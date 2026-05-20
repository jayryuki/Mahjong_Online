import React, { useState, useEffect, useRef, useCallback } from 'react';
import { TileRenderer } from '../common/TileRenderer.js';
import { useScale } from '../../hooks/useScale.js';
import { TileDef, tileSortKey } from '@mahjong/game-core';
import { parseTileId } from '../../lib/tile-utils.js';

/** Minimum tile width before we allow wrapping to more rows */
const MIN_TILE_W = 36;
/** Aspect ratio: width / height = 1 / 1.4 */
const TILE_ASPECT = 1.4;

interface HandAreaProps {
  tiles: TileDef[];
  drawnTileId: string | null;
  canDiscard?: boolean;
  onDiscard?: (tile: TileDef) => void;
  wildCardTileId?: string | null;
  onReorder?: (newTiles: TileDef[]) => void;
  availableHeight?: number;
  selectedIndex?: number | null;
  onSelectionChange?: (index: number | null) => void;
}

export function HandArea({ tiles, drawnTileId, canDiscard = true, onDiscard, wildCardTileId, onReorder, availableHeight, selectedIndex: controlledSelectedIndex, onSelectionChange }: HandAreaProps) {
  const [internalSelectedIndex, setInternalSelectedIndex] = useState<number | null>(null);
  const selectedIndex = controlledSelectedIndex !== undefined ? controlledSelectedIndex : internalSelectedIndex;
  const setSelectedIndex = onSelectionChange ?? setInternalSelectedIndex;

  const [discardingId, setDiscardingId] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  useEffect(() => { setSelectedIndex(null); }, [tiles]);

  const tileRowRef = useRef<HTMLDivElement>(null);
  const [measuredWidth, setMeasuredWidth] = useState(0);

  useEffect(() => {
    const el = tileRowRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      setMeasuredWidth(entries[0].contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const handleDiscard = (tile: TileDef) => {
    setDiscardingId(tile.id);
    setTimeout(() => {
      onDiscard?.(tile);
      setSelectedIndex(null);
      setDiscardingId(null);
    }, 250);
  };

  // Drag-and-drop handlers
  const handleDragStart = useCallback((index: number, e: React.DragEvent) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  }, []);

  const handleDragOver = useCallback((index: number, e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropIndex(index);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDropIndex(null);
  }, []);

  const handleDrop = useCallback((targetIndex: number, e: React.DragEvent) => {
    e.preventDefault();
    const sourceIndex = dragIndex;
    setDragIndex(null);
    setDropIndex(null);

    if (sourceIndex === null || sourceIndex === targetIndex) return;
    if (!onReorder) return;

    const newTiles = [...tiles];
    const [moved] = newTiles.splice(sourceIndex, 1);
    newTiles.splice(targetIndex, 0, moved);
    onReorder(newTiles);
  }, [dragIndex, tiles, onReorder]);

  const handleDragEnd = useCallback(() => {
    setDragIndex(null);
    setDropIndex(null);
  }, []);

  const scale = useScale();
  const tileCount = tiles.length;
  const isMobile = scale < 0.75;
  const gap = isMobile ? 2 : 4;
  const hasDrawn = drawnTileId !== null;
  const drawnExtraMargin = hasDrawn ? Math.round(gap * 1.5) : 0;
  const rawWidth = measuredWidth > 0 ? measuredWidth : window.innerWidth - 8;
  const availableWidth = rawWidth - drawnExtraMargin;
  const maxTileW = isMobile ? 42 : 68;
  const minTileW = isMobile ? 28 : MIN_TILE_W;

  // --- Width-only tile sizing ---
  // Fit tiles in as few rows as possible (1 preferred, 2 max)
  const maxTilesPerRow = Math.max(1, Math.floor((availableWidth + gap) / (minTileW + gap)));
  const rows = tileCount > 0 ? Math.min(Math.ceil(tileCount / maxTilesPerRow), 2) : 1;
  const perRow = Math.ceil(tileCount / rows);
  const gapsWidth = Math.max(0, perRow - 1) * gap;
  const widthBasedW = perRow > 0 ? Math.floor((availableWidth - gapsWidth) / perRow) : maxTileW;

  // Width-only: no height-based constraint (hand row is auto-height)
  const baseW = Math.max(minTileW, Math.min(widthBasedW, maxTileW));
  const baseH = Math.round(baseW * TILE_ASPECT);

  const wildSortKey = wildCardTileId ? tileSortKey(parseTileId(wildCardTileId)) : null;

  const renderTile = (tile: TileDef, index: number, isDrawn: boolean) => {
    const isSelected = selectedIndex === index;
    const isDiscarding = discardingId === tile.id;
    const isWild = wildSortKey !== null && tileSortKey(tile) === wildSortKey;
    const isDragging = dragIndex === index;
    const isDropTarget = dropIndex === index && dragIndex !== index;

    const tileEl = <TileRenderer tile={tile} width={baseW} height={baseH} selected={isSelected} onClick={canDiscard ? () => setSelectedIndex(isSelected ? null : index) : undefined} />;

    const wrapperStyle: React.CSSProperties = {
      flex: '1 1 0',
      minWidth: 0,
      maxWidth: baseW,
      boxSizing: 'border-box',
      transition: 'transform 200ms ease, opacity 200ms ease',
      cursor: canDiscard ? 'grab' : 'default',
      userSelect: 'none',
      opacity: isDragging ? 0.4 : 1,
      ...(isSelected && { transform: 'translateY(-8px)' }),
      ...(isDiscarding && { transform: 'translateY(-16px) scale(0.9)', opacity: 0.4 }),
      ...(isWild && !isDrawn && { borderRadius: '4px', boxShadow: 'inset 0 0 0 2px #fbbf24, 0 0 8px rgba(251,191,36,0.4)' }),
      ...(isDropTarget && { borderLeft: '3px solid var(--accent-warm)', marginLeft: -1 }),
    };

    const dragHandlers = onReorder ? {
      draggable: true,
      onDragStart: (e: React.DragEvent) => handleDragStart(index, e),
      onDragOver: (e: React.DragEvent) => handleDragOver(index, e),
      onDragLeave: handleDragLeave,
      onDrop: (e: React.DragEvent) => handleDrop(index, e),
      onDragEnd: handleDragEnd,
    } : {};

    // Drawn tile: glow + slight lift, zero extra row height, no label
    if (isDrawn) {
      const borderColor = isWild ? '#fbbf24' : 'var(--accent-warm)';
      const glowColor = isWild
        ? '0 0 12px 3px rgba(251,191,36,0.6), 0 0 24px 6px rgba(251,191,36,0.25)'
        : '0 0 12px 3px rgba(184,92,58,0.6), 0 0 24px 6px rgba(184,92,58,0.25)';
      return (
        <div key={tile.id} style={{
          ...wrapperStyle,
          transform: 'translateY(-4px)',
          animation: 'tileDrawIn 400ms ease-out',
          borderRadius: '8px',
          marginLeft: Math.round(gap * 1.5),
          boxShadow: `inset 0 0 0 2px ${borderColor}, ${glowColor}`,
        }} {...dragHandlers}>
          {tileEl}
        </div>
      );
    }

    return <div key={tile.id} style={wrapperStyle} {...dragHandlers}>{tileEl}</div>;
  };

  return (
    <div ref={tileRowRef} style={{
      display: 'flex',
      gap,
      padding: `${gap}px ${gap}px 0`,
      justifyContent: 'center',
      alignItems: 'flex-end',
      flexWrap: 'wrap',
      width: '100%',
    }}>
      {tiles.map((tile, i) => renderTile(tile, i, tile.id === drawnTileId))}
    </div>
  );
}
