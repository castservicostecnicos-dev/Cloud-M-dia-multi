import React, { useState, useRef, useEffect } from 'react';
import {
  Film,
  Image as ImageIcon,
  Play,
  Eye,
  Clock,
  Newspaper,
  CloudSun,
  AlertTriangle,
  Radio,
} from 'lucide-react';
import { Media } from '../types';
import { resolveMediaDisplayUrl } from '../lib/googleDrive';

interface MediaThumbnailProps {
  media: Media | {
    id: string;
    name: string;
    type: string;
    file_url: string;
    duration?: number;
    size?: number;
    mime_type?: string;
  };
  className?: string;
  aspectRatio?: 'video' | 'square' | 'auto';
  showBadge?: boolean;
  showDuration?: boolean;
  showPreviewButton?: boolean;
  allowHoverPlay?: boolean;
  onPreview?: (media: any) => void;
}

export const MediaThumbnail: React.FC<MediaThumbnailProps> = ({
  media,
  className = '',
  aspectRatio = 'video',
  showBadge = true,
  showDuration = false,
  showPreviewButton = false,
  allowHoverPlay = true,
  onPreview,
}) => {
  const [hasError, setHasError] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Determine media extension or format label
  const getFormatLabel = () => {
    if (media.type === 'weather_clock') return 'CLIMA & HORA';
    if (media.type === 'rss') return 'FEED RSS';

    const url = media.file_url || '';
    const cleanUrl = url.split('?')[0].toLowerCase();

    if (cleanUrl.endsWith('.mp4')) return 'VÍDEO MP4';
    if (cleanUrl.endsWith('.webm')) return 'VÍDEO WEBM';
    if (cleanUrl.endsWith('.mov')) return 'VÍDEO MOV';
    if (cleanUrl.endsWith('.webp')) return 'IMAGEM WEBP';
    if (cleanUrl.endsWith('.png')) return 'IMAGEM PNG';
    if (cleanUrl.endsWith('.jpg') || cleanUrl.endsWith('.jpeg')) return 'IMAGEM JPG';
    if (cleanUrl.endsWith('.gif')) return 'GIF';

    return media.type === 'video' ? 'VÍDEO' : 'IMAGEM';
  };

  // Hover play handling for video
  const handleMouseEnter = () => {
    setIsHovered(true);
    if (allowHoverPlay && media.type === 'video' && videoRef.current && !hasError) {
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => setIsVideoPlaying(true))
          .catch(() => {
            // Browser autoplay policy might restrict or video failed
            setIsVideoPlaying(false);
          });
      }
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    if (allowHoverPlay && media.type === 'video' && videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
      setIsVideoPlaying(false);
    }
  };

  const aspectClass =
    aspectRatio === 'video'
      ? 'aspect-video'
      : aspectRatio === 'square'
      ? 'aspect-square'
      : 'h-full';

  const displayUrl = resolveMediaDisplayUrl(media.file_url);

  // Weather & Clock Widget
  if (media.type === 'weather_clock') {
    return (
      <div
        className={`relative w-full ${aspectClass} bg-gradient-to-br from-slate-900 via-blue-950/40 to-slate-900 p-3 flex flex-col justify-between overflow-hidden select-none ${className}`}
      >
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5">
          <div className="flex items-center gap-1.5 text-blue-400">
            <Clock className="h-3.5 w-3.5" />
            <span className="text-xs font-mono font-bold text-white">12:30:00</span>
          </div>
          <span className="text-[9px] font-semibold text-blue-300 uppercase tracking-wider">
            Hora Certa
          </span>
        </div>
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1.5">
            <CloudSun className="h-5 w-5 text-amber-400" />
            <div>
              <span className="text-sm font-bold text-white block leading-none">24°C</span>
              <span className="text-[9px] text-slate-400 leading-none">Previsão</span>
            </div>
          </div>
          <div className="text-right text-[9px] text-slate-400 font-mono">
            <span>Máx 28° / Mín 19°</span>
          </div>
        </div>

        {showBadge && (
          <span className="absolute top-2 right-2 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase bg-blue-600/90 border border-blue-500 text-white shadow-xs">
            CLIMA & HORA
          </span>
        )}

        {showPreviewButton && onPreview && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onPreview(media);
            }}
            className="absolute bottom-2 right-2 p-1.5 rounded-lg bg-slate-900/80 hover:bg-blue-600 text-slate-300 hover:text-white transition shadow-sm cursor-pointer"
            title="Pré-visualizar widget"
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  }

  // RSS Feed Widget
  if (media.type === 'rss') {
    return (
      <div
        className={`relative w-full ${aspectClass} bg-gradient-to-br from-slate-900 via-rose-950/40 to-slate-900 p-3 flex flex-col justify-between overflow-hidden select-none ${className}`}
      >
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5">
          <div className="flex items-center gap-1.5 text-rose-400">
            <Newspaper className="h-3.5 w-3.5" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Feed RSS</span>
          </div>
          <span className="text-[9px] font-bold bg-rose-900/60 text-rose-200 px-1.5 py-0.2 rounded border border-rose-700/50">
            Tela Inteira
          </span>
        </div>
        <div className="py-1">
          <p className="text-xs font-bold text-white line-clamp-2 leading-tight">
            {media.name}
          </p>
          <span className="text-[9px] text-slate-400 truncate block mt-1 font-mono">
            {media.file_url}
          </span>
        </div>
        <div className="text-[10px] text-rose-300/80 flex items-center gap-1">
          <Radio className="h-3 w-3 animate-pulse text-rose-400" />
          <span className="truncate">Notícias em Tempo Real</span>
        </div>

        {showBadge && (
          <span className="absolute top-2 right-2 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase bg-rose-600/90 border border-rose-500 text-white shadow-xs">
            NOTÍCIA RSS
          </span>
        )}

        {showPreviewButton && onPreview && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onPreview(media);
            }}
            className="absolute bottom-2 right-2 p-1.5 rounded-lg bg-slate-900/80 hover:bg-rose-600 text-slate-300 hover:text-white transition shadow-sm cursor-pointer"
            title="Pré-visualizar notícias"
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  }

  // Videos (MP4, WebM)
  if (media.type === 'video') {
    return (
      <div
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`relative w-full ${aspectClass} bg-slate-950 flex items-center justify-center overflow-hidden group select-none ${className}`}
      >
        {!hasError ? (
          <>
            <video
              ref={videoRef}
              src={displayUrl}
              muted
              playsInline
              preload="metadata"
              onLoadedMetadata={(e) => {
                const d = Math.round((e.target as HTMLVideoElement).duration);
                if (!isNaN(d) && d > 0) setVideoDuration(d);
              }}
              onError={() => setHasError(true)}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />

            {/* Video Play Badge / Indicator */}
            {!isVideoPlaying && (
              <div className="absolute inset-0 bg-black/25 flex items-center justify-center pointer-events-none transition-opacity group-hover:bg-black/15">
                <div className="h-9 w-9 rounded-full bg-slate-900/80 border border-slate-700/80 text-white flex items-center justify-center shadow-md backdrop-blur-xs group-hover:scale-110 group-hover:bg-blue-600 group-hover:border-blue-500 transition">
                  <Play className="h-4 w-4 ml-0.5 fill-current text-white" />
                </div>
              </div>
            )}

            {/* Playing indicator */}
            {isVideoPlaying && (
              <div className="absolute top-2 left-2 z-10 flex items-center gap-1 rounded bg-black/75 px-1.5 py-0.5 text-[9px] font-bold text-emerald-400 border border-emerald-500/50 backdrop-blur-xs">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                <span>Reproduzindo</span>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center text-center p-3 text-slate-500">
            <Film className="h-8 w-8 mb-1 text-slate-600" />
            <span className="text-[10px] font-medium text-slate-400">Vídeo indisponível</span>
          </div>
        )}

        {/* Type / Format Badge */}
        {showBadge && (
          <span className="absolute top-2 right-2 rounded px-1.5 py-0.5 text-[9px] font-extrabold uppercase bg-purple-600/90 border border-purple-500 text-white shadow-xs backdrop-blur-xs">
            {getFormatLabel()}
          </span>
        )}

        {/* Video Duration */}
        {(showDuration || videoDuration || media.duration) && (
          <div className="absolute bottom-2 left-2 z-10 flex items-center gap-1 rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-mono text-slate-300 border border-slate-700 backdrop-blur-xs">
            <Clock className="h-3 w-3 text-slate-400" />
            <span>{media.duration || videoDuration || 10}s</span>
          </div>
        )}

        {/* Quick Preview Button */}
        {showPreviewButton && onPreview && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onPreview(media);
            }}
            className="absolute bottom-2 right-2 z-10 p-1.5 rounded-lg bg-slate-900/90 hover:bg-blue-600 text-white border border-slate-700/80 transition shadow-sm cursor-pointer opacity-90 group-hover:opacity-100"
            title="Abrir pré-visualização completa com som"
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  }

  // Standard Image (JPG, PNG, WEBP, GIF)
  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`relative w-full ${aspectClass} bg-slate-950 flex items-center justify-center overflow-hidden group select-none ${className}`}
    >
      {!hasError ? (
        <img
          src={displayUrl}
          alt={media.name}
          referrerPolicy="no-referrer"
          onError={() => setHasError(true)}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      ) : (
        <div className="flex flex-col items-center justify-center text-center p-3 text-slate-500">
          <ImageIcon className="h-8 w-8 mb-1 text-slate-600" />
          <span className="text-[10px] font-medium text-slate-400">Imagem indisponível</span>
        </div>
      )}

      {/* Format Badge */}
      {showBadge && (
        <span className="absolute top-2 right-2 rounded px-1.5 py-0.5 text-[9px] font-extrabold uppercase bg-slate-900/90 border border-slate-700 text-white shadow-xs backdrop-blur-xs">
          {getFormatLabel()}
        </span>
      )}

      {/* Duration Badge */}
      {showDuration && media.duration && (
        <div className="absolute bottom-2 left-2 z-10 flex items-center gap-1 rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-mono text-slate-300 border border-slate-700 backdrop-blur-xs">
          <Clock className="h-3 w-3 text-slate-400" />
          <span>{media.duration}s</span>
        </div>
      )}

      {/* Quick Preview Button */}
      {showPreviewButton && onPreview && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onPreview(media);
          }}
          className="absolute bottom-2 right-2 z-10 p-1.5 rounded-lg bg-slate-900/90 hover:bg-blue-600 text-white border border-slate-700/80 transition shadow-sm cursor-pointer opacity-90 group-hover:opacity-100"
          title="Ver imagem em alta definição"
        >
          <Eye className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
};
