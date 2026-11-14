import { Response } from 'express';
import { db, PlayerCall } from './db.js';

interface SSEClient {
  id: string;
  res: Response;
  playerId?: string;
  playerCode?: string;
  companyId?: string;
}

interface PendingRestartEntry {
  timestamp: number;
  fullReload?: boolean;
  explicitRestart?: boolean;
  reason?: string;
  consumedBy: Set<string>;
}

class RealtimeHub {
  private clients: SSEClient[] = [];
  private activeCalls: Map<string, PlayerCall> = new Map();
  private pendingRestarts: Map<string, PendingRestartEntry> = new Map();

  constructor() {
    // Keep-alive heartbeat to prevent proxies/browsers from killing SSE
    setInterval(() => {
      this.sendKeepAlive();
    }, 15000);

    // Check every 10 seconds for offline players
    setInterval(() => {
      this.checkOfflinePlayers();
    }, 10000);
  }

  private sendKeepAlive() {
    const keepAliveMsg = `: keep-alive ${Date.now()}\n\n`;
    for (const client of this.clients) {
      try {
        client.res.write(keepAliveMsg);
      } catch {
        // Handled on close
      }
    }
  }

  public addClient(client: SSEClient) {
    this.clients.push(client);

    // Initial keep-alive & connection ack
    try {
      client.res.write(`data: ${JSON.stringify({ type: 'CONNECTED', timestamp: Date.now() })}\n\n`);

      // If this player has an ongoing active call, deliver it immediately on connect
      if (client.playerId) {
        const active = this.getActiveCall(client.playerId);
        if (active) {
          const payload = JSON.stringify({ type: 'CALL_EVENT', call: active, data: active });
          client.res.write(`data: ${payload}\n\n`);
        }
      }
    } catch (e) {
      console.warn('Failed to send initial SSE ack:', e);
    }

    client.res.req.on('close', () => {
      this.clients = this.clients.filter((c) => c.id !== client.id);
    });
  }

  public getActiveCall(playerIdOrCode: string): PlayerCall | null {
    const target = (playerIdOrCode || '').trim().toLowerCase();
    if (!target) return null;
    const data = db.getData();

    // Find player ID if a code or token was passed
    const player = data.players.find(
      (p) =>
        p.id.toLowerCase() === target ||
        p.code.toLowerCase() === target ||
        (p.access_token && p.access_token.toLowerCase() === target)
    );
    const playerId = player ? player.id : target;
    const playerCode = player ? player.code.toLowerCase() : target;

    const memoryCall = this.activeCalls.get(playerId) || this.activeCalls.get(playerCode);
    const now = Date.now();

    if (memoryCall) {
      const elapsed = now - new Date(memoryCall.created_at).getTime();
      if (elapsed < (memoryCall.duration || 10) * 1000) {
        return memoryCall;
      } else {
        this.activeCalls.delete(playerId);
        this.activeCalls.delete(playerCode);
      }
    }

    // Check persistent db calls
    const recent = [...data.player_calls]
      .filter((c) => c.player_id === playerId || (player && c.player_id === player.id))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

    if (recent) {
      const elapsed = now - new Date(recent.created_at).getTime();
      if (elapsed < (recent.duration || 10) * 1000) {
        this.activeCalls.set(playerId, recent);
        if (playerCode) this.activeCalls.set(playerCode, recent);
        return recent;
      }
    }

    return null;
  }

  public sendCallToPlayer(call: PlayerCall) {
    this.activeCalls.set(call.player_id, call);
    const targetPlayer = db.getData().players.find(
      (p) =>
        p.id === call.player_id ||
        p.code.toLowerCase() === call.player_id.toLowerCase()
    );
    if (targetPlayer) {
      this.activeCalls.set(targetPlayer.id, call);
      this.activeCalls.set(targetPlayer.code.toLowerCase(), call);
    }

    const message = `data: ${JSON.stringify({ type: 'CALL_EVENT', call, data: call })}\n\n`;
    let deliveredCount = 0;

    const targetCode = targetPlayer?.code?.toLowerCase();
    const targetId = targetPlayer?.id || call.player_id;

    for (const client of this.clients) {
      const isPlayerMatch =
        (client.playerId && (client.playerId === targetId || client.playerId === targetCode)) ||
        (targetCode && client.playerCode && client.playerCode.toLowerCase() === targetCode);

      const isCompanyMonitor =
        client.companyId && client.companyId === call.company_id && !client.playerId;

      if (isPlayerMatch || isCompanyMonitor) {
        try {
          client.res.write(message);
          deliveredCount++;
        } catch (err) {
          console.warn('Error writing SSE message to client:', err);
        }
      }
    }

    return deliveredCount > 0;
  }

