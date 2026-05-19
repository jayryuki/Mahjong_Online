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

export interface HandDecomposition {
  melds: MeldCandidate[];
  pair: TileDef[];
}

export function isValidWinningShape(concealed: TileDef[], meldCount: number): boolean {
  const neededMelds = 4 - meldCount;
  const neededTiles = neededMelds * 3 + 2;
  if (concealed.length !== neededTiles) {
    // Also accept seven pairs (14 tiles, 0 melds)
    if (meldCount === 0 && concealed.length === 14 && isSevenPairs(concealed)) return true;
    return false;
  }
  return findWinningDecomposition(concealed, meldCount);
}

export function decomposeWinningHand(concealed: TileDef[], meldCount: number): HandDecomposition | null {
  const neededMelds = 4 - meldCount;
  const neededTiles = neededMelds * 3 + 2;
  if (concealed.length !== neededTiles) return null;
  const sorted = [...concealed].sort((a, b) => tileSortKey(a).localeCompare(tileSortKey(b)));
  const hasWilds = sorted.some(t => t.isWild);
  const result: HandDecomposition = { melds: [], pair: [] };
  if (hasWilds) {
    if (tryDecomposeWithWildsCollecting(sorted, neededMelds, false, result)) return result;
  } else {
    if (tryDecomposeCollecting(sorted, neededMelds, false, result)) return result;
  }
  return null;
}

