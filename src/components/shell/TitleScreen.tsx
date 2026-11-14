import { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { audioEngine } from '../../platform/audio';
import { hapticsBridge } from '../../platform/haptics';
import { useAppState } from '../../state/AppStateContext';
import { BoardoraLogo } from '../brand/BoardoraLogo';
import {
  BoardPerspectiveStage,
  ChessPiece3D,
  Dice3D,
  LudoPawn3D,
} from '../tabletop/TactilePieces';

interface TitleScreenProps {
  onEnterParlor: () => void;
}

export function TitleScreen({ onEnterParlor }: TitleScreenProps) {
  const { t, sessions, profile, levelInfo } = useAppState();
  const [dieFace, setDieFace] = useState(5);

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
      {/* Subtle Ambient Gold Vignette */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_75%_40%,rgba(214,173,85,0.14),transparent_52%),linear-gradient(120deg,rgba(8,23,47,0.92)_0%,rgba(8,23,47,0.68)_55%,rgba(8,23,47,0.85)_100%)]"
      />

      <div className="relative z-10 w-full max-w-6xl mx-auto px-5 sm:px-10 py-10 sm:py-14">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
          <div className="lg:col-span-6 boardora-enter">
            <BoardoraLogo variant="horizontal" size="lg" />

            <h1
              className="mt-7 font-display text-3xl sm:text-5xl font-bold leading-[1.1] tracking-tight text-[#F4EBDD]"
              style={{ textWrap: 'balance' }}
            >
              One World. Ten Games. Endless Fun.
            </h1>

            <p className="mt-4 text-sm sm:text-base leading-relaxed text-[#A7B8D1] max-w-lg">
              {t('app.subtitle')}
            </p>

            {profile && (
              <div className="mt-5 flex flex-wrap items-center gap-2 text-xs sm:text-sm text-[#D6AD55]">
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

            <div className="mt-7 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={handleStart}
                className="min-h-[52px] px-7 py-3.5 rounded-xl bg-gradient-to-b from-[#E5C16C] to-[#D6AD55] text-[#08172F] font-semibold text-base inline-flex items-center gap-3 shadow-lg shadow-black/40 border border-[#F3D892]/50 hover:from-[#F0D185] hover:to-[#DFB862] active:scale-[0.98] transition-all duration-150 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>{t('cta.enterParlor')}</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>

            <p className="mt-5 text-xs text-[#A7B8D1] tracking-wide">
              Press Enter or tap to begin · Offline IndexedDB · Deterministic rule engines
            </p>
          </div>

          {/* 3D Tabletop Showcase Illustration */}
          <div className="lg:col-span-6 boardora-enter">
            <BoardPerspectiveStage>
              <div className="rounded-2xl overflow-hidden border border-[#D6AD55]/35 bg-[#0E2142] p-3 sm:p-4 shadow-2xl">
                <img
                  src="/assets/game-art/hero-tabletop-3d.svg"
                  alt="BOARDORA 3D polished walnut chess board, golden chess pieces, white dice, and glossy Ludo pawns"
                  className="w-full h-auto rounded-xl block"
                />
                <div className="mt-3 pt-3 border-t border-[#D6AD55]/20 flex items-center justify-between gap-3 px-1">
                  <div className="flex items-center gap-2.5">
                    <LudoPawn3D color="crimson" size={28} />
                    <LudoPawn3D color="emerald" size={28} />
                    <LudoPawn3D color="sapphire" size={28} />
                    <LudoPawn3D color="gold" size={28} />
                    <ChessPiece3D piece="knight" tone="gold" size={30} />
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="text-[11px] text-[#A7B8D1] hidden sm:inline">
                      Tap 3D Die
                    </span>
                    <Dice3D
                      value={dieFace}
                      size={36}
                      variant="white"
                      interactive
                      onClick={() => {
                        audioEngine.play('dice-roll');
                        hapticsBridge.trigger('light');
                        setDieFace((d) => (d % 6) + 1);
                      }}
                    />
                  </div>
                </div>
              </div>
            </BoardPerspectiveStage>
          </div>
        </div>
      </div>
    </section>
  );
}
