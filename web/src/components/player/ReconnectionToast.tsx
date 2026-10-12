import React from 'react';
import { WifiOff, RotateCw, AlertTriangle } from 'lucide-react';

interface ReconnectionToastProps {
  isOffline: boolean;
  retryCountdown: number;
  onManualRetry: () => void;
}

export const ReconnectionToast: React.FC<ReconnectionToastProps> = ({
  isOffline,
  retryCountdown,
  onManualRetry
}) => {
  if (!isOffline) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '1.5rem',
        right: '1.5rem',
        zIndex: 100,
        background: 'rgba(239, 68, 68, 0.95)',
        backdropFilter: 'blur(12px)',
        color: '#ffffff',
        padding: '1rem 1.25rem',
        borderRadius: 'var(--radius-md)',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        border: '1px solid rgba(255, 255, 255, 0.2)'
      }}
    >
      <WifiOff size={22} />
      <div>
        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Network Connection Lost</div>
        <div style={{ fontSize: '0.78rem', opacity: 0.9 }}>
          Drafts are saved locally. Auto-reconnecting in {retryCountdown}s...
        </div>
      </div>
      <button
        onClick={onManualRetry}
        style={{
          background: 'rgba(255, 255, 255, 0.2)',
          border: 'none',
          color: '#ffffff',
          padding: '0.4rem 0.75rem',
          borderRadius: 'var(--radius-sm)',
          cursor: 'pointer',
          fontSize: '0.8rem',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '0.35rem'
        }}
      >
        <RotateCw size={13} /> Retry
      </button>
    </div>
  );
};
