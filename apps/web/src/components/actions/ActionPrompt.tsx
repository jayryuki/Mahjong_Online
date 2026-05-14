import React, { useState } from 'react';
import { Button } from '../common/Button.js';
import { ManTile, PinTile, SouTile, HonorTile } from '@mahjong/ui';
import { TileDef } from '@mahjong/game-core';

interface ChiOption {
  tileIds: string[];
  label: string;
}

interface ActionPromptProps {
  actions: string[];
  onAction: (action: string, chiTileIds?: [string, string]) => void;
  discardTile?: TileDef | null;
  isWild?: boolean;
  chiOptions?: ChiOption[];
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
  DECLARE_WIN_TSUMO: 'Tsumo!',
};

const HIDDEN_ACTIONS = new Set(['DISCARD_TILE']);

const REACTION_ACTIONS = new Set(['CALL_CHI', 'CALL_PON', 'CALL_KAN_OPEN', 'CALL_KAN_ADDED', 'DECLARE_WIN_RON']);

function renderDiscardTile(tile: TileDef) {
  const size = { width: 64, height: 90 };
  if (tile.suit === 'man') return <ManTile rank={tile.rank!} {...size} />;
  if (tile.suit === 'pin') return <PinTile rank={tile.rank!} {...size} />;
  if (tile.suit === 'sou') return <SouTile rank={tile.rank!} {...size} />;
  if (tile.honorName) return <HonorTile honorName={tile.honorName} {...size} />;
  return null;
}

function renderMiniTile(tile: TileDef) {
  const size = { width: 36, height: 50 };
  if (tile.suit === 'man') return <ManTile rank={tile.rank!} {...size} />;
  if (tile.suit === 'pin') return <PinTile rank={tile.rank!} {...size} />;
  if (tile.suit === 'sou') return <SouTile rank={tile.rank!} {...size} />;
  if (tile.honorName) return <HonorTile honorName={tile.honorName} {...size} />;
  return null;
}

function parseTileIdAction(id: string): TileDef {
  const parts = id.split('-');
  const suitNames = ['man', 'pin', 'sou'];
  const windNames = ['east', 'south', 'west', 'north'];
  const dragonNames = ['haku', 'hatsu', 'chun'];
  const honorNames = [...windNames, ...dragonNames];

  if (suitNames.includes(parts[0])) {
    return { id, suit: parts[0] as any, rank: parseInt(parts[1], 10), isFlower: false };
  } else if (honorNames.includes(parts[0])) {
    return { id, honorType: windNames.includes(parts[0]) ? 'wind' : 'dragon', honorName: parts[0] as any, isFlower: false };
  }
  return { id, isFlower: false };
}

export function ActionPrompt({ actions, onAction, discardTile, isWild, chiOptions }: ActionPromptProps) {
  const [showChiPicker, setShowChiPicker] = useState(false);
  const visibleActions = actions.filter(a => !HIDDEN_ACTIONS.has(a));
  if (visibleActions.length === 0) return null;

  const hasReaction = visibleActions.some(a => REACTION_ACTIONS.has(a));
  const showDiscardTile = hasReaction && discardTile;
  const hasMultipleChi = chiOptions && chiOptions.length > 1;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '1rem',
      padding: '0.375rem 0',
      ...(showDiscardTile && {
        background: 'rgba(184, 92, 58, 0.12)',
        borderRadius: '12px',
        border: '1px solid rgba(184, 92, 58, 0.25)',
        padding: '0.625rem 1rem',
      }),
    }}>
      {showDiscardTile && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '4px',
        }}>
          <span style={{ fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent-warm)', fontWeight: 700 }}>
            Discarded
          </span>
          <div style={{
            padding: '3px',
            background: isWild ? 'linear-gradient(135deg, #fbbf24, #f59e0b)' : 'linear-gradient(135deg, var(--accent-warm), #d4764e)',
            borderRadius: '8px',
            boxShadow: '0 0 14px rgba(184, 92, 58, 0.5)',
          }}>
            {renderDiscardTile(discardTile)}
          </div>
          {isWild && <span style={{ fontSize: '0.5625rem', color: '#fbbf24', fontWeight: 700, background: 'rgba(251,191,36,0.15)', padding: '1px 6px', borderRadius: '3px' }}>WILD</span>}
        </div>
      )}
      <div style={{ display: 'flex', gap: '0.625rem', justifyContent: 'center', flexWrap: 'wrap' }}>
        {visibleActions.map((action) => {
          const isWin = action.startsWith('DECLARE_WIN');
          const isPass = action === 'PASS_REACTION';
          const isChi = action === 'CALL_CHI';
          const variant = isWin ? 'primary' : 'secondary';
          return (
            <Button
              key={action}
              variant={variant}
              size="sm"
              onClick={() => {
                if (isChi && hasMultipleChi) {
                  setShowChiPicker(true);
                } else if (isChi && chiOptions && chiOptions.length === 1) {
                  const opt = chiOptions[0].tileIds;
                  onAction(action, [opt[0], opt[1]]);
                } else {
                  onAction(action);
                }
              }}
              style={{
                ...(isWin ? { animation: 'pulse 1.5s infinite' } : {}),
                animation: isWin ? 'pulse 1.5s infinite' : 'fadeInUp 250ms ease-out',
                fontSize: '1.0625rem',
                padding: '0.625rem 1.25rem',
                ...(isPass && { opacity: 0.7, fontSize: '0.9375rem', padding: '0.5rem 1rem' }),
              }}
            >
              {ACTION_LABELS[action] || action}
            </Button>
          );
        })}
      </div>
      {showChiPicker && chiOptions && chiOptions.length > 1 && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          padding: '0.625rem',
          background: 'rgba(0,0,0,0.2)',
          borderRadius: '10px',
          marginTop: '0.375rem',
        }}>
          <div style={{ fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', fontWeight: 700, textAlign: 'center' }}>
            Choose Chi
          </div>
          {chiOptions.map((opt, idx) => {
            const optTiles = opt.tileIds.map(parseTileIdAction);
            const allSeqTiles = discardTile
              ? [...optTiles, discardTile].sort((a, b) => {
                  const sk = (t: TileDef) => t.suit ? `${['man','pin','sou'].indexOf(t.suit)}${(t.rank??0).toString().padStart(2,'0')}` : `9${t.honorName??''}`;
                  return sk(a).localeCompare(sk(b));
                })
              : optTiles;
            return (
              <button
                key={idx}
                onClick={() => onAction('CALL_CHI', [opt.tileIds[0], opt.tileIds[1]] as [string, string])}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  padding: '0.375rem 0.75rem',
                  background: 'var(--surface-panel)',
                  border: '2px solid var(--border-subtle)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'border-color 150ms, background 150ms',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent-warm)'; e.currentTarget.style.background = 'rgba(184,92,58,0.1)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.background = 'var(--surface-panel)'; }}
              >
                {allSeqTiles.map((t, ti) => renderMiniTile(t))}
              </button>
            );
          })}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowChiPicker(false)}
            style={{ fontSize: '0.8125rem', marginTop: '0.125rem' }}
          >
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}
