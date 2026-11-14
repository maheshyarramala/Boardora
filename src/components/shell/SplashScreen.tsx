import { useEffect, useState } from 'react';
import { BoardoraLogo } from '../brand/BoardoraLogo';
import { ChessPiece3D, Dice3D, LudoPawn3D } from '../tabletop/TactilePieces';

interface SplashScreenProps {
  ready: boolean;
  onComplete: () => void;
}

export function SplashScreen({ ready, onComplete }: SplashScreenProps) {
  const [progress, setProgress] = useState(18);

  useEffect(() => {
    const t1 = window.setTimeout(() => setProgress(56), 140);
    const t2 = window.setTimeout(() => setProgress(88), 320);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    setProgress(100);
    const done = window.setTimeout(() => onComplete(), 280);
    return () => window.clearTimeout(done);
  }, [ready, onComplete]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center px-6 bg-[#08172F] text-[#F4EBDD] boardora-shell-bg"
      role="status"
      aria-label="Loading BOARDORA"
    >
      <div className="flex flex-col items-center text-center max-w-sm w-full boardora-enter">
        {/* 3D Tabletop Signature Trio */}
        <div className="flex items-end justify-center gap-5 mb-7">
          <LudoPawn3D color="crimson" size={44} />
          <Dice3D value={6} size={52} variant="white" />
          <ChessPiece3D piece="knight" tone="gold" size={50} />
        </div>

        <BoardoraLogo variant="stacked" size="lg" />

        <div className="mt-8 w-full max-w-xs">
          <div className="h-1.5 w-full rounded-full bg-[#142B54] overflow-hidden border border-[#D6AD55]/20">
            <div
              className="h-full bg-gradient-to-r from-[#9B712D] via-[#D6AD55] to-[#ECCB7C] transition-all duration-200 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-3 text-xs font-mono-tabular text-[#A7B8D1]">
            Preparing ten classic boards · {progress}%
          </p>
        </div>
      </div>
    </div>
  );
}
