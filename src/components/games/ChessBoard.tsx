import { useMemo, useState } from 'react';
import { Chess, type PieceSymbol } from 'chess.js';
import { Flag, RotateCw, Undo2 } from 'lucide-react';
import {
  getCapturedPiecesFromHistory,
  type ChessAction,
  type ChessState,
} from '../../engines/chess/chessEngine';

interface ChessBoardProps {
  state: ChessState;
  isHumanTurn: boolean;
  aiThinking: boolean;
  onAction: (action: ChessAction) => void;
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'] as const;

const PIECE_UNICODE: Record<'w' | 'b', Record<PieceSymbol, string>> = {
  w: { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' },
  b: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' },
};

function StauntonPieceSvg({
  type,
  color,
}: {
  type: PieceSymbol;
  color: 'w' | 'b';
}) {
  const isWhite = color === 'w';
  const fill = isWhite ? '#F7F1E3' : '#261A15';
  const stroke = isWhite ? '#3E2723' : '#D4AF37';
  const accent = isWhite ? '#C5A253' : '#8C6D32';

  return (
    <svg
      viewBox="0 0 45 45"
      className="w-[82%] h-[82%] drop-shadow-[0_4px_4px_rgba(0,0,0,0.45)] pointer-events-none select-none"
      aria-hidden="true"
    >
      {type === 'p' && (
        <path
          d="M22.5 9a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9zm-4 10.5c-2.2 2-3.5 5-3.5 8h15c0-3-1.3-6-3.5-8h-8zm-5 10.5h18v5h-18v-5z"
          fill={fill}
          stroke={stroke}
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      )}
      {type === 'r' && (
        <path
          d="M11 36h23v-4H11v4zm3-6h17l-1.5-12h-14L14 30zm-2-14h21v-6h-4v2.5h-4V10h-5v2.5h-4V10h-4v6z"
          fill={fill}
          stroke={stroke}
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      )}
      {type === 'n' && (
        <path
          d="M12 36h21v-4H12v4zm3-6c0-5 2.5-8.5 5.5-10.5-2.5-.5-4.5-2.2-5-4.8-.3-2.5 1.8-5 4.5-5.7l1.5-3 3.2 2c3.5 0 7 2.5 8 6.2 1 3.8-1 8.8-3.2 11.8 1.2 1.5 1.8 3 1.8 4H15z"
          fill={fill}
          stroke={stroke}
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      )}
      {type === 'b' && (
        <g fill={fill} stroke={stroke} strokeWidth="1.6" strokeLinejoin="round">
          <path d="M12 36h21v-4H12v4z" />
          <path d="M15.5 30c0-5 3-11 7-15 4 4 7 10 7 15h-14z" />
          <circle cx="22.5" cy="10.5" r="3" />
          <path d="M19.5 22l6-4" stroke={accent} strokeWidth="1.6" strokeLinecap="round" />
        </g>
      )}
      {type === 'q' && (
        <g fill={fill} stroke={stroke} strokeWidth="1.6" strokeLinejoin="round">
          <path d="M11 36h23v-4H11v4z" />
          <path d="M13 30L9.5 15l7 7.5L22.5 11l6 11.5 7-7.5L32 30H13z" />
          <circle cx="9.5" cy="13.5" r="2" />
          <circle cx="22.5" cy="9.5" r="2.2" />
          <circle cx="35.5" cy="13.5" r="2" />
        </g>
      )}
      {type === 'k' && (
        <g fill={fill} stroke={stroke} strokeWidth="1.6" strokeLinejoin="round">
          <path d="M12 36h21v-4H12v4z" />
          <path d="M21 7h3v3.5h3.5v3H24V17c4.5.5 7.5 3.8 6.5 8.5L28 30H17l-2.5-4.5c-1-4.7 2-8 6.5-8.5v-3.5h-3.5v-3H21V7z" />
          <path d="M17.5 25.5h10" stroke={accent} strokeWidth="1.4" />
        </g>
      )}
    </svg>
  );
}

export function ChessBoard({
  state,
  isHumanTurn,
  aiThinking,
  onAction,
}: ChessBoardProps) {
  const [flipped, setFlipped] = useState(false);
  const [selectedSq, setSelectedSq] = useState<string | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{
    from: string;
    to: string;
  } | null>(null);

  const chess = useMemo(() => new Chess(state.fen), [state.fen]);
  const board = chess.board();
  const turn = chess.turn();
  const inCheck = chess.inCheck();

  const legalMovesFromSelected = useMemo(() => {
    if (!selectedSq || !isHumanTurn) return [];
    return chess.moves({ square: selectedSq as never, verbose: true });
  }, [chess, selectedSq, isHumanTurn]);

  const targetSquares = useMemo(() => {
    const map = new Map<string, { capture: boolean; promotion: boolean }>();
    for (const m of legalMovesFromSelected) {
      map.set(m.to, {
        capture: Boolean(m.captured),
        promotion: Boolean(m.promotion),
      });
    }
    return map;
  }, [legalMovesFromSelected]);

  const lastMove = state.history[state.history.length - 1];
  const { capturedByWhite, capturedByBlack } = useMemo(
    () => getCapturedPiecesFromHistory(state.history),
    [state.history]
  );

  const displayRanks = flipped ? [...RANKS].reverse() : [...RANKS];
  const displayFiles = flipped ? [...FILES].reverse() : [...FILES];

  const handleSquareClick = (sq: string, pieceColor?: 'w' | 'b') => {
    if (!isHumanTurn || aiThinking) return;

    if (selectedSq && targetSquares.has(sq)) {
      const meta = targetSquares.get(sq)!;
      if (meta.promotion) {
        setPendingPromotion({ from: selectedSq, to: sq });
        setSelectedSq(null);
        return;
      }
      onAction({ type: 'MOVE', from: selectedSq, to: sq });
      setSelectedSq(null);
      return;
    }

    if (pieceColor === turn) {
      setSelectedSq((prev) => (prev === sq ? null : sq));
    } else {
      setSelectedSq(null);
    }
  };

  const canUndo =
    state.mode !== 'online' &&
    !aiThinking &&
    (state.mode === 'ai' ? state.history.length >= 2 : state.history.length >= 1);

  return (
    <div className="arena-layout">
      {/* 8x8 Chessboard Frame */}
      <div className="arena-board-col">
        <div className="arena-square-board-with-strips space-y-1.5">
          {/* Top Captured Material Strip */}
          <div className="flex items-center justify-between text-xs px-1.5 text-[var(--cp-text-muted)] min-h-[20px] leading-tight">
            <span className="font-medium">
              {flipped ? 'White' : 'Black'}
              {turn === (flipped ? 'w' : 'b') && !chess.isGameOver() ? ' · Turn' : ''}
            </span>
            <span className="tracking-wider text-sm sm:text-base">
              {(flipped ? capturedByBlack : capturedByWhite)
                .map((p) => PIECE_UNICODE[flipped ? 'w' : 'b'][p])
                .join(' ')}
            </span>
          </div>

          <div className="boardora-3d-board rounded-2xl bg-[#2A1D18] p-2 sm:p-3 border-2 border-[var(--cp-border-strong)] shadow-[0_24px_48px_-14px_rgba(0,0,0,0.75)]">
          <div className="grid grid-cols-8 aspect-square w-full rounded-lg overflow-hidden border border-[#140D0A]">
            {displayRanks.map((rank) => {
              const rIdx = 8 - Number(rank);
              return displayFiles.map((file) => {
                const cIdx = file.charCodeAt(0) - 97;
                const sq = `${file}${rank}`;
                const isLight = (rIdx + cIdx) % 2 === 0;
                const piece = board[rIdx]?.[cIdx] ?? null;
                const isSelected = selectedSq === sq;
                const isTarget = targetSquares.has(sq);
                const targetMeta = targetSquares.get(sq);
                const isLast = lastMove && (lastMove.from === sq || lastMove.to === sq);
                const isKingChecked =
                  inCheck && piece?.type === 'k' && piece.color === turn;

                return (
                  <button
                    key={sq}
                    type="button"
                    onClick={() => handleSquareClick(sq, piece?.color)}
                    aria-label={`${sq}${piece ? ` ${piece.color === 'w' ? 'White' : 'Black'} ${piece.type}` : ''}`}
                    className={`relative flex items-center justify-center aspect-square select-none cursor-pointer transition-colors ${
                      isKingChecked
                        ? 'bg-red-700/85'
                        : isSelected
                        ? 'bg-[#D4AF37]/75'
                        : isLast
                        ? isLight
                          ? 'bg-[#E5D399]'
                          : 'bg-[#7A6A3A]'
                        : isLight
                        ? 'bg-[#E8DEC8]'
                        : 'bg-[#3A4D6B]'
                    }`}
                  >
                    {/* Coordinates on edges */}
                    {file === displayFiles[0] && (
                      <span
                        className={`absolute top-0.5 left-1 text-[9px] font-mono-tabular font-semibold ${
                          isLight ? 'text-[#3A4D6B]' : 'text-[#E8DEC8]'
                        }`}
                      >
                        {rank}
                      </span>
                    )}
                    {rank === displayRanks[7] && (
                      <span
                        className={`absolute bottom-0.5 right-1 text-[9px] font-mono-tabular font-semibold ${
                          isLight ? 'text-[#3A4D6B]' : 'text-[#E8DEC8]'
                        }`}
                      >
                        {file}
                      </span>
                    )}

                    {piece && <StauntonPieceSvg type={piece.type} color={piece.color} />}

                    {isTarget && !targetMeta?.capture && (
                      <span className="w-3 h-3 rounded-full bg-[#081020]/35 pointer-events-none" />
                    )}
                    {isTarget && targetMeta?.capture && (
                      <span className="absolute inset-1 rounded-full border-[3px] border-[#D4AF37] pointer-events-none" />
                    )}
                  </button>
                );
              });
            })}
          </div>
        </div>

          {/* Bottom Captured Material Strip */}
          <div className="flex items-center justify-between text-xs px-1.5 text-[var(--cp-text-muted)] min-h-[20px] leading-tight">
            <span className="font-medium">
              {flipped ? 'Black' : 'White'}
              {turn === (flipped ? 'b' : 'w') && !chess.isGameOver() ? ' · Turn' : ''}
            </span>
            <span className="tracking-wider text-sm sm:text-base">
              {(flipped ? capturedByWhite : capturedByBlack)
                .map((p) => PIECE_UNICODE[flipped ? 'b' : 'w'][p])
                .join(' ')}
            </span>
          </div>
        </div>
      </div>

      {/* Side Controls & Move Ledger */}
      <aside className="arena-sidebar space-y-3">
        <div className="rounded-2xl bg-[var(--cp-bg-elevated)] border border-[var(--cp-border-strong)] p-3 sm:p-4 space-y-3">
          <div>
            <div className="text-xs text-[var(--cp-text-muted)]">STATUS</div>
            <div className="font-display text-lg font-bold mt-0.5">
              {aiThinking
                ? 'AI Calculating...'
                : `${turn === 'w' ? 'White' : 'Black'} to Move${
                    inCheck ? ' · Check!' : ''
                  }`}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setFlipped((f) => !f)}
              className="min-h-[44px] px-3 py-2 rounded-xl bg-[var(--cp-surface)] hover:bg-[var(--cp-surface-muted)] text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <RotateCw className="w-3.5 h-3.5" />
              Flip
            </button>
            <button
              type="button"
              disabled={!canUndo}
              onClick={() => onAction({ type: 'UNDO' })}
              className="min-h-[44px] px-3 py-2 rounded-xl bg-[var(--cp-surface)] hover:bg-[var(--cp-surface-muted)] disabled:opacity-45 disabled:cursor-not-allowed text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Undo2 className="w-3.5 h-3.5" />
              Undo
            </button>
            <button
              type="button"
              disabled={chess.isGameOver()}
              onClick={() => onAction({ type: 'RESIGN', color: turn })}
              className="min-h-[44px] px-3 py-2 rounded-xl bg-[var(--cp-surface)] hover:bg-red-950/60 text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-45"
            >
              <Flag className="w-3.5 h-3.5" />
              Resign
            </button>
          </div>
        </div>

        <div className="rounded-2xl bg-[var(--cp-bg-elevated)] border border-[var(--cp-border)] p-4">
          <div className="text-xs font-semibold tracking-wider text-[var(--cp-gold)] mb-2">
            MOVE HISTORY (SAN)
          </div>
          {state.history.length === 0 ? (
            <p className="text-xs text-[var(--cp-text-muted)]">
              White opens the game. Tap any piece to view legal squares.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs font-mono-tabular max-h-56 overflow-y-auto">
              {Array.from(
                { length: Math.ceil(state.history.length / 2) },
                (_, idx) => {
                  const wMove = state.history[idx * 2];
                  const bMove = state.history[idx * 2 + 1];
                  return (
                    <div key={idx} className="contents">
                      <div className="py-0.5 text-[var(--cp-text)]">
                        <span className="text-[var(--cp-text-muted)] mr-1.5">
                          {idx + 1}.
                        </span>
                        {wMove?.san}
                      </div>
                      <div className="py-0.5 text-[var(--cp-text-muted)]">
                        {bMove?.san ?? ''}
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          )}
        </div>
      </aside>

      {/* Pawn Promotion Selector Modal */}
      {pendingPromotion && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-xs rounded-2xl bg-[var(--cp-bg-elevated)] border border-[var(--cp-border-strong)] p-5 text-center shadow-2xl">
            <h3 className="font-display text-lg font-bold">Promote Pawn</h3>
            <p className="mt-1 text-xs text-[var(--cp-text-muted)]">
              Choose the piece to crown on {pendingPromotion.to}.
            </p>
            <div className="mt-4 grid grid-cols-4 gap-2">
              {(['q', 'r', 'b', 'n'] as const).map((promo) => (
                <button
                  key={promo}
                  type="button"
                  onClick={() => {
                    onAction({
                      type: 'MOVE',
                      from: pendingPromotion.from,
                      to: pendingPromotion.to,
                      promotion: promo,
                    });
                    setPendingPromotion(null);
                  }}
                  className="aspect-square rounded-xl bg-[var(--cp-surface)] hover:bg-[var(--cp-gold)]/25 border border-[var(--cp-border-strong)] flex items-center justify-center cursor-pointer"
                  aria-label={`Promote to ${promo}`}
                >
                  <StauntonPieceSvg type={promo} color={turn} />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
