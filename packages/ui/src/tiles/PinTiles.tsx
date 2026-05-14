import React from 'react';
import { TileSVG } from './TileSVG.js';

interface PinTileProps {
  rank: number;
  width?: number;
  height?: number;
  selected?: boolean;
  onClick?: () => void;
}

function PinCircles({ rank, cx, cy, baseR, spacing }: { rank: number; cx: number; cy: number; baseR: number; spacing: number }) {
  const circles: React.ReactElement[] = [];
  const positions = getCirclePositions(rank, cx, cy, spacing);

  for (const pos of positions) {
    circles.push(
      <circle key={`o-${pos.x.toFixed(1)}-${pos.y.toFixed(1)}`} cx={pos.x} cy={pos.y} r={baseR} fill="none" stroke="var(--tile-stroke)" strokeWidth={1.2} />,
      <circle key={`i-${pos.x.toFixed(1)}-${pos.y.toFixed(1)}`} cx={pos.x} cy={pos.y} r={baseR * 0.4} fill="var(--tile-stroke)" />
    );
  }
  return <>{circles}</>;
}

function getCirclePositions(count: number, cx: number, cy: number, r: number): { x: number; y: number }[] {
  switch (count) {
    case 1: return [{ x: cx, y: cy }];
    case 2: return [{ x: cx - r, y: cy }, { x: cx + r, y: cy }];
    case 3: return [{ x: cx, y: cy - r }, { x: cx - r, y: cy + r }, { x: cx + r, y: cy + r }];
    case 4: return [{ x: cx - r, y: cy - r }, { x: cx + r, y: cy - r }, { x: cx - r, y: cy + r }, { x: cx + r, y: cy + r }];
    case 5: return [{ x: cx, y: cy }, { x: cx - r, y: cy - r }, { x: cx + r, y: cy - r }, { x: cx - r, y: cy + r }, { x: cx + r, y: cy + r }];
    case 6: return [{ x: cx - r, y: cy - r }, { x: cx + r, y: cy - r }, { x: cx - r, y: cy }, { x: cx + r, y: cy }, { x: cx - r, y: cy + r }, { x: cx + r, y: cy + r }];
    case 7: return [{ x: cx, y: cy - r * 1.4 }, { x: cx - r, y: cy - r * 0.3 }, { x: cx + r, y: cy - r * 0.3 }, { x: cx - r, y: cy + r * 0.7 }, { x: cx + r, y: cy + r * 0.7 }, { x: cx - r * 0.5, y: cy + r * 1.6 }, { x: cx + r * 0.5, y: cy + r * 1.6 }];
    case 8: return [{ x: cx - r, y: cy - r * 1.3 }, { x: cx + r, y: cy - r * 1.3 }, { x: cx - r, y: cy - r * 0.1 }, { x: cx + r, y: cy - r * 0.1 }, { x: cx - r, y: cy + r * 0.9 }, { x: cx + r, y: cy + r * 0.9 }, { x: cx, y: cy - r * 0.7 }, { x: cx, y: cy + r * 1.7 }];
    case 9: return [{ x: cx - r, y: cy - r * 1.3 }, { x: cx, y: cy - r * 1.3 }, { x: cx + r, y: cy - r * 1.3 }, { x: cx - r, y: cy }, { x: cx, y: cy }, { x: cx + r, y: cy }, { x: cx - r, y: cy + r * 1.1 }, { x: cx, y: cy + r * 1.1 }, { x: cx + r, y: cy + r * 1.1 }];
    default: return [{ x: cx, y: cy }];
  }
}

export function PinTile({ rank, width = 48, height = 64, selected, onClick }: PinTileProps) {
  // Available drawing area for the circles
  const areaW = width * 0.65;
  const areaH = height * 0.52;
  // Spacing between circle centers - generous to avoid overlap
  const cols = rank >= 7 ? 3 : (rank >= 4 ? 2 : (rank >= 2 ? 2 : 1));
  const rows = rank >= 7 ? 3 : (rank >= 4 ? 2 : (rank === 3 ? 2 : 1));
  const spacingX = areaW / (cols + 0.5);
  const spacingY = areaH / (rows + 0.5);
  const spacing = Math.min(spacingX, spacingY);
  // Circle radius: about 30% of half-spacing so they're clearly separated
  const baseR = spacing * 0.30;
  return (
    <TileSVG width={width} height={height} selected={selected} onClick={onClick}>
      <PinCircles rank={rank} cx={width / 2} cy={height * 0.36} baseR={baseR} spacing={spacing} />
      <text
        x={width / 2}
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
