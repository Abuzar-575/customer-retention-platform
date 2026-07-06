import sys
import os
import json
import joblib
import pandas as pd
import numpy as np

# allow importing from preprocessing/ (sibling folder)
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from preprocessing.cleaner import (
    clean_raw_dataframe,
    encode_target,
    get_feature_dataframe,
    NUMERIC_FEATURES,
    CATEGORICAL_FEATURES,
)

from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import RandomForestClassifier
from xgboost import XGBClassifier
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score, roc_auc_score
)

# ---------- paths ----------
BASE_DIR = os.path.dirname(__file__)
DATASET_PATH = os.path.join(BASE_DIR, "..", "dataset", "WA_Fn-UseC_-Telco-Customer-Churn.csv")
SAVED_DIR = os.path.join(BASE_DIR, "saved")
os.makedirs(SAVED_DIR, exist_ok=True)

# ---------- 1. Load data ----------
print("Loading dataset...")
df = pd.read_csv(DATASET_PATH)

# ---------- 2. Clean ----------
df = clean_raw_dataframe(df)
df = encode_target(df)

X = get_feature_dataframe(df)
y = df["Churn"]

# ---------- 3. Build preprocessor ----------
preprocessor = ColumnTransformer(
    transformers=[
        ("num", StandardScaler(), NUMERIC_FEATURES),
        ("cat", OneHotEncoder(handle_unknown="ignore"), CATEGORICAL_FEATURES),
    ]
)

# ---------- 4. Train/test split ----------
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

# Fit preprocessor on training data ONLY, then transform both
X_train_processed = preprocessor.fit_transform(X_train)
X_test_processed = preprocessor.transform(X_test)

# ---------- 5. Define models ----------
models = {
    "Logistic Regression": LogisticRegression(
    max_iter=2000,
    random_state=42,
    C=0.5,
    class_weight="balanced",
    ),
    "Decision Tree": DecisionTreeClassifier(random_state=42),
    "Random Forest": RandomForestClassifier(random_state=42, n_estimators=200),
    "XGBoost": XGBClassifier(
        random_state=42,
        eval_metric="logloss",
        n_estimators=300,
        max_depth=4,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        min_child_weight=3,
       enable_categorical=False,
    ),
}

results = {}
trained_models = {}

# ---------- 6. Train + evaluate each ----------
for name, model in models.items():
    print(f"Training {name}...")
    model.fit(X_train_processed, y_train)
    preds = model.predict(X_test_processed)
    probs = model.predict_proba(X_test_processed)[:, 1]

    results[name] = {
        "accuracy": round(accuracy_score(y_test, preds), 4),
        "precision": round(precision_score(y_test, preds), 4),
        "recall": round(recall_score(y_test, preds), 4),
        "f1": round(f1_score(y_test, preds), 4),
        "roc_auc": round(roc_auc_score(y_test, probs), 4),
    }
    trained_models[name] = model
    print(f"  {name}: {results[name]}")

# ---------- 7. Pick best model ----------
best_model_name = max(results, key=lambda name: results[name]["roc_auc"])
best_model = trained_models[best_model_name]
print(f"\nSelected best model based on ROC-AUC: {best_model_name}")

# ---------- 8. Save everything ----------
print("Saving artifacts...")

joblib.dump(best_model, os.path.join(SAVED_DIR, "best_model.pkl"))
joblib.dump(preprocessor, os.path.join(SAVED_DIR, "preprocessor.pkl"))
joblib.dump(list(X.columns), os.path.join(SAVED_DIR, "feature_names.pkl"))

# Background sample for SHAP (small random sample of training data, pre-transform)
background_sample = X_train.sample(n=min(100, len(X_train)), random_state=42)
joblib.dump(background_sample, os.path.join(SAVED_DIR, "background_sample.pkl"))

metrics_output = {
    "models": results,
    "best_model": best_model_name,
}
with open(os.path.join(SAVED_DIR, "metrics.json"), "w") as f:
    json.dump(metrics_output, f, indent=2)

print("Done. Artifacts saved to:", SAVED_DIR)
print(json.dumps(metrics_output, indent=2))