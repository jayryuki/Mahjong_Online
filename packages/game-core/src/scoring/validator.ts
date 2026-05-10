import { TileDef, tileSortKey } from '../models/tile.js';

interface TileGroup {
  tiles: TileDef[];
  count: number;
}

function groupTiles(tiles: TileDef[]): Map<string, TileGroup> {
  const groups = new Map<string, TileGroup>();
  for (const tile of tiles) {
    const key = tile.suit ? `${tile.suit}-${tile.rank}` : tile.honorName ?? 'unknown';
    const existing = groups.get(key);
    if (existing) {
      existing.tiles.push(tile);
      existing.count++;
    } else {
      groups.set(key, { tiles: [tile], count: 1 });
    }
  }
  return groups;
}

export function isSequentialTriplet(tiles: TileDef[]): boolean {
  if (tiles.length !== 3) return false;
  if (!tiles.every(t => t.suit && t.rank)) return false;
  if (!tiles.every(t => t.suit === tiles[0].suit)) return false;
  const ranks = tiles.map(t => t.rank!).sort((a, b) => a - b);
  return ranks[1] === ranks[0] + 1 && ranks[2] === ranks[1] + 1;
}

export function isTriplet(tiles: TileDef[]): boolean {
  if (tiles.length !== 3) return false;
  const key = tileSortKey(tiles[0]);
  return tiles.every(t => tileSortKey(t) === key);
}

export function isPair(tiles: TileDef[]): boolean {
  if (tiles.length !== 2) return false;
  return tileSortKey(tiles[0]) === tileSortKey(tiles[1]);
}

export interface MeldCandidate {
  tiles: TileDef[];
  type: 'chi' | 'pon' | 'pair';
}

export function isValidWinningShape(concealed: TileDef[], meldCount: number): boolean {
  const neededMelds = 4 - meldCount;
  const neededTiles = neededMelds * 3 + 2;
  if (concealed.length !== neededTiles) return false;
  return findWinningDecomposition(concealed, meldCount);
}

function findWinningDecomposition(tiles: TileDef[], meldCount: number): boolean {
  const sorted = [...tiles].sort((a, b) => tileSortKey(a).localeCompare(tileSortKey(b)));
  return tryDecompose(sorted, 4 - meldCount, false);
}

function tryDecompose(tiles: TileDef[], meldsNeeded: number, pairTaken: boolean): boolean {
  if (tiles.length === 0) return meldsNeeded === 0 && pairTaken;
  if (meldsNeeded < 0) return false;

  // Try taking the first two tiles as the pair (if not already taken)
  if (!pairTaken && tiles.length >= 2 && isPair(tiles.slice(0, 2))) {
    if (tryDecompose(tiles.slice(2), meldsNeeded, true)) return true;
  }

  if (meldsNeeded === 0) return false;

  if (tiles.length >= 3 && isTriplet(tiles.slice(0, 3))) {
    if (tryDecompose(tiles.slice(3), meldsNeeded - 1, pairTaken)) return true;
  }

  if (tiles.length >= 3 && tiles[0].suit && tiles[0].rank) {
    const suit = tiles[0].suit;
    const rank = tiles[0].rank;
    const seq = findSequenceTiles(tiles, suit, rank);
    if (seq) {
      const remaining = tiles.filter((_, i) => !seq.includes(i));
      if (tryDecompose(remaining, meldsNeeded - 1, pairTaken)) return true;
    }
  }

  return false;
}

function findSequenceTiles(tiles: TileDef[], suit: string, startRank: number): number[] | null {
  const indices: number[] = [];
  for (let r = startRank; r < startRank + 3; r++) {
    const idx = tiles.findIndex((t, i) =>
      !indices.includes(i) && t.suit === suit && t.rank === r
    );
    if (idx === -1) return null;
    indices.push(idx);
  }
  return indices;
}

export function isSevenPairs(concealed: TileDef[]): boolean {
  if (concealed.length !== 14) return false;
  const groups = groupTiles(concealed);
  let pairs = 0;
  for (const [, group] of groups) {
    if (group.count % 2 !== 0) return false;
    pairs += group.count / 2;
  }
  return pairs === 7;
}
