import type { GameId } from '../../core/types';
import { getCatalogEntry } from '../../core/catalog';

const GAME_ART_PATHS: Record<GameId, string> = {
  ludo: '/assets/game-art/ludo.svg',
  chess: '/assets/game-art/chess.svg',
  snakes_ladders: '/assets/game-art/snakes_ladders.svg',
  travel_game: '/assets/game-art/travel_game.svg',
  peg_solitaire: '/assets/game-art/peg_solitaire.svg',
  nine_mens_morris: '/assets/game-art/nine_mens_morris.svg',
  checkers: '/assets/game-art/checkers.svg',
  backgammon: '/assets/game-art/backgammon.svg',
  drive_your_car: '/assets/game-art/drive_your_car.svg',
  money_game: '/assets/game-art/money_game.svg',
};

export function GameBoardArtwork({
  gameId,
  className = 'w-full h-36 object-cover',
}: {
  gameId: GameId;
  className?: string;
}) {
  const entry = getCatalogEntry(gameId);
  return (
    <img
      src={GAME_ART_PATHS[gameId]}
      alt={`${entry.title} board preview`}
      loading="lazy"
      decoding="async"
      className={`block bg-[#08172F] ${className}`}
    />
  );
}
