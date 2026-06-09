import React from 'react';
import { Button, ThemeToggle } from '@games/ui';

interface GameShellProps {
  gameName: string;
  title: string;
  subtitle: string;
  accent?: string;
  preview?: React.ReactNode;
  children: React.ReactNode;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  onBack?: () => void;
  backLabel?: string;
}

export function GameShell({
  gameName,
  title,
  subtitle,
  accent = 'var(--accent-warm)',
  preview,
  children,
  actions,
  footer,
  onBack,
  backLabel = 'Back',
}: GameShellProps) {
  return (
    <div className="game-shell mj-shell">
      <div className="game-shell__aurora" aria-hidden="true" />
      <div className="game-shell__inner">
        <div className="game-shell__topbar">
          {onBack ? (
            <Button variant="ghost" onClick={onBack}>{`← ${backLabel}`}</Button>
          ) : <div />}
          <ThemeToggle />
        </div>

        <div className="game-shell__hero">
          <div className="game-shell__eyebrow" style={{ color: accent }}>{gameName}</div>
          <h1 className="game-shell__title">{title}</h1>
          <p className="game-shell__subtitle">{subtitle}</p>
          {preview && <div className="game-shell__preview">{preview}</div>}
        </div>

        <div className="game-shell__card">
          {children}
          {actions && <div className="game-shell__actions">{actions}</div>}
        </div>

        {footer && <div className="game-shell__footer">{footer}</div>}
      </div>
    </div>
  );
}
