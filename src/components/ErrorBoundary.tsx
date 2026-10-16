import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, LogOut } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  declare readonly props: Props;

  constructor(props: Props) {
    super(props);
  }

  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Erro não capturado:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    try {
      localStorage.removeItem('indoor_media_token');
      localStorage.removeItem('indoor_cached_session');
      localStorage.removeItem('indoor_admin_master_session');
      sessionStorage.clear();
    } catch {}
    window.location.href = window.location.pathname;
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto mb-4 border border-rose-500/30">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-bold text-white mb-2">Instabilidade no Carregamento</h2>
            <p className="text-xs text-slate-400 mb-6 leading-relaxed">
              O sistema detectou uma instabilidade temporária ao carregar a interface. Clique abaixo para restabelecer a conexão.
            </p>
            {this.state.error?.message && (
              <div className="mb-6 p-3 rounded-lg bg-slate-950 border border-slate-800 text-left">
                <span className="text-[10px] font-mono text-slate-500 block uppercase tracking-wider mb-1">Detalhe técnico</span>
                <p className="text-xs font-mono text-rose-300 break-words">{this.state.error.message}</p>
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <button
                onClick={this.handleReload}
                className="flex-1 min-h-[42px] px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-sm"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Recarregar Página</span>
              </button>
              <button
                onClick={this.handleReset}
                className="flex-1 min-h-[42px] px-4 py-2 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 hover:text-white font-semibold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <LogOut className="h-4 w-4" />
                <span>Limpar e Ir para Login</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
