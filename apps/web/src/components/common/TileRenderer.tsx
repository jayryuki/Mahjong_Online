import React from 'react';
import { tileToImageName, getTileImageUrl } from '../../lib/tile-theme.js';
import { useTheme } from '../../hooks/useTheme.js';

interface TileRendererProps {
  tile: {
    suit?: string;
    rank?: number;
    honorName?: string;
  };
  width?: number;
  height?: number;
  selected?: boolean;
  onClick?: () => void;
}

const WIND_LABELS: Record<string, string> = { east: 'E', south: 'S', west: 'W', north: 'N' };

export function TileRenderer({ tile, width = 72, height = 96, selected, onClick }: TileRendererProps) {
  const { theme } = useTheme();
  const imageName = tileToImageName(tile);
  if (!imageName) return null;

  const src = getTileImageUrl(imageName, theme);
  const label = tile.rank ? String(tile.rank) : WIND_LABELS[tile.honorName ?? ''] ?? null;

  return (
    <div
      onClick={onClick}
      style={{
        position: 'relative',
        display: 'inline-block',
        width,
        height,
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <img
        src={src}
        alt={`${tile.suit ?? tile.honorName ?? 'tile'} ${tile.rank ?? ''}`.trim()}
        width={width}
        height={height}
        style={{
          display: 'block',
          borderRadius: '6px',
          objectFit: 'contain',
          filter: selected ? 'brightness(1.05)' : undefined,
          transition: 'filter 120ms ease',
          background: 'var(--tile-face-bg)',
          border: selected ? '2px solid var(--accent-warm)' : '1px solid var(--tile-face-border)',
          boxSizing: 'border-box',
        }}
      />
      {label && (
        <span style={{
          position: 'absolute',
          bottom: 2,
          right: 3,
          fontSize: Math.max(9, width * 0.17),
          fontWeight: 700,
          lineHeight: 1,
          color: 'var(--text-primary)',
          opacity: 0.45,
          pointerEvents: 'none',
          fontFamily: "'Inter', sans-serif",
        }}>
          {label}
        </span>
      )}
    </div>
  );
}
