import React, { useState } from 'react';
import Editor from '@monaco-editor/react';
import { Play, RotateCw, Terminal, CheckCircle2, XCircle, Database, FileCode, CheckSquare, Square, Info } from 'lucide-react';

// ==========================================
// 1. CODE QUESTION WIDGET (Monaco Editor)
// ==========================================

interface CodeQuestionWidgetProps {
  question: any;
  value: string;
  onChange: (val: string) => void;
  onRunCode?: (code: string, language: string) => Promise<{ stdout?: string; stderr?: string; testsPassed?: number; testsTotal?: number }>;
}

export const CodeQuestionWidget: React.FC<CodeQuestionWidgetProps> = ({
  question,
  value,
  onChange,
  onRunCode
}) => {
  const [language, setLanguage] = useState<string>(question.content?.language || 'javascript');
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [output, setOutput] = useState<{ stdout?: string; stderr?: string; testsPassed?: number; testsTotal?: number } | null>(null);
  const [activeTab, setActiveTab] = useState<'console' | 'tests'>('console');

  const handleRun = async () => {
    if (!onRunCode) return;
    setIsRunning(true);
    try {
      const res = await onRunCode(value, language);
      setOutput(res);
    } catch (err: any) {
      setOutput({ stderr: err.message });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '0.75rem' }}>
      {/* Editor Toolbar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'var(--bg-deep)',
          padding: '0.5rem 1rem',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-subtle)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <FileCode size={16} color="var(--primary-light)" />
          <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Solution Editor</span>
          <select
            className="form-select"
            value={language}
            onChange={e => setLanguage(e.target.value)}
            style={{ width: 'auto', padding: '0.2rem 0.6rem', fontSize: '0.8rem' }}
          >
            <option value="javascript">JavaScript (Node.js 20)</option>
            <option value="typescript">TypeScript</option>
            <option value="python">Python 3.11</option>
            <option value="sql">PostgreSQL / SQL</option>
          </select>
        </div>

        <button
          className="btn btn-primary"
          onClick={handleRun}
          disabled={isRunning}
          style={{ padding: '0.35rem 0.85rem', fontSize: '0.8rem' }}
        >
          {isRunning ? (
            <RotateCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
          ) : (
            <Play size={14} />
          )}
          {isRunning ? 'Running Tests...' : 'Run Code'}
        </button>
      </div>

      {/* Monaco Code Editor */}
      <div
        style={{
          minHeight: 380,
          borderRadius: 'var(--radius-sm)',
          overflow: 'hidden',
          border: '1px solid var(--border-subtle)'
        }}
      >
        <Editor
          height="380px"
          language={language === 'sql' ? 'sql' : language}
          value={value || question.content?.starterCode || '// Write your solution here\n'}
          theme="vs-dark"
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            tabSize: 2,
            fontFamily: 'JetBrains Mono, Menlo, monospace'
          }}
          onChange={val => onChange(val || '')}
        />
      </div>

      {/* Output Console & Test Results */}
      <div
        style={{
          background: 'var(--bg-deep)',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-subtle)',
          overflow: 'hidden'
        }}
      >
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)' }}>
          <button
            onClick={() => setActiveTab('console')}
            style={{
              padding: '0.4rem 0.9rem',
              background: activeTab === 'console' ? 'var(--bg-surface)' : 'transparent',
              color: activeTab === 'console' ? 'var(--text-main)' : 'var(--text-muted)',
              border: 'none',
              borderBottom: activeTab === 'console' ? '2px solid var(--primary)' : '2px solid transparent',
              cursor: 'pointer',
              fontSize: '0.8rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem'
            }}
          >
            <Terminal size={14} /> Terminal Console
          </button>
          <button
            onClick={() => setActiveTab('tests')}
            style={{
              padding: '0.4rem 0.9rem',
              background: activeTab === 'tests' ? 'var(--bg-surface)' : 'transparent',
              color: activeTab === 'tests' ? 'var(--text-main)' : 'var(--text-muted)',
              border: 'none',
              borderBottom: activeTab === 'tests' ? '2px solid var(--primary)' : '2px solid transparent',
              cursor: 'pointer',
              fontSize: '0.8rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem'
            }}
          >
            <CheckCircle2 size={14} /> Test Suite
          </button>
        </div>

        <div style={{ padding: '0.85rem', minHeight: 100, maxHeight: 180, overflowY: 'auto', fontFamily: 'monospace', fontSize: '0.85rem' }}>
          {activeTab === 'console' && (
            output?.stdout ? (
              <pre style={{ color: 'var(--text-main)', margin: 0, whiteSpace: 'pre-wrap' }}>{output.stdout}</pre>
            ) : output?.stderr ? (
              <pre style={{ color: 'var(--color-danger)', margin: 0, whiteSpace: 'pre-wrap' }}>{output.stderr}</pre>
            ) : (
              <span style={{ color: 'var(--text-muted)' }}>Click "Run Code" to execute tests and view stdout output...</span>
            )
          )}

          {activeTab === 'tests' && (
            output ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span className={`badge ${output.testsPassed === output.testsTotal ? 'badge-success' : 'badge-warning'}`}>
                  {output.testsPassed || 0} / {output.testsTotal || 0} Passed
                </span>
                <span style={{ color: 'var(--text-secondary)' }}>All assertions evaluated against runtime container.</span>
              </div>
            ) : (
              <span style={{ color: 'var(--text-muted)' }}>Test assertions will run when you execute code.</span>
            )
          )}
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 2. MULTIPLE CHOICE QUESTION WIDGET
// ==========================================

