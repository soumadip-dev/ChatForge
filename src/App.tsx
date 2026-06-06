import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CodeEditor from './components/CodeEditor';
import CompletionScreen from './components/CompletionScreen';
import GiveUpButton from './components/GiveUpButton';
import HintButton from './components/HintButton';
import ProgressBar from './components/ProgressBar';
import PuzzleCard from './components/PuzzleCard';
import ResumeModal from './components/ResumeModal';
import Timer from './components/Timer';
import { puzzles } from './data/puzzles';
import type { Puzzle } from './types';

const STORAGE_KEY = 'escapeRoomProgress';
const STORAGE_VERSION = 2;
const SOUND_KEY = 'escapeRoomSoundEnabled';
const MAX_OUTPUT_LENGTH = 5000;
const MAX_LOG_LINES = 100;

type SavedProgress = {
  version?: number;
  currentPuzzle: number;
  userCode?: string;
  output?: string;
  error?: string;
  attempts: number;
  attemptsTotal: number;
  hintsUsed: number;
  totalHintsUsed: number;
  timer: number;
  showSimplified: boolean;
  isSolutionRevealed?: boolean;
  escapeUnlocked?: boolean;
  completedPuzzles: number[];
  solvedWithAssist?: number[];
  timestamp: number;
};

type RunnerMessage = { type: 'success'; output: string } | { type: 'error'; error: string };

const sounds = {
  success: 'https://s3.amazonaws.com/freecodecamp/drums/Chord_1.mp3',
  error: 'https://s3.amazonaws.com/freecodecamp/drums/Chord_2.mp3',
  unlock: 'https://s3.amazonaws.com/freecodecamp/drums/Chord_3.mp3',
};

const formatTime = (totalSeconds: number) => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds].map(value => String(value).padStart(2, '0')).join(':');
};

const normalizeOutput = (value: string) => value.trim().replace(/\r\n/g, '\n');

const loadProgress = (): SavedProgress | null => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      return null;
    }

    const progress = JSON.parse(saved) as SavedProgress;
    const isValidPuzzle =
      Number.isInteger(progress.currentPuzzle) &&
      progress.currentPuzzle >= 0 &&
      progress.currentPuzzle < puzzles.length;

    if (!isValidPuzzle || !Array.isArray(progress.completedPuzzles)) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    return progress;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
};

const loadSoundPreference = () => {
  try {
    return localStorage.getItem(SOUND_KEY) !== 'false';
  } catch {
    return true;
  }
};

const buildWorkerSource = (userCode: string, puzzle: Puzzle) => `
  const logs = [];
  const console = {
    log: (...args) => {
      if (logs.length >= ${MAX_LOG_LINES}) {
        throw new Error('Too much output. Keep console.log calls under ${MAX_LOG_LINES}.');
      }
      logs.push(args.map((item) => String(item)).join(' '));
    }
  };

  try {
    const setup = ${JSON.stringify(puzzle.setupCode || '')};
    const code = ${JSON.stringify(userCode)};
    const validation = ${JSON.stringify(puzzle.validationCode || '')};
    const returnsExpression = ${JSON.stringify(Boolean(puzzle.returnsExpression))};
    const guard = '"use strict";\\nconst self = undefined, globalThis = undefined, fetch = undefined, XMLHttpRequest = undefined, importScripts = undefined, WebSocket = undefined;\\n';
    const body = returnsExpression
      ? setup + '\\nreturn (' + code + ');'
      : setup + '\\n' + code + '\\n' + (validation ? 'return (' + validation + ');' : '');
    const result = Function('console', guard + body)(console);
    const output = logs.length > 0
      ? logs.join('\\n')
      : result !== undefined
        ? String(result)
        : 'Code executed successfully (no output)';

    self.postMessage({
      type: 'success',
      output: output.length > ${MAX_OUTPUT_LENGTH}
        ? output.slice(0, ${MAX_OUTPUT_LENGTH}) + '\\n...output truncated...'
        : output
    });
  } catch (error) {
    self.postMessage({ type: 'error', error: error instanceof Error ? error.message : String(error) });
  }
`;

