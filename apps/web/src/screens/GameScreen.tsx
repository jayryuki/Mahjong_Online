import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { HandArea } from '../components/table/HandArea.js';
import { MeldArea } from '../components/table/MeldArea.js';
import { ActionPrompt } from '../components/actions/ActionPrompt.js';
import { Button, ThemeToggle } from '@games/ui';
import { ChatPanel, ChatMessageData } from '../components/common/ChatPanel.js';
import { TileRenderer } from '../components/common/TileRenderer.js';
import { InfoBar } from '../components/table/InfoBar.js';
import { CenterRiver } from '../components/table/CenterRiver.js';
import { SeatPosition } from '../components/table/SeatPosition.js';
import { WildCardDisplay } from '../components/table/WildCardDisplay.js';
import { useScale } from '../hooks/useScale.js';
import { clearRoom } from '../lib/gameContext.js';
import { TileDef } from '@mahjong/game-core';
import { playTurnSound, playReactionSound, playTileSound, playWinSound } from '../lib/sounds.js';
import { parseTileId } from '../lib/tile-utils.js';
import type { SeatDisplay } from '../lib/types.js';

// Sort key for tiles
function tileKey(t: TileDef): string {
  if (t.suit) {
    const suitOrder: Record<string, number> = { man: 0, pin: 1, sou: 2 };
    return `${suitOrder[t.suit]}${t.rank!.toString().padStart(2, '0')}`;
  }
  return `9${t.honorName ?? 'zzz'}`;
}

// Apply custom hand ordering; falls back to default sort for tiles not in the order
function applyOrder(tiles: TileDef[], order: string[] | null): TileDef[] {
  if (!order) return [...tiles].sort((a, b) => tileKey(a).localeCompare(tileKey(b)));
  const orderMap = new Map(order.map((id, i) => [id, i]));
  return [...tiles].sort((a, b) => {
    const ai = orderMap.get(a.id);
    const bi = orderMap.get(b.id);
    if (ai !== undefined && bi !== undefined) return ai - bi;
    if (ai !== undefined) return -1;
    if (bi !== undefined) return 1;
    return tileKey(a).localeCompare(tileKey(b));
  });
}

interface PlayerData {
  playerId: string;
  displayName: string;
  seatIndex: number;
  isReady: boolean;
  isHost: boolean;
  isConnected: boolean;
}

interface SeatData {
  seatIndex: number;
  concealedCount: number;
  isRiichi: boolean;
  meldCount: number;
  meldTypes: string;
  meldTileIds: string;
  riverTileIds: string;
  score: number;
  hasPassedReaction: boolean;
}

interface GameScreenProps {
  room: any;
  mySessionId: string;
  roomCode: string;
}

