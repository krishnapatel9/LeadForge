from pathlib import Path

# pyrefly: ignore [missing-import]
from pydantic_settings import BaseSettings, SettingsConfigDict

_API_DIR = Path(__file__).resolve().parent
# apps/api/.env is the documented location. It is found wherever the API is
# started from; a .env in the current directory still overrides it.
_ENV_FILES = (_API_DIR / ".env", Path(".env"))

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://leadforge:password123@localhost:5435/leadforge"
    GEMINI_API_KEY: str = ""
    APOLLO_API_KEY: str = ""
    CLAY_API_KEY: str = ""
    SMTP_SERVER: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    # From address for outreach; defaults to SMTP_USERNAME
    SMTP_FROM: str = ""
    PORT: int = 8000
    HOST: str = "0.0.0.0"
    LEADFORGE_MODEL: str = "gemini-2.5-flash"
    # Comma-separated list of dashboard origins allowed to call the API
    CORS_ORIGINS: str = "http://localhost:3001,http://localhost:3000"

    # --- Auth ---
    ENVIRONMENT: str = "development"
    # Signs login tokens and unsubscribe links. Required outside development.
    JWT_SECRET: str = ""
    JWT_EXPIRE_MINUTES: int = 480
    # Shared key for automation (n8n) calling the pipeline endpoints, sent as X-API-Key.
    # Leave empty to disable service access.
    SERVICE_API_KEY: str = ""
    # Public base URL of this API, used to build unsubscribe links in emails
    PUBLIC_API_URL: str = "http://localhost:8000"
    # CAN-SPAM requires a valid physical postal address in every outreach email
    AGENCY_POSTAL_ADDRESS: str = "LeadForge Agency, 548 Market St, San Francisco, CA 94104"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    model_config = SettingsConfigDict(
        env_file=_ENV_FILES,
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()

if not settings.JWT_SECRET:
    if settings.ENVIRONMENT != "development":
        raise RuntimeError(
            "JWT_SECRET must be set when ENVIRONMENT is not 'development'. "
            "Generate one with: python -c \"import secrets; print(secrets.token_urlsafe(48))\""
        )
    # Development only: a random per-process secret. Logins and unsubscribe
    # links stop working after a restart, which is fine locally.
    import secrets as _secrets
    import logging as _logging

    settings.JWT_SECRET = _secrets.token_urlsafe(48)
    _logging.getLogger("leadforge.config").warning(
        "JWT_SECRET is not set; using a temporary development secret."
    )
