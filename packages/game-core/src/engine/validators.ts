import { ActionType, ActionPayload } from './actions.js';
import { RoundState } from '../models/round.js';
import { RulesPreset } from '../rules/preset.js';

export function legalActionsForSeat(
  round: RoundState,
  preset: RulesPreset,
  seatIndex: number,
): ActionType[] {
  const actions: ActionType[] = [];
  const phase = round.seats[seatIndex];

  if (!phase) return actions;

  // TURN_DRAW: active seat draws
  if (round.activeSeat === seatIndex && round.wall.remaining > 0) {
    actions.push('DRAW_TILE');
  }

  // TURN_DECISION: active seat can discard, declare win tsumo
  if (round.activeSeat === seatIndex) {
    actions.push('DISCARD_TILE');
    if (canTsumo(round, seatIndex)) {
      actions.push('DECLARE_WIN_TSUMO');
    }
  }

  // Reaction window: eligible seats can pass or claim
  if (round.reaction && !isReactionResolved(round.reaction)) {
    const response = getReactionResponse(round.reaction, seatIndex);
    if (response === null && isEligibleSeat(round.reaction, seatIndex)) {
      actions.push('PASS_REACTION');
      if (canRon(round, seatIndex)) actions.push('DECLARE_WIN_RON');
      if (canPon(round, seatIndex, preset)) actions.push('CALL_PON');
      if (canChi(round, seatIndex, preset)) actions.push('CALL_CHI');
      if (canKanOpen(round, seatIndex, preset)) actions.push('CALL_KAN_OPEN');
    }
  }

  return actions;
}

function canTsumo(round: RoundState, seatIndex: number): boolean {
  return round.activeSeat === seatIndex;
}

function canRon(round: RoundState, seatIndex: number): boolean {
  return round.reaction !== null;
}

function canPon(round: RoundState, seatIndex: number, preset: RulesPreset): boolean {
  if (!preset.allowPon || !preset.allowOpenHand) return false;
  return round.reaction !== null;
}

function canChi(round: RoundState, seatIndex: number, preset: RulesPreset): boolean {
  if (!preset.allowChi || !preset.allowOpenHand) return false;
  if (!round.reaction) return false;
  const discardSeat = (round.reaction as any).discardSeat;
  const chiSeat = (discardSeat + 1) % preset.playerCount;
  return seatIndex === chiSeat;
}

function canKanOpen(round: RoundState, seatIndex: number, preset: RulesPreset): boolean {
  if (!preset.allowKan || !preset.allowOpenHand) return false;
  return round.reaction !== null;
}

function isReactionResolved(reaction: unknown): boolean {
  if (reaction && typeof reaction === 'object' && 'resolved' in reaction) {
    return (reaction as any).resolved === true;
  }
  return false;
}

function getReactionResponse(reaction: unknown, seatIndex: number): unknown {
  if (reaction && typeof reaction === 'object' && 'responses' in reaction) {
    return (reaction as any).responses?.[seatIndex] ?? undefined;
  }
  return undefined;
}

function isEligibleSeat(reaction: unknown, seatIndex: number): boolean {
  if (reaction && typeof reaction === 'object' && 'eligibleSeats' in reaction) {
    return (reaction as any).eligibleSeats?.includes(seatIndex) ?? false;
  }
  return false;
}
