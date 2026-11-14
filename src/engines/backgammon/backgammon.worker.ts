import type { AIDifficulty } from '../../core/types';
import { findBestBackgammonAction } from './backgammonAi';
import type { BackgammonState } from './backgammonEngine';

interface WorkerReq {
  id: number;
  state: BackgammonState;
  difficulty: AIDifficulty;
}

self.onmessage = (event: MessageEvent<WorkerReq>) => {
  const { id, state, difficulty } = event.data;
  const action = findBestBackgammonAction(state, difficulty);
  self.postMessage({ id, action });
};
