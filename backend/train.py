"""
train.py — GRYNDR ML Training Script
=====================================
Trains a RandomForestClassifier to predict study-topic difficulty.

SYNTHETIC DATA NOTICE
---------------------
The training dataset is ENTIRELY SYNTHETIC. It was generated programmatically
using realistic rules derived from educational research heuristics:

  - Low confidence + low quiz score + many days since revision + high complexity
    → likely Hard
  - High confidence + high quiz score + few days since revision + low complexity
    → likely Easy
  - Everything else → Medium

No real student data was used. The model is intended as a demonstration of the
ML pipeline. In production, it would be retrained on real student records.

Features used (all numeric, no leakage):
  1. confidence          — student self-reported (1–10)
  2. prev_quiz_score     — last quiz percentage (0–100)
  3. days_since_revision — days elapsed since last study (0–60)
  4. available_hours     — hours available today (0.5–8)
  5. complexity          — topic complexity rating (1–10)

Output (label):
  0 = Easy, 1 = Medium, 2 = Hard

Usage:
    python train.py
"""

import os
import json
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score,
    f1_score, confusion_matrix, classification_report
)
import joblib

RANDOM_STATE = 42
N_SAMPLES = 3000
MODEL_DIR = os.path.join(os.path.dirname(__file__), "ml")
MODEL_PATH = os.path.join(MODEL_DIR, "difficulty_model.joblib")
METRICS_PATH = os.path.join(MODEL_DIR, "metrics.json")
DATA_PATH = os.path.join(MODEL_DIR, "training_data.csv")

os.makedirs(MODEL_DIR, exist_ok=True)


def generate_synthetic_data(n: int, seed: int = RANDOM_STATE) -> pd.DataFrame:
    """
    Generate a reproducible synthetic dataset.

    Label assignment rules (applied before adding noise to avoid leakage):
      Hard   → difficulty_score >= 65
      Easy   → difficulty_score <= 35
      Medium → everything in between

    difficulty_score = (
        (10 - confidence) * 6      +   # low confidence → harder
        (100 - prev_quiz_score) * 0.3 + # low score → harder
        days_since_revision * 0.8  +   # more forgotten → harder
        complexity * 4             -   # high complexity → harder
        available_hours * 2           # more time → slightly easier
    ) / 3   (normalised roughly to 0–100)
    """
    rng = np.random.default_rng(seed)

    confidence = rng.uniform(1, 10, n)
    prev_quiz_score = rng.uniform(0, 100, n)
    days_since_revision = rng.integers(0, 61, n).astype(float)
    available_hours = rng.uniform(0.5, 8, n)
    complexity = rng.integers(1, 11, n).astype(float)

    raw = (
        (10 - confidence) * 6
        + (100 - prev_quiz_score) * 0.3
        + days_since_revision * 0.8
        + complexity * 4
        - available_hours * 2
    ) / 3.0

    # Add small Gaussian noise so the boundary isn't perfectly deterministic
    noise = rng.normal(0, 3, n)
    difficulty_score = np.clip(raw + noise, 0, 100)

    # Assign three classes using score quantiles.
# This ensures all three difficulty levels have sufficient examples.
    labels = pd.qcut(
    difficulty_score,
    q=3,
    labels=[0, 1, 2],
    duplicates="drop"
)   .astype(int)

    df = pd.DataFrame({
        "confidence": np.round(confidence, 2),
        "prev_quiz_score": np.round(prev_quiz_score, 2),
        "days_since_revision": days_since_revision.astype(int),
        "available_hours": np.round(available_hours, 2),
        "complexity": complexity.astype(int),
        "difficulty": labels,
    })
    return df


