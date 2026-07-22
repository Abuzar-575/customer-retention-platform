type Props = {
  data: Record<string, number>
  color?: string
}

export default function SimpleBars({ data, color = 'var(--cyan)' }: Props) {
  const entries = Object.entries(data)
  const max = Math.max(1, ...entries.map(([, v]) => v))

  if (entries.length === 0) {
    return <p className="muted">No chart data yet.</p>
  }

  return (
    <div className="chart-bars">
      {entries.map(([name, value]) => (
        <div className="col" key={name}>
          <span style={{ fontSize: '0.65rem' }}>{value}</span>
          <div
            className="fill"
            style={{ height: `${(value / max) * 100}%`, background: color }}
          />
          <span className="name">{name}</span>
        </div>
      ))}
    </div>
  )
}
