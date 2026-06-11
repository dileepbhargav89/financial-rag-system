# services/rag_service.py
# RAG pipeline — Mistral Large LLM · direct SDK · structured JSON response
#
# Flow:
#   1. MMR retrieval (similarity_search)
#   2. Build context string (respects MAX_CONTEXT_CHARS budget)
#   3. Mistral chat.complete() with system + history + context
#   4. Return { answer, sources: [{page, content, ...}] }

import asyncio
import logging
from datetime import datetime, timezone
from functools import lru_cache
from typing import List, Dict, Any

from mistralai import Mistral
from services.vector_service import similarity_search
from config import settings

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def get_mistral_client() -> Mistral:
    client = Mistral(api_key=settings.mistral_api_key)
    logger.info(f"✅ LLM: Mistral ({settings.mistral_model})")
    return client


# ── System prompt ─────────────────────────────────────────────────────────────
SYSTEM_PROMPT = """You are FinRAG, an expert AI financial analyst assistant.
Answer questions about financial documents with precision and clarity.

Rules:
1. Base ALL answers strictly on the provided context. Never hallucinate numbers or facts.
2. If context lacks sufficient information, say: "The uploaded documents do not contain
   sufficient information to answer this question."
3. Always cite page numbers when referencing figures (e.g. "As stated on page 12…").
4. Format financial numbers clearly: ₹1.2Cr, $1.2M, 15.3%, Q3 FY24.
5. Use markdown tables or bullet lists for comparisons.
6. Keep answers concise but complete."""


# ── Context builder ───────────────────────────────────────────────────────────
def _build_context(chunks: List[Dict[str, Any]]) -> str:
    budget = settings.max_context_chars
    total, parts = 0, []

    for i, chunk in enumerate(chunks):
        page  = chunk["metadata"].get("page", "?")
        fname = chunk["metadata"].get("fileName", "Document")
        block = f"[Source {i+1} | {fname} | Page {page}]\n{chunk['page_content']}\n"

        if total + len(block) > budget and parts:
            break
        parts.append(block)
        total += len(block)

    return "\n---\n\n".join(parts)


# ── Retry on rate limit ───────────────────────────────────────────────────────
async def _call_with_retry(fn, max_retries: int = 3):
    for attempt in range(max_retries + 1):
        try:
            loop = asyncio.get_event_loop()
            return await loop.run_in_executor(None, fn)
        except Exception as err:
            msg  = str(err)
            code = getattr(err, "status_code", None)
            is429 = code == 429 or "429" in msg or "rate" in msg.lower()
            if is429 and attempt < max_retries:
                wait = (2 ** attempt) + 0.5
                logger.warning(f"⚠️  Rate limit — retry {attempt+1} in {wait:.1f}s")
                await asyncio.sleep(wait)
            else:
                raise


# ── Core RAG ──────────────────────────────────────────────────────────────────
async def query_rag(query: str, chat_history: List[Dict] = None) -> Dict[str, Any]:
    """
    Full RAG pipeline:
      embed query → MMR retrieve → build context → Mistral LLM → structured response.

    Returns:
        { answer: str, sources: [{page, content, fileName, chunkIndex, ...}] }
    """
    chat_history = chat_history or []
    chunks = await similarity_search(query, settings.top_k_results)

    if not chunks:
        return {
            "answer":  "No relevant information found in the uploaded documents for your query.",
            "sources": [],
        }

    context = _build_context(chunks)

    # Last 6 messages = 3 conversation turns
    history_msgs = [
        {"role": "user" if m["role"] == "user" else "assistant", "content": str(m["content"])}
        for m in (chat_history[-6:] if chat_history else [])
    ]

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        *history_msgs,
        {"role": "user",   "content": f"Context from financial documents:\n\n{context}\n\nQuestion: {query}"},
    ]

    client = get_mistral_client()

    def _call():
        response = client.chat.complete(
            model=settings.mistral_model,
            messages=messages,
            temperature=0.1,
            max_tokens=2048,
        )
        return response.choices[0].message.content.strip()

    answer = await _call_with_retry(_call)

    sources = [
        {
            "id":             i + 1,
            "page":           int(chunk["metadata"].get("page", i + 1)),
            "content":        chunk["page_content"][:250] + ("…" if len(chunk["page_content"]) > 250 else ""),
            "fileName":       chunk["metadata"].get("fileName", "Unknown"),
            "chunkIndex":     int(chunk["metadata"].get("chunkIndex", i)),
            "totalChunks":    chunk["metadata"].get("totalChunks"),
            "section":        chunk["metadata"].get("section", ""),
            "relevanceScore": round(float(chunk.get("score", 0)), 4) if chunk.get("score") else None,
        }
        for i, chunk in enumerate(chunks)
    ]

    return {"answer": answer, "sources": sources}


# ── Pre-built insights ────────────────────────────────────────────────────────
async def generate_financial_summary() -> Dict[str, Any]:
    return await query_rag(
        "Provide a comprehensive executive summary: key revenue, profit, EBITDA, "
        "YoY growth, major business segments, geographic breakdown, and highlights.",
        [],
    )


async def extract_key_risks() -> Dict[str, Any]:
    return await query_rag(
        "List all financial, operational, regulatory, and market risks. For each: "
        "describe it clearly, quote any figures, and note any mitigation strategies.",
        [],
    )
