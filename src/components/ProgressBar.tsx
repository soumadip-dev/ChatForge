type ProgressBarProps = {
  currentPuzzle: number;
  totalPuzzles: number;
  attempts: number;
  attemptsTotal: number;
};

function ProgressBar({ currentPuzzle, totalPuzzles, attempts, attemptsTotal }: ProgressBarProps) {
  const progress = (currentPuzzle / totalPuzzles) * 100;

  return (
    <section className="rounded-lg border border-white/10 bg-white/10 p-4 backdrop-blur-lg">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm text-gray-200">
        <span className="font-semibold text-green-300">
          Puzzle {currentPuzzle}/{totalPuzzles}
        </span>
        <span>
          Attempts: <strong className="text-white">{attempts}</strong> current /{' '}
          <strong className="text-white">{attemptsTotal}</strong> total
        </span>
      </div>

      <div className="h-3 overflow-hidden rounded-full bg-gray-950/70">
        <div
          className="h-full rounded-full bg-gradient-to-r from-green-400 via-cyan-300 to-blue-400 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
    </section>
  );
}

export default ProgressBar;
