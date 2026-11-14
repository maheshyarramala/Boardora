import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import type { GameCatalogEntry } from '../../core/catalog';
import type { GameEngine, GameEvent, GameOutcome, MatchSetupConfig } from '../../core/engine';
import { calculateMatchXp } from '../../core/progression';
import type { ActiveSession, GameId, MatchRecord } from '../../core/types';
import { computeBackgammonMoveInWorker } from '../../engines/backgammon/backgammonWorkerClient';
import type {
  BackgammonAction,
  BackgammonState,
} from '../../engines/backgammon/backgammonEngine';
import type { CheckersState } from '../../engines/checkers/checkersEngine';
import { computeCheckersMoveInWorker } from '../../engines/checkers/checkersWorkerClient';
import type { ChessAction, ChessState } from '../../engines/chess/chessEngine';
import { computeChessMoveInWorker } from '../../engines/chess/chessWorkerClient';
import type {
  DriveYourCarAction,
  DriveYourCarState,
} from '../../engines/driveYourCar/driveYourCarEngine';
import type { LudoAction, LudoState } from '../../engines/ludo/ludoEngine';
import type {
  MoneyGameAction,
  MoneyGameState,
} from '../../engines/moneyGame/moneyGameEngine';
import type {
  MorrisAction,
  NineMensMorrisState,
} from '../../engines/nineMensMorris/nineMensMorrisEngine';
import { computeMorrisMoveInWorker } from '../../engines/nineMensMorris/nineMensMorrisWorkerClient';
import type {
  PegSolitaireAction,
  PegSolitaireState,
} from '../../engines/pegSolitaire/pegSolitaireEngine';
import { loadGameEngine } from '../../engines/registry';
import type { SnakesLaddersState } from '../../engines/snakesLadders/snakesLaddersEngine';
import type {
  TravelGameAction,
  TravelGameState,
} from '../../engines/travelGame/travelGameEngine';
import {
  deleteSessionFromCloud,
  pushMatchToCloud,
  pushProfileToCloud,
  pushSessionToCloud,
} from '../../firebase/cloudSync';
import { audioEngine } from '../../platform/audio';
import { hapticsBridge } from '../../platform/haptics';
import { maybeShowPostMatchInterstitial } from '../../monetization/ads';
import { useAppState } from '../../state/AppStateContext';
import { defaultRepository } from '../../storage/db';
import { CURRENT_SCHEMA_VERSION } from '../../storage/migrations';
import { GameArenaShell } from '../shell/GameArenaShell';
import { MatchOutcomeScreen } from '../shell/MatchOutcomeScreen';

const LazyLudoBoard = React.lazy(() =>
  import('./LudoBoard').then((m) => ({ default: m.LudoBoard }))
);
const LazySnakesLaddersBoard = React.lazy(() =>
  import('./SnakesLaddersBoard').then((m) => ({ default: m.SnakesLaddersBoard }))
);
const LazyChessBoard = React.lazy(() =>
  import('./ChessBoard').then((m) => ({ default: m.ChessBoard }))
);
const LazyCheckersBoard = React.lazy(() =>
  import('./CheckersBoard').then((m) => ({ default: m.CheckersBoard }))
);
const LazyPegSolitaireBoard = React.lazy(() =>
  import('./PegSolitaireBoard').then((m) => ({ default: m.PegSolitaireBoard }))
);
const LazyNineMensMorrisBoard = React.lazy(() =>
  import('./NineMensMorrisBoard').then((m) => ({ default: m.NineMensMorrisBoard }))
);
const LazyBackgammonBoard = React.lazy(() =>
  import('./BackgammonBoard').then((m) => ({ default: m.BackgammonBoard }))
);
const LazyTravelGameBoard = React.lazy(() =>
  import('./TravelGameBoard').then((m) => ({ default: m.TravelGameBoard }))
);
const LazyDriveYourCarBoard = React.lazy(() =>
  import('./DriveYourCarBoard').then((m) => ({ default: m.DriveYourCarBoard }))
);
const LazyMoneyGameBoard = React.lazy(() =>
  import('./MoneyGameBoard').then((m) => ({ default: m.MoneyGameBoard }))
);

interface ActiveMatchRunnerProps {
  game: GameCatalogEntry;
  setupConfig: MatchSetupConfig;
  resumeSession?: ActiveSession | null;
  onExit: () => void;
}

