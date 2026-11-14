import type { AIDifficulty } from '../../core/types';
import { findBestCheckersMove } from './checkersAi';
import type { CheckersMoveAction, CheckersState } from './checkersEngine';

export interface CheckersWorkerRequest {
  requestId: number;
  state: CheckersState;
  difficulty: AIDifficulty;
}

export interface CheckersWorkerResponse {
  requestId: number;
  move: CheckersMoveAction | null;
}

self.onmessage = (event: MessageEvent<CheckersWorkerRequest>) => {
  const { requestId, state, difficulty } = event.data;
  const move = findBestCheckersMove(state, difficulty);
  const response: CheckersWorkerResponse = { requestId, move };
  self.postMessage(response);
};
