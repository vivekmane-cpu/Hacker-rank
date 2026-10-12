import React, { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { ConsentScreen } from '../components/player/ConsentScreen';
import { TimerBar } from '../components/player/TimerBar';
import {
  CodeQuestionWidget,
  McqQuestionWidget,
  SqlQuestionWidget,
  SubjectiveQuestionWidget
} from '../components/player/QuestionWidgets';
import { ReconnectionToast } from '../components/player/ReconnectionToast';
import { SubmitDialog } from '../components/player/SubmitDialog';
import { CandidateSupportModal } from '../components/player/CandidateSupportModal';
import { SecureModeWarningModal } from '../components/player/SecureModeWarningModal';
import { CandidatePrivacyCenterModal } from '../components/player/CandidatePrivacyCenterModal';
import { ChevronLeft, ChevronRight, CheckCircle2, ShieldAlert, Sparkles, BookOpen } from 'lucide-react';

interface AssessmentQuestion {
  id: string;
  type: 'code' | 'multiple_choice' | 'sql' | 'subjective';
  title: string;
  description: string;
  points: number;
  content: Record<string, any>;
}

interface AssessmentSection {
  id: string;
  title: string;
  questions: AssessmentQuestion[];
}

interface DemoAssessment {
  title: string;
  durationMinutes: number;
  aiPolicy: 'assisted_with_explanation' | 'permitted' | 'forbidden';
  candidateName: string;
  sections: AssessmentSection[];
}

// Sample demonstration assessment if opened without token
const DEMO_ASSESSMENT: DemoAssessment = {
  title: 'Fullstack Platform Engineering Assessment',
  durationMinutes: 45,
  aiPolicy: 'assisted_with_explanation',
  candidateName: 'Elena Rostova',
  sections: [
    {
      id: 'sec_1',
      title: 'Systems & Data Structures',
      questions: [
        {
          id: 'q_1',
          type: 'code',
          title: 'Implement LRU Cache with O(1) Operations',
          description: 'Design and implement a data structure for a Least Recently Used (LRU) cache supporting get(key) and put(key, value) in O(1) average time complexity.',
          points: 25,
          content: {
            language: 'javascript',
            starterCode: `/**\n * LRU Cache implementation\n */\nclass LRUCache {\n  constructor(capacity) {\n    this.capacity = capacity;\n    this.cache = new Map();\n  }\n\n  get(key) {\n    if (!this.cache.has(key)) return -1;\n    const val = this.cache.get(key);\n    this.cache.delete(key);\n    this.cache.set(key, val);\n    return val;\n  }\n\n  put(key, value) {\n    if (this.cache.has(key)) {\n      this.cache.delete(key);\n    } else if (this.cache.size >= this.capacity) {\n      const oldestKey = this.cache.keys().next().value;\n      this.cache.delete(oldestKey);\n    }\n    this.cache.set(key, value);\n  }\n}\n`
          }
        },
        {
          id: 'q_2',
          type: 'multiple_choice',
          title: 'Distributed Consensus & Raft Protocol',
          description: 'In the Raft consensus protocol, what happens when a follower server receives an AppendEntries RPC with a term number lower than its own current term?',
          points: 10,
          content: {
            isMultiSelect: false,
            options: [
              { id: '1', text: 'It accepts the entry and immediately updates its term to match.' },
              { id: '2', text: 'It immediately steps down and initiates a new leader election.' },
              { id: '3', text: 'It rejects the AppendEntries RPC and returns its current term.' },
              { id: '4', text: 'It buffers the RPC and waits for the next election timeout.' }
            ]
          }
        }
      ]
    },
    {
      id: 'sec_2',
      title: 'Database & SQL Architecture',
      questions: [
        {
          id: 'q_3',
          type: 'sql',
          title: 'Tenant Aggregated Roll-up Query',
          description: 'Write a SQL query to calculate the daily count of completed assessment attempts per tenant over the last 30 days.',
          points: 15,
          content: {
            starterQuery: `SELECT \n  tenant_id,\n  DATE(created_at) as attempt_date,\n  COUNT(*) as completed_count\nFROM attempts\nWHERE status = 'submitted'\nGROUP BY tenant_id, DATE(created_at)\nORDER BY attempt_date DESC;`
          }
        },
        {
          id: 'q_4',
          type: 'subjective',
          title: 'Multi-Tenant PostgreSQL Row-Level Security Strategy',
          description: 'Explain the security implications of using PostgreSQL Row-Level Security (FORCE ROW LEVEL SECURITY) versus schema-per-tenant isolation for a high-concurrency SaaS platform. Discuss connection pooling trade-offs.',
          points: 20,
          content: {
            minWords: 30
          }
        }
      ]
    }
  ]
};

export const CandidatePlayerPage: React.FC = () => {
  const { token } = useParams<{ token?: string }>();
  const [searchParams] = useSearchParams();
  const rawToken = token || searchParams.get('token') || 'demo_token';

  // Session Stages: 'consent' | 'runtime' | 'submitted'
  const [stage, setStage] = useState<'consent' | 'runtime' | 'submitted'>('consent');
  const [currentSectionIdx, setCurrentSectionIdx] = useState(0);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [remainingSeconds, setRemainingSeconds] = useState(DEMO_ASSESSMENT.durationMinutes * 60);
  const [autosaveStatus, setAutosaveStatus] = useState<'saved' | 'saving' | 'error' | 'offline'>('saved');
  const [isOnline, setIsOnline] = useState(true);
  const [retryCountdown, setRetryCountdown] = useState(5);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [blurCount, setBlurCount] = useState(0);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showSecureWarning, setShowSecureWarning] = useState(false);
  const [secureWarningCount, setSecureWarningCount] = useState(0);
  const [isSecureMode] = useState(true);

  // Flattened questions list
  const currentSection = DEMO_ASSESSMENT.sections[currentSectionIdx];
  const allQuestions = DEMO_ASSESSMENT.sections.flatMap(s => s.questions);
  const currentQuestion = currentSection.questions[currentQuestionIdx];

  // Global countdown timer
  useEffect(() => {
    if (stage !== 'runtime') return;

    const timer = setInterval(() => {
      setRemainingSeconds(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setStage('submitted');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [stage]);

  // Secure Mode enforcement: Fullscreen exit & Window blur telemetry listener (FR-INT-04)
  useEffect(() => {
    if (stage !== 'runtime' || !isSecureMode) return;

    const handleBlur = () => {
      setBlurCount(prev => prev + 1);
      setSecureWarningCount(prev => prev + 1);
      setShowSecureWarning(true);
    };

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setSecureWarningCount(prev => prev + 1);
        setShowSecureWarning(true);
      }
    };

    window.addEventListener('blur', handleBlur);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [stage, isSecureMode]);

  const handleStartRuntime = () => {
    setStage('runtime');
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {
        // User gesture constraints or permission restrictions handled gracefully
      });
    }
  };

  const handleReEnterFullscreen = () => {
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
    setShowSecureWarning(false);
  };

  // Autosave simulator
  const handleAnswerChange = (qId: string, value: any) => {
    setAnswers(prev => ({ ...prev, [qId]: value }));
    setAutosaveStatus('saving');
    setTimeout(() => {
      setAutosaveStatus('saved');
    }, 600);
  };

  // Mock code runner for interactive sandbox test
  const handleRunCode = async (code: string, language: string) => {
    await new Promise(res => setTimeout(res, 900));
    return {
      stdout: `[Runtime] Executing test suite against Node.js 20 VM...\n✔ Test Case 1: get() on empty cache returns -1 (Passed, 2ms)\n✔ Test Case 2: put() evicts oldest item at capacity limit (Passed, 3ms)\n✔ Test Case 3: LRU order properly preserved on access (Passed, 2ms)\nAll assertions succeeded!`,
      testsPassed: 3,
      testsTotal: 3
    };
  };

  const handleExecuteSql = async (query: string) => {
    await new Promise(res => setTimeout(res, 700));
    return {
      rowCount: 3,
      rows: [
        { tenant_id: 'acme_corp', attempt_date: '2026-10-10', completed_count: 14 },
        { tenant_id: 'acme_corp', attempt_date: '2026-10-09', completed_count: 22 },
        { tenant_id: 'acme_corp', attempt_date: '2026-10-08', completed_count: 9 }
      ]
    };
  };

  const unansweredCount = allQuestions.filter(q => !answers[q.id]).length;

  const handleConfirmSubmit = async () => {
    setIsSubmitting(true);
    await new Promise(res => setTimeout(res, 1200));
    setIsSubmitting(false);
    setShowSubmitModal(false);
    setStage('submitted');
  };

  if (stage === 'consent') {
    return (
      <ConsentScreen
        assessmentTitle={DEMO_ASSESSMENT.title}
        durationMinutes={DEMO_ASSESSMENT.durationMinutes}
        aiPolicy={DEMO_ASSESSMENT.aiPolicy}
        candidateName={DEMO_ASSESSMENT.candidateName}
        onConsentAccepted={handleStartRuntime}
      />
    );
  }

  if (stage === 'submitted') {
    return (
      <div style={{ maxWidth: 640, margin: '4rem auto', padding: '0 1rem', textAlign: 'center' }}>
        <div className="glass-panel" style={{ padding: '3rem 2rem' }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: 'rgba(16, 185, 129, 0.15)',
              color: 'var(--color-success)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1.5rem'
            }}
          >
            <CheckCircle2 size={36} />
          </div>

          <h1 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: '0.5rem' }}>
            Assessment Successfully Submitted!
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '2rem' }}>
            Thank you, <strong>{DEMO_ASSESSMENT.candidateName}</strong>. Your solutions, code runs, and responses have been securely recorded. The hiring team has been notified for human review.
          </p>

          <div
            style={{
              background: 'var(--bg-deep)',
              borderRadius: 'var(--radius-md)',
              padding: '1.25rem',
              textAlign: 'left',
              border: '1px solid var(--border-subtle)',
              marginBottom: '2rem'
            }}
          >
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Submission Receipt</div>
            <div style={{ fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
              <span>Total Questions Answered:</span>
              <strong>{allQuestions.length - unansweredCount} / {allQuestions.length}</strong>
            </div>
            <div style={{ fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
              <span>Focus Status:</span>
              <span>{blurCount === 0 ? 'Optimal (0 blur events)' : `${blurCount} window blur events recorded`}</span>
            </div>
            <div style={{ fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between' }}>
              <span>Submission Timestamp:</span>
              <span>{new Date().toLocaleTimeString()}</span>
            </div>
          </div>

          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            You may now safely close this browser window.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Sticky Header Bar */}
      <TimerBar
        remainingSeconds={remainingSeconds}
        totalSeconds={DEMO_ASSESSMENT.durationMinutes * 60}
        currentSectionTitle={currentSection.title}
        currentQuestionIndex={currentQuestionIdx}
        totalQuestions={currentSection.questions.length}
        autosaveStatus={autosaveStatus}
        isOnline={isOnline}
        isSecureMode={isSecureMode}
        onSupportClick={() => setShowSupportModal(true)}
        onPrivacyClick={() => setShowPrivacyModal(true)}
        onSubmitClick={() => setShowSubmitModal(true)}
      />

      {/* Main Workspace Layout */}
      <div style={{ flex: 1, display: 'flex', maxWidth: 1440, width: '100%', margin: '0 auto', padding: '1.25rem', gap: '1.25rem' }}>
        {/* Left: Section Navigator & Question Meta */}
        <aside style={{ width: 340, display: 'flex', flexDirection: 'column', gap: '1rem', flexShrink: 0 }}>
          {/* Section Selector */}
          <div className="glass-panel" style={{ padding: '1rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.65rem' }}>
              Assessment Sections
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {DEMO_ASSESSMENT.sections.map((sec, idx) => (
                <button
                  key={sec.id}
                  onClick={() => {
                    setCurrentSectionIdx(idx);
                    setCurrentQuestionIdx(0);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.6rem 0.85rem',
                    borderRadius: 'var(--radius-sm)',
                    background: currentSectionIdx === idx ? 'var(--primary-faint)' : 'transparent',
                    border: currentSectionIdx === idx ? '1px solid var(--primary)' : '1px solid transparent',
                    color: currentSectionIdx === idx ? 'var(--text-main)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontSize: '0.85rem',
                    fontWeight: currentSectionIdx === idx ? 600 : 400
                  }}
                >
                  <span>{sec.title}</span>
                  <span className="badge badge-teal" style={{ fontSize: '0.7rem' }}>
                    {sec.questions.length} Qs
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Question List within Section */}
          <div className="glass-panel" style={{ padding: '1rem', flex: 1 }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.65rem' }}>
              Questions in Section
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {currentSection.questions.map((q, idx) => {
                const isAnswered = !!answers[q.id];
                const isCurrent = currentQuestionIdx === idx;
                return (
                  <button
                    key={q.id}
                    onClick={() => setCurrentQuestionIdx(idx)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.65rem',
                      padding: '0.65rem 0.85rem',
                      borderRadius: 'var(--radius-sm)',
                      background: isCurrent ? 'var(--bg-surface-elevated)' : 'transparent',
                      border: isCurrent ? '1px solid var(--border-medium)' : '1px solid transparent',
                      color: isCurrent ? '#ffffff' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontSize: '0.85rem'
                    }}
                  >
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: isAnswered ? 'var(--color-success)' : 'var(--text-muted)'
                      }}
                    />
                    <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {idx + 1}. {q.title}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {q.points} pts
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        {/* Center / Right: Question Content & Interactive Widget */}
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Question Header & Prompt Card */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
              <div>
                <span className="badge badge-teal" style={{ marginBottom: '0.4rem' }}>
                  {currentQuestion.type.toUpperCase()} • {currentQuestion.points} Points
                </span>
                <h2 style={{ fontSize: '1.35rem', fontWeight: 600 }}>{currentQuestion.title}</h2>
              </div>
            </div>

            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6 }}>
              {currentQuestion.description}
            </p>
          </div>

          {/* Interactive Widget Surface */}
          <div className="glass-panel" style={{ padding: '1.5rem', flex: 1 }}>
            {currentQuestion.type === 'code' && (
              <CodeQuestionWidget
                question={currentQuestion}
                value={answers[currentQuestion.id] || ''}
                onChange={val => handleAnswerChange(currentQuestion.id, val)}
                onRunCode={handleRunCode}
              />
            )}

            {currentQuestion.type === 'multiple_choice' && (
              <McqQuestionWidget
                question={currentQuestion}
                value={answers[currentQuestion.id] || ''}
                onChange={val => handleAnswerChange(currentQuestion.id, val)}
              />
            )}

            {currentQuestion.type === 'sql' && (
              <SqlQuestionWidget
                question={currentQuestion}
                value={answers[currentQuestion.id] || ''}
                onChange={val => handleAnswerChange(currentQuestion.id, val)}
                onExecuteSql={handleExecuteSql}
              />
            )}

            {currentQuestion.type === 'subjective' && (
              <SubjectiveQuestionWidget
                question={currentQuestion}
                value={answers[currentQuestion.id] || ''}
                onChange={val => handleAnswerChange(currentQuestion.id, val)}
              />
            )}
          </div>

          {/* Bottom Pagination Controls */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              className="btn btn-secondary"
              disabled={currentQuestionIdx === 0 && currentSectionIdx === 0}
              onClick={() => {
                if (currentQuestionIdx > 0) {
                  setCurrentQuestionIdx(currentQuestionIdx - 1);
                } else if (currentSectionIdx > 0) {
                  setCurrentSectionIdx(currentSectionIdx - 1);
                  setCurrentQuestionIdx(DEMO_ASSESSMENT.sections[currentSectionIdx - 1].questions.length - 1);
                }
              }}
            >
              <ChevronLeft size={16} /> Previous
            </button>

            <button
              className="btn btn-primary"
              onClick={() => {
                if (currentQuestionIdx < currentSection.questions.length - 1) {
                  setCurrentQuestionIdx(currentQuestionIdx + 1);
                } else if (currentSectionIdx < DEMO_ASSESSMENT.sections.length - 1) {
                  setCurrentSectionIdx(currentSectionIdx + 1);
                  setCurrentQuestionIdx(0);
                } else {
                  setShowSubmitModal(true);
                }
              }}
            >
              {currentQuestionIdx === currentSection.questions.length - 1 && currentSectionIdx === DEMO_ASSESSMENT.sections.length - 1
                ? 'Review & Submit'
                : 'Next Question'}
              <ChevronRight size={16} />
            </button>
          </div>
        </main>
      </div>

      {/* Offline Toast */}
      <ReconnectionToast
        isOffline={!isOnline}
        retryCountdown={retryCountdown}
        onManualRetry={() => setIsOnline(true)}
      />

      {/* Submit Confirmation Modal */}
      <SubmitDialog
        isOpen={showSubmitModal}
        unansweredCount={unansweredCount}
        totalQuestions={allQuestions.length}
        onClose={() => setShowSubmitModal(false)}
        onConfirmSubmit={handleConfirmSubmit}
        isSubmitting={isSubmitting}
      />

      {/* Candidate Support Modal (FR-CX-06) */}
      <CandidateSupportModal
        isOpen={showSupportModal}
        onClose={() => setShowSupportModal(false)}
        attemptId={rawToken}
        candidateEmail="elena.rostova@example.com"
      />

      {/* Secure Mode Fullscreen Warning Modal (FR-INT-04) */}
      <SecureModeWarningModal
        isOpen={showSecureWarning}
        warningCount={secureWarningCount}
        onReEnterFullscreen={handleReEnterFullscreen}
      />

      {/* Candidate Privacy & GDPR Rights Modal (FR-CX-07) */}
      <CandidatePrivacyCenterModal
        isOpen={showPrivacyModal}
        onClose={() => setShowPrivacyModal(false)}
        candidateEmail="elena.rostova@example.com"
      />
    </div>
  );
};
