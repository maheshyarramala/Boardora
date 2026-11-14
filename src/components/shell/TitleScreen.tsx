import { useEffect } from 'react';
import { ArrowRight } from 'lucide-react';
import { audioEngine } from '../../platform/audio';
import { hapticsBridge } from '../../platform/haptics';
import { useAppState } from '../../state/AppStateContext';
import { BoardoraLogo } from '../brand/BoardoraLogo';

interface TitleScreenProps {
  onEnterParlor: () => void;
}

export function TitleScreen({ onEnterParlor }: TitleScreenProps) {
  const { t, sessions, profile, levelInfo } = useAppState();

  const handleStart = () => {
    audioEngine.play('ui-click');
    hapticsBridge.trigger('light');
    onEnterParlor();
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        audioEngine.play('ui-click');
        hapticsBridge.trigger('light');
        onEnterParlor();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onEnterParlor]);

  return (
    <section className="relative min-h-[100dvh] w-full overflow-x-hidden flex items-center bg-[#08172F] text-[#F4EBDD] boardora-shell-bg">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(214,173,85,0.14),transparent_58%),linear-gradient(120deg,rgba(8,23,47,0.94)_0%,rgba(8,23,47,0.78)_55%,rgba(8,23,47,0.92)_100%)]"
      />
      <div className="relative z-10 w-full max-w-4xl mx-auto px-5 sm:px-10 py-10 sm:py-14">
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center boardora-enter">
          <BoardoraLogo variant="horizontal" size="lg" />
          <h1
            className="mt-7 font-display text-3xl sm:text-5xl font-bold leading-[1.1] tracking-tight text-[#F4EBDD]"
            style={{ textWrap: 'balance' }}
          >
            One World. Ten Games. Endless Fun.
          </h1>
          <p className="mt-4 mx-auto text-sm sm:text-base leading-relaxed text-[#A7B8D1] max-w-lg">
            {t('app.subtitle')}
          </p>
          {profile && (
            <div className="mt-5 flex flex-wrap justify-center items-center gap-2 text-xs sm:text-sm text-[#D6AD55]">
              <span className="font-medium">{profile.displayName}</span>
              <span aria-hidden="true" className="text-[#4E6488]">·</span>
              <span className="font-mono-tabular">Level {levelInfo.level}</span>
              <span aria-hidden="true" className="text-[#4E6488]">·</span>
              <span className="font-mono-tabular">{profile.xp} XP</span>
              {sessions.length > 0 && (
                <>
                  <span aria-hidden="true" className="text-[#4E6488]">·</span>
                  <span className="font-mono-tabular">
                    {sessions.length} Active {sessions.length === 1 ? 'Match' : 'Matches'}
                  </span>
                </>
              )}
            </div>
          )}
          <div className="mt-8 flex justify-center">
            <button
              type="button"
              onClick={handleStart}
              className="min-h-[54px] px-8 py-4 rounded-xl bg-gradient-to-b from-[#E5C16C] to-[#D6AD55] text-[#08172F] font-semibold text-base inline-flex items-center gap-3 shadow-lg shadow-black/40 border border-[#F3D892]/50 hover:from-[#F0D185] hover:to-[#DFB862] active:scale-[0.98] transition-all duration-150 whitespace-nowrap cursor-pointer"
            >
              <span>{t('cta.enterParlor')}</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
          <p className="mt-5 text-xs text-[#A7B8D1] tracking-wide">
            Your games are waiting inside the hall.
          </p>
        </div>
      </div>
    </section>
  );
}
