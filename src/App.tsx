import React, { useState, useEffect } from 'react';
import { api, getStoredToken, setStoredToken } from './lib/api';
import { User, Player } from './types';
import { Navbar } from './components/Navbar';
import { LoginView } from './views/LoginView';
import { AdminDashboard } from './views/AdminDashboard';
import { CompanyDashboard } from './views/CompanyDashboard';
import { OperatorDashboard } from './views/OperatorDashboard';
import { PlayerView } from './views/PlayerView';
import { ToastContainer, ToastMessage } from './components/Toast';
import { OfflineIndicator } from './components/OfflineIndicator';
import { PresentationModal } from './components/PresentationModal';
import { KeyRound, X } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [companyInfo, setCompanyInfo] = useState<{ id: string; name: string } | undefined>();
  const [currentPlayer, setCurrentPlayer] = useState<Player | undefined>();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isAdminMaster, setIsAdminMaster] = useState<boolean>(() => {
    try {
      return localStorage.getItem('indoor_admin_master_session') === 'true';
    } catch {
      return false;
    }
  });

  // Commercial presentation modal
  const [presentationOpen, setPresentationOpen] = useState(false);

  // Player view simulation modal (for company/operator to test player live)
  const [simulatedPlayerCode, setSimulatedPlayerCode] = useState<string | null>(null);

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Password change modal
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passLoading, setPassLoading] = useState(false);

  const showToast = (type: 'success' | 'error' | 'info', text: string) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, type, text }]);
  };

  const handleDismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Restore session
  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setLoading(false);
      return;
    }

    // Try to load cached session immediately for instant offline start
    let hasLoadedFromCache = false;
    try {
      const cached = localStorage.getItem('indoor_cached_session');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.user) {
          setUser(parsed.user);
          setCompanyInfo(parsed.company);
          setCurrentPlayer(parsed.player);
          setLoading(false);
          hasLoadedFromCache = true;
        }
      }
    } catch (e) {
      console.warn('Failed to parse cached session:', e);
    }

    // Safety timeout: never leave user stuck on loading screen for more than 2 seconds
    const safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 2000);

    api.getMe()
      .then((res) => {
        clearTimeout(safetyTimer);
        setUser(res.user);
        setCompanyInfo(res.company);
        setCurrentPlayer(res.player);
        try {
          localStorage.setItem('indoor_cached_session', JSON.stringify(res));
        } catch (e) {}
      })
      .catch((err: any) => {
        clearTimeout(safetyTimer);
        // If offline or network error, maintain cached session so player continues functioning
        if (!navigator.onLine || err?.message?.includes('Failed to fetch') || err?.message?.includes('NetworkError') || err?.name === 'AbortError') {
          console.warn('Dispositivo em modo offline; mantendo sessão em cache local.');
          return;
        }
        // Only invalidate if the server responded with authentication rejection
        if (!hasLoadedFromCache) {
          setStoredToken(null);
          localStorage.removeItem('indoor_cached_session');
          setUser(null);
        }
      })
      .finally(() => {
        clearTimeout(safetyTimer);
        setLoading(false);
      });

    return () => clearTimeout(safetyTimer);
  }, []);

  const handleLoginSuccess = (data: { user: User; company?: { id: string; name: string }; player?: Player }) => {
    setUser(data.user);
    setCompanyInfo(data.company);
    setCurrentPlayer(data.player);
    if (data.user.role === 'admin') {
      setIsAdminMaster(true);
      try {
        localStorage.setItem('indoor_admin_master_session', 'true');
      } catch {}
    }
    try {
      localStorage.setItem('indoor_cached_session', JSON.stringify(data));
    } catch (e) {}
  };

  const handleLogout = () => {
    setStoredToken(null);
    localStorage.removeItem('indoor_cached_session');
    localStorage.removeItem('indoor_admin_master_session');
    setIsAdminMaster(false);
    setUser(null);
    setCompanyInfo(undefined);
    setCurrentPlayer(undefined);
    setSimulatedPlayerCode(null);
    showToast('info', 'Sessão encerrada com sucesso.');
  };

  const handleEnterCompany = async (companyId: string) => {
    try {
      const res = await api.impersonateCompany(companyId);
      setIsAdminMaster(true);
      try {
        localStorage.setItem('indoor_admin_master_session', 'true');
        localStorage.setItem('indoor_cached_session', JSON.stringify(res));
      } catch {}
      setStoredToken(res.token);
      setUser(res.user);
      setCompanyInfo(res.company);
      setCurrentPlayer(undefined);
      setSimulatedPlayerCode(null);
      showToast('success', `Painel da empresa "${res.company?.name || res.user.name}" aberto!`);
    } catch (err: any) {
      showToast('error', err.message || 'Erro ao acessar painel da empresa.');
    }
  };

  // Quick switch between accounts for fast testing
  const handleQuickSwitchRole = async (targetRole: string) => {
    try {
      let credentials: any = {};
      if (targetRole === 'admin') {
        credentials = { email: 'ale11062@gmail.com', password: 'Admin@123456' };
      } else if (targetRole === 'company' || targetRole === 'company-1') {
        credentials = { email: 'empresa@drogariasp.com.br', password: '123456' };
      } else if (targetRole === 'operator' || targetRole === 'operator-1') {
        credentials = { email: 'operador@drogariasp.com.br', password: '123456' };
      } else if (targetRole === 'player' || targetRole === 'player-1') {
        credentials = { playerCode: 'PLAY-REC-01' };
      } else if (targetRole === 'company-2') {
        credentials = { email: 'empresa@supermercado.com.br', password: '123456' };
      } else if (targetRole === 'operator-2') {
        credentials = { email: 'operador@supermercado.com.br', password: '123456' };
      } else if (targetRole === 'player-2') {
        credentials = { playerCode: 'PLAY-MERC-02' };
      }

      let res;
      try {
        res = await api.login(credentials);
      } catch (loginErr: any) {
        // Se a empresa foi excluída ou o usuário não existe, restaura dados demo e tenta novamente
        console.warn('Conta demo não encontrada ou excluída. Restaurando dados de teste automaticamente...');
        await api.seedDemoData();
        res = await api.login(credentials);
      }

      setStoredToken(res.token);
      setUser(res.user);
      setCompanyInfo(res.company);
      setCurrentPlayer(res.player);
      setSimulatedPlayerCode(null);
      showToast('success', `Alternado com sucesso para: ${res.user.name}`);
    } catch (err: any) {
      showToast('error', err.message || 'Erro ao alternar de perfil.');
    }
  };

  const handleSeedDemoData = async () => {
    try {
      const res = await api.seedDemoData();
      showToast('success', res.message || 'Dados de teste carregados com sucesso!');
      return res;
    } catch (err: any) {
      showToast('error', err.message || 'Erro ao carregar dados de teste.');
      throw err;
    }
  };

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      showToast('error', 'A senha deve ter no mínimo 6 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('error', 'As senhas digitadas não conferem.');
      return;
    }
    setPassLoading(true);
    try {
      const res = await api.changePassword(newPassword);
      showToast('success', res.message || 'Senha alterada com sucesso.');
      setChangePasswordOpen(false);
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      showToast('error', err.message || 'Erro ao alterar senha.');
    } finally {
      setPassLoading(false);
    }
  };

  // DIRECT PLAYER VIEW VIA UNIQUE URL (?token=TOKEN or ?player=CODE)
  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const urlPlayerParam = searchParams?.get('player') || searchParams?.get('playerCode') || null;
  const urlTokenParam = searchParams?.get('token') || searchParams?.get('player_token') || null;

  if (urlPlayerParam || urlTokenParam) {
    return (
      <div className="fixed inset-0 z-50 bg-black">
        <PlayerView
          overridePlayerCode={urlPlayerParam || undefined}
          overridePlayerToken={urlTokenParam || undefined}
          onExit={() => {
            window.location.search = '';
          }}
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col h-screen w-screen items-center justify-center bg-slate-900 text-slate-400 gap-3 p-4 text-center">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        <p className="text-xs text-slate-400 font-medium">Carregando Mídia Indoor...</p>
        <button
          type="button"
          onClick={() => {
            setLoading(false);
            setStoredToken(null);
            try {
              localStorage.removeItem('indoor_cached_session');
            } catch {}
            setUser(null);
          }}
          className="mt-2 text-xs text-blue-400 hover:text-blue-300 underline cursor-pointer"
        >
          Demorando para responder? Ir para o início
        </button>
      </div>
    );
  }

  // If not logged in, show Login Screen
  if (!user) {
    return (
      <>
        <OfflineIndicator />
        <ToastContainer toasts={toasts} onDismiss={handleDismissToast} />
        <LoginView
          onLoginSuccess={handleLoginSuccess}
          showToast={showToast}
        />
      </>
    );
  }

  // PLAYER VIEW: Fullscreen, no admin menu
  if (user.role === 'player') {
    return (
      <>
        <OfflineIndicator />
        <PlayerView onExit={handleLogout} />
      </>
    );
  }

  // SIMULATED PLAYER SCREEN (Pop-over modal for Company and Operator testing)
  if (simulatedPlayerCode) {
    return (
      <div className="fixed inset-0 z-50 bg-black">
        <PlayerView
          overridePlayerCode={simulatedPlayerCode}
          onExit={() => setSimulatedPlayerCode(null)}
        />
      </div>
    );
  }

  // ADMIN, COMPANY, OPERATOR VIEWS (With top Navbar)
  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-slate-900 text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      <OfflineIndicator />
      <ToastContainer toasts={toasts} onDismiss={handleDismissToast} />

      <Navbar
        user={user}
        companyName={companyInfo?.name}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onLogout={handleLogout}
        onChangePasswordClick={() => setChangePasswordOpen(true)}
        onQuickSwitchRole={handleQuickSwitchRole}
        isAdminMaster={isAdminMaster || user.role === 'admin'}
      />

      <main className="flex-1 w-full max-w-full overflow-x-hidden">
        {user.role === 'admin' && (
          <AdminDashboard
            showToast={showToast}
            onLogout={handleLogout}
            onQuickSwitchRole={handleQuickSwitchRole}
            onEnterCompany={handleEnterCompany}
            onOpenPlayerSimulation={(code) => setSimulatedPlayerCode(code)}
            onOpenPresentation={() => setPresentationOpen(true)}
            onSeedDemoData={handleSeedDemoData}
          />
        )}

        {user.role === 'company' && (
          <CompanyDashboard
            showToast={showToast}
            companyInfo={companyInfo}
            onOpenPlayerSimulation={(code) => setSimulatedPlayerCode(code)}
          />
        )}

        {user.role === 'operator' && (
          <OperatorDashboard
            showToast={showToast}
            onOpenPlayerSimulation={(code) => setSimulatedPlayerCode(code)}
          />
        )}
      </main>

      {/* MODAL ALTERAR SENHA */}
      {changePasswordOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 p-0 sm:p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-t-2xl sm:rounded-2xl border border-slate-700 bg-slate-800 p-5 sm:p-6 shadow-2xl text-slate-100 animate-in slide-in-from-bottom sm:slide-in-from-bottom-0">
            {/* Mobile Drag Indicator */}
            <div className="sm:hidden w-12 h-1.5 bg-slate-600 rounded-full mx-auto mb-3 shrink-0" />

            <div className="flex items-center justify-between mb-4 border-b border-slate-700 pb-3">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-blue-400" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-white">Alterar Minha Senha</h3>
              </div>
              <button
                onClick={() => setChangePasswordOpen(false)}
                className="text-slate-400 hover:text-white p-1.5 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleChangePasswordSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Nova Senha *</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full min-h-[44px] rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Confirmar Nova Senha *</label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita a nova senha"
                  className="w-full min-h-[44px] rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-700">
                <button
                  type="button"
                  onClick={() => setChangePasswordOpen(false)}
                  className="flex-1 sm:flex-initial min-h-[44px] px-4 py-2.5 rounded-lg border border-slate-600 bg-slate-700 text-xs font-bold uppercase tracking-wider text-slate-300 hover:text-white hover:bg-slate-600 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={passLoading}
                  className="flex-1 sm:flex-initial min-h-[44px] px-5 py-2.5 rounded-lg bg-blue-600 text-xs font-bold uppercase tracking-wider text-white hover:bg-blue-500 cursor-pointer disabled:opacity-50 shadow-sm"
                >
                  {passLoading ? 'Salvando...' : 'Salvar Senha'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Presentation Modal */}
      <PresentationModal
        isOpen={presentationOpen}
        onClose={() => setPresentationOpen(false)}
        defaultClientName={companyInfo?.name || ''}
      />
    </div>
  );
}
