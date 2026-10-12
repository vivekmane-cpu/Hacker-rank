import React from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Clock,
  Clipboard,
  ExternalLink,
  Sparkles,
  AlertTriangle,
  FileText
} from 'lucide-react';

export interface IntegrityEvent {
  id: string;
  type: 'tab_blur' | 'paste_burst' | 'ai_suspect' | 'code_similarity' | 'candidate_reflection';
  timestamp: string;
  severity: 'low' | 'medium' | 'high' | 'info';
  title: string;
  details: string;
  metadata?: Record<string, any>;
}

interface EvidenceTimelineProps {
  events: IntegrityEvent[];
  overallIntegrityScore: number;
  advisoryLevel: 'clear' | 'suspicious' | 'violation';
}

export const EvidenceTimeline: React.FC<EvidenceTimelineProps> = ({
  events,
  overallIntegrityScore,
  advisoryLevel
}) => {
  return (
    <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header & Overall Advisory Status */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <ShieldAlert size={18} color="var(--primary-light)" />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Evidence & Integrity Timeline</h3>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Real-time telemetry captured during the candidate attempt session.
          </p>
        </div>

        <span
          className={`badge ${
            advisoryLevel === 'clear'
              ? 'badge-success'
              : advisoryLevel === 'suspicious'
              ? 'badge-warning'
              : 'badge-danger'
          }`}
        >
          {advisoryLevel.toUpperCase()} ({overallIntegrityScore}% Score)
        </span>
      </div>

      {/* The Absolute Rule Callout */}
      <div
        style={{
          background: 'rgba(2, 144, 150, 0.08)',
          border: '1px solid rgba(2, 144, 150, 0.25)',
          borderRadius: 'var(--radius-sm)',
          padding: '0.75rem 1rem',
          fontSize: '0.8rem',
          color: 'var(--text-secondary)',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.5rem'
        }}
      >
        <Sparkles size={16} color="var(--primary-light)" style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <strong style={{ color: 'var(--primary-light)' }}>The Absolute Rule:</strong> Telemetry, blur counts, and AI signals are strictly advisory heuristics. Automated algorithms are never permitted to make hiring decisions. Human judgment is legally and procedurally sovereign.
        </div>
      </div>

      {/* Chronological Event Timeline */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: 380, overflowY: 'auto', paddingRight: '0.25rem' }}>
        {events.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            <ShieldCheck size={28} color="var(--color-success)" style={{ display: 'block', margin: '0 auto 0.5rem' }} />
            No integrity anomalies detected. Candidate maintained continuous active window focus.
          </div>
        ) : (
          events.map(event => {
            const isHigh = event.severity === 'high';
            const isMedium = event.severity === 'medium';
            return (
              <div
                key={event.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem',
                  padding: '0.75rem 1rem',
                  background: 'var(--bg-deep)',
                  borderRadius: 'var(--radius-sm)',
                  border: `1px solid ${
                    isHigh
                      ? 'rgba(239, 68, 68, 0.3)'
                      : isMedium
                      ? 'rgba(245, 158, 11, 0.3)'
                      : 'var(--border-subtle)'
                  }`
                }}
              >
                <div style={{ marginTop: 2 }}>
                  {event.type === 'tab_blur' && <ExternalLink size={16} color="var(--color-warning)" />}
                  {event.type === 'paste_burst' && <Clipboard size={16} color="var(--color-danger)" />}
                  {event.type === 'ai_suspect' && <Sparkles size={16} color="var(--primary-light)" />}
                  {event.type === 'code_similarity' && <FileText size={16} color="var(--color-info)" />}
                  {event.type === 'candidate_reflection' && <ShieldCheck size={16} color="var(--color-success)" />}
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>
                      {event.title}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Clock size={12} /> {event.timestamp}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    {event.details}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
