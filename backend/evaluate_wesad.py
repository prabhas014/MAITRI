import os
import pickle
import json
import warnings

import numpy as np
from scipy.signal import find_peaks
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import GroupShuffleSplit
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    confusion_matrix,
    classification_report,
)

warnings.filterwarnings("ignore")


# ============================================================
# MAITRI - REAL WESAD MODEL EVALUATION
# ============================================================
#
# This script evaluates stress using REAL WESAD data.
#
# WESAD labels:
#   1 = Baseline
#   2 = Stress
#   3 = Amusement
#   4 = Meditation
#
# For this evaluation:
#   0 = Non-Stress
#   1 = Stress
#
# The existing MAITRI application is NOT modified.
# ============================================================


# Your extracted WESAD dataset
WESAD_ROOT = r"C:\Users\prabh\Downloads\WESAD\WESAD"

# Output file
OUTPUT_FILE = "wesad_ml_results.json"

# WESAD chest signals are sampled at 700 Hz
CHEST_FS = 700

# Analyze the physiological signals in 60-second windows
WINDOW_SECONDS = 60


# ============================================================
# FIND WESAD SUBJECT FILES
# ============================================================

def find_subject_files(root):

    files = []

    if not os.path.exists(root):
        raise FileNotFoundError(
            f"WESAD directory not found:\n{root}"
        )

    for name in sorted(os.listdir(root)):

        subject_dir = os.path.join(root, name)

        if not os.path.isdir(subject_dir):
            continue

        pkl_path = os.path.join(
            subject_dir,
            f"{name}.pkl"
        )

        if os.path.exists(pkl_path):
            files.append(
                (name, pkl_path)
            )

    if not files:
        raise FileNotFoundError(
            f"No WESAD .pkl subject files found inside:\n{root}"
        )

    return files


# ============================================================
# SIGNAL UTILITIES
# ============================================================

def safe_array(x):

    return np.asarray(
        x,
        dtype=np.float64
    ).flatten()


def clean_signal(x):

    x = safe_array(x)

    if len(x) == 0:
        return x

    if np.any(np.isnan(x)):

        median = np.nanmedian(x)

        if np.isnan(median):
            median = 0.0

        x = np.nan_to_num(
            x,
            nan=median,
            posinf=0.0,
            neginf=0.0
        )

    else:

        x = np.nan_to_num(
            x,
            posinf=0.0,
            neginf=0.0
        )

    return x


# ============================================================
# HEART RATE FROM ECG
# ============================================================

def calculate_heart_rate(ecg, fs):

    ecg = clean_signal(ecg)

    if len(ecg) < fs * 5:
        return np.nan

    std = np.std(ecg)

    if std == 0:
        return np.nan

    normalized = (
        ecg - np.mean(ecg)
    ) / std

    # Minimum 0.4 seconds between heartbeats
    # corresponds approximately to 150 BPM maximum.
    min_distance = int(
        0.4 * fs
    )

    prominence = max(
        0.4,
        np.std(normalized) * 0.5
    )

    peaks, _ = find_peaks(
        normalized,
        distance=min_distance,
        prominence=prominence
    )

    if len(peaks) < 2:
        return np.nan

    intervals = (
        np.diff(peaks) / fs
    )

    # Physiologically plausible RR intervals
    intervals = intervals[
        (intervals >= 0.3) &
        (intervals <= 2.0)
    ]

    if len(intervals) == 0:
        return np.nan

    hr = 60.0 / np.median(intervals)

    if 35 <= hr <= 200:
        return float(hr)

    return np.nan


# ============================================================
# RESPIRATION RATE
# ============================================================

def calculate_respiration_rate(
    resp,
    fs
):

    resp = clean_signal(resp)

    if len(resp) < fs * 10:
        return np.nan

    # Breathing is much slower than ECG.
    distance = int(
        1.5 * fs
    )

    prominence = max(
        np.std(resp) * 0.15,
        1e-8
    )

    peaks, _ = find_peaks(
        resp,
        distance=distance,
        prominence=prominence
    )

    duration_minutes = (
        len(resp) / fs / 60.0
    )

    if duration_minutes <= 0:
        return np.nan

    breaths_per_minute = (
        len(peaks)
        / duration_minutes
    )

    if 4 <= breaths_per_minute <= 40:
        return float(
            breaths_per_minute
        )

    return np.nan


