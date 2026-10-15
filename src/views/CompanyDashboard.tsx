import React, { useState, useEffect, useRef } from 'react';
import {
  Monitor,
  Users,
  Film,
  Image as ImageIcon,
  Rss,
  Plus,
  Edit2,
  Trash2,
  KeyRound,
  Power,
  ExternalLink,
  UploadCloud,
  Clock,
  Radio,
  CheckCircle2,
  XCircle,
  AlertCircle,
  MoveUp,
  MoveDown,
  Tv,
  Smartphone,
  CloudSun,
  HardDrive,
  FileUp,
  FileText,
  X,
  RefreshCw,
  Newspaper,
  Search,
  Check,
  Layers,
  Sparkles,
  Folder,
  Camera,
  Link2,
  Copy,
  QrCode,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Database,
  ListPlus,
  Play,
  Eye,
  Store,
  MapPin,
  GitBranch,
  Activity,
  Calendar,
  Volume2,
  VolumeX,
  Moon,
  BarChart3,
  Download,
  Sliders,
  Palette,
  Info,
  Cloud,
} from 'lucide-react';
import { api } from '../lib/api';
import { CompanyStats, CompanyStore, Player, Operator, Playlist, Media, RssFeed, Company, MediaIntegrityAuditReport, MediaIntegrityItemResult, TransitionEffect, ProofOfPlaySummary, ProofOfPlayLog, PlaylistItem } from '../types';
import { ConfirmModal } from '../components/ConfirmModal';
import { MediaThumbnail } from '../components/MediaThumbnail';
import { MediaPreviewModal } from '../components/MediaPreviewModal';
import { PlayerDiagnosticView, DiagnosticPlayerData } from '../components/PlayerDiagnosticView';
import { CloudflareR2ConfigModal } from '../components/CloudflareR2ConfigModal';
import { resolveMediaDisplayUrl, getCachedToken, setCachedAccessToken } from '../lib/googleDrive';

interface CompanyDashboardProps {
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
  onOpenPlayerSimulation: (code: string) => void;
  companyInfo?: { id: string; name: string } | null;
}

