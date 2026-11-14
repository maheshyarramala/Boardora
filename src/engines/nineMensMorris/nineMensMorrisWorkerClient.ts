import type { AIDifficulty } from '../../core/types';
import { findBestMorrisMove } from './nineMensMorrisAi';
import type { MorrisAction, NineMensMorrisState } from './nineMensMorrisEngine';

let workerInstance: Worker | null = null;
let requestCounter = 0;

function getWorker(): Worker | null {
  if (typeof Worker === 'undefined') return null;
  if (!workerInstance) {
    workerInstance = new Worker(
      new URL('./nineMensMorris.worker.ts', import.meta.url),
      { type: 'module' }
    );
  }
  return workerInstance;
}

export function computeMorrisMoveInWorker(
  state: NineMensMorrisState,
  difficulty: AIDifficulty
): Promise<MorrisAction | null> {
  const worker = getWorker();
  if (!worker) {
    return Promise.resolve(findBestMorrisMove(state, difficulty));
  }

  return new Promise((resolve) => {
    const id = ++requestCounter;
    const onMessage = (ev: MessageEvent<{ id: number; move: MorrisAction | null }>) => {
      if (ev.data.id !== id) return;
      worker.removeEventListener('message', onMessage);
      worker.removeEventListener('error', onError);
      resolve(ev.data.move);
    };
    const onError = () => {
      worker.removeEventListener('message', onMessage);
      worker.removeEventListener('error', onError);
      resolve(findBestMorrisMove(state, difficulty));
    };
    worker.addEventListener('message', onMessage);
    worker.addEventListener('error', onError);
    worker.postMessage({ id, state, difficulty });
  });
}
