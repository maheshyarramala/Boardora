import type { GameId, GameMode } from './types';

export type GameCategory = 'strategy' | 'race' | 'puzzle' | 'economy';

export interface GameCatalogEntry {
  id: GameId;
  number: number;
  title: string;
  tagline: string;
  category: GameCategory;
  minPlayers: number;
  maxPlayers: number;
  supportedModes: readonly GameMode[];
  supportsDifficulty: boolean;
  estimatedMinutes: string;
  boardFinish: string;
  rulesSummary: readonly string[];
  /** Stage when engine becomes playable; Stage 1 displays authentic rules & real 0-state stats */
  engineStage: 2 | 3 | 4 | 5 | 6;
  isReady: boolean;
}

export const GAME_CATALOG: readonly GameCatalogEntry[] = [
  {
    id: 'ludo',
    number: 1,
    title: 'Ludo',
    tagline: 'Race four tokens home across safe stars and rival captures.',
    category: 'race',
    minPlayers: 2,
    maxPlayers: 4,
    supportedModes: ['ai', 'local', 'practice', 'online'],
    supportsDifficulty: true,
    estimatedMinutes: '10–20 min',
    boardFinish: 'Inlaid Walnut & Brass',
    rulesSummary: [
      'Roll a 6 to launch a token from your home yard onto the starting square.',
      'Landing on an opponent token outside safe star tiles sends it back to its yard.',
      'Rolling a 6 or capturing grants a bonus roll; exact roll required to enter the center crown.',
    ],
    engineStage: 2,
    isReady: true,
  },
  {
    id: 'chess',
    number: 2,
    title: 'Chess',
    tagline: 'Classical strategy with FIDE rules and Web Worker depth search.',
    category: 'strategy',
    minPlayers: 2,
    maxPlayers: 2,
    supportedModes: ['ai', 'local', 'practice', 'online'],
    supportsDifficulty: true,
    estimatedMinutes: '10–30 min',
    boardFinish: 'Obsidian & Alabaster Marble',
    rulesSummary: [
      'Full FIDE move legality including castling, en passant, and pawn promotion.',
      'Detects check, checkmate, stalemate, 50-move rule, and threefold repetition.',
      'AI search runs in a dedicated Web Worker across three tactical difficulty tiers.',
    ],
    engineStage: 3,
    isReady: true,
  },
  {
    id: 'snakes_ladders',
    number: 3,
    title: 'Snakes & Ladders',
    tagline: 'Climb gilded ladders and dodge serpent chutes to square 100.',
    category: 'race',
    minPlayers: 2,
    maxPlayers: 4,
    supportedModes: ['ai', 'local', 'practice', 'online'],
    supportsDifficulty: false,
    estimatedMinutes: '5–12 min',
    boardFinish: 'Gilded Parchment & Oak',
    rulesSummary: [
      'Take turns rolling a single die to advance along the 10×10 serpentine track.',
      'Land at the base of a ladder to climb upward; land on a snake head to slide down.',
      'Exact roll or bounce-back option determines entry onto tile 100.',
    ],
    engineStage: 2,
    isReady: true,
  },
  {
    id: 'travel_game',
    number: 4,
    title: 'Travel Game',
    tagline: 'Dice-driven world tour race with route tickets and event cards.',
    category: 'race',
    minPlayers: 2,
    maxPlayers: 4,
    supportedModes: ['ai', 'local', 'practice', 'online'],
    supportsDifficulty: true,
    estimatedMinutes: '12–20 min',
    boardFinish: 'Cartographer Brass & Navy',
    rulesSummary: [
      'Roll across global hubs while spending Air, Rail, and Sea tickets to unlock shortcuts.',
      'Draw Event Cards on harbor and airport tiles for tailwind boosts or customs delays.',
      'Collect required destination passport stamps and return to the Grand Terminal to win.',
    ],
    engineStage: 6,
    isReady: true,
  },
  {
    id: 'peg_solitaire',
    number: 5,
    title: 'Peg Solitaire',
    tagline: 'Classic single-player jump puzzle with English & European boards.',
    category: 'puzzle',
    minPlayers: 1,
    maxPlayers: 1,
    supportedModes: ['practice'],
    supportsDifficulty: false,
    estimatedMinutes: '4–10 min',
    boardFinish: 'Turned Mahogany & Brass Pegs',
    rulesSummary: [
      'Jump one peg orthogonally over an adjacent peg into an empty hole, removing the jumped peg.',
      'Choose between the 33-hole English cross or 37-hole European board layout.',
      'Aim for a single remaining peg in the center cavity for a Grand Solitaire finish.',
    ],
    engineStage: 4,
    isReady: true,
  },
  {
    id: 'nine_mens_morris',
    number: 6,
    title: "Nine Men's Morris",
    tagline: 'Form three-in-a-row mills across placement, sliding, and flying.',
    category: 'strategy',
    minPlayers: 2,
    maxPlayers: 2,
    supportedModes: ['ai', 'local', 'practice', 'online'],
    supportsDifficulty: true,
    estimatedMinutes: '8–15 min',
    boardFinish: 'Engraved Cedar & Ivory',
    rulesSummary: [
      'Phase 1: Alternate placing 9 pieces on the 24 intersections; forming a mill removes an opponent piece.',
      'Phase 2: Slide pieces along connected lines to form new mills.',
      'Phase 3: Down to 3 pieces unlocks flying to any open node; win by reducing opponent below 3.',
    ],
    engineStage: 4,
    isReady: true,
  },
  {
    id: 'checkers',
    number: 7,
    title: 'Checkers / Draughts',
    tagline: 'Mandatory captures, multi-jump chains, and crowned kings.',
    category: 'strategy',
    minPlayers: 2,
    maxPlayers: 2,
    supportedModes: ['ai', 'local', 'practice', 'online'],
    supportsDifficulty: true,
    estimatedMinutes: '8–18 min',
    boardFinish: 'Rosewood & Maple',
    rulesSummary: [
      'Move diagonally forward on dark squares; captures are mandatory whenever available.',
      'Chain multiple diagonal jumps in a single turn until no further captures remain.',
      'Reach the far rank to crown a King with bidirectional diagonal movement.',
    ],
    engineStage: 2,
    isReady: true,
  },
  {
    id: 'backgammon',
    number: 8,
    title: 'Backgammon',
    tagline: 'Tactical race, prime blocks, and bearing off with twin dice.',
    category: 'strategy',
    minPlayers: 2,
    maxPlayers: 2,
    supportedModes: ['ai', 'local', 'practice', 'online'],
    supportsDifficulty: true,
    estimatedMinutes: '10–20 min',
    boardFinish: 'Emerald Felt & Walnut Case',
    rulesSummary: [
      'Move 15 checkers toward your home board according to twin dice; doubles grant four moves.',
      'Single checkers (blots) can be hit onto the bar and must re-enter before other moves.',
      'Must use maximum possible dice values; bear off all 15 checkers first to win.',
    ],
    engineStage: 5,
    isReady: true,
  },
  {
    id: 'drive_your_car',
    number: 9,
    title: 'Drive Your Car',
    tagline: 'Tabletop lane-and-fuel dice race through highway hazards.',
    category: 'race',
    minPlayers: 2,
    maxPlayers: 4,
    supportedModes: ['ai', 'local', 'practice', 'online'],
    supportsDifficulty: true,
    estimatedMinutes: '8–15 min',
    boardFinish: 'Slate Asphalt & Brass',
    rulesSummary: [
      'Roll speed and lane dice to advance across a three-lane highway track.',
      'Manage your fuel gauge—visit Pit Stops to refuel or risk stalling on empty.',
      'Dodge oil slicks and roadblocks while timing nitro boosts to cross the finish first.',
    ],
    engineStage: 6,
    isReady: true,
  },
  {
    id: 'money_game',
    number: 10,
    title: 'Money Game',
    tagline: 'Acquire title deeds, charge rent, and win bank auctions.',
    category: 'economy',
    minPlayers: 2,
    maxPlayers: 4,
    supportedModes: ['ai', 'local', 'practice', 'online'],
    supportsDifficulty: true,
    estimatedMinutes: '15–30 min',
    boardFinish: 'Velvet Navy & Gold Bullion',
    rulesSummary: [
      'Buy unowned properties on arrival or trigger an open bank auction among all players.',
      'Complete color groups to build upgrades and multiply rent collected from rivals.',
      'Survive Chance and Treasury events; last solvent tycoon (or highest net worth) wins.',
    ],
    engineStage: 6,
    isReady: true,
  },
] as const;

export function getCatalogEntry(gameId: GameId): GameCatalogEntry {
  const entry = GAME_CATALOG.find((g) => g.id === gameId);
  if (!entry) {
    throw new Error(`Unknown gameId: ${gameId}`);
  }
  return entry;
}
