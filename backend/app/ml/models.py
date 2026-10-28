import os
import joblib
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage
from app.core.config import settings
import base64

# --- STRESS PREDICTION (Random Forest) ---
MODEL_PATH = os.path.join(os.path.dirname(__file__), "stress_model.pkl")

def train_mock_stress_model():
    """Train a mock Random Forest on synthetic WESAD-like data if model doesn't exist."""
    print("Training mock Random Forest for Stress Prediction...")
    np.random.seed(42)
    # Low stress (0): HR ~65, EDA ~0.5, Temp ~36.5, Resp ~14
    low_stress = np.random.normal(loc=[65, 0.5, 36.5, 14], scale=[5, 0.1, 0.2, 2], size=(100, 4))
    # Medium stress (1): HR ~85, EDA ~1.5, Temp ~37.0, Resp ~18
    med_stress = np.random.normal(loc=[85, 1.5, 37.0, 18], scale=[5, 0.3, 0.2, 2], size=(100, 4))
    # High stress (2): HR ~105, EDA ~3.0, Temp ~37.5, Resp ~24
    high_stress = np.random.normal(loc=[105, 3.0, 37.5, 24], scale=[10, 0.5, 0.3, 3], size=(100, 4))
    
    X = np.vstack([low_stress, med_stress, high_stress])
    y = np.array([0]*100 + [1]*100 + [2]*100)
    
    clf = RandomForestClassifier(n_estimators=50, random_state=42)
    clf.fit(X, y)
    joblib.dump(clf, MODEL_PATH)
    print("Model saved to", MODEL_PATH)
    return clf

def train_stress_model(X: np.ndarray, y: np.ndarray) -> dict:
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, confusion_matrix

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    clf = RandomForestClassifier(n_estimators=50, random_state=42)
    clf.fit(X_train, y_train)

    y_pred = clf.predict(X_test)

    accuracy = float(accuracy_score(y_test, y_pred))
    precision = float(precision_score(y_test, y_pred, average='weighted', zero_division=0))
    recall = float(recall_score(y_test, y_pred, average='weighted', zero_division=0))
    f1 = float(f1_score(y_test, y_pred, average='weighted', zero_division=0))
    cm = confusion_matrix(y_test, y_pred).tolist()

    joblib.dump(clf, MODEL_PATH)

    importances = clf.feature_importances_.tolist()

    print(f"Stress Model Accuracy: {accuracy:.4f}")
    print(f"Stress Model Precision: {precision:.4f}")
    print(f"Stress Model Recall: {recall:.4f}")
    print(f"Stress Model F1-Score: {f1:.4f}")
    print(f"Stress Confusion Matrix: {cm}")

    return {
        "accuracy": accuracy,
        "precision": precision,
        "recall": recall,
        "f1_score": f1,
        "samples": len(X),
        "importances": {
            "heart_rate": importances[0],
            "eda": importances[1],
            "temp": importances[2],
            "respiration": importances[3]
        },
        "confusion_matrix": cm
    }

def predict_stress_level(features: dict) -> str:
    """Predict stress using the trained Random Forest."""
    if not os.path.exists(MODEL_PATH):
        clf = train_mock_stress_model()
    else:
        clf = joblib.load(MODEL_PATH)
        
    x_input = np.array([[
        features.get('heart_rate', 70),
        features.get('eda', 1.0),
        features.get('temp', 36.6),
        features.get('respiration', 16)
    ]])
    
    pred = clf.predict(x_input)[0]
    mapping = {0: "Low Stress", 1: "Medium Stress", 2: "High Stress"}
    return mapping.get(pred, "Unknown")

# --- EMOTION PREDICTION (Gemini Vision + Local SGD Classifier) ---
EMOTION_MODEL_PATH = os.path.join(os.path.dirname(__file__), "emotion_model.pkl")
EMOTIONS = ["Angry", "Disgust", "Fear", "Happy", "Neutral", "Sad", "Surprise"]

def train_emotion_model_from_zip(zip_path: str, max_samples_per_class: int = 500) -> dict:
    """
    Train a simple local classifier on the FER2013 dataset in the zip file.
    Uses SGDClassifier for speed and memory efficiency.
    """
    import zipfile
    import io
    from PIL import Image
    from sklearn.linear_model import SGDClassifier
    from sklearn.model_selection import train_test_split
    import random
    
    if not os.path.exists(zip_path):
        raise FileNotFoundError(f"Dataset archive not found at: {zip_path}")
        
    print(f"Reading FER2013 dataset from {zip_path}...")
    
    X = []
    y = []
    
    label_map = {emotion.lower(): idx for idx, emotion in enumerate(EMOTIONS)}
    candidates = {label: [] for label in label_map.keys()}
    
    with zipfile.ZipFile(zip_path, 'r') as zf:
        for entry in zf.namelist():
            normalized_path = entry.replace("\\", "/")
            parts = normalized_path.split("/")
            
            if len(parts) >= 3 and parts[0] == "train" and parts[1] in label_map:
                label = parts[1]
                if entry.lower().endswith(('.jpg', '.jpeg', '.png')):
                    candidates[label].append(entry)
                    
        total_loaded = 0
        for label, entries in candidates.items():
            selected_entries = entries
            if len(entries) > max_samples_per_class:
                random.seed(42)
                selected_entries = random.sample(entries, max_samples_per_class)
                
            print(f"Processing {len(selected_entries)} samples for class: '{label}'...")
            
            for entry in selected_entries:
                try:
                    img_data = zf.read(entry)
                    img = Image.open(io.BytesIO(img_data)).convert('L')
                    img = img.resize((48, 48))
                    pixels = np.array(img, dtype=np.float32) / 255.0
                    X.append(pixels.flatten())
                    y.append(label_map[label])
                    total_loaded += 1
                except Exception as e:
                    print(f"Failed to read image {entry}: {e}")
                    
    if total_loaded == 0:
        raise ValueError("No images could be parsed from the dataset archive.")
        
    X = np.array(X)
    y = np.array(y)
    
    X_train, X_val, y_train, y_val = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
    
    print(f"Fitting model on {len(X_train)} samples...")
    clf = SGDClassifier(loss='log_loss', max_iter=1000, tol=1e-3, random_state=42)
    clf.fit(X_train, y_train)
    
    val_accuracy = float(clf.score(X_val, y_val))
    train_accuracy = float(clf.score(X_train, y_train))
    
    joblib.dump(clf, EMOTION_MODEL_PATH)
    print(f"Model saved successfully to {EMOTION_MODEL_PATH} with validation accuracy: {val_accuracy:.4f}")
    
    return {
        "accuracy": val_accuracy,
        "train_accuracy": train_accuracy,
        "samples": len(X),
        "classes": EMOTIONS
    }

