import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { calculateLevelFromXp, computeAggregateStats } from '../core/progression';
import type {
  ActiveSession,
  AggregateStats,
  AvatarId,
  DailyChallenge,
  MatchRecord,
  PlayerPreferences,
  PlayerProfile,
  PrivacyConsent,
  UnlockedAchievement,
} from '../core/types';
import {
  signInWithGooglePopup,
  signOutFirebase,
  subscribeFirebaseAuth,
} from '../firebase/client';
import {
  deleteAllCloudAccountData,
  pushProfileToCloud,
  syncLocalAndCloud,
} from '../firebase/cloudSync';
import { translate, type TranslationKey } from '../i18n/translations';
import { audioEngine } from '../platform/audio';
import { hapticsBridge } from '../platform/haptics';
import { defaultRepository } from '../storage/db';

export interface CloudUserInfo {
  uid: string;
  displayName: string | null;
  email: string | null;
  emailVerified: boolean;
}

export type CloudSyncStatus = 'offline' | 'syncing' | 'synced' | 'error';

interface AppStateContextValue {
  ready: boolean;
  authReady: boolean;
  cloudUser: CloudUserInfo | null;
  cloudSyncStatus: CloudSyncStatus;
  cloudSyncError: string | null;
  lastSyncedAt: number | null;
  profile: PlayerProfile | null;
  sessions: ActiveSession[];
  matches: MatchRecord[];
  achievements: UnlockedAchievement[];
  dailyChallenge: DailyChallenge | null;
  stats: AggregateStats;
  levelInfo: ReturnType<typeof calculateLevelFromXp>;
  t: (key: TranslationKey) => string;
  updateDisplayName: (name: string) => Promise<void>;
  updateAvatar: (avatarId: AvatarId) => Promise<void>;
  updatePreferences: (patch: Partial<PlayerPreferences>) => Promise<void>;
  updatePrivacyConsent: (patch: Partial<PrivacyConsent>) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  exportSaveJson: () => Promise<string>;
  importSaveJson: (rawJson: string) => Promise<void>;
  resetLocalData: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOutCloud: () => Promise<void>;
  syncCloudNow: () => Promise<void>;
  deleteCloudAccount: () => Promise<{ requiresRecentLogin: boolean }>;
  refreshAll: () => Promise<void>;
}

