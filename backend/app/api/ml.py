import io
import os
import pandas as pd
from fastapi import APIRouter, File, UploadFile, Depends, HTTPException
from pydantic import BaseModel
from app.api.auth import get_current_user
from app.ml.models import predict_stress_level, predict_emotion_from_image, train_stress_model, train_emotion_model_from_zip

router = APIRouter()

class StressInput(BaseModel):
    heart_rate: float
    eda: float
    temp: float
    respiration: float

@router.post("/predict-stress")
async def predict_stress(
    data: StressInput,
    current_user: dict = Depends(get_current_user)
):
    prediction = predict_stress_level(data.model_dump())
    return {"stress_level": prediction}

@router.post("/predict-emotion")
async def predict_emotion(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    contents = await file.read()
    prediction = predict_emotion_from_image(contents)
    return {"emotion": prediction}

@router.post("/train-stress")
async def train_stress(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV datasets are supported for training.")
        
    contents = await file.read()
    if len(contents) == 0:
        raise HTTPException(status_code=400, detail="Cannot train on an empty file.")
        
    try:
        df = pd.read_csv(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse CSV: {str(e)}")
        
    df.columns = [col.lower().strip() for col in df.columns]
    
    column_mapping = {}
    
    # Map heart_rate
    if 'heart_rate' in df.columns:
        column_mapping['heart_rate'] = 'heart_rate'
    elif 'hr' in df.columns:
        column_mapping['hr'] = 'heart_rate'
    else:
        raise HTTPException(status_code=400, detail="Missing required column 'heart_rate' or 'hr' in CSV.")
        
    # Map eda
    if 'eda' in df.columns:
        column_mapping['eda'] = 'eda'
    elif 'electrothermal_activity' in df.columns:
        column_mapping['electrothermal_activity'] = 'eda'
    else:
        raise HTTPException(status_code=400, detail="Missing required column 'eda' in CSV.")
        
    # Map temp
    if 'temp' in df.columns:
        column_mapping['temp'] = 'temp'
    elif 'temperature' in df.columns:
        column_mapping['temperature'] = 'temp'
    elif 'temp_c' in df.columns:
        column_mapping['temp_c'] = 'temp'
    else:
        raise HTTPException(status_code=400, detail="Missing required column 'temp' or 'temperature' in CSV.")
        
    # Map respiration
    if 'respiration' in df.columns:
        column_mapping['respiration'] = 'respiration'
    elif 'resp' in df.columns:
        column_mapping['resp'] = 'respiration'
    else:
        raise HTTPException(status_code=400, detail="Missing required column 'respiration' or 'resp' in CSV.")
        
    label_col = None
    for possible_label in ['stress_level', 'stress', 'label', 'target']:
        if possible_label in df.columns:
            label_col = possible_label
            break
            
    if not label_col:
        raise HTTPException(status_code=400, detail="Missing label column (like 'stress_level', 'stress', or 'label') in CSV.")
        
    df = df.rename(columns=column_mapping)
    
    features_list = ['heart_rate', 'eda', 'temp', 'respiration']
    df = df.dropna(subset=features_list + [label_col])
    
    if len(df) < 5:
        raise HTTPException(status_code=400, detail="Insufficient training data. Please upload a dataset with at least 5 rows.")
        
    try:
        X = df[features_list].to_numpy()
        y = df[label_col].to_numpy().astype(int)
    except ValueError:
        raise HTTPException(status_code=400, detail="Features and labels must contain numeric values.")
        
    unique_labels = set(y)
    invalid_labels = unique_labels - {0, 1, 2}
    if invalid_labels:
        raise HTTPException(status_code=400, detail=f"Invalid labels found: {invalid_labels}. Stress labels must be 0 (Low), 1 (Medium), or 2 (High).")
        
    try:
        train_results = train_stress_model(X, y)
        return {
            "status": "success",
            "message": f"Random Forest stress model trained successfully on {len(df)} samples.",
            **train_results
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fit model: {str(e)}")

@router.post("/train-emotion")
async def train_emotion(
    current_user: dict = Depends(get_current_user)
):
    zip_path = r"C:\Users\prabh\Downloads\archive.zip"
    if not os.path.exists(zip_path):
        raise HTTPException(
            status_code=404, 
            detail="Kaggle download 'archive.zip' not found in your Downloads folder."
        )
        
    try:
        train_results = train_emotion_model_from_zip(zip_path)
        return {
            "status": "success",
            "message": "Facial Emotion Recognition model trained successfully using local FER2013 archive.",
            **train_results
        }
    except FileNotFoundError as fnfe:
        raise HTTPException(status_code=404, detail=str(fnfe))
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fit emotion classifier: {str(e)}")
