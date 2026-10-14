import React, { useState, useEffect, useRef } from 'react';
import {
  Building2,
  Layers,
  Monitor,
  Plus,
  CheckCircle,
  XCircle,
  KeyRound,
  Edit2,
  Power,
  Shield,
  Tv,
  Radio,
  ArrowRight,
  Copy,
  Check,
  ExternalLink,
  Sparkles,
  Search,
  X,
  Filter,
  FileSpreadsheet,
  UploadCloud,
  Trash2,
  Loader2,
  AlertCircle,
  Database,
  RefreshCw,
  CheckCircle2,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Download,
  Upload,
  Folder,
  Store,
  MapPin,
  GitBranch,
  Cloud,
} from 'lucide-react';
import { api } from '../lib/api';
import { Company, CompanyStore, Plan, AdminStats, MediaIntegrityAuditReport } from '../types';
import { ConfirmModal } from '../components/ConfirmModal';
import { GoogleDriveFileManager } from '../components/GoogleDriveFileManager';
import { CloudflareR2ConfigModal } from '../components/CloudflareR2ConfigModal';

interface AdminDashboardProps {
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
  onLogout: () => void;
  onQuickSwitchRole?: (role: string) => void;
  onEnterCompany?: (companyId: string) => void;
  onOpenPlayerSimulation?: (code: string) => void;
  onOpenPresentation?: () => void;
  onSeedDemoData?: () => Promise<any>;
}

