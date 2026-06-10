"use client";

import { Component, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("CryptoPay ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="screen">
          <div className="mobile-shell flex min-h-dvh flex-col items-center justify-center px-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-error-subtle">
              <AlertTriangle className="h-8 w-8 text-error" />
            </div>
            <h1 className="mt-4 text-xl font-bold text-text-primary">
              Something went wrong
            </h1>
            <p className="mt-2 text-sm text-text-secondary">
              Don&apos;t worry - your funds are safe. Try refreshing the app.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="cp-button cp-button-primary mt-6"
            >
              Refresh App
            </button>
            <button
              type="button"
              onClick={() => this.setState({ hasError: false })}
              className="cp-button cp-button-secondary mt-3"
            >
              Try Again
            </button>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}