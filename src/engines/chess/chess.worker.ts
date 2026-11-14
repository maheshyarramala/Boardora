import type { AIDifficulty } from '../../core/types';
import { findBestChessMove, type ChessMoveChoice } from './chessAi';

export interface ChessWorkerRequest {
  requestId: number;
  fen: string;
  difficulty: AIDifficulty;
}

export interface ChessWorkerResponse {
  requestId: number;
  move: ChessMoveChoice | null;
}

let stockfishWorker: Worker | null = null;
let stockfishDisabled = false;

function tryStockfishMove(
  fen: string,
  difficulty: AIDifficulty
): Promise<ChessMoveChoice | null> {
  if (stockfishDisabled) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const timeout = self.setTimeout(() => {
      stockfishDisabled = true;
      stockfishWorker?.terminate();
      stockfishWorker = null;
      resolve(null);
    }, 600);

    try {
      if (!stockfishWorker) {
        stockfishWorker = new Worker('/stockfish/stockfish.js');
      }
      const depth = difficulty === 'easy' ? 2 : difficulty === 'medium' ? 6 : 11;
      const skill = difficulty === 'easy' ? 3 : difficulty === 'medium' ? 10 : 18;

      const onMsg = (ev: MessageEvent<string>) => {
        const line = typeof ev.data === 'string' ? ev.data : '';
        if (line.startsWith('bestmove ')) {
          self.clearTimeout(timeout);
          stockfishWorker?.removeEventListener('message', onMsg);
          const uci = line.split(' ')[1];
          if (!uci || uci === '(none)' || uci.length < 4) {
            resolve(null);
            return;
          }
          const promo = uci.length >= 5 ? (uci[4] as 'q' | 'r' | 'b' | 'n') : undefined;
          resolve({
            from: uci.slice(0, 2),
            to: uci.slice(2, 4),
            ...(promo ? { promotion: promo } : {}),
            engineUsed: 'stockfish',
          });
        }
      };

      stockfishWorker.addEventListener('message', onMsg);
      stockfishWorker.onerror = () => {
        self.clearTimeout(timeout);
        stockfishDisabled = true;
        stockfishWorker = null;
        resolve(null);
      };
      stockfishWorker.postMessage(`setoption name Skill Level value ${skill}`);
      stockfishWorker.postMessage(`position fen ${fen}`);
      stockfishWorker.postMessage(`go depth ${depth}`);
    } catch {
      self.clearTimeout(timeout);
      stockfishDisabled = true;
      resolve(null);
    }
  });
}

self.onmessage = async (event: MessageEvent<ChessWorkerRequest>) => {
  const { requestId, fen, difficulty } = event.data;
  const sfMove = await tryStockfishMove(fen, difficulty);
  const move = sfMove ?? findBestChessMove(fen, difficulty);
  const response: ChessWorkerResponse = { requestId, move };
  self.postMessage(response);
};
