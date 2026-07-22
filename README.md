# Customer Retention Intelligence Platform

Churn prediction for telecom-style customers — XGBoost scoring, SHAP explanations, and Groq-powered retention plays. The UI is a light **Retention Arcade** HUD (Vite + React) talking to a FastAPI backend.

## What's inside

```
customer-retention-platform/
├── backend/          # FastAPI API, training, SHAP, Groq
│   ├── api/          # Groq retention + business recommendations
│   ├── dataset/      # Telco Customer Churn CSV
│   ├── explainability/
│   ├── models/       # train.py + saved metrics / pickles
│   ├── prediction/
│   ├── preprocessing/
│   └── main.py
└── frontend/         # Vite + React arcade UI
```

## Features

- **Single predict** — score one customer, see risk meter, SHAP factors, AI strategies
- **Batch arena** — upload CSV, KPIs, charts, paginated roster, row detail drawer, CSV download
- **Model lab** — compare Logistic Regression, Decision Tree, Random Forest, XGBoost
- **Business insights** — patterns derived from the uploaded batch + one Groq summary

## Prerequisites

- Python 3.10+
- Node.js 18+
- A [Groq](https://console.groq.com/) API key (for retention strategies / business playbook)

## Quick start (frontend + score API together)

One command starts the UI **and** the score API on the same server (no separate backend process):

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). Pull Score / Batch / Model Lab call `/predict` and `/models` on that same origin.

Optional standalone API only: `node simple-api/server.mjs` (port 8000).

## Full ML backend (optional)

Needs Python deps, trained pickles, and `backend/.env` with `GROQ_API_KEY`.

```bash
cd backend
pip install -r requirements.txt
python models/train.py
uvicorn main:app --reload --port 8000
```

## Frontend setup

```bash
cd frontend
npm install
npm run dev
```

App: [http://localhost:5173](http://localhost:5173)

Optional `frontend/.env`:

```env
VITE_API_URL=http://localhost:8000
```

Defaults to `http://localhost:8000` if unset.

## How to use

1. Start backend (after training) and frontend.
2. **Single** — fill demographics → services → billing, then Pull Score.
3. **Batch** — drop a Telco-style CSV (same columns as `backend/dataset/WA_Fn-UseC_-Telco-Customer-Churn.csv`). Click a row for SHAP + strategies.
4. **Model Lab** — view training metrics and the crowned best model.

## API summary

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Health |
| POST | `/predict/single` | One customer JSON → prediction + SHAP + strategies |
| POST | `/predict/batch` | CSV upload → KPIs, charts, insights, preview rows |
| GET | `/predict/batch/table?page=&page_size=` | Paginated batch results |
| GET | `/predict/batch/download` | Download predictions CSV |
| POST | `/predict/customer-detail` | `{ "customerID" }` from last batch |
| GET | `/models/comparison` | Metrics from `metrics.json` |
| GET | `/insights` | Last batch business insights |

Batch results live in memory for the API process (no database).

## Dataset

IBM Telco Customer Churn sample under `backend/dataset/`. Expected fields include `gender`, `SeniorCitizen`, `Partner`, `Dependents`, `tenure`, phone/internet add-ons, `Contract`, `PaperlessBilling`, `PaymentMethod`, `MonthlyCharges`, `TotalCharges`, and optionally `customerID`.

## Stack

- **ML:** scikit-learn, XGBoost, SHAP
- **API:** FastAPI, Uvicorn
- **LLM:** Groq (`llama-3.3-70b-versatile`)
- **UI:** Vite, React, TypeScript, CSS (no heavy UI kit)

## License

Use freely for learning and demos unless your org adds different terms.
