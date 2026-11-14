import { calculateLevelFromXp } from '../core/progression';
import type {
  AccessibilityOptions,
  ActiveSession,
  AvatarId,
  DailyChallenge,
  LanguageCode,
  MatchRecord,
  PlayerPreferences,
  PlayerProfile,
  PrivacyConsent,
  SaveExportEnvelope,
  ThemeId,
  UnlockedAchievement,
} from '../core/types';

export const CURRENT_SCHEMA_VERSION = 2;

const VALID_THEMES: readonly ThemeId[] = ['navy-gold', 'marble-light', 'emerald-felt'];
const VALID_LANGUAGES: readonly LanguageCode[] = ['en', 'es', 'fr', 'hi'];
const VALID_AVATARS: readonly AvatarId[] = [
  'royal-knight',
  'golden-crown',
  'compass-rose',
  'emerald-dice',
  'ruby-rook',
  'sapphire-wheel',
];

export function createDefaultAccessibility(): AccessibilityOptions {
  return {
    highContrast: false,
    colorblindSymbols: false,
    largeText: false,
    reducedMotion: false,
  };
}

export function createDefaultPreferences(): PlayerPreferences {
  return {
    soundEnabled: true,
    soundVolume: 0.75,
    sfxVolume: 0.85,
    musicEnabled: false,
    musicVolume: 0.35,
    hapticsEnabled: true,
    theme: 'navy-gold',
    language: 'en',
    accessibility: createDefaultAccessibility(),
  };
}

export function createDefaultPrivacyConsent(now = Date.now()): PrivacyConsent {
  return {
    analyticsEnabled: false,
    cloudSyncEnabled: false,
    consentUpdatedAt: now,
  };
}

export function createDefaultGuestProfile(now = Date.now()): PlayerProfile {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id: 'guest-local',
    displayName: 'Guest Player',
    avatarId: 'royal-knight',
    authType: 'guest',
    xp: 0,
    level: 1,
    preferences: createDefaultPreferences(),
    privacyConsent: createDefaultPrivacyConsent(now),
    createdAt: now,
    updatedAt: now,
  };
}

function clampUnit(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.min(1, Math.max(0, value));
  }
  return fallback;
}

export function migrateProfile(raw: unknown, now = Date.now()): PlayerProfile {
  const defaults = createDefaultGuestProfile(now);
  if (!raw || typeof raw !== 'object') {
    return defaults;
  }
  const obj = raw as Record<string, unknown>;
  const rawPrefs = (obj.preferences && typeof obj.preferences === 'object'
    ? obj.preferences
    : {}) as Record<string, unknown>;
  const rawAccess = (rawPrefs.accessibility && typeof rawPrefs.accessibility === 'object'
    ? rawPrefs.accessibility
    : {}) as Record<string, unknown>;
  const rawPrivacy = (obj.privacyConsent && typeof obj.privacyConsent === 'object'
    ? obj.privacyConsent
    : {}) as Record<string, unknown>;

  const xp = typeof obj.xp === 'number' && Number.isFinite(obj.xp) ? Math.max(0, Math.floor(obj.xp)) : 0;
  const { level } = calculateLevelFromXp(xp);

  const theme = VALID_THEMES.includes(rawPrefs.theme as ThemeId)
    ? (rawPrefs.theme as ThemeId)
    : defaults.preferences.theme;
  const language = VALID_LANGUAGES.includes(rawPrefs.language as LanguageCode)
    ? (rawPrefs.language as LanguageCode)
    : defaults.preferences.language;
  const avatarId = VALID_AVATARS.includes(obj.avatarId as AvatarId)
    ? (obj.avatarId as AvatarId)
    : defaults.avatarId;

  const displayName =
    typeof obj.displayName === 'string' && obj.displayName.trim().length > 0
      ? obj.displayName.trim().slice(0, 32)
      : defaults.displayName;

  const soundVolume = clampUnit(rawPrefs.soundVolume, defaults.preferences.soundVolume);
  const sfxVolume = clampUnit(rawPrefs.sfxVolume, defaults.preferences.sfxVolume);
  const musicVolume = clampUnit(rawPrefs.musicVolume, defaults.preferences.musicVolume);
  const cloudUid =
    typeof obj.cloudUid === 'string' && obj.cloudUid.trim().length > 0
      ? obj.cloudUid.trim()
      : undefined;

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id: typeof obj.id === 'string' && obj.id.length > 0 ? obj.id : defaults.id,
    ...(cloudUid ? { cloudUid } : {}),
    displayName,
    avatarId,
    authType: obj.authType === 'google' ? 'google' : 'guest',
    xp,
    level,
    preferences: {
      soundEnabled:
        typeof rawPrefs.soundEnabled === 'boolean'
          ? rawPrefs.soundEnabled
          : defaults.preferences.soundEnabled,
      soundVolume,
      sfxVolume,
      musicEnabled:
        typeof rawPrefs.musicEnabled === 'boolean'
          ? rawPrefs.musicEnabled
          : defaults.preferences.musicEnabled,
      musicVolume,
      hapticsEnabled:
        typeof rawPrefs.hapticsEnabled === 'boolean'
          ? rawPrefs.hapticsEnabled
          : defaults.preferences.hapticsEnabled,
      theme,
      language,
      accessibility: {
        highContrast: Boolean(rawAccess.highContrast),
        colorblindSymbols: Boolean(rawAccess.colorblindSymbols),
        largeText: Boolean(rawAccess.largeText),
        reducedMotion: Boolean(rawAccess.reducedMotion),
      },
    },
    privacyConsent: {
      analyticsEnabled: Boolean(rawPrivacy.analyticsEnabled),
      cloudSyncEnabled: Boolean(rawPrivacy.cloudSyncEnabled),
      consentUpdatedAt:
        typeof rawPrivacy.consentUpdatedAt === 'number'
          ? rawPrivacy.consentUpdatedAt
          : defaults.privacyConsent.consentUpdatedAt,
    },
    createdAt: typeof obj.createdAt === 'number' ? obj.createdAt : defaults.createdAt,
    updatedAt: typeof obj.updatedAt === 'number' ? obj.updatedAt : now,
  };
}

