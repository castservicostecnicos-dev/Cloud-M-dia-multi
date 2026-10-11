import React, { useState, useEffect } from 'react';
import { Newspaper, Radio, Clock, Sparkles } from 'lucide-react';
import { api } from '../lib/api';
import { cleanRssText } from '../lib/rssCleaner';
import { RssArticle } from '../types';

interface RssNewsMediaProps {
  feedUrl?: string;
  mediaName?: string;
  duration?: number;
  isVertical?: boolean;
  companyName?: string;
  playerName?: string;
  rssFeeds?: Array<{ id: string; name: string; url: string; active: boolean }>;
}

const FALLBACK_ARTICLES: RssArticle[] = [
  {
    title: 'G1 Saúde: Especialistas reforçam a importância de hábitos saudáveis e prevenção regular',
    imageUrl: 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=1920&q=80',
    description: 'Manter a hidratação diária e a prática de exercícios físicos moderados são fundamentais para o bem-estar.',
    source: 'G1 Saúde & Bem-Estar',
  },
  {
    title: 'Avanços na Medicina e Tecnologia: Novos tratamentos melhoram qualidade de vida dos pacientes',
    imageUrl: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=1920&q=80',
    description: 'Pesquisas recentes apontam melhorias significativas em terapias preventivas e diagnósticos precoces.',
    source: 'Ciência & Saúde',
  },
  {
    title: 'Prevenção e Cuidados: Campanha orienta a população sobre a atualização da caderneta de vacinação',
    imageUrl: 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?auto=format&fit=crop&w=1920&q=80',
    description: 'A imunização coletiva protege crianças, adultos e idosos contra doenças sazonais.',
    source: 'Saúde Pública',
  },
  {
    title: 'Qualidade do Sono e Produtividade: Dicas práticas para descansar melhor e reduzir o estresse',
    imageUrl: 'https://images.unsplash.com/photo-1495020689067-958852a7765e?auto=format&fit=crop&w=1920&q=80',
    description: 'Especialistas explicam como uma rotina noturna equilibrada impacta a disposição física e mental.',
    source: 'Bem-Estar',
  },
];

// Memory counter to alternate news headlines on every playlist loop
let globalStoryIndex = 0;

