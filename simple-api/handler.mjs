/**
 * Score API handlers — used by Vite (same process as the frontend)
 * and by standalone `node simple-api/server.mjs`.
 */
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

const session = {
  lastBatch: null,
  lastRaw: null,
  lastInsights: null,
}

function riskLevel(p) {
  if (p >= 70) return 'High'
  if (p >= 40) return 'Medium'
  return 'Low'
}

function scoreCustomer(c) {
  let p = 25
  if (c.Contract === 'Month-to-month') p += 28
  if (c.Contract === 'One year') p += 8
  if (c.InternetService === 'Fiber optic') p += 12
  if (c.PaymentMethod === 'Electronic check') p += 10
  if (c.OnlineSecurity === 'No') p += 8
  if (c.TechSupport === 'No') p += 8
  if (Number(c.tenure) < 6) p += 15
  else if (Number(c.tenure) < 12) p += 8
  else if (Number(c.tenure) > 48) p -= 12
  if (Number(c.MonthlyCharges) > 90) p += 10
  if (c.PaperlessBilling === 'Yes') p += 4
  if (c.Partner === 'No') p += 4
  if (Number(c.SeniorCitizen) === 1) p += 5
  p = Math.max(3, Math.min(97, Math.round(p * 10) / 10))
  const monthly = Number(c.MonthlyCharges) || 0
  return {
    customerID: c.customerID,
    probability: p,
    risk_level: riskLevel(p),
    prediction: p > 50 ? 'Churn' : 'No Churn',
    MonthlyCharges: Math.round(monthly * 100) / 100,
    ExpectedRevenueLoss: Math.round((p / 100) * monthly * 100) / 100,
  }
}

function explain(c, pred) {
  const increasing = []
  const decreasing = []
  if (c.Contract === 'Month-to-month') {
    increasing.push({
      feature: 'Contract: Month-to-month',
      impact: 0.18,
      explanation: 'Month-to-month contract raises churn risk.',
    })
  }
  if (c.InternetService === 'Fiber optic') {
    increasing.push({
      feature: 'InternetService: Fiber optic',
      impact: 0.09,
      explanation: 'Fiber optic customers show higher churn pressure.',
    })
  }
  if (c.PaymentMethod === 'Electronic check') {
    increasing.push({
      feature: 'PaymentMethod: Electronic check',
      impact: 0.07,
      explanation: 'Electronic check payments correlate with higher risk.',
    })
  }
  if (Number(c.tenure) < 6) {
    increasing.push({
      feature: 'tenure',
      impact: 0.12,
      explanation: `Short tenure (${c.tenure} months) increases risk.`,
    })
  }
  if (c.OnlineSecurity === 'No') {
    increasing.push({
      feature: 'OnlineSecurity: No',
      impact: 0.06,
      explanation: 'No online security add-on increases risk.',
    })
  }
  if (c.Contract === 'Two year') {
    decreasing.push({
      feature: 'Contract: Two year',
      impact: -0.15,
      explanation: 'Two-year contract helps retention.',
    })
  }
  if (Number(c.tenure) > 24) {
    decreasing.push({
      feature: 'tenure',
      impact: -0.1,
      explanation: `Longer tenure (${c.tenure} months) lowers risk.`,
    })
  }
  if (c.TechSupport === 'Yes') {
    decreasing.push({
      feature: 'TechSupport: Yes',
      impact: -0.05,
      explanation: 'Tech support helps keep this customer.',
    })
  }
  if (!increasing.length) {
    increasing.push({
      feature: 'profile',
      impact: 0.04,
      explanation: `Current risk score is ${pred.probability}%.`,
    })
  }
  if (!decreasing.length) {
    decreasing.push({
      feature: 'baseline',
      impact: -0.03,
      explanation: 'Some profile factors are neutral-to-stable.',
    })
  }
  return {
    increasing_risk_factors: increasing.slice(0, 5),
    decreasing_risk_factors: decreasing.slice(0, 5),
  }
}

function strategies(c) {
  const list = []
  if (c.Contract === 'Month-to-month') {
    list.push('Offer a discounted 1-year contract upgrade with a loyalty credit.')
  }
  if (c.OnlineSecurity === 'No' || c.TechSupport === 'No') {
    list.push('Bundle online security / tech support at a promotional rate.')
  }
  if (Number(c.tenure) < 6) {
    list.push('Trigger a new-customer check-in call in the next 7 days.')
  }
  if (Number(c.MonthlyCharges) > 80) {
    list.push('Review plan value and offer a temporary bill credit if at risk.')
  }
  while (list.length < 4) {
    list.push('Send a personalized retention offer tied to their current services.')
  }
  return list.slice(0, 4)
}

