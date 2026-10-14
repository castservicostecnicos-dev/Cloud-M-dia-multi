export type Role = 'admin' | 'company' | 'operator' | 'player';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  company_id: string | null;
  must_change_password?: boolean;
}

export interface CompanyStore {
  id: string;
  company_id: string;
  name: string;
  brand_name?: string;
  code?: string;
  cnpj?: string;
  city: string;
  state: string;
  address?: string;
  phone?: string;
  responsible?: string;
  status: 'active' | 'inactive';
  player_count?: number;
  operator_count?: number;
  created_at: string;
  updated_at: string;
}

export interface Company {
  id: string;
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
  plan_name?: string;
  start_date: string;
  due_date: string;
  status: 'active' | 'inactive';
  is_network?: boolean;
  stores?: CompanyStore[];
  store_count?: number;
  player_count?: number;
  operator_count?: number;
  media_count?: number;
  max_players?: number;
  max_operators?: number;
  max_media?: number;
  is_custom_limits?: boolean;
  created_at: string;
  updated_at: string;
  drive_folder_id?: string;
  drive_folder_url?: string;
}

export interface Plan {
  id: string;
  name: string;
  description: string;
  max_players: number;
  max_operators: number;
  max_media?: number;
  max_storage: number;
  monthly_price: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export type PlayerOrientation = 'horizontal' | 'vertical';

export interface Player {
  id: string;
  company_id: string;
  store_id?: string | null;
  store_name?: string;
  user_id: string;
  name: string;
  code: string;
  short_code?: string;
  location: string;
  description: string;
  orientation?: PlayerOrientation; // 'horizontal' (16:9 - 1920x1080) | 'vertical' (9:16 - 1080x1920)
  playlist_id: string | null;
  playlist_name?: string;
  status: 'active' | 'inactive';
  is_online?: boolean;
  last_seen: string;
  email?: string;
  access_token?: string;
  // Sugestão 3: Efeito de transição padrão do player
  transition_effect?: TransitionEffect;
  // Sugestão 4: Volume Master do Player
  master_volume?: number; // 0 a 100
  master_muted?: boolean;
  // Sugestão 5: Modo Economia e Descanso Noturno
  eco_mode_enabled?: boolean;
  eco_sleep_start?: string; // "22:00"
  eco_sleep_end?: string; // "06:00"
  eco_screen_type?: 'black' | 'clock' | 'dimmed';
  is_sleeping?: boolean;
  created_at: string;
  updated_at: string;
}

export interface Operator {
  id: string;
  company_id: string;
  store_id?: string | null;
  store_name?: string;
  user_id: string;
  name: string;
  email: string;
  phone: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PlaylistItem {
  id: string;
  playlist_id: string;
  media_id: string;
  position: number;
  duration: number; // in seconds
  name?: string;
  type?: 'image' | 'video' | 'rss' | 'weather_clock';
  file_url?: string;
  // Sugestão 1: Agendamento Inteligente
  schedule_enabled?: boolean;
  schedule_days?: number[]; // [0,1,2,3,4,5,6] (0 = Domingo)
  schedule_start_time?: string; // "HH:MM"
  schedule_end_time?: string; // "HH:MM"
  schedule_start_date?: string; // "YYYY-MM-DD"
  schedule_end_date?: string; // "YYYY-MM-DD"
  // Sugestão 4: Volume e Áudio
  volume?: number; // 0 a 100
  is_muted?: boolean;
  created_at: string;
}

export type TransitionEffect = 'crossfade' | 'slide' | 'zoom' | 'cut';

export interface Playlist {
  id: string;
  company_id: string;
  store_id?: string | null;
  store_name?: string;
  name: string;
  description: string;
  weather_city?: string;
  active: boolean;
  // Sugestão 3: Efeito de Transição
  transition_effect?: TransitionEffect;
  transition_duration?: number;
  // Sugestão 2: Letreiro Digital / Ticker
  custom_ticker_enabled?: boolean;
  custom_ticker_text?: string;
  custom_ticker_bg_color?: string;
  custom_ticker_speed?: number; // 1 (lento), 2 (normal), 3 (rápido)
  items: PlaylistItem[];
  created_at: string;
  updated_at: string;
}

export interface Media {
  id: string;
  company_id: string;
  name: string;
  type: 'image' | 'video' | 'rss' | 'weather_clock';
  file_url: string;
  duration: number;
  active: boolean;
  drive_file_id?: string;
  drive_view_url?: string;
  drive_download_url?: string;
  drive_folder_id?: string;
  unique_code?: string;
  source?: 'drive' | 'device' | 'url' | 'rss' | 'weather_clock';
  file_size?: number;
  mime_type?: string;
  created_at: string;
  updated_at: string;
}

export interface RssArticle {
  title: string;
  imageUrl?: string;
  description?: string;
  pubDate?: string;
  source?: string;
}

export interface WeatherForecastDay {
  date: string;
  dayName: string;
  max: number;
  min: number;
  weatherCode: number;
  text: string;
  rainProb?: number;
}

export interface WeatherData {
  city: string;
  temp: number;
  apparentTemp?: number;
  humidity?: number;
  windSpeed?: number;
  weatherCode: number;
  text: string;
  forecast?: WeatherForecastDay[];
  isFallback?: boolean;
}

export interface RssFeed {
  id: string;
  company_id: string;
  name: string;
  url: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RssPreset {
  name: string;
  url: string;
  description: string;
  category: string;
}

export interface CallPhrase {
  id: string;
  company_id: string;
  operator_id: string | null;
  phrase: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PlayerCall {
  id: string;
  company_id: string;
  player_id: string;
  operator_id: string;
  phrase_id: string | null;
  phrase: string;
  duration: number;
  is_priority?: boolean;
  created_at: string;
}

export interface AdminStats {
  totalCompanies: number;
  activeCompanies: number;
  inactiveCompanies: number;
  totalPlayers: number;
}

export interface CompanyStats {
  storesCount?: number;
  is_network?: boolean;
  playersCount: number;
  activePlayersCount: number;
  onlinePlayersCount: number;
  operatorsCount: number;
  playlistsCount: number;
  mediaCount: number;
  plan: Plan | null;
  drive_folder_url?: string;
  drive_folder_id?: string;
  limits: {
    max_players: number;
    max_operators: number;
    max_storage: number;
    max_media: number;
  };
}

export interface SubClient {
  id: string;
  company_id: string;
  name: string;
  code: string;
  phone?: string;
  email?: string;
  notes?: string;
  drive_folder_id?: string;
  drive_folder_url?: string;
  created_at: string;
  updated_at: string;
}

export type DriveCategory = 'photo' | 'document';

export interface DriveDocument {
  id: string;
  unique_code: string;
  company_id: string;
  sub_client_id?: string;
  category: DriveCategory;
  title: string;
  description: string;
  file_name: string;
  file_size?: number;
  mime_type?: string;
  drive_file_id?: string;
  drive_folder_id?: string;
  drive_view_url?: string;
  drive_download_url?: string;
  local_url?: string;
  status: 'draft' | 'approved' | 'in_progress' | 'completed';
  created_at: string;
  updated_at: string;
}

export interface DriveSettings {
  connected: boolean;
  account_email?: string;
  account_name?: string;
  account_photo?: string;
  root_folder_id?: string;
  root_folder_name?: string;
  root_folder_url?: string;
  last_synced_at?: string;
  access_token?: string;
  refresh_token?: string;
  token_expiry?: number;
  client_id?: string;
  client_secret?: string;
  service_account_json?: string;
}

export interface R2Settings {
  enabled: boolean;
  account_id?: string;
  access_key_id?: string;
  secret_access_key?: string;
  bucket_name?: string;
  public_domain?: string;
  auto_upload_on_add?: boolean;
  last_tested_at?: string;
  last_test_status?: 'success' | 'error';
  last_test_message?: string;
}

export interface MediaIntegrityItemResult {
  media_id: string;
  name: string;
  type: string;
  file_url: string;
  source: 'google_drive' | 'local' | 'rss' | 'weather_clock' | 'external';
  drive_file_id?: string;
  healthy: boolean;
  status: 'ok' | 'trashed' | 'not_found' | 'permission_denied' | 'network_error' | 'inaccessible';
  message: string;
  file_size?: number;
  mime_type?: string;
  playlists_affected: string[];
  players_affected: {
    id: string;
    name: string;
    code: string;
    location?: string;
    is_online?: boolean;
  }[];
}

export interface MediaIntegrityAuditReport {
  company_id?: string;
  checked_at: string;
  summary: {
    total: number;
    healthy: number;
    inaccessible: number;
    google_drive_count: number;
    local_count: number;
    rss_count: number;
    widget_count: number;
  };
  has_issues: boolean;
  issues: MediaIntegrityItemResult[];
  items: MediaIntegrityItemResult[];
}

export interface ProofOfPlayLog {
  id: string;
  company_id: string;
  player_id: string;
  player_name?: string;
  store_id?: string | null;
  media_id: string;
  media_name?: string;
  media_type?: string;
  playlist_id?: string;
  duration_seconds: number;
  played_at: string;
}

export interface ProofOfPlaySummary {
  totalPlays: number;
  totalDurationSeconds: number;
  uniquePlayers: number;
  uniqueMedia: number;
  topMedia: {
    media_id: string;
    media_name: string;
    media_type?: string;
    playCount: number;
    totalSeconds: number;
  }[];
  recentLogs: ProofOfPlayLog[];
}

