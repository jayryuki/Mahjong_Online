import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { HandArea } from '../components/table/HandArea.js';
import { MeldArea } from '../components/table/MeldArea.js';
import { ActionPrompt } from '../components/actions/ActionPrompt.js';
import { Button, ThemePicker } from '@games/ui';
import { ChatPanel, ChatMessageData } from '../components/common/ChatPanel.js';
import { TileRenderer } from '../components/common/TileRenderer.js';
import { InfoBar } from '../components/table/InfoBar.js';
import { WildCardDisplay } from '../components/table/WildCardDisplay.js';
import { useScale } from '../hooks/useScale.js';
import { clearRoom } from '../lib/gameContext.js';
import { TileDef } from '@mahjong/game-core';
import { playTurnSound, playReactionSound, playWinSound } from '../lib/sounds.js';
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

const SEAT_WIND_NAMES = ['East', 'South', 'West', 'North'];
const SUIT_LABELS: Record<string, string> = { man: 'Characters', pin: 'Dots', sou: 'Bamboo' };
const HONOR_LABELS: Record<string, string> = {
  east: 'East',
  south: 'South',
  west: 'West',
  north: 'North',
  haku: 'White Dragon',
  hatsu: 'Green Dragon',
  chun: 'Red Dragon',
};

function formatSeatWind(seatIndex: number): string {
  return SEAT_WIND_NAMES[seatIndex] ?? `Seat ${seatIndex}`;
}

function formatTileLabel(tile: TileDef): string {
  if (tile.suit) {
    return `${tile.rank} ${SUIT_LABELS[tile.suit] ?? tile.suit}`;
  }
  return HONOR_LABELS[tile.honorName ?? ''] ?? tile.honorName ?? 'tile';
}

function formatMeldLabel(type: string): string {
  if (type === 'chi') return 'Chi';
  if (type === 'pon') return 'Pon';
  if (type === 'kan-open') return 'Open Kan';
  if (type === 'kan-added') return 'Added Kan';
  if (type === 'kan-closed') return 'Closed Kan';
  return 'Meld';
}

function renderConcealedMeldTile(width: number, height: number) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: '8px',
        background: 'var(--mahjong-concealed-tile-bg)',
        border: '1px solid var(--game-panel-border)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12), 0 5px 14px rgba(0,0,0,0.18)',
      }}
    />
  );
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

interface TableNoticeData {
  actorSeat: number;
  fromSeat?: number | null;
  meldType: string;
  claimedTileId?: string | null;
  tileIds?: string[];
}

const SEAT_ORDER = [0, 1, 2, 3] as const;
const DISCARD_COLUMNS = 10;
const DISCARD_PANEL_MAX_WIDTH = 1040;
const TURN_BAR_MIN_HEIGHT = 52;

interface GameScreenProps {
  room: any;
  mySessionId: string;
  roomCode: string;
}

