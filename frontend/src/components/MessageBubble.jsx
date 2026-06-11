// src/components/MessageBubble.jsx
// Renders a single chat message — user, assistant (with sources), or system/error

import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Bot, User, AlertTriangle, ChevronDown, ChevronUp, ExternalLink, Hash } from 'lucide-react';

export default function MessageBubble({ message }) {
  const [showSources, setShowSources] = useState(false);
  const isUser    = message.role === 'user';
  const isSystem  = message.role === 'system';
  const isError   = message.metadata?.isError;

  const formatTime = (iso) =>
    new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // ── System / error pill ───────────────────────────────────────────────────
  if (isSystem) {
    return (
      <div className="message-enter flex justify-center px-4 py-1">
        <div
          className="flex items-center gap-2 text-sm px-4 py-2 rounded-full"
          style={{
            background: isError ? 'rgba(239,68,68,0.08)' : 'rgba(34,211,238,0.06)',
            border: `1px solid ${isError ? 'rgba(239,68,68,0.2)' : 'rgba(34,211,238,0.15)'}`,
            color:  isError ? '#f87171' : 'var(--text-secondary)',
          }}
        >
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{message.content}</span>
        </div>
      </div>
    );
  }

  // ── User bubble ───────────────────────────────────────────────────────────
  if (isUser) {
    return (
      <div className="message-enter flex justify-end items-end gap-2.5 px-4 py-1">
        <div className="flex flex-col items-end gap-1 max-w-[75%]">
          <div
            className="px-4 py-3 rounded-2xl rounded-br-sm text-sm leading-relaxed"
            style={{
              background: 'linear-gradient(135deg, rgba(34,211,238,0.15), rgba(34,211,238,0.08))',
              border: '1px solid rgba(34,211,238,0.2)',
              color: 'var(--text-primary)',
            }}
          >
            {message.content}
          </div>
          <span className="text-xs px-1" style={{ color: 'var(--text-muted)' }}>
            {formatTime(message.timestamp)}
          </span>
        </div>
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mb-5"
          style={{ background: 'rgba(34,211,238,0.12)', border: '1px solid rgba(34,211,238,0.2)' }}
        >
          <User className="w-4 h-4 text-cyan-400" />
        </div>
      </div>
    );
  }

  // ── Assistant bubble ──────────────────────────────────────────────────────
  return (
    <div className="message-enter flex items-start gap-2.5 px-4 py-1">
      {/* Avatar */}
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1"
        style={{
          background: 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(34,211,238,0.15))',
          border: '1px solid rgba(16,185,129,0.3)',
        }}
      >
        <Bot className="w-4 h-4 text-emerald-400" />
      </div>

      <div className="flex flex-col gap-2 max-w-[82%]">
        {/* Message bubble */}
        <div
          className="px-4 py-3.5 rounded-2xl rounded-tl-sm"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
        >
          <div className="prose-financial text-sm">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          </div>
        </div>

        {/* Sources toggle */}
        {message.sources && message.sources.length > 0 && (
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            <button
              onClick={() => setShowSources(!showSources)}
              className="w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-medium transition-colors hover:bg-white/5"
              style={{ background: 'rgba(34,211,238,0.04)', color: 'var(--text-secondary)' }}
            >
              <span className="flex items-center gap-1.5">
                <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
                {message.sources.length} Source{message.sources.length > 1 ? 's' : ''} Referenced
              </span>
              {showSources ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {showSources && (
              <div
                className="divide-y"
                style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}
              >
                {message.sources.map((src) => (
                  <div key={src.id} className="source-card px-3.5 py-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div
                        className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
                        style={{ background: 'rgba(34,211,238,0.1)' }}
                      >
                        <Hash className="w-3 h-3 text-cyan-400" />
                      </div>
                      <span
                        className="text-xs font-semibold truncate"
                        style={{ color: 'var(--text-primary)' }}
                        title={src.fileName}
                      >
                        {src.fileName}
                      </span>
                      <span className="text-xs ml-auto flex-shrink-0 font-mono" style={{ color: 'var(--text-muted)' }}>
                        chunk {src.chunkIndex}
                        {src.relevanceScore !== 'N/A' && (
                          <span className="ml-2 text-cyan-500"> score: {src.relevanceScore}</span>
                        )}
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                      {src.excerpt}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <span className="text-xs px-1" style={{ color: 'var(--text-muted)' }}>
          {formatTime(message.timestamp)}
        </span>
      </div>
    </div>
  );
}
