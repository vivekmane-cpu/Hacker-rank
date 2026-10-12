import React, { useState } from 'react';
import {
  Layers,
  Plus,
  Trash2,
  Settings,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Clock,
  ArrowRight,
  Search,
  Code2,
  Database,
  Lock,
  UploadCloud,
  FileCheck,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface QuestionItem {
  id: string;
  title: string;
  type: string;
  difficulty: string;
  points: number;
}

interface PoolItem {
  id: string;
  name: string;
  selectCount: number;
  questions: QuestionItem[];
}

interface SectionItem {
  id: string;
  title: string;
  description: string;
  durationMinutes: number;
  pools: PoolItem[];
}

const SAMPLE_QUESTION_BANK: QuestionItem[] = [
  { id: 'q_bank_1', title: 'Implement Distributed Rate Limiter', type: 'code', difficulty: 'hard', points: 30 },
  { id: 'q_bank_2', title: 'Raft Consensus Protocol Mechanics', type: 'multiple_choice', difficulty: 'medium', points: 10 },
  { id: 'q_bank_3', title: 'PostgreSQL Indexing & Optimization', type: 'sql', difficulty: 'medium', points: 20 },
  { id: 'q_bank_4', title: 'Design a Resilient Notification Service', type: 'subjective', difficulty: 'hard', points: 25 },
  { id: 'q_bank_5', title: 'Two Pointer Palindrome Partitioning', type: 'code', difficulty: 'easy', points: 15 },
  { id: 'q_bank_6', title: 'GraphQL vs REST API Idempotency', type: 'multiple_choice', difficulty: 'easy', points: 10 }
];

export const AssessmentBuilderPage: React.FC = () => {
  // Assessment metadata
  const [title, setTitle] = useState('Senior Backend & Distributed Systems Assessment');
  const [description, setDescription] = useState('Production takehome evaluating concurrency, consensus, and system design.');
  const [aiPolicy, setAiPolicy] = useState<'permitted' | 'forbidden' | 'assisted_with_explanation'>('assisted_with_explanation');
  const [proctoringMode, setProctoringMode] = useState<'guarded' | 'unguarded'>('guarded');
  const [extraTimeMultiplier, setExtraTimeMultiplier] = useState<number>(1.0);

  // Sections & Pools state
  const [sections, setSections] = useState<SectionItem[]>([
    {
      id: 'sec_1',
      title: 'Distributed Systems & Architecture',
      description: 'Core concepts in data consistency and scaling',
      durationMinutes: 45,
      pools: [
        {
          id: 'pool_1',
          name: 'System Design & Algorithms',
          selectCount: 1,
          questions: [
            SAMPLE_QUESTION_BANK[0],
            SAMPLE_QUESTION_BANK[3]
          ]
        }
      ]
    },
    {
      id: 'sec_2',
      title: 'Database & SQL Engineering',
      description: 'Query planning and transactional integrity',
      durationMinutes: 30,
      pools: [
        {
          id: 'pool_2',
          name: 'SQL Practical Querying',
          selectCount: 1,
          questions: [
            SAMPLE_QUESTION_BANK[2]
          ]
        }
      ]
    }
  ]);

  // Question bank picker modal state
  const [pickerPoolId, setPickerPoolId] = useState<string | null>(null);
  const [pickerSearch, setPickerSearch] = useState('');
  const [versionStatus, setVersionStatus] = useState<'draft' | 'published'>('draft');
  const [publishedVersionNumber, setPublishedVersionNumber] = useState<number>(1);
  const [publishSuccessToast, setPublishSuccessToast] = useState(false);

  // Validation gates calculation
  const hasTitle = title.trim().length >= 5;
  const hasSections = sections.length > 0;
  const allSectionsHavePools = sections.every(s => s.pools.length > 0);
  const allPoolsHaveQuestions = sections.every(s =>
    s.pools.every(p => p.questions.length >= p.selectCount && p.questions.length > 0)
  );

  const canPublish = hasTitle && hasSections && allSectionsHavePools && allPoolsHaveQuestions && versionStatus === 'draft';

  // Section handlers
  const addSection = () => {
    const newSec: SectionItem = {
      id: `sec_${Date.now()}`,
      title: `New Section ${sections.length + 1}`,
      description: 'Section description and instructions',
      durationMinutes: 30,
      pools: [
        {
          id: `pool_${Date.now()}`,
          name: 'Default Question Pool',
          selectCount: 1,
          questions: []
        }
      ]
    };
    setSections([...sections, newSec]);
  };

  const removeSection = (secId: string) => {
    setSections(sections.filter(s => s.id !== secId));
  };

  const addPoolToSection = (secId: string) => {
    setSections(
      sections.map(s => {
        if (s.id !== secId) return s;
        return {
          ...s,
          pools: [
            ...s.pools,
            {
              id: `pool_${Date.now()}`,
              name: `Pool ${s.pools.length + 1}`,
              selectCount: 1,
              questions: []
            }
          ]
        };
      })
    );
  };

  const addQuestionToPool = (q: QuestionItem) => {
    if (!pickerPoolId) return;
    setSections(
      sections.map(s => ({
        ...s,
        pools: s.pools.map(p => {
          if (p.id !== pickerPoolId) return p;
          if (p.questions.some(item => item.id === q.id)) return p;
          return {
            ...p,
            questions: [...p.questions, q]
          };
        })
      }))
    );
    setPickerPoolId(null);
  };

  const removeQuestionFromPool = (poolId: string, qId: string) => {
    setSections(
      sections.map(s => ({
        ...s,
        pools: s.pools.map(p => {
          if (p.id !== poolId) return p;
          return {
            ...p,
            questions: p.questions.filter(q => q.id !== qId)
          };
        })
      }))
    );
  };

  const handlePublish = () => {
    if (!canPublish) return;
    setVersionStatus('published');
    setPublishSuccessToast(true);
    setTimeout(() => setPublishSuccessToast(false), 4000);
  };

  const handleCreateNewDraft = () => {
    setVersionStatus('draft');
    setPublishedVersionNumber(prev => prev + 1);
  };

  // Stats
  const totalDuration = sections.reduce((acc, s) => acc + s.durationMinutes, 0) * extraTimeMultiplier;
  const totalPoints = sections.reduce(
    (acc, s) => acc + s.pools.reduce((pAcc, p) => pAcc + p.questions.reduce((qAcc, q) => qAcc + q.points, 0), 0),
    0
  );

  return (
    <div style={{ maxWidth: 1300, margin: '2rem auto', padding: '0 1.5rem' }}>
      {/* Toast Notification */}
      {publishSuccessToast && (
        <div
          style={{
            position: 'fixed',
            top: '5rem',
            right: '2rem',
            zIndex: 100,
            background: 'var(--color-success)',
            color: '#ffffff',
            padding: '1rem 1.5rem',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem'
          }}
        >
          <CheckCircle2 size={20} />
          <div>
            <div style={{ fontWeight: 600 }}>Version {publishedVersionNumber} Published!</div>
            <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>
              This version is now immutable and live for candidate invitations.
            </div>
          </div>
        </div>
      )}

      {/* Header bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem' }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: '8px',
                background: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 12px var(--primary-glow-strong)'
              }}
            >
              <Layers size={20} color="#fff" />
            </div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700 }}>Assessment Builder</h1>
            <span className={`badge ${versionStatus === 'published' ? 'badge-success' : 'badge-warning'}`}>
              {versionStatus === 'published' ? `v${publishedVersionNumber} (Immutable)` : `v${publishedVersionNumber} (Draft)`}
            </span>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Construct modular multi-section tests, configure variant sampling pools, and enforce guarded proctoring rules.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {versionStatus === 'published' ? (
            <button className="btn btn-secondary" onClick={handleCreateNewDraft}>
              <Plus size={16} /> Create Draft Version {publishedVersionNumber + 1}
            </button>
          ) : (
            <button
              className="btn btn-primary"
              disabled={!canPublish}
              onClick={handlePublish}
              style={{ padding: '0.65rem 1.5rem' }}
            >
              <UploadCloud size={16} /> Publish Version {publishedVersionNumber}
            </button>
          )}
        </div>
      </div>

      {/* Grid: Main Builder on Left, Gates & Accommodations on Right */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '2rem' }}>
        {/* Left Column: Assessment Metadata & Section List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* Metadata Card */}
          <div className="glass-panel" style={{ padding: '1.75rem' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '1.25rem' }}>General Configuration</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>
                  Assessment Title
                </label>
                <input
                  className="form-input"
                  value={title}
                  disabled={versionStatus === 'published'}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. Senior Backend Engineer Takehome"
                />
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>
                  Description & Candidate Instructions
                </label>
                <textarea
                  className="form-textarea"
                  value={description}
                  disabled={versionStatus === 'published'}
                  onChange={e => setDescription(e.target.value)}
                  style={{ minHeight: 70 }}
                />
              </div>

              {/* Policy selector */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.5rem' }}>
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>
                    AI Policy Guard
                  </label>
                  <select
                    className="form-select"
                    value={aiPolicy}
                    disabled={versionStatus === 'published'}
                    onChange={e => setAiPolicy(e.target.value as any)}
                  >
                    <option value="assisted_with_explanation">Hybrid: AI Allowed with Explanation</option>
                    <option value="forbidden">Strict: AI Forbidden</option>
                    <option value="permitted">Open: AI Permitted Unrestricted</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>
                    Proctoring Environment
                  </label>
                  <select
                    className="form-select"
                    value={proctoringMode}
                    disabled={versionStatus === 'published'}
                    onChange={e => setProctoringMode(e.target.value as any)}
                  >
                    <option value="guarded">Guarded (Tab blur logging & copy-paste guards)</option>
                    <option value="unguarded">Unguarded (Self-paced, telemetry advisory only)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Sections List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Assessment Sections & Pools</h2>
              {versionStatus === 'draft' && (
                <button className="btn btn-secondary" onClick={addSection} style={{ padding: '0.45rem 0.9rem', fontSize: '0.85rem' }}>
                  <Plus size={15} /> Add Section
                </button>
              )}
            </div>

            {sections.map((section, sIdx) => (
              <div key={section.id} className="glass-panel" style={{ padding: '1.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                  <div style={{ flex: 1, marginRight: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <span className="badge badge-teal">Section {sIdx + 1}</span>
                      <input
                        className="form-input"
                        value={section.title}
                        disabled={versionStatus === 'published'}
                        onChange={e => {
                          const val = e.target.value;
                          setSections(sections.map(s => (s.id === section.id ? { ...s, title: val } : s)));
                        }}
                        style={{ fontWeight: 600, fontSize: '1.05rem', padding: '0.3rem 0.6rem', width: 'auto', flex: 1 }}
                      />
                    </div>
                    <input
                      className="form-input"
                      value={section.description}
                      disabled={versionStatus === 'published'}
                      onChange={e => {
                        const val = e.target.value;
                        setSections(sections.map(s => (s.id === section.id ? { ...s, description: val } : s)));
                      }}
                      placeholder="Section description"
                      style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}
                    />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem' }}>
                      <Clock size={15} color="var(--text-muted)" />
                      <input
                        type="number"
                        className="form-input"
                        value={section.durationMinutes}
                        disabled={versionStatus === 'published'}
                        onChange={e => {
                          const val = parseInt(e.target.value) || 0;
                          setSections(sections.map(s => (s.id === section.id ? { ...s, durationMinutes: val } : s)));
                        }}
                        style={{ width: 65, padding: '0.25rem 0.5rem', textAlign: 'center' }}
                      />
                      <span style={{ color: 'var(--text-muted)' }}>min</span>
                    </div>

                    {versionStatus === 'draft' && sections.length > 1 && (
                      <button
                        onClick={() => removeSection(section.id)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', padding: 4 }}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Pools within this section */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                  {section.pools.map((pool, pIdx) => (
                    <div
                      key={pool.id}
                      style={{
                        background: 'var(--bg-deep)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '1.25rem',
                        border: '1px solid var(--border-subtle)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                          <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{pool.name}</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            (Candidate receives {pool.selectCount} of {pool.questions.length} questions randomly)
                          </span>
                        </div>

                        {versionStatus === 'draft' && (
                          <button
                            className="btn btn-secondary"
                            onClick={() => setPickerPoolId(pool.id)}
                            style={{ padding: '0.3rem 0.75rem', fontSize: '0.75rem' }}
                          >
                            <Plus size={13} /> Select from Question Bank
                          </button>
                        )}
                      </div>

                      {/* Questions list in pool */}
                      {pool.questions.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                          No questions in this pool yet. Click "Select from Question Bank" to add.
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {pool.questions.map(q => (
                            <div
                              key={q.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                background: 'var(--bg-surface)',
                                padding: '0.65rem 0.85rem',
                                borderRadius: 'var(--radius-sm)',
                                border: '1px solid var(--border-subtle)'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <span className="badge badge-teal" style={{ fontSize: '0.7rem' }}>
                                  {q.type}
                                </span>
                                <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{q.title}</span>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{q.points} pts</span>
                                {versionStatus === 'draft' && (
                                  <button
                                    onClick={() => removeQuestionFromPool(pool.id, q.id)}
                                    style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}

                  {versionStatus === 'draft' && (
                    <button
                      onClick={() => addPoolToSection(section.id)}
                      style={{
                        background: 'transparent',
                        border: '1px dashed var(--border-medium)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '0.65rem',
                        color: 'var(--primary-light)',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.35rem'
                      }}
                    >
                      <Plus size={14} /> Add Question Variant Pool
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Validation Gates, Accommodations, Summary */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
          {/* Publishing Validation Gates */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileCheck size={18} color="var(--primary-light)" /> Publishing Gates
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {hasTitle ? <CheckCircle2 size={16} color="var(--color-success)" /> : <AlertCircle size={16} color="var(--color-warning)" />}
                <span style={{ color: hasTitle ? 'var(--text-main)' : 'var(--text-muted)' }}>Assessment title defined</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {hasSections ? <CheckCircle2 size={16} color="var(--color-success)" /> : <AlertCircle size={16} color="var(--color-warning)" />}
                <span style={{ color: hasSections ? 'var(--text-main)' : 'var(--text-muted)' }}>At least 1 active section</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {allSectionsHavePools ? <CheckCircle2 size={16} color="var(--color-success)" /> : <AlertCircle size={16} color="var(--color-warning)" />}
                <span style={{ color: allSectionsHavePools ? 'var(--text-main)' : 'var(--text-muted)' }}>Every section has a pool</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {allPoolsHaveQuestions ? <CheckCircle2 size={16} color="var(--color-success)" /> : <AlertCircle size={16} color="var(--color-warning)" />}
                <span style={{ color: allPoolsHaveQuestions ? 'var(--text-main)' : 'var(--text-muted)' }}>Questions meet select quota</span>
              </div>
            </div>

            <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.4rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Total Test Duration:</span>
                <strong>{totalDuration} mins</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Total Max Score:</span>
                <strong>{totalPoints} pts</strong>
              </div>
            </div>
          </div>

          {/* Candidate Accommodations Engine */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Sparkles size={18} color="var(--primary-light)" /> Candidate Accommodations
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Apply individual candidate accessibility multipliers without modifying published version schemas.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Time Multiplier Accommodation
              </label>
              <select
                className="form-select"
                value={extraTimeMultiplier}
                onChange={e => setExtraTimeMultiplier(parseFloat(e.target.value))}
              >
                <option value={1.0}>Standard (1.0x - {totalDuration / extraTimeMultiplier} mins)</option>
                <option value={1.5}>Extended Time (1.5x - {(totalDuration / extraTimeMultiplier) * 1.5} mins)</option>
                <option value={2.0}>Double Time (2.0x - {(totalDuration / extraTimeMultiplier) * 2.0} mins)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Question Bank Picker Modal */}
      {pickerPoolId && (
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
            padding: '1.5rem'
          }}
        >
          <div
            className="glass-panel"
            style={{
              maxWidth: 720,
              width: '100%',
              padding: '2rem',
              background: 'var(--bg-surface-elevated)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Select from Question Bank</h2>
              <button
                className="btn btn-secondary"
                onClick={() => setPickerPoolId(null)}
                style={{ padding: '0.3rem 0.6rem' }}
              >
                Close
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <Search size={18} color="var(--text-muted)" />
              <input
                className="form-input"
                placeholder="Search by title, topic, or keyword..."
                value={pickerSearch}
                onChange={e => setPickerSearch(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', maxHeight: 380, overflowY: 'auto' }}>
              {SAMPLE_QUESTION_BANK.filter(q => q.title.toLowerCase().includes(pickerSearch.toLowerCase())).map(q => (
                <div
                  key={q.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.85rem 1rem',
                    background: 'var(--bg-deep)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.2rem' }}>{q.title}</div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <span className="badge badge-teal" style={{ fontSize: '0.7rem' }}>{q.type}</span>
                      <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>{q.difficulty}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{q.points} pts</span>
                    </div>
                  </div>

                  <button
                    className="btn btn-primary"
                    onClick={() => addQuestionToPool(q)}
                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                  >
                    Add to Pool
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
