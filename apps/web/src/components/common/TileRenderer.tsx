import React, { useState, useEffect } from 'react';
import { tileToImageName, getTileImageUrl } from '../../lib/tile-theme.js';
import { getTheme, ThemeId } from '../../lib/theme.js';

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

function useTheme(): ThemeId {
  const [theme, setTheme] = useState<ThemeId>(getTheme);
  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(getTheme()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);
  return theme;
}

export function TileRenderer({ tile, width = 72, height = 96, selected, onClick }: TileRendererProps) {
  const theme = useTheme();
  const imageName = tileToImageName(tile);
  if (!imageName) return null;

  const src = getTileImageUrl(imageName, theme);

  return (
    <img
      src={src}
      alt={`${tile.suit ?? tile.honorName ?? 'tile'} ${tile.rank ?? ''}`.trim()}
      width={width}
      height={height}
      onClick={onClick}
      style={{
        display: 'block',
        cursor: onClick ? 'pointer' : 'default',
        borderRadius: '6px',
        objectFit: 'contain',
        filter: selected ? 'brightness(1.05)' : undefined,
        transition: 'filter 120ms ease',
        background: 'var(--tile-face-bg)',
        border: selected ? '2px solid var(--accent-warm)' : '1px solid var(--tile-face-border)',
        boxSizing: 'border-box',
      }}
    />
  );
}

interface ImageTileBackProps {
  width?: number;
  height?: number;
}

export function ImageTileBack({ width = 72, height = 96 }: ImageTileBackProps) {
  return (
    <img
      src={getTileImageUrl('back')}
      alt="Face-down tile"
      width={width}
      height={height}
      style={{
        display: 'block',
        borderRadius: '6px',
        objectFit: 'contain',
        background: 'var(--tile-back-bg)',
        border: '1px solid var(--tile-face-border)',
        boxSizing: 'border-box',
      }}
    />
  );
}