function App() {
  const savedProgress = useMemo(() => loadProgress(), []);
  const [currentPuzzle, setCurrentPuzzle] = useState(0);
  const [userCode, setUserCode] = useState(puzzles[0].starterCode);
  const [output, setOutput] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [attemptsTotal, setAttemptsTotal] = useState(0);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [totalHintsUsed, setTotalHintsUsed] = useState(0);
  const [timer, setTimer] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [showSimplified, setShowSimplified] = useState(false);
  const [error, setError] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(loadSoundPreference);
  const [showResumeModal, setShowResumeModal] = useState(Boolean(savedProgress));
  const [resumeProgress, setResumeProgress] = useState<SavedProgress | null>(savedProgress);
  const [isRunning, setIsRunning] = useState(false);
  const [isSolutionRevealed, setIsSolutionRevealed] = useState(false);
  const [completedPuzzles, setCompletedPuzzles] = useState<number[]>([]);
  const [solvedWithAssist, setSolvedWithAssist] = useState<number[]>([]);
  const [escapeUnlocked, setEscapeUnlocked] = useState(false);
  const workerRef = useRef<Worker | null>(null);

  const puzzle = puzzles[currentPuzzle];
  const activePuzzle = useMemo<Puzzle>(
    () =>
      showSimplified
        ? {
            ...puzzle,
            expectedOutput: puzzle.simplifiedExpectedOutput,
            validationCode: puzzle.simplifiedValidationCode ?? '',
          }
        : puzzle,
    [puzzle, showSimplified]
  );

  const completionData = useMemo(
    () => ({
      timeTaken: formatTime(timer),
      hintsUsed: totalHintsUsed,
      puzzlesSolved: puzzles.length,
      attemptsTotal,
      assistedSolves: solvedWithAssist.length,
      shareText: `I escaped the JavaScript Fundamentals Escape Room in ${formatTime(
        timer
      )} using ${totalHintsUsed} hints! Can you beat me?`,
    }),
    [attemptsTotal, solvedWithAssist.length, timer, totalHintsUsed]
  );

  const playSound = useCallback(
    (name: keyof typeof sounds) => {
      if (!soundEnabled) {
        return;
      }

      const audio = new Audio(sounds[name]);
      audio.volume = 0.25;
      void audio.play().catch(() => undefined);
    },
    [soundEnabled]
  );

  const resetPuzzleState = useCallback((nextIndex: number) => {
    setCurrentPuzzle(nextIndex);
    setUserCode(puzzles[nextIndex].starterCode);
    setOutput('');
    setError('');
    setAttempts(0);
    setHintsUsed(0);
    setShowSimplified(false);
    setIsSolutionRevealed(false);
  }, []);

  const saveProgress = useCallback(() => {
    if (isCompleted) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }

    const progress: SavedProgress = {
      version: STORAGE_VERSION,
      currentPuzzle,
      userCode,
      output,
      error,
      attempts,
      attemptsTotal,
      hintsUsed,
      totalHintsUsed,
      timer,
      showSimplified,
      isSolutionRevealed,
      escapeUnlocked,
      completedPuzzles,
      solvedWithAssist,
      timestamp: Date.now(),
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  }, [
    attempts,
    attemptsTotal,
    completedPuzzles,
    currentPuzzle,
    error,
    escapeUnlocked,
    hintsUsed,
    isCompleted,
    isSolutionRevealed,
    output,
    showSimplified,
    solvedWithAssist,
    timer,
    totalHintsUsed,
    userCode,
  ]);

  useEffect(() => {
    if (isCompleted || showResumeModal) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setTimer(value => value + 1);
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [isCompleted, showResumeModal]);

  useEffect(() => {
    if (showResumeModal) {
      return;
    }

    const saveId = window.setTimeout(saveProgress, 250);
    return () => window.clearTimeout(saveId);
  }, [saveProgress, showResumeModal]);

  useEffect(() => {
    try {
      localStorage.setItem(SOUND_KEY, String(soundEnabled));
    } catch {
      // Ignore private browsing or storage quota failures.
    }
  }, [soundEnabled]);

  useEffect(
    () => () => {
      workerRef.current?.terminate();
    },
    []
  );

  const resumeGame = () => {
    if (!resumeProgress) {
      return;
    }

    setCurrentPuzzle(resumeProgress.currentPuzzle);
    setUserCode(resumeProgress.userCode ?? puzzles[resumeProgress.currentPuzzle].starterCode);
    setAttempts(resumeProgress.attempts);
    setAttemptsTotal(resumeProgress.attemptsTotal || resumeProgress.attempts);
    setHintsUsed(resumeProgress.hintsUsed);
    setTotalHintsUsed(resumeProgress.totalHintsUsed || resumeProgress.hintsUsed);
    setTimer(resumeProgress.timer);
    setShowSimplified(Boolean(resumeProgress.showSimplified));
    setCompletedPuzzles(resumeProgress.completedPuzzles || []);
    setSolvedWithAssist(resumeProgress.solvedWithAssist || []);
    setIsSolutionRevealed(Boolean(resumeProgress.isSolutionRevealed));
    setEscapeUnlocked(Boolean(resumeProgress.escapeUnlocked));
    setOutput(resumeProgress.output ?? '');
    setError(resumeProgress.error ?? '');
    setShowResumeModal(false);
  };

  const startNewGame = () => {
    const hasProgress = timer > 0 || completedPuzzles.length > 0 || userCode.trim().length > 0;
    if (hasProgress && !window.confirm('Start a new game and discard the saved run?')) {
      return;
    }

    localStorage.removeItem(STORAGE_KEY);
    setResumeProgress(null);
    setShowResumeModal(false);
    setTimer(0);
    setAttemptsTotal(0);
    setTotalHintsUsed(0);
    setCompletedPuzzles([]);
    setSolvedWithAssist([]);
    setEscapeUnlocked(false);
    setIsCompleted(false);
    resetPuzzleState(0);
  };

  const runCode = () => {
    if (!userCode.trim()) {
      setError('Enter a line of JavaScript before running the terminal.');
      setOutput('');
      return;
    }

    workerRef.current?.terminate();
    setIsRunning(true);
    setError('');
    setOutput('Running security check...');

    const workerUrl = URL.createObjectURL(
      new Blob([buildWorkerSource(userCode, activePuzzle)], { type: 'text/javascript' })
    );
    const worker = new Worker(workerUrl);
    URL.revokeObjectURL(workerUrl);
    workerRef.current = worker;

    const timeoutId = window.setTimeout(() => {
      worker.terminate();
      if (workerRef.current === worker) {
        workerRef.current = null;
      }
      setIsRunning(false);
      setOutput('');
      setError('Execution stopped after 2 seconds. Check for an infinite loop.');
      playSound('error');
    }, 2000);

    worker.onmessage = (event: MessageEvent<RunnerMessage>) => {
      window.clearTimeout(timeoutId);
      worker.terminate();
      if (workerRef.current === worker) {
        workerRef.current = null;
      }
      setIsRunning(false);

      if (event.data.type === 'success') {
        setOutput(event.data.output);
        setError('');
      } else {
        setOutput('');
        setError(event.data.error);
      }
    };

    worker.onerror = event => {
      window.clearTimeout(timeoutId);
      worker.terminate();
      if (workerRef.current === worker) {
        workerRef.current = null;
      }
      setIsRunning(false);
      setOutput('');
      setError(event.message || 'The code runner hit an unexpected issue.');
      playSound('error');
    };
  };

  const moveToNextPuzzle = () => {
    const solvedId = puzzles[currentPuzzle].id;
    setCompletedPuzzles(ids => (ids.includes(solvedId) ? ids : [...ids, solvedId]));
    playSound('unlock');
    resetPuzzleState(currentPuzzle + 1);
  };

  const checkSolution = () => {
    const expected = normalizeOutput(activePuzzle.expectedOutput);
    const currentOutput = normalizeOutput(output);

    if (!currentOutput || error) {
      setError('Run your code first, then check the terminal output.');
      return;
    }

    if (currentOutput === expected) {
      playSound('success');
      if (isSolutionRevealed) {
        setSolvedWithAssist(ids => (ids.includes(puzzle.id) ? ids : [...ids, puzzle.id]));
      }
      if (currentPuzzle === puzzles.length - 1) {
        setCompletedPuzzles(ids => (ids.includes(puzzle.id) ? ids : [...ids, puzzle.id]));
        setEscapeUnlocked(true);
        setOutput('All locks are solved. The escape route is ready.');
      } else {
        moveToNextPuzzle();
      }
    } else {
      playSound('error');
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      setAttemptsTotal(value => value + 1);
      setError(
        `Access denied. Expected "${expected || 'no output'}" but the terminal showed "${
          currentOutput || 'no output'
        }".`
      );

      if (newAttempts >= 2 && !showSimplified) {
        setShowSimplified(true);
      }
    }
  };

  const revealHint = () => {
    if (hintsUsed >= puzzle.hints.length) {
      return;
    }

    setHintsUsed(value => value + 1);
    setTotalHintsUsed(value => value + 1);
  };

  const giveUp = () => {
    if (!window.confirm('Reveal this solution? This puzzle will be marked as assisted.')) {
      return;
    }

    setIsSolutionRevealed(true);
    setSolvedWithAssist(ids => (ids.includes(puzzle.id) ? ids : [...ids, puzzle.id]));
    setUserCode(showSimplified ? puzzle.simplifiedExpected : puzzle.expectedCode);
    setOutput(activePuzzle.expectedOutput);
  };

  const completeGame = () => {
    setIsCompleted(true);
    setEscapeUnlocked(false);
    localStorage.removeItem(STORAGE_KEY);
    playSound('unlock');
  };

  if (isCompleted) {
    return <CompletionScreen data={completionData} onPlayAgain={startNewGame} />;
  }

  if (showResumeModal && resumeProgress) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white">
        <ResumeModal
          progress={{
            puzzleNumber: resumeProgress.currentPuzzle + 1,
            timer: formatTime(resumeProgress.timer),
            attempts: resumeProgress.attemptsTotal || resumeProgress.attempts,
            hints: resumeProgress.totalHintsUsed || resumeProgress.hintsUsed,
          }}
          onResume={resumeGame}
          onStartNew={startNewGame}
        />
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-hidden bg-gradient-to-br from-gray-900 via-gray-800 to-black px-4 py-5 text-white sm:px-6 lg:px-8">
      <div className="pointer-events-none fixed inset-0 opacity-35">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(34,197,94,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(34,197,94,0.08)_1px,transparent_1px)] bg-[size:36px_36px]" />
        <div className="absolute inset-x-0 top-0 h-32 bg-green-500/10 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-[calc(100vh-2.5rem)] w-full max-w-7xl flex-col gap-5">
        <header className="flex flex-col gap-4 rounded-lg border border-green-500/25 bg-black/30 p-4 backdrop-blur-md md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-green-300">
              JavaScript Fundamentals
            </p>
            <h1 className="mt-1 text-2xl font-bold text-white sm:text-3xl">Escape Room Terminal</h1>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Timer seconds={timer} />
            <label className="flex h-10 items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-3 text-sm text-gray-100">
              <input
                checked={soundEnabled}
                className="h-4 w-4 accent-green-500"
                onChange={event => setSoundEnabled(event.target.checked)}
                type="checkbox"
              />
              Sound
            </label>
          </div>
        </header>

        <ProgressBar
          attempts={attempts}
          attemptsTotal={attemptsTotal}
          currentPuzzle={currentPuzzle + 1}
          totalPuzzles={puzzles.length}
        />

        <section className="grid flex-1 gap-5 lg:grid-cols-[0.92fr_1.08fr]">
          <PuzzleCard
            completedPuzzles={completedPuzzles}
            currentPuzzle={currentPuzzle}
            escapeUnlocked={escapeUnlocked}
            onEscape={completeGame}
            puzzle={puzzle}
            showSimplified={showSimplified}
          />

          <div className="flex min-h-0 flex-col gap-4">
            <CodeEditor
              error={error}
              isRunning={isRunning}
              onCheck={checkSolution}
              onCodeChange={setUserCode}
              onRun={runCode}
              output={output}
              userCode={userCode}
            />

            <div className="grid gap-4 md:grid-cols-2">
              <HintButton hints={puzzle.hints} hintsUsed={hintsUsed} onReveal={revealHint} />
              <GiveUpButton
                explanation={puzzle.explanation}
                expectedCode={puzzle.expectedCode}
                isRevealed={isSolutionRevealed}
                onGiveUp={giveUp}
                practiceProblem={puzzle.practiceProblem}
              />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

export default App;
