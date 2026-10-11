import { Role, User, Company, CompanyStore, Plan, Player, Operator, Playlist, Media, RssFeed, RssPreset, RssArticle, CallPhrase, PlayerCall, AdminStats, CompanyStats, WeatherData, MediaIntegrityAuditReport, TransitionEffect, ProofOfPlaySummary, ProofOfPlayLog } from '../types';
import { handleClientFallbackRequest } from './clientFirestoreFallback';

const TOKEN_KEY = 'indoor_media_token';

// Support decoupled Static Site deployment pointing to a remote backend service
export const API_BASE_URL: string = (
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, '') || '/api'
);

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const cachedRaw = localStorage.getItem('indoor_cached_session');
    if (cachedRaw) {
      const parsed = JSON.parse(cachedRaw);
      if (parsed?.user?.id) {
        headers['X-Session-User-Id'] = String(parsed.user.id);
      }
      if (parsed?.user?.email) {
        headers['X-Session-User-Email'] = String(parsed.user.email);
      }
    }
  } catch {}

  let response: Response | null = null;
  let contentType = '';
  let data: any = null;
  let parseFailed = false;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
      });
      contentType = (response.headers.get('content-type') || '').toLowerCase();
      parseFailed = false;
      try {
        data = await response.json();
      } catch {
        parseFailed = true;
        data = {};
      }

      if (!parseFailed && !contentType.includes('text/html')) {
        break;
      }
    } catch {
      parseFailed = true;
    }

    if (attempt === 0) {
      await new Promise((r) => setTimeout(r, 700));
    }
  }

  if (response && !response.ok && !parseFailed && !contentType.includes('text/html')) {
    throw new Error(data?.error || 'Ocorreu um erro ao processar a requisição.');
  }

  if (!response || parseFailed || contentType.includes('text/html')) {
    // Fallback to direct Firebase Firestore client handler (supports Static Site deploys or cold-start windows)
    return (await handleClientFallbackRequest(endpoint, options, token)) as T;
  }

  return data as T;
}

function ensureArray<T>(val: any, fallbackKey?: string): T[] {
  if (Array.isArray(val)) return val;
  if (fallbackKey && val && Array.isArray(val[fallbackKey])) return val[fallbackKey];
  return [];
}

