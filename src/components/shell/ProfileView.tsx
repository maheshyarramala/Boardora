import { useEffect, useState } from 'react';
import {
  BarChart3,
  Check,
  Cloud,
  CloudOff,
  LogIn,
  LogOut,
  RefreshCw,
  Trash2,
  Trophy,
} from 'lucide-react';
import { ACHIEVEMENT_DEFINITIONS } from '../../core/achievements';
import { ActionButton, StatTile, SurfaceCard } from '../../design-system/primitives';
import { audioEngine } from '../../platform/audio';
import { useAppState } from '../../state/AppStateContext';
import { AVATAR_OPTIONS, AvatarCrest } from '../brand/AvatarCrest';
import { ConfirmModal } from './ConfirmModal';

interface ProfileViewProps {
  onOpenStats: () => void;
  onOpenAchievements: () => void;
}

export function ProfileView({
  onOpenStats,
  onOpenAchievements,
}: ProfileViewProps) {
  const {
    profile,
    cloudUser,
    cloudSyncStatus,
    cloudSyncError,
    lastSyncedAt,
    stats,
    levelInfo,
    achievements,
    t,
    updateDisplayName,
    updateAvatar,
    signInWithGoogle,
    signOutCloud,
    syncCloudNow,
    deleteCloudAccount,
  } = useAppState();

  const [nameInput, setNameInput] = useState(profile?.displayName ?? 'Guest Player');
  const [savedNotice, setSavedNotice] = useState(false);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  useEffect(() => {
    if (profile) {
      setNameInput(profile.displayName);
    }
  }, [profile]);

  if (!profile) return null;

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim()) return;
    await updateDisplayName(nameInput);
    audioEngine.play('ui-click');
    setSavedNotice(true);
    window.setTimeout(() => setSavedNotice(false), 1800);
  };

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-[var(--cp-text)]">
          Player Profile
        </h1>
        <p className="mt-1.5 text-sm text-[var(--cp-text-muted)]">
          Offline progress persists in IndexedDB and syncs automatically to Firebase when signed in with Google.
        </p>
      </div>

      {authMessage && (
        <div
          role="status"
          className="rounded-xl border border-[var(--cp-gold)] bg-[var(--cp-bg-elevated)] px-4 py-3 text-sm text-[var(--cp-text)]"
        >
          {authMessage}
        </div>
      )}

      <SurfaceCard highlighted className="p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <AvatarCrest avatarId={profile.avatarId} size={68} />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium text-[var(--cp-gold)]">
                {cloudUser ? 'Google Cloud Account' : 'Offline Guest Account'} ·{' '}
                {t('profile.level')} {levelInfo.level}
              </div>
              <div className="font-display text-xl sm:text-2xl font-bold truncate">
                {profile.displayName}
              </div>
              <div className="mt-2 w-full h-2 rounded-full bg-[var(--cp-surface)] overflow-hidden">
                <div
                  className="h-full bg-[var(--cp-gold)] transition-all duration-200"
                  style={{ width: `${Math.round(levelInfo.progressRatio * 100)}%` }}
                />
              </div>
              <div className="mt-1 flex items-center justify-between text-xs font-mono-tabular text-[var(--cp-text-muted)]">
                <span>{profile.xp} XP total</span>
                <span>
                  {levelInfo.currentLevelXp} / {levelInfo.nextLevelXp} XP
                </span>
              </div>
            </div>
          </div>

          <form onSubmit={(e) => void handleSaveName(e)} className="flex items-center gap-2 pt-2">
            <input
              type="text"
              value={nameInput}
              maxLength={32}
              onChange={(e) => setNameInput(e.target.value)}
              aria-label="Player display name"
              className="flex-1 min-h-[44px] px-3.5 py-2 rounded-xl bg-[var(--cp-surface)] border border-[var(--cp-border)] text-sm text-[var(--cp-text)] focus:outline-none focus:border-[var(--cp-gold)]"
            />
            <ActionButton type="submit" variant="primary">
              {savedNotice ? (
                <>
                  <Check className="w-4 h-4" />
                  Saved
                </>
              ) : (
                'Save Name'
              )}
            </ActionButton>
          </form>

          {/* Cloud Account & Sync Controls */}
          <div className="pt-3 border-t border-[var(--cp-border)] space-y-3">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 font-medium text-[var(--cp-text)]">
                {cloudUser ? (
                  <Cloud className="w-4 h-4 text-emerald-400" />
                ) : (
                  <CloudOff className="w-4 h-4 text-[var(--cp-text-muted)]" />
                )}
                {cloudUser
                  ? `Signed in (${cloudUser.email ?? 'Verified'})`
                  : 'Playing Locally (Guest)'}
              </span>
              {cloudUser && (
                <span className="font-mono-tabular text-[var(--cp-text-muted)]">
                  {cloudSyncStatus === 'syncing'
                    ? 'Syncing...'
                    : cloudSyncStatus === 'synced' && lastSyncedAt
                    ? `Synced ${new Date(lastSyncedAt).toLocaleTimeString()}`
                    : cloudSyncStatus === 'error'
                    ? 'Sync retry needed'
                    : 'Ready'}
                </span>
              )}
            </div>

            {cloudSyncError && (
              <p className="text-xs text-red-300" role="alert">
                {cloudSyncError}
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              {!cloudUser ? (
                <ActionButton
                  variant="primary"
                  onClick={() => {
                    setAuthMessage(null);
                    void signInWithGoogle()
                      .then(() => {
                        audioEngine.play('capture');
                        setAuthMessage('Google account linked and cloud data merged.');
                      })
                      .catch((err) => {
                        audioEngine.play('error');
                        setAuthMessage(
                          err instanceof Error ? err.message : 'Google Sign-In failed.'
                        );
                      });
                  }}
                >
                  <LogIn className="w-4 h-4" />
                  Sign in with Google
                </ActionButton>
              ) : (
                <>
                  <ActionButton
                    variant="secondary"
                    onClick={() => void syncCloudNow()}
                  >
                    <RefreshCw
                      className={`w-4 h-4 ${
                        cloudSyncStatus === 'syncing' ? 'animate-spin' : ''
                      }`}
                    />
                    Sync Cloud
                  </ActionButton>
                  <ActionButton
                    variant="secondary"
                    onClick={() => {
                      void signOutCloud().then(() => {
                        setAuthMessage('Signed out. Local IndexedDB progress kept.');
                      });
                    }}
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </ActionButton>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteOpen(true)}
                    className="min-h-[44px] px-3.5 py-2 rounded-xl bg-red-950/50 border border-red-500/40 text-red-200 hover:bg-red-900/60 text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Account
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-xs font-semibold tracking-wider text-[var(--cp-text-muted)] mb-3">
            CHOOSE PARLOR CREST
          </h2>
          <div className="grid grid-cols-3 sm:grid-cols-6 lg:grid-cols-3 gap-2.5">
            {AVATAR_OPTIONS.map((opt) => {
              const selected = profile.avatarId === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    audioEngine.play('ui-click');
                    void updateAvatar(opt.id);
                  }}
                  className={`min-h-[44px] p-2.5 rounded-xl border flex flex-col items-center gap-1.5 transition-colors cursor-pointer ${
                    selected
                      ? 'border-[var(--cp-gold)] bg-[var(--cp-surface-muted)]'
                      : 'border-[var(--cp-border)] bg-[var(--cp-surface)] hover:border-[var(--cp-border-strong)]'
                  }`}
                >
                  <AvatarCrest avatarId={opt.id} size={36} />
                  <span className="text-xs text-center truncate w-full">
                    {opt.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </SurfaceCard>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label={t('profile.matches')} value={String(stats.totalPlayed)} />
        <StatTile label="Wins" value={String(stats.totalWins)} />
        <StatTile label={t('profile.winRate')} value={`${stats.overallWinRate}%`} />
        <StatTile
          label="Achievements"
          value={`${achievements.length} / ${ACHIEVEMENT_DEFINITIONS.length}`}
        />
      </section>

      <div className="flex flex-wrap gap-3">
        <ActionButton variant="secondary" onClick={onOpenStats}>
          <BarChart3 className="w-4 h-4 text-[var(--cp-gold)]" />
          Open Full Statistics
        </ActionButton>
        <ActionButton variant="secondary" onClick={onOpenAchievements}>
          <Trophy className="w-4 h-4 text-[var(--cp-gold)]" />
          Open Achievements
        </ActionButton>
      </div>

      <ConfirmModal
        open={confirmDeleteOpen}
        title="Permanently Delete Cloud Account?"
        message="This deletes your cloud profile, match ledger, active sessions, and achievements from Firestore as well as local data on this device. This action cannot be undone."
        confirmLabel="Delete Account & Data"
        destructive
        onCancel={() => setConfirmDeleteOpen(false)}
        onConfirm={() => {
          setConfirmDeleteOpen(false);
          void deleteCloudAccount()
            .then((res) => {
              setAuthMessage(
                res.requiresRecentLogin
                  ? 'All cloud & local data deleted. Sign in again to finish removing your Auth credential if needed.'
                  : 'Account and all cloud & local records permanently deleted.'
              );
            })
            .catch((err) => {
              setAuthMessage(
                err instanceof Error ? err.message : 'Unable to delete account.'
              );
            });
        }}
      />
    </div>
  );
}
