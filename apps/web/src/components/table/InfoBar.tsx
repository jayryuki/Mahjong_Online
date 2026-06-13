import { useScale } from '../../hooks/useScale.js';

interface InfoBarProps {
  roundWind: string;
  handNumber: number;
  honba: number;
  riichiSticks: number;
  wallRemaining: number;
  embedded?: boolean;
}

export function InfoBar({ roundWind, handNumber, honba, wallRemaining, embedded = false }: InfoBarProps) {
  const scale = useScale();
  const wind = roundWind.charAt(0).toUpperCase() + roundWind.slice(1);
  const fontSize = `${0.875 * scale}rem`;

  return (
    <div style={{
      display: 'flex',
      justifyContent: embedded ? 'flex-start' : 'center',
      gap: `${(embedded ? 0.75 : 1.25) * scale}rem`,
      padding: embedded ? 0 : `${0.25 * scale}rem ${0.5 * scale}rem`,
      background: embedded ? 'transparent' : 'var(--surface-panel)',
      borderBottom: embedded ? 'none' : '1px solid var(--border-subtle)',
      flexShrink: 0,
      lineHeight: 1.3,
      flexWrap: 'wrap',
    }}>
      {[
        { k: 'Wind', v: wind },
        { k: 'Hand', v: String(handNumber) },
        { k: 'Honba', v: String(honba) },
        { k: 'Wall', v: String(wallRemaining) },
      ].map(({ k, v }) => (
        <span key={k} style={{ fontSize, color: 'var(--text-muted)', fontWeight: 500 }}>
          <span style={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}>{k}</span>{' '}
          <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{v}</span>
        </span>
      ))}
    </div>
  );
}
