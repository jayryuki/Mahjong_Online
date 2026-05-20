import { TileDef, tileSortKey } from '../models/tile.js';
import { Meld } from '../models/meld.js';
import { isSevenPairs } from './validator.js';

export interface HKFanMatch {
  id: string;
  name: string;
  fanValue: number;
  description: string;
}

export function evaluateHKPatterns(
  concealed: TileDef[],
  melds: Meld[],
  winType: 'tsumo' | 'ron',
  seatWind: 'east' | 'south' | 'west' | 'north',
  roundWind: 'east' | 'south' | 'west' | 'north',
): HKFanMatch[] {
  const patterns: HKFanMatch[] = [];
  const allTiles = [...concealed, ...melds.flatMap(m => m.tiles)];
  const isConcealed = melds.length === 0 || melds.every(m => m.isConcealed);

  // Gang / Kong (1 fan per gang)
  const gangCount = melds.filter(m => m.type === 'kan-open' || m.type === 'kan-closed' || m.type === 'kan-added').length;
  for (let gi = 0; gi < gangCount; gi++) {
    patterns.push({ id: `gang-${gi}`, name: 'Gang (槓)', fanValue: 1, description: 'Four of a kind' });
  }

  // Dragon pungs
  const dragonPungs = countDragonPungs(allTiles);
  if (dragonPungs.includes('haku')) patterns.push({ id: 'dragon-haku', name: 'Dragon Pung (白板)', fanValue: 1, description: 'White dragon triplet' });
  if (dragonPungs.includes('hatsu')) patterns.push({ id: 'dragon-hatsu', name: 'Dragon Pung (發財)', fanValue: 1, description: 'Green dragon triplet' });
  if (dragonPungs.includes('chun')) patterns.push({ id: 'dragon-chun', name: 'Dragon Pung (紅中)', fanValue: 1, description: 'Red dragon triplet' });

  // Wind pungs
  const windPungs = countWindPungs(allTiles);
  for (const wind of windPungs) {
    if (wind === roundWind) {
      const capWind = wind.charAt(0).toUpperCase() + wind.slice(1);
      patterns.push({ id: `round-wind-${wind}`, name: `Round Wind (${capWind})`, fanValue: 1, description: 'Round wind triplet' });
    }
    if (wind === seatWind) {
      const capWind = wind.charAt(0).toUpperCase() + wind.slice(1);
      patterns.push({ id: `seat-wind-${wind}`, name: `Seat Wind (${capWind})`, fanValue: 1, description: 'Seat wind triplet' });
    }
  }

  // All Pung (2 fan)
  if (isAllPung(melds, concealed)) {
    patterns.push({ id: 'all-pung', name: 'All Pung', fanValue: 2, description: 'All triplets, no sequences' });
  }

  // Mixed One Suit / Half Flush (2 fan)
  if (isHalfFlush(allTiles)) {
    patterns.push({ id: 'half-flush', name: 'Half Flush', fanValue: 2, description: 'Honors + one suit only' });
  }

  // All Tiles in Hand / Concealed Self-Draw (3 fan)
  if (isConcealed && winType === 'tsumo') {
    patterns.push({ id: 'concealed-self-draw', name: 'All Tiles in Hand', fanValue: 3, description: 'Concealed hand, self-drawn' });
  }

  // Small Dragons (3 fan)
  if (isSmallDragons(allTiles)) {
    patterns.push({ id: 'small-dragons', name: 'Small Dragons', fanValue: 3, description: 'Two dragon pungs + one dragon pair' });
  }

  // Big Dragons (4 fan) — overrides small dragons
  if (isBigDragons(allTiles)) {
    // Remove small dragons if present
    const smallIdx = patterns.findIndex(p => p.id === 'small-dragons');
    if (smallIdx !== -1) patterns.splice(smallIdx, 1);
    patterns.push({ id: 'big-dragons', name: 'Big Dragons', fanValue: 4, description: 'Three dragon pungs' });
  }

  // Small Winds (4 fan)
  if (isSmallWinds(allTiles)) {
    patterns.push({ id: 'small-winds', name: 'Small Winds', fanValue: 4, description: 'Three wind pungs + one wind pair' });
  }

  // Full Flush (6 fan) — overrides half flush
  if (isFullFlush(allTiles)) {
    const halfIdx = patterns.findIndex(p => p.id === 'half-flush');
    if (halfIdx !== -1) patterns.splice(halfIdx, 1);
    patterns.push({ id: 'full-flush', name: 'Full Flush', fanValue: 7, description: 'All tiles from one suit, no honors' });
  }

  // Thirteen Orphans (13 fan)
  if (isThirteenOrphans(concealed)) {
    patterns.length = 0;
    patterns.push({ id: 'thirteen-orphans', name: 'Thirteen Orphans', fanValue: 13, description: 'One of each terminal + honor + one duplicate' });
    return patterns;
  }

  // Nine Gates (8 fan)
  if (isNineGates(concealed)) {
    patterns.length = 0;
    patterns.push({ id: 'nine-gates', name: 'Nine Gates', fanValue: 8, description: '1-1-1-2-3-4-5-6-7-8-9-9-9 + any same suit' });
    return patterns;
  }

  // Seven Pairs (2 fan)
  if (melds.length === 0 && isSevenPairs(concealed)) {
    patterns.length = 0;
    patterns.push({ id: 'seven-pairs', name: 'Seven Pairs', fanValue: 2, description: 'Seven distinct pairs' });
    return patterns;
  }

  // Common Hand (1 fan) — all sequences + non-value pair
  if (patterns.length === 0 && melds.length === 0 && isCommonHand(concealed, seatWind, roundWind)) {
    patterns.push({ id: 'common-hand', name: 'Common Hand', fanValue: 1, description: 'All sequences, non-value pair' });
    return patterns;
  }

  // No chicken hand in wild card mode — every winning hand is worth at least 1 fan
  if (patterns.length === 0) {
    patterns.push({ id: 'base-win', name: 'Winning Hand', fanValue: 1, description: 'Base value for any winning hand' });
  }

  return patterns;
}

