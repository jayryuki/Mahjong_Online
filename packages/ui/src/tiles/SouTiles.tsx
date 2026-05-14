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
  const areaTop = height * 0.10;
  const areaBottom = height * 0.64;
  const totalArea = areaBottom - areaTop;

  // Ensure minimum gap between sticks is at least 1.5x stick height
  const stickH = totalArea / (rank * 2.5);
  const gapH = totalArea / (rank * 2.5) * 1.5;
  const totalNeeded = rank * stickH + (rank - 1) * gapH;
  const scale = totalNeeded > totalArea ? totalArea / totalNeeded : 1;
  const finalStickH = stickH * scale;
  const finalGapH = gapH * scale;
  const startY = areaTop + (totalArea - (rank * finalStickH + Math.max(0, rank - 1) * finalGapH)) / 2;

  const sticks = [];
  for (let i = 0; i < rank; i++) {
    const y = startY + i * (finalStickH + finalGapH);
    sticks.push(
      <rect key={`stick-${i}`} x={cx - width * 0.2} y={y} width={width * 0.4} height={finalStickH} rx={1.5} fill="var(--tile-stroke)" />
    );
  }

  return (
    <TileSVG width={width} height={height} selected={selected} onClick={onClick}>
      {sticks}
      <text
        x={cx}
        y={height * 0.84}
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
