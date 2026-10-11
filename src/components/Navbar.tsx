import React, { useState } from 'react';
import { Tv, LogOut, User as UserIcon, Shield, Building2, PhoneCall, KeyRound, MonitorPlay, ChevronDown } from 'lucide-react';
import { User } from '../types';
import { PWAInstallButton } from './PWAInstallButton';

interface NavbarProps {
  user: User;
  companyName?: string;
  activeTab: string;
  onSelectTab: (tab: string) => void;
  onLogout: () => void;
  onChangePasswordClick: () => void;
  onQuickSwitchRole?: (role: string) => void;
  isAdminMaster?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  companyName,
  activeTab,
  onSelectTab,
  onLogout,
  onChangePasswordClick,
  onQuickSwitchRole,
  isAdminMaster,
}) => {
  const [profileOpen, setProfileOpen] = useState(false);

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin':
        return 'Admin Geral';
      case 'company':
        return 'Empresa';
      case 'operator':
        return 'Operador';
      case 'player':
        return 'Player';
      default:
        return role;
    }
  };

  const roleColors = {
    admin: 'bg-purple-950/80 text-purple-300 border-purple-800',
    company: 'bg-blue-950/80 text-blue-300 border-blue-800',
    operator: 'bg-emerald-950/80 text-emerald-300 border-emerald-800',
    player: 'bg-amber-950/80 text-amber-300 border-amber-800',
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-700 bg-slate-800 shadow-lg">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-8">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <img
            src="/apple-touch-icon.png"
            alt="CAST Mídia Indoor"
            className="w-9 h-9 rounded-xl object-cover shadow-sm shrink-0 border border-slate-700/80"
          />
          <div>
            <div className="flex items-center gap-2.5">
              <span className="text-base sm:text-xl font-bold tracking-tight uppercase text-white">
                CAST <span className="text-blue-400 font-semibold text-sm sm:text-base">MÍDIA INDOOR</span>
              </span>
              <span className={`hidden xs:inline text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${roleColors[user.role]}`}>
                {getRoleLabel(user.role)}
              </span>
            </div>
            {companyName && (
              <p className="text-xs text-slate-400 font-medium truncate max-w-[180px] sm:max-w-xs">{companyName}</p>
            )}
          </div>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-3 sm:gap-6">
          <PWAInstallButton />

          {/* Return to Admin Button when inspecting a company/operator */}
          {onQuickSwitchRole && isAdminMaster && user.role !== 'admin' && (
            <button
              type="button"
              onClick={() => onQuickSwitchRole('admin')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold uppercase tracking-wider shadow-md border border-purple-400/40 transition cursor-pointer"
              title="Voltar para o Painel de Administração Geral (DEV)"
            >
              <Shield className="h-3.5 w-3.5" />
              <span>Voltar ao Admin</span>
            </button>
          )}

          {/* Quick Demo Role Switcher (Exclusivo Admin Geral) */}
          {onQuickSwitchRole && (user.role === 'admin' || isAdminMaster) && (
            <div className="hidden xl:flex items-center gap-1 bg-slate-900/60 p-1 rounded-lg border border-slate-700 text-xs text-slate-300">
              <span className="px-1.5 text-slate-500 text-[10px] font-bold uppercase tracking-wider">Acesso Rápido:</span>
              <button
                type="button"
                onClick={() => onQuickSwitchRole('admin')}
                className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition cursor-pointer ${
                  user.role === 'admin' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                Admin
              </button>
              <button
                type="button"
                onClick={() => onQuickSwitchRole('company')}
                className="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider text-blue-300 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                title="Entrar como Drogarias SP"
              >
                Farmácia
              </button>
              <button
                type="button"
                onClick={() => onQuickSwitchRole('company-2')}
                className="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider text-emerald-300 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                title="Entrar como Supermercado Central"
              >
                Supermercado
              </button>
              <button
                type="button"
                onClick={() => onQuickSwitchRole('operator')}
                className="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider text-amber-300 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                title="Entrar como Operador"
              >
                Operador
              </button>
              <button
                type="button"
                onClick={() => onQuickSwitchRole('player')}
                className="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider text-cyan-300 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                title="Abrir Player TV"
              >
                Player
              </button>
            </div>
          )}

          {/* User profile dropdown */}
          <div className="relative">
            <button
              id="btn-profile-dropdown"
              onClick={() => setProfileOpen(!profileOpen)}
              className="flex items-center gap-3 p-1 rounded-lg hover:bg-slate-700/50 transition cursor-pointer text-left"
            >
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold text-white uppercase tracking-tight truncate max-w-[130px]">{user.name}</p>
                <p className="text-[10px] text-blue-400 uppercase font-bold tracking-tighter">{getRoleLabel(user.role)}</p>
              </div>
              <div className="w-9 h-9 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center text-xs font-bold text-slate-200">
                {getInitials(user.name) || <UserIcon className="h-4 w-4 text-blue-400" />}
              </div>
              <ChevronDown className="h-3 w-3 text-slate-400 hidden sm:block" />
            </button>

            {profileOpen && (
              <div
                className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-700 bg-slate-800 p-2 shadow-2xl text-slate-100 animate-in fade-in z-50"
                onClick={() => setProfileOpen(false)}
              >
                <div className="border-b border-slate-700 px-3 py-2">
                  <p className="text-xs font-bold text-white uppercase tracking-tight truncate">{user.name}</p>
                  <p className="text-[11px] text-slate-400 truncate">{user.email}</p>
                </div>

                <div className="pt-1 space-y-0.5">
                  {onQuickSwitchRole && user.role === 'admin' && (
                    <div className="xl:hidden px-3 py-2 border-b border-slate-700">
                      <p className="text-[10px] uppercase font-bold text-slate-400 mb-1.5">Alternar Perfil:</p>
                      <div className="grid grid-cols-2 gap-1 text-[10px] font-bold">
                        <button
                          onClick={() => onQuickSwitchRole('admin')}
                          className="px-2 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-white text-center cursor-pointer"
                        >
                          Admin
                        </button>
                        <button
                          onClick={() => onQuickSwitchRole('company')}
                          className="px-2 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-white text-center cursor-pointer"
                        >
                          Empresa
                        </button>
                        <button
                          onClick={() => onQuickSwitchRole('operator')}
                          className="px-2 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-white text-center cursor-pointer"
                        >
                          Operador
                        </button>
                        <button
                          onClick={() => onQuickSwitchRole('player')}
                          className="px-2 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-white text-center cursor-pointer"
                        >
                          Player
                        </button>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={onChangePasswordClick}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 hover:text-white transition cursor-pointer"
                  >
                    <KeyRound className="h-3.5 w-3.5 text-slate-400" />
                    <span>Alterar Senha</span>
                  </button>

                  <button
                    id="btn-logout"
                    onClick={onLogout}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wider text-rose-400 hover:bg-rose-950/40 transition cursor-pointer"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    <span>Encerrar Sessão</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
