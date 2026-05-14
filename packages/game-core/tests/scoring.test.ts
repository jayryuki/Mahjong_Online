import { describe, it, expect } from 'vitest';
import { createSuitedTile, createHonorTile } from '../src/models/tile.js';
import { evaluateHKPatterns } from '../src/scoring/hk-evaluator.js';
import { calculateHKScore } from '../src/scoring/hk-calculator.js';

function man(r: number, i: number) { return createSuitedTile('man', r, i); }
function pin(r: number, i: number) { return createSuitedTile('pin', r, i); }
function sou(r: number, i: number) { return createSuitedTile('sou', r, i); }
function dragon(n: 'haku' | 'hatsu' | 'chun', i: number) { return createHonorTile(n, i); }
function wind(n: 'east' | 'south' | 'west' | 'north', i: number) { return createHonorTile(n, i); }

describe('evaluateHKPatterns', () => {
  it('detects winning hand (1 fan) for an open hand with no patterns', () => {
    const concealed = [
      man(2, 10), man(3, 10), man(4, 10),
      pin(5, 10), pin(6, 10), pin(7, 10),
      sou(3, 10), sou(4, 10), sou(5, 10),
      man(6, 10), man(7, 10),
    ];
    const melds = [{ type: 'pon' as const, tiles: [pin(1, 0), pin(1, 1), pin(1, 2)], calledFromSeat: 1, isConcealed: false }];
    const patterns = evaluateHKPatterns(concealed, melds, 'tsumo', 'east', 'east');
    const baseWin = patterns.find(p => p.id === 'base-win');
    expect(baseWin).toBeDefined();
    expect(baseWin!.fanValue).toBe(1);
  });

  it('detects dragon pung (1 fan)', () => {
    const concealed = [
      man(2, 0), man(3, 0), man(4, 0),
      pin(5, 0), pin(6, 0), pin(7, 0),
      sou(3, 0), sou(4, 0), sou(5, 0),
      dragon('haku', 0), dragon('haku', 1), dragon('haku', 2),
      man(5, 0), man(5, 1),
    ];
    const patterns = evaluateHKPatterns(concealed, [], 'tsumo', 'east', 'east');
    const haku = patterns.find(p => p.id === 'dragon-haku');
    expect(haku).toBeDefined();
    expect(haku!.fanValue).toBe(1);
  });

  it('detects round wind pung (1 fan)', () => {
    const concealed = [
      man(2, 0), man(3, 0), man(4, 0),
      pin(5, 0), pin(6, 0), pin(7, 0),
      sou(3, 0), sou(4, 0), sou(5, 0),
      wind('east', 0), wind('east', 1), wind('east', 2),
      man(5, 0), man(5, 1),
    ];
    const patterns = evaluateHKPatterns(concealed, [], 'tsumo', 'south', 'east');
    const roundEast = patterns.find(p => p.id === 'round-wind-east');
    expect(roundEast).toBeDefined();
    expect(roundEast!.fanValue).toBe(1);
  });

  it('detects seat wind pung (1 fan)', () => {
    const concealed = [
      man(2, 0), man(3, 0), man(4, 0),
      pin(5, 0), pin(6, 0), pin(7, 0),
      sou(3, 0), sou(4, 0), sou(5, 0),
      wind('south', 0), wind('south', 1), wind('south', 2),
      man(5, 0), man(5, 1),
    ];
    const patterns = evaluateHKPatterns(concealed, [], 'tsumo', 'south', 'east');
    const seatSouth = patterns.find(p => p.id === 'seat-wind-south');
    expect(seatSouth).toBeDefined();
    expect(seatSouth!.fanValue).toBe(1);
  });

  it('detects big dragons (4 fan)', () => {
    const concealed = [
      dragon('haku', 0), dragon('haku', 1), dragon('haku', 2),
      dragon('hatsu', 0), dragon('hatsu', 1), dragon('hatsu', 2),
      dragon('chun', 0), dragon('chun', 1), dragon('chun', 2),
      man(1, 0), man(1, 1), man(1, 2),
      pin(5, 0), pin(5, 1),
    ];
    const patterns = evaluateHKPatterns(concealed, [], 'tsumo', 'east', 'east');
    const bigDragons = patterns.find(p => p.id === 'big-dragons');
    expect(bigDragons).toBeDefined();
    expect(bigDragons!.fanValue).toBe(4);
  });

  it('detects full flush (6 fan)', () => {
    // All man tiles, no honors, but not nine gates
    const concealed = [
      man(2, 0), man(3, 0), man(4, 0),
      man(5, 0), man(6, 0), man(7, 0),
      man(3, 1), man(4, 1), man(5, 1),
      man(6, 1), man(7, 1), man(8, 1),
      man(1, 0), man(1, 1),
    ];
    const patterns = evaluateHKPatterns(concealed, [], 'tsumo', 'east', 'east');
    const flush = patterns.find(p => p.id === 'full-flush');
    expect(flush).toBeDefined();
    expect(flush!.fanValue).toBe(6);
  });
});

describe('calculateHKScore', () => {
  it('calculates 1 fan = 2 points', () => {
    const patterns = [{ id: 'base-win', name: 'Winning Hand', fanValue: 1, description: '' }];
    const result = calculateHKScore(patterns, false, false);
    expect(result.fan).toBe(1);
    expect(result.basePoints).toBe(2);
  });

  it('calculates 1 fan = 2 points', () => {
    const patterns = [{ id: 'dragon-haku', name: 'Dragon Pung', fanValue: 1, description: '' }];
    const result = calculateHKScore(patterns, false, false);
    expect(result.fan).toBe(1);
    expect(result.basePoints).toBe(2);
  });

  it('GONG doubles the score', () => {
    const patterns = [{ id: 'dragon-haku', name: 'Dragon Pung', fanValue: 1, description: '' }];
    const result = calculateHKScore(patterns, true, false);
    expect(result.gongMultiplier).toBe(2);
    expect(result.basePoints).toBe(2);
    expect(result.total).toBeGreaterThan(2);
  });

  it('caps at 128 points for 7+ fan', () => {
    const patterns = [{ id: 'thirteen-orphans', name: 'Thirteen Orphans', fanValue: 13, description: '' }];
    const result = calculateHKScore(patterns, false, false);
    expect(result.fan).toBe(13);
    expect(result.basePoints).toBe(128);
  });

  it('dealer winner gets paid by all 3 others', () => {
    const patterns = [{ id: 'dragon-haku', name: 'Dragon Pung', fanValue: 1, description: '' }];
    const result = calculateHKScore(patterns, false, true);
    expect(result.total).toBe(6); // 2 points × 3 players
  });

  it('non-dealer winner: dealer pays double', () => {
    const patterns = [{ id: 'dragon-haku', name: 'Dragon Pung', fanValue: 1, description: '' }];
    const result = calculateHKScore(patterns, false, false);
    expect(result.total).toBe(8); // dealer pays 4, others pay 2 each
  });
});
