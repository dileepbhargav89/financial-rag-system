# routers/query.py — POST /ask · POST /insights · GET /health

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException

from services.rag_service    import query_rag, generate_financial_summary, extract_key_risks
from services.vector_service import get_store_stats
from models.schemas import (
    QueryRequest, QueryResponse, InsightRequest,
    HealthResponse, VectorStoreStats, Source,
)
from config import settings

router = APIRouter()
logger = logging.getLogger(__name__)

INSIGHT_HANDLERS = {
    "summary": generate_financial_summary,
    "risks":   extract_key_risks,
}


# ── POST /ask ─────────────────────────────────────────────────────────────────
@router.post("/ask", response_model=QueryResponse)
async def ask_question(body: QueryRequest):
    """RAG query: embed → MMR retrieve → Mistral LLM → { answer, sources }"""
    query = body.query.strip()
    logger.info(f'🔍 Query: "{query[:80]}…"')

    try:
        history = [{"role": m.role, "content": m.content} for m in body.chatHistory]
        result  = await query_rag(query, history)

        sources = [
            Source(
                id=s["id"],
                page=s["page"],
                content=s["content"],
                fileName=s["fileName"],
                chunkIndex=s["chunkIndex"],
                totalChunks=s.get("totalChunks"),
                section=s.get("section", ""),
                relevanceScore=s.get("relevanceScore"),
            )
            for s in result["sources"]
        ]

        return QueryResponse(
            success=True,
            answer=result["answer"],
            sources=sources,
            query=query,
            timestamp=datetime.now(timezone.utc).isoformat(),
        )

    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logger.exception("❌ Query error")
        raise HTTPException(status_code=500, detail=str(exc))


# ── POST /insights ────────────────────────────────────────────────────────────
@router.post("/insights", response_model=QueryResponse)
async def get_insights(body: InsightRequest):
    handler = INSIGHT_HANDLERS.get(body.type)
    if not handler:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid insight type. Choose from: {', '.join(INSIGHT_HANDLERS)}"
        )
    try:
        result  = await handler()
        sources = [
            Source(
                id=s["id"], page=s["page"], content=s["content"],
                fileName=s["fileName"], chunkIndex=s["chunkIndex"],
                totalChunks=s.get("totalChunks"), section=s.get("section", ""),
                relevanceScore=s.get("relevanceScore"),
            )
            for s in result["sources"]
        ]
        return QueryResponse(
            success=True,
            answer=result["answer"],
            sources=sources,
            query=body.type,
            timestamp=datetime.now(timezone.utc).isoformat(),
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ── GET /health ───────────────────────────────────────────────────────────────
@router.get("/health", response_model=HealthResponse)
async def health_check():
    try:
        stats = await get_store_stats()
        return HealthResponse(
            status="ok",
            timestamp=datetime.now(timezone.utc).isoformat(),
            vectorStore=VectorStoreStats(**stats),
            environment=settings.debug and "development" or "production",
            backend="Python / FastAPI",
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
