import type { AIDifficulty } from '../../core/types';
import type { ChessWorkerRequest, ChessWorkerResponse } from './chess.worker';
import { findBestChessMove, type ChessMoveChoice } from './chessAi';

let workerInstance: Worker | null = null;
let requestCounter = 0;

export function computeChessMoveInWorker(
  fen: string,
  difficulty: AIDifficulty
): Promise<ChessMoveChoice | null> {
  if (typeof Worker === 'undefined') {
    return Promise.resolve(findBestChessMove(fen, difficulty));
  }

  return new Promise((resolve) => {
    try {
      if (!workerInstance) {
        workerInstance = new Worker(
          new URL('./chess.worker.ts', import.meta.url),
          { type: 'module' }
        );
      }

      const id = ++requestCounter;
      const timeout = window.setTimeout(() => {
        resolve(findBestChessMove(fen, difficulty));
      }, 3500);

      const handleMessage = (ev: MessageEvent<ChessWorkerResponse>) => {
        if (ev.data?.requestId === id) {
          window.clearTimeout(timeout);
          workerInstance?.removeEventListener('message', handleMessage);
          resolve(ev.data.move);
        }
      };

      workerInstance.addEventListener('message', handleMessage);
      const req: ChessWorkerRequest = { requestId: id, fen, difficulty };
      workerInstance.postMessage(req);
    } catch {
      resolve(findBestChessMove(fen, difficulty));
    }
  });
}
