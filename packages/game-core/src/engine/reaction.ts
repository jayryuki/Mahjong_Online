import { TileDef } from '../models/tile.js';

export interface ReactionState {
  reactionId: string;
  discardSeat: number;
  discardTile: TileDef;
  eligibleSeats: number[];
  responses: Record<number, ReactionResponse | null>;
  deadline: number;
  resolved: boolean;
  createdAt: number;
}

export type ReactionResponse =
  | { type: 'pass' }
  | { type: 'ron' }
  | { type: 'pon' }
  | { type: 'kan-open' }
  | { type: 'chi'; tiles: [number, number] };

export function createReaction(
  reactionId: string,
  discardSeat: number,
  discardTile: TileDef,
  eligibleSeats: number[],
  deadlineMs: number,
): ReactionState {
  const responses: Record<number, ReactionResponse | null> = {};
  for (const seat of eligibleSeats) {
    responses[seat] = null;
  }
  return {
    reactionId,
    discardSeat,
    discardTile,
    eligibleSeats,
    responses,
    deadline: Date.now() + deadlineMs,
    resolved: false,
    createdAt: Date.now(),
  };
}

export function submitResponse(
  state: ReactionState,
  seatIndex: number,
  response: ReactionResponse,
): ReactionState {
  if (state.resolved || !(seatIndex in state.responses)) return state;
  if (state.responses[seatIndex] !== null) return state;
  return {
    ...state,
    responses: { ...state.responses, [seatIndex]: response },
  };
}

export function isAllResponded(state: ReactionState): boolean {
  return state.eligibleSeats.every(s => state.responses[s] !== null);
}

export function autoPassUnresponded(state: ReactionState): ReactionState {
  const responses = { ...state.responses };
  for (const seat of state.eligibleSeats) {
    if (responses[seat] === null) {
      responses[seat] = { type: 'pass' };
    }
  }
  return { ...state, responses, resolved: true };
}
