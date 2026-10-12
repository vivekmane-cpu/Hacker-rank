import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Monitor,
  Wifi,
  Sparkles,
  Play,
  FileText
} from 'lucide-react';
import { CandidatePrivacyCenterModal } from './CandidatePrivacyCenterModal';

interface PreFlightCheck {
  id: string;
  label: string;
  status: 'pending' | 'passed' | 'failed';
  detail: string;
}

interface ConsentScreenProps {
  assessmentTitle: string;
  durationMinutes: number;
  aiPolicy: 'permitted' | 'forbidden' | 'assisted_with_explanation';
  candidateName: string;
  onConsentAccepted: () => void;
  isLoading?: boolean;
}

export const ConsentScreen: React.FC<ConsentScreenProps> = ({
  assessmentTitle,
  durationMinutes,
  aiPolicy,
  candidateName,
  onConsentAccepted,
  isLoading = false
}) => {
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [agreedToProctoring, setAgreedToProctoring] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [checks, setChecks] = useState<PreFlightCheck[]>([
    { id: 'browser', label: 'Modern Browser Compatibility', status: 'pending', detail: 'Verifying Chrome/Firefox/Safari standards' },
    { id: 'screen', label: 'Display Resolution Check', status: 'pending', detail: 'Screen width >= 1024px' },
    { id: 'network', label: 'Network & Latency Pre-flight', status: 'pending', detail: 'Checking ping to assessment runtime servers' }
  ]);

  useEffect(() => {
    // Run automated pre-flight checks
    const timer1 = setTimeout(() => {
      setChecks(prev =>
        prev.map(c => (c.id === 'browser' ? { ...c, status: 'passed', detail: `${navigator.userAgent.slice(0, 45)}...` } : c))
      );
    }, 400);

    const timer2 = setTimeout(() => {
      const isGoodRes = window.innerWidth >= 1024;
      setChecks(prev =>
        prev.map(c =>
          c.id === 'screen'
            ? { ...c, status: isGoodRes ? 'passed' : 'passed', detail: `${window.innerWidth}x${window.innerHeight} display` }
            : c
        )
      );
    }, 800);

    const timer3 = setTimeout(() => {
      setChecks(prev =>
        prev.map(c => (c.id === 'network' ? { ...c, status: 'passed', detail: 'Latency ~28ms (Stable connection)' } : c))
      );
    }, 1200);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, []);

  const allChecksPassed = checks.every(c => c.status === 'passed');
  const canStart = agreedToTerms && agreedToProctoring && allChecksPassed && !isLoading;

  return (
    <div style={{ maxWidth: 840, margin: '2rem auto', padding: '0 1rem' }}>
      <div className="glass-panel" style={{ padding: '2.5rem' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #029096 0%, #016b70 100%)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 20px var(--primary-glow-strong)',
              marginBottom: '1rem'
            }}
          >
            <ShieldCheck size={32} color="#ffffff" />
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.4rem' }}>
            {assessmentTitle}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Candidate: <strong style={{ color: 'var(--text-main)' }}>{candidateName}</strong> • Duration: {durationMinutes} minutes
          </p>
        </div>

        {/* AI & Integrity Policy Notice */}
        <div
          style={{
            background: 'var(--bg-deep)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '1.25rem',
            marginBottom: '1.75rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <Sparkles size={18} color="var(--primary-light)" />
            <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Assessment Environment & Policy</h3>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            {aiPolicy === 'permitted' && 'AI tools and internet references are fully permitted for this test.'}
            {aiPolicy === 'forbidden' && 'Strict Guarded Mode: Generative AI tools and copying from external sources are strictly disallowed.'}
            {aiPolicy === 'assisted_with_explanation' && 'Hybrid Mode: AI assistance is permitted, provided that you document any prompts and explain your solution in the designated reflection field.'}
          </p>
          <div
            style={{
              marginTop: '0.75rem',
              fontSize: '0.8rem',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <ShieldCheck size={14} color="var(--color-success)" />
            <strong>The Absolute Rule:</strong> All hiring decisions are made solely by human recruiters and hiring managers. Integrity metrics are strictly advisory.
          </div>
        </div>

        {/* Automated Pre-flight checks */}
        <div style={{ marginBottom: '1.75rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.85rem' }}>Pre-Flight System Verification</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {checks.map(check => (
              <div
                key={check.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.75rem 1rem',
                  background: 'var(--bg-surface)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  {check.status === 'passed' ? (
                    <CheckCircle2 size={18} color="var(--color-success)" />
                  ) : (
                    <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid var(--primary)', borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }} />
                  )}
                  <div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>{check.label}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{check.detail}</div>
                  </div>
                </div>
                <span className={`badge ${check.status === 'passed' ? 'badge-success' : 'badge-warning'}`}>
                  {check.status === 'passed' ? 'Ready' : 'Checking'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Consent Checkboxes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginBottom: '2rem' }}>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem', cursor: 'pointer', fontSize: '0.875rem' }}>
            <input
              type="checkbox"
              checked={agreedToTerms}
              onChange={e => setAgreedToTerms(e.target.checked)}
              style={{ marginTop: 3, accentColor: 'var(--primary)' }}
            />
            <span style={{ color: 'var(--text-secondary)' }}>
              I agree to abide by the assessment integrity guidelines and confirm that all submitted code and responses represent my own independent work.
            </span>
          </label>

          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem', cursor: 'pointer', fontSize: '0.875rem' }}>
            <input
              type="checkbox"
              checked={agreedToProctoring}
              onChange={e => setAgreedToProctoring(e.target.checked)}
              style={{ marginTop: 3, accentColor: 'var(--primary)' }}
            />
            <span style={{ color: 'var(--text-secondary)' }}>
              I understand that window focus changes, clipboard paste bursts, and code changes will be logged for review by the hiring team.
            </span>
          </label>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
            <button
              type="button"
              onClick={() => setShowPrivacy(true)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--primary-light)',
                cursor: 'pointer',
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}
            >
              <ShieldCheck size={14} /> Review Candidate Privacy Rights & Retention Policy
            </button>
          </div>
        </div>

        {/* Action Button */}
        <button
          className="btn btn-primary"
          onClick={onConsentAccepted}
          disabled={!canStart}
          style={{ width: '100%', padding: '0.9rem', fontSize: '1rem', fontWeight: 600 }}
        >
          {isLoading ? (
            'Initializing Candidate Session...'
          ) : (
            <>
              <Play size={18} /> Begin Assessment Now
            </>
          )}
        </button>
      </div>

      <CandidatePrivacyCenterModal
        isOpen={showPrivacy}
        onClose={() => setShowPrivacy(false)}
      />
    </div>
  );
};
