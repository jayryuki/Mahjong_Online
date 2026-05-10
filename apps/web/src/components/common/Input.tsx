import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function Input({ label, style, ...props }: InputProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
      {label && <label style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-secondary)' }}>{label}</label>}
      <input
        style={{
          padding: '0.75rem 1rem',
          borderRadius: '8px',
          border: '1px solid var(--border-subtle)',
          background: 'var(--surface-panel)',
          color: 'var(--text-primary)',
          fontSize: '0.9375rem',
          fontFamily: "'Inter', sans-serif",
          outline: 'none',
          transition: 'border-color 120ms ease',
          ...style,
        }}
        onFocus={(e) => { e.currentTarget.style.boxShadow = 'var(--focus-ring)'; }}
        onBlur={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
        {...props}
      />
    </div>
  );
}
