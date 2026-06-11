# services/pdf_service.py
# Page-aware PDF extraction using PyMuPDF (fitz)
#
# Why PyMuPDF over pdfplumber or pdf-parse?
#  ✓ Fastest Python PDF library (C++ core)
#  ✓ Per-page text extraction preserving layout
#  ✓ Works on large files without loading all pages into RAM at once
#  ✓ Handles ligatures, special chars, and financial symbols correctly

import fitz          # pymupdf
import os
import re
from collections import Counter
from datetime import datetime, timezone
from typing import List, Dict, Any


# ── Character normalisation ──────────────────────────────────────────────────
CHAR_MAP = {
    '\ufb01': 'fi',  '\ufb02': 'fl',  '\ufb03': 'ffi', '\ufb04': 'ffl',
    '\ufb00': 'ff',  '\ufb05': 'st',  '\ufb06': 'st',
    '\u2013': '-',   '\u2014': '--',  '\u2018': "'",   '\u2019': "'",
    '\u201c': '"',   '\u201d': '"',   '\u2022': '•',   '\u2026': '...',
    '\u00a0': ' ',
}

def _fix_encoding(text: str) -> str:
    for src, dst in CHAR_MAP.items():
        text = text.replace(src, dst)
    return text


# ── Header / footer detection ────────────────────────────────────────────────
def _strip_repeated_lines(page_texts: List[Dict]) -> List[Dict]:
    """Remove lines that appear identically on ≥60 % of pages (headers/footers)."""
    if len(page_texts) < 5:
        return page_texts

    freq: Counter = Counter()
    for p in page_texts:
        lines = p["text"].split("\n")
        for line in ([lines[0]] if lines else []) + ([lines[-1]] if len(lines) > 1 else []):
            stripped = line.strip()
            if 3 < len(stripped) < 120:
                freq[stripped] += 1

    threshold = len(page_texts) * 0.6
    repeated  = {line for line, cnt in freq.items() if cnt >= threshold}

    return [
        {
            "page_number": p["page_number"],
            "text": "\n".join(
                line for line in p["text"].split("\n")
                if line.strip() not in repeated
            ),
        }
        for p in page_texts
    ]


# ── Text cleaning ────────────────────────────────────────────────────────────
def _clean_text(text: str) -> str:
    text = text.replace("\x00", "")
    text = re.sub(r"[ \t]{2,}", " ", text)
    text = re.sub(r"(\r\n|\r|\n){3,}", "\n\n", text)
    return text.strip()


# ── Main functions ────────────────────────────────────────────────────────────

async def extract_text_from_pdf(file_path: str) -> Dict[str, Any]:
    """
    Extract text page-by-page from a PDF using PyMuPDF.

    Returns:
        {
          page_texts: [{ page_number: int, text: str }, ...],
          full_text:  str,
          metadata:   { pages, char_count, file_name, extracted_at }
        }
    """
    doc = fitz.open(file_path)
    raw_pages = []

    try:
        for page_idx in range(len(doc)):
            page = doc[page_idx]
            # "text" mode preserves word order and line breaks
            text = page.get_text("text")
            text = _fix_encoding(text)
            text = _clean_text(text)
            raw_pages.append({"page_number": page_idx + 1, "text": text})
    finally:
        doc.close()

    cleaned_pages = _strip_repeated_lines(raw_pages)
    full_text  = "\n\n".join(p["text"] for p in cleaned_pages)
    char_count = len(full_text.replace(" ", "").replace("\n", ""))

    if char_count < 80:
        raise ValueError(
            f"PDF appears to be scanned/image-based "
            f"(only {char_count} readable chars from {len(cleaned_pages)} pages). "
            "Please use a text-based PDF or run OCR first."
        )

    return {
        "page_texts": cleaned_pages,
        "full_text":  full_text,
        "metadata": {
            "pages":        len(cleaned_pages),
            "char_count":   char_count,
            "file_name":    os.path.basename(file_path),
            "extracted_at": datetime.now(timezone.utc).isoformat(),
        },
    }


def validate_pdf(file_path: str) -> None:
    """Raise ValueError if the file is not a readable PDF."""
    if not os.path.exists(file_path):
        raise ValueError("File does not exist")

    if os.path.getsize(file_path) == 0:
        raise ValueError("File is empty")

    with open(file_path, "rb") as f:
        header = f.read(5)

    if header != b"%PDF-":
        raise ValueError("File is not a valid PDF")
