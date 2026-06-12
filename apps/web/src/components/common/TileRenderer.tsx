import React from 'react';
import { tileToImageName, getTileImageUrl } from '../../lib/tile-theme.js';
import { useTheme } from '../../hooks/useTheme.js';

interface TileRendererProps {
  tile: {
    id?: string;
    suit?: string;
    rank?: number;
    honorName?: string;
  };
  width?: number;
  height?: number;
  selected?: boolean;
  onClick?: () => void;
  isWild?: boolean;
  showWildBadge?: boolean;
  wildBadgeText?: string;
}

const WIND_LABELS: Record<string, string> = { east: 'E', south: 'S', west: 'W', north: 'N' };

export function TileRenderer({
  tile,
  width = 72,
  height = 96,
  selected,
  onClick,
  isWild = false,
  showWildBadge = false,
  wildBadgeText = 'Joker',
}: TileRendererProps) {
  const { theme, themeStyle } = useTheme();
  const imageName = tileToImageName(tile);
  if (!imageName) return null;

  const src = getTileImageUrl(imageName, theme, themeStyle);
  const label = tile.rank ? String(tile.rank) : WIND_LABELS[tile.honorName ?? ''] ?? null;
  const imageFilter = selected
    ? 'var(--mahjong-tile-filter) brightness(1.08) var(--mahjong-tile-symbol-outline-filter)'
    : 'var(--mahjong-tile-filter) var(--mahjong-tile-symbol-outline-filter)';
  const showBadge = isWild && showWildBadge;
  const badgeFontSize = Math.max(6.5, width * 0.125);

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
      {isWild && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: -3,
            borderRadius: '10px',
            background: 'linear-gradient(135deg, rgba(96,165,250,0.95), rgba(192,132,252,0.95), rgba(244,114,182,0.9), rgba(250,204,21,0.95), rgba(52,211,153,0.95), rgba(96,165,250,0.95))',
            backgroundSize: '220% 220%',
            filter: 'blur(1px)',
            opacity: 0.9,
            pointerEvents: 'none',
            animation: 'mjJokerShift 3s linear infinite, mjJokerPulse 2.4s ease-in-out infinite',
          }}
        />
      )}
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
          boxShadow: isWild
            ? '0 0 0 1.5px rgba(255,255,255,0.78), 0 0 14px rgba(192,132,252,0.4), 0 0 28px rgba(250,204,21,0.22), var(--mahjong-tile-outline-shadow)'
            : 'var(--mahjong-tile-outline-shadow)',
          border: selected
            ? '2px solid var(--accent-warm)'
            : isWild
              ? '1.5px solid rgba(255,255,255,0.82)'
              : '1px solid var(--tile-face-border)',
          boxSizing: 'border-box',
          position: 'relative',
          zIndex: 1,
        }}
      />
      {isWild && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 2,
            borderRadius: '6px',
            background: 'linear-gradient(160deg, rgba(255,255,255,0.38) 0%, rgba(255,255,255,0.08) 24%, rgba(96,165,250,0.18) 50%, rgba(244,114,182,0.24) 74%, rgba(250,204,21,0.24) 100%)',
            mixBlendMode: 'screen',
            opacity: 0.9,
            pointerEvents: 'none',
            zIndex: 2,
          }}
        />
      )}
      {showBadge && (
        <span
          style={{
            position: 'absolute',
            top: -8,
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: Math.max(24, width * 0.6),
            padding: width < 40 ? '1px 4px' : '2px 6px',
            borderRadius: '999px',
            background: 'linear-gradient(135deg, rgba(96,165,250,0.95), rgba(192,132,252,0.96), rgba(244,114,182,0.94), rgba(250,204,21,0.95))',
            border: '1px solid rgba(255,255,255,0.5)',
            color: '#fff',
            fontSize: `${badgeFontSize}px`,
            fontWeight: 900,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
            textShadow: '0 1px 2px rgba(0,0,0,0.55)',
            boxShadow: '0 5px 14px rgba(76, 29, 149, 0.28)',
            pointerEvents: 'none',
            zIndex: 4,
          }}
        >
          {wildBadgeText}
        </span>
      )}
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
          zIndex: 3,
        }}>
          {label}
        </span>
      )}
    </div>
  );
}
