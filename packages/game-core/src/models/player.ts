export interface PlayerState {
  playerId: string;
  displayName: string;
  seatIndex: number;
  isConnected: boolean;
  isReady: boolean;
  isHost: boolean;
}

export interface PlayerScoreState {
  seatIndex: number;
  points: number;
  riichiDeposit: boolean;
}

export interface ScoreTrack {
  entries: PlayerScoreState[];
  startValue: number;
}

export interface SpectatorState {
  playerId: string;
  displayName: string;
  joinedAt: number;
}