export const api = {
  // Auth
  login: (credentials: { email?: string; password?: string; playerCode?: string; playerToken?: string; token?: string }) =>
    request<{ token: string; user: User; company?: { id: string; name: string }; player?: Player }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    }),

  getMe: () =>
    request<{ user: User; company?: { id: string; name: string }; player?: Player }>('/auth/me'),

  changePassword: (newPassword: string) =>
    request<{ message: string }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ newPassword }),
    }),

  forgotPassword: (email: string) =>
    request<{ message: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  // Admin
  getAdminStats: () => request<AdminStats>('/admin/stats'),
  getFirestoreStatus: () =>
    request<{
      configured: boolean;
      provider: string;
      lastSyncTimestamp: string | null;
      lastSyncError: string | null;
      isSyncing: boolean;
    }>('/admin/firestore/status'),
  syncFirestore: () =>
    request<{
      success: boolean;
      status: {
        configured: boolean;
        provider: string;
        lastSyncTimestamp: string | null;
        lastSyncError: string | null;
        isSyncing: boolean;
      };
    }>('/admin/firestore/sync', { method: 'POST' }),
  exportBackup: async () => {
    const token = getStoredToken();
    const res = await fetch(`${API_BASE_URL}/admin/backup/export`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      throw new Error('Falha ao exportar backup.');
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStr = new Date().toISOString().split('T')[0];
    a.href = url;
    a.download = `indoor_media_backup_${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  },
  importBackup: (backup: any) =>
    request<{ success: boolean; message: string }>('/admin/backup/import', {
      method: 'POST',
      body: JSON.stringify({ backup }),
    }),
  getCompanies: () =>
    request<Company[]>('/admin/companies').then((r) => ensureArray<Company>(r, 'companies')),
  impersonateCompany: (companyId: string) =>
    request<{ token: string; user: User; company: { id: string; name: string } }>(
      `/admin/companies/${companyId}/impersonate`,
      { method: 'POST' }
    ),
  createCompany: (data: Partial<Company> & { password?: string }) =>
    request<Company>('/admin/companies', { method: 'POST', body: JSON.stringify(data) }),
  updateCompany: (id: string, data: Partial<Company>) =>
    request<Company>(`/admin/companies/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  toggleCompanyStatus: (id: string) =>
    request<{ message: string; status: 'active' | 'inactive' }>(`/admin/companies/${id}/toggle-status`, {
      method: 'POST',
    }),
  resetCompanyPassword: (id: string, newPassword?: string) =>
    request<{ message: string }>(`/admin/companies/${id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ newPassword }),
    }),
  deleteCompany: (id: string) =>
    request<{ message: string }>(`/admin/companies/${id}`, { method: 'DELETE' }),
  getAdminCompanyStores: (companyId: string) =>
    request<CompanyStore[]>(`/admin/companies/${companyId}/stores`).then((r) => ensureArray<CompanyStore>(r, 'stores')),
  createAdminCompanyStore: (companyId: string, data: Partial<CompanyStore>) =>
    request<CompanyStore>(`/admin/companies/${companyId}/stores`, { method: 'POST', body: JSON.stringify(data) }),
  updateAdminCompanyStore: (storeId: string, data: Partial<CompanyStore>) =>
    request<CompanyStore>(`/admin/stores/${storeId}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteAdminCompanyStore: (storeId: string) =>
    request<{ message: string }>(`/admin/stores/${storeId}`, { method: 'DELETE' }),

  getPlans: () =>
    request<Plan[]>('/admin/plans').then((r) => ensureArray<Plan>(r, 'plans')),
  createPlan: (data: Partial<Plan>) =>
    request<Plan>('/admin/plans', { method: 'POST', body: JSON.stringify(data) }),
  updatePlan: (id: string, data: Partial<Plan>) =>
    request<Plan>(`/admin/plans/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  togglePlanStatus: (id: string) =>
    request<{ message: string; active: boolean }>(`/admin/plans/${id}/toggle-status`, { method: 'POST' }),
  deletePlan: (id: string) =>
    request<{ message: string }>(`/admin/plans/${id}`, { method: 'DELETE' }),

  seedDemoData: () =>
    request<{
      message: string;
      companiesCount: number;
      operatorsCount: number;
      playersCount: number;
      demoClients: Array<{
        id: string;
        name: string;
        segment: string;
        companyEmail: string;
        operatorEmail: string;
        playerCode: string;
        playerCodeSecondary?: string;
      }>;
    }>('/auth/seed-demo-data', { method: 'POST' }),

  // Company
  getCompanyStats: () => request<CompanyStats>('/company/stats'),
  getCompanyStores: () =>
    request<CompanyStore[]>('/company/stores').then((r) => ensureArray<CompanyStore>(r, 'stores')),
  createCompanyStore: (data: Partial<CompanyStore>) =>
    request<CompanyStore>('/company/stores', { method: 'POST', body: JSON.stringify(data) }),
  updateCompanyStore: (id: string, data: Partial<CompanyStore>) =>
    request<CompanyStore>(`/company/stores/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCompanyStore: (id: string) =>
    request<{ message: string }>(`/company/stores/${id}`, { method: 'DELETE' }),
  updateCompanyDriveFolder: (data: { drive_folder_id?: string; drive_folder_url?: string }) =>
    request<{ success: boolean; company: Company }>('/company/drive-folder', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  getCompanyPlayers: () =>
    request<Player[]>('/company/players').then((r) => ensureArray<Player>(r, 'players')),
  createCompanyPlayer: (data: Partial<Player> & { password?: string }) =>
    request<Player>('/company/players', { method: 'POST', body: JSON.stringify(data) }),
  updateCompanyPlayer: (id: string, data: Partial<Player>) =>
    request<Player>(`/company/players/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  togglePlayerStatus: (id: string) =>
    request<{ message: string; status: 'active' | 'inactive' }>(`/company/players/${id}/toggle-status`, {
      method: 'POST',
    }),
  resetPlayerPassword: (id: string, newPassword?: string) =>
    request<{ message: string }>(`/company/players/${id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ newPassword }),
    }),
  deleteCompanyPlayer: (id: string) =>
    request<{ message: string }>(`/company/players/${id}`, { method: 'DELETE' }),
  regeneratePlayerToken: (id: string) =>
    request<{ message: string; access_token: string; player: Player }>(`/company/players/${id}/regenerate-token`, {
      method: 'POST',
    }),
  // Sugestão 5: Colocar player em descanso ou acordar remotamente
  togglePlayerSleep: (id: string) =>
    request<{ status: string; is_sleeping: boolean; message: string }>(`/company/players/${id}/toggle-sleep`, {
      method: 'POST',
    }),

  getCompanyOperators: () =>
    request<Operator[]>('/company/operators').then((r) => ensureArray<Operator>(r, 'operators')),
  createCompanyOperator: (data: Partial<Operator> & { password?: string }) =>
    request<Operator>('/company/operators', { method: 'POST', body: JSON.stringify(data) }),
  updateCompanyOperator: (id: string, data: Partial<Operator> & { password?: string }) =>
    request<Operator>(`/company/operators/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  toggleOperatorStatus: (id: string) =>
    request<{ message: string; active: boolean }>(`/company/operators/${id}/toggle-status`, { method: 'POST' }),
  resetOperatorPassword: (id: string, newPassword?: string) =>
    request<{ message: string }>(`/company/operators/${id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ newPassword }),
    }),
  deleteCompanyOperator: (id: string) =>
    request<{ message: string }>(`/company/operators/${id}`, { method: 'DELETE' }),

  getCompanyPlaylists: () =>
    request<Playlist[]>('/company/playlists').then((r) => ensureArray<Playlist>(r, 'playlists')),
  createCompanyPlaylist: (data: Partial<Playlist> & { restartPlayers?: boolean }) =>
    request<Playlist>('/company/playlists', { method: 'POST', body: JSON.stringify(data) }),
  updateCompanyPlaylist: (id: string, data: Partial<Playlist> & { restartPlayers?: boolean }) =>
    request<Playlist>(`/company/playlists/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  togglePlaylistStatus: (id: string) =>
    request<{ message: string; active: boolean }>(`/company/playlists/${id}/toggle-status`, { method: 'POST' }),
  deleteCompanyPlaylist: (id: string) =>
    request<{ message: string }>(`/company/playlists/${id}`, { method: 'DELETE' }),
  addWeatherToPlaylist: (params: { playlist_id?: string; duration?: number }) =>
    request<{ message: string; playlist: Playlist; item: any }>('/company/weather/add-to-playlist', {
      method: 'POST',
      body: JSON.stringify(params),
    }),
  addRssToPlaylist: (params: { playlist_id?: string; rss_url: string; name?: string; duration?: number }) =>
    request<{ message: string; playlist: Playlist; item: any }>('/company/rss/add-to-playlist', {
      method: 'POST',
      body: JSON.stringify(params),
    }),

  getCompanyMedia: () =>
    request<Media[]>('/company/media').then((r) => ensureArray<Media>(r, 'media')),
  checkMediaIntegrity: (driveAccessToken?: string) =>
    request<MediaIntegrityAuditReport>('/company/media/check-integrity', {
      method: 'POST',
      body: JSON.stringify({ driveAccessToken }),
    }),
  getMediaIntegrityStatus: () => request<MediaIntegrityAuditReport>('/company/media/integrity-status'),
  checkAdminMediaIntegrity: (params?: { companyId?: string; driveAccessToken?: string }) =>
    request<MediaIntegrityAuditReport>('/admin/media/check-integrity', {
      method: 'POST',
      body: JSON.stringify(params || {}),
    }),
  getAdminMediaIntegrityStatus: (companyId?: string) =>
    request<MediaIntegrityAuditReport>(`/admin/media/integrity-status${companyId ? `?companyId=${companyId}` : ''}`),
  uploadFile: (fileData: string, filename: string, mimeType?: string) =>
    request<{ url: string; filename: string; originalName: string; size: number; mimeType: string }>('/upload', {
      method: 'POST',
      body: JSON.stringify({ fileData, filename, mimeType }),
    }),
  uploadCompanyMedia: (data: Partial<Media> & { addToAllPlaylists?: boolean }) =>
    request<Media & { addToAllPlaylists?: boolean; playlistsUpdatedCount?: number }>('/company/media', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateCompanyMedia: (id: string, data: Partial<Media>) =>
    request<Media>(`/company/media/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCompanyMedia: (id: string) =>
    request<{ message: string }>(`/company/media/${id}`, { method: 'DELETE' }),
  addMediaToAllPlaylists: (
    mediaId: string,
    params?: { duration?: number; restartPlayers?: boolean; forceDuplicate?: boolean }
  ) =>
    request<{
      message: string;
      updatedCount: number;
      alreadyContainedCount: number;
      totalPlaylists: number;
      playlists: Playlist[];
    }>(`/company/media/${mediaId}/add-to-all-playlists`, {
      method: 'POST',
      body: JSON.stringify(params || {}),
    }),

  getCompanyRss: () =>
    request<RssFeed[]>('/company/rss').then((r) => ensureArray<RssFeed>(r, 'feeds')),
  getRssPresets: () =>
    request<RssPreset[]>('/company/rss/presets').then((r) => ensureArray<RssPreset>(r, 'presets')),
  loadDefaultRssFeeds: () =>
    request<{ message: string; feeds: RssFeed[] }>('/company/rss/load-defaults', { method: 'POST' }),
  createCompanyRss: (data: Partial<RssFeed>) =>
    request<RssFeed>('/company/rss', { method: 'POST', body: JSON.stringify(data) }),
  updateCompanyRss: (id: string, data: Partial<RssFeed>) =>
    request<RssFeed>(`/company/rss/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  toggleRssStatus: (id: string) =>
    request<{ message: string; active: boolean }>(`/company/rss/${id}/toggle-status`, { method: 'POST' }),
  deleteCompanyRss: (id: string) =>
    request<{ message: string }>(`/company/rss/${id}`, { method: 'DELETE' }),

  fetchRssHeadlines: (url: string) =>
    request<{ items: string[] }>(`/rss/proxy?url=${encodeURIComponent(url)}`),

  fetchRssArticles: (url: string) =>
    request<{ items: string[]; articles: RssArticle[]; feedTitle?: string }>(
      `/rss/proxy?url=${encodeURIComponent(url)}`
    ),

  // Operator
  getOperatorDashboard: () =>
    request<{
      players: Array<
        Pick<Player, 'id' | 'name' | 'code' | 'location' | 'orientation'> & {
          is_online: boolean;
          last_seen: string;
          expected_interval_seconds?: number;
          heartbeat_timeout_seconds?: number;
        }
      >;
      phrases: CallPhrase[];
      expected_interval_seconds?: number;
      heartbeat_timeout_seconds?: number;
      server_time?: string;
    }>('/operator/dashboard').then((res) => ({
      ...res,
      players: ensureArray(res?.players),
      phrases: ensureArray(res?.phrases),
    })),
  getOperatorPhrases: () =>
    request<CallPhrase[]>('/operator/phrases').then((r) => ensureArray<CallPhrase>(r, 'phrases')),
  createOperatorPhrase: (phrase: string) =>
    request<CallPhrase>('/operator/phrases', { method: 'POST', body: JSON.stringify({ phrase }) }),
  updateOperatorPhrase: (id: string, data: { phrase?: string; active?: boolean }) =>
    request<CallPhrase>(`/operator/phrases/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteOperatorPhrase: (id: string) =>
    request<{ message: string }>(`/operator/phrases/${id}`, { method: 'DELETE' }),

  triggerCall: (data: {
    playerId: string;
    phrase: string;
    phraseId?: string;
    duration?: number;
    isPriority?: boolean;
    is_priority?: boolean;
  }) =>
    request<{ message: string; call: PlayerCall; delivered: boolean }>('/operator/call', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Weather with Forecast
  getWeather: (city?: string) =>
    request<{
      status: string;
      city: string;
      temp: number;
      apparentTemp?: number;
      humidity?: number;
      windSpeed?: number;
      weatherCode: number;
      text: string;
      forecast?: Array<{
        date: string;
        dayName: string;
        max: number;
        min: number;
        weatherCode: number;
        text: string;
        rainProb?: number;
      }>;
      isFallback?: boolean;
    }>(`/weather?city=${encodeURIComponent(city || 'São Paulo')}`),

  // Player
  getCurrentPlayer: (code?: string, token?: string) => {
    const params = new URLSearchParams();
    if (code) params.append('code', code);
    if (token) params.append('token', token);
    const qs = params.toString();
    return request<{
      player: Pick<Player, 'id' | 'name' | 'code' | 'access_token' | 'location' | 'orientation'> & {
        transition_effect?: TransitionEffect;
        master_volume?: number;
        master_muted?: boolean;
        eco_mode_enabled?: boolean;
        eco_sleep_start?: string;
        eco_sleep_end?: string;
        eco_screen_type?: 'black' | 'clock' | 'dimmed';
        is_sleeping?: boolean;
      };
      company: { id: string; name: string };
      playlist: {
        id: string;
        name: string;
        weather_city?: string;
        transition_effect?: TransitionEffect;
        transition_duration?: number;
        custom_ticker_enabled?: boolean;
        custom_ticker_text?: string;
        custom_ticker_bg_color?: string;
        custom_ticker_speed?: number;
      } | null;
      weatherCity?: string;
      items: Array<{
        id: string;
        media_id: string;
        position: number;
        duration: number;
        name: string;
        type: 'image' | 'video' | 'rss' | 'weather_clock';
        file_url: string;
        schedule_enabled?: boolean;
        schedule_days?: number[];
        schedule_start_time?: string;
        schedule_end_time?: string;
        schedule_start_date?: string;
        schedule_end_date?: string;
        volume?: number;
        is_muted?: boolean;
      }>;
      rssFeeds: RssFeed[];
    }>(qs ? `/player/current?${qs}` : '/player/current');
  },

  // Sugestão 6: Prova de Exibição & Analytics
  recordProofOfPlay: (data: {
    player_id: string;
    media_id: string;
    playlist_id?: string;
    duration_seconds: number;
  }) =>
    request<{ status: string; logId: string }>('/player/proof-of-play', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getProofOfPlaySummary: (params?: { playerId?: string; mediaId?: string; days?: number }) => {
    const query = new URLSearchParams();
    if (params?.playerId) query.append('playerId', params.playerId);
    if (params?.mediaId) query.append('mediaId', params.mediaId);
    if (params?.days) query.append('days', String(params.days));
    const qs = query.toString();
    return request<{ summary: ProofOfPlaySummary; logsCount: number }>(
      `/company/proof-of-play${qs ? `?${qs}` : ''}`
    );
  },

  sendHeartbeat: (playerId: string, code?: string, token?: string) =>
    request<{ status: string }>('/player/heartbeat', {
      method: 'POST',
      body: JSON.stringify({ playerId, code, token }),
    }),

  sendPlayerOffline: (playerId: string, code?: string, token?: string) =>
    request<{ status: string }>('/player/offline', {
      method: 'POST',
      body: JSON.stringify({ playerId, code, token }),
    }),

  getActiveCall: (playerId?: string, code?: string, token?: string, companyId?: string) => {
    const params = new URLSearchParams();
    if (playerId) params.append('playerId', playerId);
    if (code) params.append('code', code);
    if (token) params.append('token', token);
    if (companyId) params.append('companyId', companyId);
    return request<{
      activeCall: PlayerCall | null;
      pendingRestart?: any;
      reloadPlaylist?: boolean;
    }>(`/player/active-call?${params.toString()}`);
  },

  restartPlayer: (params?: {
    playerId?: string;
    playlistId?: string;
    companyId?: string;
    fullReload?: boolean;
    reason?: string;
  }) =>
    request<{
      status: string;
      deliveredCount: number;
      targetPlayerCount: number;
      message: string;
    }>('/player/restart', {
      method: 'POST',
      body: JSON.stringify(params || {}),
    }),

  // Google Drive & SubClients
  getDriveSettings: () => request<{ status: string; settings: any }>('/drive/settings'),
  updateDriveSettings: (data: any) =>
    request<{ status: string; settings: any }>('/drive/settings', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  testDriveConnection: () =>
    request<{
      status: string;
      connected: boolean;
      account_email?: string;
      account_name?: string;
      account_photo?: string;
      storageQuota?: any;
      message?: string;
      error?: string;
    }>('/drive/test-connection', {
      method: 'POST',
    }),
  ensureDriveClientFoldersServer: (params: { clientName: string; customRootName?: string; clientDriveToken?: string }) =>
    request<{
      status: string;
      structure: any;
    }>('/drive/ensure-folders', {
      method: 'POST',
      body: JSON.stringify(params),
    }),
  uploadDriveDocumentServer: (params: {
    fileData: string;
    fileName: string;
    mimeType: string;
    folderId: string;
    companyId?: string;
    title?: string;
    description?: string;
    category?: string;
    clientDriveToken?: string;
  }) =>
    request<{
      status: string;
      document: any;
      driveResult?: any;
      message?: string;
    }>('/drive/upload-document', {
      method: 'POST',
      body: JSON.stringify(params),
    }),
  listDriveFolderFilesServer: (folderId: string, clientDriveToken?: string) => {
    const query = clientDriveToken ? `?token=${encodeURIComponent(clientDriveToken)}` : '';
    return request<{ status: string; files: any[] }>(`/drive/folder-files/${folderId}${query}`);
  },
  deleteDriveFileServer: (fileId: string, clientDriveToken?: string) =>
    request<{ status: string; message: string }>('/drive/delete-file', {
      method: 'POST',
      body: JSON.stringify({ fileId, clientDriveToken }),
    }),
  verifyDriveFileServer: (fileId: string, clientDriveToken?: string) => {
    const query = clientDriveToken ? `?token=${encodeURIComponent(clientDriveToken)}` : '';
    return request<{
      accessible: boolean;
      status: string;
      name?: string;
      size?: number;
      message: string;
    }>(`/drive/verify-file/${fileId}${query}`);
  },
  scanAndImportDriveMedia: (companyId?: string) =>
    request<{
      status: string;
      totalImported: number;
      importedItems: any[];
      message: string;
      error?: string;
    }>('/drive/scan-and-import', {
      method: 'POST',
      body: JSON.stringify({ companyId }),
    }),
  uploadCompanyMediaToDriveServer: (data: {
    fileData?: string;
    uploadedFilename?: string;
    filename: string;
    mimeType: string;
    name?: string;
    duration?: number;
    companyId?: string;
    clientDriveToken?: string;
    addToAllPlaylists?: boolean;
  }) => {
    const storedDriveToken =
      data.clientDriveToken ||
      localStorage.getItem('mindoors_gdrive_access_token') ||
      localStorage.getItem('google_drive_access_token') ||
      sessionStorage.getItem('mindoors_gdrive_access_token') ||
      undefined;

    return request<{
      status: string;
      media: any;
      savedToDrive: boolean;
      driveAccount?: string;
      addToAllPlaylists?: boolean;
      playlistsUpdatedCount?: number;
      message: string;
    }>('/company/media/upload-to-drive', {
      method: 'POST',
      body: JSON.stringify({ ...data, clientDriveToken: storedDriveToken }),
    });
  },

  uploadCompanyMediaFileChunked: async (params: {
    file: File;
    name?: string;
    duration?: number;
    companyId?: string;
    clientDriveToken?: string;
    addToAllPlaylists?: boolean;
    onProgress?: (percent: number) => void;
  }) => {
    const { file, name, duration, companyId, clientDriveToken, addToAllPlaylists, onProgress } = params;
    const CHUNK_SIZE = 1536 * 1024; // 1.5 MB raw (~2 MB base64) per chunk
    const totalChunks = Math.max(1, Math.ceil(file.size / CHUNK_SIZE));
    const uploadId = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const blobToBase64 = (blob: Blob): Promise<string> =>
      new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Falha ao ler arquivo do dispositivo.'));
        reader.readAsDataURL(blob);
      });

    let uploadedFilename = '';

    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(file.size, start + CHUNK_SIZE);
      const slice = file.slice(start, end);
      const chunkData = await blobToBase64(slice);

      const res = await request<{
        status: string;
        filename: string;
        url?: string;
      }>('/upload/chunk', {
        method: 'POST',
        body: JSON.stringify({
          uploadId,
          chunkIndex: i,
          totalChunks,
          chunkData,
          filename: file.name,
          mimeType: file.type || 'application/octet-stream',
        }),
      });

      uploadedFilename = res.filename;
      if (onProgress) {
        onProgress(Math.min(92, Math.round(((i + 1) / totalChunks) * 90)));
      }
    }

    const storedDriveToken =
      localStorage.getItem('mindoors_gdrive_access_token') ||
      localStorage.getItem('google_drive_access_token') ||
      sessionStorage.getItem('mindoors_gdrive_access_token') ||
      undefined;

    const finalRes = await request<{
      status: string;
      media: any;
      savedToDrive: boolean;
      driveAccount?: string;
      message: string;
    }>('/company/media/upload-to-drive', {
      method: 'POST',
      body: JSON.stringify({
        uploadedFilename,
        filename: file.name,
        mimeType: file.type || 'application/octet-stream',
        name: name || file.name,
        duration,
        companyId,
        clientDriveToken: storedDriveToken,
        addToAllPlaylists,
      }),
    });

    if (onProgress) {
      onProgress(100);
    }
    return finalRes;
  },

  getSubClients: (companyId?: string) => {
    const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : '';
    return request<{ status: string; subClients: any[] }>(`/sub-clients${query}`);
  },

  getCompanySubClients: (companyId: string) =>
    request<{ status: string; subClients: any[] }>(`/companies/${companyId}/sub-clients`),

  createSubClient: (companyId: string, data: any) =>
    request<{ status: string; subClient: any }>(`/companies/${companyId}/sub-clients`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateSubClient: (id: string, data: any) =>
    request<{ status: string; subClient: any }>(`/sub-clients/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteSubClient: (id: string) =>
    request<{ status: string; message: string }>(`/sub-clients/${id}`, {
      method: 'DELETE',
    }),

  getDriveDocuments: (params?: { companyId?: string; subClientId?: string; category?: string }) => {
    const q = new URLSearchParams();
    if (params?.companyId) q.append('companyId', params.companyId);
    if (params?.subClientId) q.append('subClientId', params.subClientId);
    if (params?.category) q.append('category', params.category);
    return request<{ status: string; documents: any[] }>(`/drive/documents?${q.toString()}`);
  },

  createDriveDocument: (data: any) =>
    request<{ status: string; document: any }>('/drive/documents', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateDriveDocument: (id: string, data: any) =>
    request<{ status: string; document: any }>(`/drive/documents/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteDriveDocument: (id: string) =>
    request<{ status: string; message: string }>(`/drive/documents/${id}`, {
      method: 'DELETE',
    }),
};
