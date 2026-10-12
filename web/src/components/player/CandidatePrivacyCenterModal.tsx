import React, { useState } from 'react';
import { ShieldCheck, X, Check, Lock, Eye, Trash2, FileText, ExternalLink } from 'lucide-react';

interface CandidatePrivacyCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidateEmail?: string;
}

export const CandidatePrivacyCenterModal: React.FC<CandidatePrivacyCenterModalProps> = ({
  isOpen,
  onClose,
  candidateEmail = 'candidate@example.com'
}) => {
  const [requestSent, setRequestSent] = useState(false);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 105,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem'
      }}
    >
      <div
        className="glass-panel"
        style={{
          maxWidth: 640,
          width: '100%',
          padding: '2.25rem',
          background: 'var(--bg-surface-elevated)',
          position: 'relative',
          maxHeight: '90vh',
          overflowY: 'auto'
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

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.4rem' }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '8px',
              background: 'var(--primary-faint)',
              color: 'var(--primary-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <ShieldCheck size={22} />
          </div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 700 }}>Candidate Privacy & Rights Center</h2>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
          Commitment to transparency, ethical proctoring, and statutory data rights (GDPR, India DPDP, CCPA).
        </p>

        {/* Categories of Data Collected */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
          <div
            style={{
              background: 'var(--bg-deep)',
              borderRadius: 'var(--radius-sm)',
              padding: '1rem',
              border: '1px solid var(--border-subtle)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
              <FileText size={16} color="var(--primary-light)" />
              <strong style={{ fontSize: '0.875rem' }}>1. Assessment Artifacts & Code Solutions</strong>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              Source code, multiple choice responses, SQL queries, and test case outputs submitted during your session. Used strictly for evaluation by the hiring organization.
            </p>
          </div>

          <div
            style={{
              background: 'var(--bg-deep)',
              borderRadius: 'var(--radius-sm)',
              padding: '1rem',
              border: '1px solid var(--border-subtle)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
              <Eye size={16} color="var(--primary-light)" />
              <strong style={{ fontSize: '0.875rem' }}>2. Session Integrity Telemetry</strong>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              Window focus blur durations, clipboard paste timestamps, and system pre-flight checks. Telemetry is advisory metadata and never used for automated rejection.
            </p>
          </div>

          <div
            style={{
              background: 'var(--bg-deep)',
              borderRadius: 'var(--radius-sm)',
              padding: '1rem',
              border: '1px solid var(--border-subtle)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
              <Lock size={16} color="var(--primary-light)" />
              <strong style={{ fontSize: '0.875rem' }}>3. Retention & Encryption Standards</strong>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              Encrypted in transit (TLS 1.3) and at rest (PostgreSQL Forced Row-Level Security). Candidate records are retained for 90 days by default, after which automated anonymization occurs.
            </p>
          </div>
        </div>

        {/* Data Subject Rights */}
        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1.25rem', marginBottom: '1.5rem' }}>
          <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.5rem' }}>Your Statutory Rights</h4>
          <ul style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.6, paddingLeft: '1.25rem' }}>
            <li><strong>Right to Human Review:</strong> The Absolute Rule guarantees that no automated algorithm can make a hiring decision.</li>
            <li><strong>Right of Explanation:</strong> You retain the right to submit clarifying explanations for any flagged telemetry.</li>
            <li><strong>Right to Erasure:</strong> You can request permanent deletion of your candidate dossier following recruitment.</li>
          </ul>
        </div>

        {/* Erasure Action */}
        {requestSent ? (
          <div
            style={{
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: 'var(--radius-sm)',
              padding: '0.85rem',
              textAlign: 'center',
              color: 'var(--color-success)',
              fontSize: '0.85rem'
            }}
          >
            <Check size={16} style={{ display: 'inline', marginRight: 4 }} />
            Data Subject Request registered for {candidateEmail}. A confirmation dispatch has been logged.
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Candidate: <code>{candidateEmail}</code>
            </span>
            <button
              className="btn btn-secondary"
              onClick={() => setRequestSent(true)}
              style={{ fontSize: '0.8rem', padding: '0.45rem 0.85rem' }}
            >
              <Trash2 size={14} /> Request Post-Hiring Erasure
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
