"""
Optional transformer fine-tuning (DistilBERT / DeBERTa-v3 / RoBERTa).

Kept separate & opt-in because it requires torch + transformers and is heavy.
Enable via config.transformers.enabled: true, then:

    PYTHONPATH=. python training/transformers_train.py distilbert

On machines with limited RAM, prefer distilbert-base-uncased and a small
per-class subsample. The ensemble automatically includes the transformer
probabilities if a fine-tuned model directory exists under saved_models/.
"""
from __future__ import annotations

import sys
from pathlib import Path

from utils import abspath, load_config


def train_transformer(key: str = "distilbert") -> str:
    cfg = load_config()
    tcfg = cfg["transformers"]
    if not tcfg["enabled"]:
        raise SystemExit("transformers.enabled is false in config.yaml")

    try:
        import numpy as np
        import torch
        from datasets import Dataset
        from sklearn.model_selection import train_test_split
        from sklearn.preprocessing import LabelEncoder
        from transformers import (AutoModelForSequenceClassification,
                                  AutoTokenizer, Trainer, TrainingArguments)
    except ImportError as e:
        raise SystemExit(f"Install torch+transformers+datasets first: {e}")

    from datasets.generate_dataset import load_all_datasets

    model_name = tcfg["models"][key]
    df = load_all_datasets().dropna(subset=["text", "label"])
    le = LabelEncoder().fit(cfg["labels"]["classes"])
    df["y"] = le.transform(df["label"])

    tr, te = train_test_split(df, test_size=0.2, stratify=df["y"],
                              random_state=cfg["project"]["random_seed"])
    tok = AutoTokenizer.from_pretrained(model_name)

    def enc(batch):
        return tok(batch["text"], truncation=True,
                   max_length=tcfg["max_length"], padding="max_length")

    ds_tr = Dataset.from_pandas(tr[["text", "y"]]).map(enc, batched=True).rename_column("y", "labels")
    ds_te = Dataset.from_pandas(te[["text", "y"]]).map(enc, batched=True).rename_column("y", "labels")

    model = AutoModelForSequenceClassification.from_pretrained(
        model_name, num_labels=len(le.classes_))

    out = abspath(cfg["paths"]["saved_models_dir"]) / f"transformer_{key}"
    args = TrainingArguments(
        output_dir=str(out), num_train_epochs=tcfg["epochs"],
        per_device_train_batch_size=tcfg["batch_size"],
        per_device_eval_batch_size=tcfg["batch_size"],
        eval_strategy="epoch", save_strategy="epoch",
        load_best_model_at_end=True, logging_steps=50, report_to=[])
    trainer = Trainer(model=model, args=args,
                      train_dataset=ds_tr, eval_dataset=ds_te)
    trainer.train()
    trainer.save_model(str(out))
    tok.save_pretrained(str(out))
    print(f"Saved transformer -> {out}")
    return str(out)


if __name__ == "__main__":
    key = sys.argv[1] if len(sys.argv) > 1 else "distilbert"
    train_transformer(key)
