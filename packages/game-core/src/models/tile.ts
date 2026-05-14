export type Suit = 'man' | 'pin' | 'sou';
export type HonorType = 'wind' | 'dragon';
export type WindName = 'east' | 'south' | 'west' | 'north';
export type DragonName = 'haku' | 'hatsu' | 'chun';

export interface TileDef {
  id: string;
  suit?: Suit;
  rank?: number;
  honorType?: HonorType;
  honorName?: WindName | DragonName;
  isFlower: boolean;
  flowerIndex?: number;
  isWild?: boolean;
}

export function createSuitedTile(suit: Suit, rank: number, instance: number): TileDef {
  return {
    id: `${suit}-${rank}-${instance}`,
    suit,
    rank,
    isFlower: false,
  };
}

export function createHonorTile(honorName: WindName | DragonName, instance: number): TileDef {
  const honorType: HonorType = ['east', 'south', 'west', 'north'].includes(honorName as string) ? 'wind' : 'dragon';
  return {
    id: `${honorName}-${instance}`,
    honorType,
    honorName,
    isFlower: false,
  };
}

export function tileSortKey(tile: TileDef): string {
  if (tile.suit) {
    const suitOrder: Record<Suit, number> = { man: 0, pin: 1, sou: 2 };
    return `${suitOrder[tile.suit]}${tile.rank!.toString().padStart(2, '0')}`;
  }
  return `9${tile.honorName ?? 'zzz'}`;
}

export function generateFullTileSet(playerCount: 4, flowersEnabled: boolean): TileDef[] {
  const tiles: TileDef[] = [];
  let instance = 0;

  for (const suit of ['man', 'pin', 'sou'] as Suit[]) {
    for (let rank = 1; rank <= 9; rank++) {
      for (let copy = 0; copy < 4; copy++) {
        tiles.push(createSuitedTile(suit, rank, instance++));
      }
    }
  }

  for (const name of ['east', 'south', 'west', 'north', 'haku', 'hatsu', 'chun'] as const) {
    for (let copy = 0; copy < 4; copy++) {
      tiles.push(createHonorTile(name, instance++));
    }
  }

  return tiles;
}
