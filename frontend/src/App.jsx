// App.jsx — FinRAG root layout (Python/FastAPI + Mistral edition)
import React from 'react';
import Header     from './components/Header';
import FileUpload from './components/FileUpload';
import ChatWindow from './components/ChatWindow';
import Dashboard  from './components/Dashboard';
import { useChat }   from './hooks/useChat';
import { useUpload } from './hooks/useUpload';

export default function App() {
  const { messages, isLoading, sendMessage, fetchInsight, clearChat } = useChat();
  const { uploadedDocs, isUploading, uploadProgress, uploadError, uploadFile, removeDoc } = useUpload();
  const hasDocuments = uploadedDocs.some(d => d.status === 'ready');

  return (
    <div className="min-h-screen flex flex-col grid-bg" style={{ background: 'var(--bg-deep)' }}>
      <Header />

      <main className="flex-1 flex overflow-hidden" style={{ height: 'calc(100vh - 73px)' }}>
        {/* Sidebar */}
        <aside
          className="w-80 flex-shrink-0 flex flex-col gap-5 p-5 overflow-y-auto"
          style={{ borderRight: '1px solid var(--border)', background: 'var(--bg-surface)' }}
        >
          <section>
            <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: 'var(--text-muted)' }}>
              Documents
            </p>
            <FileUpload
              uploadedDocs={uploadedDocs} isUploading={isUploading}
              uploadProgress={uploadProgress} uploadError={uploadError}
              onUpload={uploadFile} onRemove={removeDoc}
            />
          </section>

          <div style={{ height: 1, background: 'var(--border)' }} />

          <section>
            <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: 'var(--text-muted)' }}>
              Overview
            </p>
            <Dashboard uploadedDocs={uploadedDocs} messages={messages} />
          </section>

          <div style={{ height: 1, background: 'var(--border)' }} />

          <section>
            <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: 'var(--text-muted)' }}>
              How it works
            </p>
            <ol className="space-y-3">
              {[
                ['📄', 'Upload',    'PDF parsed page-by-page with PyMuPDF'],
                ['✂️',  'Chunk',    'Sentence-boundary splitting, 800 chars, page metadata'],
                ['🔢', 'Embed',    'Mistral-embed (1024-dim) in safe batches of 32'],
                ['🔍', 'Retrieve', 'FAISS + MMR search — relevance & diversity'],
                ['✨', 'Answer',   'Mistral Large generates page-cited answers'],
              ].map(([emoji, title, desc]) => (
                <li key={title} className="flex gap-3">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-sm"
                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
                  >
                    {emoji}
                  </div>
                  <div>
                    <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</p>
                    <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--text-muted)' }}>{desc}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <div className="mt-auto pt-4" style={{ borderTop: '1px solid var(--border)' }}>
            <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
              Python · FastAPI · PyMuPDF · FAISS · Mistral AI
            </p>
          </div>
        </aside>

        {/* Chat panel */}
        <div className="flex-1 p-5 overflow-hidden">
          <ChatWindow
            messages={messages} isLoading={isLoading}
            onSend={sendMessage} onInsight={fetchInsight}
            onClear={clearChat} hasDocuments={hasDocuments}
          />
        </div>
      </main>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0);    opacity: 0.4; }
          40%            { transform: translateY(-5px); opacity: 1;   }
        }
      `}</style>
    </div>
  );
}
