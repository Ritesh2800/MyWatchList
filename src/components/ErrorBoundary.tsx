import React from 'react';

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message || 'An unexpected error occurred.' };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          className="flex min-h-dvh flex-col items-center justify-center bg-[var(--bg)] px-6 text-center text-[var(--ink)]"
        >
          <h1 className="font-display text-2xl font-bold">Something went wrong</h1>
          <p className="mt-2 max-w-md text-sm text-[var(--muted)]">{this.state.message}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-6 min-h-[44px] rounded-full bg-[var(--inverse-bg)] px-6 text-sm font-semibold text-[var(--inverse-ink)]"
          >
            Reload SeenIt
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
