import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CodeEditor from './components/CodeEditor';
import CompletionScreen from './components/CompletionScreen';
import GiveUpButton from './components/GiveUpButton';
import HintButton from './components/HintButton';
import ProgressBar from './components/ProgressBar';
import PuzzleCard from './components/PuzzleCard';
import ResumeModal from './components/ResumeModal';
import Timer from './components/Timer';
import { chapterPuzzles, chapters } from './data/puzzles';
import type { Puzzle } from './types';

const STORAGE_KEY = 'escapeRoomProgress';
const STORAGE_VERSION = 3;
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
  selectedChapterId?: number;
  completedPuzzles: number[];
  solvedWithAssist?: number[];
  timestamp: number;
};

type RunnerMessage = { type: 'success'; output: string } | { type: 'error'; error: string };
type ViewMode = 'chapters' | 'solving';

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
      progress.currentPuzzle < chapterPuzzles.length;

    if (
      progress.version !== STORAGE_VERSION ||
      !isValidPuzzle ||
      !Array.isArray(progress.completedPuzzles)
    ) {
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

const findChapterByPuzzleId = (puzzleId: number) =>
  chapters.find(chapter => (chapter.puzzleIds as readonly number[]).includes(puzzleId)) ??
  chapters[0];

const getRouteChapterId = () => {
  const match = window.location.hash.match(/^#\/chapter\/(\d+)$/);
  return match ? Number(match[1]) : null;
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
  const initialRouteChapterId = useMemo(() => getRouteChapterId(), []);
  const [viewMode, setViewMode] = useState<ViewMode>(initialRouteChapterId ? 'solving' : 'chapters');
  const [currentPuzzle, setCurrentPuzzle] = useState(0);
  const [selectedChapterId, setSelectedChapterId] = useState(initialRouteChapterId ?? 1);
  const [userCode, setUserCode] = useState(chapterPuzzles[0].starterCode);
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

  const puzzle = chapterPuzzles[currentPuzzle];
  const activeChapter = useMemo(() => findChapterByPuzzleId(puzzle.id), [puzzle.id]);
  const selectedChapter = useMemo(
    () => chapters.find(chapter => chapter.id === selectedChapterId) ?? activeChapter,
    [activeChapter, selectedChapterId]
  );
  const selectedChapterPuzzles = useMemo(
    () =>
      selectedChapter.puzzleIds
        .map(puzzleId => chapterPuzzles.find(candidate => candidate.id === puzzleId))
        .filter((candidate): candidate is Puzzle => Boolean(candidate)),
    [selectedChapter]
  );
  const currentChapterPuzzle = selectedChapterPuzzles.findIndex(candidate => candidate.id === puzzle.id);
  const displayedPuzzle =
    currentChapterPuzzle >= 0 ? puzzle : selectedChapterPuzzles[0] ?? chapterPuzzles[0];
  const displayedPuzzleIndex = chapterPuzzles.findIndex(candidate => candidate.id === displayedPuzzle.id);
  const displayedChapterPuzzleNumber =
    selectedChapterPuzzles.findIndex(candidate => candidate.id === displayedPuzzle.id) + 1;
  const activePuzzle = useMemo<Puzzle>(
    () =>
      showSimplified
        ? {
            ...displayedPuzzle,
            expectedOutput: displayedPuzzle.simplifiedExpectedOutput,
            validationCode: displayedPuzzle.simplifiedValidationCode ?? '',
          }
        : displayedPuzzle,
    [displayedPuzzle, showSimplified]
  );

  const completionData = useMemo(
    () => ({
      timeTaken: formatTime(timer),
      hintsUsed: totalHintsUsed,
      puzzlesSolved: chapterPuzzles.length,
      attemptsTotal,
      assistedSolves: solvedWithAssist.length,
      shareText: `I escaped the JavaScript Fundamentals Escape Room in ${formatTime(
        timer
      )} using ${totalHintsUsed} hints! Can you beat me?`,
    }),
    [attemptsTotal, solvedWithAssist.length, timer, totalHintsUsed]
  );

  const chapterStatuses = useMemo(
    () =>
      chapters.map((chapter, index) => {
        const solvedCount = chapter.puzzleIds.filter(id => completedPuzzles.includes(id)).length;
        const complete = solvedCount === chapter.puzzleIds.length;
        const unlocked =
          index === 0 ||
          chapters
            .slice(0, index)
            .every(previousChapter =>
              previousChapter.puzzleIds.every(id => completedPuzzles.includes(id))
            );

        return {
          ...chapter,
          complete,
          solvedCount,
          unlocked,
        };
      }),
    [completedPuzzles]
  );

  const puzzleLabels = selectedChapterPuzzles.map((candidate, index) => {
    const solved = completedPuzzles.includes(candidate.id);
    const previousSolved =
      index === 0 || completedPuzzles.includes(selectedChapterPuzzles[index - 1].id);

    return {
      id: candidate.id,
      number: index + 1,
      solved,
      active: candidate.id === displayedPuzzle.id,
      available: solved || previousSolved,
    };
  });

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
    setSelectedChapterId(findChapterByPuzzleId(chapterPuzzles[nextIndex].id).id);
    setUserCode(chapterPuzzles[nextIndex].starterCode);
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
      selectedChapterId,
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
    selectedChapterId,
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

  useEffect(() => {
    const syncRoute = () => {
      const routeChapterId = getRouteChapterId();
      setViewMode(routeChapterId ? 'solving' : 'chapters');

      if (routeChapterId && chapters.some(chapter => chapter.id === routeChapterId)) {
        setSelectedChapterId(routeChapterId);
      }
    };

    window.addEventListener('hashchange', syncRoute);
    window.addEventListener('popstate', syncRoute);
    return () => {
      window.removeEventListener('hashchange', syncRoute);
      window.removeEventListener('popstate', syncRoute);
    };
  }, []);

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
    setSelectedChapterId(
      resumeProgress.selectedChapterId ??
        findChapterByPuzzleId(chapterPuzzles[resumeProgress.currentPuzzle].id).id
    );
    setUserCode(resumeProgress.userCode ?? chapterPuzzles[resumeProgress.currentPuzzle].starterCode);
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
    setViewMode('solving');
    window.history.pushState(null, '', `#/chapter/${
      resumeProgress.selectedChapterId ??
      findChapterByPuzzleId(chapterPuzzles[resumeProgress.currentPuzzle].id).id
    }`);
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
    setViewMode('chapters');
    window.history.pushState(null, '', '#/');
  };

  const selectPuzzleById = (puzzleId: number) => {
    const nextIndex = chapterPuzzles.findIndex(candidate => candidate.id === puzzleId);

    if (nextIndex < 0) {
      return;
    }

    resetPuzzleState(nextIndex);
  };

  const selectChapter = (chapterId: number) => {
    const status = chapterStatuses.find(chapter => chapter.id === chapterId);

    if (!status?.unlocked) {
      return;
    }

    const chapterPuzzleIds = status.puzzleIds;
    const firstUnsolvedId =
      chapterPuzzleIds.find(id => !completedPuzzles.includes(id)) ?? chapterPuzzleIds[0];

    setSelectedChapterId(chapterId);
    selectPuzzleById(firstUnsolvedId);
    setViewMode('solving');
    window.history.pushState(null, '', `#/chapter/${chapterId}`);
  };

  const showChapterSelect = () => {
    setViewMode('chapters');
    window.history.pushState(null, '', '#/');
  };

  const selectAvailablePuzzle = (puzzleId: number) => {
    const target = puzzleLabels.find(candidate => candidate.id === puzzleId);

    if (!target?.available) {
      return;
    }

    selectPuzzleById(puzzleId);
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
    const solvedId = displayedPuzzle.id;
    setCompletedPuzzles(ids => (ids.includes(solvedId) ? ids : [...ids, solvedId]));
    playSound('unlock');

    const nextIndex = displayedPuzzleIndex + 1;
    if (nextIndex < chapterPuzzles.length) {
      resetPuzzleState(nextIndex);
    }
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
        setSolvedWithAssist(ids =>
          ids.includes(displayedPuzzle.id) ? ids : [...ids, displayedPuzzle.id]
        );
      }
      if (displayedPuzzleIndex === chapterPuzzles.length - 1) {
        setCompletedPuzzles(ids =>
          ids.includes(displayedPuzzle.id) ? ids : [...ids, displayedPuzzle.id]
        );
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
    if (hintsUsed >= displayedPuzzle.hints.length) {
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
    setSolvedWithAssist(ids =>
      ids.includes(displayedPuzzle.id) ? ids : [...ids, displayedPuzzle.id]
    );
    setUserCode(showSimplified ? displayedPuzzle.simplifiedExpected : displayedPuzzle.expectedCode);
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
            <h1 className="mt-1 text-2xl font-bold text-white sm:text-3xl">
              {viewMode === 'chapters' ? 'Choose a Chapter' : 'Escape Room Terminal'}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {viewMode === 'solving' ? (
              <button
                className="h-10 rounded-lg border border-white/15 bg-white/10 px-3 text-sm font-semibold text-gray-100 transition hover:bg-white/20"
                onClick={showChapterSelect}
                type="button"
              >
                Back to Chapters
              </button>
            ) : null}
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

        {viewMode === 'solving' ? (
        <ProgressBar
          attempts={attempts}
          attemptsTotal={attemptsTotal}
          chapterNumber={selectedChapter.id}
          chapterTitle={selectedChapter.title}
          currentChapterPuzzle={Math.max(displayedChapterPuzzleNumber, 1)}
          onSelectPuzzle={selectAvailablePuzzle}
          puzzleLabels={puzzleLabels}
          totalChapterPuzzles={selectedChapterPuzzles.length}
        />
        ) : null}

        <section
          className={
            viewMode === 'chapters' ? 'grid gap-3 md:grid-cols-2 xl:grid-cols-4' : 'hidden'
          }
        >
          {chapterStatuses.map(chapter => {
            const selected = viewMode === 'solving' && chapter.id === selectedChapter.id;
            const icon = chapter.complete ? '✅' : chapter.unlocked ? String(chapter.id) : '🔒';

            return (
              <button
                aria-pressed={selected}
                className={`min-h-36 rounded-lg border p-4 text-left transition ${
                  selected
                    ? 'border-yellow-300/80 bg-yellow-300/15 shadow-lg shadow-yellow-500/10'
                    : chapter.unlocked
                      ? 'border-green-500/25 bg-white/10 hover:border-green-300/60 hover:bg-white/15'
                      : 'cursor-not-allowed border-white/10 bg-black/25 opacity-60'
                }`}
                disabled={!chapter.unlocked}
                key={chapter.id}
                onClick={() => selectChapter(chapter.id)}
                type="button"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-gray-300">
                      Chapter {chapter.id}
                    </p>
                    <h2 className="mt-1 text-xl font-bold text-white">{chapter.title}</h2>
                  </div>
                  <span className="flex h-10 min-w-10 items-center justify-center rounded-lg border border-white/15 bg-black/30 text-lg font-bold">
                    {icon}
                  </span>
                </div>

                <p className="mt-3 min-h-12 text-sm leading-6 text-gray-300">
                  {chapter.description}
                </p>

                <div className="mt-4">
                  <div className="mb-2 flex items-center justify-between text-xs text-gray-300">
                    <span>
                      {chapter.solvedCount}/{chapter.puzzleIds.length} solved
                    </span>
                    <span>{chapter.complete ? 'Complete' : chapter.unlocked ? 'Unlocked' : 'Locked'}</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-950/70">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-green-400 to-cyan-300"
                      style={{
                        width: `${(chapter.solvedCount / chapter.puzzleIds.length) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              </button>
            );
          })}
        </section>

        <section
          className={
            viewMode === 'solving'
              ? 'grid flex-1 gap-5 lg:grid-cols-[0.92fr_1.08fr]'
              : 'hidden'
          }
        >
          <PuzzleCard
            completedPuzzles={completedPuzzles}
            currentPuzzleId={displayedPuzzle.id}
            escapeUnlocked={escapeUnlocked}
            chapterPuzzles={selectedChapterPuzzles}
            onEscape={completeGame}
            puzzle={displayedPuzzle}
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
              <HintButton hints={displayedPuzzle.hints} hintsUsed={hintsUsed} onReveal={revealHint} />
              <GiveUpButton
                explanation={displayedPuzzle.explanation}
                expectedCode={displayedPuzzle.expectedCode}
                isRevealed={isSolutionRevealed}
                onGiveUp={giveUp}
                practiceProblem={displayedPuzzle.practiceProblem}
              />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

export default App;
