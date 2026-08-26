from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://leadforge:password123@localhost:5435/leadforge"
    ANTHROPIC_API_KEY: str = ""
    PORT: int = 8000
    HOST: str = "0.0.0.0"
    LEADFORGE_MODEL: str = "claude-3-5-sonnet-20241022"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
