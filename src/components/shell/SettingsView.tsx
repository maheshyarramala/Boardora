import React, { useRef, useState } from 'react';
import {
  Download,
  Music,
  RotateCcw,
  Trash2,
  Upload,
  Volume2,
} from 'lucide-react';
import type { LanguageCode, ThemeId } from '../../core/types';
import { audioEngine } from '../../platform/audio';
import { hapticsBridge } from '../../platform/haptics';
import { useAppState } from '../../state/AppStateContext';
import { ConfirmModal } from './ConfirmModal';

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-4 py-3 cursor-pointer">
      <div className="min-w-0">
        <div className="text-sm font-medium text-[var(--cp-text)]">{label}</div>
        {description && (
          <div className="text-xs text-[var(--cp-text-muted)] mt-0.5">
            {description}
          </div>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
          checked ? 'bg-[var(--cp-gold)]' : 'bg-[var(--cp-surface-muted)]'
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-[#08172F] transition-transform ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </label>
  );
}

export function SettingsView() {
  const {
    profile,
    cloudUser,
    t,
    updatePreferences,
    updatePrivacyConsent,
    exportSaveJson,
    importSaveJson,
    resetLocalData,
    deleteCloudAccount,
  } = useAppState();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  if (!profile) return null;

  const { preferences, privacyConsent } = profile;

  const handleExport = async () => {
    const json = await exportSaveJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `boardora-save-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    audioEngine.play('ui-click');
    setStatusMessage('Save archive exported.');
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      await importSaveJson(text);
      audioEngine.play('capture');
      setStatusMessage('Save data imported and migrated safely.');
    } catch (err) {
      audioEngine.play('error');
      setStatusMessage(
        err instanceof Error ? err.message : 'Unable to import save file.'
      );
    } finally {
      e.target.value = '';
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-[var(--cp-text)]">
          {t('settings.title')}
        </h1>
        <p className="mt-1.5 text-sm text-[var(--cp-text-muted)]">
          All preferences persist immediately to IndexedDB and sync to Firestore when enabled.
        </p>
      </div>

      {statusMessage && (
        <div
          role="status"
          className="rounded-xl border border-[var(--cp-gold)] bg-[var(--cp-bg-elevated)] px-4 py-3 text-sm text-[var(--cp-text)]"
        >
          {statusMessage}
        </div>
      )}

      {/* Audio & Haptics */}
      <section className="rounded-2xl border border-[var(--cp-border)] bg-[var(--cp-bg-elevated)] p-5 sm:p-6 divide-y divide-[var(--cp-border)]">
        <h2 className="font-display text-lg font-bold pb-3">{t('settings.audio')}</h2>

        <ToggleRow
          label={t('settings.soundEffects')}
          description="Synthesized Web Audio wooden piece clacks, dice rolls, victory, and defeat cues."
          checked={preferences.soundEnabled}
          onChange={(next) => {
            void updatePreferences({ soundEnabled: next });
            if (next) audioEngine.play('wood-clack');
          }}
        />

        <div className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium">{t('settings.volume')}</div>
            <div className="text-xs font-mono-tabular text-[var(--cp-text-muted)]">
              {Math.round(preferences.soundVolume * 100)}%
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={preferences.soundVolume}
              aria-label="Master sound volume"
              onChange={(e) =>
                void updatePreferences({ soundVolume: Number(e.target.value) })
              }
              className="w-40 accent-[var(--cp-gold)] cursor-pointer"
            />
            <button
              type="button"
              onClick={() => audioEngine.play('dice-roll')}
              className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[var(--cp-surface)] hover:bg-[var(--cp-surface-muted)] text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Volume2 className="w-3.5 h-3.5" />
              Test SFX
            </button>
          </div>
        </div>

        <div className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium">SFX Volume</div>
            <div className="text-xs font-mono-tabular text-[var(--cp-text-muted)]">
              {Math.round(preferences.sfxVolume * 100)}%
            </div>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={preferences.sfxVolume}
            aria-label="Sound effects volume"
            onChange={(e) =>
              void updatePreferences({ sfxVolume: Number(e.target.value) })
            }
            className="w-40 accent-[var(--cp-gold)] cursor-pointer"
          />
        </div>

        <ToggleRow
          label="Parlor Ambient Music"
          description="Calm synthesized Web Audio parlor chord ambiance while playing."
          checked={preferences.musicEnabled}
          onChange={(next) => {
            void updatePreferences({ musicEnabled: next });
            audioEngine.play('ui-click');
          }}
        />

        <div className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Music className="w-4 h-4 text-[var(--cp-gold)]" />
            <div>
              <div className="text-sm font-medium">Music Volume</div>
              <div className="text-xs font-mono-tabular text-[var(--cp-text-muted)]">
                {Math.round(preferences.musicVolume * 100)}%
              </div>
            </div>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={preferences.musicVolume}
            aria-label="Background music volume"
            onChange={(e) =>
              void updatePreferences({ musicVolume: Number(e.target.value) })
            }
            className="w-40 accent-[var(--cp-gold)] cursor-pointer"
          />
        </div>

        <ToggleRow
          label={t('settings.haptics')}
          description="Subtle tactile pulses on supported mobile devices."
          checked={preferences.hapticsEnabled}
          onChange={(next) => {
            void updatePreferences({ hapticsEnabled: next });
            if (next) hapticsBridge.trigger('medium');
          }}
        />
      </section>

      {/* Theme & Language */}
      <section className="rounded-2xl border border-[var(--cp-border)] bg-[var(--cp-bg-elevated)] p-5 sm:p-6 space-y-5">
        <h2 className="font-display text-lg font-bold">{t('settings.appearance')}</h2>

        <div>
          <label className="block text-sm font-medium mb-2">
            {t('settings.theme')}
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {(
              [
                { id: 'navy-gold', label: 'Navy & Gold Parlor' },
                { id: 'marble-light', label: 'Alabaster Marble' },
                { id: 'emerald-felt', label: 'Emerald Felt' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  audioEngine.play('ui-click');
                  void updatePreferences({ theme: opt.id as ThemeId });
                }}
                className={`min-h-[44px] px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  preferences.theme === opt.id
                    ? 'border-[var(--cp-gold)] bg-[var(--cp-gold)] text-[#08172F] font-semibold'
                    : 'border-[var(--cp-border)] bg-[var(--cp-surface)] text-[var(--cp-text)] hover:border-[var(--cp-border-strong)]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="language-select" className="block text-sm font-medium mb-2">
            {t('settings.language')}
          </label>
          <select
            id="language-select"
            value={preferences.language}
            onChange={(e) =>
              void updatePreferences({ language: e.target.value as LanguageCode })
            }
            className="min-h-[44px] w-full sm:w-64 px-3.5 py-2 rounded-xl bg-[var(--cp-surface)] border border-[var(--cp-border)] text-sm text-[var(--cp-text)] focus:outline-none focus:border-[var(--cp-gold)] cursor-pointer"
          >
            <option value="en">English</option>
            <option value="es">Español</option>
            <option value="fr">Français</option>
            <option value="hi">हिन्दी</option>
          </select>
        </div>
      </section>

      {/* Accessibility */}
      <section className="rounded-2xl border border-[var(--cp-border)] bg-[var(--cp-bg-elevated)] p-5 sm:p-6 divide-y divide-[var(--cp-border)]">
        <h2 className="font-display text-lg font-bold pb-3">
          {t('settings.accessibility')}
        </h2>

        <ToggleRow
          label={t('settings.highContrast')}
          checked={preferences.accessibility.highContrast}
          onChange={(next) =>
            void updatePreferences({
              accessibility: { ...preferences.accessibility, highContrast: next },
            })
          }
        />
        <ToggleRow
          label={t('settings.colorblind')}
          description="Adds geometric emblems alongside team colors on game boards."
          checked={preferences.accessibility.colorblindSymbols}
          onChange={(next) =>
            void updatePreferences({
              accessibility: {
                ...preferences.accessibility,
                colorblindSymbols: next,
              },
            })
          }
        />
        <ToggleRow
          label={t('settings.largeText')}
          checked={preferences.accessibility.largeText}
          onChange={(next) =>
            void updatePreferences({
              accessibility: { ...preferences.accessibility, largeText: next },
            })
          }
        />
        <ToggleRow
          label={t('settings.reducedMotion')}
          checked={preferences.accessibility.reducedMotion}
          onChange={(next) =>
            void updatePreferences({
              accessibility: { ...preferences.accessibility, reducedMotion: next },
            })
          }
        />
      </section>

      {/* Privacy & Save Data Controls */}
      <section className="rounded-2xl border border-[var(--cp-border)] bg-[var(--cp-bg-elevated)] p-5 sm:p-6 space-y-4">
        <h2 className="font-display text-lg font-bold">{t('settings.privacy')}</h2>
        <p className="text-xs leading-relaxed text-[var(--cp-text-muted)]">
          BOARDORA collects zero personal data in Guest Mode. Optional analytics and Firebase cloud save remain off unless you sign in and opt in.
        </p>

        <div className="divide-y divide-[var(--cp-border)]">
          <ToggleRow
            label={t('settings.analyticsConsent')}
            description="Opt-in gameplay balancing consent (no PII collected)."
            checked={privacyConsent.analyticsEnabled}
            onChange={(next) =>
              void updatePrivacyConsent({ analyticsEnabled: next })
            }
          />
          <ToggleRow
            label={t('settings.cloudSync')}
            description="Automatically syncs matches, sessions, and XP to Firestore when signed in."
            checked={privacyConsent.cloudSyncEnabled}
            onChange={(next) =>
              void updatePrivacyConsent({ cloudSyncEnabled: next })
            }
          />
        </div>

        <div className="pt-4 border-t border-[var(--cp-border)] flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void handleExport()}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-[var(--cp-surface)] hover:bg-[var(--cp-surface-muted)] text-sm font-medium inline-flex items-center gap-2 cursor-pointer whitespace-nowrap"
          >
            <Download className="w-4 h-4 text-[var(--cp-gold)]" />
            {t('settings.exportSave')}
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-[var(--cp-surface)] hover:bg-[var(--cp-surface-muted)] text-sm font-medium inline-flex items-center gap-2 cursor-pointer whitespace-nowrap"
          >
            <Upload className="w-4 h-4 text-[var(--cp-gold)]" />
            {t('settings.importSave')}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            onChange={(e) => void handleImportFile(e)}
            className="hidden"
          />

          <button
            type="button"
            onClick={() => setConfirmResetOpen(true)}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-red-950/50 border border-red-500/40 text-red-200 hover:bg-red-900/60 text-sm font-medium inline-flex items-center gap-2 cursor-pointer whitespace-nowrap"
          >
            <RotateCcw className="w-4 h-4" />
            {t('settings.clearData')}
          </button>

          {cloudUser && (
            <button
              type="button"
              onClick={() => setConfirmDeleteOpen(true)}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-red-950/70 border border-red-400/60 text-red-100 hover:bg-red-900/80 text-sm font-medium inline-flex items-center gap-2 cursor-pointer whitespace-nowrap"
            >
              <Trash2 className="w-4 h-4" />
              Delete Cloud Account
            </button>
          )}
        </div>
      </section>

      <ConfirmModal
        open={confirmResetOpen}
        title="Reset Local Save Data?"
        message="This permanently clears your local Guest profile, saved match sessions, match history, and achievements from IndexedDB on this device."
        confirmLabel="Reset All Data"
        destructive
        onCancel={() => setConfirmResetOpen(false)}
        onConfirm={() => {
          setConfirmResetOpen(false);
          void resetLocalData().then(() => {
            setStatusMessage('Local data reset to a clean Guest profile.');
          });
        }}
      />

      <ConfirmModal
        open={confirmDeleteOpen}
        title="Delete Cloud Account & Data?"
        message="This permanently erases all cloud data stored under your Firebase account and clears local save data on this device."
        confirmLabel="Delete Account"
        destructive
        onCancel={() => setConfirmDeleteOpen(false)}
        onConfirm={() => {
          setConfirmDeleteOpen(false);
          void deleteCloudAccount()
            .then((res) => {
              setStatusMessage(
                res.requiresRecentLogin
                  ? 'Cloud & local data cleared. Sign in again to purge your Auth record.'
                  : 'Cloud account and all data permanently deleted.'
              );
            })
            .catch((err) => {
              setStatusMessage(
                err instanceof Error ? err.message : 'Unable to delete account.'
              );
            });
        }}
      />
    </div>
  );
}
