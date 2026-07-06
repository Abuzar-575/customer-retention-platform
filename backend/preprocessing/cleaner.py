import pandas as pd

# Columns exactly as in the dataset, minus customerID and Churn
NUMERIC_FEATURES = ["tenure", "MonthlyCharges", "TotalCharges"]

CATEGORICAL_FEATURES = [
    "gender", "SeniorCitizen", "Partner", "Dependents",
    "PhoneService", "MultipleLines", "InternetService",
    "OnlineSecurity", "OnlineBackup", "DeviceProtection",
    "TechSupport", "StreamingTV", "StreamingMovies",
    "Contract", "PaperlessBilling", "PaymentMethod"
]

ALL_FEATURES = NUMERIC_FEATURES + CATEGORICAL_FEATURES


def clean_raw_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    """
    Cleans a raw dataframe (straight from CSV, training or batch upload).
    Does NOT encode/scale — that's the preprocessor's job (fitted in train.py).
    This only fixes data issues so the dataframe is valid to feed into the preprocessor.
    """
    df = df.copy()

    # Fix TotalCharges: it's stored as string, blank for tenure==0 customers
    df["TotalCharges"] = df["TotalCharges"].replace(" ", pd.NA)
    df["TotalCharges"] = pd.to_numeric(df["TotalCharges"], errors="coerce")
    # Blank TotalCharges only happens when tenure == 0 -> churn hasn't had time to matter, fill with 0
    df["TotalCharges"] = df["TotalCharges"].fillna(0)

    # SeniorCitizen is 0/1 int in raw data, but we treat it as categorical (few distinct values)
    df["SeniorCitizen"] = df["SeniorCitizen"].astype(str)

    return df


def encode_target(df: pd.DataFrame) -> pd.DataFrame:
    """Converts Churn Yes/No -> 1/0. Only used during training."""
    df = df.copy()
    df["Churn"] = df["Churn"].map({"Yes": 1, "No": 0})
    return df


def get_feature_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    """
    Drops customerID and Churn (if present), returns only the columns
    the model was trained on, in the correct order.
    """
    df = df.copy()
    return df[ALL_FEATURES]