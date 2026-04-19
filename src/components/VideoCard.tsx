import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Play, Clock, MapPin, Star, Infinity as InfinityIcon } from 'lucide-react';
import type { Video } from '../lib/types';
import { formatPrice, formatDuration } from '../lib/types';

interface VideoCardProps {
  video: Video;
  featured?: boolean;
}

export default function VideoCard({ video, featured }: VideoCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleMouseEnter = () => {
    setIsHovered(true);
    videoRef.current?.play().catch(() => {});
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };

  // Seed a consistent pseudo-random hue accent per clip
  const accent = parseInt(video.id, 36) % 3 === 0 ? '#f97316' : '#38bdf8';

  return (
    <Link
      to={`/video/${video.id}`}
      className={`group relative block rounded-3xl overflow-hidden transition-all duration-300 hover:-translate-y-1 ${
        featured ? 'md:col-span-2 md:row-span-2' : ''
      }`}
      style={{
        background: 'linear-gradient(180deg, rgba(20,29,54,0.7), rgba(10,14,26,0.85))',
        border: '1px solid rgba(59, 108, 181, 0.25)',
        boxShadow: isHovered
          ? `0 20px 60px -20px ${accent}55, 0 0 0 1px ${accent}33`
          : '0 4px 20px -8px rgba(0,0,0,0.4)',
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Motion streak overlay on hover */}
      <div
        className={`absolute inset-0 pointer-events-none transition-opacity duration-500 z-10 ${
          isHovered ? 'opacity-70' : 'opacity-0'
        }`}
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: `${10 + i * 16}%`,
              left: '-10%',
              width: '120%',
              height: '1px',
              background: `linear-gradient(90deg, transparent, ${accent}88, transparent)`,
              transform: `rotate(${-3 + i}deg)`,
              filter: 'blur(0.5px)',
            }}
          />
        ))}
      </div>

      {/* Video / Thumbnail */}
      <div className={`relative overflow-hidden ${featured ? 'aspect-[21/9]' : 'aspect-video'}`}>
        {video.thumbnail_url && (
          <img
            src={video.thumbnail_url}
            alt={video.title}
            className={`absolute inset-0 w-full h-full object-cover transition-all duration-500 ${
              isHovered ? 'opacity-0 scale-110' : 'opacity-100 scale-100'
            }`}
          />
        )}

        {video.watermarked_url && (
          <video
            ref={videoRef}
            src={video.watermarked_url}
            muted
            loop
            playsInline
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
              isHovered ? 'opacity-100' : 'opacity-0'
            }`}
          />
        )}

        {/* Tiny-planet fallback when no thumbnail */}
        {!video.thumbnail_url && (
          <div className="absolute inset-0 flex items-center justify-center"
            style={{
              background: 'radial-gradient(ellipse at 50% 90%, #0f172a 0%, #0a0e1a 60%)',
            }}
          >
            <div
              className="rounded-full"
              style={{
                width: '60%',
                aspectRatio: '1',
                background: `radial-gradient(circle at 40% 40%, #15803d 0%, #166534 35%, #713f12 55%, #422006 75%, transparent 100%)`,
                boxShadow: `0 0 80px ${accent}66, inset -20px -30px 60px rgba(0,0,0,0.6)`,
              }}
            />
          </div>
        )}

        {/* Watermark */}
        <div className="watermark-overlay">
          <span className="watermark-text text-lg">SKYSTOCK</span>
        </div>

        {/* 360° angle badge */}
        <div className="absolute top-3 right-3 z-20">
          <span
            className="flex items-center gap-1 px-2.5 py-1 rounded-full backdrop-blur-md text-[10px] font-display font-bold uppercase tracking-wider"
            style={{
              background: 'rgba(10,14,26,0.7)',
              border: `1px solid ${accent}66`,
              color: '#ffffff',
            }}
          >
            <InfinityIcon className="w-3 h-3" style={{ color: accent }} />
            360°
          </span>
        </div>

        {/* Play on hover */}
        <div className={`absolute inset-0 flex items-center justify-center transition-all duration-300 z-20 ${
          isHovered ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
        }`}>
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center backdrop-blur-md"
            style={{
              background: `linear-gradient(135deg, ${accent}cc, rgba(249,115,22,0.8))`,
              boxShadow: `0 0 30px ${accent}99`,
            }}
          >
            <Play className="w-6 h-6 text-white ml-0.5" fill="white" />
          </div>
        </div>

        {/* Top-left badges */}
        <div className="absolute top-3 left-3 flex items-center gap-2 z-20">
          {video.featured && (
            <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-gradient-to-r from-ember-500 to-amber-500 text-[10px] font-display font-bold text-white uppercase tracking-wider">
              <Star className="w-3 h-3" fill="currentColor" /> Featured
            </span>
          )}
          <span className="px-2 py-1 rounded-full bg-sky-950/80 backdrop-blur-sm text-[10px] font-mono text-sky-200 uppercase">
            {video.resolution}·{video.fps}
          </span>
        </div>

        {/* Duration badge */}
        <div className="absolute bottom-3 right-3 z-20">
          <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-sky-950/80 backdrop-blur-sm text-[11px] font-mono text-sky-200">
            <Clock className="w-3 h-3" />
            {formatDuration(video.duration_seconds)}
          </span>
        </div>

        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-sky-950 via-sky-950/60 to-transparent" />
      </div>

      {/* Info */}
      <div className="p-4 relative z-20">
        <h3 className={`font-display font-bold text-white group-hover:text-sky-200 transition-colors line-clamp-1 ${
          featured ? 'text-2xl' : 'text-base'
        }`}>
          {video.title}
        </h3>

        {video.description && (
          <p className="mt-1 text-[13px] text-sky-400 line-clamp-2 leading-relaxed">{video.description}</p>
        )}

        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-3 text-[11px] text-sky-500">
            {video.location && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" /> {video.location}
              </span>
            )}
          </div>

          <div className="flex items-baseline gap-1.5">
            <span className="text-[10px] uppercase tracking-wider text-sky-600 font-mono">from</span>
            <span className="font-display font-bold text-ember-400 text-lg leading-none">
              {formatPrice(video.price_cents)}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