const PLAN_TEMPLATES = [
  {
    type: 'call',
    name: 'Call Básico',
    description: '1 tela com chamadas no painel e até 4 operadores de atendimento (proporção 4:1).',
    max_players: 1,
    max_operators: 4,
    max_storage: 50,
    monthly_price: 49,
    tag: 'R$ 49 | 1 Tela | 4 Op',
  },
  {
    type: 'call',
    name: 'Call Intermediário',
    description: '3 telas com chamadas no painel e até 12 operadores de atendimento (proporção 4:1).',
    max_players: 3,
    max_operators: 12,
    max_storage: 150,
    monthly_price: 109,
    tag: 'R$ 109 | 3 Telas | 12 Op',
  },
  {
    type: 'call',
    name: 'Call Pro',
    description: '6 telas com chamadas simultâneas e até 24 operadores de atendimento (proporção 4:1).',
    max_players: 6,
    max_operators: 24,
    max_storage: 300,
    monthly_price: 229,
    tag: 'R$ 229 | 6 Telas | 24 Op',
  },
  {
    type: 'show',
    name: 'Show Básico',
    description: 'Exibição de mídia indoor, propagandas, hora certa e notícias RSS em até 2 telas (sem operador).',
    max_players: 2,
    max_operators: 0,
    max_storage: 50,
    monthly_price: 29,
    tag: 'R$ 29 | 2 Telas | 0 Op',
  },
  {
    type: 'show',
    name: 'Show Intermediário',
    description: 'Até 5 telas simultâneas com notícias e mídias institucionais sem operadores.',
    max_players: 5,
    max_operators: 0,
    max_storage: 150,
    monthly_price: 89,
    tag: 'R$ 89 | 5 Telas | 0 Op',
  },
  {
    type: 'show',
    name: 'Show Pro',
    description: 'Até 12 telas para redes e múltiplos pontos comerciais sem operadores.',
    max_players: 12,
    max_operators: 0,
    max_storage: 500,
    monthly_price: 149,
    tag: 'R$ 149 | 12 Telas | 0 Op',
  },
  {
    type: 'special',
    name: 'Especial Sob Medida',
    description: 'Plano customizado com quantidade de telas e operadores definida livremente para o cliente.',
    max_players: 2,
    max_operators: 10,
    max_storage: 150,
    monthly_price: 119,
    tag: 'Sob Medida | 2 Telas | 10 Op',
  },
  {
    type: 'special',
    name: 'Especial Corporativo',
    description: 'Plano especial sob medida para médias e grandes empresas com alta demanda de guichês.',
    max_players: 4,
    max_operators: 20,
    max_storage: 250,
    monthly_price: 189,
    tag: 'Corporativo | 4 Telas | 20 Op',
  },
  {
    type: 'special',
    name: 'Especial Grandes Redes',
    description: 'Operações complexas com múltiplos terminais de exibição e ampla equipe de atendimento.',
    max_players: 10,
    max_operators: 50,
    max_storage: 600,
    monthly_price: 349,
    tag: 'Redes | 10 Telas | 50 Op',
  },
];

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  showToast,
  onLogout,
  onQuickSwitchRole,
  onEnterCompany,
  onOpenPlayerSimulation,
  onOpenPresentation,
  onSeedDemoData,
}) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'companies' | 'plans' | 'drive'>('dashboard');
  const [r2ModalOpen, setR2ModalOpen] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [selectedDemoClient, setSelectedDemoClient] = useState<'comp-1' | 'comp-2'>('comp-1');
  const [stats, setStats] = useState<AdminStats>({
    totalCompanies: 0,
    activeCompanies: 0,
    inactiveCompanies: 0,
    totalPlayers: 0,
  });
  const [companies, setCompanies] = useState<Company[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [companyModalOpen, setCompanyModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [isSavingCompany, setIsSavingCompany] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [isSavingPlan, setIsSavingPlan] = useState(false);
  const [planModalError, setPlanModalError] = useState<string | null>(null);

  // Password reset modal
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetCompanyId, setResetCompanyId] = useState<string | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');

  // Confirmation modal
  const [confirmData, setConfirmData] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    action: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    action: () => {},
  });

  // Search and filter for companies (Mobile and Desktop)
  const [companySearch, setCompanySearch] = useState('');
  const [companyStatusFilter, setCompanyStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Company Form state
  const [companyForm, setCompanyForm] = useState<{
    legal_name: string;
    trade_name: string;
    cnpj: string;
    email: string;
    phone: string;
    responsible: string;
    address: string;
    city: string;
    state: string;
    plan_id: string;
    max_players: number | string;
    max_operators: number | string;
    max_media: number | string;
    drive_folder_url?: string;
    start_date: string;
    due_date: string;
    password: string;
    is_network: boolean;
    stores: Array<{
      id?: string;
      name: string;
      brand_name?: string;
      code?: string;
      city: string;
      state: string;
      address?: string;
      phone?: string;
      responsible?: string;
      status?: 'active' | 'inactive';
    }>;
  }>({
    legal_name: '',
    trade_name: '',
    cnpj: '',
    email: '',
    phone: '',
    responsible: '',
    address: '',
    city: '',
    state: '',
    plan_id: '',
    max_players: '',
    max_operators: '',
    max_media: '',
    drive_folder_url: '',
    start_date: new Date().toISOString().split('T')[0],
    due_date: '',
    password: '',
    is_network: false,
    stores: [],
  });

  // Draft for adding a store inside the New/Edit Company Modal
  const [storeDraft, setStoreDraft] = useState<{
    name: string;
    brand_name: string;
    code: string;
    city: string;
    state: string;
    address: string;
    responsible: string;
  }>({
    name: '',
    brand_name: '',
    code: '',
    city: '',
    state: '',
    address: '',
    responsible: '',
  });

  // Dedicated Quick Manage Stores Modal for an existing Company
  const [storesModalCompany, setStoresModalCompany] = useState<Company | null>(null);
  const [companyStoresList, setCompanyStoresList] = useState<CompanyStore[]>([]);
  const [loadingStores, setLoadingStores] = useState(false);
  const [savingQuickStore, setSavingQuickStore] = useState(false);
  const [editingQuickStore, setEditingQuickStore] = useState<CompanyStore | null>(null);
  const [quickStoreForm, setQuickStoreForm] = useState<{
    name: string;
    brand_name: string;
    code: string;
    city: string;
    state: string;
    address: string;
    phone: string;
    responsible: string;
  }>({
    name: '',
    brand_name: '',
    code: '',
    city: '',
    state: '',
    address: '',
    phone: '',
    responsible: '',
  });

  // Plan Form state
  const [planForm, setPlanForm] = useState<{
    name: string;
    description: string;
    max_players: number | string;
    max_operators: number | string;
    max_storage: number | string;
    monthly_price: number | string;
  }>({
    name: '',
    description: '',
    max_players: 2,
    max_operators: 0,
    max_storage: 50,
    monthly_price: 49,
  });
  const [planWithoutOperator, setPlanWithoutOperator] = useState(false);
  const [autoCalcRatio, setAutoCalcRatio] = useState(true);
  const [planMode, setPlanMode] = useState<'call' | 'show' | 'special'>('call');

  // Copied Key State for visual feedback
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Firebase Firestore Persistence State
  const [firestoreStatus, setFirestoreStatus] = useState<{
    configured: boolean;
    provider: string;
    lastSyncTimestamp: string | null;
    lastSyncError: string | null;
    isSyncing: boolean;
  } | null>(null);
  const [isSyncingFirestore, setIsSyncingFirestore] = useState(false);

  // Global Media Integrity State
  const [adminIntegrityReport, setAdminIntegrityReport] = useState<MediaIntegrityAuditReport | null>(null);
  const [isAuditingMedia, setIsAuditingMedia] = useState(false);
  const [showIntegrityReportModal, setShowIntegrityReportModal] = useState(false);

  const handleAuditAdminMedia = async () => {
    setIsAuditingMedia(true);
    try {
      const report = await api.checkAdminMediaIntegrity();
      setAdminIntegrityReport(report);
      setShowIntegrityReportModal(true);
      if (report.has_issues) {
        showToast('error', `Atenção: ${report.issues.length} mídia(s) inacessível(is) no Google Drive ou servidor encontradas!`);
      } else {
        showToast('success', `Todas as ${report.summary.total} mídias de todas as empresas estão íntegras e acessíveis!`);
      }
    } catch (err: any) {
      showToast('error', err.message || 'Falha ao auditar integridade das mídias.');
    } finally {
      setIsAuditingMedia(false);
    }
  };

  const handleCopyText = (text: string, key: string, label: string) => {
    try {
      if (navigator?.clipboard?.writeText) {
        navigator.clipboard.writeText(text);
      }
      setCopiedKey(key);
      showToast('success', `${label} copiado!`);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      showToast('info', `${label}: ${text}`);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [s, c, p, fsStatus] = await Promise.all([
        api.getAdminStats(),
        api.getCompanies(),
        api.getPlans(),
        api.getFirestoreStatus().catch(() => null),
      ]);
      setStats(s);
      setCompanies(Array.isArray(c) ? c : []);
      setPlans(Array.isArray(p) ? p : []);
      if (fsStatus) setFirestoreStatus(fsStatus);
    } catch (err: any) {
      showToast('error', err.message || 'Erro ao carregar dados do painel.');
    } finally {
      setLoading(false);
    }
  };

  const handleSyncFirestore = async () => {
    setIsSyncingFirestore(true);
    try {
      const res = await api.syncFirestore();
      setFirestoreStatus(res.status);
      showToast('success', 'Banco de dados sincronizado com Firebase Firestore com sucesso!');
    } catch (err: any) {
      showToast('error', err.message || 'Falha ao sincronizar com Firebase Firestore.');
    } finally {
      setIsSyncingFirestore(false);
    }
  };

  const [isImportingBackup, setIsImportingBackup] = useState(false);
  const backupFileInputRef = useRef<HTMLInputElement>(null);

  const handleExportBackup = async () => {
    try {
      await api.exportBackup();
      showToast('success', 'Download do arquivo de backup JSON iniciado!');
    } catch (err: any) {
      showToast('error', err.message || 'Falha ao exportar arquivo de backup.');
    }
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImportingBackup(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const res = await api.importBackup(parsed);
      showToast('success', res.message || 'Backup restaurado com sucesso e salvo na nuvem!');
      await loadData();
    } catch (err: any) {
      showToast('error', err.message || 'Erro ao importar arquivo de backup JSON.');
    } finally {
      setIsImportingBackup(false);
      if (backupFileInputRef.current) {
        backupFileInputRef.current.value = '';
      }
    }
  };

  const handleSeedDemoData = async () => {
    setIsSeeding(true);
    try {
      const res = onSeedDemoData ? await onSeedDemoData() : await api.seedDemoData();
      showToast('success', res.message || 'Dados de teste carregados com sucesso!');
      await loadData();
    } catch (err: any) {
      showToast('error', err.message || 'Erro ao carregar dados de teste.');
    } finally {
      setIsSeeding(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenCompanyModal = (company?: Company) => {
    setModalError(null);
    if (company) {
      setEditingCompany(company);
      setCompanyForm({
        legal_name: company.legal_name,
        trade_name: company.trade_name,
        cnpj: company.cnpj,
        email: company.email,
        phone: company.phone || '',
        responsible: company.responsible || '',
        address: company.address || '',
        city: company.city || '',
        state: company.state || '',
        plan_id: company.plan_id || (plans[0]?.id || ''),
        max_players: company.max_players !== undefined && company.max_players !== null ? company.max_players : '',
        max_operators: company.max_operators !== undefined && company.max_operators !== null ? company.max_operators : '',
        max_media: company.max_media !== undefined && company.max_media !== null ? company.max_media : '',
        drive_folder_url: company.drive_folder_url || '',
        start_date: company.start_date || '',
        due_date: company.due_date || '',
        password: '',
        is_network: Boolean(company.is_network || (company.stores && company.stores.length > 0)),
        stores: (company.stores || []).map((s) => ({
          id: s.id,
          name: s.name,
          brand_name: s.brand_name || '',
          code: s.code || '',
          city: s.city || '',
          state: s.state || '',
          address: s.address || '',
          phone: s.phone || '',
          responsible: s.responsible || '',
          status: s.status || 'active',
        })),
      });
      setStoreDraft({
        name: '',
        brand_name: '',
        code: '',
        city: company.city || '',
        state: company.state || 'SP',
        address: '',
        responsible: '',
      });
    } else {
      setEditingCompany(null);
      const defaultPlan = plans.find((p) => p.active) || plans[0];
      setCompanyForm({
        legal_name: '',
        trade_name: '',
        cnpj: '',
        email: '',
        phone: '',
        responsible: '',
        address: '',
        city: '',
        state: '',
        plan_id: defaultPlan?.id || '',
        max_players: '',
        max_operators: '',
        max_media: '',
        drive_folder_url: '',
        start_date: new Date().toISOString().split('T')[0],
        due_date: '',
        password: '',
        is_network: false,
        stores: [],
      });
      setStoreDraft({
        name: '',
        brand_name: '',
        code: '',
        city: '',
        state: 'SP',
        address: '',
        responsible: '',
      });
    }
    setCompanyModalOpen(true);
  };

  const handleAddDraftStore = () => {
    const trimmedName = storeDraft.name.trim();
    if (!trimmedName) {
      showToast('error', 'Informe o nome da loja/unidade (ex: Vale Lar Jacareí).');
      return;
    }
    const nextIdx = companyForm.stores.length + 1;
    const newEntry = {
      name: trimmedName,
      brand_name: storeDraft.brand_name.trim() || undefined,
      code: storeDraft.code.trim().toUpperCase() || `LOJA-0${nextIdx}`,
      city: storeDraft.city.trim() || companyForm.city.trim() || '',
      state: (storeDraft.state.trim() || companyForm.state.trim() || 'SP').toUpperCase(),
      address: storeDraft.address.trim() || undefined,
      responsible: storeDraft.responsible.trim() || undefined,
      status: 'active' as const,
    };
    setCompanyForm((prev) => ({
      ...prev,
      is_network: true,
      stores: [...prev.stores, newEntry],
    }));
    setStoreDraft((prev) => ({
      ...prev,
      name: '',
      code: '',
      address: '',
    }));
  };

  const handleRemoveDraftStore = (index: number) => {
    setCompanyForm((prev) => {
      const updated = prev.stores.filter((_, i) => i !== index);
      return {
        ...prev,
        stores: updated,
      };
    });
  };

  const handleOpenStoresModal = async (company: Company) => {
    setStoresModalCompany(company);
    setEditingQuickStore(null);
    setQuickStoreForm({
      name: '',
      brand_name: '',
      code: '',
      city: company.city || '',
      state: company.state || 'SP',
      address: '',
      phone: '',
      responsible: '',
    });
    setLoadingStores(true);
    try {
      const list = await api.getAdminCompanyStores(company.id);
      setCompanyStoresList(list);
    } catch (err: any) {
      showToast('error', err.message || 'Erro ao carregar lojas da empresa.');
      setCompanyStoresList(company.stores || []);
    } finally {
      setLoadingStores(false);
    }
  };

  const handleSaveQuickStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storesModalCompany) return;
    if (!quickStoreForm.name.trim()) {
      showToast('error', 'Informe o nome da loja/unidade.');
      return;
    }
    setSavingQuickStore(true);
    try {
      if (editingQuickStore) {
        await api.updateAdminCompanyStore(editingQuickStore.id, {
          name: quickStoreForm.name.trim(),
          brand_name: quickStoreForm.brand_name.trim() || undefined,
          code: quickStoreForm.code.trim().toUpperCase() || undefined,
          city: quickStoreForm.city.trim(),
          state: quickStoreForm.state.trim().toUpperCase(),
          address: quickStoreForm.address.trim() || undefined,
          phone: quickStoreForm.phone.trim() || undefined,
          responsible: quickStoreForm.responsible.trim() || undefined,
        });
        showToast('success', 'Loja atualizada com sucesso.');
      } else {
        await api.createAdminCompanyStore(storesModalCompany.id, {
          name: quickStoreForm.name.trim(),
          brand_name: quickStoreForm.brand_name.trim() || undefined,
          code: quickStoreForm.code.trim().toUpperCase() || undefined,
          city: quickStoreForm.city.trim() || storesModalCompany.city,
          state: (quickStoreForm.state.trim() || storesModalCompany.state || 'SP').toUpperCase(),
          address: quickStoreForm.address.trim() || undefined,
          phone: quickStoreForm.phone.trim() || undefined,
          responsible: quickStoreForm.responsible.trim() || undefined,
        });
        showToast('success', 'Loja adicionada à rede com sucesso.');
      }
      setEditingQuickStore(null);
      setQuickStoreForm({
        name: '',
        brand_name: '',
        code: '',
        city: storesModalCompany.city || '',
        state: storesModalCompany.state || 'SP',
        address: '',
        phone: '',
        responsible: '',
      });
      const updated = await api.getAdminCompanyStores(storesModalCompany.id);
      setCompanyStoresList(updated);
      await loadData();
    } catch (err: any) {
      showToast('error', err.message || 'Erro ao salvar loja.');
    } finally {
      setSavingQuickStore(false);
    }
  };

  const handleDeleteQuickStore = async (store: CompanyStore) => {
    if (!storesModalCompany) return;
    try {
      await api.deleteAdminCompanyStore(store.id);
      showToast('success', `Loja "${store.name}" removida.`);
      const updated = await api.getAdminCompanyStores(storesModalCompany.id);
      setCompanyStoresList(updated);
      await loadData();
    } catch (err: any) {
      showToast('error', err.message || 'Erro ao remover loja.');
    }
  };

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    setIsSavingCompany(true);
    try {
      const payload = {
        ...companyForm,
        max_players: companyForm.max_players !== '' ? Number(companyForm.max_players) : undefined,
        max_operators: companyForm.max_operators !== '' ? Number(companyForm.max_operators) : undefined,
        max_media: companyForm.max_media !== '' ? Number(companyForm.max_media) : undefined,
      };
      if (editingCompany) {
        await api.updateCompany(editingCompany.id, payload);
        showToast('success', 'Empresa atualizada com sucesso.');
      } else {
        await api.createCompany(payload);
        showToast('success', 'Empresa cadastrada com sucesso.');
      }
      setCompanyModalOpen(false);
      await loadData();
    } catch (err: any) {
      const msg = err.message || 'Erro ao salvar empresa.';
      setModalError(msg);
      showToast('error', msg);
    } finally {
      setIsSavingCompany(false);
    }
  };

  const handleDeleteCompany = (company: Company) => {
    setConfirmData({
      isOpen: true,
      title: 'Excluir Empresa',
      message: `Tem certeza que deseja excluir permanentemente a empresa "${company.trade_name}"? Esta ação removerá seus acessos, players, operadores e mídias vinculadas.`,
      action: async () => {
        try {
          const res = await api.deleteCompany(company.id);
          showToast('success', res.message);
          setConfirmData((prev) => ({ ...prev, isOpen: false }));
          loadData();
        } catch (err: any) {
          showToast('error', err.message || 'Erro ao excluir empresa.');
        }
      },
    });
  };

  const handleDeletePlan = (plan: Plan) => {
    const linked = companies.filter((c) => c.plan_id === plan.id);
    if (linked.length > 0) {
      showToast('error', `Não é possível excluir o plano "${plan.name}" pois existem ${linked.length} empresa(s) vinculada(s) a ele.`);
      return;
    }
    setConfirmData({
      isOpen: true,
      title: 'Excluir Plano',
      message: `Deseja excluir permanentemente o plano "${plan.name}"?`,
      action: async () => {
        try {
          const res = await api.deletePlan(plan.id);
          showToast('success', res.message);
          setConfirmData((prev) => ({ ...prev, isOpen: false }));
          loadData();
        } catch (err: any) {
          showToast('error', err.message || 'Erro ao excluir plano.');
        }
      },
    });
  };

  const handleToggleCompany = (company: Company) => {
    const isActivating = company.status === 'inactive';
    setConfirmData({
      isOpen: true,
      title: isActivating ? 'Ativar Empresa' : 'Desativar Empresa',
      message: isActivating
        ? `Deseja ativar a empresa ${company.trade_name}? Seus players voltarão a operar.`
        : `Deseja desativar a empresa ${company.trade_name}? Uma empresa inativa não poderá operar seus players.`,
      action: async () => {
        try {
          const res = await api.toggleCompanyStatus(company.id);
          showToast('success', res.message);
          setConfirmData((prev) => ({ ...prev, isOpen: false }));
          loadData();
        } catch (err: any) {
          showToast('error', err.message);
        }
      },
    });
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetCompanyId) return;
    try {
      const res = await api.resetCompanyPassword(resetCompanyId, newPasswordInput || undefined);
      showToast('success', res.message);
      setResetModalOpen(false);
      setNewPasswordInput('');
    } catch (err: any) {
      showToast('error', err.message);
    }
  };

  const handleOpenPlanModal = (plan?: Plan, defaultCategory?: 'call' | 'show' | 'special') => {
    setPlanModalError(null);
    if (plan) {
      setEditingPlan(plan);
      setPlanForm({
        name: plan.name,
        description: plan.description,
        max_players: plan.max_players,
        max_operators: plan.max_operators,
        max_storage: plan.max_storage,
        monthly_price: plan.monthly_price,
      });
      const isZeroOp = Number(plan.max_operators) === 0;
      const isCallRatio = !isZeroOp && Number(plan.max_players) > 0 && Number(plan.max_operators) === Number(plan.max_players) * 4;
      setPlanWithoutOperator(isZeroOp);
      setAutoCalcRatio(isCallRatio);
      setPlanMode(isZeroOp ? 'show' : isCallRatio ? 'call' : 'special');
    } else {
      setEditingPlan(null);
      if (defaultCategory === 'special') {
        setPlanForm({
          name: 'Especial Sob Medida',
          description: 'Plano customizado com quantidade de telas e operadores definida sob medida para o cliente.',
          max_players: 2,
          max_operators: 10,
          max_storage: 150,
          monthly_price: 119,
        });
        setPlanWithoutOperator(false);
        setAutoCalcRatio(false);
        setPlanMode('special');
      } else if (defaultCategory === 'show') {
        setPlanForm({
          name: 'Show Básico',
          description: 'Exibição de mídia indoor, propagandas, hora certa e notícias RSS em até 2 telas (sem operador).',
          max_players: 2,
          max_operators: 0,
          max_storage: 50,
          monthly_price: 29,
        });
        setPlanWithoutOperator(true);
        setAutoCalcRatio(false);
        setPlanMode('show');
      } else {
        // Default to Call Básico preset (1 tela, 4 operadores)
        setPlanForm({
          name: 'Call Básico',
          description: '1 tela com chamadas no painel e até 4 operadores de atendimento (proporção 4:1).',
          max_players: 1,
          max_operators: 4,
          max_storage: 50,
          monthly_price: 49,
        });
        setPlanWithoutOperator(false);
        setAutoCalcRatio(true);
        setPlanMode('call');
      }
    }
    setPlanModalOpen(true);
  };

  const handleApplyPlanTemplate = (tpl: (typeof PLAN_TEMPLATES)[0]) => {
    setPlanModalError(null);
    setPlanForm({
      name: tpl.name,
      description: tpl.description,
      max_players: tpl.max_players,
      max_operators: tpl.max_operators,
      max_storage: tpl.max_storage,
      monthly_price: tpl.monthly_price,
    });
    setPlanMode(tpl.type as 'call' | 'show' | 'special');
    setPlanWithoutOperator(tpl.type === 'show');
    setAutoCalcRatio(tpl.type === 'call');
    showToast('info', `Modelo "${tpl.name}" carregado com sucesso.`);
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setPlanModalError(null);
    setIsSavingPlan(true);
    const payload = {
      ...planForm,
      max_players: Math.max(1, Number(planForm.max_players) || 1),
      max_operators: planMode === 'show' || planWithoutOperator ? 0 : Math.max(0, Number(planForm.max_operators) || 0),
      max_storage: Math.max(1, Number(planForm.max_storage) || 1),
      monthly_price: Math.max(0, Number(planForm.monthly_price) || 0),
    };
    try {
      if (editingPlan) {
        await api.updatePlan(editingPlan.id, payload);
        showToast('success', 'Plano atualizado com sucesso.');
      } else {
        await api.createPlan(payload);
        showToast('success', 'Plano criado com sucesso.');
      }
      setPlanModalOpen(false);
      await loadData();
    } catch (err: any) {
      const msg = err.message || 'Erro ao salvar plano.';
      setPlanModalError(msg);
      showToast('error', msg);
    } finally {
      setIsSavingPlan(false);
    }
  };

  const handleTogglePlan = async (plan: Plan) => {
    try {
      const res = await api.togglePlanStatus(plan.id);
      showToast('success', res.message);
      loadData();
    } catch (err: any) {
      showToast('error', err.message);
    }
  };

  const filteredCompanies = companies.filter((c) => {
    const term = companySearch.toLowerCase().trim();
    const matchesSearch =
      !term ||
      c.trade_name.toLowerCase().includes(term) ||
      c.legal_name.toLowerCase().includes(term) ||
      c.cnpj.toLowerCase().includes(term) ||
      c.email.toLowerCase().includes(term) ||
      (c.responsible && c.responsible.toLowerCase().includes(term));
    const matchesStatus =
      companyStatusFilter === 'all' ||
      (companyStatusFilter === 'active' && c.status === 'active') ||
      (companyStatusFilter === 'inactive' && c.status !== 'active');
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="mx-auto max-w-7xl px-3.5 sm:px-8 py-5 sm:py-8">
      {/* Subheader / Tabs com scroll horizontal suave em telas pequenas */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-700 pb-5 mb-6 sm:mb-8">
        <div>
          <h2 className="text-xl sm:text-3xl font-light text-white tracking-tight">Administração</h2>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:flex lg:flex-wrap lg:items-center gap-2 w-full lg:w-auto">
          <button
            id="tab-admin-dashboard"
            onClick={() => setActiveTab('dashboard')}
            className={`w-full lg:w-auto justify-center px-3.5 py-2 sm:py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition cursor-pointer text-center ${
              activeTab === 'dashboard'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
            }`}
          >
            Dashboard
          </button>
          <button
            id="tab-admin-companies"
            onClick={() => setActiveTab('companies')}
            className={`w-full lg:w-auto justify-center px-3.5 py-2 sm:py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition cursor-pointer text-center ${
              activeTab === 'companies'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
            }`}
          >
            Empresas ({companies.length})
          </button>
          <button
            id="tab-admin-plans"
            onClick={() => setActiveTab('plans')}
            className={`w-full lg:w-auto justify-center px-3.5 py-2 sm:py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition cursor-pointer text-center ${
              activeTab === 'plans'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
            }`}
          >
            Planos ({plans.length})
          </button>
          <button
            id="tab-admin-drive"
            onClick={() => setActiveTab('drive')}
            className={`w-full lg:w-auto justify-center flex items-center gap-1.5 px-3.5 py-2 sm:py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition cursor-pointer text-center ${
              activeTab === 'drive'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
            }`}
          >
            <UploadCloud className="h-3.5 w-3.5 text-blue-400 shrink-0" />
            <span className="truncate">Google Drive</span>
          </button>

          <button
            id="btn-admin-r2"
            type="button"
            onClick={() => setR2ModalOpen(true)}
            className="w-full lg:w-auto justify-center flex items-center gap-1.5 px-3.5 py-2 sm:py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider bg-orange-600/20 hover:bg-orange-600/35 text-orange-200 border border-orange-500/40 shadow-sm transition cursor-pointer text-center"
            title="Configurar Cloudflare R2 para armazenamento permanente definitivo com tráfego 100% grátis"
          >
            <Cloud className="h-3.5 w-3.5 text-orange-400 shrink-0" />
            <span className="truncate">Cloudflare R2</span>
          </button>

          {onOpenPresentation && (
            <button
              type="button"
              onClick={onOpenPresentation}
              className="w-full lg:w-auto justify-center flex items-center gap-1.5 px-3.5 py-2 sm:py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-sm transition cursor-pointer border border-blue-500/40 text-center"
              title="Abrir Apresentação Comercial / Exportar PDF para Clientes"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Apresentação (PDF)</span>
            </button>
          )}

          <button
            id="btn-admin-top-seed-data"
            type="button"
            onClick={handleSeedDemoData}
            disabled={isSeeding}
            className="w-full lg:w-auto justify-center flex items-center gap-1.5 px-3.5 py-2 sm:py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition cursor-pointer border border-emerald-500/40 disabled:opacity-50 text-center"
            title="Carregar / Restaurar Dados de Teste (Empresas, Operadores e Telas) para Apresentação"
          >
            {isSeeding ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin text-white shrink-0" />
                <span className="truncate">Carregando...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5 text-amber-300 shrink-0" />
                <span className="truncate">Dados Teste</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* VIEW: DASHBOARD MINIMALISTA */}
      {activeTab === 'dashboard' && (
        <div className="space-y-8">
          {/* 3 Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div className="rounded-xl border border-slate-700 bg-slate-800 p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                  Empresas Ativas
                </span>
                <CheckCircle className="h-5 w-5 text-emerald-400" />
              </div>
              <p className="mt-3 text-4xl font-light text-white">{stats.activeCompanies}</p>
            </div>

            <div className="rounded-xl border border-slate-700 bg-slate-800 p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                  Empresas Inativas
                </span>
                <XCircle className="h-5 w-5 text-rose-400" />
              </div>
              <p className="mt-3 text-4xl font-light text-white">{stats.inactiveCompanies}</p>
            </div>

            <div className="rounded-xl border border-slate-700 bg-slate-800 p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                  Total de Players
                </span>
                <Monitor className="h-5 w-5 text-blue-400" />
              </div>
              <p className="mt-3 text-4xl font-light text-white">{stats.totalPlayers}</p>
            </div>
          </div>

          {/* Acessos Rápidos do Sistema (Exclusivo Admin Geral) */}
          <div className="rounded-xl border border-blue-900/50 bg-slate-800/95 p-6 shadow-md">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-700/80 pb-5 mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 shrink-0">
                  <Shield className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                  Acessos Rápidos
                </h3>
              </div>

              {/* Botão Principal: Carregar Dados de Teste */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  id="btn-seed-test-data"
                  type="button"
                  onClick={handleSeedDemoData}
                  disabled={isSeeding}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold uppercase tracking-wider transition cursor-pointer shadow-lg shadow-emerald-950/40 border border-emerald-400/40 disabled:opacity-50"
                >
                  {isSeeding ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-white" />
                      <span>Carregando...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 text-amber-300" />
                      <span>Carregar Dados de Teste</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Status de Armazenamento & Persistência na Nuvem */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5 p-3.5 rounded-xl bg-slate-900/90 border border-slate-700/80">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-500/20 text-orange-400 border border-orange-500/30 shrink-0">
                  <Database className="h-4 w-4" />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-white">Firebase Firestore</span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-800/60">
                    <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                    Ativo
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
                <button
                  id="btn-admin-audit-media"
                  type="button"
                  onClick={handleAuditAdminMedia}
                  disabled={isAuditingMedia}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 transition cursor-pointer disabled:opacity-50"
                  title="Audita integridade de todos os arquivos no Google Drive e mídias no Firebase"
                >
                  {isAuditingMedia ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400" />
                  ) : (
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                  )}
                  <span>Auditar Mídias (Drive)</span>
                </button>

                <button
                  type="button"
                  onClick={handleSyncFirestore}
                  disabled={isSyncingFirestore}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 transition cursor-pointer disabled:opacity-50"
                  title="Garante que todos os dados locais estejam salvos no Firebase Firestore"
                >
                  {isSyncingFirestore ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-orange-400" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5 text-orange-400" />
                  )}
                  <span>Sincronizar Firestore</span>
                </button>

                {/* Backup JSON Download e Restauração */}
                <button
                  type="button"
                  onClick={handleExportBackup}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 transition cursor-pointer"
                  title="Baixa uma cópia completa de segurança em arquivo JSON para o seu computador"
                >
                  <Download className="h-3.5 w-3.5 text-blue-400" />
                  <span>Baixar Backup</span>
                </button>

                <input
                  type="file"
                  ref={backupFileInputRef}
                  onChange={handleImportBackup}
                  accept=".json"
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => backupFileInputRef.current?.click()}
                  disabled={isImportingBackup}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 transition cursor-pointer disabled:opacity-50"
                  title="Restaura os dados a partir de um arquivo JSON de backup e salva no Firestore"
                >
                  {isImportingBackup ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-purple-400" />
                  ) : (
                    <Upload className="h-3.5 w-3.5 text-purple-400" />
                  )}
                  <span>Restaurar Backup</span>
                </button>
              </div>
            </div>

            {/* Alternador de Clientes Demo para Apresentação */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5 p-3 rounded-lg bg-slate-900/70 border border-slate-700/60">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Cliente de Demonstração:</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedDemoClient('comp-1')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
                    selectedDemoClient === 'comp-1'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700'
                  }`}
                >
                  1. Farmácia (Drogaria SP)
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDemoClient('comp-2')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
                    selectedDemoClient === 'comp-2'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700'
                  }`}
                >
                  2. Supermercado (Hortifruti)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {/* 1. Admin Geral */}
              <div className="rounded-xl border border-purple-800/40 bg-purple-950/20 p-5 flex flex-col justify-between hover:border-purple-700/60 transition">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-purple-900/60 text-purple-300 border border-purple-700/60">
                      Sessão Ativa
                    </span>
                    <Shield className="h-5 w-5 text-purple-400" />
                  </div>
                  <h4 className="text-sm font-bold text-white uppercase tracking-wider">1. Admin Geral</h4>

                  <div className="mt-4 p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1 text-xs font-mono">
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="text-slate-500 text-[10px] uppercase">Login:</span>
                      <span className="font-semibold text-purple-300 select-all truncate ml-2">ale11062@gmail.com</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="text-slate-500 text-[10px] uppercase">Senha:</span>
                      <span className="text-emerald-400 font-bold select-all">Admin@123456</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-purple-900/40 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopyText('ale11062@gmail.com\nAdmin@123456', 'admin_cred', 'Credenciais do Admin')}
                    className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border border-purple-800/60 bg-purple-900/30 hover:bg-purple-900/50 text-purple-200 text-xs font-bold uppercase tracking-wider transition cursor-pointer"
                  >
                    {copiedKey === 'admin_cred' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    <span>Copiar Credenciais</span>
                  </button>
                </div>
              </div>

              {/* 2. Empresa Demo Selecionada */}
              {selectedDemoClient === 'comp-1' ? (
                <div className="rounded-xl border border-blue-800/40 bg-blue-950/20 p-5 flex flex-col justify-between hover:border-blue-700/60 transition">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-900/60 text-blue-300 border border-blue-700/60">
                        Painel da Empresa
                      </span>
                      <Building2 className="h-5 w-5 text-blue-400" />
                    </div>
                    <h4 className="text-sm font-bold text-white uppercase tracking-wider">2. Drogarias SP</h4>

                    <div className="mt-4 p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1 text-xs font-mono">
                      <div className="flex items-center justify-between text-slate-300">
                        <span className="text-slate-500 text-[10px] uppercase">Login:</span>
                        <span className="font-semibold text-blue-300 select-all truncate ml-2">empresa@drogariasp.com.br</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-300">
                        <span className="text-slate-500 text-[10px] uppercase">Senha:</span>
                        <span className="text-slate-200 font-bold select-all">123456</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-blue-900/40 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onQuickSwitchRole?.('company')}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold uppercase tracking-wider transition cursor-pointer shadow-sm"
                    >
                      <span>Entrar Empresa</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopyText('empresa@drogariasp.com.br\n123456', 'company_cred', 'Credenciais da Empresa')}
                      title="Copiar dados"
                      className="p-2 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
                    >
                      {copiedKey === 'company_cred' ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-blue-800/40 bg-blue-950/20 p-5 flex flex-col justify-between hover:border-blue-700/60 transition">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-900/60 text-blue-300 border border-blue-700/60">
                        Painel da Empresa
                      </span>
                      <Building2 className="h-5 w-5 text-blue-400" />
                    </div>
                    <h4 className="text-sm font-bold text-white uppercase tracking-wider">2. Supermercado Central</h4>

                    <div className="mt-4 p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1 text-xs font-mono">
                      <div className="flex items-center justify-between text-slate-300">
                        <span className="text-slate-500 text-[10px] uppercase">Login:</span>
                        <span className="font-semibold text-blue-300 select-all truncate ml-2">empresa@supermercado.com.br</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-300">
                        <span className="text-slate-500 text-[10px] uppercase">Senha:</span>
                        <span className="text-slate-200 font-bold select-all">123456</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-blue-900/40 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onQuickSwitchRole?.('company-2')}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold uppercase tracking-wider transition cursor-pointer shadow-sm"
                    >
                      <span>Entrar Supermercado</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopyText('empresa@supermercado.com.br\n123456', 'company2_cred', 'Credenciais do Supermercado')}
                      title="Copiar dados"
                      className="p-2 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
                    >
                      {copiedKey === 'company2_cred' ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              )}

              {/* 3. Operador Demo Selecionado */}
              {selectedDemoClient === 'comp-1' ? (
                <div className="rounded-xl border border-emerald-800/40 bg-emerald-950/20 p-5 flex flex-col justify-between hover:border-emerald-700/60 transition">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-900/60 text-emerald-300 border border-emerald-700/60">
                        Painel Operacional
                      </span>
                      <Radio className="h-5 w-5 text-emerald-400" />
                    </div>
                    <h4 className="text-sm font-bold text-white uppercase tracking-wider">3. Operador (Carlos)</h4>

                    <div className="mt-4 p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1 text-xs font-mono">
                      <div className="flex items-center justify-between text-slate-300">
                        <span className="text-slate-500 text-[10px] uppercase">Login:</span>
                        <span className="font-semibold text-emerald-300 select-all truncate ml-2">operador@drogariasp.com.br</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-300">
                        <span className="text-slate-500 text-[10px] uppercase">Senha:</span>
                        <span className="text-slate-200 font-bold select-all">123456</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-emerald-900/40 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onQuickSwitchRole?.('operator')}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold uppercase tracking-wider transition cursor-pointer shadow-sm"
                    >
                      <span>Entrar Operador</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopyText('operador@drogariasp.com.br\n123456', 'operator_cred', 'Credenciais do Operador')}
                      title="Copiar dados"
                      className="p-2 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
                    >
                      {copiedKey === 'operator_cred' ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-emerald-800/40 bg-emerald-950/20 p-5 flex flex-col justify-between hover:border-emerald-700/60 transition">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-900/60 text-emerald-300 border border-emerald-700/60">
                        Painel Operacional
                      </span>
                      <Radio className="h-5 w-5 text-emerald-400" />
                    </div>
                    <h4 className="text-sm font-bold text-white uppercase tracking-wider">3. Operadora (Ana)</h4>

                    <div className="mt-4 p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1 text-xs font-mono">
                      <div className="flex items-center justify-between text-slate-300">
                        <span className="text-slate-500 text-[10px] uppercase">Login:</span>
                        <span className="font-semibold text-emerald-300 select-all truncate ml-2">operador@supermercado.com.br</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-300">
                        <span className="text-slate-500 text-[10px] uppercase">Senha:</span>
                        <span className="text-slate-200 font-bold select-all">123456</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-emerald-900/40 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onQuickSwitchRole?.('operator-2')}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold uppercase tracking-wider transition cursor-pointer shadow-sm"
                    >
                      <span>Entrar Operadora</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopyText('operador@supermercado.com.br\n123456', 'operator2_cred', 'Credenciais da Operadora')}
                      title="Copiar dados"
                      className="p-2 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
                    >
                      {copiedKey === 'operator2_cred' ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              )}

              {/* 4. Player TV Demo Selecionado */}
              {selectedDemoClient === 'comp-1' ? (
                <div className="rounded-xl border border-amber-800/40 bg-amber-950/20 p-5 flex flex-col justify-between hover:border-amber-700/60 transition">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-900/60 text-amber-300 border border-amber-700/60">
                        Reprodução Ao Vivo
                      </span>
                      <Tv className="h-5 w-5 text-amber-400" />
                    </div>
                    <h4 className="text-sm font-bold text-white uppercase tracking-wider">4. TV Recepção</h4>

                    <div className="mt-4 p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1 text-xs font-mono">
                      <div className="flex items-center justify-between text-slate-300">
                        <span className="text-slate-500 text-[10px] uppercase">Código TV:</span>
                        <span className="font-bold text-amber-300 select-all tracking-wider">PLAY-REC-01</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-300">
                        <span className="text-slate-500 text-[10px] uppercase">Local:</span>
                        <span className="text-slate-300 truncate">Balcão Principal</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-amber-900/40 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (onOpenPlayerSimulation) {
                          onOpenPlayerSimulation('PLAY-REC-01');
                        } else if (onQuickSwitchRole) {
                          onQuickSwitchRole('player');
                        }
                      }}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black uppercase tracking-wider transition cursor-pointer shadow-sm"
                    >
                      <span>Abrir Player</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopyText('PLAY-REC-01', 'player_code', 'Código do Player')}
                      title="Copiar código"
                      className="p-2 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
                    >
                      {copiedKey === 'player_code' ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-amber-800/40 bg-amber-950/20 p-5 flex flex-col justify-between hover:border-amber-700/60 transition">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-900/60 text-amber-300 border border-amber-700/60">
                        Reprodução Ao Vivo
                      </span>
                      <Tv className="h-5 w-5 text-amber-400" />
                    </div>
                    <h4 className="text-sm font-bold text-white uppercase tracking-wider">4. TV Salão Vendas</h4>

                    <div className="mt-4 p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1 text-xs font-mono">
                      <div className="flex items-center justify-between text-slate-300">
                        <span className="text-slate-500 text-[10px] uppercase">Código TV:</span>
                        <span className="font-bold text-amber-300 select-all tracking-wider">PLAY-MERC-02</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-300">
                        <span className="text-slate-500 text-[10px] uppercase">Local:</span>
                        <span className="text-slate-300 truncate">Salão Principal</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-amber-900/40 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (onOpenPlayerSimulation) {
                          onOpenPlayerSimulation('PLAY-MERC-02');
                        } else if (onQuickSwitchRole) {
                          onQuickSwitchRole('player-2');
                        }
                      }}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black uppercase tracking-wider transition cursor-pointer shadow-sm"
                    >
                      <span>Abrir Player</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopyText('PLAY-MERC-02', 'player2_code', 'Código do Player')}
                      title="Copiar código"
                      className="p-2 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
                    >
                      {copiedKey === 'player2_code' ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Atalhos Rápidos */}
          <div className="rounded-xl border border-slate-700 bg-slate-800 p-6 shadow-sm">
            <h3 className="text-xs font-bold text-slate-400 mb-4 uppercase tracking-widest">Atalhos Principais</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <button
                onClick={() => setActiveTab('companies')}
                className="flex items-center gap-3.5 p-4 rounded-xl border border-slate-700 bg-slate-800/90 hover:bg-slate-750 hover:border-slate-600 transition cursor-pointer text-left group"
              >
                <div className="p-2.5 rounded-lg bg-blue-600/20 text-blue-400 group-hover:bg-blue-600 group-hover:text-white transition">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-white">Gerenciar Empresas</h4>
                </div>
              </button>

              <button
                onClick={() => setActiveTab('plans')}
                className="flex items-center gap-3.5 p-4 rounded-xl border border-slate-700 bg-slate-800/90 hover:bg-slate-750 hover:border-slate-600 transition cursor-pointer text-left group"
              >
                <div className="p-2.5 rounded-lg bg-purple-600/20 text-purple-400 group-hover:bg-purple-600 group-hover:text-white transition">
                  <Layers className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-white">Gerenciar Planos</h4>
                </div>
              </button>

              <button
                onClick={onLogout}
                className="flex items-center gap-3.5 p-4 rounded-xl border border-rose-900/40 bg-rose-950/20 hover:bg-rose-950/40 transition cursor-pointer text-left"
              >
                <div className="p-2.5 rounded-lg bg-rose-600/20 text-rose-400">
                  <Power className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-rose-200">Encerrar Sessão</h4>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW: EMPRESAS */}
      {activeTab === 'companies' && (
        <div className="space-y-4 sm:space-y-6">
          {/* Header e Ações */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">Empresas</h3>
            </div>
            <button
              id="btn-nova-empresa"
              onClick={() => handleOpenCompanyModal()}
              className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 sm:py-2 text-xs font-bold uppercase tracking-wider text-white shadow-sm hover:bg-blue-500 active:bg-blue-700 transition cursor-pointer shrink-0"
            >
              <Plus className="h-4 w-4" />
              <span>Nova Empresa</span>
            </button>
          </div>

          {/* Barra de Busca e Filtros de Status (Otimizada para Mobile e Desktop) */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-800/80 p-3 rounded-xl border border-slate-700">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={companySearch}
                onChange={(e) => setCompanySearch(e.target.value)}
                placeholder="Buscar por nome, CNPJ, e-mail ou responsável..."
                className="w-full pl-10 pr-9 py-2 rounded-lg border border-slate-700 bg-slate-900 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
              {companySearch && (
                <button
                  type="button"
                  onClick={() => setCompanySearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Filtros de Status em Pills */}
            <div className="grid grid-cols-3 sm:flex sm:flex-wrap items-center gap-1.5 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setCompanyStatusFilter('all')}
                className={`w-full sm:w-auto justify-center px-2 sm:px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition cursor-pointer text-center ${
                  companyStatusFilter === 'all'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-700'
                }`}
              >
                Todas ({companies.length})
              </button>
              <button
                type="button"
                onClick={() => setCompanyStatusFilter('active')}
                className={`w-full sm:w-auto justify-center px-2 sm:px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition cursor-pointer text-center ${
                  companyStatusFilter === 'active'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-700'
                }`}
              >
                Ativas ({companies.filter((c) => c.status === 'active').length})
              </button>
              <button
                type="button"
                onClick={() => setCompanyStatusFilter('inactive')}
                className={`w-full sm:w-auto justify-center px-2 sm:px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition cursor-pointer text-center ${
                  companyStatusFilter === 'inactive'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-700'
                }`}
              >
                Inativas ({companies.filter((c) => c.status !== 'active').length})
              </button>
            </div>
          </div>

          {/* VISÃO MOBILE: CARDS RESPONSIVOS COM BOTÕES DE TOQUE PROEMINENTES */}
          <div className="block md:hidden space-y-3.5">
            {filteredCompanies.length === 0 ? (
              <div className="rounded-xl border border-slate-700 bg-slate-800 p-8 text-center text-slate-400">
                Nenhuma empresa encontrada com os filtros atuais.
              </div>
            ) : (
              filteredCompanies.map((c) => (
                <div key={c.id} className="rounded-xl border border-slate-700 bg-slate-800 p-4 shadow-sm space-y-3.5">
                  {/* Cabeçalho do Card */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h4 className="font-bold text-white text-base leading-snug break-words">{c.trade_name}</h4>
                      <p className="text-xs text-slate-400 mt-0.5 break-words">{c.legal_name}</p>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                        c.status === 'active'
                          ? 'bg-emerald-950/90 text-emerald-300 border border-emerald-700'
                          : 'bg-rose-950/90 text-rose-300 border border-rose-700'
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${c.status === 'active' ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                      {c.status === 'active' ? 'Ativa' : 'Inativa'}
                    </span>
                  </div>

                  {/* Badges de Plano e CNPJ */}
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="inline-block rounded-md px-2.5 py-1 bg-blue-900/40 text-blue-300 border border-blue-800 text-[11px] font-bold uppercase tracking-wider">
                      {c.plan_name || 'Plano Padrão'}
                    </span>
                    {c.is_custom_limits && (
                      <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 bg-purple-950/80 text-purple-300 border border-purple-700/80 text-[10px] font-bold uppercase tracking-wider">
                        <Sparkles className="h-3 w-3 text-purple-400" />
                        Sob Medida
                      </span>
                    )}
                    <span className="font-mono text-slate-300 bg-slate-900 px-2 py-0.5 rounded border border-slate-700 text-[11px]">
                      {c.cnpj}
                    </span>
                    {(c.is_network || (c.stores && c.stores.length > 0)) && (
                      <span className="inline-flex items-center gap-1 rounded-md px-2.5 py-0.5 bg-cyan-950/90 text-cyan-300 border border-cyan-700/80 text-[10px] font-bold uppercase tracking-wider">
                        <Store className="h-3 w-3 text-cyan-400" />
                        Rede • {c.stores?.length || c.store_count || 0} {(c.stores?.length || c.store_count || 0) === 1 ? 'Loja' : 'Lojas'}
                      </span>
                    )}
                  </div>

                  {/* Lista resumida das Lojas da Rede no Card Mobile */}
                  {c.stores && c.stores.length > 0 && (
                    <div className="rounded-lg border border-cyan-900/50 bg-cyan-950/20 p-2.5 space-y-1.5">
                      <div className="flex items-center justify-between text-[10px] uppercase font-bold tracking-wider text-cyan-300">
                        <span className="flex items-center gap-1">
                          <GitBranch className="h-3 w-3 text-cyan-400" />
                          Unidades / Lojas da Rede
                        </span>
                        <button
                          type="button"
                          onClick={() => handleOpenStoresModal(c)}
                          className="text-cyan-400 hover:text-cyan-200 underline cursor-pointer"
                        >
                          Gerenciar
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {c.stores.slice(0, 4).map((st) => (
                          <span
                            key={st.id}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-900/90 border border-slate-700 text-[11px] text-slate-200"
                          >
                            <Store className="h-2.5 w-2.5 text-cyan-400 shrink-0" />
                            <span className="font-medium">{st.name}</span>
                            {st.city && <span className="text-[10px] text-slate-400">({st.city})</span>}
                          </span>
                        ))}
                        {c.stores.length > 4 && (
                          <span className="px-2 py-0.5 rounded bg-slate-900/60 text-[10px] text-slate-400 font-semibold">
                            +{c.stores.length - 4} lojas
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Detalhes de Quotas e Contato */}
                  <div className="grid grid-cols-3 gap-2 text-xs bg-slate-900/70 p-3 rounded-lg border border-slate-700/60">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Telas</span>
                      <span className="text-white font-semibold">
                        {c.player_count || 0} {c.max_players !== undefined ? `/ ${c.max_players}` : ''}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Operadores</span>
                      {c.max_operators === 0 ? (
                        <span className="text-amber-400 font-semibold text-[11px]">Sem op.</span>
                      ) : (
                        <span className="text-white font-semibold">
                          {c.operator_count || 0} {c.max_operators !== undefined ? `/ ${c.max_operators}` : ''}
                        </span>
                      )}
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Mídias (Drive)</span>
                      <span className="text-white font-semibold">
                        {c.media_count || 0} / {c.max_media || 20}
                      </span>
                    </div>
                    <div className="col-span-3 pt-2 border-t border-slate-800 text-slate-400 text-[11px] flex flex-wrap items-center justify-between gap-1">
                      <span className="truncate">{c.email}</span>
                      {c.due_date && <span className="shrink-0 font-mono text-slate-300">Vence: {c.due_date}</span>}
                    </div>
                    {c.drive_folder_url && (
                      <div className="col-span-3 pt-1">
                        <a
                          href={c.drive_folder_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-[11px] text-blue-400 hover:text-blue-300 font-semibold"
                        >
                          <Folder className="h-3.5 w-3.5 text-blue-400" />
                          <span>Abrir Pasta no Google Drive</span>
                          <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Botões de Ação para Celular (Área de toque otimizada >= 44px) */}
                  <div className="space-y-2 pt-1">
                    {onEnterCompany && (
                      <button
                        type="button"
                        onClick={() => onEnterCompany(c.id)}
                        className="w-full flex items-center justify-center gap-2 h-11 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider shadow-md transition cursor-pointer"
                      >
                        <ArrowRight className="h-4 w-4" />
                        <span>Acessar Painel da Empresa</span>
                      </button>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenCompanyModal(c)}
                        className="flex items-center justify-center gap-2 h-11 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold text-xs uppercase tracking-wider shadow-md transition cursor-pointer"
                      >
                        <Edit2 className="h-4 w-4" />
                        <span>Editar Matriz</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenStoresModal(c)}
                        className="flex items-center justify-center gap-1.5 h-11 px-3 rounded-xl border border-cyan-700/80 bg-cyan-950/40 hover:bg-cyan-900/50 text-cyan-200 font-bold text-xs uppercase tracking-wider transition cursor-pointer"
                      >
                        <Store className="h-4 w-4 text-cyan-400" />
                        <span>Lojas ({c.stores?.length || c.store_count || 0})</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setResetCompanyId(c.id);
                          setResetModalOpen(true);
                        }}
                        className="flex items-center justify-center gap-2 h-11 px-3 rounded-xl border border-amber-800/80 bg-amber-950/30 hover:bg-amber-900/40 active:bg-amber-900/60 text-amber-300 font-bold text-xs uppercase tracking-wider transition cursor-pointer"
                      >
                        <KeyRound className="h-4 w-4" />
                        <span>Resetar Senha</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggleCompany(c)}
                        className={`flex items-center justify-center gap-2 h-11 px-3 rounded-xl border font-bold text-xs uppercase tracking-wider transition cursor-pointer ${
                          c.status === 'active'
                            ? 'border-rose-800/80 bg-rose-950/20 text-rose-300 hover:bg-rose-950/40 active:bg-rose-950/60'
                            : 'border-emerald-800/80 bg-emerald-950/20 text-emerald-300 hover:bg-emerald-950/40 active:bg-emerald-950/60'
                        }`}
                      >
                        <Power className="h-3.5 w-3.5" />
                        <span>{c.status === 'active' ? 'Desativar' : 'Ativar'}</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteCompany(c)}
                      className="w-full flex items-center justify-center gap-2 h-10 px-3 rounded-xl border border-rose-900/60 bg-rose-950/20 hover:bg-rose-950/50 active:bg-rose-950/80 text-rose-400 font-bold text-xs uppercase tracking-wider transition cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>Excluir Empresa</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* VISÃO DESKTOP: TABELA COM SUPORTE A OVERFLOW HORIZONTAL */}
          <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-700 bg-slate-800 shadow-sm">
            <table className="w-full text-left text-xs text-slate-300 min-w-[700px]">
              <thead className="border-b border-slate-700 bg-slate-800/80 uppercase font-semibold text-slate-400 text-[10px] tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">Empresa</th>
                  <th className="px-5 py-3.5">CNPJ / E-mail</th>
                  <th className="px-5 py-3.5">Plano Contratado</th>
                  <th className="px-5 py-3.5">Players / Operadores</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {filteredCompanies.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                      Nenhuma empresa encontrada com os filtros atuais.
                    </td>
                  </tr>
                ) : (
                  filteredCompanies.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-700/30 transition">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-white text-sm">{c.trade_name}</p>
                          {(c.is_network || (c.stores && c.stores.length > 0)) && (
                            <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 bg-cyan-950/90 text-cyan-300 border border-cyan-800 text-[10px] font-bold uppercase tracking-wider">
                              <Store className="h-2.5 w-2.5 text-cyan-400" />
                              Rede • {c.stores?.length || c.store_count || 0} {(c.stores?.length || c.store_count || 0) === 1 ? 'Loja' : 'Lojas'}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400">{c.legal_name}</p>
                        {c.stores && c.stores.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1 mt-1.5">
                            {c.stores.slice(0, 3).map((st) => (
                              <span
                                key={st.id}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-900/90 border border-slate-700 text-[10px] text-cyan-200"
                              >
                                <Store className="h-2.5 w-2.5 text-cyan-400" />
                                {st.name}
                              </span>
                            ))}
                            {c.stores.length > 3 && (
                              <button
                                type="button"
                                onClick={() => handleOpenStoresModal(c)}
                                className="px-1.5 py-0.5 rounded bg-cyan-950/60 border border-cyan-800/60 text-[10px] text-cyan-300 hover:text-white font-semibold cursor-pointer"
                              >
                                +{c.stores.length - 3} lojas
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-mono text-slate-200">{c.cnpj}</p>
                        <p className="text-[11px] text-slate-400">{c.email}</p>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-col gap-1 items-start">
                          <span className="inline-block rounded px-2 py-0.5 bg-blue-900/40 text-blue-300 border border-blue-800 text-[10px] font-bold tracking-wider uppercase">
                            {c.plan_name || 'Plano Padrão'}
                          </span>
                          {c.is_custom_limits && (
                            <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 bg-purple-950/80 text-purple-300 border border-purple-800 text-[9px] font-bold uppercase tracking-wider">
                              <Sparkles className="h-2.5 w-2.5 text-purple-400" />
                              Sob Medida
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-slate-300 font-medium text-xs">
                          {c.player_count || 0}{c.max_players !== undefined ? `/${c.max_players}` : ''} players •{' '}
                          {c.max_operators === 0 ? (
                            <span className="text-amber-400 font-semibold text-[11px]">0 op.</span>
                          ) : (
                            `${c.operator_count || 0}${c.max_operators !== undefined ? `/${c.max_operators}` : ''} ops`
                          )}
                        </p>
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
                          <span>Mídias: <strong className="text-slate-200">{c.media_count || 0} / {c.max_media || 20}</strong></span>
                          {c.drive_folder_url && (
                            <a
                              href={c.drive_folder_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-400 hover:text-blue-300 font-semibold inline-flex items-center gap-0.5"
                              title="Abrir pasta no Google Drive"
                            >
                              <Folder className="h-3 w-3" />
                              <span>Drive</span>
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                            c.status === 'active'
                              ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                              : 'bg-rose-950/80 text-rose-300 border border-rose-800'
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              c.status === 'active' ? 'bg-emerald-400' : 'bg-rose-400'
                            }`}
                          />
                          {c.status === 'active' ? 'Ativa' : 'Inativa'}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {onEnterCompany && (
                            <button
                              onClick={() => onEnterCompany(c.id)}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600/90 text-white hover:bg-emerald-500 border border-emerald-500/60 transition cursor-pointer shadow-xs"
                              title="Acessar Painel desta Empresa (Gerenciar Mídias, Playlists, Players e Operadores)"
                            >
                              <ArrowRight className="h-3.5 w-3.5" />
                              <span className="text-[11px] font-bold">Painel</span>
                            </button>
                          )}
                          <button
                            onClick={() => handleOpenStoresModal(c)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-cyan-950/50 text-cyan-200 hover:text-white hover:bg-cyan-900/60 border border-cyan-800/60 transition cursor-pointer"
                            title="Gerenciar Lojas / Unidades da Rede"
                          >
                            <Store className="h-3.5 w-3.5 text-cyan-400" />
                            <span className="text-[11px] font-semibold">
                              Lojas ({c.stores?.length || c.store_count || 0})
                            </span>
                          </button>
                          <button
                            onClick={() => handleOpenCompanyModal(c)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-700/60 text-slate-200 hover:text-white hover:bg-slate-700 border border-slate-600/50 transition cursor-pointer"
                            title="Editar empresa"
                          >
                            <Edit2 className="h-3.5 w-3.5 text-blue-400" />
                            <span className="text-[11px] font-semibold">Editar</span>
                          </button>
                          <button
                            onClick={() => {
                              setResetCompanyId(c.id);
                              setResetModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-amber-400 hover:bg-slate-700 border border-transparent hover:border-amber-700/50 transition cursor-pointer"
                            title="Resetar senha"
                          >
                            <KeyRound className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleToggleCompany(c)}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition cursor-pointer ${
                              c.status === 'active'
                                ? 'border border-rose-800 text-rose-300 hover:bg-rose-950/40'
                                : 'border border-emerald-800 text-emerald-300 hover:bg-emerald-950/40'
                            }`}
                          >
                            {c.status === 'active' ? 'Desativar' : 'Ativar'}
                          </button>
                          <button
                            onClick={() => handleDeleteCompany(c)}
                            className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-950/50 border border-transparent hover:border-rose-700/50 transition cursor-pointer"
                            title="Excluir empresa"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW: PLANOS */}
      {activeTab === 'plans' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">Planos</h3>
            </div>
            <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto">
              <button
                id="btn-novo-plano-especial"
                onClick={() => handleOpenPlanModal(undefined, 'special')}
                className="w-full sm:w-auto justify-center flex items-center gap-1.5 rounded-lg bg-purple-700/80 hover:bg-purple-600 px-3 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-sm transition cursor-pointer border border-purple-500/50 text-center"
              >
                <Sparkles className="h-3.5 w-3.5 text-purple-200 shrink-0" />
                <span className="truncate">+ Especial</span>
              </button>
              <button
                id="btn-novo-plano"
                onClick={() => handleOpenPlanModal()}
                className="w-full sm:w-auto justify-center flex items-center gap-2 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-sm hover:bg-blue-500 transition cursor-pointer text-center"
              >
                <Plus className="h-4 w-4 shrink-0" />
                <span className="truncate">Novo Plano</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((p) => {
              const isShow = p.max_operators === 0;
              const isCall41 = !isShow && p.max_players > 0 && p.max_operators === p.max_players * 4;
              const isSpecial = !isShow && !isCall41;

              return (
                <div
                  key={p.id}
                  className={`rounded-xl border p-6 bg-slate-800 flex flex-col justify-between shadow-sm ${
                    p.active ? 'border-slate-700' : 'border-slate-700/50 opacity-60'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <h4 className="text-lg font-bold text-white tracking-tight">{p.name}</h4>
                        {isShow ? (
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-950/70 text-amber-300 border border-amber-800">
                            Show (Sem Op)
                          </span>
                        ) : isCall41 ? (
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-950/70 text-blue-300 border border-blue-800">
                            Call (4:1)
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-purple-950/70 text-purple-300 border border-purple-800 flex items-center gap-1">
                            <Sparkles className="h-2.5 w-2.5 text-purple-300" />
                            Especial Livre
                          </span>
                        )}
                      </div>
                      <span
                        className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${
                          p.active
                            ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                            : 'bg-slate-700 text-slate-400 border-slate-600'
                        }`}
                      >
                        {p.active ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>

                    <div className="space-y-2.5 text-xs text-slate-300 border-t border-slate-700 pt-4">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 uppercase text-[10px] font-semibold tracking-wider">Limite de Players / Telas:</span>
                        <strong className="text-white">{p.max_players} {p.max_players === 1 ? 'tela' : 'telas'}</strong>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 uppercase text-[10px] font-semibold tracking-wider">Limite de Operadores:</span>
                        {isShow ? (
                          <span className="text-amber-400 bg-amber-950/70 border border-amber-800/80 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                            Sem Operador (Mídia/RSS)
                          </span>
                        ) : isCall41 ? (
                          <strong className="text-white">
                            {p.max_operators} operadores (4 por tela)
                          </strong>
                        ) : (
                          <strong className="text-purple-300 flex items-center gap-1">
                            <span>{p.max_operators} operadores</span>
                            <span className="text-[10px] text-purple-400 font-normal">(Livre)</span>
                          </strong>
                        )}
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 uppercase text-[10px] font-semibold tracking-wider">Armazenamento / Mídias:</span>
                        <strong className="text-white">{p.max_storage} arquivos</strong>
                      </div>
                      <div className="flex justify-between items-baseline pt-3 border-t border-slate-700">
                        <span className="text-slate-400 uppercase text-[10px] font-semibold tracking-wider">Mensalidade:</span>
                        <strong className="text-lg text-blue-400 font-bold">
                          R$ {Number(p.monthly_price).toFixed(2)}<span className="text-xs text-slate-400 font-normal">/mês</span>
                        </strong>
                      </div>
                    </div>
                  </div>

                <div className="mt-6 pt-4 border-t border-slate-700 flex items-center justify-end gap-2">
                  <button
                    onClick={() => handleOpenPlanModal(p)}
                    className="px-3 py-1.5 rounded-lg border border-slate-600 text-xs font-bold uppercase tracking-wider text-slate-300 hover:text-white hover:bg-slate-700 transition cursor-pointer"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleTogglePlan(p)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
                      p.active
                        ? 'border border-rose-800 text-rose-300 hover:bg-rose-950/40'
                        : 'border border-emerald-800 text-emerald-300 hover:bg-emerald-950/40'
                    }`}
                  >
                    {p.active ? 'Desativar' : 'Ativar'}
                  </button>
                  <button
                    onClick={() => handleDeletePlan(p)}
                    className="p-1.5 rounded-lg border border-transparent hover:border-rose-800 text-rose-400 hover:bg-rose-950/40 transition cursor-pointer"
                    title="Excluir plano"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW: GOOGLE DRIVE & CENTRAL DE ARQUIVOS */}
      {activeTab === 'drive' && (
        <GoogleDriveFileManager
          companies={companies}
          isDevAdmin={true}
          showToast={showToast}
        />
      )}

      {/* MODAL EMPRESA - Otimizado para dispositivos móveis (Bottom-sheet) e desktop */}
      {companyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 p-0 sm:p-4 backdrop-blur-xs overflow-hidden">
          <div className="w-full max-w-2xl h-[92dvh] sm:h-auto max-h-[92dvh] sm:max-h-[90vh] flex flex-col rounded-t-2xl sm:rounded-2xl border-t sm:border border-slate-700 bg-slate-800 shadow-2xl text-slate-100 overflow-hidden">
            {/* Barra de arraste visual para dispositivos móveis */}
            <div className="w-12 h-1 bg-slate-600 rounded-full mx-auto mt-2.5 sm:hidden" />

            {/* Cabeçalho Fixo do Modal */}
            <div className="flex-shrink-0 px-4 sm:px-6 py-3.5 border-b border-slate-700 bg-slate-800/95 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm sm:text-base font-bold uppercase tracking-wider text-white">
                    {editingCompany ? 'Editar Empresa' : 'Nova Empresa'}
                  </h3>
                  {editingCompany && (
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-blue-900/60 text-blue-300 border border-blue-700/60 truncate max-w-[150px] sm:max-w-none">
                      {editingCompany.trade_name}
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCompanyModalOpen(false)}
                className="h-10 w-10 flex items-center justify-center rounded-xl bg-slate-700/50 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                title="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Formulário com Corpo Rolável e Rodapé Fixo */}
            <form onSubmit={handleSaveCompany} className="flex flex-col flex-1 min-h-0">
              <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-5 text-xs">
                {modalError && (
                  <div className="rounded-xl border border-rose-700/80 bg-rose-950/60 p-3.5 text-rose-200 flex items-start gap-2.5">
                    <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                    <div className="text-xs">
                      <span className="font-bold block">Não foi possível salvar:</span>
                      <span>{modalError}</span>
                    </div>
                  </div>
                )}

                {/* SEÇÃO 1: Identificação Cadastral */}
                <div className="space-y-3 bg-slate-900/40 p-3.5 sm:p-4 rounded-xl border border-slate-700/60">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-blue-400 block">
                      1. Identificação da Empresa (Matriz / Grupo)
                    </span>
                    {/* Seletor de Modalidade: Empresa Única vs Rede de Lojas */}
                    <div className="inline-flex rounded-lg border border-slate-700 bg-slate-900 p-0.5 self-start sm:self-auto">
                      <button
                        type="button"
                        onClick={() => setCompanyForm((prev) => ({ ...prev, is_network: false }))}
                        className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition cursor-pointer ${
                          !companyForm.is_network
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Unidade Única
                      </button>
                      <button
                        type="button"
                        onClick={() => setCompanyForm((prev) => ({ ...prev, is_network: true }))}
                        className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 transition cursor-pointer ${
                          companyForm.is_network
                            ? 'bg-cyan-600 text-white shadow-xs'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <Store className="h-3 w-3" />
                        <span>Rede de Lojas / Filiais</span>
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                        {companyForm.is_network ? 'Nome da Rede / Empresa Matriz *' : 'Nome Fantasia *'}
                      </label>
                      <input
                        type="text"
                        required
                        value={companyForm.trade_name}
                        onChange={(e) => setCompanyForm({ ...companyForm, trade_name: e.target.value })}
                        placeholder={companyForm.is_network ? 'Ex: Grupo Vale Lar & Vale Tudo' : 'Ex: Drogaria Central'}
                        className="w-full min-h-[44px] rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-sm sm:text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                        Razão Social *
                      </label>
                      <input
                        type="text"
                        required
                        value={companyForm.legal_name}
                        onChange={(e) => setCompanyForm({ ...companyForm, legal_name: e.target.value })}
                        placeholder="Ex: Drogaria Central Ltda"
                        className="w-full min-h-[44px] rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-sm sm:text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      CNPJ *
                    </label>
                    <input
                      type="text"
                      required
                      value={companyForm.cnpj}
                      onChange={(e) => setCompanyForm({ ...companyForm, cnpj: e.target.value })}
                      placeholder="00.000.000/0001-00"
                      className="w-full min-h-[44px] rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-sm sm:text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
                    />
                  </div>
                </div>

                {/* SEÇÃO 2: Contato e Gestão */}
                <div className="space-y-3 bg-slate-900/40 p-3.5 sm:p-4 rounded-xl border border-slate-700/60">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-blue-400 block">
                    2. Contato e Gestão
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                        E-mail de Login *
                      </label>
                      <input
                        type="email"
                        required
                        value={companyForm.email}
                        onChange={(e) => setCompanyForm({ ...companyForm, email: e.target.value })}
                        placeholder="contato@empresa.com"
                        className="w-full min-h-[44px] rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-sm sm:text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                        Telefone / WhatsApp
                      </label>
                      <input
                        type="text"
                        value={companyForm.phone}
                        onChange={(e) => setCompanyForm({ ...companyForm, phone: e.target.value })}
                        placeholder="(11) 99999-9999"
                        className="w-full min-h-[44px] rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-sm sm:text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                        Responsável
                      </label>
                      <input
                        type="text"
                        value={companyForm.responsible}
                        onChange={(e) => setCompanyForm({ ...companyForm, responsible: e.target.value })}
                        placeholder="Nome do gestor"
                        className="w-full min-h-[44px] rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-sm sm:text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {/* SEÇÃO 3: Endereço */}
                <div className="space-y-3 bg-slate-900/40 p-3.5 sm:p-4 rounded-xl border border-slate-700/60">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-blue-400 block">
                    3. Endereço e Localização
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    <div className="sm:col-span-3">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                        Endereço Completo
                      </label>
                      <input
                        type="text"
                        value={companyForm.address}
                        onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })}
                        placeholder="Rua, Número, Bairro, Complemento"
                        className="w-full min-h-[44px] rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-sm sm:text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                        Cidade
                      </label>
                      <input
                        type="text"
                        value={companyForm.city}
                        onChange={(e) => setCompanyForm({ ...companyForm, city: e.target.value })}
                        placeholder="Ex: São Paulo"
                        className="w-full min-h-[44px] rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-sm sm:text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                        Estado (UF)
                      </label>
                      <input
                        type="text"
                        maxLength={2}
                        value={companyForm.state}
                        onChange={(e) => setCompanyForm({ ...companyForm, state: e.target.value.toUpperCase() })}
                        placeholder="SP"
                        className="w-full min-h-[44px] rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-sm sm:text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 uppercase font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* SEÇÃO 3.1: LOJAS / UNIDADES DA REDE (FILIAIS) */}
                <div className="space-y-3.5 bg-cyan-950/20 p-3.5 sm:p-4 rounded-xl border border-cyan-800/60">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-cyan-400 flex items-center gap-1.5">
                        <Store className="h-3.5 w-3.5" />
                        <span>Lojas / Unidades da Rede ({companyForm.stores.length})</span>
                      </span>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Cadastre as lojas/filiais que pertencem a esta empresa (ex: Vale Lar Jacareí, Vale Tudo Jacareí, Vale Lar São José).
                      </p>
                    </div>
                    {!companyForm.is_network && (
                      <button
                        type="button"
                        onClick={() => setCompanyForm((prev) => ({ ...prev, is_network: true }))}
                        className="px-3 py-1.5 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/40 text-cyan-300 text-[10px] font-bold uppercase tracking-wider transition cursor-pointer shrink-0 self-start"
                      >
                        + Habilitar Rede de Lojas
                      </button>
                    )}
                  </div>

                  {(companyForm.is_network || companyForm.stores.length > 0) && (
                    <div className="space-y-3 pt-1">
                      {/* Formulário rápido para adicionar loja à lista */}
                      <div className="rounded-xl border border-slate-700/80 bg-slate-900/90 p-3 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-300">
                            Adicionar Nova Loja / Filial à Empresa
                          </span>
                          <span className="text-[10px] text-slate-400">
                            Você também poderá adicionar ou editar lojas depois
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                          <div className="sm:col-span-5">
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                              Nome da Loja / Unidade *
                            </label>
                            <input
                              type="text"
                              value={storeDraft.name}
                              onChange={(e) => setStoreDraft({ ...storeDraft, name: e.target.value })}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleAddDraftStore();
                                }
                              }}
                              placeholder="Ex: Vale Lar Jacareí"
                              className="w-full min-h-[40px] rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                            />
                          </div>
                          <div className="sm:col-span-3">
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                              Bandeira / Marca
                            </label>
                            <input
                              type="text"
                              value={storeDraft.brand_name}
                              onChange={(e) => setStoreDraft({ ...storeDraft, brand_name: e.target.value })}
                              placeholder="Ex: Vale Lar"
                              className="w-full min-h-[40px] rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                            />
                          </div>
                          <div className="sm:col-span-3">
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                              Cidade
                            </label>
                            <input
                              type="text"
                              value={storeDraft.city}
                              onChange={(e) => setStoreDraft({ ...storeDraft, city: e.target.value })}
                              placeholder={companyForm.city || 'Ex: Jacareí'}
                              className="w-full min-h-[40px] rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                            />
                          </div>
                          <div className="sm:col-span-1">
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                              UF
                            </label>
                            <input
                              type="text"
                              maxLength={2}
                              value={storeDraft.state}
                              onChange={(e) => setStoreDraft({ ...storeDraft, state: e.target.value.toUpperCase() })}
                              placeholder={companyForm.state || 'SP'}
                              className="w-full min-h-[40px] rounded-xl border border-slate-700 bg-slate-800 px-2 py-2 text-xs text-white text-center font-mono uppercase placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                            />
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-1">
                          <input
                            type="text"
                            value={storeDraft.address}
                            onChange={(e) => setStoreDraft({ ...storeDraft, address: e.target.value })}
                            placeholder="Endereço ou observação da loja (opcional)"
                            className="flex-1 min-h-[38px] rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                          />
                          <button
                            type="button"
                            onClick={handleAddDraftStore}
                            className="h-9 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-sm transition cursor-pointer shrink-0"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            <span>Adicionar Loja</span>
                          </button>
                        </div>
                      </div>

                      {/* Lista de Lojas adicionadas */}
                      {companyForm.stores.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/40 p-4 text-center text-slate-400 text-xs">
                          Nenhuma loja adicionada ainda. Preencha o nome acima e clique em <strong>Adicionar Loja</strong>.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {companyForm.stores.map((st, idx) => (
                            <div
                              key={st.id || idx}
                              className="flex items-center justify-between gap-2 rounded-xl border border-cyan-800/50 bg-slate-900/90 px-3 py-2.5"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <Store className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                                  <span className="font-bold text-white text-xs truncate">{st.name}</span>
                                  {st.brand_name && (
                                    <span className="px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 text-[9px] font-bold uppercase">
                                      {st.brand_name}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                                  <span className="font-mono text-slate-500">{st.code || `LOJA-0${idx + 1}`}</span>
                                  {(st.city || st.state) && (
                                    <span className="flex items-center gap-0.5">
                                      <MapPin className="h-2.5 w-2.5 text-slate-500" />
                                      {st.city}{st.state ? `/${st.state}` : ''}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveDraftStore(idx)}
                                className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-950/50 hover:text-rose-300 transition cursor-pointer shrink-0"
                                title="Remover loja"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* SEÇÃO 4: Plano Contratado e Vigência */}
                <div className="space-y-3 bg-slate-900/40 p-3.5 sm:p-4 rounded-xl border border-slate-700/60">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-blue-400 block">
                      4. Plano e Vigência
                    </span>
                    <button
                      type="button"
                      onClick={() => handleOpenPlanModal(undefined, 'special')}
                      className="text-[10px] font-bold text-purple-400 hover:text-purple-300 flex items-center gap-1 cursor-pointer underline"
                    >
                      <Sparkles className="h-3 w-3" />
                      <span>+ Criar Plano Especial</span>
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                        Plano Contratado *
                      </label>
                      <select
                        required
                        value={companyForm.plan_id}
                        onChange={(e) => setCompanyForm({ ...companyForm, plan_id: e.target.value })}
                        className="w-full min-h-[44px] rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-sm sm:text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                      >
                        <option value="">Selecione um plano...</option>
                        {(() => {
                          const callPlans = plans.filter((p) => p.max_operators > 0 && p.max_players > 0 && p.max_operators === p.max_players * 4);
                          const showPlans = plans.filter((p) => p.max_operators === 0);
                          const specialPlans = plans.filter((p) => p.max_operators > 0 && !(p.max_players > 0 && p.max_operators === p.max_players * 4));

                          return (
                            <>
                              {callPlans.length > 0 && (
                                <optgroup label="Linha Call (Proporção 4:1)">
                                  {callPlans.map((p) => (
                                    <option key={p.id} value={p.id}>
                                      {p.name} ({p.max_players} {p.max_players === 1 ? 'tela' : 'telas'} | {p.max_operators} operadores)
                                    </option>
                                  ))}
                                </optgroup>
                              )}
                              {showPlans.length > 0 && (
                                <optgroup label="Linha Show (Sem Operador)">
                                  {showPlans.map((p) => (
                                    <option key={p.id} value={p.id}>
                                      {p.name} ({p.max_players} {p.max_players === 1 ? 'tela' : 'telas'} | Sem operador)
                                    </option>
                                  ))}
                                </optgroup>
                              )}
                              {specialPlans.length > 0 && (
                                <optgroup label="Planos Especiais Sob Medida (Livre)">
                                  {specialPlans.map((p) => (
                                    <option key={p.id} value={p.id}>
                                      ⭐ {p.name} ({p.max_players} {p.max_players === 1 ? 'tela' : 'telas'} | {p.max_operators} operadores)
                                    </option>
                                  ))}
                                </optgroup>
                              )}
                            </>
                          );
                        })()}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                        Data de Início
                      </label>
                      <input
                        type="date"
                        value={companyForm.start_date}
                        onChange={(e) => setCompanyForm({ ...companyForm, start_date: e.target.value })}
                        className="w-full min-h-[44px] rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-sm sm:text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                        Data de Vencimento
                      </label>
                      <input
                        type="date"
                        value={companyForm.due_date}
                        onChange={(e) => setCompanyForm({ ...companyForm, due_date: e.target.value })}
                        className="w-full min-h-[44px] rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-sm sm:text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  {/* LIMITES ESPECIAIS SOB MEDIDA (TRAVA DE 4 OPERADORES LIBERADA) */}
                  <div className="mt-3.5 p-3 sm:p-3.5 rounded-xl border border-purple-800/60 bg-purple-950/20 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-purple-300 font-bold text-xs">
                        <Sparkles className="h-3.5 w-3.5 text-purple-400" />
                        <span>Definição Livre de Operadores e Telas (Planos Especiais)</span>
                      </div>
                      {(companyForm.max_players !== '' || companyForm.max_operators !== '' || companyForm.max_media !== '') && (
                        <button
                          type="button"
                          onClick={() => setCompanyForm({ ...companyForm, max_players: '', max_operators: '', max_media: '' })}
                          className="text-[10px] text-purple-400 hover:text-purple-200 underline cursor-pointer"
                        >
                          Usar Padrão do Plano
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-300 mb-1">
                          Qtd. Telas / Players (Livre)
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={companyForm.max_players}
                          onChange={(e) => setCompanyForm({ ...companyForm, max_players: e.target.value })}
                          placeholder={
                            (() => {
                              const p = plans.find((pl) => pl.id === companyForm.plan_id);
                              return p ? `Padrão: ${p.max_players} telas` : 'Ex: 5';
                            })()
                          }
                          className="w-full min-h-[40px] rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-300 mb-1">
                          Qtd. Operadores (Livre)
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={companyForm.max_operators}
                          onChange={(e) => setCompanyForm({ ...companyForm, max_operators: e.target.value })}
                          placeholder={
                            (() => {
                              const p = plans.find((pl) => pl.id === companyForm.plan_id);
                              return p ? `Padrão: ${p.max_operators} ops` : 'Ex: 10';
                            })()
                          }
                          className="w-full min-h-[40px] rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-300 mb-1">
                          Limite de Mídias (Cota Livre)
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={companyForm.max_media}
                          onChange={(e) => setCompanyForm({ ...companyForm, max_media: e.target.value })}
                          placeholder={
                            (() => {
                              const p = plans.find((pl) => pl.id === companyForm.plan_id);
                              return p ? `Padrão: ${p.max_media || p.max_storage || 20} mídias` : 'Ex: 50';
                            })()
                          }
                          className="w-full min-h-[40px] rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                        />
                      </div>
                    </div>

                    {/* Pasta Dedicada no Google Drive */}
                    <div className="pt-2 border-t border-slate-800">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-300 mb-1 flex items-center gap-1.5">
                        <Folder className="h-3.5 w-3.5 text-blue-400" />
                        <span>Link da Pasta no Google Drive (Opcional)</span>
                      </label>
                      <input
                        type="url"
                        value={companyForm.drive_folder_url || ''}
                        onChange={(e) => setCompanyForm({ ...companyForm, drive_folder_url: e.target.value })}
                        placeholder="https://drive.google.com/drive/folders/..."
                        className="w-full min-h-[40px] rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {/* SEÇÃO 5: Senha de Acesso */}
                <div className="space-y-3 bg-slate-900/40 p-3.5 sm:p-4 rounded-xl border border-slate-700/60">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-blue-400 block">
                    {editingCompany ? '5. Atualizar Senha de Acesso (Opcional)' : '5. Senha Inicial de Acesso'}
                  </span>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      {editingCompany ? 'Nova Senha (deixe em branco para manter a atual)' : 'Senha Inicial de Acesso'}
                    </label>
                    <input
                      type="password"
                      value={companyForm.password}
                      onChange={(e) => setCompanyForm({ ...companyForm, password: e.target.value })}
                      placeholder={editingCompany ? 'Digite caso queira alterar a senha de acesso da empresa...' : 'Padrão: 123456 (ou digite uma senha definitiva)'}
                      className="w-full min-h-[44px] rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-sm sm:text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Rodapé Fixo com Botões Visíveis em Qualquer Dispositivo */}
              <div className="flex-shrink-0 px-4 sm:px-6 py-3.5 border-t border-slate-700 bg-slate-800/95 backdrop-blur-md flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setCompanyModalOpen(false)}
                  className="h-11 px-5 rounded-xl border border-slate-600 bg-slate-700 text-xs font-bold uppercase tracking-wider text-slate-300 hover:text-white hover:bg-slate-600 active:bg-slate-800 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingCompany}
                  className="h-11 px-6 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 text-xs sm:text-sm font-bold uppercase tracking-wider text-white shadow-lg flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  {isSavingCompany ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      <span>{editingCompany ? 'Salvar Alterações' : 'Cadastrar Empresa'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PLANO - Otimizado para Mobile e Desktop */}
      {planModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 p-0 sm:p-4 backdrop-blur-xs overflow-hidden">
          <div className="w-full max-w-md h-[90dvh] sm:h-auto max-h-[90dvh] sm:max-h-[85vh] flex flex-col rounded-t-2xl sm:rounded-2xl border-t sm:border border-slate-700 bg-slate-800 shadow-2xl text-slate-100 overflow-hidden">
            <div className="w-12 h-1 bg-slate-600 rounded-full mx-auto mt-2.5 sm:hidden" />

            {/* Cabeçalho Fixo */}
            <div className="flex-shrink-0 px-4 sm:px-6 py-3.5 border-b border-slate-700 bg-slate-800/95 flex items-center justify-between">
              <h3 className="text-sm sm:text-base font-bold uppercase tracking-wider text-white">
                {editingPlan ? 'Editar Plano' : 'Novo Plano'}
              </h3>
              <button
                type="button"
                onClick={() => setPlanModalOpen(false)}
                className="h-9 w-9 flex items-center justify-center rounded-xl bg-slate-700/50 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                title="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSavePlan} className="flex flex-col flex-1 min-h-0">
              <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-4 text-xs">
                {planModalError && (
                  <div className="rounded-xl border border-rose-700/80 bg-rose-950/60 p-3 text-rose-200 flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <div className="text-xs">
                      <span className="font-bold block">Erro ao salvar plano:</span>
                      <span>{planModalError}</span>
                    </div>
                  </div>
                )}

                {/* Seletor de Modelos Predefinidos */}
                <div className="rounded-xl border border-slate-700 bg-slate-900/90 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">
                      Modelos Rápidos (Clique para preencher)
                    </span>
                    <span className="text-[9px] text-slate-500 font-mono">Call (4:1) | Show (0 Op) | Especial (Livre)</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {PLAN_TEMPLATES.map((tpl) => {
                      const isSelected = planForm.name.toLowerCase() === tpl.name.toLowerCase();
                      const isSpecial = tpl.type === 'special';
                      const isShow = tpl.type === 'show';
                      return (
                        <button
                          key={tpl.name}
                          type="button"
                          onClick={() => handleApplyPlanTemplate(tpl)}
                          className={`px-2.5 py-1.5 rounded-lg text-left border transition text-[11px] cursor-pointer flex flex-col ${
                            isSelected
                              ? isSpecial
                                ? 'border-purple-500 bg-purple-950/70 text-white shadow-sm ring-1 ring-purple-500/50'
                                : isShow
                                ? 'border-amber-500 bg-amber-950/70 text-white shadow-sm ring-1 ring-amber-500/50'
                                : 'border-blue-500 bg-blue-950/70 text-white shadow-sm ring-1 ring-blue-500/50'
                              : 'border-slate-700/80 bg-slate-800 hover:bg-slate-700/80 text-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-bold truncate">{tpl.name}</span>
                            {isSpecial && <Sparkles className="h-3 w-3 text-purple-400 shrink-0" />}
                          </div>
                          <span className="text-[9px] text-slate-400 font-mono mt-0.5">{tpl.tag}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Nome do Plano *</label>
                  <input
                    type="text"
                    required
                    value={planForm.name}
                    onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                    placeholder="Ex: Call Básico, Show Intermediário ou Especial Sob Medida"
                    className="w-full min-h-[44px] rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Descrição</label>
                  <textarea
                    rows={2}
                    value={planForm.description}
                    onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })}
                    placeholder="Detalhes sobre a capacidade deste plano"
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Tipo / Modalidade de Plano */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Regra de Operadores e Telas *
                  </label>
                  <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-900 rounded-xl border border-slate-700">
                    <button
                      type="button"
                      onClick={() => {
                        setPlanMode('call');
                        setPlanWithoutOperator(false);
                        setAutoCalcRatio(true);
                        const screens = Number(planForm.max_players) || 1;
                        setPlanForm({ ...planForm, max_operators: screens * 4 });
                      }}
                      className={`py-2 px-2 rounded-lg text-center transition cursor-pointer flex flex-col items-center justify-center ${
                        planMode === 'call'
                          ? 'bg-blue-600 text-white font-bold shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span className="text-xs font-bold">Linha Call</span>
                      <span className="text-[10px] opacity-80">Proporção 4:1</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setPlanMode('show');
                        setPlanWithoutOperator(true);
                        setAutoCalcRatio(false);
                        setPlanForm({ ...planForm, max_operators: 0 });
                      }}
                      className={`py-2 px-2 rounded-lg text-center transition cursor-pointer flex flex-col items-center justify-center ${
                        planMode === 'show'
                          ? 'bg-amber-600 text-white font-bold shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span className="text-xs font-bold">Linha Show</span>
                      <span className="text-[10px] opacity-80">Sem Operador</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setPlanMode('special');
                        setPlanWithoutOperator(false);
                        setAutoCalcRatio(false);
                      }}
                      className={`py-2 px-2 rounded-lg text-center transition cursor-pointer flex flex-col items-center justify-center ${
                        planMode === 'special'
                          ? 'bg-purple-600 text-white font-bold shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-1">
                        <Sparkles className="h-3 w-3 text-purple-300" />
                        <span className="text-xs font-bold">Especial</span>
                      </div>
                      <span className="text-[10px] opacity-80">Livre / Sob Medida</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Número de Telas / Players *
                    </label>
                    <input
                      type="number"
                      min={1}
                      required
                      value={planForm.max_players}
                      onChange={(e) => {
                        const v = e.target.value;
                        const screens = v === '' ? '' : Math.max(1, Number(v));
                        if (planMode === 'call' && autoCalcRatio && typeof screens === 'number') {
                          setPlanForm({
                            ...planForm,
                            max_players: screens,
                            max_operators: screens * 4,
                          });
                        } else {
                          setPlanForm({ ...planForm, max_players: screens });
                        }
                      }}
                      placeholder="Ex: 2"
                      className="w-full min-h-[44px] rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Limite de Operadores *
                      </label>
                      {planMode === 'call' && autoCalcRatio && (
                        <button
                          type="button"
                          onClick={() => {
                            setAutoCalcRatio(false);
                            setPlanMode('special');
                          }}
                          className="text-[10px] text-purple-400 hover:text-purple-300 font-semibold cursor-pointer underline flex items-center gap-1"
                        >
                          <Sparkles className="h-2.5 w-2.5" />
                          <span>Destravar 4:1 (Livre)</span>
                        </button>
                      )}
                      {planMode === 'special' && (
                        <span className="text-[10px] text-purple-400 font-semibold flex items-center gap-0.5">
                          <Sparkles className="h-2.5 w-2.5" /> Livre / Sob Medida
                        </span>
                      )}
                    </div>

                    {planMode === 'show' || planWithoutOperator ? (
                      <div className="w-full rounded-xl border border-amber-800/80 bg-amber-950/40 px-3.5 py-2 text-amber-300 font-semibold text-xs flex items-center justify-between min-h-[44px]">
                        <span>0 operadores</span>
                        <span className="text-[10px] uppercase font-bold text-amber-400 bg-amber-900/80 px-1.5 py-0.5 rounded">Sem Chamada</span>
                      </div>
                    ) : (
                      <div className="relative">
                        <input
                          type="number"
                          min={0}
                          required
                          disabled={planMode === 'call' && autoCalcRatio}
                          value={planForm.max_operators}
                          onChange={(e) => {
                            const v = e.target.value;
                            setPlanForm({ ...planForm, max_operators: v === '' ? '' : Math.max(0, Number(v)) });
                          }}
                          placeholder="Ex: 10"
                          className={`w-full min-h-[44px] rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 ${
                            planMode === 'call' && autoCalcRatio
                              ? 'opacity-90 bg-slate-900/80 cursor-not-allowed text-blue-300 pr-24'
                              : 'text-white'
                          }`}
                        />
                        {planMode === 'call' && autoCalcRatio && (
                          <span className="absolute right-2.5 top-2.5 text-[10px] font-mono text-blue-400 bg-blue-950/80 px-1.5 py-0.5 rounded border border-blue-800">
                            {Number(planForm.max_players) || 1} x 4 = {planForm.max_operators}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Limite de Mídias *</label>
                    <input
                      type="number"
                      min={1}
                      required
                      value={planForm.max_storage}
                      onChange={(e) => {
                        const v = e.target.value;
                        setPlanForm({ ...planForm, max_storage: v === '' ? '' : Number(v) });
                      }}
                      placeholder="Ex: 100"
                      className="w-full min-h-[44px] rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Valor Mensal (R$) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      required
                      value={planForm.monthly_price}
                      onChange={(e) => {
                        const v = e.target.value;
                        setPlanForm({ ...planForm, monthly_price: v === '' ? '' : Number(v) });
                      }}
                      placeholder="Ex: 49.00"
                      className="w-full min-h-[44px] rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Rodapé Fixo */}
              <div className="flex-shrink-0 px-4 sm:px-6 py-3.5 border-t border-slate-700 bg-slate-800/95 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setPlanModalOpen(false)}
                  className="h-11 px-5 rounded-xl border border-slate-600 bg-slate-700 text-xs font-bold uppercase tracking-wider text-slate-300 hover:text-white hover:bg-slate-600 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingPlan}
                  className="h-11 px-6 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 text-xs font-bold uppercase tracking-wider text-white shadow-md flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  {isSavingPlan ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <span>Salvar Plano</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL RESET SENHA - Otimizado para Mobile e Desktop */}
      {resetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 p-0 sm:p-4 backdrop-blur-xs overflow-hidden">
          <div className="w-full max-w-sm rounded-t-2xl sm:rounded-2xl border-t sm:border border-slate-700 bg-slate-800 p-5 sm:p-6 shadow-2xl text-slate-100">
            <div className="w-12 h-1 bg-slate-600 rounded-full mx-auto mb-3 sm:hidden" />
            <div className="flex items-center justify-between border-b border-slate-700 pb-3 mb-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">Resetar Senha da Empresa</h3>
              <button
                type="button"
                onClick={() => setResetModalOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleResetPassword} className="space-y-4 text-xs">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Nova Senha Provisória</label>
                <input
                  type="password"
                  value={newPasswordInput}
                  onChange={(e) => setNewPasswordInput(e.target.value)}
                  placeholder="Deixe em branco para o padrão: 123456"
                  className="w-full min-h-[44px] rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-700">
                <button
                  type="button"
                  onClick={() => setResetModalOpen(false)}
                  className="h-11 px-4 rounded-xl border border-slate-600 bg-slate-700 text-xs font-bold uppercase tracking-wider text-slate-300 hover:text-white hover:bg-slate-600 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="h-11 px-5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold uppercase tracking-wider text-white shadow-md transition cursor-pointer"
                >
                  Confirmar Reset
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RELATÓRIO DE AUDITORIA DE MÍDIAS / DRIVE */}
      {showIntegrityReportModal && adminIntegrityReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-xs">
          <div className="w-full max-w-3xl rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div
                  className={`rounded-xl p-2.5 ${
                    adminIntegrityReport.has_issues
                      ? 'bg-rose-950/80 text-rose-400 border border-rose-700'
                      : 'bg-emerald-950/80 text-emerald-400 border border-emerald-700'
                  }`}
                >
                  {adminIntegrityReport.has_issues ? (
                    <ShieldAlert className="h-6 w-6" />
                  ) : (
                    <ShieldCheck className="h-6 w-6" />
                  )}
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Auditoria de Integridade de Mídias & Google Drive
                  </h3>
                  <p className="text-xs text-slate-400">
                    Verificação cruzada entre banco Firebase Firestore, Google Drive e URLs de mídia
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowIntegrityReportModal(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* SUMMARY STATS */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4">
              <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Mídias</span>
                <span className="text-xl font-bold text-white">{adminIntegrityReport.summary.total}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700">
                <span className="text-[10px] uppercase font-bold text-emerald-400 block">Íntegras & Acessíveis</span>
                <span className="text-xl font-bold text-emerald-400">{adminIntegrityReport.summary.healthy}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700">
                <span className="text-[10px] uppercase font-bold text-rose-400 block">Inacessíveis / Falha</span>
                <span className="text-xl font-bold text-rose-400">{adminIntegrityReport.summary.inaccessible}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700">
                <span className="text-[10px] uppercase font-bold text-blue-400 block">Google Drive</span>
                <span className="text-xl font-bold text-blue-400">{adminIntegrityReport.summary.google_drive_count}</span>
              </div>
            </div>

            {/* STATUS MESSAGE */}
            <div
              className={`p-3 rounded-xl border text-xs mb-4 ${
                adminIntegrityReport.has_issues
                  ? 'bg-rose-950/30 border-rose-800/60 text-rose-200'
                  : 'bg-emerald-950/20 border-emerald-800/50 text-emerald-200'
              }`}
            >
              {adminIntegrityReport.has_issues
                ? `Atenção: ${adminIntegrityReport.issues.length} mídia(s) cadastrada(s) no Firebase não puderam ser acessadas no Google Drive ou servidor. Mídias problemáticas podem causar tela preta nos terminais.`
                : 'Excelente! Todos os arquivos cadastrados no Firebase Firestore estão acessíveis no Google Drive e prontos para transmissão contínua 24/7.'}
            </div>

            {/* ISSUES LIST OR ITEMS LIST */}
            <div className="overflow-y-auto flex-1 space-y-2.5 pr-1">
              {adminIntegrityReport.issues.length > 0 ? (
                adminIntegrityReport.issues.map((issue) => (
                  <div
                    key={issue.media_id}
                    className="p-3 rounded-xl border border-rose-800/60 bg-slate-800/80 flex flex-col justify-between gap-2"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="text-xs font-bold text-white block">{issue.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          Origem: {issue.source === 'google_drive' ? 'Google Drive' : issue.source}
                        </span>
                      </div>
                      <span className="rounded bg-rose-900 border border-rose-700 px-2 py-0.5 text-[9px] font-bold uppercase text-rose-200">
                        {issue.status}
                      </span>
                    </div>
                    <p className="text-xs text-rose-300 font-medium">{issue.message}</p>
                    {(issue.playlists_affected.length > 0 || issue.players_affected.length > 0) && (
                      <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-700/60">
                        {issue.playlists_affected.length > 0 && (
                          <p>Playlists: <span className="text-slate-200">{issue.playlists_affected.join(', ')}</span></p>
                        )}
                        {issue.players_affected.length > 0 && (
                          <p>Telas: <span className="text-amber-400">{issue.players_affected.map((p) => p.name || p.code).join(', ')}</span></p>
                        )}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-slate-400">
                  <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto mb-2 opacity-80" />
                  <p className="text-xs font-semibold text-slate-300">Nenhum problema de integridade detectado.</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Todas as mídias no banco de dados estão ativas e acessíveis.</p>
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
              <span className="text-[10px] text-slate-500 font-mono">
                Auditado em: {new Date(adminIntegrityReport.checked_at).toLocaleString()}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleAuditAdminMedia}
                  disabled={isAuditingMedia}
                  className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-xs font-bold text-slate-300 hover:text-white transition cursor-pointer"
                >
                  Reexecutar Auditoria
                </button>
                <button
                  type="button"
                  onClick={() => setShowIntegrityReportModal(false)}
                  className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white transition cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DEDICADO: GERENCIAR LOJAS / UNIDADES DA REDE */}
      {storesModalCompany && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 p-0 sm:p-4 backdrop-blur-xs overflow-hidden">
          <div className="w-full max-w-2xl h-[90dvh] sm:h-auto max-h-[90dvh] sm:max-h-[88vh] flex flex-col rounded-t-2xl sm:rounded-2xl border-t sm:border border-slate-700 bg-slate-800 shadow-2xl text-slate-100 overflow-hidden">
            <div className="w-12 h-1 bg-slate-600 rounded-full mx-auto mt-2.5 sm:hidden" />

            <div className="flex-shrink-0 px-4 sm:px-6 py-3.5 border-b border-slate-700 bg-slate-800/95 flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-cyan-950 border border-cyan-800 flex items-center justify-center shrink-0">
                  <Store className="h-4 w-4 text-cyan-400" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-bold uppercase tracking-wider text-white truncate">
                    Lojas / Unidades da Rede
                  </h3>
                  <p className="text-xs text-cyan-300 font-medium truncate">
                    Matriz: {storesModalCompany.trade_name} ({companyStoresList.length} {companyStoresList.length === 1 ? 'loja' : 'lojas'})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStoresModalCompany(null)}
                className="h-9 w-9 flex items-center justify-center rounded-xl bg-slate-700/50 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-5 text-xs">
              {/* Formulário de Cadastro / Edição de Loja */}
              <form
                onSubmit={handleSaveQuickStore}
                className="rounded-xl border border-cyan-800/60 bg-slate-900/70 p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400">
                    {editingQuickStore ? `Editando Loja: ${editingQuickStore.name}` : 'Nova Loja / Filial da Rede'}
                  </span>
                  {editingQuickStore && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingQuickStore(null);
                        setQuickStoreForm({
                          name: '',
                          brand_name: '',
                          code: '',
                          city: storesModalCompany.city || '',
                          state: storesModalCompany.state || 'SP',
                          address: '',
                          phone: '',
                          responsible: '',
                        });
                      }}
                      className="text-[10px] text-slate-400 hover:text-white underline cursor-pointer"
                    >
                      Cancelar edição
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <div className="sm:col-span-5">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Nome da Loja / Unidade *
                    </label>
                    <input
                      type="text"
                      required
                      value={quickStoreForm.name}
                      onChange={(e) => setQuickStoreForm({ ...quickStoreForm, name: e.target.value })}
                      placeholder="Ex: Vale Lar Jacareí"
                      className="w-full min-h-[42px] rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div className="sm:col-span-4">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Bandeira / Marca (Opcional)
                    </label>
                    <input
                      type="text"
                      value={quickStoreForm.brand_name}
                      onChange={(e) => setQuickStoreForm({ ...quickStoreForm, brand_name: e.target.value })}
                      placeholder="Ex: Vale Lar ou Vale Tudo"
                      className="w-full min-h-[42px] rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Código
                    </label>
                    <input
                      type="text"
                      value={quickStoreForm.code}
                      onChange={(e) => setQuickStoreForm({ ...quickStoreForm, code: e.target.value.toUpperCase() })}
                      placeholder="Ex: LOJA-01"
                      className="w-full min-h-[42px] rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white font-mono uppercase placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <div className="sm:col-span-4">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Cidade *
                    </label>
                    <input
                      type="text"
                      required
                      value={quickStoreForm.city}
                      onChange={(e) => setQuickStoreForm({ ...quickStoreForm, city: e.target.value })}
                      placeholder="Ex: Jacareí ou São José dos Campos"
                      className="w-full min-h-[42px] rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      UF
                    </label>
                    <input
                      type="text"
                      maxLength={2}
                      value={quickStoreForm.state}
                      onChange={(e) => setQuickStoreForm({ ...quickStoreForm, state: e.target.value.toUpperCase() })}
                      placeholder="SP"
                      className="w-full min-h-[42px] rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white font-mono uppercase text-center placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div className="sm:col-span-6">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Gerente / Responsável da Loja
                    </label>
                    <input
                      type="text"
                      value={quickStoreForm.responsible}
                      onChange={(e) => setQuickStoreForm({ ...quickStoreForm, responsible: e.target.value })}
                      placeholder="Nome do gerente local (opcional)"
                      className="w-full min-h-[42px] rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
                  <input
                    type="text"
                    value={quickStoreForm.address}
                    onChange={(e) => setQuickStoreForm({ ...quickStoreForm, address: e.target.value })}
                    placeholder="Endereço da loja (opcional)"
                    className="flex-1 min-h-[42px] rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                  <button
                    type="submit"
                    disabled={savingQuickStore}
                    className="h-10 px-5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md transition cursor-pointer shrink-0"
                  >
                    {savingQuickStore ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : editingQuickStore ? (
                      <>
                        <Check className="h-4 w-4" />
                        <span>Salvar Loja</span>
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4" />
                        <span>Cadastrar Loja</span>
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* Lista de Lojas Cadastradas */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                    Lojas Vinculadas a {storesModalCompany.trade_name} ({companyStoresList.length})
                  </h4>
                </div>

                {loadingStores ? (
                  <div className="py-8 text-center text-slate-400 flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
                    <span>Carregando lojas...</span>
                  </div>
                ) : companyStoresList.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/40 p-6 text-center text-slate-400 space-y-2">
                    <Store className="h-7 w-7 text-slate-500 mx-auto" />
                    <p className="text-xs font-medium text-slate-300">
                      Nenhuma loja/filial cadastrada para esta empresa.
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Utilize o formulário acima para adicionar unidades (ex: Vale Lar Jacareí, Vale Tudo Jacareí, Vale Lar São José).
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {companyStoresList.map((st) => (
                      <div
                        key={st.id}
                        className="rounded-xl border border-slate-700 bg-slate-900/90 p-3.5 flex flex-col justify-between gap-2.5 hover:border-cyan-700/60 transition"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-white text-sm">{st.name}</span>
                              {st.brand_name && (
                                <span className="px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 text-[9px] font-bold uppercase">
                                  {st.brand_name}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-1">
                              {st.code && <span className="font-mono text-slate-300 bg-slate-800 px-1.5 py-0.5 rounded">{st.code}</span>}
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3 text-cyan-400" />
                                {st.city}{st.state ? ` - ${st.state}` : ''}
                              </span>
                            </div>
                            {st.address && <p className="text-[11px] text-slate-500 mt-1 truncate">{st.address}</p>}
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingQuickStore(st);
                                setQuickStoreForm({
                                  name: st.name,
                                  brand_name: st.brand_name || '',
                                  code: st.code || '',
                                  city: st.city || '',
                                  state: st.state || 'SP',
                                  address: st.address || '',
                                  phone: st.phone || '',
                                  responsible: st.responsible || '',
                                });
                              }}
                              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                              title="Editar loja"
                            >
                              <Edit2 className="h-3.5 w-3.5 text-cyan-400" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteQuickStore(st)}
                              className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-950/50 transition cursor-pointer"
                              title="Excluir loja"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[10px] text-slate-400">
                          <span>Telas vinculadas: <strong className="text-white">{st.player_count || 0}</strong></span>
                          <span>Operadores: <strong className="text-white">{st.operator_count || 0}</strong></span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex-shrink-0 px-4 sm:px-6 py-3 border-t border-slate-700 bg-slate-800/95 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setStoresModalCompany(null)}
                className="h-10 px-5 rounded-xl bg-slate-700 hover:bg-slate-600 text-xs font-bold uppercase tracking-wider text-white transition cursor-pointer"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CONFIGURAÇÃO CLOUDFLARE R2 */}
      <CloudflareR2ConfigModal
        isOpen={r2ModalOpen}
        onClose={() => setR2ModalOpen(false)}
      />

      {/* CONFIRMAÇÃO DE AÇÃO */}
      <ConfirmModal
        isOpen={confirmData.isOpen}
        title={confirmData.title}
        message={confirmData.message}
        onConfirm={confirmData.action}
        onCancel={() => setConfirmData((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};
