'use client';

import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex min-h-[200px] flex-col items-center justify-center gap-4 rounded-lg border border-red-200 bg-[var(--surface)] p-8 text-center dark:border-red-950">
          <AlertTriangle className="h-8 w-8 text-[var(--danger)]" />
          <div>
            <p className="font-medium text-[var(--ink)]">出了点问题</p>
            <p className="mt-1 text-sm text-[var(--muted)]">{this.state.error?.message || '页面加载失败'}</p>
          </div>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false })}
            className="flex min-h-11 items-center gap-1.5 rounded-md bg-[var(--accent)] px-4 text-sm font-medium text-white hover:bg-[var(--accent-hover)]"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            重试
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
