import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/common/Button.js';
import { ThemeToggle } from '../components/common/ThemeToggle.js';

export function StartScreen() {
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2rem', padding: '2rem' }}>
      <h1 style={{ fontFamily: "'Newsreader', Georgia, serif", fontSize: '3rem', fontWeight: 500, letterSpacing: '-0.03em', color: 'var(--text-primary)', margin: 0 }}>
        Mahjong
      </h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: '1.125rem', fontStyle: 'italic', fontFamily: "'Newsreader', Georgia, serif", margin: 0 }}>
        A quiet room for a strategic game.
      </p>
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <Button size="lg" onClick={() => navigate('/create')}>Create Room</Button>
        <Button variant="secondary" size="lg" onClick={() => navigate('/join')}>Join Room</Button>
        <ThemeToggle />
      </div>
    </div>
  );
}
