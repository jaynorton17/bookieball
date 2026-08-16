import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div
            style={{
              display: 'grid',
              placeItems: 'center',
              height: '100%',
              textAlign: 'center',
              padding: '2rem',
            }}
          >
            <div style={{ display: 'grid', gap: '1rem', maxWidth: '480px' }}>
              <span
                style={{
                  color: '#ff9d96',
                  textTransform: 'uppercase',
                  letterSpacing: '0.2em',
                  fontWeight: 900,
                  fontSize: '0.82rem',
                }}
              >
                Something went wrong
              </span>
              <p style={{ color: 'rgba(234,242,255,0.72)', lineHeight: 1.5, margin: 0, fontSize: '0.95rem' }}>
                The slide player encountered an error. You can reload the page to try again.
              </p>
              <button
                type="button"
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.location.reload();
                }}
                style={{
                  justifySelf: 'center',
                  borderRadius: '999px',
                  border: '1px solid rgba(240,210,132,0.2)',
                  background: 'linear-gradient(180deg, rgba(247,220,143,0.92), rgba(200,154,49,0.92))',
                  color: '#151a21',
                  padding: '0.6rem 1.2rem',
                  fontWeight: 900,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                }}
              >
                Reload
              </button>
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
