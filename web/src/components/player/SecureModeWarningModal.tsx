import React from 'react';
import { ShieldAlert, Maximize2, AlertTriangle } from 'lucide-react';

interface SecureModeWarningModalProps {
  isOpen: boolean;
  warningCount: number;
  onReEnterFullscreen: () => void;
}

export const SecureModeWarningModal: React.FC<SecureModeWarningModalProps> = ({
  isOpen,
  warningCount,
  onReEnterFullscreen
}) => {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 110,
        background: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem'
      }}
    >
      <div
        className="glass-panel"
        style={{
          maxWidth: 520,
          width: '100%',
          padding: '2.25rem',
          background: 'var(--bg-surface-elevated)',
          textAlign: 'center',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          boxShadow: '0 0 30px rgba(239, 68, 68, 0.2)'
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: 'rgba(239, 68, 68, 0.15)',
            color: 'var(--color-danger)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '1.25rem'
          }}
        >
          <ShieldAlert size={32} />
        </div>

        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.5rem', color: '#ffffff' }}>
          Secure Mode Notice: Window Exit Detected
        </h2>

        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5, marginBottom: '1.25rem' }}>
          This assessment is operating in <strong>Secure Mode</strong>. You exited full-screen presentation or switched browser windows.
        </p>

        <div
          style={{
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            borderRadius: 'var(--radius-sm)',
            padding: '0.85rem 1rem',
            marginBottom: '1.5rem',
            fontSize: '0.82rem',
            textAlign: 'left',
            color: 'var(--text-secondary)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--color-warning)', fontWeight: 600, marginBottom: '0.25rem' }}>
            <AlertTriangle size={15} /> Exit Event Recorded (#{warningCount})
          </div>
          <div>
            This anomaly has been logged to the integrity evidence timeline for human reviewer inspection. Per <strong>The Absolute Rule</strong>, an accidental exit will never automatically disqualify you.
          </div>
        </div>

        <button
          className="btn btn-primary"
          onClick={onReEnterFullscreen}
          style={{ width: '100%', padding: '0.8rem', fontSize: '0.95rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
        >
          <Maximize2 size={18} /> Re-Enter Full-Screen Mode
        </button>
      </div>
    </div>
  );
};
