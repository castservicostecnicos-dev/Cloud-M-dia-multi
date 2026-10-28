import React, { useState, useEffect } from 'react';
import {
  Cloud,
  Key,
  Database,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Save,
  RefreshCw,
  HelpCircle,
  X,
  Lock,
  Globe,
  UploadCloud,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { api } from '../lib/api';
import { R2Settings } from '../types';

interface CloudflareR2ConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export const CloudflareR2ConfigModal: React.FC<CloudflareR2ConfigModalProps> = ({
  isOpen,
  onClose,
  onSaved,
}) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  const [form, setForm] = useState<Partial<R2Settings> & { has_secret?: boolean; is_configured?: boolean }>({
    enabled: true,
    account_id: '',
    access_key_id: '',
    secret_access_key: '',
    bucket_name: '',
    public_domain: '',
    auto_upload_on_add: true,
  });

  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      setFeedback(null);
      const res = await api.getR2Settings();
      if (res?.settings) {
        setForm({
          enabled: res.settings.enabled ?? true,
          account_id: res.settings.account_id || '',
          access_key_id: res.settings.access_key_id || '',
          secret_access_key: res.settings.secret_access_key || '',
          bucket_name: res.settings.bucket_name || '',
          public_domain: res.settings.public_domain || '',
          auto_upload_on_add: res.settings.auto_upload_on_add ?? true,
          has_secret: res.settings.has_secret,
          is_configured: res.settings.is_configured,
          last_tested_at: res.settings.last_tested_at,
          last_test_status: res.settings.last_test_status,
          last_test_message: res.settings.last_test_message,
        });
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Falha ao carregar configurações do R2.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async () => {
    try {
      setTesting(true);
      setFeedback(null);
      const res = await api.testR2Connection({
        account_id: form.account_id,
        access_key_id: form.access_key_id,
        secret_access_key: form.secret_access_key,
        bucket_name: form.bucket_name,
      });

      if (res.success) {
        setFeedback({
          type: 'success',
          message: res.message || 'Conexão testada com sucesso! O bucket R2 está pronto para receber mídias.',
        });
      } else {
        setFeedback({
          type: 'error',
          message: res.message || 'Não foi possível conectar ao bucket R2.',
        });
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Erro durante o teste de conexão com o Cloudflare R2.',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setFeedback(null);
      const res = await api.updateR2Settings(form);
      if (res?.settings) {
        setForm((prev) => ({
          ...prev,
          ...res.settings,
        }));
      }

      if (res?.testResult && !res.testResult.success) {
        setFeedback({
          type: 'error',
          message: `Configurações salvas, porém o teste falhou: ${res.testResult.message}`,
        });
      } else {
        setFeedback({
          type: 'success',
          message: 'Configurações do Cloudflare R2 salvas e ativadas com sucesso!',
        });
      }

      if (onSaved) onSaved();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Erro ao salvar configurações do R2.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSyncLocalMedia = async () => {
    if (!window.confirm('Deseja enviar todas as mídias locais armazenadas no servidor para o Cloudflare R2?')) {
      return;
    }
    try {
      setSyncing(true);
      setFeedback(null);
      const res = await api.syncLocalMediaToR2();
      if (res.syncedCount > 0) {
        setFeedback({
          type: 'success',
          message: `${res.syncedCount} mídia(s) enviada(s) com sucesso para o Cloudflare R2!`,
        });
        if (onSaved) onSaved();
      } else {
        setFeedback({
          type: 'info',
          message: 'Todas as mídias já estão sincronizadas com o Cloudflare R2 ou não há mídias locais pendentes.',
        });
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Erro ao sincronizar mídias com o R2.',
      });
    } finally {
      setSyncing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-slate-800 p-4 sm:p-5 bg-gradient-to-r from-orange-950/40 via-slate-900 to-slate-900">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/20 text-orange-400 border border-orange-500/30">
              <Cloud className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">Armazenamento Cloudflare R2</h3>
                <span className="rounded-full bg-orange-500/20 border border-orange-500/30 px-2 py-0.5 text-[10px] font-bold text-orange-300">
                  Definitivo • 0 Egress
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Salva fotos e vídeos automaticamente sem expiração de token e com tráfego 100% grátis
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`mx-4 sm:mx-6 mt-4 p-3 rounded-xl border text-xs flex items-center gap-2.5 ${
              feedback.type === 'success'
                ? 'bg-emerald-950/80 border-emerald-700/80 text-emerald-200'
                : feedback.type === 'error'
                ? 'bg-rose-950/80 border-rose-700/80 text-rose-200'
                : 'bg-blue-950/80 border-blue-700/80 text-blue-200'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            ) : feedback.type === 'error' ? (
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            ) : (
              <Cloud className="h-4 w-4 shrink-0 text-blue-400" />
            )}
            <div className="flex-1 font-medium">{feedback.message}</div>
          </div>
        )}

        {/* Conteúdo / Formulário */}
        <form onSubmit={handleSave} className="p-4 sm:p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Status e Toggle Ativo */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white">Status da Integração R2</span>
                {form.last_test_status === 'success' ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-400 border border-emerald-500/30">
                    <CheckCircle2 className="h-3 w-3" /> Conectado & Operante
                  </span>
                ) : form.is_configured ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-400 border border-amber-500/30">
                    <AlertCircle className="h-3 w-3" /> Configurado (Aguardando Teste)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-md bg-slate-800 px-2 py-0.5 text-[11px] font-semibold text-slate-400">
                    Não Configurado
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                Quando ativado, todo arquivo de mídia enviado pelos clientes será salvo no Cloudflare R2
              </p>
            </div>

            <label className="flex items-center gap-2 cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
                className="h-4 w-4 rounded border-slate-700 bg-slate-800 text-orange-500 focus:ring-orange-500"
              />
              <span className="text-xs font-bold text-white">Ativar R2</span>
            </label>
          </div>

          {/* Tutorial Colapsável */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowTutorial(!showTutorial)}
              className="w-full p-3 flex items-center justify-between text-left hover:bg-slate-800/40 transition cursor-pointer"
            >
              <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                <HelpCircle className="h-4 w-4 text-orange-400" />
                <span>Como obter as chaves no Cloudflare R2 (Passo a Passo)</span>
              </div>
              {showTutorial ? (
                <ChevronUp className="h-4 w-4 text-slate-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-slate-400" />
              )}
            </button>

            {showTutorial && (
              <div className="p-3.5 border-t border-slate-800/80 bg-slate-900/50 space-y-2 text-xs text-slate-300">
                <ol className="list-decimal list-inside space-y-1.5 text-slate-400">
                  <li>
                    Acesse o painel da Cloudflare (<a href="https://dash.cloudflare.com" target="_blank" rel="noreferrer" className="text-orange-400 underline inline-flex items-center gap-0.5">dash.cloudflare.com <ExternalLink className="h-2.5 w-2.5" /></a>) e clique em <strong className="text-white">R2</strong> no menu esquerdo.
                  </li>
                  <li>
                    Clique em <strong className="text-white">Create bucket</strong> (Criar bucket) e dê um nome, por exemplo: <code className="bg-slate-800 px-1 py-0.5 rounded text-orange-300">indoor-midia</code>.
                  </li>
                  <li>
                    No menu lateral do R2, clique em <strong className="text-white">Manage R2 API Tokens</strong> (Gerenciar Tokens de API do R2) e depois em <strong className="text-white">Create API Token</strong>.
                  </li>
                  <li>
                    Selecione as permissões: <strong className="text-white">Object Read & Write</strong> (Leitura e Gravação).
                  </li>
                  <li>
                    Copie a <strong className="text-white">Access Key ID</strong>, a <strong className="text-white">Secret Access Key</strong> e o seu <strong className="text-white">Account ID</strong> e cole nos campos abaixo.
                  </li>
                  <li>
                    Em <strong className="text-white">Settings</strong> do seu bucket, em <strong className="text-white">CORS Policy</strong>, adicione permissão de origem:
                    <div className="mt-1 p-2 rounded bg-slate-950 font-mono text-[10px] text-orange-200 overflow-x-auto">
                      {`[{"AllowedOrigins": ["*"], "AllowedMethods": ["GET", "PUT", "POST", "HEAD"], "AllowedHeaders": ["*"]}]`}
                    </div>
                  </li>
                  <li>
                    (Opcional): Na aba de configurações do seu bucket, ative <strong className="text-white">R2.dev subdomain</strong> ou adicione um domínio customizado (ex: <code className="text-orange-300">midia.seusite.com</code>).
                  </li>
                </ol>
              </div>
            )}
          </div>

          {/* Grid de Campos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Account ID */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-300">
                Account ID (ID da Conta Cloudflare) <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={form.account_id || ''}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const clean = raw.replace(/^https?:\/\//i, '').replace(/\.r2\.cloudflarestorage\.com.*$/i, '').replace(/dash\.cloudflare\.com\/?/i, '').split('/')[0].trim();
                    setForm({ ...form, account_id: clean });
                  }}
                  placeholder="ex: 8a4c19ef58b432a188f..."
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-600 focus:border-orange-500 focus:outline-none font-mono"
                  required
                />
              </div>
              <p className="text-[10px] text-slate-500">ID alfanumérico de 32 caracteres (sem https:// e sem .r2...)</p>
            </div>

            {/* Bucket Name */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-300">
                Nome do Bucket (Bucket Name) <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={form.bucket_name || ''}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const clean = raw.replace(/^https?:\/\//i, '').replace(/\/.*$/, '').trim();
                    setForm({ ...form, bucket_name: clean });
                  }}
                  placeholder="ex: indoor-midia"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-600 focus:border-orange-500 focus:outline-none font-mono"
                  required
                />
              </div>
              <p className="text-[10px] text-slate-500">Nome exato do bucket criado no R2</p>
            </div>

            {/* Access Key ID */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-300">
                Access Key ID (ID da Chave) <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={form.access_key_id || ''}
                  onChange={(e) => setForm({ ...form, access_key_id: e.target.value })}
                  placeholder="ex: b9a7852c019d38..."
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-600 focus:border-orange-500 focus:outline-none font-mono"
                  required
                />
              </div>
            </div>

            {/* Secret Access Key */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-300">
                Secret Access Key (Chave Secreta) <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={form.secret_access_key || ''}
                  onChange={(e) => setForm({ ...form, secret_access_key: e.target.value })}
                  placeholder={form.has_secret ? '•••••••••••••••• (Já gravada)' : 'Cole a chave secreta'}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-600 focus:border-orange-500 focus:outline-none font-mono"
                />
              </div>
              <p className="text-[10px] text-slate-500">Chave secreta S3 gerada ao criar o token do R2</p>
            </div>
          </div>

          {/* Domínio Público (Opcional) */}
          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-300">
              Domínio Público / Custom Domain (Opcional)
            </label>
            <div className="relative">
              <Globe className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <input
                type="text"
                value={form.public_domain || ''}
                onChange={(e) => setForm({ ...form, public_domain: e.target.value })}
                placeholder="ex: https://pub-xxxxxx.r2.dev ou https://midia.seusite.com.br"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 pl-9 pr-3 py-2 text-xs text-white placeholder-slate-600 focus:border-orange-500 focus:outline-none"
              />
            </div>
            <p className="text-[10px] text-slate-500">
              URL pública do R2 ou subdomínio Cloudflare para servir mídias com CDN ultrarrápida
            </p>
          </div>

          {/* Checkbox Auto Upload */}
          <div className="pt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.auto_upload_on_add}
                onChange={(e) => setForm({ ...form, auto_upload_on_add: e.target.checked })}
                className="h-4 w-4 rounded border-slate-700 bg-slate-800 text-orange-500 focus:ring-orange-500"
              />
              <span className="text-xs text-slate-300 font-medium">
                Enviar automaticamente mídias carregadas para o R2 ao fazer upload
              </span>
            </label>
          </div>

          {/* Rodapé / Botões */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={handleSyncLocalMedia}
              disabled={syncing || !form.is_configured}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 hover:text-white transition cursor-pointer disabled:opacity-40"
              title="Faz o upload de arquivos locais antigos para o Cloudflare R2"
            >
              <UploadCloud className={`h-3.5 w-3.5 ${syncing ? 'animate-bounce text-orange-400' : ''}`} />
              <span>{syncing ? 'Sincronizando...' : 'Sincronizar Mídias Locais para o R2'}</span>
            </button>

            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testing || !form.account_id || !form.access_key_id}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-orange-500/40 bg-orange-500/10 hover:bg-orange-500/20 text-xs font-bold text-orange-300 transition cursor-pointer disabled:opacity-40"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${testing ? 'animate-spin' : ''}`} />
                <span>{testing ? 'Testando...' : 'Testar Conexão'}</span>
              </button>

              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-xs font-bold text-white shadow-sm transition cursor-pointer disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" />
                <span>{saving ? 'Salvando...' : 'Salvar e Ativar R2'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
