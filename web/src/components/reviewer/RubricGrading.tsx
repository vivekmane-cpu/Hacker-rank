import React, { useState } from 'react';
import { Sliders, Edit3, Check, AlertCircle, RefreshCw } from 'lucide-react';

interface RubricItem {
  id: string;
  name: string;
  description: string;
  weight: number;
  score: number; // 0 - 100
}

interface RubricGradingProps {
  initialRubrics: RubricItem[];
  onScoresChange: (totalWeightedScore: number, rubrics: RubricItem[]) => void;
  onOverrideScore: (newScore: number, reason: string) => void;
}

export const RubricGrading: React.FC<RubricGradingProps> = ({
  initialRubrics,
  onScoresChange,
  onOverrideScore
}) => {
  const [rubrics, setRubrics] = useState<RubricItem[]>(initialRubrics);
  const [isOverrideMode, setIsOverrideMode] = useState(false);
  const [overrideScore, setOverrideScore] = useState<number>(85);
  const [overrideReason, setOverrideReason] = useState<string>('');
  const [isOverrideApplied, setIsOverrideApplied] = useState(false);

  // Compute weighted score
  const totalWeight = rubrics.reduce((acc, r) => acc + r.weight, 0);
  const weightedScore = Math.round(
    rubrics.reduce((acc, r) => acc + (r.score * r.weight) / totalWeight, 0)
  );

  const handleSliderChange = (id: string, newScore: number) => {
    const updated = rubrics.map(r => (r.id === id ? { ...r, score: newScore } : r));
    setRubrics(updated);
    const newTotal = Math.round(
      updated.reduce((acc, r) => acc + (r.score * r.weight) / totalWeight, 0)
    );
    onScoresChange(newTotal, updated);
  };

  const handleApplyOverride = () => {
    if (!overrideReason.trim()) return;
    setIsOverrideApplied(true);
    onOverrideScore(overrideScore, overrideReason);
  };

  return (
    <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Sliders size={18} color="var(--primary-light)" />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Rubric Evaluation & Scoring</h3>
        </div>

        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Weighted Score</span>
          <span
            style={{
              fontSize: '1.4rem',
              fontWeight: 700,
              color: isOverrideApplied ? 'var(--color-warning)' : 'var(--primary-light)'
            }}
          >
            {isOverrideApplied ? overrideScore : weightedScore} / 100
          </span>
          {isOverrideApplied && (
            <span style={{ fontSize: '0.7rem', color: 'var(--color-warning)', display: 'block' }}>
              (Manual Override Applied)
            </span>
          )}
        </div>
      </div>

      {/* Sliders List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {rubrics.map(item => (
          <div
            key={item.id}
            style={{
              background: 'var(--bg-deep)',
              borderRadius: 'var(--radius-sm)',
              padding: '0.85rem 1rem',
              border: '1px solid var(--border-subtle)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', fontSize: '0.85rem' }}>
              <div>
                <strong>{item.name}</strong>{' '}
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>({item.weight}% weight)</span>
              </div>
              <strong style={{ color: 'var(--primary-light)' }}>{item.score}%</strong>
            </div>

            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.65rem' }}>
              {item.description}
            </p>

            <input
              type="range"
              min="0"
              max="100"
              value={item.score}
              disabled={isOverrideApplied}
              onChange={e => handleSliderChange(item.id, parseInt(e.target.value))}
              style={{
                width: '100%',
                accentColor: 'var(--primary)',
                cursor: isOverrideApplied ? 'not-allowed' : 'pointer'
              }}
            />
          </div>
        ))}
      </div>

      {/* Manual Override Action & Form */}
      <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
        {!isOverrideMode ? (
          <button
            className="btn btn-secondary"
            onClick={() => setIsOverrideMode(true)}
            style={{ width: '100%', padding: '0.45rem', fontSize: '0.8rem' }}
          >
            <Edit3 size={14} /> Apply Score Override
          </button>
        ) : (
          <div
            style={{
              background: 'var(--bg-surface-elevated)',
              borderRadius: 'var(--radius-sm)',
              padding: '1rem',
              border: '1px solid var(--border-medium)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Manual Score Override</span>
              <button
                onClick={() => {
                  setIsOverrideMode(false);
                  setIsOverrideApplied(false);
                }}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.75rem' }}
              >
                Reset to Rubric
              </button>
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>
                Adjusted Score (0-100)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                className="form-input"
                value={overrideScore}
                onChange={e => setOverrideScore(parseInt(e.target.value) || 0)}
                style={{ width: 100 }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>
                Required Justification Reason (Audit Logged)
              </label>
              <textarea
                className="form-textarea"
                placeholder="Explain why the algorithmic score was overridden (e.g. exceptionally elegant alternative data structure)..."
                value={overrideReason}
                onChange={e => setOverrideReason(e.target.value)}
                style={{ minHeight: 60, fontSize: '0.8rem' }}
              />
            </div>

            <button
              className="btn btn-primary"
              onClick={handleApplyOverride}
              disabled={!overrideReason.trim()}
              style={{ padding: '0.45rem', fontSize: '0.8rem' }}
            >
              <Check size={14} /> Commit Score Override
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
