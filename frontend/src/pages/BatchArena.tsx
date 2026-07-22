import { useState } from 'react'
import {
  batchDownloadUrl,
  getBatchTable,
  getCustomerDetail,
  predictBatch,
  type BatchPredictResponse,
  type Prediction,
  type SinglePredictResponse,
} from '../api'
import CsvDropzone from '../components/CsvDropzone'
import RiskMeter from '../components/RiskMeter'
import ScoreTicker from '../components/ScoreTicker'
import ShapBars from '../components/ShapBars'
import SimpleBars from '../components/SimpleBars'

export default function BatchArena() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [batch, setBatch] = useState<BatchPredictResponse | null>(null)
  const [rows, setRows] = useState<Prediction[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalRows, setTotalRows] = useState(0)
  const [filter, setFilter] = useState('')
  const [detail, setDetail] = useState<SinglePredictResponse | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const loadPage = async (p: number) => {
    const table = await getBatchTable(p, 50)
    setRows(table.customers)
    setPage(table.page)
    setTotalPages(table.total_pages)
    setTotalRows(table.total_rows)
  }

  const onFile = async (file: File) => {
    setBusy(true)
    setError(null)
    setDetail(null)
    try {
      const data = await predictBatch(file)
      setBatch(data)
      await loadPage(1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Batch failed')
      setBatch(null)
    } finally {
      setBusy(false)
    }
  }

  const openDetail = async (customerID?: string) => {
    if (!customerID) return
    setDetailLoading(true)
    setDetailId(customerID)
    setError(null)
    try {
      const data = await getCustomerDetail(customerID)
      setDetail(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Detail lookup failed')
    } finally {
      setDetailLoading(false)
    }
  }

  const filtered = rows.filter((r) => {
    if (!filter) return true
    const q = filter.toLowerCase()
    return (
      String(r.customerID ?? '').toLowerCase().includes(q) ||
      r.risk_level.toLowerCase().includes(q) ||
      r.prediction.toLowerCase().includes(q)
    )
  })

  return (
    <div className="stack">
      <div>
        <h1>Batch Arena</h1>
        <p className="muted">Upload a roster CSV and rack up the churn scores.</p>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <CsvDropzone onFile={onFile} busy={busy} />

      {batch && (
        <>
          <div className="hud-grid cols-4">
            <div className="score-tile">
              <div className="label">Players</div>
              <div className="value">
                <ScoreTicker value={batch.kpis.total_customers} />
              </div>
            </div>
            <div className="score-tile danger">
              <div className="label">High risk</div>
              <div className="value">
                <ScoreTicker value={batch.kpis.high_risk_count} />
              </div>
            </div>
            <div className="score-tile">
              <div className="label">Avg churn %</div>
              <div className="value">
                <ScoreTicker value={batch.kpis.average_churn_probability} decimals={1} />
              </div>
            </div>
            <div className="score-tile danger">
              <div className="label">Rev at risk $</div>
              <div className="value" style={{ fontSize: '1.35rem' }}>
                <ScoreTicker value={batch.kpis.predicted_revenue_loss} decimals={0} />
              </div>
            </div>
          </div>

          <div className="hud-grid cols-2">
            <div className="panel">
              <div className="panel-title">Churn vs stay</div>
              <SimpleBars data={batch.charts.churn_vs_stay} color="var(--coral)" />
            </div>
            <div className="panel">
              <div className="panel-title">Risk distribution</div>
              <SimpleBars data={batch.charts.risk_distribution} color="var(--amber)" />
            </div>
            <div className="panel">
              <div className="panel-title">Contract vs avg churn %</div>
              <SimpleBars data={batch.charts.contract_type_vs_churn} color="var(--cyan)" />
            </div>
            <div className="panel">
              <div className="panel-title">Business intel</div>
              {Object.values(batch.business_insights.calculated_patterns).map((t) => (
                <p key={t} style={{ fontSize: '0.8rem', lineHeight: 1.45 }}>
                  {t}
                </p>
              ))}
              {batch.business_insights.business_recommendation && (
                <p
                  style={{
                    fontSize: '0.85rem',
                    borderTop: '2px solid var(--ink)',
                    paddingTop: '0.75rem',
                    marginTop: '0.5rem',
                  }}
                >
                  <strong>Playbook:</strong> {batch.business_insights.business_recommendation}
                </p>
              )}
            </div>
          </div>

          <div className="panel">
            <div className="row-actions" style={{ justifyContent: 'space-between' }}>
              <div className="panel-title" style={{ margin: 0 }}>
                Roster · {totalRows} rows
              </div>
              <div className="row-actions">
                <input
                  placeholder="Filter id / risk…"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  style={{
                    border: '2px solid var(--ink)',
                    padding: '0.4rem 0.6rem',
                    background: 'var(--playfield)',
                  }}
                />
                <a className="btn" href={batchDownloadUrl()}>
                  Download CSV
                </a>
              </div>
            </div>

            <div className="table-wrap" style={{ marginTop: '0.75rem' }}>
              <table className="roster">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Probability</th>
                    <th>Risk</th>
                    <th>Prediction</th>
                    <th>Rev loss</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r, i) => (
                    <tr
                      key={`${r.customerID ?? i}-${i}`}
                      onClick={() => openDetail(r.customerID)}
                    >
                      <td>{r.customerID ?? '—'}</td>
                      <td>{r.probability}%</td>
                      <td>
                        <span className={`chip ${r.risk_level.toLowerCase()}`}>
                          {r.risk_level}
                        </span>
                      </td>
                      <td>{r.prediction}</td>
                      <td>${r.ExpectedRevenueLoss}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pager">
              <button
                className="btn btn-ghost"
                disabled={page <= 1}
                onClick={() => loadPage(page - 1)}
              >
                Prev
              </button>
              <span className="muted">
                Page {page} / {totalPages}
              </span>
              <button
                className="btn btn-ghost"
                disabled={page >= totalPages}
                onClick={() => loadPage(page + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}

      {(detail || detailLoading) && (
        <>
          <div className="drawer-backdrop" onClick={() => setDetail(null)} />
          <aside className="drawer">
            <div className="row-actions" style={{ justifyContent: 'space-between' }}>
              <h2 style={{ fontSize: '1.1rem' }}>{detailId}</h2>
              <button className="btn btn-ghost" onClick={() => setDetail(null)}>
                Close
              </button>
            </div>
            {detailLoading && <p className="muted">Loading detail…</p>}
            {detail && (
              <div className="stack" style={{ marginTop: '1rem' }}>
                <div style={{ textAlign: 'center' }}>
                  <RiskMeter
                    value={detail.prediction.probability}
                    risk={detail.prediction.risk_level}
                  />
                  <div style={{ marginTop: '0.75rem' }}>
                    <span
                      className={`risk-banner ${detail.prediction.risk_level.toLowerCase()}`}
                    >
                      {detail.prediction.risk_level}
                    </span>
                  </div>
                </div>
                <ShapBars explanation={detail.explanation} />
                <div>
                  <div className="panel-title">Retention plays</div>
                  <ul className="strategy-list">
                    {detail.retention_strategies.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </aside>
        </>
      )}
    </div>
  )
}