# ============================================================
# EDA FEATURES
# ============================================================

def calculate_eda_features(eda):

    eda = clean_signal(eda)

    if len(eda) == 0:
        return np.nan, np.nan

    eda_mean = float(
        np.mean(eda)
    )

    eda_std = float(
        np.std(eda)
    )

    return eda_mean, eda_std


# ============================================================
# TEMPERATURE
# ============================================================

def calculate_temperature(temp):

    temp = clean_signal(temp)

    if len(temp) == 0:
        return np.nan

    return float(
        np.mean(temp)
    )


# ============================================================
# FEATURE EXTRACTION
# ============================================================

def extract_features(
    chest,
    start,
    end
):

    ecg = chest["ECG"][start:end]

    eda = chest["EDA"][start:end]

    temp = chest["Temp"][start:end]

    resp = chest["Resp"][start:end]

    heart_rate = calculate_heart_rate(
        ecg,
        CHEST_FS
    )

    eda_mean, eda_std = (
        calculate_eda_features(eda)
    )

    temperature = calculate_temperature(
        temp
    )

    respiration = calculate_respiration_rate(
        resp,
        CHEST_FS
    )

    return [
        heart_rate,
        eda_mean,
        temperature,
        respiration,
        eda_std
    ]


# ============================================================
# LOAD ONE SUBJECT
# ============================================================

def load_subject(path):

    print(
        f"Loading: {path}"
    )

    with open(
        path,
        "rb"
    ) as f:

        data = pickle.load(
            f,
            encoding="latin1"
        )

    signal_data = data["signal"]

    labels = np.asarray(
        data["label"]
    ).flatten()

    chest = signal_data["chest"]

    required = [
        "ECG",
        "EDA",
        "Temp",
        "Resp"
    ]

    for key in required:

        if key not in chest:

            raise KeyError(
                f"Required chest signal '{key}' not found."
            )

    return chest, labels


# ============================================================
# BUILD DATASET
# ============================================================

def build_dataset(
    subject_files
):

    X = []

    y = []

    groups = []

    print()
    print("=" * 65)
    print("BUILDING REAL WESAD DATASET")
    print("=" * 65)

    window_size = (
        CHEST_FS
        * WINDOW_SECONDS
    )

    for subject_id, path in subject_files:

        try:

            chest, labels = (
                load_subject(path)
            )

            signal_length = min(
                len(chest["ECG"]),
                len(chest["EDA"]),
                len(chest["Temp"]),
                len(chest["Resp"]),
                len(labels)
            )

            print(
                f"{subject_id}: "
                f"{signal_length:,} synchronized samples"
            )

            subject_windows = 0

            for start in range(
                0,
                signal_length - window_size + 1,
                window_size
            ):

                end = (
                    start + window_size
                )

                window_labels = (
                    labels[start:end]
                )

                # Only use Baseline and Stress.
                valid_labels = (
                    window_labels[
                        np.isin(
                            window_labels,
                            [1, 2]
                        )
                    ]
                )

                # Require at least 80% valid labels.
                if (
                    len(valid_labels)
                    < len(window_labels) * 0.8
                ):
                    continue

                # Majority label
                majority_label = int(
                    np.bincount(
                        valid_labels.astype(int)
                    ).argmax()
                )

                features = extract_features(
                    chest,
                    start,
                    end
                )

                if not np.all(
                    np.isfinite(features)
                ):
                    continue

                # WESAD:
                #
                # 1 = Baseline
                # 2 = Stress
                #
                # Convert to:
                #
                # 0 = Non-Stress
                # 1 = Stress

                if majority_label == 2:
                    target = 1
                else:
                    target = 0

                X.append(features)

                y.append(target)

                groups.append(
                    subject_id
                )

                subject_windows += 1

            print(
                f"{subject_id}: "
                f"{subject_windows} usable windows"
            )

        except Exception as e:

            print(
                f"WARNING: Could not process "
                f"{subject_id}: {e}"
            )

    X = np.asarray(
        X,
        dtype=np.float32
    )

    y = np.asarray(
        y,
        dtype=np.int32
    )

    groups = np.asarray(
        groups
    )

    if len(X) == 0:

        raise RuntimeError(
            "No usable WESAD windows were created."
        )

    return X, y, groups