const AppStateContext = createContext<AppStateContextValue | null>(null);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [cloudUser, setCloudUser] = useState<CloudUserInfo | null>(null);
  const [cloudSyncStatus, setCloudSyncStatus] = useState<CloudSyncStatus>('offline');
  const [cloudSyncError, setCloudSyncError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);

  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [matches, setMatches] = useState<MatchRecord[]>([]);
  const [achievements, setAchievements] = useState<UnlockedAchievement[]>([]);
  const [dailyChallenge, setDailyChallenge] = useState<DailyChallenge | null>(null);

  const refreshAll = useCallback(async () => {
    const [loadedProfile, loadedSessions, loadedMatches, loadedAchievements, loadedDaily] =
      await Promise.all([
        defaultRepository.getOrCreateProfile(),
        defaultRepository.listSessions(),
        defaultRepository.listMatches(),
        defaultRepository.listAchievements(),
        defaultRepository.getOrCreateDailyChallenge(),
      ]);

    setProfile(loadedProfile);
    setSessions(loadedSessions);
    setMatches(loadedMatches);
    setAchievements(loadedAchievements);
    setDailyChallenge(loadedDaily);
    setReady(true);
  }, []);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  const performCloudSync = useCallback(
    async (uid: string) => {
      setCloudSyncStatus('syncing');
      setCloudSyncError(null);
      try {
        await syncLocalAndCloud(uid, defaultRepository);
        await refreshAll();
        setCloudSyncStatus('synced');
        setLastSyncedAt(Date.now());
      } catch (err) {
        setCloudSyncStatus('error');
        setCloudSyncError(
          err instanceof Error ? err.message : 'Cloud sync encountered an error.'
        );
      }
    },
    [refreshAll]
  );

  // Subscribe to Firebase Auth state changes
  useEffect(() => {
    const unsub = subscribeFirebaseAuth((fbUser) => {
      if (fbUser) {
        setCloudUser({
          uid: fbUser.uid,
          displayName: fbUser.displayName,
          email: fbUser.email,
          emailVerified: fbUser.emailVerified,
        });
      } else {
        setCloudUser(null);
        setCloudSyncStatus('offline');
      }
      setAuthReady(true);
    });
    return unsub;
  }, []);

  // Automatically sync when authenticated and local data is ready
  useEffect(() => {
    if (!ready || !cloudUser) return;
    if (!profile?.privacyConsent.cloudSyncEnabled && profile?.authType !== 'google') {
      return;
    }
    void performCloudSync(cloudUser.uid);
    // Intentionally sync on user login / ready boundary
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, cloudUser?.uid]);

  // Sync theme, accessibility attributes, audio, and haptics whenever profile changes
  useEffect(() => {
    if (!profile) return;
    const { preferences } = profile;
    const root = document.documentElement;
    root.setAttribute('data-theme', preferences.theme);
    root.setAttribute(
      'data-high-contrast',
      String(preferences.accessibility.highContrast)
    );
    root.setAttribute(
      'data-large-text',
      String(preferences.accessibility.largeText)
    );
    root.setAttribute(
      'data-reduced-motion',
      String(preferences.accessibility.reducedMotion)
    );
    root.setAttribute('lang', preferences.language);

    if (preferences.theme === 'marble-light') {
      root.classList.remove('dark');
    } else {
      root.classList.add('dark');
    }

    audioEngine.configure({
      soundEnabled: preferences.soundEnabled,
      soundVolume: preferences.soundVolume,
      sfxVolume: preferences.sfxVolume,
      musicEnabled: preferences.musicEnabled,
      musicVolume: preferences.musicVolume,
    });
    hapticsBridge.configure(preferences.hapticsEnabled);
  }, [profile]);

  const maybePushProfile = useCallback(
    async (saved: PlayerProfile) => {
      if (cloudUser && saved.privacyConsent.cloudSyncEnabled) {
        try {
          await pushProfileToCloud(cloudUser.uid, saved);
          setLastSyncedAt(Date.now());
          setCloudSyncStatus('synced');
        } catch (err) {
          setCloudSyncStatus('error');
          setCloudSyncError(
            err instanceof Error ? err.message : 'Unable to sync profile.'
          );
        }
      }
    },
    [cloudUser]
  );

  const updateDisplayName = useCallback(
    async (name: string) => {
      if (!profile) return;
      const trimmed = name.trim().slice(0, 32);
      if (!trimmed) return;
      const saved = await defaultRepository.saveProfile({
        ...profile,
        displayName: trimmed,
      });
      setProfile(saved);
      void maybePushProfile(saved);
    },
    [profile, maybePushProfile]
  );

  const updateAvatar = useCallback(
    async (avatarId: AvatarId) => {
      if (!profile) return;
      const saved = await defaultRepository.saveProfile({
        ...profile,
        avatarId,
      });
      setProfile(saved);
      void maybePushProfile(saved);
    },
    [profile, maybePushProfile]
  );

  const updatePreferences = useCallback(
    async (patch: Partial<PlayerPreferences>) => {
      if (!profile) return;
      const saved = await defaultRepository.saveProfile({
        ...profile,
        preferences: {
          ...profile.preferences,
          ...patch,
          accessibility: {
            ...profile.preferences.accessibility,
            ...(patch.accessibility ?? {}),
          },
        },
      });
      setProfile(saved);
      void maybePushProfile(saved);
    },
    [profile, maybePushProfile]
  );

  const updatePrivacyConsent = useCallback(
    async (patch: Partial<PrivacyConsent>) => {
      if (!profile) return;
      const saved = await defaultRepository.saveProfile({
        ...profile,
        privacyConsent: {
          ...profile.privacyConsent,
          ...patch,
          consentUpdatedAt: Date.now(),
        },
      });
      setProfile(saved);
      if (cloudUser && saved.privacyConsent.cloudSyncEnabled) {
        void performCloudSync(cloudUser.uid);
      }
    },
    [profile, cloudUser, performCloudSync]
  );

  const deleteSession = useCallback(async (sessionId: string) => {
    await defaultRepository.deleteSession(sessionId);
    setSessions((prev) => prev.filter((s) => s.sessionId !== sessionId));
  }, []);

  const exportSaveJson = useCallback(async () => {
    const envelope = await defaultRepository.exportSaveData();
    return JSON.stringify(envelope, null, 2);
  }, []);

  const importSaveJson = useCallback(
    async (rawJson: string) => {
      await defaultRepository.importSaveData(rawJson);
      await refreshAll();
      if (cloudUser) {
        void performCloudSync(cloudUser.uid);
      }
    },
    [refreshAll, cloudUser, performCloudSync]
  );

  const resetLocalData = useCallback(async () => {
    await defaultRepository.clearAllLocalData();
    await refreshAll();
  }, [refreshAll]);

  const signInWithGoogle = useCallback(async () => {
    const fbUser = await signInWithGooglePopup();
    const current = await defaultRepository.getOrCreateProfile();
    const upgraded = await defaultRepository.saveProfile({
      ...current,
      cloudUid: fbUser.uid,
      authType: 'google',
      displayName:
        current.displayName === 'Guest Player' && fbUser.displayName
          ? fbUser.displayName.slice(0, 32)
          : current.displayName,
      privacyConsent: {
        ...current.privacyConsent,
        cloudSyncEnabled: true,
        consentUpdatedAt: Date.now(),
      },
    });
    setProfile(upgraded);
    await performCloudSync(fbUser.uid);
  }, [performCloudSync]);

  const signOutCloud = useCallback(async () => {
    await signOutFirebase();
    if (profile) {
      const downgraded = await defaultRepository.saveProfile({
        ...profile,
        authType: 'guest',
      });
      setProfile(downgraded);
    }
    setCloudUser(null);
    setCloudSyncStatus('offline');
  }, [profile]);

  const syncCloudNow = useCallback(async () => {
    if (!cloudUser) return;
    await performCloudSync(cloudUser.uid);
  }, [cloudUser, performCloudSync]);

  const deleteCloudAccount = useCallback(async () => {
    let requiresRecentLogin = false;
    if (cloudUser) {
      const res = await deleteAllCloudAccountData(cloudUser.uid);
      requiresRecentLogin = res.requiresRecentLogin;
    }
    await defaultRepository.clearAllLocalData();
    await refreshAll();
    setCloudUser(null);
    setCloudSyncStatus('offline');
    return { requiresRecentLogin };
  }, [cloudUser, refreshAll]);

  const stats = useMemo(() => computeAggregateStats(matches), [matches]);
  const levelInfo = useMemo(
    () => calculateLevelFromXp(profile?.xp ?? 0),
    [profile?.xp]
  );

  const t = useCallback(
    (key: TranslationKey) => translate(profile?.preferences.language ?? 'en', key),
    [profile?.preferences.language]
  );

  const value = useMemo<AppStateContextValue>(
    () => ({
      ready,
      authReady,
      cloudUser,
      cloudSyncStatus,
      cloudSyncError,
      lastSyncedAt,
      profile,
      sessions,
      matches,
      achievements,
      dailyChallenge,
      stats,
      levelInfo,
      t,
      updateDisplayName,
      updateAvatar,
      updatePreferences,
      updatePrivacyConsent,
      deleteSession,
      exportSaveJson,
      importSaveJson,
      resetLocalData,
      signInWithGoogle,
      signOutCloud,
      syncCloudNow,
      deleteCloudAccount,
      refreshAll,
    }),
    [
      ready,
      authReady,
      cloudUser,
      cloudSyncStatus,
      cloudSyncError,
      lastSyncedAt,
      profile,
      sessions,
      matches,
      achievements,
      dailyChallenge,
      stats,
      levelInfo,
      t,
      updateDisplayName,
      updateAvatar,
      updatePreferences,
      updatePrivacyConsent,
      deleteSession,
      exportSaveJson,
      importSaveJson,
      resetLocalData,
      signInWithGoogle,
      signOutCloud,
      syncCloudNow,
      deleteCloudAccount,
      refreshAll,
    ]
  );

  return (
    <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>
  );
}

export function useAppState(): AppStateContextValue {
  const ctx = useContext(AppStateContext);
  if (!ctx) {
    throw new Error('useAppState must be used inside AppStateProvider');
  }
  return ctx;
}
