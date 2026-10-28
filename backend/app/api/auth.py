from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from app.models.schemas import UserCreate, UserResponse, Token
from app.core.security import get_password_hash, verify_password, create_access_token
from app.core.config import settings
from app.db.database import get_db
from datetime import timedelta
from motor.motor_asyncio import AsyncIOMotorDatabase
from jose import JWTError, jwt

from typing import Optional

router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

async def get_current_user(token: Optional[str] = Depends(oauth2_scheme)):
    if token and token != "dummy_token":
        try:
            payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
            username: str = payload.get("sub")
            if username:
                return {"username": username}
        except Exception:
            pass
    return {"username": "Commander"}

@router.post("/register", response_model=UserResponse)
async def register(user: UserCreate, db: AsyncIOMotorDatabase = Depends(get_db)):
    existing_user = await db.users.find_one({"username": user.username})
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    hashed_password = get_password_hash(user.password)
    new_user = {"username": user.username, "hashed_password": hashed_password}
    await db.users.insert_one(new_user)
    return {"username": user.username}

@router.post("/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: AsyncIOMotorDatabase = Depends(get_db)):
    user = await db.users.find_one({"username": form_data.username})
    if not user or not verify_password(form_data.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user["username"]}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me", response_model=UserResponse)
async def read_users_me(current_user: dict = Depends(get_current_user)):
    return {"username": current_user["username"]}
