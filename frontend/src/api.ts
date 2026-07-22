// Same origin as the UI in dev (Vite mounts the score API). Override with VITE_API_URL if needed.
const API_BASE = import.meta.env.VITE_API_URL ?? ''

export type CustomerInput = {
  customerID?: string
  gender: string
  SeniorCitizen: number
  Partner: string
  Dependents: string
  tenure: number
  PhoneService: string
  MultipleLines: string
  InternetService: string
  OnlineSecurity: string
  OnlineBackup: string
  DeviceProtection: string
  TechSupport: string
  StreamingTV: string
  StreamingMovies: string
  Contract: string
  PaperlessBilling: string
  PaymentMethod: string
  MonthlyCharges: number
  TotalCharges: number
}

export type Prediction = {
  customerID?: string
  probability: number
  risk_level: string
  prediction: string
  MonthlyCharges: number
  ExpectedRevenueLoss: number
}

export type ShapFactor = {
  feature: string
  impact: number
  explanation: string
}

export type Explanation = {
  increasing_risk_factors: ShapFactor[]
  decreasing_risk_factors: ShapFactor[]
}

export type SinglePredictResponse = {
  prediction: Prediction
  explanation: Explanation
  retention_strategies: string[]
}

export type BatchKpis = {
  total_customers: number
  high_risk_count: number
  average_churn_probability: number
  predicted_revenue_loss: number
}

export type BatchCharts = {
  churn_vs_stay: Record<string, number>
  risk_distribution: Record<string, number>
  contract_type_vs_churn: Record<string, number>
  monthly_charges_vs_churn: { monthly_charges: number; probability: number }[]
  tenure_distribution: number[]
}

export type BusinessInsights = {
  calculated_patterns: Record<string, string>
  business_recommendation: string
}

export type BatchPredictResponse = {
  kpis: BatchKpis
  charts: BatchCharts
  customer_table_preview: Prediction[]
  business_insights: BusinessInsights
}

export type TablePage = {
  page: number
  page_size: number
  total_rows: number
  total_pages: number
  customers: Prediction[]
}

export type ModelMetrics = {
  accuracy: number
  precision: number
  recall: number
  f1: number
  roc_auc: number
}

export type ModelComparison = {
  models: Record<string, ModelMetrics>
  best_model: string
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = await res.json()
      detail = body.detail ?? JSON.stringify(body)
    } catch {
      /* ignore */
    }
    throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail))
  }
  return res.json() as Promise<T>
}

export async function predictSingle(customer: CustomerInput) {
  const res = await fetch(`${API_BASE}/predict/single`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(customer),
  })
  return handle<SinglePredictResponse>(res)
}

export async function predictBatch(file: File) {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${API_BASE}/predict/batch`, {
    method: 'POST',
    body: form,
  })
  return handle<BatchPredictResponse>(res)
}

export async function getBatchTable(page = 1, pageSize = 50) {
  const res = await fetch(
    `${API_BASE}/predict/batch/table?page=${page}&page_size=${pageSize}`,
  )
  return handle<TablePage>(res)
}

export function batchDownloadUrl() {
  return `${API_BASE}/predict/batch/download`
}

export async function getCustomerDetail(customerID: string) {
  const res = await fetch(`${API_BASE}/predict/customer-detail`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ customerID }),
  })
  return handle<SinglePredictResponse>(res)
}

export async function getModelComparison() {
  const res = await fetch(`${API_BASE}/models/comparison`)
  return handle<ModelComparison>(res)
}

export async function getInsights() {
  const res = await fetch(`${API_BASE}/insights`)
  return handle<BusinessInsights>(res)
}