function singlePayload(c) {
  const prediction = scoreCustomer(c)
  return {
    prediction,
    explanation: explain(c, prediction),
    retention_strategies: strategies(c),
  }
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return []
  const headers = splitCsvLine(lines[0])
  return lines.slice(1).filter(Boolean).map((line) => {
    const cols = splitCsvLine(line)
    const row = {}
    headers.forEach((h, i) => {
      row[h] = cols[i]
    })
    return row
  })
}

function splitCsvLine(line) {
  const out = []
  let cur = ''
  let q = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      q = !q
      continue
    }
    if (ch === ',' && !q) {
      out.push(cur.trim())
      cur = ''
      continue
    }
    cur += ch
  }
  out.push(cur.trim())
  return out
}

function insightsFrom(raw, results) {
  const merged = raw.map((r, i) => ({ ...r, probability: results[i].probability }))
  const patterns = {}
  const high = merged.filter((r) => Number(r.MonthlyCharges) > 90)
  const low = merged.filter((r) => Number(r.MonthlyCharges) <= 90)
  if (high.length && low.length) {
    const ha = avg(high.map((r) => r.probability))
    const la = avg(low.map((r) => r.probability))
    patterns.high_monthly_charges = `Customers paying above $90/month average ${ha.toFixed(1)}% churn vs ${la.toFixed(1)}% below $90.`
  }
  const fiber = merged.filter((r) => r.InternetService === 'Fiber optic')
  const dsl = merged.filter((r) => r.InternetService === 'DSL')
  if (fiber.length && dsl.length) {
    patterns.fiber_vs_dsl = `Fiber optic avg ${avg(fiber.map((r) => r.probability)).toFixed(1)}% vs DSL ${avg(dsl.map((r) => r.probability)).toFixed(1)}%.`
  }
  const newbie = merged.filter((r) => Number(r.tenure) < 6)
  if (newbie.length) {
    patterns.new_customer_risk = `Under-6-month customers average ${avg(newbie.map((r) => r.probability)).toFixed(1)}% churn (${newbie.length} rows).`
  }
  const byContract = {}
  for (const r of merged) {
    const k = r.Contract || 'Unknown'
    ;(byContract[k] ??= []).push(r.probability)
  }
  patterns.contract_type_breakdown =
    'Average churn by contract: ' +
    Object.entries(byContract)
      .map(([k, v]) => `${k}: ${avg(v).toFixed(1)}%`)
      .join(', ')
  return {
    calculated_patterns: patterns,
    business_recommendation:
      'Prioritize month-to-month fiber customers with high bills for contract upgrades and support add-ons.',
  }
}

function avg(arr) {
  return arr.reduce((a, b) => a + b, 0) / (arr.length || 1)
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function send(res, status, data, headers = {}) {
  const body = typeof data === 'string' ? data : JSON.stringify(data)
  res.statusCode = status
  const type = typeof data === 'string' ? 'text/csv' : 'application/json'
  res.setHeader('Content-Type', type)
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v)
  res.end(body)
}

function loadMetrics() {
  const p = join(__dirname, '..', 'backend', 'models', 'saved', 'metrics.json')
  if (existsSync(p)) return JSON.parse(readFileSync(p, 'utf8'))
  return {
    models: {
      'Logistic Regression': { accuracy: 0.74, precision: 0.5, recall: 0.78, f1: 0.61, roc_auc: 0.84 },
      'Decision Tree': { accuracy: 0.72, precision: 0.47, recall: 0.48, f1: 0.47, roc_auc: 0.64 },
      'Random Forest': { accuracy: 0.78, precision: 0.62, recall: 0.48, f1: 0.54, roc_auc: 0.82 },
      XGBoost: { accuracy: 0.8, precision: 0.66, recall: 0.52, f1: 0.58, roc_auc: 0.84 },
    },
    best_model: 'XGBoost',
  }
}

const API_PREFIXES = ['/predict', '/models', '/insights']

export function isApiPath(pathname) {
  return API_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'))
}

