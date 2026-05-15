import React from 'react';
import { TileSVG } from './TileSVG.js';

const WIND_CHARS: Record<string, string> = { east: '東', south: '南', west: '西', north: '北' };
const WIND_LABELS: Record<string, string> = { east: 'E', south: 'S', west: 'W', north: 'N' };
const DRAGON_CHARS: Record<string, string> = { haku: '白', hatsu: '發', chun: '中' };

interface HonorTileProps {
  honorName: string;
  width?: number;
  height?: number;
  selected?: boolean;
  onClick?: () => void;
}

export function HonorTile({ honorName, width = 48, height = 64, selected, onClick }: HonorTileProps) {
  const isWind = honorName in WIND_CHARS;
  const char = WIND_CHARS[honorName] ?? DRAGON_CHARS[honorName] ?? '?';
  return (
    <TileSVG width={width} height={height} selected={selected} onClick={onClick}>
      <text
        x={width / 2}
        y={isWind ? height * 0.38 : height / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fill="var(--tile-stroke)"
        fontSize={width * (isWind ? 0.38 : 0.42)}
        fontFamily="'Newsreader', Georgia, serif"
        fontWeight="400"
      >
        {char}
      </text>
      {isWind && (
        <text
          x={width / 2}
          y={height * 0.76}
          textAnchor="middle"
          dominantBaseline="central"
          fill="var(--tile-stroke)"
          fontSize={width * 0.22}
          fontFamily="'Inter', sans-serif"
          fontWeight="700"
        >
          {WIND_LABELS[honorName]}
        </text>
      )}
    </TileSVG>
  );
}
