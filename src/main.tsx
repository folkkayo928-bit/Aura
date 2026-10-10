import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Keep diagnostics local to the WebView; never send session or wallet data.
    console.error('AURA UI render failed:', error.message, info.componentStack);
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