  public broadcastPlayerStatus(playerId: string, companyId: string, isOnline: boolean) {
    const payload = JSON.stringify({
      type: 'PLAYER_STATUS_CHANGE',
      playerId,
      companyId,
      isOnline,
      lastSeen: new Date().toISOString(),
    });
    const message = `data: ${payload}\n\n`;

    for (const client of this.clients) {
      if (client.companyId === companyId || !client.companyId) {
        try {
          client.res.write(message);
        } catch {
          // Handled on close
        }
      }
    }
  }

  public broadcastMediaChange(companyId: string, action: 'created' | 'deleted' | 'updated', mediaOrId?: any) {
    const payload = JSON.stringify({
      type: 'MEDIA_CHANGED',
      action,
      companyId,
      media: typeof mediaOrId === 'object' ? mediaOrId : undefined,
      mediaId: typeof mediaOrId === 'string' ? mediaOrId : mediaOrId?.id,
      timestamp: Date.now(),
    });
    const message = `data: ${payload}\n\n`;

    for (const client of this.clients) {
      if (!client.companyId || client.companyId === companyId) {
        try {
          client.res.write(message);
        } catch {
          // Handled on close
        }
      }
    }
  }

  public recordHeartbeat(playerIdOrCode: string) {
    const data = db.getData();
    const target = String(playerIdOrCode || '').trim().toLowerCase();
    if (!target) return false;

    const player = data.players.find(
      (p) =>
        p.id.toLowerCase() === target ||
        p.code.toLowerCase() === target ||
        (p.access_token && p.access_token.toLowerCase() === target)
    );
    if (!player) return false;

    const previousLastSeen = new Date(player.last_seen || 0).getTime();
    const wasOffline = Date.now() - previousLastSeen > 45000;

    player.last_seen = new Date().toISOString();
    db.persist();

    if (wasOffline) {
      this.broadcastPlayerStatus(player.id, player.company_id, true);
    }
    return true;
  }

  public recordOffline(playerIdOrCode: string) {
    const data = db.getData();
    const target = String(playerIdOrCode || '').trim().toLowerCase();
    if (!target) return false;

    const player = data.players.find(
      (p) =>
        p.id.toLowerCase() === target ||
        p.code.toLowerCase() === target ||
        (p.access_token && p.access_token.toLowerCase() === target)
    );
    if (!player) return false;

    player.last_seen = null as any;
    db.persist();
    this.broadcastPlayerStatus(player.id, player.company_id, false);
    return true;
  }

  private checkOfflinePlayers() {
    const data = db.getData();
    const now = Date.now();
    for (const player of data.players) {
      const lastSeen = new Date(player.last_seen || 0).getTime();
      const isOnline = now - lastSeen <= 45000;
      // Heartbeat checks
    }
  }

