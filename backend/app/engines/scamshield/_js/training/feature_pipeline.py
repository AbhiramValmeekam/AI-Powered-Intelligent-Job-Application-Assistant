"""
Feature pipeline shared by training and inference.

Builds a combined sparse matrix: [ TF-IDF(cleaned_text) | scaled structured feats ].
Persisted as a single joblib artifact so inference reproduces training exactly.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import List

import numpy as np
import pandas as pd
from scipy import sparse
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.preprocessing import MaxAbsScaler

from features.build_features import STRUCTURED_FEATURE_NAMES, structured_matrix
from training.clean import clean_series
from utils import load_config


@dataclass
class FeaturePipeline:
    """Fitted feature pipeline (TF-IDF + structured scaler)."""
    tfidf: TfidfVectorizer
    scaler: MaxAbsScaler
    structured_names: List[str]

    def transform(self, df: pd.DataFrame):
        cleaned = clean_series(df["text"])
        X_text = self.tfidf.transform(cleaned)
        X_struct = self.scaler.transform(structured_matrix(df))
        return sparse.hstack([X_text, sparse.csr_matrix(X_struct)]).tocsr()

    @property
    def feature_names(self) -> List[str]:
        return list(self.tfidf.get_feature_names_out()) + self.structured_names


def fit_feature_pipeline(df: pd.DataFrame) -> FeaturePipeline:
    cfg = load_config()["features"]["tfidf"]
    tfidf = TfidfVectorizer(
        max_features=cfg["max_features"],
        ngram_range=tuple(cfg["ngram_range"]),
        min_df=cfg["min_df"],
        sublinear_tf=cfg["sublinear_tf"],
    )
    cleaned = clean_series(df["text"])
    X_text = tfidf.fit_transform(cleaned)

    scaler = MaxAbsScaler()
    X_struct = scaler.fit_transform(structured_matrix(df))

    pipe = FeaturePipeline(tfidf=tfidf, scaler=scaler,
                           structured_names=list(STRUCTURED_FEATURE_NAMES))
    # sanity: cache combined width
    _ = sparse.hstack([X_text, sparse.csr_matrix(X_struct)])
    return pipe
