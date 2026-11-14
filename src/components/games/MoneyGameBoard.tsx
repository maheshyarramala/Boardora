import { useState } from 'react';
import { Banknote, Building2, Gavel, PiggyBank, ShieldCheck } from 'lucide-react';
import {
  calculateNetWorth,
  type MoneyGameAction,
  type MoneyGameState,
} from '../../engines/moneyGame/moneyGameEngine';
import type { MoneyGroupColor } from '../../engines/moneyGame/moneyBoardConfig';
import { BoardPerspectiveStage, Dice3D } from '../tabletop/TactilePieces';

interface MoneyGameBoardProps {
  state: MoneyGameState;
  isHumanTurn: boolean;
  onAction: (action: MoneyGameAction) => void;
}

const PLAYER_COLORS: Record<string, string> = {
  crimson: '#ef4444',
  sapphire: '#38bdf8',
  emerald: '#10b981',
  amber: '#f59e0b',
};

const GROUP_HEX: Record<MoneyGroupColor, string> = {
  emerald: '#10b981',
  sapphire: '#38bdf8',
  amber: '#f59e0b',
  ruby: '#ef4444',
};

/**
 * Computes square-loop perimeter position (x, y) for 24 tiles on a 7x7 outer ring inside viewBox 0..490.
 */
function getTileRect(index: number): { x: number; y: number; w: number; h: number } {
  const cell = 68;
  const pad = 7;
  // 0..6: bottom row right -> left
  if (index <= 6) {
    return { x: pad + (6 - index) * cell, y: pad + 6 * cell, w: cell, h: cell };
  }
  // 7..12: left column bottom -> top
  if (index <= 12) {
    return { x: pad, y: pad + (12 - index) * cell, w: cell, h: cell };
  }
  // 13..18: top row left -> right
  if (index <= 18) {
    return { x: pad + (index - 12) * cell, y: pad, w: cell, h: cell };
  }
  // 19..23: right column top -> bottom
  return { x: pad + 6 * cell, y: pad + (index - 18) * cell, w: cell, h: cell };
}