export function GameScreen({ room, mySessionId, roomCode }: GameScreenProps) {
  const navigate = useNavigate();

  // My seat index
  const [mySeat, setMySeat] = useState<number>(0);
  const mySeatRef = useRef<number>(0);

  // Hand tiles (parsed from server messages)
  const [handTiles, setHandTiles] = useState<TileDef[]>([]);
  // Custom tile ordering (array of tile IDs, or null for default sort)
  const [handOrder, setHandOrder] = useState<string[] | null>(null);
  const handOrderRef = useRef<string[] | null>(null);
  handOrderRef.current = handOrder;

  // Current legal actions
  const [legalActions, setLegalActions] = useState<string[]>([]);

  // Reaction options (when someone discards and we can react)
  const [reactionOptions, setReactionOptions] = useState<string[]>([]);

  // Chi tile options (pairs of tile IDs that can form a sequence with the discard)
  const [chiTileOptions, setChiTileOptions] = useState<string[][]>([]);

  // Wild card tile ID
  const [wildCardTileId, setWildCardTileId] = useState<string | null>(null);

  // Last discard tile when reacting
  const [reactionDiscardTileId, setReactionDiscardTileId] = useState<string | null>(null);

  // Current phase
  const [phase, setPhase] = useState<string>('LOBBY');

  // Room state (synced from onStateChange)
  const [roomState, setRoomState] = useState<any>(null);

  // Win result for display
  const [handResult, setHandResult] = useState<any>(null);

  // Drawn tile ID (from tile-drawn message)
  const [drawnTileId, setDrawnTileId] = useState<string | null>(null);

  // Hand version tracking
  const [handVersion, setHandVersion] = useState<number>(0);

  // Status message
  const [statusMessage, setStatusMessage] = useState<string>('Connecting...');

  // Whether it's currently the player's turn (for visual emphasis)
  const [isMyTurn, setIsMyTurn] = useState(false);

  // Track seat mapping from state
  const seatMapRef = useRef<Map<string, number>>(new Map());

  // Chat messages
  const [chatMessages, setChatMessages] = useState<ChatMessageData[]>([]);

  // Leave confirmation
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  // Hand row height for tile sizing
  const [handRowHeight, setHandRowHeight] = useState(0);
  const handRowRef = useRef<HTMLDivElement>(null);

  // Selected tile index (for Discard button in action row)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  // Spectator state
  const [isSpectator, setIsSpectator] = useState(false);
  const [spectatorAllHands, setSpectatorAllHands] = useState<Record<number, { tiles: string[]; melds: Array<{ type: string; tileIds: string[]; isConcealed: boolean }> }> | null>(null);

  // Blind kan reaction
  const [blindKanReactionOptions, setBlindKanReactionOptions] = useState<string[]>([]);
  const [blindKanTileId, setBlindKanTileId] = useState<string | null>(null);

  // Listen for state changes
  useEffect(() => {
    if (!room) return;

    const onStateChange = (state: any) => {
      setRoomState({ ...state });
      setPhase(state.phase || 'LOBBY');

      // Build seat mapping from players
      const players: PlayerData[] = state.players ? Array.from(state.players.values() as Iterable<PlayerData>) : [];
      const newSeatMap = new Map<string, number>();
      for (const p of players) {
        if (p.seatIndex !== undefined && p.seatIndex !== null) {
          newSeatMap.set(p.playerId, p.seatIndex);
        }
      }
      seatMapRef.current = newSeatMap;

      // Find my seat and spectator status
      const myPlayer = players.find((p: PlayerData) => p.playerId === mySessionId);
      if (myPlayer && (myPlayer as any).isSpectator) {
        setIsSpectator(true);
      }
      const mySeatIdx = newSeatMap.get(mySessionId);
      if (mySeatIdx !== undefined) {
        setMySeat(mySeatIdx);
        mySeatRef.current = mySeatIdx;
      }

      // Sync chat messages from schema
      if (state.chatMessages) {
        const msgs: ChatMessageData[] = [];
        for (const m of Array.from(state.chatMessages as Iterable<any>)) {
          msgs.push({
            senderId: m.senderId,
            senderName: m.senderName,
            text: m.text,
            timestamp: m.timestamp,
          });
        }
        setChatMessages(msgs);
      }
    };

    room.onStateChange(onStateChange);

    // Initial state
    if (room.state) {
      onStateChange(room.state);
    }

    return () => {
      room.onStateChange.remove(onStateChange);
    };
  }, [room, mySessionId]);

  // Listen for server messages
  useEffect(() => {
    if (!room) return;

    room.send('request-hand');

    const unsubs: Array<() => void> = [];

    const onHandState = (data: { tiles: string[]; melds: Array<{ type: string; tileIds: string[]; isConcealed: boolean }>; handVersion: number; phase?: string; activeSeat?: number; legalActions?: string[]; wildCardTileId?: string | null }) => {
      const tiles = data.tiles.map(parseTileId);
      setHandTiles(applyOrder(tiles, handOrderRef.current));
      setHandVersion(data.handVersion);
      setHandResult(null);
      if (data.wildCardTileId) setWildCardTileId(data.wildCardTileId);

      // Reconstruct turn state from server response
      if (data.phase && data.legalActions) {
        const myTurn = (data.phase === 'TURN_DRAW' || data.phase === 'TURN_DECISION') && data.activeSeat === mySeatRef.current;
        if (myTurn) {
          setIsMyTurn(true);
          playTurnSound();
        } else if (data.phase !== 'REACTION_WINDOW' && data.phase !== 'BLIND_KAN_REACTION') {
          setIsMyTurn(false);
        }
        if (data.phase === 'TURN_DRAW' && data.activeSeat === mySeatRef.current) {
          setLegalActions(data.legalActions);
          setStatusMessage('Your turn - Draw a tile!');
        } else if (data.phase === 'TURN_DECISION' && data.activeSeat === mySeatRef.current) {
          setLegalActions(data.legalActions);
          setStatusMessage('Tile drawn! Choose an action.');
        } else if (data.phase === 'REACTION_WINDOW') {
          setReactionOptions(data.legalActions);
          setStatusMessage('A tile was discarded. You can react!');
        } else if (data.phase === 'BLIND_KAN_REACTION') {
          setBlindKanReactionOptions(data.legalActions);
          setStatusMessage('A blind kan was declared. You may be able to win!');
        } else {
          setStatusMessage(`Seat ${data.activeSeat ?? '?'} is playing...`);
        }
      } else {
        setIsMyTurn(false);
        setStatusMessage('Hand synced.');
      }
    };

    const onDeal = (data: { tiles: string[]; handVersion?: number; wildCardTileId?: string | null }) => {
      const tiles = data.tiles.map(parseTileId);
      setHandTiles(applyOrder(tiles, handOrderRef.current));
      if (data.handVersion !== undefined) setHandVersion(data.handVersion);
      setStatusMessage('Hand dealt! Waiting for your turn...');
      setHandResult(null);
      setIsMyTurn(false);
      if (data.wildCardTileId) setWildCardTileId(data.wildCardTileId);
    };

    const onYourTurnDraw = (data: { seat: number }) => {
      if (data.seat === mySeatRef.current) {
        setIsMyTurn(true);
        playTurnSound();
        setStatusMessage('Your turn - Draw a tile!');
        setLegalActions(['DRAW_TILE']);
      } else {
        setIsMyTurn(false);
        setStatusMessage(`Seat ${data.seat} is drawing...`);
        setLegalActions([]);
      }
    };

    const onTileDrawn = (data: { tileId: string; handVersion?: number }) => {
      const tile = parseTileId(data.tileId);
      setDrawnTileId(data.tileId);
      setHandTiles((prev) => {
        return applyOrder([...prev, tile], handOrderRef.current);
      });
      if (data.handVersion !== undefined) setHandVersion(data.handVersion);
      setStatusMessage('Tile drawn! Choose an action.');
    };

    const onLegalActions = (data: { actions: string[] }) => {
      setLegalActions(data.actions);
    };

    const onReactionOptions = (data: { discardSeat: number; discardTileId: string; actions: string[]; chiOptions?: string[][] }) => {
      setReactionOptions(data.actions);
      setChiTileOptions(data.chiOptions ?? []);
      setReactionDiscardTileId(data.discardTileId);
      setStatusMessage(`Seat ${data.discardSeat} discarded. You can react!`);
      playReactionSound();
    };

    const onMeldApplied = (data: { meld: { type: string; tileIds: string[] }; handVersion?: number }) => {
      const meldTileIds = new Set(data.meld.tileIds);
      setHandTiles((prev) => prev.filter((t) => !meldTileIds.has(t.id)));
      if (data.handVersion !== undefined) setHandVersion(data.handVersion);
      const meldLabel = data.meld.type === 'chi' ? 'Chi' : data.meld.type === 'pon' ? 'Pon' : 'Kan';
      setStatusMessage(`${meldLabel} called! You must discard a tile.`);
    };

    const onHandResult = (data: any) => {
      setHandResult(data);
      setLegalActions([]);
      setReactionOptions([]);
      setBlindKanReactionOptions([]);
      setDrawnTileId(null);
      if (data.endReason === 'exhaustive-draw') {
        setStatusMessage('Exhaustive draw! No one wins this hand.');
      } else if (data.blindKanRon) {
        playWinSound();
        setStatusMessage(`Hand over! Ron by seat ${data.winner} off blind kan!`);
      } else if (data.winType === 'ron') {
        playWinSound();
        setStatusMessage(`Hand over! Ron by seat ${data.winner}!`);
      } else {
        playWinSound();
        setStatusMessage(`Hand over! Tsumo by seat ${data.winner}!`);
      }
    };

    const onMatchEnd = (data: { finalScores: Array<{ seatIndex: number; points: number }> }) => {
      setStatusMessage('Match over!');
      setHandResult({ endReason: 'match-end', finalScores: data.finalScores });
    };

    const onBlindKanReactionOptions = (data: { kanSeat: number; kanTileId: string; actions: string[] }) => {
      setBlindKanReactionOptions(data.actions);
      setBlindKanTileId(data.kanTileId);
      setStatusMessage(`Seat ${data.kanSeat} declared a blind kan. You can win off it!`);
      playReactionSound();
    };

    const onSpectatorHandState = (data: { allHands: Record<number, { tiles: string[]; melds: Array<{ type: string; tileIds: string[]; isConcealed: boolean }> }>; phase: string; activeSeat: number; wildCardTileId?: string | null }) => {
      setSpectatorAllHands(data.allHands);
      setPhase(data.phase);
      if (data.wildCardTileId) setWildCardTileId(data.wildCardTileId);
      setStatusMessage('Spectating...');
    };

    unsubs.push(room.onMessage('hand-state', onHandState));
    unsubs.push(room.onMessage('deal', onDeal));
    unsubs.push(room.onMessage('your-turn-draw', onYourTurnDraw));
    unsubs.push(room.onMessage('tile-drawn', onTileDrawn));
    unsubs.push(room.onMessage('legal-actions', onLegalActions));
    unsubs.push(room.onMessage('reaction-options', onReactionOptions));
    unsubs.push(room.onMessage('meld-applied', onMeldApplied));
    unsubs.push(room.onMessage('hand-result', onHandResult));
    unsubs.push(room.onMessage('match-end', onMatchEnd));
    unsubs.push(room.onMessage('blind-kan-reaction-options', onBlindKanReactionOptions));
    unsubs.push(room.onMessage('spectator-hand-state', onSpectatorHandState));
    unsubs.push(room.onMessage('seat-joined', (data: { seatIndex: number }) => {
      setIsSpectator(false);
      setSpectatorAllHands(null);
      setMySeat(data.seatIndex);
      mySeatRef.current = data.seatIndex;
      room.send('request-hand');
    }));

    return () => {
      for (const unsub of unsubs) {
        unsub();
      }
    };
  }, [room]);

  // Observe hand row height
  useEffect(() => {
    const el = handRowRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const h = entries[0]?.contentRect.height;
      if (h) setHandRowHeight(h);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Handle actions from ActionPrompt
  const handleAction = useCallback((action: string, chiTileIds?: [string, string]) => {
    if (!room) return;

    setIsMyTurn(false);

    switch (action) {
      case 'DRAW_TILE':
        room.send('draw-tile');
        setStatusMessage('Drawing tile...');
        setLegalActions([]);
        break;
      case 'PASS_REACTION':
        room.send('pass-reaction');
        setReactionOptions([]);
        setReactionDiscardTileId(null);
        setBlindKanReactionOptions([]);
        setBlindKanTileId(null);
        setStatusMessage('Passed.');
        break;
      case 'CALL_PON':
        room.send('call-pon');
        setReactionOptions([]);
        setReactionDiscardTileId(null);
        setStatusMessage('Calling Pon!');
        break;
      case 'CALL_CHI': {
        if (chiTileIds) {
          room.send('call-chi', { tileIds: chiTileIds });
        } else if (chiTileOptions.length > 0) {
          room.send('call-chi', { tileIds: [chiTileOptions[0][0], chiTileOptions[0][1]] as [string, string] });
        }
        setReactionOptions([]);
        setReactionDiscardTileId(null);
        setStatusMessage('Calling Chi!');
        break;
      }
      case 'DECLARE_WIN_TSUMO':
        room.send('declare-win-tsumo');
        setLegalActions([]);
        setStatusMessage('Declaring Tsumo!');
        break;
      case 'CALL_KAN_OPEN':
        room.send('call-kan-open');
        setReactionOptions([]);
        setReactionDiscardTileId(null);
        setStatusMessage('Calling Kan (Open)!');
        break;
      case 'CALL_KAN_CLOSED': {
        // Find the first set of 4 identical tiles and send one tile ID
        const counts = new Map<string, { key: string; id: string; count: number }>();
        for (const t of handTiles) {
          const k = tileKey(t);
          const entry = counts.get(k);
          if (entry) { entry.count++; } else { counts.set(k, { key: k, id: t.id, count: 1 }); }
        }
        const kanTile = Array.from(counts.values()).find(e => e.count === 4);
        if (kanTile) {
          room.send('call-kan-closed', { tileId: kanTile.id });
          setLegalActions([]);
          setStatusMessage('Calling Kan (Closed)!');
        }
        break;
      }
      case 'CALL_KAN_ADDED': {
        // Find a pon meld tile that has a matching tile in hand (from roomState)
        const seatData = roomState?.seats ? Array.from(roomState.seats.values() as Iterable<SeatData>) : [];
        const mySeatData = seatData.find((s: SeatData) => s.seatIndex === mySeatRef.current);
        const meldTypes: string[] = mySeatData?.meldTypes ? mySeatData.meldTypes.split(',').filter(Boolean) : [];
        const meldTileIdsStr = mySeatData?.meldTileIds ?? '';
        const meldGroups = meldTileIdsStr ? meldTileIdsStr.split(',').filter(Boolean) : [];
        const ponIdx = meldTypes.indexOf('pon');
        if (ponIdx >= 0 && meldGroups[ponIdx]) {
          const ponTileId = meldGroups[ponIdx].split('|')[0];
          const ponTileKey = tileKey(parseTileId(ponTileId));
          const matchTile = handTiles.find(t => tileKey(t) === ponTileKey);
          if (matchTile) {
            room.send('call-kan-added', { tileId: matchTile.id });
            setLegalActions([]);
            setStatusMessage('Calling Kan (Added)!');
          }
        }
        break;
      }
      case 'DECLARE_WIN_RON_BLIND_KAN':
        room.send('declare-win-ron-blind-kan');
        setBlindKanReactionOptions([]);
        setBlindKanTileId(null);
        setStatusMessage('Declaring Ron off Blind Kan!');
        break;
    }
  }, [room, chiTileOptions, handTiles, roomState]);

  // Handle discard
  const handleDiscard = useCallback((tile: TileDef) => {
    if (!room) return;
    room.send('discard-tile', { tileId: tile.id });
    setHandTiles((prev) => prev.filter((t) => t.id !== tile.id));
    setDrawnTileId(null);
    setLegalActions([]);
    setIsMyTurn(false);
    setSelectedIndex(null);
    setStatusMessage('Tile discarded. Waiting...');
  }, [room]);

  // Handle tile reorder (drag-and-drop)
  const handleReorder = useCallback((newTiles: TileDef[]) => {
    setHandTiles(newTiles);
    setHandOrder(newTiles.map(t => t.id));
  }, []);

  // Handle sort (reset to default order)
  const handleSort = useCallback(() => {
    setHandOrder(null);
    setHandTiles(prev => applyOrder(prev, null));
  }, []);

  // Chat send handler
  const handleChatSend = useCallback((text: string) => {
    room?.send('chat', { text });
  }, [room]);

  // Leave game handler
  const handleLeave = useCallback(() => {
    try { room?.leave(); } catch {}
    clearRoom();
    navigate('/');
  }, [room, navigate]);

  const buildSeatDisplays = (): SeatDisplay[] => {
    if (!roomState) {
      return [0, 1, 2, 3].map((i) => ({
        seatIndex: i,
        displayName: `Seat ${i}`,
        tileCount: 0,
        isDealer: i === 0,
        isActive: false,
        isRiichi: false,
        melds: [],
        river: [],
        score: 300,
      }));
    }

    const players: PlayerData[] = roomState.players ? Array.from(roomState.players.values() as Iterable<PlayerData>) : [];
    const seats: SeatData[] = roomState.seats ? Array.from(roomState.seats.values() as Iterable<SeatData>) : [];
    const activeSeat = roomState.activeSeat ?? 0;
    const dealerSeat = roomState.dealerSeat ?? 0;

    return [0, 1, 2, 3].map((i) => {
      const seatData = seats.find((s) => s.seatIndex === i);
      const player = players.find((p) => p.seatIndex === i);

      // Parse river tiles — each seat's most recently discarded tile glows
      const riverTileIds: string[] = seatData?.riverTileIds ? seatData.riverTileIds.split(',').filter(Boolean) : [];
      const riverEntries = riverTileIds.map((id, idx) => ({
        tile: parseTileId(id),
        isLastDiscard: idx === riverTileIds.length - 1 && riverTileIds.length > 0,
      }));

      // Parse melds
      const meldTileIdsStr: string = seatData?.meldTileIds ?? '';
      const meldGroups = meldTileIdsStr ? meldTileIdsStr.split(',').filter(Boolean) : [];
      const melds = meldGroups.map((group) => {
        const tileIds = group.split('|');
        return {
          type: '',
          tiles: tileIds.map(id => ({ id })),
          isConcealed: false,
        };
      });

      const meldTypes: string[] = seatData?.meldTypes ? seatData.meldTypes.split(',').filter(Boolean) : [];
      for (let j = 0; j < melds.length; j++) {
        if (meldTypes[j]) {
          melds[j].type = meldTypes[j];
          // kan-closed melds are concealed — hide tile identity from non-owners
          if (meldTypes[j] === 'kan-closed') {
            melds[j].isConcealed = true;
          }
        }
      }

      return {
        seatIndex: i,
        displayName: player?.displayName || `Seat ${i}`,
        tileCount: seatData?.concealedCount ?? 0,
        isDealer: i === dealerSeat,
        isActive: i === activeSeat,
        isRiichi: seatData?.isRiichi ?? false,
        melds,
        river: riverEntries,
        score: seatData?.score ?? 300,
      };
    });
  };

  const seatDisplays = buildSeatDisplays();
  const allActions = [...legalActions, ...reactionOptions, ...blindKanReactionOptions];

  // My seat display for the bottom panel
  const mySeatDisplay = seatDisplays.find(s => s.seatIndex === mySeat);

  // No room
  if (!room) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Not connected to a room.</p>
        <Button onClick={() => navigate('/')}>Back to Home</Button>
      </div>
    );
  }

  const scale = useScale();
  const isMobile = scale < 0.75;

  // Render a tile for the winning hand display
  const renderResultTile = (tile: TileDef, w: number, h: number) => {
    return <TileRenderer tile={tile} width={Math.round(w * scale)} height={Math.round(h * scale)} />;
  };

  // Resolve opponent seats
  const rightSeat = seatDisplays.find(s => s.seatIndex === (mySeat + 1) % 4);
  const acrossSeat = seatDisplays.find(s => s.seatIndex === (mySeat + 2) % 4);
  const leftSeat = seatDisplays.find(s => s.seatIndex === (mySeat + 3) % 4);

  const canDiscard = legalActions.includes('DISCARD_TILE');

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', overflowX: 'hidden', overflowY: 'auto' }}>
      {/* === ZONE 1: Top HUD === */}
      <div style={{ flexShrink: 0, position: 'relative' }}>
        <InfoBar roundWind={roomState?.roundWind ?? 'east'} handNumber={roomState?.handNumber ?? 1} honba={roomState?.honba ?? 0} riichiSticks={0} wallRemaining={roomState?.wallRemaining ?? 0} />
        <div style={{ position: 'absolute', top: 4, right: 8, zIndex: 60, display: 'flex', gap: '6px', alignItems: 'center' }}>
          <ThemeToggle />
          <button
            onClick={() => setShowLeaveConfirm(true)}
            style={{
              background: 'rgba(0,0,0,0.5)',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '8px',
              padding: '4px 10px',
              cursor: 'pointer',
              fontSize: `${1.125 * scale}rem`,
              fontWeight: 600,
              fontFamily: "'Inter', sans-serif",
              backdropFilter: 'blur(4px)',
            }}
          >
            Exit
          </button>
        </div>
      </div>

      {/* === ZONE 2: Center board (discard region) === */}
      <div className="mj-table-stage" style={{ flex: '1 1 0%', minHeight: '40dvh', position: 'relative', overflow: 'hidden', borderRadius: '0 0 8px 8px' }}>
        {/* River overlay */}
        <div style={{ position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none' }}>
          <CenterRiver mySeat={mySeat} seats={seatDisplays} />
        </div>

        {/* Opponent grid */}
        <div style={{
          width: '100%',
          height: '100%',
          display: 'grid',
          gridTemplateRows: 'auto 1fr auto',
          gridTemplateColumns: isMobile ? 'minmax(0, 0.25fr) 3.5fr minmax(0, 0.25fr)' : 'minmax(0, 0.4fr) 3.2fr minmax(0, 0.4fr)',
          gridTemplateAreas: `
            ". top ."
            "left center right"
            ". bottom ."
          `,
          minHeight: 0,
          background: 'radial-gradient(ellipse at center, #2d5a3d 0%, #1e3f2a 60%, #152b1e 100%)',
          padding: isMobile ? '3px' : '6px',
          gap: isMobile ? '3px' : '6px',
          position: 'relative',
          zIndex: 1,
        }}>
          {/* Across seat (top) */}
          <div style={{ gridArea: 'top', justifySelf: 'center', zIndex: 4, overflow: 'hidden', maxWidth: '100%', padding: '2px 8px' }}>
            {acrossSeat && <SeatPosition position="top" seatIndex={acrossSeat.seatIndex} displayName={acrossSeat.displayName} tileCount={acrossSeat.tileCount} isDealer={acrossSeat.isDealer} isActive={acrossSeat.isActive} isRiichi={acrossSeat.isRiichi} score={acrossSeat.score} melds={acrossSeat.melds} />}
          </div>

          {/* Left seat */}
          <div style={{ gridArea: 'left', alignSelf: 'center', justifySelf: 'center', zIndex: 4, overflow: 'hidden', maxWidth: '100%', padding: '4px' }}>
            {leftSeat && <SeatPosition position="left" seatIndex={leftSeat.seatIndex} displayName={leftSeat.displayName} tileCount={leftSeat.tileCount} isDealer={leftSeat.isDealer} isActive={leftSeat.isActive} isRiichi={leftSeat.isRiichi} score={leftSeat.score} melds={leftSeat.melds} />}
          </div>

          {/* Center cell */}
          <div style={{ gridArea: 'center', minHeight: 0 }} />

          {/* Right seat */}
          <div style={{ gridArea: 'right', alignSelf: 'center', justifySelf: 'center', zIndex: 4, overflow: 'hidden', maxWidth: '100%', padding: '4px' }}>
            {rightSeat && <SeatPosition position="right" seatIndex={rightSeat.seatIndex} displayName={rightSeat.displayName} tileCount={rightSeat.tileCount} isDealer={rightSeat.isDealer} isActive={rightSeat.isActive} isRiichi={rightSeat.isRiichi} score={rightSeat.score} melds={rightSeat.melds} />}
          </div>

          {/* Bottom (my seat - empty, hand is below) */}
          <div style={{ gridArea: 'bottom' }} />
        </div>

        {/* Wild card display */}
        <WildCardDisplay wildCardTileId={wildCardTileId} />
      </div>

      {/* === ZONE 3: Bottom player panel === */}
      <div className={isMyTurn ? 'mj-player-dock mj-player-dock--turn' : 'mj-player-dock'} style={{
        flexShrink: 0,
        background: 'var(--surface-panel)',
        borderTop: isMyTurn ? '3px solid var(--accent-warm)' : '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        ...(isMyTurn && { boxShadow: '0 -4px 24px rgba(184, 92, 58, 0.3)' }),
      }}>
        {/* Row 1: Player/status */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 0.5rem', flexShrink: 0, gap: '0.5rem', minHeight: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}>
            <span style={{ fontSize: `${1 * scale}rem`, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', fontWeight: 600, flexShrink: 0 }}>
              {mySeatDisplay ? ['E','S','W','N'][mySeatDisplay.seatIndex] : ''} {mySeatDisplay?.isDealer && 'D'}
            </span>
            <span style={{ fontSize: `${1.125 * scale}rem`, fontWeight: 600, color: mySeatDisplay?.isActive ? 'var(--accent-warm)' : 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {mySeatDisplay?.displayName}
            </span>
            {isMyTurn && (
              <span style={{
                background: 'var(--accent-warm)',
                color: '#fff',
                padding: '1px 6px',
                borderRadius: '4px',
                fontWeight: 800,
                fontSize: `${0.8 * scale}rem`,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                animation: 'turnBannerPulse 2s ease-in-out infinite',
                flexShrink: 0,
              }}>
                Your Turn
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
            <span style={{ fontSize: `${1 * scale}rem`, color: 'var(--text-muted)', maxWidth: '16ch', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{statusMessage}</span>
            <span style={{ fontSize: `${1.25 * scale}rem`, fontWeight: 700, color: 'var(--text-primary)' }}>{mySeatDisplay?.score ?? 300}</span>
            <ChatPanel messages={chatMessages} mySessionId={mySessionId} onSend={handleChatSend} />
          </div>
        </div>

        {/* Row 2: Melds (optional) */}
        {mySeatDisplay && mySeatDisplay.melds.length > 0 && (
          <div style={{ display: 'flex', gap: '0.375rem', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', flexShrink: 0, minHeight: 0, padding: '1px 0' }}>
            <MeldArea melds={mySeatDisplay.melds} />
          </div>
        )}

        {/* Row 3: Hand tiles (dedicated, tiles only) */}
        <div ref={handRowRef} style={{ overflow: 'visible', paddingTop: isMobile ? '4px' : '8px', paddingBottom: isMobile ? '4px' : '8px' }}>
          <HandArea
            tiles={handTiles}
            drawnTileId={drawnTileId}
            canDiscard={canDiscard}
            onDiscard={handleDiscard}
            wildCardTileId={wildCardTileId}
            onReorder={handleReorder}
            availableHeight={handRowHeight}
            selectedIndex={selectedIndex}
            onSelectionChange={setSelectedIndex}
          />
        </div>

        {/* Row 4: Action row (buttons, sort, discard) */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.375rem',
          padding: '2px 0',
          flexShrink: 0,
          minHeight: 0,
          flexWrap: 'wrap',
        }}>
          {handOrder !== null && (
            <button
              onClick={handleSort}
              style={{
                padding: '0.2rem 0.6rem',
                background: 'var(--surface-panel)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 500,
                fontSize: `${0.85 * scale}rem`,
              }}
            >
              Sort
            </button>
          )}
          {allActions.length > 0 && (() => {
            const discardTile = reactionDiscardTileId ? parseTileId(reactionDiscardTileId) : null;
            const isWild = discardTile && wildCardTileId && tileKey(discardTile) === tileKey(parseTileId(wildCardTileId));
            const chiOpts = chiTileOptions.map(pair => ({
              tileIds: [...pair],
              label: pair.map(id => { const t = parseTileId(id); return t.suit ? `${t.rank}` : t.honorName ?? '?'; }).join('-'),
            }));
            return <ActionPrompt actions={allActions} onAction={handleAction} discardTile={discardTile} isWild={!!isWild} chiOptions={chiOpts} />;
          })()}
          {canDiscard && selectedIndex !== null && (
            <button
              onClick={() => handleDiscard(handTiles[selectedIndex])}
              style={{
                padding: '0.25rem 1rem',
                background: 'var(--accent-warm)',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: `${1.125 * scale}rem`,
                boxShadow: '0 2px 6px rgba(184, 92, 58, 0.4)',
                animation: 'fadeInUp 200ms ease-out',
              }}
            >
              Discard
            </button>
          )}
        </div>
      </div>

      {/* Spectator view overlay */}
      {isSpectator && spectatorAllHands && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          zIndex: 50,
          padding: `${2 * scale}rem ${1 * scale}rem`,
          overflow: 'auto',
        }}>
          <div style={{ color: '#fff', fontSize: `${1.5 * scale}rem`, fontWeight: 700, marginBottom: `${1 * scale}rem` }}>
            Spectating
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: `${1 * scale}rem`,
            width: '100%',
            maxWidth: '900px',
          }}>
            {[0, 1, 2, 3].map((seatIdx) => {
              const hand = spectatorAllHands[seatIdx];
              if (!hand) return null;
              const tiles = hand.tiles.map(parseTileId);
              const playerData: any = roomState?.players ? Array.from(roomState.players.values()).find((p: any) => p.seatIndex === seatIdx) : null;
              const name = playerData?.displayName ?? `Seat ${seatIdx}`;
              return (
                <div key={seatIdx} style={{
                  background: 'rgba(255,255,255,0.08)',
                  borderRadius: '8px',
                  padding: `${0.75 * scale}rem`,
                }}>
                  <div style={{ color: '#fff', fontSize: `${1 * scale}rem`, fontWeight: 600, marginBottom: `${0.5 * scale}rem` }}>
                    {name} ({['East', 'South', 'West', 'North'][seatIdx]})
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px' }}>
                    {tiles.map((tile) => (
                      <TileRenderer key={tile.id} tile={tile} width={Math.round(36 * scale)} height={Math.round(50 * scale)} />
                    ))}
                    {hand.melds.map((meld, mi) => (
                      <div key={mi} style={{ display: 'flex', gap: '1px', marginLeft: `${0.5 * scale}rem` }}>
                        {meld.tileIds.map((tid) => {
                          const t = parseTileId(tid);
                          return meld.isConcealed
                            ? <div key={tid} style={{ width: Math.round(36 * scale), height: Math.round(50 * scale), background: '#4a6741', borderRadius: '3px' }} />
                            : <TileRenderer key={tid} tile={t} width={Math.round(36 * scale)} height={Math.round(50 * scale)} />;
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          {/* Join seat button for spectators */}
          {(phase === 'HAND_END' || phase === 'ROUND_END' || phase === 'MATCH_END') && (
            <div style={{ marginTop: `${1 * scale}rem` }}>
              <div style={{ color: '#ccc', fontSize: `${0.9 * scale}rem`, marginBottom: `${0.5 * scale}rem` }}>
                Open seats available:
              </div>
              <div style={{ display: 'flex', gap: `${0.5 * scale}rem` }}>
                {[0, 1, 2, 3].map((seatIdx) => {
                  const seatPlayer: any = roomState?.players ? Array.from(roomState.players.values()).find((p: any) => p.seatIndex === seatIdx && !p.isSpectator) : null;
                  const isOccupied = seatPlayer && seatPlayer.isConnected;
                  if (isOccupied) return null;
                  return (
                    <button
                      key={seatIdx}
                      onClick={() => room?.send('spectator-join-seat', { seatIndex: seatIdx })}
                      style={{
                        padding: `${0.5 * scale}rem ${1 * scale}rem`,
                        background: 'var(--accent-warm)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: `${0.9 * scale}rem`,
                        fontWeight: 600,
                      }}
                    >
                      Seat {seatIdx} ({['East', 'South', 'West', 'North'][seatIdx]})
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Hand result overlay */}
      {handResult && (
        <div className={handResult.endReason === 'exhaustive-draw' ? 'mj-result-overlay' : 'mj-result-overlay mj-result-overlay--win'} style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.75)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
          zIndex: 100,
          padding: '1rem',
        }}>
          {handResult.endReason !== 'exhaustive-draw' && (
            <div className="mj-win-confetti" aria-hidden="true">
              {Array.from({ length: 24 }).map((_, i) => <i key={i} style={{ ['--i' as any]: i }} />)}
            </div>
          )}
          <div className="mj-result-card" style={{
            background: 'var(--surface-panel)',
            borderRadius: '16px',
            padding: '1.5rem',
            maxWidth: 'min(500px, 95vw)',
            width: '100%',
            textAlign: 'center',
            maxHeight: '90dvh',
            overflow: 'auto',
          }}>
            {handResult.endReason === 'match-end' ? (
              <>
                <h2 style={{ color: 'var(--accent-warm)', margin: '0 0 1rem 0', fontSize: `${3 * scale}rem` }}>Match Over</h2>
                {handResult.finalScores?.map((s: any) => {
                  const seat = seatDisplays[s.seatIndex];
                  return (
                    <div key={s.seatIndex} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', fontSize: `${2.125 * scale}rem` }}>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{seat?.displayName ?? `Seat ${s.seatIndex}`}</span>
                      <span style={{ color: s.points >= 300 ? 'var(--success)' : 'var(--danger)', fontWeight: 700 }}>{s.points}</span>
                    </div>
                  );
                })}
              </>
            ) : handResult.endReason === 'exhaustive-draw' ? (
              <>
                <h2 style={{ color: 'var(--text-primary)', margin: '0 0 1rem 0', fontSize: `${3 * scale}rem` }}>Exhaustive Draw</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: `${2.125 * scale}rem` }}>No one wins this hand.</p>
              </>
            ) : (
              <>
                <h2 style={{ color: 'var(--accent-warm)', margin: '0 0 0.75rem 0', fontSize: `${3.5 * scale}rem` }}>
                  {handResult.blindKanRon ? 'Ron (Blind Kan)!' : handResult.winType === 'ron' ? 'Ron!' : 'Tsumo!'}
                </h2>
                <p style={{ color: 'var(--text-primary)', fontSize: `${2.125 * scale}rem`, margin: '0 0 0.5rem 0' }}>
                  {seatDisplays.find(s => s.seatIndex === handResult.winner)?.displayName ?? `Seat ${handResult.winner}`} wins with {handResult.fan} fan{handResult.hasGong ? ' + GONG (2x)' : ''}
                </p>

                {/* Winning hand tiles - grouped by melds */}
                {(handResult.handGroups || (handResult.winnerTiles && handResult.winnerTiles.length > 0)) && (
                  <div style={{ margin: '1rem 0', padding: '0.75rem', background: 'rgba(0,0,0,0.15)', borderRadius: '10px' }}>
                    <div style={{ fontSize: `${1.375 * scale}rem`, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 600 }}>Winning Hand</div>
                    {handResult.handGroups ? (
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                        {handResult.handGroups.map((group: { type: string; tileIds: string[] }, gi: number) => (
                          <div key={gi} style={{
                            display: 'flex',
                            gap: 2,
                            padding: group.type === 'pair' ? '2px 6px' : '2px 4px',
                            background: group.type === 'pair' ? 'rgba(251,191,36,0.12)' : group.type === 'chi' ? 'rgba(59,130,246,0.1)' : 'rgba(255,255,255,0.06)',
                            borderRadius: '6px',
                            border: group.type === 'pair' ? '1px solid rgba(251,191,36,0.3)' : '1px solid rgba(255,255,255,0.08)',
                          }}>
                            {group.tileIds.map((tid: string, ti: number) => (
                              <div key={ti}>{renderResultTile(parseTileId(tid), 60, 84)}</div>
                            ))}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', justifyContent: 'center', gap: 2, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                        {handResult.winnerTiles.map((tid: string, i: number) => {
                          const t = parseTileId(tid);
                          return <div key={tid}>{renderResultTile(t, 60, 84)}</div>;
                        })}
                      </div>
                    )}
                    {handResult.winnerMelds && handResult.winnerMelds.length > 0 && !handResult.handGroups && (
                      <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {handResult.winnerMelds.map((m: { type: string; tileIds: string[] }, mi: number) => (
                          <div key={mi} style={{ display: 'flex', gap: 1, padding: '2px 4px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px' }}>
                            {m.tileIds.map((tid: string, ti: number) => (
                              <div key={ti}>{renderResultTile(parseTileId(tid), 48, 66)}</div>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <p style={{ color: 'var(--accent-warm)', fontSize: `${3.5 * scale}rem`, fontWeight: 700, margin: '0.5rem 0' }}>
                  {handResult.total} points
                </p>
                {handResult.patterns && (
                  <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    {handResult.patterns.map((p: any) => (
                      <div key={p.id} style={{ fontSize: `${1.875 * scale}rem`, color: 'var(--text-secondary)' }}>
                        {p.name} <span style={{ color: 'var(--accent-warm)', fontWeight: 600 }}>({p.fanValue} fan)</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
            {phase === 'HAND_END' && (
              <Button
                onClick={() => {
                  if (handResult.endReason === 'match-end') {
                    navigate('/');
                  } else {
                    room?.send('next-hand');
                    setHandResult(null);
                    setHandTiles([]);
                    setDrawnTileId(null);
                    setWildCardTileId(null);
                  }
                }}
                size="lg"
                style={{ marginTop: '1.5rem', width: '100%' }}
              >
                {handResult.endReason === 'match-end' ? 'Back to Home' : 'Next Hand'}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Leave confirmation overlay */}
      {showLeaveConfirm && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 200,
        }}>
          {handResult.endReason !== 'exhaustive-draw' && (
            <div className="mj-win-confetti" aria-hidden="true">
              {Array.from({ length: 24 }).map((_, i) => <i key={i} style={{ ['--i' as any]: i }} />)}
            </div>
          )}
          <div className="mj-result-card" style={{
            background: 'var(--surface-panel)',
            borderRadius: '16px',
            padding: '1.5rem',
            maxWidth: '360px',
            width: '90%',
            textAlign: 'center',
          }}>
            <h3 style={{ color: 'var(--text-primary)', margin: '0 0 0.75rem 0', fontSize: `${1.75 * scale}rem` }}>Leave Game?</h3>
            <p style={{ color: 'var(--text-secondary)', margin: '0 0 1.25rem 0', fontSize: `${1.375 * scale}rem` }}>You will disconnect from the room and cannot rejoin.</p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <Button variant="secondary" onClick={() => setShowLeaveConfirm(false)}>Cancel</Button>
              <Button onClick={handleLeave}>Leave</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
