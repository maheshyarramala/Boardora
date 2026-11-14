import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import {
  ACHIEVEMENT_DEFINITIONS,
  evaluateNewlyUnlockedAchievements,
} from '../core/achievements';
import {
  doesMatchCompleteDailyChallenge,
  generateDailyChallenge,
  getUtcDateKey,
} from '../core/dailyChallenges';
import { calculateLevelFromXp } from '../core/progression';
import type {
  ActiveSession,
  DailyChallenge,
  GameId,
  MatchRecord,
  PlayerProfile,
  SaveExportEnvelope,
  UnlockedAchievement,
} from '../core/types';
import {
  CURRENT_SCHEMA_VERSION,
  createDefaultGuestProfile,
  migrateProfile,
  migrateSaveEnvelope,
} from './migrations';

interface BoardoraDBSchema extends DBSchema {
  profiles: {
    key: string;
    value: PlayerProfile;
  };
  sessions: {
    key: string;
    value: ActiveSession;
    indexes: { 'by-game': GameId; 'by-updated': number };
  };
  matches: {
    key: string;
    value: MatchRecord;
    indexes: { 'by-game': GameId; 'by-completed': number };
  };
  achievements: {
    key: string;
    value: UnlockedAchievement;
  };
  dailyChallenges: {
    key: string;
    value: DailyChallenge;
  };
  meta: {
    key: string;
    value: { key: string; value: string | number };
  };
}

const DB_NAME = 'boardora_10in1_db';

export interface StorageBackend {
  getProfile(id: string): Promise<PlayerProfile | undefined>;
  putProfile(profile: PlayerProfile): Promise<void>;
  listSessions(): Promise<ActiveSession[]>;
  putSession(session: ActiveSession): Promise<void>;
  deleteSession(sessionId: string): Promise<void>;
  listMatches(): Promise<MatchRecord[]>;
  putMatch(match: MatchRecord): Promise<void>;
  listAchievements(): Promise<UnlockedAchievement[]>;
  putAchievement(achievement: UnlockedAchievement): Promise<void>;
  getDailyChallenge(dateKey: string): Promise<DailyChallenge | undefined>;
  putDailyChallenge(challenge: DailyChallenge): Promise<void>;
  listDailyChallenges(): Promise<DailyChallenge[]>;
  clearAll(): Promise<void>;
}

export function createMemoryStorageBackend(): StorageBackend {
  const profiles = new Map<string, PlayerProfile>();
  const sessions = new Map<string, ActiveSession>();
  const matches = new Map<string, MatchRecord>();
  const achievements = new Map<string, UnlockedAchievement>();
  const dailyChallenges = new Map<string, DailyChallenge>();

  return {
    async getProfile(id) {
      return profiles.get(id);
    },
    async putProfile(profile) {
      profiles.set(profile.id, profile);
    },
    async listSessions() {
      return Array.from(sessions.values()).sort((a, b) => b.updatedAt - a.updatedAt);
    },
    async putSession(session) {
      sessions.set(session.sessionId, session);
    },
    async deleteSession(sessionId) {
      sessions.delete(sessionId);
    },
    async listMatches() {
      return Array.from(matches.values()).sort((a, b) => b.completedAt - a.completedAt);
    },
    async putMatch(match) {
      matches.set(match.matchId, match);
    },
    async listAchievements() {
      return Array.from(achievements.values());
    },
    async putAchievement(achievement) {
      achievements.set(achievement.id, achievement);
    },
    async getDailyChallenge(dateKey) {
      return dailyChallenges.get(dateKey);
    },
    async putDailyChallenge(challenge) {
      dailyChallenges.set(challenge.dateKey, challenge);
    },
    async listDailyChallenges() {
      return Array.from(dailyChallenges.values());
    },
    async clearAll() {
      profiles.clear();
      sessions.clear();
      matches.clear();
      achievements.clear();
      dailyChallenges.clear();
    },
  };
}

let dbPromise: Promise<IDBPDatabase<BoardoraDBSchema>> | null = null;

function getIndexedDb(): Promise<IDBPDatabase<BoardoraDBSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<BoardoraDBSchema>(DB_NAME, CURRENT_SCHEMA_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('profiles')) {
          db.createObjectStore('profiles', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('sessions')) {
          const sessionStore = db.createObjectStore('sessions', {
            keyPath: 'sessionId',
          });
          sessionStore.createIndex('by-game', 'gameId');
          sessionStore.createIndex('by-updated', 'updatedAt');
        }
        if (!db.objectStoreNames.contains('matches')) {
          const matchStore = db.createObjectStore('matches', {
            keyPath: 'matchId',
          });
          matchStore.createIndex('by-game', 'gameId');
          matchStore.createIndex('by-completed', 'completedAt');
        }
        if (!db.objectStoreNames.contains('achievements')) {
          db.createObjectStore('achievements', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('dailyChallenges')) {
          db.createObjectStore('dailyChallenges', { keyPath: 'dateKey' });
        }
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'key' });
        }
      },
    });
  }
  return dbPromise;
}

