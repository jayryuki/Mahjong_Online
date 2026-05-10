import React from 'react';

interface TileSVGProps {
  width?: number;
  height?: number;
  selected?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}

export function TileSVG({ width = 48, height = 64, selected, onClick, children }: TileSVGProps) {
  const borderRadius = 6;
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      onClick={onClick}
      style={{
        cursor: onClick ? 'pointer' : 'default',
        filter: selected ? 'brightness(1.05)' : undefined,
        transition: 'filter 120ms ease',
      }}
      role="img"
      aria-label="Mahjong tile"
    >
      <rect
        x={1}
        y={1}
        width={width - 2}
        height={height - 2}
        rx={borderRadius}
        ry={borderRadius}
        fill="var(--tile-face-bg)"
        stroke={selected ? 'var(--accent-warm)' : 'var(--tile-face-border)'}
        strokeWidth={selected ? 2 : 1}
      />
      {children}
    </svg>
  );
}
