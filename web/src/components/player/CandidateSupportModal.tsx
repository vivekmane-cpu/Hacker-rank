import React, { useState } from 'react';
import { HelpCircle, X, Send, CheckCircle2, AlertTriangle, Monitor, Wifi, FileQuestion } from 'lucide-react';

interface CandidateSupportModalProps {
  isOpen: boolean;
  onClose: () => void;
  attemptId?: string;
  candidateEmail?: string;
}

export const CandidateSupportModal: React.FC<CandidateSupportModalProps> = ({
  isOpen,
  onClose,
  attemptId,
  candidateEmail
}) => {
  const [category, setCategory] = useState<'editor' | 'network' | 'question' | 'accommodation'>('editor');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [ticketId, setTicketId] = useState<string | null>(null);

  if (!isOpen) return null;

  const categories = [
    { id: 'editor', label: 'Editor / Runtime Glitch', icon: Monitor, desc: 'Code runner, syntax formatting, or browser execution issues' },
    { id: 'network', label: 'Network / Autosave Trouble', icon: Wifi, desc: 'Connection drops, slow latency, or sync lag' },
    { id: 'question', label: 'Question Ambiguity', icon: FileQuestion, desc: 'Unclear problem constraints or missing test input details' },
    { id: 'accommodation', label: 'Accessibility / Extra Time', icon: AlertTriangle, desc: 'Accommodations or assistive technology support' }
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;

    setIsSubmitting(true);
    try {
      // In production, posts to `/api/v1/support`
      await new Promise(res => setTimeout(res, 800));
      setTicketId(`INC-${Math.floor(100000 + Math.random() * 900000)}`);
      setIsSubmitted(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setIsSubmitted(false);
    setDescription('');
    setTicketId(null);
    onClose();
  };

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
          maxWidth: 560,
          width: '100%',
          padding: '2rem',
          background: 'var(--bg-surface-elevated)',
          position: 'relative'
        }}
      >
        <button
          onClick={handleReset}
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

        {isSubmitted ? (
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: '50%',
                background: 'rgba(16, 185, 129, 0.15)',
                color: 'var(--color-success)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1rem'
              }}
            >
              <CheckCircle2 size={30} />
            </div>
            <h3 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '0.4rem' }}>
              Support Incident Logged
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.25rem', lineHeight: 1.5 }}>
              Ticket Reference: <strong style={{ color: 'var(--primary-light)' }}>{ticketId}</strong><br />
              The recruiting and technical proctoring team has been notified. Your progress and timer remain saved.
            </p>
            <div
              style={{
                background: 'var(--bg-deep)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.85rem 1rem',
                fontSize: '0.8rem',
                color: 'var(--text-muted)',
                marginBottom: '1.5rem',
                textAlign: 'left'
              }}
            >
              • If you experienced a fatal disconnect, your resume token allows you to re-enter seamlessly.<br />
              • Human reviewers will review this incident log alongside your final submission.
            </div>
            <button className="btn btn-primary" onClick={handleReset} style={{ width: '100%' }}>
              Resume Assessment
            </button>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.35rem' }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: '8px',
                  background: 'var(--primary-faint)',
                  color: 'var(--primary-light)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <HelpCircle size={20} />
              </div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>I'm Having a Problem</h2>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              Report a technical glitch or question issue directly to the platform ops team.
            </p>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                  Select Issue Type
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                  {categories.map(cat => {
                    const Icon = cat.icon;
                    const isSelected = category === cat.id;
                    return (
                      <div
                        key={cat.id}
                        onClick={() => setCategory(cat.id as any)}
                        style={{
                          padding: '0.75rem',
                          borderRadius: 'var(--radius-sm)',
                          background: isSelected ? 'var(--primary-faint)' : 'var(--bg-deep)',
                          border: `1px solid ${isSelected ? 'var(--primary)' : 'var(--border-subtle)'}`,
                          cursor: 'pointer',
                          transition: 'all var(--transition-fast)'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
                          <Icon size={15} color={isSelected ? 'var(--primary-light)' : 'var(--text-muted)'} />
                          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: isSelected ? '#ffffff' : 'var(--text-main)' }}>
                            {cat.label}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: 1.3 }}>
                          {cat.desc}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                  Problem Details & Reproduction
                </label>
                <textarea
                  className="form-textarea"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Describe what went wrong (e.g., Code runner hung on Test Case 2, or keyboard input lag)..."
                  required
                  style={{ minHeight: 90, fontSize: '0.85rem' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={onClose}
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!description.trim() || isSubmitting}
                  style={{ flex: 1 }}
                >
                  <Send size={15} /> {isSubmitting ? 'Submitting...' : 'Send Help Request'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