function countDragonPungs(tiles: TileDef[]): string[] {
  const groups = new Map<string, number>();
  for (const t of tiles) {
    if (t.honorType === 'dragon') {
      const key = tileSortKey(t);
      groups.set(key, (groups.get(key) ?? 0) + 1);
    }
  }
  const result: string[] = [];
  for (const [key, count] of groups) {
    if (count >= 3) {
      if (key.includes('haku')) result.push('haku');
      if (key.includes('hatsu')) result.push('hatsu');
      if (key.includes('chun')) result.push('chun');
    }
  }
  return result;
}

function countWindPungs(tiles: TileDef[]): string[] {
  const groups = new Map<string, number>();
  for (const t of tiles) {
    if (t.honorType === 'wind') {
      const key = tileSortKey(t);
      groups.set(key, (groups.get(key) ?? 0) + 1);
    }
  }
  const result: string[] = [];
  const winds = ['east', 'south', 'west', 'north'];
  for (const [key, count] of groups) {
    if (count >= 3) {
      for (const w of winds) {
        if (key.includes(w)) result.push(w);
      }
    }
  }
  return result;
}

function isAllPung(melds: Meld[], concealed: TileDef[]): boolean {
  // Check that all melds are pungs/kans
  if (!melds.every(m => m.type === 'pon' || m.type.startsWith('kan'))) return false;

  // Decompose concealed tiles and verify all groups are pungs (no sequences)
  const groups = new Map<string, number>();
  for (const t of concealed) {
    const key = tileSortKey(t);
    groups.set(key, (groups.get(key) ?? 0) + 1);
  }
  const counts = Array.from(groups.values());
  // Must have exactly one pair and all other groups must be triplets
  if (counts.filter(c => c === 2).length !== 1) return false;
  if (!counts.every(c => c === 3 || c === 2)) return false;

  // Verify no sequences can be formed (count heuristic can false-positive)
  // Check that no three consecutive suited tiles exist that would form a sequence
  const suited = concealed.filter(t => t.suit).sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
  const bySuit = new Map<string, number[]>();
  for (const t of suited) {
    if (!bySuit.has(t.suit!)) bySuit.set(t.suit!, []);
    bySuit.get(t.suit!)!.push(t.rank!);
  }
  for (const [, ranks] of bySuit) {
    const sorted = [...ranks].sort((a, b) => a - b);
    // Check if there are 3 consecutive ranks that aren't all part of the same triplet
    for (let i = 0; i < sorted.length - 2; i++) {
      if (sorted[i + 1] === sorted[i] + 1 && sorted[i + 2] === sorted[i] + 2) {
        // Found consecutive ranks - check if they're all the same count (triplet) or different (sequence)
        const r1 = sorted[i], r2 = sorted[i + 1], r3 = sorted[i + 2];
        const c1 = groups.get(`${suited.find(t => t.suit === suited[0]?.suit && t.rank === r1)?.suit}-${r1}`) ?? 0;
        const c2 = groups.get(`${suited.find(t => t.suit === suited[0]?.suit && t.rank === r2)?.suit}-${r2}`) ?? 0;
        const c3 = groups.get(`${suited.find(t => t.suit === suited[0]?.suit && t.rank === r3)?.suit}-${r3}`) ?? 0;
        // If each has exactly 1, they form a sequence, not pungs
        if (c1 === 1 && c2 === 1 && c3 === 1) return false;
      }
    }
  }

  return true;
}

