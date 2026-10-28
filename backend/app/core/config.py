from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "MAITRI"
    MONGO_URI: str = "mongodb://localhost:27017"
    MONGO_DB_NAME: str = "maitri_db"
    JWT_SECRET_KEY: str = "super_secret_jwt_key_maitri" # Replace in prod
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7
    GEMINI_API_KEY: str = ""

    class Config:
        env_file = ".env"

settings = Settings()
