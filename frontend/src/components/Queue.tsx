import type { Finding, HeroFinding, SortKey } from '../types'

type QueueProps = {
  analysisId: number | null
  findings: Finding[]
  totalCount: number | undefined
  visibleCount: number
  search: string
  severity: string
  sortKey: SortKey
  sortDir: 'asc' | 'desc'
  selectedId: number | null
  heroFindings: HeroFinding[] | undefined
  showHeroHints: boolean
  onSearchChange: (value: string) => void
  onSeverityChange: (value: string) => void
  onToggleSort: (key: SortKey) => void
  onSelect: (finding: Finding) => void
  onHeroSelect: (hero: HeroFinding) => void
}

function sortIndicator(active: boolean, dir: 'asc' | 'desc') {
  if (!active) return ''
  return dir === 'asc' ? ' ↑' : ' ↓'
}

export function Queue({
  analysisId,
  findings,
  totalCount,
  visibleCount,
  search,
  severity,
  sortKey,
  sortDir,
  selectedId,
  heroFindings,
  showHeroHints,
  onSearchChange,
  onSeverityChange,
  onToggleSort,
  onSelect,
  onHeroSelect,
}: QueueProps) {
  return (
    <section className="queue-panel" aria-label="Findings queue">
      <div className="panel-head">
        <h2>
          Findings
          {totalCount != null && ` (${visibleCount}/${totalCount})`}
        </h2>
      </div>
      {analysisId != null && (
        <div className="queue-toolbar">
          <input
            type="search"
            className="search-box"
            placeholder="Search site, rule, or message…"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          <select value={severity} onChange={(e) => onSeverityChange(e.target.value)}>
            <option value="">All severities</option>
            <option value="critical">Critical</option>
            <option value="warning">Warning</option>
          </select>
        </div>
      )}
      <div className="queue-body">
        {!analysisId && (
          <p className="queue-empty">Run analysis to populate the exception queue.</p>
        )}
        {analysisId != null && !findings.length && !showHeroHints && (
          <p className="queue-empty">
            {search.trim()
              ? `No findings match "${search}".`
              : 'No findings in this run.'}
          </p>
        )}
        {showHeroHints && heroFindings && heroFindings.length > 0 && (
          <div className="hero-hints-block">
            <span className="hero-hints-label">Top findings from this run</span>
            <ul className="hero-hints">
              {heroFindings.slice(0, 3).map((h, i) => (
                <li key={`${h.site_id}-${h.rule_id}-${i}`}>
                  <button
                    type="button"
                    className="hero-hint-btn"
                    onClick={() => onHeroSelect(h)}
                  >
                    <span className={`sev ${h.severity}`}>{h.severity}</span>{' '}
                    <span className="mono">{h.site_id}</span>{' '}
                    <span className="mono">{h.rule_id}</span>
                    <br />
                    {h.message}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {findings.length > 0 && (
          <table>
            <thead>
              <tr>
                <th onClick={() => onToggleSort('severity')}>
                  Severity{sortIndicator(sortKey === 'severity', sortDir)}
                </th>
                <th onClick={() => onToggleSort('site_id')}>
                  Site{sortIndicator(sortKey === 'site_id', sortDir)}
                </th>
                <th onClick={() => onToggleSort('rule_id')}>
                  Rule{sortIndicator(sortKey === 'rule_id', sortDir)}
                </th>
                <th>Message</th>
              </tr>
            </thead>
            <tbody>
              {findings.map((f) => (
                <tr
                  key={f.id}
                  className={selectedId === f.id ? 'selected' : ''}
                  onClick={() => onSelect(f)}
                >
                  <td>
                    <span className={`sev ${f.severity}`}>{f.severity}</span>
                  </td>
                  <td className="mono">{f.site_id}</td>
                  <td className="mono">{f.rule_id}</td>
                  <td>{f.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  )
}
