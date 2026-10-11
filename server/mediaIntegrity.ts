import fs from 'fs';
import path from 'path';
import { Media, Playlist, Player, uploadsDir } from './db.js';

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

/**
 * Extracts Google Drive File ID from different URL variations
 */
export function extractDriveFileId(url: string): string | null {
  if (!url) return null;

  // lh3.googleusercontent.com/d/FILE_ID
  const lh3Match = url.match(/googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/);
  if (lh3Match && lh3Match[1]) return lh3Match[1];

  // drive.google.com/file/d/FILE_ID/...
  const driveFileMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (driveFileMatch && driveFileMatch[1]) return driveFileMatch[1];

  // drive.google.com/open?id=FILE_ID or uc?id=FILE_ID or uc?export=view&id=FILE_ID
  const idParamMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idParamMatch && idParamMatch[1]) return idParamMatch[1];

  // Direct drive format: drive/folders/ or custom format
  const genericDriveMatch = url.match(/drive\/([a-zA-Z0-9_-]{25,})/);
  if (genericDriveMatch && genericDriveMatch[1]) return genericDriveMatch[1];

  return null;
}

/**
 * Verifies a single media item's accessibility and health
 */
export async function auditSingleMedia(
  media: Media,
  companyPlaylists: Playlist[],
  companyPlayers: Player[],
  driveAccessToken?: string
): Promise<MediaIntegrityItemResult> {
  // Find affected playlists
  const affectedPlaylists = companyPlaylists
    .filter((pl) => pl.items && pl.items.some((i) => i.media_id === media.id))
    .map((pl) => pl.name);

  // Find affected players configured with those playlists
  const affectedPlayers = companyPlayers
    .filter((py) => {
      if (!py.playlist_id) return false;
      return companyPlaylists.some(
        (pl) => pl.id === py.playlist_id && pl.items.some((i) => i.media_id === media.id)
      );
    })
    .map((py) => ({
      id: py.id,
      name: py.name,
      code: py.code,
      location: py.location,
      is_online: Boolean(py.last_seen && (Date.now() - new Date(py.last_seen).getTime() < 300000)),
    }));

  const baseResult: Omit<MediaIntegrityItemResult, 'healthy' | 'status' | 'message' | 'source'> = {
    media_id: media.id,
    name: media.name,
    type: media.type,
    file_url: media.file_url,
    playlists_affected: affectedPlaylists,
    players_affected: affectedPlayers,
  };

  // 1. Weather & Clock Widget
  if (media.type === 'weather_clock' || media.file_url === 'widget:weather_clock') {
    return {
      ...baseResult,
      source: 'weather_clock',
      healthy: true,
      status: 'ok',
      message: 'Widget dinâmico nativo de Previsão do Tempo e Relógio em funcionamento.',
    };
  }

  // 2. RSS News Media
  if (media.type === 'rss') {
    return {
      ...baseResult,
      source: 'rss',
      healthy: true,
      status: 'ok',
      message: 'Feed de notícias RSS ativo e monitorado pelo player.',
    };
  }

  // 3. Local uploaded media (/uploads/...)
  if (media.file_url.startsWith('/uploads/') || media.file_url.includes('/api/uploads/')) {
    const filename = path.basename(media.file_url.split('?')[0]);
    const filePath = path.join(uploadsDir, filename);

    if (fs.existsSync(filePath)) {
      try {
        const stats = fs.statSync(filePath);
        return {
          ...baseResult,
          source: 'local',
          healthy: true,
          status: 'ok',
          file_size: stats.size,
          message: 'Arquivo armazenado no servidor e acessível localmente.',
        };
      } catch {
        return {
          ...baseResult,
          source: 'local',
          healthy: true,
          status: 'ok',
          message: 'Arquivo local verificado.',
        };
      }
    } else {
      return {
        ...baseResult,
        source: 'local',
        healthy: false,
        status: 'not_found',
        message: 'Arquivo de mídia local ausente ou não encontrado no disco.',
      };
    }
  }

  // 4. Google Drive Media Check
  const driveFileId = extractDriveFileId(media.file_url);

  if (driveFileId) {
    // If we have a Google Drive OAuth access token, test via official Google Drive API v3
    if (driveAccessToken) {
      try {
        const driveApiUrl = `https://www.googleapis.com/drive/v3/files/${driveFileId}?fields=id,name,trashed,size,mimeType,shared`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        const res = await fetch(driveApiUrl, {
          headers: {
            Authorization: `Bearer ${driveAccessToken}`,
          },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const fileData = await res.json();
          if (fileData.trashed) {
            return {
              ...baseResult,
              source: 'google_drive',
              drive_file_id: driveFileId,
              healthy: false,
              status: 'trashed',
              message: 'Arquivo foi movido para a Lixeira do Google Drive.',
            };
          }

          return {
            ...baseResult,
            source: 'google_drive',
            drive_file_id: driveFileId,
            healthy: true,
            status: 'ok',
            file_size: fileData.size ? Number(fileData.size) : undefined,
            mime_type: fileData.mimeType,
            message: 'Arquivo ativo, íntegro e confirmado no Google Drive.',
          };
        }

        if (res.status === 404) {
          return {
            ...baseResult,
            source: 'google_drive',
            drive_file_id: driveFileId,
            healthy: false,
            status: 'not_found',
            message: 'Arquivo não encontrado ou excluído permanentemente da sua conta do Google Drive.',
          };
        }

        if (res.status === 403) {
          return {
            ...baseResult,
            source: 'google_drive',
            drive_file_id: driveFileId,
            healthy: false,
            status: 'permission_denied',
            message: 'Acesso negado: permissões insuficientes ou link revogado no Google Drive.',
          };
        }
      } catch (err: any) {
        console.warn(`[Integrity] Drive API error for file ${driveFileId}:`, err?.message);
      }
    }

    // Fallback or Public Stream Verification for Google Drive: probe direct stream URL
    try {
      const streamUrl = `https://lh3.googleusercontent.com/d/${driveFileId}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const probeRes = await fetch(streamUrl, {
        method: 'HEAD',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (probeRes.ok || probeRes.status === 302 || probeRes.status === 301) {
        return {
          ...baseResult,
          source: 'google_drive',
          drive_file_id: driveFileId,
          healthy: true,
          status: 'ok',
          message: 'Arquivo acessível para reprodução direta nas telas e TVs.',
        };
      }

      if (probeRes.status === 404) {
        return {
          ...baseResult,
          source: 'google_drive',
          drive_file_id: driveFileId,
          healthy: false,
          status: 'not_found',
          message: 'Arquivo não localizado no Google Drive (código 404).',
        };
      }

      if (probeRes.status === 403) {
        return {
          ...baseResult,
          source: 'google_drive',
          drive_file_id: driveFileId,
          healthy: false,
          status: 'permission_denied',
          message: 'Arquivo com permissão restrita no Google Drive. Requer autorização pública.',
        };
      }

      return {
        ...baseResult,
        source: 'google_drive',
        drive_file_id: driveFileId,
        healthy: false,
        status: 'inaccessible',
        message: `Servidor do Google Drive respondeu com status ${probeRes.status}.`,
      };
    } catch (err: any) {
      return {
        ...baseResult,
        source: 'google_drive',
        drive_file_id: driveFileId,
        healthy: false,
        status: 'network_error',
        message: `Falha na verificação de rede: ${err?.message || 'tempo esgotado'}`,
      };
    }
  }

  // 5. External HTTP/HTTPS URL
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const extRes = await fetch(media.file_url, {
      method: 'HEAD',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (extRes.ok || extRes.status === 301 || extRes.status === 302) {
      return {
        ...baseResult,
        source: 'external',
        healthy: true,
        status: 'ok',
        message: 'URL externa acessível.',
      };
    }

    return {
      ...baseResult,
      source: 'external',
      healthy: false,
      status: extRes.status === 404 ? 'not_found' : 'inaccessible',
      message: `URL externa retornou status ${extRes.status}.`,
    };
  } catch (err: any) {
    return {
      ...baseResult,
      source: 'external',
      healthy: false,
      status: 'network_error',
      message: `Não foi possível alcançar a URL externa: ${err?.message || 'erro de rede'}`,
    };
  }
}

/**
 * Runs a complete integrity audit across multiple media items
 */
export async function runMediaIntegrityAudit(
  mediaList: Media[],
  playlists: Playlist[],
  players: Player[],
  companyId?: string,
  driveAccessToken?: string
): Promise<MediaIntegrityAuditReport> {
  const items: MediaIntegrityItemResult[] = [];

  // Run checks with concurrency control to avoid hitting Google rate limits
  const BATCH_SIZE = 5;
  for (let i = 0; i < mediaList.length; i += BATCH_SIZE) {
    const batch = mediaList.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map((m) => auditSingleMedia(m, playlists, players, driveAccessToken))
    );
    items.push(...results);
  }

  const healthy = items.filter((i) => i.healthy).length;
  const inaccessible = items.filter((i) => !i.healthy).length;
  const google_drive_count = items.filter((i) => i.source === 'google_drive').length;
  const local_count = items.filter((i) => i.source === 'local').length;
  const rss_count = items.filter((i) => i.source === 'rss').length;
  const widget_count = items.filter((i) => i.source === 'weather_clock').length;

  const issues = items.filter((i) => !i.healthy);

  return {
    company_id: companyId,
    checked_at: new Date().toISOString(),
    summary: {
      total: items.length,
      healthy,
      inaccessible,
      google_drive_count,
      local_count,
      rss_count,
      widget_count,
    },
    has_issues: issues.length > 0,
    issues,
    items,
  };
}
