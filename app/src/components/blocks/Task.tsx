import type { ReactNode } from 'react'
import type { TaskBlock, TaskKind } from '../../lib/tasks'
import { taskAnchor } from '../../lib/tasks'
import { dexHref } from '../../lib/route'
import { MonSprite } from '../dex/MonSprite'
import { useDex, useGame } from '../common'
import { usePokedex } from '../pokedex/context'

const KIND_LABEL: Record<TaskKind, string> = { catch: 'Catch', quest: 'Side quest', item: 'Get item' }

// A walkthrough task: an optional catch, side quest or NPC item lifted out of the prose (lib/tasks.ts).
// The original paragraph stays as the instructions, passed in as children so it renders like the rest of the prose.
// Later tasks sharing a paragraph have no text and render as a header row under the first.
export const Task = ({ b, done, onToggle, collapsed, children }: {
  b: TaskBlock; done: boolean; onToggle: (b: TaskBlock) => void; collapsed?: boolean; children: ReactNode
}) => {
  const dex = useDex()
  const pokedex = usePokedex()
  const game = useGame()
  // dex.json only has species that appear in battles and tables; gifts like Smoochum may only be in pokedex.json
  const name = (s: string) => dex.species[s]?.name ?? pokedex?.dex.species[s]?.name ?? s
  const species = b.species ?? []
  return (
    <article className={`task k-${b.kind}${done ? ' is-done' : ''}${done && collapsed ? ' is-collapsed' : ''}${b.markdown ? '' : ' is-sibling'}`} id={taskAnchor(b.slug)}>
      <div className="task-head">
        <label className="task-check">
          <input type="checkbox" checked={done} onChange={() => onToggle(b)} aria-label={`Done: ${b.title}`} />
        </label>
        <div className="task-name">
          <span className="eyebrow">Task · {KIND_LABEL[b.kind]}</span>
          <h3>{b.title}</h3>
        </div>
        {species.length > 0 && (
          <div className="task-mons">
            {species.map(s => (
              <a key={s} href={dexHref(game.id, s)} title={name(s)}>
                <MonSprite species={s} size="icon" alt={name(s)} />
              </a>
            ))}
          </div>
        )}
      </div>
      {b.markdown && <div className="task-body">{children}</div>}
    </article>
  )
}
