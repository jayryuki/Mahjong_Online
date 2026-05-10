import React from 'react';
import { TileSVG } from './TileSVG.js';

interface PinTileProps {
  rank: number;
  width?: number;
  height?: number;
  selected?: boolean;
  onClick?: () => void;
}

function PinCircles({ rank, cx, cy, baseR }: { rank: number; cx: number; cy: number; baseR: number }) {
  const circles: React.ReactElement[] = [];
  const positions = getCirclePositions(rank, cx, cy);

  for (const pos of positions) {
    circles.push(
      <circle key={`o-${pos.x}-${pos.y}`} cx={pos.x} cy={pos.y} r={baseR} fill="none" stroke="var(--tile-stroke)" strokeWidth={1.5} />,
      <circle key={`i-${pos.x}-${pos.y}`} cx={pos.x} cy={pos.y} r={baseR * 0.4} fill="var(--tile-stroke)" />
    );
  }
  return <>{circles}</>;
}

function getCirclePositions(count: number, cx: number, cy: number): { x: number; y: number }[] {
  const r = cx * 0.22;
  switch (count) {
    case 1: return [{ x: cx, y: cy }];
    case 2: return [{ x: cx - r, y: cy }, { x: cx + r, y: cy }];
    case 3: return [{ x: cx, y: cy - r }, { x: cx - r, y: cy + r }, { x: cx + r, y: cy + r }];
    case 4: return [{ x: cx - r, y: cy - r }, { x: cx + r, y: cy - r }, { x: cx - r, y: cy + r }, { x: cx + r, y: cy + r }];
    case 5: return [{ x: cx, y: cy }, { x: cx - r, y: cy - r }, { x: cx + r, y: cy - r }, { x: cx - r, y: cy + r }, { x: cx + r, y: cy + r }];
    case 6: return [{ x: cx - r, y: cy - r }, { x: cx + r, y: cy - r }, { x: cx - r, y: cy }, { x: cx + r, y: cy }, { x: cx - r, y: cy + r }, { x: cx + r, y: cy + r }];
    case 7: return [{ x: cx, y: cy - r * 1.2 }, { x: cx - r, y: cy - r * 0.2 }, { x: cx + r, y: cy - r * 0.2 }, { x: cx - r, y: cy + r * 0.7 }, { x: cx + r, y: cy + r * 0.7 }, { x: cx - r * 0.5, y: cy + r * 1.5 }, { x: cx + r * 0.5, y: cy + r * 1.5 }];
    case 8: return [{ x: cx - r, y: cy - r * 1.2 }, { x: cx + r, y: cy - r * 1.2 }, { x: cx - r, y: cy }, { x: cx + r, y: cy }, { x: cx - r, y: cy + r * 0.8 }, { x: cx + r, y: cy + r * 0.8 }, { x: cx, y: cy - r * 0.6 }, { x: cx, y: cy + r * 1.6 }];
    case 9: return [{ x: cx - r, y: cy - r * 1.2 }, { x: cx, y: cy - r * 1.2 }, { x: cx + r, y: cy - r * 1.2 }, { x: cx - r, y: cy }, { x: cx, y: cy }, { x: cx + r, y: cy }, { x: cx - r, y: cy + r * 1.0 }, { x: cx, y: cy + r * 1.0 }, { x: cx + r, y: cy + r * 1.0 }];
    default: return [{ x: cx, y: cy }];
  }
}

export function PinTile({ rank, width = 48, height = 64, selected, onClick }: PinTileProps) {
  const baseR = width * 0.07;
  return (
    <TileSVG width={width} height={height} selected={selected} onClick={onClick}>
      <PinCircles rank={rank} cx={width / 2} cy={height / 2} baseR={baseR} />
    </TileSVG>
  );
}