export function MoneyGameBoard({
  state,
  isHumanTurn,
  onAction,
}: MoneyGameBoardProps) {
  const [rolling, setRolling] = useState(false);
  const active = state.players[state.currentPlayerIndex];
  const config = state.boardConfig;
  const activeTile = config.tiles[active.position];

  const handleRoll = () => {
    if (!isHumanTurn || state.phase !== 'roll' || rolling) return;
    setRolling(true);
    window.setTimeout(() => {
      setRolling(false);
      onAction({ type: 'ROLL' });
    }, 220);
  };

  // Determine whether human owns decision input during auction
  const activeActorForControl =
    state.phase === 'auction' && state.auction
      ? state.players[state.auction.currentBidderIndex]
      : active;
  const canHumanControlPrompt =
    state.mode === 'local' ? true : !activeActorForControl.isAi;

  return (
    <div className="arena-layout">
      <div className="arena-board-col">
        <BoardPerspectiveStage className="arena-square-board">
          <div className="boardora-3d-board rounded-2xl sm:rounded-3xl bg-[#0e1a30] p-2 sm:p-3 border-2 border-[#d4af37]/60 shadow-2xl">
            <svg
              viewBox="0 0 490 490"
              className="w-full h-auto block select-none"
              role="img"
              aria-label="Money Game board"
            >
              <rect
                x="2"
                y="2"
                width="486"
                height="486"
                rx="16"
                fill="#0b1528"
                stroke="#d4af37"
                strokeWidth="2"
                strokeOpacity="0.55"
              />

              {/* Center Parlor Ledger Felt */}
              <rect
                x="78"
                y="78"
                width="334"
                height="334"
                rx="12"
                fill="#10213c"
                stroke="#d4af37"
                strokeOpacity="0.3"
                strokeWidth="1.5"
              />
              <text
                x="245"
                y="208"
                textAnchor="middle"
                fontSize="20"
                fontWeight="bold"
                fill="#d4af37"
                letterSpacing="2"
              >
                MONEY GAME
              </text>
              <text
                x="245"
                y="232"
                textAnchor="middle"
                fontSize="10.5"
                fill="#cbd5e1"
              >
                Fictional Credits (¢) · Target: ¢{config.targetNetWorth.toLocaleString()}
              </text>
              <text
                x="245"
                y="252"
                textAnchor="middle"
                fontSize="9.5"
                fill="#94a3b8"
              >
                Round {state.roundNumber} · +10% Savings Interest at Payday
              </text>

              {/* 24 Perimeter Tiles */}
              {config.tiles.map((tile) => {
                const rect = getTileRect(tile.index);
                const deed = state.deeds[tile.index];
                const playersHere = state.players.filter(
                  (p) => !p.insolvent && p.position === tile.index
                );

                return (
                  <g key={tile.index}>
                    <rect
                      x={rect.x + 1.5}
                      y={rect.y + 1.5}
                      width={rect.w - 3}
                      height={rect.h - 3}
                      rx="6"
                      fill={
                        tile.kind === 'payday'
                          ? '#422006'
                          : tile.kind === 'savings'
                          ? '#064e3b'
                          : tile.kind === 'decision'
                          ? '#1e1b4b'
                          : tile.kind === 'event'
                          ? '#3b0764'
                          : '#17253e'
                      }
                      stroke={deed ? PLAYER_COLORS[state.players[deed.ownerIndex].color] : '#475569'}
                      strokeWidth={deed ? 2.2 : 1}
                    />

                    {/* Color group header bar for Deeds */}
                    {tile.kind === 'property' && tile.group && (
                      <rect
                        x={rect.x + 2.5}
                        y={rect.y + 2.5}
                        width={rect.w - 5}
                        height={11}
                        rx="3"
                        fill={GROUP_HEX[tile.group]}
                      />
                    )}

                    {/* Tile short label */}
                    <text
                      x={rect.x + rect.w / 2}
                      y={rect.y + (tile.kind === 'property' ? 25 : 22)}
                      textAnchor="middle"
                      fontSize="7.4"
                      fontWeight="bold"
                      fill="#f8fafc"
                    >
                      {tile.name.slice(0, 12)}
                    </text>

                    <text
                      x={rect.x + rect.w / 2}
                      y={rect.y + 37}
                      textAnchor="middle"
                      fontSize="8"
                      fontFamily="monospace"
                      fill="#d4af37"
                    >
                      {tile.kind === 'property'
                        ? `¢${tile.price}`
                        : tile.kind === 'payday'
                        ? '+¢250'
                        : tile.kind === 'savings'
                        ? 'VAULT'
                        : tile.kind === 'earning'
                        ? `+¢${tile.amount}`
                        : tile.kind === 'expense'
                        ? `-¢${tile.amount}`
                        : tile.kind === 'decision'
                        ? 'CHOICE'
                        : 'EVENT'}
                    </text>

                    {/* Upgrade pips */}
                    {deed && deed.upgradeLevel > 0 && (
                      <text
                        x={rect.x + rect.w / 2}
                        y={rect.y + 49}
                        textAnchor="middle"
                        fontSize="8"
                        fill="#fbbf24"
                      >
                        {'★'.repeat(deed.upgradeLevel)}
                      </text>
                    )}

                    {/* Player tokens */}
                    {playersHere.map((p, pIdx) => (
                      <circle
                        key={p.id}
                        cx={rect.x + 14 + (pIdx % 3) * 18}
                        cy={rect.y + rect.h - 11}
                        r={6.5}
                        fill={PLAYER_COLORS[p.color]}
                        stroke="#ffffff"
                        strokeWidth="1.5"
                      />
                    ))}
                  </g>
                );
              })}
            </svg>
          </div>
        </BoardPerspectiveStage>
      </div>

      {/* Financial Cockpit & Action Prompts */}
      <aside className="arena-sidebar space-y-3">
        <div className="rounded-2xl bg-[var(--cp-bg-elevated)] border border-[var(--cp-border)] p-3 sm:p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span
                  className="w-3.5 h-3.5 rounded-full border border-white/60"
                  style={{ backgroundColor: PLAYER_COLORS[active.color] }}
                />
                <span className="font-display font-bold text-base">
                  {active.label}
                </span>
              </div>
              <p className="text-xs text-[var(--cp-text-muted)] mt-0.5">
                On {activeTile.name}
              </p>
            </div>
            <span className="text-[11px] font-mono-tabular text-[var(--cp-gold)]">
              Fictional ¢ Only
            </span>
          </div>

          {/* Phase-based Interactive Controls */}
          {state.phase === 'roll' && (
            <div className="rounded-xl bg-[var(--cp-surface)] border border-[var(--cp-border)] p-4 flex items-center justify-between gap-4">
              <div
                className={`flex items-center gap-2.5 transition-transform duration-200 ${
                  rolling ? 'scale-105 opacity-85' : ''
                }`}
              >
                <Dice3D
                  value={state.lastDice?.[0] ?? 4}
                  size={44}
                  variant="ivory"
                  interactive={isHumanTurn}
                  onClick={handleRoll}
                />
                <Dice3D
                  value={state.lastDice?.[1] ?? 2}
                  size={44}
                  variant="gold"
                  interactive={isHumanTurn}
                  onClick={handleRoll}
                />
              </div>
              <button
                type="button"
                disabled={!isHumanTurn || rolling}
                onClick={handleRoll}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-[var(--cp-gold)] text-[#081020] font-semibold text-sm hover:brightness-105 cursor-pointer disabled:opacity-45"
              >
                {rolling ? 'Rolling...' : isHumanTurn ? 'Roll Dice' : 'Bot Turn...'}
              </button>
            </div>
          )}

          {state.phase === 'buy_or_auction' && (
            <div className="rounded-xl bg-[var(--cp-surface)] border border-[var(--cp-gold)]/55 p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-[var(--cp-gold)]">
                <Building2 className="w-4 h-4" />
                DEED OFFER: {activeTile.name} (¢{activeTile.price})
              </div>
              <p className="text-xs text-[var(--cp-text-muted)]">
                Base Rent ¢{activeTile.baseRent} · Buy directly or put to Bank Auction.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={!canHumanControlPrompt || active.cash < (activeTile.price ?? 0)}
                  onClick={() => onAction({ type: 'BUY_PROPERTY' })}
                  className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-[var(--cp-gold)] text-[#081020] text-xs font-semibold cursor-pointer disabled:opacity-40"
                >
                  Buy Deed (¢{activeTile.price})
                </button>
                <button
                  type="button"
                  disabled={!canHumanControlPrompt}
                  onClick={() => onAction({ type: 'START_AUCTION' })}
                  className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-[var(--cp-bg-elevated)] border border-[var(--cp-border)] text-xs font-semibold cursor-pointer"
                >
                  Bank Auction
                </button>
              </div>
            </div>
          )}

          {state.phase === 'auction' && state.auction && (
            <div className="rounded-xl bg-[var(--cp-surface)] border border-amber-400/50 p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-300">
                <Gavel className="w-4 h-4" />
                AUCTION: {config.tiles[state.auction.tileIndex]?.name}
              </div>
              <div className="text-xs text-[var(--cp-text-muted)]">
                High Bid:{' '}
                <span className="font-mono-tabular text-[var(--cp-text)] font-bold">
                  ¢{state.auction.highestBid}
                </span>{' '}
                {state.auction.highestBidderIndex !== null
                  ? `by ${state.players[state.auction.highestBidderIndex].label}`
                  : '(Opening)'}
                {' · '}Turn:{' '}
                <span className="font-semibold text-[var(--cp-gold)]">
                  {activeActorForControl.label}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={
                    !canHumanControlPrompt ||
                    activeActorForControl.cash < state.auction.highestBid + 20
                  }
                  onClick={() => onAction({ type: 'AUCTION_BID', increment: 20 })}
                  className="min-h-[40px] px-3 rounded-xl bg-[var(--cp-gold)] text-[#081020] text-xs font-semibold cursor-pointer disabled:opacity-40"
                >
                  Bid ¢{state.auction.highestBid + 20}
                </button>
                <button
                  type="button"
                  disabled={
                    !canHumanControlPrompt ||
                    activeActorForControl.cash < state.auction.highestBid + 50
                  }
                  onClick={() => onAction({ type: 'AUCTION_BID', increment: 50 })}
                  className="min-h-[40px] px-3 rounded-xl bg-amber-400/20 border border-amber-400/50 text-amber-200 text-xs font-semibold cursor-pointer disabled:opacity-40"
                >
                  Bid ¢{state.auction.highestBid + 50}
                </button>
                <button
                  type="button"
                  disabled={!canHumanControlPrompt}
                  onClick={() => onAction({ type: 'AUCTION_PASS' })}
                  className="min-h-[40px] px-3 rounded-xl bg-[var(--cp-bg-elevated)] border border-[var(--cp-border)] text-xs font-semibold cursor-pointer"
                >
                  Pass
                </button>
              </div>
            </div>
          )}

          {state.phase === 'upgrade_prompt' && (
            <div className="rounded-xl bg-[var(--cp-surface)] border border-emerald-400/50 p-4 space-y-3">
              <div className="text-xs font-semibold text-emerald-300">
                COLOR GROUP MONOPOLY — UPGRADE {activeTile.name}?
              </div>
              <p className="text-xs text-[var(--cp-text-muted)]">
                Invest ¢{activeTile.upgradeCost} to increase rent by +¢{activeTile.upgradeRentBonus}.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={!canHumanControlPrompt || active.cash < (activeTile.upgradeCost ?? 0)}
                  onClick={() => onAction({ type: 'UPGRADE_PROPERTY', accept: true })}
                  className="min-h-[40px] px-3.5 rounded-xl bg-[var(--cp-gold)] text-[#081020] text-xs font-semibold cursor-pointer disabled:opacity-40"
                >
                  Upgrade (¢{activeTile.upgradeCost})
                </button>
                <button
                  type="button"
                  disabled={!canHumanControlPrompt}
                  onClick={() => onAction({ type: 'UPGRADE_PROPERTY', accept: false })}
                  className="min-h-[40px] px-3.5 rounded-xl bg-[var(--cp-bg-elevated)] border border-[var(--cp-border)] text-xs font-semibold cursor-pointer"
                >
                  Skip
                </button>
              </div>
            </div>
          )}

          {state.phase === 'savings_prompt' && (
            <div className="rounded-xl bg-[var(--cp-surface)] border border-emerald-400/50 p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300">
                <PiggyBank className="w-4 h-4" />
                SAVINGS VAULT (EARNS +10% AT PAYDAY)
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={!canHumanControlPrompt || active.cash < 100}
                  onClick={() => onAction({ type: 'SAVINGS_ACTION', delta: 100 })}
                  className="min-h-[40px] px-3 rounded-xl bg-emerald-500/20 border border-emerald-400/50 text-emerald-200 text-xs font-semibold cursor-pointer disabled:opacity-40"
                >
                  Deposit ¢100
                </button>
                <button
                  type="button"
                  disabled={!canHumanControlPrompt || active.cash < 250}
                  onClick={() => onAction({ type: 'SAVINGS_ACTION', delta: 250 })}
                  className="min-h-[40px] px-3 rounded-xl bg-emerald-500/20 border border-emerald-400/50 text-emerald-200 text-xs font-semibold cursor-pointer disabled:opacity-40"
                >
                  Deposit ¢250
                </button>
                <button
                  type="button"
                  disabled={!canHumanControlPrompt || active.savings < 100}
                  onClick={() => onAction({ type: 'SAVINGS_ACTION', delta: -100 })}
                  className="min-h-[40px] px-3 rounded-xl bg-[var(--cp-bg-elevated)] border border-[var(--cp-border)] text-xs font-semibold cursor-pointer disabled:opacity-40"
                >
                  Withdraw ¢100
                </button>
                <button
                  type="button"
                  disabled={!canHumanControlPrompt}
                  onClick={() => onAction({ type: 'SAVINGS_ACTION', delta: 0 })}
                  className="min-h-[40px] px-3 rounded-xl bg-[var(--cp-bg-elevated)] border border-[var(--cp-border)] text-xs font-semibold cursor-pointer"
                >
                  Hold
                </button>
              </div>
            </div>
          )}

          {state.phase === 'decision_prompt' && state.activeDecisionCard && (
            <div className="rounded-xl bg-[var(--cp-surface)] border border-sky-400/50 p-4 space-y-3">
              <div className="text-xs font-semibold text-sky-300">
                FINANCIAL DECISION: {state.activeDecisionCard.title}
              </div>
              <p className="text-xs text-[var(--cp-text-muted)]">
                {state.activeDecisionCard.prompt}
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  disabled={
                    !canHumanControlPrompt ||
                    active.cash + state.activeDecisionCard.optionA.cashDelta < 0
                  }
                  onClick={() => onAction({ type: 'CHOOSE_DECISION', choice: 'a' })}
                  className="min-h-[40px] px-3 rounded-xl bg-[var(--cp-gold)] text-[#081020] text-xs font-semibold cursor-pointer disabled:opacity-40"
                >
                  {state.activeDecisionCard.optionA.label}
                </button>
                <button
                  type="button"
                  disabled={!canHumanControlPrompt}
                  onClick={() => onAction({ type: 'CHOOSE_DECISION', choice: 'b' })}
                  className="min-h-[40px] px-3 rounded-xl bg-[var(--cp-bg-elevated)] border border-[var(--cp-border)] text-xs font-semibold cursor-pointer"
                >
                  {state.activeDecisionCard.optionB.label}
                </button>
              </div>
            </div>
          )}

          {/* Player Net Worth Ledgers */}
          <div className="space-y-2">
            {state.players.map((p, idx) => {
              const nw = calculateNetWorth(state, idx);
              const isCurrent = idx === state.currentPlayerIndex;
              return (
                <div
                  key={p.id}
                  className={`rounded-xl p-3 border text-xs ${
                    p.insolvent
                      ? 'opacity-45 bg-[var(--cp-surface)]/40 border-red-500/30'
                      : isCurrent
                      ? 'bg-[var(--cp-surface)] border-[var(--cp-gold)]/70'
                      : 'bg-[var(--cp-surface)]/60 border-[var(--cp-border)]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold flex items-center gap-1.5">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: PLAYER_COLORS[p.color] }}
                      />
                      {p.label}
                      {p.insured && (
                        <ShieldCheck className="w-3.5 h-3.5 text-sky-300" />
                      )}
                    </span>
                    <span className="font-mono-tabular font-bold text-[var(--cp-gold)]">
                      {p.insolvent ? 'INSOLVENT' : `NW: ¢${nw.toLocaleString()}`}
                    </span>
                  </div>
                  {!p.insolvent && (
                    <div className="mt-1.5 flex items-center justify-between text-[11px] font-mono-tabular text-[var(--cp-text-muted)]">
                      <span className="inline-flex items-center gap-1">
                        <Banknote className="w-3 h-3 text-amber-300" />
                        Cash ¢{p.cash}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <PiggyBank className="w-3 h-3 text-emerald-300" />
                        Savings ¢{p.savings}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl bg-[var(--cp-bg-elevated)] border border-[var(--cp-border)] p-4">
          <div className="text-xs font-semibold tracking-wider text-[var(--cp-text-muted)] mb-2">
            LEDGER LOG ({state.history.length})
          </div>
          <ul className="max-h-32 overflow-y-auto space-y-1 text-xs font-mono-tabular text-[var(--cp-text-muted)]">
            {state.history.length === 0 ? (
              <li>Roll twin dice to build cash, savings, and property equity.</li>
            ) : (
              state.history.map((item, i) => <li key={`${item}-${i}`}>{item}</li>)
            )}
          </ul>
        </div>
      </aside>
    </div>
  );
}
