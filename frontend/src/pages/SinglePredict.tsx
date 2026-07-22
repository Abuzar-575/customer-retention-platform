import { useState, type FormEvent } from 'react'
import { predictSingle, type CustomerInput, type SinglePredictResponse } from '../api'
import RiskMeter from '../components/RiskMeter'
import ShapBars from '../components/ShapBars'

const empty: CustomerInput = {
  customerID: '',
  gender: 'Female',
  SeniorCitizen: 0,
  Partner: 'No',
  Dependents: 'No',
  tenure: 12,
  PhoneService: 'Yes',
  MultipleLines: 'No',
  InternetService: 'Fiber optic',
  OnlineSecurity: 'No',
  OnlineBackup: 'No',
  DeviceProtection: 'No',
  TechSupport: 'No',
  StreamingTV: 'No',
  StreamingMovies: 'No',
  Contract: 'Month-to-month',
  PaperlessBilling: 'Yes',
  PaymentMethod: 'Electronic check',
  MonthlyCharges: 70,
  TotalCharges: 840,
}

const STEPS = ['Demographics', 'Services', 'Billing'] as const

export default function SinglePredict() {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<CustomerInput>(empty)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<SinglePredictResponse | null>(null)

  const set = <K extends keyof CustomerInput>(key: K, value: CustomerInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const payload = {
        ...form,
        customerID: form.customerID || undefined,
        SeniorCitizen: Number(form.SeniorCitizen),
        tenure: Number(form.tenure),
        MonthlyCharges: Number(form.MonthlyCharges),
        TotalCharges: Number(form.TotalCharges),
      }
      const data = await predictSingle(payload)
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Prediction failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="stack">
      <div>
        <h1>Single Predict</h1>
        <p className="muted">Build a player profile, then pull the churn score.</p>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <form className="panel" onSubmit={submit}>
        <div className="stepper">
          {STEPS.map((label, i) => (
            <button
              key={label}
              type="button"
              className={`step ${i === step ? 'on' : ''}`}
              onClick={() => setStep(i)}
            >
              {i + 1}. {label}
            </button>
          ))}
        </div>

        {step === 0 && (
          <div className="form-grid">
            <div className="field">
              <label>Customer ID</label>
              <input
                value={form.customerID ?? ''}
                onChange={(e) => set('customerID', e.target.value)}
                placeholder="optional"
              />
            </div>
            <div className="field">
              <label>Gender</label>
              <select value={form.gender} onChange={(e) => set('gender', e.target.value)}>
                <option>Female</option>
                <option>Male</option>
              </select>
            </div>
            <div className="field">
              <label>Senior Citizen</label>
              <select
                value={form.SeniorCitizen}
                onChange={(e) => set('SeniorCitizen', Number(e.target.value))}
              >
                <option value={0}>No</option>
                <option value={1}>Yes</option>
              </select>
            </div>
            <div className="field">
              <label>Partner</label>
              <select value={form.Partner} onChange={(e) => set('Partner', e.target.value)}>
                <option>Yes</option>
                <option>No</option>
              </select>
            </div>
            <div className="field">
              <label>Dependents</label>
              <select
                value={form.Dependents}
                onChange={(e) => set('Dependents', e.target.value)}
              >
                <option>Yes</option>
                <option>No</option>
              </select>
            </div>
            <div className="field">
              <label>Tenure (months)</label>
              <input
                type="number"
                min={0}
                value={form.tenure}
                onChange={(e) => set('tenure', Number(e.target.value))}
              />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="form-grid">
            {(
              [
                ['PhoneService', ['Yes', 'No']],
                ['MultipleLines', ['Yes', 'No', 'No phone service']],
                ['InternetService', ['DSL', 'Fiber optic', 'No']],
                ['OnlineSecurity', ['Yes', 'No', 'No internet service']],
                ['OnlineBackup', ['Yes', 'No', 'No internet service']],
                ['DeviceProtection', ['Yes', 'No', 'No internet service']],
                ['TechSupport', ['Yes', 'No', 'No internet service']],
                ['StreamingTV', ['Yes', 'No', 'No internet service']],
                ['StreamingMovies', ['Yes', 'No', 'No internet service']],
              ] as const
            ).map(([key, opts]) => (
              <div className="field" key={key}>
                <label>{key}</label>
                <select
                  value={String(form[key])}
                  onChange={(e) => set(key, e.target.value)}
                >
                  {opts.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}

        {step === 2 && (
          <div className="form-grid">
            <div className="field">
              <label>Contract</label>
              <select value={form.Contract} onChange={(e) => set('Contract', e.target.value)}>
                <option>Month-to-month</option>
                <option>One year</option>
                <option>Two year</option>
              </select>
            </div>
            <div className="field">
              <label>Paperless Billing</label>
              <select
                value={form.PaperlessBilling}
                onChange={(e) => set('PaperlessBilling', e.target.value)}
              >
                <option>Yes</option>
                <option>No</option>
              </select>
            </div>
            <div className="field">
              <label>Payment Method</label>
              <select
                value={form.PaymentMethod}
                onChange={(e) => set('PaymentMethod', e.target.value)}
              >
                <option>Electronic check</option>
                <option>Mailed check</option>
                <option>Bank transfer (automatic)</option>
                <option>Credit card (automatic)</option>
              </select>
            </div>
            <div className="field">
              <label>Monthly Charges</label>
              <input
                type="number"
                step="0.01"
                value={form.MonthlyCharges}
                onChange={(e) => set('MonthlyCharges', Number(e.target.value))}
              />
            </div>
            <div className="field">
              <label>Total Charges</label>
              <input
                type="number"
                step="0.01"
                value={form.TotalCharges}
                onChange={(e) => set('TotalCharges', Number(e.target.value))}
              />
            </div>
          </div>
        )}

        <div className="row-actions" style={{ marginTop: '1.25rem' }}>
          {step > 0 && (
            <button type="button" className="btn btn-ghost" onClick={() => setStep((s) => s - 1)}>
              Back
            </button>
          )}
          {step < 2 ? (
            <button type="button" className="btn" onClick={() => setStep((s) => s + 1)}>
              Next Stage
            </button>
          ) : (
            <button type="submit" className="btn btn-coral" disabled={loading}>
              {loading ? 'Scoring…' : 'Pull Score'}
            </button>
          )}
        </div>
      </form>

      {result && (
        <div className="stack">
          <div className="panel" style={{ textAlign: 'center' }}>
            <div className="panel-title">Risk readout</div>
            <RiskMeter
              value={result.prediction.probability}
              risk={result.prediction.risk_level}
            />
            <div style={{ marginTop: '1rem' }}>
              <span
                className={`risk-banner ${result.prediction.risk_level.toLowerCase()}`}
              >
                {result.prediction.risk_level} risk · {result.prediction.prediction}
              </span>
            </div>
            <p className="muted" style={{ marginTop: '0.75rem' }}>
              Expected revenue loss ${result.prediction.ExpectedRevenueLoss} · Monthly $
              {result.prediction.MonthlyCharges}
            </p>
          </div>

          <ShapBars explanation={result.explanation} />

          <div className="panel">
            <div className="panel-title">AI retention plays</div>
            <ul className="strategy-list">
              {result.retention_strategies.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
