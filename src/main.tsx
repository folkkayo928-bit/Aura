import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

function redactDiagnostic(value: string): string {
  return value
    .replace(/https?:\/\/[^\s"'<>)]*/gi, '[URL redacted]')
    .replace(/\beyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]+\b/g, '[TOKEN redacted]')
    .replace(/\b(?:Bearer|Authorization)\s+[^\s,;]+/gi, '[AUTH redacted]')
    .replace(/\b0x[a-f0-9]{40}\b/gi, '[WALLET ADDRESS redacted]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[EMAIL redacted]')
    .slice(0, 1800);
}

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; diagnostic: string }
> {
  state = { hasError: false, diagnostic: '' };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Keep diagnostics local to the WebView, and redact possible credentials
    // or personal values before making details visible or logging them.
    const diagnostic = redactDiagnostic(
      `${error.name || 'Error'}: ${error.message || 'No error message'}\n${info.componentStack || ''}`,
    );
    this.setState({ diagnostic });
    console.error('AURA UI render failed (redacted):', diagnostic);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="min-h-screen bg-[#09090d] text-stone-100 flex items-center justify-center p-6">
          <section className="w-full max-w-sm rounded-3xl border border-amber-400/20 bg-[#12121a] p-6 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400/10 text-amber-300 font-serif text-2xl">A</div>
            <h1 className="mt-4 text-xl font-serif">AURA couldn’t open this screen</h1>
            <p className="mt-2 text-sm leading-6 text-stone-400">
              Your account and assets have not been changed by this display error. Reload AURA to try again.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 w-full rounded-xl bg-amber-400 py-3 text-sm font-bold text-stone-950"
            >
              Reload AURA
            </button>
            {this.state.diagnostic && (
              <details className="mt-4 rounded-xl border border-white/10 p-3 text-left">
                <summary className="cursor-pointer text-xs text-stone-300">Technical details (redacted)</summary>
                <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap break-words text-[10px] leading-4 text-stone-500">{this.state.diagnostic}</pre>
                <p className="mt-2 text-[10px] leading-4 text-stone-600">
                  These details stay in this WebView; AURA does not send them to a logging service.
                </p>
              </details>
            )}
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>,
);
