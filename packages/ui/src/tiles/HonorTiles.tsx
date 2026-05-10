import React from 'react';
import { TileSVG } from './TileSVG.js';

const WIND_CHARS: Record<string, string> = { east: '東', south: '南', west: '西', north: '北' };
const DRAGON_CHARS: Record<string, string> = { haku: '白', hatsu: '發', chun: '中' };

interface HonorTileProps {
  honorName: string;
  width?: number;
  height?: number;
  selected?: boolean;
  onClick?: () => void;
}

export function HonorTile({ honorName, width = 48, height = 64, selected, onClick }: HonorTileProps) {
  const char = WIND_CHARS[honorName] ?? DRAGON_CHARS[honorName] ?? '?';
  return (
    <TileSVG width={width} height={height} selected={selected} onClick={onClick}>
      <text
        x={width / 2}
        y={height / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fill="var(--tile-stroke)"
        fontSize={width * 0.55}
        fontFamily="'Newsreader', Georgia, serif"
        fontWeight="400"
      >
        {char}
      </text>
    </TileSVG>
  );
}