def predict_emotion_from_image(image_bytes: bytes) -> str:
    """
    If local model exists, use it. Otherwise, fallback to Gemini Vision.
    """
    if os.path.exists(EMOTION_MODEL_PATH):
        try:
            from PIL import Image
            import io
            
            clf = joblib.load(EMOTION_MODEL_PATH)
            
            img = Image.open(io.BytesIO(image_bytes)).convert('L')
            img = img.resize((48, 48))
            pixels = np.array(img, dtype=np.float32) / 255.0
            x_input = pixels.flatten().reshape(1, -1)
            
            pred_idx = clf.predict(x_input)[0]
            if 0 <= pred_idx < len(EMOTIONS):
                return EMOTIONS[pred_idx]
        except Exception as e:
            print(f"Local emotion prediction failed: {e}. Falling back to Gemini Vision.")
            
    try:
        # Check if API key is provided
        if not settings.GEMINI_API_KEY or settings.GEMINI_API_KEY == "YOUR_GEMINI_API_KEY":
            print("Gemini API key not configured. Falling back to Neutral.")
            return "Neutral"

        llm = ChatGoogleGenerativeAI(
            model="gemini-2.5-flash", 
            google_api_key=settings.GEMINI_API_KEY,
            temperature=0.0
        )
        
        image_b64 = base64.b64encode(image_bytes).decode('utf-8')
        
        message = HumanMessage(
            content=[
                {
                    "type": "text",
                    "text": "Analyze the human face in this image. Classify the dominant emotion into exactly ONE of these categories: Happy, Sad, Neutral, Fear, Angry, Surprise. Output only the category word."
                },
                {
                    "type": "image_url",
                    "image_url": f"data:image/jpeg;base64,{image_b64}"
                }
            ]
        )
        
        response = llm.invoke([message])
        emotion = response.content.strip().title()
        
        valid_emotions = ["Happy", "Sad", "Neutral", "Fear", "Angry", "Surprise"]
        for valid in valid_emotions:
            if valid in emotion:
                return valid
                
        return "Neutral"
    except Exception as e:
        print(f"Emotion detection error: {e}")
        return "Neutral"

# --- SLEEP PREDICTION (Mock LSTM on Sleep EDF) ---
def predict_sleep_quality(features: dict) -> str:
    """Predict sleep quality based on sleep duration, HR, REM, Deep Sleep."""
    # Mock heuristic representing a trained model
    duration = features.get('sleep_duration', 7.0)
    rem = features.get('rem_percentage', 20)
    deep = features.get('deep_sleep_percentage', 15)
    
    score = (duration / 8.0) * 0.4 + (rem / 25.0) * 0.3 + (deep / 20.0) * 0.3
    
    if score > 0.85:
        return "Excellent"
    elif score > 0.70:
        return "Good"
    elif score > 0.50:
        return "Fair"
    else:
        return "Poor"

# --- VOICE EMOTION (Mock CNN on RAVDESS) ---
def predict_voice_emotion(audio_bytes: bytes = None) -> str:
    """Predict emotion from audio MFCC features."""
    import random
    # In a real scenario, we'd extract MFCC using librosa and pass to CNN/LSTM
    emotions = ["Happy", "Calm", "Fear", "Angry"]
    # Mocking based on a static seed or random for demonstration
    return random.choice(emotions)

# --- ACTIVITY RECOGNITION (Mock Random Forest on UCI HAR) ---
def predict_activity(features: dict) -> str:
    """Predict activity from accelerometer/gyroscope."""
    # Features could be mean_accel_x, etc.
    # We will use simple thresholds to mock the Random Forest
    accel_mag = features.get('accel_magnitude', 1.0) # baseline 1g
    if accel_mag > 2.5:
        return "Running"
    elif accel_mag > 1.3:
        return "Walking"
    elif accel_mag < 0.2:
        return "Sleeping"
    elif features.get('orientation_vertical', True):
        return "Standing"
    else:
        return "Working"
