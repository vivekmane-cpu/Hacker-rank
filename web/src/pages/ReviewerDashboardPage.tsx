import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import {
  EvidenceTimeline,
  IntegrityEvent
} from '../components/reviewer/EvidenceTimeline';
import { RubricGrading } from '../components/reviewer/RubricGrading';
import {
  DecisionAuthoring,
  HiringDecision
} from '../components/reviewer/DecisionAuthoring';
import {
  ShieldCheck,
  Download,
  FileText,
  Code2,
  Database,
  CheckCircle2,
  ExternalLink,
  Sparkles,
  Printer,
  X
} from 'lucide-react';

export const ReviewerDashboardPage: React.FC = () => {
  const { attemptId } = useParams<{ attemptId?: string }>();

  // Candidate attempt sample data
  const candidate = {
    id: attemptId || 'att_sample_987',
    name: 'Elena Rostova',
    email: 'elena.rostova@example.com',
    assessmentTitle: 'Senior Infrastructure & Distributed Systems',
    roleTarget: 'Staff Site Reliability Engineer',
    submittedAt: 'October 10, 2026 14:32 UTC',
    durationSpentMinutes: 38,
    maxDurationMinutes: 45
  };

  // Integrity evidence timeline
  const [integrityEvents] = useState<IntegrityEvent[]>([
    {
      id: 'ev_1',
      type: 'tab_blur',
      timestamp: '14:04:12',
      severity: 'low',
      title: 'Window Blur (Duration: 4.2s)',
      details: 'Candidate switched window focus briefly to check documentation or local environment.'
    },
    {
      id: 'ev_2',
      type: 'paste_burst',
      timestamp: '14:18:45',
      severity: 'medium',
      title: 'Paste Burst (184 characters)',
      details: 'Pasted boilerplate test assertions into the code editor. Structure matches standard Jest setup.'
    },
    {
      id: 'ev_3',
      type: 'ai_suspect',
      timestamp: '14:26:10',
      severity: 'info',
      title: 'AI Advisory Heuristic (Score: 28%)',
      details: 'Low probability of synthetic AI text. Code structure exhibits idiosyncratic commenting.'
    },
    {
      id: 'ev_4',
      type: 'candidate_reflection',
      timestamp: '14:30:00',
      severity: 'info',
      title: 'Candidate Reflection Logged',
      details: 'Candidate explained: "Used standard Map iteration pattern for LRU cache eviction logic."'
    }
  ]);

  // Rubric state
  const [rubrics, setRubrics] = useState([
    { id: 'correctness', name: 'Correctness & Test Suite', description: 'Pass rate on unit and edge test cases', weight: 35, score: 95 },
    { id: 'quality', name: 'Code Quality & Clean Architecture', description: 'Readability, naming conventions, and idiomatic style', weight: 25, score: 90 },
    { id: 'system', name: 'System Design & Scalability', description: 'Trade-off analysis, concurrency, and fault tolerance', weight: 25, score: 88 },
    { id: 'communication', name: 'Clarity & Communication', description: 'Documentation, rationale, and reasoning explanations', weight: 15, score: 92 }
  ]);

  const [finalScore, setFinalScore] = useState<number>(91);
  const [isDecisionCommitted, setIsDecisionCommitted] = useState<boolean>(false);
  const [committedDecision, setCommittedDecision] = useState<HiringDecision | null>(null);
  const [showPdfModal, setShowPdfModal] = useState<boolean>(false);
  const [activeQuestionTab, setActiveQuestionTab] = useState<'q1_code' | 'q2_sql' | 'q3_arch'>('q1_code');

  const handleCommitDecision = async (decision: HiringDecision, notes: string) => {
    // In production, posts to `/api/v1/reviews/:attemptId/decisions`
    await new Promise(res => setTimeout(res, 800));
    setCommittedDecision(decision);
    setIsDecisionCommitted(true);
  };

  const handleScoreOverride = (newScore: number, reason: string) => {
    setFinalScore(newScore);
  };

  return (
    <div style={{ maxWidth: 1440, margin: '2rem auto', padding: '0 1.5rem' }}>
      {/* Reviewer Header Card */}
      <div className="glass-panel" style={{ padding: '1.75rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.4rem' }}>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 700 }}>{candidate.name}</h1>
              <span className="badge badge-teal">{candidate.roleTarget}</span>
              <span className="badge badge-success">Submitted</span>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              {candidate.email} • {candidate.assessmentTitle} • Finished in {candidate.durationSpentMinutes}m / {candidate.maxDurationMinutes}m
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Candidate Score</span>
              <span style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--primary-light)' }}>
                {finalScore} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>/ 100</span>
              </span>
            </div>

            <button
              className="btn btn-secondary"
              onClick={() => setShowPdfModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}
            >
              <Download size={16} /> Export PDF Report
            </button>
          </div>
        </div>
      </div>

      {/* Main Reviewer Layout: Left Column = Candidate Solutions, Right Column = Integrity & Grading */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 480px', gap: '2rem' }}>
        {/* Left Column: Solution Inspection */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            {/* Question Tab Bar */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', marginBottom: '1.25rem', gap: '0.5rem' }}>
              <button
                onClick={() => setActiveQuestionTab('q1_code')}
                style={{
                  padding: '0.5rem 1rem',
                  background: activeQuestionTab === 'q1_code' ? 'var(--bg-surface)' : 'transparent',
                  color: activeQuestionTab === 'q1_code' ? 'var(--primary-light)' : 'var(--text-muted)',
                  border: 'none',
                  borderBottom: activeQuestionTab === 'q1_code' ? '2px solid var(--primary)' : '2px solid transparent',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem'
                }}
              >
                <Code2 size={16} /> Q1: LRU Cache (Code)
              </button>

              <button
                onClick={() => setActiveQuestionTab('q2_sql')}
                style={{
                  padding: '0.5rem 1rem',
                  background: activeQuestionTab === 'q2_sql' ? 'var(--bg-surface)' : 'transparent',
                  color: activeQuestionTab === 'q2_sql' ? 'var(--primary-light)' : 'var(--text-muted)',
                  border: 'none',
                  borderBottom: activeQuestionTab === 'q2_sql' ? '2px solid var(--primary)' : '2px solid transparent',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem'
                }}
              >
                <Database size={16} /> Q2: Roll-up Query (SQL)
              </button>

              <button
                onClick={() => setActiveQuestionTab('q3_arch')}
                style={{
                  padding: '0.5rem 1rem',
                  background: activeQuestionTab === 'q3_arch' ? 'var(--bg-surface)' : 'transparent',
                  color: activeQuestionTab === 'q3_arch' ? 'var(--primary-light)' : 'var(--text-muted)',
                  border: 'none',
                  borderBottom: activeQuestionTab === 'q3_arch' ? '2px solid var(--primary)' : '2px solid transparent',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem'
                }}
              >
                <FileText size={16} /> Q3: RLS Strategy (Subjective)
              </button>
            </div>

            {/* Q1: Code Editor & Execution Output */}
            {activeQuestionTab === 'q1_code' && (
              <div>
                <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Candidate JavaScript Solution • 3/3 Automated Tests Passed (100%)
                  </span>
                  <span className="badge badge-success">3/3 Passed</span>
                </div>

                <div style={{ height: 320, borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--border-subtle)', marginBottom: '1rem' }}>
                  <Editor
                    height="320px"
                    language="javascript"
                    value={`class LRUCache {\n  constructor(capacity) {\n    this.capacity = capacity;\n    this.cache = new Map();\n  }\n\n  get(key) {\n    if (!this.cache.has(key)) return -1;\n    const val = this.cache.get(key);\n    this.cache.delete(key);\n    this.cache.set(key, val);\n    return val;\n  }\n\n  put(key, value) {\n    if (this.cache.has(key)) {\n      this.cache.delete(key);\n    } else if (this.cache.size >= this.capacity) {\n      const oldestKey = this.cache.keys().next().value;\n      this.cache.delete(oldestKey);\n    }\n    this.cache.set(key, value);\n  }\n}`}
                    theme="vs-dark"
                    options={{ readOnly: true, minimap: { enabled: false }, fontSize: 13 }}
                  />
                </div>

                <div style={{ background: 'var(--bg-deep)', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Automated Runner Evaluation Log:</div>
                  <pre style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-success)', fontFamily: 'monospace' }}>
                    [Passed] Test 1: get() on empty cache returns -1 (2ms)&#10;
                    [Passed] Test 2: put() evicts oldest item at capacity limit (3ms)&#10;
                    [Passed] Test 3: LRU order properly preserved on access (2ms)
                  </pre>
                </div>
              </div>
            )}

            {/* Q2: SQL Review */}
            {activeQuestionTab === 'q2_sql' && (
              <div>
                <div style={{ marginBottom: '1rem' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Candidate PostgreSQL Solution
                  </span>
                </div>
                <div style={{ height: 240, borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
                  <Editor
                    height="240px"
                    language="sql"
                    value={`SELECT \n  tenant_id,\n  DATE(created_at) as attempt_date,\n  COUNT(*) as completed_count\nFROM attempts\nWHERE status = 'submitted'\nGROUP BY tenant_id, DATE(created_at)\nORDER BY attempt_date DESC;`}
                    theme="vs-dark"
                    options={{ readOnly: true, minimap: { enabled: false }, fontSize: 13 }}
                  />
                </div>
              </div>
            )}

            {/* Q3: Subjective Architectural Answer */}
            {activeQuestionTab === 'q3_arch' && (
              <div style={{ background: 'var(--bg-deep)', padding: '1.25rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', lineHeight: 1.7, fontSize: '0.9rem' }}>
                <p>
                  "For high-concurrency multi-tenant SaaS, using PostgreSQL Row-Level Security (RLS) with <code>FORCE ROW LEVEL SECURITY</code> is significantly more resource-efficient than schema-per-tenant, because it prevents connection pool starvation across thousands of schemas. By setting <code>SET LOCAL app.tenant_id</code> inside a request-scoped transaction on a non-superuser connection (<code>kombee_app</code>), queries fail closed at the database kernel level even if an application SQL bug occurs."
                </p>
                <div style={{ marginTop: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Word count: 72 words • Screened clean by Content Safety
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Evidence Timeline + Rubric Grading + Decision */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <EvidenceTimeline
            events={integrityEvents}
            overallIntegrityScore={94}
            advisoryLevel="clear"
          />

          <RubricGrading
            initialRubrics={rubrics}
            onScoresChange={newWeighted => setFinalScore(newWeighted)}
            onOverrideScore={handleScoreOverride}
          />

          <DecisionAuthoring
            onCommitDecision={handleCommitDecision}
            isCommitted={isDecisionCommitted}
            committedDecision={committedDecision}
          />
        </div>
      </div>

      {/* PDF Report Preview Modal */}
      {showPdfModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            background: 'rgba(0, 0, 0, 0.8)',
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
              maxWidth: 720,
              width: '100%',
              padding: '2.5rem',
              background: '#ffffff',
              color: '#0f172a',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #029096', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#029096', margin: 0 }}>
                  Kombee Assess — Candidate Evaluation Dossier
                </h2>
                <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: 4 }}>
                  Official Audit Report • Generated {new Date().toLocaleDateString()}
                </div>
              </div>
              <button
                onClick={() => setShowPdfModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer' }}
              >
                <X size={22} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
              <div><strong>Candidate:</strong> {candidate.name} ({candidate.email})</div>
              <div><strong>Final Score:</strong> {finalScore} / 100</div>
              <div><strong>Assessment:</strong> {candidate.assessmentTitle}</div>
              <div><strong>Decision:</strong> {committedDecision ? committedDecision.toUpperCase() : 'PENDING'}</div>
            </div>

            <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: 8, marginBottom: '1.5rem', fontSize: '0.85rem', color: '#334155', border: '1px solid #e2e8f0' }}>
              <strong>The Absolute Rule Verification:</strong> This assessment was independently graded and signed off by a human evaluator. All integrity heuristics and AI detection scores served purely as advisory metadata.
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                onClick={() => window.print()}
                style={{
                  background: '#029096',
                  color: '#ffffff',
                  border: 'none',
                  padding: '0.6rem 1.25rem',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                <Printer size={16} /> Print / Save as PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
