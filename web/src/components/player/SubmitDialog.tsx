import React from 'react';
import { AlertCircle, CheckCircle2, Send, X } from 'lucide-react';

interface SubmitDialogProps {
  isOpen: boolean;
  unansweredCount: number;
  totalQuestions: number;
  onClose: () => void;
  onConfirmSubmit: () => void;
  isSubmitting?: boolean;
}

export const SubmitDialog: React.FC<SubmitDialogProps> = ({
  isOpen,
  unansweredCount,
  totalQuestions,
  onClose,
  onConfirmSubmit,
  isSubmitting = false
}) => {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem'
      }}
    >
      <div
        className="glass-panel"
        style={{
          maxWidth: 520,
          width: '100%',
          padding: '2rem',
          background: 'var(--bg-surface-elevated)',
          position: 'relative'
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1.25rem',
            right: '1.25rem',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer'
          }}
        >
          <X size={20} />
        </button>

        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div
            style={{
              width: 50,
              height: 50,
              borderRadius: '50%',
              background: unansweredCount > 0 ? 'rgba(245, 158, 11, 0.15)' : 'var(--primary-faint)',
              color: unansweredCount > 0 ? 'var(--color-warning)' : 'var(--primary-light)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1rem'
            }}
          >
            {unansweredCount > 0 ? <AlertCircle size={28} /> : <CheckCircle2 size={28} />}
          </div>

          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.5rem' }}>
            Ready to submit your assessment?
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>
            Once submitted, your responses will be locked and cannot be edited.
          </p>
        </div>

        {unansweredCount > 0 && (
          <div
            style={{
              background: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: 'var(--radius-sm)',
              padding: '0.85rem 1rem',
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              color: 'var(--color-warning)',
              fontSize: '0.85rem'
            }}
          >
            <AlertCircle size={18} />
            <span>
              You have <strong>{unansweredCount}</strong> unanswered question{unansweredCount > 1 ? 's' : ''} out of {totalQuestions}.
            </span>
          </div>
        )}

        <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
          <button
            className="btn btn-secondary"
            onClick={onClose}
            style={{ flex: 1 }}
            disabled={isSubmitting}
          >
            Review Questions
          </button>
          <button
            className="btn btn-primary"
            onClick={onConfirmSubmit}
            style={{ flex: 1 }}
            disabled={isSubmitting}
          >
            <Send size={16} /> {isSubmitting ? 'Submitting...' : 'Confirm Submission'}
          </button>
        </div>
      </div>
    </div>
  );
};
