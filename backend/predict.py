"""
predict.py — GRYNDR prediction module.
Loads the saved RandomForest model and exposes a predict() function.
"""
import os
import json
import numpy as np
import joblib

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "ml", "difficulty_model.joblib")
METRICS_PATH = os.path.join(BASE_DIR, "ml", "metrics.json")

LABEL_MAP = {0: "Easy", 1: "Medium", 2: "Hard"}

_model = None
_metrics: dict = {}


def _load_model():
    global _model, _metrics
    if _model is None:
        if not os.path.exists(MODEL_PATH):
            raise FileNotFoundError(
                f"Model not found at {MODEL_PATH}. "
                "Run `python train.py` first."
            )
        try:
            _model = joblib.load(MODEL_PATH)
        except Exception as exc:
            raise RuntimeError("ML model could not be loaded. Run python -m backend.train.") from exc
    if not _metrics and os.path.exists(METRICS_PATH):
        with open(METRICS_PATH) as f:
            _metrics = json.load(f)
    return _model


def predict(
    confidence: float,
    prev_quiz_score: float,
    days_since_revision: int,
    available_hours: float,
    complexity: int,
) -> dict:
    """
    Predict topic difficulty from the five input features.

    Returns:
        {
          "difficulty": "Easy" | "Medium" | "Hard",
          "probabilities": {"Easy": float, "Medium": float, "Hard": float},
          "features_used": { ... }
        }
    """
    model = _load_model()
    features = np.array([[
        confidence,
        prev_quiz_score,
        days_since_revision,
        available_hours,
        complexity,
    ]], dtype=float)

    try:
        pred_class = int(model.predict(features)[0])
        proba = model.predict_proba(features)[0].tolist()
    except Exception as exc:
        raise RuntimeError("ML prediction failed. Run python -m backend.train.") from exc

    # Align probabilities to class order in the model
    classes = [int(c) for c in model.classes_]
    prob_dict = {LABEL_MAP[c]: round(float(p), 4) for c, p in zip(classes, proba)}

    return {
        "difficulty": LABEL_MAP[pred_class],
        "probabilities": {
            "Easy":   prob_dict.get("Easy", 0.0),
            "Medium": prob_dict.get("Medium", 0.0),
            "Hard":   prob_dict.get("Hard", 0.0),
        },
        "features_used": {
            "confidence": confidence,
            "prev_quiz_score": prev_quiz_score,
            "days_since_revision": days_since_revision,
            "available_hours": available_hours,
            "complexity": complexity,
        },
    }


def get_metrics() -> dict:
    _load_model()
    return _metrics
