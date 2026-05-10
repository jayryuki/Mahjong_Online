import { describe, it, expect } from 'vitest';
import { createReaction, submitResponse, isAllResponded, autoPassUnresponded } from '../src/engine/reaction.js';
import { createSuitedTile } from '../src/models/tile.js';

describe('createReaction', () => {
  it('creates a reaction with null responses for eligible seats', () => {
    const tile = createSuitedTile('man', 1, 0);
    const reaction = createReaction('r1', 0, tile, [1, 2, 3], 15000);
    expect(reaction.reactionId).toBe('r1');
    expect(reaction.discardSeat).toBe(0);
    expect(reaction.eligibleSeats).toEqual([1, 2, 3]);
    expect(reaction.responses[1]).toBeNull();
    expect(reaction.responses[2]).toBeNull();
    expect(reaction.responses[3]).toBeNull();
    expect(reaction.resolved).toBe(false);
  });
});

describe('submitResponse', () => {
  it('records a response for an eligible seat', () => {
    const tile = createSuitedTile('man', 1, 0);
    let reaction = createReaction('r1', 0, tile, [1, 2, 3], 15000);
    reaction = submitResponse(reaction, 1, { type: 'pass' });
    expect(reaction.responses[1]).toEqual({ type: 'pass' });
  });

  it('ignores response from non-eligible seat', () => {
    const tile = createSuitedTile('man', 1, 0);
    let reaction = createReaction('r1', 0, tile, [1, 2, 3], 15000);
    reaction = submitResponse(reaction, 0, { type: 'pass' });
    expect(reaction.responses[0]).toBeUndefined();
  });

  it('ignores duplicate response', () => {
    const tile = createSuitedTile('man', 1, 0);
    let reaction = createReaction('r1', 0, tile, [1, 2, 3], 15000);
    reaction = submitResponse(reaction, 1, { type: 'pass' });
    reaction = submitResponse(reaction, 1, { type: 'ron' });
    expect(reaction.responses[1]).toEqual({ type: 'pass' });
  });

  it('ignores response when resolved', () => {
    const tile = createSuitedTile('man', 1, 0);
    let reaction = createReaction('r1', 0, tile, [1, 2, 3], 15000);
    reaction = { ...reaction, resolved: true };
    reaction = submitResponse(reaction, 1, { type: 'pass' });
    expect(reaction.responses[1]).toBeNull();
  });
});

describe('isAllResponded', () => {
  it('returns false when not all responded', () => {
    const tile = createSuitedTile('man', 1, 0);
    let reaction = createReaction('r1', 0, tile, [1, 2, 3], 15000);
    reaction = submitResponse(reaction, 1, { type: 'pass' });
    expect(isAllResponded(reaction)).toBe(false);
  });

  it('returns true when all responded', () => {
    const tile = createSuitedTile('man', 1, 0);
    let reaction = createReaction('r1', 0, tile, [1, 2], 15000);
    reaction = submitResponse(reaction, 1, { type: 'pass' });
    reaction = submitResponse(reaction, 2, { type: 'pass' });
    expect(isAllResponded(reaction)).toBe(true);
  });
});

describe('autoPassUnresponded', () => {
  it('auto-passes for unresponded seats and marks resolved', () => {
    const tile = createSuitedTile('man', 1, 0);
    let reaction = createReaction('r1', 0, tile, [1, 2, 3], 15000);
    reaction = submitResponse(reaction, 1, { type: 'pass' });
    reaction = autoPassUnresponded(reaction);
    expect(reaction.responses[2]).toEqual({ type: 'pass' });
    expect(reaction.responses[3]).toEqual({ type: 'pass' });
    expect(reaction.resolved).toBe(true);
  });
});
