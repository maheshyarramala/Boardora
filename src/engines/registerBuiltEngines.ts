import type { GameEngine } from '../core/engine';
import { registerEngineLoader } from './registry';

let registered = false;

/**
 * Registers lazy dynamic imports for all implemented game engines.
 * No engine code or AI worker is downloaded until a user opens that game.
 */
export function registerBuiltEngines(): void {
  if (registered) return;
  registered = true;

  registerEngineLoader('ludo', async () => {
    const mod = await import('./ludo/ludoEngine');
    return mod.ludoEngine as unknown as GameEngine<unknown, unknown>;
  });

  registerEngineLoader('snakes_ladders', async () => {
    const mod = await import('./snakesLadders/snakesLaddersEngine');
    return mod.snakesLaddersEngine as unknown as GameEngine<unknown, unknown>;
  });

  registerEngineLoader('chess', async () => {
    const mod = await import('./chess/chessEngine');
    return mod.chessEngine as unknown as GameEngine<unknown, unknown>;
  });

  registerEngineLoader('checkers', async () => {
    const mod = await import('./checkers/checkersEngine');
    return mod.checkersEngine as unknown as GameEngine<unknown, unknown>;
  });

  registerEngineLoader('peg_solitaire', async () => {
    const mod = await import('./pegSolitaire/pegSolitaireEngine');
    return mod.pegSolitaireEngine as unknown as GameEngine<unknown, unknown>;
  });

  registerEngineLoader('nine_mens_morris', async () => {
    const mod = await import('./nineMensMorris/nineMensMorrisEngine');
    return mod.nineMensMorrisEngine as unknown as GameEngine<unknown, unknown>;
  });

  registerEngineLoader('backgammon', async () => {
    const mod = await import('./backgammon/backgammonEngine');
    return mod.backgammonEngine as unknown as GameEngine<unknown, unknown>;
  });

  registerEngineLoader('travel_game', async () => {
    const mod = await import('./travelGame/travelGameEngine');
    return mod.travelGameEngine as unknown as GameEngine<unknown, unknown>;
  });

  registerEngineLoader('drive_your_car', async () => {
    const mod = await import('./driveYourCar/driveYourCarEngine');
    return mod.driveYourCarEngine as unknown as GameEngine<unknown, unknown>;
  });

  registerEngineLoader('money_game', async () => {
    const mod = await import('./moneyGame/moneyGameEngine');
    return mod.moneyGameEngine as unknown as GameEngine<unknown, unknown>;
  });
}
