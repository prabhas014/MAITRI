import os
import sys
import random
import numpy as np

# Add backend to path so we can import from app
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.ml.models import train_stress_model, train_emotion_model_from_zip

def generate_synthetic_stress_data(num_samples=160):
    X = []
    y = []
    
    # Class 0: Low Stress
    for _ in range(60):
        hr = round(60 + random.random() * 15)
        eda = round(0.2 + random.random() * 0.5, 3)
        temp = round(36.2 + random.random() * 0.5, 1)
        resp = round(11 + random.random() * 4)
        X.append([hr, eda, temp, resp])
        y.append(0)
        
    # Class 1: Medium Stress
    for _ in range(50):
        hr = round(80 + random.random() * 15)
        eda = round(1.1 + random.random() * 0.6, 3)
        temp = round(36.8 + random.random() * 0.4, 1)
        resp = round(16 + random.random() * 4)
        X.append([hr, eda, temp, resp])
        y.append(1)
        
    # Class 2: High Stress
    for _ in range(50):
        hr = round(100 + random.random() * 20)
        eda = round(2.4 + random.random() * 1.2, 3)
        temp = round(37.3 + random.random() * 0.6, 1)
        resp = round(21 + random.random() * 5)
        X.append([hr, eda, temp, resp])
        y.append(2)
        
    return np.array(X), np.array(y)

def main():
    print("--- Training Stress Model ---")
    X, y = generate_synthetic_stress_data()
    print(f"Generated {len(X)} synthetic samples.")
    stress_results = train_stress_model(X, y)
    print(f"Stress Model Results: {stress_results}")
    print("-----------------------------\n")
    
    print("--- Training Emotion Model ---")
    zip_path = r"C:\Users\prabh\Downloads\archive.zip"
    if os.path.exists(zip_path):
        emotion_results = train_emotion_model_from_zip(zip_path)
        print(f"Emotion Model Results: {emotion_results}")
    else:
        print(f"Error: {zip_path} not found!")
    print("-----------------------------")

if __name__ == "__main__":
    main()
