import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '../components/common/Button.js';
import { ThemeToggle } from '../components/common/ThemeToggle.js';

interface PointTransfer {
  from: number;
  to: number;
  amount: number;
  reason: string;
}

interface PatternMatch {
  id: string;
  name: string;
  hanValue: number;
  description: string;
}

interface ScoreBreakdown {
  han: number;
  fu: number;
  total: number;
  steps: string[];
}

interface HandResult {
  winner: number;
  winType: 'ron' | 'tsumo';
  losingSeat?: number;
  patterns: PatternMatch[];
  han: number;
  fu: number;
  score: ScoreBreakdown;
  settlement: PointTransfer[];
}

export function ResultScreen() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();

  // Mock result data — will be wired to real state in Task 16
  const result: HandResult = {
    winner: 0,
    winType: 'tsumo',
    patterns: [
      { id: 'menzen-tsumo', name: 'Menzen Tsumo', hanValue: 1, description: 'Concealed self-draw' },
    ],
    han: 1,
    fu: 30,
    score: { han: 1, fu: 30, total: 1500, steps: ['1 han / 30 fu = 30 × 8 = 1500'] },
    settlement: [
      { from: 1, to: 0, amount: 500, reason: 'Tsumo payment (1 han)' },
      { from: 2, to: 0, amount: 500, reason: 'Tsumo payment (1 han)' },
      { from: 3, to: 0, amount: 500, reason: 'Tsumo payment (1 han)' },
    ],
  };

  const seatNames = ['East (You)', 'South', 'West', 'North'];
  const winTypeLabel = result.winType === 'ron' ? 'Ron' : 'Tsumo';

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', maxWidth: '480px' }}>
        <Button variant="ghost" onClick={() => navigate(`/game/${roomCode}`)}>&larr; Back to Table</Button>
        <ThemeToggle />
      </div>

      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontFamily: "'Newsreader', Georgia, serif", fontSize: '2rem', fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>
          {seatNames[result.winner]} wins!
        </h1>
        <div style={{
          display: 'inline-block',
          padding: '0.25rem 0.75rem',
          borderRadius: '4px',
          background: result.winType === 'ron' ? 'var(--accent-warm)' : 'var(--success)',
          color: '#fff',
          fontSize: '0.6875rem',
          fontWeight: 600,
          marginTop: '0.5rem',
        }}>
          {winTypeLabel}
        </div>
      </div>

      <div style={{ width: '100%', maxWidth: '480px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Patterns */}
        <div style={{ padding: '1rem', borderRadius: '8px', background: 'var(--surface-panel)' }}>
          <div style={{ fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.5rem' }}>Yaku</div>
          {result.patterns.map((p) => (
            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.375rem 0' }}>
              <span style={{ color: 'var(--text-primary)' }}>{p.name}</span>
              <span style={{ color: 'var(--accent-warm)', fontWeight: 500 }}>{p.hanValue} han</span>
            </div>
          ))}
        </div>

        {/* Score breakdown */}
        <div style={{ padding: '1rem', borderRadius: '8px', background: 'var(--surface-panel)' }}>
          <div style={{ fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.5rem' }}>Score</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>{result.han} han / {result.fu} fu</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '1.25rem' }}>{result.score.total}</span>
          </div>
          {result.score.steps.map((step, i) => (
            <div key={i} style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', padding: '0.125rem 0' }}>{step}</div>
          ))}
        </div>

        {/* Point transfers */}
        <div style={{ padding: '1rem', borderRadius: '8px', background: 'var(--surface-panel)' }}>
          <div style={{ fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.5rem' }}>Point Transfers</div>
          {result.settlement.map((t, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.375rem 0', fontSize: '0.8125rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>{seatNames[t.from]} → {seatNames[t.to]}</span>
              <span style={{ color: t.to === result.winner ? 'var(--success)' : 'var(--danger)', fontWeight: 500 }}>{t.amount}</span>
            </div>
          ))}
        </div>

        <Button size="lg" onClick={() => navigate(`/game/${roomCode}`)} style={{ width: '100%' }}>
          Next Hand
        </Button>
      </div>
    </div>
  );
}