# ============================================================
# MAIN
# ============================================================

def main():

    print()

    print(
        "+----------------------------------------------------------+"
    )

    print(
        "|       MAITRI - REAL WESAD MODEL EVALUATION              |"
    )

    print(
        "|       Stress vs Non-Stress Classification               |"
    )

    print(
        "|       Subject-independent evaluation                    |"
    )

    print(
        "+----------------------------------------------------------+"
    )

    print()

    print(
        "WESAD directory:"
    )

    print(
        WESAD_ROOT
    )

    # --------------------------------------------------------
    # Find subjects
    # --------------------------------------------------------

    subject_files = (
        find_subject_files(
            WESAD_ROOT
        )
    )

    print()

    print(
        f"Found {len(subject_files)} "
        f"WESAD subject files:"
    )

    for subject_id, path in subject_files:

        print(
            f"  {subject_id} -> {path}"
        )

    # --------------------------------------------------------
    # Build dataset
    # --------------------------------------------------------

    X, y, groups = (
        build_dataset(
            subject_files
        )
    )

    print()

    print("=" * 65)

    print(
        "DATASET SUMMARY"
    )

    print("=" * 65)

    print(
        f"Total usable windows : {len(X)}"
    )

    print(
        f"Non-Stress samples   : "
        f"{np.sum(y == 0)}"
    )

    print(
        f"Stress samples       : "
        f"{np.sum(y == 1)}"
    )

    print(
        f"Subjects             : "
        f"{len(np.unique(groups))}"
    )

    # --------------------------------------------------------
    # SUBJECT-INDEPENDENT SPLIT
    # --------------------------------------------------------

    splitter = GroupShuffleSplit(
        n_splits=1,
        test_size=0.2,
        random_state=42
    )

    train_idx, test_idx = next(
        splitter.split(
            X,
            y,
            groups=groups
        )
    )

    X_train = X[train_idx]

    X_test = X[test_idx]

    y_train = y[train_idx]

    y_test = y[test_idx]

    train_subjects = np.unique(
        groups[train_idx]
    )

    test_subjects = np.unique(
        groups[test_idx]
    )

    print()

    print("=" * 65)

    print(
        "SUBJECT-INDEPENDENT TRAIN / TEST SPLIT"
    )

    print("=" * 65)

    print(
        f"Training samples : "
        f"{len(X_train)}"
    )

    print(
        f"Test samples     : "
        f"{len(X_test)}"
    )

    print(
        f"Training subjects: "
        f"{list(train_subjects)}"
    )

    print(
        f"Test subjects    : "
        f"{list(test_subjects)}"
    )

    # --------------------------------------------------------
    # TRAIN RANDOM FOREST
    # --------------------------------------------------------

    print()

    print("=" * 65)

    print(
        "TRAINING RANDOM FOREST"
    )

    print("=" * 65)

    clf = RandomForestClassifier(
        n_estimators=100,
        random_state=42,
        class_weight="balanced",
        n_jobs=-1
    )

    clf.fit(
        X_train,
        y_train
    )

    # --------------------------------------------------------
    # TEST
    # --------------------------------------------------------

    y_pred = clf.predict(
        X_test
    )

    accuracy = accuracy_score(
        y_test,
        y_pred
    )

    precision = precision_score(
        y_test,
        y_pred,
        average="weighted",
        zero_division=0
    )

    recall = recall_score(
        y_test,
        y_pred,
        average="weighted",
        zero_division=0
    )

    f1 = f1_score(
        y_test,
        y_pred,
        average="weighted",
        zero_division=0
    )

    cm = confusion_matrix(
        y_test,
        y_pred,
        labels=[0, 1]
    )

    report = classification_report(
        y_test,
        y_pred,
        labels=[0, 1],
        target_names=[
            "Non-Stress",
            "Stress"
        ],
        zero_division=0
    )

    # --------------------------------------------------------
    # PRINT RESULTS
    # --------------------------------------------------------

    print()

    print("=" * 65)

    print(
        "HELD-OUT TEST SET RESULTS"
    )

    print("=" * 65)

    print(
        f"Accuracy           : "
        f"{accuracy:.4f} "
        f"({accuracy * 100:.2f}%)"
    )

    print(
        f"Weighted Precision : "
        f"{precision:.4f}"
    )

    print(
        f"Weighted Recall    : "
        f"{recall:.4f}"
    )

    print(
        f"Weighted F1-score  : "
        f"{f1:.4f}"
    )

    print()

    print(
        "Confusion Matrix"
    )

    print(
        "Rows = True class"
    )

    print(
        "Columns = Predicted class"
    )

    print()

    print(
        "                 Non-Stress  Stress"
    )

    print(
        f"Non-Stress       "
        f"{cm[0][0]:10d}  "
        f"{cm[0][1]:6d}"
    )

    print(
        f"Stress           "
        f"{cm[1][0]:10d}  "
        f"{cm[1][1]:6d}"
    )

    print()

    print(
        "Classification Report"
    )

    print(
        report
    )

    # --------------------------------------------------------
    # FEATURE IMPORTANCE
    # --------------------------------------------------------

    importances = (
        clf.feature_importances_
    )

    feature_importance = {

        "heart_rate": float(
            importances[0]
        ),

        "eda": float(
            importances[1]
        ),

        "temperature": float(
            importances[2]
        ),

        "respiration": float(
            importances[3]
        ),

        "eda_std": float(
            importances[4]
        )
    }

    print()

    print(
        "Feature Importances:"
    )

    for name, value in (
        feature_importance.items()
    ):

        print(
            f"  {name:15s}: "
            f"{value:.4f}"
        )

    # --------------------------------------------------------
    # SAVE JSON RESULTS
    # --------------------------------------------------------

    results = {

        "evaluation_info": {

            "script":
                "evaluate_wesad.py",

            "random_state":
                42,

            "evaluation_type":
                "Subject-independent held-out test set",

            "note":
                "All metrics are computed on held-out "
                "WESAD subjects. Test subject windows "
                "are never used during training."
        },

        "stress_prediction": {

            "model":
                "Random Forest (n_estimators=100)",

            "dataset":
                "WESAD",

            "dataset_type":
                "Real physiological dataset",

            "classification":
                "Binary stress classification",

            "label_mapping": {

                "0":
                    "Non-Stress",

                "1":
                    "Stress"
            },

            "window_seconds":
                WINDOW_SECONDS,

            "sampling_frequency_hz":
                CHEST_FS,

            "total_windows":
                int(len(X)),

            "train_windows":
                int(len(X_train)),

            "test_windows":
                int(len(X_test)),

            "train_subjects":
                [
                    str(x)
                    for x in train_subjects
                ],

            "test_subjects":
                [
                    str(x)
                    for x in test_subjects
                ],

            "class_distribution": {

                "Non-Stress":
                    int(np.sum(y == 0)),

                "Stress":
                    int(np.sum(y == 1))
            },

            "metrics": {

                "accuracy":
                    float(accuracy),

                "weighted_precision":
                    float(precision),

                "weighted_recall":
                    float(recall),

                "weighted_f1_score":
                    float(f1)
            },

            "confusion_matrix": {

                "labels": [
                    "Non-Stress",
                    "Stress"
                ],

                "matrix":
                    cm.tolist()
            },

            "feature_importances":
                feature_importance
        }
    }

    output_path = os.path.join(
        os.path.dirname(__file__),
        OUTPUT_FILE
    )

    with open(
        output_path,
        "w",
        encoding="utf-8"
    ) as f:

        json.dump(
            results,
            f,
            indent=2
        )

    print()

    print("=" * 65)

    print(
        "Results saved to:"
    )

    print(
        output_path
    )

    print("=" * 65)


if __name__ == "__main__":
    main()