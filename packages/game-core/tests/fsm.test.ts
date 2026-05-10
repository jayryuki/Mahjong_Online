import { describe, it, expect } from 'vitest';
import { canTransition } from '../src/engine/fsm.js';
import { isTenpai } from '../src/engine/validators.js';
import { createSuitedTile, createHonorTile } from '../src/models/tile.js';

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

describe('isTenpai', () => {
  // Tenpai hand: man1x3, man2x3, man3x3, pin1x2, pin2x1, pin3x1 = 13 tiles
  // Adding pin1 makes: man1 triplet + man2 triplet + man3 triplet + pin1-pin2-pin3 sequence + pin1x2 pair = winning
  it('returns true for a tenpai hand', () => {
    const hand = [
      ...[0, 1, 2].map(i => createSuitedTile('man', 1, i)),
      ...[3, 4, 5].map(i => createSuitedTile('man', 2, i)),
      ...[6, 7, 8].map(i => createSuitedTile('man', 3, i)),
      createSuitedTile('pin', 1, 10),
      createSuitedTile('pin', 1, 11),
      createSuitedTile('pin', 2, 12),
      createSuitedTile('pin', 3, 13),
    ];
    expect(isTenpai(hand, 0)).toBe(true);
  });

  it('returns false for a not-tenpai hand', () => {
    const hand = [
      createSuitedTile('man', 1, 0),
      createSuitedTile('man', 5, 1),
      createSuitedTile('man', 9, 2),
      createSuitedTile('pin', 1, 3),
      createSuitedTile('pin', 5, 4),
      createSuitedTile('pin', 9, 5),
      createSuitedTile('sou', 1, 6),
      createSuitedTile('sou', 5, 7),
      createSuitedTile('sou', 9, 8),
      createHonorTile('east', 9),
      createHonorTile('south', 10),
      createHonorTile('west', 11),
      createHonorTile('north', 12),
    ];
    expect(isTenpai(hand, 0)).toBe(false);
  });

  it('returns false for a 14-tile hand (wrong length)', () => {
    const hand = [
      ...[0, 1, 2].map(i => createSuitedTile('man', 1, i)),
      ...[3, 4, 5].map(i => createSuitedTile('man', 2, i)),
      ...[6, 7, 8].map(i => createSuitedTile('man', 3, i)),
      createSuitedTile('pin', 1, 10),
      createSuitedTile('pin', 1, 11),
      createSuitedTile('pin', 2, 12),
      createSuitedTile('pin', 3, 13),
      createSuitedTile('pin', 1, 14), // extra tile making it 14
    ];
    expect(isTenpai(hand, 0)).toBe(false);
  });
});
