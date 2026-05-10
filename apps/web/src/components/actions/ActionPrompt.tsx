import React from 'react';
import { Button } from '../common/Button.js';

interface ActionPromptProps {
  actions: string[];
  onAction: (action: string) => void;
}

const ACTION_LABELS: Record<string, string> = {
  DRAW_TILE: 'Draw',
  DISCARD_TILE: 'Discard',
  PASS_REACTION: 'Pass',
  CALL_CHI: 'Chi',
  CALL_PON: 'Pon',
  CALL_KAN_OPEN: 'Kan',
  CALL_KAN_CLOSED: 'Kan',
  CALL_KAN_ADDED: 'Kan',
  DECLARE_WIN_RON: 'Ron!',
  DECLARE_WIN_TSUMO: 'Tsumo!',
  DECLARE_RIICHI: 'Riichi!',
};

export function ActionPrompt({ actions, onAction }: ActionPromptProps) {
  if (actions.length === 0) return null;

  return (
    <div style={{ display: 'flex', gap: '0.5rem', padding: '0.75rem', justifyContent: 'center', background: 'var(--surface-panel)', borderTop: '1px solid var(--border-subtle)' }}>
      {actions.map((action) => {
        const isWin = action.startsWith('DECLARE_WIN');
        const isRiichi = action === 'DECLARE_RIICHI';
        const variant = isWin ? 'primary' : isRiichi ? 'primary' : 'secondary';
        return (
          <Button
            key={action}
            variant={variant}
            size="sm"
            onClick={() => onAction(action)}
            style={isWin ? { animation: 'pulse 1.5s infinite' } : undefined}
          >
            {ACTION_LABELS[action] || action}
          </Button>
        );
      })}
    </div>
  );
}
