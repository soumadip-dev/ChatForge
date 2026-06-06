import { puzzles } from '../data/puzzles';
import type { Puzzle } from '../types';

type PuzzleCardProps = {
  puzzle: Puzzle;
  currentPuzzle: number;
  completedPuzzles: number[];
  showSimplified: boolean;
  escapeUnlocked: boolean;
  onEscape: () => void;
};

function PuzzleCard({
  puzzle,
  currentPuzzle,
  completedPuzzles,
  showSimplified,
  escapeUnlocked,
  onEscape,
}: PuzzleCardProps) {
  return (
    <article className="puzzle-transition glow-border flex min-h-[520px] flex-col justify-between rounded-2xl border border-green-500/30 bg-white/10 p-5 shadow-2xl shadow-black/40 backdrop-blur-lg sm:p-8">
      <div>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <span className="rounded-full border border-green-500/40 bg-green-500/10 px-3 py-1 text-sm font-semibold text-green-300">
            Lock {puzzle.id}
          </span>
          <span className="text-green-400 animate-pulse">Terminal Active</span>
        </div>

        <h2 className="text-2xl font-bold text-white sm:text-3xl">{puzzle.title}</h2>
        <p className="mt-4 text-base leading-7 text-gray-200">{puzzle.story}</p>

        <div className="mt-6 rounded-lg border border-yellow-500/25 bg-yellow-500/10 p-4">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-yellow-300">
            Authentication Required
          </p>
          <p className="mt-2 text-gray-100">{puzzle.question}</p>
        </div>

        {showSimplified ? (
          <div className="mt-4 rounded-lg border border-cyan-400/30 bg-cyan-500/10 p-4">
            <p className="text-sm font-semibold text-cyan-200">Simplified route unlocked</p>
            <p className="mt-2 text-gray-100">{puzzle.simplifiedVersion}</p>
            <p className="mt-3 font-mono text-sm text-cyan-100">
              Code target: {puzzle.simplifiedExpected}
            </p>
            <p className="mt-2 font-mono text-sm text-cyan-100">
              Output target: {puzzle.simplifiedExpectedOutput}
            </p>
          </div>
        ) : null}
      </div>

      <div className="mt-8">
        <div className="mb-4 grid grid-cols-4 gap-2">
          {puzzles.map((p, index) => {
            const solved = completedPuzzles.includes(p.id);
            const active = index === currentPuzzle;

            return (
              <div
                className={`h-2 rounded-full ${
                  solved ? 'bg-green-400' : active ? 'bg-yellow-400' : 'bg-white/20'
                }`}
                key={p.id}
              />
            );
          })}
        </div>

        {escapeUnlocked ? (
          <button
            className="w-full rounded-lg bg-green-500 px-6 py-4 text-base font-bold text-gray-950 shadow-lg shadow-green-500/30 transition hover:bg-green-300 focus:outline-none focus:ring-2 focus:ring-green-200"
            onClick={onEscape}
            type="button"
          >
            Escape Room
          </button>
        ) : (
          <p className="text-red-400">System Locked</p>
        )}
      </div>
    </article>
  );
}

export default PuzzleCard;
