import { useMemo } from 'react';

export function useLegalActions(state: any, mySeatIndex: number): string[] {
  return useMemo(() => {
    if (!state?.round) return [];
    return state.legalActions ?? [];
  }, [state, mySeatIndex]);
}
