import type { ReactNode } from 'react'
import type { TaskBlock, TaskKind } from '../../lib/tasks'
import { taskAnchor } from '../../lib/tasks'
import { dexHref } from '../../lib/route'
import { MonSprite } from '../dex/MonSprite'
import { useDex, useGame } from '../common'

const KIND_LABEL: Record<TaskKind, string> = { catch: 'Catch', quest: 'Side quest', item: 'Get item' }

// A walkthrough task: an optional catch, side quest or NPC item lifted out of the prose (lib/tasks.ts).
// The original paragraph stays as the instructions, passed in as children so it renders like the rest of the prose.
// Later tasks sharing a paragraph have no text and render as a header row under the first.
export const Task = ({ b, done, onToggle, collapsed, children }: {
  b: TaskBlock; done: boolean; onToggle: (b: TaskBlock) => void; collapsed?: boolean; children: ReactNode
}) => {
  const dex = useDex()
  const game = useGame()
  const species = (b.species ?? []).filter(s => dex.species[s])
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
              <a key={s} href={dexHref(game.id, s)} title={dex.species[s].name}>
                <MonSprite species={s} size="icon" alt={dex.species[s].name} />
              </a>
            ))}
          </div>
        )}
      </div>
      {b.markdown && <div className="task-body">{children}</div>}
    </article>
  )
}
