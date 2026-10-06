// Item icon file resolution shared by scripts/build-sprites.ts and its tests.
// Mirrors the game's pbItemIconFile (Utilities.rb): TMs use the icon of the taught move's type,
// items with an :image flag use that file, everything else uses Graphics/Icons/<SYM>.png.

export interface RubyEntry { name?: string; tm?: string; image?: string; type?: string }

// Top-level `:SYM => { ... }` entries of an ITEMHASH / MOVEHASH Ruby script, with the scalar fields we need
export const parseRubyHash = (src: string): Record<string, RubyEntry> => {
  const out: Record<string, RubyEntry> = {}
  for (const [, sym, body] of src.matchAll(/^ {2}:([A-Z0-9_]+) => \{\n([\s\S]*?)^ {2}\}/gm)) {
    const entry: RubyEntry = {}
    for (const [, key, sval, symval] of body.matchAll(/^\s*:(name|tm|image|type) => (?:"([^"]*)"|:([A-Za-z0-9_]+))/gm)) {
      entry[key as keyof RubyEntry] = sval ?? symval
    }
    out[sym] = entry
  }
  return out
}

const titleCase = (s: string) => s.charAt(0) + s.slice(1).toLowerCase()

/** File name in Graphics/Icons for an item, or null. `files` maps lowercase file name to its real spelling. */
export const itemIconSource = (
  sym: string,
  item: RubyEntry,
  moves: Record<string, RubyEntry>,
  files: Map<string, string>
): string | null => {
  const find = (base: string) => files.get(`${base}.png`.toLowerCase()) ?? null
  if (item.tm) {
    const type = moves[item.tm]?.type
    return type ? find(`TM - ${titleCase(type)}`) : null
  }
  return (item.image && find(item.image)) || find(sym)
}
