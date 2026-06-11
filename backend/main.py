# main.py — FinRAG FastAPI application entry point
# Run: uvicorn main:app --reload --port 5000

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import settings
from routers import upload, query
from services.vector_service import load_vector_store

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("finrag")


# ── Startup / shutdown lifecycle ──────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("\n🚀  FinRAG backend starting…")
    logger.info(f"    LLM        : {settings.mistral_model}")
    logger.info(f"    Embeddings : {settings.mistral_embed_model}  (batch {settings.embed_batch_size})")
    logger.info(f"    Retrieval  : MMR λ={settings.mmr_lambda}, top-{settings.top_k_results}")
    logger.info(f"    Chunk      : {settings.chunk_size} chars / {settings.chunk_overlap} overlap")
    logger.info(f"    Max upload : {settings.max_file_size_mb} MB\n")

    try:
        await load_vector_store()
    except Exception as e:
        logger.warning(f"⚠️  Could not pre-load vector store: {e}")

    yield

    # Shutdown
    logger.info("🛑  FinRAG backend shutting down")


# ── App factory ───────────────────────────────────────────────────────────────
app = FastAPI(
    title="FinRAG API",
    description="AI Financial Intelligence — Mistral AI + FAISS + Python",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url, "http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


# ── Request logging ───────────────────────────────────────────────────────────
@app.middleware("http")
async def log_requests(request: Request, call_next):
    logger.info(f"  → {request.method} {request.url.path}")
    response = await call_next(request)
    return response


# ── Global error handler ──────────────────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception(f"🔥 Unhandled error on {request.url.path}: {exc}")
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error", "detail": str(exc)},
    )


# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(upload.router, prefix="/upload", tags=["Upload"])
app.include_router(query.router,  tags=["Query"])


# ── Dev entrypoint ────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=True,
        timeout_keep_alive=600,   # keep connections alive for large uploads
    )
