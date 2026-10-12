import { Clock, Check, AlertCircle, Wifi, WifiOff, Send, HelpCircle, ShieldCheck, ShieldAlert } from 'lucide-react';

interface TimerBarProps {
  remainingSeconds: number;
  totalSeconds: number;
  currentSectionTitle: string;
  currentQuestionIndex: number;
  totalQuestions: number;
  autosaveStatus: 'saved' | 'saving' | 'error' | 'offline';
  isOnline: boolean;
  isSecureMode?: boolean;
  onSupportClick?: () => void;
  onPrivacyClick?: () => void;
  onSubmitClick: () => void;
}

export const TimerBar: React.FC<TimerBarProps> = ({
  remainingSeconds,
  totalSeconds,
  currentSectionTitle,
  currentQuestionIndex,
  totalQuestions,
  autosaveStatus,
  isOnline,
  isSecureMode = true,
  onSupportClick,
  onPrivacyClick,
  onSubmitClick
}) => {
  const hours = Math.floor(remainingSeconds / 3600);
  const minutes = Math.floor((remainingSeconds % 3600) / 60);
  const seconds = remainingSeconds % 60;

  const formattedTime = [
    hours > 0 ? String(hours).padStart(2, '0') : null,
    String(minutes).padStart(2, '0'),
    String(seconds).padStart(2, '0')
  ]
    .filter(Boolean)
    .join(':');

  const isLowTime = remainingSeconds <= 300; // < 5 mins
  const isCriticalTime = remainingSeconds <= 60; // < 1 min

  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 40,
        background: 'rgba(6, 9, 14, 0.95)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--border-subtle)',
        padding: '0.75rem 1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)'
      }}
    >
      {/* Left: Section & Question Progress */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
        <div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Section
          </span>
          <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-main)' }}>
            {currentSectionTitle}
          </div>
        </div>

        <div style={{ height: 28, width: 1, background: 'var(--border-subtle)' }} />

        <div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Question
          </span>
          <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--primary-light)' }}>
            {currentQuestionIndex + 1} of {totalQuestions}
          </div>
        </div>
      </div>

      {/* Center: Live Synchronized Countdown Timer */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.45rem 1.15rem',
          borderRadius: 'var(--radius-full)',
          background: isCriticalTime
            ? 'rgba(239, 68, 68, 0.15)'
            : isLowTime
            ? 'rgba(245, 158, 11, 0.15)'
            : 'var(--bg-surface-elevated)',
          border: `1px solid ${
            isCriticalTime
              ? 'rgba(239, 68, 68, 0.4)'
              : isLowTime
              ? 'rgba(245, 158, 11, 0.4)'
              : 'var(--border-subtle)'
          }`,
          color: isCriticalTime ? 'var(--color-danger)' : isLowTime ? 'var(--color-warning)' : 'var(--text-main)',
          transition: 'all var(--transition-fast)'
        }}
      >
        <Clock size={16} />
        <span style={{ fontFamily: 'monospace', fontSize: '1.1rem', fontWeight: 700, letterSpacing: '0.05em' }}>
          {formattedTime}
        </span>
        {isLowTime && (
          <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>
            {isCriticalTime ? 'Ending soon!' : 'Time low'}
          </span>
        )}
      </div>

      {/* Right: Autosave status, Support, Privacy & Submit button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        {isSecureMode && (
          <span className="badge badge-teal" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.7rem' }}>
            <ShieldAlert size={12} /> Secure Mode
          </span>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem' }}>
          {isOnline ? (
            autosaveStatus === 'saving' ? (
              <>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--primary)', animation: 'pulse 1s infinite' }} />
                <span style={{ color: 'var(--text-muted)' }}>Saving draft...</span>
              </>
            ) : autosaveStatus === 'error' ? (
              <>
                <AlertCircle size={14} color="var(--color-danger)" />
                <span style={{ color: 'var(--color-danger)' }}>Save failed</span>
              </>
            ) : (
              <>
                <Check size={14} color="var(--color-success)" />
                <span style={{ color: 'var(--text-secondary)' }}>Autosaved</span>
              </>
            )
          ) : (
            <>
              <WifiOff size={14} color="var(--color-danger)" />
              <span style={{ color: 'var(--color-danger)' }}>Offline (Retrying)</span>
            </>
          )}
        </div>

        {onSupportClick && (
          <button
            onClick={onSupportClick}
            className="btn btn-secondary"
            title="Report a problem or technical issue"
            style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', gap: '0.35rem' }}
          >
            <HelpCircle size={14} color="var(--primary-light)" /> Having a problem?
          </button>
        )}

        {onPrivacyClick && (
          <button
            onClick={onPrivacyClick}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              padding: '0.35rem'
            }}
            title="Candidate Privacy Center & Data Rights"
          >
            <ShieldCheck size={16} />
          </button>
        )}

        <button
          className="btn btn-primary"
          onClick={onSubmitClick}
          style={{ padding: '0.45rem 1rem', fontSize: '0.85rem' }}
        >
          <Send size={15} /> Submit Test
        </button>
      </div>
    </div>
  );
};
