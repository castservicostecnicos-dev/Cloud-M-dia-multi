import React, { useState } from 'react';
import { Tv, KeyRound, ArrowRight, Monitor, AlertCircle, CheckCircle2 } from 'lucide-react';
import { api, setStoredToken } from '../lib/api';
import { User, Player } from '../types';

interface LoginViewProps {
  onLoginSuccess: (data: { user: User; company?: { id: string; name: string }; player?: Player }) => void;
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess, showToast }) => {
  const [mode, setMode] = useState<'standard' | 'player_code'>('standard');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [playerCode, setPlayerCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Forgot password modal
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');

  // Mandatory password change modal
  const [mustChangeUser, setMustChangeUser] = useState<User | null>(null);
  const [pendingLoginData, setPendingLoginData] = useState<{
    user: User;
    company?: { id: string; name: string };
    player?: Player;
  } | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changeLoading, setChangeLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setLoading(true);

    try {
      const payload = mode === 'standard' ? { email, password } : { playerCode };
      const res = await api.login(payload);

      setStoredToken(res.token);

      if (res.user.must_change_password) {
        setMustChangeUser(res.user);
        setPendingLoginData(res);
        setLoading(false);
        return;
      }

      showToast('success', `Bem-vindo(a), ${res.user.name}!`);
      onLoginSuccess(res);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao efetuar login.');
    } finally {
      setLoading(false);
    }
  };

  const handleMandatoryPasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setErrorMessage('A nova senha deve possuir no mínimo 6 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage('A confirmação de senha não confere.');
      return;
    }

    setChangeLoading(true);
    setErrorMessage('');

    try {
      await api.changePassword(newPassword);
      showToast('success', 'Senha redefinida com sucesso!');
      if (mustChangeUser) {
        const updatedUser = { ...mustChangeUser, must_change_password: false };
        onLoginSuccess({
          ...(pendingLoginData || {}),
          user: updatedUser,
        });
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao alterar senha.');
    } finally {
      setChangeLoading(false);
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) return;
    try {
      const res = await api.forgotPassword(forgotEmail);
      setForgotSuccess(res.message);
    } catch (err: any) {
      setErrorMessage(err.message);
    }
  };

  return (
    <div className="flex min-h-screen flex-col justify-center items-center px-3 py-8 sm:px-6 lg:px-8 bg-slate-900 w-full max-w-full overflow-x-hidden">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center">
          <img
            src="/pwa-192x192.png"
            alt="CAST Mídia Indoor"
            className="mx-auto h-20 w-20 sm:h-24 sm:w-24 rounded-2xl object-cover shadow-2xl shadow-blue-950/80 border border-slate-700/80"
          />
          <h1 className="mt-4 text-xl sm:text-3xl font-bold tracking-tight text-white uppercase">
            CAST <span className="text-blue-400">MÍDIA INDOOR</span>
          </h1>
        </div>

        {/* Login Box */}
        <div className="rounded-2xl border border-slate-700 bg-slate-800 p-5 sm:p-8 shadow-2xl">
          {errorMessage && (
            <div className="mb-5 flex items-center gap-2.5 rounded-lg border border-rose-800/80 bg-rose-950/40 p-3 text-xs font-medium text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Mode Selector */}
          <div className="mb-6 flex rounded-lg bg-slate-900 p-1 text-xs font-bold uppercase tracking-wider border border-slate-700">
            <button
              type="button"
              onClick={() => {
                setMode('standard');
                setErrorMessage('');
              }}
              className={`flex-1 rounded-md py-2 text-center transition cursor-pointer ${
                mode === 'standard' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Acesso por E-mail
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('player_code');
                setErrorMessage('');
              }}
              className={`flex-1 rounded-md py-2 text-center transition cursor-pointer ${
                mode === 'player_code' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Código do Player (TV)
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'standard' ? (
              <>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">E-mail</label>
                  <input
                    id="input-login-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu.email@empresa.com"
                    className="mt-1.5 block w-full rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Senha</label>
                    <button
                      id="btn-forgot-password"
                      type="button"
                      onClick={() => {
                        setForgotOpen(true);
                        setForgotSuccess('');
                        setForgotEmail(email);
                      }}
                      className="text-xs text-blue-400 hover:text-blue-300 font-semibold cursor-pointer"
                    >
                      Esqueci minha senha
                    </button>
                  </div>
                  <input
                    id="input-login-password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="mt-1.5 block w-full rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </>
            ) : (
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Código de Ativação do Player</label>
                <div className="relative mt-1.5">
                  <input
                    id="input-player-code"
                    type="text"
                    required
                    value={playerCode}
                    onChange={(e) => setPlayerCode(e.target.value.toUpperCase())}
                    placeholder="EX: PLAY-REC-01"
                    className="block w-full rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-3 text-base uppercase font-mono tracking-wider text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                  />
                  <Monitor className="absolute right-3.5 top-3.5 h-5 w-5 text-slate-500" />
                </div>
              </div>
            )}

            <button
              id="btn-login-submit"
              type="submit"
              disabled={loading}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-xs font-bold uppercase tracking-wider text-white shadow-md hover:bg-blue-500 focus:outline-none transition cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <span>Entrando...</span>
              ) : (
                <>
                  <span>Entrar</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Mandatory Password Change Modal (First Access) */}
      {mustChangeUser && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 p-0 sm:p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl border border-slate-700 bg-slate-800 p-5 sm:p-6 shadow-2xl text-slate-100 animate-in slide-in-from-bottom sm:slide-in-from-bottom-0">
            {/* Mobile Drag Indicator */}
            <div className="sm:hidden w-12 h-1.5 bg-slate-600 rounded-full mx-auto mb-3 shrink-0" />

            <div className="flex items-center gap-3 border-b border-slate-700 pb-3 mb-4">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-white">Alteração de Senha</h3>
              </div>
            </div>

            {errorMessage && (
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-rose-800 bg-rose-950/40 p-3 text-xs text-rose-300">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleMandatoryPasswordChange} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Nova Senha</label>
                <input
                  id="input-change-new-password"
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full min-h-[44px] rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Confirme a Nova Senha</label>
                <input
                  id="input-change-confirm-password"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita a nova senha"
                  className="w-full min-h-[44px] rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="pt-2 border-t border-slate-700">
                <button
                  id="btn-save-new-password"
                  type="submit"
                  disabled={changeLoading}
                  className="w-full min-h-[44px] rounded-lg bg-blue-600 py-3 text-xs font-bold uppercase tracking-wider text-white hover:bg-blue-500 shadow-sm transition cursor-pointer disabled:opacity-50"
                >
                  {changeLoading ? 'Salvando...' : 'Salvar Nova Senha e Continuar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Forgot Password Modal */}
      {forgotOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 p-0 sm:p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl border border-slate-700 bg-slate-800 p-5 sm:p-6 shadow-2xl text-slate-100 animate-in slide-in-from-bottom sm:slide-in-from-bottom-0">
            {/* Mobile Drag Indicator */}
            <div className="sm:hidden w-12 h-1.5 bg-slate-600 rounded-full mx-auto mb-3 shrink-0" />

            <h3 className="text-sm font-bold uppercase tracking-wider text-white border-b border-slate-700 pb-3 mb-4">Recuperar Senha</h3>

            {forgotSuccess ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 rounded-lg border border-emerald-800 bg-emerald-950/40 p-3 text-xs text-emerald-300">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                  <span>{forgotSuccess}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setForgotOpen(false)}
                  className="w-full min-h-[44px] rounded-lg bg-slate-700 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-200 hover:bg-slate-600 transition cursor-pointer"
                >
                  Voltar ao Login
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">E-mail</label>
                  <input
                    type="email"
                    required
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="seu.email@empresa.com"
                    className="w-full min-h-[44px] rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-700">
                  <button
                    type="button"
                    onClick={() => setForgotOpen(false)}
                    className="flex-1 sm:flex-initial min-h-[44px] px-4 py-2.5 rounded-lg border border-slate-600 bg-slate-700 text-xs font-bold uppercase tracking-wider text-slate-300 hover:text-white hover:bg-slate-600 transition cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 sm:flex-initial min-h-[44px] px-4 py-2.5 rounded-lg bg-blue-600 text-xs font-bold uppercase tracking-wider text-white hover:bg-blue-500 shadow-sm transition cursor-pointer"
                  >
                    Enviar Instruções
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