function isHalfFlush(tiles: TileDef[]): boolean {
  const suits = new Set(tiles.filter(t => t.suit).map(t => t.suit));
  const hasHonor = tiles.some(t => t.honorType);
  return suits.size === 1 && hasHonor;
}

function isFullFlush(tiles: TileDef[]): boolean {
  const suits = new Set(tiles.filter(t => t.suit).map(t => t.suit));
  const hasHonor = tiles.some(t => t.honorType);
  return suits.size === 1 && !hasHonor;
}

function isCommonHand(
  concealed: TileDef[],
  seatWind: 'east' | 'south' | 'west' | 'north',
  roundWind: 'east' | 'south' | 'west' | 'north',
): boolean {
  // Must be 14 tiles (concealed hand with no melds)
  if (concealed.length !== 14) return false;

  // All tiles must be suited (no honors)
  if (concealed.some(t => !t.suit)) return false;

  // Check if pair is a value pair (dragon, seat wind, or round wind)
  const groups = new Map<string, TileDef[]>();
  for (const t of concealed) {
    const key = tileSortKey(t);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(t);
  }

  let pairCount = 0;
  let sequenceCount = 0;
  const valuePairNames = new Set(['haku', 'hatsu', 'chun', seatWind, roundWind]);

  for (const [key, tiles] of groups) {
    if (tiles.length === 2) {
      pairCount++;
      // Check if this pair is a value pair
      const tile = tiles[0];
      if (tile.honorType && valuePairNames.has(tile.honorName!)) return false;
      if (!tile.honorType && valuePairNames.has(tile.suit!)) return false; // shouldn't happen but safe
    }
  }

  // Must have exactly one pair
  if (pairCount !== 1) return false;

  // Check that the hand decomposes as all sequences + one pair
  // Use a simple check: try to find 4 sequences in the remaining tiles after removing the pair
  const sorted = [...concealed].sort((a, b) => tileSortKey(a).localeCompare(tileSortKey(b)));
  return canDecomposeAllSequences(sorted);
}

function canDecomposeAllSequences(tiles: TileDef[]): boolean {
  if (tiles.length === 0) return true;
  if (tiles.length < 3) return false;

  // Try to form a sequence starting with the first tile
  const first = tiles[0];
  if (!first.suit) return false;

  // Try sequence: first, first+1, first+2
  const secondKey = `${first.suit}-${(first.rank ?? 0) + 1}`;
  const thirdKey = `${first.suit}-${(first.rank ?? 0) + 2}`;

  const secondIdx = tiles.findIndex((t, i) => i > 0 && tileSortKey(t) === secondKey);
  const thirdIdx = tiles.findIndex((t, i) => i > 0 && tileSortKey(t) === thirdKey);

  if (secondIdx !== -1 && thirdIdx !== -1) {
    const remaining = tiles.filter((_, i) => i !== 0 && i !== secondIdx && i !== thirdIdx);
    if (canDecomposeAllSequences(remaining)) return true;
  }

  // Try triplet (same tile 3 times) - this would NOT be a sequence, so fail
  // Actually, for common hand, we need ALL sequences. If first tile can't form a sequence, fail.
  return false;
}

function isSmallDragons(tiles: TileDef[]): boolean {
  const dragonPungs = countDragonPungs(tiles);
  if (dragonPungs.length < 2) return false;
  // Check for a dragon pair among the remaining tiles
  const dragonNames = ['haku', 'hatsu', 'chun'];
  const groups = new Map<string, number>();
  for (const t of tiles) {
    if (t.honorType === 'dragon') {
      const key = tileSortKey(t);
      groups.set(key, (groups.get(key) ?? 0) + 1);
    }
  }
  // Need at least 2 pungs + 1 pair from dragons
  let pungCount = 0;
  let pairCount = 0;
  for (const [key, count] of groups) {
    if (count >= 3) pungCount++;
    if (count === 2) pairCount++;
    // A kan counts as pung + 1 extra
    if (count === 4) { pungCount++; pairCount++; }
  }
  return pungCount >= 2 && pairCount >= 1;
}

