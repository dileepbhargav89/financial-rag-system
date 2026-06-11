# services/embedding_service.py
# Mistral AI embeddings — mistral-embed (1024-dim) — safe batching
#
# Mistral's embed API has a per-request token limit.
# A 100-page PDF produces ~500 chunks. Sending all at once → 400 error.
# FIX: embed in groups of EMBED_BATCH_SIZE (32), sleep between batches,
#      retry on 429 / 5xx with exponential back-off.

import asyncio
import logging
from functools import lru_cache
from typing import List

from langchain_mistralai import MistralAIEmbeddings
from config import settings

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def get_embeddings() -> MistralAIEmbeddings:
    """Singleton MistralAIEmbeddings instance."""
    emb = MistralAIEmbeddings(
        api_key=settings.mistral_api_key,
        model=settings.mistral_embed_model,
    )
    logger.info(f"✅ Embeddings: Mistral {settings.mistral_embed_model} (1024-dim)")
    return emb


async def embed_query(query: str) -> List[float]:
    """Embed a single query string → 1024-dim vector."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(
        None, get_embeddings().embed_query, query
    )


async def batched_embed_documents(texts: List[str]) -> List[List[float]]:
    """
    Embed texts in safe batches — KEY FIX for large-PDF uploads.

    Flow per batch:
      1. Slice up to EMBED_BATCH_SIZE texts
      2. Call Mistral embed API (run_in_executor → non-blocking)
      3. On 429 / 5xx: exponential back-off, up to 3 retries
      4. Sleep EMBED_BATCH_DELAY seconds before next batch

    Args:
        texts: raw chunk strings to embed
    Returns:
        List of 1024-dim float vectors, same length as texts
    """
    batch_size  = settings.embed_batch_size    # 32
    batch_delay = settings.embed_batch_delay   # 0.3 s
    embeddings  = get_embeddings()
    loop        = asyncio.get_event_loop()

    total_batches = (len(texts) + batch_size - 1) // batch_size
    logger.info(f"🔢 Embedding {len(texts)} chunks → {total_batches} batch(es) of {batch_size}")

    all_vectors: List[List[float]] = []

    for batch_num, start in enumerate(range(0, len(texts), batch_size), 1):
        batch = texts[start : start + batch_size]

        # Safety: truncate individual texts that are excessively long
        safe_batch = [t[:8000] if len(t) > 8000 else t for t in batch]

        vectors = None
        for attempt in range(1, 4):   # max 3 attempts
            try:
                vectors = await loop.run_in_executor(
                    None, embeddings.embed_documents, safe_batch
                )
                break
            except Exception as err:
                msg  = str(err)
                code = getattr(err, "status_code", None) or getattr(err, "statusCode", None)
                is_retryable = code in (429, 500, 502, 503) or "429" in msg or "rate" in msg.lower()

                if is_retryable and attempt < 3:
                    wait = attempt * 2.0
                    logger.warning(
                        f"  ⚠️  Batch {batch_num}/{total_batches} attempt {attempt} "
                        f"failed ({code or msg[:60]}). Retry in {wait}s…"
                    )
                    await asyncio.sleep(wait)
                else:
                    raise RuntimeError(
                        f"Embedding batch {batch_num}/{total_batches} failed "
                        f"after {attempt} attempt(s): {msg}"
                    ) from err

        all_vectors.extend(vectors)
        logger.info(f"  ✅ Batch {batch_num}/{total_batches} — {len(batch)} chunks embedded")

        if start + batch_size < len(texts):
            await asyncio.sleep(batch_delay)

    logger.info(f"✅ All {len(all_vectors)} vectors generated")
    return all_vectors
