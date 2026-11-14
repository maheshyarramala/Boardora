import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
  type DocumentData,
} from 'firebase/firestore';
import { calculateLevelFromXp } from '../core/progression';
import type {
  ActiveSession,
  DailyChallenge,
  MatchRecord,
  PlayerProfile,
  UnlockedAchievement,
} from '../core/types';
import type { BoardoraRepository } from '../storage/db';
import { CURRENT_SCHEMA_VERSION, migrateProfile } from '../storage/migrations';
import {
  OperationType,
  db,
  deleteFirebaseAuthAccount,
  handleFirestoreError,
} from './client';

export interface SyncDataset {
  profile: PlayerProfile;
  sessions: ActiveSession[];
  matches: MatchRecord[];
  achievements: UnlockedAchievement[];
  dailyChallenges: DailyChallenge[];
}

const VALID_ID_REGEX = /^[a-zA-Z0-9_\-]+$/;

function sanitizeDocId(raw: string, prefix: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_\-]/g, '-').slice(0, 120);
  if (cleaned.length > 0 && VALID_ID_REGEX.test(cleaned)) {
    return cleaned;
  }
  return `${prefix}-${Date.now()}`;
}

/**
 * Converts arbitrary engine JSON objects (including 2D matrices like Checkers/Peg Solitaire)
 * into native Firestore Maps & flat Lists without nested arrays or JSON.stringify.
 */
export function toFirestoreSafeValue(value: unknown): unknown {
  if (value === undefined) return null;
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }
  if (Array.isArray(value)) {
    const hasNestedArray = value.some((item) => Array.isArray(item));
    if (hasNestedArray) {
      return {
        __cpNestedList: true,
        rows: value.map((item) => ({
          cells: Array.isArray(item)
            ? item.map((sub) => toFirestoreSafeValue(sub))
            : [toFirestoreSafeValue(item)],
        })),
      };
    }
    return value.map((item) => toFirestoreSafeValue(item));
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) {
        out[k] = toFirestoreSafeValue(v);
      }
    }
    return out;
  }
  return String(value);
}

export function fromFirestoreSafeValue(value: unknown): unknown {
  if (
    value === null ||
    value === undefined ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => fromFirestoreSafeValue(item));
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (record.__cpNestedList === true && Array.isArray(record.rows)) {
      return record.rows.map((row) => {
        const rowObj = row as { cells?: unknown[] };
        return Array.isArray(rowObj.cells)
          ? rowObj.cells.map((cell) => fromFirestoreSafeValue(cell))
          : [];
      });
    }
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(record)) {
      out[k] = fromFirestoreSafeValue(v);
    }
    return out;
  }
  return value;
}

/**
 * Pure deterministic conflict resolver between offline IndexedDB state and cloud Firestore state.
 * - Keeps the higher XP total and recomputes level monotonically.
 * - Unions completed matches by matchId, achievements by id, and daily challenges by dateKey.
 * - Merges active sessions by sessionId, retaining higher actionCount / newer timestamp.
 */
