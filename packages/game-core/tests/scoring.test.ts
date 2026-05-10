import { describe, it, expect } from 'vitest';
import { createSuitedTile, createHonorTile } from '../src/models/tile.js';
import { evaluatePatterns } from '../src/scoring/evaluator.js';
import { calculateScore } from '../src/scoring/calculator.js';
import { settleHand } from '../src/scoring/settlement.js';

function man(r: number, i: number) { return createSuitedTile('man', r, i); }
function pin(r: number, i: number) { return createSuitedTile('pin', r, i); }
function sou(r: number, i: number) { return createSuitedTile('sou', r, i); }
function dragon(n: 'haku' | 'hatsu' | 'chun', i: number) { return createHonorTile(n, i); }

describe('evaluatePatterns', () => {
  it('detects tanyao', () => {
    const concealed = [
      man(2, 0), man(3, 0), man(4, 0),
      pin(5, 0), pin(6, 0), pin(7, 0),
      sou(3, 0), sou(4, 0), sou(5, 0),
      man(6, 0), man(7, 0), man(8, 0),
      pin(3, 0), pin(3, 1),
    ];
    const patterns = evaluatePatterns(concealed, [], 'tsumo', 'east', 'east');
    const tanyao = patterns.find(p => p.id === 'tanyao');
    expect(tanyao).toBeDefined();
    expect(tanyao!.hanValue).toBe(1);
  });

  it('detects yakuhai (dragon triplet)', () => {
    const concealed = [
      man(2, 0), man(3, 0), man(4, 0),
      pin(5, 0), pin(6, 0), pin(7, 0),
      sou(3, 0), sou(4, 0), sou(5, 0),
      dragon('haku', 0), dragon('haku', 1), dragon('haku', 2),
      man(5, 0), man(5, 1),
    ];
    const patterns = evaluatePatterns(concealed, [], 'ron', 'east', 'east');
    const haku = patterns.find(p => p.id === 'yakuhai-haku');
    expect(haku).toBeDefined();
    expect(haku!.hanValue).toBe(1);
  });

  it('detects menzen tsumo', () => {
    const concealed = [
      man(1, 0), man(2, 0), man(3, 0),
      pin(4, 0), pin(5, 0), pin(6, 0),
      sou(7, 0), sou(8, 0), sou(9, 0),
      dragon('haku', 0), dragon('haku', 1), dragon('haku', 2),
      man(5, 0), man(5, 1),
    ];
    const patterns = evaluatePatterns(concealed, [], 'tsumo', 'east', 'east');
    const tsumo = patterns.find(p => p.id === 'menzen-tsumo');
    expect(tsumo).toBeDefined();
  });

  it('no menzen tsumo on ron', () => {
    const concealed = [
      man(1, 0), man(2, 0), man(3, 0),
      pin(4, 0), pin(5, 0), pin(6, 0),
      sou(7, 0), sou(8, 0), sou(9, 0),
      dragon('haku', 0), dragon('haku', 1), dragon('haku', 2),
      man(5, 0), man(5, 1),
    ];
    const patterns = evaluatePatterns(concealed, [], 'ron', 'east', 'east');
    const tsumo = patterns.find(p => p.id === 'menzen-tsumo');
    expect(tsumo).toBeUndefined();
  });
});

describe('calculateScore', () => {
  it('calculates 1 han / 30 fu', () => {
    const patterns = [{ id: 'tanyao', name: 'Tanyao', hanValue: 1, description: '' }];
    const result = calculateScore(patterns, 30);
    expect(result.han).toBe(1);
    expect(result.total).toBe(1000);
  });

  it('calculates 3 han / 30 fu', () => {
    const patterns = [
      { id: 'tanyao', name: 'Tanyao', hanValue: 1, description: '' },
      { id: 'pinfu', name: 'Pinfu', hanValue: 1, description: '' },
      { id: 'menzen-tsumo', name: 'Menzen Tsumo', hanValue: 1, description: '' },
    ];
    const result = calculateScore(patterns, 30);
    expect(result.han).toBe(3);
    expect(result.total).toBe(4000);
  });

  it('calculates 2 han / 30 fu', () => {
    const patterns = [
      { id: 'tanyao', name: 'Tanyao', hanValue: 1, description: '' },
      { id: 'pinfu', name: 'Pinfu', hanValue: 1, description: '' },
    ];
    const result = calculateScore(patterns, 30);
    expect(result.han).toBe(2);
    expect(result.total).toBe(2000);
  });

  it('calculates 4 han / 30 fu', () => {
    const patterns = [
      { id: 'p1', name: 'P1', hanValue: 2, description: '' },
      { id: 'p2', name: 'P2', hanValue: 2, description: '' },
    ];
    const result = calculateScore(patterns, 30);
    expect(result.han).toBe(4);
    expect(result.total).toBe(8000);
  });

  it('caps at mangan for 5+ han', () => {
    const patterns = [
      { id: 'p1', name: 'P1', hanValue: 3, description: '' },
      { id: 'p2', name: 'P2', hanValue: 2, description: '' },
    ];
    const result = calculateScore(patterns, 30);
    expect(result.han).toBe(5);
    expect(result.total).toBe(8000);
  });
});

describe('settleHand', () => {
  it('calculates ron settlement (non-dealer)', () => {
    const patterns = [{ id: 'tanyao', name: 'Tanyao', hanValue: 1, description: '' }];
    const result = settleHand(0, 'ron', 2, patterns, 30, 4, false);
    expect(result.winner).toBe(0);
    expect(result.winType).toBe('ron');
    expect(result.settlement).toHaveLength(1);
    expect(result.settlement[0].from).toBe(2);
    expect(result.settlement[0].to).toBe(0);
  });

  it('calculates tsumo settlement', () => {
    const patterns = [{ id: 'tanyao', name: 'Tanyao', hanValue: 1, description: '' }];
    const result = settleHand(0, 'tsumo', undefined, patterns, 30, 4, false);
    expect(result.winner).toBe(0);
    expect(result.winType).toBe('tsumo');
    expect(result.settlement).toHaveLength(3);
    expect(result.settlement.every(s => s.to === 0)).toBe(true);
  });

  it('calculates ron settlement (dealer)', () => {
    const patterns = [{ id: 'tanyao', name: 'Tanyao', hanValue: 1, description: '' }];
    const result = settleHand(0, 'ron', 2, patterns, 30, 4, true);
    expect(result.settlement).toHaveLength(1);
    // Dealer ron is 1.5x
    expect(result.settlement[0].amount).toBeGreaterThan(1000);
  });

  it('settles dealer tsumo with equal payments from all others', () => {
    const patterns = [{ id: 'tanyao', name: 'Tanyao', hanValue: 1, description: '' }];
    const result = settleHand(0, 'tsumo', undefined, patterns, 30, 4, true);
    expect(result.settlement).toHaveLength(3);
    // All three losers should pay the same amount for dealer tsumo
    const amounts = result.settlement.map(s => s.amount);
    expect(amounts[0]).toBe(amounts[1]);
    expect(amounts[1]).toBe(amounts[2]);
  });

  it('settles non-dealer tsumo with all others paying', () => {
    const patterns = [{ id: 'tanyao', name: 'Tanyao', hanValue: 1, description: '' }];
    const result = settleHand(1, 'tsumo', undefined, patterns, 30, 4, false);
    expect(result.settlement).toHaveLength(3);
    expect(result.settlement.every(s => s.to === 1)).toBe(true);
    // All payments go to the winner from the other 3 seats
    expect(result.settlement.map(s => s.from).sort()).toEqual([0, 2, 3]);
  });
});