def train():
    print("=" * 60)
    print("GRYNDR — ML Training Pipeline")
    print("Dataset: SYNTHETIC (see module docstring)")
    print("=" * 60)

    # ── 1. Generate and save data ──────────────────────────────────
    df = generate_synthetic_data(N_SAMPLES)
    df.to_csv(DATA_PATH, index=False)
    print(f"\n✓ Synthetic dataset saved → {DATA_PATH}")
    print(f"  Samples: {len(df)}")
    print(f"  Label distribution:\n{df['difficulty'].value_counts().sort_index().rename({0:'Easy',1:'Medium',2:'Hard'})}\n")

    feature_cols = [
        "confidence", "prev_quiz_score", "days_since_revision",
        "available_hours", "complexity"
    ]
    X = df[feature_cols].values
    y = df["difficulty"].values

    # ── 2. Train/test split (stratified) ──────────────────────────
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, stratify=y, random_state=RANDOM_STATE
    )

    # ── 3. Train ──────────────────────────────────────────────────
    clf = RandomForestClassifier(
        n_estimators=200,
        max_depth=12,
        min_samples_leaf=5,
        class_weight="balanced",
        random_state=RANDOM_STATE,
        n_jobs=-1,
    )
    clf.fit(X_train, y_train)
    print("✓ Model trained")

    # ── 4. Evaluate ───────────────────────────────────────────────
    y_pred = clf.predict(X_test)
    label_names = ["Easy", "Medium", "Hard"]

    accuracy  = float(accuracy_score(y_test, y_pred))
    precision = float(precision_score(y_test, y_pred, average="weighted"))
    recall    = float(recall_score(y_test, y_pred, average="weighted"))
    f1        = float(f1_score(y_test, y_pred, average="weighted"))
    cm        = confusion_matrix(y_test, y_pred).tolist()

    # 5-fold CV on full dataset
    cv_scores = cross_val_score(clf, X, y, cv=5, scoring="accuracy")

    print("\n── Evaluation Metrics ──────────────────────────────────────")
    print(f"  Accuracy  (test): {accuracy:.4f}")
    print(f"  Precision (w-avg): {precision:.4f}")
    print(f"  Recall    (w-avg): {recall:.4f}")
    print(f"  F1        (w-avg): {f1:.4f}")
    print(f"  CV Accuracy (5-fold): {cv_scores.mean():.4f} ± {cv_scores.std():.4f}")
    print("\n── Classification Report ───────────────────────────────────")
    print(classification_report(
    y_test,
    y_pred,
    labels=[0, 1, 2],
    target_names=label_names,
    zero_division=0
    ))    
    print(f"── Confusion Matrix (Easy | Medium | Hard) ─────────────────")
    print(f"  Rows=actual, Cols=predicted")
    for row, label in zip(cm, label_names):
        print(f"  {label:6s}: {row}")

    # ── 5. Feature importance ─────────────────────────────────────
    importances = {
        col: float(imp)
        for col, imp in zip(feature_cols, clf.feature_importances_)
    }
    print("\n── Feature Importances ─────────────────────────────────────")
    for k, v in sorted(importances.items(), key=lambda x: -x[1]):
        print(f"  {k:<25s}: {v:.4f}")

    # ── 6. Save model and metrics ─────────────────────────────────
    joblib.dump(clf, MODEL_PATH)
    print(f"\n✓ Model saved → {MODEL_PATH}")

    metrics = {
        "accuracy": accuracy,
        "precision_weighted": precision,
        "recall_weighted": recall,
        "f1_weighted": f1,
        "cv_accuracy_mean": float(cv_scores.mean()),
        "cv_accuracy_std": float(cv_scores.std()),
        "confusion_matrix": cm,
        "label_names": label_names,
        "feature_importances": importances,
        "n_train": int(X_train.shape[0]),
        "n_test": int(X_test.shape[0]),
        "dataset_note": "SYNTHETIC — generated programmatically, not real student data",
    }
    with open(METRICS_PATH, "w") as f:
        json.dump(metrics, f, indent=2)
    print(f"✓ Metrics saved → {METRICS_PATH}")
    print("\n✓ Training complete.\n")
    return clf, metrics


if __name__ == "__main__":
    train()
