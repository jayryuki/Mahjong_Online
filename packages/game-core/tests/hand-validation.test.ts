import { describe, it, expect } from 'vitest';
import { createSuitedTile, createHonorTile } from '../src/models/tile.js';
import { isValidWinningShape, isSevenPairs } from '../src/scoring/validator.js';

function man(r: number, i: number) { return createSuitedTile('man', r, i); }
function pin(r: number, i: number) { return createSuitedTile('pin', r, i); }
function sou(r: number, i: number) { return createSuitedTile('sou', r, i); }
function wind(n: 'east' | 'south' | 'west' | 'north', i: number) { return createHonorTile(n, i); }

describe('isValidWinningShape', () => {
  it('validates 4 melds + pair', () => {
    const hand = [
      man(1, 0), man(2, 0), man(3, 0),
      pin(4, 0), pin(5, 0), pin(6, 0),
      sou(7, 0), sou(8, 0), sou(9, 0),
      wind('east', 0), wind('east', 1), wind('east', 2),
      man(5, 0), man(5, 1),
    ];
    expect(isValidWinningShape(hand, 0)).toBe(true);
  });

  it('rejects incomplete hand', () => {
    const hand = [man(1, 0), man(2, 0)];
    expect(isValidWinningShape(hand, 0)).toBe(false);
  });

  it('validates with 1 open meld', () => {
    const hand = [
      man(1, 0), man(2, 0), man(3, 0),
      pin(4, 0), pin(5, 0), pin(6, 0),
      wind('east', 0), wind('east', 1), wind('east', 2),
      man(5, 0), man(5, 1),
    ];
    expect(isValidWinningShape(hand, 1)).toBe(true);
  });
});

describe('isSevenPairs', () => {
  it('validates seven pairs', () => {
    const hand = [
      man(1, 0), man(1, 1),
      man(2, 0), man(2, 1),
      man(3, 0), man(3, 1),
      man(4, 0), man(4, 1),
      man(5, 0), man(5, 1),
      man(6, 0), man(6, 1),
      man(7, 0), man(7, 1),
    ];
    expect(isSevenPairs(hand)).toBe(true);
  });

  it('rejects non-pair hand', () => {
    const hand = [
      man(1, 0), man(2, 0),
      man(3, 0), man(4, 0),
      man(5, 0), man(6, 0),
      man(7, 0), man(8, 0),
      man(9, 0), pin(1, 0),
      pin(2, 0), pin(3, 0),
      pin(4, 0), pin(5, 0),
    ];
    expect(isSevenPairs(hand)).toBe(false);
  });
});
