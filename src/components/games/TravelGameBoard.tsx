import { useState } from 'react';
import { Compass, Plane, Ship, Train, CheckCircle2 } from 'lucide-react';
import {
  computeTravelProgress,
  type TravelGameAction,
  type TravelGameState,
} from '../../engines/travelGame/travelGameEngine';
import { BoardPerspectiveStage, Dice3D } from '../tabletop/TactilePieces';

interface TravelGameBoardProps {
  state: TravelGameState;
  isHumanTurn: boolean;
  onAction: (action: TravelGameAction) => void;
}

const TOKEN_COLORS: Record<string, string> = {
  crimson: '#ef4444',
  sapphire: '#38bdf8',
  emerald: '#10b981',
  amber: '#f59e0b',
};

export function TravelGameBoard({
  state,
  isHumanTurn,
  onAction,
}: TravelGameBoardProps) {
  const [rolling, setRolling] = useState(false);
  const active = state.players[state.currentPlayerIndex];
  const tiles = state.boardConfig.tiles;
  const activeTile = tiles[active.position];

  const handleRoll = () => {
    if (!isHumanTurn || state.phase !== 'roll' || rolling) return;
    setRolling(true);
    window.setTimeout(() => {
      setRolling(false);
      onAction({ type: 'ROLL' });
    }, 220);
  };

  return (
    <div className="arena-layout">
      <div className="arena-board-col">
        <BoardPerspectiveStage className="arena-wide-board">
          <div className="rounded-2xl sm:rounded-3xl bg-[#0e1b33] p-2 sm:p-3 border-2 border-[#d4af37]/55 shadow-2xl">
            <svg
              viewBox="0 0 560 380"
              className="w-full h-auto block select-none"
              role="img"
              aria-label="Travel Game world tour board"
            >
              <defs>
                <radialGradient id="ocean-bg" cx="50%" cy="50%" r="70%">
                  <stop offset="0%" stopColor="#162d50" />
                  <stop offset="100%" stopColor="#091326" />
                </radialGradient>
              </defs>

              <rect
                x="4"
                y="4"
                width="552"
                height="372"
                rx="18"
                fill="url(#ocean-bg)"
                stroke="#d4af37"
                strokeWidth="2"
                strokeOpacity="0.55"
              />

              {/* Subtle latitude/longitude grid */}
              <ellipse
                cx="280"
                cy="190"
                rx="220"
                ry="130"
                fill="none"
                stroke="#d4af37"
                strokeOpacity="0.12"
                strokeDasharray="4 6"
              />
              <line x1="20" y1="190" x2="540" y2="190" stroke="#d4af37" strokeOpacity="0.08" />
              <line x1="280" y1="20" x2="280" y2="360" stroke="#d4af37" strokeOpacity="0.08" />

              {/* Main tour route edges */}
              {tiles.map((t, idx) => {
                const next = tiles[(idx + 1) % tiles.length];
                return (
                  <line
                    key={`loop-${t.index}`}
                    x1={t.x}
                    y1={t.y}
                    x2={next.x}
                    y2={next.y}
                    stroke="#e2c799"
                    strokeWidth="2.5"
                    strokeOpacity="0.5"
                  />
                );
              })}

              {/* Express shortcut dashed arcs */}
              {tiles.map((t) => {
                if (t.kind !== 'hub' || typeof t.shortcutTo !== 'number') return null;
                const dest = tiles[t.shortcutTo];
                if (!dest) return null;
                const color =
                  t.hubMode === 'air'
                    ? '#38bdf8'
                    : t.hubMode === 'rail'
                    ? '#fbbf24'
                    : '#34d399';
                return (
                  <line
                    key={`shortcut-${t.index}`}
                    x1={t.x}
                    y1={t.y}
                    x2={dest.x}
                    y2={dest.y}
                    stroke={color}
                    strokeWidth="2.2"
                    strokeDasharray="6 4"
                    strokeOpacity="0.7"
                  />
                );
              })}

              {/* Station Nodes */}
              {tiles.map((t) => {
                const isTerminal = t.kind === 'terminal';
                const isCheckpoint = t.kind === 'checkpoint';
                const isEvent = t.kind === 'event';
                const isHub = t.kind === 'hub';
                const fill = isTerminal
                  ? '#d4af37'
                  : isCheckpoint
                  ? '#10b981'
                  : isEvent
                  ? '#a855f7'
                  : isHub
                  ? '#0284c7'
                  : '#1e293b';

                const playersHere = state.players.filter((p) => p.position === t.index);

                return (
                  <g key={t.index}>
                    <circle
                      cx={t.x}
                      cy={t.y}
                      r={isTerminal || isCheckpoint ? 15 : isHub ? 13 : 10}
                      fill={fill}
                      stroke="#f8fafc"
                      strokeWidth={isTerminal || isCheckpoint ? 2 : 1.2}
                      strokeOpacity={0.8}
                    />
                    <text
                      x={t.x}
                      y={t.y + 3}
                      textAnchor="middle"
                      fontSize="8"
                      fontWeight="bold"
                      fill={isTerminal ? '#081020' : '#f8fafc'}
                    >
                      {isTerminal ? 'HQ' : isCheckpoint ? '★' : isEvent ? '?' : t.index}
                    </text>

                    {/* Token pieces on this station */}
                    {playersHere.map((p, pIdx) => {
                      const angle = (pIdx / Math.max(1, playersHere.length)) * Math.PI * 2;
                      const ox = playersHere.length > 1 ? Math.cos(angle) * 9 : 0;
                      const oy = playersHere.length > 1 ? Math.sin(angle) * 9 : -12;
                      return (
                        <g key={p.id}>
                          <circle
                            cx={t.x + ox}
                            cy={t.y + oy}
                            r={6.5}
                            fill={TOKEN_COLORS[p.color]}
                            stroke="#ffffff"
                            strokeWidth="1.6"
                          />
                        </g>
                      );
                    })}
                  </g>
                );
              })}
            </svg>
          </div>
        </BoardPerspectiveStage>
      </div>

      {/* Controls & Explorer Ledger */}
      <aside className="arena-sidebar space-y-3">
        <div className="rounded-2xl bg-[var(--cp-bg-elevated)] border border-[var(--cp-border)] p-3 sm:p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span
                  className="w-3.5 h-3.5 rounded-full border border-white/60"
                  style={{ backgroundColor: TOKEN_COLORS[active.color] }}
                />
                <span className="font-display font-bold text-base">
                  {active.label}
                </span>
              </div>
              <p className="text-xs text-[var(--cp-text-muted)] mt-0.5">
                At {activeTile.name} ({activeTile.region})
              </p>
            </div>
            <Compass className="w-5 h-5 text-[var(--cp-gold)]" />
          </div>

          {/* Dice & Route Choice */}
          {state.phase === 'roll' ? (
            <div className="rounded-xl bg-[var(--cp-surface)] border border-[var(--cp-border)] p-4 flex items-center justify-between gap-4">
              <div
                className={`transition-transform duration-200 ${
                  rolling ? 'scale-105 opacity-85' : ''
                }`}
              >
                <Dice3D
                  value={state.lastRoll ?? 4}
                  size={48}
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
                {rolling ? 'Rolling...' : isHumanTurn ? 'Roll Travel Die' : 'Bot Rolling...'}
              </button>
            </div>
          ) : (
            <div className="rounded-xl bg-[var(--cp-surface)] border border-[var(--cp-gold)]/50 p-4 space-y-3">
              <div className="text-xs font-semibold text-[var(--cp-gold)]">
                EXPRESS HUB CHOICE (ROLLED {state.lastRoll})
              </div>
              <p className="text-xs text-[var(--cp-text-muted)]">
                Spend 1 {activeTile.hubMode?.toUpperCase()} ticket to take the express route to{' '}
                <span className="text-[var(--cp-text)] font-medium">
                  {tiles[activeTile.shortcutTo ?? 0]?.name}
                </span>{' '}
                plus remaining steps?
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={!isHumanTurn}
                  onClick={() => onAction({ type: 'CHOOSE_ROUTE', useShortcut: true })}
                  className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-[var(--cp-gold)] text-[#081020] text-xs font-semibold cursor-pointer"
                >
                  Use {activeTile.hubMode?.toUpperCase()} Ticket
                </button>
                <button
                  type="button"
                  disabled={!isHumanTurn}
                  onClick={() => onAction({ type: 'CHOOSE_ROUTE', useShortcut: false })}
                  className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-[var(--cp-bg-elevated)] border border-[var(--cp-border)] text-xs font-semibold cursor-pointer"
                >
                  Stay on Main Loop
                </button>
              </div>
            </div>
          )}

          {state.lastEventCard && (
            <div className="rounded-xl bg-purple-950/35 border border-purple-400/40 p-3 text-xs">
              <div className="font-semibold text-purple-200">
                Event: {state.lastEventCard.title}
              </div>
              <p className="mt-0.5 text-purple-100/80">
                {state.lastEventCard.description}
              </p>
            </div>
          )}

          {/* Explorer Tickets & Stamps */}
          <div className="space-y-2.5">
            {state.players.map((p, idx) => {
              const progress = computeTravelProgress(state, p);
              const isCurrent = idx === state.currentPlayerIndex;
              return (
                <div
                  key={p.id}
                  className={`rounded-xl p-3 border text-xs ${
                    isCurrent
                      ? 'bg-[var(--cp-surface)] border-[var(--cp-gold)]/70'
                      : 'bg-[var(--cp-surface)]/60 border-[var(--cp-border)]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-semibold">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: TOKEN_COLORS[p.color] }}
                      />
                      <span>{p.label}</span>
                    </div>
                    <span className="font-mono-tabular text-[var(--cp-gold)]">
                      {p.stamps.length}/{state.boardConfig.requiredStamps.length} Stamps · {progress}%
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-[var(--cp-text-muted)] font-mono-tabular">
                    <span className="inline-flex items-center gap-1">
                      <Plane className="w-3 h-3 text-sky-300" /> {p.tickets.air}
                      <Train className="w-3 h-3 text-amber-300 ml-1.5" /> {p.tickets.rail}
                      <Ship className="w-3 h-3 text-emerald-300 ml-1.5" /> {p.tickets.sea}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      {state.boardConfig.requiredStamps.map((stampId) => (
                        <CheckCircle2
                          key={stampId}
                          className={`w-3.5 h-3.5 ${
                            p.stamps.includes(stampId)
                              ? 'text-emerald-400'
                              : 'text-slate-600'
                          }`}
                        />
                      ))}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Log */}
        <div className="rounded-2xl bg-[var(--cp-bg-elevated)] border border-[var(--cp-border)] p-4">
          <div className="text-xs font-semibold tracking-wider text-[var(--cp-text-muted)] mb-2">
            DISPATCH LOG ({state.history.length})
          </div>
          <ul className="max-h-32 overflow-y-auto space-y-1 text-xs font-mono-tabular text-[var(--cp-text-muted)]">
            {state.history.length === 0 ? (
              <li>Collect all 3 continental stamps and return to Grand Terminal.</li>
            ) : (
              state.history.map((item, idx) => <li key={`${item}-${idx}`}>{item}</li>)
            )}
          </ul>
        </div>
      </aside>
    </div>
  );
}
