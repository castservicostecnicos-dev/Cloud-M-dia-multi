import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  loadDatabaseFromFirestore,
  saveDatabaseToFirestoreNow,
  queueFirestoreSync,
  getFirestoreSyncStatus,
  enableFirestoreSync,
} from './firestore.js';
import { R2Settings } from '../src/types';

export interface User {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  salt: string;
  role: 'admin' | 'company' | 'operator' | 'player';
  company_id: string | null;
  active: boolean;
  must_change_password?: boolean;
  created_at: string;
  updated_at: string;
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
  start_date: string;
  due_date: string;
  status: 'active' | 'inactive';
  is_network?: boolean;
  max_players?: number;
  max_operators?: number;
  max_media?: number;
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

export interface Player {
  id: string;
  company_id: string;
  store_id?: string | null;
  user_id: string;
  name: string;
  code: string;
  location: string;
  description: string;
  orientation: 'horizontal' | 'vertical'; // 'horizontal' (16:9 - 1920x1080) | 'vertical' (9:16 - 1080x1920)
  playlist_id: string | null;
  status: 'active' | 'inactive';
  access_token?: string;
  last_seen: string;
  // Sugestão 3: Transições
  transition_effect?: 'crossfade' | 'slide' | 'zoom' | 'cut';
  // Sugestão 4: Volume Master do Player
  master_volume?: number; // 0 a 100
  master_muted?: boolean;
  // Sugestão 5: Modo Economia Noturno
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
  schedule_days?: number[]; // [0,1,2,3,4,5,6]
  schedule_start_time?: string; // "08:00"
  schedule_end_time?: string; // "18:00"
  schedule_start_date?: string; // "2026-10-01"
  schedule_end_date?: string; // "2026-10-31"
  // Sugestão 4: Volume por mídia
  volume?: number; // 0 a 100
  is_muted?: boolean;
  created_at: string;
}

export interface Playlist {
  id: string;
  company_id: string;
  store_id?: string | null;
  name: string;
  description: string;
  weather_city?: string;
  active: boolean;
  // Sugestão 3: Transição padrão
  transition_effect?: 'crossfade' | 'slide' | 'zoom' | 'cut';
  transition_duration?: number;
  // Sugestão 2: Letreiro Digital
  custom_ticker_enabled?: boolean;
  custom_ticker_text?: string;
  custom_ticker_bg_color?: string;
  custom_ticker_speed?: number;
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

export const DEFAULT_RSS_FEEDS: RssPreset[] = [
  {
    name: 'G1 - Saúde e Bem-Estar',
    url: 'https://g1.globo.com/rss/g1/saude/',
    description: 'Prevenção, qualidade de vida, alimentação saudável e avanços médicos.',
    category: 'Saúde',
  },
  {
    name: 'G1 - Brasil e Notícias Gerais',
    url: 'https://g1.globo.com/rss/g1/brasil/',
    description: 'Principais manchetes e acontecimentos de destaque nacional em tempo real.',
    category: 'Geral',
  },
  {
    name: 'Folha de S.Paulo - Em Cima da Hora',
    url: 'https://feeds.folha.uol.com.br/emcimadahora/rss091.xml',
    description: 'Atualizações minuto a minuto dos principais fatos do Brasil e do mundo.',
    category: 'Jornalismo',
  },
  {
    name: 'G1 - Economia e Negócios',
    url: 'https://g1.globo.com/rss/g1/economia/',
    description: 'Mercado de trabalho, finanças, inflação e tendências de negócios.',
    category: 'Economia',
  },
  {
    name: 'G1 - Tecnologia e Inovação',
    url: 'https://g1.globo.com/rss/g1/tecnologia/',
    description: 'Novidades do universo tech, internet, celulares e inteligência artificial.',
    category: 'Tecnologia',
  },
];

export function ensureCompanyDefaultMedia(
  companyId: string,
  data: DatabaseSchema,
  now: string = new Date().toISOString()
): boolean {
  let changed = false;

  // 1. Ensure RSS feeds exist
  seedDefaultRssFeedsForCompany(companyId, data, now);

  // 2. Ensure Weather & Clock media exists for this company
  const hasWeather = data.media.some((m) => m.company_id === companyId && m.type === 'weather_clock');
  if (!hasWeather) {
    const weatherId = `med-${companyId}-weather`;
    data.media.push({
      id: weatherId,
      company_id: companyId,
      name: 'Hora Certa & Previsão do Tempo',
      type: 'weather_clock',
      file_url: 'widget:weather_clock',
      duration: 12,
      active: true,
      created_at: now,
      updated_at: now,
    });
    changed = true;
  }

  // 3. Ensure full-screen RSS Media items exist for common news channels
  const rssPresets = [
    { name: 'Notícias RSS - Saúde & Bem-Estar', url: 'https://g1.globo.com/rss/g1/saude/', duration: 15 },
    { name: 'Notícias RSS - G1 Brasil', url: 'https://g1.globo.com/rss/g1/brasil/', duration: 15 },
    { name: 'Notícias RSS - Tecnologia & Inovação', url: 'https://g1.globo.com/rss/g1/tecnologia/', duration: 15 },
    { name: 'Notícias RSS - Economia & Negócios', url: 'https://g1.globo.com/rss/g1/economia/', duration: 15 },
  ];

  for (const preset of rssPresets) {
    const exists = data.media.some(
      (m) =>
        m.company_id === companyId &&
        m.type === 'rss' &&
        (m.file_url.trim() === preset.url.trim() || m.name.toLowerCase() === preset.name.toLowerCase())
    );
    if (!exists) {
      data.media.push({
        id: `med-${companyId}-rss-${Math.random().toString(36).substring(2, 7)}`,
        company_id: companyId,
        name: preset.name,
        type: 'rss',
        file_url: preset.url,
        duration: preset.duration,
        active: true,
        created_at: now,
        updated_at: now,
      });
      changed = true;
    }
  }

  return changed;
}

export function seedDefaultRssFeedsForCompany(
  companyId: string,
  data: DatabaseSchema,
  now: string = new Date().toISOString()
): void {
  DEFAULT_RSS_FEEDS.forEach((feed, idx) => {
    const alreadyExists = data.rss_feeds.some(
      (r) =>
        r.company_id === companyId &&
        (r.url.trim() === feed.url.trim() || r.name.toLowerCase() === feed.name.toLowerCase())
    );
    if (!alreadyExists) {
      data.rss_feeds.push({
        id: `rss-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
        company_id: companyId,
        name: feed.name,
        url: feed.url,
        active: true,
        created_at: now,
        updated_at: now,
      });
    }
  });

  // Ensure default Full-Screen RSS Media item exists
  const hasRssMedia = data.media.some((m) => m.company_id === companyId && m.type === 'rss');
  if (!hasRssMedia) {
    const rssMediaId = `med-${Date.now()}-rss-saude`;
    data.media.push({
      id: rssMediaId,
      company_id: companyId,
      name: 'Notícias RSS - Saúde & Bem-Estar',
      type: 'rss',
      file_url: 'https://g1.globo.com/rss/g1/saude/',
      duration: 15,
      active: true,
      created_at: now,
      updated_at: now,
    });

    const pl = data.playlists?.find((p) => p.company_id === companyId);
    if (pl && !pl.items.some((it) => it.media_id === rssMediaId)) {
      pl.items.push({
        id: `pli-${Date.now()}-rss`,
        playlist_id: pl.id,
        media_id: rssMediaId,
        position: pl.items.length + 1,
        duration: 15,
        created_at: now,
      });
    }
  }
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

export interface DriveDocument {
  id: string;
  unique_code: string; // Ex: FOTO-CLI-001-3F8E, DOC-CLI-001-9X72
  company_id: string;
  sub_client_id?: string;
  category: 'photo' | 'document';
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
  photos_bucket_folder_id?: string;
  photos_bucket_folder_name?: string;
  photos_bucket_enabled?: boolean;
  last_synced_at?: string;
  access_token?: string;
  refresh_token?: string;
  token_expiry?: number;
  client_id?: string;
  client_secret?: string;
  service_account_json?: string;
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

export interface DatabaseSchema {
  users: User[];
  companies: Company[];
  company_stores?: CompanyStore[];
  plans: Plan[];
  players: Player[];
  operators: Operator[];
  playlists: Playlist[];
  media: Media[];
  rss_feeds: RssFeed[];
  call_phrases: CallPhrase[];
  player_calls: PlayerCall[];
  sub_clients: SubClient[];
  drive_documents: DriveDocument[];
  drive_settings: DriveSettings;
  r2_settings?: R2Settings;
  proof_of_play_logs?: ProofOfPlayLog[];
  sessions?: AuthSession[];
}

export interface AuthSession {
  token: string;
  userId: string;
  role: 'admin' | 'company' | 'operator' | 'player';
  companyId: string | null;
  playerId?: string;
  createdAt: number;
}

export const DEFAULT_PLANS: Plan[] = [
  {
    id: 'plan-call-basic',
    name: 'Call Básico',
    description: '1 tela com chamadas completas de atendimento e até 4 operadores autorizados (proporção 4:1).',
    max_players: 1,
    max_operators: 4,
    max_storage: 50,
    monthly_price: 49.0,
    active: true,
    created_at: '2026-09-01T00:00:00.000Z',
    updated_at: '2026-09-05T00:00:00.000Z',
  },
  {
    id: 'plan-call-inter',
    name: 'Call Intermediário',
    description: '3 telas com chamadas no painel e até 12 operadores de guichê (proporção 4:1).',
    max_players: 3,
    max_operators: 12,
    max_storage: 150,
    monthly_price: 109.0,
    active: true,
    created_at: '2026-09-01T00:00:00.000Z',
    updated_at: '2026-09-05T00:00:00.000Z',
  },
  {
    id: 'plan-call-pro',
    name: 'Call Pro',
    description: '6 telas com chamadas simultâneas e até 24 operadores de guichê (proporção 4:1).',
    max_players: 6,
    max_operators: 24,
    max_storage: 300,
    monthly_price: 229.0,
    active: true,
    created_at: '2026-09-01T00:00:00.000Z',
    updated_at: '2026-09-05T00:00:00.000Z',
  },
  {
    id: 'plan-show-basic',
    name: 'Show Básico',
    description: 'Exibição de mídia indoor, propagandas, hora certa e notícias RSS em até 2 telas (sem operador).',
    max_players: 2,
    max_operators: 0,
    max_storage: 50,
    monthly_price: 29.0,
    active: true,
    created_at: '2026-09-01T00:00:00.000Z',
    updated_at: '2026-09-05T00:00:00.000Z',
  },
  {
    id: 'plan-show-inter',
    name: 'Show Intermediário',
    description: 'Até 5 telas simultâneas com notícias e mídias institucionais personalizadas (sem operador).',
    max_players: 5,
    max_operators: 0,
    max_storage: 150,
    monthly_price: 89.0,
    active: true,
    created_at: '2026-09-01T00:00:00.000Z',
    updated_at: '2026-09-05T00:00:00.000Z',
  },
  {
    id: 'plan-show-pro',
    name: 'Show Pro',
    description: 'Até 12 telas para redes e múltiplos pontos comerciais focados em publicidade e notícias (sem operador).',
    max_players: 12,
    max_operators: 0,
    max_storage: 500,
    monthly_price: 149.0,
    active: true,
    created_at: '2026-09-01T00:00:00.000Z',
    updated_at: '2026-09-05T00:00:00.000Z',
  },
  {
    id: 'plan-especial-corp',
    name: 'Especial Corporativo',
    description: 'Plano especial sob medida com proporção livre de telas e operadores (ex: 4 telas e 20 operadores de guichê).',
    max_players: 4,
    max_operators: 20,
    max_storage: 250,
    monthly_price: 189.0,
    active: true,
    created_at: '2026-09-01T00:00:00.000Z',
    updated_at: '2026-09-05T00:00:00.000Z',
  },
];

export function hashPassword(password: string, existingSalt?: string): { hash: string; salt: string } {
  const salt = existingSalt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  if (!password || !hash) return false;
  // Direct match for legacy / plain-text passwords
  if (password === hash) return true;
  if (!salt) return false;
  try {
    const derived = crypto.scryptSync(password, salt, 64).toString('hex');
    const bufA = Buffer.from(derived, 'hex');
    const bufB = Buffer.from(hash, 'hex');
    if (bufA.length !== bufB.length) {
      return false;
    }
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

export const dataDir = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.resolve(process.cwd(), 'data');

export const dbPath = path.join(dataDir, 'indoor_media.json');

export const uploadsDir = (process.env.UPLOAD_DIR || process.env.UPLOADS_DIR)
  ? path.resolve((process.env.UPLOAD_DIR || process.env.UPLOADS_DIR)!)
  : (process.env.DATA_DIR ? path.join(dataDir, 'uploads') : path.resolve(process.cwd(), 'uploads'));

class DatabaseStore {
  private data: DatabaseSchema;

  constructor() {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    if (fs.existsSync(dbPath)) {
      try {
        const raw = fs.readFileSync(dbPath, 'utf-8');
        this.data = JSON.parse(raw);
        // Normalize player orientation
        let changed = false;
        if (this.data.players) {
          for (const p of this.data.players) {
            if (!p.orientation) {
              p.orientation = p.code?.includes('SALA') ? 'vertical' : 'horizontal';
              changed = true;
            }
          }
        }

        // Ensure every company has Weather & Clock and RSS media items loaded
        if (this.data.companies && this.data.media) {
          const now = new Date().toISOString();
          for (const comp of this.data.companies) {
            if (ensureCompanyDefaultMedia(comp.id, this.data, now)) {
              changed = true;
            }
          }
        }

        // Clear any old predefined call phrases as requested
        if (this.data.call_phrases && this.data.call_phrases.length > 0) {
          this.data.call_phrases = [];
          changed = true;
        }

        // Synchronize the 6 official plans: Call Básico, Call Intermediário, Call Pro, Show Básico, Show Intermediário, Show Pro
        if (this.data.plans) {
          const legacyIds = new Set(['plan-basic', 'plan-pro', 'plan-enterprise']);
          const initialLength = this.data.plans.length;
          this.data.plans = this.data.plans.filter((p) => !legacyIds.has(p.id));
          if (this.data.plans.length !== initialLength) {
            changed = true;
          }

          for (const defPlan of DEFAULT_PLANS) {
            const existingIdx = this.data.plans.findIndex(
              (p) => p.id === defPlan.id || p.name.trim().toLowerCase() === defPlan.name.trim().toLowerCase()
            );
            if (existingIdx === -1) {
              this.data.plans.push({ ...defPlan });
              changed = true;
            } else {
              // Update plan limits and price to match requested specifications
              this.data.plans[existingIdx].id = defPlan.id;
              this.data.plans[existingIdx].name = defPlan.name;
              this.data.plans[existingIdx].description = defPlan.description;
              this.data.plans[existingIdx].max_players = defPlan.max_players;
              this.data.plans[existingIdx].max_operators = defPlan.max_operators;
              this.data.plans[existingIdx].max_storage = defPlan.max_storage;
              this.data.plans[existingIdx].monthly_price = defPlan.monthly_price;
              this.data.plans[existingIdx].active = true;
              changed = true;
            }
          }

          // Remap any legacy plan IDs or ensure demo company with operators is on Call Intermediário
          if (this.data.companies) {
            for (const comp of this.data.companies) {
              const opCount = (this.data.operators || []).filter((o) => o.company_id === comp.id).length;
              if (comp.id === 'comp-demo-1' && opCount > 0 && comp.plan_id === 'plan-show-inter') {
                comp.plan_id = 'plan-call-inter';
                changed = true;
              } else if (!this.data.plans.some((p) => p.id === comp.plan_id) || comp.plan_id === 'plan-pro' || comp.plan_id === 'plan-basic' || comp.plan_id === 'plan-enterprise') {
                comp.plan_id = 'plan-call-inter';
                changed = true;
              }
            }
          }
        }

        // Ensure sub_clients, company_stores, drive_documents, and drive_settings exist
        if (!this.data.company_stores) {
          this.data.company_stores = [];
          changed = true;
        }
        if (!this.data.sub_clients) {
          this.data.sub_clients = [];
          changed = true;
        }
        if (!this.data.drive_documents) {
          this.data.drive_documents = [];
          changed = true;
        }
        if (!this.data.drive_settings) {
          this.data.drive_settings = {
            connected: false,
            root_folder_name: 'MÍDIA INDOOR - ARQUIVOS DO SISTEMA',
          };
          changed = true;
        }
        if (!this.data.r2_settings) {
          this.data.r2_settings = {
            enabled: Boolean(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID),
            account_id: process.env.R2_ACCOUNT_ID || '',
            access_key_id: process.env.R2_ACCESS_KEY_ID || '',
            secret_access_key: process.env.R2_SECRET_ACCESS_KEY || '',
            bucket_name: process.env.R2_BUCKET_NAME || '',
            public_domain: process.env.R2_PUBLIC_DOMAIN || '',
            auto_upload_on_add: true,
          };
          changed = true;
        }
        if (!this.data.sessions) {
          this.data.sessions = [];
          changed = true;
        }
        if (!this.data.proof_of_play_logs) {
          this.data.proof_of_play_logs = [];
          changed = true;
        } else if (Array.isArray(this.data.proof_of_play_logs)) {
          const seenPopIds = new Set<string>();
          const originalLen = this.data.proof_of_play_logs.length;
          this.data.proof_of_play_logs = this.data.proof_of_play_logs.filter((l) => {
            if (!l || !l.id || seenPopIds.has(l.id)) return false;
            seenPopIds.add(l.id);
            return true;
          });
          if (this.data.proof_of_play_logs.length !== originalLen) {
            changed = true;
          }
        }

        // Ensure all players have a unique persistent access_token for direct URL auto-start
        if (this.data.players && Array.isArray(this.data.players)) {
          for (const pl of this.data.players) {
            if (!pl.access_token) {
              pl.access_token = `tok_${crypto.randomBytes(16).toString('hex')}`;
              changed = true;
            }
          }
        }

        if (changed) {
          try {
            fs.writeFileSync(dbPath, JSON.stringify(this.data, null, 2), 'utf-8');
          } catch (e) {
            console.warn('[DatabaseStore] Could not write normalized cache to disk:', e);
          }
        }
      } catch {
        this.data = this.createInitialData();
        try {
          fs.writeFileSync(dbPath, JSON.stringify(this.data, null, 2), 'utf-8');
        } catch (e) {
          console.warn('[DatabaseStore] Could not write initial data to disk:', e);
        }
      }
    } else {
      this.data = this.createInitialData();
      try {
        fs.writeFileSync(dbPath, JSON.stringify(this.data, null, 2), 'utf-8');
      } catch (e) {
        console.warn('[DatabaseStore] Could not initialize disk cache:', e);
      }
    }
  }

  private save() {
    try {
      fs.writeFileSync(dbPath, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Error saving db file:', err);
    }
    // Asynchronously synchronize all data to Firebase Firestore
    queueFirestoreSync(this.data);
  }

  private mergeById<T extends { id: string; updated_at?: string }>(cloudArr: T[] = [], localArr: T[] = []): T[] {
    const map = new Map<string, T>();
    for (const item of cloudArr) {
      if (item && item.id) {
        map.set(item.id, item);
      }
    }
    for (const localItem of localArr) {
      if (!localItem || !localItem.id) continue;
      const existing = map.get(localItem.id);
      if (!existing) {
        map.set(localItem.id, localItem);
      } else if (localItem.updated_at && existing.updated_at) {
        if (new Date(localItem.updated_at).getTime() > new Date(existing.updated_at).getTime()) {
          map.set(localItem.id, localItem);
        }
      }
    }
    return Array.from(map.values());
  }

  public async initFromFirestore(): Promise<void> {
    try {
      console.log('[DatabaseStore] Checking Firebase Firestore for persisted data...');
      const res = await loadDatabaseFromFirestore();

      if (res.status === 'found') {
        const cloudData = res.data;
        const localData = this.data;

        const mergedDriveSettings: DriveSettings = {
          connected: true,
          account_email: 'cast.servicostecnicos@gmail.com',
          account_name: 'CAST Serviços Técnicos',
          account_photo: cloudData.drive_settings?.account_photo || localData.drive_settings?.account_photo,
          root_folder_id: cloudData.drive_settings?.root_folder_id || localData.drive_settings?.root_folder_id || '19aGanFfBfZABMIEwh8DDQt6zW0c0ISl1',
          root_folder_name:
            cloudData.drive_settings?.root_folder_name ||
            localData.drive_settings?.root_folder_name ||
            'MÍDIA INDOOR - ARQUIVOS DO SISTEMA',
          root_folder_url: cloudData.drive_settings?.root_folder_url || localData.drive_settings?.root_folder_url || 'https://drive.google.com/drive/folders/19aGanFfBfZABMIEwh8DDQt6zW0c0ISl1',
          access_token: cloudData.drive_settings?.access_token || localData.drive_settings?.access_token,
          refresh_token: cloudData.drive_settings?.refresh_token || localData.drive_settings?.refresh_token,
          token_expiry: cloudData.drive_settings?.token_expiry || localData.drive_settings?.token_expiry,
          last_synced_at: cloudData.drive_settings?.last_synced_at || localData.drive_settings?.last_synced_at,
        };

        // Merge sessions by token so active logins survive restarts and deploys
        const sessionMap = new Map<string, AuthSession>();
        for (const s of [...(cloudData.sessions || []), ...(localData.sessions || [])]) {
          if (s && s.token) sessionMap.set(s.token, s);
        }

        this.data = {
          users: this.mergeById(cloudData.users, localData.users),
          companies: this.mergeById(cloudData.companies, localData.companies),
          company_stores: this.mergeById(cloudData.company_stores, localData.company_stores),
          plans: this.mergeById(cloudData.plans, localData.plans),
          players: this.mergeById(cloudData.players, localData.players),
          operators: this.mergeById(cloudData.operators, localData.operators),
          playlists: this.mergeById(cloudData.playlists, localData.playlists),
          media: this.mergeById(cloudData.media, localData.media),
          rss_feeds: this.mergeById(cloudData.rss_feeds, localData.rss_feeds),
          call_phrases: this.mergeById(cloudData.call_phrases, localData.call_phrases),
          player_calls: this.mergeById(cloudData.player_calls, localData.player_calls),
          sub_clients: this.mergeById(cloudData.sub_clients, localData.sub_clients),
          drive_documents: this.mergeById(cloudData.drive_documents, localData.drive_documents),
          drive_settings: mergedDriveSettings,
          r2_settings: cloudData.r2_settings || localData.r2_settings || this.data.r2_settings,
          proof_of_play_logs: this.mergeById(cloudData.proof_of_play_logs, localData.proof_of_play_logs).slice(-5000),
          sessions: Array.from(sessionMap.values()).slice(-200),
        };

        try {
          fs.writeFileSync(dbPath, JSON.stringify(this.data, null, 2), 'utf-8');
        } catch (e) {
          console.warn('[DatabaseStore] Could not write cache to disk:', e);
        }
        await saveDatabaseToFirestoreNow(this.data);
        console.log(
          `[DatabaseStore] Restored & merged from Firebase Firestore! Loaded ${this.data.companies.length} companies, ${this.data.company_stores?.length || 0} stores, ${this.data.players.length} players, ${this.data.users.length} users.`
        );

        // Verify that all companies have Weather & Clock and RSS media items loaded
        if (this.data.companies && this.data.media) {
          const now = new Date().toISOString();
          let anyAdded = false;
          for (const comp of this.data.companies) {
            if (ensureCompanyDefaultMedia(comp.id, this.data, now)) {
              anyAdded = true;
            }
          }
          if (anyAdded) {
            try {
              fs.writeFileSync(dbPath, JSON.stringify(this.data, null, 2), 'utf-8');
              await saveDatabaseToFirestoreNow(this.data);
            } catch (e) {
              console.warn('[DatabaseStore] Could not write default media cache to disk:', e);
            }
          }
        }
      } else if (res.status === 'not_found') {
        console.log('[DatabaseStore] No prior Firestore document found. Initializing Firestore with current database...');
        await saveDatabaseToFirestoreNow(this.data);
      } else if (res.status === 'error') {
        console.error('[DatabaseStore] Network or auth error reading Firestore. Retaining local data without cloud overwrite.');
      } else if (res.status === 'unconfigured') {
        console.warn('[DatabaseStore] Firestore credentials not provided. Running in local-disk mode only.');
      }
    } catch (err) {
      console.warn('[DatabaseStore] Initial Firestore sync warning:', err);
    } finally {
      // Enable background sync for any future user operations
      enableFirestoreSync();
    }
  }

  public async syncToFirestoreNow(): Promise<boolean> {
    return await saveDatabaseToFirestoreNow(this.data);
  }

  public importBackup(newData: any): boolean {
    if (!newData || !Array.isArray(newData.users) || !newData.users.some((u: any) => u.role === 'admin')) {
      throw new Error('Arquivo de backup inválido: usuário administrador ausente ou corrompido.');
    }
    this.data = newData;
    this.save();
    return true;
  }

  public getFirestoreStatus() {
    return getFirestoreSyncStatus();
  }

  public getData(): DatabaseSchema {
    return this.data;
  }

  public persist() {
    this.save();
  }

  private createInitialData(): DatabaseSchema {
    const now = new Date().toISOString();
    const adminPass = hashPassword(process.env.ADMIN_INITIAL_PASSWORD || 'Admin@123456');
    const demoPass = hashPassword('123456');

    const adminUser: User = {
      id: 'usr-admin-1',
      name: 'Administrador Geral',
      email: 'ale11062@gmail.com',
      password_hash: adminPass.hash,
      salt: adminPass.salt,
      role: 'admin',
      company_id: null,
      active: true,
      must_change_password: true,
      created_at: now,
      updated_at: now,
    };

    const plans: Plan[] = DEFAULT_PLANS.map((p) => ({
      ...p,
      created_at: now,
      updated_at: now,
    }));

    const companyId = 'comp-demo-1';
    const companyUser: User = {
      id: 'usr-comp-1',
      name: 'Gerente Drogaria São Paulo',
      email: 'empresa@drogariasp.com.br',
      password_hash: demoPass.hash,
      salt: demoPass.salt,
      role: 'company',
      company_id: companyId,
      active: true,
      must_change_password: false,
      created_at: now,
      updated_at: now,
    };

    const company: Company = {
      id: companyId,
      legal_name: 'Drogaria São Paulo S/A',
      trade_name: 'Drogaria São Paulo - Matriz',
      cnpj: '61.412.110/0001-55',
      email: 'contato@drogariasp.com.br',
      phone: '(11) 3345-8000',
      responsible: 'Roberto Ferreira',
      address: 'Av. Paulista, 1000',
      city: 'São Paulo',
      state: 'SP',
      plan_id: 'plan-call-inter',
      start_date: '2026-01-01',
      due_date: '2027-01-01',
      status: 'active',
      created_at: now,
      updated_at: now,
    };

    const operatorUser: User = {
      id: 'usr-op-1',
      name: 'Carlos Atendimento',
      email: 'operador@drogariasp.com.br',
      password_hash: demoPass.hash,
      salt: demoPass.salt,
      role: 'operator',
      company_id: companyId,
      active: true,
      must_change_password: false,
      created_at: now,
      updated_at: now,
    };

    const operator: Operator = {
      id: 'op-1',
      company_id: companyId,
      user_id: operatorUser.id,
      name: 'Carlos Atendimento',
      email: 'operador@drogariasp.com.br',
      phone: '(11) 98765-4321',
      active: true,
      created_at: now,
      updated_at: now,
    };

    const playerUser1: User = {
      id: 'usr-play-1',
      name: 'Player Recepção',
      email: 'player1@drogariasp.com.br',
      password_hash: demoPass.hash,
      salt: demoPass.salt,
      role: 'player',
      company_id: companyId,
      active: true,
      must_change_password: false,
      created_at: now,
      updated_at: now,
    };

    const playerUser2: User = {
      id: 'usr-play-2',
      name: 'Player Caixa 02',
      email: 'player2@drogariasp.com.br',
      password_hash: demoPass.hash,
      salt: demoPass.salt,
      role: 'player',
      company_id: companyId,
      active: true,
      must_change_password: false,
      created_at: now,
      updated_at: now,
    };

    const mediaList: Media[] = [
      {
        id: 'med-1',
        company_id: companyId,
        name: 'Ofertas da Semana - Até 40% OFF',
        type: 'image',
        file_url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" width="1920" height="1080"><defs><linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%230f172a"/><stop offset="100%" stop-color="%231e3a8a"/></linearGradient></defs><rect width="1920" height="1080" fill="url(%23bg)"/><circle cx="1600" cy="250" r="380" fill="%232563eb" opacity="0.15"/><circle cx="200" cy="900" r="300" fill="%2338bdf8" opacity="0.1"/><rect x="120" y="100" width="220" height="48" rx="8" fill="%232563eb"/><text x="140" y="132" fill="%23ffffff" font-size="22" font-family="system-ui, sans-serif" font-weight="bold">DROGARIA SÃO PAULO</text><text x="120" y="320" fill="%2338bdf8" font-size="38" font-family="system-ui, sans-serif" font-weight="bold" letter-spacing="4">SEMANA DA SAÚDE E BEM-ESTAR</text><text x="120" y="440" fill="%23ffffff" font-size="82" font-family="system-ui, sans-serif" font-weight="900">ATÉ 40% DE DESCONTO</text><text x="120" y="540" fill="%2394a3b8" font-size="34" font-family="system-ui, sans-serif">Em medicamentos selecionados, dermocosméticos e vitaminas.</text><rect x="120" y="640" width="560" height="180" rx="16" fill="%231e293b" stroke="%23334155" stroke-width="2"/><text x="160" y="710" fill="%2338bdf8" font-size="26" font-family="system-ui, sans-serif" font-weight="bold">CONSULTE NOSSO FARMACÊUTICO</text><text x="160" y="760" fill="%23cbd5e1" font-size="22" font-family="system-ui, sans-serif">Aferição de pressão e testes rápidos disponíveis no guichê 2.</text></svg>',
        duration: 8,
        active: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: 'med-2',
        company_id: companyId,
        name: 'Horário de Atendimento e Delivery',
        type: 'image',
        file_url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" width="1920" height="1080"><defs><linearGradient id="bg2" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23091e3a"/><stop offset="100%" stop-color="%230f172a"/></linearGradient></defs><rect width="1920" height="1080" fill="url(%23bg2)"/><rect x="120" y="100" width="220" height="48" rx="8" fill="%2310b981"/><text x="140" y="132" fill="%23ffffff" font-size="22" font-family="system-ui, sans-serif" font-weight="bold">ATENDIMENTO 24 HORAS</text><text x="120" y="320" fill="%2334d399" font-size="38" font-family="system-ui, sans-serif" font-weight="bold">COMODIDADE PARA VOCÊ</text><text x="120" y="440" fill="%23ffffff" font-size="78" font-family="system-ui, sans-serif" font-weight="900">RECEBA SEUS MEDICAMENTOS EM CASA</text><text x="120" y="540" fill="%2394a3b8" font-size="34" font-family="system-ui, sans-serif">Peça pelo WhatsApp oficial ou aplicativo com entrega expressa em até 45 minutos.</text><g transform="translate(120, 650)"><rect width="450" height="140" rx="12" fill="%231e293b"/><text x="40" y="60" fill="%2338bdf8" font-size="22" font-family="system-ui, sans-serif">WHATSAPP OFICIAL</text><text x="40" y="105" fill="%23ffffff" font-size="32" font-family="system-ui, sans-serif" font-weight="bold">(11) 98765-0000</text></g></svg>',
        duration: 8,
        active: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: 'med-3',
        company_id: companyId,
        name: 'Dica de Saúde - Hidratação Diária',
        type: 'image',
        file_url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" width="1920" height="1080"><defs><linearGradient id="bg3" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23172554"/><stop offset="100%" stop-color="%231e293b"/></linearGradient></defs><rect width="1920" height="1080" fill="url(%23bg3)"/><rect x="120" y="100" width="180" height="48" rx="8" fill="%230284c7"/><text x="140" y="132" fill="%23ffffff" font-size="22" font-family="system-ui, sans-serif" font-weight="bold">DICA DE SAÚDE</text><text x="120" y="320" fill="%2338bdf8" font-size="36" font-family="system-ui, sans-serif" font-weight="bold">CUIDE DO SEU CORPO</text><text x="120" y="440" fill="%23ffffff" font-size="80" font-family="system-ui, sans-serif" font-weight="900">VOCÊ JÁ BEBEU ÁGUA HOJE?</text><text x="120" y="540" fill="%2394a3b8" font-size="34" font-family="system-ui, sans-serif">A hidratação regular melhora a disposição, circulação e o funcionamento renal.</text><rect x="120" y="650" width="700" height="140" rx="14" fill="%230f172a" stroke="%23334155" stroke-width="2"/><text x="160" y="715" fill="%2338bdf8" font-size="24" font-family="system-ui, sans-serif" font-weight="bold">RECOMENDAÇÃO MÉDICA</text><text x="160" y="755" fill="%23e2e8f0" font-size="20" font-family="system-ui, sans-serif">Consuma no mínimo 2 litros de água filtrada ao longo do dia.</text></svg>',
        duration: 8,
        active: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: 'med-weather-clock',
        company_id: companyId,
        name: 'Hora Certa & Previsão do Tempo',
        type: 'weather_clock',
        file_url: 'widget:weather_clock',
        duration: 12,
        active: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: 'med-rss-saude',
        company_id: companyId,
        name: 'Notícias RSS - Saúde & Bem-Estar',
        type: 'rss',
        file_url: 'https://g1.globo.com/rss/g1/saude/',
        duration: 15,
        active: true,
        created_at: now,
        updated_at: now,
      }
    ];

    const playlistId = 'pl-1';
    const playlist: Playlist = {
      id: playlistId,
      company_id: companyId,
      name: 'Programação Recepção Geral',
      description: 'Loop institucional com promoções, dicas de saúde, clima/hora e notícias em tempo real.',
      weather_city: 'São Paulo',
      active: true,
      items: [
        {
          id: 'pli-1',
          playlist_id: playlistId,
          media_id: 'med-1',
          position: 1,
          duration: 8,
          created_at: now,
        },
        {
          id: 'pli-2',
          playlist_id: playlistId,
          media_id: 'med-2',
          position: 2,
          duration: 8,
          created_at: now,
        },
        {
          id: 'pli-3',
          playlist_id: playlistId,
          media_id: 'med-3',
          position: 3,
          duration: 8,
          created_at: now,
        },
        {
          id: 'pli-4',
          playlist_id: playlistId,
          media_id: 'med-weather-clock',
          position: 4,
          duration: 12,
          created_at: now,
        },
        {
          id: 'pli-5',
          playlist_id: playlistId,
          media_id: 'med-rss-saude',
          position: 5,
          duration: 15,
          created_at: now,
        }
      ],
      created_at: now,
      updated_at: now,
    };

    const players: Player[] = [
      {
        id: 'play-1',
        company_id: companyId,
        user_id: playerUser1.id,
        name: 'PLAYER RECEPÇÃO',
        code: 'PLAY-REC-01',
        location: 'Hall de Entrada Principal',
        description: 'Smart TV 55 polegadas na recepção principal.',
        orientation: 'horizontal',
        playlist_id: playlistId,
        status: 'active',
        access_token: 'tok_play_rec_01_a9f8b2c4',
        last_seen: new Date().toISOString(), // Online
        created_at: now,
        updated_at: now,
      },
      {
        id: 'play-2',
        company_id: companyId,
        user_id: playerUser2.id,
        name: 'PLAYER SALA 02 (TOTEM)',
        code: 'PLAY-SALA-02',
        location: 'Sala de Espera 02',
        description: 'Totem digital vertical 9:16 na sala de espera.',
        orientation: 'vertical',
        playlist_id: playlistId,
        status: 'active',
        access_token: 'tok_play_sala_02_e7d1c3b5',
        last_seen: new Date(Date.now() - 3600000).toISOString(), // Offline (1h ago)
        created_at: now,
        updated_at: now,
      }
    ];

    const callPhrases: CallPhrase[] = [];

    const rssFeeds: RssFeed[] = DEFAULT_RSS_FEEDS.map((feed, idx) => ({
      id: `rss-${idx + 1}`,
      company_id: companyId,
      name: feed.name,
      url: feed.url,
      active: true,
      created_at: now,
      updated_at: now,
    }));

    return {
      users: [adminUser, companyUser, operatorUser, playerUser1, playerUser2],
      companies: [company],
      plans,
      players,
      operators: [operator],
      playlists: [playlist],
      media: mediaList,
      rss_feeds: rssFeeds,
      call_phrases: callPhrases,
      player_calls: [],
      sub_clients: [
        {
          id: 'sub-cli-1',
          company_id: companyId,
          name: 'Dr. Roberto Rocha (Consultório 02)',
          code: 'CLI-001',
          phone: '(11) 98111-2233',
          email: 'roberto@clinicaexemplo.com.br',
          notes: 'Cliente atendido frequentemente para serviços de saúde.',
          created_at: now,
          updated_at: now,
        },
        {
          id: 'sub-cli-2',
          company_id: companyId,
          name: 'Farmácia Central Distribuidora',
          code: 'CLI-002',
          phone: '(11) 98222-3344',
          email: 'central@farmaciaexemplo.com.br',
          notes: 'Cliente comercial para orçamentos e pedidos de mídias.',
          created_at: now,
          updated_at: now,
        },
      ],
      drive_documents: [],
      drive_settings: {
        connected: false,
        root_folder_name: 'MÍDIA INDOOR - ARQUIVOS DO SISTEMA',
      },
      r2_settings: {
        enabled: Boolean(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID),
        account_id: process.env.R2_ACCOUNT_ID || '',
        access_key_id: process.env.R2_ACCESS_KEY_ID || '',
        secret_access_key: process.env.R2_SECRET_ACCESS_KEY || '',
        bucket_name: process.env.R2_BUCKET_NAME || '',
        public_domain: process.env.R2_PUBLIC_DOMAIN || '',
        auto_upload_on_add: true,
      },
      proof_of_play_logs: [],
      sessions: [],
    };
  }

  // ==========================================
  // SESSIONS MANAGEMENT (PERSISTENT SESSIONS)
  // ==========================================
  public getSession(token: string): AuthSession | undefined {
    if (!token || !this.data.sessions) return undefined;
    const found = this.data.sessions.find((s) => s.token === token);
    if (found) {
      // Normalize any session created by client fallback
      if (!found.userId && (found as any).user_id) {
        found.userId = (found as any).user_id;
      }
      if (found.companyId === undefined && (found as any).company_id !== undefined) {
        found.companyId = (found as any).company_id;
      }
      if (!found.playerId && (found as any).player_id) {
        found.playerId = (found as any).player_id;
      }
      if (!found.createdAt && (found as any).created_at) {
        found.createdAt = (found as any).created_at;
      }
      return found;
    }
    return undefined;
  }

  public saveSession(session: AuthSession): void {
    if (!this.data.sessions) {
      this.data.sessions = [];
    }
    const idx = this.data.sessions.findIndex((s) => s.token === session.token);
    if (idx >= 0) {
      this.data.sessions[idx] = session;
    } else {
      this.data.sessions.push(session);
    }
    // Prune sessions older than 30 days to prevent bloat
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    if (this.data.sessions.length > 500) {
      this.data.sessions = this.data.sessions.filter((s) => s.createdAt > thirtyDaysAgo);
    }
    this.save();
  }

  public removeSession(token: string): void {
    if (!this.data.sessions) return;
    const initialLen = this.data.sessions.length;
    this.data.sessions = this.data.sessions.filter((s) => s.token !== token);
    if (this.data.sessions.length !== initialLen) {
      this.save();
    }
  }

  public removeUserSessions(userId: string): void {
    if (!this.data.sessions) return;
    const initialLen = this.data.sessions.length;
    this.data.sessions = this.data.sessions.filter((s) => s.userId !== userId);
    if (this.data.sessions.length !== initialLen) {
      this.save();
    }
  }

  // ==========================================
  // COMPANY STORES / LOJAS DA REDE (MATRIZ -> FILIAIS)
  // ==========================================
  public getCompanyStores(companyId?: string): CompanyStore[] {
    if (!this.data.company_stores) {
      this.data.company_stores = [];
    }
    if (companyId) {
      return this.data.company_stores.filter((s) => s.company_id === companyId);
    }
    return this.data.company_stores;
  }

  public getCompanyStore(id: string): CompanyStore | undefined {
    return (this.data.company_stores || []).find((s) => s.id === id);
  }

  public createCompanyStore(data: Omit<CompanyStore, 'id' | 'created_at' | 'updated_at'>): CompanyStore {
    const now = new Date().toISOString();
    if (!this.data.company_stores) this.data.company_stores = [];
    const existingCount = this.data.company_stores.filter((s) => s.company_id === data.company_id).length;
    const item: CompanyStore = {
      ...data,
      code: data.code || `LOJA-0${existingCount + 1}`,
      status: data.status || 'active',
      id: `store-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      created_at: now,
      updated_at: now,
    };
    this.data.company_stores.push(item);
    const comp = this.data.companies.find((c) => c.id === data.company_id);
    if (comp) {
      comp.is_network = true;
      comp.updated_at = now;
    }
    this.save();
    return item;
  }

  public updateCompanyStore(id: string, updates: Partial<CompanyStore>): CompanyStore | null {
    if (!this.data.company_stores) return null;
    const idx = this.data.company_stores.findIndex((s) => s.id === id);
    if (idx === -1) return null;
    this.data.company_stores[idx] = {
      ...this.data.company_stores[idx],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    this.save();
    return this.data.company_stores[idx];
  }

  public deleteCompanyStore(id: string): boolean {
    if (!this.data.company_stores) return false;
    const initial = this.data.company_stores.length;
    this.data.company_stores = this.data.company_stores.filter((s) => s.id !== id);
    if (this.data.company_stores.length !== initial) {
      // Unlink store_id from players, operators, and playlists
      for (const p of this.data.players || []) {
        if (p.store_id === id) p.store_id = null;
      }
      for (const op of this.data.operators || []) {
        if (op.store_id === id) op.store_id = null;
      }
      for (const pl of this.data.playlists || []) {
        if (pl.store_id === id) pl.store_id = null;
      }
      this.save();
      return true;
    }
    return false;
  }

  // ==========================================
  // SUB-CLIENTS (CLIENTES DO CLIENTE A)
  // ==========================================
  public getSubClients(companyId?: string): SubClient[] {
    if (companyId) {
      return (this.data.sub_clients || []).filter((s) => s.company_id === companyId);
    }
    return this.data.sub_clients || [];
  }

  public getSubClient(id: string): SubClient | undefined {
    return (this.data.sub_clients || []).find((s) => s.id === id);
  }

  public createSubClient(data: Omit<SubClient, 'id' | 'created_at' | 'updated_at'>): SubClient {
    const now = new Date().toISOString();
    const item: SubClient = {
      ...data,
      id: `sub-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      created_at: now,
      updated_at: now,
    };
    if (!this.data.sub_clients) this.data.sub_clients = [];
    this.data.sub_clients.push(item);
    this.save();
    return item;
  }

  public updateSubClient(id: string, updates: Partial<SubClient>): SubClient | null {
    if (!this.data.sub_clients) return null;
    const idx = this.data.sub_clients.findIndex((s) => s.id === id);
    if (idx === -1) return null;
    this.data.sub_clients[idx] = {
      ...this.data.sub_clients[idx],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    this.save();
    return this.data.sub_clients[idx];
  }

  public deleteSubClient(id: string): boolean {
    if (!this.data.sub_clients) return false;
    const initial = this.data.sub_clients.length;
    this.data.sub_clients = this.data.sub_clients.filter((s) => s.id !== id);
    if (this.data.sub_clients.length !== initial) {
      if (this.data.drive_documents) {
        this.data.drive_documents = this.data.drive_documents.filter((d) => d.sub_client_id !== id);
      }
      this.save();
      return true;
    }
    return false;
  }

  // ==========================================
  // DRIVE DOCUMENTS & FOTOS VINCULADAS
  // ==========================================
  public getDriveDocuments(filter?: {
    companyId?: string;
    subClientId?: string;
    category?: string;
  }): DriveDocument[] {
    const docs = this.data.drive_documents || [];
    return docs.filter((d) => {
      if (filter?.companyId && d.company_id !== filter.companyId) return false;
      if (filter?.subClientId && d.sub_client_id !== filter.subClientId) return false;
      if (filter?.category && d.category !== filter.category) return false;
      return true;
    });
  }

  public getDriveDocument(id: string): DriveDocument | undefined {
    return (this.data.drive_documents || []).find((d) => d.id === id);
  }

  public createDriveDocument(data: Omit<DriveDocument, 'id' | 'created_at' | 'updated_at'>): DriveDocument {
    const now = new Date().toISOString();
    const item: DriveDocument = {
      ...data,
      id: `doc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      created_at: now,
      updated_at: now,
    };
    if (!this.data.drive_documents) this.data.drive_documents = [];
    this.data.drive_documents.push(item);
    this.save();
    return item;
  }

  public updateDriveDocument(id: string, updates: Partial<DriveDocument>): DriveDocument | null {
    if (!this.data.drive_documents) return null;
    const idx = this.data.drive_documents.findIndex((d) => d.id === id);
    if (idx === -1) return null;
    this.data.drive_documents[idx] = {
      ...this.data.drive_documents[idx],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    this.save();
    return this.data.drive_documents[idx];
  }

  public deleteDriveDocument(id: string): boolean {
    if (!this.data.drive_documents) return false;
    const initial = this.data.drive_documents.length;
    this.data.drive_documents = this.data.drive_documents.filter((d) => d.id !== id);
    if (this.data.drive_documents.length !== initial) {
      this.save();
      return true;
    }
    return false;
  }

  // ==========================================
  // DRIVE SETTINGS (CONEXÃO ESCOLHIDA PELO DEV: cast.servicostecnicos@gmail.com)
  // ==========================================
  public getDriveSettings(): DriveSettings {
    if (!this.data.drive_settings) {
      this.data.drive_settings = {
        connected: true,
        account_email: 'cast.servicostecnicos@gmail.com',
        account_name: 'CAST Serviços Técnicos',
        root_folder_name: 'MÍDIA INDOOR - ARQUIVOS DO SISTEMA',
        root_folder_id: '19aGanFfBfZABMIEwh8DDQt6zW0c0ISl1',
        root_folder_url: 'https://drive.google.com/drive/folders/19aGanFfBfZABMIEwh8DDQt6zW0c0ISl1',
      };
    } else {
      // Garantir sempre a conta oficial cast.servicostecnicos@gmail.com
      if (!this.data.drive_settings.account_email || this.data.drive_settings.account_email === 'ti.servicos-tecnicos@gmail.com') {
        this.data.drive_settings.account_email = 'cast.servicostecnicos@gmail.com';
        this.data.drive_settings.account_name = 'CAST Serviços Técnicos';
      }
      // Sempre manter ativa para carregar sem necessidade de criar token toda vez
      this.data.drive_settings.connected = true;
      if (!this.data.drive_settings.root_folder_name) {
        this.data.drive_settings.root_folder_name = 'MÍDIA INDOOR - ARQUIVOS DO SISTEMA';
      }
      if (!this.data.drive_settings.root_folder_id) {
        this.data.drive_settings.root_folder_id = '19aGanFfBfZABMIEwh8DDQt6zW0c0ISl1';
      }
      if (!this.data.drive_settings.root_folder_url) {
        this.data.drive_settings.root_folder_url = 'https://drive.google.com/drive/folders/19aGanFfBfZABMIEwh8DDQt6zW0c0ISl1';
      }
    }
    return this.data.drive_settings;
  }

  public updateDriveSettings(settings: Partial<DriveSettings>): DriveSettings {
    const current = this.getDriveSettings();
    const cleanUpdates: Record<string, any> = {};
    for (const [k, v] of Object.entries(settings)) {
      if (v !== undefined) {
        cleanUpdates[k] = v;
      }
    }

    const targetEmail = cleanUpdates.account_email || current.account_email || 'cast.servicostecnicos@gmail.com';
    const targetName = cleanUpdates.account_name || current.account_name || 'Conta da Empresa';

    cleanUpdates.connected = true;
    cleanUpdates.account_email = targetEmail;
    cleanUpdates.account_name = targetName;

    this.data.drive_settings = {
      ...current,
      ...cleanUpdates,
      connected: true,
      account_email: targetEmail,
      account_name: targetName,
      last_synced_at: new Date().toISOString(),
    };
    this.save();
    return this.data.drive_settings;
  }

  // ==========================================
  // CLOUDFLARE R2 OBJECT STORAGE SETTINGS
  // ==========================================
  public getR2Settings(): R2Settings {
    if (!this.data.r2_settings) {
      this.data.r2_settings = {
        enabled: Boolean(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID),
        account_id: process.env.R2_ACCOUNT_ID || '',
        access_key_id: process.env.R2_ACCESS_KEY_ID || '',
        secret_access_key: process.env.R2_SECRET_ACCESS_KEY || '',
        bucket_name: process.env.R2_BUCKET_NAME || '',
        public_domain: process.env.R2_PUBLIC_DOMAIN || '',
        auto_upload_on_add: true,
      };
    }
    return this.data.r2_settings;
  }

  public updateR2Settings(settings: Partial<R2Settings>): R2Settings {
    const current = this.getR2Settings();
    this.data.r2_settings = {
      ...current,
      ...settings,
    };
    this.save();
    return this.data.r2_settings;
  }

  // ==========================================
  // CARREGAR / RESTAURAR DADOS DE TESTE (DEMO)
  // ==========================================
  public seedDemoData(): {
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
  } {
    const now = new Date().toISOString();
    const demoPass = hashPassword('123456');

    // 1. Garantir que os planos padrão existam
    if (!this.data.plans || this.data.plans.length === 0) {
      this.data.plans = DEFAULT_PLANS.map((p) => ({
        ...p,
        created_at: now,
        updated_at: now,
      }));
    } else {
      for (const defPlan of DEFAULT_PLANS) {
        if (!this.data.plans.some((p) => p.id === defPlan.id)) {
          this.data.plans.push({
            ...defPlan,
            created_at: now,
            updated_at: now,
          });
        }
      }
    }

    // 2. Garantir usuário Administrador Geral (preserva o atual se já existir)
    const existingAdmin = this.data.users.find((u) => u.role === 'admin' && u.email.toLowerCase() === 'ale11062@gmail.com');
    if (!existingAdmin) {
      const adminPass = hashPassword(process.env.ADMIN_INITIAL_PASSWORD || 'Admin@123456');
      this.data.users.unshift({
        id: 'usr-admin-1',
        name: 'Administrador Geral',
        email: 'ale11062@gmail.com',
        password_hash: adminPass.hash,
        salt: adminPass.salt,
        role: 'admin',
        company_id: null,
        active: true,
        must_change_password: false,
        created_at: now,
        updated_at: now,
      });
    }

    // 3. Remover registros demo antigos para recriação limpa sem conflitos
    const demoCompanyIds = ['comp-demo-1', 'comp-demo-2'];
    const demoUserEmails = [
      'empresa@drogariasp.com.br',
      'contato@drogariasp.com.br',
      'operador@drogariasp.com.br',
      'player1@drogariasp.com.br',
      'player2@drogariasp.com.br',
      'empresa@supermercado.com.br',
      'contato@supermercado.com.br',
      'operador@supermercado.com.br',
      'player@supermercado.com.br',
    ];

    this.data.companies = this.data.companies.filter((c) => !demoCompanyIds.includes(c.id));
    this.data.users = this.data.users.filter(
      (u) => !demoCompanyIds.includes(u.company_id || '') && !demoUserEmails.includes(u.email.toLowerCase())
    );
    this.data.operators = this.data.operators.filter((o) => !demoCompanyIds.includes(o.company_id));
    this.data.players = this.data.players.filter((p) => !demoCompanyIds.includes(p.company_id));
    this.data.playlists = this.data.playlists.filter((pl) => !demoCompanyIds.includes(pl.company_id));
    this.data.media = this.data.media.filter((m) => !demoCompanyIds.includes(m.company_id));
    this.data.rss_feeds = this.data.rss_feeds.filter((r) => !demoCompanyIds.includes(r.company_id));
    this.data.call_phrases = (this.data.call_phrases || []).filter((cp) => !demoCompanyIds.includes(cp.company_id));
    this.data.sub_clients = (this.data.sub_clients || []).filter((sc) => !demoCompanyIds.includes(sc.company_id));

    // =========================================================================
    // CLIENTE 1: DROGARIA SÃO PAULO (FARMÁCIA & SAÚDE)
    // =========================================================================
    const comp1Id = 'comp-demo-1';
    const comp1: Company = {
      id: comp1Id,
      legal_name: 'Drogaria São Paulo S/A',
      trade_name: 'Drogaria São Paulo - Matriz',
      cnpj: '61.412.110/0001-55',
      email: 'contato@drogariasp.com.br',
      phone: '(11) 3345-8000',
      responsible: 'Roberto Ferreira',
      address: 'Av. Paulista, 1000 - Bela Vista',
      city: 'São Paulo',
      state: 'SP',
      plan_id: 'plan-call-inter',
      start_date: '2026-01-01',
      due_date: '2027-01-01',
      status: 'active',
      created_at: now,
      updated_at: now,
    };

    const comp1User: User = {
      id: 'usr-comp-1',
      name: 'Gerente Drogaria São Paulo',
      email: 'empresa@drogariasp.com.br',
      password_hash: demoPass.hash,
      salt: demoPass.salt,
      role: 'company',
      company_id: comp1Id,
      active: true,
      must_change_password: false,
      created_at: now,
      updated_at: now,
    };

    const op1User: User = {
      id: 'usr-op-1',
      name: 'Carlos Atendimento',
      email: 'operador@drogariasp.com.br',
      password_hash: demoPass.hash,
      salt: demoPass.salt,
      role: 'operator',
      company_id: comp1Id,
      active: true,
      must_change_password: false,
      created_at: now,
      updated_at: now,
    };

    const op1: Operator = {
      id: 'op-1',
      company_id: comp1Id,
      user_id: op1User.id,
      name: 'Carlos Atendimento - Balcão 01',
      email: 'operador@drogariasp.com.br',
      phone: '(11) 98765-4321',
      active: true,
      created_at: now,
      updated_at: now,
    };

    const play1User: User = {
      id: 'usr-play-1',
      name: 'Player Recepção',
      email: 'player1@drogariasp.com.br',
      password_hash: demoPass.hash,
      salt: demoPass.salt,
      role: 'player',
      company_id: comp1Id,
      active: true,
      must_change_password: false,
      created_at: now,
      updated_at: now,
    };

    const play2User: User = {
      id: 'usr-play-2',
      name: 'Player Caixa 02',
      email: 'player2@drogariasp.com.br',
      password_hash: demoPass.hash,
      salt: demoPass.salt,
      role: 'player',
      company_id: comp1Id,
      active: true,
      must_change_password: false,
      created_at: now,
      updated_at: now,
    };

    const comp1Media: Media[] = [
      {
        id: 'med-1',
        company_id: comp1Id,
        name: 'Ofertas da Semana - Até 40% OFF',
        type: 'image',
        file_url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" width="1920" height="1080"><defs><linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%230f172a"/><stop offset="100%" stop-color="%231e3a8a"/></linearGradient></defs><rect width="1920" height="1080" fill="url(%23bg)"/><circle cx="1600" cy="250" r="380" fill="%232563eb" opacity="0.15"/><circle cx="200" cy="900" r="300" fill="%2338bdf8" opacity="0.1"/><rect x="120" y="100" width="280" height="52" rx="10" fill="%232563eb"/><text x="140" y="134" fill="%23ffffff" font-size="22" font-family="system-ui, sans-serif" font-weight="bold">DROGARIA SÃO PAULO</text><text x="120" y="320" fill="%2338bdf8" font-size="38" font-family="system-ui, sans-serif" font-weight="bold" letter-spacing="4">SEMANA DA SAÚDE E BEM-ESTAR</text><text x="120" y="440" fill="%23ffffff" font-size="82" font-family="system-ui, sans-serif" font-weight="900">ATÉ 40% DE DESCONTO</text><text x="120" y="540" fill="%2394a3b8" font-size="34" font-family="system-ui, sans-serif">Em medicamentos selecionados, dermocosméticos e vitaminas.</text><rect x="120" y="640" width="600" height="180" rx="16" fill="%231e293b" stroke="%23334155" stroke-width="2"/><text x="160" y="710" fill="%2338bdf8" font-size="26" font-family="system-ui, sans-serif" font-weight="bold">CONSULTE NOSSO FARMACÊUTICO</text><text x="160" y="760" fill="%23cbd5e1" font-size="22" font-family="system-ui, sans-serif">Aferição de pressão e testes rápidos no guichê 01.</text></svg>',
        duration: 8,
        active: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: 'med-2',
        company_id: comp1Id,
        name: 'Horário de Atendimento e Delivery',
        type: 'image',
        file_url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" width="1920" height="1080"><defs><linearGradient id="bg2" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23091e3a"/><stop offset="100%" stop-color="%230f172a"/></linearGradient></defs><rect width="1920" height="1080" fill="url(%23bg2)"/><rect x="120" y="100" width="260" height="52" rx="10" fill="%2310b981"/><text x="140" y="134" fill="%23ffffff" font-size="22" font-family="system-ui, sans-serif" font-weight="bold">ATENDIMENTO 24 HORAS</text><text x="120" y="320" fill="%2334d399" font-size="38" font-family="system-ui, sans-serif" font-weight="bold">COMODIDADE PARA VOCÊ</text><text x="120" y="440" fill="%23ffffff" font-size="78" font-family="system-ui, sans-serif" font-weight="900">RECEBA MEDICAMENTOS EM CASA</text><text x="120" y="540" fill="%2394a3b8" font-size="34" font-family="system-ui, sans-serif">Peça pelo WhatsApp oficial com entrega expressa em até 45 minutos.</text><g transform="translate(120, 650)"><rect width="450" height="140" rx="14" fill="%231e293b" stroke="%23334155" stroke-width="2"/><text x="40" y="60" fill="%2338bdf8" font-size="22" font-family="system-ui, sans-serif">WHATSAPP OFICIAL</text><text x="40" y="105" fill="%23ffffff" font-size="32" font-family="system-ui, sans-serif" font-weight="bold">(11) 98765-0000</text></g></svg>',
        duration: 8,
        active: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: 'med-3',
        company_id: comp1Id,
        name: 'Dica de Saúde - Hidratação Diária',
        type: 'image',
        file_url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" width="1920" height="1080"><defs><linearGradient id="bg3" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23172554"/><stop offset="100%" stop-color="%231e293b"/></linearGradient></defs><rect width="1920" height="1080" fill="url(%23bg3)"/><rect x="120" y="100" width="200" height="52" rx="10" fill="%230284c7"/><text x="140" y="134" fill="%23ffffff" font-size="22" font-family="system-ui, sans-serif" font-weight="bold">DICA DE SAÚDE</text><text x="120" y="320" fill="%2338bdf8" font-size="36" font-family="system-ui, sans-serif" font-weight="bold">CUIDE DO SEU CORPO</text><text x="120" y="440" fill="%23ffffff" font-size="80" font-family="system-ui, sans-serif" font-weight="900">VOCÊ JÁ BEBEU ÁGUA HOJE?</text><text x="120" y="540" fill="%2394a3b8" font-size="34" font-family="system-ui, sans-serif">A hidratação regular melhora a disposição, circulação e o funcionamento renal.</text><rect x="120" y="650" width="700" height="140" rx="14" fill="%230f172a" stroke="%23334155" stroke-width="2"/><text x="160" y="715" fill="%2338bdf8" font-size="24" font-family="system-ui, sans-serif" font-weight="bold">RECOMENDAÇÃO MÉDICA</text><text x="160" y="755" fill="%23e2e8f0" font-size="20" font-family="system-ui, sans-serif">Consuma no mínimo 2 litros de água filtrada ao longo do dia.</text></svg>',
        duration: 8,
        active: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: 'med-weather-clock',
        company_id: comp1Id,
        name: 'Hora Certa & Previsão do Tempo',
        type: 'weather_clock',
        file_url: 'widget:weather_clock',
        duration: 12,
        active: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: 'med-rss-saude',
        company_id: comp1Id,
        name: 'Notícias RSS - Saúde & Bem-Estar',
        type: 'rss',
        file_url: 'https://g1.globo.com/rss/g1/saude/',
        duration: 15,
        active: true,
        created_at: now,
        updated_at: now,
      },
    ];

    const pl1Id = 'pl-1';
    const pl1: Playlist = {
      id: pl1Id,
      company_id: comp1Id,
      name: 'Programação Recepção Geral',
      description: 'Loop institucional com promoções, dicas de saúde, clima/hora e notícias em tempo real.',
      weather_city: 'São Paulo',
      active: true,
      items: [
        { id: 'pli-1', playlist_id: pl1Id, media_id: 'med-1', position: 1, duration: 8, created_at: now },
        { id: 'pli-2', playlist_id: pl1Id, media_id: 'med-2', position: 2, duration: 8, created_at: now },
        { id: 'pli-3', playlist_id: pl1Id, media_id: 'med-3', position: 3, duration: 8, created_at: now },
        { id: 'pli-4', playlist_id: pl1Id, media_id: 'med-weather-clock', position: 4, duration: 12, created_at: now },
        { id: 'pli-5', playlist_id: pl1Id, media_id: 'med-rss-saude', position: 5, duration: 15, created_at: now },
      ],
      created_at: now,
      updated_at: now,
    };

    const comp1Players: Player[] = [
      {
        id: 'play-1',
        company_id: comp1Id,
        user_id: play1User.id,
        name: 'PLAYER RECEPÇÃO',
        code: 'PLAY-REC-01',
        location: 'Hall de Entrada Principal',
        description: 'Smart TV 55 polegadas na recepção principal.',
        orientation: 'horizontal',
        playlist_id: pl1Id,
        status: 'active',
        access_token: 'tok_play_rec_01_a9f8b2c4',
        last_seen: new Date().toISOString(),
        created_at: now,
        updated_at: now,
      },
      {
        id: 'play-2',
        company_id: comp1Id,
        user_id: play2User.id,
        name: 'PLAYER SALA 02 (TOTEM)',
        code: 'PLAY-SALA-02',
        location: 'Sala de Espera 02',
        description: 'Totem digital vertical 9:16 na sala de espera.',
        orientation: 'vertical',
        playlist_id: pl1Id,
        status: 'active',
        access_token: 'tok_play_sala_02_e7d1c3b5',
        last_seen: new Date(Date.now() - 3600000).toISOString(),
        created_at: now,
        updated_at: now,
      },
    ];

    const comp1Phrases: CallPhrase[] = [
      { id: 'ph-1', company_id: comp1Id, operator_id: null, phrase: 'Senha normal no Balcão 01', active: true, created_at: now, updated_at: now },
      { id: 'ph-2', company_id: comp1Id, operator_id: null, phrase: 'Atendimento preferencial no Caixa 02', active: true, created_at: now, updated_at: now },
      { id: 'ph-3', company_id: comp1Id, operator_id: null, phrase: 'Retirada de medicamentos no Guichê 03', active: true, created_at: now, updated_at: now },
    ];

    const comp1Rss: RssFeed[] = DEFAULT_RSS_FEEDS.map((feed, idx) => ({
      id: `rss-comp1-${idx + 1}`,
      company_id: comp1Id,
      name: feed.name,
      url: feed.url,
      active: true,
      created_at: now,
      updated_at: now,
    }));

    // =========================================================================
    // CLIENTE 2: SUPERMERCADO CENTRAL HORTIFRUTI (VAREJO & ALIMENTOS)
    // =========================================================================
    const comp2Id = 'comp-demo-2';
    const comp2: Company = {
      id: comp2Id,
      legal_name: 'Supermercado Central Alimentos Ltda',
      trade_name: 'Supermercado Central Hortifruti',
      cnpj: '72.523.220/0001-66',
      email: 'contato@supermercado.com.br',
      phone: '(11) 3456-7890',
      responsible: 'Mariana Souza',
      address: 'Rua das Flores, 500 - Centro',
      city: 'Campinas',
      state: 'SP',
      plan_id: 'plan-call-inter',
      start_date: '2026-01-01',
      due_date: '2027-01-01',
      status: 'active',
      created_at: now,
      updated_at: now,
    };

    const comp2User: User = {
      id: 'usr-comp-2',
      name: 'Gerente Supermercado Central',
      email: 'empresa@supermercado.com.br',
      password_hash: demoPass.hash,
      salt: demoPass.salt,
      role: 'company',
      company_id: comp2Id,
      active: true,
      must_change_password: false,
      created_at: now,
      updated_at: now,
    };

    const op2User: User = {
      id: 'usr-op-2',
      name: 'Ana Operadora',
      email: 'operador@supermercado.com.br',
      password_hash: demoPass.hash,
      salt: demoPass.salt,
      role: 'operator',
      company_id: comp2Id,
      active: true,
      must_change_password: false,
      created_at: now,
      updated_at: now,
    };

    const op2: Operator = {
      id: 'op-2',
      company_id: comp2Id,
      user_id: op2User.id,
      name: 'Ana Operadora - Caixa 01',
      email: 'operador@supermercado.com.br',
      phone: '(11) 97654-3210',
      active: true,
      created_at: now,
      updated_at: now,
    };

    const play3User: User = {
      id: 'usr-play-3',
      name: 'Player Hortifruti',
      email: 'player@supermercado.com.br',
      password_hash: demoPass.hash,
      salt: demoPass.salt,
      role: 'player',
      company_id: comp2Id,
      active: true,
      must_change_password: false,
      created_at: now,
      updated_at: now,
    };

    const comp2Media: Media[] = [
      {
        id: 'med-merc-1',
        company_id: comp2Id,
        name: 'Festival de Hortifruti Fresco - Até 35% OFF',
        type: 'image',
        file_url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" width="1920" height="1080"><defs><linearGradient id="bgm1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23064e3b"/><stop offset="100%" stop-color="%23022c22"/></linearGradient></defs><rect width="1920" height="1080" fill="url(%23bgm1)"/><circle cx="1600" cy="300" r="350" fill="%2310b981" opacity="0.15"/><rect x="120" y="100" width="340" height="52" rx="10" fill="%23059669"/><text x="140" y="134" fill="%23ffffff" font-size="22" font-family="system-ui, sans-serif" font-weight="bold">SUPERMERCADO CENTRAL</text><text x="120" y="320" fill="%2334d399" font-size="38" font-family="system-ui, sans-serif" font-weight="bold" letter-spacing="4">DIRETO DO PRODUTOR PARA SUA MESA</text><text x="120" y="440" fill="%23ffffff" font-size="82" font-family="system-ui, sans-serif" font-weight="900">FESTIVAL DE HORTIFRUTI</text><text x="120" y="540" fill="%23a7f3d0" font-size="34" font-family="system-ui, sans-serif">Frutas, verduras e legumes selecionados com até 35% de desconto hoje.</text><rect x="120" y="640" width="620" height="180" rx="16" fill="%23065f46" stroke="%2310b981" stroke-width="2"/><text x="160" y="710" fill="%236ee7b7" font-size="26" font-family="system-ui, sans-serif" font-weight="bold">QUALIDADE E FRESCOR GARANTIDOS</text><text x="160" y="760" fill="%23ffffff" font-size="22" font-family="system-ui, sans-serif">Reposição diária às 06h e 14h com procedência sustentável.</text></svg>',
        duration: 8,
        active: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: 'med-merc-2',
        company_id: comp2Id,
        name: 'Padaria & Confeitaria Artesanal',
        type: 'image',
        file_url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" width="1920" height="1080"><defs><linearGradient id="bgm2" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23451a03"/><stop offset="100%" stop-color="%231c1917"/></linearGradient></defs><rect width="1920" height="1080" fill="url(%23bgm2)"/><rect x="120" y="100" width="280" height="52" rx="10" fill="%23d97706"/><text x="140" y="134" fill="%23ffffff" font-size="22" font-family="system-ui, sans-serif" font-weight="bold">PADARIA ARTESANAL</text><text x="120" y="320" fill="%23fbbf24" font-size="38" font-family="system-ui, sans-serif" font-weight="bold">PÃO QUENTINHO A TODA HORA</text><text x="120" y="440" fill="%23ffffff" font-size="78" font-family="system-ui, sans-serif" font-weight="900">FORNADAS A CADA 30 MINUTOS</text><text x="120" y="540" fill="%23fed7aa" font-size="34" font-family="system-ui, sans-serif">Pães franceses crocantes, bolos caseiros, salgados e cafés especiais.</text><g transform="translate(120, 650)"><rect width="520" height="140" rx="14" fill="%23292524" stroke="%2378350f" stroke-width="2"/><text x="40" y="60" fill="%23f59e0b" font-size="22" font-family="system-ui, sans-serif">COMBO CAFÉ DA MANHÃ</text><text x="40" y="105" fill="%23ffffff" font-size="30" font-family="system-ui, sans-serif" font-weight="bold">Pão na Chapa + Café Expresso R$ 6,90</text></g></svg>',
        duration: 8,
        active: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: 'med-merc-3',
        company_id: comp2Id,
        name: 'Clube de Vantagens Super Central',
        type: 'image',
        file_url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" width="1920" height="1080"><defs><linearGradient id="bgm3" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%231e1b4b"/><stop offset="100%" stop-color="%230f172a"/></linearGradient></defs><rect width="1920" height="1080" fill="url(%23bgm3)"/><rect x="120" y="100" width="280" height="52" rx="10" fill="%234f46e5"/><text x="140" y="134" fill="%23ffffff" font-size="22" font-family="system-ui, sans-serif" font-weight="bold">CLUBE DE DESCONTOS</text><text x="120" y="320" fill="%23818cf8" font-size="36" font-family="system-ui, sans-serif" font-weight="bold">ECONOMIA REAL NO SEU DIA</text><text x="120" y="440" fill="%23ffffff" font-size="80" font-family="system-ui, sans-serif" font-weight="900">INFORME SEU CPF NO CAIXA</text><text x="120" y="540" fill="%23c7d2fe" font-size="34" font-family="system-ui, sans-serif">Ative ofertas instantâneas pelo aplicativo e acumule pontos para trocar por prêmios.</text><rect x="120" y="650" width="650" height="140" rx="14" fill="%231e293b" stroke="%234338ca" stroke-width="2"/><text x="160" y="715" fill="%23a5b4fc" font-size="24" font-family="system-ui, sans-serif" font-weight="bold">BAIXE O APLICATIVO GRATUITO</text><text x="160" y="755" fill="%23ffffff" font-size="20" font-family="system-ui, sans-serif">Disponível para Android e iOS na Google Play e App Store.</text></svg>',
        duration: 8,
        active: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: 'med-weather-clock-2',
        company_id: comp2Id,
        name: 'Hora Certa & Previsão do Tempo',
        type: 'weather_clock',
        file_url: 'widget:weather_clock',
        duration: 12,
        active: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: 'med-rss-merc',
        company_id: comp2Id,
        name: 'Notícias RSS - Economia & Brasil',
        type: 'rss',
        file_url: 'https://g1.globo.com/rss/g1/economia/',
        duration: 15,
        active: true,
        created_at: now,
        updated_at: now,
      },
    ];

    const pl2Id = 'pl-2';
    const pl2: Playlist = {
      id: pl2Id,
      company_id: comp2Id,
      name: 'Programação TV Central Hortifruti',
      description: 'Loop do salão de vendas com ofertas de hortifruti, padaria, clube de vantagens, clima e notícias.',
      weather_city: 'Campinas',
      active: true,
      items: [
        { id: 'pli-merc-1', playlist_id: pl2Id, media_id: 'med-merc-1', position: 1, duration: 8, created_at: now },
        { id: 'pli-merc-2', playlist_id: pl2Id, media_id: 'med-merc-2', position: 2, duration: 8, created_at: now },
        { id: 'pli-merc-3', playlist_id: pl2Id, media_id: 'med-merc-3', position: 3, duration: 8, created_at: now },
        { id: 'pli-merc-4', playlist_id: pl2Id, media_id: 'med-weather-clock-2', position: 4, duration: 12, created_at: now },
        { id: 'pli-merc-5', playlist_id: pl2Id, media_id: 'med-rss-merc', position: 5, duration: 15, created_at: now },
      ],
      created_at: now,
      updated_at: now,
    };

    const comp2Players: Player[] = [
      {
        id: 'play-3',
        company_id: comp2Id,
        user_id: play3User.id,
        name: 'TV VENDAS / HORTIFRUTI',
        code: 'PLAY-MERC-02',
        location: 'Salão Central de Vendas',
        description: 'Smart TV 65 polegadas voltada para o corredor principal e caixas.',
        orientation: 'horizontal',
        playlist_id: pl2Id,
        status: 'active',
        access_token: 'tok_play_merc_02_c1d2e3f4',
        last_seen: new Date().toISOString(),
        created_at: now,
        updated_at: now,
      },
    ];

    const comp2Phrases: CallPhrase[] = [
      { id: 'ph-merc-1', company_id: comp2Id, operator_id: null, phrase: 'Próximo cliente ao Caixa Rápido 01', active: true, created_at: now, updated_at: now },
      { id: 'ph-merc-2', company_id: comp2Id, operator_id: null, phrase: 'Atendimento preferencial no Caixa 02', active: true, created_at: now, updated_at: now },
      { id: 'ph-merc-3', company_id: comp2Id, operator_id: null, phrase: 'Retirada de compras online no Balcão Central', active: true, created_at: now, updated_at: now },
    ];

    const comp2Rss: RssFeed[] = DEFAULT_RSS_FEEDS.map((feed, idx) => ({
      id: `rss-comp2-${idx + 1}`,
      company_id: comp2Id,
      name: feed.name,
      url: feed.url,
      active: true,
      created_at: now,
      updated_at: now,
    }));

    // Inserir os registros nas coleções
    this.data.companies.push(comp1, comp2);
    this.data.users.push(comp1User, op1User, play1User, play2User, comp2User, op2User, play3User);
    this.data.operators.push(op1, op2);
    this.data.players.push(...comp1Players, ...comp2Players);
    this.data.playlists.push(pl1, pl2);
    this.data.media.push(...comp1Media, ...comp2Media);
    this.data.rss_feeds.push(...comp1Rss, ...comp2Rss);
    this.data.call_phrases.push(...comp1Phrases, ...comp2Phrases);

    // Sub-clientes de demonstração
    this.data.sub_clients.push(
      {
        id: 'sub-cli-1',
        company_id: comp1Id,
        name: 'Dr. Roberto Rocha (Consultório 02)',
        code: 'CLI-001',
        phone: '(11) 98111-2233',
        email: 'roberto@clinicaexemplo.com.br',
        notes: 'Cliente atendido para serviços de saúde.',
        created_at: now,
        updated_at: now,
      },
      {
        id: 'sub-cli-2',
        company_id: comp1Id,
        name: 'Farmácia Central Distribuidora',
        code: 'CLI-002',
        phone: '(11) 98222-3344',
        email: 'central@farmaciaexemplo.com.br',
        notes: 'Cliente comercial para orçamentos de mídias.',
        created_at: now,
        updated_at: now,
      },
      {
        id: 'sub-cli-3',
        company_id: comp2Id,
        name: 'Restaurante Sabor da Terra',
        code: 'CLI-M01',
        phone: '(11) 98333-4455',
        email: 'contato@restaurantesabor.com.br',
        notes: 'Parceiro comercial para exibição de anúncios na TV.',
        created_at: now,
        updated_at: now,
      }
    );

    this.save();

    return {
      message: 'Dados de teste carregados com sucesso! 2 empresas clientes, 2 operadores e 3 telas ativas prontas para exibição.',
      companiesCount: 2,
      operatorsCount: 2,
      playersCount: 3,
      demoClients: [
        {
          id: comp1Id,
          name: comp1.trade_name,
          segment: 'Farmácia & Saúde',
          companyEmail: 'empresa@drogariasp.com.br',
          operatorEmail: 'operador@drogariasp.com.br',
          playerCode: 'PLAY-REC-01',
          playerCodeSecondary: 'PLAY-SALA-02',
        },
        {
          id: comp2Id,
          name: comp2.trade_name,
          segment: 'Varejo & Hortifruti',
          companyEmail: 'empresa@supermercado.com.br',
          operatorEmail: 'operador@supermercado.com.br',
          playerCode: 'PLAY-MERC-02',
        },
      ],
    };
  }
}

export const db = new DatabaseStore();
