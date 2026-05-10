import { Server, matchMaker } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { createServer } from 'http';
import express from 'express';
import { MahjongRoom } from './rooms/MahjongRoom.js';
import { RoomCodeService } from './services/RoomCodeService.js';

const app = express();
app.use(express.json());

const server = createServer(app);
const transport = new WebSocketTransport({ server });

const gameServer = new Server({ transport });

gameServer.define('mahjong', MahjongRoom);

const roomCodeService = new RoomCodeService();

app.post('/api/rooms', async (req, res) => {
  const { displayName, preset } = req.body;
  const roomCode = roomCodeService.generateCode();
  const hostPlayerId = `player-${Date.now()}`;

  try {
    const room = await matchMaker.createRoom('mahjong', {
      preset: preset || 'riichi',
      hostPlayerId,
      roomCode,
    });

    roomCodeService.register(roomCode, room.roomId);
    res.json({ roomCode, roomId: room.roomId, hostPlayerId });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create room' });
  }
});

app.get('/api/rooms/:code', (req, res) => {
  const roomId = roomCodeService.getRoomId(req.params.code);
  if (roomId) {
    res.json({ roomId, exists: true });
  } else {
    res.status(404).json({ error: 'Room not found' });
  }
});

const PORT: number = parseInt(process.env.PORT || '2567', 10);
gameServer.listen(PORT).then(() => {
  console.log(`Mahjong server running on port ${PORT}`);
});
