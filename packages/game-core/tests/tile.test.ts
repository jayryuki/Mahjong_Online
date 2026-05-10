import { describe, it, expect } from 'vitest';
import {
  createSuitedTile,
  createHonorTile,
  tileSortKey,
  generateFullTileSet,
} from '../src/models/tile.js';

describe('createSuitedTile', () => {
  it('creates a suited tile with correct id', () => {
    const tile = createSuitedTile('man', 1, 0);
    expect(tile.id).toBe('man-1-0');
    expect(tile.suit).toBe('man');
    expect(tile.rank).toBe(1);
    expect(tile.isFlower).toBe(false);
  });

  it('creates different instances with different ids', () => {
    const a = createSuitedTile('pin', 5, 0);
    const b = createSuitedTile('pin', 5, 1);
    expect(a.id).not.toBe(b.id);
  });
});

describe('createHonorTile', () => {
  it('creates a wind honor tile', () => {
    const tile = createHonorTile('east', 0);
    expect(tile.honorType).toBe('wind');
    expect(tile.honorName).toBe('east');
    expect(tile.isFlower).toBe(false);
  });

  it('creates a dragon honor tile', () => {
    const tile = createHonorTile('haku', 0);
    expect(tile.honorType).toBe('dragon');
    expect(tile.honorName).toBe('haku');
  });
});

describe('tileSortKey', () => {
  it('sorts man before pin before sou', () => {
    const man = createSuitedTile('man', 1, 0);
    const pin = createSuitedTile('pin', 1, 0);
    const sou = createSuitedTile('sou', 1, 0);
    expect(tileSortKey(man) < tileSortKey(pin)).toBe(true);
    expect(tileSortKey(pin) < tileSortKey(sou)).toBe(true);
  });

  it('sorts honors after suited tiles', () => {
    const sou9 = createSuitedTile('sou', 9, 0);
    const east = createHonorTile('east', 0);
    expect(tileSortKey(sou9) < tileSortKey(east)).toBe(true);
  });
});

describe('generateFullTileSet', () => {
  it('generates 136 tiles for 4-player without flowers', () => {
    const tiles = generateFullTileSet(4, false);
    expect(tiles.length).toBe(136);
  });

  it('has 4 copies of each suited tile', () => {
    const tiles = generateFullTileSet(4, false);
    const man1s = tiles.filter(t => t.suit === 'man' && t.rank === 1);
    expect(man1s.length).toBe(4);
  });

  it('has 4 copies of each honor tile', () => {
    const tiles = generateFullTileSet(4, false);
    const easts = tiles.filter(t => t.honorName === 'east');
    expect(easts.length).toBe(4);
  });
});
