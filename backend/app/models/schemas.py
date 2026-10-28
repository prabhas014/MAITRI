from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class UserCreate(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    username: str

class Token(BaseModel):
    access_token: str
    token_type: str

class HealthInput(BaseModel):
    heart_rate: int
    spo2: float
    temperature: float
    sleep_hours: float
    blood_pressure: str
    weight: float
    exercise_duration: int
    emotion: Optional[str] = "Neutral"
    eda: Optional[float] = 1.0
    respiration: Optional[float] = 16.0
    sleep_duration: Optional[float] = None
    activity: Optional[str] = None
    sleep_quality: Optional[str] = None
    water_intake: Optional[float] = None

class HealthRecord(HealthInput):
    username: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    health_score: int
    stress_prediction: str
    recommendation: str
    sleep_quality: Optional[str] = "Good"
    activity: Optional[str] = "Resting"
    water_intake: Optional[float] = None

class ConversationTurn(BaseModel):
    role: str   # 'user' or 'assistant'
    content: str

class ChatMessage(BaseModel):
    role: str
    content: str
    # Conversation history sent by the frontend for multi-turn context
    history: Optional[List[ConversationTurn]] = None
    # NOTE: the fields below are kept for schema compatibility but
    # are intentionally IGNORED — health state always comes from the DB.
    emotion: Optional[str] = None
    stress: Optional[str] = None
    sleep: Optional[str] = None
    hr: Optional[str] = None
    activity: Optional[str] = None

