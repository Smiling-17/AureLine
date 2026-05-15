import React, { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCcw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = "/";
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--background)] px-6 text-[var(--foreground)]">
          <div className="flex max-w-md flex-col items-center text-center">
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[var(--red)]/10 text-[var(--red)]">
              <AlertTriangle size={36} />
            </div>
            <h1 className="t-heading-xl mb-4">Something went wrong</h1>
            <p className="mb-8 text-base text-[var(--muted-strong)]">
              The application encountered an unexpected error. We apologize for the inconvenience.
            </p>
            <div className="w-full rounded-xl bg-[var(--surface-inset)] p-4 text-left text-xs text-[var(--muted)] overflow-x-auto mb-8 font-mono">
              {this.state.error?.message || "Unknown rendering error occurred"}
            </div>
            <button
              onClick={this.handleReset}
              className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-8 py-3.5 text-sm font-semibold text-white shadow-sm transition-transform hover:scale-[1.02] active:scale-[0.98]"
            >
              <RefreshCcw size={16} />
              Restart Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