export function mergeCloudAndLocalData(
  local: SyncDataset,
  cloud: Partial<SyncDataset> | null,
  uid: string
): SyncDataset {
  if (!cloud) {
    const xp = local.profile.xp;
    const { level } = calculateLevelFromXp(xp);
    return {
      ...local,
      profile: {
        ...local.profile,
        cloudUid: uid,
        authType: 'google',
        xp,
        level,
      },
    };
  }

  const cloudProfile = cloud.profile ? migrateProfile(cloud.profile) : null;
  const localNewer =
    !cloudProfile || local.profile.updatedAt >= cloudProfile.updatedAt;
  const preferredBase = localNewer ? local.profile : cloudProfile;
  const mergedXp = Math.max(local.profile.xp, cloudProfile?.xp ?? 0);
  const { level } = calculateLevelFromXp(mergedXp);

  const mergedProfile: PlayerProfile = {
    ...preferredBase,
    id: local.profile.id,
    cloudUid: uid,
    authType: 'google',
    schemaVersion: CURRENT_SCHEMA_VERSION,
    xp: mergedXp,
    level,
    privacyConsent: {
      analyticsEnabled:
        local.profile.privacyConsent.analyticsEnabled ||
        Boolean(cloudProfile?.privacyConsent.analyticsEnabled),
      cloudSyncEnabled:
        local.profile.privacyConsent.cloudSyncEnabled ||
        Boolean(cloudProfile?.privacyConsent.cloudSyncEnabled),
      consentUpdatedAt: Math.max(
        local.profile.privacyConsent.consentUpdatedAt,
        cloudProfile?.privacyConsent.consentUpdatedAt ?? 0
      ),
    },
    createdAt: Math.min(
      local.profile.createdAt,
      cloudProfile?.createdAt ?? local.profile.createdAt
    ),
    updatedAt: Math.max(
      local.profile.updatedAt,
      cloudProfile?.updatedAt ?? local.profile.updatedAt
    ),
  };

  // Matches: union by matchId
  const matchMap = new Map<string, MatchRecord>();
  for (const m of [...(cloud.matches ?? []), ...local.matches]) {
    if (!matchMap.has(m.matchId)) {
      matchMap.set(m.matchId, { ...m, schemaVersion: CURRENT_SCHEMA_VERSION });
    }
  }
  const matches = Array.from(matchMap.values()).sort(
    (a, b) => b.completedAt - a.completedAt
  );

  // Achievements: union keeping earliest unlock time
  const achMap = new Map<string, UnlockedAchievement>();
  for (const a of [...(cloud.achievements ?? []), ...local.achievements]) {
    const existing = achMap.get(a.id);
    if (!existing || a.unlockedAt < existing.unlockedAt) {
      achMap.set(a.id, { ...a, schemaVersion: CURRENT_SCHEMA_VERSION });
    }
  }
  const achievements = Array.from(achMap.values());

  // Daily Challenges: union by dateKey preserving completion
  const dailyMap = new Map<string, DailyChallenge>();
  for (const d of [...(cloud.dailyChallenges ?? []), ...local.dailyChallenges]) {
    const existing = dailyMap.get(d.dateKey);
    if (!existing) {
      dailyMap.set(d.dateKey, { ...d, schemaVersion: CURRENT_SCHEMA_VERSION });
    } else if (d.completed && !existing.completed) {
      dailyMap.set(d.dateKey, { ...d, schemaVersion: CURRENT_SCHEMA_VERSION });
    }
  }
  const dailyChallenges = Array.from(dailyMap.values());

  // Sessions: keep latest progress per sessionId
  const sessMap = new Map<string, ActiveSession>();
  for (const s of [...(cloud.sessions ?? []), ...local.sessions]) {
    const existing = sessMap.get(s.sessionId);
    if (
      !existing ||
      s.actionCount > existing.actionCount ||
      (s.actionCount === existing.actionCount && s.updatedAt > existing.updatedAt)
    ) {
      sessMap.set(s.sessionId, { ...s, schemaVersion: CURRENT_SCHEMA_VERSION });
    }
  }
  const sessions = Array.from(sessMap.values()).sort(
    (a, b) => b.updatedAt - a.updatedAt
  );

  return {
    profile: mergedProfile,
    sessions,
    matches,
    achievements,
    dailyChallenges,
  };
}

