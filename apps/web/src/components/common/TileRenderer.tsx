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
  const { theme, themeStyle } = useTheme();
  const imageName = tileToImageName(tile);
  if (!imageName) return null;

  const src = getTileImageUrl(imageName, theme, themeStyle);
  const label = tile.rank ? String(tile.rank) : WIND_LABELS[tile.honorName ?? ''] ?? null;
  const imageFilter = selected
    ? 'var(--mahjong-tile-filter) brightness(1.08) var(--mahjong-tile-symbol-outline-filter)'
    : 'var(--mahjong-tile-filter) var(--mahjong-tile-symbol-outline-filter)';

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
          filter: imageFilter,
          transition: 'filter 120ms ease',
          background: 'var(--tile-face-bg)',
          boxShadow: 'var(--mahjong-tile-outline-shadow)',
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
          color: 'var(--tile-stroke)',
          opacity: 0.72,
          textShadow: 'var(--mahjong-tile-label-outline-shadow)',
          pointerEvents: 'none',
          fontFamily: "'Inter', sans-serif",
        }}>
          {label}
        </span>
      )}
    </div>
  );
}
