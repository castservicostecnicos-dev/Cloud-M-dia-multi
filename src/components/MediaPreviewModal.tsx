import React, { useState, useRef } from 'react';
import {
  X,
  Play,
  Pause,
  Volume2,
  VolumeX,
  ExternalLink,
  Clock,
  Film,
  Image as ImageIcon,
  Newspaper,
  CloudSun,
  Maximize2,
  Check,
  Plus,
  Radio,
  HardDrive,
  CheckSquare,
} from 'lucide-react';
import { Media } from '../types';
import { WeatherClockMedia } from './WeatherClockMedia';
import { RssNewsMedia } from './RssNewsMedia';
import { resolveMediaDisplayUrl, extractDriveFileId } from '../lib/googleDrive';
import { getIndexedDbMedia } from '../lib/indexedDbMedia';
import { API_BASE_URL } from '../lib/api';

interface MediaPreviewModalProps {
  media: Media | null;
  onClose: () => void;
  onAddToPlaylist?: (media: Media) => void;
  onChoosePlaylists?: (media: Media) => void;
  isAlreadyInPlaylist?: boolean;
}

export const MediaPreviewModal: React.FC<MediaPreviewModalProps> = ({
  media,
  onClose,
  onAddToPlaylist,
  onChoosePlaylists,
  isAlreadyInPlaylist = false,
}) => {
  if (!media) return null;

  const [isPlaying, setIsPlaying] = useState(true);
  const getInitialMediaSrc = (m: Media): string => {
    const r2Url = (m as any).r2_url;
    if (r2Url && typeof r2Url === 'string' && r2Url.startsWith('http') && !r2Url.includes('drive.google.com')) {
      return r2Url;
    }
    if (m.type === 'video') {
      if (m.file_url && m.file_url.startsWith('http') && !m.file_url.includes('drive.google.com')) {
        return m.file_url;
      }
      if (m.local_url && m.local_url.startsWith('/uploads/')) return m.local_url;
      if (m.id) return `${API_BASE_URL}/media/stream/${m.id}`;
      if (m.file_url && m.file_url.startsWith('/uploads/')) return m.file_url;
    }
    return resolveMediaDisplayUrl(m.file_url);
  };

  const [isMuted, setIsMuted] = useState(true);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [videoCurrentTime, setVideoCurrentTime] = useState<number>(0);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
  const [imageError, setImageError] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [resolvedSrc, setResolvedSrc] = useState<string>(() => getInitialMediaSrc(media));
  const videoRef = useRef<HTMLVideoElement>(null);

  React.useEffect(() => {
    let isMounted = true;
    const initial = getInitialMediaSrc(media);
    setResolvedSrc(initial);
    if (initial && initial.startsWith('data:')) {
      return;
    }
    getIndexedDbMedia(media).then((rec) => {
      if (rec && isMounted) {
        setResolvedSrc(rec);
        setImageError(false);
        setVideoError(false);
      }
    }).catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [media.id, media.file_url, (media as any).local_url]);

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const remaining = Math.floor(sec % 60);
    return `${mins}:${remaining.toString().padStart(2, '0')}`;
  };

  const getFormatBadge = () => {
    if (media.type === 'weather_clock') return { label: 'CLIMA & HORA', color: 'bg-blue-600 border-blue-500' };
    if (media.type === 'rss') return { label: 'FEED RSS AO VIVO', color: 'bg-rose-600 border-rose-500' };

    const clean = (media.file_url || '').split('?')[0].toLowerCase();
    if (clean.endsWith('.mp4')) return { label: 'VÍDEO MP4', color: 'bg-purple-600 border-purple-500' };
    if (clean.endsWith('.webm')) return { label: 'VÍDEO WEBM', color: 'bg-purple-600 border-purple-500' };
    if (clean.endsWith('.mov')) return { label: 'VÍDEO MOV', color: 'bg-purple-600 border-purple-500' };
    if (clean.endsWith('.webp')) return { label: 'IMAGEM WEBP', color: 'bg-emerald-600 border-emerald-500' };
    if (clean.endsWith('.png')) return { label: 'IMAGEM PNG', color: 'bg-blue-600 border-blue-500' };
    if (clean.endsWith('.jpg') || clean.endsWith('.jpeg')) return { label: 'IMAGEM JPG', color: 'bg-amber-600 border-amber-500' };

    return media.type === 'video'
      ? { label: 'VÍDEO', color: 'bg-purple-600 border-purple-500' }
      : { label: 'IMAGEM', color: 'bg-slate-700 border-slate-600' };
  };

  const badge = getFormatBadge();

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-70 flex items-center justify-center bg-black/85 p-2 sm:p-4 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-4xl max-w-[calc(100vw-1rem)] max-h-[95vh] rounded-2xl border border-slate-700/80 bg-slate-900 shadow-2xl flex flex-col overflow-hidden text-slate-100"
      >
        {/* Header */}
        <div className="shrink-0 px-4 sm:px-6 py-3.5 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-extrabold uppercase text-white border shadow-xs ${badge.color}`}
            >
              {badge.label}
            </span>
            {Boolean(media.drive_file_id || media.drive_view_url || media.source === 'drive') && (
              <span className="shrink-0 rounded px-2 py-0.5 text-[10px] font-bold uppercase bg-blue-950/80 border border-blue-700 text-blue-300 flex items-center gap-1 shadow-xs">
                <HardDrive className="h-3 w-3 text-blue-400" />
                Nuvem
              </span>
            )}
            <h3 className="text-sm sm:text-base font-bold text-white truncate" title={media.name}>
              {media.name}
            </h3>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {(media.drive_view_url || media.drive_file_id || extractDriveFileId(media.file_url)) && (
              <a
                href={media.drive_view_url || (media.drive_file_id ? `https://drive.google.com/file/d/${media.drive_file_id}/view` : `https://drive.google.com/file/d/${extractDriveFileId(media.file_url)}/view`)}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-xs text-white bg-blue-600 hover:bg-blue-500 font-bold px-3 py-1.5 rounded-lg shadow-sm transition"
                title="Abrir arquivo em tamanho original"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Abrir Mídia</span>
                <span className="sm:hidden">Abrir</span>
              </a>
            )}
            {media.file_url && !media.file_url.startsWith('widget:') && (
              <a
                href={media.file_url}
                target="_blank"
                rel="noreferrer"
                className="hidden sm:flex items-center gap-1 text-xs text-slate-400 hover:text-blue-400 font-semibold px-2.5 py-1.5 rounded-lg hover:bg-slate-800 transition"
                title="Abrir arquivo original em nova aba"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span>Original</span>
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              title="Fechar (Esc)"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content Player / Preview Stage */}
        <div className="flex-1 min-h-[300px] max-h-[68vh] bg-black flex items-center justify-center overflow-hidden relative">
          {/* VIDEO PLAYER */}
          {media.type === 'video' && (
            <div className="w-full h-full flex flex-col items-center justify-center bg-black relative">
              {!videoError ? (
                <>
                  <video
                    ref={videoRef}
                    src={resolvedSrc || getInitialMediaSrc(media)}
                    autoPlay
                    controls
                    muted={isMuted}
                    playsInline
                    className="w-full h-full max-h-[64vh] object-contain"
                    onLoadedMetadata={(e) => {
                      const target = e.target as HTMLVideoElement;
                      setVideoDuration(Math.round(target.duration));
                    }}
                    onTimeUpdate={(e) => {
                      setVideoCurrentTime(Math.round((e.target as HTMLVideoElement).currentTime));
                    }}
                    onPlay={() => setIsPlaying(true)}
                    onError={(e) => {
                      const target = e.currentTarget;
                      const streamProxyUrl = `${API_BASE_URL}/media/stream/${media.id}?proxy=1`;
                      const directUrl = (media as any).r2_url || resolveMediaDisplayUrl(media.file_url);

                      if (directUrl && directUrl.startsWith('http') && !directUrl.includes('drive.google.com') && target.src && target.src.includes('/media/stream/') && !target.src.includes(directUrl)) {
                        target.src = directUrl;
                        setResolvedSrc(directUrl);
                        return;
                      }

                      if (streamProxyUrl && target.src && !target.src.includes('proxy=1')) {
                        target.src = streamProxyUrl;
                        setResolvedSrc(streamProxyUrl);
                        return;
                      }

                      const driveId = media.drive_file_id || extractDriveFileId(media.file_url);
                      if (driveId && !(target.src || '').includes('uc?export=download')) {
                        target.src = `https://drive.google.com/uc?export=download&id=${driveId}`;
                        return;
                      }
                      if ((media as any).local_url && target.src !== (media as any).local_url) {
                        target.src = (media as any).local_url;
                        return;
                      }
                      getIndexedDbMedia(media).then((rec) => {
                        if (rec && target.src !== rec) {
                          setResolvedSrc(rec);
                          target.src = rec;
                          setVideoError(false);
                        } else {
                          setVideoError(true);
                        }
                      }).catch(() => setVideoError(true));
                    }}
                  />
                  {/* Floating Audio Toggle */}
                  <button
                    type="button"
                    onClick={() => {
                      const next = !isMuted;
                      setIsMuted(next);
                      if (videoRef.current) videoRef.current.muted = next;
                    }}
                    className="absolute top-3 right-3 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/75 hover:bg-black/90 text-white text-xs font-semibold backdrop-blur-md border border-slate-700/80 transition shadow-lg cursor-pointer"
                    title={isMuted ? 'Ativar Áudio' : 'Desativar Áudio'}
                  >
                    {isMuted ? (
                      <>
                        <VolumeX className="h-4 w-4 text-rose-400" />
                        <span>Ativar Som</span>
                      </>
                    ) : (
                      <>
                        <Volume2 className="h-4 w-4 text-emerald-400" />
                        <span>Som Ativo</span>
                      </>
                    )}
                  </button>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center p-6 text-center text-slate-400 max-w-md">
                  <Film className="h-12 w-12 text-blue-400 mb-3" />
                  <p className="text-sm font-semibold text-white mb-1">Visualização de Vídeo</p>
                  <p className="text-xs text-slate-400 mb-4">
                    Tente recarregar o vídeo diretamente via servidor ou abrir na nuvem.
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setVideoError(false);
                        const proxyUrl = `${API_BASE_URL}/media/stream/${media.id}?proxy=1&t=${Date.now()}`;
                        setResolvedSrc(proxyUrl);
                        if (videoRef.current) {
                          videoRef.current.src = proxyUrl;
                          videoRef.current.load();
                        }
                      }}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg transition cursor-pointer"
                    >
                      <span>Tentar Novamente</span>
                    </button>
                    <a
                      href={media.drive_view_url || (media.drive_file_id ? `https://drive.google.com/file/d/${media.drive_file_id}/view` : media.file_url)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg transition"
                    >
                      <HardDrive className="h-4 w-4" />
                      <span>Abrir na Nuvem</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* IMAGE VIEWER */}
          {media.type === 'image' && (
            <div className="w-full h-full flex items-center justify-center p-2 bg-radial from-slate-950 to-black overflow-auto">
              {!imageError ? (
                <img
                  src={resolvedSrc || resolveMediaDisplayUrl(media.file_url)}
                  alt={media.name}
                  referrerPolicy="no-referrer"
                  onLoad={(e) => {
                    const img = e.currentTarget;
                    setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });
                  }}
                  onError={(e) => {
                    const target = e.currentTarget;
                    const driveId = media.drive_file_id || extractDriveFileId(media.file_url);
                    if (driveId && !(target.src || '').includes('thumbnail')) {
                      target.src = `https://drive.google.com/thumbnail?id=${driveId}&sz=w1920`;
                      return;
                    }
                    if (driveId && !(target.src || '').includes('uc?id=')) {
                      target.src = `https://drive.google.com/uc?id=${driveId}&export=view`;
                      return;
                    }
                    if ((media as any).local_url && target.src !== (media as any).local_url) {
                      target.src = (media as any).local_url;
                      return;
                    }
                    getIndexedDbMedia(media).then((rec) => {
                      if (rec && target.src !== rec) {
                        setResolvedSrc(rec);
                        target.src = rec;
                        setImageError(false);
                      } else {
                        setImageError(true);
                      }
                    }).catch(() => setImageError(true));
                  }}
                  className="max-w-full max-h-[64vh] object-contain rounded-lg shadow-xl"
                />
              ) : (
                <div className="flex flex-col items-center justify-center p-6 text-center text-slate-400 max-w-md">
                  <ImageIcon className="h-12 w-12 text-blue-400 mb-3" />
                  <p className="text-sm font-semibold text-white mb-1">Imagem armazenada na Nuvem</p>
                  <p className="text-xs text-slate-400 mb-4">
                    Abra a imagem diretamente na Nuvem para visualização em alta definição.
                  </p>
                  <a
                    href={media.drive_view_url || (media.drive_file_id ? `https://drive.google.com/file/d/${media.drive_file_id}/view` : media.file_url)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg transition"
                  >
                    <HardDrive className="h-4 w-4" />
                    <span>Visualizar na Nuvem</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              )}
            </div>
          )}

          {/* WEATHER & CLOCK SIMULATOR */}
          {media.type === 'weather_clock' && (
            <div className="w-full h-full p-4 sm:p-8 flex items-center justify-center bg-slate-950">
              <div className="w-full max-w-xl aspect-video rounded-2xl overflow-hidden border border-blue-800/40 shadow-2xl">
                <WeatherClockMedia
                  weatherData={{
                    city: 'São Paulo',
                    temp: 24,
                    condition: 'Parcialmente Nublado',
                    icon: 'cloud-sun',
                    humidity: 65,
                    windSpeed: 12,
                    forecast: [
                      { day: 'Amanhã', tempMax: 26, tempMin: 18, condition: 'Sol', icon: 'sun' },
                      { day: 'Sábado', tempMax: 28, tempMin: 19, condition: 'Sol com Nuvens', icon: 'cloud-sun' },
                      { day: 'Domingo', tempMax: 24, tempMin: 17, condition: 'Pancadas de Chuva', icon: 'cloud-rain' },
                    ],
                  }}
                  isVertical={false}
                />
              </div>
            </div>
          )}

          {/* RSS LIVE NEWS SIMULATOR */}
          {media.type === 'rss' && (
            <div className="w-full h-full p-4 sm:p-6 flex items-center justify-center bg-slate-950">
              <div className="w-full max-w-2xl aspect-video rounded-2xl overflow-hidden border border-rose-800/40 shadow-2xl">
                <RssNewsMedia
                  url={media.file_url}
                  isVertical={false}
                  duration={media.duration || 15}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer info & Actions */}
        <div className="shrink-0 px-4 sm:px-6 py-3 border-t border-slate-800 bg-slate-900/95 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-slate-400">
            <div className="flex items-center gap-1.5 font-medium">
              <Clock className="h-4 w-4 text-blue-400 shrink-0" />
              <span>Duração configurada: <strong>{media.duration}s</strong></span>
            </div>

            {media.type === 'video' && videoDuration && (
              <span className="font-mono text-slate-400">
                Vídeo: {formatSeconds(videoDuration)} ({videoDuration}s)
              </span>
            )}

            {media.type === 'image' && imageDimensions && (
              <span className="font-mono text-slate-400">
                Resolução: {imageDimensions.width} × {imageDimensions.height} px
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 sm:flex sm:flex-wrap sm:items-center justify-end gap-2 w-full sm:w-auto">
            {onChoosePlaylists && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onChoosePlaylists(media);
                }}
                className="w-full sm:w-auto justify-center min-h-[40px] px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center gap-2 transition cursor-pointer shadow-md text-center"
                title="Escolher em quais playlists esta mídia será exibida e definir duração"
              >
                <CheckSquare className="h-4 w-4 text-amber-200 shrink-0" />
                <span>Escolher Playlists</span>
              </button>
            )}

            {onAddToPlaylist && (
              <button
                type="button"
                onClick={() => {
                  onAddToPlaylist(media);
                  onClose();
                }}
                className="w-full sm:w-auto justify-center min-h-[40px] px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-2 transition cursor-pointer shadow-md text-center"
              >
                {isAlreadyInPlaylist ? (
                  <>
                    <Check className="h-4 w-4 text-emerald-300 shrink-0" />
                    <span>Adicionar Novamente</span>
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 shrink-0" />
                    <span>Adicionar</span>
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto justify-center min-h-[40px] px-4 py-2 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition cursor-pointer text-center"
            >
              Fechar Prévia
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
