export type GameId =
  | 'ludo'
  | 'chess'
  | 'snakes_ladders'
  | 'travel_game'
  | 'peg_solitaire'
  | 'nine_mens_morris'
  | 'checkers'
  | 'backgammon'
  | 'drive_your_car'
  | 'money_game';

export type GameMode = 'ai' | 'local' | 'practice' | 'online';

export type AIDifficulty = 'easy' | 'medium' | 'hard';

export type ThemeId = 'navy-gold' | 'marble-light' | 'emerald-felt';

export type LanguageCode = 'en' | 'es' | 'fr' | 'hi';

export type AvatarId =
  | 'royal-knight'
  | 'golden-crown'
  | 'compass-rose'
  | 'emerald-dice'
  | 'ruby-rook'
  | 'sapphire-wheel';

export interface AccessibilityOptions {
  highContrast: boolean;
  colorblindSymbols: boolean;
  largeText: boolean;
  reducedMotion: boolean;
}

export interface PlayerPreferences {
  soundEnabled: boolean;
  soundVolume: number; // Master volume 0 to 1
  sfxVolume: number; // 0 to 1
  musicEnabled: boolean;
  musicVolume: number; // 0 to 1
  hapticsEnabled: boolean;
  theme: ThemeId;
  language: LanguageCode;
  accessibility: AccessibilityOptions;
}

export interface PrivacyConsent {
  analyticsEnabled: boolean;
  cloudSyncEnabled: boolean;
  consentUpdatedAt: number;
}

export interface PlayerProfile {
  schemaVersion: number;
  id: string;
  cloudUid?: string;
  displayName: string;
  avatarId: AvatarId;
  authType: 'guest' | 'google';
  xp: number;
  level: number;
  preferences: PlayerPreferences;
  privacyConsent: PrivacyConsent;
  createdAt: number;
  updatedAt: number;
}

export interface ActiveSession {
  schemaVersion: number;
  sessionId: string;
  gameId: GameId;
  mode: GameMode;
  difficulty: AIDifficulty;
  playerCount: number;
  seed: number;
  serializedState: string;
  actionCount: number;
  elapsedMs: number;
  createdAt: number;
  updatedAt: number;
}

export type MatchOutcome = 'win' | 'loss' | 'draw';

export interface MatchRecord {
  schemaVersion: number;
  matchId: string;
  gameId: GameId;
  mode: GameMode;
  difficulty?: AIDifficulty;
  outcome: MatchOutcome;
  opponentLabel: string;
  movesCount: number;
  durationMs: number;
  xpAwarded: number;
  score?: number;
  serverSignature?: string;
  completedAt: number;
}

export interface GameStats {
  gameId: GameId;
  played: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  currentStreak: number;
  bestStreak: number;
  totalDurationMs: number;
  bestScore: number | null;
}

export interface AggregateStats {
  totalPlayed: number;
  totalWins: number;
  totalLosses: number;
  totalDraws: number;
  overallWinRate: number;
  totalDurationMs: number;
  byGame: Record<GameId, GameStats>;
}

export interface UnlockedAchievement {
  schemaVersion: number;
  id: string;
  unlockedAt: number;
}

export interface AchievementDefinition {
  id: string;
  titleKey: string;
  descriptionKey: string;
  xpReward: number;
  category: 'milestone' | 'mastery' | 'explorer' | 'streak';
}

export interface DailyChallenge {
  schemaVersion: number;
  dateKey: string; // YYYY-MM-DD (UTC)
  gameId: GameId;
  targetMode: GameMode;
  objectiveType: 'win_match' | 'complete_match' | 'win_under_moves';
  targetValue: number;
  xpReward: number;
  completed: boolean;
  completedAt: number | null;
}

export interface SaveExportEnvelope {
  format: 'boardora-save';
  schemaVersion: number;
  exportedAt: number;
  profile: PlayerProfile;
  sessions: ActiveSession[];
  matches: MatchRecord[];
  achievements: UnlockedAchievement[];
  dailyChallenges: DailyChallenge[];
}
