type TimerProps = {
  seconds: number;
};

const formatTime = (totalSeconds: number) => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':');
};

function Timer({ seconds }: TimerProps) {
  return (
    <div className="flex h-10 items-center gap-2 rounded-lg border border-green-500/40 bg-green-950/40 px-4 font-mono text-green-300 shadow-lg shadow-green-950/30">
      <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
      <span>{formatTime(seconds)}</span>
    </div>
  );
}

export default Timer;
