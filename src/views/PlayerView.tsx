import React, { useState, useEffect, useRef } from 'react';
import {
  Maximize2,
  Minimize2,
  Bell,
  AlertTriangle,
  LogOut,
  RefreshCw,
  Volume2,
  VolumeX,
  Tv,
  Smartphone,
  Scaling,
  Wifi,
  WifiOff,
  Database,
  HardDriveDownload,
  CheckCircle2,
  Clock,
  Cloud,
  CloudSun,
  Sun,
  CloudRain,
  Star,
  Thermometer,
  Moon,
  Sparkles,
  Radio,
} from 'lucide-react';
import { api, getStoredToken, API_BASE_URL } from '../lib/api';
import { playCallChime, playCallAlert, stopCallAlert, unlockAudio } from '../lib/audio';
import { PlayerOrientation, WeatherData } from '../types';
import { WeatherClockMedia } from '../components/WeatherClockMedia';
import { RssNewsMedia } from '../components/RssNewsMedia';
import { cleanRssText } from '../lib/rssCleaner';
import { resolveMediaDisplayUrl } from '../lib/googleDrive';

interface PlayerViewProps {
  onExit?: () => void;
  overridePlayerCode?: string;
  overridePlayerToken?: string;
}

interface CurrentPlayerData {
  player: {
    id: string;
    name: string;
    code: string;
    access_token?: string;
    location: string;
    orientation?: PlayerOrientation;
    transition_effect?: 'crossfade' | 'slide' | 'zoom' | 'cut';
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
    transition_effect?: 'crossfade' | 'slide' | 'zoom' | 'cut';
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
  rssFeeds: Array<{ id: string; name: string; url: string; active: boolean }>;
}

interface ActiveCall {
  id: string;
  phrase: string;
  duration: number;
  is_priority?: boolean;
  timestamp: number;
}

function resolveMediaUrl(url: string | undefined): string {
  if (!url) return '';
  return resolveMediaDisplayUrl(url);
}

export const PlayerView: React.FC<PlayerViewProps> = ({ onExit, overridePlayerCode, overridePlayerToken }) => {
  const [data, setData] = useState<CurrentPlayerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Offline & Workbox cache status
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [isOfflinePlayback, setIsOfflinePlayback] = useState<boolean>(false);
  const [cacheSyncStatus, setCacheSyncStatus] = useState<'idle' | 'syncing' | 'synced'>('idle');
  const [cachedMediaCount, setCachedMediaCount] = useState<number>(0);

  // Playback & display state
  const [orientation, setOrientation] = useState<PlayerOrientation>('horizontal');
  const [fitMode, setFitMode] = useState<'contain' | 'cover'>('contain');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [callRemaining, setCallRemaining] = useState<number>(0);
  const [isSpeakingCall, setIsSpeakingCall] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [restartNotification, setRestartNotification] = useState<{ message: string; timestamp: number } | null>(null);
  const lastRestartTsRef = useRef<number>(0);

  // Ensure audio and speech synthesis are unlocked on user gesture / interaction
  useEffect(() => {
    const handleGesture = () => {
      unlockAudio();
    };
    window.addEventListener('click', handleGesture, { passive: true });
    window.addEventListener('touchstart', handleGesture, { passive: true });
    window.addEventListener('keydown', handleGesture, { passive: true });
    return () => {
      window.removeEventListener('click', handleGesture);
      window.removeEventListener('touchstart', handleGesture);
      window.removeEventListener('keydown', handleGesture);
    };
  }, []);

  // RSS headlines with instantaneous initial display and offline local cache
  const DEFAULT_HEADLINES = [
    'Saúde & Bem-Estar: Manter hábitos regulares de hidratação melhora o foco e a imunidade.',
    'Vacinação em dia: Proteja toda a família com o calendário atualizado de imunização.',
    'Atendimento Humanizado: Nossos consultores e farmacêuticos estão à disposição para orientações.',
    'Dica do Especialista: Pratique 20 a 30 minutos de caminhada diária para fortalecer o coração.',
    'Prevenção: Meça sua pressão arterial e glicemia regularmente em nossa sala de atendimento.',
    'Mídia Indoor Conectada: Programação digital e chamadas de atendimento em tempo real.',
  ];

  const [rssHeadlines, setRssHeadlines] = useState<string[]>(() => {
    try {
      const cached = localStorage.getItem('indoor_cached_rss_headlines');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return DEFAULT_HEADLINES;
  });

  // Local Time State for lower third ticker
  const [currentTime, setCurrentTime] = useState<string>(() => {
    const d = new Date();
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  });
  const [currentDate, setCurrentDate] = useState<string>(() => {
    const d = new Date();
    return d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
  });

  // Weather State for weather_clock media
  const [weatherData, setWeatherData] = useState<WeatherData>(() => ({
    city: 'São Paulo',
    temp: 24,
    apparentTemp: 25,
    humidity: 60,
    windSpeed: 12,
    text: 'Céu Limpo',
    weatherCode: 0,
    forecast: [],
  }));

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => {
      const d = new Date();
      setCurrentTime(d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
      setCurrentDate(d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch real-time weather based on playlist configured city
  const fetchWeather = async (city?: string) => {
    const targetCity = city || data?.playlist?.weather_city || data?.weatherCity || 'São Paulo';
    try {
      const res = await api.getWeather(targetCity);
      if (res && res.status === 'ok') {
        setWeatherData({
          city: res.city || targetCity,
          temp: res.temp,
          apparentTemp: res.apparentTemp,
          humidity: res.humidity,
          windSpeed: res.windSpeed,
          text: res.text,
          weatherCode: res.weatherCode,
          forecast: res.forecast || [],
        });
      }
    } catch {
      // keep fallback
    }
  };

  useEffect(() => {
    const city = data?.playlist?.weather_city || data?.weatherCity || 'São Paulo';
    fetchWeather(city);
    // Refresh weather every 15 minutes
    const weatherInterval = setInterval(() => {
      fetchWeather(city);
    }, 15 * 60 * 1000);
    return () => clearInterval(weatherInterval);
  }, [data?.playlist?.weather_city, data?.weatherCity]);

  const containerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<any>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Monitor network connectivity changes
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Auto-reconnect & sync configuration when back online
      loadPlayerData();
    };
    const handleOffline = () => {
      setIsOnline(false);
      setIsOfflinePlayback(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Pre-cache media assets into Cache Storage via Service Worker
  const precachePlaylistAssets = async (mediaItems?: CurrentPlayerData['items']) => {
    if (!mediaItems || mediaItems.length === 0) return;
    setCacheSyncStatus('syncing');
    let count = 0;

    try {
      const hasCaches = typeof window !== 'undefined' && 'caches' in window;
      const videoCache = hasCaches ? await caches.open('indoor-media-videos-v1').catch(() => null) : null;
      const imageCache = hasCaches ? await caches.open('indoor-media-images-v1').catch(() => null) : null;

      for (const item of mediaItems) {
        if (!item.file_url) continue;

        // Data URLs are already local and require no network
        if (item.file_url.startsWith('data:')) {
          count++;
          continue;
        }

        try {
          if (hasCaches) {
            const targetCache = item.type === 'video' ? videoCache : imageCache;
            if (targetCache) {
              const matched = await targetCache.match(item.file_url);
              if (!matched) {
                // Fetch through browser/service worker to warm the CacheFirst route
                const response = await fetch(item.file_url, { mode: 'no-cors' });
                if (response && response.type !== 'error') {
                  await targetCache.put(item.file_url, response.clone());
                }
              }
            }
          }
          count++;
        } catch (itemErr) {
          // Continue caching other assets if one fails
          count++;
        }
      }

      setCachedMediaCount(count);
      setCacheSyncStatus('synced');
    } catch (err) {
      console.warn('Nota de sincronização de cache de mídias:', err);
      setCacheSyncStatus('idle');
    }
  };

  // Fetch active RSS headlines
  const refreshRssHeadlines = async (feeds?: CurrentPlayerData['rssFeeds']) => {
    if (!feeds || feeds.length === 0) return;
    try {
      const activeFeeds = feeds.filter((r) => r.active);
      const targetFeeds = activeFeeds.length > 0 ? activeFeeds : feeds;
      const collected: string[] = [];

      for (const feed of targetFeeds) {
        try {
          const res = await api.fetchRssHeadlines(feed.url);
          if (res.items && res.items.length > 0) {
            collected.push(...res.items);
          }
        } catch (feedErr) {
          console.warn(`Aviso: falha ao consultar feed ${feed.name}:`, feedErr);
        }
      }

      if (collected.length > 0) {
        const cleanedHeadlines = collected.map(cleanRssText).filter(Boolean);
        setRssHeadlines(cleanedHeadlines);
        try {
          localStorage.setItem('indoor_cached_rss_headlines', JSON.stringify(cleanedHeadlines));
        } catch (e) {}
      }
    } catch (e) {
      console.warn('Não foi possível atualizar RSS:', e);
    }
  };

  // Fetch player configuration with robust offline fallback
  const loadPlayerData = async () => {
    const effectiveKey = overridePlayerToken || overridePlayerCode || 'default';
    const offlineCacheKey = `indoor_player_offline_data_${effectiveKey}`;

    const getAnyCachedData = (): CurrentPlayerData | null => {
      try {
        const specific = localStorage.getItem(offlineCacheKey);
        if (specific) return JSON.parse(specific);
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('indoor_player_offline_data_')) {
            const val = localStorage.getItem(key);
            if (val) return JSON.parse(val);
          }
        }
      } catch {}
      return null;
    };

    try {
      setLoading(true);
      setError(null);

      let res: CurrentPlayerData | null = null;
      try {
        res = await api.getCurrentPlayer(overridePlayerCode, overridePlayerToken);
        if (res) {
          try {
            localStorage.setItem(offlineCacheKey, JSON.stringify(res));
            localStorage.setItem('indoor_player_offline_data_default', JSON.stringify(res));
            if (res.player?.code) {
              localStorage.setItem(`indoor_player_offline_data_${res.player.code}`, JSON.stringify(res));
            }
          } catch (e) {}
          setIsOfflinePlayback(false);
        }
      } catch (netErr: any) {
        // Fallback to local storage if network request fails or device is offline
        const localCached = getAnyCachedData();
        if (localCached) {
          console.log('Utilizando playlist do cache local offline para reprodução contínua.');
          res = localCached;
          setIsOfflinePlayback(true);
        } else {
          throw netErr;
        }
      }

      if (!res) {
        throw new Error('Configuração do player não disponível.');
      }

      setData(res);

      if (res.player?.orientation) {
        setOrientation(res.player.orientation);
      }

      // Proactively warm the Workbox media cache in background
      precachePlaylistAssets(res.items);

      // Fetch RSS headlines immediately
      if (res.rssFeeds && res.rssFeeds.length > 0) {
        refreshRssHeadlines(res.rssFeeds);
      }
    } catch (err: any) {
      // Check again if local cache can rescue the screen
      const localCached = getAnyCachedData();
      if (localCached) {
        try {
          setData(localCached);
          setIsOfflinePlayback(true);
          setError(null);
          precachePlaylistAssets(localCached.items);
          return;
        } catch (e) {}
      }
      setError(err.message || 'Erro ao carregar dados do reprodutor.');
    } finally {
      setLoading(false);
    }
  };

  // Periodic RSS refresh every 4 minutes to keep news fresh
  useEffect(() => {
    if (!data?.rssFeeds || data.rssFeeds.length === 0) return;
    const rssInterval = setInterval(() => {
      if (navigator.onLine) {
        refreshRssHeadlines(data.rssFeeds);
      }
    }, 4 * 60 * 1000);

    return () => clearInterval(rssInterval);
  }, [data?.rssFeeds]);

  useEffect(() => {
    loadPlayerData();
  }, [overridePlayerCode, overridePlayerToken]);

  // Automatic Heartbeat ping loop every 15s to keep system status continuously live
  useEffect(() => {
    const playerRecord = data?.player;
    const playerId = playerRecord?.id || playerRecord?.code || overridePlayerCode;
    if (!playerId) return;

    const playerCode = playerRecord?.code || overridePlayerCode;
    const playerToken = playerRecord?.access_token || overridePlayerToken;

    const sendBeat = () => {
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        api.sendHeartbeat(playerId, playerCode, playerToken).catch(() => {});
      }
    };

    // Send initial ping immediately upon resolution
    sendBeat();
    const interval = setInterval(sendBeat, 15000);

    const handleOnline = () => {
      sendBeat();
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        sendBeat();
      }
    };

    const markOffline = () => {
      try {
        api.sendPlayerOffline(playerId, playerCode, playerToken).catch(() => {});
        const url = `${API_BASE_URL}/player/offline`;
        const payload = JSON.stringify({ playerId, code: playerCode, token: playerToken });
        if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
          navigator.sendBeacon(url, new Blob([payload], { type: 'application/json' }));
        }
        if (typeof fetch === 'function') {
          fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payload,
            keepalive: true,
          }).catch(() => {});
        }
      } catch {}
    };

    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('beforeunload', markOffline);
    window.addEventListener('pagehide', markOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('beforeunload', markOffline);
      window.removeEventListener('pagehide', markOffline);
      markOffline();
    };
  }, [data?.player?.id, data?.player?.code, overridePlayerCode, overridePlayerToken]);

  // Reference to avoid duplicate triggers of the same call ID
  const lastCallIdRef = useRef<string>('');

  const triggerCallOnScreen = (callItem: any) => {
    if (!callItem || !callItem.phrase) return;
    const callId = callItem.id || `call-${Date.now()}`;
    const phrase = String(callItem.phrase).trim();
    if (!phrase) return;

    if (lastCallIdRef.current === callId) return;
    lastCallIdRef.current = callId;

    const isPriority = Boolean(callItem.is_priority ?? callItem.isPriority);
    const duration = Number(callItem.duration) || 10;

    // Disparar Chime Melódico + Voz Sintetizada (Speech Synthesis em Português)
    unlockAudio();
    playCallAlert(phrase, isPriority, {
      onSpeechStart: () => setIsSpeakingCall(true),
      onSpeechEnd: () => setIsSpeakingCall(false),
    });

    setActiveCall({
      id: callId,
      phrase,
      duration,
      is_priority: isPriority,
      timestamp: Date.now(),
    });
    setCallRemaining(duration);
  };

  // Handle remote restart / reload command sent from dashboard
  const handleRestartCommand = async (cmd?: any) => {
    const ts = cmd?.timestamp || Date.now();
    if (ts && ts <= lastRestartTsRef.current + 2000) return;
    lastRestartTsRef.current = ts;

    console.log('[PlayerView] Comando de reinicialização recebido! Recarregando playlist...', cmd);

    setRestartNotification({
      message: cmd?.reason || 'Playlist atualizada! Recarregando mídias...',
      timestamp: Date.now(),
    });
    setTimeout(() => setRestartNotification(null), 4500);

    try {
      await loadPlayerData();
      setCurrentIndex(0);
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
        videoRef.current.play().catch(() => {});
      }
      if (cmd?.fullReload) {
        window.location.reload();
      }
    } catch (err) {
      console.warn('Erro ao processar reinicialização da playlist:', err);
    }
  };

  // 1. Real-time SSE Connection for instantaneous calls and playlist restarts
  useEffect(() => {
    const token = overridePlayerToken || data?.player?.access_token || getStoredToken();
    const playerId = data?.player?.id;
    const playerCode = overridePlayerCode || data?.player?.code;
    const companyId = data?.company?.id;

    const params = new URLSearchParams();
    if (token) params.append('token', token);
    if (playerId) params.append('playerId', playerId);
    if (playerCode) params.append('code', playerCode);
    if (companyId) params.append('companyId', companyId);

    const sseUrl = `${API_BASE_URL}/realtime/stream?${params.toString()}`;
    const eventSource = new EventSource(sseUrl);

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'CALL_EVENT') {
          const callData = payload.call || payload.data;
          if (callData) {
            const matchesPlayer = !playerId || !callData.player_id || callData.player_id === playerId;
            if (matchesPlayer) {
              triggerCallOnScreen(callData);
            }
          }
        } else if (payload.type === 'RELOAD_PLAYLIST' || payload.type === 'RESTART_PLAYER') {
          const matchesPlayer =
            !payload.playerId ||
            !playerId ||
            payload.playerId === playerId ||
            payload.playerId === playerCode;

          const matchesPlaylist =
            payload.playlistId && data?.playlist?.id && payload.playlistId === data.playlist.id;

          const matchesCompany =
            payload.companyId && companyId && payload.companyId === companyId;

          if (matchesPlayer || matchesPlaylist || matchesCompany) {
            handleRestartCommand(payload);
          }
        }
      } catch (err) {
        console.error('Failed to parse SSE event:', err);
      }
    };

    eventSource.onerror = () => {
      // EventSource auto-reconnects automatically
    };

    return () => {
      eventSource.close();
    };
  }, [data?.player?.id, data?.player?.code, data?.player?.access_token, data?.company?.id, data?.playlist?.id, overridePlayerCode, overridePlayerToken]);

  // 2. Fast Active-Call & Restart Polling Fallback (ensures 100% reception even through restrictive proxies/iframes)
  useEffect(() => {
    const targetPlayerId = data?.player?.id;
    const targetCode = overridePlayerCode || data?.player?.code;
    const targetToken = overridePlayerToken || data?.player?.access_token;
    if (!targetPlayerId && !targetCode && !targetToken) return;

    const checkActiveCall = async () => {
      if (!navigator.onLine) return;
      try {
        const res = await api.getActiveCall(targetPlayerId, targetCode, targetToken, data?.company?.id);
        if (res?.activeCall) {
          triggerCallOnScreen(res.activeCall);
        }
        if (res?.reloadPlaylist || res?.pendingRestart) {
          handleRestartCommand(res.pendingRestart);
        }
      } catch {
        // Silent catch for intermittent network offline
      }
    };

    // Check immediately and poll every 1.5s
    checkActiveCall();
    const pollInterval = setInterval(checkActiveCall, 1500);

    return () => clearInterval(pollInterval);
  }, [data?.player?.id, data?.player?.code, data?.player?.access_token, data?.company?.id, overridePlayerCode, overridePlayerToken]);

  // 3. Local BroadcastChannel & Storage Event Sync (Instant 0ms multi-tab synchronization)
  useEffect(() => {
    const targetPlayerId = data?.player?.id;

    let bc: BroadcastChannel | null = null;
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        bc = new BroadcastChannel('indoor_media_calls');
        bc.onmessage = (evt) => {
          if (evt.data?.type === 'CALL_EVENT' && evt.data?.call) {
            const call = evt.data.call;
            const matches = !targetPlayerId || !call.player_id || call.player_id === targetPlayerId;
            if (matches) {
              try {
                bc?.postMessage({ type: 'CALL_ACK', callId: call.id });
              } catch {}
              triggerCallOnScreen(call);
            }
          } else if (evt.data?.type === 'RELOAD_PLAYLIST' || evt.data?.type === 'RESTART_PLAYER') {
            const matches =
              !targetPlayerId ||
              !evt.data.playerId ||
              evt.data.playerId === targetPlayerId;
            if (matches) {
              handleRestartCommand(evt.data);
            }
          }
        };
      }
    } catch {}

    const handleStorage = (evt: StorageEvent) => {
      if (evt.key === 'indoor_last_call' && evt.newValue) {
        try {
          const parsed = JSON.parse(evt.newValue);
          if (parsed?.call) {
            const call = parsed.call;
            const matches = !targetPlayerId || !call.player_id || call.player_id === targetPlayerId;
            if (matches) {
              triggerCallOnScreen(call);
            }
          }
        } catch {}
      } else if (evt.key === 'indoor_player_restart_cmd' && evt.newValue) {
        try {
          const parsed = JSON.parse(evt.newValue);
          handleRestartCommand(parsed);
        } catch {}
      }
    };

    window.addEventListener('storage', handleStorage);

    return () => {
      bc?.close();
      window.removeEventListener('storage', handleStorage);
    };
  }, [data?.player?.id]);

  // Call timer countdown
  useEffect(() => {
    if (!activeCall) return;

    const interval = setInterval(() => {
      setCallRemaining((prev) => {
        if (prev <= 1) {
          setActiveCall(null);
          setIsSpeakingCall(false);
          stopCallAlert();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [activeCall]);

  // Sugestão 1: Agendamento Inteligente de Conteúdo (Smart Scheduling)
  const isItemScheduled = (item: any): boolean => {
    if (!item) return false;
    if (!item.schedule_enabled) return true;
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    if (item.schedule_start_date && todayStr < item.schedule_start_date) return false;
    if (item.schedule_end_date && todayStr > item.schedule_end_date) return false;
    if (Array.isArray(item.schedule_days) && item.schedule_days.length > 0) {
      if (!item.schedule_days.includes(now.getDay())) return false;
    }
    if (item.schedule_start_time || item.schedule_end_time) {
      const curMin = now.getHours() * 60 + now.getMinutes();
      if (item.schedule_start_time) {
        const [sh, sm] = item.schedule_start_time.split(':').map(Number);
        if (curMin < sh * 60 + sm) return false;
      }
      if (item.schedule_end_time) {
        const [eh, em] = item.schedule_end_time.split(':').map(Number);
        if (curMin > eh * 60 + em) return false;
      }
    }
    return true;
  };

  // Sugestão 5: Modo Economia de Energia & Descanso Noturno
  const isSleepModeActive = (): boolean => {
    if (data?.player?.is_sleeping) return true;
    if (!data?.player?.eco_mode_enabled) return false;
    const now = new Date();
    const curMin = now.getHours() * 60 + now.getMinutes();
    const startStr = data.player.eco_sleep_start || '22:00';
    const endStr = data.player.eco_sleep_end || '06:00';
    const [sh, sm] = startStr.split(':').map(Number);
    const [eh, em] = endStr.split(':').map(Number);
    const startMin = sh * 60 + sm;
    const endMin = eh * 60 + em;
    if (startMin <= endMin) {
      return curMin >= startMin && curMin < endMin;
    } else {
      return curMin >= startMin || curMin < endMin;
    }
  };

  // Sugestão 6: Envio de Prova de Exibição (Proof of Play)
  const sendProofOfPlay = (item: any, durationSec: number) => {
    if (!data?.player?.id || !item?.media_id) return;
    api.recordProofOfPlay({
      player_id: data.player.id,
      media_id: item.media_id,
      playlist_id: data.playlist?.id,
      duration_seconds: durationSec,
    }).catch(() => {});
  };

  // Mídias ativas filtradas pelo agendamento inteligente
  const allItems = data?.items || [];
  const hasAnyScheduledRule = allItems.some((it) => it.schedule_enabled);
  const scheduledItems = allItems.filter(isItemScheduled);
  const effectiveItems = hasAnyScheduledRule ? scheduledItems : allItems;
  const currentMedia = effectiveItems.length > 0 ? effectiveItems[currentIndex % effectiveItems.length] : null;

  // Sugestão 4: Controle de Volume e Mudo por Vídeo & Master
  useEffect(() => {
    if (currentMedia?.type === 'video' && videoRef.current) {
      const masterVol = data?.player?.master_volume !== undefined ? data.player.master_volume : 100;
      const masterMuted = Boolean(data?.player?.master_muted);
      const itemVol = currentMedia.volume !== undefined ? currentMedia.volume : 100;
      const itemMuted = Boolean(currentMedia.is_muted);
      const finalVol = Math.max(0, Math.min(1, (masterVol / 100) * (itemVol / 100)));
      const finalMuted = masterMuted || itemMuted;
      videoRef.current.volume = finalVol;
      videoRef.current.muted = finalMuted;
    }
  }, [currentIndex, currentMedia, data?.player?.master_volume, data?.player?.master_muted]);

  // Avançar mídia com registro de prova de exibição
  const advanceNextMedia = () => {
    if (effectiveItems.length === 0) return;
    const item = effectiveItems[currentIndex % effectiveItems.length];
    if (item) {
      sendProofOfPlay(item, item.duration || 10);
    }
    setCurrentIndex((prev) => (prev + 1) % effectiveItems.length);
  };

  // Playlist items loop timer (respeita agendamento e modo sleep)
  useEffect(() => {
    if (effectiveItems.length === 0 || activeCall || isSleepModeActive()) return;

    const item = effectiveItems[currentIndex % effectiveItems.length];
    const durationSec = item?.duration || 10;

    if (item?.type === 'video') {
      return;
    }

    const timer = setTimeout(() => {
      advanceNextMedia();
    }, durationSec * 1000);

    return () => clearTimeout(timer);
  }, [effectiveItems, currentIndex, activeCall, data?.player?.is_sleeping]);

  const handleVideoEnded = () => {
    advanceNextMedia();
  };

  // Sugestão 3: Transições Visuais Suaves e Cinematográficas
  const transitionEffect = data?.player?.transition_effect || data?.playlist?.transition_effect || 'crossfade';
  const getTransitionClass = () => {
    if (transitionEffect === 'slide') return 'animate-in slide-in-from-right duration-700 ease-out';
    if (transitionEffect === 'zoom') return 'animate-in zoom-in-95 duration-1000 ease-out';
    if (transitionEffect === 'cut') return '';
    return 'animate-in fade-in duration-700 ease-in-out';
  };

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Auto-hide controls on mouse idle
  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3500);
  };

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-950 text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
          <p className="text-sm font-semibold tracking-wider uppercase text-slate-300">
            Iniciando Reprodutor de Mídia Indoor...
          </p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-950 p-6 text-slate-200">
        <div className="max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center shadow-2xl">
          <AlertTriangle className="mx-auto h-12 w-12 text-amber-500" />
          <h2 className="mt-4 text-xl font-bold text-white">Falha ao Conectar Player</h2>
          <p className="mt-2 text-sm text-slate-400">{error || 'Player não encontrado ou inativo.'}</p>
          <div className="mt-6 flex justify-center gap-3">
            <button
              onClick={loadPlayerData}
              className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 cursor-pointer"
            >
              Tentar Novamente
            </button>
            {onExit && (
              <button
                onClick={onExit}
                className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 cursor-pointer"
              >
                Voltar
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const isVertical = orientation === 'vertical';

  // Sugestão 5: Exibição do Modo Noturno / Descanso de Tela (Sleep Mode)
  if (isSleepModeActive()) {
    const isBlackScreen = data.player.eco_screen_type === 'black';
    return (
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        className="relative flex h-screen w-screen items-center justify-center bg-black overflow-hidden select-none"
      >
        {isBlackScreen ? (
          <div className="flex flex-col items-center justify-center text-slate-800">
            <Moon className="h-6 w-6 mb-2 opacity-30 animate-pulse text-slate-700" />
            <span className="text-[10px] font-mono tracking-widest uppercase opacity-25 text-slate-600">
              Modo Economia Ativo • {currentTime}
            </span>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center p-8 max-w-lg animate-in fade-in duration-700 text-slate-300">
            <div className="h-20 w-20 rounded-full bg-slate-900/90 border border-slate-800 flex items-center justify-center mb-6 shadow-2xl">
              <Moon className="h-10 w-10 text-indigo-400 animate-pulse" />
            </div>
            <div className="text-5xl sm:text-6xl font-black text-slate-100 tracking-tight font-mono mb-2">
              {currentTime}
            </div>
            <p className="text-sm font-semibold text-slate-400 capitalize">{currentDate}</p>
            <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-indigo-950/70 border border-indigo-800/70 px-4 py-1.5 text-xs font-semibold text-indigo-300 shadow-lg">
              <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
              <span>Modo Economia de Energia • Horário de Repouso</span>
            </div>
            <p className="mt-3 text-[11px] text-slate-500 font-mono">
              Programado para retomar a programação às {data.player.eco_sleep_end || '06:00'}
            </p>
          </div>
        )}

        {showControls && (
          <div className="absolute top-4 right-4 z-50">
            <button
              onClick={() => {
                if (data.player.id) {
                  api.togglePlayerSleep(data.player.id).then(() => loadPlayerData()).catch(() => {});
                }
              }}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white shadow-xl hover:bg-indigo-500 cursor-pointer"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Acordar Player</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className="relative flex h-screen w-screen items-center justify-center bg-black overflow-hidden select-none"
    >
      {/* 
        STAGE DE REPRODUÇÃO ADAPTATIVO:
        Respeita as resoluções de 1920x1080 (16:9) e 1080x1920 (9:16).
        Adapta-se a qualquer dispositivo (smart TVs, totens, desktops, tablets, smartphones)
        mantendo a proporção correta com moldura de cinema (letterboxing/pillarboxing).
      */}
      <div
        style={{
          aspectRatio: fitMode === 'contain' ? (isVertical ? '9 / 16' : '16 / 9') : undefined,
        }}
        className={`relative flex flex-col overflow-hidden bg-black transition-all duration-300 ${
          fitMode === 'contain'
            ? isVertical
              ? 'h-full max-h-screen w-auto max-w-full shadow-2xl ring-1 ring-slate-800/60'
              : 'w-full max-w-screen h-auto max-h-screen shadow-2xl ring-1 ring-slate-800/60'
            : 'w-full h-full'
        }`}
      >
        {/* 1. MÍDIA ATUAL (IMAGEM OU VÍDEO COM TRANSIÇÕES E VOLUME) */}
        <div className="relative flex-1 w-full h-full overflow-hidden bg-black flex items-center justify-center">
          {effectiveItems.length === 0 ? (
            <div className="text-center p-8 text-slate-500 max-w-md">
              <p className="text-xl font-bold text-slate-400">Sem mídias ativas nesta janela de horário</p>
              <p className="text-xs text-slate-600 mt-2">Os itens da playlist estão configurados para outros dias ou faixas de horário.</p>
            </div>
          ) : currentMedia?.type === 'weather_clock' ? (
            <div className={`w-full h-full ${getTransitionClass()}`}>
              <WeatherClockMedia
                key={currentMedia.id + currentIndex}
                weatherData={weatherData}
                city={data?.playlist?.weather_city || data?.weatherCity || weatherData.city}
                isVertical={isVertical}
                companyName={data?.company?.name}
                playerName={data?.player?.name}
              />
            </div>
          ) : currentMedia?.type === 'rss' ? (
            <div className={`w-full h-full ${getTransitionClass()}`}>
              <RssNewsMedia
                key={currentMedia.id + currentIndex}
                feedUrl={currentMedia.file_url}
                mediaName={currentMedia.name}
                duration={currentMedia.duration || 15}
                isVertical={isVertical}
                companyName={data?.company?.name}
                playerName={data?.player?.name}
                rssFeeds={data?.rssFeeds}
              />
            </div>
          ) : currentMedia?.type === 'video' ? (
            <div className={`relative w-full h-full flex items-center justify-center overflow-hidden ${getTransitionClass()}`}>
              <video
                ref={videoRef}
                key={currentMedia.id + currentIndex}
                src={resolveMediaUrl(currentMedia.file_url)}
                autoPlay
                playsInline
                onEnded={handleVideoEnded}
                onError={(e) => {
                  console.warn('Erro ao reproduzir vídeo ou codec offline, avançando para próxima mídia:', e);
                  setTimeout(() => {
                    advanceNextMedia();
                  }, 2000);
                }}
                className="h-full w-full object-cover"
              />

              {/* Sugestão 4: Indicador de Volume e Áudio */}
              <div className="absolute top-4 right-4 z-20 flex items-center gap-1.5 rounded-lg bg-black/60 backdrop-blur-md px-2.5 py-1 text-[11px] font-mono text-slate-300 border border-slate-800 pointer-events-none">
                {data.player.master_muted || currentMedia.is_muted ? (
                  <>
                    <VolumeX className="h-3.5 w-3.5 text-rose-400" />
                    <span className="text-rose-300 font-semibold">Mudo</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="h-3.5 w-3.5 text-emerald-400" />
                    <span>{Math.round(((data.player.master_volume ?? 100) * (currentMedia.volume ?? 100)) / 100)}%</span>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className={`w-full h-full ${getTransitionClass()}`}>
              <img
                key={currentMedia?.id + currentIndex}
                src={resolveMediaUrl(currentMedia?.file_url)}
                alt={currentMedia?.name}
                referrerPolicy="no-referrer"
                onError={(e) => {
                  console.warn('Erro ao carregar imagem, avançando:', e);
                  setTimeout(() => {
                    advanceNextMedia();
                  }, 2500);
                }}
                className="h-full w-full object-cover"
              />
            </div>
          )}
        </div>

        {/* 2. SUGESTÃO 2: LETREIRO DIGITAL & TICKER DE RODAPÉ (TICKER EM TEMPO REAL) */}
        {!activeCall && (
          <div
            style={{
              backgroundColor: data?.playlist?.custom_ticker_bg_color || '#090d16',
            }}
            className="relative z-30 flex items-stretch h-10 sm:h-12 w-full border-t border-slate-800 shadow-2xl overflow-hidden text-white"
          >
            {/* Bloco de Relógio & Clima à esquerda */}
            <div className="shrink-0 flex items-center gap-2.5 px-3 sm:px-4 bg-slate-900/90 border-r border-slate-800 z-10 text-xs font-semibold font-mono">
              <Clock className="h-3.5 w-3.5 text-blue-400 shrink-0" />
              <span className="font-bold text-white tracking-wider">{currentTime}</span>
              <span className="text-slate-600 hidden sm:inline">|</span>
              <span className="text-slate-300 text-[11px] hidden sm:inline">{weatherData.temp}°C</span>
            </div>

            {/* Letreiro em movimento contínuo (Marquee Ticker) */}
            <div className="flex-1 overflow-hidden relative flex items-center">
              <div
                className="whitespace-nowrap flex items-center gap-12 font-medium text-xs sm:text-sm tracking-wide text-slate-200 animate-ticker"
                style={{
                  animationDuration:
                    data?.playlist?.custom_ticker_speed === 1
                      ? '160s'
                      : data?.playlist?.custom_ticker_speed === 3
                      ? '60s'
                      : '100s',
                }}
              >
                {data?.playlist?.custom_ticker_enabled && data.playlist.custom_ticker_text ? (
                  <>
                    <span className="flex items-center gap-2 text-amber-300 font-bold">
                      <Radio className="h-3.5 w-3.5 text-amber-400 animate-pulse" />
                      {data.playlist.custom_ticker_text}
                    </span>
                    <span className="text-slate-500">•</span>
                    <span>{data.playlist.custom_ticker_text}</span>
                    <span className="text-slate-500">•</span>
                    <span className="text-blue-300">{data.player.name} • {data.company.name}</span>
                    <span className="text-slate-500">•</span>
                    <span>{data.playlist.custom_ticker_text}</span>
                  </>
                ) : (
                  (rssHeadlines.length > 0 ? rssHeadlines : DEFAULT_HEADLINES).map((hl, idx) => (
                    <React.Fragment key={idx}>
                      <span className="inline-flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-blue-400 shrink-0" />
                        {hl}
                      </span>
                      <span className="text-slate-600 font-bold">•</span>
                    </React.Fragment>
                  ))
                )}
              </div>
            </div>

            {/* Badge da Empresa / Player à direita */}
            <div className="shrink-0 hidden md:flex items-center gap-2 px-3 bg-slate-900/90 border-l border-slate-800 z-10 text-[11px] font-bold text-slate-300">
              <span className="truncate max-w-[140px] text-blue-400">{data?.player?.name}</span>
            </div>
          </div>
        )}

        {/* 3. OVERLAY DA CHAMADA EM DESTAQUE TOTAL (SOBREPÕE QUANDO HÁ CHAMADA) */}
        {activeCall && (
          <div
            className={`absolute inset-0 z-50 flex flex-col items-center justify-between backdrop-blur-md p-6 sm:p-10 text-white animate-in zoom-in-95 duration-300 ${
              activeCall.is_priority
                ? 'bg-slate-950/95 ring-8 ring-amber-500/40 ring-inset'
                : 'bg-slate-950/95'
            }`}
          >
            {/* Top Indicator */}
            <div className="pt-4 flex flex-col items-center gap-2">
              <div
                className={`inline-flex items-center gap-2.5 rounded-full px-6 py-2.5 shadow-xl animate-pulse ${
                  activeCall.is_priority
                    ? 'bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 text-slate-950 shadow-amber-500/50'
                    : 'bg-blue-600 text-white shadow-blue-900/50'
                }`}
              >
                {activeCall.is_priority ? (
                  <Star className="h-5 w-5 fill-slate-950 text-slate-950" />
                ) : (
                  <Bell className="h-5 w-5 text-white" />
                )}
                <span className="text-sm sm:text-base font-black uppercase tracking-widest">
                  {activeCall.is_priority ? 'ATENDIMENTO PREFERENCIAL' : 'CHAMADA DE ATENDIMENTO'}
                </span>
              </div>
              <span className="text-[10px] sm:text-xs uppercase tracking-widest text-slate-400 font-mono">
                {isVertical ? 'TOTEM VERTICAL • 9:16' : 'TELA HORIZONTAL • 16:9'}
              </span>
            </div>

            {/* Frase Prominente em Display Typography */}
            <div className="my-auto text-center px-4 w-full max-w-4xl">
              {activeCall.is_priority && (
                <div className="mb-4 inline-flex items-center gap-2 rounded-lg bg-amber-500/15 border border-amber-500/40 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-amber-300">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  <span>Fila Prioritária de Atendimento</span>
                </div>
              )}
              <h1
                className={`${
                  isVertical
                    ? 'text-3xl sm:text-5xl lg:text-6xl leading-snug'
                    : 'text-4xl sm:text-6xl lg:text-7xl leading-tight'
                } font-black tracking-tight drop-shadow-2xl break-words ${
                  activeCall.is_priority ? 'text-amber-200' : 'text-white'
                }`}
              >
                {activeCall.phrase}
              </h1>

              {/* Subtítulo / Localização do Player & Status de Voz */}
              <div className="mt-6 sm:mt-8 flex flex-col items-center gap-3">
                <div className="flex flex-wrap items-center justify-center gap-3 text-slate-300 text-xs sm:text-base font-semibold">
                  <span className="bg-slate-900/90 px-3 py-1 rounded-md border border-slate-700/80">
                    {data.player.name}
                  </span>
                  <span>•</span>
                  <span className={activeCall.is_priority ? 'text-amber-400' : 'text-blue-400'}>
                    {data.player.location || 'Atendimento'}
                  </span>
                </div>

                {/* Badge Dinâmico de Voz e Chime */}
                <div className="inline-flex items-center gap-2 rounded-full px-3.5 py-1 bg-slate-900/90 border border-slate-700/80 text-xs font-semibold shadow-lg">
                  <Volume2 className={`h-4 w-4 ${isSpeakingCall ? 'text-amber-400 animate-bounce' : 'text-blue-400'}`} />
                  <span className={isSpeakingCall ? 'text-amber-300 font-bold' : 'text-slate-300'}>
                    {isSpeakingCall ? 'Voz anunciando frase...' : 'Sinal sonoro & Voz ativados'}
                  </span>
                </div>
              </div>
            </div>

            {/* Barra de Progresso / Countdown */}
            <div className="w-full max-w-md pb-4">
              <div className="h-2.5 w-full rounded-full bg-slate-800 overflow-hidden shadow-inner">
                <div
                  className={`h-full transition-all duration-1000 ease-linear rounded-full ${
                    activeCall.is_priority ? 'bg-amber-400' : 'bg-blue-500'
                  }`}
                  style={{
                    width: `${(callRemaining / activeCall.duration) * 100}%`,
                  }}
                />
              </div>
              <p className="mt-2 text-center text-[11px] font-semibold text-slate-400 tracking-wider uppercase">
                Retornando à programação em {callRemaining}s
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Notificação Visual de Reinicialização de Playlist em Tempo Real */}
      {restartNotification && (
        <div
          id="player-restart-toast"
          className="absolute top-4 right-4 z-50 flex items-center gap-3 rounded-2xl bg-indigo-950/95 backdrop-blur-md px-4 py-2.5 text-xs font-semibold text-white shadow-2xl border border-indigo-400/50 animate-fade-in"
        >
          <RefreshCw className="h-4 w-4 animate-spin text-indigo-400 shrink-0" />
          <div>
            <div className="font-bold text-[11px] uppercase tracking-wider text-indigo-300">Playlist Atualizada</div>
            <div className="text-[12px] text-slate-100">{restartNotification.message}</div>
          </div>
        </div>
      )}

      {/* Indicador de Status Offline persistente */}
      {(!isOnline || isOfflinePlayback) && (
        <div
          id="player-offline-badge"
          className="absolute top-4 left-4 z-40 flex items-center gap-2 rounded-lg bg-amber-600/90 backdrop-blur-md px-3 py-1.5 text-xs font-bold text-white shadow-2xl border border-amber-400/40 animate-pulse"
        >
          <WifiOff className="w-4 h-4 text-amber-100" />
          <span>OFFLINE</span>
        </div>
      )}

      {/* 4. CONTROLES DISCRETOS AO MOVER O MOUSE (TOOLBAR SUPERIOR) */}
      <div
        className={`absolute top-4 right-4 z-50 flex flex-wrap items-center justify-end gap-1.5 max-w-[calc(100vw-2rem)] transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Sincronização e status do Cache Workbox */}
        <button
          type="button"
          onClick={() => precachePlaylistAssets(data.items)}
          disabled={cacheSyncStatus === 'syncing'}
          className="flex items-center gap-1.5 rounded-lg bg-slate-900/90 px-2.5 py-1.5 text-[11px] font-semibold text-slate-200 hover:text-white border border-slate-700/80 shadow-xl cursor-pointer backdrop-blur-sm disabled:opacity-50"
          title="Pré-carregar mídias da playlist no cache Workbox para reprodução 100% offline"
        >
          {cacheSyncStatus === 'syncing' ? (
            <RefreshCw className="h-3.5 w-3.5 text-blue-400 animate-spin" />
          ) : cacheSyncStatus === 'synced' ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
          ) : (
            <HardDriveDownload className="h-3.5 w-3.5 text-amber-400" />
          )}
          <span>
            {cacheSyncStatus === 'syncing'
              ? 'Baixando p/ Cache...'
              : cacheSyncStatus === 'synced'
              ? `Cache Pronto (${cachedMediaCount || allItems.length})`
              : 'Salvar p/ Offline'}
          </span>
        </button>

        {/* Alternar orientação para teste/simulação */}
        <button
          type="button"
          onClick={() => setOrientation(isVertical ? 'horizontal' : 'vertical')}
          className="flex items-center gap-1.5 rounded-lg bg-slate-900/90 px-2.5 py-1.5 text-[11px] font-semibold text-slate-200 hover:text-white border border-slate-700/80 shadow-xl cursor-pointer backdrop-blur-sm"
          title={`Alternar formato para ${isVertical ? 'Horizontal 16:9' : 'Vertical 9:16'}`}
        >
          {isVertical ? (
            <Tv className="h-3.5 w-3.5 text-blue-400" />
          ) : (
            <Smartphone className="h-3.5 w-3.5 text-emerald-400" />
          )}
          <span>{isVertical ? 'Ver em 16:9' : 'Ver em 9:16'}</span>
        </button>

        {/* Alternar modo de ajuste (Proporcional vs Preencher tela inteira) */}
        <button
          type="button"
          onClick={() => setFitMode(fitMode === 'contain' ? 'cover' : 'contain')}
          className="flex items-center gap-1.5 rounded-lg bg-slate-900/90 px-2.5 py-1.5 text-[11px] font-semibold text-slate-200 hover:text-white border border-slate-700/80 shadow-xl cursor-pointer backdrop-blur-sm"
          title={
            fitMode === 'contain'
              ? 'Preencher tela toda (esticar/ocupar tela inteira)'
              : 'Ajustar proporção exata (16:9 / 9:16)'
          }
        >
          <Scaling className="h-3.5 w-3.5 text-slate-300" />
          <span>{fitMode === 'contain' ? 'Proporção 16:9/9:16' : 'Preencher'}</span>
        </button>

        {/* Teste de áudio e voz sintetizada */}
        <button
          type="button"
          onClick={() => {
            unlockAudio();
            triggerCallOnScreen({
              id: `test-call-${Date.now()}`,
              phrase: 'Atenção, dirija-se ao atendimento no caixa 1',
              duration: 7,
              is_priority: false,
            });
          }}
          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold border shadow-xl cursor-pointer backdrop-blur-sm transition ${
            isSpeakingCall
              ? 'bg-amber-950/90 text-amber-300 border-amber-500/80 animate-pulse'
              : 'bg-slate-900/90 text-slate-200 hover:text-white border-slate-700/80'
          }`}
          title="Testar sinal sonoro de chamada e voz sintetizada em português"
        >
          <Volume2 className={`h-3.5 w-3.5 ${isSpeakingCall ? 'text-amber-400' : 'text-blue-400'}`} />
          <span>{isSpeakingCall ? 'Falando...' : 'Testar Som & Voz'}</span>
        </button>

        {/* Tela Cheia */}
        <button
          type="button"
          onClick={toggleFullscreen}
          className="rounded-lg bg-slate-900/90 p-2 text-slate-300 hover:text-white border border-slate-700/80 shadow-xl cursor-pointer backdrop-blur-sm"
          title="Alternar Tela Cheia"
        >
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>

        {/* Sair */}
        {onExit && (
          <button
            type="button"
            onClick={onExit}
            className="flex items-center gap-1.5 rounded-lg bg-slate-900/90 px-3 py-1.5 text-[11px] font-semibold text-rose-300 hover:text-rose-200 border border-slate-700/80 shadow-xl cursor-pointer backdrop-blur-sm"
            title="Voltar ao Painel"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sair</span>
          </button>
        )}
      </div>

      {/* Identificação do Player no canto superior esquerdo (ao mover o mouse) */}
      <div
        className={`absolute top-4 left-4 z-50 flex items-center gap-2 transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="rounded-lg bg-slate-900/90 px-3 py-1.5 border border-slate-700/80 text-[11px] font-mono text-slate-300 shadow-xl backdrop-blur-sm flex items-center gap-2">
          <span className="font-bold text-white">{data.player.name}</span>
          <span className="text-slate-600">|</span>
          <span className="text-blue-400">{data.player.code}</span>
          <span className="text-slate-600">|</span>
          <span
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${
              isVertical
                ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                : 'bg-blue-950/80 text-blue-300 border border-blue-800'
            }`}
          >
            {isVertical ? <Smartphone className="h-3 w-3" /> : <Tv className="h-3 w-3" />}
            <span>{isVertical ? '9:16 (1080×1920)' : '16:9 (1920×1080)'}</span>
          </span>
          <span className="text-slate-600">|</span>
          <span
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${
              isOnline
                ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                : 'bg-amber-950/80 text-amber-300 border border-amber-800'
            }`}
          >
            {isOnline ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            <span>{isOnline ? 'Online' : 'Offline (Cache Ativo)'}</span>
          </span>
        </div>
      </div>
    </div>
  );
};
