import React, { useState, useEffect } from 'react';
import {
  Clock,
  Sun,
  CloudSun,
  Cloud,
  CloudRain,
  CloudLightning,
  Snowflake,
  Wind,
  Droplets,
  Thermometer,
  Calendar,
  MapPin,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { WeatherData, WeatherForecastDay } from '../types';

interface WeatherClockMediaProps {
  weatherData: WeatherData;
  city?: string;
  isVertical?: boolean;
  companyName?: string;
  playerName?: string;
}

export const WeatherClockMedia: React.FC<WeatherClockMediaProps> = ({
  weatherData,
  city = 'São Paulo',
  isVertical = false,
  companyName,
  playerName,
}) => {
  const [now, setNow] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  const seconds = now.getSeconds().toString().padStart(2, '0');

  // Format full friendly date in Portuguese: "Sexta-feira, 4 de Setembro de 2026"
  const weekday = now.toLocaleDateString('pt-BR', { weekday: 'long' });
  const capitalizedWeekday = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  const formattedDate = now.toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const displayCity = weatherData.city || city;

  const getWeatherIcon = (code: number, sizeClass = 'h-8 w-8') => {
    if (code === 0 || code === 1) {
      return <Sun className={`${sizeClass} text-amber-400`} />;
    }
    if (code === 2 || code === 3) {
      return <CloudSun className={`${sizeClass} text-amber-300`} />;
    }
    if (code >= 45 && code <= 48) {
      return <Cloud className={`${sizeClass} text-slate-300`} />;
    }
    if (code >= 51 && code <= 67) {
      return <CloudRain className={`${sizeClass} text-cyan-400`} />;
    }
    if (code >= 71 && code <= 77) {
      return <Snowflake className={`${sizeClass} text-blue-200`} />;
    }
    if (code >= 80 && code <= 82) {
      return <CloudRain className={`${sizeClass} text-blue-400`} />;
    }
    if (code >= 95) {
      return <CloudLightning className={`${sizeClass} text-amber-500`} />;
    }
    return <Sun className={`${sizeClass} text-amber-400`} />;
  };

  // Ensure we have at least a 4-day forecast for the UI
  const forecastList: WeatherForecastDay[] =
    weatherData.forecast && weatherData.forecast.length > 0
      ? weatherData.forecast
      : [
          {
            date: 'Hoje',
            dayName: 'Hoje',
            max: weatherData.temp + 3,
            min: weatherData.temp - 4,
            weatherCode: weatherData.weatherCode,
            text: weatherData.text,
            rainProb: 10,
          },
          {
            date: 'Amanhã',
            dayName: 'Amanhã',
            max: weatherData.temp + 4,
            min: weatherData.temp - 3,
            weatherCode: 1,
            text: 'Ensolarado',
            rainProb: 5,
          },
          {
            date: 'Dia 3',
            dayName: 'Depois de amanhã',
            max: weatherData.temp + 2,
            min: weatherData.temp - 5,
            weatherCode: 2,
            text: 'Parcialmente Nublado',
            rainProb: 20,
          },
          {
            date: 'Dia 4',
            dayName: 'Em 3 dias',
            max: weatherData.temp + 1,
            min: weatherData.temp - 4,
            weatherCode: 51,
            text: 'Pancadas de Chuva',
            rainProb: 60,
          },
        ];

  return (
    <div
      id="weather-clock-media-container"
      className="w-full h-full bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white flex flex-col justify-between overflow-hidden select-none p-6 sm:p-10 relative"
    >
      {/* Background ambient lighting effects */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header Tag */}
      <div className="relative z-10 flex items-center justify-between border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-600/20 border border-blue-500/40 text-blue-400 font-bold text-xs uppercase tracking-wider">
            <span className="h-2 w-2 rounded-full bg-blue-400 animate-pulse" />
            <span>HORA CERTA & PREVISÃO DO TEMPO</span>
          </div>
          {companyName && (
            <span className="hidden sm:inline-block text-xs font-semibold text-slate-400 tracking-wide">
              {companyName}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 text-slate-300 text-xs font-medium">
          <MapPin className="h-4 w-4 text-rose-400 shrink-0" />
          <span className="font-semibold text-white">{displayCity}</span>
          {playerName && (
            <span className="hidden md:inline text-slate-500">| {playerName}</span>
          )}
        </div>
      </div>

      {/* 1. PARTE SUPERIOR: RELÓGIO DIGITAL & HORA CERTA */}
      <div className={`relative z-10 flex flex-col items-center justify-center text-center ${isVertical ? 'my-4' : 'my-2 sm:my-4'}`}>
        {/* Main Clock */}
        <div className="flex items-baseline justify-center tracking-tight font-black font-mono drop-shadow-[0_4px_24px_rgba(59,130,246,0.3)]">
          <span className="text-6xl sm:text-8xl md:text-9xl text-white">
            {hours}
          </span>
          <span className="text-5xl sm:text-7xl md:text-8xl text-blue-400 animate-pulse mx-1 sm:mx-2 font-light">
            :
          </span>
          <span className="text-6xl sm:text-8xl md:text-9xl text-white">
            {minutes}
          </span>
          <span className="text-5xl sm:text-7xl md:text-8xl text-blue-400 animate-pulse mx-1 sm:mx-2 font-light">
            :
          </span>
          <span className="text-4xl sm:text-6xl md:text-7xl text-amber-400">
            {seconds}
          </span>
        </div>

        {/* Date Display */}
        <div className="mt-3 sm:mt-4 flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-slate-300">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800/80 border border-slate-700/60 shadow-sm">
            <Calendar className="h-4 w-4 text-blue-400" />
            <span className="text-sm sm:text-base font-bold text-white">
              {capitalizedWeekday}
            </span>
          </div>
          <span className="text-xs sm:text-sm font-medium text-slate-400">
            {formattedDate}
          </span>
        </div>
      </div>

      {/* 2. PARTE INFERIOR: CLIMA ATUAL COM PREVISÃO ESTENDIDA */}
      <div className={`relative z-10 w-full ${isVertical ? 'space-y-3' : 'space-y-4'}`}>
        {/* Banner com clima atual e métricas */}
        <div className="rounded-2xl bg-slate-900/80 border border-slate-800/90 p-4 sm:p-5 backdrop-blur-md shadow-2xl flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Lado Esquerdo: Temperatura e Condição */}
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 shadow-inner flex items-center justify-center shrink-0">
              {getWeatherIcon(weatherData.weatherCode, 'h-12 w-12 sm:h-14 sm:w-14')}
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl sm:text-5xl font-black text-white tracking-tight">
                  {weatherData.temp}°
                </span>
                <span className="text-lg sm:text-xl font-bold text-amber-400">
                  {weatherData.text}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 font-semibold">
                {displayCity}
              </p>
            </div>
          </div>

          {/* Lado Direito: Métricas (Sensação, Umidade, Vento) */}
          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 border-t md:border-t-0 md:border-l border-slate-800 pt-3 md:pt-0 md:pl-6">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/60 border border-slate-700/50">
              <Thermometer className="h-4 w-4 text-rose-400" />
              <div className="text-left leading-tight">
                <span className="block text-[10px] text-slate-400 uppercase font-semibold">Sensação</span>
                <span className="text-xs font-bold text-white">
                  {weatherData.apparentTemp ?? weatherData.temp}°C
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/60 border border-slate-700/50">
              <Droplets className="h-4 w-4 text-cyan-400" />
              <div className="text-left leading-tight">
                <span className="block text-[10px] text-slate-400 uppercase font-semibold">Umidade</span>
                <span className="text-xs font-bold text-white">
                  {weatherData.humidity ?? 60}%
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/60 border border-slate-700/50">
              <Wind className="h-4 w-4 text-emerald-400" />
              <div className="text-left leading-tight">
                <span className="block text-[10px] text-slate-400 uppercase font-semibold">Vento</span>
                <span className="text-xs font-bold text-white">
                  {weatherData.windSpeed ?? 12} km/h
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Grade de Previsão para os Próximos Dias */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Previsão para os Próximos Dias
            </span>
            <span className="text-[10px] text-slate-500 font-semibold">
              Atualização Automática
            </span>
          </div>

          <div
            className={`grid gap-2 sm:gap-3 ${
              isVertical
                ? 'grid-cols-2 sm:grid-cols-4'
                : 'grid-cols-2 sm:grid-cols-4 lg:grid-cols-5'
            }`}
          >
            {forecastList.slice(0, isVertical ? 4 : 5).map((f, idx) => (
              <div
                key={f.date || idx}
                className="rounded-xl bg-slate-900/60 border border-slate-800/80 p-3 flex flex-col justify-between hover:border-slate-700 transition"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white truncate">{f.dayName}</span>
                  {f.rainProb !== undefined && f.rainProb > 0 && (
                    <span className="text-[10px] text-cyan-400 font-semibold flex items-center gap-0.5">
                      <Droplets className="h-3 w-3" />
                      {f.rainProb}%
                    </span>
                  )}
                </div>

                <div className="my-2 flex items-center justify-center">
                  {getWeatherIcon(f.weatherCode, 'h-8 w-8')}
                </div>

                <p className="text-[11px] text-slate-300 font-medium text-center truncate mb-2">
                  {f.text}
                </p>

                <div className="flex items-center justify-between border-t border-slate-800/80 pt-1.5 text-xs font-mono font-bold">
                  <span className="flex items-center text-rose-400" title="Máxima">
                    <ArrowUp className="h-3 w-3" />
                    {f.max}°
                  </span>
                  <span className="flex items-center text-cyan-400" title="Mínima">
                    <ArrowDown className="h-3 w-3" />
                    {f.min}°
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