export const CompanyDashboard: React.FC<CompanyDashboardProps> = ({
  showToast,
  onOpenPlayerSimulation,
  companyInfo,
}) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'stores' | 'players' | 'operators' | 'playlists' | 'media' | 'rss' | 'proof_of_play'>('dashboard');
  const [stats, setStats] = useState<CompanyStats | null>(null);
  const [stores, setStores] = useState<CompanyStore[]>([]);
  const [selectedStoreFilter, setSelectedStoreFilter] = useState<string>('all');
  const [players, setPlayers] = useState<Player[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [mediaList, setMediaList] = useState<Media[]>([]);
  const [rssList, setRssList] = useState<RssFeed[]>([]);
  const [loading, setLoading] = useState(true);

  const effectiveMaxMedia = stats?.limits?.max_media || stats?.limits?.max_storage || stats?.company?.max_media || 250;

  // Modals
  const [storeModalOpen, setStoreModalOpen] = useState(false);
  const [editingStore, setEditingStore] = useState<CompanyStore | null>(null);
  const [storeForm, setStoreForm] = useState<{
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
    state: 'SP',
    address: '',
    phone: '',
    responsible: '',
  });
  const [playerModalOpen, setPlayerModalOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);

  const [operatorModalOpen, setOperatorModalOpen] = useState(false);
  const [editingOperator, setEditingOperator] = useState<Operator | null>(null);

  const [playlistModalOpen, setPlaylistModalOpen] = useState(false);
  const [editingPlaylist, setEditingPlaylist] = useState<Playlist | null>(null);
  const [isRestartingPlayer, setIsRestartingPlayer] = useState<string | null>(null);

  const [mediaModalOpen, setMediaModalOpen] = useState(false);
  const [rssModalOpen, setRssModalOpen] = useState(false);
  const [editingRss, setEditingRss] = useState<RssFeed | null>(null);

  const [diagnosticModalPlayer, setDiagnosticModalPlayer] = useState<DiagnosticPlayerData | null>(null);

  const handleOpenDiagnostic = (playerTarget?: Player | DiagnosticPlayerData) => {
    if (playerTarget) {
      setDiagnosticModalPlayer(playerTarget as DiagnosticPlayerData);
    } else if (players.length > 0) {
      setDiagnosticModalPlayer(players[0] as DiagnosticPlayerData);
    } else {
      showToast('info', 'Nenhum player cadastrado para exibir diagnóstico.');
    }
  };

  const [resetPasswordData, setResetPasswordData] = useState<{
    isOpen: boolean;
    type: 'player' | 'operator';
    id: string;
    title: string;
  }>({
    isOpen: false,
    type: 'player',
    id: '',
    title: '',
  });
  const [newPasswordInput, setNewPasswordInput] = useState('');

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

  // Unique Direct Access Player Link Modal & copy state
  const [playerDirectLinkModal, setPlayerDirectLinkModal] = useState<{
    isOpen: boolean;
    player: Player | null;
  }>({
    isOpen: false,
    player: null,
  });
  const [copiedPlayerId, setCopiedPlayerId] = useState<string | null>(null);

  // Media Integrity Check State
  const [integrityReport, setIntegrityReport] = useState<MediaIntegrityAuditReport | null>(null);
  const [isCheckingIntegrity, setIsCheckingIntegrity] = useState(false);
  const [isSyncingDriveMedia, setIsSyncingDriveMedia] = useState(false);
  const [repairingMediaId, setRepairingMediaId] = useState<string | null>(null);
  const [showIntegrityDetails, setShowIntegrityDetails] = useState(false);

  // Quick RSS Selection Modal inside Playlist Builder
  const [rssQuickPickerOpen, setRssQuickPickerOpen] = useState(false);

  // Cloudflare R2 Modal State
  const [r2ModalOpen, setR2ModalOpen] = useState(false);

  // Send RSS/Weather directly to playlist target modal (when user triggers from RSS tab or Playlists tab)
  const [playlistTargetModal, setPlaylistTargetModal] = useState<{
    isOpen: boolean;
    type: 'rss' | 'weather';
    rssData?: { url: string; name: string };
  }>({
    isOpen: false,
    type: 'rss',
  });

  // Media Preview Modal (High-definition video/image preview with audio & zoom)
  const [previewModalMedia, setPreviewModalMedia] = useState<Media | null>(null);

  // Forms
  const [playerForm, setPlayerForm] = useState<{
    name: string;
    code: string;
    store_id: string;
    location: string;
    description: string;
    orientation: 'horizontal' | 'vertical';
    playlist_id: string;
    password: string;
    transition_effect?: TransitionEffect;
    master_volume?: number;
    master_muted?: boolean;
    eco_mode_enabled?: boolean;
    eco_sleep_start?: string;
    eco_sleep_end?: string;
    eco_screen_type?: 'black' | 'clock';
  }>({
    name: '',
    code: '',
    store_id: '',
    location: '',
    description: '',
    orientation: 'horizontal',
    playlist_id: '',
    password: '',
    transition_effect: 'crossfade',
    master_volume: 100,
    master_muted: false,
    eco_mode_enabled: false,
    eco_sleep_start: '22:00',
    eco_sleep_end: '06:00',
    eco_screen_type: 'black',
  });

  const [operatorForm, setOperatorForm] = useState({
    name: '',
    email: '',
    phone: '',
    store_id: '',
    password: '',
  });

  const [playlistForm, setPlaylistForm] = useState<{
    name: string;
    description: string;
    store_id: string;
    weather_city: string;
    transition_effect?: TransitionEffect;
    transition_duration?: number;
    custom_ticker_enabled?: boolean;
    custom_ticker_text?: string;
    custom_ticker_bg_color?: string;
    custom_ticker_speed?: number;
    items: Array<{
      id?: string;
      media_id: string;
      duration: number | string;
      schedule_enabled?: boolean;
      schedule_days?: number[];
      schedule_start_time?: string;
      schedule_end_time?: string;
      schedule_start_date?: string;
      schedule_end_date?: string;
      volume?: number;
      is_muted?: boolean;
    }>;
  }>({
    name: '',
    description: '',
    store_id: '',
    weather_city: '',
    transition_effect: 'crossfade',
    transition_duration: 0.8,
    custom_ticker_enabled: false,
    custom_ticker_text: '',
    custom_ticker_bg_color: '#0f172a',
    custom_ticker_speed: 2,
    items: [],
  });

  // Modal para configuração de Agendamento Inteligente do item da playlist
  const [scheduleModalItemIndex, setScheduleModalItemIndex] = useState<number | null>(null);

  // Estados da Prova de Exibição (Proof of Play)
  const [proofOfPlaySummary, setProofOfPlaySummary] = useState<ProofOfPlaySummary | null>(null);
  const [proofOfPlayLoading, setProofOfPlayLoading] = useState(false);
  const [proofOfPlayDays, setProofOfPlayDays] = useState<number>(7);
  const [proofOfPlayPlayerFilter, setProofOfPlayPlayerFilter] = useState<string>('all');

  const loadProofOfPlay = async () => {
    try {
      setProofOfPlayLoading(true);
      const res = await api.getProofOfPlaySummary({
        days: proofOfPlayDays,
        playerId: proofOfPlayPlayerFilter !== 'all' ? proofOfPlayPlayerFilter : undefined,
      });
      if (res?.summary) {
        setProofOfPlaySummary(res.summary);
      }
    } catch (err: any) {
      console.warn('Erro ao carregar prova de exibição:', err);
    } finally {
      setProofOfPlayLoading(false);
    }
  };

  const handleExportProofOfPlayCsv = () => {
    const params = new URLSearchParams();
    params.append('days', String(proofOfPlayDays));
    if (proofOfPlayPlayerFilter !== 'all') {
      params.append('playerId', proofOfPlayPlayerFilter);
    }
    const token = localStorage.getItem('token') || '';
    fetch(`/api/company/proof-of-play/export-csv?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Falha ao exportar CSV');
        return res.blob();
      })
      .then((blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `auditoria-prova-de-exibicao-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        showToast('success', 'Relatório CSV de Prova de Exibição gerado e exportado com sucesso!');
      })
      .catch((err) => {
        showToast('error', err.message || 'Erro ao exportar relatório CSV');
      });
  };

  const formatSecondsToReadable = (seconds: number) => {
    if (!seconds || seconds <= 0) return '0s';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}h ${mins}m ${secs > 0 ? `${secs}s` : ''}`.trim();
    }
    if (mins > 0) {
      return `${mins}m ${secs > 0 ? `${secs}s` : ''}`.trim();
    }
    return `${secs}s`;
  };

  useEffect(() => {
    if (activeTab === 'proof_of_play') {
      loadProofOfPlay();
    }
  }, [activeTab, proofOfPlayDays, proofOfPlayPlayerFilter]);

  // Media Picker modal states for Playlist
  const [mediaPickerModalOpen, setMediaPickerModalOpen] = useState(false);
  const [mediaPickerFilter, setMediaPickerFilter] = useState<'all' | 'image' | 'video' | 'rss' | 'weather_clock'>('all');
  const [mediaPickerSearch, setMediaPickerSearch] = useState('');
  const [targetPlaylistIdForNewMedia, setTargetPlaylistIdForNewMedia] = useState<string>('');
  const [uploadToAllPlaylists, setUploadToAllPlaylists] = useState<boolean>(false);

  // Modal para carregar mídia existente em todas as playlists de uma só vez
  const [addToAllPlaylistsModalMedia, setAddToAllPlaylistsModalMedia] = useState<Media | null>(null);
  const [isAddingToAllPlaylists, setIsAddingToAllPlaylists] = useState(false);
  const [addToAllPlaylistsDuration, setAddToAllPlaylistsDuration] = useState<number>(10);
  const [addToAllPlaylistsRestart, setAddToAllPlaylistsRestart] = useState<boolean>(true);
  const [addToAllPlaylistsDuplicate, setAddToAllPlaylistsDuplicate] = useState<boolean>(false);

  const openAddToAllPlaylistsModal = (media: Media) => {
    setAddToAllPlaylistsModalMedia(media);
    setAddToAllPlaylistsDuration(Number(media.duration) || 10);
    setAddToAllPlaylistsRestart(true);
    setAddToAllPlaylistsDuplicate(false);
  };

  const handleConfirmAddToAllPlaylists = async () => {
    if (!addToAllPlaylistsModalMedia) return;
    try {
      setIsAddingToAllPlaylists(true);
      const res = await api.addMediaToAllPlaylists(addToAllPlaylistsModalMedia.id, {
        duration: Number(addToAllPlaylistsDuration) || 10,
        restartPlayers: addToAllPlaylistsRestart,
        forceDuplicate: addToAllPlaylistsDuplicate,
      });

      showToast('success', res.message || `Mídia "${addToAllPlaylistsModalMedia.name}" vinculada a todas as playlists com sucesso!`);
      setAddToAllPlaylistsModalMedia(null);
      await loadData();
    } catch (err: any) {
      showToast('error', err.message || 'Erro ao carregar mídia para todas as playlists.');
    } finally {
      setIsAddingToAllPlaylists(false);
    }
  };

  const [mediaForm, setMediaForm] = useState<{
    name: string;
    type: 'image' | 'video' | 'rss' | 'weather_clock';
    file_url: string;
    duration: number | string;
  }>({
    name: '',
    type: 'image',
    file_url: '',
    duration: 10,
  });

  const [mediaSourceType, setMediaSourceType] = useState<
    'device' | 'url' | 'rss' | 'weather_clock'
  >('device');

  const [selectedDeviceFile, setSelectedDeviceFile] = useState<{
    file: File | null;
    dataUrl: string;
    name: string;
    sizeFormatted: string;
    type: string;
    isVideo: boolean;
  } | null>(null);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const resetMediaModalState = (preselectedPlaylistId?: string) => {
    setMediaForm({
      name: '',
      type: 'image',
      file_url: '',
      duration: 10,
    });
    setMediaSourceType('device');
    setSelectedDeviceFile(null);
    setIsUploadingMedia(false);
    setUploadProgress(0);
    setIsDraggingFile(false);
    setUploadToAllPlaylists(false);
    setTargetPlaylistIdForNewMedia(
      preselectedPlaylistId !== undefined
        ? preselectedPlaylistId
        : (editingPlaylist ? editingPlaylist.id : '')
    );
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const [rssForm, setRssForm] = useState({
    name: '',
    url: '',
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [s, st, pl, op, py, md, rs] = await Promise.all([
        api.getCompanyStats(),
        api.getCompanyStores().catch(() => []),
        api.getCompanyPlayers(),
        api.getCompanyOperators(),
        api.getCompanyPlaylists(),
        api.getCompanyMedia(),
        api.getCompanyRss(),
      ]);
      setStats(s);
      setStores(Array.isArray(st) ? st : []);
      setPlayers(Array.isArray(pl) ? pl : []);
      setOperators(Array.isArray(op) ? op : []);
      setPlaylists(Array.isArray(py) ? py : []);
      setMediaList(Array.isArray(md) ? md : []);
      setRssList(Array.isArray(rs) ? rs : []);

      if (editingPlaylist && Array.isArray(py)) {
        const freshEditing = py.find((p) => p.id === editingPlaylist.id);
        if (freshEditing) {
          setEditingPlaylist(freshEditing);
        }
      }

      // Load cached integrity status if any
      api.getMediaIntegrityStatus().then((rep) => {
        if (rep && rep.checked_at) setIntegrityReport(rep);
      }).catch(() => {});
    } catch (err: any) {
      showToast('error', err.message || 'Erro ao carregar dados da empresa.');
    } finally {
      setLoading(false);
    }
  };

  const handleRunIntegrityCheck = async () => {
    setIsCheckingIntegrity(true);
    try {
      const report = await api.checkMediaIntegrity();
      setIntegrityReport(report);
      if (report.has_issues) {
        showToast(
          'error',
          `Alerta: ${report.issues.length} mídia(s) com problema de acesso encontradas.`
        );
        setShowIntegrityDetails(true);
      } else {
        showToast(
          'success',
          `Integridade confirmada: todas as ${report.summary.total} mídias estão íntegras e prontas para exibição!`
        );
      }
    } catch (err: any) {
      showToast('error', err.message || 'Falha ao verificar integridade das mídias.');
    } finally {
      setIsCheckingIntegrity(false);
    }
  };

  const handleSyncDriveMedia = async () => {
    setIsSyncingDriveMedia(true);
    try {
      showToast('info', 'Buscando novos arquivos e fotos no Google Drive...');
      const res = await api.scanAndImportDriveMedia();
      if (res?.status === 'ok') {
        showToast('success', res.message);
        const updatedMedia = await api.getCompanyMedia();
        if (Array.isArray(updatedMedia)) {
          setMediaList(updatedMedia);
        }
      } else {
        showToast('error', res?.error || 'Erro ao sincronizar com Google Drive.');
      }
    } catch (err: any) {
      showToast('error', err?.message || 'Falha ao sincronizar com Google Drive.');
    } finally {
      setIsSyncingDriveMedia(false);
    }
  };

  useEffect(() => {
    loadData();
    // Refresh stats and player status periodically every 5 seconds for automatic live monitoring
    const interval = setInterval(() => {
      Promise.all([
        api.getCompanyPlayers(),
        api.getCompanyStats().catch(() => null),
      ])
        .then(([pl, st]) => {
          if (Array.isArray(pl)) {
            setPlayers(pl);
            setDiagnosticModalPlayer((current) => {
              if (!current) return null;
              const updated = pl.find((p) => p.id === current.id || p.code === current.code);
              return updated ? (updated as DiagnosticPlayerData) : current;
            });
          }
          if (st) setStats(st);
        })
        .catch(() => {});
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // --- STORE / LOJAS DA REDE HANDLERS ---
  const handleOpenStoreModal = (store?: CompanyStore) => {
    if (store) {
      setEditingStore(store);
      setStoreForm({
        name: store.name,
        brand_name: store.brand_name || '',
        code: store.code || '',
        city: store.city || '',
        state: store.state || 'SP',
        address: store.address || '',
        phone: store.phone || '',
        responsible: store.responsible || '',
      });
    } else {
      setEditingStore(null);
      setStoreForm({
        name: '',
        brand_name: '',
        code: `LOJA-0${stores.length + 1}`,
        city: '',
        state: 'SP',
        address: '',
        phone: '',
        responsible: '',
      });
    }
    setStoreModalOpen(true);
  };

  const handleSaveStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeForm.name.trim()) {
      showToast('error', 'Informe o nome da loja/unidade.');
      return;
    }
    try {
      if (editingStore) {
        await api.updateCompanyStore(editingStore.id, {
          name: storeForm.name.trim(),
          brand_name: storeForm.brand_name.trim() || undefined,
          code: storeForm.code.trim().toUpperCase() || undefined,
          city: storeForm.city.trim(),
          state: storeForm.state.trim().toUpperCase(),
          address: storeForm.address.trim() || undefined,
          phone: storeForm.phone.trim() || undefined,
          responsible: storeForm.responsible.trim() || undefined,
        });
        showToast('success', 'Loja/Unidade atualizada com sucesso.');
      } else {
        await api.createCompanyStore({
          name: storeForm.name.trim(),
          brand_name: storeForm.brand_name.trim() || undefined,
          code: storeForm.code.trim().toUpperCase() || undefined,
          city: storeForm.city.trim(),
          state: storeForm.state.trim().toUpperCase(),
          address: storeForm.address.trim() || undefined,
          phone: storeForm.phone.trim() || undefined,
          responsible: storeForm.responsible.trim() || undefined,
        });
        showToast('success', 'Loja/Unidade cadastrada na rede com sucesso.');
      }
      setStoreModalOpen(false);
      loadData();
    } catch (err: any) {
      showToast('error', err.message || 'Erro ao salvar loja.');
    }
  };

  const handleDeleteStore = (store: CompanyStore) => {
    setConfirmData({
      isOpen: true,
      title: 'Excluir Loja / Unidade',
      message: `Deseja excluir a loja "${store.name}"? Os players e operadores vinculados passarão para a matriz geral sem serem apagados.`,
      action: async () => {
        try {
          await api.deleteCompanyStore(store.id);
          showToast('success', 'Loja excluída com sucesso.');
          if (selectedStoreFilter === store.id) setSelectedStoreFilter('all');
          setConfirmData((p) => ({ ...p, isOpen: false }));
          loadData();
        } catch (err: any) {
          showToast('error', err.message || 'Erro ao excluir loja.');
        }
      },
    });
  };

  // --- PLAYER HANDLERS ---
  const handleOpenPlayerModal = (player?: Player) => {
    if (player) {
      setEditingPlayer(player);
      setPlayerForm({
        name: player.name,
        code: player.code,
        store_id: player.store_id || '',
        location: player.location || '',
        description: player.description || '',
        orientation: player.orientation || 'horizontal',
        playlist_id: player.playlist_id || '',
        password: '',
        transition_effect: player.transition_effect || 'crossfade',
        master_volume: player.master_volume !== undefined ? player.master_volume : 100,
        master_muted: Boolean(player.master_muted),
        eco_mode_enabled: Boolean(player.eco_mode_enabled),
        eco_sleep_start: player.eco_sleep_start || '22:00',
        eco_sleep_end: player.eco_sleep_end || '06:00',
        eco_screen_type: player.eco_screen_type || 'black',
      });
    } else {
      setEditingPlayer(null);
      const nextCode = `PLAY-0${players.length + 1}`;
      setPlayerForm({
        name: '',
        code: nextCode,
        store_id: selectedStoreFilter !== 'all' ? selectedStoreFilter : '',
        location: '',
        description: '',
        orientation: 'horizontal',
        playlist_id: playlists[0]?.id || '',
        password: '',
        transition_effect: 'crossfade',
        master_volume: 100,
        master_muted: false,
        eco_mode_enabled: false,
        eco_sleep_start: '22:00',
        eco_sleep_end: '06:00',
        eco_screen_type: 'black',
      });
    }
    setPlayerModalOpen(true);
  };

  const handleTogglePlayerSleep = async (player: Player) => {
    try {
      const res = await api.togglePlayerSleep(player.id);
      showToast('success', res.message || (res.is_sleeping ? 'Player colocado em repouso (Modo Economia).' : 'Player acordado com sucesso.'));
      loadData();
    } catch (err: any) {
      showToast('error', err.message || 'Erro ao alternar modo repouso do player.');
    }
  };

  const handleSavePlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingPlayer) {
        await api.updateCompanyPlayer(editingPlayer.id, playerForm);
        showToast('success', 'Player atualizado com sucesso.');
      } else {
        await api.createCompanyPlayer(playerForm);
        showToast('success', 'Player cadastrado com sucesso.');
      }
      setPlayerModalOpen(false);
      loadData();
    } catch (err: any) {
      showToast('error', err.message);
    }
  };

  const handleTogglePlayer = (player: Player) => {
    const isActivating = player.status === 'inactive';
    setConfirmData({
      isOpen: true,
      title: isActivating ? 'Ativar Player' : 'Desativar Player',
      message: isActivating
        ? `Deseja ativar o player ${player.name}?`
        : `Deseja desativar o player ${player.name}? Ele não reproduzirá conteúdos enquanto inativo.`,
      action: async () => {
        try {
          const res = await api.togglePlayerStatus(player.id);
          showToast('success', res.message);
          setConfirmData((p) => ({ ...p, isOpen: false }));
          loadData();
        } catch (err: any) {
          showToast('error', err.message);
        }
      },
    });
  };

  const handleDeletePlayer = (player: Player) => {
    setConfirmData({
      isOpen: true,
      title: 'Excluir Player',
      message: `Tem certeza que deseja excluir o player ${player.name} (${player.code})?`,
      action: async () => {
        try {
          const res = await api.deleteCompanyPlayer(player.id);
          showToast('success', res.message);
          setConfirmData((p) => ({ ...p, isOpen: false }));
          loadData();
        } catch (err: any) {
          showToast('error', err.message);
        }
      },
    });
  };

  const getPlayerDirectUrl = (player: Player) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const token = player.access_token || player.code;
    return `${origin}/?player=${encodeURIComponent(player.code)}&token=${encodeURIComponent(token)}`;
  };

  const handleCopyPlayerLink = async (player: Player) => {
    const url = getPlayerDirectUrl(player);
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = url;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedPlayerId(player.id);
      setTimeout(() => setCopiedPlayerId(null), 3000);
      showToast('success', 'Link copiado.');
    } catch {
      showToast('error', 'Não foi possível copiar automaticamente para a área de transferência.');
    }
  };

  const handleRegenerateToken = async (player: Player) => {
    try {
      const res = await api.regeneratePlayerToken(player.id);
      showToast('success', 'Novo token de acesso gerado com sucesso.');
      if (playerDirectLinkModal.player?.id === player.id) {
        setPlayerDirectLinkModal({
          isOpen: true,
          player: { ...player, access_token: res.access_token },
        });
      }
      loadData();
    } catch (err: any) {
      showToast('error', err.message);
    }
  };

  // --- OPERATOR HANDLERS ---
  const handleOpenOperatorModal = (operator?: Operator) => {
    if (operator) {
      setEditingOperator(operator);
      setOperatorForm({
        name: operator.name,
        email: operator.email,
        phone: operator.phone || '',
        store_id: operator.store_id || '',
        password: '',
      });
    } else {
      if (stats?.limits.max_operators === 0) {
        showToast('error', 'Plano sem operadores.');
        return;
      }
      setEditingOperator(null);
      setOperatorForm({
        name: '',
        email: '',
        phone: '',
        store_id: selectedStoreFilter !== 'all' ? selectedStoreFilter : '',
        password: '',
      });
    }
    setOperatorModalOpen(true);
  };

  const handleSaveOperator = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingOperator) {
        const updatedOp = await api.updateCompanyOperator(editingOperator.id, operatorForm);
        setOperators((prev) => prev.map((o) => (o.id === editingOperator.id ? { ...o, ...updatedOp } : o)));
        showToast('success', 'Operador atualizado com sucesso.');
      } else {
        const createdOp = await api.createCompanyOperator(operatorForm);
        setOperators((prev) => [...prev, createdOp]);
        showToast('success', 'Operador cadastrado com sucesso.');
      }
      setOperatorModalOpen(false);
      loadData();
    } catch (err: any) {
      showToast('error', err.message);
    }
  };

  const handleToggleOperator = async (operator: Operator) => {
    try {
      const res = await api.toggleOperatorStatus(operator.id);
      showToast('success', res.message);
      loadData();
    } catch (err: any) {
      showToast('error', err.message);
    }
  };

  const handleDeleteOperator = (operator: Operator) => {
    setConfirmData({
      isOpen: true,
      title: 'Excluir Operador',
      message: `Tem certeza que deseja excluir o operador ${operator.name}?`,
      action: async () => {
        try {
          const res = await api.deleteCompanyOperator(operator.id);
          showToast('success', res.message);
          setConfirmData((p) => ({ ...p, isOpen: false }));
          loadData();
        } catch (err: any) {
          showToast('error', err.message);
        }
      },
    });
  };

  // --- PLAYLIST HANDLERS ---
  const handleOpenPlaylistModal = (playlist?: Playlist) => {
    if (playlist) {
      setEditingPlaylist(playlist);
      setPlaylistForm({
        name: playlist.name,
        description: playlist.description || '',
        store_id: playlist.store_id || '',
        weather_city: playlist.weather_city || '',
        transition_effect: playlist.transition_effect || 'crossfade',
        transition_duration: playlist.transition_duration || 0.8,
        custom_ticker_enabled: Boolean(playlist.custom_ticker_enabled),
        custom_ticker_text: playlist.custom_ticker_text || '',
        custom_ticker_bg_color: playlist.custom_ticker_bg_color || '#0f172a',
        custom_ticker_speed: playlist.custom_ticker_speed || 2,
        items: playlist.items.map((it) => {
          const matchedMedia = mediaList.find((m) => m.id === it.media_id);
          return {
            id: it.id,
            media_id: it.media_id,
            duration: it.duration || 10,
            name: matchedMedia?.name || it.name,
            type: matchedMedia?.type || it.type,
            schedule_enabled: Boolean(it.schedule_enabled),
            schedule_days: it.schedule_days || [0, 1, 2, 3, 4, 5, 6],
            schedule_start_time: it.schedule_start_time || '',
            schedule_end_time: it.schedule_end_time || '',
            schedule_start_date: it.schedule_start_date || '',
            schedule_end_date: it.schedule_end_date || '',
            volume: it.volume !== undefined ? it.volume : 100,
            is_muted: Boolean(it.is_muted),
          } as any;
        }),
      });
    } else {
      setEditingPlaylist(null);
      const selectedStoreObj = stores.find((s) => s.id === selectedStoreFilter);
      setPlaylistForm({
        name: '',
        description: '',
        store_id: selectedStoreFilter !== 'all' ? selectedStoreFilter : '',
        weather_city: selectedStoreObj?.city || '',
        transition_effect: 'crossfade',
        transition_duration: 0.8,
        custom_ticker_enabled: false,
        custom_ticker_text: '',
        custom_ticker_bg_color: '#0f172a',
        custom_ticker_speed: 2,
        items: mediaList.slice(0, 2).map((m) => ({
          media_id: m.id,
          duration: m.duration || 10,
          name: m.name,
          type: m.type,
          schedule_enabled: false,
          schedule_days: [0, 1, 2, 3, 4, 5, 6],
          schedule_start_time: '',
          schedule_end_time: '',
          schedule_start_date: '',
          schedule_end_date: '',
          volume: 100,
          is_muted: false,
        } as any)),
      });
    }
    setPlaylistModalOpen(true);
  };

  // Comando para reiniciar telas / recarregar playlist em tempo real
  const handleRestartPlayers = async (params: {
    playerId?: string;
    playlistId?: string;
    playlistName?: string;
    playerName?: string;
  }) => {
    const loadingKey = params.playlistId || params.playerId || 'all';
    try {
      setIsRestartingPlayer(loadingKey);
      const res = await api.restartPlayer({
        playerId: params.playerId,
        playlistId: params.playlistId,
        reason: params.playlistName
          ? `Playlist "${params.playlistName}" atualizada. Recarregando mídias...`
          : params.playerName
          ? `Comando enviado para o reprodutor ${params.playerName}`
          : 'Comando de reinicialização enviado pelo painel',
      });

      // Notificar abas abertas no mesmo navegador imediatamente via BroadcastChannel & LocalStorage
      try {
        if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
          const bc = new BroadcastChannel('indoor_media_calls');
          bc.postMessage({
            type: 'RELOAD_PLAYLIST',
            playlistId: params.playlistId,
            playerId: params.playerId,
            timestamp: Date.now(),
          });
        }
        localStorage.setItem(
          'indoor_player_restart_cmd',
          JSON.stringify({
            playlistId: params.playlistId,
            playerId: params.playerId,
            timestamp: Date.now(),
          })
        );
      } catch {}

      showToast(
        'success',
        res.message || 'Comando de reinicialização enviado com sucesso para as telas!'
      );
    } catch (err: any) {
      showToast('error', err.message || 'Falha ao enviar comando de reinicialização.');
    } finally {
      setIsRestartingPlayer(null);
    }
  };

  const handleSavePlaylist = async (e: React.FormEvent, andRestart = false) => {
    e.preventDefault();
    try {
      const payload = {
        ...playlistForm,
        items: playlistForm.items.map((it, idx) => ({
          ...it,
          media_id: it.media_id,
          position: idx + 1,
          duration: Number(it.duration) || 10,
          schedule_enabled: Boolean(it.schedule_enabled),
          schedule_days: it.schedule_days || [0, 1, 2, 3, 4, 5, 6],
          schedule_start_time: it.schedule_start_time || undefined,
          schedule_end_time: it.schedule_end_time || undefined,
          schedule_start_date: it.schedule_start_date || undefined,
          schedule_end_date: it.schedule_end_date || undefined,
          volume: it.volume !== undefined ? Number(it.volume) : 100,
          is_muted: Boolean(it.is_muted),
        })),
        restartPlayers: andRestart,
      };

      let targetPlaylistId = editingPlaylist?.id;
      if (editingPlaylist) {
        await api.updateCompanyPlaylist(editingPlaylist.id, payload as any);
        showToast('success', 'Playlist atualizada com sucesso.');
      } else {
        const created: any = await api.createCompanyPlaylist(payload as any);
        if (created?.id) targetPlaylistId = created.id;
        showToast('success', 'Playlist criada com sucesso.');
      }

      if (andRestart) {
        await handleRestartPlayers({
          playlistId: targetPlaylistId,
          playlistName: playlistForm.name,
        });
      }

      setPlaylistModalOpen(false);
      loadData();
    } catch (err: any) {
      showToast('error', err.message);
    }
  };

  const handleSelectMediaForPlaylist = (media: Media) => {
    const itemDuration = media.duration || (media.type === 'rss' ? 15 : 10);
    const newItem = {
      id: `pli-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      media_id: media.id,
      duration: itemDuration,
      name: media.name,
      type: media.type,
      file_url: media.file_url,
    };
    setPlaylistForm((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        newItem,
      ],
    }));
    showToast('success', `Mídia "${media.name}" adicionada à playlist. Lembre-se de salvar a playlist para confirmar.`);
    setMediaPickerModalOpen(false);
  };

  const handleSelectMediaForPlaylistAndRestart = async (media: Media) => {
    const itemDuration = media.duration || (media.type === 'rss' ? 15 : 10);
    const newItem = {
      id: `pli-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      media_id: media.id,
      duration: itemDuration,
      name: media.name,
      type: media.type,
      file_url: media.file_url,
    };
    const updatedFormItems = [...playlistForm.items, newItem];
    setPlaylistForm((prev) => ({
      ...prev,
      items: updatedFormItems,
    }));
    setMediaPickerModalOpen(false);

    if (editingPlaylist) {
      try {
        const payload = {
          ...editingPlaylist,
          ...playlistForm,
          items: updatedFormItems.map((it, idx) => ({
            ...it,
            position: idx + 1,
            duration: Number(it.duration) || 10,
          })),
          restartPlayers: true,
        };
        const updatedPl = await api.updateCompanyPlaylist(editingPlaylist.id, payload as any);
        if (updatedPl) {
          setEditingPlaylist(updatedPl);
          setPlaylists((prev) => prev.map((p) => (p.id === editingPlaylist.id ? updatedPl : p)));
        }
        showToast('success', `Mídia "${media.name}" salva na playlist "${editingPlaylist.name}" e reprodutores reiniciados!`);
        loadData();
      } catch (err: any) {
        showToast('error', `Falha ao salvar playlist: ${err.message}`);
      }
    } else {
      showToast('success', `Mídia "${media.name}" incluída na playlist!`);
      await handleRestartPlayers({});
    }
  };

  // Add Weather/Clock directly to the currently open playlist form
  const handleQuickAddWeatherToPlaylist = async () => {
    let weatherMedia = mediaList.find((m) => m.type === 'weather_clock');
    if (!weatherMedia) {
      try {
        weatherMedia = await api.uploadCompanyMedia({
          name: 'Hora Certa & Previsão do Tempo',
          type: 'weather_clock',
          file_url: 'widget:weather_clock',
          duration: 12,
        });
        setMediaList((prev) => [weatherMedia!, ...prev]);
      } catch (err: any) {
        showToast('error', err.message || 'Erro ao criar mídia de Previsão do Tempo.');
        return;
      }
    }

    setPlaylistForm((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          media_id: weatherMedia!.id,
          duration: 12,
        },
      ],
    }));
    showToast('success', '🌤️ Hora Certa & Previsão do Tempo adicionada à sequência da playlist!');
  };

  // Add RSS directly to the currently open playlist form
  const handleQuickAddRssToPlaylist = async (rssUrl: string, rssName: string) => {
    let rssMedia = mediaList.find((m) => m.type === 'rss' && (m.file_url.trim() === rssUrl.trim() || m.name === rssName));
    if (!rssMedia) {
      try {
        rssMedia = await api.uploadCompanyMedia({
          name: rssName.startsWith('Notícias RSS') ? rssName : `Notícias RSS - ${rssName}`,
          type: 'rss',
          file_url: rssUrl,
          duration: 15,
        });
        setMediaList((prev) => [rssMedia!, ...prev]);
      } catch (err: any) {
        showToast('error', err.message || 'Erro ao criar mídia de Notícias RSS.');
        return;
      }
    }

    setPlaylistForm((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          media_id: rssMedia!.id,
          duration: 15,
        },
      ],
    }));
    setRssQuickPickerOpen(false);
    showToast('success', `📰 Notícias RSS "${rssName}" adicionadas à playlist!`);
  };

  // Add RSS feed to a saved playlist from the RSS tab
  const handleSendRssToPlaylist = async (feedUrl: string, feedName: string, targetPlaylistId?: string) => {
    if (playlists.length === 0) {
      showToast('info', 'Você ainda não possui nenhuma playlist. Criando sua primeira playlist...');
      handleOpenPlaylistModal();
      return;
    }

    const playlistId = targetPlaylistId || (playlists.length === 1 ? playlists[0].id : null);
    if (!playlistId) {
      setPlaylistTargetModal({
        isOpen: true,
        type: 'rss',
        rssData: { url: feedUrl, name: feedName },
      });
      return;
    }

    const targetPl = playlists.find((p) => p.id === playlistId);
    try {
      const res = await api.addRssToPlaylist({
        playlist_id: playlistId,
        rss_url: feedUrl,
        name: feedName.startsWith('Notícias RSS') ? feedName : `Notícias RSS - ${feedName}`,
        duration: 15,
      });
      showToast('success', `📰 Notícias "${feedName}" incluídas na playlist "${targetPl?.name || 'selecionada'}"!`);
      setPlaylistTargetModal({ isOpen: false, type: 'rss' });
      loadData();
    } catch (err: any) {
      showToast('error', err.message || 'Falha ao incluir canal RSS na playlist.');
    }
  };

  // Add Weather to a saved playlist directly from Playlists view
  const handleSendWeatherToSavedPlaylist = async (playlistId: string) => {
    try {
      const targetPl = playlists.find((p) => p.id === playlistId);
      await api.addWeatherToPlaylist({
        playlist_id: playlistId,
        duration: 12,
      });
      showToast('success', `🌤️ Hora Certa & Previsão do Tempo incluída na playlist "${targetPl?.name || 'selecionada'}"!`);
      loadData();
    } catch (err: any) {
      showToast('error', err.message || 'Falha ao incluir clima na playlist.');
    }
  };

  const handleTogglePlaylist = async (playlist: Playlist) => {
    try {
      const res = await api.togglePlaylistStatus(playlist.id);
      showToast('success', res.message);
      loadData();
    } catch (err: any) {
      showToast('error', err.message);
    }
  };

  const handleDeletePlaylist = (playlist: Playlist) => {
    setConfirmData({
      isOpen: true,
      title: 'Excluir Playlist',
      message: `Tem certeza que deseja excluir a playlist ${playlist.name}?`,
      action: async () => {
        try {
          const res = await api.deleteCompanyPlaylist(playlist.id);
          showToast('success', res.message);
          setConfirmData((p) => ({ ...p, isOpen: false }));
          loadData();
        } catch (err: any) {
          showToast('error', err.message);
        }
      },
    });
  };

  // --- MEDIA HANDLERS ---
  const handleProcessDeviceFile = (file: File) => {
    if (file.size > 200 * 1024 * 1024) {
      showToast('error', 'O arquivo é muito grande. O limite máximo é de 200 MB.');
      return;
    }

    const isVideo =
      file.type.startsWith('video/') ||
      /\.(mp4|webm|mov|ogg|ogv|mkv|avi|m4v|3gp|mpeg|mpg)$/i.test(file.name);
    const isImage =
      file.type.startsWith('image/') ||
      /\.(jpg|jpeg|png|webp|gif|svg|bmp|avif|heic|heif|jfif)$/i.test(file.name) ||
      !isVideo;

    if (!isVideo && !isImage) {
      showToast('error', 'Formato não suportado. Escolha uma imagem (JPG, PNG, WEBP, GIF) ou vídeo (MP4, WebM, MOV).');
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    const autoTitle = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ').trim() || file.name;

    setSelectedDeviceFile({
      file,
      dataUrl: previewUrl,
      name: file.name,
      sizeFormatted: formatFileSize(file.size),
      type: file.type || (isVideo ? 'video/mp4' : 'image/jpeg'),
      isVideo,
    });

    setMediaForm((prev) => ({
      ...prev,
      name: prev.name.trim() === '' ? autoTitle : prev.name,
      type: isVideo ? 'video' : 'image',
      duration: isVideo ? 15 : prev.duration || 10,
    }));
  };

  const handleSaveMedia = async (e: React.FormEvent, andRestart = false) => {
    e.preventDefault();

    const currentMediaCount = mediaList.length;
    const maxMediaLimit = effectiveMaxMedia;
    if (currentMediaCount >= maxMediaLimit) {
      showToast(
        'error',
        `Limite de mídias atingido para seu plano (${currentMediaCount}/${maxMediaLimit}). Remova mídias obsoletas ou solicite aumento de cota ao administrador.`
      );
      return;
    }

    try {
      setIsUploadingMedia(true);
      setUploadProgress(5);
      let targetFileUrl = mediaForm.file_url;
      let createdMedia: Media | null = null;
      let mediaTitle = mediaForm.name.trim();
      const isTargetAllPlaylists =
        uploadToAllPlaylists || targetPlaylistIdForNewMedia === '__ALL_PLAYLISTS__';

      if (mediaSourceType === 'device') {
        if (!selectedDeviceFile) {
          showToast('error', 'Por favor, selecione um arquivo de mídia do seu dispositivo.');
          setIsUploadingMedia(false);
          return;
        }

        mediaTitle =
          mediaForm.name.trim() ||
          selectedDeviceFile.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ').trim() ||
          selectedDeviceFile.name;

        let uploadRes;
        if (selectedDeviceFile.file) {
          uploadRes = await api.uploadCompanyMediaFileChunked({
            file: selectedDeviceFile.file,
            name: mediaTitle,
            duration: Number(mediaForm.duration) || (selectedDeviceFile.isVideo ? 15 : 10),
            addToAllPlaylists: isTargetAllPlaylists,
            onProgress: (pct) => setUploadProgress(pct),
          });
        } else {
          uploadRes = await api.uploadCompanyMediaToDriveServer({
            fileData: selectedDeviceFile.dataUrl,
            filename: selectedDeviceFile.name,
            mimeType: selectedDeviceFile.type,
            name: mediaTitle,
            duration: Number(mediaForm.duration) || 10,
            addToAllPlaylists: isTargetAllPlaylists,
          });
        }

        if (uploadRes?.media) {
          createdMedia = uploadRes.media;
          setMediaList((prev) => [uploadRes.media, ...prev.filter((m) => m.id !== uploadRes.media.id)]);
        }
      } else if (mediaSourceType === 'weather_clock') {
        targetFileUrl = 'widget:weather_clock';
      } else if (mediaSourceType === 'rss') {
        if (!targetFileUrl.trim()) {
          showToast('error', 'Informe a URL do feed RSS.');
          setIsUploadingMedia(false);
          return;
        }
      } else {
        if (!targetFileUrl.trim()) {
          showToast('error', 'Informe a URL da mídia.');
          setIsUploadingMedia(false);
          return;
        }
        targetFileUrl = resolveMediaDisplayUrl(targetFileUrl);
      }

      if (!createdMedia) {
        mediaTitle = mediaForm.name.trim() || (mediaSourceType === 'rss' ? 'Notícias RSS' : 'Nova Mídia');
        createdMedia = await api.uploadCompanyMedia({
          name: mediaTitle,
          type: mediaSourceType === 'weather_clock' ? 'weather_clock' : mediaSourceType === 'rss' ? 'rss' : mediaForm.type,
          file_url: targetFileUrl,
          duration: Number(mediaForm.duration) || 10,
          addToAllPlaylists: isTargetAllPlaylists,
        });
        if (createdMedia) {
          setMediaList((prev) => [createdMedia!, ...prev.filter((m) => m.id !== createdMedia!.id)]);
        }
      }

      // Se foi solicitado incluir em todas as playlists da empresa:
      let targetPl: Playlist | null = null;
      if (isTargetAllPlaylists && createdMedia) {
        try {
          await api.addMediaToAllPlaylists(createdMedia.id, {
            duration: Number(createdMedia.duration) || 10,
            restartPlayers: andRestart,
            forceDuplicate: false,
          });
        } catch (allPlErr) {
          console.warn('Inclusão em todas as playlists já processada no servidor:', allPlErr);
        }
      } else {
        // Se foi selecionada uma playlist de destino específica ou se o modal de playlist está aberto
        const targetPlId = targetPlaylistIdForNewMedia || (playlistModalOpen && editingPlaylist ? editingPlaylist.id : '');
        targetPl = playlists.find((p) => p.id === targetPlId) || (editingPlaylist?.id === targetPlId ? editingPlaylist : null);

        if (createdMedia && targetPl) {
          const itemDuration = Number(createdMedia.duration) || (createdMedia.type === 'rss' ? 15 : 10);
          const nowStr = new Date().toISOString();

          // Preserva todos os itens atuais que estão no formulário aberto para evitar perder itens recém-adicionados
          const baseItems = (playlistModalOpen && editingPlaylist?.id === targetPl.id && playlistForm.items.length > 0)
            ? playlistForm.items.map((it, idx) => {
                const foundMedia = mediaList.find((m) => m.id === it.media_id);
                return {
                  id: it.id || `pli-${Date.now()}-${idx}`,
                  playlist_id: targetPl!.id,
                  media_id: it.media_id,
                  position: idx + 1,
                  duration: Number(it.duration) || 10,
                  name: foundMedia?.name || it.name,
                  type: foundMedia?.type || it.type,
                  file_url: foundMedia?.file_url || it.file_url,
                  schedule_enabled: Boolean(it.schedule_enabled),
                  schedule_days: it.schedule_days,
                  schedule_start_time: it.schedule_start_time,
                  schedule_end_time: it.schedule_end_time,
                  schedule_start_date: it.schedule_start_date,
                  schedule_end_date: it.schedule_end_date,
                  volume: it.volume !== undefined ? Number(it.volume) : 100,
                  is_muted: Boolean(it.is_muted),
                  created_at: it.created_at || nowStr,
                };
              })
            : (targetPl.items || []).map((it, idx) => ({ ...it, position: idx + 1 }));

          const newItem = {
            id: `pli-${Date.now()}`,
            playlist_id: targetPl.id,
            media_id: createdMedia.id,
            position: baseItems.length + 1,
            duration: itemDuration,
            name: createdMedia.name,
            type: createdMedia.type,
            file_url: createdMedia.file_url,
            created_at: nowStr,
          };

          const updatedItems = [...baseItems, newItem];

          // Atualizar no formulário se estiver aberto
          if (playlistModalOpen && editingPlaylist?.id === targetPl.id) {
            setPlaylistForm((prev) => ({
              ...prev,
              items: [
                ...prev.items,
                {
                  id: newItem.id,
                  media_id: createdMedia!.id,
                  duration: itemDuration,
                  name: createdMedia!.name,
                  type: createdMedia!.type,
                  file_url: createdMedia!.file_url,
                },
              ],
            }));
            setEditingPlaylist((prev) => (prev ? { ...prev, items: updatedItems } : null));
          }

          // Salvar a playlist atualizada no servidor
          try {
            const savedPl = await api.updateCompanyPlaylist(targetPl.id, {
              ...targetPl,
              items: updatedItems,
              restartPlayers: andRestart,
            });
            if (savedPl) {
              setPlaylists((prev) => prev.map((p) => (p.id === targetPl!.id ? savedPl : p)));
            }
          } catch (plErr) {
            console.warn('Falha ao adicionar mídia diretamente à playlist:', plErr);
          }
        }
      }

      // Reiniciar players se solicitado
      if (andRestart) {
        await handleRestartPlayers({
          playlistId: targetPl?.id,
          playlistName: targetPl?.name,
        });
      }

      showToast(
        'success',
        isTargetAllPlaylists
          ? `Mídia "${mediaTitle}" carregada e incluída em TODAS as ${playlists.length} playlists da empresa!${andRestart ? ' Reprodutores reiniciados.' : ''}`
          : targetPl
          ? `Mídia "${mediaTitle}" carregada e incluída na playlist "${targetPl.name}"!${andRestart ? ' Reprodutores reiniciados.' : ''}`
          : `Mídia "${mediaTitle}" cadastrada com sucesso!${andRestart ? ' Telas reiniciadas.' : ''}`
      );

      setMediaModalOpen(false);
      resetMediaModalState(playlistModalOpen && editingPlaylist ? editingPlaylist.id : undefined);
      loadData();
    } catch (err: any) {
      showToast('error', err.message || 'Erro ao cadastrar mídia.');
    } finally {
      setIsUploadingMedia(false);
    }
  };

  const handleDeleteMedia = (media: Media) => {
    setConfirmData({
      isOpen: true,
      title: 'Excluir Mídia',
      message: `Tem certeza que deseja excluir a mídia "${media.name}"?`,
      action: async () => {
        try {
          const res = await api.deleteCompanyMedia(media.id);
          showToast('success', res.message);
          setConfirmData((p) => ({ ...p, isOpen: false }));
          loadData();
        } catch (err: any) {
          showToast('error', err.message);
        }
      },
    });
  };

  // Sample media templates for quick testing
  const addPresetMedia = (title: string, type: 'image' | 'video' | 'rss' | 'weather_clock', url: string, duration: number) => {
    setSelectedDeviceFile(null);
    setMediaSourceType(type === 'weather_clock' ? 'weather_clock' : type === 'rss' ? 'rss' : 'url');
    setMediaForm({
      name: title,
      type,
      file_url: url,
      duration,
    });
  };

  // --- RSS HANDLERS ---
  const [isLoadingDefaultRss, setIsLoadingDefaultRss] = useState(false);

  const RSS_PRESETS = [
    {
      name: 'G1 - Saúde e Bem-Estar',
      url: 'https://g1.globo.com/rss/g1/saude/',
      category: 'Saúde',
      description: 'Prevenção, medicina e qualidade de vida.',
    },
    {
      name: 'G1 - Brasil e Notícias Gerais',
      url: 'https://g1.globo.com/rss/g1/brasil/',
      category: 'Geral',
      description: 'Manchetes e notícias do Brasil em tempo real.',
    },
    {
      name: 'Folha de S.Paulo - Em Cima da Hora',
      url: 'https://feeds.folha.uol.com.br/emcimadahora/rss091.xml',
      category: 'Jornalismo',
      description: 'Atualizações minuto a minuto dos principais fatos.',
    },
    {
      name: 'G1 - Economia e Negócios',
      url: 'https://g1.globo.com/rss/g1/economia/',
      category: 'Economia',
      description: 'Mercado financeiro, finanças pessoais e inflação.',
    },
    {
      name: 'G1 - Tecnologia e Inovação',
      url: 'https://g1.globo.com/rss/g1/tecnologia/',
      category: 'Tecnologia',
      description: 'Inovações, smartphones, IA e mundo digital.',
    },
  ];

  const handleLoadDefaultRss = async () => {
    setIsLoadingDefaultRss(true);
    try {
      const res = await api.loadDefaultRssFeeds();
      showToast('success', res.message || 'Canais RSS recomendados carregados com sucesso!');
      loadData();
    } catch (err: any) {
      showToast('error', err.message || 'Erro ao carregar canais padrão.');
    } finally {
      setIsLoadingDefaultRss(false);
    }
  };

  const handleAddPresetRss = async (preset: { name: string; url: string }) => {
    try {
      await api.createCompanyRss(preset);
      showToast('success', `Canal "${preset.name}" adicionado com sucesso!`);
      loadData();
    } catch (err: any) {
      showToast('error', err.message || 'Erro ao adicionar canal.');
    }
  };

  const handleOpenRssModal = (rss?: RssFeed) => {
    if (rss) {
      setEditingRss(rss);
      setRssForm({ name: rss.name, url: rss.url });
    } else {
      setEditingRss(null);
      setRssForm({ name: '', url: 'https://g1.globo.com/rss/g1/brasil/' });
    }
    setRssModalOpen(true);
  };

  const handleSaveRss = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingRss) {
        await api.updateCompanyRss(editingRss.id, rssForm);
        showToast('success', 'Feed RSS atualizado.');
      } else {
        await api.createCompanyRss(rssForm);
        showToast('success', 'Feed RSS cadastrado.');
      }
      setRssModalOpen(false);
      loadData();
    } catch (err: any) {
      showToast('error', err.message);
    }
  };

  const handleToggleRss = async (rss: RssFeed) => {
    try {
      const res = await api.toggleRssStatus(rss.id);
      showToast('success', res.message);
      loadData();
    } catch (err: any) {
      showToast('error', err.message);
    }
  };

  const handleDeleteRss = (rss: RssFeed) => {
    setConfirmData({
      isOpen: true,
      title: 'Excluir Feed RSS',
      message: `Tem certeza que deseja remover o feed "${rss.name}"?`,
      action: async () => {
        try {
          const res = await api.deleteCompanyRss(rss.id);
          showToast('success', res.message);
          setConfirmData((p) => ({ ...p, isOpen: false }));
          loadData();
        } catch (err: any) {
          showToast('error', err.message);
        }
      },
    });
  };

  // --- PASSWORD RESET HANDLER ---
  const handlePerformPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (resetPasswordData.type === 'player') {
        const res = await api.resetPlayerPassword(resetPasswordData.id, newPasswordInput || undefined);
        showToast('success', res.message);
      } else {
        const res = await api.resetOperatorPassword(resetPasswordData.id, newPasswordInput || undefined);
        showToast('success', res.message);
      }
      setResetPasswordData((p) => ({ ...p, isOpen: false }));
      setNewPasswordInput('');
    } catch (err: any) {
      showToast('error', err.message);
    }
  };

  const filteredPickerMedia = mediaList.filter((m) => {
    const matchesFilter =
      mediaPickerFilter === 'all' ? true : m.type === mediaPickerFilter;
    const matchesSearch =
      mediaPickerSearch.trim() === '' ||
      m.name.toLowerCase().includes(mediaPickerSearch.toLowerCase()) ||
      m.type.toLowerCase().includes(mediaPickerSearch.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const filteredPlayers =
    selectedStoreFilter === 'all'
      ? players
      : selectedStoreFilter === 'none'
      ? players.filter((p) => !p.store_id)
      : players.filter((p) => p.store_id === selectedStoreFilter);

  const filteredOperators =
    selectedStoreFilter === 'all'
      ? operators
      : selectedStoreFilter === 'none'
      ? operators.filter((op) => !op.store_id)
      : operators.filter((op) => op.store_id === selectedStoreFilter);

  const filteredPlaylists =
    selectedStoreFilter === 'all'
      ? playlists
      : selectedStoreFilter === 'none'
      ? playlists.filter((pl) => !pl.store_id)
      : playlists.filter((pl) => pl.store_id === selectedStoreFilter);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Top Header & Tabs */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-700 pb-5 mb-6">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight uppercase">Painel da Empresa</h2>
          {stores.length > 0 && (
            <p className="text-xs text-indigo-300 mt-0.5 flex items-center gap-1.5">
              <GitBranch className="h-3.5 w-3.5 text-indigo-400" />
              <span>Rede Multi-Lojas ({stores.length} {stores.length === 1 ? 'unidade cadastrada' : 'unidades cadastradas'})</span>
            </p>
          )}
        </div>

        {/* Sub-tabs com quebra responsiva em grade para mobile (sem deslocamento lateral) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:flex lg:flex-wrap lg:items-center gap-2 w-full lg:w-auto">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`w-full lg:w-auto justify-center min-h-[42px] px-3.5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition cursor-pointer text-center ${
              activeTab === 'dashboard'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700/60'
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab('stores')}
            className={`w-full lg:w-auto justify-center min-h-[42px] px-3.5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition cursor-pointer flex items-center gap-1.5 text-center ${
              activeTab === 'stores'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-800/80 text-indigo-300 hover:text-white hover:bg-slate-800 border border-indigo-800/50'
            }`}
          >
            <Store className="h-3.5 w-3.5 shrink-0" />
            <span>Lojas ({stores.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('players')}
            className={`w-full lg:w-auto justify-center min-h-[42px] px-3.5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition cursor-pointer text-center ${
              activeTab === 'players'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700/60'
            }`}
          >
            Players ({players.length})
          </button>
          <button
            onClick={() => setActiveTab('operators')}
            className={`w-full lg:w-auto justify-center min-h-[42px] px-3.5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition cursor-pointer text-center ${
              activeTab === 'operators'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700/60'
            }`}
          >
            Operadores ({operators.length})
          </button>
          <button
            onClick={() => setActiveTab('playlists')}
            className={`w-full lg:w-auto justify-center min-h-[42px] px-3.5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition cursor-pointer text-center ${
              activeTab === 'playlists'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700/60'
            }`}
          >
            Playlists ({playlists.length})
          </button>
          <button
            onClick={() => setActiveTab('media')}
            className={`w-full lg:w-auto justify-center min-h-[42px] px-3.5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition cursor-pointer text-center ${
              activeTab === 'media'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700/60'
            }`}
          >
            Mídias ({mediaList.length})
          </button>
          <button
            onClick={() => setActiveTab('rss')}
            className={`w-full lg:w-auto justify-center min-h-[42px] px-3.5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition cursor-pointer text-center ${
              activeTab === 'rss'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700/60'
            }`}
          >
            RSS ({rssList.length})
          </button>

          <button
            onClick={() => setActiveTab('proof_of_play')}
            className={`w-full lg:w-auto justify-center min-h-[42px] px-3.5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition cursor-pointer flex items-center gap-1.5 text-center ${
              activeTab === 'proof_of_play'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-slate-800/80 text-amber-300 hover:text-white hover:bg-slate-800 border border-amber-800/50'
            }`}
          >
            <BarChart3 className="h-3.5 w-3.5 shrink-0 text-amber-400" />
            <span>Prova de Exibição</span>
          </button>

          <button
            type="button"
            onClick={() => handleRestartPlayers({})}
            disabled={isRestartingPlayer === 'all'}
            className="w-full lg:w-auto justify-center min-h-[42px] px-3.5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition cursor-pointer flex items-center gap-1.5 border border-indigo-500/50 bg-indigo-600/25 hover:bg-indigo-600/45 text-indigo-200 hover:text-white shadow-xs text-center"
            title="Reiniciar reprodutores e recarregar playlists nas telas em tempo real"
          >
            <RefreshCw className={`h-3.5 w-3.5 shrink-0 ${isRestartingPlayer === 'all' ? 'animate-spin text-indigo-400' : ''}`} />
            <span>Reiniciar Telas</span>
          </button>
        </div>
      </div>

      {/* BARRA DE FILTRO RÁPIDO POR LOJA / UNIDADE (QUANDO A EMPRESA POSSUI LOJAS) */}
      {stores.length > 0 && (activeTab === 'players' || activeTab === 'operators' || activeTab === 'playlists') && (
        <div className="mb-6 rounded-xl border border-indigo-800/50 bg-indigo-950/20 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-indigo-200 font-semibold">
            <Store className="h-4 w-4 text-indigo-400 shrink-0" />
            <span>Filtrar por Loja / Unidade da Rede:</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setSelectedStoreFilter('all')}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                selectedStoreFilter === 'all'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-800 text-slate-300 hover:text-white border border-slate-700'
              }`}
            >
              Todas ({stores.length} lojas)
            </button>
            {stores.map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => setSelectedStoreFilter(st.id)}
                className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  selectedStoreFilter === st.id
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-800 text-slate-300 hover:text-white border border-slate-700'
                }`}
              >
                <span>{st.name}</span>
                {st.city && <span className="text-[10px] opacity-75">({st.city})</span>}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setSelectedStoreFilter('none')}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                selectedStoreFilter === 'none'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
              }`}
            >
              Matriz Geral (Sem Loja)
            </button>
          </div>
        </div>
      )}

      {/* VIEW: DASHBOARD MINIMALISTA COM LIMITES DO PLANO */}
      {activeTab === 'dashboard' && stats && (
        <div className="space-y-8">
          {/* 4 Cards de Métricas */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border border-slate-700 bg-slate-800 p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Players Ativos
                </span>
                <Monitor className="h-4 w-4 text-blue-400" />
              </div>
              <p className="mt-2 text-2xl font-bold text-white tracking-tight">
                {stats.activePlayersCount}{' '}
                <span className="text-xs font-normal text-slate-400">/ {stats.playersCount} total</span>
              </p>
              <div className="mt-2.5 pt-2 border-t border-slate-700/60 flex items-center justify-between flex-wrap gap-1">
                <div className="flex items-center gap-1.5 text-xs text-emerald-400">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[11px] font-medium">{stats.onlinePlayersCount} online</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleOpenDiagnostic()}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-400 hover:text-blue-300 underline cursor-pointer"
                  title="Ver métricas de heartbeat e diagnóstico de conectividade"
                >
                  <Activity className="h-3 w-3" />
                  <span>Métricas Heartbeat</span>
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-slate-700 bg-slate-800 p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Operadores
                </span>
                <Users className="h-4 w-4 text-emerald-400" />
              </div>
              <p className="mt-2 text-2xl font-bold text-white tracking-tight">{stats.operatorsCount}</p>
            </div>

            <div className="rounded-xl border border-slate-700 bg-slate-800 p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Playlists
                </span>
                <Film className="h-4 w-4 text-purple-400" />
              </div>
              <p className="mt-2 text-2xl font-bold text-white tracking-tight">{stats.playlistsCount}</p>
            </div>

            <div className="rounded-xl border border-slate-700 bg-slate-800 p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Mídias Cadastradas
                </span>
                <ImageIcon className="h-4 w-4 text-amber-400" />
              </div>
              <p className="mt-2 text-2xl font-bold text-white tracking-tight">{stats.mediaCount}</p>
            </div>
          </div>

          {/* Resumo dos Limites do Plano */}
          <div className="rounded-xl border border-slate-700 bg-slate-800 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Plano: {stats.plan?.name || 'Personalizado'}
                </h3>
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-blue-400 bg-blue-950/60 px-3 py-1 rounded-full border border-blue-800/80">
                R$ {Number(stats.plan?.monthly_price || 0).toFixed(2)}/mês
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
              {/* Players limit */}
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-slate-400 font-bold uppercase text-[10px] tracking-wider">Players Utilizados</span>
                  <span className="font-semibold text-white">
                    {stats.playersCount} / {stats.limits.max_players}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-700/60 overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full"
                    style={{
                      width: `${Math.min(100, (stats.playersCount / stats.limits.max_players) * 100)}%`,
                    }}
                  />
                </div>
              </div>

              {/* Operators limit */}
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-slate-400 font-bold uppercase text-[10px] tracking-wider">Operadores de Atendimento</span>
                  <span className="font-semibold text-white">
                    {stats.limits.max_operators === 0 ? (
                      <span className="text-amber-400 font-bold text-[10px] uppercase">Não incluído (Linha Show)</span>
                    ) : (
                      `${stats.operatorsCount} / ${stats.limits.max_operators}`
                    )}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-700/60 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${stats.limits.max_operators === 0 ? 'bg-amber-500/30' : 'bg-emerald-500'}`}
                    style={{
                      width: stats.limits.max_operators === 0 ? '0%' : `${Math.min(100, (stats.operatorsCount / Math.max(1, stats.limits.max_operators)) * 100)}%`,
                    }}
                  />
                </div>
              </div>

              {/* Storage / Media limit */}
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-slate-400 font-bold uppercase text-[10px] tracking-wider">Cota de Mídias (Armazenamento em Nuvem)</span>
                  <span className="font-semibold text-white">
                    {stats.mediaCount} / {stats.limits.max_media || stats.limits.max_storage || 20}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-700/60 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      (stats.mediaCount / (stats.limits.max_media || stats.limits.max_storage || 20)) >= 1
                        ? 'bg-rose-500'
                        : (stats.mediaCount / (stats.limits.max_media || stats.limits.max_storage || 20)) >= 0.8
                        ? 'bg-amber-500'
                        : 'bg-blue-500'
                    }`}
                    style={{
                      width: `${Math.min(100, (stats.mediaCount / (stats.limits.max_media || stats.limits.max_storage || 20)) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW: LOJAS / UNIDADES DA REDE */}
      {activeTab === 'stores' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
                <Store className="h-4 w-4 text-indigo-400" />
                <span>Lojas / Unidades da Rede ({stores.length})</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Organize suas filiais, bandeiras e pontos de venda e vincule Players, Operadores e Playlists a cada loja.
              </p>
            </div>
            <button
              onClick={() => handleOpenStoreModal()}
              className="flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 min-h-[44px] text-xs font-bold uppercase tracking-wider text-white shadow-sm hover:bg-indigo-500 transition cursor-pointer w-full sm:w-auto"
            >
              <Plus className="h-4 w-4" />
              <span>Nova Loja / Unidade</span>
            </button>
          </div>

          {stores.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-700 bg-slate-800/60 p-8 text-center space-y-3">
              <Store className="h-10 w-10 text-indigo-400 mx-auto opacity-80" />
              <div>
                <h4 className="text-sm font-bold text-white">Nenhuma loja ou filial cadastrada</h4>
                <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                  Se sua empresa possui mais de uma unidade (ex: Vale Lar Jacareí, Vale Tudo Jacareí, Vale Lar São José), cadastre as lojas aqui para separar as telas e operadores por filial.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleOpenStoreModal()}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold uppercase tracking-wider transition cursor-pointer shadow-sm"
              >
                <Plus className="h-4 w-4" />
                <span>Cadastrar Primeira Loja</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {stores.map((st) => {
                const storePlayers = players.filter((p) => p.store_id === st.id);
                const storeOperators = operators.filter((op) => op.store_id === st.id);
                const storePlaylists = playlists.filter((pl) => pl.store_id === st.id);
                return (
                  <div
                    key={st.id}
                    className="rounded-xl border border-slate-700 bg-slate-800 p-5 shadow-sm flex flex-col justify-between gap-4 hover:border-indigo-500/50 transition"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-bold text-white text-base">{st.name}</h4>
                            {st.brand_name && (
                              <span className="px-2 py-0.5 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-800/60 text-[10px] font-bold uppercase">
                                {st.brand_name}
                              </span>
                            )}
                            {st.code && (
                              <span className="font-mono text-[10px] bg-slate-900 px-2 py-0.5 rounded text-slate-400 border border-slate-700">
                                {st.code}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                            <span>
                              {st.city}
                              {st.state ? `/${st.state}` : ''}
                              {st.address ? ` — ${st.address}` : ''}
                            </span>
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleOpenStoreModal(st)}
                            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition cursor-pointer"
                            title="Editar loja"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteStore(st)}
                            className="p-2 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-slate-700 transition cursor-pointer"
                            title="Excluir loja"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {/* Resumo de vínculos da unidade */}
                      <div className="grid grid-cols-3 gap-2 pt-1">
                        <div className="rounded-lg bg-slate-900/70 border border-slate-700/60 p-2.5 text-center">
                          <p className="text-lg font-bold text-blue-400">{storePlayers.length}</p>
                          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Players</p>
                        </div>
                        <div className="rounded-lg bg-slate-900/70 border border-slate-700/60 p-2.5 text-center">
                          <p className="text-lg font-bold text-emerald-400">{storeOperators.length}</p>
                          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Operadores</p>
                        </div>
                        <div className="rounded-lg bg-slate-900/70 border border-slate-700/60 p-2.5 text-center">
                          <p className="text-lg font-bold text-purple-400">{storePlaylists.length}</p>
                          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Playlists</p>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-700/60 flex flex-wrap items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedStoreFilter(st.id);
                          setActiveTab('players');
                        }}
                        className="text-xs font-bold text-indigo-300 hover:text-indigo-200 flex items-center gap-1.5 cursor-pointer"
                      >
                        <Monitor className="h-3.5 w-3.5" />
                        <span>Ver Players desta Loja →</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedStoreFilter(st.id);
                          handleOpenPlayerModal();
                        }}
                        className="px-3 py-1.5 rounded-lg bg-slate-700/70 hover:bg-slate-700 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer transition"
                      >
                        <Plus className="h-3.5 w-3.5 text-blue-400" />
                        <span>Novo Player aqui</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VIEW: PLAYERS */}
      {activeTab === 'players' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">Players de Mídia</h3>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => handleOpenDiagnostic()}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 rounded-lg border border-indigo-700/80 bg-indigo-950/60 hover:bg-indigo-900/80 text-indigo-300 px-3.5 py-2.5 min-h-[44px] text-xs font-bold uppercase tracking-wider transition cursor-pointer shadow-xs"
                title="Abrir painel de métricas de heartbeat e diagnóstico de conectividade de cada tela"
              >
                <Activity className="h-4 w-4 text-indigo-400" />
                <span>Métricas Heartbeat</span>
              </button>
              <button
                onClick={() => handleOpenPlayerModal()}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 min-h-[44px] text-xs font-bold uppercase tracking-wider text-white shadow-sm hover:bg-blue-500 transition cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>Novo Player</span>
              </button>
            </div>
          </div>

          {/* MOBILE CARDS VIEW (block md:hidden) */}
          <div className="block md:hidden space-y-3">
            {filteredPlayers.length === 0 ? (
              <div className="rounded-xl border border-slate-700 bg-slate-800 p-6 text-center text-slate-400 text-xs">
                Nenhum player encontrado. Clique em "Novo Player" para adicionar uma tela.
              </div>
            ) : (
              filteredPlayers.map((p) => (
                <div key={p.id} className="rounded-xl border border-slate-700 bg-slate-800 p-4 shadow-sm space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="font-bold text-white text-sm">{p.name}</h4>
                        {p.store_name && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-800/60 text-[10px] font-bold">
                            <Store className="h-2.5 w-2.5 text-indigo-400" />
                            <span>{p.store_name}</span>
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">{p.description || 'Sem descrição'}</p>
                    </div>
                    <span className="font-mono bg-slate-900 px-2.5 py-1 rounded text-xs font-bold text-blue-400 border border-slate-700 shrink-0">
                      {p.code}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {/* Status & Online */}
                    <button
                      type="button"
                      onClick={() => handleOpenDiagnostic(p)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition cursor-pointer hover:opacity-85 ${
                        p.is_online
                          ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                          : 'bg-slate-900 text-slate-400 border border-slate-700'
                      }`}
                      title="Ver métricas de heartbeat e ping desta tela"
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          p.is_online ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                        }`}
                      />
                      <span>{p.is_online ? 'Online' : 'Offline'}</span>
                      <Activity className="h-2.5 w-2.5 ml-0.5 opacity-70" />
                    </button>

                    <span
                      className={`inline-flex items-center px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                        p.status === 'active'
                          ? 'bg-blue-950/60 text-blue-300 border border-blue-800'
                          : 'bg-rose-950/60 text-rose-300 border border-rose-800'
                      }`}
                    >
                      {p.status === 'active' ? 'Ativo' : 'Inativo'}
                    </span>

                    {/* Orientation */}
                    {p.orientation === 'vertical' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-emerald-950/60 text-emerald-300 border border-emerald-800/80">
                        <Smartphone className="h-3 w-3 text-emerald-400 shrink-0" />
                        <span>9:16 Vertical</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-blue-950/60 text-blue-300 border border-blue-800/80">
                        <Tv className="h-3 w-3 text-blue-400 shrink-0" />
                        <span>16:9 Horizontal</span>
                      </span>
                    )}
                  </div>

                  <div className="rounded-lg bg-slate-900/60 p-2.5 border border-slate-700/60 space-y-1 text-xs">
                    <div className="flex justify-between text-slate-400">
                      <span>Localização:</span>
                      <span className="font-medium text-slate-200">{p.location || 'Não informada'}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Playlist:</span>
                      <span className="font-medium text-blue-400">{p.playlist_name || 'Nenhuma'}</span>
                    </div>
                  </div>

                  {/* Link Único / Atalho TV */}
                  <div className="rounded-lg bg-blue-950/40 p-2.5 border border-blue-800/60 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-blue-300 uppercase tracking-wider flex items-center gap-1">
                        <Link2 className="h-3 w-3 text-blue-400" />
                        <span>Link Único (Sem Login)</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setPlayerDirectLinkModal({ isOpen: true, player: p })}
                        className="text-[10px] text-blue-400 hover:text-blue-300 underline font-medium cursor-pointer"
                      >
                        Ver Detalhes
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-300 font-mono truncate bg-slate-900/80 px-2 py-1 rounded border border-slate-700/60 select-all">
                      {getPlayerDirectUrl(p)}
                    </p>
                    <div className="flex items-center gap-2 pt-0.5">
                      <button
                        type="button"
                        onClick={() => handleCopyPlayerLink(p)}
                        className={`flex-1 min-h-[36px] flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-xs cursor-pointer ${
                          copiedPlayerId === p.id
                            ? 'bg-emerald-600 text-white'
                            : 'bg-blue-600 hover:bg-blue-500 text-white'
                        }`}
                      >
                        {copiedPlayerId === p.id ? (
                          <>
                            <Check className="h-3.5 w-3.5" />
                            <span>Link Copiado!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" />
                            <span>Copiar Link Único</span>
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => window.open(getPlayerDirectUrl(p), '_blank')}
                        className="min-h-[36px] px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                        title="Abrir em Nova Aba"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        <span>Abrir</span>
                      </button>
                    </div>
                  </div>

                  {/* Actions Grid for Mobile */}
                  <div className="pt-2 border-t border-slate-700/60 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenDiagnostic(p)}
                      className="min-h-[44px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-950/70 hover:bg-indigo-900/80 text-indigo-300 border border-indigo-800/80 text-xs font-semibold cursor-pointer"
                      title="Ver métricas de heartbeat e diagnóstico desta tela"
                    >
                      <Activity className="h-3.5 w-3.5 text-indigo-400" />
                      <span>Diagnóstico / Ping</span>
                    </button>
                    <button
                      onClick={() => handleRestartPlayers({ playerId: p.id, playerName: p.name })}
                      disabled={isRestartingPlayer === p.id}
                      className="min-h-[44px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600/25 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-700/60 text-xs font-bold cursor-pointer"
                      title="Reiniciar este reprodutor agora"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${isRestartingPlayer === p.id ? 'animate-spin' : ''}`} />
                      <span>Reiniciar Tela</span>
                    </button>
                    <button
                      onClick={() => onOpenPlayerSimulation(p.code)}
                      className="min-h-[44px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-700/50 text-xs font-semibold cursor-pointer"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      <span>Ver Tela</span>
                    </button>
                    <button
                      onClick={() => handleTogglePlayerSleep(p)}
                      className={`min-h-[44px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold cursor-pointer ${
                        p.is_sleeping
                          ? 'bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 border-indigo-700/80'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                      }`}
                      title={p.is_sleeping ? 'Acordar player' : 'Colocar player em repouso (Modo Economia)'}
                    >
                      <Moon className={`h-3.5 w-3.5 ${p.is_sleeping ? 'text-indigo-400' : 'text-slate-400'}`} />
                      <span>{p.is_sleeping ? 'Acordar' : 'Repouso'}</span>
                    </button>
                    <button
                      onClick={() => handleOpenPlayerModal(p)}
                      className="min-h-[44px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-700/60 hover:bg-slate-700 text-slate-200 border border-slate-600 text-xs font-semibold cursor-pointer"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                      <span>Editar</span>
                    </button>
                    <button
                      onClick={() => {
                        setResetPasswordData({
                          isOpen: true,
                          type: 'player',
                          id: p.id,
                          title: `Resetar Senha do Player ${p.name}`,
                        });
                      }}
                      className="min-h-[44px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-amber-950/40 hover:bg-amber-900/40 text-amber-300 border border-amber-800/60 text-xs font-semibold cursor-pointer"
                    >
                      <KeyRound className="h-3.5 w-3.5" />
                      <span>Senha</span>
                    </button>
                    <button
                      onClick={() => handleTogglePlayer(p)}
                      className="min-h-[44px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-semibold cursor-pointer"
                    >
                      <Power className="h-3.5 w-3.5" />
                      <span>{p.status === 'active' ? 'Desativar' : 'Ativar'}</span>
                    </button>
                    <button
                      onClick={() => handleDeletePlayer(p)}
                      className="col-span-2 min-h-[44px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-rose-950/30 hover:bg-rose-900/40 text-rose-300 border border-rose-800/50 text-xs font-semibold cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Excluir Player</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* DESKTOP TABLE VIEW (hidden md:block) */}
          <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-700 bg-slate-800 shadow-sm">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="border-b border-slate-700 bg-slate-800 uppercase font-bold text-slate-400 text-[10px] tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">Identificação / Nome</th>
                  <th className="px-5 py-3.5">Código Único</th>
                  <th className="px-5 py-3.5">Link Único (Atalho Direto)</th>
                  <th className="px-5 py-3.5">Formato & Resolução</th>
                  <th className="px-5 py-3.5">Localização</th>
                  <th className="px-5 py-3.5">Playlist Associada</th>
                  <th className="px-5 py-3.5">Conexão</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/60">
                {filteredPlayers.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-5 py-8 text-center text-slate-400">
                      Nenhum player encontrado. Clique em "Novo Player" para adicionar uma tela.
                    </td>
                  </tr>
                ) : (
                  filteredPlayers.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-700/30 transition">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="font-bold text-white text-sm">{p.name}</p>
                          {p.store_name && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-800/60 text-[10px] font-bold">
                              <Store className="h-2.5 w-2.5 text-indigo-400" />
                              <span>{p.store_name}</span>
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400">{p.description || 'Sem descrição'}</p>
                      </td>
                      <td className="px-5 py-4">
                        <span className="font-mono bg-slate-900 px-2.5 py-1 rounded text-xs font-bold text-blue-400 border border-slate-700">
                          {p.code}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleCopyPlayerLink(p)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition shadow-xs ${
                              copiedPlayerId === p.id
                                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700'
                                : 'bg-blue-950/60 hover:bg-blue-900/80 text-blue-300 border-blue-800/80'
                            }`}
                            title="Copiar link único com token para atalho na TV/Aparelho"
                          >
                            {copiedPlayerId === p.id ? (
                              <>
                                <Check className="h-3.5 w-3.5 text-emerald-400" />
                                <span className="text-emerald-300 font-bold">Copiado!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-3.5 w-3.5 text-blue-400" />
                                <span>Copiar Link</span>
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => setPlayerDirectLinkModal({ isOpen: true, player: p })}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition cursor-pointer"
                            title="Ver detalhes do link único e QR Code"
                          >
                            <Link2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        {p.orientation === 'vertical' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-emerald-950/60 text-emerald-300 border border-emerald-800/80">
                            <Smartphone className="h-3 w-3 text-emerald-400 shrink-0" />
                            <span>9:16 (1080×1920) Vertical</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-blue-950/60 text-blue-300 border border-blue-800/80">
                            <Tv className="h-3 w-3 text-blue-400 shrink-0" />
                            <span>16:9 (1920×1080) Horizontal</span>
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 font-medium text-slate-200">{p.location || 'Não informada'}</td>
                      <td className="px-5 py-4">
                        <span className="rounded bg-slate-900/80 px-2.5 py-1 text-slate-300 border border-slate-700 text-xs">
                          {p.playlist_name || 'Nenhuma'}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <button
                          type="button"
                          onClick={() => handleOpenDiagnostic(p)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition cursor-pointer hover:opacity-85 ${
                            p.is_online
                              ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                              : 'bg-slate-900 text-slate-400 border border-slate-700'
                          }`}
                          title="Clique para ver métricas de heartbeat e diagnóstico em tempo real"
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              p.is_online ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                            }`}
                          />
                          <span>{p.is_online ? 'Online' : 'Offline'}</span>
                          <Activity className="h-2.5 w-2.5 ml-0.5 opacity-70" />
                        </button>
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            p.status === 'active'
                              ? 'bg-blue-950/60 text-blue-300 border border-blue-800'
                              : 'bg-rose-950/60 text-rose-300 border border-rose-800'
                          }`}
                        >
                          {p.status === 'active' ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Botão de diagnóstico e métricas heartbeat */}
                          <button
                            type="button"
                            onClick={() => handleOpenDiagnostic(p)}
                            className="p-1.5 rounded-lg text-indigo-400 hover:text-indigo-200 hover:bg-slate-700 transition cursor-pointer"
                            title="Ver métricas de heartbeat e diagnóstico deste player"
                          >
                            <Activity className="h-4 w-4" />
                          </button>
                          {/* Botão de reiniciar este player */}
                          <button
                            type="button"
                            onClick={() => handleRestartPlayers({ playerId: p.id, playerName: p.name })}
                            disabled={isRestartingPlayer === p.id}
                            className="p-1.5 rounded-lg text-indigo-400 hover:text-indigo-200 hover:bg-slate-700 transition cursor-pointer"
                            title="Reiniciar reprodutor e recarregar playlist nesta tela"
                          >
                            <RefreshCw className={`h-4 w-4 ${isRestartingPlayer === p.id ? 'animate-spin' : ''}`} />
                          </button>
                          {/* Botão de abrir em nova aba pelo link único */}
                          <button
                            onClick={() => window.open(getPlayerDirectUrl(p), '_blank')}
                            className="p-1.5 rounded-lg text-emerald-400 hover:text-emerald-300 hover:bg-slate-700 transition cursor-pointer"
                            title="Abrir reprodutor pelo link único (Nova Aba)"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </button>
                          {/* Botão de simular no mesmo app */}
                          <button
                            onClick={() => onOpenPlayerSimulation(p.code)}
                            className="p-1.5 rounded-lg text-blue-400 hover:text-blue-300 hover:bg-slate-700 transition cursor-pointer"
                            title="Simular visualização"
                          >
                            <Tv className="h-4 w-4" />
                          </button>
                          {/* Botão de repouso / eco sleep */}
                          <button
                            type="button"
                            onClick={() => handleTogglePlayerSleep(p)}
                            className={`p-1.5 rounded-lg transition cursor-pointer ${
                              p.is_sleeping
                                ? 'bg-indigo-950 text-indigo-300 hover:bg-indigo-900 border border-indigo-700/60'
                                : 'text-slate-400 hover:text-white hover:bg-slate-700'
                            }`}
                            title={p.is_sleeping ? 'Acordar player agora' : 'Colocar player em repouso (Modo Economia)'}
                          >
                            <Moon className={`h-4 w-4 ${p.is_sleeping ? 'text-indigo-400' : 'text-slate-400'}`} />
                          </button>
                          <button
                            onClick={() => handleOpenPlayerModal(p)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition cursor-pointer"
                            title="Editar"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => {
                              setResetPasswordData({
                                isOpen: true,
                                type: 'player',
                                id: p.id,
                                title: `Resetar Senha do Player ${p.name}`,
                              });
                            }}
                            className="p-1.5 rounded-lg text-amber-400 hover:text-amber-300 hover:bg-slate-700 transition cursor-pointer"
                            title="Resetar senha"
                          >
                            <KeyRound className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleTogglePlayer(p)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition cursor-pointer"
                            title={p.status === 'active' ? 'Desativar' : 'Ativar'}
                          >
                            <Power className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeletePlayer(p)}
                            className="p-1.5 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-slate-700 transition cursor-pointer"
                            title="Excluir"
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

      {/* VIEW: OPERADORES */}
      {activeTab === 'operators' && (
        <div className="space-y-6">
          {stats.limits.max_operators === 0 && (
            <div className="rounded-xl border border-amber-800/80 bg-amber-950/40 p-3 text-amber-200 shadow-sm flex items-center gap-2.5">
              <Users className="h-4 w-4 text-amber-300 shrink-0" />
              <span className="text-xs font-bold uppercase tracking-wider text-amber-100">
                Plano sem Operador ({stats.plan?.name || 'Linha Show'})
              </span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">Operadores</h3>
            </div>
            <button
              onClick={() => handleOpenOperatorModal()}
              disabled={stats.limits.max_operators === 0}
              className={`flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 min-h-[44px] text-xs font-bold uppercase tracking-wider shadow-sm transition w-full sm:w-auto ${
                stats.limits.max_operators === 0
                  ? 'bg-slate-700 text-slate-400 cursor-not-allowed border border-slate-600'
                  : 'bg-blue-600 text-white hover:bg-blue-500 cursor-pointer'
              }`}
              title={stats.limits.max_operators === 0 ? 'Plano sem operadores' : 'Cadastrar novo operador'}
            >
              <Plus className="h-4 w-4" />
              <span>Novo Operador</span>
            </button>
          </div>

          {/* MOBILE CARDS VIEW (block md:hidden) */}
          <div className="block md:hidden space-y-3">
            {filteredOperators.length === 0 ? (
              <div className="rounded-xl border border-slate-700 bg-slate-800 p-6 text-center text-slate-400 text-xs">
                Nenhum operador encontrado. Clique em "Novo Operador".
              </div>
            ) : (
              filteredOperators.map((op) => (
                <div key={op.id} className="rounded-xl border border-slate-700 bg-slate-800 p-4 shadow-sm space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="font-bold text-white text-sm">{op.name}</h4>
                        {op.store_name && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-800/60 text-[10px] font-bold">
                            <Store className="h-2.5 w-2.5 text-indigo-400" />
                            <span>{op.store_name}</span>
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-300 font-mono mt-0.5">{op.email}</p>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                        op.active
                          ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                          : 'bg-rose-950/80 text-rose-300 border border-rose-800'
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${op.active ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                      {op.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>

                  <div className="rounded-lg bg-slate-900/60 p-2.5 border border-slate-700/60 text-xs">
                    <span className="text-slate-400">Telefone: </span>
                    <span className="font-medium text-slate-200">{op.phone || 'Não informado'}</span>
                  </div>

                  <div className="pt-2 border-t border-slate-700/60 grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleOpenOperatorModal(op)}
                      className="min-h-[44px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-700/60 hover:bg-slate-700 text-slate-200 border border-slate-600 text-xs font-semibold cursor-pointer"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                      <span>Editar</span>
                    </button>
                    <button
                      onClick={() => {
                        setResetPasswordData({
                          isOpen: true,
                          type: 'operator',
                          id: op.id,
                          title: `Resetar Senha do Operador ${op.name}`,
                        });
                      }}
                      className="min-h-[44px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-amber-950/40 hover:bg-amber-900/40 text-amber-300 border border-amber-800/60 text-xs font-semibold cursor-pointer"
                    >
                      <KeyRound className="h-3.5 w-3.5" />
                      <span>Senha</span>
                    </button>
                    <button
                      onClick={() => handleToggleOperator(op)}
                      className="min-h-[44px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-semibold cursor-pointer"
                    >
                      <Power className="h-3.5 w-3.5" />
                      <span>{op.active ? 'Desativar' : 'Ativar'}</span>
                    </button>
                    <button
                      onClick={() => handleDeleteOperator(op)}
                      className="min-h-[44px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-rose-950/30 hover:bg-rose-900/40 text-rose-300 border border-rose-800/50 text-xs font-semibold cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Excluir</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* DESKTOP TABLE VIEW (hidden md:block) */}
          <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-700 bg-slate-800 shadow-sm">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="border-b border-slate-700 bg-slate-800 uppercase font-bold text-slate-400 text-[10px] tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">Nome</th>
                  <th className="px-5 py-3.5">E-mail de Acesso</th>
                  <th className="px-5 py-3.5">Telefone</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/60">
                {filteredOperators.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-slate-400">
                      Nenhum operador encontrado. Clique em "Novo Operador".
                    </td>
                  </tr>
                ) : (
                  filteredOperators.map((op) => (
                    <tr key={op.id} className="hover:bg-slate-700/30 transition">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-white text-sm">{op.name}</span>
                          {op.store_name && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-800/60 text-[10px] font-bold">
                              <Store className="h-2.5 w-2.5 text-indigo-400" />
                              <span>{op.store_name}</span>
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-slate-300 font-mono">{op.email}</td>
                      <td className="px-5 py-4 text-slate-300">{op.phone || 'Não informado'}</td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            op.active
                              ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                              : 'bg-rose-950/80 text-rose-300 border border-rose-800'
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${op.active ? 'bg-emerald-400' : 'bg-rose-400'}`}
                          />
                          {op.active ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenOperatorModal(op)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition cursor-pointer"
                            title="Editar"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => {
                              setResetPasswordData({
                                isOpen: true,
                                type: 'operator',
                                id: op.id,
                                title: `Resetar Senha do Operador ${op.name}`,
                              });
                            }}
                            className="p-1.5 rounded-lg text-amber-400 hover:text-amber-300 hover:bg-slate-700 transition cursor-pointer"
                            title="Resetar senha"
                          >
                            <KeyRound className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleToggleOperator(op)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition cursor-pointer"
                            title={op.active ? 'Desativar' : 'Ativar'}
                          >
                            <Power className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteOperator(op)}
                            className="p-1.5 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-slate-700 transition cursor-pointer"
                            title="Excluir"
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

      {/* VIEW: PLAYLISTS */}
      {activeTab === 'playlists' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">Playlists</h3>
            </div>
            <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => handleRestartPlayers({})}
                disabled={isRestartingPlayer === 'all'}
                className="w-full sm:w-auto justify-center flex items-center gap-1.5 rounded-lg border border-indigo-500/50 bg-indigo-600/25 hover:bg-indigo-600/45 px-3 py-2 text-xs font-bold uppercase tracking-wider text-indigo-200 hover:text-white shadow-sm transition cursor-pointer"
                title="Dá o comando para todas as telas recarregarem a programação imediatamente"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isRestartingPlayer === 'all' ? 'animate-spin text-indigo-400' : ''}`} />
                <span>Reiniciar Telas</span>
              </button>
              <button
                onClick={() => handleOpenPlaylistModal()}
                className="w-full sm:w-auto justify-center flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-sm hover:bg-blue-500 transition cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>Nova Playlist</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filteredPlaylists.length === 0 ? (
              <div className="col-span-2 rounded-xl border border-slate-700 bg-slate-800 p-8 text-center text-slate-400 text-xs">
                Nenhuma playlist encontrada.
              </div>
            ) : (
              filteredPlaylists.map((pl) => (
                <div key={pl.id} className="rounded-xl border border-slate-700 bg-slate-800 p-5 shadow-sm space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-white text-base">{pl.name}</h4>
                        {pl.store_name && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-800/60 text-[10px] font-bold">
                            <Store className="h-2.5 w-2.5 text-indigo-400" />
                            <span>{pl.store_name}</span>
                          </span>
                        )}
                        <span
                          className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border tracking-wider ${
                            pl.active
                              ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                              : 'bg-slate-900 text-slate-400 border-slate-700'
                          }`}
                        >
                          {pl.active ? 'Ativa' : 'Inativa'}
                        </span>
                      </div>
                      {pl.description && <p className="text-xs text-slate-400 mt-1">{pl.description}</p>}
                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] text-sky-300 bg-sky-950/70 border border-sky-800/80 px-2 py-0.5 rounded-full inline-flex items-center gap-1 font-medium">
                          🌤️ Cidade: {pl.weather_city || 'São Paulo'}
                        </span>

                        {/* Status Clima na grade */}
                        {pl.items.some((it) => {
                          const m = mediaList.find((med) => med.id === it.media_id);
                          const t = m?.type || it.type;
                          const n = (m?.name || it.name || '').toLowerCase();
                          return t === 'weather_clock' || n.includes('previsão') || n.includes('clima');
                        }) ? (
                          <span className="text-[11px] text-amber-300 bg-amber-950/70 border border-amber-800/80 px-2 py-0.5 rounded-full inline-flex items-center gap-1 font-medium">
                            🌤️ Clima & Hora Ativo
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleSendWeatherToSavedPlaylist(pl.id)}
                            className="text-[11px] text-amber-300 hover:text-amber-200 bg-amber-900/30 hover:bg-amber-900/50 border border-amber-700/60 px-2 py-0.5 rounded-full inline-flex items-center gap-1 font-medium cursor-pointer transition"
                            title="Clique para adicionar a tela de Clima e Hora Certa nesta playlist"
                          >
                            + 🌤️ Adicionar Clima
                          </button>
                        )}

                        {/* Status RSS na grade */}
                        {pl.items.some((it) => {
                          const m = mediaList.find((med) => med.id === it.media_id);
                          const t = m?.type || it.type;
                          const n = (m?.name || it.name || '').toLowerCase();
                          return t === 'rss' || n.includes('rss') || n.includes('notícia');
                        }) ? (
                          <span className="text-[11px] text-rose-300 bg-rose-950/70 border border-rose-800/80 px-2 py-0.5 rounded-full inline-flex items-center gap-1 font-medium">
                            📰 Notícias RSS Ativas
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setPlaylistTargetModal({
                                isOpen: true,
                                type: 'rss',
                                rssData: { url: 'https://g1.globo.com/rss/g1/brasil/', name: 'G1 - Notícias Brasil' },
                              });
                            }}
                            className="text-[11px] text-rose-300 hover:text-rose-200 bg-rose-900/30 hover:bg-rose-900/50 border border-rose-700/60 px-2 py-0.5 rounded-full inline-flex items-center gap-1 font-medium cursor-pointer transition"
                            title="Clique para adicionar canal de notícias RSS em tela cheia"
                          >
                            + 📰 Adicionar RSS
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenPlaylistModal(pl)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition cursor-pointer"
                        title="Editar playlist"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleTogglePlaylist(pl)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition cursor-pointer"
                        title={pl.active ? 'Desativar' : 'Ativar'}
                      >
                        <Power className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeletePlaylist(pl)}
                        className="p-1.5 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-slate-700 transition cursor-pointer"
                        title="Excluir"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Itens da Playlist */}
                  <div className="border-t border-slate-700 pt-3">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                      Sequência ({pl.items.length} itens):
                    </p>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 text-xs">
                      {pl.items.map((it, idx) => {
                        const matchedMedia = mediaList.find((m) => m.id === it.media_id);
                        const itemName = matchedMedia?.name || it.name || 'Mídia sem nome';
                        const itemType = matchedMedia?.type || it.type || 'image';
                        const typeLabel =
                          itemType === 'weather_clock'
                            ? 'CLIMA & HORA'
                            : itemType === 'rss'
                            ? 'RSS / LINK'
                            : itemType === 'video'
                            ? 'VÍDEO'
                            : 'IMAGEM';

                        return (
                          <div
                            key={it.id || idx}
                            onClick={() => matchedMedia && setPreviewModalMedia(matchedMedia)}
                            className={`flex items-center justify-between gap-2 rounded-lg bg-slate-900/70 border border-slate-700/60 px-3 py-2 text-slate-300 ${
                              matchedMedia ? 'hover:border-slate-600 cursor-pointer transition' : ''
                            }`}
                            title={itemName}
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <span className="font-mono text-slate-500 font-bold shrink-0">{idx + 1}.</span>
                              <span className="truncate text-white font-semibold">{itemName}</span>
                              <span
                                className={`shrink-0 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                                  itemType === 'weather_clock'
                                    ? 'bg-amber-950/80 text-amber-300 border border-amber-800/60'
                                    : itemType === 'rss'
                                    ? 'bg-rose-950/80 text-rose-300 border border-rose-800/60'
                                    : itemType === 'video'
                                    ? 'bg-purple-950/80 text-purple-300 border border-purple-800/60'
                                    : 'bg-slate-800 text-slate-300 border border-slate-700'
                                }`}
                              >
                                {typeLabel}
                              </span>
                            </div>
                            <span className="shrink-0 font-mono text-xs text-blue-400 font-bold">
                              {it.duration}s
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Rodapé com botão de reiniciar player e recarregar playlist nas telas */}
                  <div className="border-t border-slate-700/70 pt-3 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => handleRestartPlayers({ playlistId: pl.id, playlistName: pl.name })}
                      disabled={isRestartingPlayer === pl.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/25 hover:bg-indigo-600/45 border border-indigo-500/40 text-indigo-200 hover:text-white text-xs font-bold transition cursor-pointer shadow-xs"
                      title="Envia o comando para todos os reprodutores vinculados a esta playlist recarregarem e reiniciarem as mídias agora"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isRestartingPlayer === pl.id ? 'animate-spin text-indigo-400' : ''}`} />
                      <span>Reiniciar Player(s)</span>
                    </button>
                    <span className="text-[11px] font-mono text-slate-400">
                      {pl.items.length} {pl.items.length === 1 ? 'mídia' : 'mídias'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* VIEW: MÍDIAS */}
      {activeTab === 'media' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">Mídias</h3>
            </div>
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap sm:items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => handleRestartPlayers({})}
                disabled={isRestartingPlayer === 'all'}
                className="w-full sm:w-auto justify-center flex items-center gap-1.5 rounded-lg border border-indigo-500/50 bg-indigo-600/25 hover:bg-indigo-600/45 px-3 py-2 text-xs font-bold uppercase tracking-wider text-indigo-200 hover:text-white shadow-sm transition cursor-pointer text-center"
                title="Dá o comando para todas as telas recarregarem a programação e mídias imediatamente"
              >
                <RefreshCw className={`h-3.5 w-3.5 shrink-0 ${isRestartingPlayer === 'all' ? 'animate-spin text-indigo-400' : ''}`} />
                <span>Reiniciar Telas</span>
              </button>

              <button
                id="btn-verify-media-integrity"
                type="button"
                onClick={handleRunIntegrityCheck}
                disabled={isCheckingIntegrity}
                className="w-full sm:w-auto justify-center flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/90 px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-200 shadow-sm hover:bg-slate-700 hover:text-white transition cursor-pointer disabled:opacity-50 text-center"
                title="Verifica se todas as mídias salvas estão acessíveis e prontas para as telas"
              >
                <ShieldCheck className={`h-4 w-4 shrink-0 ${isCheckingIntegrity ? 'animate-spin text-blue-400' : 'text-emerald-400'}`} />
                <span className="truncate">{isCheckingIntegrity ? 'Auditando...' : 'Integridade'}</span>
              </button>

              <button
                id="btn-sync-drive-media"
                type="button"
                onClick={handleSyncDriveMedia}
                disabled={isSyncingDriveMedia}
                className="w-full sm:w-auto justify-center flex items-center gap-2 rounded-lg border border-blue-500/40 bg-blue-600/20 px-3 py-2 text-xs font-bold uppercase tracking-wider text-blue-200 shadow-sm hover:bg-blue-600/30 hover:text-white transition cursor-pointer disabled:opacity-50 text-center"
                title="Sincroniza e importa arquivos e fotos que você colocou diretamente na pasta do Google Drive pelo seu computador para ficarem visíveis no celular e nas TVs"
              >
                <RefreshCw className={`h-4 w-4 shrink-0 ${isSyncingDriveMedia ? 'animate-spin text-blue-400' : 'text-blue-300'}`} />
                <span className="truncate">{isSyncingDriveMedia ? 'Sincronizando...' : 'Sincronizar'}</span>
              </button>

              <button
                id="btn-open-r2-modal"
                type="button"
                onClick={() => setR2ModalOpen(true)}
                className="w-full sm:w-auto justify-center flex items-center gap-2 rounded-lg border border-orange-500/40 bg-orange-600/20 px-3 py-2 text-xs font-bold uppercase tracking-wider text-orange-200 shadow-sm hover:bg-orange-600/35 hover:text-white transition cursor-pointer text-center"
                title="Configurar Cloudflare R2 para armazenamento definitivo com tráfego 100% grátis e sem expiração de token"
              >
                <Cloud className="h-4 w-4 shrink-0 text-orange-400" />
                <span className="truncate">Cloudflare R2</span>
              </button>

              <button
                id="btn-open-media-modal"
                onClick={() => {
                  resetMediaModalState();
                  setMediaModalOpen(true);
                }}
                className="w-full sm:w-auto justify-center flex items-center gap-2 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-sm hover:bg-blue-500 transition cursor-pointer text-center"
              >
                <UploadCloud className="h-4 w-4 shrink-0" />
                <span>Nova Mídia</span>
              </button>
            </div>
          </div>

          {/* COTA DE MÍDIAS E ARMAZENAMENTO */}
          <div className="rounded-xl border border-slate-700/80 bg-slate-850 p-4 sm:p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30 shrink-0">
                  <Film className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-white">Cota de Mídias</h4>
                </div>
              </div>

              <div className="flex items-center gap-3 bg-slate-900/80 border border-slate-800 px-4 py-2 rounded-xl">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Mídias Utilizadas</span>
                  <span className="text-sm font-bold text-white">
                    {mediaList.length} <span className="text-xs text-slate-400 font-normal">/ {effectiveMaxMedia}</span>
                  </span>
                </div>
                <div className="h-8 w-px bg-slate-700 mx-1" />
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-950/80 border border-blue-700/80 text-blue-300 text-[11px] font-semibold" title="Google Drive configurado como bucket oficial de fotos da empresa">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
                  Bucket de Fotos: Google Drive
                </span>
              </div>
            </div>

            {/* BARRA DE PROGRESSO DA COTA */}
            <div>
              <div className="h-2 w-full rounded-full bg-slate-900 border border-slate-700/60 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    mediaList.length >= effectiveMaxMedia
                      ? 'bg-rose-500'
                      : mediaList.length / effectiveMaxMedia >= 0.8
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  }`}
                  style={{
                    width: `${Math.min(
                      100,
                      (mediaList.length / effectiveMaxMedia) * 100
                    )}%`,
                  }}
                />
              </div>
              <div className="flex items-center justify-between mt-1 text-[10px]">
                <span className="text-slate-400">
                  {Math.max(0, effectiveMaxMedia - mediaList.length)} vaga(s) disponível(is)
                </span>
                {mediaList.length >= effectiveMaxMedia && (
                  <span className="font-bold text-rose-400">
                    Limite de mídias atingido!
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* INTEGRITY AUDIT BANNER & ALERT REPORT */}
          {integrityReport && (
            <div
              className={`rounded-xl border p-4 transition ${
                integrityReport.has_issues
                  ? 'border-rose-700/80 bg-rose-950/30'
                  : 'border-emerald-800/60 bg-emerald-950/20'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start sm:items-center gap-3">
                  <div
                    className={`rounded-lg p-2 shrink-0 ${
                      integrityReport.has_issues
                        ? 'bg-rose-900/60 text-rose-400'
                        : 'bg-emerald-900/60 text-emerald-400'
                    }`}
                  >
                    {integrityReport.has_issues ? (
                      <ShieldAlert className="h-5 w-5" />
                    ) : (
                      <ShieldCheck className="h-5 w-5" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-bold text-white">
                        {integrityReport.has_issues
                          ? `${integrityReport.issues.length} mídia(s) com falha`
                          : `Integridade OK (${integrityReport.summary.total})`}
                      </h4>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {new Date(integrityReport.checked_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  {integrityReport.has_issues && (
                    <button
                      type="button"
                      onClick={() => setShowIntegrityDetails(!showIntegrityDetails)}
                      className="rounded-lg border border-rose-700 bg-rose-900/40 px-3 py-1.5 text-xs font-semibold text-rose-200 hover:bg-rose-900/70 transition cursor-pointer"
                    >
                      {showIntegrityDetails ? 'Ocultar Detalhes' : `Ver Detalhes (${integrityReport.issues.length})`}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleRunIntegrityCheck}
                    disabled={isCheckingIntegrity}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white transition cursor-pointer"
                  >
                    <RefreshCw className={`h-3 w-3 ${isCheckingIntegrity ? 'animate-spin' : ''}`} />
                    <span>Reverificar</span>
                  </button>
                </div>
              </div>

              {/* DETAILED ISSUES BREAKDOWN */}
              {integrityReport.has_issues && showIntegrityDetails && (
                <div className="mt-4 pt-4 border-t border-rose-800/40 space-y-3">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-rose-300">
                    Mídias que requerem atenção:
                  </h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {integrityReport.issues.map((issue) => (
                      <div
                        key={issue.media_id}
                        className="rounded-lg border border-rose-800/60 bg-slate-900/80 p-3 flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="text-xs font-bold text-white block">{issue.name}</span>
                              <span className="text-[10px] text-slate-400 uppercase font-mono">
                                Origem: {issue.source === 'google_drive' ? 'Nuvem' : issue.source}
                              </span>
                            </div>
                            <span className="rounded bg-rose-900/80 border border-rose-600 px-1.5 py-0.5 text-[9px] font-bold uppercase text-rose-200">
                              {issue.status}
                            </span>
                          </div>
                          <p className="text-xs text-rose-300 mt-1.5 font-medium">{issue.message}</p>

                          {/* Affected Playlists & Screens */}
                          <div className="mt-2 text-[11px] text-slate-400 space-y-0.5">
                            {issue.playlists_affected.length > 0 && (
                              <div>
                                <span className="text-slate-500 font-medium">Playlists afetadas: </span>
                                <span className="text-slate-300">{issue.playlists_affected.join(', ')}</span>
                              </div>
                            )}
                            {issue.players_affected.length > 0 && (
                              <div>
                                <span className="text-slate-500 font-medium">Telas afetadas: </span>
                                <span className="text-amber-400 font-semibold">
                                  {issue.players_affected.map((p) => p.name || p.code).join(', ')}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const targetMedia = mediaList.find((m) => m.id === issue.media_id);
                              if (targetMedia) handleDeleteMedia(targetMedia);
                            }}
                            className="flex items-center gap-1 text-[11px] text-rose-400 hover:text-rose-300 font-medium ml-auto"
                          >
                            <Trash2 className="h-3 w-3" />
                            <span>Remover Mídia</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {mediaList.map((m) => {
              const itemIntegrity = integrityReport?.items?.find((it) => it.media_id === m.id);
              const memberPlaylists = playlists.filter((pl) =>
                pl.items.some((it) => it.media_id === m.id)
              );
              return (
              <div
                key={m.id}
                className={`overflow-hidden rounded-xl border bg-slate-800 shadow-sm flex flex-col justify-between transition ${
                  itemIntegrity && !itemIntegrity.healthy
                    ? 'border-rose-600 ring-1 ring-rose-500/50'
                    : 'border-slate-700'
                }`}
              >
                <div className="relative aspect-video w-full bg-slate-950 flex items-center justify-center overflow-hidden">
                  {/* Integrity Badge on Media Card */}
                  {itemIntegrity && !itemIntegrity.healthy && (
                    <div
                      className="absolute top-2 left-2 z-10 flex items-center gap-1 rounded bg-rose-950/90 border border-rose-600 px-2 py-0.5 text-[10px] font-bold text-rose-300 shadow-sm"
                      title={itemIntegrity.message}
                    >
                      <AlertTriangle className="h-3 w-3 text-rose-400 shrink-0" />
                      <span className="truncate max-w-[120px]">Inacessível</span>
                    </div>
                  )}
                  {itemIntegrity && itemIntegrity.healthy && itemIntegrity.source === 'google_drive' && (
                    <div
                      className="absolute top-2 left-2 z-10 flex items-center gap-1 rounded bg-emerald-950/80 border border-emerald-700/60 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 shadow-sm"
                      title="Arquivo verificado e acessível na nuvem"
                    >
                      <ShieldCheck className="h-3 w-3 text-emerald-400 shrink-0" />
                      <span>Nuvem OK</span>
                    </div>
                  )}
                  
                  {/* Media Thumbnail Component with Image & Video (MP4/WebM) Previews */}
                  <MediaThumbnail
                    media={m}
                    showBadge={true}
                    showDuration={false}
                    showPreviewButton={true}
                    allowHoverPlay={true}
                    onPreview={(item) => setPreviewModalMedia(item)}
                  />
                </div>

                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-bold text-white text-sm truncate flex-1" title={m.name}>{m.name}</h4>
                    {m.drive_file_id && (
                      <span className="shrink-0 text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-950/80 border border-blue-800/70 text-blue-300 flex items-center gap-1" title="Armazenado na nuvem">
                        <Folder className="h-3 w-3 text-blue-400" />
                        Nuvem
                      </span>
                    )}
                  </div>

                  {m.unique_code && (
                    <p className="text-[10px] font-mono text-slate-400 mt-1 flex items-center gap-1">
                      <span className="text-slate-500">ID:</span> {m.unique_code}
                    </p>
                  )}

                  {memberPlaylists.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {memberPlaylists.map((pl) => (
                        <span
                          key={pl.id}
                          className="inline-flex items-center gap-1 rounded bg-emerald-950/80 border border-emerald-800/70 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300 truncate max-w-full"
                          title={`Presente na playlist: ${pl.name}`}
                        >
                          <Check className="h-2.5 w-2.5 text-emerald-400 shrink-0" />
                          <span className="truncate">{pl.name}</span>
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="mt-2.5 pt-2 border-t border-slate-700/60 space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span className="flex items-center gap-1 font-medium">
                        <Clock className="h-3.5 w-3.5 text-slate-400" />
                        {m.duration}s
                      </span>

                      {m.drive_view_url && (
                        <a
                          href={m.drive_view_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-400 hover:text-blue-300 p-1 rounded hover:bg-slate-700 transition cursor-pointer flex items-center gap-1 text-[11px]"
                          title="Abrir arquivo original na nuvem"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          <span>Arquivo</span>
                        </a>
                      )}
                    </div>

                    {/* Botões de Ação Responsivos (com opção de carregar em todas as playlists) */}
                    <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-1.5 w-full">
                      <button
                        type="button"
                        onClick={() => openAddToAllPlaylistsModal(m)}
                        className={`col-span-2 sm:col-span-1 min-h-[34px] px-2.5 py-1 rounded-lg border text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                          memberPlaylists.length === playlists.length && playlists.length > 0
                            ? 'border-emerald-500/40 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/60 hover:text-white'
                            : 'border-amber-500/50 bg-amber-950/40 text-amber-300 hover:bg-amber-900/60 hover:text-white'
                        }`}
                        title="Carregar esta mídia para todas as playlists da empresa de uma só vez"
                      >
                        <Layers className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                        <span className="truncate">
                          {memberPlaylists.length === playlists.length && playlists.length > 0
                            ? `Em Todas (${playlists.length})`
                            : 'Todas as Playlists'}
                        </span>
                      </button>

                      {memberPlaylists.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            const pl = memberPlaylists[0];
                            handleRestartPlayers({
                              playlistId: pl.id,
                              playlistName: pl.name,
                            });
                          }}
                          disabled={isRestartingPlayer !== null}
                          className="min-h-[34px] text-indigo-300 hover:text-white px-2 py-1 rounded-lg hover:bg-indigo-900/40 border border-indigo-500/30 transition cursor-pointer flex items-center justify-center gap-1 text-xs font-semibold"
                          title="Reinicia os reprodutores vinculados a esta mídia para recarregar a playlist"
                        >
                          <RefreshCw className="h-3 w-3 shrink-0" />
                          <span className="truncate">Reiniciar</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setPreviewModalMedia(m)}
                        className="min-h-[34px] text-slate-300 hover:text-white px-2 py-1 rounded-lg hover:bg-slate-700 border border-slate-700/60 transition cursor-pointer flex items-center justify-center gap-1 text-xs font-semibold"
                        title="Pré-visualizar em alta definição"
                      >
                        <Eye className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                        <span>Ver</span>
                      </button>

                      <button
                        onClick={() => handleDeleteMedia(m)}
                        className="min-h-[34px] text-rose-400 hover:text-rose-300 px-2 py-1 rounded-lg hover:bg-rose-950/40 border border-rose-500/30 transition cursor-pointer flex items-center justify-center gap-1 text-xs font-semibold"
                        title="Excluir da biblioteca"
                      >
                        <Trash2 className="h-3.5 w-3.5 shrink-0" />
                        <span className="sm:hidden">Excluir</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          </div>
        </div>
      )}

      {/* VIEW: RSS */}
      {activeTab === 'rss' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">Feeds RSS</h3>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <button
                type="button"
                onClick={handleLoadDefaultRss}
                disabled={isLoadingDefaultRss}
                className="min-h-[44px] flex items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 px-3.5 py-2 text-xs font-semibold text-slate-200 transition cursor-pointer disabled:opacity-50"
              >
                {isLoadingDefaultRss ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin text-blue-400" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                )}
                <span>Restaurar Feeds Padrão</span>
              </button>
              <button
                type="button"
                onClick={() => handleOpenRssModal()}
                className="min-h-[44px] flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-sm hover:bg-blue-500 transition cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>Novo Feed RSS</span>
              </button>
            </div>
          </div>

          {/* PAINEL DE CANAIS PRONTOS PARA USO */}
          <div className="rounded-xl border border-slate-700 bg-slate-800/80 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-white">
                  Canais Sugeridos
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
              {RSS_PRESETS.map((preset) => {
                const isAdded = rssList.some(
                  (r) => r.url.trim() === preset.url.trim() || r.name.toLowerCase() === preset.name.toLowerCase()
                );
                return (
                  <div
                    key={preset.url}
                    className="flex flex-col justify-between rounded-lg border border-slate-700/80 bg-slate-900/60 p-3 text-xs"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-bold text-white truncate">{preset.name}</span>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider bg-slate-800 text-blue-400 border border-slate-700 shrink-0">
                          {preset.category}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
                      <span className="font-mono text-[10px] text-slate-500 truncate max-w-[130px]">
                        {preset.url}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleSendRssToPlaylist(preset.url, preset.name)}
                          className="px-2 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold text-[10px] transition cursor-pointer flex items-center gap-1 shadow-sm"
                          title="Inserir este canal diretamente na playlist como slide de tela inteira"
                        >
                          <ListPlus className="h-3 w-3" />
                          <span>+ Na Playlist</span>
                        </button>
                        {isAdded ? (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-400 shrink-0">
                            <CheckCircle2 className="h-3 w-3" />
                            <span>Cadastrado</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleAddPresetRss(preset)}
                            className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold text-[10px] transition cursor-pointer flex items-center gap-1"
                            title="Salvar canal no banco de dados"
                          >
                            <Plus className="h-3 w-3" />
                            <span>Salvar</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* MOBILE CARDS VIEW (block md:hidden) */}
          <div className="block md:hidden space-y-3">
            {rssList.length === 0 ? (
              <div className="rounded-xl border border-slate-700 bg-slate-800 p-6 text-center text-slate-400 text-xs">
                Nenhum canal RSS cadastrado.
              </div>
            ) : (
              rssList.map((r) => (
                <div key={r.id} className="rounded-xl border border-slate-700 bg-slate-800 p-4 shadow-sm space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-bold text-white text-sm">{r.name}</h4>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                        r.active
                          ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                          : 'bg-slate-900 text-slate-400 border border-slate-700'
                      }`}
                    >
                      {r.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>

                  <div className="rounded-lg bg-slate-900/60 p-2.5 border border-slate-700/60 text-xs font-mono text-slate-300 break-all">
                    {r.url}
                  </div>

                  {/* Ação rápida: Inserir na Playlist */}
                  <button
                    type="button"
                    onClick={() => handleSendRssToPlaylist(r.url, r.name)}
                    className="w-full min-h-[38px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition cursor-pointer shadow-sm"
                  >
                    <ListPlus className="h-4 w-4" />
                    <span>+ Incluir na Playlist como Slide</span>
                  </button>

                  <div className="pt-2 border-t border-slate-700/60 flex items-center gap-2">
                    <button
                      onClick={() => handleOpenRssModal(r)}
                      className="flex-1 min-h-[44px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-700/60 hover:bg-slate-700 text-slate-200 border border-slate-600 text-xs font-semibold cursor-pointer"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                      <span>Editar</span>
                    </button>
                    <button
                      onClick={() => handleToggleRss(r)}
                      className="flex-1 min-h-[44px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-semibold cursor-pointer"
                    >
                      <Power className="h-3.5 w-3.5" />
                      <span>{r.active ? 'Desativar' : 'Ativar'}</span>
                    </button>
                    <button
                      onClick={() => handleDeleteRss(r)}
                      className="min-h-[44px] px-3.5 flex items-center justify-center rounded-lg bg-rose-950/30 hover:bg-rose-900/40 text-rose-300 border border-rose-800/50 text-xs font-semibold cursor-pointer"
                      title="Excluir"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* DESKTOP TABLE VIEW (hidden md:block) */}
          <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-700 bg-slate-800 shadow-sm">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="border-b border-slate-700 bg-slate-800 uppercase font-bold text-slate-400 text-[10px] tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">Nome do Canal</th>
                  <th className="px-5 py-3.5">URL do Feed</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/60">
                {rssList.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-8 text-center text-slate-400">
                      Nenhum canal RSS cadastrado.
                    </td>
                  </tr>
                ) : (
                  rssList.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-700/30 transition">
                      <td className="px-5 py-4 font-bold text-white">{r.name}</td>
                      <td className="px-5 py-4 font-mono text-slate-300 truncate max-w-xs">{r.url}</td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            r.active
                              ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                              : 'bg-slate-900 text-slate-400 border border-slate-700'
                          }`}
                        >
                          {r.active ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleSendRssToPlaylist(r.url, r.name)}
                            className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-sm"
                            title="Inserir este canal RSS como slide de tela inteira na playlist"
                          >
                            <ListPlus className="h-3.5 w-3.5" />
                            <span>+ Na Playlist</span>
                          </button>
                          <button
                            onClick={() => handleOpenRssModal(r)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition cursor-pointer"
                            title="Editar"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleToggleRss(r)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition cursor-pointer"
                            title={r.active ? 'Desativar' : 'Ativar'}
                          >
                            <Power className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteRss(r)}
                            className="p-1.5 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-slate-700 transition cursor-pointer"
                            title="Excluir"
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

      {/* SUGESTÃO 6: ABA DE PROVA DE EXIBIÇÃO & AUDITORIA (PROOF OF PLAY) */}
      {activeTab === 'proof_of_play' && (
        <div className="space-y-6">
          {/* Top Bar with Filters and Export */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-400" />
                <span>Prova de Exibição & Auditoria (Proof of Play)</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Métricas auditáveis e relatórios de conformidade comercial para anunciantes e lojistas.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Filtro de Período */}
              <div className="flex items-center gap-1.5 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700 text-xs">
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                <select
                  value={proofOfPlayDays}
                  onChange={(e) => setProofOfPlayDays(Number(e.target.value))}
                  className="bg-transparent text-white font-medium focus:outline-none cursor-pointer"
                >
                  <option value={1}>Últimas 24 horas</option>
                  <option value={7}>Últimos 7 dias</option>
                  <option value={15}>Últimos 15 dias</option>
                  <option value={30}>Últimos 30 dias</option>
                </select>
              </div>

              {/* Filtro de Player */}
              <div className="flex items-center gap-1.5 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700 text-xs">
                <Tv className="h-3.5 w-3.5 text-slate-400" />
                <select
                  value={proofOfPlayPlayerFilter}
                  onChange={(e) => setProofOfPlayPlayerFilter(e.target.value)}
                  className="bg-transparent text-white font-medium focus:outline-none cursor-pointer max-w-[150px] truncate"
                >
                  <option value="all">Todas as Telas</option>
                  {players.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Atualizar */}
              <button
                type="button"
                onClick={loadProofOfPlay}
                disabled={proofOfPlayLoading}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition cursor-pointer"
                title="Atualizar dados de exibição"
              >
                <RefreshCw className={`h-4 w-4 ${proofOfPlayLoading ? 'animate-spin text-blue-400' : ''}`} />
              </button>

              {/* Exportar CSV */}
              <button
                type="button"
                onClick={handleExportProofOfPlayCsv}
                className="min-h-[36px] flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-xs cursor-pointer"
                title="Exportar registros detalhados em planilha CSV para anunciantes"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Exportar Relatório CSV</span>
              </button>
            </div>
          </div>

          {/* Cards de Métricas Principais (KPIs) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-xs relative overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total de Exibições</span>
                <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <Play className="h-4 w-4 fill-current" />
                </div>
              </div>
              <p className="text-2xl font-extrabold text-white font-mono">
                {proofOfPlayLoading ? '...' : (proofOfPlaySummary?.totalPlays ?? 0).toLocaleString('pt-BR')}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">Impactos veiculados no período</p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-xs relative overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tempo Total no Ar</span>
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Clock className="h-4 w-4" />
                </div>
              </div>
              <p className="text-2xl font-extrabold text-emerald-400 font-mono">
                {proofOfPlayLoading ? '...' : formatSecondsToReadable(proofOfPlaySummary?.totalDurationSeconds ?? 0)}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">Horas totais de exibição em tela</p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-xs relative overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Telas Auditadas</span>
                <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  <Tv className="h-4 w-4" />
                </div>
              </div>
              <p className="text-2xl font-extrabold text-indigo-400 font-mono">
                {proofOfPlayLoading ? '...' : (proofOfPlaySummary?.uniquePlayers ?? 0)}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">Reprodutores que reportaram logs</p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-xs relative overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Mídias no Período</span>
                <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  <Film className="h-4 w-4" />
                </div>
              </div>
              <p className="text-2xl font-extrabold text-purple-400 font-mono">
                {proofOfPlayLoading ? '...' : (proofOfPlaySummary?.uniqueMedia ?? 0)}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">Campanhas distintas transmitidas</p>
            </div>
          </div>

          {/* Gráfico / Ranking das Top Mídias & Tabela de Registros Recentes */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Top Mídias Mais Exibidas */}
            <div className="lg:col-span-1 rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="font-bold text-white text-sm flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-blue-400" />
                  <span>Mídias Mais Exibidas</span>
                </h3>
                <span className="text-[11px] font-semibold text-slate-400">
                  Top {(proofOfPlaySummary?.topMedia || []).length}
                </span>
              </div>

              {(!proofOfPlaySummary?.topMedia || proofOfPlaySummary.topMedia.length === 0) ? (
                <div className="p-6 text-center text-slate-500 text-xs">
                  Nenhuma mídia registrada no período selecionado.
                </div>
              ) : (
                <div className="space-y-3.5 max-h-[460px] overflow-y-auto pr-1">
                  {proofOfPlaySummary.topMedia.slice(0, 10).map((tm, idx) => {
                    const maxCount = proofOfPlaySummary.topMedia[0]?.playCount || 1;
                    const percent = Math.min(100, Math.round((tm.playCount / maxCount) * 100));
                    return (
                      <div key={tm.media_id || idx} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5 min-w-0 flex-1 pr-2">
                            <span className="font-mono text-slate-500 font-bold text-[10px]">#{idx + 1}</span>
                            <span className="font-semibold text-white truncate text-xs" title={tm.media_name}>
                              {tm.media_name}
                            </span>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="font-mono font-bold text-blue-400 text-xs">{tm.playCount}x</span>
                            <span className="text-slate-500 text-[10px] ml-1">({formatSecondsToReadable(tm.totalSeconds)})</span>
                          </div>
                        </div>
                        <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Tabela de Logs Recentes de Auditoria */}
            <div className="lg:col-span-2 rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="font-bold text-white text-sm flex items-center gap-2">
                  <Activity className="h-4 w-4 text-emerald-400" />
                  <span>Últimos Registros de Reprodução (Tempo Real)</span>
                </h3>
                <span className="text-[11px] font-semibold text-slate-400">
                  {proofOfPlaySummary?.recentLogs?.length || 0} eventos
                </span>
              </div>

              {(!proofOfPlaySummary?.recentLogs || proofOfPlaySummary.recentLogs.length === 0) ? (
                <div className="p-12 text-center space-y-2">
                  <ShieldAlert className="h-8 w-8 text-slate-600 mx-auto" />
                  <p className="text-sm font-bold text-slate-300">Nenhum evento registrado ainda</p>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Assim que as TVs reproduzirem a grade, cada exibição com data, horário e duração aparecerá aqui automaticamente.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto max-h-[460px] overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 text-[11px] uppercase">
                        <th className="pb-2.5 font-bold">Data & Hora</th>
                        <th className="pb-2.5 font-bold">Mídia</th>
                        <th className="pb-2.5 font-bold">TV / Player</th>
                        <th className="pb-2.5 font-bold">Duração</th>
                        <th className="pb-2.5 font-bold text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {proofOfPlaySummary.recentLogs
                        .filter((log, idx, arr) => arr.findIndex((l) => l.id === log.id) === idx)
                        .slice(0, 50)
                        .map((log, idx) => {
                          const dateFormatted = new Date(log.played_at).toLocaleString('pt-BR');
                          const rowKey = log.id ? `${log.id}-${idx}` : `log-${idx}`;
                          return (
                            <tr key={rowKey} className="hover:bg-slate-800/40 transition">
                            <td className="py-2.5 font-mono text-[11px] text-slate-300">
                              {dateFormatted}
                            </td>
                            <td className="py-2.5">
                              <div className="flex items-center gap-2">
                                <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                                  log.media_type === 'video'
                                    ? 'bg-purple-950 text-purple-300 border border-purple-800'
                                    : log.media_type === 'rss'
                                    ? 'bg-rose-950 text-rose-300 border border-rose-800'
                                    : 'bg-blue-950 text-blue-300 border border-blue-800'
                                }`}>
                                  {log.media_type || 'IMG'}
                                </span>
                                <span className="font-semibold text-white truncate max-w-[160px]" title={log.media_name}>
                                  {log.media_name}
                                </span>
                              </div>
                            </td>
                            <td className="py-2.5 text-slate-300 font-medium">
                              {log.player_name || log.player_id}
                            </td>
                            <td className="py-2.5 font-mono text-slate-300">
                              {log.duration_seconds}s
                            </td>
                            <td className="py-2.5 text-right">
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded-full">
                                <CheckCircle2 className="h-3 w-3" />
                                <span>Verificado</span>
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL PLAYER */}
      {playerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 p-0 sm:p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl text-slate-100 flex flex-col max-h-[92vh] sm:max-h-[85vh] animate-in slide-in-from-bottom sm:slide-in-from-bottom-0">
            {/* Mobile Drag Indicator */}
            <div className="sm:hidden w-12 h-1.5 bg-slate-700 rounded-full mx-auto my-2.5 shrink-0" />

            {/* Header */}
            <div className="shrink-0 px-5 py-3 sm:py-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-bold text-white">
                {editingPlayer ? 'Editar Player' : 'Novo Player'}
              </h3>
              <button
                type="button"
                onClick={() => setPlayerModalOpen(false)}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSavePlayer} className="flex flex-col flex-1 min-h-0">
              <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Nome do Ponto de Exibição *</label>
                  <input
                    type="text"
                    required
                    value={playerForm.name}
                    onChange={(e) => setPlayerForm({ ...playerForm, name: e.target.value })}
                    placeholder="Ex: TV Recepção Principal"
                    className="w-full min-h-[44px] rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                {stores.length > 0 && (
                  <div>
                    <label className="block font-semibold text-indigo-300 mb-1 flex items-center gap-1.5">
                      <Store className="h-3.5 w-3.5 text-indigo-400" />
                      <span>Loja / Unidade da Rede</span>
                    </label>
                    <select
                      value={playerForm.store_id}
                      onChange={(e) => setPlayerForm({ ...playerForm, store_id: e.target.value })}
                      className="w-full min-h-[44px] rounded-lg border border-indigo-700/70 bg-slate-800 px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                    >
                      <option value="">Matriz / Rede Geral (Todas as Lojas)</option>
                      {stores.map((st) => (
                        <option key={st.id} value={st.id}>
                          {st.name} {st.city ? `— ${st.city}/${st.state}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">Código Único (TV) *</label>
                    <input
                      type="text"
                      required
                      value={playerForm.code}
                      onChange={(e) => setPlayerForm({ ...playerForm, code: e.target.value.toUpperCase() })}
                      placeholder="EX: PLAY-01"
                      className="w-full min-h-[44px] rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 font-mono uppercase text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">Localização</label>
                    <input
                      type="text"
                      value={playerForm.location}
                      onChange={(e) => setPlayerForm({ ...playerForm, location: e.target.value })}
                      placeholder="Ex: Balcão 01"
                      className="w-full min-h-[44px] rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Orientação & Resolução */}
                <div>
                  <label className="block font-semibold text-slate-300 mb-1.5">
                    Orientação da Tela & Resolução *
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setPlayerForm({ ...playerForm, orientation: 'horizontal' })}
                      className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                        playerForm.orientation === 'horizontal'
                          ? 'border-blue-500 bg-blue-950/40 ring-1 ring-blue-500 text-white'
                          : 'border-slate-700 bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700/50'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-1.5">
                        <span className="font-bold text-[11px] uppercase tracking-wider text-slate-200">
                          Horizontal (16:9)
                        </span>
                        <Tv className="h-4 w-4 text-blue-400 shrink-0" />
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-5 rounded border border-current flex items-center justify-center text-[8px] font-mono font-bold">
                          16:9
                        </div>
                        <span className="text-xs font-semibold text-white">1920 × 1080 px</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPlayerForm({ ...playerForm, orientation: 'vertical' })}
                      className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                        playerForm.orientation === 'vertical'
                          ? 'border-emerald-500 bg-emerald-950/40 ring-1 ring-emerald-500 text-white'
                          : 'border-slate-700 bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700/50'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-1.5">
                        <span className="font-bold text-[11px] uppercase tracking-wider text-slate-200">
                          Vertical (9:16)
                        </span>
                        <Smartphone className="h-4 w-4 text-emerald-400 shrink-0" />
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-8 rounded border border-current flex items-center justify-center text-[8px] font-mono font-bold">
                          9:16
                        </div>
                        <span className="text-xs font-semibold text-white">1080 × 1920 px</span>
                      </div>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Playlist Padrão</label>
                  <select
                    value={playerForm.playlist_id}
                    onChange={(e) => setPlayerForm({ ...playerForm, playlist_id: e.target.value })}
                    className="w-full min-h-[44px] rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="">Sem playlist associada</option>
                    {playlists.map((pl) => (
                      <option key={pl.id} value={pl.id}>
                        {pl.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Sugestão 3: Transição de Tela Padrão */}
                <div>
                  <label className="block font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-blue-400" />
                    <span>Transição Visual entre Mídias</span>
                  </label>
                  <select
                    value={playerForm.transition_effect || 'crossfade'}
                    onChange={(e) => setPlayerForm({ ...playerForm, transition_effect: e.target.value as any })}
                    className="w-full min-h-[44px] rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="crossfade">Dissolvência Suave (Crossfade)</option>
                    <option value="slide">Deslizamento Lateral (Slide)</option>
                    <option value="zoom">Zoom Cinematográfico (Ken Burns)</option>
                    <option value="cut">Corte Instantâneo Clássico</option>
                  </select>
                </div>

                {/* Sugestão 4: Volume Master do Reprodutor */}
                <div className="rounded-xl border border-slate-700/80 bg-slate-800/60 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-semibold text-slate-200 flex items-center gap-1.5 text-xs">
                      {playerForm.master_muted ? (
                        <VolumeX className="h-4 w-4 text-rose-400" />
                      ) : (
                        <Volume2 className="h-4 w-4 text-emerald-400" />
                      )}
                      <span>Volume Master do Player</span>
                    </label>
                    <span className="font-mono font-bold text-xs text-white">
                      {playerForm.master_muted ? 'Mudo' : `${playerForm.master_volume ?? 100}%`}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      disabled={playerForm.master_muted}
                      value={playerForm.master_volume ?? 100}
                      onChange={(e) => setPlayerForm({ ...playerForm, master_volume: Number(e.target.value) })}
                      className="flex-1 accent-blue-500 cursor-pointer disabled:opacity-40"
                    />
                    <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={playerForm.master_muted ?? false}
                        onChange={(e) => setPlayerForm({ ...playerForm, master_muted: e.target.checked })}
                        className="rounded accent-rose-500"
                      />
                      <span>Silencioso (Mudo)</span>
                    </label>
                  </div>
                </div>

                {/* Sugestão 5: Modo Economia de Energia & Descanso Noturno */}
                <div className="rounded-xl border border-indigo-800/60 bg-indigo-950/30 p-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-indigo-300 flex items-center gap-1.5 text-xs cursor-pointer">
                      <Moon className="h-4 w-4 text-indigo-400" />
                      <span>Modo Economia de Energia Noturno</span>
                    </label>
                    <input
                      type="checkbox"
                      checked={playerForm.eco_mode_enabled ?? false}
                      onChange={(e) => setPlayerForm({ ...playerForm, eco_mode_enabled: e.target.checked })}
                      className="rounded accent-indigo-500 h-4 w-4 cursor-pointer"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Desliga a reprodução fora do expediente para economizar energia e evitar queima da tela (burn-in).
                  </p>

                  {playerForm.eco_mode_enabled && (
                    <div className="pt-2 border-t border-indigo-800/40 space-y-2.5 animate-in fade-in">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] uppercase font-bold text-indigo-300 mb-1">Dormir às</label>
                          <input
                            type="time"
                            value={playerForm.eco_sleep_start || '22:00'}
                            onChange={(e) => setPlayerForm({ ...playerForm, eco_sleep_start: e.target.value })}
                            className="w-full rounded-lg border border-indigo-700/80 bg-slate-900 px-2.5 py-1.5 text-white text-xs font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase font-bold text-indigo-300 mb-1">Acordar às</label>
                          <input
                            type="time"
                            value={playerForm.eco_sleep_end || '06:00'}
                            onChange={(e) => setPlayerForm({ ...playerForm, eco_sleep_end: e.target.value })}
                            className="w-full rounded-lg border border-indigo-700/80 bg-slate-900 px-2.5 py-1.5 text-white text-xs font-mono"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] uppercase font-bold text-indigo-300 mb-1">Aparência em Repouso</label>
                        <select
                          value={playerForm.eco_screen_type || 'black'}
                          onChange={(e) => setPlayerForm({ ...playerForm, eco_screen_type: e.target.value as any })}
                          className="w-full rounded-lg border border-indigo-700/80 bg-slate-900 px-2.5 py-1.5 text-white text-xs"
                        >
                          <option value="black">Tela Preta Anti-Burn-In (Consumo Mínimo)</option>
                          <option value="clock">Relógio OLED Minimalista Escurecido</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                {!editingPlayer && (
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">Senha de Acesso do Player</label>
                    <input
                      type="password"
                      value={playerForm.password}
                      onChange={(e) => setPlayerForm({ ...playerForm, password: e.target.value })}
                      placeholder="Padrão: 123456"
                      className="w-full min-h-[44px] rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                )}

                {editingPlayer && (
                  <div className="rounded-xl border border-blue-800/60 bg-blue-950/30 p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-blue-300 flex items-center gap-1.5">
                        <Link2 className="h-3.5 w-3.5 text-blue-400" />
                        <span>Link Único para Atalho na TV (Sem Login)</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRegenerateToken(editingPlayer)}
                        className="text-[10px] text-blue-400 hover:text-blue-200 underline font-medium cursor-pointer"
                      >
                        Regenerar Token
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={getPlayerDirectUrl(editingPlayer)}
                        className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 font-mono text-[11px] text-blue-200 focus:outline-none select-all"
                      />
                      <button
                        type="button"
                        onClick={() => handleCopyPlayerLink(editingPlayer)}
                        className="min-h-[34px] px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1 transition shadow-xs cursor-pointer shrink-0"
                      >
                        {copiedPlayerId === editingPlayer.id ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-emerald-300" />
                            <span>Copiado</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" />
                            <span>Copiar</span>
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => window.open(getPlayerDirectUrl(editingPlayer), '_blank')}
                        className="min-h-[34px] px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 text-xs flex items-center gap-1 transition cursor-pointer shrink-0"
                        title="Abrir em Nova Aba"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Sticky Footer */}
              <div className="shrink-0 p-4 border-t border-slate-800 bg-slate-900/95 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setPlayerModalOpen(false)}
                  className="flex-1 sm:flex-initial min-h-[44px] px-4 py-2.5 rounded-lg border border-slate-700 bg-slate-800 text-xs font-semibold text-slate-300 hover:bg-slate-700 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 sm:flex-initial min-h-[44px] px-5 py-2.5 rounded-lg bg-blue-600 text-xs font-semibold text-white hover:bg-blue-500 cursor-pointer shadow-sm"
                >
                  Salvar Player
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL OPERADOR */}
      {operatorModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 p-0 sm:p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl text-slate-100 flex flex-col max-h-[92vh] sm:max-h-[85vh] animate-in slide-in-from-bottom sm:slide-in-from-bottom-0">
            {/* Mobile Drag Indicator */}
            <div className="sm:hidden w-12 h-1.5 bg-slate-700 rounded-full mx-auto my-2.5 shrink-0" />

            {/* Header */}
            <div className="shrink-0 px-5 py-3 sm:py-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-bold text-white">
                {editingOperator ? 'Editar Operador' : 'Novo Operador'}
              </h3>
              <button
                type="button"
                onClick={() => setOperatorModalOpen(false)}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveOperator} className="flex flex-col flex-1 min-h-0">
              <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Nome do Operador *</label>
                  <input
                    type="text"
                    required
                    value={operatorForm.name}
                    onChange={(e) => setOperatorForm({ ...operatorForm, name: e.target.value })}
                    placeholder="Ex: Carlos Atendente"
                    className="w-full min-h-[44px] rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">E-mail para Login *</label>
                  <input
                    type="email"
                    required
                    value={operatorForm.email}
                    onChange={(e) => setOperatorForm({ ...operatorForm, email: e.target.value })}
                    placeholder="operador@empresa.com"
                    className="w-full min-h-[44px] rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Telefone / WhatsApp</label>
                  <input
                    type="text"
                    value={operatorForm.phone}
                    onChange={(e) => setOperatorForm({ ...operatorForm, phone: e.target.value })}
                    placeholder="(11) 98888-8888"
                    className="w-full min-h-[44px] rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                {stores.length > 0 && (
                  <div>
                    <label className="block font-semibold text-indigo-300 mb-1 flex items-center gap-1.5">
                      <Store className="h-3.5 w-3.5 text-indigo-400" />
                      <span>Loja / Unidade de Atuação</span>
                    </label>
                    <select
                      value={operatorForm.store_id}
                      onChange={(e) => setOperatorForm({ ...operatorForm, store_id: e.target.value })}
                      className="w-full min-h-[44px] rounded-lg border border-indigo-700/70 bg-slate-800 px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                    >
                      <option value="">Todas as Lojas da Rede (Acesso Geral)</option>
                      {stores.map((st) => (
                        <option key={st.id} value={st.id}>
                          {st.name} {st.city ? `— ${st.city}/${st.state}` : ''}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Se vinculado a uma loja específica, o operador verá apenas as telas dessa loja no painel de chamadas.
                    </p>
                  </div>
                )}

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    {editingOperator ? 'Nova Senha (opcional)' : 'Senha Provisória'}
                  </label>
                  <input
                    type="password"
                    value={operatorForm.password}
                    onChange={(e) => setOperatorForm({ ...operatorForm, password: e.target.value })}
                    placeholder={editingOperator ? 'Deixe em branco para manter a senha atual' : 'Padrão: 123456'}
                    className="w-full min-h-[44px] rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Sticky Footer */}
              <div className="shrink-0 p-4 border-t border-slate-800 bg-slate-900/95 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setOperatorModalOpen(false)}
                  className="flex-1 sm:flex-initial min-h-[44px] px-4 py-2.5 rounded-lg border border-slate-700 bg-slate-800 text-xs font-semibold text-slate-300 hover:bg-slate-700 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 sm:flex-initial min-h-[44px] px-5 py-2.5 rounded-lg bg-blue-600 text-xs font-semibold text-white hover:bg-blue-500 cursor-pointer shadow-sm"
                >
                  Salvar Operador
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PLAYLIST (COM SELEÇÃO E ORDENAÇÃO DE MÍDIAS) */}
      {playlistModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 p-0 sm:p-4 backdrop-blur-xs">
          <div className="w-full max-w-xl rounded-t-2xl sm:rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl text-slate-100 flex flex-col max-h-[92vh] sm:max-h-[88vh] animate-in slide-in-from-bottom sm:slide-in-from-bottom-0">
            {/* Mobile Drag Indicator */}
            <div className="sm:hidden w-12 h-1.5 bg-slate-700 rounded-full mx-auto my-2.5 shrink-0" />

            {/* Header */}
            <div className="shrink-0 px-5 py-3 sm:py-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-bold text-white">
                {editingPlaylist ? 'Editar Playlist' : 'Nova Playlist'}
              </h3>
              <button
                type="button"
                onClick={() => setPlaylistModalOpen(false)}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSavePlaylist} className="flex flex-col flex-1 min-h-0">
              <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Nome da Playlist *</label>
                  <input
                    type="text"
                    required
                    value={playlistForm.name}
                    onChange={(e) => setPlaylistForm({ ...playlistForm, name: e.target.value })}
                    placeholder="Ex: Programação Diária - Farmácia"
                    className="w-full min-h-[44px] rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Descrição</label>
                  <input
                    type="text"
                    value={playlistForm.description}
                    onChange={(e) => setPlaylistForm({ ...playlistForm, description: e.target.value })}
                    placeholder="Observações da grade"
                    className="w-full min-h-[44px] rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                {stores.length > 0 && (
                  <div>
                    <label className="block font-semibold text-indigo-300 mb-1 flex items-center gap-1.5">
                      <Store className="h-3.5 w-3.5 text-indigo-400" />
                      <span>Loja / Unidade da Rede (Opcional)</span>
                    </label>
                    <select
                      value={playlistForm.store_id}
                      onChange={(e) => {
                        const stId = e.target.value;
                        const stObj = stores.find((s) => s.id === stId);
                        setPlaylistForm({
                          ...playlistForm,
                          store_id: stId,
                          weather_city: stObj?.city ? stObj.city : playlistForm.weather_city,
                        });
                      }}
                      className="w-full min-h-[44px] rounded-lg border border-indigo-700/70 bg-slate-800 px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                    >
                      <option value="">Grade Geral da Rede (Todas as Lojas)</option>
                      {stores.map((st) => (
                        <option key={st.id} value={st.id}>
                          {st.name} {st.city ? `— ${st.city}/${st.state}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    Cidade (Clima)
                  </label>
                  <input
                    type="text"
                    value={playlistForm.weather_city}
                    onChange={(e) => setPlaylistForm({ ...playlistForm, weather_city: e.target.value })}
                    placeholder="Ex: São Paulo, Campinas, Belo Horizonte"
                    className="w-full min-h-[44px] rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Sugestão 3: Transição Visual da Playlist */}
                <div className="rounded-xl border border-slate-700/80 bg-slate-800/60 p-3 space-y-2">
                  <label className="font-semibold text-slate-200 flex items-center gap-1.5 text-xs">
                    <Sparkles className="h-4 w-4 text-blue-400" />
                    <span>Efeito de Transição Padrão da Playlist</span>
                  </label>
                  <select
                    value={playlistForm.transition_effect || 'crossfade'}
                    onChange={(e) => setPlaylistForm({ ...playlistForm, transition_effect: e.target.value as any })}
                    className="w-full min-h-[40px] rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white text-xs focus:outline-none focus:border-blue-500"
                  >
                    <option value="crossfade">Dissolvência Suave (Crossfade)</option>
                    <option value="slide">Deslizamento Lateral (Slide)</option>
                    <option value="zoom">Zoom Cinematográfico (Ken Burns)</option>
                    <option value="cut">Corte Instantâneo (Cut)</option>
                  </select>
                  <p className="text-[11px] text-slate-400">
                    Define como as mídias se alternam visualmente nas TVs vinculadas a esta playlist.
                  </p>
                </div>

                {/* Itens na Playlist */}
                <div className="border-t border-slate-800 pt-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                    <div>
                      <label className="font-semibold text-slate-300 block">Sequência</label>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          if (editingPlaylist) {
                            handleRestartPlayers({
                              playlistId: editingPlaylist.id,
                              playlistName: editingPlaylist.name,
                            });
                          } else {
                            handleRestartPlayers({});
                          }
                        }}
                        disabled={isRestartingPlayer !== null}
                        className="min-h-[36px] px-3 py-1.5 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 hover:text-white border border-indigo-500/50 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                        title="Reinicia o player e recarrega a playlist nas telas imediatamente"
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${isRestartingPlayer ? 'animate-spin text-indigo-400' : ''}`} />
                        <span>Reiniciar Player(s)</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleQuickAddWeatherToPlaylist}
                        className="min-h-[36px] px-2.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                        title="Adicionar tela de Clima e Hora Certa"
                      >
                        <CloudSun className="h-3.5 w-3.5 text-amber-400" />
                        <span>+ Clima & Hora</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setRssQuickPickerOpen(true)}
                        className="min-h-[36px] px-2.5 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                        title="Adicionar canal de notícias RSS em tela cheia"
                      >
                        <Newspaper className="h-3.5 w-3.5 text-rose-400" />
                        <span>+ Notícia RSS</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setMediaPickerModalOpen(true)}
                        className="min-h-[36px] px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-sm"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Mídias</span>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {playlistForm.items.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-700 p-4 bg-slate-900/60 my-2 space-y-2">
                        <p className="text-slate-300 font-bold text-xs text-center">Sem itens na playlist</p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                          <button
                            type="button"
                            onClick={handleQuickAddWeatherToPlaylist}
                            className="p-2.5 rounded-xl border border-amber-500/40 bg-amber-950/30 hover:bg-amber-900/40 text-left transition cursor-pointer group"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <CloudSun className="h-4 w-4 text-amber-400" />
                              <span className="text-[10px] font-bold text-amber-400 uppercase">+ Adicionar</span>
                            </div>
                            <p className="text-xs font-bold text-white">Clima & Hora</p>
                          </button>

                          <button
                            type="button"
                            onClick={() => setRssQuickPickerOpen(true)}
                            className="p-2.5 rounded-xl border border-rose-500/40 bg-rose-950/30 hover:bg-rose-900/40 text-left transition cursor-pointer group"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <Newspaper className="h-4 w-4 text-rose-400" />
                              <span className="text-[10px] font-bold text-rose-400 uppercase">+ Escolher</span>
                            </div>
                            <p className="text-xs font-bold text-white">Notícias RSS</p>
                          </button>

                          <button
                            type="button"
                            onClick={() => setMediaPickerModalOpen(true)}
                            className="p-2.5 rounded-xl border border-blue-500/40 bg-blue-950/30 hover:bg-blue-900/40 text-left transition cursor-pointer group"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <Film className="h-4 w-4 text-blue-400" />
                              <span className="text-[10px] font-bold text-blue-400 uppercase">+ Abrir</span>
                            </div>
                            <p className="text-xs font-bold text-white">Biblioteca</p>
                          </button>
                        </div>
                      </div>
                    ) : (
                      playlistForm.items.map((it, idx) => {
                        const media = mediaList.find((m) => m.id === it.media_id);
                        const itemName = media?.name || (it as any).name || 'Mídia sem nome';
                        const itemType = media?.type || (it as any).type || 'image';
                        return (
                          <div
                            key={idx}
                            className="flex items-center gap-2 sm:gap-2.5 rounded-xl border border-slate-700/80 bg-slate-800/80 hover:bg-slate-800 p-2 sm:p-2.5 transition"
                          >
                            <span className="font-mono text-slate-400 font-bold text-xs w-5 sm:w-6 text-center shrink-0">#{idx + 1}</span>

                            {/* Media Thumbnail / Icon */}
                            <div
                              onClick={() => media && setPreviewModalMedia(media)}
                              className="h-10 w-12 sm:w-14 shrink-0 rounded-lg overflow-hidden bg-slate-950 flex items-center justify-center border border-slate-700 cursor-pointer group hover:border-blue-500 relative transition"
                              title="Clique para pré-visualizar esta mídia"
                            >
                              {itemType === 'weather_clock' ? (
                                <CloudSun className="h-5 w-5 text-amber-400" />
                              ) : itemType === 'rss' ? (
                                <Newspaper className="h-5 w-5 text-rose-400" />
                              ) : itemType === 'video' && media?.file_url ? (
                                <>
                                  <video
                                    src={media.file_url}
                                    preload="metadata"
                                    muted
                                    className="h-full w-full object-cover"
                                  />
                                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center group-hover:bg-blue-600/30 transition">
                                    <Play className="h-3 w-3 text-white fill-current opacity-90 group-hover:scale-110 transition" />
                                  </div>
                                </>
                              ) : media?.file_url ? (
                                <>
                                  <img
                                    src={media.file_url}
                                    alt={itemName}
                                    referrerPolicy="no-referrer"
                                    className="h-full w-full object-cover group-hover:scale-105 transition"
                                  />
                                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 flex items-center justify-center transition opacity-0 group-hover:opacity-100">
                                    <Eye className="h-3 w-3 text-white" />
                                  </div>
                                </>
                              ) : (
                                <Film className="h-5 w-5 text-slate-500" />
                              )}
                            </div>

                            {/* Media Title and Type Badge */}
                            <div className="flex-1 min-w-0">
                              <p className="text-white font-bold text-xs truncate" title={itemName}>
                                {itemName}
                              </p>
                              <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                                  itemType === 'rss'
                                    ? 'bg-rose-950/80 text-rose-300 border border-rose-800/60'
                                    : itemType === 'weather_clock'
                                    ? 'bg-blue-950/80 text-blue-300 border border-blue-800/60'
                                    : itemType === 'video'
                                    ? 'bg-purple-950/80 text-purple-300 border border-purple-800/60'
                                    : 'bg-slate-700 text-slate-300'
                                }`}>
                                  {itemType === 'rss' ? 'Notícia RSS / Link' : itemType === 'weather_clock' ? 'Clima & Hora' : itemType === 'video' ? 'Vídeo' : 'Imagem'}
                                </span>

                                {/* Sugestão 1: Agendamento Inteligente Badge / Botão */}
                                <button
                                  type="button"
                                  onClick={() => setScheduleModalItemIndex(idx)}
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 transition cursor-pointer ${
                                    it.schedule_enabled
                                      ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-600/80 hover:bg-emerald-900'
                                      : 'bg-slate-900/90 text-slate-400 hover:text-white border border-slate-700/80 hover:border-blue-500'
                                  }`}
                                  title="Clique para programar dias e horários desta mídia"
                                >
                                  <Calendar className={`h-3 w-3 ${it.schedule_enabled ? 'text-emerald-400' : 'text-slate-400'}`} />
                                  <span>{it.schedule_enabled ? 'Programado' : 'Agendar'}</span>
                                </button>

                                {/* Sugestão 4: Controle de Áudio por Vídeo */}
                                {itemType === 'video' && (
                                  <div className="flex items-center gap-1 bg-slate-900/90 px-1.5 py-0.5 rounded border border-slate-700/80">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const newItems = [...playlistForm.items];
                                        newItems[idx].is_muted = !newItems[idx].is_muted;
                                        setPlaylistForm({ ...playlistForm, items: newItems });
                                      }}
                                      className="cursor-pointer text-slate-300 hover:text-white"
                                      title={it.is_muted ? 'Vídeo mudo (clique para ativar som)' : 'Som ativo (clique para mutar)'}
                                    >
                                      {it.is_muted ? (
                                        <VolumeX className="h-3 w-3 text-rose-400" />
                                      ) : (
                                        <Volume2 className="h-3 w-3 text-emerald-400" />
                                      )}
                                    </button>
                                    {!it.is_muted && (
                                      <span className="text-[10px] text-slate-300 font-mono font-bold">
                                        {it.volume !== undefined ? `${it.volume}%` : '100%'}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Duration input */}
                            <div className="flex items-center gap-1 bg-slate-900 px-2 py-1 rounded-lg border border-slate-700 shrink-0">
                              <Clock className="h-3 w-3 text-slate-400" />
                              <input
                                type="number"
                                min={1}
                                max={600}
                                value={it.duration}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  const newItems = [...playlistForm.items];
                                  newItems[idx].duration = v === '' ? '' : Number(v);
                                  setPlaylistForm({ ...playlistForm, items: newItems });
                                }}
                                placeholder="10"
                                className="w-10 sm:w-12 bg-transparent text-white text-xs font-bold text-center focus:outline-none"
                              />
                              <span className="text-slate-400 text-[10px] font-semibold">s</span>
                            </div>

                            {/* Order buttons */}
                            <div className="flex items-center gap-0.5 shrink-0">
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => {
                                  const newItems = [...playlistForm.items];
                                  const temp = newItems[idx - 1];
                                  newItems[idx - 1] = newItems[idx];
                                  newItems[idx] = temp;
                                  setPlaylistForm({ ...playlistForm, items: newItems });
                                }}
                                className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                                title="Subir posição"
                              >
                                <MoveUp className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={idx === playlistForm.items.length - 1}
                                onClick={() => {
                                  const newItems = [...playlistForm.items];
                                  const temp = newItems[idx + 1];
                                  newItems[idx + 1] = newItems[idx];
                                  newItems[idx] = temp;
                                  setPlaylistForm({ ...playlistForm, items: newItems });
                                }}
                                className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                                title="Descer posição"
                              >
                                <MoveDown className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const newItems = playlistForm.items.filter((_, i) => i !== idx);
                                  setPlaylistForm({ ...playlistForm, items: newItems });
                                }}
                                className="p-1.5 text-rose-400 hover:text-rose-300 ml-0.5 cursor-pointer"
                                title="Remover da playlist"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {playlistForm.items.length > 0 && (
                    <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setMediaPickerModalOpen(true)}
                        className="w-full min-h-[40px] py-2 px-3 rounded-lg border border-dashed border-slate-700 hover:border-blue-500/80 bg-slate-800/40 hover:bg-slate-800 text-slate-300 hover:text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5 text-blue-400" />
                        <span>Incluir da Biblioteca</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          resetMediaModalState(editingPlaylist?.id);
                          setMediaModalOpen(true);
                        }}
                        className="w-full min-h-[40px] py-2 px-3 rounded-lg border border-indigo-500/40 hover:border-indigo-500 bg-indigo-950/30 hover:bg-indigo-900/40 text-indigo-200 hover:text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                        title="Fazer upload de nova imagem ou vídeo direto do celular/computador e incluir nesta playlist"
                      >
                        <UploadCloud className="h-3.5 w-3.5 text-indigo-400" />
                        <span>Carregar Nova Mídia (Upload)</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Sticky Footer com botões de Salvar e Reiniciar */}
              <div className="shrink-0 p-4 border-t border-slate-800 bg-slate-900/95 flex flex-wrap items-center justify-between gap-3">
                {editingPlaylist && (
                  <button
                    type="button"
                    onClick={() =>
                      handleRestartPlayers({
                        playlistId: editingPlaylist.id,
                        playlistName: editingPlaylist.name,
                      })
                    }
                    disabled={isRestartingPlayer === editingPlaylist.id}
                    className="min-h-[40px] px-3.5 py-2 rounded-lg border border-indigo-500/40 bg-indigo-600/20 hover:bg-indigo-600/35 text-xs font-bold text-indigo-200 hover:text-white flex items-center gap-1.5 transition cursor-pointer"
                    title="Envia o comando para todas as telas recarregarem esta playlist imediatamente"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRestartingPlayer === editingPlaylist.id ? 'animate-spin text-indigo-400' : ''}`} />
                    <span>Reiniciar Telas Agora</span>
                  </button>
                )}

                <div className="flex flex-wrap items-center gap-2.5 ml-auto">
                  <button
                    type="button"
                    onClick={() => setPlaylistModalOpen(false)}
                    className="min-h-[40px] px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-xs font-semibold text-slate-300 hover:bg-slate-700 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleSavePlaylist(e, true)}
                    className="min-h-[40px] px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white cursor-pointer shadow-sm flex items-center gap-1.5 transition"
                    title="Salva a playlist e envia o comando para as telas reiniciarem imediatamente"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Salvar e Reiniciar Telas</span>
                  </button>
                  <button
                    type="submit"
                    className="min-h-[40px] px-5 py-2 rounded-lg bg-blue-600 text-xs font-semibold text-white hover:bg-blue-500 cursor-pointer shadow-sm"
                  >
                    Salvar Playlist
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL SELETOR DE MÍDIAS PARA A PLAYLIST */}
      {mediaPickerModalOpen && (
        <div className="fixed inset-0 z-60 flex items-end sm:items-center justify-center bg-black/80 p-0 sm:p-4 backdrop-blur-sm">
          <div className="w-full max-w-4xl rounded-t-2xl sm:rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl text-slate-100 flex flex-col max-h-[94vh] sm:max-h-[90vh] animate-in slide-in-from-bottom sm:slide-in-from-bottom-0">
            {/* Mobile Drag Indicator */}
            <div className="sm:hidden w-12 h-1.5 bg-slate-700 rounded-full mx-auto my-2.5 shrink-0" />

            {/* Header */}
            <div className="shrink-0 px-5 py-3 sm:py-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  <Film className="h-5 w-5 text-blue-400 shrink-0" />
                  <span>Selecionar Mídia</span>
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (editingPlaylist) {
                      handleRestartPlayers({
                        playlistId: editingPlaylist.id,
                        playlistName: editingPlaylist.name,
                      });
                    } else {
                      handleRestartPlayers({});
                    }
                  }}
                  disabled={isRestartingPlayer !== null}
                  className="min-h-[38px] px-3 py-1.5 rounded-lg border border-indigo-500/50 bg-indigo-600/25 hover:bg-indigo-600/40 text-indigo-200 hover:text-white font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                  title="Reiniciar player e recarregar a tela agora"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isRestartingPlayer ? 'animate-spin text-indigo-400' : ''}`} />
                  <span className="hidden sm:inline">Reiniciar Telas</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    resetMediaModalState(editingPlaylist?.id);
                    setMediaModalOpen(true);
                  }}
                  className="min-h-[38px] px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-sm"
                >
                  <Plus className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Nova Mídia</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMediaPickerModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="px-4 py-3 border-b border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shrink-0">
              <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
                {[
                  { id: 'all', label: 'Todas', count: mediaList.length },
                  { id: 'image', label: 'Imagens', count: mediaList.filter((m) => m.type === 'image').length },
                  { id: 'video', label: 'Vídeos', count: mediaList.filter((m) => m.type === 'video').length },
                  { id: 'rss', label: 'Notícias RSS', count: mediaList.filter((m) => m.type === 'rss').length },
                  { id: 'weather_clock', label: 'Clima & Hora', count: mediaList.filter((m) => m.type === 'weather_clock').length },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setMediaPickerFilter(tab.id as any)}
                    className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                      mediaPickerFilter === tab.id
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                        mediaPickerFilter === tab.id ? 'bg-blue-800 text-white' : 'bg-slate-700 text-slate-400'
                      }`}
                    >
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>

              <div className="relative min-w-[200px] max-w-xs flex-1">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  value={mediaPickerSearch}
                  onChange={(e) => setMediaPickerSearch(e.target.value)}
                  placeholder="Buscar por nome..."
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Grid of Media */}
            <div className="flex-1 overflow-y-auto py-4 pr-1">
              {filteredPickerMedia.length === 0 ? (
                <div className="py-12 text-center">
                  <Film className="h-10 w-10 text-slate-600 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-300">Nenhuma mídia encontrada</p>
                  <button
                    type="button"
                    onClick={() => {
                      resetMediaModalState(editingPlaylist?.id);
                      setMediaModalOpen(true);
                    }}
                    className="mt-4 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs inline-flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Plus className="h-4 w-4" /> Cadastrar Mídia Agora
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {filteredPickerMedia.map((m) => {
                    const timesInPlaylist = playlistForm.items.filter((it) => it.media_id === m.id).length;
                    return (
                      <div
                        key={m.id}
                        onClick={() => handleSelectMediaForPlaylist(m)}
                        className="group relative rounded-xl border border-slate-700/80 bg-slate-800/80 hover:bg-slate-800 hover:border-blue-500 hover:shadow-lg transition cursor-pointer overflow-hidden flex flex-col justify-between"
                      >
                        {/* Media Visual Preview */}
                        <div className="relative aspect-video w-full bg-slate-950 overflow-hidden flex items-center justify-center">
                          <MediaThumbnail
                            media={m}
                            showBadge={true}
                            showDuration={true}
                            showPreviewButton={true}
                            allowHoverPlay={true}
                            onPreview={(item) => setPreviewModalMedia(item)}
                          />

                          {/* Badge se já está na playlist */}
                          {timesInPlaylist > 0 && (
                            <span className="absolute bottom-2 left-2 rounded-md bg-emerald-600/90 border border-emerald-500 text-[10px] font-bold text-white px-2 py-0.5 flex items-center gap-1 shadow-md z-10">
                              <Check className="h-3 w-3" /> Na Playlist ({timesInPlaylist}x)
                            </span>
                          )}
                        </div>

                        {/* Body & Actions */}
                        <div className="p-3">
                          <h4 className="font-bold text-white text-xs truncate group-hover:text-blue-300 transition" title={m.name}>
                            {m.name}
                          </h4>
                          <div className="mt-2 flex items-center justify-between pt-2 border-t border-slate-700/60 text-[11px] text-slate-400">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPreviewModalMedia(m);
                              }}
                              className="flex items-center gap-1 text-slate-300 hover:text-blue-400 font-semibold transition cursor-pointer"
                              title="Pré-visualizar em tela cheia com som"
                            >
                              <Eye className="h-3.5 w-3.5 text-blue-400" />
                              <span>Prévia</span>
                            </button>

                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelectMediaForPlaylistAndRestart(m);
                                }}
                                className="px-2 py-1 rounded-md bg-indigo-600/80 hover:bg-indigo-600 text-indigo-100 hover:text-white font-bold text-[11px] flex items-center gap-1 transition shadow-xs cursor-pointer"
                                title="Adiciona esta mídia à playlist e reinicia o player imediatamente"
                              >
                                <RefreshCw className="h-3 w-3" />
                                <span>+ Reiniciar</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSelectMediaForPlaylist(m)}
                                className="px-2.5 py-1 rounded-md bg-blue-600 hover:bg-blue-500 text-white font-bold text-[11px] flex items-center gap-1 transition shadow-xs cursor-pointer"
                              >
                                <Plus className="h-3 w-3" /> Escolher
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 shrink-0">
              <span>Total de {filteredPickerMedia.length} mídia(s) disponíveis</span>
              <button
                type="button"
                onClick={() => setMediaPickerModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 font-semibold cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL MÍDIA */}
      {mediaModalOpen && (
        <div className="fixed inset-0 z-80 flex items-end sm:items-center justify-center bg-black/80 p-0 sm:p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-t-2xl sm:rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl text-slate-100 max-h-[92vh] sm:max-h-[88vh] flex flex-col animate-in slide-in-from-bottom sm:slide-in-from-bottom-0">
            {/* Mobile Drag Indicator */}
            <div className="sm:hidden w-12 h-1.5 bg-slate-700 rounded-full mx-auto my-2.5 shrink-0" />

            <div className="shrink-0 px-5 py-3 sm:py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-600/20 text-blue-400 shrink-0">
                  <UploadCloud className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white leading-tight">Cadastrar Mídia</h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMediaModalOpen(false)}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMedia} className="flex flex-col flex-1 min-h-0">
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
                {/* SELETOR DE ORIGEM DA MÍDIA */}
                <div>
                  <label className="block font-semibold text-slate-300 mb-1.5 text-xs">Origem da Mídia</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setMediaSourceType('device');
                        if (selectedDeviceFile) {
                          setMediaForm((prev) => ({
                            ...prev,
                            type: selectedDeviceFile.isVideo ? 'video' : 'image',
                          }));
                        }
                      }}
                      className={`min-h-[42px] flex items-center justify-center gap-1.5 p-2 rounded-lg text-xs font-bold transition cursor-pointer border ${
                        mediaSourceType === 'device'
                          ? 'bg-blue-600 border-blue-500 text-white shadow-sm'
                          : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <HardDrive className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">Dispositivo</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setMediaSourceType('url');
                        if (mediaForm.file_url === 'widget:weather_clock') {
                          setMediaForm((prev) => ({ ...prev, file_url: '' }));
                        }
                      }}
                      className={`min-h-[42px] flex items-center justify-center gap-1.5 p-2 rounded-lg text-xs font-bold transition cursor-pointer border ${
                        mediaSourceType === 'url'
                          ? 'bg-blue-600 border-blue-500 text-white shadow-sm'
                          : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">URL / Link</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setMediaSourceType('rss');
                        setMediaForm((prev) => ({
                          ...prev,
                          type: 'rss',
                          file_url:
                            prev.file_url === 'widget:weather_clock' || !prev.file_url
                              ? 'https://g1.globo.com/rss/g1/brasil/'
                              : prev.file_url,
                          name: prev.name || 'Notícias G1 Brasil',
                          duration: prev.duration || 15,
                        }));
                      }}
                      className={`min-h-[42px] flex items-center justify-center gap-1.5 p-2 rounded-lg text-xs font-bold transition cursor-pointer border ${
                        mediaSourceType === 'rss'
                          ? 'bg-rose-600 border-rose-500 text-white shadow-sm'
                          : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <Newspaper className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">Notícias RSS</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setMediaSourceType('weather_clock');
                        setMediaForm((prev) => ({
                          ...prev,
                          type: 'weather_clock',
                          file_url: 'widget:weather_clock',
                          name: prev.name || 'Hora Certa & Previsão do Tempo',
                          duration: prev.duration || 12,
                        }));
                      }}
                      className={`min-h-[42px] flex items-center justify-center gap-1.5 p-2 rounded-lg text-xs font-bold transition cursor-pointer border ${
                        mediaSourceType === 'weather_clock'
                          ? 'bg-blue-600 border-blue-500 text-white shadow-sm'
                          : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <CloudSun className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">Clima & Hora</span>
                    </button>
                  </div>
                </div>

                {/* 1. SELEÇÃO DO ARQUIVO DO DISPOSITIVO */}
              {mediaSourceType === 'device' && (
                <div>
                  <label className="block font-semibold text-slate-300 mb-1.5">
                    Arquivo do Computador ou Celular *
                  </label>

                  <input
                    id="company-media-file-input"
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,video/*,.mp4,.webm,.mov,.mkv,.avi,.m4v,.jpg,.jpeg,.png,.webp,.gif,.svg,.bmp,.avif"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleProcessDeviceFile(file);
                      e.target.value = '';
                    }}
                  />

                  {!selectedDeviceFile ? (
                    <label
                      htmlFor="company-media-file-input"
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDraggingFile(true);
                      }}
                      onDragLeave={() => setIsDraggingFile(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDraggingFile(false);
                        const file = e.dataTransfer.files?.[0];
                        if (file) handleProcessDeviceFile(file);
                      }}
                      className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition ${
                        isDraggingFile
                          ? 'border-blue-400 bg-blue-950/40 text-blue-200 scale-[0.99]'
                          : 'border-slate-700 bg-slate-800/50 hover:bg-slate-800 hover:border-slate-500 text-slate-400'
                      }`}
                    >
                      <div className="p-3 rounded-full bg-blue-600/10 text-blue-400 mb-2.5">
                        <FileUp className="h-6 w-6" />
                      </div>
                      <p className="text-sm font-bold text-white mb-1">
                        Clique para escolher ou arraste o arquivo aqui
                      </p>
                      <p className="text-[11px] text-slate-400 max-w-xs">
                        Suporta vídeos (MP4, WebM, MOV) e imagens (JPG, PNG, WEBP, GIF) até 200 MB
                      </p>
                      <span className="mt-3 px-3 py-1.5 rounded-lg bg-blue-600 text-white font-semibold text-xs hover:bg-blue-500 transition shadow-xs">
                        Selecionar Arquivo do Dispositivo
                      </span>
                    </label>
                  ) : (
                    <div className="rounded-xl border border-slate-700 bg-slate-800/90 p-3.5 space-y-3">
                      <div className="relative rounded-lg overflow-hidden bg-black/60 border border-slate-700 flex items-center justify-center max-h-44">
                        {selectedDeviceFile.isVideo ? (
                          <video
                            src={selectedDeviceFile.dataUrl}
                            className="w-full max-h-44 object-contain"
                            controls
                            muted
                            onLoadedMetadata={(e) => {
                              const d = Math.round((e.target as HTMLVideoElement).duration);
                              if (!isNaN(d) && d > 0) {
                                setMediaForm((prev) => ({ ...prev, duration: d }));
                              }
                            }}
                          />
                        ) : (
                          <img
                            src={selectedDeviceFile.dataUrl}
                            alt="Pré-visualização"
                            className="w-full max-h-44 object-contain"
                          />
                        )}
                        <span className="absolute top-2 left-2 rounded px-2 py-0.5 text-[9px] font-extrabold uppercase bg-slate-900/90 border border-slate-700 text-white shadow-sm">
                          {selectedDeviceFile.isVideo ? 'VÍDEO CARREGADO' : 'IMAGEM CARREGADA'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <div className="truncate pr-2">
                          <p className="font-bold text-white truncate flex items-center gap-1.5">
                            <FileText className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                            <span className="truncate">{selectedDeviceFile.name}</span>
                          </p>
                          <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
                            {selectedDeviceFile.sizeFormatted} • {selectedDeviceFile.type}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <label
                            htmlFor="company-media-file-input"
                            className="text-xs text-blue-400 hover:text-blue-300 underline font-semibold cursor-pointer"
                          >
                            Trocar
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedDeviceFile(null);
                              if (fileInputRef.current) fileInputRef.current.value = '';
                            }}
                            className="p-1 rounded-md text-slate-400 hover:text-rose-400 hover:bg-slate-700 cursor-pointer"
                            title="Remover arquivo"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {!selectedDeviceFile.isVideo && (
                        <div className="flex items-start gap-2.5 rounded-lg bg-blue-950/50 border border-blue-500/30 p-2.5 text-xs text-blue-200">
                          <Folder className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-bold text-white">Bucket de Fotos: Google Drive</p>
                            <p className="text-[11px] text-blue-300">
                              Esta foto será salva e catalogada no Google Drive da sua empresa (pasta <code className="bg-slate-900 px-1 py-0.5 rounded text-blue-200">📸 Fotos com Código Único</code>) com link permanente para as TVs.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* 2. URL EXTERNA */}
              {mediaSourceType === 'url' && (
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block font-semibold text-slate-300">URL da Mídia (Web) *</label>
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <button
                          type="button"
                          onClick={() => setMediaForm((prev) => ({ ...prev, type: 'image' }))}
                          className={`px-2 py-0.5 rounded font-bold transition cursor-pointer ${
                            mediaForm.type === 'image'
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'bg-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          Imagem
                        </button>
                        <button
                          type="button"
                          onClick={() => setMediaForm((prev) => ({ ...prev, type: 'video' }))}
                          className={`px-2 py-0.5 rounded font-bold transition cursor-pointer ${
                            mediaForm.type === 'video'
                              ? 'bg-purple-600 text-white shadow-xs'
                              : 'bg-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          Vídeo
                        </button>
                      </div>
                    </div>
                    <input
                      type="url"
                      required
                      value={mediaForm.file_url}
                      onChange={(e) => {
                        const val = e.target.value;
                        const isVid = /\.(mp4|webm|mov|ogg)($|\?)/i.test(val);
                        setMediaForm((prev) => ({
                          ...prev,
                          file_url: val,
                          type: isVid ? 'video' : prev.type || 'image',
                        }));
                      }}
                      placeholder="https://exemplo.com/imagem.jpg ou https://exemplo.com/video.mp4"
                      className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:outline-none focus:border-blue-500 text-xs"
                    />
                  </div>

                  {/* LIVE PREVIEW BOX */}
                  {mediaForm.file_url.trim().length > 8 && (
                    <div className="rounded-xl border border-slate-700 bg-slate-800/90 p-3 space-y-2">
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span className="font-semibold text-white flex items-center gap-1.5">
                          <Eye className="h-3.5 w-3.5 text-blue-400" />
                          <span>Pré-visualização da URL</span>
                        </span>
                        <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300">
                          {mediaForm.type === 'video' ? 'Vídeo Web' : 'Imagem Web'}
                        </span>
                      </div>
                      <div className="relative rounded-lg overflow-hidden bg-black/70 border border-slate-700 flex items-center justify-center max-h-44">
                        {mediaForm.type === 'video' ? (
                          <video
                            src={mediaForm.file_url}
                            controls
                            className="w-full max-h-44 object-contain"
                            onLoadedMetadata={(e) => {
                              const d = Math.round((e.target as HTMLVideoElement).duration);
                              if (!isNaN(d) && d > 0 && (!mediaForm.duration || mediaForm.duration === 10)) {
                                setMediaForm((prev) => ({ ...prev, duration: d }));
                              }
                            }}
                          />
                        ) : (
                          <img
                            src={mediaForm.file_url}
                            alt="Pré-visualização"
                            referrerPolicy="no-referrer"
                            className="w-full max-h-44 object-contain"
                          />
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 3. NOTÍCIAS RSS EM TELA INTEIRA */}
              {mediaSourceType === 'rss' && (
                <div className="space-y-3">
                  {rssList.length > 0 && (
                    <div>
                      <label className="block font-semibold text-slate-300 mb-1.5">
                        Feeds cadastrados:
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {rssList.map((r) => (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => {
                              setMediaForm((prev) => ({
                                ...prev,
                                name: prev.name || `Notícias - ${r.name}`,
                                file_url: r.url,
                                type: 'rss',
                                duration: prev.duration || 15,
                              }));
                            }}
                            className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
                              mediaForm.file_url === r.url
                                ? 'bg-rose-600 border-rose-500 text-white font-bold shadow-sm'
                                : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white'
                            }`}
                          >
                            <Rss className="h-3 w-3 text-rose-400" />
                            <span>{r.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">URL do Feed RSS *</label>
                    <input
                      type="url"
                      required
                      value={mediaForm.file_url}
                      onChange={(e) => setMediaForm({ ...mediaForm, file_url: e.target.value })}
                      placeholder="https://g1.globo.com/rss/g1/brasil/"
                      className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:outline-none focus:border-rose-500"
                    />
                  </div>
                </div>
              )}

              {/* 4. WIDGET CLIMA & HORA */}
              {mediaSourceType === 'weather_clock' && (
                <div className="rounded-lg border border-blue-500/30 bg-blue-950/20 p-3 text-xs text-blue-200 flex items-center gap-2 font-bold">
                  <CloudSun className="h-4 w-4 text-blue-400" />
                  <span>Clima & Hora Certa</span>
                </div>
              )}

              {/* TÍTULO / NOME DA MÍDIA */}
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Título / Nome da Mídia *</label>
                <input
                  type="text"
                  required
                  value={mediaForm.name}
                  onChange={(e) => setMediaForm({ ...mediaForm, name: e.target.value })}
                  placeholder="Ex: Notícias Saúde G1, Banner Promoção..."
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* TIPO E TEMPO */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Tipo de Mídia *</label>
                  <select
                    value={mediaForm.type}
                    onChange={(e) => {
                      const newType = e.target.value as any;
                      setMediaForm({
                        ...mediaForm,
                        type: newType,
                        file_url:
                          newType === 'weather_clock'
                            ? 'widget:weather_clock'
                            : mediaForm.file_url === 'widget:weather_clock'
                            ? ''
                            : mediaForm.file_url,
                        duration: newType === 'weather_clock' ? 12 : newType === 'rss' ? 15 : mediaForm.duration,
                      });
                      if (newType === 'weather_clock') setMediaSourceType('weather_clock');
                      if (newType === 'rss') setMediaSourceType('rss');
                    }}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="image">Imagem (JPG, PNG, WEBP)</option>
                    <option value="video">Vídeo (MP4, WebM)</option>
                    <option value="rss">Notícias RSS (Tela Inteira)</option>
                    <option value="weather_clock">Clima & Hora Certa</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Tempo na Tela (seg) *</label>
                  <input
                    type="number"
                    min={2}
                    max={600}
                    required
                    value={mediaForm.duration}
                    onChange={(e) => {
                      const v = e.target.value;
                      setMediaForm({ ...mediaForm, duration: v === '' ? '' : Number(v) });
                    }}
                    placeholder="Ex: 15"
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Exemplos Rápidos para Teste */}
              <div className="rounded-lg bg-slate-800/60 p-2.5 border border-slate-800 text-[11px]">
                <p className="text-slate-400 font-medium mb-1.5">Modelos Rápidos para Teste:</p>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      addPresetMedia(
                        'Notícias G1 Saúde',
                        'rss',
                        'https://g1.globo.com/rss/g1/saude/',
                        15
                      )
                    }
                    className="bg-rose-600/90 hover:bg-rose-600 text-white font-medium px-2 py-1 rounded transition cursor-pointer flex items-center gap-1"
                  >
                    <Newspaper className="h-3 w-3" />
                    + RSS G1 Saúde (15s)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      addPresetMedia(
                        'Notícias G1 Brasil',
                        'rss',
                        'https://g1.globo.com/rss/g1/brasil/',
                        15
                      )
                    }
                    className="bg-rose-600/90 hover:bg-rose-600 text-white font-medium px-2 py-1 rounded transition cursor-pointer flex items-center gap-1"
                  >
                    <Newspaper className="h-3 w-3" />
                    + RSS G1 Brasil (15s)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      addPresetMedia(
                        'Hora Certa & Previsão do Tempo',
                        'weather_clock',
                        'widget:weather_clock',
                        12
                      )
                    }
                    className="bg-blue-600/80 hover:bg-blue-600 text-white font-medium px-2 py-1 rounded transition cursor-pointer flex items-center gap-1"
                  >
                    <CloudSun className="h-3 w-3" />
                    + Clima & Hora Certa
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      addPresetMedia(
                        'Medicamentos com Desconto',
                        'image',
                        'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=1200&q=80',
                        12
                      )
                    }
                    className="bg-slate-700 px-2 py-1 rounded text-slate-200 hover:bg-slate-600 transition cursor-pointer"
                  >
                    + Banner Farmácia
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      addPresetMedia(
                        'Dicas de Hidratação',
                        'image',
                        'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?auto=format&fit=crop&w=1200&q=80',
                        10
                      )
                    }
                    className="bg-slate-700 px-2 py-1 rounded text-slate-200 hover:bg-slate-600 transition cursor-pointer"
                  >
                    + Banner Saúde
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      addPresetMedia(
                        'Vídeo Institucional',
                        'video',
                        'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
                        15
                      )
                    }
                    className="bg-slate-700 px-2 py-1 rounded text-slate-200 hover:bg-slate-600 transition cursor-pointer"
                  >
                    + Vídeo Exemplo
                  </button>
                </div>
              </div>
              {/* VÍNCULO DIRETO A UMA PLAYLIST OU A TODAS AS PLAYLISTS */}
              <div className="rounded-xl border border-indigo-500/40 bg-indigo-950/20 p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-indigo-300 text-xs flex items-center gap-1.5">
                    <Film className="h-3.5 w-3.5 text-indigo-400" />
                    <span>Vincular às Playlists da Empresa:</span>
                  </label>
                  {(uploadToAllPlaylists || targetPlaylistIdForNewMedia === '__ALL_PLAYLISTS__') ? (
                    <span className="text-[10px] bg-amber-500/30 text-amber-200 border border-amber-500/40 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                      <Layers className="h-2.5 w-2.5 text-amber-400" />
                      Todas as {playlists.length} playlists
                    </span>
                  ) : targetPlaylistIdForNewMedia ? (
                    <span className="text-[10px] bg-indigo-600/50 text-indigo-200 px-2 py-0.5 rounded-full font-bold">
                      Auto-inclusão ativa
                    </span>
                  ) : null}
                </div>

                {/* Opção Destacada: Carregar para Todas as Playlists */}
                <div
                  onClick={() => {
                    const newVal = !uploadToAllPlaylists;
                    setUploadToAllPlaylists(newVal);
                    if (newVal) {
                      setTargetPlaylistIdForNewMedia('__ALL_PLAYLISTS__');
                    } else if (targetPlaylistIdForNewMedia === '__ALL_PLAYLISTS__') {
                      setTargetPlaylistIdForNewMedia('');
                    }
                  }}
                  className={`p-3 rounded-xl border transition cursor-pointer flex items-start gap-3 ${
                    uploadToAllPlaylists || targetPlaylistIdForNewMedia === '__ALL_PLAYLISTS__'
                      ? 'bg-amber-950/40 border-amber-500/70 text-amber-100 ring-1 ring-amber-500/30'
                      : 'bg-slate-800/80 border-slate-700 hover:border-slate-600 text-slate-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    id="chk-upload-to-all-playlists"
                    checked={uploadToAllPlaylists || targetPlaylistIdForNewMedia === '__ALL_PLAYLISTS__'}
                    onChange={(e) => {
                      setUploadToAllPlaylists(e.target.checked);
                      if (e.target.checked) {
                        setTargetPlaylistIdForNewMedia('__ALL_PLAYLISTS__');
                      } else if (targetPlaylistIdForNewMedia === '__ALL_PLAYLISTS__') {
                        setTargetPlaylistIdForNewMedia('');
                      }
                    }}
                    className="mt-0.5 h-4 w-4 rounded border-slate-600 text-amber-500 focus:ring-amber-400 cursor-pointer"
                  />
                  <div className="flex-1">
                    <label
                      htmlFor="chk-upload-to-all-playlists"
                      className="font-bold text-xs text-white flex items-center gap-1.5 cursor-pointer"
                    >
                      <Layers className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                      <span>Carregar para todas as playlists de uma só vez</span>
                    </label>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Adiciona esta nova mídia automaticamente a todas as <strong>{playlists.length}</strong> playlists cadastradas na sua empresa.
                    </p>
                  </div>
                </div>

                {/* Se não marcou todas, pode selecionar uma playlist específica */}
                {!(uploadToAllPlaylists || targetPlaylistIdForNewMedia === '__ALL_PLAYLISTS__') && (
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Ou selecione uma playlist específica:
                    </label>
                    <select
                      value={targetPlaylistIdForNewMedia}
                      onChange={(e) => {
                        const val = e.target.value;
                        setTargetPlaylistIdForNewMedia(val);
                        if (val === '__ALL_PLAYLISTS__') {
                          setUploadToAllPlaylists(true);
                        } else {
                          setUploadToAllPlaylists(false);
                        }
                      }}
                      className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:outline-none focus:border-indigo-500 text-xs"
                    >
                      <option value="">Não vincular agora (salvar apenas na biblioteca de mídias)</option>
                      <option value="__ALL_PLAYLISTS__">⭐ Adicionar a TODAS as playlists ({playlists.length} playlists)</option>
                      {playlists.map((pl) => (
                        <option key={pl.id} value={pl.id}>
                          {pl.name} ({pl.items?.length || 0} mídias) {pl.store_name ? `• ${pl.store_name}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              </div>

              {/* Sticky Footer */}
              <div className="shrink-0 p-4 border-t border-slate-800 bg-slate-900/95 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-xs text-slate-400">
                  <span>Cota: </span>
                  <strong className={mediaList.length >= effectiveMaxMedia ? 'text-rose-400 font-bold' : 'text-slate-200 font-semibold'}>
                    {mediaList.length} / {effectiveMaxMedia} mídias
                  </strong>
                  {mediaList.length >= effectiveMaxMedia && (
                    <span className="text-rose-400 ml-1.5 font-semibold text-[11px]">(Limite atingido)</span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    disabled={isUploadingMedia}
                    onClick={() => setMediaModalOpen(false)}
                    className="flex-1 sm:flex-initial min-h-[44px] px-4 py-2.5 rounded-lg border border-slate-700 bg-slate-800 text-xs font-semibold text-slate-300 hover:bg-slate-700 cursor-pointer disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={
                      isUploadingMedia ||
                      mediaList.length >= effectiveMaxMedia ||
                      (mediaSourceType === 'device' && !selectedDeviceFile && !mediaForm.file_url) ||
                      (mediaSourceType === 'url' && (!mediaForm.file_url.trim() || !mediaForm.name.trim())) ||
                      (mediaSourceType === 'rss' && !mediaForm.file_url.trim())
                    }
                    onClick={(e) => handleSaveMedia(e, true)}
                    className="flex-1 sm:flex-initial min-h-[44px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                    title="Faz o upload da mídia, salva na playlist e envia o comando para as telas reiniciarem imediatamente"
                  >
                    {isUploadingMedia ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        <span>Enviando... {uploadProgress > 0 ? `${uploadProgress}%` : ''}</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-3.5 w-3.5" />
                        <span>
                          {uploadToAllPlaylists || targetPlaylistIdForNewMedia === '__ALL_PLAYLISTS__'
                            ? 'Salvar em Todas as Playlists e Reiniciar'
                            : targetPlaylistIdForNewMedia
                            ? 'Salvar, Incluir na Playlist e Reiniciar'
                            : 'Salvar e Reiniciar Telas'}
                        </span>
                      </>
                    )}
                  </button>
                  <button
                    type="submit"
                    disabled={
                      isUploadingMedia ||
                      mediaList.length >= effectiveMaxMedia ||
                      (mediaSourceType === 'device' && !selectedDeviceFile && !mediaForm.file_url) ||
                      (mediaSourceType === 'url' && (!mediaForm.file_url.trim() || !mediaForm.name.trim())) ||
                      (mediaSourceType === 'rss' && !mediaForm.file_url.trim())
                    }
                    className="flex-1 sm:flex-initial min-h-[44px] flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 text-xs font-semibold text-white hover:bg-blue-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                  >
                    {isUploadingMedia ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        <span>Enviando... {uploadProgress > 0 ? `${uploadProgress}%` : ''}</span>
                      </>
                    ) : (
                      <>
                        <UploadCloud className="h-3.5 w-3.5" />
                        <span>Salvar Apenas</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL RSS */}
      {rssModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 p-0 sm:p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl text-slate-100 flex flex-col max-h-[90vh] sm:max-h-[85vh] animate-in slide-in-from-bottom sm:slide-in-from-bottom-0">
            {/* Mobile Drag Indicator */}
            <div className="sm:hidden w-12 h-1.5 bg-slate-700 rounded-full mx-auto my-2.5 shrink-0" />

            {/* Header */}
            <div className="shrink-0 px-5 py-3 sm:py-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-bold text-white">
                {editingRss ? 'Editar Feed RSS' : 'Novo Feed RSS'}
              </h3>
              <button
                type="button"
                onClick={() => setRssModalOpen(false)}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRss} className="flex flex-col flex-1 min-h-0">
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 text-xs">
                {!editingRss && (
                  <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3 space-y-2">
                    <div className="flex items-center gap-1.5 text-amber-400 font-bold text-[11px]">
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>Canais Prontos (Clique para preencher)</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {RSS_PRESETS.map((p) => (
                        <button
                          key={p.url}
                          type="button"
                          onClick={() => setRssForm({ name: p.name, url: p.url })}
                          className={`min-h-[30px] px-2 py-1 rounded text-[10px] font-semibold border transition cursor-pointer flex items-center gap-1 ${
                            rssForm.url === p.url
                              ? 'bg-blue-600/30 border-blue-500 text-blue-300 font-bold'
                              : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white'
                          }`}
                        >
                          <span>{p.name.split(' - ')[1] || p.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Nome do Canal *</label>
                  <input
                    type="text"
                    required
                    value={rssForm.name}
                    onChange={(e) => setRssForm({ ...rssForm, name: e.target.value })}
                    placeholder="Ex: G1 Brasil"
                    className="w-full min-h-[44px] rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">URL do Link RSS (XML) *</label>
                  <input
                    type="url"
                    required
                    value={rssForm.url}
                    onChange={(e) => setRssForm({ ...rssForm, url: e.target.value })}
                    placeholder="https://..."
                    className="w-full min-h-[44px] rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Sticky Footer */}
              <div className="shrink-0 p-4 border-t border-slate-800 bg-slate-900/95 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setRssModalOpen(false)}
                  className="flex-1 sm:flex-initial min-h-[44px] px-4 py-2.5 rounded-lg border border-slate-700 bg-slate-800 text-xs font-semibold text-slate-300 hover:bg-slate-700 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 sm:flex-initial min-h-[44px] px-5 py-2.5 rounded-lg bg-blue-600 text-xs font-semibold text-white hover:bg-blue-500 cursor-pointer shadow-sm"
                >
                  Salvar RSS
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL RESET SENHA (PLAYER OU OPERADOR) */}
      {resetPasswordData.isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 p-0 sm:p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-t-2xl sm:rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-2xl text-slate-100 animate-in slide-in-from-bottom sm:slide-in-from-bottom-0">
            {/* Mobile Drag Indicator */}
            <div className="sm:hidden w-12 h-1.5 bg-slate-700 rounded-full mx-auto mb-3 shrink-0" />

            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white">{resetPasswordData.title}</h3>
              <button
                type="button"
                onClick={() => setResetPasswordData((p) => ({ ...p, isOpen: false }))}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handlePerformPasswordReset} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Nova Senha</label>
                <input
                  type="password"
                  value={newPasswordInput}
                  onChange={(e) => setNewPasswordInput(e.target.value)}
                  placeholder="Deixe em branco para o padrão: 123456"
                  className="w-full min-h-[44px] rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setResetPasswordData((p) => ({ ...p, isOpen: false }))}
                  className="flex-1 sm:flex-initial min-h-[44px] px-4 py-2.5 rounded-lg border border-slate-700 bg-slate-800 text-xs font-semibold text-slate-300 hover:bg-slate-700 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 sm:flex-initial min-h-[44px] px-5 py-2.5 rounded-lg bg-blue-600 text-xs font-semibold text-white hover:bg-blue-500 cursor-pointer"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL LINK ÚNICO DO PLAYER */}
      {playerDirectLinkModal.isOpen && playerDirectLinkModal.player && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 p-0 sm:p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-t-2xl sm:rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl text-slate-100 flex flex-col max-h-[92vh] sm:max-h-[85vh] animate-in slide-in-from-bottom sm:slide-in-from-bottom-0">
            {/* Mobile Drag Indicator */}
            <div className="sm:hidden w-12 h-1.5 bg-slate-700 rounded-full mx-auto my-2.5 shrink-0" />

            {/* Header */}
            <div className="shrink-0 px-5 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="rounded-lg bg-blue-950 p-2 border border-blue-800/80 text-blue-400">
                  <Link2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Link Único de Auto-Início</h3>
                  <p className="text-xs text-slate-400">
                    {playerDirectLinkModal.player.name} &bull; Código{' '}
                    <span className="font-mono text-blue-400 font-bold">{playerDirectLinkModal.player.code}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPlayerDirectLinkModal({ isOpen: false, player: null })}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
              {/* Link Input & Copy */}
              <div className="space-y-1.5">
                <label className="block font-semibold text-slate-300">URL Direta do Player</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={getPlayerDirectUrl(playerDirectLinkModal.player)}
                    className="flex-1 min-h-[44px] rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-blue-300 focus:outline-none select-all"
                  />
                  <button
                    type="button"
                    onClick={() => handleCopyPlayerLink(playerDirectLinkModal.player!)}
                    className={`min-h-[44px] px-4 rounded-lg font-bold text-xs flex items-center gap-1.5 transition shadow-sm cursor-pointer shrink-0 ${
                      copiedPlayerId === playerDirectLinkModal.player.id
                        ? 'bg-emerald-600 text-white'
                        : 'bg-blue-600 hover:bg-blue-500 text-white'
                    }`}
                  >
                    {copiedPlayerId === playerDirectLinkModal.player.id ? (
                      <>
                        <Check className="h-4 w-4" />
                        <span>Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        <span>Copiar Link</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Security & Token reset */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3.5 flex items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-semibold text-slate-300 block">Token de Acesso</span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {playerDirectLinkModal.player.access_token || 'Ativo'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRegenerateToken(playerDirectLinkModal.player!)}
                  className="min-h-[36px] px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer shrink-0"
                >
                  Regenerar Token
                </button>
              </div>
            </div>

            {/* Sticky Footer */}
            <div className="shrink-0 p-4 border-t border-slate-800 bg-slate-900/95 flex flex-col sm:flex-row sm:items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setPlayerDirectLinkModal({ isOpen: false, player: null })}
                className="w-full sm:w-auto min-h-[44px] px-4 py-2.5 rounded-lg border border-slate-700 bg-slate-800 text-xs font-semibold text-slate-300 hover:bg-slate-700 cursor-pointer text-center"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={() => window.open(getPlayerDirectUrl(playerDirectLinkModal.player!), '_blank')}
                className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white cursor-pointer shadow-sm flex items-center justify-center gap-1.5 text-center"
              >
                <ExternalLink className="h-4 w-4" />
                <span>Testar Reprodutor em Nova Aba</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL SELETOR RÁPIDO DE NOTÍCIAS RSS PARA A PLAYLIST */}
      {rssQuickPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 p-0 sm:p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-t-2xl sm:rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl text-slate-100 flex flex-col max-h-[90vh] sm:max-h-[85vh] animate-in slide-in-from-bottom sm:slide-in-from-bottom-0">
            {/* Header */}
            <div className="shrink-0 px-5 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/30">
                  <Newspaper className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Escolher Notícias RSS</h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRssQuickPickerOpen(false)}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 overflow-y-auto space-y-3 text-xs">
              <p className="text-slate-300 font-semibold">Canais de Notícias Recomendados:</p>
              <div className="space-y-2">
                {RSS_PRESETS.map((preset) => (
                  <div
                    key={preset.url}
                    className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-700/80 bg-slate-800/80 hover:bg-slate-800 transition"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h5 className="font-bold text-white truncate">{preset.name}</h5>
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded uppercase tracking-wider bg-slate-900 text-rose-300 border border-rose-900/60 shrink-0">
                          {preset.category}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleQuickAddRssToPlaylist(preset.url, preset.name)}
                      className="min-h-[36px] px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 shrink-0 transition cursor-pointer shadow-sm"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Inserir</span>
                    </button>
                  </div>
                ))}
              </div>

              {/* Se a empresa tiver canais personalizados cadastrados */}
              {rssList.filter((r) => !RSS_PRESETS.some((p) => p.url === r.url)).length > 0 && (
                <div className="pt-2 border-t border-slate-800 space-y-2">
                  <p className="text-slate-300 font-semibold">Seus Canais RSS Personalizados:</p>
                  {rssList
                    .filter((r) => !RSS_PRESETS.some((p) => p.url === r.url))
                    .map((custom) => (
                      <div
                        key={custom.id}
                        className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-700/80 bg-slate-800/80 hover:bg-slate-800 transition"
                      >
                        <div className="min-w-0">
                          <h5 className="font-bold text-white truncate">{custom.name}</h5>
                          <p className="font-mono text-[10px] text-slate-400 truncate mt-0.5">{custom.url}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleQuickAddRssToPlaylist(custom.url, custom.name)}
                          className="min-h-[36px] px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 shrink-0 transition cursor-pointer shadow-sm"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          <span>Inserir</span>
                        </button>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="shrink-0 p-4 border-t border-slate-800 bg-slate-900/95 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setRssQuickPickerOpen(false)}
                className="min-h-[40px] px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-xs font-semibold text-slate-300 hover:bg-slate-700 cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL SELETOR DE PLAYLIST DE DESTINO (DISPARADO PELA ABA RSS) */}
      {playlistTargetModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 p-0 sm:p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl text-slate-100 flex flex-col max-h-[90vh] sm:max-h-[85vh] animate-in slide-in-from-bottom sm:slide-in-from-bottom-0">
            <div className="shrink-0 px-5 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/30">
                  <ListPlus className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Adicionar à Playlist</h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPlaylistTargetModal({ isOpen: false, type: 'rss' })}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="p-3 rounded-lg bg-slate-800/80 border border-slate-700/80">
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block mb-1">
                  Conteúdo Selecionado
                </span>
                <p className="text-white font-bold text-sm">
                  {playlistTargetModal.rssData?.name || 'Canal RSS'}
                </p>
                <p className="font-mono text-[10px] text-slate-400 truncate mt-0.5">
                  {playlistTargetModal.rssData?.url}
                </p>
              </div>

              <div className="space-y-2">
                <label className="font-semibold text-slate-300 block">Selecione a Playlist de destino:</label>
                {playlists.map((pl) => (
                  <button
                    key={pl.id}
                    type="button"
                    onClick={() => {
                      if (playlistTargetModal.rssData) {
                        handleSendRssToPlaylist(
                          playlistTargetModal.rssData.url,
                          playlistTargetModal.rssData.name,
                          pl.id
                        );
                      }
                    }}
                    className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-800 hover:border-blue-500 transition text-left cursor-pointer group"
                  >
                    <div>
                      <h4 className="font-bold text-white text-xs group-hover:text-blue-300">{pl.name}</h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">{pl.items?.length || 0} itens na grade</p>
                    </div>
                    <span className="text-xs font-bold text-blue-400 group-hover:translate-x-0.5 transition flex items-center gap-1">
                      <span>Inserir</span>
                      <Plus className="h-3.5 w-3.5" />
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="shrink-0 p-4 border-t border-slate-800 bg-slate-900/95 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setPlaylistTargetModal({ isOpen: false, type: 'rss' })}
                className="min-h-[40px] px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-xs font-semibold text-slate-300 hover:bg-slate-700 cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE PRÉ-VISUALIZAÇÃO COMPLETA DE MÍDIA (IMAGENS / VÍDEOS / CLIMA / RSS) */}
      <MediaPreviewModal
        media={previewModalMedia}
        onClose={() => setPreviewModalMedia(null)}
        onAddToPlaylist={mediaPickerModalOpen ? (m) => handleSelectMediaForPlaylist(m) : undefined}
        isAlreadyInPlaylist={
          previewModalMedia
            ? playlistForm.items.some((it) => it.media_id === previewModalMedia.id)
            : false
        }
      />

      {/* MODAL DE CADASTRO / EDIÇÃO DE LOJA DA REDE */}
      {storeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 p-0 sm:p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-t-2xl sm:rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl text-slate-100 flex flex-col max-h-[92vh] sm:max-h-[85vh] animate-in slide-in-from-bottom sm:slide-in-from-bottom-0">
            <div className="sm:hidden w-12 h-1.5 bg-slate-700 rounded-full mx-auto my-2.5 shrink-0" />
            <div className="shrink-0 px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Store className="h-5 w-5 text-indigo-400" />
                <h3 className="text-base font-bold text-white">
                  {editingStore ? 'Editar Loja / Unidade' : 'Nova Loja / Unidade da Rede'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setStoreModalOpen(false)}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStore} className="flex flex-col flex-1 min-h-0">
              <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Nome da Loja / Filial *</label>
                  <input
                    type="text"
                    required
                    value={storeForm.name}
                    onChange={(e) => setStoreForm({ ...storeForm, name: e.target.value })}
                    placeholder="Ex: Vale Lar Jacareí, Vale Tudo São José..."
                    className="w-full min-h-[44px] rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">Bandeira / Submarca</label>
                    <input
                      type="text"
                      value={storeForm.brand_name}
                      onChange={(e) => setStoreForm({ ...storeForm, brand_name: e.target.value })}
                      placeholder="Ex: Vale Lar, Vale Tudo"
                      className="w-full min-h-[44px] rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">Código da Filial</label>
                    <input
                      type="text"
                      value={storeForm.code}
                      onChange={(e) => setStoreForm({ ...storeForm, code: e.target.value.toUpperCase() })}
                      placeholder="Ex: LOJA-01"
                      className="w-full min-h-[44px] rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 font-mono uppercase text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block font-semibold text-slate-300 mb-1">Cidade *</label>
                    <input
                      type="text"
                      required
                      value={storeForm.city}
                      onChange={(e) => setStoreForm({ ...storeForm, city: e.target.value })}
                      placeholder="Ex: Jacareí, São José dos Campos"
                      className="w-full min-h-[44px] rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">UF *</label>
                    <input
                      type="text"
                      required
                      maxLength={2}
                      value={storeForm.state}
                      onChange={(e) => setStoreForm({ ...storeForm, state: e.target.value.toUpperCase() })}
                      placeholder="SP"
                      className="w-full min-h-[44px] rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 uppercase text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Endereço / Localização</label>
                  <input
                    type="text"
                    value={storeForm.address}
                    onChange={(e) => setStoreForm({ ...storeForm, address: e.target.value })}
                    placeholder="Ex: Av. Principal, 500 - Centro"
                    className="w-full min-h-[44px] rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">Gerente / Responsável</label>
                    <input
                      type="text"
                      value={storeForm.responsible}
                      onChange={(e) => setStoreForm({ ...storeForm, responsible: e.target.value })}
                      placeholder="Nome do gerente"
                      className="w-full min-h-[44px] rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">Telefone da Loja</label>
                    <input
                      type="text"
                      value={storeForm.phone}
                      onChange={(e) => setStoreForm({ ...storeForm, phone: e.target.value })}
                      placeholder="(12) 3955-0000"
                      className="w-full min-h-[44px] rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              <div className="shrink-0 p-4 border-t border-slate-800 bg-slate-900/95 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setStoreModalOpen(false)}
                  className="flex-1 sm:flex-initial min-h-[44px] px-4 py-2.5 rounded-lg border border-slate-700 bg-slate-800 text-xs font-semibold text-slate-300 hover:bg-slate-700 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 sm:flex-initial min-h-[44px] px-5 py-2.5 rounded-lg bg-indigo-600 text-xs font-semibold text-white hover:bg-indigo-500 cursor-pointer shadow-sm"
                >
                  Salvar Loja
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE DIAGNÓSTICO & HEARTBEAT DOS PLAYERS */}
      {diagnosticModalPlayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-2 sm:p-5 backdrop-blur-xs overflow-y-auto overflow-x-hidden">
          <div className="w-full max-w-3xl max-w-[calc(100vw-1rem)] max-h-[92vh] overflow-y-auto overflow-x-hidden">
            <PlayerDiagnosticView
              player={diagnosticModalPlayer}
              allPlayers={players as DiagnosticPlayerData[]}
              onSelectPlayer={(id) => {
                const found = players.find((p) => p.id === id);
                if (found) setDiagnosticModalPlayer(found as DiagnosticPlayerData);
              }}
              onRefresh={async () => {
                try {
                  const freshPlayers = await api.getCompanyPlayers();
                  if (Array.isArray(freshPlayers)) {
                    setPlayers(freshPlayers);
                    const updated = freshPlayers.find((p) => p.id === diagnosticModalPlayer.id || p.code === diagnosticModalPlayer.code);
                    if (updated) setDiagnosticModalPlayer(updated as DiagnosticPlayerData);
                  }
                } catch {}
              }}
              onOpenSimulation={onOpenPlayerSimulation}
              showToast={showToast}
              onClose={() => setDiagnosticModalPlayer(null)}
            />
          </div>
        </div>
      )}

      {/* MODAL DE CARREGAR MÍDIA PARA TODAS AS PLAYLISTS */}
      {addToAllPlaylistsModalMedia && (
        <div className="fixed inset-0 z-80 flex items-end sm:items-center justify-center bg-black/85 p-0 sm:p-4 backdrop-blur-xs overflow-x-hidden">
          <div className="w-full max-w-lg max-w-[calc(100vw-1rem)] rounded-t-2xl sm:rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl text-slate-100 max-h-[92vh] sm:max-h-[88vh] flex flex-col animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 overflow-x-hidden">
            {/* Mobile Drag Indicator */}
            <div className="sm:hidden w-12 h-1.5 bg-slate-700 rounded-full mx-auto my-2.5 shrink-0" />

            <div className="shrink-0 px-5 py-3 sm:py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 shrink-0 border border-amber-500/30">
                  <Layers className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white leading-tight">
                    Carregar para Todas as Playlists
                  </h3>
                  <p className="text-xs text-slate-400">
                    Vincular mídia em todas as playlists de uma só vez
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAddToAllPlaylistsModalMedia(null)}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
              {/* Media Card Preview */}
              <div className="rounded-xl border border-slate-700/80 bg-slate-800/80 p-3.5 flex items-center gap-3">
                <div className="w-20 aspect-video rounded-lg overflow-hidden bg-black shrink-0 flex items-center justify-center border border-slate-700">
                  <MediaThumbnail media={addToAllPlaylistsModalMedia} showBadge={false} showDuration={false} />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="font-bold text-white text-sm truncate" title={addToAllPlaylistsModalMedia.name}>
                    {addToAllPlaylistsModalMedia.name}
                  </h4>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400 mt-1">
                    <span className="capitalize px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300 font-medium">
                      {addToAllPlaylistsModalMedia.type === 'weather_clock'
                        ? 'Clima & Hora'
                        : addToAllPlaylistsModalMedia.type === 'rss'
                        ? 'Notícias RSS'
                        : addToAllPlaylistsModalMedia.type === 'video'
                        ? 'Vídeo'
                        : 'Imagem'}
                    </span>
                    <span>Duração: <strong>{addToAllPlaylistsModalMedia.duration}s</strong></span>
                  </div>
                </div>
              </div>

              {/* Informative Alert */}
              <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-3 text-amber-200 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <Layers className="h-4 w-4 text-amber-400 shrink-0" />
                  <span>Será incluída em {playlists.length} playlist(s)</span>
                </p>
                <p className="text-[11px] text-amber-300/90 leading-relaxed">
                  Esta mídia será adicionada como novo item na sequência de todas as playlists cadastradas da empresa. Os reprodutores que estiverem exibindo essas playlists receberão a nova programação.
                </p>
              </div>

              {/* Parâmetros: Duração */}
              <div className="space-y-3 bg-slate-800/60 rounded-xl p-3.5 border border-slate-700/60">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    Tempo de exibição nesta inserção (segundos):
                  </label>
                  <input
                    type="number"
                    min={2}
                    max={600}
                    value={addToAllPlaylistsDuration}
                    onChange={(e) => setAddToAllPlaylistsDuration(Math.max(1, Number(e.target.value) || 10))}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:outline-none focus:border-amber-500 text-xs font-semibold"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="chk-duplicate-all-pl"
                    checked={addToAllPlaylistsDuplicate}
                    onChange={(e) => setAddToAllPlaylistsDuplicate(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-600 text-amber-500 focus:ring-amber-400 cursor-pointer"
                  />
                  <label htmlFor="chk-duplicate-all-pl" className="text-xs text-slate-300 cursor-pointer">
                    Adicionar mesmo nas playlists que já contêm esta mídia
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="chk-restart-all-pl"
                    checked={addToAllPlaylistsRestart}
                    onChange={(e) => setAddToAllPlaylistsRestart(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-600 text-indigo-500 focus:ring-indigo-400 cursor-pointer"
                  />
                  <label htmlFor="chk-restart-all-pl" className="text-xs text-slate-300 cursor-pointer font-medium">
                    Reiniciar reprodutores imediatamente para atualizar as TVs
                  </label>
                </div>
              </div>

              {/* Lista de Playlists Destino */}
              <div>
                <label className="block font-semibold text-slate-300 mb-1.5">
                  Playlists que receberão a mídia ({playlists.length}):
                </label>
                <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                  {playlists.map((pl) => {
                    const alreadyHas = pl.items.some((it) => it.media_id === addToAllPlaylistsModalMedia.id);
                    return (
                      <div
                        key={pl.id}
                        className="flex items-center justify-between p-2 rounded-lg bg-slate-800 border border-slate-700/70 text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Film className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                          <span className="font-semibold text-white truncate">{pl.name}</span>
                          {pl.store_name && (
                            <span className="text-[10px] text-slate-400 truncate">({pl.store_name})</span>
                          )}
                        </div>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${
                            alreadyHas
                              ? 'bg-emerald-950 border border-emerald-700 text-emerald-300'
                              : 'bg-blue-950 border border-blue-700 text-blue-300'
                          }`}
                        >
                          {alreadyHas ? 'Já incluída' : 'Receberá mídia'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Sticky Footer */}
            <div className="shrink-0 p-4 border-t border-slate-800 bg-slate-900/95 flex flex-col sm:flex-row items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={isAddingToAllPlaylists}
                onClick={() => setAddToAllPlaylistsModalMedia(null)}
                className="w-full sm:w-auto min-h-[44px] px-4 py-2.5 rounded-lg border border-slate-700 bg-slate-800 text-xs font-semibold text-slate-300 hover:bg-slate-700 cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isAddingToAllPlaylists || playlists.length === 0}
                onClick={handleConfirmAddToAllPlaylists}
                className="w-full sm:w-auto min-h-[44px] flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-xs font-bold text-white transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
              >
                {isAddingToAllPlaylists ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Carregando em todas as playlists...</span>
                  </>
                ) : (
                  <>
                    <Layers className="h-3.5 w-3.5" />
                    <span>Confirmar e Carregar em Todas ({playlists.length})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUGESTÃO 1: MODAL DE AGENDAMENTO INTELIGENTE DE ITEM DE PLAYLIST */}
      {scheduleModalItemIndex !== null && playlistForm.items[scheduleModalItemIndex] && (() => {
        const item = playlistForm.items[scheduleModalItemIndex];
        const media = mediaList.find((m) => m.id === item.media_id);
        const itemName = media?.name || (item as any).name || 'Mídia da Playlist';
        const itemType = media?.type || (item as any).type || 'image';

        const updateItemField = (field: string, val: any) => {
          const newItems = [...playlistForm.items];
          newItems[scheduleModalItemIndex] = {
            ...newItems[scheduleModalItemIndex],
            [field]: val,
          };
          setPlaylistForm({ ...playlistForm, items: newItems });
        };

        const activeDays = Array.isArray(item.schedule_days) ? item.schedule_days : [0, 1, 2, 3, 4, 5, 6];

        const toggleDay = (dayIndex: number) => {
          const current = [...activeDays];
          const exists = current.includes(dayIndex);
          const updated = exists ? current.filter((d) => d !== dayIndex) : [...current, dayIndex].sort();
          updateItemField('schedule_days', updated);
        };

        const daysLabels = [
          { idx: 0, label: 'Dom', full: 'Domingo' },
          { idx: 1, label: 'Seg', full: 'Segunda-feira' },
          { idx: 2, label: 'Ter', full: 'Terça-feira' },
          { idx: 3, label: 'Qua', full: 'Quarta-feira' },
          { idx: 4, label: 'Qui', full: 'Quinta-feira' },
          { idx: 5, label: 'Sex', full: 'Sexta-feira' },
          { idx: 6, label: 'Sáb', full: 'Sábado' },
        ];

        return (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 p-0 sm:p-4 backdrop-blur-xs">
            <div className="w-full max-w-lg rounded-t-2xl sm:rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl text-slate-100 flex flex-col max-h-[92vh] sm:max-h-[85vh] animate-in slide-in-from-bottom sm:slide-in-from-bottom-0">
              {/* Header */}
              <div className="shrink-0 px-5 py-3 sm:py-4 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <Calendar className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Agendamento Inteligente</h3>
                    <p className="text-[11px] text-slate-400 truncate max-w-[280px]">
                      {itemName} ({itemType === 'video' ? 'Vídeo' : itemType === 'rss' ? 'RSS' : 'Imagem'})
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setScheduleModalItemIndex(null)}
                  className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
                {/* Toggle Agendamento */}
                <div className="flex items-center justify-between p-3.5 rounded-xl border border-emerald-800/60 bg-emerald-950/20">
                  <div>
                    <label className="font-bold text-emerald-300 text-xs block cursor-pointer">
                      Ativar Agendamento para esta Mídia
                    </label>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Quando ativado, a TV reproduz este item apenas nos dias e horários configurados abaixo.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={item.schedule_enabled ?? false}
                    onChange={(e) => updateItemField('schedule_enabled', e.target.checked)}
                    className="rounded accent-emerald-500 h-5 w-5 cursor-pointer ml-3 shrink-0"
                  />
                </div>

                {item.schedule_enabled && (
                  <div className="space-y-4 animate-in fade-in">
                    {/* Dias da Semana */}
                    <div className="rounded-xl border border-slate-800 bg-slate-800/40 p-3.5 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <label className="font-bold text-slate-200 text-xs">
                          Dias da Semana Permitidos
                        </label>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => updateItemField('schedule_days', [0, 1, 2, 3, 4, 5, 6])}
                            className="text-[10px] text-blue-400 hover:text-blue-300 underline font-medium cursor-pointer"
                          >
                            Todos
                          </button>
                          <span className="text-slate-600">•</span>
                          <button
                            type="button"
                            onClick={() => updateItemField('schedule_days', [1, 2, 3, 4, 5])}
                            className="text-[10px] text-blue-400 hover:text-blue-300 underline font-medium cursor-pointer"
                          >
                            Seg-Sex
                          </button>
                          <span className="text-slate-600">•</span>
                          <button
                            type="button"
                            onClick={() => updateItemField('schedule_days', [0, 6])}
                            className="text-[10px] text-blue-400 hover:text-blue-300 underline font-medium cursor-pointer"
                          >
                            Fim de Semana
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-7 gap-1.5 pt-1">
                        {daysLabels.map((d) => {
                          const isSelected = activeDays.includes(d.idx);
                          return (
                            <button
                              key={d.idx}
                              type="button"
                              onClick={() => toggleDay(d.idx)}
                              className={`py-2 px-1 rounded-lg text-xs font-bold transition text-center cursor-pointer ${
                                isSelected
                                  ? 'bg-emerald-600 text-white shadow-xs'
                                  : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
                              }`}
                              title={d.full}
                            >
                              {d.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Janela de Horário */}
                    <div className="rounded-xl border border-slate-800 bg-slate-800/40 p-3.5 space-y-2.5">
                      <label className="font-bold text-slate-200 text-xs block">
                        Janela de Horário Diária (Início e Fim)
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] text-slate-400 mb-1">Horário de Início</label>
                          <input
                            type="time"
                            value={item.schedule_start_time || ''}
                            onChange={(e) => updateItemField('schedule_start_time', e.target.value)}
                            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-400 mb-1">Horário de Término</label>
                          <input
                            type="time"
                            value={item.schedule_end_time || ''}
                            onChange={(e) => updateItemField('schedule_end_time', e.target.value)}
                            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-500">
                        Deixe em branco para permitir a exibição durante o dia inteiro nos dias selecionados.
                      </p>
                    </div>

                    {/* Período de Validade de Campanha (Datas) */}
                    <div className="rounded-xl border border-slate-800 bg-slate-800/40 p-3.5 space-y-2.5">
                      <label className="font-bold text-slate-200 text-xs block">
                        Período de Validade da Campanha (Opcional)
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] text-slate-400 mb-1">Data Inicial</label>
                          <input
                            type="date"
                            value={item.schedule_start_date || ''}
                            onChange={(e) => updateItemField('schedule_start_date', e.target.value)}
                            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-400 mb-1">Data Limite (Expira em)</label>
                          <input
                            type="date"
                            value={item.schedule_end_date || ''}
                            onChange={(e) => updateItemField('schedule_end_date', e.target.value)}
                            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-500">
                        Após a data limite, a mídia para de rodar nas TVs sem necessidade de excluí-la da grade.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="shrink-0 p-4 border-t border-slate-800 bg-slate-900/95 flex items-center justify-between gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    updateItemField('schedule_enabled', false);
                    updateItemField('schedule_days', [0, 1, 2, 3, 4, 5, 6]);
                    updateItemField('schedule_start_time', '');
                    updateItemField('schedule_end_time', '');
                    updateItemField('schedule_start_date', '');
                    updateItemField('schedule_end_date', '');
                    setScheduleModalItemIndex(null);
                  }}
                  className="px-3 py-2 rounded-lg text-slate-400 hover:text-rose-400 text-xs font-semibold cursor-pointer transition"
                >
                  Limpar Regras
                </button>
                <button
                  type="button"
                  onClick={() => setScheduleModalItemIndex(null)}
                  className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-md cursor-pointer"
                >
                  Concluir Agendamento
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL CONFIGURAÇÃO CLOUDFLARE R2 */}
      <CloudflareR2ConfigModal
        isOpen={r2ModalOpen}
        onClose={() => setR2ModalOpen(false)}
        onSaved={loadData}
      />

      {/* CONFIRMAÇÃO DE AÇÃO */}
      <ConfirmModal
        isOpen={confirmData.isOpen}
        title={confirmData.title}
        message={confirmData.message}
        onConfirm={confirmData.action}
        onCancel={() => setConfirmData((p) => ({ ...p, isOpen: false }))}
      />
    </div>
  );
};
