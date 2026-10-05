// Dependency-free PNG cropper (non-interlaced, bit depth >= 8). Keeps the original color type,
// palette and transparency chunks, so pixel art stays byte-exact.
import { deflateSync, inflateSync } from 'node:zlib'

interface Chunk { type: string; data: Buffer }

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = (buf: Buffer) => {
  let c = 0xffffffff
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

const readChunks = (png: Buffer): Chunk[] => {
  const chunks: Chunk[] = []
  let p = 8
  while (p + 12 <= png.length) {
    const len = png.readUInt32BE(p)
    const type = png.toString('latin1', p + 4, p + 8)
    chunks.push({ type, data: png.subarray(p + 8, p + 8 + len) })
    if (type === 'IEND') break
    p += 12 + len
  }
  return chunks
}

const writeChunk = (type: string, data: Buffer) => {
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data])
  const out = Buffer.alloc(body.length + 8)
  out.writeUInt32BE(data.length, 0)
  body.copy(out, 4)
  out.writeUInt32BE(crc32(body), body.length + 4)
  return out
}

const channels: Record<number, number> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }

const paeth = (a: number, b: number, c: number) => {
  const p = a + b - c
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c)
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
}

interface Decoded { chunks: Chunk[]; ihdr: Buffer; width: number; height: number; colorType: number; bpp: number; stride: number; px: Buffer }

// Unfiltered pixel bytes of an 8/16-bit, non-interlaced PNG
const decodePng = (png: Buffer): Decoded => {
  const chunks = readChunks(png)
  const ihdr = chunks.find(c => c.type === 'IHDR')!.data
  const width = ihdr.readUInt32BE(0), height = ihdr.readUInt32BE(4)
  const depth = ihdr[8], colorType = ihdr[9], interlace = ihdr[12]
  if (depth < 8 || interlace !== 0 || !(colorType in channels)) throw new Error('unsupported PNG layout')
  const bpp = (channels[colorType] * depth) / 8
  const stride = width * bpp
  const raw = inflateSync(Buffer.concat(chunks.filter(c => c.type === 'IDAT').map(c => c.data)))
  const px = Buffer.alloc(stride * height)
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]
    const src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1))
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? px[y * stride + i - bpp] : 0
      const b = y > 0 ? px[(y - 1) * stride + i] : 0
      const c = y > 0 && i >= bpp ? px[(y - 1) * stride + i - bpp] : 0
      const add = filter === 0 ? 0 : filter === 1 ? a : filter === 2 ? b : filter === 3 ? (a + b) >> 1 : paeth(a, b, c)
      px[y * stride + i] = (src[i] + add) & 0xff
    }
  }
  return { chunks, ihdr, width, height, colorType, bpp, stride, px }
}

export interface Box { x: number; y: number; w: number; h: number }

// Bounding box of visible (non-transparent) pixels inside a region, or null if it is empty.
// Handles RGBA, gray+alpha and paletted images with a tRNS chunk; other layouts count as opaque.
export const alphaBounds = (png: Buffer, region: Box): Box | null => {
  const { chunks, width, height, colorType, bpp, stride, px } = decodePng(png)
  const trns = chunks.find(c => c.type === 'tRNS')?.data
  const visible = (x: number, y: number) => {
    const o = y * stride + x * bpp
    if (colorType === 6) return px[o + bpp - (bpp === 8 ? 2 : 1)] > 0
    if (colorType === 4) return px[o + bpp - (bpp === 4 ? 2 : 1)] > 0
    if (colorType === 3) return !trns || px[o] >= trns.length || trns[px[o]] > 0
    return true
  }
  let minX = Infinity, minY = Infinity, maxX = -1, maxY = -1
  for (let y = Math.max(0, region.y); y < Math.min(height, region.y + region.h); y++) {
    for (let x = Math.max(0, region.x); x < Math.min(width, region.x + region.w); x++) {
      if (!visible(x, y)) continue
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
  return maxX < 0 ? null : { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 }
}

export const cropPng = (png: Buffer, x0: number, y0: number, w: number, h: number): Buffer => {
  const { chunks, ihdr, width, height, bpp, stride, px } = decodePng(png)
  const out = Buffer.alloc((w * bpp + 1) * h)
  for (let y = 0; y < h; y++) {
    const sy = y0 + y
    // Rows outside the source stay zero (transparent / black), filter type 0.
    if (sy < 0 || sy >= height) continue
    for (let x = 0; x < w; x++) {
      const sx = x0 + x
      if (sx < 0 || sx >= width) continue
      px.copy(out, y * (w * bpp + 1) + 1 + x * bpp, sy * stride + sx * bpp, sy * stride + (sx + 1) * bpp)
    }
  }
  const newHdr = Buffer.from(ihdr)
  newHdr.writeUInt32BE(w, 0)
  newHdr.writeUInt32BE(h, 4)
  const keep = chunks.filter(c => ['PLTE', 'tRNS'].includes(c.type))
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    writeChunk('IHDR', newHdr),
    ...keep.map(c => writeChunk(c.type, c.data)),
    writeChunk('IDAT', deflateSync(out)),
    writeChunk('IEND', Buffer.alloc(0))
  ])
}
