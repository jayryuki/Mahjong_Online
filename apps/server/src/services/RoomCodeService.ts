const CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'.split('');
const CODE_LENGTH = 6;

export class RoomCodeService {
  private codeToRoomId = new Map<string, string>();

  generateCode(): string {
    let code: string;
    do {
      code = '';
      for (let i = 0; i < CODE_LENGTH; i++) {
        code += CHARSET[Math.floor(Math.random() * CHARSET.length)];
      }
    } while (this.codeToRoomId.has(code));
    return code;
  }

  register(code: string, roomId: string): void {
    this.codeToRoomId.set(code.toUpperCase(), roomId);
  }

  getRoomId(code: string): string | undefined {
    return this.codeToRoomId.get(code.toUpperCase());
  }

  remove(code: string): void {
    this.codeToRoomId.delete(code.toUpperCase());
  }

  getAll(): Map<string, string> {
    return this.codeToRoomId;
  }
}
