// src/components/FileUpload.jsx
// Drag-and-drop PDF upload with progress bar and document list

import React, { useRef, useState, useCallback } from 'react';
import {
  Upload, FileText, CheckCircle, AlertCircle,
  X, Loader2, FilePlus, ChevronDown, ChevronUp,
} from 'lucide-react';

const STATUS = {
  uploading: { color: '#22d3ee',  bg: 'rgba(34,211,238,0.1)',  Icon: Loader2,      label: 'Processing…', spin: true  },
  ready:     { color: '#10b981',  bg: 'rgba(16,185,129,0.1)',  Icon: CheckCircle,  label: 'Ready',       spin: false },
  error:     { color: '#ef4444',  bg: 'rgba(239,68,68,0.1)',   Icon: AlertCircle,  label: 'Error',       spin: false },
};

function formatSize(bytes) {
  if (bytes < 1024)             return `${bytes} B`;
  if (bytes < 1024 * 1024)      return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FileUpload({
  uploadedDocs, isUploading, uploadProgress, uploadError,
  onUpload, onRemove,
}) {
  const inputRef    = useRef(null);
  const [isDrag, setIsDrag] = useState(false);
  const [open, setOpen]     = useState(true);

  const handleFiles = useCallback(
    (files) => { if (files && files[0]) onUpload(files[0]); },
    [onUpload]
  );

  function onDrop(e) {
    e.preventDefault();
    setIsDrag(false);
    handleFiles(e.dataTransfer.files);
  }

  return (
    <div className="flex flex-col gap-4">

      {/* Drop zone */}
      <div
        className="drop-zone rounded-xl p-6 text-center cursor-pointer"
        style={{
          background: isDrag ? 'rgba(34,211,238,0.06)' : 'rgba(8,13,26,0.6)',
          borderColor: isDrag ? 'var(--accent)' : undefined,
        }}
        onDragOver={(e) => { e.preventDefault(); setIsDrag(true); }}
        onDragLeave={() => setIsDrag(false)}
        onDrop={onDrop}
        onClick={() => { if (!isUploading) inputRef.current?.click(); }}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
          disabled={isUploading}
        />

        {isUploading ? (
          <div className="flex flex-col items-center gap-3">
            {/* Spinner ring */}
            <div className="relative w-12 h-12">
              <div className="absolute inset-0 rounded-full border-2"
                style={{ borderColor: 'rgba(34,211,238,0.15)' }} />
              <div className="absolute inset-0 rounded-full border-2 border-transparent animate-spin"
                style={{ borderTopColor: 'var(--accent)', animationDuration: '0.9s' }} />
            </div>
            {/* Progress bar */}
            <div className="w-full max-w-xs">
              <div className="flex justify-between text-xs mb-1.5"
                style={{ color: 'var(--text-secondary)' }}>
                <span>Embedding document…</span>
                <span style={{ color: 'var(--accent)', fontFamily: 'monospace' }}>
                  {uploadProgress}%
                </span>
              </div>
              <div className="h-1.5 rounded-full" style={{ background: 'rgba(34,211,238,0.1)' }}>
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%`, background: 'var(--accent)' }}
                />
              </div>
            </div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Chunking &amp; generating embeddings…
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{
                background: 'rgba(34,211,238,0.08)',
                border: '1px solid rgba(34,211,238,0.15)',
              }}
            >
              {isDrag
                ? <FilePlus style={{ width: 24, height: 24, color: 'var(--accent)' }} />
                : <Upload   style={{ width: 24, height: 24, color: 'var(--text-muted)' }} />
              }
            </div>
            <div>
              <p className="text-sm font-medium mb-0.5"
                style={{ color: 'var(--text-primary)' }}>
                {isDrag ? 'Drop your PDF here' : 'Upload Financial Document'}
              </p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Drag &amp; drop or click · PDF only · Max 50 MB
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Error banner */}
      {uploadError && (
        <div
          className="flex items-start gap-2.5 rounded-lg px-3 py-2.5 text-sm"
          style={{
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.2)',
            color: '#f87171',
          }}
        >
          <AlertCircle style={{ width: 16, height: 16, flexShrink: 0, marginTop: 2 }} />
          <span>{uploadError}</span>
        </div>
      )}

      {/* Document list */}
      {uploadedDocs.length > 0 && (
        <div
          className="rounded-xl overflow-hidden"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
        >
          <button
            onClick={() => setOpen(!open)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-white/5 transition-colors"
            style={{ color: 'var(--text-secondary)' }}
          >
            <span className="flex items-center gap-2">
              <FileText style={{ width: 16, height: 16 }} />
              Documents ({uploadedDocs.length})
            </span>
            {open
              ? <ChevronUp   style={{ width: 16, height: 16 }} />
              : <ChevronDown style={{ width: 16, height: 16 }} />
            }
          </button>

          {open && (
            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {uploadedDocs.map((doc) => {
                const cfg  = STATUS[doc.status] || STATUS.error;
                const Icon = cfg.Icon;
                return (
                  <div key={doc.id} className="flex items-center gap-3 px-4 py-3">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: cfg.bg }}
                    >
                      <Icon
                        style={{ width: 16, height: 16, color: cfg.color }}
                        className={cfg.spin ? 'animate-spin' : ''}
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p
                        className="text-sm font-medium truncate"
                        style={{ color: 'var(--text-primary)' }}
                        title={doc.name}
                      >
                        {doc.name}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {formatSize(doc.size)}
                        {doc.pages  && ` · ${doc.pages} pages`}
                        {doc.chunks && ` · ${doc.chunks} chunks`}
                      </p>
                    </div>

                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0"
                      style={{ color: cfg.color, background: cfg.bg }}
                    >
                      {cfg.label}
                    </span>

                    {doc.status !== 'uploading' && (
                      <button
                        onClick={() => onRemove(doc.id)}
                        className="p-1 rounded-md hover:bg-white/10 transition-colors ml-1"
                        style={{ color: 'var(--text-muted)' }}
                        title="Remove from list"
                      >
                        <X style={{ width: 14, height: 14 }} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
