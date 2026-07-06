# backend/main.py

import io
import os
import json
import pandas as pd
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional

from prediction.predictor import predict_single, predict_batch
from explainability.shap_explainer import explain_single
from api.groq_service import get_customer_retention_strategy, get_business_recommendation

app = FastAPI(title="Customer Retention Intelligence Platform")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------- In-memory session storage (no database, per decision) ----------
session_data = {
    "last_batch_results": None,
    "last_raw_df": None,
    "last_insights": None,
}


def clean_num(value, decimals=2):
    """Forces any numpy/pandas numeric type into a plain Python float, rounded."""
    if value is None:
        return None
    return round(float(value), decimals)


# =========================================================
# Endpoint 1: POST /predict/single
# =========================================================

class CustomerInput(BaseModel):
    customerID: Optional[str] = None
    gender: str
    SeniorCitizen: int
    Partner: str
    Dependents: str
    tenure: int
    PhoneService: str
    MultipleLines: str
    InternetService: str
    OnlineSecurity: str
    OnlineBackup: str
    DeviceProtection: str
    TechSupport: str
    StreamingTV: str
    StreamingMovies: str
    Contract: str
    PaperlessBilling: str
    PaymentMethod: str
    MonthlyCharges: float
    TotalCharges: float


@app.post("/predict/single")
def predict_single_customer(customer: CustomerInput):
    try:
        customer_dict = customer.model_dump()

        prediction_result = predict_single(customer_dict)
        prediction_result["probability"] = clean_num(prediction_result["probability"], 1)
        prediction_result["MonthlyCharges"] = clean_num(prediction_result["MonthlyCharges"])
        prediction_result["ExpectedRevenueLoss"] = clean_num(prediction_result["ExpectedRevenueLoss"])

        shap_result = explain_single(customer_dict)
        retention_strategies = get_customer_retention_strategy(customer_dict, shap_result)

        return {
            "prediction": prediction_result,
            "explanation": shap_result,
            "retention_strategies": retention_strategies,
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")


# =========================================================
# Business insights calculation helper
# =========================================================

def calculate_business_insights(results_df: pd.DataFrame, raw_df: pd.DataFrame) -> dict:
    """
    Auto-calculates real statistical patterns from the batch data.
    Never hardcoded — always derived from the actual uploaded dataset.
    """
    merged = raw_df.copy()
    merged["probability"] = results_df["probability"].values

    insights = {}

    # High monthly charges vs churn
    high_charge_mask = merged["MonthlyCharges"] > 90
    if high_charge_mask.sum() > 0 and (~high_charge_mask).sum() > 0:
        high_avg = merged.loc[high_charge_mask, "probability"].mean()
        low_avg = merged.loc[~high_charge_mask, "probability"].mean()
        if low_avg > 0:
            multiplier = clean_num(high_avg / low_avg, 1)
            insights["high_monthly_charges"] = (
                f"Customers paying above $90/month have an average churn probability of "
                f"{clean_num(high_avg, 1)}%, which is {multiplier}x higher than customers below "
                f"$90/month ({clean_num(low_avg, 1)}%)."
            )

    # Fiber vs DSL
    if "InternetService" in merged.columns:
        fiber_mask = merged["InternetService"] == "Fiber optic"
        dsl_mask = merged["InternetService"] == "DSL"
        if fiber_mask.sum() > 0 and dsl_mask.sum() > 0:
            fiber_avg = merged.loc[fiber_mask, "probability"].mean()
            dsl_avg = merged.loc[dsl_mask, "probability"].mean()
            diff = clean_num(fiber_avg - dsl_avg, 1)
            insights["fiber_vs_dsl"] = (
                f"Fiber optic customers churn at {clean_num(fiber_avg, 1)}% average probability, "
                f"{'higher' if diff > 0 else 'lower'} by {abs(diff)} percentage points compared to "
                f"DSL customers ({clean_num(dsl_avg, 1)}%)."
            )

    # New customers (low tenure)
    if "tenure" in merged.columns:
        new_customer_mask = merged["tenure"] < 6
        if new_customer_mask.sum() > 0:
            new_avg = merged.loc[new_customer_mask, "probability"].mean()
            insights["new_customer_risk"] = (
                f"Customers with under 6 months tenure have an average churn probability of "
                f"{clean_num(new_avg, 1)}%, based on {int(new_customer_mask.sum())} such customers in this dataset."
            )

    # Contract type breakdown
    if "Contract" in merged.columns:
        contract_avgs = merged.groupby("Contract")["probability"].mean().round(1)
        contract_avgs_clean = {k: clean_num(v, 1) for k, v in contract_avgs.to_dict().items()}
        insights["contract_type_breakdown"] = (
            f"Average churn probability by contract type: "
            + ", ".join([f"{k}: {v}%" for k, v in contract_avgs_clean.items()])
        )

    return insights


# =========================================================
# Endpoint 2: POST /predict/batch
# =========================================================

@app.post("/predict/batch")
async def predict_batch_customers(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        raw_df = pd.read_csv(io.BytesIO(contents))

        results_df = predict_batch(raw_df)

        # ---------- KPI cards ----------
        total_customers = int(len(results_df))
        high_risk_count = int((results_df["risk_level"] == "High").sum())
        avg_probability = clean_num(results_df["probability"].mean(), 1)
        total_revenue_loss = clean_num(results_df["ExpectedRevenueLoss"].sum(), 2)

        kpis = {
            "total_customers": total_customers,
            "high_risk_count": high_risk_count,
            "average_churn_probability": avg_probability,
            "predicted_revenue_loss": total_revenue_loss,
        }

        # ---------- Chart data ----------
        churn_vs_stay = {k: int(v) for k, v in results_df["prediction"].value_counts().to_dict().items()}
        risk_distribution = {k: int(v) for k, v in results_df["risk_level"].value_counts().to_dict().items()}

        contract_churn = {}
        if "Contract" in raw_df.columns:
            merged_temp = raw_df.copy()
            merged_temp["probability"] = results_df["probability"].values
            contract_avgs = merged_temp.groupby("Contract")["probability"].mean().round(1)
            contract_churn = {k: clean_num(v, 1) for k, v in contract_avgs.to_dict().items()}

        charges_vs_churn = [
            {"monthly_charges": clean_num(mc, 2), "probability": clean_num(p, 1)}
            for mc, p in zip(raw_df["MonthlyCharges"], results_df["probability"])
        ]

        tenure_distribution = [int(t) for t in raw_df["tenure"].tolist()] if "tenure" in raw_df.columns else []

        # ---------- Business insights + Groq (ONE call, not per row) ----------
        insights = calculate_business_insights(results_df, raw_df)
        business_recommendation = get_business_recommendation(insights) if insights else ""

        # ---------- Clean customer table numbers before storing/returning ----------
        customer_table = results_df.copy()
        customer_table["probability"] = customer_table["probability"].apply(lambda x: clean_num(x, 1))
        customer_table["MonthlyCharges"] = customer_table["MonthlyCharges"].apply(lambda x: clean_num(x, 2))
        customer_table["ExpectedRevenueLoss"] = customer_table["ExpectedRevenueLoss"].apply(lambda x: clean_num(x, 2))

        # ---------- Store in memory for download + /insights + customer detail + pagination ----------
        session_data["last_batch_results"] = results_df
        session_data["last_raw_df"] = raw_df
        session_data["last_insights"] = {
            "calculated_patterns": insights,
            "business_recommendation": business_recommendation,
        }

        return {
            "kpis": kpis,
            "charts": {
                "churn_vs_stay": churn_vs_stay,
                "risk_distribution": risk_distribution,
                "contract_type_vs_churn": contract_churn,
                "monthly_charges_vs_churn": charges_vs_churn,
                "tenure_distribution": tenure_distribution,
            },
            # Only a preview here — the frontend fetches full paginated rows
            # from /predict/batch/table so this response stays small and fast
            # regardless of CSV size.
            "customer_table_preview": customer_table.head(50).to_dict(orient="records"),
            "business_insights": session_data["last_insights"],
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Batch prediction failed: {str(e)}")


# =========================================================
# Additional endpoint: GET /predict/batch/table (paginated)
# =========================================================

@app.get("/predict/batch/table")
def get_batch_table(page: int = 1, page_size: int = 50):
    if session_data["last_batch_results"] is None:
        raise HTTPException(status_code=404, detail="No batch data available. Upload a CSV first.")

    if page < 1 or page_size < 1:
        raise HTTPException(status_code=400, detail="page and page_size must be positive integers.")

    df = session_data["last_batch_results"].copy()
    df["probability"] = df["probability"].apply(lambda x: clean_num(x, 1))
    df["MonthlyCharges"] = df["MonthlyCharges"].apply(lambda x: clean_num(x, 2))
    df["ExpectedRevenueLoss"] = df["ExpectedRevenueLoss"].apply(lambda x: clean_num(x, 2))

    total_rows = len(df)
    total_pages = max(1, (total_rows + page_size - 1) // page_size)
    start = (page - 1) * page_size
    end = start + page_size

    page_data = df.iloc[start:end].to_dict(orient="records")

    return {
        "page": page,
        "page_size": page_size,
        "total_rows": total_rows,
        "total_pages": total_pages,
        "customers": page_data,
    }


# =========================================================
# Additional endpoint: GET /predict/batch/download
# =========================================================

@app.get("/predict/batch/download")
def download_batch_predictions():
    if session_data["last_batch_results"] is None:
        raise HTTPException(status_code=404, detail="No batch data available. Upload a CSV first.")

    df = session_data["last_batch_results"]
    output_df = df[["customerID", "probability", "risk_level", "ExpectedRevenueLoss", "prediction"]].copy()
    output_df.columns = ["CustomerID", "Probability", "Risk", "ExpectedRevenueLoss", "Prediction"]

    stream = io.StringIO()
    output_df.to_csv(stream, index=False)
    stream.seek(0)

    return StreamingResponse(
        iter([stream.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=churn_predictions.csv"},
    )


# =========================================================
# Additional endpoint: POST /predict/customer-detail
# =========================================================

class CustomerIdInput(BaseModel):
    customerID: str


@app.post("/predict/customer-detail")
def get_customer_detail(payload: CustomerIdInput):
    if session_data["last_raw_df"] is None:
        raise HTTPException(status_code=404, detail="No batch data available. Upload a CSV first.")

    raw_df = session_data["last_raw_df"]
    matching_rows = raw_df[raw_df["customerID"] == payload.customerID]

    if matching_rows.empty:
        raise HTTPException(status_code=404, detail=f"Customer {payload.customerID} not found in last batch.")

    customer_dict = matching_rows.iloc[0].to_dict()

    try:
        prediction_result = predict_single(customer_dict)
        prediction_result["probability"] = clean_num(prediction_result["probability"], 1)
        prediction_result["MonthlyCharges"] = clean_num(prediction_result["MonthlyCharges"])
        prediction_result["ExpectedRevenueLoss"] = clean_num(prediction_result["ExpectedRevenueLoss"])

        shap_result = explain_single(customer_dict)
        retention_strategies = get_customer_retention_strategy(customer_dict, shap_result)

        return {
            "prediction": prediction_result,
            "explanation": shap_result,
            "retention_strategies": retention_strategies,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Customer detail lookup failed: {str(e)}")


# =========================================================
# Endpoint 3: GET /models/comparison
# =========================================================

@app.get("/models/comparison")
def get_model_comparison():
    metrics_path = os.path.join(os.path.dirname(__file__), "models", "saved", "metrics.json")

    if not os.path.exists(metrics_path):
        raise HTTPException(status_code=404, detail="metrics.json not found. Run train.py first.")

    with open(metrics_path, "r") as f:
        metrics = json.load(f)

    return metrics


# =========================================================
# Endpoint 4: GET /insights
# =========================================================

@app.get("/insights")
def get_insights():
    if session_data["last_insights"] is None:
        raise HTTPException(status_code=404, detail="No insights available yet. Upload a batch CSV first.")

    return session_data["last_insights"]


# =========================================================
# Root health check
# =========================================================

@app.get("/")
def root():
    return {"status": "Customer Retention Intelligence Platform API is running"}