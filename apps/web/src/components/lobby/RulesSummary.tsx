import React from 'react';

interface RulesSummaryProps {
  presetName?: string;
}

export function RulesSummary({ presetName = 'Riichi' }: RulesSummaryProps) {
  const rules = [
    { label: 'Variant', value: presetName },
    { label: 'Players', value: '4' },
    { label: 'Flowers', value: 'No' },
    { label: 'Min Han', value: '1' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', padding: '0.75rem', borderRadius: '8px', background: 'var(--surface-panel)' }}>
      <div style={{ fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.25rem' }}>Rules</div>
      {rules.map((r) => (
        <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
          <span style={{ color: 'var(--text-secondary)' }}>{r.label}</span>
          <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{r.value}</span>
        </div>
      ))}
    </div>
  );
}
