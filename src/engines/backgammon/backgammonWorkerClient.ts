import type { AIDifficulty } from '../../core/types';
import { findBestBackgammonAction } from './backgammonAi';
import type { BackgammonAction, BackgammonState } from './backgammonEngine';

let workerInstance: Worker | null = null;
let requestCounter = 0;

function getWorker(): Worker | null {
  if (typeof Worker === 'undefined') return null;
  if (!workerInstance) {
    workerInstance = new Worker(
      new URL('./backgammon.worker.ts', import.meta.url),
      { type: 'module' }
    );
  }
  return workerInstance;
}

export function computeBackgammonMoveInWorker(
  state: BackgammonState,
  difficulty: AIDifficulty
): Promise<BackgammonAction | null> {
  const worker = getWorker();
  if (!worker) {
    return Promise.resolve(findBestBackgammonAction(state, difficulty));
  }

  return new Promise((resolve) => {
    const id = ++requestCounter;
    const onMessage = (
      ev: MessageEvent<{ id: number; action: BackgammonAction | null }>
    ) => {
      if (ev.data.id !== id) return;
      worker.removeEventListener('message', onMessage);
      worker.removeEventListener('error', onError);
      resolve(ev.data.action);
    };
    const onError = () => {
      worker.removeEventListener('message', onMessage);
      worker.removeEventListener('error', onError);
      resolve(findBestBackgammonAction(state, difficulty));
    };
    worker.addEventListener('message', onMessage);
    worker.addEventListener('error', onError);
    worker.postMessage({ id, state, difficulty });
  });
}
