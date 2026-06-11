# config.py — centralised settings via pydantic-settings
# All values read from .env file; fallbacks provided for every optional field.

from pydantic_settings import BaseSettings
from pydantic import field_validator
from functools import lru_cache
import os


class Settings(BaseSettings):
    # ── Mistral AI ─────────────────────────────────────────────────────────────
    mistral_api_key:     str   = ""
    mistral_model:       str   = "mistral-large-latest"
    mistral_embed_model: str   = "mistral-embed"

    # ── Embedding batching ─────────────────────────────────────────────────────
    # Mistral embed API rejects requests with too many tokens.
    # 32 chunks × ~200 tokens/chunk = ~6400 tokens — comfortably under the limit.
    embed_batch_size:  int   = 32
    embed_batch_delay: float = 0.3   # seconds between batches

    # ── RAG parameters ─────────────────────────────────────────────────────────
    top_k_results:    int   = 6
    mmr_lambda:       float = 0.6    # 1.0=relevance only, 0.0=diversity only
    score_threshold:  float = 0.25
    chunk_size:       int   = 800
    chunk_overlap:    int   = 150
    max_context_chars: int  = 6000

    # ── Server ─────────────────────────────────────────────────────────────────
    port:         int = 5000
    host:         str = "0.0.0.0"
    frontend_url: str = "http://localhost:3000"
    debug:        bool = False

    # ── File handling ──────────────────────────────────────────────────────────
    max_file_size_mb: int = 100
    upload_dir:       str = "./data/uploads"
    vectorstore_path: str = "./vectorstore"

    @field_validator("mistral_api_key")
    @classmethod
    def api_key_must_be_set(cls, v: str) -> str:
        placeholder = "your_mistral_api_key_here"
        if not v or v == placeholder:
            raise ValueError(
                "\n\nMISTRAL_API_KEY is not set.\n"
                "  1. Copy backend/.env.example → backend/.env\n"
                "  2. Get a free key at https://console.mistral.ai\n"
                "  3. Set MISTRAL_API_KEY=your_key_here\n"
            )
        return v

    @property
    def max_file_size_bytes(self) -> int:
        return self.max_file_size_mb * 1024 * 1024

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
