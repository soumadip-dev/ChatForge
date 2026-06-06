type ProgressBarProps = {
  chapterTitle: string;
  chapterNumber: number;
  currentChapterPuzzle: number;
  totalChapterPuzzles: number;
  puzzleLabels: {
    id: number;
    number: number;
    solved: boolean;
    active: boolean;
    available: boolean;
  }[];
  attempts: number;
  attemptsTotal: number;
  onSelectPuzzle: (puzzleId: number) => void;
};

function ProgressBar({
  chapterTitle,
  chapterNumber,
  currentChapterPuzzle,
  totalChapterPuzzles,
  puzzleLabels,
  attempts,
  attemptsTotal,
  onSelectPuzzle,
}: ProgressBarProps) {
  const progress = (currentChapterPuzzle / totalChapterPuzzles) * 100;

  return (
    <section className="rounded-lg border border-white/10 bg-white/10 p-4 backdrop-blur-lg">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm text-gray-200">
        <div>
          <span className="font-semibold text-green-300">
            Chapter {chapterNumber}: {chapterTitle}
          </span>
          <span className="ml-2 text-gray-300">
            Puzzle {currentChapterPuzzle}/{totalChapterPuzzles}
          </span>
        </div>
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

      <div className="mt-4 flex flex-wrap gap-2">
        {puzzleLabels.map(puzzle => (
          <button
            aria-label={`Puzzle ${puzzle.number}${puzzle.solved ? ' completed' : ''}`}
            className={`h-9 min-w-9 rounded-lg border px-3 text-sm font-bold transition ${
              puzzle.active
                ? 'border-yellow-300 bg-yellow-300 text-gray-950 shadow-lg shadow-yellow-500/20'
                : puzzle.solved
                  ? 'border-green-400/60 bg-green-500/20 text-green-200 hover:bg-green-500/30'
                  : puzzle.available
                    ? 'border-white/20 bg-white/10 text-white hover:bg-white/20'
                    : 'cursor-not-allowed border-white/10 bg-black/20 text-gray-500'
            }`}
            disabled={!puzzle.available}
            key={puzzle.id}
            onClick={() => onSelectPuzzle(puzzle.id)}
            type="button"
          >
            {puzzle.solved ? '✓' : puzzle.number}
          </button>
        ))}
      </div>
    </section>
  );
}

export default ProgressBar;
