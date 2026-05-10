import { describe, it, expect } from 'vitest';
import { buildWall, drawTile, peekRemaining } from '../src/models/wall.js';
import { generateFullTileSet } from '../src/models/tile.js';

describe('buildWall', () => {
  it('creates a wall with 136 tiles for 4 players', () => {
    const tiles = generateFullTileSet(4, false);
    const wall = buildWall(tiles, 'test-seed-1');
    expect(wall.tiles.length).toBe(136);
    expect(wall.remaining).toBe(136 - 14); // 14 in dead wall
    expect(wall.deadWallStart).toBe(136 - 14);
  });

  it('is deterministic from the same seed', () => {
    const tiles1 = generateFullTileSet(4, false);
    const tiles2 = generateFullTileSet(4, false);
    const wall1 = buildWall(tiles1, 'same-seed');
    const wall2 = buildWall(tiles2, 'same-seed');
    expect(wall1.tiles.map(t => t.id)).toEqual(wall2.tiles.map(t => t.id));
  });

  it('produces different order from different seeds', () => {
    const tiles1 = generateFullTileSet(4, false);
    const tiles2 = generateFullTileSet(4, false);
    const wall1 = buildWall(tiles1, 'seed-a');
    const wall2 = buildWall(tiles2, 'seed-b');
    const ids1 = wall1.tiles.map(t => t.id).join(',');
    const ids2 = wall2.tiles.map(t => t.id).join(',');
    expect(ids1).not.toBe(ids2);
  });
});

describe('drawTile', () => {
  it('draws the next tile from the wall', () => {
    const tiles = generateFullTileSet(4, false);
    const wall = buildWall(tiles, 'draw-test');
    const first = wall.tiles[0];
    const result = drawTile(wall);
    expect(result.tile).toEqual(first);
    expect(result.wall.remaining).toBe(wall.remaining - 1);
  });

  it('returns null when wall is exhausted', () => {
    const tiles = generateFullTileSet(4, false);
    let wall = buildWall(tiles, 'exhaust-test');
    const drawsNeeded = wall.remaining;
    for (let i = 0; i < drawsNeeded; i++) {
      wall = drawTile(wall).wall;
    }
    const result = drawTile(wall);
    expect(result.tile).toBeNull();
  });
});
