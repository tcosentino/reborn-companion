// Starter picker: a card per starter with the ability and natures worth soft-resetting for.
// Curated picks live in starters/<game>/<section-id>.json; scripts/apply-starters.ts replaces the paragraph that
// lists the starters with a `starters` block. Species data (types, abilities, final form) comes from the dex at render.
// Only type-erasable TS here: the build script runs under Node's native type stripping.

export interface StarterPick {
  species: string
  // Ability SYM worth resetting for, or null when the choice barely matters
  ability: string | null
  // Best natures first, by name ("Adamant")
  natures: string[]
  note: string
}

// One file in starters/<game>/<section-id>.json
export interface StartersDef {
  // Verbatim start of the paragraph the cards replace (whitespace-trimmed)
  match: string
  title?: string
  picks: StarterPick[]
}

export interface StartersBlock {
  type: 'starters'
  title: string
  picks: StarterPick[]
  // The replaced paragraph, kept verbatim so the build can undo the swap
  markdown: string
}

// Nature -> [raised, lowered] stat; neutral natures have neither
export const NATURES: Record<string, [string, string] | null> = {
  Hardy: null, Docile: null, Serious: null, Bashful: null, Quirky: null,
  Lonely: ['Atk', 'Def'], Brave: ['Atk', 'Spe'], Adamant: ['Atk', 'SpA'], Naughty: ['Atk', 'SpD'],
  Bold: ['Def', 'Atk'], Relaxed: ['Def', 'Spe'], Impish: ['Def', 'SpA'], Lax: ['Def', 'SpD'],
  Timid: ['Spe', 'Atk'], Hasty: ['Spe', 'Def'], Jolly: ['Spe', 'SpA'], Naive: ['Spe', 'SpD'],
  Modest: ['SpA', 'Atk'], Mild: ['SpA', 'Def'], Quiet: ['SpA', 'Spe'], Rash: ['SpA', 'SpD'],
  Calm: ['SpD', 'Atk'], Gentle: ['SpD', 'Def'], Sassy: ['SpD', 'Spe'], Careful: ['SpD', 'SpA']
}

export const natureEffect = (name: string) => {
  const n = NATURES[name]
  return n ? `+${n[0]} −${n[1]}` : 'neutral'
}

export const STARTERS_ANCHOR = 'starters'

interface SpeciesLike { forms: Record<string, { abilities: string[]; hiddenAbility?: string | null }> }

export const validateStarters = (def: StartersDef, species: Record<string, SpeciesLike>): string[] => {
  const errors: string[] = []
  if (!def.match?.trim()) errors.push('missing match')
  const seen = new Set<string>()
  for (const p of def.picks ?? []) {
    if (seen.has(p.species)) errors.push(`${p.species}: listed twice`)
    seen.add(p.species)
    const form = species[p.species]?.forms['0']
    if (!form) { errors.push(`${p.species}: not in the dex`); continue }
    const abilities = [...form.abilities, form.hiddenAbility].filter(Boolean)
    if (p.ability && !abilities.includes(p.ability)) errors.push(`${p.species}: ability ${p.ability} is not one of ${abilities.join(', ')}`)
    if (!p.natures?.length) errors.push(`${p.species}: no natures`)
    p.natures?.filter(n => !(n in NATURES)).forEach(n => errors.push(`${p.species}: unknown nature "${n}"`))
    if (!p.note?.trim()) errors.push(`${p.species}: missing note`)
  }
  if (!def.picks?.length) errors.push('no picks')
  return errors
}

interface BlockLike { type: string; markdown?: string }

const paragraphs = (md: string) => md.split('\n\n').map(p => p.trim()).filter(Boolean)

// Undo an earlier swap: the starters block goes back into prose, joined with the prose around it
export const unapplyStarters = <B extends BlockLike>(blocks: (B | StartersBlock)[]): B[] => {
  const out: B[] = []
  for (const b of blocks) {
    const md = b.type === 'starters' || b.type === 'prose' ? b.markdown as string : null
    const prev = out[out.length - 1]
    if (md != null && prev?.type === 'prose') prev.markdown = `${prev.markdown}\n\n${md}`
    else if (md != null) out.push({ type: 'prose', markdown: md } as B)
    else out.push(b as B)
  }
  return out
}

// Replaces the first paragraph starting with def.match. `found` is false when no paragraph matched.
export const applyStarters = <B extends BlockLike>(blocks: (B | StartersBlock)[], def: StartersDef) => {
  const out: (B | StartersBlock)[] = []
  let found = false
  for (const b of unapplyStarters(blocks)) {
    if (found || b.type !== 'prose') { out.push(b); continue }
    const ps = paragraphs(b.markdown as string)
    const i = ps.findIndex(p => p.startsWith(def.match.trim()))
    if (i < 0) { out.push(b); continue }
    found = true
    if (i > 0) out.push({ ...b, markdown: ps.slice(0, i).join('\n\n') })
    out.push({ type: 'starters', title: def.title ?? 'Starters', picks: def.picks, markdown: ps[i] })
    if (i < ps.length - 1) out.push({ ...b, markdown: ps.slice(i + 1).join('\n\n') })
  }
  return { blocks: out, found }
}
