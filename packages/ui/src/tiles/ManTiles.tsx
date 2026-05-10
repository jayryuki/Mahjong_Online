import React from 'react';
import { TileSVG } from './TileSVG.js';

const MAN_KANJI = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];

interface ManTileProps {
  rank: number;
  width?: number;
  height?: number;
  selected?: boolean;
  onClick?: () => void;
}

export function ManTile({ rank, width = 48, height = 64, selected, onClick }: ManTileProps) {
  return (
    <TileSVG width={width} height={height} selected={selected} onClick={onClick}>
      <text
        x={width / 2}
        y={height * 0.42}
        textAnchor="middle"
        dominantBaseline="central"
        fill="var(--tile-stroke)"
        fontSize={width * 0.5}
        fontFamily="'Newsreader', Georgia, serif"
        fontWeight="400"
      >
        {MAN_KANJI[rank - 1]}
      </text>
      <text
        x={width / 2}
        y={height * 0.78}
        textAnchor="middle"
        dominantBaseline="central"
        fill="var(--tile-stroke)"
        fontSize={width * 0.22}
        fontFamily="'Inter', sans-serif"
        fontWeight="500"
      >
        {rank}
      </text>
    </TileSVG>
  );
}
