// Section overrides: replace the body of one heading in an upstream raw markdown file.
// Each override is a markdown file with frontmatter naming the target:
//
//   ---
//   file: main_ep_01.md
//   heading: All Aboard!
//   ---
//   Replacement body...
//
// The heading line is kept; everything after it up to the next heading of the same or higher
// level is replaced. Applying fails loudly if the heading is missing or ambiguous.

export interface Override {
  source: string
  file: string
  heading: string
  body: string
}

const FRONTMATTER = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/

export const parseOverride = (source: string, text: string): Override => {
  const match = FRONTMATTER.exec(text.replace(/\r\n/g, '\n'))
  if (!match) throw new Error(`${source}: missing frontmatter`)
  const fields = Object.fromEntries(
    match[1].split('\n')
      .map(line => /^(\w+):\s*(.*)$/.exec(line))
      .filter((m): m is RegExpExecArray => m !== null)
      .map(m => [m[1], m[2].trim()])
  )
  if (!fields.file || !fields.heading) throw new Error(`${source}: frontmatter needs file and heading`)
  return { source, file: fields.file, heading: fields.heading, body: match[2].trim() }
}

const headingLevel = (line: string) => /^(#{1,6})\s/.exec(line)?.[1].length ?? 0

export const applyOverride = (markdown: string, override: Override): string => {
  const lines = markdown.split('\n')
  const isTarget = (line: string) =>
    headingLevel(line) > 0 && line.replace(/^#+\s+/, '').trim() === override.heading
  const hits = lines.flatMap((line, i) => (isTarget(line) ? [i] : []))
  if (hits.length !== 1) {
    throw new Error(`${override.source}: expected one "${override.heading}" heading in ${override.file}, found ${hits.length}`)
  }
  const start = hits[0]
  const level = headingLevel(lines[start])
  const nextIdx = lines.findIndex((line, i) => i > start && headingLevel(line) > 0 && headingLevel(line) <= level)
  const end = nextIdx === -1 ? lines.length : nextIdx
  const tail = end < lines.length ? ['', ...lines.slice(end)] : []
  return [...lines.slice(0, start + 1), '', override.body, ...tail].join('\n')
}
