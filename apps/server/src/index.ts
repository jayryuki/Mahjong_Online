/**
 * Colyseus Multi-Game Server
 *
 * This server hosts multiple game types behind a single Colyseus instance.
 * Currently running: Mahjong + Blackjack.
 *
 * ── HOW TO ADD A NEW GAME ──
 *
 * 1. CREATE A GAME-CORE PACKAGE (in packages/)
 *      - Copy packages/blackjack-game-core as a template
 *      - Name it @<game>/game-core in its package.json
 *      - Add it as a workspace dependency in this server's package.json:
 *          "@poker/game-core": "workspace:*"
 *      - Run `pnpm install` from the monorepo root
 *
 * 2. CREATE ROOM + SCHEMA (in src/rooms/)
 *      - Create src/rooms/PokerRoom.ts extending Room<GameState>
 *      - Create src/rooms/schema/PokerGameState.ts with your Colyseus Schema
 *      - The Room class must have onCreate(), onJoin(), onLeave(), onDispose()
 *      - See BlackjackRoom.ts or MahjongRoom.ts for full examples
 *
 * 3. REGISTER THE ROOM (this file)
 *      - Import: `import { PokerRoom } from './rooms/PokerRoom.js';`
 *      - Define: `gameServer.define('poker', PokerRoom);`
 *      - This string ('poker') is the gameType used everywhere below
 *
 * 4. ADD FRONTEND DIST (in apps/server/)
 *      - Build the game's web client (e.g. apps/poker-web)
 *      - Copy the dist output to apps/server/poker-dist/
 *      - Add a variable: `const pokerDist = path.resolve(__dirname, '../poker-dist');`
 *
 * 5. UPDATE HOST-BASED ROUTING (two places in this file)
 *      - Static middleware: add a `host.includes('poker')` branch
 *      - SPA catch-all: add poker to the host→dist mapping
 *      - Each game gets its own subdomain (e.g. poker.jayryuki.com)
 *
 * 6. UPDATE API ROUTES (three places in this file)
 *      - POST /api/rooms: map `game === 'poker'` → gameType 'poker'
 *      - GET  /api/rooms: add game-specific fields to the room listing
 *      - GET  /api/rooms/:code: no change needed (already generic)
 *
 * 7. UPDATE FALLBACK maxPlayers (in GET /api/rooms catch block)
 *      - Add: `game === 'poker' ? 9 :` to the ternary chain
 *
 * The key insight: Colyseus is game-agnostic. You just call
 * `gameServer.define('gametype', RoomClass)` and it handles WebSocket
 * routing. The REST API and frontend serving are Express concerns
 * that you wire up alongside it.
 */

import { Server, matchMaker } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { createServer } from 'http';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { MahjongRoom } from './rooms/MahjongRoom.js';
import { BlackjackRoom } from './rooms/BlackjackRoom.js';
import { RoomCodeService } from './services/RoomCodeService.js';

// Access the local rooms map from matchMaker for real-time data
const getLocalRoomById = (matchMaker as any).getLocalRoomById.bind(matchMaker) as (roomId: string) => any;

const app = express();
app.use(express.json());

// Serve frontend builds based on host
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mahjongDist = path.resolve(__dirname, '../../web/dist');
const blackjackDist = path.resolve(__dirname, '../blackjack-dist');

// Serve frontend builds based on host header.
// Each game gets its own subdomain (e.g. blackjack.jayryuki.com).
// To add a new game: add a dist path variable above and a host.includes() branch here.
app.use((req, res, next) => {
  const host = req.hostname || req.headers.host || '';
  if (host.includes('blackjack')) {
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

const roomCodeService = new RoomCodeService();

app.post('/api/rooms', async (req, res) => {
  const { displayName, preset, game } = req.body;
  // Map the 'game' field from the client to a Colyseus room type string.
  // To add a new game: add a mapping here, e.g. game === 'poker' ? 'poker' : ...
  const gameType = game === 'blackjack' ? 'blackjack' : 'mahjong';
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
      maxPlayers: game === 'blackjack' ? 7 : 4,
      openSlots: game === 'blackjack' ? 7 : 4,
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
  const dist = host.includes('blackjack') ? blackjackDist : mahjongDist;
  res.sendFile(path.join(dist, 'index.html'));
});

const PORT: number = parseInt(process.env.PORT || '2500', 10);
gameServer.listen(PORT).then(() => {
  console.log(`Game server running on port ${PORT} (mahjong + blackjack)`);
});
