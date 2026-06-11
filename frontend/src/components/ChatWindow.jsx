// src/components/ChatWindow.jsx
// Main chat interface — message list, input bar, quick-action buttons

import React, { useRef, useEffect, useState } from 'react';
import {
  Send, Trash2, Loader2, TrendingUp, AlertTriangle, MessageSquare,
} from 'lucide-react';
import MessageBubble from './MessageBubble';

const SUGGESTED_QUESTIONS = [
  'What is the total revenue for this period?',
  'How did net income change year over year?',
  'What are the main sources of operating expenses?',
  'What is the debt-to-equity ratio?',
];

export default function ChatWindow({
  messages, isLoading, onSend, onInsight, onClear, hasDocuments,
}) {
  const [input, setInput]       = useState('');
  const [focused, setFocused]   = useState(false);
  const bottomRef               = useRef(null);
  const textareaRef             = useRef(null);

  // Auto-scroll to bottom whenever messages or loading state changes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Auto-resize textarea up to 160px
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 160) + 'px';
  }, [input]);

  function handleSend() {
    const q = input.trim();
    if (!q || isLoading) return;
    onSend(q);
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const canSend = input.trim().length > 0 && hasDocuments && !isLoading;

  return (
    <div
      className="flex flex-col h-full rounded-2xl overflow-hidden"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-5 py-4 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-card)' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.2)' }}
          >
            <MessageSquare style={{ width: 18, height: 18, color: 'var(--accent)' }} />
          </div>
          <div>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Financial Analyst
            </h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: hasDocuments ? '#10b981' : '#f59e0b' }}
              />
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {hasDocuments ? 'Documents loaded · RAG active' : 'Upload a document to begin'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasDocuments && (
            <>
              <button
                onClick={() => onInsight('summary')}
                disabled={isLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background: 'rgba(16,185,129,0.1)',
                  border: '1px solid rgba(16,185,129,0.2)',
                  color: '#34d399',
                }}
              >
                <TrendingUp style={{ width: 14, height: 14 }} />
                <span className="hidden sm:inline">Summary</span>
              </button>
              <button
                onClick={() => onInsight('risks')}
                disabled={isLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background: 'rgba(245,158,11,0.1)',
                  border: '1px solid rgba(245,158,11,0.2)',
                  color: '#fbbf24',
                }}
              >
                <AlertTriangle style={{ width: 14, height: 14 }} />
                <span className="hidden sm:inline">Risks</span>
              </button>
            </>
          )}

          {messages.length > 0 && (
            <button
              onClick={onClear}
              className="p-2 rounded-lg transition-all hover:bg-white/10"
              style={{ color: 'var(--text-muted)' }}
              title="Clear conversation"
            >
              <Trash2 style={{ width: 16, height: 16 }} />
            </button>
          )}
        </div>
      </div>

      {/* ── Messages ───────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto py-4 space-y-1">
        {messages.length === 0 ? (
          /* Empty / welcome state */
          <div className="flex flex-col items-center justify-center h-full px-6 text-center gap-6">
            <div>
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{
                  background: 'linear-gradient(135deg, rgba(34,211,238,0.1), rgba(16,185,129,0.08))',
                  border: '1px solid rgba(34,211,238,0.15)',
                }}
              >
                <MessageSquare style={{ width: 32, height: 32, color: 'var(--accent)' }} />
              </div>
              <h3
                className="text-lg font-semibold mb-2"
                style={{ fontFamily: 'DM Serif Display', color: 'var(--text-primary)' }}
              >
                Ask About Your Documents
              </h3>
              <p className="text-sm max-w-sm mx-auto" style={{ color: 'var(--text-muted)' }}>
                {hasDocuments
                  ? 'Your documents are loaded. Ask any financial question below.'
                  : 'Upload a financial PDF on the left, then ask questions here.'}
              </p>
            </div>

            {hasDocuments && (
              <div className="w-full max-w-md space-y-2">
                <p className="text-xs font-semibold tracking-widest uppercase mb-3"
                  style={{ color: 'var(--text-muted)' }}>
                  Suggested Questions
                </p>
                {SUGGESTED_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => onSend(q)}
                    className="w-full text-left px-4 py-3 rounded-xl text-sm transition-all"
                    style={{
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-secondary)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(34,211,238,0.3)';
                      e.currentTarget.style.color = 'var(--text-primary)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border)';
                      e.currentTarget.style.color = 'var(--text-secondary)';
                    }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}

            {/* Typing indicator */}
            {isLoading && (
              <div className="flex items-center gap-2.5 px-4 py-1 message-enter">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}
                >
                  <Loader2 style={{ width: 16, height: 16, color: '#34d399' }}
                    className="animate-spin" />
                </div>
                <div
                  className="px-4 py-3 rounded-2xl rounded-tl-sm"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
                >
                  <div className="flex items-center gap-1.5">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="w-2 h-2 rounded-full"
                        style={{
                          background: 'var(--accent)',
                          animation: 'bounce 1.2s ease-in-out infinite',
                          animationDelay: `${i * 0.2}s`,
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Input bar ──────────────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 p-4"
        style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-card)' }}
      >
        <div
          className="flex items-end gap-3 rounded-xl px-4 py-3"
          style={{
            background: 'var(--bg-surface)',
            border: `1px solid ${focused ? 'rgba(34,211,238,0.35)' : 'var(--border)'}`,
            transition: 'border-color 0.2s ease',
          }}
        >
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={
              hasDocuments
                ? 'Ask a question about your financial documents…'
                : 'Upload a document first to enable chat…'
            }
            disabled={!hasDocuments || isLoading}
            className="flex-1 bg-transparent resize-none outline-none text-sm leading-relaxed disabled:opacity-40"
            style={{
              color: 'var(--text-primary)',
              maxHeight: 160,
              fontFamily: 'DM Sans, system-ui, sans-serif',
            }}
          />
          <button
            onClick={handleSend}
            disabled={!canSend}
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            style={{
              background: canSend ? 'rgba(34,211,238,0.2)' : 'rgba(255,255,255,0.05)',
            }}
          >
            {isLoading
              ? <Loader2 style={{ width: 16, height: 16, color: 'var(--accent)' }} className="animate-spin" />
              : <Send style={{ width: 16, height: 16, color: canSend ? 'var(--accent)' : 'var(--text-muted)' }} />
            }
          </button>
        </div>
        <p className="text-xs text-center mt-2" style={{ color: 'var(--text-muted)' }}>
          Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
