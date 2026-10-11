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
} from 'lucide-react';
import { Media } from '../types';
import { WeatherClockMedia } from './WeatherClockMedia';
import { RssNewsMedia } from './RssNewsMedia';
import { resolveMediaDisplayUrl } from '../lib/googleDrive';

interface MediaPreviewModalProps {
  media: Media | null;
  onClose: () => void;
  onAddToPlaylist?: (media: Media) => void;
  isAlreadyInPlaylist?: boolean;
}

export const MediaPreviewModal: React.FC<MediaPreviewModalProps> = ({
  media,
  onClose,
  onAddToPlaylist,
  isAlreadyInPlaylist = false,
}) => {
  if (!media) return null;

  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [videoCurrentTime, setVideoCurrentTime] = useState<number>(0);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

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
            <h3 className="text-sm sm:text-base font-bold text-white truncate" title={media.name}>
              {media.name}
            </h3>
          </div>

          <div className="flex items-center gap-2 shrink-0">
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
              <video
                ref={videoRef}
                src={resolveMediaDisplayUrl(media.file_url)}
                autoPlay
                controls
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
                onPause={() => setIsPlaying(false)}
              />
            </div>
          )}

          {/* IMAGE VIEWER */}
          {media.type === 'image' && (
            <div className="w-full h-full flex items-center justify-center p-2 bg-radial from-slate-950 to-black overflow-auto">
              <img
                src={resolveMediaDisplayUrl(media.file_url)}
                alt={media.name}
                referrerPolicy="no-referrer"
                onLoad={(e) => {
                  const img = e.currentTarget;
                  setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });
                }}
                className="max-w-full max-h-[64vh] object-contain rounded-lg shadow-xl"
              />
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

          <div className="grid grid-cols-2 sm:flex sm:items-center justify-end gap-2 w-full sm:w-auto">
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
