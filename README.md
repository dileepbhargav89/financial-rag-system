# FinRAG — AI Financial Intelligence (Python Edition)

> Production-ready RAG system — **Python FastAPI** backend + **React** frontend

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | Python 3.11+ · FastAPI · Uvicorn |
| **PDF Parsing** | PyMuPDF (fitz) — page-aware, fast |
| **Chunking** | LangChain RecursiveCharacterTextSplitter |
| **Embeddings** | Mistral AI `mistral-embed` (1024-dim) |
| **Vector Store** | FAISS (`faiss-cpu`) — persistent |
| **Retrieval** | MMR (Maximal Marginal Relevance) |
| **LLM** | Mistral Large (`mistral-large-latest`) |
| **Frontend** | React 18 · Tailwind CSS · Axios |

---

## Quick Start

### 1. Get a Mistral API key
Sign up at [console.mistral.ai](https://console.mistral.ai) — free tier available.

### 2. Backend
```bash
cd backend
python -m venv venv

# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
# Edit .env → set MISTRAL_API_KEY=your_key_here

python main.py
# Server starts at http://localhost:5000
```

### 3. Frontend
```bash
cd frontend
npm install
npm start
# Opens http://localhost:3000
```

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/upload` | Upload PDF (form-data, field: `file`) |
| `POST` | `/ask` | RAG query → `{ answer, sources }` |
| `POST` | `/insights` | Pre-built insights (`type`: `summary`\|`risks`) |
| `GET` | `/health` | Server + FAISS stats |
| `GET` | `/docs` | FastAPI auto-generated Swagger UI |

### /ask request & response
```json
// Request
{ "query": "What was the total revenue in FY2024?", "chatHistory": [] }

// Response
{
  "success": true,
  "answer": "Total revenue for FY2024 was ₹8.98 lakh crore (Page 23)...",
  "sources": [
    { "page": 23, "content": "Revenue stood at ₹8,98,302 crore...", "fileName": "annual_report.pdf" }
  ],
  "query": "What was the total revenue in FY2024?",
  "timestamp": "2026-01-01T10:00:00Z"
}
```

---

## RAG Pipeline

```
PDF Upload (up to 100 MB)
  ↓
PyMuPDF page-by-page extraction
  ↓  (ligature fix + header/footer strip)
RecursiveCharacterTextSplitter
  ↓  (800 chars / 150 overlap · sentence-boundary)
  Per-chunk metadata: { page, fileName, chunkIndex, section }
  ↓
Mistral-embed — batched (32 chunks/call, 300ms delay, auto-retry)
  ↓
FAISS store (saved to vectorstore/index.faiss + index.pkl)
  ↓
Query → MMR retrieval (top-6, λ=0.6) — diverse + relevant
  ↓
Context builder (6000 char budget, page-cited blocks)
  ↓
Mistral Large — system prompt + history + context
  ↓
{ answer: string, sources: [{page, content}] }
```

---

## Environment Variables

```env
MISTRAL_API_KEY=...          # Required
MISTRAL_MODEL=mistral-large-latest
MISTRAL_EMBED_MODEL=mistral-embed
EMBED_BATCH_SIZE=32          # chunks per API call (don't raise above 50)
EMBED_BATCH_DELAY=0.3        # seconds between batches
TOP_K_RESULTS=6
MMR_LAMBDA=0.6
CHUNK_SIZE=800
CHUNK_OVERLAP=150
MAX_FILE_SIZE_MB=100
```

---

## Project Structure

```
finrag-python/
├── backend/
│   ├── main.py                  # FastAPI app + lifespan hooks
│   ├── config.py                # pydantic-settings configuration
│   ├── requirements.txt
│   ├── .env.example
│   ├── models/
│   │   └── schemas.py           # Pydantic request/response models
│   ├── routers/
│   │   ├── upload.py            # POST /upload
│   │   └── query.py             # POST /ask, /insights · GET /health
│   └── services/
│       ├── pdf_service.py       # PyMuPDF extraction
│       ├── chunk_service.py     # LangChain text splitting
│       ├── embedding_service.py # Mistral embed with batching
│       ├── vector_service.py    # FAISS store + MMR search
│       └── rag_service.py       # RAG pipeline + Mistral LLM
└── frontend/
    └── src/
        ├── App.jsx
        ├── components/          # Header, ChatWindow, FileUpload…
        ├── hooks/               # useChat, useUpload
        └── utils/api.js         # Axios client
```
