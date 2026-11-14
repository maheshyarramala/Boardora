import type { AIDifficulty } from '../../core/types';
import { findBestMorrisMove } from './nineMensMorrisAi';
import type { NineMensMorrisState } from './nineMensMorrisEngine';

interface WorkerReq {
  id: number;
  state: NineMensMorrisState;
  difficulty: AIDifficulty;
}

self.onmessage = (event: MessageEvent<WorkerReq>) => {
  const { id, state, difficulty } = event.data;
  const move = findBestMorrisMove(state, difficulty);
  self.postMessage({ id, move });
};
