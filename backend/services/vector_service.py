# services/vector_service.py
# FAISS vector store — persistent, MMR-enabled retrieval
#
# Uses langchain-community FAISS wrapper.
# Saves to: vectorstore/index.faiss + vectorstore/index.pkl

import asyncio
import logging
import os
from typing import List, Optional, Dict, Any

from langchain_community.vectorstores import FAISS
from langchain.schema import Document
from services.embedding_service import get_embeddings, batched_embed_documents
from config import settings

logger = logging.getLogger(__name__)

_vector_store: Optional[FAISS] = None
STORE_PATH = settings.vectorstore_path


def _ensure_store_path() -> None:
    os.makedirs(STORE_PATH, exist_ok=True)


def _index_exists() -> bool:
    return os.path.exists(os.path.join(STORE_PATH, "index.faiss"))


# ── Persistence ───────────────────────────────────────────────────────────────

async def save_store() -> None:
    global _vector_store
    if _vector_store is None:
        return
    try:
        _ensure_store_path()
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, _vector_store.save_local, STORE_PATH)
        count = _vector_store.index.ntotal if _vector_store.index else 0
        logger.info(f"💾 Saved {count} vectors → {STORE_PATH}")
    except Exception as e:
        logger.warning(f"⚠️  Could not save vector store: {e}")


async def load_vector_store() -> Optional[FAISS]:
    global _vector_store
    if not _index_exists():
        return None
    try:
        _ensure_store_path()
        embeddings = get_embeddings()
        loop       = asyncio.get_event_loop()
        _vector_store = await loop.run_in_executor(
            None,
            lambda: FAISS.load_local(
                STORE_PATH,
                embeddings,
                allow_dangerous_deserialization=True,
            ),
        )
        count = _vector_store.index.ntotal if _vector_store.index else 0
        logger.info(f"✅ Loaded FAISS store — {count} vectors")
        return _vector_store
    except Exception as e:
        logger.warning(f"⚠️  Could not load FAISS store: {e}")
        _vector_store = None
        return None


# ── Document ingestion ────────────────────────────────────────────────────────

async def add_documents_to_store(docs: List[Document]) -> FAISS:
    """
    Embed documents in safe batches and add them to the FAISS store.

    WHY NOT FAISS.from_documents()?
      It calls embed_documents() on ALL texts in one shot.
      For large PDFs (300-600 chunks) → Mistral 400 error.

    FIX: batched_embed_documents() → FAISS.add_embeddings() pattern.
    """
    global _vector_store
    _ensure_store_path()

    if _vector_store is None:
        await load_vector_store()

    texts     = [doc.page_content for doc in docs]
    metadatas = [doc.metadata      for doc in docs]

    # ── CORE FIX: batched embedding ───────────────────────────────────────────
    vectors = await batched_embed_documents(texts)
    # ─────────────────────────────────────────────────────────────────────────

    embeddings  = get_embeddings()
    text_vector_pairs = list(zip(texts, vectors))

    loop = asyncio.get_event_loop()

    if _vector_store is None:
        logger.info(f"📦 Creating new FAISS store with {len(docs)} chunks")
        _vector_store = await loop.run_in_executor(
            None,
            lambda: FAISS.from_embeddings(
                text_embeddings=text_vector_pairs,
                embedding=embeddings,
                metadatas=metadatas,
            ),
        )
    else:
        logger.info(f"➕ Adding {len(docs)} chunks to existing FAISS store")
        await loop.run_in_executor(
            None,
            lambda: _vector_store.add_embeddings(
                text_embeddings=text_vector_pairs,
                metadatas=metadatas,
            ),
        )

    await save_store()
    return _vector_store


# ── Retrieval ─────────────────────────────────────────────────────────────────

async def similarity_search(query: str, top_k: int = None) -> List[Dict[str, Any]]:
    """
    MMR-based retrieval — balances relevance and diversity.
    Falls back to plain similarity search for very small stores.
    """
    global _vector_store
    top_k = top_k or settings.top_k_results

    if _vector_store is None:
        await load_vector_store()

    if _vector_store is None or _vector_store.index.ntotal == 0:
        raise ValueError("No documents indexed yet. Please upload a PDF first.")

    total      = _vector_store.index.ntotal
    k          = min(top_k, total)
    fetch_k    = min(top_k * 3, total)
    loop       = asyncio.get_event_loop()

    try:
        # MMR: diverse AND relevant
        results = await loop.run_in_executor(
            None,
            lambda: _vector_store.max_marginal_relevance_search(
                query,
                k=k,
                fetch_k=fetch_k,
                lambda_mult=settings.mmr_lambda,
            ),
        )

        # Get scores via standard search for display
        scored = await loop.run_in_executor(
            None,
            lambda: _vector_store.similarity_search_with_score(query, k=min(top_k * 2, total)),
        )
        score_map = {doc.page_content: score for doc, score in scored}

        return [
            {
                "page_content": doc.page_content,
                "metadata":     doc.metadata,
                "score":        score_map.get(doc.page_content, 0.0),
            }
            for doc in results
        ]
    except Exception:
        # Fallback for very small stores
        fallback = await loop.run_in_executor(
            None,
            lambda: _vector_store.similarity_search_with_score(query, k=k),
        )
        return [
            {"page_content": doc.page_content, "metadata": doc.metadata, "score": score}
            for doc, score in fallback
        ]


# ── Stats & maintenance ───────────────────────────────────────────────────────

async def get_store_stats() -> Dict[str, Any]:
    global _vector_store
    if _vector_store is None:
        await load_vector_store()

    if _vector_store is None:
        return {"loaded": False, "docCount": 0, "fileCount": 0, "files": []}

    count = _vector_store.index.ntotal if _vector_store.index else 0
    # Extract unique file names from docstore
    try:
        docs  = list(_vector_store.docstore._dict.values())
        files = list({d.metadata.get("fileName", "") for d in docs if d.metadata.get("fileName")})
    except Exception:
        files = []

    return {"loaded": True, "docCount": count, "fileCount": len(files), "files": files}


async def clear_vector_store() -> None:
    global _vector_store
    _vector_store = None
    for fname in ("index.faiss", "index.pkl"):
        path = os.path.join(STORE_PATH, fname)
        if os.path.exists(path):
            os.remove(path)
    logger.info("🗑️  Vector store cleared")
