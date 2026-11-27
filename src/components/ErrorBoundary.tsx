import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { getTranslations } from '../utils/language';
import { loadUserPreferences } from '../services/preferencesRepository';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(_error: Error, _errorInfo: ErrorInfo): void {
    // Error captured cleanly inside boundary without exposing internals to UI
  }

  private handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.hash = '#dashboard';
      window.location.reload();
    }
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const lang = loadUserPreferences().language;
    const t = getTranslations(lang);

    return (
      <div className="min-h-screen bg-[var(--bg-main)] text-[var(--text-primary)] flex items-center justify-center p-6">
        <div className="surface-card rounded-lg p-8 max-w-lg w-full space-y-5">
          <p className="text-xs font-code text-[var(--text-secondary)]">
            {t.errorBoundary.kicker}
          </p>
          <h1 className="font-editorial text-2xl sm:text-3xl font-normal text-[var(--text-primary)]">
            {t.errorBoundary.heading}
          </h1>
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
            {t.errorBoundary.body}
          </p>
          <button
            type="button"
            onClick={this.handleReload}
            className="px-4 py-2.5 text-xs font-medium rounded-md btn-primary"
          >
            {t.errorBoundary.reloadBtn}
          </button>
        </div>
      </div>
    );
  }
}
