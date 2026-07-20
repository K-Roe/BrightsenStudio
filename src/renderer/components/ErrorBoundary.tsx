import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public override state: ErrorBoundaryState = {
    hasError: false
  };

  public static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Renderer error boundary caught an error.', error, errorInfo);
  }

  public override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <main className="error-shell">
          <section className="error-panel">
            <p className="eyebrow">Studio paused</p>
            <h1>Something went wrong while preparing this screen.</h1>
            <p>
              Your work is still stored locally. Close and reopen Studio, then try the action again.
            </p>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}
