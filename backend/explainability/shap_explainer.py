# backend/explainability/shap_explainer.py

import os
import sys
import joblib
import shap
import numpy as np
import pandas as pd

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from preprocessing.cleaner import clean_raw_dataframe, get_feature_dataframe
from prediction.predictor import normalize_columns, validate_columns, model, preprocessor

# ---------- Load background sample once ----------
BASE_DIR = os.path.dirname(__file__)
SAVED_DIR = os.path.join(BASE_DIR, "..", "models", "saved")

background_sample = joblib.load(os.path.join(SAVED_DIR, "background_sample.pkl"))
background_transformed = preprocessor.transform(background_sample)
feature_names_transformed = preprocessor.get_feature_names_out()

explainer = shap.TreeExplainer(model, background_transformed, feature_perturbation="tree_path_dependent")


def _clean_feature_name(raw_name: str) -> str:
    """Only used for the short 'feature' label shown in the response, not for logic."""
    name = raw_name.split("__", 1)[-1]
    if "_" in name:
        parts = name.split("_", 1)
        return f"{parts[0]}: {parts[1]}"
    return name


def _describe_direction(raw_name: str, shap_value: float, customer_row: pd.Series) -> str:
    """
    Builds a value-aware explanation, phrased positively (states what the
    customer's actual situation is, rather than what it isn't).

    Looks at the customer's ACTUAL value for the base feature, not just the
    one-hot column name, since a SHAP value on a one-hot column describes
    that column being 0 or 1 — a very different statement from the raw
    feature name alone.
    """
    direction = "increasing" if shap_value > 0 else "decreasing"

    # Strip the ColumnTransformer prefix, e.g. "cat__Contract_Month-to-month" -> "Contract_Month-to-month"
    name = raw_name.split("__", 1)[-1]

    if "_" in name:
        # One-hot encoded categorical column
        base_feature, category = name.split("_", 1)

        if base_feature in customer_row.index:
            customer_value = str(customer_row[base_feature])
            matches_category = (customer_value == category)

            if matches_category:
                return f"Having {base_feature} = '{category}' is {direction} churn risk"
            else:
                # Positive framing: state the customer's actual value directly,
                # instead of "not having X".
                return (
                    f"Being on {base_feature} = '{customer_value}' "
                    f"(rather than '{category}') is {direction} churn risk"
                )
        # Fallback if base_feature isn't found for some reason
        return f"{base_feature}: {category} is {direction} churn risk"

    else:
        # Numeric feature — use the customer's real, unscaled value
        if name in customer_row.index:
            customer_value = customer_row[name]
            return f"{name} of {customer_value} is {direction} churn risk"
        return f"{name} is {direction} churn risk"


def explain_single(customer_dict: dict, top_n: int = 5) -> dict:
    df = pd.DataFrame([customer_dict])
    df = normalize_columns(df)
    validate_columns(df)

    cleaned = clean_raw_dataframe(df)
    features = get_feature_dataframe(cleaned)
    customer_row = features.iloc[0]  # actual values, used for correct descriptions

    transformed = preprocessor.transform(features)

    shap_values = explainer.shap_values(transformed)

    if isinstance(shap_values, list):
        row_shap = shap_values[1][0]
    else:
        row_shap = shap_values[0]

    # Keep the RAW name (with cat__/num__ prefix) alongside the shap value —
    # we need the raw name to correctly parse base_feature/category in _describe_direction.
    pairs = list(zip(feature_names_transformed, row_shap))
    pairs_sorted = sorted(pairs, key=lambda x: abs(x[1]), reverse=True)

    top_factors = pairs_sorted[:top_n]

    increasing_risk = [
        {
            "feature": _clean_feature_name(raw_name),
            "impact": round(float(value), 4),
            "explanation": _describe_direction(raw_name, value, customer_row),
        }
        for raw_name, value in top_factors if value > 0
    ]
    decreasing_risk = [
        {
            "feature": _clean_feature_name(raw_name),
            "impact": round(float(value), 4),
            "explanation": _describe_direction(raw_name, value, customer_row),
        }
        for raw_name, value in top_factors if value < 0
    ]

    return {
        "increasing_risk_factors": increasing_risk,
        "decreasing_risk_factors": decreasing_risk,
    }