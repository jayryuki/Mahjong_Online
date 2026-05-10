import { TileDef } from './tile.js';

export interface WallState {
  tiles: TileDef[];
  drawIndex: number;
  remaining: number;
  deadWallStart: number;
}

export interface DeadWallState {
  replacementDrawsAvailable: number;
}

export interface RoundSeedInfo {
  shuffleSeed: string;
  wallVersion: number;
}

function seededRandom(seed: string): () => number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(31, h) + seed.charCodeAt(i) | 0;
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
    h = Math.imul(h ^ (h >>> 13), 0x45d9f3b);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

export function buildWall(tiles: TileDef[], seed: string): WallState {
  const shuffled = [...tiles];
  const rng = seededRandom(seed);

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const deadWallCount = 14;
  return {
    tiles: shuffled,
    drawIndex: 0,
    remaining: shuffled.length - deadWallCount,
    deadWallStart: shuffled.length - deadWallCount,
  };
}

export function drawTile(wall: WallState): { tile: TileDef | null; wall: WallState } {
  if (wall.drawIndex >= wall.deadWallStart) {
    return { tile: null, wall };
  }
  const tile = wall.tiles[wall.drawIndex];
  return {
    tile,
    wall: {
      ...wall,
      drawIndex: wall.drawIndex + 1,
      remaining: wall.remaining - 1,
    },
  };
}

export function drawReplacementTile(wall: WallState): { tile: TileDef | null; wall: WallState } {
  const deadEnd = wall.tiles.length;
  const replIndex = deadEnd - 1;
  if (replIndex <= wall.deadWallStart) {
    return { tile: null, wall };
  }
  const tile = wall.tiles[replIndex];
  const newTiles = [...wall.tiles.slice(0, replIndex)];
  return {
    tile,
    wall: {
      ...wall,
      tiles: newTiles,
      deadWallStart: wall.deadWallStart - 1,
      remaining: wall.remaining,
    },
  };
}

export function peekRemaining(wall: WallState): number {
  return wall.remaining;
}
