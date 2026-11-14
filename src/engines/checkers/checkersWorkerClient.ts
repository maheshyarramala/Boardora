import type { AIDifficulty } from '../../core/types';
import type { CheckersWorkerRequest, CheckersWorkerResponse } from './checkers.worker';
import { findBestCheckersMove } from './checkersAi';
import type { CheckersMoveAction, CheckersState } from './checkersEngine';

let workerInstance: Worker | null = null;
let requestCounter = 0;

export function computeCheckersMoveInWorker(
  state: CheckersState,
  difficulty: AIDifficulty
): Promise<CheckersMoveAction | null> {
  if (typeof Worker === 'undefined') {
    return Promise.resolve(findBestCheckersMove(state, difficulty));
  }

  return new Promise((resolve) => {
    try {
      if (!workerInstance) {
        workerInstance = new Worker(
          new URL('./checkers.worker.ts', import.meta.url),
          { type: 'module' }
        );
      }

      const id = ++requestCounter;
      const timeout = window.setTimeout(() => {
        resolve(findBestCheckersMove(state, difficulty));
      }, 3000);

      const handleMessage = (ev: MessageEvent<CheckersWorkerResponse>) => {
        if (ev.data?.requestId === id) {
          window.clearTimeout(timeout);
          workerInstance?.removeEventListener('message', handleMessage);
          resolve(ev.data.move);
        }
      };

      workerInstance.addEventListener('message', handleMessage);
      const req: CheckersWorkerRequest = { requestId: id, state, difficulty };
      workerInstance.postMessage(req);
    } catch {
      resolve(findBestCheckersMove(state, difficulty));
    }
  });
}
