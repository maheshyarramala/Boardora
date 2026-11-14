import type { GameEngine } from '../core/engine';
import type { GameId } from '../core/types';

export type LazyEngineLoader<TState = unknown, TAction = unknown> = () => Promise<
  GameEngine<TState, TAction>
>;

/**
 * Lazy-loaded registry for all 10 independent game engines.
 * Ensures unused game assets and AI workers are never loaded at startup.
 */
const ENGINE_LOADERS: Partial<Record<GameId, LazyEngineLoader>> = {};

export function registerEngineLoader(
  gameId: GameId,
  loader: LazyEngineLoader
): void {
  ENGINE_LOADERS[gameId] = loader;
}

export function isEngineRegistered(gameId: GameId): boolean {
  return Boolean(ENGINE_LOADERS[gameId]);
}

export async function loadGameEngine(
  gameId: GameId
): Promise<GameEngine<unknown, unknown> | null> {
  const loader = ENGINE_LOADERS[gameId];
  if (!loader) {
    return null;
  }
  return loader();
}
