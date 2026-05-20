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