function buildProfilePayload(uid: string, profile: PlayerProfile, isCreate: boolean) {
  const safeName = profile.displayName.trim().slice(0, 32) || 'Player';
  const base: DocumentData = {
    uid,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    displayName: safeName,
    avatarId: profile.avatarId,
    authType: 'google',
    xp: Math.max(0, Math.floor(profile.xp)),
    level: Math.max(1, Math.floor(profile.level)),
    preferences: {
      soundEnabled: profile.preferences.soundEnabled,
      soundVolume: profile.preferences.soundVolume,
      sfxVolume: profile.preferences.sfxVolume,
      musicEnabled: profile.preferences.musicEnabled,
      musicVolume: profile.preferences.musicVolume,
      hapticsEnabled: profile.preferences.hapticsEnabled,
      theme: profile.preferences.theme,
      language: profile.preferences.language,
      accessibility: {
        highContrast: profile.preferences.accessibility.highContrast,
        colorblindSymbols: profile.preferences.accessibility.colorblindSymbols,
        largeText: profile.preferences.accessibility.largeText,
        reducedMotion: profile.preferences.accessibility.reducedMotion,
      },
    },
    privacyConsent: {
      analyticsEnabled: profile.privacyConsent.analyticsEnabled,
      cloudSyncEnabled: profile.privacyConsent.cloudSyncEnabled,
      consentUpdatedAt: Math.max(0, Math.floor(profile.privacyConsent.consentUpdatedAt)),
    },
    updatedAt: serverTimestamp(),
  };

  if (isCreate) {
    base.createdAt = serverTimestamp();
  }
  return base;
}

export async function pushProfileToCloud(
  uid: string,
  profile: PlayerProfile
): Promise<void> {
  const userPath = `users/${uid}`;
  const ref = doc(db, 'users', uid);
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, buildProfilePayload(uid, profile, true));
    } else {
      const payload = buildProfilePayload(uid, profile, false);
      delete payload.uid;
      delete payload.authType;
      delete payload.schemaVersion;
      await updateDoc(ref, payload);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }
}

