import { describe, it, expect } from 'vitest';
import { canTransition } from '../src/engine/fsm.js';

describe('canTransition', () => {
  it('allows ROOM_OPEN to LOBBY', () => {
    expect(canTransition({ type: 'ROOM_OPEN' }, { type: 'LOBBY' })).toBe(true);
  });

  it('allows LOBBY to DEALING', () => {
    expect(canTransition({ type: 'LOBBY' }, { type: 'DEALING' })).toBe(true);
  });

  it('allows DEALING to TURN_DRAW', () => {
    expect(canTransition({ type: 'DEALING', progress: 0 }, { type: 'TURN_DRAW', activeSeat: 0, wallRemaining: 100 })).toBe(true);
  });

  it('allows TURN_DRAW to TURN_DECISION', () => {
    expect(canTransition({ type: 'TURN_DRAW', activeSeat: 0, wallRemaining: 100 }, { type: 'TURN_DECISION', activeSeat: 0, legalActions: [] })).toBe(true);
  });

  it('allows TURN_DECISION to REACTION_WINDOW', () => {
    expect(canTransition(
      { type: 'TURN_DECISION', activeSeat: 0, legalActions: [] },
      { type: 'REACTION_WINDOW', discardSeat: 0, discardTile: {} as any, pendingSeats: [1] }
    )).toBe(true);
  });

  it('allows HAND_END to ROUND_END', () => {
    expect(canTransition(
      { type: 'HAND_END', endReason: 'win', result: null },
      { type: 'ROUND_END', summary: {} as any }
    )).toBe(true);
  });

  it('denies ROOM_OPEN to TURN_DRAW', () => {
    expect(canTransition({ type: 'ROOM_OPEN' }, { type: 'TURN_DRAW', activeSeat: 0, wallRemaining: 100 })).toBe(false);
  });

  it('denies MATCH_END to anything', () => {
    expect(canTransition({ type: 'MATCH_END', finalScores: [] }, { type: 'LOBBY' })).toBe(false);
  });
});
