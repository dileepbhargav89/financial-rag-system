from pydantic import BaseModel, Field
from typing import List, Optional, Any

class ChatMessage(BaseModel):
    role:    str
    content: str

class QueryRequest(BaseModel):
    query:       str               = Field(..., min_length=2, max_length=2000)
    chatHistory: List[ChatMessage] = Field(default_factory=list)

class InsightRequest(BaseModel):
    type: str

class Source(BaseModel):
    id:             int
    page:           int
    content:        str
    fileName:       str
    chunkIndex:     int
    totalChunks:    Optional[int]   = None
    section:        Optional[str]   = ""
    relevanceScore: Optional[float] = None

class QueryResponse(BaseModel):
    success:   bool
    answer:    str
    sources:   List[Source]
    query:     str
    timestamp: str

class UploadDetails(BaseModel):
    fileName:      str
    pages:         int
    chunksCreated: int
    textLength:    int
    charCount:     int
    fileSizeMB:    float

class UploadResponse(BaseModel):
    success: bool
    message: str
    details: UploadDetails

class VectorStoreStats(BaseModel):
    loaded:    bool
    docCount:  int
    fileCount: int
    files:     List[str] = Field(default_factory=list)

class HealthResponse(BaseModel):
    status:      str
    timestamp:   str
    vectorStore: VectorStoreStats
    environment: str
    backend:     str = "Python / FastAPI"

class ErrorResponse(BaseModel):
    error:  str
    detail: Optional[Any] = None
