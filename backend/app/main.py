from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import auth, chat, health, ml, decision, datasets

app = FastAPI(title="MAITRI - Astronaut Assistant API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(chat.router, prefix="/api/chat", tags=["chat"])
app.include_router(health.router, prefix="/api/health", tags=["health"])
app.include_router(ml.router, prefix="/api/ml", tags=["ml"])
app.include_router(decision.router, prefix="/api/decision", tags=["decision"])
app.include_router(datasets.router, prefix="/api/datasets", tags=["datasets"])

@app.get("/")
def read_root():
    return {"message": "Welcome to MAITRI Backend API"}
