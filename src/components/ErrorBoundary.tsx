import { Component, ReactNode } from 'react';

interface Props { children: ReactNode }
interface State { error: Error | null; info: string | null }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: null };

  static getDerivedStateFromError(error: Error): State {
    return { error, info: null };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    this.setState({ error, info: info.componentStack || null });
    // Also spit to console for dev triage
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-screen bg-[#0a0e1a] text-sky-200 font-mono p-8 overflow-auto">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-ember-400 font-display font-bold text-xl mb-2">Something broke rendering this page.</h1>
          <p className="text-sky-500 text-sm mb-6">Paste the details below if you&apos;re reporting this.</p>
          <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-4 mb-4">
            <div className="text-red-300 text-sm font-display font-semibold mb-1">{this.state.error.name}</div>
            <pre className="text-xs whitespace-pre-wrap break-words text-red-200">{this.state.error.message}</pre>
          </div>
          {this.state.error.stack && (
            <details className="mb-4">
              <summary className="text-xs text-sky-400 cursor-pointer">Stack trace</summary>
              <pre className="mt-2 text-[11px] whitespace-pre-wrap break-words text-sky-500">{this.state.error.stack}</pre>
            </details>
          )}
          {this.state.info && (
            <details>
              <summary className="text-xs text-sky-400 cursor-pointer">Component tree</summary>
              <pre className="mt-2 text-[11px] whitespace-pre-wrap break-words text-sky-500">{this.state.info}</pre>
            </details>
          )}
          <button
            onClick={() => location.reload()}
            className="mt-6 px-4 py-2 rounded-xl text-sm font-display font-semibold text-white"
            style={{ background: 'linear-gradient(135deg, #f97316, #fb923c)' }}
          >
            Reload page
          </button>
        </div>
      </div>
    );
  }
}
