/** Map a TileDef to the classic SVG filename (no extension). */
export function tileToImageName(tile: {
  suit?: string;
  rank?: number;
  honorName?: string;
}): string | null {
  if (tile.suit === 'pin' && tile.rank) return `svg/${String(16 + tile.rank).padStart(2, '0')}-circles-${tile.rank}`;
  if (tile.suit === 'sou' && tile.rank) return `svg/${String(25 + tile.rank).padStart(2, '0')}-bamboos-${tile.rank}`;
  if (tile.suit === 'man' && tile.rank) return `svg/${String(7 + tile.rank).padStart(2, '0')}-characters-${tile.rank}`;
  if (tile.honorName === 'east') return 'svg/04-east-wind';
  if (tile.honorName === 'south') return 'svg/05-south-wind';
  if (tile.honorName === 'west') return 'svg/06-west-wind';
  if (tile.honorName === 'north') return 'svg/07-north-wind';
  if (tile.honorName === 'chun') return 'svg/03-red-dragon';
  if (tile.honorName === 'hatsu') return 'svg/02-green-dragon';
  if (tile.honorName === 'haku') return 'svg/01-white-dragon';
  return null;
}

export function getTileImageUrl(imageName: string): string {
  if (imageName === 'back') return '/tiles/classic/back.png';
  return `/tiles/classic/${imageName}.svg`;
}
