import React from 'react';

interface TileBackProps {
  width?: number;
  height?: number;
}

export function TileBack({ width = 48, height = 64 }: TileBackProps) {
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Face-down tile">
      <rect
        x={1} y={1} width={width - 2} height={height - 2}
        rx={6} ry={6}
        fill="var(--tile-back-bg)"
        stroke="var(--tile-face-border)"
        strokeWidth={1}
      />
      <rect
        x={width * 0.2} y={height * 0.15}
        width={width * 0.6} height={height * 0.7}
        rx={3} ry={3}
        fill="none"
        stroke="var(--tile-face-border)"
        strokeWidth={1}
        opacity={0.4}
      />
    </svg>
  );
}
