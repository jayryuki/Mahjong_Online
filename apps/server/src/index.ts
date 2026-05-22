/**
 * Colyseus Multi-Game Server
 *
 * Hosts multiple game types behind a single Colyseus instance on port 2500.
 * Currently running: Mahjong + Blackjack.
 *
 * See docs/adding-a-new-game.md for the full guide on adding new game rooms.
 */

import { Server, matchMaker } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { createServer } from 'http';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { MahjongRoom } from './rooms/MahjongRoom.js';
import { BlackjackRoom } from './rooms/BlackjackRoom.js';
import { RouletteRoom } from './rooms/RouletteRoom.js';
import { RoomCodeService } from './services/RoomCodeService.js';

// Access the local rooms map from matchMaker for real-time data
const getLocalRoomById = (matchMaker as any).getLocalRoomById.bind(matchMaker) as (roomId: string) => any;

const app = express();
app.use(express.json());

// Serve frontend builds based on host
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mahjongDist = path.resolve(__dirname, '../../web/dist');
const blackjackDist = path.resolve(__dirname, '../blackjack-dist');
const rouletteDist = path.resolve(__dirname, '../roulette-dist');

// Serve frontend builds based on host header.
// Each game gets its own subdomain (e.g. blackjack.jayryuki.com).
// To add a new game: add a dist path variable above and a host.includes() branch here.
app.use((req, res, next) => {
  const host = req.hostname || req.headers.host || '';
  if (host.includes('roulette')) {
    express.static(rouletteDist)(req, res, next);
  } else if (host.includes('blackjack')) {
    express.static(blackjackDist)(req, res, next);
  } else {
    // Default: serve mahjong frontend
    express.static(mahjongDist)(req, res, next);
  }
});

const server = createServer(app);
const transport = new WebSocketTransport({ server });

const gameServer = new Server({ transport });

// Register all game rooms with Colyseus.
// The string arg is the "roomType" — used by matchMaker.createRoom() and
// by clients joining via colyseusClient.joinById().
// To add a new game: gameServer.define('poker', PokerRoom);
gameServer.define('mahjong', MahjongRoom);
gameServer.define('blackjack', BlackjackRoom);
gameServer.define('roulette', RouletteRoom);

const roomCodeService = new RoomCodeService();

app.post('/api/rooms', async (req, res) => {
  const { displayName, preset, game } = req.body;
  // Map the 'game' field from the client to a Colyseus room type string.
  // To add a new game: add a mapping here, e.g. game === 'poker' ? 'poker' : ...
  const gameType = game === 'blackjack' ? 'blackjack'
               : game === 'roulette' ? 'roulette'
               : 'mahjong';
  const roomCode = roomCodeService.generateCode();
  const hostPlayerId = `player-${Date.now()}`;

  try {
    const room = await matchMaker.createRoom(gameType, {
      preset: preset || (gameType === 'blackjack' ? 'standard' : 'riichi'),
      hostPlayerId,
      roomCode,
    });

    roomCodeService.register(roomCode, room.roomId, gameType);
    res.json({ roomCode, roomId: room.roomId, hostPlayerId, game: gameType });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create room' });
  }
});

app.get('/api/rooms', async (req, res) => {
  try {
    const filterGame = req.query.game as string | undefined;
    const allEntries = [...roomCodeService.getAll().entries()]; // [code, { roomId, game }]
    if (allEntries.length === 0) {
      res.json([]);
      return;
    }

    const result = [];

    for (const [code, { roomId, game }] of allEntries) {
      if (filterGame && game !== filterGame) continue;

      const room = getLocalRoomById(roomId);
      if (room) {
        const state = room.state as any;
        let hostName = '';
        if (state.players) {
          for (const p of state.players.values()) {
            if (p.isHost) { hostName = p.displayName; break; }
          }
        }
        const entry: any = {
          roomId,
          roomCode: code,
          game,
          hostName,
          playerCount: room.clients.length,
          maxPlayers: room.maxClients,
          openSlots: room.maxClients - room.clients.length,
          status: state.status ?? 'lobby',
        };
        if (game === 'mahjong') {
          entry.wallRemaining = state.wallRemaining ?? 0;
        }
        result.push(entry);
      } else {
        // Room no longer in memory — remove stale entry
        roomCodeService.remove(code);
      }
    }

    res.json(result);
  } catch (err) {
    const fallback = [...roomCodeService.getAll().entries()].map(([code, { roomId, game }]) => ({
      roomId,
      roomCode: code,
      game,
      hostName: '',
      playerCount: 0,
      maxPlayers: game === 'blackjack' ? 7 : game === 'roulette' ? 8 : 4,
      openSlots: game === 'blackjack' ? 7 : game === 'roulette' ? 8 : 4,
      status: 'lobby',
    }));
    res.json(fallback);
  }
});

app.get('/api/rooms/:code', (req, res) => {
  const roomId = roomCodeService.getRoomId(req.params.code);
  const game = roomCodeService.getGame(req.params.code);
  if (roomId && game) {
    res.json({ roomId, exists: true, game });
  } else {
    res.status(404).json({ error: 'Room not found' });
  }
});

// SPA catch-all: serve index.html for all non-API routes (React Router)
// To add a new game: add its dist to the host→dist mapping below.
app.get('*', (req, res) => {
  const host = req.hostname || req.headers.host || '';
  const dist = host.includes('roulette') ? rouletteDist
             : host.includes('blackjack') ? blackjackDist
             : mahjongDist;
  res.sendFile(path.join(dist, 'index.html'));
});

const PORT: number = parseInt(process.env.PORT || '2500', 10);
gameServer.listen(PORT).then(() => {
  console.log(`Game server running on port ${PORT} (mahjong + blackjack + roulette)`);
});
