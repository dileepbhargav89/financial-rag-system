# services/chunk_service.py
# Semantic text chunking with LangChain's RecursiveCharacterTextSplitter
# Each chunk carries accurate page number, file name, and section metadata.

from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.schema import Document
from config import settings
from typing import List, Dict, Any


SEPARATORS = ["\n\n", "\n", ". ", "! ", "? ", "; ", ": ", ", ", " ", ""]


def _detect_section_title(text: str) -> str:
    """Heuristic: first line that looks like a heading."""
    first = text.split("\n")[0].strip() if text else ""
    if (
        0 < len(first) < 80
        and not first.endswith((".", "!", "?", ";"))
        and (first == first.upper() or first[0].isupper())
    ):
        return first
    return ""


def _deduplicate(chunks: List[Document]) -> List[Document]:
    seen, result = set(), []
    for doc in chunks:
        key = " ".join(doc.page_content.split())[:200]
        if key not in seen:
            seen.add(key)
            result.append(doc)
    return result


async def split_into_chunks(
    page_texts: List[Dict[str, Any]],
    file_metadata: Dict[str, Any],
    chunk_size: int   = None,
    chunk_overlap: int = None,
) -> List[Document]:
    """
    Split page-aware text into LangChain Documents.

    Each Document carries metadata:
        page, fileName, filePath, totalPages, uploadedAt,
        chunkIndex, chunkSize, section, totalChunks
    """
    chunk_size    = chunk_size    or settings.chunk_size
    chunk_overlap = chunk_overlap or settings.chunk_overlap

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        separators=SEPARATORS,
    )

    all_docs: List[Document] = []
    idx = 0

    for page in page_texts:
        text       = page.get("text", "")
        page_number = page.get("page_number", 1)
        if not text or len(text.strip()) < 20:
            continue

        sub_docs = splitter.create_documents(
            [text],
            metadatas=[{"page_number": page_number}],
        )

        for doc in sub_docs:
            content = doc.page_content.strip()
            if len(content) < 30:
                continue

            all_docs.append(Document(
                page_content=content,
                metadata={
                    "page":       doc.metadata.get("page_number", page_number),
                    "fileName":   file_metadata.get("fileName", "unknown"),
                    "filePath":   file_metadata.get("filePath", ""),
                    "totalPages": file_metadata.get("pages", 0),
                    "uploadedAt": file_metadata.get("uploadedAt", ""),
                    "chunkIndex": idx,
                    "chunkSize":  len(content),
                    "section":    _detect_section_title(content),
                },
            ))
            idx += 1

    deduped = _deduplicate(all_docs)
    total   = len(deduped)

    # Stamp totalChunks on every document
    for doc in deduped:
        doc.metadata["totalChunks"] = total

    return deduped