function getIsHumanTurn(gameId: GameId, state: unknown): boolean {
  if (gameId === 'ludo') {
    const s = state as LudoState;
    return !s.players[s.currentPlayerIndex]?.isAi;
  }
  if (gameId === 'snakes_ladders') {
    const s = state as SnakesLaddersState;
    return !s.players[s.currentPlayerIndex]?.isAi;
  }
  if (gameId === 'chess') {
    const s = state as ChessState;
    if (s.mode !== 'ai') return true;
    return new Chess(s.fen).turn() === 'w';
  }
  if (gameId === 'checkers') {
    const s = state as CheckersState;
    if (s.mode !== 'ai') return true;
    return s.turn === 'r';
  }
  if (gameId === 'peg_solitaire') {
    return true;
  }
  if (gameId === 'nine_mens_morris') {
    const s = state as NineMensMorrisState;
    if (s.mode !== 'ai') return true;
    return s.turn === 'w';
  }
  if (gameId === 'backgammon') {
    const s = state as BackgammonState;
    if (s.mode !== 'ai') return true;
    return s.turn === 'w';
  }
  if (gameId === 'travel_game') {
    const s = state as TravelGameState;
    return !s.players[s.currentPlayerIndex]?.isAi;
  }
  if (gameId === 'drive_your_car') {
    const s = state as DriveYourCarState;
    return !s.players[s.currentPlayerIndex]?.isAi;
  }
  if (gameId === 'money_game') {
    const s = state as MoneyGameState;
    if (s.phase === 'auction' && s.auction) {
      return !s.players[s.auction.currentBidderIndex]?.isAi;
    }
    return !s.players[s.currentPlayerIndex]?.isAi;
  }
  return true;
}

function getTurnLabel(gameId: GameId, state: unknown): string {
  if (gameId === 'ludo') {
    const s = state as LudoState;
    return `${s.players[s.currentPlayerIndex]?.label ?? 'Player'}'s Turn`;
  }
  if (gameId === 'snakes_ladders') {
    const s = state as SnakesLaddersState;
    return `${s.players[s.currentPlayerIndex]?.label ?? 'Player'}'s Turn`;
  }
  if (gameId === 'chess') {
    const s = state as ChessState;
    return new Chess(s.fen).turn() === 'w' ? 'White to Move' : 'Black to Move';
  }
  if (gameId === 'checkers') {
    const s = state as CheckersState;
    return s.turn === 'r' ? 'Crimson to Move' : 'Walnut to Move';
  }
  if (gameId === 'peg_solitaire') {
    const s = state as PegSolitaireState;
    return `${s.pegsRemaining} Pegs Left`;
  }
  if (gameId === 'nine_mens_morris') {
    const s = state as NineMensMorrisState;
    return s.turn === 'w' ? 'Ivory Gold to Move' : 'Obsidian to Move';
  }
  if (gameId === 'backgammon') {
    const s = state as BackgammonState;
    return s.turn === 'w' ? 'Ivory to Move' : 'Crimson to Move';
  }
  if (gameId === 'travel_game') {
    const s = state as TravelGameState;
    return `${s.players[s.currentPlayerIndex]?.label ?? 'Explorer'}'s Turn`;
  }
  if (gameId === 'drive_your_car') {
    const s = state as DriveYourCarState;
    return `${s.players[s.currentPlayerIndex]?.label ?? 'Driver'}'s Turn`;
  }
  if (gameId === 'money_game') {
    const s = state as MoneyGameState;
    if (s.phase === 'auction' && s.auction) {
      return `Auction: ${s.players[s.auction.currentBidderIndex]?.label ?? 'Bidder'}`;
    }
    return `${s.players[s.currentPlayerIndex]?.label ?? 'Tycoon'}'s Turn`;
  }
  return 'Active Turn';
}

function getMoveCount(state: unknown): number {
  if (state && typeof state === 'object' && 'moveCount' in state) {
    return Number((state as { moveCount: number }).moveCount) || 0;
  }
  return 0;
}

