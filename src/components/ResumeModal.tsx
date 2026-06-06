type ResumeModalProps = {
  progress: {
    puzzleNumber: number;
    timer: string;
    attempts: number;
    hints: number;
  };
  onResume: () => void;
  onStartNew: () => void;
};

function ResumeModal({ progress, onResume, onStartNew }: ResumeModalProps) {
  return (
    <div
      aria-labelledby="resume-title"
      aria-modal="true"
      className="fixed inset-0 z-20 flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm"
      role="dialog"
    >
      <section className="w-full max-w-lg rounded-lg border border-green-500/35 bg-gray-950 p-6 text-white shadow-2xl shadow-green-950/40">
        <p className="text-green-400 animate-pulse">Saved signal detected</p>
        <h2 className="mt-2 text-2xl font-bold" id="resume-title">
          Resume Escape Room?
        </h2>
        <p className="mt-3 text-gray-300">
          A saved run is waiting at puzzle {progress.puzzleNumber}.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-white/10 p-3">
            <p className="text-xs text-gray-400">Time</p>
            <p className="font-mono text-green-300">{progress.timer}</p>
          </div>
          <div className="rounded-lg bg-white/10 p-3">
            <p className="text-xs text-gray-400">Attempts</p>
            <p className="font-mono text-green-300">{progress.attempts}</p>
          </div>
          <div className="rounded-lg bg-white/10 p-3">
            <p className="text-xs text-gray-400">Hints</p>
            <p className="font-mono text-green-300">{progress.hints}</p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            autoFocus
            className="rounded-lg bg-green-600 px-5 py-3 font-semibold text-white transition hover:bg-green-700"
            onClick={onResume}
            type="button"
          >
            Resume
          </button>
          <button
            className="rounded-lg border border-white/20 bg-white/10 px-5 py-3 font-semibold text-white transition hover:bg-white/20"
            onClick={onStartNew}
            type="button"
          >
            Start New
          </button>
        </div>
      </section>
    </div>
  );
}

export default ResumeModal;