export async function pushMatchToCloud(
  uid: string,
  match: MatchRecord
): Promise<void> {
  const matchId = sanitizeDocId(match.matchId, 'match');
  const path = `users/${uid}/matches/${matchId}`;
  const ref = doc(db, 'users', uid, 'matches', matchId);
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) return; // Immutable completed matches
    const payload: DocumentData = {
      ownerId: uid,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      matchId,
      gameId: match.gameId,
      mode: match.mode,
      outcome: match.outcome,
      opponentLabel: match.opponentLabel.slice(0, 64) || 'Opponent',
      movesCount: Math.max(0, Math.floor(match.movesCount)),
      durationMs: Math.max(0, Math.floor(match.durationMs)),
      xpAwarded: Math.max(0, Math.floor(match.xpAwarded)),
      completedAt: Math.max(0, Math.floor(match.completedAt)),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (match.difficulty) payload.difficulty = match.difficulty;
    if (typeof match.score === 'number' && Number.isFinite(match.score)) {
      payload.score = Math.floor(match.score);
    }
    if (match.serverSignature) {
      payload.serverSignature = match.serverSignature.slice(0, 128);
    }
    await setDoc(ref, payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function pushSessionToCloud(
  uid: string,
  session: ActiveSession
): Promise<void> {
  const sessionId = sanitizeDocId(session.sessionId, 'sess');
  const path = `users/${uid}/sessions/${sessionId}`;
  const ref = doc(db, 'users', uid, 'sessions', sessionId);
  try {
    let parsed: unknown = {};
    try {
      parsed = JSON.parse(session.serializedState);
    } catch {
      parsed = { raw: session.serializedState };
    }
    const stateMap = toFirestoreSafeValue(parsed) as Record<string, unknown>;
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        ownerId: uid,
        schemaVersion: CURRENT_SCHEMA_VERSION,
        sessionId,
        gameId: session.gameId,
        mode: session.mode,
        difficulty: session.difficulty,
        playerCount: Math.min(4, Math.max(1, Math.floor(session.playerCount))),
        seed: Math.max(0, Math.floor(session.seed)),
        stateMap,
        actionCount: Math.max(0, Math.floor(session.actionCount)),
        elapsedMs: Math.max(0, Math.floor(session.elapsedMs)),
        localUpdatedAt: Math.max(0, Math.floor(session.updatedAt)),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        stateMap,
        actionCount: Math.max(0, Math.floor(session.actionCount)),
        elapsedMs: Math.max(0, Math.floor(session.elapsedMs)),
        localUpdatedAt: Math.max(0, Math.floor(session.updatedAt)),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteSessionFromCloud(
  uid: string,
  sessionId: string
): Promise<void> {
  const safeId = sanitizeDocId(sessionId, 'sess');
  const path = `users/${uid}/sessions/${safeId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'sessions', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function pushAchievementToCloud(
  uid: string,
  ach: UnlockedAchievement
): Promise<void> {
  const achId = sanitizeDocId(ach.id, 'ach');
  const path = `users/${uid}/achievements/${achId}`;
  const ref = doc(db, 'users', uid, 'achievements', achId);
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) return;
    await setDoc(ref, {
      ownerId: uid,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      achievementId: achId,
      unlockedAt: Math.max(0, Math.floor(ach.unlockedAt)),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function pushDailyChallengeToCloud(
  uid: string,
  dc: DailyChallenge
): Promise<void> {
  const dateKey = sanitizeDocId(dc.dateKey, '2026-01-01');
  const path = `users/${uid}/dailyChallenges/${dateKey}`;
  const ref = doc(db, 'users', uid, 'dailyChallenges', dateKey);
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        ownerId: uid,
        schemaVersion: CURRENT_SCHEMA_VERSION,
        dateKey,
        gameId: dc.gameId,
        targetMode: dc.targetMode,
        objectiveType: dc.objectiveType,
        targetValue: Math.max(1, Math.floor(dc.targetValue)),
        xpReward: Math.max(0, Math.floor(dc.xpReward)),
        completed: Boolean(dc.completed),
        completedAt:
          typeof dc.completedAt === 'number' ? Math.floor(dc.completedAt) : null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else if (dc.completed && snap.data()?.completed === false) {
      await updateDoc(ref, {
        completed: true,
        completedAt:
          typeof dc.completedAt === 'number'
            ? Math.floor(dc.completedAt)
            : Date.now(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function syncLocalAndCloud(
  uid: string,
  repo: BoardoraRepository
): Promise<SyncDataset> {
  const [localProfile, localSessions, localMatches, localAchs, localDailies] =
    await Promise.all([
      repo.getOrCreateProfile(),
      repo.listSessions(),
      repo.listMatches(),
      repo.listAchievements(),
      repo.listDailyChallenges(),
    ]);

  let cloudProfile: PlayerProfile | null = null;
  const cloudMatches: MatchRecord[] = [];
  const cloudSessions: ActiveSession[] = [];
  const cloudAchs: UnlockedAchievement[] = [];
  const cloudDailies: DailyChallenge[] = [];

  try {
    const profileSnap = await getDoc(doc(db, 'users', uid));
    if (profileSnap.exists()) {
      cloudProfile = migrateProfile(profileSnap.data());
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `users/${uid}`);
  }

  try {
    const matchesSnap = await getDocs(collection(db, 'users', uid, 'matches'));
    matchesSnap.forEach((d) => {
      const data = d.data();
      cloudMatches.push({
        schemaVersion: CURRENT_SCHEMA_VERSION,
        matchId: String(data.matchId ?? d.id),
        gameId: data.gameId,
        mode: data.mode,
        ...(data.difficulty ? { difficulty: data.difficulty } : {}),
        outcome: data.outcome,
        opponentLabel: String(data.opponentLabel ?? 'Opponent'),
        movesCount: Number(data.movesCount ?? 0),
        durationMs: Number(data.durationMs ?? 0),
        xpAwarded: Number(data.xpAwarded ?? 0),
        ...(typeof data.score === 'number' ? { score: data.score } : {}),
        ...(typeof data.serverSignature === 'string'
          ? { serverSignature: data.serverSignature }
          : {}),
        completedAt: Number(data.completedAt ?? Date.now()),
      });
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, `users/${uid}/matches`);
  }

  try {
    const sessSnap = await getDocs(collection(db, 'users', uid, 'sessions'));
    sessSnap.forEach((d) => {
      const data = d.data();
      const restored = fromFirestoreSafeValue(data.stateMap ?? {});
      cloudSessions.push({
        schemaVersion: CURRENT_SCHEMA_VERSION,
        sessionId: String(data.sessionId ?? d.id),
        gameId: data.gameId,
        mode: data.mode,
        difficulty: data.difficulty,
        playerCount: Number(data.playerCount ?? 2),
        seed: Number(data.seed ?? 1),
        serializedState: JSON.stringify(restored),
        actionCount: Number(data.actionCount ?? 0),
        elapsedMs: Number(data.elapsedMs ?? 0),
        createdAt: Number(data.localUpdatedAt ?? Date.now()),
        updatedAt: Number(data.localUpdatedAt ?? Date.now()),
      });
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, `users/${uid}/sessions`);
  }

  try {
    const achSnap = await getDocs(collection(db, 'users', uid, 'achievements'));
    achSnap.forEach((d) => {
      const data = d.data();
      cloudAchs.push({
        schemaVersion: CURRENT_SCHEMA_VERSION,
        id: String(data.achievementId ?? d.id),
        unlockedAt: Number(data.unlockedAt ?? Date.now()),
      });
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, `users/${uid}/achievements`);
  }

  try {
    const dailySnap = await getDocs(collection(db, 'users', uid, 'dailyChallenges'));
    dailySnap.forEach((d) => {
      const data = d.data();
      cloudDailies.push({
        schemaVersion: CURRENT_SCHEMA_VERSION,
        dateKey: String(data.dateKey ?? d.id),
        gameId: data.gameId,
        targetMode: data.targetMode,
        objectiveType: data.objectiveType,
        targetValue: Number(data.targetValue ?? 1),
        xpReward: Number(data.xpReward ?? 200),
        completed: Boolean(data.completed),
        completedAt:
          typeof data.completedAt === 'number' ? data.completedAt : null,
      });
    });
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.LIST,
      `users/${uid}/dailyChallenges`
    );
  }

  const merged = mergeCloudAndLocalData(
    {
      profile: localProfile,
      sessions: localSessions,
      matches: localMatches,
      achievements: localAchs,
      dailyChallenges: localDailies,
    },
    cloudProfile
      ? {
          profile: cloudProfile,
          sessions: cloudSessions,
          matches: cloudMatches,
          achievements: cloudAchs,
          dailyChallenges: cloudDailies,
        }
      : null,
    uid
  );

  // Persist merged state into IndexedDB
  await repo.importMergedSnapshot(merged);

  // Push missing/updated items to Firestore
  await pushProfileToCloud(uid, merged.profile);
  await Promise.all([
    ...merged.matches.map((m) => pushMatchToCloud(uid, m)),
    ...merged.sessions.map((s) => pushSessionToCloud(uid, s)),
    ...merged.achievements.map((a) => pushAchievementToCloud(uid, a)),
    ...merged.dailyChallenges.map((d) => pushDailyChallengeToCloud(uid, d)),
  ]);

  return merged;
}

export async function deleteAllCloudAccountData(uid: string): Promise<{
  authDeleted: boolean;
  requiresRecentLogin: boolean;
}> {
  const subcollections = [
    'matches',
    'sessions',
    'achievements',
    'dailyChallenges',
  ] as const;

  for (const sub of subcollections) {
    const colPath = `users/${uid}/${sub}`;
    try {
      const snap = await getDocs(collection(db, 'users', uid, sub));
      await Promise.all(
        snap.docs.map(async (d) => {
          try {
            await deleteDoc(d.ref);
          } catch (err) {
            handleFirestoreError(err, OperationType.DELETE, `${colPath}/${d.id}`);
          }
        })
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, colPath);
    }
  }

  try {
    await deleteDoc(doc(db, 'users', uid));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `users/${uid}`);
  }

  return deleteFirebaseAuthAccount();
}
