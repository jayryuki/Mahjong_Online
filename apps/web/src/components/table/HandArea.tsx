import React, { useState, useEffect, useRef, useCallback } from 'react';
import { TileRenderer } from '../common/TileRenderer.js';
import { useScale } from '../../hooks/useScale.js';
import { TileDef, tileSortKey } from '@mahjong/game-core';
import { parseTileId } from '../../lib/tile-utils.js';

/** Minimum tile width before we allow wrapping to more rows */
const MIN_TILE_W = 36;
/** Aspect ratio: width / height = 1 / 1.35 (slightly shorter to save vertical space) */
const TILE_ASPECT = 1.35;

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

  // --- Sizing calculations (must come before callbacks that reference them) ---
  const scale = useScale();
  const tileCount = tiles.length;
  const isMobile = scale < 0.75;
  const gap = isMobile ? 2 : 4;
  const hasDrawn = drawnTileId !== null;
  const rawWidth = measuredWidth > 0 ? measuredWidth : Math.max(320, window.innerWidth - 8);
  const maxTileW = isMobile ? 52 : 68;
  const minTileW = isMobile ? 24 : MIN_TILE_W;

  // Row layout: mobile explicit 2 rows (6+7 for 13, 7+7 for 14)
  let topRowCount = 0;
  let bottomRowCount = 0;
  let perRow = tileCount;

  if (isMobile && tileCount >= 10) {
    if (tileCount === 13) {
      topRowCount = 6;
      bottomRowCount = 7;
    } else if (tileCount === 14) {
      topRowCount = 7;
      bottomRowCount = 7;
    } else {
      topRowCount = Math.ceil(tileCount / 2);
      bottomRowCount = tileCount - topRowCount;
    }
    perRow = Math.max(topRowCount, bottomRowCount);
  }

  const useTwoRows = isMobile && topRowCount > 0;
  const drawnExtraMargin = hasDrawn ? Math.round(gap * 2.5) : 0;
  const availableWidth = Math.max(0, rawWidth - drawnExtraMargin - gap * 2);

  const gapsWidth = Math.max(0, perRow - 1) * gap;
  const widthBasedW = perRow > 0 ? Math.floor((availableWidth - gapsWidth) / perRow) : maxTileW;
  const baseW = Math.max(minTileW, Math.min(widthBasedW, maxTileW));
  const baseH = Math.round(baseW * TILE_ASPECT);

  // Keep layout values in refs so touch handlers can read latest values without re-binding
  const layoutRef = useRef({ baseW, gap, topRowCount, bottomRowCount, tileCount });
  layoutRef.current = { baseW, gap, topRowCount, bottomRowCount, tileCount };

  const wildSortKey = wildCardTileId ? tileSortKey(parseTileId(wildCardTileId)) : null;

  // --- Desktop HTML5 Drag-and-drop handlers ---
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

  // --- Mobile touch drag-and-drop ---
  const [touchDragIndex, setTouchDragIndex] = useState<number | null>(null);
  const [touchDropIndex, setTouchDropIndex] = useState<number | null>(null);
  const [touchDraggingActive, setTouchDraggingActive] = useState(false);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  const topRowRef = useRef<HTMLDivElement>(null);
  const bottomRowRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((index: number, e: React.TouchEvent) => {
    if (!onReorder) return;
    const t = e.touches[0];
    touchStartPos.current = { x: t.clientX, y: t.clientY };
    setTouchDragIndex(index);
    setTouchDropIndex(null);
    setTouchDraggingActive(false);
  }, [onReorder]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (touchDragIndex === null) return;
    const t = e.touches[0];

    if (!touchStartPos.current) return;

    const deltaX = t.clientX - touchStartPos.current.x;
    const deltaY = t.clientY - touchStartPos.current.y;
    const dragThreshold = 10;

    if (!touchDraggingActive) {
      if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > dragThreshold) {
        setTouchDragIndex(null);
        setTouchDropIndex(null);
        touchStartPos.current = null;
        return;
      }

      if (Math.abs(deltaX) <= dragThreshold && Math.abs(deltaY) <= dragThreshold) {
        return;
      }

      setTouchDraggingActive(true);
    }

    e.preventDefault();

    const { baseW: bw, gap: g, topRowCount: trc, bottomRowCount: brc, tileCount: tc } = layoutRef.current;

    // Find which row the finger is over
    const topRect = topRowRef.current?.getBoundingClientRect();
    const bottomRect = bottomRowRef.current?.getBoundingClientRect();

    let targetIdx: number | null = null;

    const calcIdxInRow = (rect: DOMRect, rowCount: number, rowOffset: number) => {
      const relX = t.clientX - rect.left;
      const rowContentWidth = rowCount * bw + (rowCount - 1) * g;
      const rowLeft = (rect.width - rowContentWidth) / 2;
      const idxInRow = Math.floor((relX - rowLeft + bw / 2) / (bw + g));
      return rowOffset + Math.max(0, Math.min(rowCount - 1, idxInRow));
    };

    if (topRect && t.clientY >= topRect.top && t.clientY <= topRect.bottom) {
      targetIdx = calcIdxInRow(topRect, trc, 0);
    } else if (bottomRect && t.clientY >= bottomRect.top && t.clientY <= bottomRect.bottom) {
      targetIdx = calcIdxInRow(bottomRect, brc, trc);
    }

    if (targetIdx !== null && targetIdx >= 0 && targetIdx < tc) {
      setTouchDropIndex(targetIdx);
    }
  }, [touchDragIndex, touchDraggingActive]);

  const handleTouchEnd = useCallback(() => {
    if (touchDragIndex === null || touchDropIndex === null || !touchDraggingActive) {
      setTouchDragIndex(null);
      setTouchDropIndex(null);
      setTouchDraggingActive(false);
      touchStartPos.current = null;
      return;
    }
    if (touchDragIndex !== touchDropIndex && onReorder) {
      const newTiles = [...tiles];
      const [moved] = newTiles.splice(touchDragIndex, 1);
      newTiles.splice(touchDropIndex, 0, moved);
      onReorder(newTiles);
    }
    setTouchDragIndex(null);
    setTouchDropIndex(null);
    setTouchDraggingActive(false);
    touchStartPos.current = null;
  }, [touchDragIndex, touchDropIndex, touchDraggingActive, tiles, onReorder]);

  const makeWrapperStyle = (index: number, isDrawn: boolean, isSelected: boolean, isDiscarding: boolean, isWild: boolean, isDragging: boolean, isDropTarget: boolean): React.CSSProperties => {
    const style: React.CSSProperties = {
      flex: `0 0 ${baseW}px`,
      width: baseW,
      minWidth: 0,
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
    if (isDrawn) {
      const borderColor = isWild ? '#fbbf24' : 'var(--accent-warm)';
      const glowColor = isWild
        ? '0 0 12px 3px rgba(251,191,36,0.6), 0 0 24px 6px rgba(251,191,36,0.25)'
        : '0 0 12px 3px rgba(184,92,58,0.6), 0 0 24px 6px rgba(184,92,58,0.25)';
      style.transform = 'translateY(-4px)';
      style.animation = 'tileDrawIn 400ms ease-out';
      style.borderRadius = '8px';
      style.marginLeft = Math.round(gap * 1.5);
      style.boxShadow = `inset 0 0 0 2px ${borderColor}, ${glowColor}`;
    }
    return style;
  };

  const renderTileEl = (tile: TileDef, index: number, isDrawn: boolean) => {
    const isSelected = selectedIndex === index;
    const isDiscarding = discardingId === tile.id;
    const isWild = wildSortKey !== null && tileSortKey(tile) === wildSortKey;
    const isDragging = dragIndex === index || touchDragIndex === index;
    const isDropTarget = (dropIndex === index && dragIndex !== null && dragIndex !== index) ||
                         (touchDropIndex === index && touchDragIndex !== null && touchDragIndex !== index);

    const tileEl = (
      <TileRenderer
        tile={tile}
        width={baseW}
        height={baseH}
        selected={isSelected}
        onClick={canDiscard ? () => setSelectedIndex(isSelected ? null : index) : undefined}
      />
    );

    const wrapperStyle = makeWrapperStyle(index, isDrawn, isSelected, isDiscarding, isWild, isDragging, isDropTarget);

    const desktopDragHandlers = onReorder ? {
      draggable: true,
      onDragStart: (e: React.DragEvent) => handleDragStart(index, e),
      onDragOver: (e: React.DragEvent) => handleDragOver(index, e),
      onDragLeave: handleDragLeave,
      onDrop: (e: React.DragEvent) => handleDrop(index, e),
      onDragEnd: handleDragEnd,
    } : {};

    const mobileTouchHandlers = (onReorder && isMobile) ? {
      onTouchStart: (e: React.TouchEvent) => handleTouchStart(index, e),
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    } : {};

    return (
      <div key={tile.id} style={wrapperStyle} {...desktopDragHandlers} {...mobileTouchHandlers}>
        {tileEl}
      </div>
    );
  };

  // Desktop: single flex-wrap row
  if (!useTwoRows) {
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
        {tiles.map((tile, i) => renderTileEl(tile, i, tile.id === drawnTileId))}
      </div>
    );
  }

  // Mobile: explicit two rows
  const topTiles = tiles.slice(0, topRowCount);
  const bottomTiles = tiles.slice(topRowCount);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      padding: `${gap}px ${gap}px 0`,
      alignItems: 'center',
      width: '100%',
      touchAction: touchDraggingActive ? 'none' : 'pan-y',
    }}>
      <div ref={topRowRef} style={{
        display: 'flex',
        gap,
        justifyContent: 'center',
        alignItems: 'flex-end',
        width: '100%',
      }}>
        {topTiles.map((tile, i) => renderTileEl(tile, i, tile.id === drawnTileId))}
      </div>
      <div ref={bottomRowRef} style={{
        display: 'flex',
        gap,
        justifyContent: 'center',
        alignItems: 'flex-end',
        width: '100%',
      }}>
        {bottomTiles.map((tile, i) => renderTileEl(tile, topRowCount + i, tile.id === drawnTileId))}
      </div>
    </div>
  );
}