export function createIndexedDbStorageBackend(): StorageBackend {
  return {
    async getProfile(id) {
      const db = await getIndexedDb();
      return db.get('profiles', id);
    },
    async putProfile(profile) {
      const db = await getIndexedDb();
      await db.put('profiles', profile);
    },
    async listSessions() {
      const db = await getIndexedDb();
      const all = await db.getAll('sessions');
      return all.sort((a, b) => b.updatedAt - a.updatedAt);
    },
    async putSession(session) {
      const db = await getIndexedDb();
      await db.put('sessions', session);
    },
    async deleteSession(sessionId) {
      const db = await getIndexedDb();
      await db.delete('sessions', sessionId);
    },
    async listMatches() {
      const db = await getIndexedDb();
      const all = await db.getAll('matches');
      return all.sort((a, b) => b.completedAt - a.completedAt);
    },
    async putMatch(match) {
      const db = await getIndexedDb();
      await db.put('matches', match);
    },
    async listAchievements() {
      const db = await getIndexedDb();
      return db.getAll('achievements');
    },
    async putAchievement(achievement) {
      const db = await getIndexedDb();
      await db.put('achievements', achievement);
    },
    async getDailyChallenge(dateKey) {
      const db = await getIndexedDb();
      return db.get('dailyChallenges', dateKey);
    },
    async putDailyChallenge(challenge) {
      const db = await getIndexedDb();
      await db.put('dailyChallenges', challenge);
    },
    async listDailyChallenges() {
      const db = await getIndexedDb();
      return db.getAll('dailyChallenges');
    },
    async clearAll() {
      const db = await getIndexedDb();
      const tx = db.transaction(
        ['profiles', 'sessions', 'matches', 'achievements', 'dailyChallenges', 'meta'],
        'readwrite'
      );
      await Promise.all([
        tx.objectStore('profiles').clear(),
        tx.objectStore('sessions').clear(),
        tx.objectStore('matches').clear(),
        tx.objectStore('achievements').clear(),
        tx.objectStore('dailyChallenges').clear(),
        tx.objectStore('meta').clear(),
        tx.done,
      ]);
    },
  };
}

export class BoardoraRepository {
  private readonly backend: StorageBackend;

  constructor(backend?: StorageBackend) {
    if (backend) {
      this.backend = backend;
    } else if (typeof indexedDB !== 'undefined') {
      this.backend = createIndexedDbStorageBackend();
    } else {
      this.backend = createMemoryStorageBackend();
    }
  }

  async getOrCreateProfile(): Promise<PlayerProfile> {
    const existing = await this.backend.getProfile('guest-local');
    if (existing) {
      const migrated = migrateProfile(existing);
      if (migrated.schemaVersion !== existing.schemaVersion) {
        await this.backend.putProfile(migrated);
      }
      return migrated;
    }
    const created = createDefaultGuestProfile();
    await this.backend.putProfile(created);
    return created;
  }

  async saveProfile(profile: PlayerProfile): Promise<PlayerProfile> {
    const updated: PlayerProfile = {
      ...migrateProfile(profile),
      updatedAt: Date.now(),
    };
    await this.backend.putProfile(updated);
    return updated;
  }

  async listSessions(): Promise<ActiveSession[]> {
    return this.backend.listSessions();
  }

  async upsertSession(session: ActiveSession): Promise<void> {
    await this.backend.putSession({
      ...session,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      updatedAt: Date.now(),
    });
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.backend.deleteSession(sessionId);
  }

  async listMatches(): Promise<MatchRecord[]> {
    return this.backend.listMatches();
  }

  async listAchievements(): Promise<UnlockedAchievement[]> {
    return this.backend.listAchievements();
  }

  async listDailyChallenges(): Promise<DailyChallenge[]> {
    return this.backend.listDailyChallenges();
  }