function playFeedbackForEvents(
  events: readonly GameEvent[],
  outcome?: GameOutcome | null
) {
  if (outcome?.finished) {
    if (outcome.humanOutcome === 'win') {
      audioEngine.play('victory');
      hapticsBridge.trigger('success');
    } else if (outcome.humanOutcome === 'loss') {
      audioEngine.play('defeat');
      hapticsBridge.trigger('warning');
    } else {
      audioEngine.play('wood-clack');
      hapticsBridge.trigger('medium');
    }
    return;
  }
  for (const ev of events) {
    if (ev.type === 'win') {
      audioEngine.play('victory');
      hapticsBridge.trigger('success');
      return;
    }
    if (ev.type === 'capture') {
      audioEngine.play('capture');
      hapticsBridge.trigger('medium');
      return;
    }
    if (ev.type === 'roll') {
      audioEngine.play('dice-roll');
      hapticsBridge.trigger('light');
      return;
    }
  }
  audioEngine.play('wood-clack');
  hapticsBridge.trigger('light');
}

export function ActiveMatchRunner({
  game,
  setupConfig,
  resumeSession,
  onExit,
}: ActiveMatchRunnerProps) {
  const { cloudUser, profile, refreshAll } = useAppState();
  const [engine, setEngine] = useState<GameEngine<unknown, unknown> | null>(null);
  const [gameState, setGameState] = useState<unknown>(null);
  const [outcome, setOutcome] = useState<GameOutcome | null>(null);
  const [aiThinking, setAiThinking] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(() =>
    resumeSession ? Math.floor(resumeSession.elapsedMs / 1000) : 0
  );
  const [xpAwarded, setXpAwarded] = useState(0);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const sessionIdRef = useRef<string>(
    resumeSession?.sessionId ?? `sess-${game.id}-${Date.now()}`
  );
  const matchRecordedRef = useRef(false);
  const elapsedRef = useRef(elapsedSeconds);
  elapsedRef.current = elapsedSeconds;

  const recordFinishedMatch = useCallback(
    async (
      nextState: unknown,
      nextOutcome: GameOutcome,
    ) => {
      if (matchRecordedRef.current) return;
      matchRecordedRef.current = true;
      const movesCount = getMoveCount(nextState);
      const earned = calculateMatchXp({
        outcome: nextOutcome.humanOutcome,
        mode: setupConfig.mode,
        difficulty: setupConfig.difficulty,
        movesCount,
      });
      setXpAwarded(earned);
      const matchRecord: MatchRecord = {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        matchId: `match-${game.id}-${Date.now()}`,
        gameId: game.id,
        mode: setupConfig.mode,
        difficulty: setupConfig.difficulty,
        outcome: nextOutcome.humanOutcome,
        opponentLabel:
          setupConfig.mode === 'ai'
            ? `AI (${setupConfig.difficulty})`
            : setupConfig.mode === 'local'
            ? `${setupConfig.playerCount}P Pass & Play`
            : 'Solo Practice',
        movesCount,
        durationMs: elapsedRef.current * 1000,
        xpAwarded: earned,
        score: nextOutcome.score,
        completedAt: Date.now(),
      };
      const res = await defaultRepository.recordCompletedMatch(
        matchRecord,
        sessionIdRef.current
      );
      if (cloudUser && profile?.privacyConsent.cloudSyncEnabled) {
        void pushMatchToCloud(cloudUser.uid, matchRecord);
        void pushProfileToCloud(cloudUser.uid, res.profile);
        void deleteSessionFromCloud(cloudUser.uid, sessionIdRef.current);
      }
      await refreshAll();
    },
    [
      game.id,
      setupConfig,
      cloudUser,
      profile?.privacyConsent.cloudSyncEnabled,
      refreshAll,
    ]
  );

  // Load engine lazily and initialize or resume state
  useEffect(() => {
    let cancelled = false;
    void loadGameEngine(game.id).then((loaded) => {
      if (cancelled || !loaded) return;
      const initialState = resumeSession
        ? loaded.deserialize(resumeSession.serializedState)
        : loaded.createInitialState(setupConfig);
      setEngine(loaded);
      setGameState(initialState);
      setOutcome(loaded.evaluateOutcome(initialState));
      matchRecordedRef.current = false;
    });
    return () => {
      cancelled = true;
    };
  }, [game.id, setupConfig, resumeSession]);

  // Real elapsed timer
  useEffect(() => {
    if (!gameState || outcome?.finished) return;
    const interval = window.setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [gameState, outcome?.finished]);

  const persistOrFinish = useCallback(
    async (
      loadedEngine: GameEngine<unknown, unknown>,
      nextState: unknown,
      nextOutcome: GameOutcome | null
    ) => {
      const movesCount = getMoveCount(nextState);
      if (nextOutcome?.finished) {
        await recordFinishedMatch(nextState, nextOutcome);
      } else {
        const sessionObj: ActiveSession = {
          schemaVersion: CURRENT_SCHEMA_VERSION,
          sessionId: sessionIdRef.current,
          gameId: game.id,
          mode: setupConfig.mode,
          difficulty: setupConfig.difficulty,
          playerCount: setupConfig.playerCount,
          seed: setupConfig.seed,
          serializedState: loadedEngine.serialize(nextState),
          actionCount: movesCount,
          elapsedMs: elapsedRef.current * 1000,
          createdAt: resumeSession?.createdAt ?? Date.now(),
          updatedAt: Date.now(),
        };
        await defaultRepository.upsertSession(sessionObj);
        if (cloudUser && profile?.privacyConsent.cloudSyncEnabled) {
          void pushSessionToCloud(cloudUser.uid, sessionObj);
        }
      }
    },
    [
      recordFinishedMatch,
      game.id,
      setupConfig,
      resumeSession?.createdAt,
      cloudUser,
      profile?.privacyConsent.cloudSyncEnabled,
    ]
  );

  const dispatchAction = useCallback(
    (action: unknown) => {
      if (!engine || !gameState) return;
      const check = engine.validateAction(gameState, action);
      if (!check.valid) {
        audioEngine.play('error');
        hapticsBridge.trigger('warning');
        setErrorBanner(check.reason ?? 'Illegal move.');
        window.setTimeout(() => setErrorBanner(null), 2200);
        return;
      }

      const transition = engine.applyAction(gameState, action);
      const nextOutcome = engine.evaluateOutcome(transition.state);
      playFeedbackForEvents(transition.events, nextOutcome);
      setGameState(transition.state);
      setOutcome(nextOutcome);
      setErrorBanner(null);
      void persistOrFinish(engine, transition.state, nextOutcome);
    },
    [engine, gameState, persistOrFinish]
  );

  // Automated AI Turn Driver (offloaded to Web Workers for board search games)
  useEffect(() => {
    if (!engine || !gameState || outcome?.finished) return;
    if (getIsHumanTurn(game.id, gameState)) return;

    let cancelled = false;
    setAiThinking(true);

    const runAi = async () => {
      await new Promise((r) => window.setTimeout(r, 420));
      if (cancelled) return;

      let chosenAction: unknown = null;
      if (game.id === 'chess') {
        const s = gameState as ChessState;
        const choice = await computeChessMoveInWorker(s.fen, setupConfig.difficulty);
        if (choice) {
          chosenAction = {
            type: 'MOVE',
            from: choice.from,
            to: choice.to,
            ...(choice.promotion ? { promotion: choice.promotion } : {}),
          } satisfies ChessAction;
        }
      } else if (game.id === 'checkers') {
        const s = gameState as CheckersState;
        chosenAction = await computeCheckersMoveInWorker(s, setupConfig.difficulty);
      } else if (game.id === 'nine_mens_morris') {
        const s = gameState as NineMensMorrisState;
        chosenAction = await computeMorrisMoveInWorker(s, setupConfig.difficulty);
      } else if (game.id === 'backgammon') {
        const s = gameState as BackgammonState;
        chosenAction = await computeBackgammonMoveInWorker(s, setupConfig.difficulty);
      } else if (engine.computeBotMove) {
        chosenAction = engine.computeBotMove(gameState, setupConfig.difficulty);
      }

      if (cancelled) return;
      setAiThinking(false);
      if (chosenAction) {
        dispatchAction(chosenAction);
      }
    };

    void runAi();
    return () => {
      cancelled = true;
    };
  }, [
    engine,
    gameState,
    outcome?.finished,
    game.id,
    setupConfig.difficulty,
    dispatchAction,
  ]);

  const handleRestart = () => {
    if (!engine) return;
    sessionIdRef.current = `sess-${game.id}-${Date.now()}`;
    matchRecordedRef.current = false;
    const freshConfig: MatchSetupConfig = {
      ...setupConfig,
      seed: Date.now() >>> 0,
    };
    const freshState = engine.createInitialState(freshConfig);
    setGameState(freshState);
    setOutcome(null);
    setElapsedSeconds(0);
    setXpAwarded(0);
    setAiThinking(false);
  };

  const handleExit = () => {
    void (async () => {
      if (outcome?.finished) {
        await maybeShowPostMatchInterstitial();
      }
      await refreshAll();
      onExit();
    })();
  };

  if (!engine || !gameState) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--cp-bg)] text-[var(--cp-text)]">
        <p className="font-display text-lg">Preparing {game.title} Table...</p>
      </div>
    );
  }

  const isHumanTurn = getIsHumanTurn(game.id, gameState);
  const turnLabel = getTurnLabel(game.id, gameState);

  const moveCount = getMoveCount(gameState);
  const legalActions = engine.getLegalActions(gameState);

  return (
    <>
      <GameArenaShell
        title={game.title}
        subtitle={
          setupConfig.mode === 'ai'
            ? `vs AI (${setupConfig.difficulty})`
            : setupConfig.mode === 'local'
            ? 'Pass & Play'
            : 'Practice'
        }
        turnLabel={turnLabel}
        moveCount={moveCount}
        elapsedSeconds={elapsedSeconds}
        outcome={null}
        onRestart={handleRestart}
        onExit={handleExit}
      >
        <div className="w-full space-y-2">
          {errorBanner && (
            <div
              role="alert"
              className="max-w-md mx-auto rounded-xl bg-red-950/90 border border-red-400/50 px-4 py-2 text-xs text-center text-red-100"
            >
              {errorBanner}
            </div>
          )}

          <Suspense
            fallback={
              <div className="text-center py-12 text-sm text-[var(--cp-text-muted)]">
                Loading tabletop board...
              </div>
            }
          >
            {game.id === 'ludo' && (
              <LazyLudoBoard
                state={gameState as LudoState}
                isHumanTurn={isHumanTurn}
                legalActions={legalActions as LudoAction[]}
                onAction={(a) => dispatchAction(a)}
              />
            )}
            {game.id === 'snakes_ladders' && (
              <LazySnakesLaddersBoard
                state={gameState as SnakesLaddersState}
                isHumanTurn={isHumanTurn}
                onAction={(a) => dispatchAction(a)}
              />
            )}
            {game.id === 'chess' && (
              <LazyChessBoard
                state={gameState as ChessState}
                isHumanTurn={isHumanTurn}
                aiThinking={aiThinking}
                onAction={(a) => dispatchAction(a)}
              />
            )}
            {game.id === 'checkers' && (
              <LazyCheckersBoard
                state={gameState as CheckersState}
                isHumanTurn={isHumanTurn}
                aiThinking={aiThinking}
                onAction={(a) => dispatchAction(a)}
              />
            )}
            {game.id === 'peg_solitaire' && (
              <LazyPegSolitaireBoard
                state={gameState as PegSolitaireState}
                onAction={(a: PegSolitaireAction) => dispatchAction(a)}
              />
            )}
            {game.id === 'nine_mens_morris' && (
              <LazyNineMensMorrisBoard
                state={gameState as NineMensMorrisState}
                isHumanTurn={isHumanTurn}
                aiThinking={aiThinking}
                onAction={(a: MorrisAction) => dispatchAction(a)}
              />
            )}
            {game.id === 'backgammon' && (
              <LazyBackgammonBoard
                state={gameState as BackgammonState}
                isHumanTurn={isHumanTurn}
                aiThinking={aiThinking}
                onAction={(a: BackgammonAction) => dispatchAction(a)}
              />
            )}
            {game.id === 'travel_game' && (
              <LazyTravelGameBoard
                state={gameState as TravelGameState}
                isHumanTurn={isHumanTurn}
                onAction={(a: TravelGameAction) => dispatchAction(a)}
              />
            )}
            {game.id === 'drive_your_car' && (
              <LazyDriveYourCarBoard
                state={gameState as DriveYourCarState}
                isHumanTurn={isHumanTurn}
                onAction={(a: DriveYourCarAction) => dispatchAction(a)}
              />
            )}
            {game.id === 'money_game' && (
              <LazyMoneyGameBoard
                state={gameState as MoneyGameState}
                isHumanTurn={isHumanTurn}
                onAction={(a: MoneyGameAction) => dispatchAction(a)}
              />
            )}
          </Suspense>
        </div>
      </GameArenaShell>

      {outcome?.finished && (
        <MatchOutcomeScreen
          gameTitle={game.title}
          outcome={outcome}
          moveCount={moveCount}
          elapsedSeconds={elapsedSeconds}
          xpEarned={xpAwarded}
          onPlayAgain={handleRestart}
          onReturnToParlor={handleExit}
        />
      )}
    </>
  );
}
