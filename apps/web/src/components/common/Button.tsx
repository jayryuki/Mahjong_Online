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
    fontWeight: 600,
    fontFamily: "'Inter', sans-serif",
    fontSize: size === 'sm' ? '0.9375rem' : size === 'lg' ? '1.0625rem' : '1rem',
    padding: size === 'sm' ? '0.625rem 1.25rem' : size === 'lg' ? '1rem 2.75rem' : '0.875rem 2.25rem',
    transition: 'all 120ms ease',
  };

  const variants: Record<string, React.CSSProperties> = {
    primary: { ...base, background: 'var(--accent-warm)', color: '#ffffff' },
    secondary: { ...base, background: 'var(--surface-panel)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' },
    ghost: { ...base, background: 'none', color: 'var(--text-secondary)' },
  };

  return <button style={{ ...variants[variant], ...style }} {...props} />;
}
