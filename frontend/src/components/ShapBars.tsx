import type { Explanation } from '../api'

type Props = {
  explanation: Explanation
}

export default function ShapBars({ explanation }: Props) {
  const ups = explanation.increasing_risk_factors
  const downs = explanation.decreasing_risk_factors
  const max = Math.max(
    0.001,
    ...ups.map((f) => Math.abs(f.impact)),
    ...downs.map((f) => Math.abs(f.impact)),
  )

  return (
    <div className="hud-grid cols-2">
      <div className="panel">
        <div className="panel-title">Risk amplifiers</div>
        {ups.length === 0 && <p className="muted">None in top factors.</p>}
        {ups.map((f) => (
          <div key={f.feature + f.impact}>
            <div className="bar-row">
              <span style={{ fontSize: '0.75rem' }}>{f.feature}</span>
              <span className="muted">{f.impact.toFixed(3)}</span>
            </div>
            <div className="bar-track">
              <div
                className="bar-fill"
                style={{ width: `${(Math.abs(f.impact) / max) * 100}%` }}
              />
            </div>
            <p className="muted" style={{ fontSize: '0.7rem', margin: '0.25rem 0 0.75rem' }}>
              {f.explanation}
            </p>
          </div>
        ))}
      </div>
      <div className="panel">
        <div className="panel-title">Retention shields</div>
        {downs.length === 0 && <p className="muted">None in top factors.</p>}
        {downs.map((f) => (
          <div key={f.feature + f.impact}>
            <div className="bar-row">
              <span style={{ fontSize: '0.75rem' }}>{f.feature}</span>
              <span className="muted">{f.impact.toFixed(3)}</span>
            </div>
            <div className="bar-track">
              <div
                className="bar-fill safe"
                style={{ width: `${(Math.abs(f.impact) / max) * 100}%` }}
              />
            </div>
            <p className="muted" style={{ fontSize: '0.7rem', margin: '0.25rem 0 0.75rem' }}>
              {f.explanation}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
