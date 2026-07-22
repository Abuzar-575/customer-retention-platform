import { useEffect, useState } from 'react'
import { getModelComparison, type ModelComparison } from '../api'

export default function ModelLab() {
  const [data, setData] = useState<ModelComparison | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getModelComparison()
      .then(setData)
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Failed to load models'),
      )
      .finally(() => setLoading(false))
  }, [])

  const ranked = data
    ? Object.entries(data.models).sort((a, b) => b[1].roc_auc - a[1].roc_auc)
    : []

  return (
    <div className="stack">
      <div>
        <h1>Model Lab</h1>
        <p className="muted">High-score board for the trained churn models.</p>
      </div>

      {loading && <p className="muted">Loading leaderboard…</p>}
      {error && <div className="error-banner">{error}</div>}

      {data && (
        <>
          <div className="panel" style={{ textAlign: 'center' }}>
            <div className="panel-title">Reigning champion</div>
            <h2 style={{ fontSize: '2rem', color: 'var(--ink)' }}>{data.best_model}</h2>
            <p className="muted">Best overall pick from training metrics</p>
          </div>

          <div className="leaderboard">
            {ranked.map(([name, m], i) => (
              <div
                key={name}
                className={`leader-row ${name === data.best_model ? 'best' : ''}`}
              >
                <div className="rank">#{i + 1}</div>
                <div>
                  <strong style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem' }}>
                    {name}
                    {name === data.best_model ? ' ★' : ''}
                  </strong>
                  <div className="metric-pills">
                    <span>ACC {(m.accuracy * 100).toFixed(1)}%</span>
                    <span>PREC {(m.precision * 100).toFixed(1)}%</span>
                    <span>REC {(m.recall * 100).toFixed(1)}%</span>
                    <span>F1 {(m.f1 * 100).toFixed(1)}%</span>
                    <span>AUC {(m.roc_auc * 100).toFixed(1)}%</span>
                  </div>
                </div>
                <div
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 800,
                    fontSize: '1.4rem',
                  }}
                >
                  {(m.roc_auc * 100).toFixed(0)}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
