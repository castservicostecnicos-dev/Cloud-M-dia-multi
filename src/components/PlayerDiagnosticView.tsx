import React, { useState, useEffect } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  HelpCircle,
  Monitor,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Wifi,
  WifiOff,
  Copy,
  Check,
} from 'lucide-react';
import { Player } from '../types';

export interface DiagnosticPlayerData extends Pick<Player, 'id' | 'name' | 'code' | 'location'> {
  store_id?: string | null;
  store_name?: string;
  is_online: boolean;
  last_seen: string;
  expected_interval_seconds?: number;
  heartbeat_timeout_seconds?: number;
  orientation?: string;
}

interface PlayerDiagnosticViewProps {
  player: DiagnosticPlayerData;
  allPlayers?: DiagnosticPlayerData[];
  onSelectPlayer?: (playerId: string) => void;
  onRefresh: () => void;
  onOpenSimulation?: (code: string) => void;
  showToast?: (type: 'success' | 'error' | 'info', message: string) => void;
  onClose?: () => void;
}

export const PlayerDiagnosticView: React.FC<PlayerDiagnosticViewProps> = ({
  player,
  allPlayers = [],
  onSelectPlayer,
  onRefresh,
  onOpenSimulation,
  showToast,
  onClose,
}) => {
  // Live ticker to update elapsed seconds in real-time every second
  const [now, setNow] = useState<number>(Date.now());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Automatic ping verification loop: auto-syncs player signal from server every 4 seconds
  useEffect(() => {
    const autoRefreshTimer = setInterval(() => {
      onRefresh();
    }, 4000);
    return () => clearInterval(autoRefreshTimer);
  }, [onRefresh]);

  const expectedInterval = player.expected_interval_seconds || 20;
  const timeoutThreshold = player.heartbeat_timeout_seconds || 45;

  const lastSeenMs = player.last_seen ? new Date(player.last_seen).getTime() : 0;
  const hasEverConnected = Boolean(player.last_seen && lastSeenMs > 0);
  const elapsedMs = hasEverConnected ? Math.max(0, now - lastSeenMs) : Infinity;
  const elapsedSec = hasEverConnected ? Math.floor(elapsedMs / 1000) : Infinity;

  // Real-time calculation of status
  const isHealthy = hasEverConnected && elapsedSec <= expectedInterval;
  const isWaiting = hasEverConnected && elapsedSec > expectedInterval && elapsedSec <= timeoutThreshold;
  const isOffline = !hasEverConnected || elapsedSec > timeoutThreshold;

  // Format formatted timestamp
  const formattedTimestamp = hasEverConnected
    ? new Date(lastSeenMs).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : 'Nenhum registro de sinal';

  // Format relative elapsed time
  const formatElapsed = (sec: number) => {
    if (sec === Infinity) return 'Nunca conectado';
    if (sec < 60) return `${sec}s atrás`;
    const mins = Math.floor(sec / 60);
    const remainingSec = sec % 60;
    if (mins < 60) return `${mins}m ${remainingSec}s atrás`;
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return `${hours}h ${remainingMins}m atrás`;
  };

  const elapsedText = formatElapsed(elapsedSec);

  // Time difference vs expected interval
  const delaySec = hasEverConnected ? Math.max(0, elapsedSec - expectedInterval) : 0;
  const timeoutDiffSec = hasEverConnected ? elapsedSec - timeoutThreshold : 0;

  // Gauge percentage calculation (capped at 100% at 90s for visual meter)
  const maxScaleSec = 90;
  const gaugePercent = hasEverConnected
    ? Math.min(100, Math.max(0, (elapsedSec / maxScaleSec) * 100))
    : 100;

  const handleRefreshClick = async () => {
    setIsRefreshing(true);
    await onRefresh();
    setTimeout(() => {
      setIsRefreshing(false);
      if (showToast) {
        showToast('info', 'Status de conectividade dos players atualizado.');
      }
    }, 400);
  };

  const handleCopyLink = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const url = `${origin}/?player=${encodeURIComponent(player.code)}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      if (showToast) {
        showToast('success', `Link do player (${player.code}) copiado para a área de transferência.`);
      }
      setTimeout(() => setCopied(false), 2500);
    });
  };

  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-800/95 p-5 sm:p-6 shadow-xl text-slate-100 animate-in fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-700 pb-4 mb-5">
        <div className="flex items-center gap-3">
          <div
            className={`p-2.5 rounded-xl border shrink-0 ${
              isHealthy
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : isWaiting
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
            }`}
          >
            {isHealthy ? (
              <Wifi className="h-5 w-5" />
            ) : isWaiting ? (
              <Activity className="h-5 w-5" />
            ) : (
              <WifiOff className="h-5 w-5" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-white tracking-tight">
                Diagnóstico de Conectividade
              </h3>
              <span className="font-mono text-xs text-blue-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-700 font-bold">
                {player.code}
              </span>
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300 bg-emerald-950/80 border border-emerald-800/80 px-2.5 py-0.5 rounded-full shadow-xs">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Auto-verificação (4s)</span>
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {player.name} &bull; {player.location || 'Localização não informada'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {allPlayers.length > 1 && onSelectPlayer && (
            <select
              value={player.id}
              onChange={(e) => onSelectPlayer(e.target.value)}
              className="flex-1 sm:flex-initial rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-slate-200 focus:border-blue-500 focus:outline-none"
              title="Alternar player para diagnóstico"
            >
              {allPlayers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.code}) - {p.is_online ? 'Online' : 'Offline'}
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={handleRefreshClick}
            disabled={isRefreshing}
            className="flex-1 sm:flex-initial justify-center flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-700 transition cursor-pointer disabled:opacity-50 text-center"
            title="Atualizar batimento e status agora"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Verificar</span>
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900 text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-700 transition cursor-pointer"
              title="Fechar painel de diagnóstico"
            >
              Fechar
            </button>
          )}
        </div>
      </div>

      {/* Main Status Banner */}
      <div
        className={`rounded-xl border p-4 mb-6 transition ${
          isHealthy
            ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-200'
            : isWaiting
            ? 'bg-amber-950/40 border-amber-800/80 text-amber-200'
            : 'bg-rose-950/40 border-rose-800/80 text-rose-200'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3">
            <div
              className={`p-2 rounded-lg shrink-0 mt-0.5 sm:mt-0 ${
                isHealthy
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : isWaiting
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'bg-rose-500/20 text-rose-400'
              }`}
            >
              {isHealthy ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : isWaiting ? (
                <Clock className="h-5 w-5" />
              ) : (
                <AlertTriangle className="h-5 w-5" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-black uppercase tracking-wider">
                  {isHealthy
                    ? 'Player Online'
                    : isWaiting
                    ? 'Aguardando Sinal'
                    : 'Player Offline'}
                </h4>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    isHealthy
                      ? 'bg-emerald-500 text-slate-950'
                      : isWaiting
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-rose-600 text-white'
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      isHealthy ? 'bg-slate-950 animate-pulse' : isWaiting ? 'bg-slate-950' : 'bg-white'
                    }`}
                  />
                  {isHealthy ? 'Online' : isWaiting ? 'Alerta' : 'Offline'}
                </span>
              </div>
            </div>
          </div>

          <div className="shrink-0 flex items-center gap-2">
            <span className="font-mono text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white">
              {elapsedText}
            </span>
          </div>
        </div>
      </div>

      {/* Metric Cards Comparison (Last Heartbeat vs Expected Interval) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {/* Metric 1: Last Heartbeat Received */}
        <div className="rounded-xl border border-slate-700 bg-slate-900/80 p-4">
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider">Último Heartbeat</span>
            <Clock className="h-4 w-4 text-blue-400" />
          </div>
          <div className="font-bold text-white text-sm truncate" title={formattedTimestamp}>
            {hasEverConnected
              ? new Date(lastSeenMs).toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })
              : 'Sem registro'}
          </div>
          <p className="text-[11px] text-slate-400 mt-1 truncate">
            {hasEverConnected
              ? new Date(lastSeenMs).toLocaleDateString('pt-BR')
              : 'Dispositivo novo'}
          </p>
          <div className="mt-2 text-[10px] font-semibold text-blue-400 bg-blue-950/40 px-2 py-0.5 rounded border border-blue-900/50 inline-block">
            {elapsedText}
          </div>
        </div>

        {/* Metric 2: Expected Interval */}
        <div className="rounded-xl border border-slate-700 bg-slate-900/80 p-4">
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider">Intervalo Esperado</span>
            <Activity className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="font-bold text-white text-sm">A cada {expectedInterval}s</div>
          <p className="text-[11px] text-slate-400 mt-1">Frequência programada</p>
          <div className="mt-2 text-[10px] font-semibold text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-900/50 inline-block">
            Cadência contínua
          </div>
        </div>

        {/* Metric 3: Tolerance Threshold */}
        <div className="rounded-xl border border-slate-700 bg-slate-900/80 p-4">
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider">Tolerância Máxima</span>
            <ShieldAlert className="h-4 w-4 text-amber-400" />
          </div>
          <div className="font-bold text-white text-sm">{timeoutThreshold} segundos</div>
          <p className="text-[11px] text-slate-400 mt-1">Limite para status offline</p>
          <div className="mt-2 text-[10px] font-semibold text-amber-400 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-900/50 inline-block">
            Margem de rede
          </div>
        </div>

        {/* Metric 4: Delay / Variance */}
        <div className="rounded-xl border border-slate-700 bg-slate-900/80 p-4">
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider">Diferença / Atraso</span>
            <AlertTriangle
              className={`h-4 w-4 ${
                isOffline ? 'text-rose-400' : isWaiting ? 'text-amber-400' : 'text-emerald-400'
              }`}
            />
          </div>
          <div
            className={`font-bold text-sm ${
              isOffline ? 'text-rose-400' : isWaiting ? 'text-amber-400' : 'text-emerald-400'
            }`}
          >
            {!hasEverConnected
              ? 'Indeterminado'
              : delaySec === 0
              ? 'Sincronizado'
              : `+${delaySec}s atraso`}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            {isOffline
              ? `Excedeu limite em ${timeoutDiffSec}s`
              : isWaiting
              ? 'Próximo sinal pendente'
              : 'Dentro da janela regular'}
          </p>
          <div
            className={`mt-2 text-[10px] font-semibold px-2 py-0.5 rounded border inline-block ${
              isOffline
                ? 'text-rose-400 bg-rose-950/40 border-rose-900/50'
                : isWaiting
                ? 'text-amber-400 bg-amber-950/40 border-amber-900/50'
                : 'text-emerald-400 bg-emerald-950/40 border-emerald-900/50'
            }`}
          >
            {isOffline ? 'Offline crítico' : isWaiting ? 'Aguardando pulso' : 'Normal'}
          </div>
        </div>
      </div>

      {/* Visual Latency / Heartbeat Timeline Bar */}
      <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Linha do Tempo do Batimento (Heartbeat)
            </span>
            <span className="text-xs text-slate-300 font-mono">
              Tempo decorrido:{' '}
              <strong
                className={
                  isOffline ? 'text-rose-400' : isWaiting ? 'text-amber-400' : 'text-emerald-400'
                }
              >
                {hasEverConnected ? `${elapsedSec}s` : 'Sem sinal'}
              </strong>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-[10px] font-semibold text-slate-400">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> Esperado (0–20s)
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-amber-500" /> Tolerância (20–45s)
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-rose-500" /> Offline (&gt;45s)
            </span>
          </div>
        </div>

        {/* Gauge Track */}
        <div className="relative h-4 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800 flex">
          {/* Green zone: 0 to 20s (22.2% of 90s scale) */}
          <div
            style={{ width: `${(expectedInterval / maxScaleSec) * 100}%` }}
            className="h-full bg-emerald-600/70 border-r border-slate-900"
            title="Zona Saudável (0-20s)"
          />
          {/* Amber zone: 20 to 45s (27.8% of 90s scale) */}
          <div
            style={{ width: `${((timeoutThreshold - expectedInterval) / maxScaleSec) * 100}%` }}
            className="h-full bg-amber-600/70 border-r border-slate-900"
            title="Zona de Tolerância de Rede (20-45s)"
          />
          {/* Red zone: > 45s (50% of 90s scale) */}
          <div
            style={{ width: `${((maxScaleSec - timeoutThreshold) / maxScaleSec) * 100}%` }}
            className="h-full bg-rose-700/60"
            title="Zona Offline (>45s)"
          />

          {/* Real-time Indicator Pin */}
          {hasEverConnected && (
            <div
              className="absolute top-0 bottom-0 w-1 bg-white shadow-lg shadow-white/80 transition-all duration-300"
              style={{ left: `calc(${gaugePercent}% - 2px)` }}
              title={`Posição atual: ${elapsedSec}s`}
            />
          )}
        </div>

        {/* Marker Labels */}
        <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-1.5 px-0.5">
          <span>0s</span>
          <span className="text-emerald-400 font-bold">20s (Esperado)</span>
          <span className="text-amber-400 font-bold">45s (Limite)</span>
          <span>90s+</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-1 sm:flex sm:flex-wrap sm:items-center justify-end gap-2 border-t border-slate-700 pt-4 w-full">
          {/* Open player in new tab */}
          <a
            href={`/?player=${encodeURIComponent(player.code)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto justify-center flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-sm cursor-pointer text-center"
            title="Abrir a tela do player diretamente no navegador"
          >
            <Monitor className="h-3.5 w-3.5" />
            <span>Abrir Player ({player.code})</span>
            <ExternalLink className="h-3 w-3" />
          </a>

          {/* Copy direct link */}
          <button
            type="button"
            onClick={handleCopyLink}
            className="w-full sm:w-auto justify-center flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-700 text-xs font-semibold transition cursor-pointer text-center"
            title="Copiar URL para configurar no dispositivo do player"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{copied ? 'Copiado!' : 'Copiar URL'}</span>
          </button>

          {/* Simulation button if provided */}
          {onOpenSimulation && (
            <button
              type="button"
              onClick={() => onOpenSimulation(player.code)}
              className="w-full sm:w-auto justify-center flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-700 text-xs font-semibold transition cursor-pointer text-center"
              title="Testar a tela do player nesta mesma aba"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Simular Nesta Aba</span>
            </button>
          )}
      </div>
    </div>
  );
};
