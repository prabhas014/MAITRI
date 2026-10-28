from fastapi import APIRouter, Depends, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.db.database import get_db
from app.models.schemas import HealthInput, HealthRecord
from app.api.auth import get_current_user
from datetime import datetime
from app.ml.models import predict_stress_level

router = APIRouter()

def calculate_health_score(metrics: HealthInput) -> int:
    score = 100
    if metrics.heart_rate > 100 or metrics.heart_rate < 50:
        score -= 15
    if metrics.spo2 < 95:
        score -= 20
    if metrics.sleep_hours < 6:
        score -= 10
    if metrics.exercise_duration < 30:
        score -= 5
    return max(0, score)

def derive_sleep_quality(sleep_hours: float) -> str:
    if sleep_hours >= 7.0:
        return "Good"
    elif sleep_hours >= 5.0:
        return "Fair"
    else:
        return "Poor"

def derive_activity(exercise_duration: int, heart_rate: int) -> str:
    if exercise_duration >= 30 or heart_rate >= 100:
        return "Working"
    elif exercise_duration > 0:
        return "Active"
    else:
        return "Resting"

def simple_stress_prediction(metrics: HealthInput) -> str:
    # Use the RandomForest classifier!
    eda = metrics.eda
    resp = metrics.respiration

    # If EDA and respiration are at default baseline (1.0 and 16.0) or unset,
    # calibrate them realistically according to heart rate and temperature
    # so the Random Forest model can accurately reflect Low, Medium, and High stress regimes:
    if (eda == 1.0 or eda is None) and (resp == 16.0 or resp is None):
        if metrics.heart_rate <= 75 and metrics.temperature <= 36.8:
            eda = 0.4
            resp = 13.0
        elif metrics.heart_rate >= 100 or metrics.temperature >= 37.3:
            eda = 2.8
            resp = 22.0
        else:
            eda = 1.3
            resp = 17.0

    features = {
        "heart_rate": metrics.heart_rate,
        "eda": eda if eda is not None else 1.0,
        "temp": metrics.temperature,
        "respiration": resp if resp is not None else 16.0
    }
    try:
        return predict_stress_level(features)
    except Exception as e:
        print(f"ML stress prediction failed: {e}. Falling back to heuristic.")
        if metrics.heart_rate > 95 and metrics.sleep_hours < 5:
            return "High Stress"
        elif metrics.heart_rate > 85 or metrics.sleep_hours < 7:
            return "Medium Stress"
        return "Low Stress"

def get_recommendation(stress: str, score: int) -> str:
    if stress == "High Stress":
        return "Take immediate action: perform a 10-minute deep breathing exercise and hydrate."
    if score < 70:
        return "Your health score is low. Ensure you get at least 7 hours of sleep and monitor vitals."
    return "All vitals are nominal. Keep up the good work and maintain your exercise routine."

@router.post("/score", response_model=HealthRecord)
async def submit_health_metrics(
    metrics: HealthInput, 
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    health_score = calculate_health_score(metrics)
    stress_prediction = simple_stress_prediction(metrics)
    recommendation = get_recommendation(stress_prediction, health_score)
    
    sleep_quality = metrics.sleep_quality or derive_sleep_quality(metrics.sleep_hours)
    if metrics.activity and metrics.activity.strip() and metrics.activity != "Auto":
        activity = metrics.activity
    else:
        activity = derive_activity(metrics.exercise_duration, metrics.heart_rate)
    
    dumped = metrics.model_dump()
    dumped["sleep_quality"] = sleep_quality
    dumped["activity"] = activity
    dumped["water_intake"] = metrics.water_intake
    
    record = HealthRecord(
        **dumped,
        username=current_user.get("username", "Commander"),
        timestamp=datetime.utcnow(),
        health_score=health_score,
        stress_prediction=stress_prediction,
        recommendation=recommendation
    )
    
    try:
        await db.health_records.insert_one(record.model_dump())
    except Exception as e:
        print(f"MongoDB not available: {e}")
    return record

@router.get("/history")
async def get_health_history(
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    try:
        username = current_user.get("username", "Commander")
        cursor = db.health_records.find({"username": username}).sort("timestamp", -1).limit(30)
        records = await cursor.to_list(length=30)
        for r in records:
            r["_id"] = str(r["_id"])
            if isinstance(r.get("timestamp"), datetime):
                r["timestamp"] = r["timestamp"].isoformat()
            if "emotion" not in r or not r["emotion"]:
                r["emotion"] = "Neutral"
            if "sleep_quality" not in r or not r["sleep_quality"]:
                r["sleep_quality"] = derive_sleep_quality(r.get("sleep_hours", 7.5))
            if "activity" not in r or not r["activity"]:
                r["activity"] = derive_activity(r.get("exercise_duration", 0), r.get("heart_rate", 70))
        return records
    except Exception as e:
        print(f"MongoDB not available: {e}")
        return []
