type HintButtonProps = {
  hints: string[];
  hintsUsed: number;
  onReveal: () => void;
};

function HintButton({ hints, hintsUsed, onReveal }: HintButtonProps) {
  const hasHintsLeft = hintsUsed < hints.length;
  const visibleHints = hints.slice(0, hintsUsed);

  return (
    <section className="rounded-lg border border-yellow-500/25 bg-yellow-500/10 p-4 backdrop-blur-lg">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-yellow-200">Hints</h2>
          <p className="text-sm text-gray-300">
            {hintsUsed}/{hints.length} revealed
          </p>
        </div>
        <button
          className="rounded-lg bg-yellow-600 px-4 py-2 font-semibold text-white transition hover:bg-yellow-700 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!hasHintsLeft}
          onClick={onReveal}
          type="button"
        >
          Hint
        </button>
      </div>

      <div className="mt-4 space-y-2">
        {visibleHints.length > 0 ? (
          visibleHints.map((hint, index) => (
            <p className="rounded-lg bg-black/25 p-3 text-sm text-yellow-50" key={hint}>
              {index + 1}. {hint}
            </p>
          ))
        ) : (
          <p className="text-sm text-gray-300">Hints appear progressively as you request them.</p>
        )}
      </div>
    </section>
  );
}

export default HintButton;
