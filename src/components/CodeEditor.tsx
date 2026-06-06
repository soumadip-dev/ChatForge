import type { KeyboardEvent } from 'react';

type CodeEditorProps = {
  userCode: string;
  output: string;
  error: string;
  isRunning: boolean;
  onCodeChange: (value: string) => void;
  onRun: () => void;
  onCheck: () => void;
};

function CodeEditor({
  userCode,
  output,
  error,
  isRunning,
  onCodeChange,
  onRun,
  onCheck,
}: CodeEditorProps) {
  const handleEditorKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'Enter') {
      event.preventDefault();
      onCheck();
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      onRun();
    }
  };

  return (
    <section className="grid min-h-[520px] gap-4 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
      <div className="flex min-h-[340px] flex-col rounded-lg border border-green-500/30 bg-black/35 p-4 backdrop-blur-lg">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-green-200">Code Terminal</h2>
          <span className="text-xs uppercase tracking-[0.16em] text-gray-400">JavaScript</span>
        </div>

        <textarea
          aria-label="JavaScript code editor"
          className="min-h-0 flex-1 resize-none rounded-lg border border-green-500/50 bg-gray-900/50 p-4 font-mono text-sm leading-6 text-green-400 outline-none transition focus:border-green-300 focus:ring-2 focus:ring-green-400/25"
          onKeyDown={handleEditorKeyDown}
          onChange={(event) => onCodeChange(event.target.value)}
          placeholder="Write JavaScript here..."
          spellCheck={false}
          value={userCode}
        />

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            className="rounded-lg bg-green-600 px-6 py-2 font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isRunning}
            onClick={onRun}
            title="Run code (Ctrl+Enter)"
            type="button"
          >
            {isRunning ? 'Running...' : 'Run'}
          </button>
          <button
            className="rounded-lg bg-blue-600 px-6 py-2 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isRunning}
            onClick={onCheck}
            title="Check answer (Ctrl+Shift+Enter)"
            type="button"
          >
            Check
          </button>
          <span className="text-xs text-gray-400">Ctrl+Enter run</span>
        </div>
      </div>

      <div className="flex min-h-[260px] flex-col rounded-lg border border-cyan-400/25 bg-black/45 p-4 backdrop-blur-lg">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-cyan-200">Output</h2>
          <span className={error ? 'text-red-400' : 'text-green-400 animate-pulse'}>
            {error ? 'Access Error' : 'Terminal Active'}
          </span>
        </div>

        <pre
          aria-live="polite"
          className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap rounded-lg border border-white/10 bg-gray-950/75 p-4 font-mono text-sm leading-6 text-gray-100"
        >
          {error || output || 'Run code to view output.'}
        </pre>
      </div>
    </section>
  );
}

export default CodeEditor;
