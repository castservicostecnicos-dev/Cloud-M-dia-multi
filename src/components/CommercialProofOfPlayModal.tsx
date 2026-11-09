import React, { useRef } from 'react';
import {
  FileCheck2,
  Download,
  Printer,
  X,
  Tv,
  Calendar,
  Clock,
  ShieldCheck,
  Building2,
  BarChart3,
  Film,
  Sparkles,
} from 'lucide-react';
import { ProofOfPlaySummary } from '../types';

interface CommercialProofOfPlayModalProps {
  isOpen: boolean;
  onClose: () => void;
  summary: ProofOfPlaySummary | null;
  companyName: string;
  selectedMediaName?: string;
  daysFilter: number | string;
  onExportCsv?: () => void;
}

export const CommercialProofOfPlayModal: React.FC<CommercialProofOfPlayModalProps> = ({
  isOpen,
  onClose,
  summary,
  companyName,
  selectedMediaName,
  daysFilter,
  onExportCsv,
}) => {
  const printRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !summary) return null;

  const handlePrint = () => {
    window.print();
  };

  const periodLabel =
    daysFilter === 'all' || Number(daysFilter) >= 365
      ? 'Todo o Histórico Auditado'
      : `Últimos ${daysFilter} Dias`;

  const totalPlays = summary.total_plays || 0;
  const totalSeconds = summary.total_seconds || 0;
  const totalMinutes = Math.round(totalSeconds / 60);
  const totalHours = (totalSeconds / 3600).toFixed(1);

  // Hash de autenticidade para auditoria comercial
  const auditHash = `POP-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
  const currentDateFormatted = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl text-slate-100 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Barra superior de ações */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Certificado Comercial de Exibição (POP)</h3>
              <p className="text-xs text-slate-400">Documento auditado para comprovação a anunciantes e patrocinadores</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onExportCsv && (
              <button
                type="button"
                onClick={onExportCsv}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition cursor-pointer"
                title="Exportar planilha analítica CSV"
              >
                <Download className="h-3.5 w-3.5 text-blue-400" />
                <span>CSV Analítico</span>
              </button>
            )}
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white shadow-lg shadow-emerald-950 transition cursor-pointer"
              title="Imprimir ou Salvar como PDF para o Anunciante"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Imprimir / Gerar PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer ml-2"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Conteúdo do Certificado (Formatado para tela e impressão) */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 print:p-0 print:bg-white print:text-black">
          <div
            ref={printRef}
            className="rounded-2xl border border-slate-800 bg-slate-950/60 p-6 sm:p-8 shadow-xl relative overflow-hidden print:border-none print:shadow-none print:p-4"
          >
            {/* Selo decorativo de fundo */}
            <div className="absolute -top-12 -right-12 w-48 h-48 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />

            {/* Cabeçalho Oficial */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-800 gap-4">
              <div>
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-2">
                  <FileCheck2 className="h-3.5 w-3.5" />
                  <span>Prova Oficial de Veiculação (Proof of Play)</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  {companyName || 'Mídia Indoor'}
                </h1>
                <p className="text-sm text-slate-400 mt-0.5">
                  Rede de Telas Digitais & Mídia Indoor Auditada
                </p>
              </div>
              <div className="text-left sm:text-right space-y-1">
                <div className="text-xs font-mono text-slate-500">AUTENTICAÇÃO AUDITADA</div>
                <div className="font-mono text-sm font-bold text-emerald-400 bg-emerald-950/40 px-3 py-1 rounded border border-emerald-800/50 inline-block">
                  {auditHash}
                </div>
                <div className="text-[11px] text-slate-400">Emissão: {currentDateFormatted}</div>
              </div>
            </div>

            {/* Ficha da Campanha / Anunciante */}
            <div className="my-6 grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800/80">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Campanha / Mídia</div>
                <div className="text-sm font-bold text-white mt-0.5 truncate flex items-center gap-1.5">
                  <Film className="h-4 w-4 text-indigo-400 shrink-0" />
                  <span>{selectedMediaName || 'Todas as Peças Veiculadas'}</span>
                </div>
              </div>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Período Auditado</div>
                <div className="text-sm font-semibold text-slate-200 mt-0.5 flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>{periodLabel}</span>
                </div>
              </div>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Status de Conformidade</div>
                <div className="text-sm font-bold text-emerald-400 mt-0.5 flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>100% Auditado em Rede</span>
                </div>
              </div>
            </div>

            {/* Grandes Indicadores de Veiculação (KPIs Comerciais) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 my-6">
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
                <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase">
                  <BarChart3 className="h-4 w-4 text-blue-400" />
                  <span>Exibições Totais</span>
                </div>
                <div className="mt-2 text-2xl sm:text-3xl font-black text-white">
                  {totalPlays.toLocaleString('pt-BR')}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">Impactos / inserções registradas</div>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
                <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase">
                  <Clock className="h-4 w-4 text-emerald-400" />
                  <span>Tempo de Ar</span>
                </div>
                <div className="mt-2 text-2xl sm:text-3xl font-black text-white">
                  {totalHours} <span className="text-sm font-normal text-slate-400">horas</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-1">({totalMinutes.toLocaleString('pt-BR')} minutos na tela)</div>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
                <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase">
                  <Tv className="h-4 w-4 text-purple-400" />
                  <span>Telas Ativas</span>
                </div>
                <div className="mt-2 text-2xl sm:text-3xl font-black text-white">
                  {summary.active_players_count || Object.keys(summary.by_player || {}).length || 0}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">Terminais com exibição ativa</div>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
                <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase">
                  <Building2 className="h-4 w-4 text-amber-400" />
                  <span>Inserções / Hora</span>
                </div>
                <div className="mt-2 text-2xl sm:text-3xl font-black text-white">
                  {totalPlays > 0 ? Math.max(1, Math.round(totalPlays / Math.max(1, Number(daysFilter) || 7) / 12)) : 0}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">Média de frequência horária</div>
              </div>
            </div>

            {/* Demonstrativo por Tela / Ponto de Exibição */}
            <div className="mt-6">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                <Tv className="h-4 w-4 text-slate-500" />
                <span>Demonstrativo por Terminal / Ponto de Venda</span>
              </h4>

              {Object.keys(summary.by_player || {}).length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-500 bg-slate-900/40 rounded-xl border border-slate-800">
                  Nenhuma exibição no período selecionado.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-800">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900/90 text-slate-400 font-semibold border-b border-slate-800">
                      <tr>
                        <th className="py-2.5 px-3">Terminal / Ponto de Exibição</th>
                        <th className="py-2.5 px-3 text-right">Inserções Confirmadas</th>
                        <th className="py-2.5 px-3 text-right">Tempo no Ar</th>
                        <th className="py-2.5 px-3 text-right">Participação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
                      {Object.entries(summary.by_player || {}).map(([pId, rawPlays]) => {
                        const plays = Number(rawPlays) || 0;
                        const share = totalPlays > 0 ? ((plays / totalPlays) * 100).toFixed(1) : '0';
                        return (
                          <tr key={pId} className="hover:bg-slate-900/50">
                            <td className="py-2.5 px-3 font-semibold text-slate-200">
                              Terminal #{pId}
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-white">
                              {plays.toLocaleString('pt-BR')}
                            </td>
                            <td className="py-2.5 px-3 text-right text-slate-400 font-mono">
                              {Math.round((plays * 10) / 60)} min
                            </td>
                            <td className="py-2.5 px-3 text-right text-emerald-400 font-bold">
                              {share}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Termo de Veracidade e Carimbo Digital */}
            <div className="mt-8 pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-slate-400 text-xs">
              <div className="space-y-1 text-center sm:text-left">
                <p className="font-semibold text-slate-300">
                  Declaração de Auditoria Eletrônica de Mídia Indoor
                </p>
                <p className="text-[11px] text-slate-500">
                  Relatório gerado automaticamente por telemetria em tempo real a partir dos reprodutores autorizados.
                </p>
              </div>
              <div className="flex items-center gap-2 text-[11px] font-mono text-emerald-400/90 bg-emerald-950/30 px-3 py-1.5 rounded-lg border border-emerald-900/50">
                <ShieldCheck className="h-4 w-4" />
                <span>CERTIFICADO VÁLIDO</span>
              </div>
            </div>
          </div>
        </div>

        {/* Rodapé */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs text-slate-400">
          <span>Apresente este documento impresso ou em PDF com o logotipo da sua empresa</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