export function GameScreen({ room, mySessionId, roomCode }: GameScreenProps) {
  const navigate = useNavigate();
  void roomCode;

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
  const [callNotice, setCallNotice] = useState<string | null>(null);

  // Whether it's currently the player's turn (for visual emphasis)
  const [isMyTurn, setIsMyTurn] = useState(false);

  // Track seat mapping from state
  const seatMapRef = useRef<Map<string, number>>(new Map());
  const seatLabelsRef = useRef<Record<number, string>>({
    0: 'East',
    1: 'South',
    2: 'West',
    3: 'North',
  });
  const noticeTimerRef = useRef<number | null>(null);

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
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [turnSecondsLeft, setTurnSecondsLeft] = useState(30);
  const [autoPlayWarning, setAutoPlayWarning] = useState(false);
  const turnDeadlineRef = useRef<number | null>(null);

  const clearCallNoticeTimer = useCallback(() => {
    if (noticeTimerRef.current !== null) {
      window.clearTimeout(noticeTimerRef.current);
      noticeTimerRef.current = null;
    }
  }, []);

  const showCallNotice = useCallback((message: string) => {
    setCallNotice(message);
    clearCallNoticeTimer();
    noticeTimerRef.current = window.setTimeout(() => {
      setCallNotice(null);
      noticeTimerRef.current = null;
    }, 4200);
  }, [clearCallNoticeTimer]);

  const resetTurnTimer = useCallback(() => {
    if (!isMyTurn) return;
    turnDeadlineRef.current = Date.now() + 30000;
    setTurnSecondsLeft(30);
    setAutoPlayWarning(false);
    try { room?.send('tile-activity'); } catch {}
  }, [isMyTurn, room]);

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
      seatLabelsRef.current = {
        0: players.find((p) => p.seatIndex === 0)?.displayName || formatSeatWind(0),
        1: players.find((p) => p.seatIndex === 1)?.displayName || formatSeatWind(1),
        2: players.find((p) => p.seatIndex === 2)?.displayName || formatSeatWind(2),
        3: players.find((p) => p.seatIndex === 3)?.displayName || formatSeatWind(3),
      };

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

  useEffect(() => () => clearCallNoticeTimer(), [clearCallNoticeTimer]);

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
      setCallNotice(null);

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
      setCallNotice(null);
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
    };

    const onTableNotice = (data: TableNoticeData) => {
      const actorLabel = seatLabelsRef.current[data.actorSeat] ?? formatSeatWind(data.actorSeat);
      const meldLabel = formatMeldLabel(data.meldType);
      const claimedLabel = data.claimedTileId ? formatTileLabel(parseTileId(data.claimedTileId)) : null;
      const fromLabel = data.fromSeat !== undefined && data.fromSeat !== null
        ? seatLabelsRef.current[data.fromSeat] ?? formatSeatWind(data.fromSeat)
        : null;

      let message = fromLabel
        ? `${actorLabel} called ${meldLabel} on ${claimedLabel ?? 'a tile'} from ${fromLabel}.`
        : `${actorLabel} declared ${meldLabel}${claimedLabel ? ` with ${claimedLabel}` : ''}.`;

      if (data.actorSeat === mySeatRef.current) {
        message += ' Discard a tile.';
      }

      setStatusMessage(message);
      showCallNotice(message);
      playReactionSound();
    };

    const onHandResult = (data: any) => {
      setHandResult(data);
      setLegalActions([]);
      setReactionOptions([]);
      setBlindKanReactionOptions([]);
      setDrawnTileId(null);
      setCallNotice(null);
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

    const onSeatJoinError = (data: { reason?: string }) => {
      const message = data.reason || 'That seat cannot be joined right now.';
      setStatusMessage(message);
      showCallNotice(message);
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
    unsubs.push(room.onMessage('table-notice', onTableNotice));
    unsubs.push(room.onMessage('hand-result', onHandResult));
    unsubs.push(room.onMessage('match-end', onMatchEnd));
    unsubs.push(room.onMessage('blind-kan-reaction-options', onBlindKanReactionOptions));
    unsubs.push(room.onMessage('spectator-hand-state', onSpectatorHandState));
    unsubs.push(room.onMessage('seat-join-error', onSeatJoinError));
    unsubs.push(room.onMessage('seat-joined', (data: { seatIndex: number }) => {
      setIsSpectator(false);
      setSpectatorAllHands(null);
      setMySeat(data.seatIndex);
      mySeatRef.current = data.seatIndex;
      setCallNotice(null);
      room.send('request-hand');
    }));

    return () => {
      for (const unsub of unsubs) {
        unsub();
      }
    };
  }, [room, resetTurnTimer, showCallNotice]);

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
    resetTurnTimer();
    if (!room) return;

    setIsMyTurn(false);

    switch (action) {
      case 'DRAW_TILE':
        room.send('draw-tile', { auto: false });
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
    resetTurnTimer();
    if (!room) return;
    room.send('discard-tile', { tileId: tile.id, auto: false });
    setHandTiles((prev) => prev.filter((t) => t.id !== tile.id));
    setDrawnTileId(null);
    setLegalActions([]);
    setIsMyTurn(false);
    setSelectedIndex(null);
    setStatusMessage('Tile discarded. Waiting...');
  }, [room, resetTurnTimer]);

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
  }, [room, resetTurnTimer]);

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
          // Closed kans stay hidden to the rest of the table, but the owner can still see them.
          if (meldTypes[j] === 'kan-closed' && i !== mySeat) {
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
  const allActions = Array.from(new Set([...legalActions, ...reactionOptions, ...blindKanReactionOptions]));

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
  const discardHistoryTileIds: string[] = roomState?.discardHistoryTileIds
    ? String(roomState.discardHistoryTileIds).split(',').filter(Boolean)
    : [];
  const discardHistoryTiles = discardHistoryTileIds.map((tileId, index) => ({
    tile: parseTileId(tileId),
    key: `${tileId}-${index}`,
  }));
  const seatStripWidth = isMobile ? 'calc((100% - 0.9rem) / 4)' : 'minmax(0, 1fr)';
  const sharedDiscardTileW = Math.max(28, Math.round((isMobile ? 40 : 56) * scale));
  const sharedDiscardTileH = Math.max(40, Math.round((isMobile ? 56 : 78) * scale));
  const sharedMeldTileW = Math.max(16, Math.round((isMobile ? 18 : 21) * scale));
  const sharedMeldTileH = Math.max(24, Math.round((isMobile ? 26 : 31) * scale));
  const currentTurnSeat = seatDisplays.find((seat) => seat.isActive) ?? null;
  const currentTurnLabel = currentTurnSeat
    ? `${formatSeatWind(currentTurnSeat.seatIndex)} · ${currentTurnSeat.displayName}`
    : 'Waiting for next turn';

  // Render a tile for the winning hand display
  const renderResultTile = (tile: TileDef, w: number, h: number) => {
    return <TileRenderer tile={tile} width={Math.round(w * scale)} height={Math.round(h * scale)} />;
  };

  const canDiscard = legalActions.includes('DISCARD_TILE');


  useEffect(() => {
    if (!isMyTurn) {
      turnDeadlineRef.current = null;
      setTurnSecondsLeft(30);
      setAutoPlayWarning(false);
      return;
    }
    turnDeadlineRef.current = Date.now() + 30000;
    setTurnSecondsLeft(30);
    setAutoPlayWarning(false);
  }, [isMyTurn, handVersion, legalActions.join(',')]);

  useEffect(() => {
    if (!isMyTurn) return;
    const interval = window.setInterval(() => {
      const deadline = turnDeadlineRef.current;
      if (!deadline) return;
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setTurnSecondsLeft(remaining);
      setAutoPlayWarning(remaining <= 10);
      if (remaining > 0) return;

      if (legalActions.includes('DRAW_TILE')) {
        room?.send('draw-tile', { auto: true });
        turnDeadlineRef.current = Date.now() + 30000;
        setTurnSecondsLeft(30);
        setAutoPlayWarning(false);
        return;
      }

      if (legalActions.includes('DISCARD_TILE')) {
        const stableTiles = handTiles.filter((tile) => tile.id !== drawnTileId);
        const autoTile = stableTiles[stableTiles.length - 1] ?? handTiles[handTiles.length - 1];
        if (autoTile) {
          room?.send('discard-tile', { tileId: autoTile.id, auto: true });
          turnDeadlineRef.current = null;
        }
      }
    }, 250);
    return () => window.clearInterval(interval);
  }, [isMyTurn, legalActions, handTiles, drawnTileId, room]);


  const handleChangeName = (name: string) => {
    const trimmed = name.trim().slice(0, 20);
    if (!trimmed) return;
    try { localStorage.setItem('mahjong_displayName', trimmed); } catch {}
    room?.send('change-name', { displayName: trimmed });
  };

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', overflowX: 'hidden', overflowY: 'auto' }}>
      {/* === ZONE 1: Top HUD === */}
      <div className="mj-table-topbar" style={{ flexShrink: 0, position: 'relative' }}>
        <div style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          alignItems: isMobile ? 'stretch' : 'center',
          justifyContent: 'space-between',
          gap: isMobile ? '0.35rem' : '0.75rem',
          padding: isMobile ? '0.35rem 0.45rem' : '0.35rem 0.6rem',
          background: 'transparent',
          borderBottom: 'none',
        }}>
          <InfoBar embedded roundWind={roomState?.roundWind ?? 'east'} handNumber={roomState?.handNumber ?? 1} honba={roomState?.honba ?? 0} riichiSticks={0} wallRemaining={roomState?.wallRemaining ?? 0} />
          <div style={{
            display: 'flex',
            justifyContent: isMobile ? 'space-between' : 'flex-end',
            gap: isMobile ? '0.35rem' : '0.5rem',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}>
            <ThemePicker style={isMobile ? { gap: '0.25rem', transform: 'scale(0.88)', transformOrigin: 'center right' } : undefined} />
            <button
              onClick={() => setShowLeaveConfirm(true)}
              style={{
                background: 'rgba(0,0,0,0.5)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '10px',
                padding: isMobile ? '4px 8px' : '7px 12px',
                cursor: 'pointer',
                fontSize: `${(isMobile ? 0.95 : 1.125) * scale}rem`,
                fontWeight: 600,
                fontFamily: "'Inter', sans-serif",
                backdropFilter: 'blur(4px)',
              }}
            >
              Exit
            </button>
          </div>
        </div>
      </div>

      {/* === ZONE 2: Center board (discard region) === */}
      <div className="mj-table-stage" style={{ flex: '1 1 0%', minHeight: isMobile ? '36dvh' : '44dvh', position: 'relative', overflow: 'hidden', borderRadius: '0' }}>
        <div style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          background: 'radial-gradient(circle at top, rgba(255,255,255,0.08), transparent 40%), linear-gradient(180deg, rgba(20,20,18,0.9), rgba(10,10,10,0.94))',
          padding: '0.65rem 0.75rem 0.85rem',
          gap: '0.65rem',
          position: 'relative',
          zIndex: 1,
        }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.75rem',
              padding: '0.4rem 0.7rem',
              minHeight: `${TURN_BAR_MIN_HEIGHT}px`,
              borderRadius: '18px',
              background: currentTurnSeat
                ? 'linear-gradient(135deg, rgba(184,92,58,0.24), rgba(255,255,255,0.08))'
                : 'rgba(255,255,255,0.05)',
              border: `1px solid ${currentTurnSeat ? 'rgba(245,196,81,0.45)' : 'rgba(255,255,255,0.08)'}`,
              boxShadow: currentTurnSeat ? '0 10px 28px rgba(184,92,58,0.16)' : '0 8px 22px rgba(0,0,0,0.16)',
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{
                  fontSize: `${0.72 * scale}rem`,
                  color: 'var(--game-on-table-muted)',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.12em',
                }}>
                  Current turn
                </div>
                <div style={{
                  fontSize: `${1.08 * scale}rem`,
                  color: 'var(--game-on-table-text)',
                  fontWeight: 900,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {currentTurnLabel}
                </div>
              </div>
              {callNotice && (
                <div style={{
                  maxWidth: '48%',
                  padding: '0.35rem 0.65rem',
                  borderRadius: '999px',
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: 'var(--game-on-table-text)',
                  fontSize: `${0.74 * scale}rem`,
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {callNotice}
                </div>
              )}
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? 'repeat(4, minmax(82px, 1fr))' : `repeat(4, ${seatStripWidth})`,
              gap: '0.5rem',
              alignItems: 'stretch',
            }}>
              {SEAT_ORDER.map((seatIndex) => {
                const seat = seatDisplays.find((entry) => entry.seatIndex === seatIndex);
                if (!seat) return null;
                const melds = seat.melds.filter((meld) => ['chi', 'pon', 'kan-open', 'kan-added', 'kan-closed'].includes(meld.type));
                return (
                  <div
                    key={seatIndex}
                    style={{
                      minWidth: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.42rem',
                      padding: '0.45rem',
                      borderRadius: '16px',
                      background: seat.isActive
                        ? 'linear-gradient(180deg, rgba(184,92,58,0.2), rgba(255,255,255,0.05))'
                        : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${seat.isActive ? 'rgba(245,196,81,0.48)' : 'rgba(255,255,255,0.08)'}`,
                      boxShadow: seat.isActive ? '0 0 0 1px rgba(255,255,255,0.08), 0 10px 28px rgba(184,92,58,0.14)' : '0 8px 22px rgba(0,0,0,0.12)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.35rem', minWidth: 0 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{
                          fontSize: `${0.72 * scale}rem`,
                          color: 'var(--game-on-table-muted)',
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          letterSpacing: '0.1em',
                        }}>
                          {formatSeatWind(seatIndex)}
                        </div>
                        <div style={{
                          fontSize: `${0.88 * scale}rem`,
                          color: 'var(--game-on-table-text)',
                          fontWeight: 800,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}>
                          {seat.displayName}
                        </div>
                      </div>
                      <div style={{
                        flexShrink: 0,
                        padding: '0.18rem 0.42rem',
                        borderRadius: '999px',
                        background: seat.isActive ? 'var(--accent-warm)' : 'rgba(255,255,255,0.07)',
                        color: '#fff',
                        fontSize: `${0.68 * scale}rem`,
                        fontWeight: 900,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                      }}>
                        {seat.isActive ? 'Turn' : `${seat.tileCount}t`}
                      </div>
                    </div>

                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.35rem',
                      minHeight: `${Math.max(92, sharedMeldTileH * 2 + 28)}px`,
                    }}>
                      {melds.length === 0 ? (
                        <div style={{
                          flex: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          textAlign: 'center',
                          borderRadius: '12px',
                          border: '1px dashed rgba(255,255,255,0.12)',
                          color: 'var(--game-on-table-muted)',
                          fontSize: `${0.72 * scale}rem`,
                          fontWeight: 700,
                          padding: '0.5rem 0.35rem',
                        }}>
                          No chi or pon yet
                        </div>
                      ) : (
                        melds.map((meld, meldIndex) => {
                          const tileIds = meld.tiles?.map((tile: any) => (typeof tile === 'string' ? tile : tile.id)) ?? [];
                          return (
                            <div
                              key={`${meld.type}-${meldIndex}`}
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.22rem',
                                padding: '0.3rem',
                                borderRadius: '12px',
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid rgba(255,255,255,0.08)',
                              }}
                            >
                              <span style={{
                                fontSize: `${0.62 * scale}rem`,
                                color: 'var(--game-on-table-muted)',
                                fontWeight: 800,
                                letterSpacing: '0.08em',
                                textTransform: 'uppercase',
                              }}>
                                {formatMeldLabel(meld.type)}
                              </span>
                              <div style={{ display: 'flex', gap: '2px', flexWrap: 'nowrap' }}>
                                {meld.isConcealed
                                  ? tileIds.map((_, tileIndex) => (
                                      <div key={`${meld.type}-${meldIndex}-concealed-${tileIndex}`}>
                                        {renderConcealedMeldTile(sharedMeldTileW, sharedMeldTileH)}
                                      </div>
                                    ))
                                  : tileIds.map((tileId: string, tileIndex: number) => {
                                      const tile = parseTileId(tileId);
                                      return (
                                        <TileRenderer
                                          key={`${tileId}-${tileIndex}`}
                                          tile={tile}
                                          width={sharedMeldTileW}
                                          height={sharedMeldTileH}
                                          isWild={!!wildCardTileId && tileKey(tile) === tileKey(parseTileId(wildCardTileId))}
                                        />
                                      );
                                    })}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{
              flex: 1,
              minHeight: 0,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'stretch',
            }}>
              <div style={{
                flex: 1,
                width: '100%',
                maxWidth: `${DISCARD_PANEL_MAX_WIDTH}px`,
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                padding: '0.7rem 0.8rem 0.8rem',
                borderRadius: '22px',
                background: 'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03))',
                border: '1px solid rgba(255,255,255,0.1)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 14px 32px rgba(0,0,0,0.2)',
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  gap: '0.75rem',
                  flexWrap: 'wrap',
                }}>
                  <div>
                    <div style={{
                      fontSize: `${1.12 * scale}rem`,
                      color: 'var(--game-on-table-text)',
                      fontWeight: 900,
                    }}>
                      Discard area
                    </div>
                    <div style={{
                      fontSize: `${0.74 * scale}rem`,
                      color: 'var(--game-on-table-muted)',
                      fontWeight: 700,
                    }}>
                      {discardHistoryTiles.length} tiles shown in play order
                    </div>
                  </div>
                  <div style={{
                    padding: '0.28rem 0.6rem',
                    borderRadius: '999px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: 'var(--game-on-table-muted)',
                    fontSize: `${0.68 * scale}rem`,
                    fontWeight: 800,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                  }}>
                    Shared pile
                  </div>
                </div>

                <div style={{
                  flex: 1,
                  minHeight: 0,
                  overflowY: 'auto',
                  paddingRight: '0.15rem',
                }}>
                  {discardHistoryTiles.length === 0 ? (
                    <div style={{
                      minHeight: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      textAlign: 'center',
                      borderRadius: '18px',
                      border: '1px dashed rgba(255,255,255,0.12)',
                      color: 'var(--game-on-table-muted)',
                      fontSize: `${0.84 * scale}rem`,
                      fontWeight: 700,
                      padding: '1rem',
                    }}>
                      Discards will appear here in one ordered pile.
                    </div>
                  ) : (
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: `repeat(${DISCARD_COLUMNS}, minmax(0, ${sharedDiscardTileW}px))`,
                      justifyContent: 'center',
                      alignContent: 'start',
                      gap: isMobile ? '0.28rem' : '0.38rem',
                    }}>
                      {discardHistoryTiles.map((entry, index) => (
                        <div
                          key={entry.key}
                          style={{
                            position: 'relative',
                            width: `${sharedDiscardTileW}px`,
                            height: `${sharedDiscardTileH}px`,
                          }}
                        >
                          <TileRenderer tile={entry.tile} width={sharedDiscardTileW} height={sharedDiscardTileH} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', flexDirection: isMobile ? 'column' : 'row', padding: '2px 0.5rem', flexShrink: 0, gap: '0.5rem', minHeight: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: isMobile ? 'space-between' : 'flex-start', gap: '0.4rem', minWidth: 0, width: isMobile ? '100%' : 'auto' }}>
            {editingName ? (
              <input
                autoFocus
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onBlur={() => {
                  const trimmed = nameInput.trim().slice(0, 20);
                  if (trimmed && trimmed !== mySeatDisplay?.displayName) handleChangeName(trimmed);
                  setEditingName(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                  if (e.key === 'Escape') setEditingName(false);
                }}
                style={{
                  minWidth: 0,
                  width: 'min(100%, 220px)',
                  fontSize: `${1.025 * scale}rem`,
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  background: 'rgba(255,255,255,0.92)',
                  border: '1px solid var(--accent-warm)',
                  borderRadius: '999px',
                  padding: '0.2rem 0.6rem',
                  outline: 'none',
                }}
              />
            ) : (
              <button
                type="button"
                onClick={() => { setNameInput(mySeatDisplay?.displayName ?? ''); setEditingName(true); }}
                style={{
                  minWidth: 0,
                  fontSize: `${0.95 * scale}rem`,
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  background: 'transparent',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '999px',
                  padding: '0.2rem 0.6rem',
                  cursor: 'pointer',
                }}
                title="Click to change name"
              >
                Edit name
              </button>
            )}
            {isMyTurn && (
              <span style={{
                background: autoPlayWarning ? '#b45309' : 'var(--accent-warm)',
                color: '#fff',
                padding: '2px 8px',
                borderRadius: '999px',
                fontWeight: 800,
                fontSize: `${0.8 * scale}rem`,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                animation: 'turnBannerPulse 2s ease-in-out infinite',
                flexShrink: 0,
              }}>
                {autoPlayWarning ? `Auto in ${turnSecondsLeft}s` : `Your Turn · ${turnSecondsLeft}s`}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', gap: '0.5rem', flexShrink: 0, width: isMobile ? '100%' : 'auto' }}>
            <span style={{ fontSize: `${1 * scale}rem`, color: autoPlayWarning ? '#fcd34d' : 'var(--text-muted)', maxWidth: isMobile ? 'none' : '28ch', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: isMobile ? 'normal' : 'nowrap', lineHeight: 1.35, flex: 1 }}>
              {autoPlayWarning ? `No move in ${turnSecondsLeft}s: auto-play will draw, then toss from the marked Auto tiles.` : statusMessage}
            </span>
            <ChatPanel messages={chatMessages} mySessionId={mySessionId} onSend={handleChatSend} />
          </div>
        </div>

        {/* Row 2: Melds (optional) */}
        {!isMobile && mySeatDisplay && mySeatDisplay.melds.length > 0 && (
          <div style={{ display: 'flex', gap: '0.375rem', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', flexShrink: 0, minHeight: 0, padding: '1px 0' }}>
            <MeldArea melds={mySeatDisplay.melds} />
          </div>
        )}

        {/* Row 3: Controls above hand */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.375rem',
          padding: isMobile ? '4px 0 2px' : '2px 0',
          flexShrink: 0,
          minHeight: 0,
          flexWrap: 'wrap',
        }}>
          {handOrder !== null && (
            <button
              className="mj-dock-control-button mj-dock-control-button--sort"
              onClick={handleSort}
              style={{
                padding: isMobile ? '0.45rem 1rem' : '0.2rem 0.6rem',
                background: 'var(--surface-panel)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '999px',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: `${(isMobile ? 0.98 : 0.85) * scale}rem`,
                minWidth: isMobile ? `${74 * scale}px` : undefined,
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
              className="mj-dock-control-button mj-dock-control-button--draw"
              onClick={() => handleDiscard(handTiles[selectedIndex])}
              style={{
                padding: isMobile ? '0.5rem 1.15rem' : '0.25rem 1rem',
                background: autoPlayWarning ? '#b45309' : 'var(--accent-warm)',
                color: '#fff',
                border: 'none',
                borderRadius: '999px',
                cursor: 'pointer',
                fontWeight: 800,
                fontSize: `${(isMobile ? 1.04 : 1.125) * scale}rem`,
                boxShadow: '0 2px 6px rgba(184, 92, 58, 0.4)',
                animation: 'fadeInUp 200ms ease-out',
                minWidth: isMobile ? `${90 * scale}px` : undefined,
              }}
            >
              Discard
            </button>
          )}
        </div>

        {/* Row 4: Hand tiles (dedicated, tiles only) */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', paddingTop: isMobile ? '0px' : '2px' }}>
          <div style={{
            fontSize: `${0.78 * scale}rem`,
            color: autoPlayWarning ? '#fcd34d' : 'var(--text-muted)',
            background: autoPlayWarning ? 'rgba(120, 53, 15, 0.22)' : 'rgba(255,255,255,0.04)',
            border: autoPlayWarning ? '1px solid rgba(245,196,81,0.35)' : '1px solid rgba(255,255,255,0.08)',
            borderRadius: '999px',
            padding: '0.2rem 0.6rem',
            fontWeight: 700,
          }}>
            {isMobile ? 'Auto toss: 2 rightmost tiles' : 'Auto-toss zone: the 2 rightmost hand tiles'}
          </div>
        </div>
        <div ref={handRowRef} style={{ overflow: 'visible', paddingTop: isMobile ? '8px' : '12px', paddingBottom: isMobile ? '10px' : '12px' }}>
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
            onInteraction={resetTurnTimer}
          />
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
                Join next game:
              </div>
              <div style={{ display: 'flex', gap: `${0.5 * scale}rem` }}>
                {SEAT_ORDER.map((seatIdx) => {
                  const seatPlayer: any = roomState?.players ? Array.from(roomState.players.values()).find((p: any) => p.seatIndex === seatIdx && !p.isSpectator) : null;
                  const isBotSeat = typeof seatPlayer?.playerId === 'string' && seatPlayer.playerId.startsWith('bot-');
                  const humansAtTable = roomState?.players
                    ? Array.from(roomState.players.values()).filter((p: any) => !p.isSpectator && !String(p.playerId).startsWith('bot-')).length
                    : 0;
                  const disabled = !isBotSeat;
                  return (
                    <button
                      key={seatIdx}
                      onClick={() => {
                        if (disabled) {
                          const message = humansAtTable >= 4
                            ? 'All four seats already have human players. Join next game only replaces bots.'
                            : 'Join next game only works to replace a bot.';
                          setStatusMessage(message);
                          showCallNotice(message);
                          return;
                        }
                        room?.send('spectator-join-seat', { seatIndex: seatIdx });
                      }}
                      aria-disabled={disabled}
                      style={{
                        padding: `${0.5 * scale}rem ${1 * scale}rem`,
                        background: disabled ? 'rgba(255,255,255,0.12)' : 'var(--accent-warm)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: disabled ? 'not-allowed' : 'pointer',
                        fontSize: `${0.9 * scale}rem`,
                        fontWeight: 600,
                        opacity: disabled ? 0.55 : 1,
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
            {(phase === 'HAND_END' || handResult.endReason === 'match-end') && (
              <Button
                onClick={() => {
                  if (handResult.endReason === 'match-end') {
                    handleLeave();
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
          {handResult && handResult.endReason !== 'exhaustive-draw' && (
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
