// src/components/Dashboard.jsx
// Mini stats dashboard — documents, pages, vector chunks, answers

import React from 'react';
import { FileText, MessageSquare, Database, Layers } from 'lucide-react';

export default function Dashboard({ uploadedDocs, messages }) {
  const ready       = uploadedDocs.filter((d) => d.status === 'ready');
  const totalChunks = ready.reduce((s, d) => s + (d.chunks || 0), 0);
  const totalPages  = ready.reduce((s, d) => s + (d.pages  || 0), 0);
  const answers     = messages.filter((m) => m.role === 'assistant').length;

  const stats = [
    { label: 'Documents', value: ready.length,         Icon: FileText,      color: '#22d3ee', bg: 'rgba(34,211,238,0.08)',  border: 'rgba(34,211,238,0.15)'  },
    { label: 'Pages',     value: totalPages  || '—',   Icon: Layers,        color: '#a78bfa', bg: 'rgba(167,139,250,0.08)', border: 'rgba(167,139,250,0.15)' },
    { label: 'Chunks',    value: totalChunks || '—',   Icon: Database,      color: '#10b981', bg: 'rgba(16,185,129,0.08)',  border: 'rgba(16,185,129,0.15)'  },
    { label: 'Answers',   value: answers,               Icon: MessageSquare, color: '#f59e0b', bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.15)'  },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {stats.map(({ label, value, Icon, color, bg, border }) => (
        <div
          key={label}
          className="stat-card rounded-xl px-4 py-3.5"
          style={{ background: bg, border: `1px solid ${border}` }}
        >
          <div className="flex items-center gap-2 mb-1.5">
            <Icon style={{ width: 14, height: 14, color }} />
            <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
              {label}
            </span>
          </div>
          <p
            className="text-2xl font-bold"
            style={{ color, fontFamily: 'DM Serif Display, Georgia, serif' }}
          >
            {value}
          </p>
        </div>
      ))}
    </div>
  );
}
