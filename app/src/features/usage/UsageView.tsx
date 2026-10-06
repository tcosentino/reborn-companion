import { useMemo, useState } from 'react'
// Rewritten by the Stop hook after every Claude Code turn; Vite hot-reloads it in dev
import ledgerJson from '../../../../usage/ledger.json'
import { chats, compact, days, totals, usd, type UsageLedger } from '../../lib/usage'
import './usage.css'

const ledger = ledgerJson as UsageLedger

type Sort = 'cost' | 'recent'

const fmtDay = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })

// #/usage: what building this guide cost in Claude Code tokens, per chat and per day
export default function UsageView() {
  const [sort, setSort] = useState<Sort>('cost')
  const all = useMemo(() => chats(ledger.rows), [])
  const list = useMemo(() => [...all].sort(sort === 'cost'
    ? (a, b) => b.costUSD - a.costUSD
    : (a, b) => b.lastDay.localeCompare(a.lastDay) || b.costUSD - a.costUSD), [all, sort])
  const byDay = useMemo(() => days(ledger.rows), [])
  const t = useMemo(() => totals(ledger.rows), [])
  const maxChat = Math.max(...all.map(c => c.costUSD), 0.01)
  const maxDay = Math.max(...byDay.map(d => d.costUSD), 0.01)

  return (
    <main className="usage">
      <a href="#/" className="brand">PokeGuide</a>
      <h1>Build cost</h1>
      <p className="lede">
        Claude Code tokens spent building this guide, estimated at API list prices.
        Updated {new Date(ledger.updated).toLocaleString()}.
      </p>

      <dl className="usage-tiles">
        <div><dt>Est. cost</dt><dd>{usd(t.costUSD)}</dd></div>
        <div><dt>Chats</dt><dd>{t.chats}</dd></div>
        <div><dt>Tokens</dt><dd>{compact(t.tokens)}</dd></div>
        <div><dt>Output tokens</dt><dd>{compact(t.output)}</dd></div>
      </dl>

      <section aria-labelledby="usage-days">
        <h2 id="usage-days">Cost by day</h2>
        <ol className="usage-days" style={{ gridTemplateColumns: `repeat(${byDay.length}, minmax(0, 1fr))` }}>
          {byDay.map(d => (
            <li key={d.day} title={`${d.day}: ${usd(d.costUSD)} (running total ${usd(d.cumulativeUSD)})`}>
              <span className="usage-day-value mono">{usd(d.costUSD)}</span>
              <span className="usage-day-track">
                <span className="usage-day-bar" style={{ height: `${(d.costUSD / maxDay) * 100}%` }} />
              </span>
              <span className="usage-day-label">{fmtDay(d.day)}</span>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="usage-chats">
        <div className="usage-chats-head">
          <h2 id="usage-chats">Chats</h2>
          <div className="usage-sort" role="group" aria-label="Sort chats">
            {(['cost', 'recent'] as const).map(s => (
              <button key={s} aria-pressed={sort === s} onClick={() => setSort(s)}>{s === 'cost' ? 'Most expensive' : 'Most recent'}</button>
            ))}
          </div>
        </div>
        <ol className="usage-chats">
          {list.map(c => (
            <li key={c.session} title={c.session}>
              <div className="usage-chat-text">
                <span className="usage-chat-title">{c.title || <span className="muted">Untitled ({c.session.slice(0, 8)})</span>}</span>
                <span className="usage-chat-meta">
                  {fmtDay(c.firstDay)}{c.lastDay !== c.firstDay ? `–${fmtDay(c.lastDay)}` : ''}
                  {c.source !== 'main' && <> · {c.source}</>}
                  {' · '}{c.models.map(([m, cost]) => `${m} ${usd(cost)}`).join(', ')}
                  {' · '}{compact(c.tokens)} tokens
                </span>
              </div>
              <span className="usage-chat-track" aria-hidden>
                <span className="usage-chat-bar" style={{ width: `${(c.costUSD / maxChat) * 100}%` }} />
              </span>
              <span className="usage-chat-cost mono">{usd(c.costUSD)}</span>
            </li>
          ))}
        </ol>
      </section>

      {ledger.unpricedModels.length > 0 && (
        <p className="muted">Not priced (tokens counted, cost excluded): {ledger.unpricedModels.join(', ')}</p>
      )}
      <p className="muted usage-note">
        Background calls that never reach a transcript (permission checks, chat titles) are not counted, so totals run a few
        percent low. Source: <code>usage/ledger.json</code>, written by <code>scripts/token-usage.ts</code>.
      </p>
    </main>
  )
}
