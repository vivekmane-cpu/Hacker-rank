import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Terminal, Lock, Mail, ArrowRight, ShieldCheck, UserCheck, Briefcase, Crown, AlertCircle } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('owner@acme.com');
  const [password, setPassword] = useState('Password123!');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const demoAccounts = [
    { role: 'Tenant Owner', email: 'owner@acme.com', icon: Crown, desc: 'Full tenant admin, API keys & billing' },
    { role: 'Recruiter', email: 'recruiter@acme.com', icon: Briefcase, desc: 'Assessments, candidate invites & pools' },
    { role: 'Reviewer', email: 'reviewer@acme.com', icon: UserCheck, desc: 'Evidence review, rubrics & Absolute Rule' },
    { role: 'Platform Admin', email: 'admin@kombee.io', icon: ShieldCheck, desc: 'Global cross-tenant administration' }
  ];

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const response = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error?.message || 'Authentication failed. Please verify credentials.');
      }

      // Store session data in localStorage
      localStorage.setItem('kombee_token', data.token);
      localStorage.setItem('kombee_user', JSON.stringify(data.user));
      localStorage.setItem('kombee_tenant', JSON.stringify(data.tenant));

      // Trigger storage event so navbar updates immediately
      window.dispatchEvent(new Event('authChange'));

      // Route based on role
      if (data.user.role === 'Reviewer') {
        navigate('/review');
      } else {
        navigate('/builder');
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const selectDemoAccount = (accEmail: string) => {
    setEmail(accEmail);
    setPassword('Password123!');
    setErrorMsg(null);
  };

  return (
    <div style={{ maxWidth: 960, margin: '3rem auto', padding: '0 1.5rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #029096 0%, #016b70 100%)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 16px var(--primary-glow-strong)',
            marginBottom: '1rem'
          }}
        >
          <Terminal size={26} color="#ffffff" />
        </div>
        <h1 style={{ fontSize: '2.2rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '0.4rem' }}>
          Sign in to Kombee Assess
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          Multi-tenant technical interview, assessment builder & candidate verification platform
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', alignItems: 'start' }}>
        {/* Credentials Form */}
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '1.25rem' }}>Account Credentials</h2>

          {errorMsg && (
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.75rem 1rem',
                color: 'var(--color-danger)',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginBottom: '1.25rem'
              }}
            >
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>
                Email Address
              </label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: 12 }} />
                <input
                  type="email"
                  className="form-input"
                  style={{ paddingLeft: '2.25rem' }}
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="user@example.com"
                  required
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: 12 }} />
                <input
                  type="password"
                  className="form-input"
                  style={{ paddingLeft: '2.25rem' }}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={isLoading}
              style={{ marginTop: '0.5rem', padding: '0.75rem', fontSize: '0.95rem', fontWeight: 600 }}
            >
              {isLoading ? 'Authenticating...' : 'Sign In with Email'}
              <ArrowRight size={16} />
            </button>
          </form>

          <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Protected by Row-Level Security & fail-closed isolation context
          </div>
        </div>

        {/* Demo Fast-Login Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            Or select a pre-seeded demo role:
          </div>

          {demoAccounts.map(acc => {
            const Icon = acc.icon;
            const isSelected = email === acc.email;
            return (
              <div
                key={acc.email}
                onClick={() => selectDemoAccount(acc.email)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  padding: '1rem 1.25rem',
                  borderRadius: 'var(--radius-md)',
                  background: isSelected ? 'var(--primary-faint)' : 'var(--bg-surface)',
                  border: `1px solid ${isSelected ? 'var(--primary)' : 'var(--border-subtle)'}`,
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)'
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '8px',
                    background: isSelected ? 'var(--primary)' : 'var(--bg-deep)',
                    color: isSelected ? '#ffffff' : 'var(--primary-light)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Icon size={18} />
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: '0.9rem', color: isSelected ? '#ffffff' : 'var(--text-main)' }}>
                      {acc.role}
                    </strong>
                    <code style={{ fontSize: '0.75rem', color: 'var(--primary-light)' }}>
                      {acc.email}
                    </code>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                    {acc.desc}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