/** Connect-style middleware for Vite — UI and API share one origin. */
export async function apiMiddleware(req, res, next) {
  const url = new URL(req.url || '/', 'http://localhost')
  if (!isApiPath(url.pathname)) return next()

  try {
    if (req.method === 'OPTIONS') return send(res, 204, '')

    if (req.method === 'POST' && url.pathname === '/predict/single') {
      const raw = await readBody(req)
      const customer = JSON.parse(raw.toString() || '{}')
      return send(res, 200, singlePayload(customer))
    }

    if (req.method === 'POST' && url.pathname === '/predict/batch') {
      const buf = await readBody(req)
      const text = buf.toString('utf8')
      const boundaryMatch = (req.headers['content-type'] || '').match(/boundary=(.+)$/i)
      let csv = text
      if (boundaryMatch) {
        const parts = text.split('--' + boundaryMatch[1])
        const filePart = parts.find((p) => /filename=/i.test(p))
        if (filePart) {
          const idx = filePart.indexOf('\r\n\r\n')
          csv = idx >= 0 ? filePart.slice(idx + 4).replace(/\r\n--$/, '').trim() : text
        }
      }
      const rawRows = parseCsv(csv)
      if (!rawRows.length) return send(res, 400, { detail: 'Empty or invalid CSV' })
      const results = rawRows.map((r) => scoreCustomer(r))
      const insights = insightsFrom(rawRows, results)
      session.lastBatch = results
      session.lastRaw = rawRows
      session.lastInsights = insights
      const churn_vs_stay = {}
      const risk_distribution = {}
      const contract_type_vs_churn = {}
      for (const r of results) {
        churn_vs_stay[r.prediction] = (churn_vs_stay[r.prediction] || 0) + 1
        risk_distribution[r.risk_level] = (risk_distribution[r.risk_level] || 0) + 1
      }
      for (const r of rawRows) {
        const k = r.Contract || 'Unknown'
        ;(contract_type_vs_churn[k] ??= []).push(scoreCustomer(r).probability)
      }
      const contractAvg = Object.fromEntries(
        Object.entries(contract_type_vs_churn).map(([k, v]) => [k, Math.round(avg(v) * 10) / 10]),
      )
      return send(res, 200, {
        kpis: {
          total_customers: results.length,
          high_risk_count: results.filter((r) => r.risk_level === 'High').length,
          average_churn_probability: Math.round(avg(results.map((r) => r.probability)) * 10) / 10,
          predicted_revenue_loss:
            Math.round(results.reduce((s, r) => s + r.ExpectedRevenueLoss, 0) * 100) / 100,
        },
        charts: {
          churn_vs_stay,
          risk_distribution,
          contract_type_vs_churn: contractAvg,
          monthly_charges_vs_churn: rawRows.map((r, i) => ({
            monthly_charges: Number(r.MonthlyCharges) || 0,
            probability: results[i].probability,
          })),
          tenure_distribution: rawRows.map((r) => Number(r.tenure) || 0),
        },
        customer_table_preview: results.slice(0, 50),
        business_insights: insights,
      })
    }

    if (req.method === 'GET' && url.pathname === '/predict/batch/table') {
      if (!session.lastBatch) return send(res, 404, { detail: 'No batch data. Upload a CSV first.' })
      const page = Math.max(1, Number(url.searchParams.get('page') || 1))
      const page_size = Math.max(1, Number(url.searchParams.get('page_size') || 50))
      const total_rows = session.lastBatch.length
      const total_pages = Math.max(1, Math.ceil(total_rows / page_size))
      const start = (page - 1) * page_size
      return send(res, 200, {
        page,
        page_size,
        total_rows,
        total_pages,
        customers: session.lastBatch.slice(start, start + page_size),
      })
    }

    if (req.method === 'GET' && url.pathname === '/predict/batch/download') {
      if (!session.lastBatch) return send(res, 404, { detail: 'No batch data.' })
      const header = 'CustomerID,Probability,Risk,ExpectedRevenueLoss,Prediction\n'
      const rows = session.lastBatch
        .map(
          (r) =>
            `${r.customerID ?? ''},${r.probability},${r.risk_level},${r.ExpectedRevenueLoss},${r.prediction}`,
        )
        .join('\n')
      return send(res, 200, header + rows, {
        'Content-Disposition': 'attachment; filename=churn_predictions.csv',
      })
    }

    if (req.method === 'POST' && url.pathname === '/predict/customer-detail') {
      if (!session.lastRaw) return send(res, 404, { detail: 'No batch data.' })
      const { customerID } = JSON.parse((await readBody(req)).toString() || '{}')
      const row = session.lastRaw.find((r) => r.customerID === customerID)
      if (!row) return send(res, 404, { detail: `Customer ${customerID} not found.` })
      return send(res, 200, singlePayload(row))
    }

    if (req.method === 'GET' && url.pathname === '/models/comparison') {
      return send(res, 200, loadMetrics())
    }

    if (req.method === 'GET' && url.pathname === '/insights') {
      if (!session.lastInsights) return send(res, 404, { detail: 'No insights yet.' })
      return send(res, 200, session.lastInsights)
    }

    return send(res, 404, { detail: 'Not found' })
  } catch (err) {
    return send(res, 500, { detail: String(err.message || err) })
  }
}
