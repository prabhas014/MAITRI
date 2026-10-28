"""
evaluate_models.py - MAITRI ML Evaluation Script
==================================================
Produces held-out test-set metrics for:
  1. Stress Prediction  - Random Forest on synthetic WESAD-like data
  2. Emotion Recognition - SGDClassifier on FER2013

Results are written to ml_results.json (same directory as this script).

Usage (from the backend/ directory, inside the venv):
    python evaluate_models.py

The FER2013 archive.zip is expected at:
    C:/Users/prabh/Downloads/archive.zip
You can override this path with the --fer-zip argument:
    python evaluate_models.py --fer-zip "D:/data/archive.zip"

IMPORTANT LABELLING:
  - Stress dataset: SYNTHETIC WESAD-like data (not real WESAD)
  - Emotion dataset: FER2013

No application code (FastAPI, MongoDB, Gemini) is imported here.
All evaluation is done on the held-out test split only.
"""

import os
import sys
import json
import random
import argparse
import numpy as np

RANDOM_STATE = 42
random.seed(RANDOM_STATE)
np.random.seed(RANDOM_STATE)


def generate_synthetic_stress_data():
    """
    Identical to generate_synthetic_stress_data() in train_models.py.
    Uses random.seed(42) so the dataset is always identical.
    Features: [heart_rate, eda, temperature, respiration]
    Labels  : 0 = Low Stress, 1 = Medium Stress, 2 = High Stress
    Distribution: 60 Low / 50 Medium / 50 High -> 160 samples total
    """
    random.seed(RANDOM_STATE)
    X, y = [], []

    for _ in range(60):
        hr   = round(60  + random.random() * 15)
        eda  = round(0.2 + random.random() * 0.5,  3)
        temp = round(36.2 + random.random() * 0.5, 1)
        resp = round(11  + random.random() * 4)
        X.append([hr, eda, temp, resp])
        y.append(0)

    for _ in range(50):
        hr   = round(80  + random.random() * 15)
        eda  = round(1.1 + random.random() * 0.6,  3)
        temp = round(36.8 + random.random() * 0.4, 1)
        resp = round(16  + random.random() * 4)
        X.append([hr, eda, temp, resp])
        y.append(1)

    for _ in range(50):
        hr   = round(100 + random.random() * 20)
        eda  = round(2.4 + random.random() * 1.2,  3)
        temp = round(37.3 + random.random() * 0.6, 1)
        resp = round(21  + random.random() * 5)
        X.append([hr, eda, temp, resp])
        y.append(2)

    return np.array(X), np.array(y)


