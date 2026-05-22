/**
 * RoomCodeService — Maps human-readable room codes to Colyseus room IDs + game types.
 *
 * When a room is created via POST /api/rooms, we generate a short code (e.g. "UNQEUT")
 * and store { roomId, game } against it. Clients then use the code to join — the server
 * looks up the real roomId before the client calls colyseusClient.joinById().
 *
 * This service is game-agnostic. The 'game' field is just a string tag that gets
 * stored and returned; no changes needed here when adding new game types.
 */

const CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'.split('');
const CODE_LENGTH = 6;

interface RoomEntry {
  roomId: string;
  game: string;
}

export class RoomCodeService {
  private codeToRoom = new Map<string, RoomEntry>();

  generateCode(): string {
    let code: string;
    do {
      code = '';
      for (let i = 0; i < CODE_LENGTH; i++) {
        code += CHARSET[Math.floor(Math.random() * CHARSET.length)];
      }
    } while (this.codeToRoom.has(code));
    return code;
  }

  register(code: string, roomId: string, game: string): void {
    this.codeToRoom.set(code.toUpperCase(), { roomId, game });
  }

  getRoomId(code: string): string | undefined {
    return this.codeToRoom.get(code.toUpperCase())?.roomId;
  }

  getGame(code: string): string | undefined {
    return this.codeToRoom.get(code.toUpperCase())?.game;
  }

  remove(code: string): void {
    this.codeToRoom.delete(code.toUpperCase());
  }

  getAll(): Map<string, RoomEntry> {
    return this.codeToRoom;
  }
}
