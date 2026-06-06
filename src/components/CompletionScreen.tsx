type CompletionData = {
  timeTaken: string;
  hintsUsed: number;
  puzzlesSolved: number;
  attemptsTotal: number;
  assistedSolves: number;
  shareText: string;
};

type CompletionScreenProps = {
  data: CompletionData;
  onPlayAgain: () => void;
};

function CompletionScreen({ data, onPlayAgain }: CompletionScreenProps) {
  const shareResults = async () => {
    if (navigator.share) {
      await navigator.share({ text: data.shareText }).catch(() => undefined);
      return;
    }

    await navigator.clipboard?.writeText(data.shareText).catch(() => undefined);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-black px-4 py-8 text-white">
      <section className="w-full max-w-3xl rounded-2xl border border-green-500/35 bg-white/10 p-6 text-center shadow-2xl shadow-green-950/30 backdrop-blur-lg sm:p-10">
        <p className="text-green-400 animate-pulse">System Unlocked</p>
        <h1 className="mt-3 text-3xl font-bold sm:text-5xl">You Escaped</h1>
        <p className="mx-auto mt-4 max-w-xl text-gray-200">
          The final door is open. Your JavaScript fundamentals passed every lock.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-5">
          {[
            ['Time', data.timeTaken],
            ['Puzzles', String(data.puzzlesSolved)],
            ['Hints', String(data.hintsUsed)],
            ['Attempts', String(data.attemptsTotal)],
            ['Assisted', String(data.assistedSolves)],
          ].map(([label, value]) => (
            <div className="rounded-lg border border-white/10 bg-black/30 p-4" key={label}>
              <p className="text-sm text-gray-400">{label}</p>
              <p className="mt-2 font-mono text-xl font-bold text-green-300">{value}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button
            className="rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700"
            onClick={shareResults}
            type="button"
          >
            Share
          </button>
          <button
            className="rounded-lg bg-green-600 px-6 py-3 font-semibold text-white transition hover:bg-green-700"
            onClick={onPlayAgain}
            type="button"
          >
            Play Again
          </button>
        </div>
      </section>
    </main>
  );
}

export default CompletionScreen;