export function migrateSaveEnvelope(raw: unknown, now = Date.now()): SaveExportEnvelope {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid save file: expected JSON object.');
  }
  const obj = raw as Record<string, unknown>;
  if (obj.format !== 'boardora-save' && obj.format !== 'classicplay-save') {
    throw new Error('Unsupported save format identifier.');
  }
  const version = typeof obj.schemaVersion === 'number' ? obj.schemaVersion : 0;
  if (version > CURRENT_SCHEMA_VERSION) {
    throw new Error(
      `Save schema version ${version} is newer than supported version ${CURRENT_SCHEMA_VERSION}.`
    );
  }

  const profile = migrateProfile(obj.profile, now);

  const sessions: ActiveSession[] = Array.isArray(obj.sessions)
    ? obj.sessions
        .filter((s): s is ActiveSession => Boolean(s && typeof s === 'object' && 'sessionId' in s && 'gameId' in s))
        .map((s) => ({ ...s, schemaVersion: CURRENT_SCHEMA_VERSION }))
    : [];

  const matches: MatchRecord[] = Array.isArray(obj.matches)
    ? obj.matches
        .filter((m): m is MatchRecord => Boolean(m && typeof m === 'object' && 'matchId' in m && 'gameId' in m))
        .map((m) => ({ ...m, schemaVersion: CURRENT_SCHEMA_VERSION }))
    : [];

  const achievements: UnlockedAchievement[] = Array.isArray(obj.achievements)
    ? obj.achievements
        .filter((a): a is UnlockedAchievement => Boolean(a && typeof a === 'object' && 'id' in a))
        .map((a) => ({ ...a, schemaVersion: CURRENT_SCHEMA_VERSION }))
    : [];

  const dailyChallenges: DailyChallenge[] = Array.isArray(obj.dailyChallenges)
    ? obj.dailyChallenges
        .filter((d): d is DailyChallenge => Boolean(d && typeof d === 'object' && 'dateKey' in d && 'gameId' in d))
        .map((d) => ({ ...d, schemaVersion: CURRENT_SCHEMA_VERSION }))
    : [];

  return {
    format: 'boardora-save',
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportedAt: typeof obj.exportedAt === 'number' ? obj.exportedAt : now,
    profile,
    sessions,
    matches,
    achievements,
    dailyChallenges,
  };
}
