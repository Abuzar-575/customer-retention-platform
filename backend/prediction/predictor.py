# backend/prediction/predictor.py

import os
import sys
import joblib
import pandas as pd

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from preprocessing.cleaner import (
    clean_raw_dataframe,
    get_feature_dataframe,
    ALL_FEATURES,
)

# ---------- Load saved artifacts once, at import time ----------
BASE_DIR = os.path.dirname(__file__)
SAVED_DIR = os.path.join(BASE_DIR, "..", "models", "saved")

model = joblib.load(os.path.join(SAVED_DIR, "best_model.pkl"))
preprocessor = joblib.load(os.path.join(SAVED_DIR, "preprocessor.pkl"))
feature_names = joblib.load(os.path.join(SAVED_DIR, "feature_names.pkl"))


# ---------- Column name aliasing ----------
# Keys are normalized (lowercase, spaces/underscores/hyphens stripped) before lookup.
COLUMN_ALIASES = {
    # customerID
    "customerid": "customerID",
    "customer id": "customerID",
    "custid": "customerID",
    "id": "customerID",

    # gender
    "gender": "gender",
    "sex": "gender",

    # SeniorCitizen
    "seniorcitizen": "SeniorCitizen",
    "senior citizen": "SeniorCitizen",
    "issenior": "SeniorCitizen",
    "senior": "SeniorCitizen",

    # Partner
    "partner": "Partner",
    "haspartner": "Partner",
    "married": "Partner",

    # Dependents
    "dependents": "Dependents",
    "hasdependents": "Dependents",
    "dependent": "Dependents",

    # tenure
    "tenure": "tenure",
    "tenuremonths": "tenure",
    "monthsastenant": "tenure",
    "monthsactive": "tenure",
    "customertenure": "tenure",

    # PhoneService
    "phoneservice": "PhoneService",
    "phone service": "PhoneService",
    "hasphoneservice": "PhoneService",
    "phone": "PhoneService",

    # MultipleLines
    "multiplelines": "MultipleLines",
    "multiple lines": "MultipleLines",
    "haslultiplelines": "MultipleLines",

    # InternetService
    "internetservice": "InternetService",
    "internet service": "InternetService",
    "internettype": "InternetService",
    "internet": "InternetService",

    # OnlineSecurity
    "onlinesecurity": "OnlineSecurity",
    "online security": "OnlineSecurity",

    # OnlineBackup
    "onlinebackup": "OnlineBackup",
    "online backup": "OnlineBackup",

    # DeviceProtection
    "deviceprotection": "DeviceProtection",
    "device protection": "DeviceProtection",

    # TechSupport
    "techsupport": "TechSupport",
    "tech support": "TechSupport",

    # StreamingTV
    "streamingtv": "StreamingTV",
    "streaming tv": "StreamingTV",
    "streamingtelevision": "StreamingTV",

    # StreamingMovies
    "streamingmovies": "StreamingMovies",
    "streaming movies": "StreamingMovies",

    # Contract
    "contract": "Contract",
    "contracttype": "Contract",
    "contract type": "Contract",
    "plantype": "Contract",

    # PaperlessBilling
    "paperlessbilling": "PaperlessBilling",
    "paperless billing": "PaperlessBilling",
    "paperless": "PaperlessBilling",

    # PaymentMethod
    "paymentmethod": "PaymentMethod",
    "payment method": "PaymentMethod",
    "paymenttype": "PaymentMethod",

    # MonthlyCharges
    "monthlycharges": "MonthlyCharges",
    "monthly charges": "MonthlyCharges",
    "monthlycharge": "MonthlyCharges",
    "monthlyfee": "MonthlyCharges",
    "monthlybill": "MonthlyCharges",

    # TotalCharges
    "totalcharges": "TotalCharges",
    "total charges": "TotalCharges",
    "totalcharge": "TotalCharges",
    "totalbill": "TotalCharges",
    "lifetimecharges": "TotalCharges",

    # Churn (only relevant if someone re-uploads a labeled dataset)
    "churn": "Churn",
    "churned": "Churn",
    "haschurned": "Churn",
}


def _normalize_key(col: str) -> str:
    """Lowercase, strip spaces/underscores/hyphens for alias lookup."""
    return col.strip().lower().replace("_", "").replace("-", "").replace(" ", "")


def normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    """
    Renames known alternate column names to our expected canonical names.
    Matching is case-insensitive and ignores spaces/underscores/hyphens.
    Unknown columns are left untouched (they'll be caught by validate_columns
    if they turn out to be required and missing).
    """
    df = df.copy()
    rename_map = {}
    for col in df.columns:
        key = _normalize_key(col)
        if key in COLUMN_ALIASES:
            rename_map[col] = COLUMN_ALIASES[key]
    return df.rename(columns=rename_map)


def validate_columns(df: pd.DataFrame):
    """
    Checks that all required columns are present before we attempt prediction.
    Raises a ValueError with a clear message if anything is missing.
    Extra/unexpected columns are allowed and simply ignored.
    """
    missing = [col for col in ALL_FEATURES if col not in df.columns]
    if missing:
        raise ValueError(f"Missing required columns: {', '.join(missing)}")


def get_risk_level(probability_percent: float) -> str:
    """probability_percent is expected as 0-100."""
    if probability_percent <= 35:
        return "Low"
    elif probability_percent <= 70:
        return "Medium"
    else:
        return "High"


def predict_single(customer_dict: dict) -> dict:
    """
    Takes a single customer as a dict (e.g. from a form/JSON body).
    Returns probability, risk level, and prediction.
    """
    df = pd.DataFrame([customer_dict])
    return predict_batch(df).iloc[0].to_dict()


def predict_batch(df: pd.DataFrame) -> pd.DataFrame:
    """
    Takes a dataframe of one or more customers (raw, uncleaned).
    Returns a dataframe with added columns: probability, risk_level, prediction.
    customerID is preserved if present, but not required.
    """
    df = df.copy()
    df = normalize_columns(df)

    has_id = "customerID" in df.columns
    ids = df["customerID"] if has_id else None

    validate_columns(df)

    cleaned = clean_raw_dataframe(df)
    features = get_feature_dataframe(cleaned)

    transformed = preprocessor.transform(features)
    probabilities = model.predict_proba(transformed)[:, 1]

    results = pd.DataFrame({
        "probability": [float(round(p * 100, 1)) for p in probabilities],
    })
    results["risk_level"] = results["probability"].apply(get_risk_level)
    results["prediction"] = results["probability"].apply(lambda p: "Churn" if p > 50 else "No Churn")

    if has_id:
        results.insert(0, "customerID", ids.values)

    results["MonthlyCharges"] = cleaned["MonthlyCharges"].values
    results["ExpectedRevenueLoss"] = round(
        (results["probability"] / 100) * results["MonthlyCharges"], 2
    )

    return results  