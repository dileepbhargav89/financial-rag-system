// Header.jsx — FinRAG branding + server status (Python/FastAPI edition)
import React, { useState, useEffect } from 'react';
import { TrendingUp, Wifi, WifiOff, Loader } from 'lucide-react';
import { healthCheck } from '../utils/api';

const STATUS_CONFIG = {
  online:   { color: '#10b981', bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.2)',  label: 'Connected',   Icon: Wifi    },
  offline:  { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.2)',   label: 'Offline',     Icon: WifiOff },
  checking: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.2)',  label: 'Connecting…', Icon: Loader  },
};

export default function Header() {
  const [status, setStatus] = useState('checking');

  useEffect(() => {
    let cancelled = false;
    async function check() {
      try {
        await healthCheck();
        if (!cancelled) setStatus('online');
      } catch {
        if (!cancelled) setStatus('offline');
      }
    }
    check();
    const id = setInterval(check, 30_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const { color, bg, border, label, Icon } = STATUS_CONFIG[status];

  return (
    <header
      className="sticky top-0 z-50 flex items-center justify-between px-6 py-4"
      style={{
        background: 'rgba(8,13,26,0.88)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      {/* Brand */}
      <div className="flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, rgba(34,211,238,0.2), rgba(16,185,129,0.15))',
            border: '1px solid rgba(34,211,238,0.25)',
          }}
        >
          <TrendingUp style={{ width: 20, height: 20, color: 'var(--accent)' }} />
        </div>
        <div>
          <h1
            className="text-lg font-bold leading-none"
            style={{ fontFamily: 'DM Serif Display, Georgia, serif', color: 'var(--text-primary)' }}
          >
            FinRAG<span style={{ color: 'var(--accent)' }}>.</span>
          </h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            AI Financial Intelligence
          </p>
        </div>
      </div>

      {/* Right — stack badge + status */}
      <div className="flex items-center gap-3">
        {/* Stack badge */}
        <div
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid var(--border)',
            color: 'var(--text-muted)',
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#f97316' }} />
          Mistral Large · Python FastAPI
        </div>

        {/* Server status */}
        <div
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
          style={{ background: bg, border: `1px solid ${border}`, color }}
        >
          <Icon
            style={{ width: 14, height: 14 }}
            className={status === 'checking' ? 'animate-spin' : ''}
          />
          <span>{label}</span>
        </div>
      </div>
    </header>
  );
}