  public sendRestartCommand(params: {
    playerId?: string;
    playlistId?: string;
    companyId?: string;
    fullReload?: boolean;
    explicitRestart?: boolean;
    reason?: string;
  }): { deliveredCount: number; targetPlayerCount: number } {
    const data = db.getData();
    let targetPlayerIds: string[] = [];

    if (params.playerId) {
      targetPlayerIds.push(params.playerId);
    } else if (params.playlistId) {
      const matching = data.players.filter(
        (p) =>
          p.playlist_id === params.playlistId &&
          (!params.companyId || p.company_id === params.companyId)
      );
      targetPlayerIds = matching.map((p) => p.id);
      // Fallback: if no players are specifically mapped to this playlist, broadcast to company players
      if (targetPlayerIds.length === 0 && params.companyId) {
        targetPlayerIds = data.players
          .filter((p) => p.company_id === params.companyId)
          .map((p) => p.id);
      }
    } else if (params.companyId) {
      targetPlayerIds = data.players
        .filter((p) => p.company_id === params.companyId)
        .map((p) => p.id);
    }

    const timestamp = Date.now();
    const eventPayload = {
      type: 'RELOAD_PLAYLIST',
      action: 'restart',
      playlistId: params.playlistId,
      playerId: params.playerId,
      companyId: params.companyId,
      fullReload: params.fullReload ?? false,
      explicitRestart: params.explicitRestart ?? false,
      reason: params.reason || 'Playlist atualizada pelo painel.',
      timestamp,
    };

    const message = `data: ${JSON.stringify(eventPayload)}\n\n`;
    let deliveredCount = 0;

    for (const client of this.clients) {
      const matchesPlayer =
        !targetPlayerIds.length ||
        (client.playerId && targetPlayerIds.includes(client.playerId)) ||
        (client.playerCode &&
          targetPlayerIds.some((tId) => {
            const p = data.players.find((pl) => pl.id === tId);
            return p && p.code.toLowerCase() === client.playerCode?.toLowerCase();
          }));

      const matchesCompany =
        params.companyId && client.companyId === params.companyId;

      if (matchesPlayer || (matchesCompany && !client.playerId)) {
        try {
          client.res.write(message);
          deliveredCount++;
        } catch (err) {
          console.warn('Erro ao enviar evento de reinicialização para cliente SSE:', err);
        }
      }
    }

    // Persist pending restart for 30s to cover players polling or momentarily reconnecting
    // Share a single entry instance across keys so consuming by player/playlist/company deduplicates cleanly per screen
    const sharedEntry: PendingRestartEntry = {
      timestamp,
      fullReload: params.fullReload,
      explicitRestart: params.explicitRestart,
      reason: eventPayload.reason,
      consumedBy: new Set<string>(),
    };

    if (params.companyId && !params.playerId && !params.playlistId) {
      this.pendingRestarts.set(`company:${params.companyId}`, sharedEntry);
    }
    if (params.playlistId) {
      this.pendingRestarts.set(`playlist:${params.playlistId}`, sharedEntry);
    }
    for (const id of targetPlayerIds) {
      this.pendingRestarts.set(`player:${id.toLowerCase()}`, sharedEntry);
      const p = data.players.find((pl) => pl.id === id);
      if (p) {
        this.pendingRestarts.set(`player:${p.code.toLowerCase()}`, sharedEntry);
      }
    }

    return { deliveredCount, targetPlayerCount: targetPlayerIds.length };
  }

  public checkAndClearPendingRestart(
    playerIdOrCode: string,
    companyId?: string,
    playlistId?: string
  ): { reload: boolean; timestamp: number; fullReload?: boolean; explicitRestart?: boolean; reason?: string } | null {
    const target = String(playerIdOrCode || '').trim().toLowerCase();
    const now = Date.now();
    const data = db.getData();
    const matchedPlayer = data.players.find(
      (p) => p.id.toLowerCase() === target || p.code.toLowerCase() === target
    );
    const consumerAliases = Array.from(
      new Set(
        [
          target,
          matchedPlayer?.id?.toLowerCase(),
          matchedPlayer?.code?.toLowerCase(),
        ].filter(Boolean) as string[]
      )
    );
    if (consumerAliases.length === 0) consumerAliases.push('anonymous');

    // Prune expired entries (>30s)
    for (const [k, entry] of this.pendingRestarts.entries()) {
      if (now - entry.timestamp >= 30000) {
        this.pendingRestarts.delete(k);
      }
    }

    const tryConsume = (entry: PendingRestartEntry | undefined) => {
      if (!entry) return null;
      if (consumerAliases.some((alias) => entry.consumedBy.has(alias))) {
        return null;
      }
      for (const alias of consumerAliases) {
        entry.consumedBy.add(alias);
      }
      return {
        reload: true,
        timestamp: entry.timestamp,
        fullReload: entry.fullReload,
        explicitRestart: entry.explicitRestart,
        reason: entry.reason,
      };
    };

    // 1. Check player-specific entries across all aliases
    for (const alias of consumerAliases) {
      const res = tryConsume(this.pendingRestarts.get(`player:${alias}`));
      if (res) return res;
    }

    // 2. Check playlist-specific entry
    if (playlistId) {
      const res = tryConsume(this.pendingRestarts.get(`playlist:${playlistId}`));
      if (res) return res;
    }

    // 3. Check company-specific entry
    if (companyId) {
      const res = tryConsume(this.pendingRestarts.get(`company:${companyId}`));
      if (res) return res;
    }

    return null;
  }
}

export const realtimeHub = new RealtimeHub();