export const RssNewsMedia: React.FC<RssNewsMediaProps> = ({
  feedUrl,
  mediaName,
  duration = 15,
  isVertical = false,
  companyName,
  playerName,
  rssFeeds = [],
}) => {
  const [articles, setArticles] = useState<RssArticle[]>(() => {
    try {
      const cached = localStorage.getItem(`indoor_rss_articles_${feedUrl || 'default'}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return FALLBACK_ARTICLES;
  });

  const [currentIndex, setCurrentIndex] = useState(0);
  const [now, setNow] = useState(new Date());
  const [imageError, setImageError] = useState(false);

  // Determine target RSS feed URL
  const targetUrl =
    feedUrl && feedUrl.trim() !== ''
      ? feedUrl
      : rssFeeds.length > 0
      ? rssFeeds[0].url
      : 'https://g1.globo.com/rss/g1/saude/';

  // Fetch articles on mount
  useEffect(() => {
    let isMounted = true;

    api
      .fetchRssArticles(targetUrl)
      .then((res) => {
        if (!isMounted) return;
        if (res.articles && res.articles.length > 0) {
          const cleanedArticles = res.articles.map((a) => ({
            ...a,
            title: cleanRssText(a.title),
            description: a.description ? cleanRssText(a.description) : undefined,
            source: a.source ? cleanRssText(a.source) : undefined,
          }));
          setArticles(cleanedArticles);
          try {
            localStorage.setItem(
              `indoor_rss_articles_${feedUrl || 'default'}`,
              JSON.stringify(cleanedArticles)
            );
          } catch (e) {}
        }
      })
      .catch((err) => {
        console.warn('Could not fetch RSS articles, using fallback cache:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [targetUrl, feedUrl]);

  // Advance news story on mount or every cycle
  useEffect(() => {
    if (articles.length > 0) {
      const nextIdx = globalStoryIndex % articles.length;
      setCurrentIndex(nextIdx);
      globalStoryIndex = (globalStoryIndex + 1) % articles.length;
    }
  }, [articles.length]);

  // Internal rotation if duration is long (e.g. >= 16 seconds, rotate every half)
  useEffect(() => {
    if (duration >= 16 && articles.length > 1) {
      const step = Math.max(8, Math.floor(duration / 2)) * 1000;
      const timer = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % articles.length);
        setImageError(false);
      }, step);
      return () => clearInterval(timer);
    }
  }, [duration, articles.length]);

  // Clock
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const currentArticle = articles[currentIndex] || FALLBACK_ARTICLES[0];
  const timeString = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const dateString = now.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const displayImage =
    !imageError && currentArticle.imageUrl
      ? currentArticle.imageUrl
      : FALLBACK_ARTICLES[currentIndex % FALLBACK_ARTICLES.length].imageUrl;

  return (
    <div
      id="rss-fullscreen-media"
      className="relative w-full h-full bg-slate-950 overflow-hidden select-none flex flex-col justify-between"
    >
      {/* BACKGROUND IMAGE with cinematic zoom & subtle grain */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <img
          key={displayImage}
          src={displayImage}
          alt={currentArticle.title}
          onError={() => setImageError(true)}
          className="w-full h-full object-cover transform scale-105 animate-[pulse_10s_ease-in-out_infinite] transition-opacity duration-1000"
          style={{
            filter: 'brightness(0.85) contrast(1.08)',
          }}
        />
        {/* Multilayer gradient scrims for pristine text legibility */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/50 to-black/40" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/30 to-transparent" />
      </div>

      {/* TOP BAR: Brand, Source, Realtime Status & Clock */}
      <header className="relative z-10 p-6 sm:p-8 lg:p-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-600/90 text-white font-bold text-xs sm:text-sm tracking-wider uppercase shadow-lg shadow-rose-950/40 backdrop-blur-md">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
            </span>
            <span>NOTÍCIA EM TEMPO REAL</span>
          </div>

          {currentArticle.source && (
            <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-white/90 text-xs sm:text-sm font-medium backdrop-blur-md border border-white/15">
              <Radio className="h-3.5 w-3.5 text-rose-400" />
              <span>{currentArticle.source}</span>
            </div>
          )}
        </div>

        {/* CLOCK & DATE */}
        <div className="flex items-center gap-4 text-right">
          <div className="hidden md:block">
            <p className="text-xs text-slate-300 capitalize font-medium">{dateString}</p>
            {companyName && (
              <p className="text-[11px] text-slate-400 tracking-wider uppercase">{companyName}</p>
            )}
          </div>
          <div className="flex items-center gap-2 bg-black/50 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 text-white">
            <Clock className="h-4 w-4 text-rose-400" />
            <span className="font-mono text-xl sm:text-2xl font-black tracking-tight">{timeString}</span>
          </div>
        </div>
      </header>

      {/* CENTER / BOTTOM CONTENT: Main Article Title and Summary */}
      <main className="relative z-10 px-6 sm:px-12 lg:px-16 pb-12 sm:pb-16 max-w-6xl">
        {/* Subtle Category & Source Tag */}
        <div className="flex items-center gap-2 mb-3 sm:mb-4">
          <Newspaper className="h-5 w-5 text-rose-400" />
          <span className="text-xs sm:text-sm uppercase tracking-widest text-rose-300 font-bold">
            {cleanRssText(mediaName || currentArticle.source || 'Informativo Indoor')}
          </span>
          <span className="text-white/40">•</span>
          <span className="text-xs text-white/70">
            {articles.length > 1 ? `Notícia ${currentIndex + 1} de ${articles.length}` : 'Atualização Contínua'}
          </span>
        </div>

        {/* HEADLINE */}
        <h1
          className={`font-black text-white leading-tight tracking-tight drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)] ${
            isVertical
              ? 'text-2xl sm:text-4xl lg:text-5xl line-clamp-4'
              : 'text-3xl sm:text-5xl lg:text-6xl line-clamp-3'
          }`}
        >
          {cleanRssText(currentArticle.title)}
        </h1>

        {/* DESCRIPTION / LEAD */}
        {currentArticle.description && (
          <p
            className={`mt-4 sm:mt-6 text-slate-200 font-normal leading-relaxed drop-shadow-[0_2px_8px_rgba(0,0,0,0.7)] ${
              isVertical ? 'text-sm sm:text-base line-clamp-3' : 'text-base sm:text-xl lg:text-2xl line-clamp-2 max-w-4xl'
            }`}
          >
            {cleanRssText(currentArticle.description)}
          </p>
        )}
      </main>

      {/* DURATION PROGRESS BAR (discreet bar along the bottom) */}
      <div className="relative z-10 w-full h-1.5 bg-white/15 overflow-hidden">
        <div
          key={`${currentIndex}-${duration}`}
          className="h-full bg-rose-500 rounded-r"
          style={{
            animation: `rssProgress ${duration}s linear forwards`,
          }}
        />
      </div>

      <style>{`
        @keyframes rssProgress {
          0% { width: 0%; }
          100% { width: 100%; }
        }
      `}</style>
    </div>
  );
};
