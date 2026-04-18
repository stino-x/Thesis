/**
 * Error boundary for detection components.
 * Catches unhandled errors from TensorFlow.js / ONNX Runtime
 * and shows a useful message instead of crashing the whole page.
 */

import { Component, type ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props { 
  children: ReactNode; 
  label?: string;
  onReset?: () => void;
}
interface State { 
  error: Error | null;
  errorCount: number;
  lastErrorTime: number;
}

export class DetectionErrorBoundary extends Component<Props, State> {
  state: State = { error: null, errorCount: 0, lastErrorTime: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const now = Date.now();
    const timeSinceLastError = now - this.state.lastErrorTime;
    
    // Reset count if more than 30 seconds since last error
    const errorCount = timeSinceLastError > 30000 ? 1 : this.state.errorCount + 1;
    
    console.error('[DetectionErrorBoundary]', {
      label: this.props.label,
      error,
      errorInfo,
      errorCount,
      componentStack: errorInfo.componentStack,
    });

    // Log to external service if available (e.g., Sentry)
    if (typeof window !== 'undefined' && (window as any).Sentry) {
      (window as any).Sentry.captureException(error, {
        contexts: {
          react: {
            componentStack: errorInfo.componentStack,
          },
        },
        tags: {
          errorBoundary: this.props.label || 'Detection',
          errorCount,
        },
      });
    }

    this.setState({ errorCount, lastErrorTime: now });
  }

  handleReset = () => {
    this.setState({ error: null, errorCount: 0 });
    this.props.onReset?.();
  };

  render() {
    if (!this.state.error) return this.props.children;

    const { errorCount } = this.state;
    const tooManyErrors = errorCount >= 3;

    return (
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            {this.props.label ?? 'Detection'} failed
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {this.state.error.message}
          </p>
          
          {tooManyErrors && (
            <p className="text-sm text-orange-500">
              Multiple errors detected. This might indicate a browser compatibility issue or corrupted model files.
              Try refreshing the page or clearing your browser cache.
            </p>
          )}

          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer hover:text-foreground">
              Technical details
            </summary>
            <pre className="mt-2 p-2 bg-muted rounded overflow-auto max-h-40">
              {this.state.error.stack}
            </pre>
          </details>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={this.handleReset}
              disabled={tooManyErrors}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Try again {errorCount > 1 && `(${errorCount}/3)`}
            </Button>
            
            {tooManyErrors && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.location.reload()}
              >
                Reload page
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }
}
