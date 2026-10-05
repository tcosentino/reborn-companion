// Applies overrides/<game>/*.md to a copy of upstream's raw markdown.
//
// Usage (node >= 23.6 runs .ts directly):
//   node scripts/apply-overrides.ts <overridesDir> <rawGameDir>
// <rawGameDir> is edited in place, so pass a scratch copy, never upstream/src/_raw itself.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { applyOverride, parseOverride } from './overrides.ts'

const [overridesDir, rawDir] = process.argv.slice(2)
if (!overridesDir || !rawDir) {
  console.error('usage: node scripts/apply-overrides.ts <overridesDir> <rawGameDir>')
  process.exit(1)
}

const files = existsSync(overridesDir)
  ? readdirSync(overridesDir).filter(f => f.endsWith('.md')).sort()
  : []

for (const name of files) {
  const override = parseOverride(name, readFileSync(join(overridesDir, name), 'utf8'))
  const target = join(rawDir, override.file)
  if (!existsSync(target)) throw new Error(`${name}: ${override.file} not found in ${rawDir}`)
  writeFileSync(target, applyOverride(readFileSync(target, 'utf8'), override))
}

console.log(`applied ${files.length} override(s) from ${overridesDir}`)
