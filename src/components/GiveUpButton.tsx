type GiveUpButtonProps = {
  expectedCode: string;
  explanation: string;
  practiceProblem: string;
  isRevealed: boolean;
  onGiveUp: () => void;
};

function GiveUpButton({
  expectedCode,
  explanation,
  practiceProblem,
  isRevealed,
  onGiveUp,
}: GiveUpButtonProps) {
  return (
    <section className="rounded-lg border border-red-400/25 bg-red-500/10 p-4 backdrop-blur-lg">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-red-100">Assist Mode</h2>
          <p className="text-sm text-gray-300">Reveal the solution and get a practice prompt.</p>
        </div>
        <button
          className="rounded-lg bg-red-600 px-4 py-2 font-semibold text-white transition hover:bg-red-700"
          onClick={onGiveUp}
          type="button"
        >
          Give Up
        </button>
      </div>

      {isRevealed ? (
        <div className="mt-4 space-y-3">
          <pre className="overflow-auto rounded-lg bg-gray-950/75 p-3 font-mono text-sm text-green-300">
            {expectedCode}
          </pre>
          <p className="text-sm leading-6 text-gray-100">{explanation}</p>
          <div className="rounded-lg border border-white/10 bg-black/25 p-3">
            <p className="text-sm font-semibold text-red-100">Practice problem</p>
            <p className="mt-1 text-sm text-gray-200">{practiceProblem}</p>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default GiveUpButton;
