from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

# pyrefly: ignore [missing-import]
from pydantic_settings import BaseSettings, SettingsConfigDict

_API_DIR = Path(__file__).resolve().parent
# apps/api/.env is the documented location. It is found wherever the API is
# started from; a .env in the current directory still overrides it.
_ENV_FILES = (_API_DIR / ".env", Path(".env"))

# libpq options that asyncpg doesn't accept as connect() arguments
_DROP_QUERY_KEYS = {"channel_binding", "options", "application_name", "target_session_attrs"}


def normalize_database_url(url: str) -> str:
    """Accepts the connection string exactly as Neon or Render give it.

    Providers hand out "postgres://" (Render, rejected by SQLAlchemy 2),
    "postgresql://", or "postgresql+psycopg://" (Neon's snippet), usually with
    "?sslmode=require&channel_binding=require". The API uses asyncpg, which
    needs the "+asyncpg" scheme, takes "ssl" instead of "sslmode" and
    crashes on unknown libpq options such as channel_binding.
    """
    url = url.strip()
    scheme, sep, rest = url.partition("://")
    if not sep or not (scheme in ("postgres", "postgresql") or scheme.startswith("postgresql+")):
        return url

    parts = urlsplit("postgresql+asyncpg://" + rest)
    query = []
    for key, value in parse_qsl(parts.query, keep_blank_values=True):
        if key == "sslmode":
            # asyncpg understands disable/allow/prefer/require/verify-ca/verify-full
            query.append(("ssl", value))
        elif key not in _DROP_QUERY_KEYS:
            query.append((key, value))
    return urlunsplit(parts._replace(query=urlencode(query)))


class Settings(BaseSettings):
    # Local default; set DATABASE_URL (any spelling, e.g. Neon's string) everywhere else
    DATABASE_URL: str = "postgresql+asyncpg://leadforge:password@localhost:5432/leadforge"
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
    # Optional first admin, created on start-up if no user has this email yet.
    # Lets a hosted deploy get its first login without running create_user.
    BOOTSTRAP_ADMIN_EMAIL: str = ""
    BOOTSTRAP_ADMIN_PASSWORD: str = ""

    @property
    def cors_origin_list(self) -> list[str]:
        # A trailing slash never matches a browser Origin header, so drop it
        return [o.strip().rstrip("/") for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @property
    def async_database_url(self) -> str:
        return normalize_database_url(self.DATABASE_URL)

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
