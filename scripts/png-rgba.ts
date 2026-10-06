// Dependency-free RGBA image buffer for compositing game graphics (8-bit PNGs: RGB, RGBA, paletted).
import { deflateSync } from 'node:zlib'
import { decodePng, writeChunk } from './png-crop.ts'

export interface Rgba { w: number; h: number; px: Uint8Array }

export const blank = (w: number, h: number, fill = [0, 0, 0, 0]): Rgba => {
  const px = new Uint8Array(w * h * 4)
  for (let i = 0; i < px.length; i += 4) px.set(fill, i)
  return { w, h, px }
}

export const readPng = (png: Buffer): Rgba => {
  const { chunks, width, height, colorType, bpp, stride, px } = decodePng(png)
  const ihdr = chunks.find(c => c.type === 'IHDR')!.data
  if (ihdr[8] !== 8) throw new Error('only 8-bit PNGs are supported')
  const plte = chunks.find(c => c.type === 'PLTE')?.data
  const trns = chunks.find(c => c.type === 'tRNS')?.data
  const out = new Uint8Array(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const s = y * stride + x * bpp, d = (y * width + x) * 4
      if (colorType === 6) out.set(px.subarray(s, s + 4), d)
      else if (colorType === 2) out.set([px[s], px[s + 1], px[s + 2], 255], d)
      else if (colorType === 3) {
        const i = px[s]
        out.set([plte![i * 3], plte![i * 3 + 1], plte![i * 3 + 2], trns && i < trns.length ? trns[i] : 255], d)
      } else if (colorType === 0) out.set([px[s], px[s], px[s], 255], d)
      else out.set([px[s], px[s], px[s], px[s + 1]], d)
    }
  }
  return { w: width, h: height, px: out }
}

export const writePng = (img: Rgba): Buffer => {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(img.w, 0)
  ihdr.writeUInt32BE(img.h, 4)
  ihdr.set([8, 6, 0, 0, 0], 8)
  const raw = Buffer.alloc((img.w * 4 + 1) * img.h)
  for (let y = 0; y < img.h; y++) raw.set(img.px.subarray(y * img.w * 4, (y + 1) * img.w * 4), y * (img.w * 4 + 1) + 1)
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    writeChunk('IHDR', ihdr),
    writeChunk('IDAT', deflateSync(raw, { level: 9 })),
    writeChunk('IEND', Buffer.alloc(0))
  ])
}

export type Blend = 'normal' | 'add'

// Draws a w*h region of src at (sx, sy) onto dst at (dx, dy). `opacity` is 0-255 on top of the source alpha.
export const draw = (dst: Rgba, src: Rgba, sx: number, sy: number, w: number, h: number, dx: number, dy: number, opacity = 255, blend: Blend = 'normal') => {
  for (let y = 0; y < h; y++) {
    const ty = dy + y, fy = sy + y
    if (ty < 0 || ty >= dst.h || fy < 0 || fy >= src.h) continue
    for (let x = 0; x < w; x++) {
      const tx = dx + x, fx = sx + x
      if (tx < 0 || tx >= dst.w || fx < 0 || fx >= src.w) continue
      const s = (fy * src.w + fx) * 4, d = (ty * dst.w + tx) * 4
      const a = (src.px[s + 3] * opacity) / 65025
      if (a <= 0) continue
      for (let c = 0; c < 3; c++) {
        dst.px[d + c] = blend === 'add'
          ? Math.min(255, dst.px[d + c] + src.px[s + c] * a)
          : Math.round(src.px[s + c] * a + dst.px[d + c] * (1 - a))
      }
      if (blend === 'normal') dst.px[d + 3] = Math.round(255 * a + dst.px[d + 3] * (1 - a))
    }
  }
}

export const crop = (img: Rgba, x: number, y: number, w: number, h: number): Rgba => {
  const out = blank(w, h, [0, 0, 0, 255])
  draw(out, img, x, y, w, h, 0, 0)
  return out
}
