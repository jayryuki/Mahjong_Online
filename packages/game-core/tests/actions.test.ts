import { describe, it, expect } from 'vitest';
import { legalActionsForSeat } from '../src/engine/validators.js';
import { createSuitedTile, generateFullTileSet } from '../src/models/tile.js';
import { buildWall } from '../src/models/wall.js';
import { RIICHI_PRESET } from '../src/rules/riichi.js';
import type { RoundState } from '../src/models/round.js';

function makeRound(overrides: Partial<RoundState> = {}): RoundState {
  const tiles = generateFullTileSet(4, false);
  const wall = buildWall(tiles, 'test');
  return {
    roundWind: 'east',
    handNumber: 1,
    honba: 0,
    riichiSticks: 0,
    dealerSeat: 0,
    activeSeat: 0,
    wall,
    deadWall: null,
    dora: null,
    reaction: null,
    seats: [
      { seatIndex: 0, playerId: 'p0', concealedCount: 13, melds: [], flowers: [], river: { entries: [] }, isRiichi: false, isConnected: true },
      { seatIndex: 1, playerId: 'p1', concealedCount: 13, melds: [], flowers: [], river: { entries: [] }, isRiichi: false, isConnected: true },
      { seatIndex: 2, playerId: 'p2', concealedCount: 13, melds: [], flowers: [], river: { entries: [] }, isRiichi: false, isConnected: true },
      { seatIndex: 3, playerId: 'p3', concealedCount: 13, melds: [], flowers: [], river: { entries: [] }, isRiichi: false, isConnected: true },
    ],
    eventLog: [],
    seedInfo: { shuffleSeed: 'test', wallVersion: 0 },
    ...overrides,
  };
}

describe('legalActionsForSeat', () => {
  it('returns DRAW_TILE for active seat when wall has tiles', () => {
    const round = makeRound({ activeSeat: 0 });
    const actions = legalActionsForSeat(round, RIICHI_PRESET, 0);
    expect(actions).toContain('DRAW_TILE');
  });

  it('does not return DRAW_TILE for inactive seat', () => {
    const round = makeRound({ activeSeat: 0 });
    const actions = legalActionsForSeat(round, RIICHI_PRESET, 1);
    expect(actions).not.toContain('DRAW_TILE');
  });

  it('returns DISCARD_TILE for active seat', () => {
    const round = makeRound({ activeSeat: 0 });
    const actions = legalActionsForSeat(round, RIICHI_PRESET, 0);
    expect(actions).toContain('DISCARD_TILE');
  });

  it('does not return DECLARE_RIICHI in Phase 1', () => {
    const round = makeRound({ activeSeat: 0 });
    const actions = legalActionsForSeat(round, RIICHI_PRESET, 0);
    expect(actions).not.toContain('DECLARE_RIICHI');
  });

  it('returns PASS_REACTION during reaction window for eligible seat', () => {
    const round = makeRound({
      activeSeat: 0,
      reaction: {
        reactionId: 'r1',
        discardSeat: 0,
        discardTile: createSuitedTile('man', 1, 0),
        eligibleSeats: [1, 2, 3],
        responses: { 1: null, 2: null, 3: null },
        deadline: Date.now() + 15000,
        resolved: false,
        createdAt: Date.now(),
      },
    });
    // Seat 2 is eligible and not the active seat / discard seat
    const actions = legalActionsForSeat(round, RIICHI_PRESET, 2);
    expect(actions).toContain('PASS_REACTION');
  });

  it('does not return PASS_REACTION when not in reaction window', () => {
    const round = makeRound({ activeSeat: 0, reaction: null });
    const actions = legalActionsForSeat(round, RIICHI_PRESET, 0);
    expect(actions).not.toContain('PASS_REACTION');
  });
});
