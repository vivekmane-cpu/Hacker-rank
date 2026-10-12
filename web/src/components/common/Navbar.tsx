import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Layers, Play, ShieldCheck, Terminal, UserCheck, LogIn, LogOut, User } from 'lucide-react';

export const Navbar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [currentTenant, setCurrentTenant] = useState<any>(null);

  const loadAuth = () => {
    try {
      const u = localStorage.getItem('kombee_user');
      const t = localStorage.getItem('kombee_tenant');
      if (u) setCurrentUser(JSON.parse(u));
      else setCurrentUser(null);
      if (t) setCurrentTenant(JSON.parse(t));
      else setCurrentTenant(null);
    } catch {
      setCurrentUser(null);
      setCurrentTenant(null);
    }
  };

  useEffect(() => {
    loadAuth();
    window.addEventListener('authChange', loadAuth);
    return () => window.removeEventListener('authChange', loadAuth);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('kombee_token');
    localStorage.removeItem('kombee_user');
    localStorage.removeItem('kombee_tenant');
    setCurrentUser(null);
    setCurrentTenant(null);
    window.dispatchEvent(new Event('authChange'));
    navigate('/login');
  };

  const navLinks = [
    { to: '/builder', label: 'Assessment Builder', icon: Layers },
    { to: '/player', label: 'Candidate Player', icon: Play },
    { to: '/review', label: 'Reviewer Dashboard', icon: UserCheck }
  ];

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'rgba(6, 9, 14, 0.85)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--border-subtle)',
        padding: '0.75rem 2rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
        <Link
          to="/"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
            textDecoration: 'none',
            color: 'inherit'
          }}
        >
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #029096 0%, #016b70 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 12px var(--primary-glow-strong)'
            }}
          >
            <Terminal size={20} color="#ffffff" />
          </div>
          <span style={{ fontSize: '1.15rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
            Kombee <span style={{ color: 'var(--primary-light)' }}>Assess</span>
          </span>
        </Link>

        <nav style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {navLinks.map(link => {
            const Icon = link.icon;
            const isActive = location.pathname.startsWith(link.to);
            return (
              <Link
                key={link.to}
                to={link.to}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  padding: '0.45rem 0.9rem',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.875rem',
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? '#ffffff' : 'var(--text-secondary)',
                  background: isActive ? 'var(--primary-faint)' : 'transparent',
                  border: isActive ? '1px solid rgba(2, 144, 150, 0.35)' : '1px solid transparent',
                  textDecoration: 'none',
                  transition: 'all var(--transition-fast)'
                }}
              >
                <Icon size={16} color={isActive ? 'var(--primary-light)' : 'var(--text-muted)'} />
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <span className="badge badge-teal" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <ShieldCheck size={14} /> Production RLS
        </span>

        {currentUser ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.35rem 0.75rem',
                background: 'var(--bg-surface-elevated)',
                borderRadius: 'var(--radius-full)',
                border: '1px solid var(--border-subtle)',
                fontSize: '0.8rem'
              }}
            >
              <User size={14} color="var(--primary-light)" />
              <span style={{ fontWeight: 600 }}>{currentUser.first_name || currentUser.email}</span>
              <span className="badge badge-info" style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem' }}>
                {currentUser.role || 'Member'}
              </span>
            </div>

            <button
              onClick={handleLogout}
              title="Sign Out"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: '0.35rem',
                borderRadius: 'var(--radius-sm)'
              }}
            >
              <LogOut size={16} />
            </button>
          </div>
        ) : (
          <Link
            to="/login"
            className="btn btn-primary"
            style={{ padding: '0.4rem 0.9rem', fontSize: '0.85rem' }}
          >
            <LogIn size={15} /> Sign In
          </Link>
        )}
      </div>
    </header>
  );
};
