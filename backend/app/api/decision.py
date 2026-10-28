from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()

class MultimodalState(BaseModel):
    stress_level: str
    emotion: str
    sleep_quality: str
    activity: str

@router.post("/evaluate")
async def evaluate_decision(state: MultimodalState):
    """
    AI Decision Engine: Aggregates all sensor/ML outputs to determine fatigue risk.
    """
    risk_score = 0
    
    # Stress heuristic
    if state.stress_level == "High Stress":
        risk_score += 3
    elif state.stress_level == "Medium Stress":
        risk_score += 1
        
    # Emotion heuristic
    if state.emotion in ["Sad", "Fear", "Angry"]:
        risk_score += 2
        
    # Sleep heuristic
    if state.sleep_quality == "Poor":
        risk_score += 3
    elif state.sleep_quality == "Fair":
        risk_score += 1
        
    # Activity heuristic
    if state.activity in ["Working", "Running"] and risk_score >= 3:
        # High exertion while already compromised
        risk_score += 2
        
    # Determine risk level
    if risk_score >= 6:
        fatigue_risk = "HIGH"
    elif risk_score >= 3:
        fatigue_risk = "MEDIUM"
    else:
        fatigue_risk = "LOW"
        
    return {
        "fatigue_risk": fatigue_risk,
        "risk_score": risk_score,
        "recommendation": f"Astronaut fatigue risk = {fatigue_risk}. Adjust schedule accordingly."
    }
