import { useState } from 'react';
import { ArrowLeft, ArrowRight, Flame, Fuel, Zap } from 'lucide-react';
import {
  VEHICLE_ROSTER,
  type DriveFeatureKind,
} from '../../engines/driveYourCar/driveTrackConfig';
import {
  getFeatureAt,
  type DriveYourCarAction,
  type DriveYourCarState,
} from '../../engines/driveYourCar/driveYourCarEngine';
import { BoardPerspectiveStage, Dice3D } from '../tabletop/TactilePieces';

interface DriveYourCarBoardProps {
  state: DriveYourCarState;
  isHumanTurn: boolean;
  onAction: (action: DriveYourCarAction) => void;
}

const FEATURE_META: Record<
  DriveFeatureKind,
  { symbol: string; bg: string; label: string }
> = {
  pit: { symbol: 'P', bg: '#10b981', label: 'Pit' },
  boost: { symbol: '⚡', bg: '#f59e0b', label: 'Boost' },
  oil: { symbol: '💧', bg: '#6366f1', label: 'Oil' },
  roadblock: { symbol: '✕', bg: '#dc2626', label: 'Block' },
  event: { symbol: '?', bg: '#a855f7', label: 'Event' },
};

export function DriveYourCarBoard({
  state,
  isHumanTurn,
  onAction,
}: DriveYourCarBoardProps) {
  const [rolling, setRolling] = useState(false);
  const active = state.players[state.currentPlayerIndex];
  const track = state.trackConfig;
  const totalSegs = track.totalSegments;
  const sectors = 4;
  const segsPerSector = Math.ceil(totalSegs / sectors);

  const handleRoll = () => {
    if (!isHumanTurn || rolling) return;
    setRolling(true);
    window.setTimeout(() => {
      setRolling(false);
      onAction({ type: 'ROLL_DRIVE' });
    }, 220);
  };

  return (
    <div className="arena-layout">
      <div className="arena-board-col">
        <BoardPerspectiveStage className="arena-wide-board">
          <div className="boardora-3d-board rounded-2xl sm:rounded-3xl bg-[#111827] p-2 sm:p-3 border-2 border-[#d4af37]/55 shadow-2xl">
            <svg
              viewBox="0 0 560 408"
              className="w-full h-auto block select-none"
              role="img"
              aria-label="Drive Your Car 3-lane highway board"
            >
              <rect
                x="4"
                y="4"
                width="552"
                height="400"
                rx="16"
                fill="#0b1322"
                stroke="#d4af37"
                strokeOpacity="0.5"
                strokeWidth="2"
              />

              {/* 4 Horizontal Highway Strips (8 segments × 3 lanes each) */}
              {Array.from({ length: sectors }, (_, secIdx) => {
                const startSeg = secIdx * segsPerSector + 1;
                const yTop = 18 + secIdx * 96;
                const xStart = 44;
                const cellW = 60;
                const laneH = 25;

                return (
                  <g key={secIdx}>
                    <text
                      x="18"
                      y={yTop + 42}
                      textAnchor="middle"
                      fontSize="9"
                      fontWeight="bold"
                      fill="#d4af37"
                    >
                      S{secIdx + 1}
                    </text>

                    {/* Asphalt strip */}
                    <rect
                      x={xStart}
                      y={yTop}
                      width={segsPerSector * cellW}
                      height={laneH * 3}
                      rx="6"
                      fill="#1f2937"
                      stroke="#475569"
                      strokeWidth="1"
                    />

                    {/* Lane dashed dividers */}
                    <line
                      x1={xStart}
                      y1={yTop + laneH}
                      x2={xStart + segsPerSector * cellW}
                      y2={yTop + laneH}
                      stroke="#94a3b8"
                      strokeDasharray="6 6"
                      strokeOpacity="0.45"
                    />
                    <line
                      x1={xStart}
                      y1={yTop + laneH * 2}
                      x2={xStart + segsPerSector * cellW}
                      y2={yTop + laneH * 2}
                      stroke="#94a3b8"
                      strokeDasharray="6 6"
                      strokeOpacity="0.45"
                    />

                    {Array.from({ length: segsPerSector }, (_, offset) => {
                      const segNum = startSeg + offset;
                      if (segNum > totalSegs) return null;
                      const x = xStart + offset * cellW;
                      const isCheckpoint = track.checkpoints.includes(segNum);
                      const isFinish = segNum === totalSegs;

                      return (
                        <g key={segNum}>
                          <line
                            x1={x}
                            y1={yTop}
                            x2={x}
                            y2={yTop + laneH * 3}
                            stroke={
                              isFinish
                                ? '#fbbf24'
                                : isCheckpoint
                                ? '#34d399'
                                : '#334155'
                            }
                            strokeWidth={isFinish || isCheckpoint ? 2.2 : 0.8}
                          />

                          <text
                            x={x + cellW / 2}
                            y={yTop + laneH * 3 + 11}
                            textAnchor="middle"
                            fontSize="8.5"
                            fontFamily="monospace"
                            fill={isFinish ? '#fbbf24' : isCheckpoint ? '#6ee7b7' : '#94a3b8'}
                          >
                            {isFinish ? '🏁 FIN' : isCheckpoint ? `CP ${segNum}` : segNum}
                          </text>

                          {/* Lane features */}
                          {([0, 1, 2] as const).map((lane) => {
                            const feat = getFeatureAt(track, segNum, lane);
                            const cy = yTop + lane * laneH + laneH / 2;
                            const cx = x + cellW / 2;

                            const carsHere = state.players.filter(
                              (p) => p.segment === segNum && p.lane === lane
                            );

                            return (
                              <g key={lane}>
                                {feat && (
                                  <g>
                                    <rect
                                      x={cx - 12}
                                      y={cy - 9}
                                      width="24"
                                      height="18"
                                      rx="4"
                                      fill={FEATURE_META[feat].bg}
                                      fillOpacity="0.28"
                                      stroke={FEATURE_META[feat].bg}
                                      strokeWidth="1"
                                    />
                                    <text
                                      x={cx}
                                      y={cy + 3.5}
                                      textAnchor="middle"
                                      fontSize="9"
                                      fontWeight="bold"
                                      fill="#f8fafc"
                                    >
                                      {FEATURE_META[feat].symbol}
                                    </text>
                                  </g>
                                )}

                                {carsHere.map((car, cIdx) => {
                                  const spec = VEHICLE_ROSTER[car.vehicleId];
                                  const shiftX = carsHere.length > 1 ? (cIdx - 0.5) * 14 : 0;
                                  return (
                                    <g key={car.id}>
                                      <rect
                                        x={cx - 11 + shiftX}
                                        y={cy - 7}
                                        width="22"
                                        height="14"
                                        rx="4"
                                        fill={spec.colorHex}
                                        stroke="#ffffff"
                                        strokeWidth="1.5"
                                      />
                                      <text
                                        x={cx + shiftX}
                                        y={cy + 3}
                                        textAnchor="middle"
                                        fontSize="8"
                                        fontWeight="bold"
                                        fill="#081020"
                                      >
                                        {car.id + 1}
                                      </text>
                                    </g>
                                  );
                                })}
                              </g>
                            );
                          })}
                        </g>
                      );
                    })}
                  </g>
                );
              })}

              {/* Legend */}
              <text x="44" y="397" fontSize="8.5" fill="#94a3b8">
                P = Pit Refuel · ⚡ = Boost · 💧 = Oil Slick · ✕ = Roadblock · ? = Road Event
              </text>
            </svg>
          </div>
        </BoardPerspectiveStage>
      </div>

      {/* Driver Cockpit & Standings */}
      <aside className="arena-sidebar space-y-3">
        <div className="rounded-2xl bg-[var(--cp-bg-elevated)] border border-[var(--cp-border)] p-3 sm:p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span
                  className="w-3.5 h-3.5 rounded-sm border border-white/60"
                  style={{ backgroundColor: VEHICLE_ROSTER[active.vehicleId].colorHex }}
                />
                <span className="font-display font-bold text-base">
                  {active.label}
                </span>
              </div>
              <p className="text-xs text-[var(--cp-text-muted)] mt-0.5">
                {VEHICLE_ROSTER[active.vehicleId].name} · Seg {active.segment}/{totalSegs}
              </p>
            </div>
          </div>

          {/* Pre-roll Lane & Nitro Controls */}
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              disabled={!isHumanTurn || state.switchedLaneThisTurn || active.lane === 0 || active.fuel <= 0}
              onClick={() => onAction({ type: 'SWITCH_LANE', lane: (active.lane - 1) as 0 | 1 | 2 })}
              className="min-h-[42px] px-2.5 rounded-xl bg-[var(--cp-surface)] border border-[var(--cp-border)] hover:border-[var(--cp-gold)] disabled:opacity-40 text-xs font-semibold inline-flex items-center justify-center gap-1 cursor-pointer disabled:cursor-not-allowed"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Lane L
            </button>
            <button
              type="button"
              disabled={!isHumanTurn || active.nitro <= 0 || (active.fuel < 2 && !state.nitroArmed)}
              onClick={() => onAction({ type: 'TOGGLE_NITRO' })}
              className={`min-h-[42px] px-2.5 rounded-xl border text-xs font-semibold inline-flex items-center justify-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                state.nitroArmed
                  ? 'bg-amber-500 text-[#081020] border-amber-300'
                  : 'bg-[var(--cp-surface)] border-[var(--cp-border)] text-[var(--cp-text)]'
              }`}
            >
              <Flame className="w-3.5 h-3.5" />
              Nitro ({active.nitro})
            </button>
            <button
              type="button"
              disabled={!isHumanTurn || state.switchedLaneThisTurn || active.lane === 2 || active.fuel <= 0}
              onClick={() => onAction({ type: 'SWITCH_LANE', lane: (active.lane + 1) as 0 | 1 | 2 })}
              className="min-h-[42px] px-2.5 rounded-xl bg-[var(--cp-surface)] border border-[var(--cp-border)] hover:border-[var(--cp-gold)] disabled:opacity-40 text-xs font-semibold inline-flex items-center justify-center gap-1 cursor-pointer disabled:cursor-not-allowed"
            >
              Lane R
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Roll Drive */}
          <div className="rounded-xl bg-[var(--cp-surface)] border border-[var(--cp-border)] p-4 flex items-center justify-between gap-4">
            <div
              className={`transition-transform duration-200 ${
                rolling ? 'scale-105 opacity-85' : ''
              }`}
            >
              <Dice3D
                value={state.lastRoll ?? 5}
                size={48}
                variant="ivory"
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
              {active.fuel <= 0
                ? 'Emergency Coast'
                : rolling
                ? 'Driving...'
                : isHumanTurn
                ? 'Accelerate (Roll)'
                : 'Rival Driving...'}
            </button>
          </div>

          {state.lastEventCard && (
            <div className="rounded-xl bg-purple-950/35 border border-purple-400/40 p-3 text-xs">
              <div className="font-semibold text-purple-200">
                Road Event: {state.lastEventCard.title}
              </div>
              <p className="mt-0.5 text-purple-100/80">
                {state.lastEventCard.description}
              </p>
            </div>
          )}

          {/* Grid Telemetry */}
          <div className="space-y-2">
            {state.players.map((p, idx) => {
              const spec = VEHICLE_ROSTER[p.vehicleId];
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
                    <span className="font-semibold flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-sm"
                        style={{ backgroundColor: spec.colorHex }}
                      />
                      {p.label}
                    </span>
                    <span className="font-mono-tabular text-[var(--cp-gold)]">
                      Seg {p.segment}/{totalSegs} · Lane {p.lane === 0 ? 'L' : p.lane === 1 ? 'C' : 'R'}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[11px] font-mono-tabular text-[var(--cp-text-muted)]">
                    <span className="inline-flex items-center gap-1">
                      <Fuel className="w-3 h-3 text-emerald-400" />
                      {p.fuel}/{p.maxFuel}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Zap className="w-3 h-3 text-amber-300" />
                      Nitro {p.nitro}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl bg-[var(--cp-bg-elevated)] border border-[var(--cp-border)] p-4">
          <div className="text-xs font-semibold tracking-wider text-[var(--cp-text-muted)] mb-2">
            RACE LOG ({state.history.length})
          </div>
          <ul className="max-h-32 overflow-y-auto space-y-1 text-xs font-mono-tabular text-[var(--cp-text-muted)]">
            {state.history.length === 0 ? (
              <li>Switch lanes or engage Nitro before accelerating!</li>
            ) : (
              state.history.map((h, i) => <li key={`${h}-${i}`}>{h}</li>)
            )}
          </ul>
        </div>
      </aside>
    </div>
  );
}
