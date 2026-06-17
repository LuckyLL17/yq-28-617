import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Copy, CheckCircle, XCircle } from 'lucide-react';
import { useState } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    this.setState({ errorInfo });
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <ErrorFallback
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          onReset={this.handleReset}
        />
      );
    }
    return this.props.children;
  }
}

interface ErrorFallbackProps {
  error: Error | null;
  errorInfo: ErrorInfo | null;
  onReset: () => void;
}

function ErrorFallback({ error, errorInfo, onReset }: ErrorFallbackProps) {
  const [copied, setCopied] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const errorReport = {
    message: error?.message ?? 'Unknown error',
    stack: error?.stack ?? '',
    componentStack: errorInfo?.componentStack ?? '',
    timestamp: new Date().toISOString(),
    url: typeof window !== 'undefined' ? window.location.href : '',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(errorReport, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      console.warn('Failed to copy to clipboard');
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-red-900/30 via-slate-900 to-red-900/20 p-4">
      <div className="w-full max-w-2xl bg-slate-800/90 backdrop-blur-md border border-red-500/30 rounded-2xl shadow-2xl shadow-red-500/10 overflow-hidden">
        <div className="bg-gradient-to-r from-red-600/20 to-orange-600/20 border-b border-red-500/20 p-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-red-300 mb-1">渲染错误</h2>
              <p className="text-sm text-slate-400">
                游戏界面发生了一个意外错误，已被错误边界捕获。
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <XCircle className="w-4 h-4 text-red-400" />
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">错误信息</span>
            </div>
            <p className="font-mono text-sm text-red-300 break-words">
              {error?.message ?? 'Unknown error'}
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onReset}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-medium rounded-xl transition-all shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30"
            >
              <RefreshCw className="w-4 h-4" />
              重启游戏
            </button>
            <button
              onClick={handleCopy}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-700/80 hover:bg-slate-700 text-slate-200 font-medium rounded-xl transition-all border border-slate-600/50"
            >
              {copied ? (
                <>
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  已复制
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  复制报告
                </>
              )}
            </button>
          </div>

          <button
            onClick={() => setShowDetails(!showDetails)}
            className="w-full flex items-center justify-between px-4 py-3 bg-slate-700/40 hover:bg-slate-700/60 text-slate-300 text-sm rounded-xl transition-all border border-slate-600/30"
          >
            <span className="font-medium">{showDetails ? '隐藏' : '显示'}调试详情</span>
            <span className={`text-xs transition-transform ${showDetails ? 'rotate-180' : ''}`}>
              ▼
            </span>
          </button>

          {showDetails && (
            <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
              {error?.stack && (
                <div className="bg-slate-900/80 border border-slate-700/50 rounded-xl p-4 max-h-48 overflow-auto">
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Stack Trace</p>
                  <pre className="text-xs text-slate-400 font-mono whitespace-pre-wrap break-words">
                    {error.stack}
                  </pre>
                </div>
              )}
              {errorInfo?.componentStack && (
                <div className="bg-slate-900/80 border border-slate-700/50 rounded-xl p-4 max-h-48 overflow-auto">
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Component Stack</p>
                  <pre className="text-xs text-slate-400 font-mono whitespace-pre-wrap break-words">
                    {errorInfo.componentStack}
                  </pre>
                </div>
              )}
              <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-4 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="text-slate-500 mb-1">时间</p>
                  <p className="text-slate-300 font-mono">{errorReport.timestamp}</p>
                </div>
                <div>
                  <p className="text-slate-500 mb-1">URL</p>
                  <p className="text-slate-300 font-mono truncate">{errorReport.url}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="bg-slate-900/40 border-t border-slate-700/30 px-6 py-4">
          <p className="text-xs text-slate-500 text-center">
            如果问题持续出现，请将错误报告发送给开发者以协助排查。
          </p>
        </div>
      </div>
    </div>
  );
}

export default ErrorBoundary;
