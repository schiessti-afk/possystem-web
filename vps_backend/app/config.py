"""Environment configuration for the remote backend.

pydantic-settings v2 style: values load from the process environment
first, then from a local .env file (systemd supplies EnvironmentFile).
"""
from pydantic_settings import BaseSettings, SettingsConfigDict

# Known insecure defaults — if a live server still runs with one of
# these, main.py logs a loud warning at startup.
_DEV_TOKENS = {
    "your_secure_bearer_token",       # possystem default (POS_API_TOKEN)
    "your_secure_bearer_token_here",
    "owner_secure_access_key",
    "generate_a_long_random_hex_string",
    "generate_another_long_random_hex_string",
}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    DATABASE_URL: str = (
        "postgresql://postgres:postgres@localhost:5432/pos_remote"
    )

    # Must match POS_API_TOKEN on the register; sync worker sends
    # "Authorization: Bearer <token>".
    API_BEARER_TOKEN: str = "your_secure_bearer_token"

    # Sent by the owner's browser as X-API-Key on /api/v1/dashboard/*.
    DASHBOARD_API_KEY: str = "owner_secure_access_key"

    # Comma-separated CORS origins for the dashboard UI.
    DASHBOARD_ALLOWED_ORIGINS: str = "*"

    # Hard cap on events per batch. The POS worker sends BATCH_SIZE=50.
    MAX_BATCH_EVENTS: int = 200

    PORT: int = 8000

    @property
    def allowed_origins(self) -> list[str]:
        raw = self.DASHBOARD_ALLOWED_ORIGINS.strip()
        if raw == "*":
            return ["*"]
        return [o.strip() for o in raw.split(",") if o.strip()]

    def using_dev_credentials(self) -> bool:
        return (
            self.API_BEARER_TOKEN in _DEV_TOKENS
            or self.DASHBOARD_API_KEY in _DEV_TOKENS
        )


settings = Settings()
