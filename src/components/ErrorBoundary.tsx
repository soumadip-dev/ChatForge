import { Component, type ErrorInfo, type ReactNode } from 'react';

type ErrorBoundaryProps = {
  children: ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
};

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Escape room crashed', error, info);
  }

  resetGame = () => {
    localStorage.removeItem('escapeRoomProgress');
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-950 px-4 text-white">
        <section className="max-w-lg rounded-lg border border-red-400/30 bg-white/10 p-6 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-red-300">
            Terminal recovery
          </p>
          <h1 className="mt-3 text-2xl font-bold">The room needs a reset</h1>
          <p className="mt-3 text-gray-300">
            Something unexpected interrupted the game. Restarting clears the saved run and reloads a
            clean room.
          </p>
          <button
            className="mt-6 rounded-lg bg-red-600 px-5 py-3 font-semibold text-white transition hover:bg-red-700"
            onClick={this.resetGame}
            type="button"
          >
            Restart Room
          </button>
        </section>
      </main>
    );
  }
}

export default ErrorBoundary;