  async importMergedSnapshot(snapshot: {
    profile: PlayerProfile;
    sessions: ActiveSession[];
    matches: MatchRecord[];
    achievements: UnlockedAchievement[];
    dailyChallenges: DailyChallenge[];
  }): Promise<void> {
    await this.backend.clearAll();
    await this.backend.putProfile(migrateProfile(snapshot.profile));
    for (const session of snapshot.sessions) {
      await this.backend.putSession({
        ...session,
        schemaVersion: CURRENT_SCHEMA_VERSION,
      });
    }
    for (const match of snapshot.matches) {
      await this.backend.putMatch({
        ...match,
        schemaVersion: CURRENT_SCHEMA_VERSION,
      });
    }
    for (const ach of snapshot.achievements) {
      await this.backend.putAchievement({
        ...ach,
        schemaVersion: CURRENT_SCHEMA_VERSION,
      });
    }
    for (const dc of snapshot.dailyChallenges) {
      await this.backend.putDailyChallenge({
        ...dc,
        schemaVersion: CURRENT_SCHEMA_VERSION,
      });
    }
  }

  async getOrCreateDailyChallenge(dateKey = getUtcDateKey()): Promise<DailyChallenge> {
    const existing = await this.backend.getDailyChallenge(dateKey);
    if (existing) return existing;
    const generated = generateDailyChallenge(dateKey);
    await this.backend.putDailyChallenge(generated);
    return generated;
  }

  async recordCompletedMatch(
    match: MatchRecord,
    sessionIdToClear?: string
  ): Promise<{
    profile: PlayerProfile;
    newlyUnlockedAchievements: UnlockedAchievement[];
    completedDailyChallenge: DailyChallenge | null;
  }> {
    const normalizedMatch: MatchRecord = {
      ...match,
      schemaVersion: CURRENT_SCHEMA_VERSION,
    };
    await this.backend.putMatch(normalizedMatch);
    if (sessionIdToClear) {
      await this.backend.deleteSession(sessionIdToClear);
    }

    const [profile, allMatches, existingAchievements, daily] = await Promise.all([
      this.getOrCreateProfile(),
      this.backend.listMatches(),
      this.backend.listAchievements(),
      this.getOrCreateDailyChallenge(getUtcDateKey(new Date(match.completedAt))),
    ]);

    const newlyUnlocked = evaluateNewlyUnlockedAchievements(
      allMatches,
      existingAchievements,
      match.completedAt
    );

    let bonusXp = 0;
    for (const ach of newlyUnlocked) {
      await this.backend.putAchievement(ach);
      const def = ACHIEVEMENT_DEFINITIONS.find((d) => d.id === ach.id);
      if (def) bonusXp += def.xpReward;
    }

    let completedDailyChallenge: DailyChallenge | null = null;
    if (doesMatchCompleteDailyChallenge(daily, normalizedMatch)) {
      completedDailyChallenge = {
        ...daily,
        completed: true,
        completedAt: match.completedAt,
      };
      await this.backend.putDailyChallenge(completedDailyChallenge);
      bonusXp += daily.xpReward;
    }

    const nextXp = profile.xp + normalizedMatch.xpAwarded + bonusXp;
    const { level } = calculateLevelFromXp(nextXp);
    const updatedProfile: PlayerProfile = {
      ...profile,
      xp: nextXp,
      level,
      updatedAt: Date.now(),
    };
    await this.backend.putProfile(updatedProfile);

    return {
      profile: updatedProfile,
      newlyUnlockedAchievements: newlyUnlocked,
      completedDailyChallenge,
    };
  }

  async exportSaveData(): Promise<SaveExportEnvelope> {
    const [profile, sessions, matches, achievements, dailyChallenges] =
      await Promise.all([
        this.getOrCreateProfile(),
        this.backend.listSessions(),
        this.backend.listMatches(),
        this.backend.listAchievements(),
        this.backend.listDailyChallenges(),
      ]);

    return {
      format: 'boardora-save',
      schemaVersion: CURRENT_SCHEMA_VERSION,
      exportedAt: Date.now(),
      profile,
      sessions,
      matches,
      achievements,
      dailyChallenges,
    };
  }

  async importSaveData(rawJson: string): Promise<SaveExportEnvelope> {
    const parsed: unknown = JSON.parse(rawJson);
    const envelope = migrateSaveEnvelope(parsed);
    await this.backend.clearAll();
    await this.backend.putProfile(envelope.profile);
    for (const session of envelope.sessions) {
      await this.backend.putSession(session);
    }
    for (const match of envelope.matches) {
      await this.backend.putMatch(match);
    }
    for (const ach of envelope.achievements) {
      await this.backend.putAchievement(ach);
    }
    for (const dc of envelope.dailyChallenges) {
      await this.backend.putDailyChallenge(dc);
    }
    return envelope;
  }

  async clearAllLocalData(): Promise<PlayerProfile> {
    await this.backend.clearAll();
    return this.getOrCreateProfile();
  }
}

export const defaultRepository = new BoardoraRepository();
