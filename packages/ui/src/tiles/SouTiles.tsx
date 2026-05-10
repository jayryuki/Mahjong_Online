import React from 'react';
import { TileSVG } from './TileSVG.js';

interface SouTileProps {
  rank: number;
  width?: number;
  height?: number;
  selected?: boolean;
  onClick?: () => void;
}

export function SouTile({ rank, width = 48, height = 64, selected, onClick }: SouTileProps) {
  const cx = width / 2;
  const stickHeight = height * 0.12;
  const startY = height * 0.15;
  const gap = (height * 0.7) / rank;

  const sticks = [];
  for (let i = 0; i < rank; i++) {
    const y = startY + i * gap;
    sticks.push(
      <rect key={`stick-${i}`} x={cx - width * 0.2} y={y} width={width * 0.4} height={stickHeight} rx={2} fill="var(--tile-stroke)" />
    );
  }

  return (
    <TileSVG width={width} height={height} selected={selected} onClick={onClick}>
      {sticks}
    </TileSVG>
  );
}