def evaluate_stress_model():
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import (
        accuracy_score, precision_score, recall_score,
        f1_score, confusion_matrix, classification_report
    )

    print("\n" + "=" * 60)
    print("  STRESS PREDICTION - Random Forest")
    print("  Dataset: Synthetic WESAD-like (NOT real WESAD)")
    print("=" * 60)

    X, y = generate_synthetic_stress_data()
    total_samples = len(X)
    label_names = ["Low Stress", "Medium Stress", "High Stress"]

    for idx, name in enumerate(label_names):
        count = int(np.sum(y == idx))
        print(f"  Class {idx} ({name}): {count} samples")

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=RANDOM_STATE, stratify=y
    )

    print(f"\n  Total samples : {total_samples}")
    print(f"  Training set  : {len(X_train)} samples (80%)")
    print(f"  Test set      : {len(X_test)} samples (20%)")

    clf = RandomForestClassifier(n_estimators=50, random_state=RANDOM_STATE)
    clf.fit(X_train, y_train)

    y_pred = clf.predict(X_test)

    accuracy  = float(accuracy_score(y_test, y_pred))
    precision = float(precision_score(y_test, y_pred, average="weighted", zero_division=0))
    recall    = float(recall_score(y_test, y_pred,    average="weighted", zero_division=0))
    f1        = float(f1_score(y_test, y_pred,        average="weighted", zero_division=0))
    cm        = confusion_matrix(y_test, y_pred).tolist()
    importances = clf.feature_importances_.tolist()
    feature_names = ["heart_rate", "eda", "temperature", "respiration"]

    print(f"\n  [Held-out Test Set Metrics]")
    print(f"  Accuracy           : {accuracy:.4f}  ({accuracy*100:.2f}%)")
    print(f"  Weighted Precision : {precision:.4f}")
    print(f"  Weighted Recall    : {recall:.4f}")
    print(f"  Weighted F1-score  : {f1:.4f}")
    print(f"\n  Confusion Matrix (rows=true, cols=predicted):")
    for i, row in enumerate(cm):
        print(f"    {label_names[i]:>15}: {row}")
    print(f"\n  Feature Importances:")
    for name, imp in zip(feature_names, importances):
        print(f"    {name:>15}: {imp:.4f}")
    print(f"\n  Per-class report:")
    print(classification_report(y_test, y_pred, target_names=label_names, zero_division=0))

    return {
        "model": "Random Forest (n_estimators=50)",
        "dataset": "Synthetic WESAD-like data (NOT real WESAD)",
        "note": "160 synthetically generated samples modelled on WESAD physiological signal distributions. Labels: 0=Low Stress, 1=Medium Stress, 2=High Stress.",
        "random_state": RANDOM_STATE,
        "split": "80/20 stratified train-test split",
        "total_samples": total_samples,
        "train_samples": len(X_train),
        "test_samples": len(X_test),
        "class_distribution": {
            "Low Stress (0)":    int(np.sum(y == 0)),
            "Medium Stress (1)": int(np.sum(y == 1)),
            "High Stress (2)":   int(np.sum(y == 2)),
        },
        "metrics": {
            "accuracy":           round(accuracy,  4),
            "weighted_precision": round(precision, 4),
            "weighted_recall":    round(recall,    4),
            "weighted_f1_score":  round(f1,        4),
        },
        "confusion_matrix": {
            "labels": label_names,
            "matrix": cm,
        },
        "feature_importances": {
            name: round(imp, 6)
            for name, imp in zip(feature_names, importances)
        },
    }


EMOTIONS = ["Angry", "Disgust", "Fear", "Happy", "Neutral", "Sad", "Surprise"]


def load_fer2013_data(zip_path, max_samples_per_class=500):
    import zipfile
    import io
    from PIL import Image

    label_map = {emotion.lower(): idx for idx, emotion in enumerate(EMOTIONS)}
    candidates = {label: [] for label in label_map}

    with zipfile.ZipFile(zip_path, "r") as zf:
        for entry in zf.namelist():
            normalized = entry.replace("\\", "/")
            parts = normalized.split("/")
            if (
                len(parts) >= 3
                and parts[0] == "train"
                and parts[1] in label_map
                and entry.lower().endswith((".jpg", ".jpeg", ".png"))
            ):
                candidates[parts[1]].append(entry)

        X, y = [], []
        per_class_counts = {}

        for label, entries in candidates.items():
            selected = entries
            if len(entries) > max_samples_per_class:
                random.seed(RANDOM_STATE)
                selected = random.sample(entries, max_samples_per_class)

            loaded = 0
            for entry in selected:
                try:
                    img_data = zf.read(entry)
                    img = Image.open(io.BytesIO(img_data)).convert("L")
                    img = img.resize((48, 48))
                    pixels = np.array(img, dtype=np.float32) / 255.0
                    X.append(pixels.flatten())
                    y.append(label_map[label])
                    loaded += 1
                except Exception as e:
                    print(f"  [WARN] Failed to read {entry}: {e}")

            per_class_counts[EMOTIONS[label_map[label]]] = loaded
            print(f"  Loaded {loaded:>4} samples - class: '{label}'")

    if len(X) == 0:
        raise ValueError("No images could be parsed from the archive. Check the zip structure.")

    return np.array(X), np.array(y), per_class_counts