interface McqQuestionWidgetProps {
  question: any;
  value: string | string[];
  onChange: (val: string | string[]) => void;
}

export const McqQuestionWidget: React.FC<McqQuestionWidgetProps> = ({
  question,
  value,
  onChange
}) => {
  const isMulti = question.content?.isMultiSelect || false;
  const options = question.content?.options || [];

  const handleSelect = (optId: string) => {
    if (isMulti) {
      const current = Array.isArray(value) ? value : [];
      if (current.includes(optId)) {
        onChange(current.filter(id => id !== optId));
      } else {
        onChange([...current, optId]);
      }
    } else {
      onChange(optId);
    }
  };

  const isSelected = (optId: string) => {
    if (isMulti) {
      return Array.isArray(value) && value.includes(optId);
    }
    return value === optId;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
        {isMulti ? 'Select all options that apply (multiple choice)' : 'Select exactly one option'}
      </div>

      {options.map((opt: any, index: number) => {
        const selected = isSelected(opt.id || String(index));
        return (
          <div
            key={opt.id || index}
            onClick={() => handleSelect(opt.id || String(index))}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.85rem',
              padding: '1rem 1.25rem',
              borderRadius: 'var(--radius-md)',
              background: selected ? 'var(--primary-faint)' : 'var(--bg-surface)',
              border: `1px solid ${selected ? 'var(--primary)' : 'var(--border-subtle)'}`,
              cursor: 'pointer',
              transition: 'all var(--transition-fast)'
            }}
          >
            <div style={{ color: selected ? 'var(--primary-light)' : 'var(--text-muted)' }}>
              {isMulti ? (
                selected ? <CheckSquare size={18} /> : <Square size={18} />
              ) : (
                <div
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    border: `2px solid ${selected ? 'var(--primary-light)' : 'var(--text-muted)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  {selected && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--primary-light)' }} />}
                </div>
              )}
            </div>

            <span style={{ fontSize: '0.95rem', color: selected ? '#ffffff' : 'var(--text-main)', fontWeight: selected ? 600 : 400 }}>
              {opt.text}
            </span>
          </div>
        );
      })}
    </div>
  );
};

// ==========================================
// 3. SQL QUERY QUESTION WIDGET
// ==========================================

interface SqlQuestionWidgetProps {
  question: any;
  value: string;
  onChange: (val: string) => void;
  onExecuteSql?: (query: string) => Promise<{ rows: any[]; rowCount: number }>;
}

export const SqlQuestionWidget: React.FC<SqlQuestionWidgetProps> = ({
  question,
  value,
  onChange,
  onExecuteSql
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<{ rows: any[]; rowCount: number } | null>(null);

  const handleExecute = async () => {
    if (!onExecuteSql) return;
    setIsRunning(true);
    try {
      const res = await onExecuteSql(value);
      setResult(res);
    } catch (err: any) {
      setResult({ rows: [{ error: err.message }], rowCount: 0 });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'var(--bg-deep)',
          padding: '0.5rem 1rem',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-subtle)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Database size={16} color="var(--primary-light)" />
          <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>PostgreSQL Query Console</span>
        </div>

        <button
          className="btn btn-primary"
          onClick={handleExecute}
          disabled={isRunning}
          style={{ padding: '0.35rem 0.85rem', fontSize: '0.8rem' }}
        >
          {isRunning ? <RotateCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Play size={14} />}
          {isRunning ? 'Executing...' : 'Run Query'}
        </button>
      </div>

      <div style={{ minHeight: 220, border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
        <Editor
          height="220px"
          language="sql"
          value={value || question.content?.starterQuery || 'SELECT * FROM users;'}
          theme="vs-dark"
          options={{ minimap: { enabled: false }, fontSize: 14 }}
          onChange={val => onChange(val || '')}
        />
      </div>

      {result && (
        <div className="glass-panel" style={{ padding: '1rem', overflowX: 'auto' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
            Returned {result.rowCount} rows
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left' }}>
                {result.rows[0] && Object.keys(result.rows[0]).map(col => (
                  <th key={col} style={{ padding: '0.5rem', color: 'var(--primary-light)' }}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  {Object.values(row).map((val: any, j) => (
                    <td key={j} style={{ padding: '0.5rem', color: 'var(--text-main)' }}>{String(val)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ==========================================
// 4. SUBJECTIVE / ARCHITECTURE QUESTION WIDGET
// ==========================================

interface SubjectiveQuestionWidgetProps {
  question: any;
  value: string;
  onChange: (val: string) => void;
}

export const SubjectiveQuestionWidget: React.FC<SubjectiveQuestionWidgetProps> = ({
  question,
  value,
  onChange
}) => {
  const wordCount = value ? value.trim().split(/\s+/).filter(Boolean).length : 0;
  const minWords = question.content?.minWords || 50;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <textarea
        className="form-textarea"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Type your design, architectural rationale, and trade-off analysis here (Markdown supported)..."
        style={{ minHeight: 280, resize: 'vertical', lineHeight: 1.6 }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        <span>Markdown formatting supported</span>
        <span style={{ color: wordCount >= minWords ? 'var(--color-success)' : 'var(--color-warning)' }}>
          {wordCount} words (Recommended minimum: {minWords})
        </span>
      </div>
    </div>
  );
};
