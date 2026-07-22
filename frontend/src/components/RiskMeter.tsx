type Props = {
  value: number
  risk?: string
}

export default function RiskMeter({ value, risk }: Props) {
  const clamped = Math.max(0, Math.min(100, value))
  const r = 54
  const c = 2 * Math.PI * r
  const offset = c - (clamped / 100) * c
  const color =
    risk === 'High' ? 'var(--coral)' : risk === 'Medium' ? 'var(--amber)' : 'var(--lime)'

  return (
    <div className="risk-meter" aria-label={`Churn probability ${clamped}%`}>
      <svg viewBox="0 0 120 120">
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="var(--playfield-2)"
          strokeWidth="12"
        />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="square"
          style={{ transition: 'stroke-dashoffset 0.7s ease' }}
        />
      </svg>
      <div className="center">
        <div className="pct">{clamped.toFixed(1)}</div>
        <div className="muted" style={{ fontSize: '0.65rem' }}>
          % CHURN
        </div>
      </div>
    </div>
  )
}
