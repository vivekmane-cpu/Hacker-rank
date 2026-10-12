import React, { useState } from 'react';
import { ShieldCheck, CheckCircle2, XCircle, Users, HelpCircle, Lock, Send, AlertTriangle } from 'lucide-react';

export type HiringDecision = 'pass' | 'fail' | 'interview' | 'inconclusive';

interface DecisionAuthoringProps {
  onCommitDecision: (decision: HiringDecision, notes: string) => Promise<void>;
  isCommitted?: boolean;
  committedDecision?: HiringDecision | null;
}

export const DecisionAuthoring: React.FC<DecisionAuthoringProps> = ({
  onCommitDecision,
  isCommitted = false,
  committedDecision = null
}) => {
  const [selectedDecision, setSelectedDecision] = useState<HiringDecision>('pass');
  const [notes, setNotes] = useState<string>('');
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [acknowledgedAbsoluteRule, setAcknowledgedAbsoluteRule] = useState<boolean>(false);

  const decisions: { id: HiringDecision; label: string; desc: string; icon: any; color: string }[] = [
    {
      id: 'pass',
      label: 'Recommend Hire',
      desc: 'Candidate demonstrated strong architectural competence and clean code.',
      icon: CheckCircle2,
      color: 'var(--color-success)'
    },
    {
      id: 'interview',
      label: 'Follow-up Interview',
      desc: 'Promising work with key technical decisions to explore during live pairing.',
      icon: Users,
      color: 'var(--primary-light)'
    },
    {
      id: 'fail',
      label: 'Do Not Advance',
      desc: 'Solution did not satisfy minimum complexity or correctness thresholds.',
      icon: XCircle,
      color: 'var(--color-danger)'
    },
    {
      id: 'inconclusive',
      label: 'Inconclusive',
      desc: 'Requires peer assessment or secondary review.',
      icon: HelpCircle,
      color: 'var(--color-warning)'
    }
  ];

  const handleFinalSubmit = async () => {
    if (!acknowledgedAbsoluteRule) return;
    setIsSubmitting(true);
    try {
      await onCommitDecision(selectedDecision, notes);
      setShowConfirmModal(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isCommitted && committedDecision) {
    const dec = decisions.find(d => d.id === committedDecision);
    const Icon = dec?.icon || ShieldCheck;
    return (
      <div className="glass-panel" style={{ padding: '1.5rem', textAlign: 'center' }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            background: 'rgba(16, 185, 129, 0.15)',
            color: 'var(--color-success)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '0.75rem'
          }}
        >
          <Icon size={24} color={dec?.color || 'var(--color-success)'} />
        </div>
        <h4 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.25rem' }}>
          Decision Recorded: {dec?.label}
        </h4>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Human review has been finalized and immutable audit record created.
        </p>
      </div>
    );
  }

  return (
    <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <ShieldCheck size={18} color="var(--primary-light)" />
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Human Reviewer Decision</h3>
      </div>

      {/* Decision Choice Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
        {decisions.map(d => {
          const Icon = d.icon;
          const isSelected = selectedDecision === d.id;
          return (
            <div
              key={d.id}
              onClick={() => setSelectedDecision(d.id)}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
                padding: '0.85rem 1rem',
                borderRadius: 'var(--radius-sm)',
                background: isSelected ? 'var(--bg-surface-elevated)' : 'var(--bg-deep)',
                border: `1px solid ${isSelected ? d.color : 'var(--border-subtle)'}`,
                cursor: 'pointer',
                transition: 'all var(--transition-fast)'
              }}
            >
              <Icon size={20} color={d.color} style={{ marginTop: 2 }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.875rem', color: isSelected ? '#ffffff' : 'var(--text-main)' }}>
                  {d.label}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.3 }}>
                  {d.desc}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Reviewer Feedback Notes */}
      <div>
        <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>
          Detailed Technical Rationale & Candidate Feedback Notes
        </label>
        <textarea
          className="form-textarea"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Document the technical reasoning behind this evaluation for the hiring committee..."
          style={{ minHeight: 90, fontSize: '0.85rem' }}
        />
      </div>

      <button
        className="btn btn-primary"
        onClick={() => setShowConfirmModal(true)}
        disabled={!notes.trim()}
        style={{ padding: '0.65rem 1.25rem', fontSize: '0.9rem' }}
      >
        <Lock size={15} /> Finalize Official Decision
      </button>

      {/* The Absolute Rule Confirmation Modal */}
      {showConfirmModal && (
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
              maxWidth: 540,
              width: '100%',
              padding: '2rem',
              background: 'var(--bg-surface-elevated)'
            }}
          >
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: '50%',
                  background: 'var(--primary-faint)',
                  color: 'var(--primary-light)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '1rem'
                }}
              >
                <ShieldCheck size={28} />
              </div>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                Confirm Official Hiring Outcome
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.5 }}>
                You are about to record a permanent <strong>{selectedDecision.toUpperCase()}</strong> decision for this candidate.
              </p>
            </div>

            <div
              style={{
                background: 'rgba(2, 144, 150, 0.08)',
                border: '1px solid rgba(2, 144, 150, 0.3)',
                borderRadius: 'var(--radius-sm)',
                padding: '1rem',
                marginBottom: '1.5rem',
                fontSize: '0.82rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.5
              }}
            >
              <strong style={{ color: 'var(--primary-light)' }}>The Absolute Rule Verification:</strong><br />
              As a human evaluator, you certify that you have independently examined the candidate's code and problem-solving process. Automated AI and integrity scores remain strictly advisory.
            </div>

            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem', cursor: 'pointer', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              <input
                type="checkbox"
                checked={acknowledgedAbsoluteRule}
                onChange={e => setAcknowledgedAbsoluteRule(e.target.checked)}
                style={{ marginTop: 3, accentColor: 'var(--primary)' }}
              />
              <span style={{ color: 'var(--text-main)' }}>
                I confirm that I have exercised independent human judgment in reaching this decision.
              </span>
            </label>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                className="btn btn-secondary"
                onClick={() => setShowConfirmModal(false)}
                style={{ flex: 1 }}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleFinalSubmit}
                disabled={!acknowledgedAbsoluteRule || isSubmitting}
                style={{ flex: 1 }}
              >
                {isSubmitting ? 'Recording...' : 'Commit Decision'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
