import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export function Button({ variant = 'primary', size = 'md', style, ...props }: ButtonProps) {
  const base: React.CSSProperties = {
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: 500,
    fontFamily: "'Inter', sans-serif",
    fontSize: size === 'sm' ? '0.8125rem' : size === 'lg' ? '1rem' : '0.9375rem',
    padding: size === 'sm' ? '0.5rem 1rem' : size === 'lg' ? '0.875rem 2.5rem' : '0.75rem 2rem',
    transition: 'all 120ms ease',
  };

  const variants: Record<string, React.CSSProperties> = {
    primary: { ...base, background: 'var(--accent-warm)', color: '#ffffff' },
    secondary: { ...base, background: 'var(--surface-panel)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' },
    ghost: { ...base, background: 'none', color: 'var(--text-secondary)' },
  };

  return <button style={{ ...variants[variant], ...style }} {...props} />;
}
