import { TileDef, tileSortKey } from '../models/tile.js';
import { Meld } from '../models/meld.js';

export interface PatternMatch {
  id: string;
  name: string;
  hanValue: number;
  description: string;
}

export function evaluatePatterns(
  concealed: TileDef[],
  melds: Meld[],
  winType: 'ron' | 'tsumo',
  seatWind: 'east' | 'south' | 'west' | 'north',
  roundWind: 'east' | 'south' | 'west' | 'north',
): PatternMatch[] {
  const patterns: PatternMatch[] = [];
  const allTiles = [...concealed, ...melds.flatMap(m => m.tiles)];
  const isConcealed = melds.every(m => m.isConcealed) && melds.length === 0;

  if (isTanyao(allTiles)) {
    patterns.push({ id: 'tanyao', name: 'Tanyao', hanValue: 1, description: 'All simples — no terminals or honors' });
  }

  const windDragonPatterns = findYakuhai(allTiles, seatWind, roundWind);
  patterns.push(...windDragonPatterns);

  if (isConcealed && isPinfu(concealed, melds, winType)) {
    patterns.push({ id: 'pinfu', name: 'Pinfu', hanValue: 1, description: 'No-fu concealed hand' });
  }

  if (isToitoi(melds, concealed)) {
    patterns.push({ id: 'toitoi', name: 'Toitoi', hanValue: 2, description: 'All triplets' });
  }

  if (isConcealed && winType === 'tsumo') {
    patterns.push({ id: 'menzen-tsumo', name: 'Menzen Tsumo', hanValue: 1, description: 'Concealed self-draw' });
  }

  if (isChanta(allTiles, melds)) {
    patterns.push({ id: 'chanta', name: 'Chanta', hanValue: isConcealed ? 2 : 1, description: 'Half outside hand' });
  }

  return patterns;
}

function isTanyao(tiles: TileDef[]): boolean {
  return tiles.every(t => t.suit && t.rank! >= 2 && t.rank! <= 8);
}

function findYakuhai(tiles: TileDef[], seatWind: string, roundWind: string): PatternMatch[] {
  const patterns: PatternMatch[] = [];
  const groups = new Map<string, number>();
  for (const t of tiles) {
    const key = tileSortKey(t);
    groups.set(key, (groups.get(key) ?? 0) + 1);
  }

  for (const [key, count] of groups) {
    if (count < 3) continue;
    if (key.includes('haku')) {
      patterns.push({ id: 'yakuhai-haku', name: 'Haku', hanValue: 1, description: 'White dragon triplet' });
    }
    if (key.includes('hatsu')) {
      patterns.push({ id: 'yakuhai-hatsu', name: 'Hatsu', hanValue: 1, description: 'Green dragon triplet' });
    }
    if (key.includes('chun')) {
      patterns.push({ id: 'yakuhai-chun', name: 'Chun', hanValue: 1, description: 'Red dragon triplet' });
    }
    // Wind yakuhai: round wind and seat wind triplets
    const windNames: Array<'east' | 'south' | 'west' | 'north'> = ['east', 'south', 'west', 'north'];
    for (const wind of windNames) {
      if (key.includes(wind)) {
        if (wind === roundWind) {
          const capWind = wind.charAt(0).toUpperCase() + wind.slice(1);
          patterns.push({ id: `yakuhai-round-${wind}`, name: `Round Wind (${capWind})`, hanValue: 1, description: 'Round wind triplet' });
        }
        if (wind === seatWind) {
          const capWind = wind.charAt(0).toUpperCase() + wind.slice(1);
          patterns.push({ id: `yakuhai-seat-${wind}`, name: `Seat Wind (${capWind})`, hanValue: 1, description: 'Seat wind triplet' });
        }
      }
    }
  }

  return patterns;
}

function isPinfu(concealed: TileDef[], melds: Meld[], winType: 'ron' | 'tsumo'): boolean {
  return melds.length === 0 && winType === 'tsumo';
}

function isToitoi(melds: Meld[], concealed: TileDef[]): boolean {
  if (melds.length === 0) return false;
  return melds.every(m => m.type === 'pon' || m.type.startsWith('kan'));
}

function isChanta(tiles: TileDef[], melds: Meld[]): boolean {
  // Chanta: every block contains at least one terminal or honor
  // Approximate: all suited tiles must be rank 1-3 or 7-9, ensuring any possible sequence touches a terminal
  // Also must contain at least one terminal or honor (otherwise it's just tanyao)
  const hasTerminalOrHonor = tiles.some(t => !t.suit || t.rank === 1 || t.rank === 9);
  if (!hasTerminalOrHonor) return false;
  return tiles.every(t =>
    !t.suit || t.rank! <= 3 || t.rank! >= 7
  );
}