function findWinningDecomposition(tiles: TileDef[], meldCount: number): boolean {
  const sorted = [...tiles].sort((a, b) => tileSortKey(a).localeCompare(tileSortKey(b)));
  const hasWilds = sorted.some(t => t.isWild);
  if (hasWilds) {
    return tryDecomposeWithWilds(sorted, 4 - meldCount, false);
  }
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

// ---------------------------------------------------------------------------
// Wild-card-aware decomposition
// ---------------------------------------------------------------------------

function tryDecomposeWithWilds(tiles: TileDef[], meldsNeeded: number, pairTaken: boolean): boolean {
  if (tiles.length === 0) return meldsNeeded === 0 && pairTaken;
  if (meldsNeeded < 0) return false;

  const wildIndices = tiles.reduce((acc, t, i) => t.isWild ? [...acc, i] : acc, [] as number[]);
  const nonWildTiles = tiles.filter(t => !t.isWild);
  const wildCount = wildIndices.length;

  // If only wilds remain, they can fill anything needed
  if (nonWildTiles.length === 0) {
    // Wild-only tiles: they can form any melds/pair needed
    const totalTiles = tiles.length;
    const neededForMelds = meldsNeeded * 3;
    const neededForPair = pairTaken ? 0 : 2;
    return totalTiles === neededForMelds + neededForPair;
  }

  const first = tiles.find(t => !t.isWild)!;
  const firstIdx = tiles.indexOf(first);

  // Try pair with first non-wild tile
  if (!pairTaken && tiles.length >= 2) {
    // Pair: first + another same tile, or first + wild
    const sameIdx = tiles.findIndex((t, i) => i !== firstIdx && !t.isWild && tileSortKey(t) === tileSortKey(first));
    if (sameIdx !== -1) {
      const remaining = tiles.filter((_, i) => i !== firstIdx && i !== sameIdx);
      if (tryDecomposeWithWilds(remaining, meldsNeeded, true)) return true;
    }
    // Pair with wild
    if (wildCount > 0) {
      const remaining = tiles.filter((_, i) => i !== firstIdx && i !== wildIndices[0]);
      if (tryDecomposeWithWilds(remaining, meldsNeeded, true)) return true;
    }
    // Pair of two wilds
    if (wildCount >= 2) {
      const remaining = tiles.filter((_, i) => i !== wildIndices[0] && i !== wildIndices[1]);
      if (tryDecomposeWithWilds(remaining, meldsNeeded, true)) return true;
    }
  }

  if (meldsNeeded === 0) return false;

  // Try triplet with first non-wild tile
  // 3 of same
  const sameKeyTiles = tiles.filter((t, i) => i !== firstIdx && !t.isWild && tileSortKey(t) === tileSortKey(first));
  if (sameKeyTiles.length >= 2) {
    const idx2 = tiles.indexOf(sameKeyTiles[0]);
    const idx3 = tiles.indexOf(sameKeyTiles[1], idx2 + 1);
    const remaining = tiles.filter((_, i) => i !== firstIdx && i !== idx2 && i !== idx3);
    if (tryDecomposeWithWilds(remaining, meldsNeeded - 1, pairTaken)) return true;
  }
  // Triplet with 1 wild
  if (sameKeyTiles.length >= 1 && wildCount >= 1) {
    const idx2 = tiles.indexOf(sameKeyTiles[0]);
    const remaining = tiles.filter((_, i) => i !== firstIdx && i !== idx2 && i !== wildIndices[0]);
    if (tryDecomposeWithWilds(remaining, meldsNeeded - 1, pairTaken)) return true;
  }
  // Triplet with 2 wilds
  if (wildCount >= 2) {
    const remaining = tiles.filter((_, i) => i !== firstIdx && i !== wildIndices[0] && i !== wildIndices[1]);
    if (tryDecomposeWithWilds(remaining, meldsNeeded - 1, pairTaken)) return true;
  }

  // Try sequence with first non-wild tile (suited only)
  if (first.suit && first.rank) {
    const suit: string = first.suit;
    const firstRank: number = first.rank;
    for (let startOffset = -2; startOffset <= 0; startOffset++) {
      const startRank: number = firstRank + startOffset;
      if (startRank < 1 || startRank + 2 > 9) continue;

      const neededRanks: number[] = [startRank, startRank + 1, startRank + 2];
      const seqIndices: number[] = [firstIdx];
      let wildsUsed = 0;
      const usedWildIndices = new Set<number>();

      for (const r of neededRanks) {
        if (r === first.rank) continue; // Already have first
        const foundIdx = tiles.findIndex((t, i) =>
          !seqIndices.includes(i) && !usedWildIndices.has(i) && !t.isWild && t.suit === suit && t.rank === r
        );
        if (foundIdx !== -1) {
          seqIndices.push(foundIdx);
        } else if (wildCount - wildsUsed > 0) {
          // Use a wild
          const wildIdx = wildIndices.find(wi => !seqIndices.includes(wi) && !usedWildIndices.has(wi));
          if (wildIdx !== undefined) {
            usedWildIndices.add(wildIdx);
            seqIndices.push(wildIdx);
            wildsUsed++;
          } else {
            break;
          }
        } else {
          break;
        }
      }

      if (seqIndices.length === 3) {
        const remaining = tiles.filter((_, i) => !seqIndices.includes(i));
        if (tryDecomposeWithWilds(remaining, meldsNeeded - 1, pairTaken)) return true;
      }
    }
  }

  // Try sequence with wilds only (3 wilds forming a sequence)
  if (wildCount >= 3 && meldsNeeded > 0) {
    const remaining = tiles.filter((_, i) => i !== wildIndices[0] && i !== wildIndices[1] && i !== wildIndices[2]);
    if (tryDecomposeWithWilds(remaining, meldsNeeded - 1, pairTaken)) return true;
  }

  return false;
}

// ---------------------------------------------------------------------------
// Collecting decomposition variants (return the actual melds found)
// ---------------------------------------------------------------------------

function tryDecomposeCollecting(tiles: TileDef[], meldsNeeded: number, pairTaken: boolean, result: HandDecomposition): boolean {
  if (tiles.length === 0) return meldsNeeded === 0 && pairTaken;
  if (meldsNeeded < 0) return false;

  if (!pairTaken && tiles.length >= 2 && isPair(tiles.slice(0, 2))) {
    result.pair = tiles.slice(0, 2);
    if (tryDecomposeCollecting(tiles.slice(2), meldsNeeded, true, result)) return true;
    result.pair = [];
  }

  if (meldsNeeded === 0) return false;

  if (tiles.length >= 3 && isTriplet(tiles.slice(0, 3))) {
    result.melds.push({ tiles: tiles.slice(0, 3), type: 'pon' });
    if (tryDecomposeCollecting(tiles.slice(3), meldsNeeded - 1, pairTaken, result)) return true;
    result.melds.pop();
  }

  if (tiles.length >= 3 && tiles[0].suit && tiles[0].rank) {
    const suit = tiles[0].suit;
    const rank = tiles[0].rank;
    const seq = findSequenceTiles(tiles, suit, rank);
    if (seq) {
      const seqTiles = seq.map(i => tiles[i]);
      const remaining = tiles.filter((_, i) => !seq.includes(i));
      result.melds.push({ tiles: seqTiles, type: 'chi' });
      if (tryDecomposeCollecting(remaining, meldsNeeded - 1, pairTaken, result)) return true;
      result.melds.pop();
    }
  }

  return false;
}

function tryDecomposeWithWildsCollecting(tiles: TileDef[], meldsNeeded: number, pairTaken: boolean, result: HandDecomposition): boolean {
  if (tiles.length === 0) return meldsNeeded === 0 && pairTaken;
  if (meldsNeeded < 0) return false;

  const wildIndices = tiles.reduce((acc, t, i) => t.isWild ? [...acc, i] : acc, [] as number[]);
  const nonWildTiles = tiles.filter(t => !t.isWild);
  const wildCount = wildIndices.length;

  if (nonWildTiles.length === 0) {
    const totalTiles = tiles.length;
    const neededForMelds = meldsNeeded * 3;
    const neededForPair = pairTaken ? 0 : 2;
    if (totalTiles === neededForMelds + neededForPair) {
      let idx = 0;
      if (!pairTaken) {
        result.pair = tiles.slice(0, 2);
        idx = 2;
      }
      while (idx < tiles.length) {
        result.melds.push({ tiles: tiles.slice(idx, idx + 3), type: 'pon' });
        idx += 3;
      }
      return true;
    }
    return false;
  }

  const first = tiles.find(t => !t.isWild)!;
  const firstIdx = tiles.indexOf(first);

  if (!pairTaken && tiles.length >= 2) {
    const sameIdx = tiles.findIndex((t, i) => i !== firstIdx && !t.isWild && tileSortKey(t) === tileSortKey(first));
    if (sameIdx !== -1) {
      result.pair = [first, tiles[sameIdx]];
      const remaining = tiles.filter((_, i) => i !== firstIdx && i !== sameIdx);
      if (tryDecomposeWithWildsCollecting(remaining, meldsNeeded, true, result)) return true;
      result.pair = [];
    }
    if (wildCount > 0) {
      result.pair = [first, tiles[wildIndices[0]]];
      const remaining = tiles.filter((_, i) => i !== firstIdx && i !== wildIndices[0]);
      if (tryDecomposeWithWildsCollecting(remaining, meldsNeeded, true, result)) return true;
      result.pair = [];
    }
    if (wildCount >= 2) {
      result.pair = [tiles[wildIndices[0]], tiles[wildIndices[1]]];
      const remaining = tiles.filter((_, i) => i !== wildIndices[0] && i !== wildIndices[1]);
      if (tryDecomposeWithWildsCollecting(remaining, meldsNeeded, true, result)) return true;
      result.pair = [];
    }
  }

  if (meldsNeeded === 0) return false;

  const sameKeyTiles = tiles.filter((t, i) => i !== firstIdx && !t.isWild && tileSortKey(t) === tileSortKey(first));
  if (sameKeyTiles.length >= 2) {
    const idx2 = tiles.indexOf(sameKeyTiles[0]);
    const idx3 = tiles.indexOf(sameKeyTiles[1], idx2 + 1);
    result.melds.push({ tiles: [first, tiles[idx2], tiles[idx3]], type: 'pon' });
    const remaining = tiles.filter((_, i) => i !== firstIdx && i !== idx2 && i !== idx3);
    if (tryDecomposeWithWildsCollecting(remaining, meldsNeeded - 1, pairTaken, result)) return true;
    result.melds.pop();
  }
  if (sameKeyTiles.length >= 1 && wildCount >= 1) {
    const idx2 = tiles.indexOf(sameKeyTiles[0]);
    result.melds.push({ tiles: [first, tiles[idx2], tiles[wildIndices[0]]], type: 'pon' });
    const remaining = tiles.filter((_, i) => i !== firstIdx && i !== idx2 && i !== wildIndices[0]);
    if (tryDecomposeWithWildsCollecting(remaining, meldsNeeded - 1, pairTaken, result)) return true;
    result.melds.pop();
  }
  if (wildCount >= 2) {
    result.melds.push({ tiles: [first, tiles[wildIndices[0]], tiles[wildIndices[1]]], type: 'pon' });
    const remaining = tiles.filter((_, i) => i !== firstIdx && i !== wildIndices[0] && i !== wildIndices[1]);
    if (tryDecomposeWithWildsCollecting(remaining, meldsNeeded - 1, pairTaken, result)) return true;
    result.melds.pop();
  }

  if (first.suit && first.rank) {
    const suit: string = first.suit;
    const firstRank: number = first.rank;
    for (let startOffset = -2; startOffset <= 0; startOffset++) {
      const startRank: number = firstRank + startOffset;
      if (startRank < 1 || startRank + 2 > 9) continue;

      const neededRanks: number[] = [startRank, startRank + 1, startRank + 2];
      const seqIndices: number[] = [firstIdx];
      let wildsUsed = 0;
      const usedWildIndices = new Set<number>();

      for (const r of neededRanks) {
        if (r === first.rank) continue;
        const foundIdx = tiles.findIndex((t, i) =>
          !seqIndices.includes(i) && !usedWildIndices.has(i) && !t.isWild && t.suit === suit && t.rank === r
        );
        if (foundIdx !== -1) {
          seqIndices.push(foundIdx);
        } else if (wildCount - wildsUsed > 0) {
          const wildIdx = wildIndices.find(wi => !seqIndices.includes(wi) && !usedWildIndices.has(wi));
          if (wildIdx !== undefined) {
            usedWildIndices.add(wildIdx);
            seqIndices.push(wildIdx);
            wildsUsed++;
          } else {
            break;
          }
        } else {
          break;
        }
      }

      if (seqIndices.length === 3) {
        const seqTiles = seqIndices.map(i => tiles[i]);
        const remaining = tiles.filter((_, i) => !seqIndices.includes(i));
        result.melds.push({ tiles: seqTiles, type: 'chi' });
        if (tryDecomposeWithWildsCollecting(remaining, meldsNeeded - 1, pairTaken, result)) return true;
        result.melds.pop();
      }
    }
  }

  if (wildCount >= 3 && meldsNeeded > 0) {
    result.melds.push({ tiles: [tiles[wildIndices[0]], tiles[wildIndices[1]], tiles[wildIndices[2]]], type: 'chi' });
    const remaining = tiles.filter((_, i) => i !== wildIndices[0] && i !== wildIndices[1] && i !== wildIndices[2]);
    if (tryDecomposeWithWildsCollecting(remaining, meldsNeeded - 1, pairTaken, result)) return true;
    result.melds.pop();
  }

  return false;
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
