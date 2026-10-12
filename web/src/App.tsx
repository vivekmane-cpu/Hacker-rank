import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { Navbar } from './components/common/Navbar';
import { CandidatePlayerPage } from './pages/CandidatePlayerPage';
import { AssessmentBuilderPage } from './pages/AssessmentBuilderPage';
import { ReviewerDashboardPage } from './pages/ReviewerDashboardPage';
import { LoginPage } from './pages/LoginPage';
import { Terminal, Layers, Play, ArrowRight, ShieldCheck, Cpu, Code2, UserCheck } from 'lucide-react';
import './styles/design-tokens.css';

const HomePage: React.FC = () => {
  return (
    <div style={{ maxWidth: 1100, margin: '3rem auto', padding: '0 1.5rem', textAlign: 'center' }}>
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.35rem 0.85rem',
          borderRadius: 'var(--radius-full)',
          background: 'var(--primary-faint)',
          border: '1px solid rgba(2, 144, 150, 0.3)',
          color: 'var(--primary-light)',
          fontSize: '0.8rem',
          fontWeight: 600,
          marginBottom: '1.5rem'
        }}
      >
        <ShieldCheck size={14} /> Production Multi-Tenant Technical Assessment SaaS
      </div>

      <h1
        style={{
          fontSize: '3.25rem',
          fontWeight: 800,
          letterSpacing: '-0.03em',
          lineHeight: 1.15,
          marginBottom: '1.25rem'
        }}
      >
        Enterprise Skills, Takehomes &<br />
        <span style={{ color: 'var(--primary-light)', textShadow: '0 0 24px var(--primary-glow-strong)' }}>
          Technical Assessment Engine
        </span>
      </h1>

      <p
        style={{
          fontSize: '1.15rem',
          color: 'var(--text-secondary)',
          maxWidth: 680,
          margin: '0 auto 2.5rem',
          lineHeight: 1.6
        }}
      >
        Curated question taxonomies, multi-section pool variant sampling, sandboxed runtime code execution, and tamper-resistant candidate player.
      </p>

      {/* Main Action Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', textAlign: 'left' }}>
        <Link
          to="/player"
          className="glass-panel"
          style={{
            padding: '2rem',
            textDecoration: 'none',
            color: 'inherit',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #029096, #016b70)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1.25rem',
                boxShadow: '0 0 16px var(--primary-glow)'
              }}
            >
              <Play size={22} color="#ffffff" />
            </div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '0.5rem' }}>Candidate Player</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.5 }}>
              Live server countdown timer, autosave, Monaco editor, test runner, and tab telemetry.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--primary-light)', fontWeight: 600, marginTop: '1.5rem', fontSize: '0.85rem' }}>
            Launch Player <ArrowRight size={15} />
          </div>
        </Link>

        <Link
          to="/builder"
          className="glass-panel"
          style={{
            padding: '2rem',
            textDecoration: 'none',
            color: 'inherit',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: '10px',
                background: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-medium)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1.25rem'
              }}
            >
              <Layers size={22} color="var(--primary-light)" />
            </div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '0.5rem' }}>Assessment Builder</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.5 }}>
              Sections, pool variant sampling, accommodations, guarded policies, and immutable versions.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--primary-light)', fontWeight: 600, marginTop: '1.5rem', fontSize: '0.85rem' }}>
            Open Builder <ArrowRight size={15} />
          </div>
        </Link>

        <Link
          to="/review"
          className="glass-panel"
          style={{
            padding: '2rem',
            textDecoration: 'none',
            color: 'inherit',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: '10px',
                background: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-medium)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1.25rem'
              }}
            >
              <UserCheck size={22} color="var(--primary-light)" />
            </div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '0.5rem' }}>Reviewer Dashboard</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.5 }}>
              Evidence timeline, rubric sliders, score override, Absolute Rule decisions, and PDF export.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--primary-light)', fontWeight: 600, marginTop: '1.5rem', fontSize: '0.85rem' }}>
            Inspect Candidate <ArrowRight size={15} />
          </div>
        </Link>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <BrowserRouter>
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Navbar />
        <main style={{ flex: 1 }}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/builder" element={<AssessmentBuilderPage />} />
            <Route path="/player" element={<CandidatePlayerPage />} />
            <Route path="/player/:token" element={<CandidatePlayerPage />} />
            <Route path="/review" element={<ReviewerDashboardPage />} />
            <Route path="/review/:attemptId" element={<ReviewerDashboardPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
