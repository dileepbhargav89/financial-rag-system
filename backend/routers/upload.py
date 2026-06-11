# routers/upload.py — POST /upload
# Accepts a PDF, runs the full ingestion pipeline, returns stats.

import os
import uuid
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse

from services.pdf_service   import extract_text_from_pdf, validate_pdf
from services.chunk_service  import split_into_chunks
from services.vector_service import add_documents_to_store
from models.schemas import UploadResponse, UploadDetails, ErrorResponse
from config import settings

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("", response_model=UploadResponse)
async def upload_document(file: UploadFile = File(...)):
    """
    POST /upload

    Pipeline:
      PDF → validate → page-aware extract (PyMuPDF)
          → semantic chunk → batch Mistral embed → FAISS store
    """
    # ── Validate file type ────────────────────────────────────────────────────
    if file.content_type not in ("application/pdf", "application/octet-stream") and \
       not (file.filename or "").lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted.")

    file_name  = file.filename or "document.pdf"
    file_bytes = await file.read()
    file_size  = len(file_bytes)

    if file_size > settings.max_file_size_bytes:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Maximum allowed size is {settings.max_file_size_mb} MB."
        )
    if file_size == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    # ── Save to temp path ─────────────────────────────────────────────────────
    os.makedirs(settings.upload_dir, exist_ok=True)
    tmp_name  = f"{uuid.uuid4()}.pdf"
    tmp_path  = os.path.join(settings.upload_dir, tmp_name)

    with open(tmp_path, "wb") as f:
        f.write(file_bytes)

    try:
        logger.info(f"\n📄 Processing: {file_name} ({file_size/1024/1024:.1f} MB)")

        # Step 1 — Validate PDF header
        validate_pdf(tmp_path)

        # Step 2 — Page-aware text extraction (PyMuPDF)
        logger.info("  [1/4] Extracting text with PyMuPDF…")
        result    = await extract_text_from_pdf(tmp_path)
        page_texts = result["page_texts"]
        full_text  = result["full_text"]
        metadata   = result["metadata"]

        char_count = metadata["char_count"]
        logger.info(f"  ✅ {len(full_text):,} chars across {metadata['pages']} pages")

        # Step 3 — Semantic chunking
        logger.info("  [2/4] Chunking…")
        chunks = await split_into_chunks(
            page_texts,
            {
                "fileName":  file_name,
                "filePath":  tmp_path,
                "pages":     metadata["pages"],
                "uploadedAt": datetime.now(timezone.utc).isoformat(),
            },
        )
        logger.info(f"  ✅ {len(chunks)} chunks created")

        if not chunks:
            raise ValueError("No text chunks could be extracted. The PDF may be empty or image-based.")

        # Step 4 — Batch embed + FAISS store
        logger.info(f"  [3/4] Embedding {len(chunks)} chunks (may take ~30-60s for large files)…")
        await add_documents_to_store(chunks)
        logger.info(f"  [4/4] ✅ Indexed {len(chunks)} chunks in FAISS")
        logger.info(f"✅ '{file_name}' ready\n")

        return UploadResponse(
            success=True,
            message=f'Successfully processed "{file_name}"',
            details=UploadDetails(
                fileName=file_name,
                pages=metadata["pages"],
                chunksCreated=len(chunks),
                textLength=len(full_text),
                charCount=char_count,
                fileSizeMB=round(file_size / 1024 / 1024, 2),
            ),
        )

    except (ValueError, RuntimeError) as exc:
        logger.error(f"❌ Upload error for '{file_name}': {exc}")
        raise HTTPException(status_code=500, detail=str(exc))

    except Exception as exc:
        logger.exception(f"❌ Unexpected upload error for '{file_name}'")
        raise HTTPException(status_code=500, detail=f"Failed to process document: {exc}")

    finally:
        if os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except OSError:
                pass