def evaluate_emotion_model(zip_path):
    from sklearn.linear_model import SGDClassifier
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import (
        accuracy_score, precision_score, recall_score,
        f1_score, confusion_matrix, classification_report
    )

    print("\n" + "=" * 60)
    print("  EMOTION RECOGNITION - SGDClassifier (log loss)")
    print("  Dataset: FER2013")
    print("=" * 60)

    if not os.path.exists(zip_path):
        msg = (
            f"\n  [SKIP] FER2013 archive not found at: {zip_path}\n"
            f"  Download archive.zip from Kaggle (FER2013 dataset) and\n"
            f"  place it at the path above, or pass --fer-zip <path>.\n"
            f"  Emotion evaluation will be skipped.\n"
        )
        print(msg)
        return {
            "model": "SGDClassifier (loss=log_loss, max_iter=1000)",
            "dataset": "FER2013",
            "status": "SKIPPED - archive.zip not found",
            "expected_path": zip_path,
        }

    print(f"\n  Loading FER2013 data from: {zip_path}")
    X, y, per_class_counts = load_fer2013_data(zip_path, max_samples_per_class=500)
    total_samples = len(X)

    print(f"\n  Total samples loaded : {total_samples}")
    print(f"  Per-class breakdown  :")
    for emotion, count in per_class_counts.items():
        print(f"    {emotion:>10}: {count}")

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=RANDOM_STATE, stratify=y
    )

    print(f"\n  Training set  : {len(X_train)} samples (80%)")
    print(f"  Test set      : {len(X_test)} samples (20%)")
    print(f"\n  Fitting SGDClassifier...")

    clf = SGDClassifier(loss="log_loss", max_iter=1000, tol=1e-3, random_state=RANDOM_STATE)
    clf.fit(X_train, y_train)

    y_pred = clf.predict(X_test)

    accuracy  = float(accuracy_score(y_test, y_pred))
    precision = float(precision_score(y_test, y_pred, average="weighted", zero_division=0))
    recall    = float(recall_score(y_test, y_pred,    average="weighted", zero_division=0))
    f1        = float(f1_score(y_test, y_pred,        average="weighted", zero_division=0))
    cm        = confusion_matrix(y_test, y_pred).tolist()

    print(f"\n  [Held-out Test Set Metrics]")
    print(f"  Accuracy           : {accuracy:.4f}  ({accuracy*100:.2f}%)")
    print(f"  Weighted Precision : {precision:.4f}")
    print(f"  Weighted Recall    : {recall:.4f}")
    print(f"  Weighted F1-score  : {f1:.4f}")
    print(f"\n  Confusion Matrix (rows=true, cols=predicted):")
    for i, row in enumerate(cm):
        print(f"    {EMOTIONS[i]:>10}: {row}")
    print(f"\n  Per-class report:")
    print(classification_report(y_test, y_pred, target_names=EMOTIONS, zero_division=0))

    return {
        "model": "SGDClassifier (loss=log_loss, max_iter=1000, tol=1e-3)",
        "dataset": "FER2013",
        "note": "Trained on FER2013 train/ split only (max 500 samples per class). 48x48 greyscale pixels normalised to [0,1] and flattened.",
        "random_state": RANDOM_STATE,
        "split": "80/20 stratified train-test split",
        "total_samples": total_samples,
        "train_samples": len(X_train),
        "test_samples": len(X_test),
        "samples_per_class": per_class_counts,
        "class_labels": EMOTIONS,
        "metrics": {
            "accuracy":           round(accuracy,  4),
            "weighted_precision": round(precision, 4),
            "weighted_recall":    round(recall,    4),
            "weighted_f1_score":  round(f1,        4),
        },
        "confusion_matrix": {
            "labels": EMOTIONS,
            "matrix": cm,
        },
    }


def main():
    parser = argparse.ArgumentParser(
        description="Evaluate MAITRI ML models and write results to ml_results.json"
    )
    parser.add_argument(
        "--fer-zip",
        default=os.path.join(os.path.expanduser("~"), "Downloads", "archive.zip"),
        help="Path to the FER2013 archive.zip (default: ~/Downloads/archive.zip)",
    )
    args = parser.parse_args()

    print("\n+----------------------------------------------------------+")
    print("|         MAITRI - ML Model Evaluation Script             |")
    print("|  All metrics computed on held-out test sets only        |")
    print("|  random_state=42 - fully reproducible                   |")
    print("+----------------------------------------------------------+")

    results = {
        "evaluation_info": {
            "script": "evaluate_models.py",
            "random_state": RANDOM_STATE,
            "note": "All metrics are computed on the held-out test set (20%) only. Training data is never used for evaluation.",
        }
    }

    stress_results = evaluate_stress_model()
    results["stress_prediction"] = stress_results

    emotion_results = evaluate_emotion_model(args.fer_zip)
    results["emotion_recognition"] = emotion_results

    output_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ml_results.json")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)

    print("\n" + "=" * 60)
    print(f"  Results saved to: {output_path}")
    print("=" * 60 + "\n")


if __name__ == "__main__":
    main()