function isBigDragons(tiles: TileDef[]): boolean {
  const dragonPungs = countDragonPungs(tiles);
  return dragonPungs.length === 3;
}

function isSmallWinds(tiles: TileDef[]): boolean {
  const windPungs = countWindPungs(tiles);
  if (windPungs.length < 3) return false;
  // Check for a wind pair
  const groups = new Map<string, number>();
  for (const t of tiles) {
    if (t.honorType === 'wind') {
      const key = tileSortKey(t);
      groups.set(key, (groups.get(key) ?? 0) + 1);
    }
  }
  for (const [, count] of groups) {
    if (count === 2) return true;
  }
  return false;
}

function isThirteenOrphans(concealed: TileDef[]): boolean {
  if (concealed.length !== 14) return false;

  const wilds = concealed.filter(t => t.isWild);
  const nonWilds = concealed.filter(t => !t.isWild);

  // All non-wild tiles must be terminals or honors
  for (const t of nonWilds) {
    if (t.suit && t.rank !== 1 && t.rank !== 9) return false;
    if (!t.suit && !t.honorName) return false;
  }

  // Count unique required types among non-wilds
  const requiredTerminals = ['man1', 'man9', 'pin1', 'pin9', 'sou1', 'sou9'];
  const requiredHonors = ['east', 'south', 'west', 'north', 'haku', 'hatsu', 'chun'];
  const allRequired = [...requiredTerminals, ...requiredHonors]; // 12 types total

  const covered = new Set<string>();
  for (const t of nonWilds) {
    if (t.suit && (t.rank === 1 || t.rank === 9)) {
      covered.add(t.suit + t.rank);
    } else if (t.honorName) {
      covered.add(t.honorName);
    }
  }

  const missing = allRequired.filter(k => !covered.has(k));
  const wildCount = wilds.length;

  // Need wilds to cover all missing types, with at least 1 wild or duplicate remaining for the pair
  if (missing.length > wildCount) return false;

  const remainingWilds = wildCount - missing.length;
  // Need at least 1 tile for the pair: either a remaining wild, or a duplicate among non-wilds
  if (remainingWilds >= 1) return true;

  // No wilds left for pair - check if there's a duplicate among non-wilds
  const keys = nonWilds.map(t => t.suit ? `${t.suit}-${t.rank}` : t.honorName ?? '');
  const seen = new Set<string>();
  for (const k of keys) {
    if (seen.has(k)) return true; // duplicate found = pair
    seen.add(k);
  }

  return false;
}

function isNineGates(concealed: TileDef[]): boolean {
  if (concealed.length !== 14) return false;

  const wilds = concealed.filter(t => t.isWild);
  const nonWilds = concealed.filter(t => !t.isWild);

  // All non-wild tiles must be from one suit
  const nonWildSuits = new Set(nonWilds.filter(t => t.suit).map(t => t.suit));
  if (nonWildSuits.size > 1) return false;
  // If no non-wild tiles, wilds alone can't form Nine Gates (need a suit identity)
  if (nonWildSuits.size === 0) return false;

  const suit = nonWilds.find(t => t.suit)!.suit!;

  // All non-wild tiles must be this suit
  if (!nonWilds.every(t => t.suit === suit)) return false;

  // Count ranks from non-wilds
  const rankCounts = new Map<number, number>();
  for (const t of nonWilds) {
    if (t.suit === suit && t.rank) {
      rankCounts.set(t.rank, (rankCounts.get(t.rank) ?? 0) + 1);
    }
  }

  // Check: at least one 1, at least one 9, one each of 2-8 (using wilds to fill gaps)
  const wildCount = wilds.length;
  let wildsAvailable = wildCount;

  if ((rankCounts.get(1) ?? 0) < 1) {
    if (wildsAvailable <= 0) return false;
    wildsAvailable--;
  }
  if ((rankCounts.get(9) ?? 0) < 1) {
    if (wildsAvailable <= 0) return false;
    wildsAvailable--;
  }
  for (let r = 2; r <= 8; r++) {
    if ((rankCounts.get(r) ?? 0) < 1) {
      if (wildsAvailable <= 0) return false;
      wildsAvailable--;
    }
  }

  return true;
}
