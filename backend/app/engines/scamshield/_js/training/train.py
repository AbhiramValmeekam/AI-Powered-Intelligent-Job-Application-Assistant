"""
Model zoo + training + evaluation + auto-selection for JobShield AI.

Trains: Logistic Regression, Linear SVM, Random Forest, XGBoost, LightGBM
(classical). Optional transformer fine-tuning (DistilBERT/DeBERTa-v3/RoBERTa)
is available in training.transformers_train when torch+transformers are
installed and config.transformers.enabled is true.

Artifacts are written to saved_models/:
  feature_pipeline.joblib   - fitted TF-IDF + scaler
  label_encoder.joblib      - class <-> int mapping
  model_<name>.joblib       - each trained classical model
  best_model.joblib         - the auto-selected best model
  reports/metrics.json      - per-model metrics
  reports/*.png             - (optional) plots
"""
from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Dict, Tuple

import joblib
import numpy as np
import pandas as pd
from sklearn.calibration import CalibratedClassifierCV
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (accuracy_score, classification_report,
                             confusion_matrix, f1_score, precision_score,
                             recall_score)
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.svm import LinearSVC

from datasets.generate_dataset import load_all_datasets
from training.feature_pipeline import fit_feature_pipeline
from utils import abspath, ensure_dirs, load_config


def _build_estimators(cfg: dict, n_classes: int):
    m = cfg["models"]
    seed = cfg["project"]["random_seed"]
    est = {}
    if m["logistic_regression"]["enabled"]:
        est["logistic_regression"] = LogisticRegression(
            max_iter=m["logistic_regression"]["max_iter"],
            C=m["logistic_regression"]["C"], n_jobs=-1)
    if m["linear_svm"]["enabled"]:
        # wrap for probability estimates
        est["linear_svm"] = CalibratedClassifierCV(
            LinearSVC(C=m["linear_svm"]["C"]), cv=3)
    if m["random_forest"]["enabled"]:
        est["random_forest"] = RandomForestClassifier(
            n_estimators=m["random_forest"]["n_estimators"],
            max_depth=m["random_forest"]["max_depth"],
            random_state=seed, n_jobs=-1)
    if m["xgboost"]["enabled"]:
        try:
            from xgboost import XGBClassifier
            est["xgboost"] = XGBClassifier(
                n_estimators=m["xgboost"]["n_estimators"],
                max_depth=m["xgboost"]["max_depth"],
                learning_rate=m["xgboost"]["learning_rate"],
                subsample=0.9, colsample_bytree=0.9,
                objective="multi:softprob", num_class=n_classes,
                tree_method="hist", eval_metric="mlogloss",
                random_state=seed, n_jobs=-1)
        except ImportError:
            print("  [warn] xgboost not installed - skipping")
    if m["lightgbm"]["enabled"]:
        try:
            from lightgbm import LGBMClassifier
            est["lightgbm"] = LGBMClassifier(
                n_estimators=m["lightgbm"]["n_estimators"],
                max_depth=m["lightgbm"]["max_depth"],
                learning_rate=m["lightgbm"]["learning_rate"],
                subsample=0.9, colsample_bytree=0.9,
                random_state=seed, n_jobs=-1, verbose=-1)
        except ImportError:
            print("  [warn] lightgbm not installed - skipping")
    return est


def _metrics(y_true, y_pred) -> Dict[str, float]:
    return {
        "accuracy": round(float(accuracy_score(y_true, y_pred)), 4),
        "precision_macro": round(float(precision_score(y_true, y_pred, average="macro", zero_division=0)), 4),
        "recall_macro": round(float(recall_score(y_true, y_pred, average="macro", zero_division=0)), 4),
        "f1_macro": round(float(f1_score(y_true, y_pred, average="macro", zero_division=0)), 4),
        "precision_weighted": round(float(precision_score(y_true, y_pred, average="weighted", zero_division=0)), 4),
        "recall_weighted": round(float(recall_score(y_true, y_pred, average="weighted", zero_division=0)), 4),
        "f1_weighted": round(float(f1_score(y_true, y_pred, average="weighted", zero_division=0)), 4),
    }


def train_all(n_per_class: int | None = None) -> dict:
    cfg = load_config()
    ensure_dirs()
    seed = cfg["project"]["random_seed"]
    out_dir = abspath(cfg["paths"]["saved_models_dir"])
    rep_dir = abspath(cfg["paths"]["reports_dir"])

    print("[1/5] Loading dataset ...")
    df = load_all_datasets()
    df = df.dropna(subset=["text", "label"]).drop_duplicates(subset=["text"])
    print(f"      {len(df)} rows | classes: {dict(df['label'].value_counts())}")

    # label encoding
    le = LabelEncoder().fit(cfg["labels"]["classes"])
    y = le.transform(df["label"])

    # split
    df_tr, df_te, y_tr, y_te = train_test_split(
        df, y, test_size=cfg["data"]["test_size"],
        stratify=y if cfg["data"]["stratify"] else None, random_state=seed)

    print("[2/5] Fitting feature pipeline ...")
    pipe = fit_feature_pipeline(df_tr)
    X_tr = pipe.transform(df_tr)
    X_te = pipe.transform(df_te)
    print(f"      feature matrix: {X_tr.shape}")

    print("[3/5] Training models ...")
    estimators = _build_estimators(cfg, n_classes=len(le.classes_))
    metrics_all: Dict[str, dict] = {}
    for name, est in estimators.items():
        t0 = time.time()
        # tree models need dense-ish; sparse is fine for all sklearn/xgb/lgbm
        est.fit(X_tr, y_tr)
        y_pred = est.predict(X_te)
        met = _metrics(y_te, y_pred)
        met["train_seconds"] = round(time.time() - t0, 2)
        met["confusion_matrix"] = confusion_matrix(y_te, y_pred).tolist()
        metrics_all[name] = met
        joblib.dump(est, out_dir / f"model_{name}.joblib")
        print(f"      {name:20s} acc={met['accuracy']:.4f} "
              f"f1_macro={met['f1_macro']:.4f} ({met['train_seconds']}s)")

    # auto-select
    primary = cfg["selection"]["primary_metric"]
    best_name = max(metrics_all, key=lambda n: metrics_all[n][primary])
    best_est = joblib.load(out_dir / f"model_{best_name}.joblib")
    print(f"[4/5] Best model by {primary}: {best_name} "
          f"({metrics_all[best_name][primary]:.4f})")

    print("[5/5] Saving artifacts ...")
    joblib.dump(pipe, out_dir / "feature_pipeline.joblib")
    joblib.dump(le, out_dir / "label_encoder.joblib")
    joblib.dump(best_est, out_dir / "best_model.joblib")

    report = {
        "best_model": best_name,
        "primary_metric": primary,
        "classes": list(le.classes_),
        "n_samples": int(len(df)),
        "test_size": cfg["data"]["test_size"],
        "metrics": metrics_all,
        "detailed_report": classification_report(
            y_te, best_est.predict(X_te),
            target_names=list(le.classes_), output_dict=True, zero_division=0),
    }
    with open(rep_dir / "metrics.json", "w", encoding="utf-8") as fh:
        json.dump(report, fh, indent=2)
    print(f"      metrics -> {rep_dir / 'metrics.json'}")
    return report


if __name__ == "__main__":
    train_all()
