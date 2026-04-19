import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Play, Clock, MapPin, Star, Infinity as InfinityIcon, Sparkles } from 'lucide-react';
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

  // Equirectangular frames have low-distortion center and warped edges. We zoom INTO
  // the centre so the card shows a clean "forward view" instead of bent trees at the
  // sides. Bumps on hover for extra depth when the preview starts playing.
  const baseScale = 1.55;
  const hoverScale = 1.62;
  const accent = parseInt(video.id, 36) % 3 === 0 ? '#f97316' : '#38bdf8';
  const src = video.preview_url || video.watermarked_url;

  return (
    <Link
      to={`/video/${video.id}`}
      className={`group relative block rounded-3xl overflow-hidden transition-all duration-300 hover:-translate-y-1 ${
        featured ? 'md:col-span-2 md:row-span-2' : ''
      }`}
      style={{
        background: 'linear-gradient(180deg, rgba(20,29,54,0.8), rgba(10,14,26,0.92))',
        border: '1px solid rgba(59, 108, 181, 0.25)',
        boxShadow: isHovered
          ? `0 28px 70px -24px ${accent}66, 0 0 0 1px ${accent}44`
          : '0 8px 28px -10px rgba(0,0,0,0.55)',
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Viewport */}
      <div className={`relative overflow-hidden bg-[#0a0e1a] ${featured ? 'aspect-[21/9]' : 'aspect-[16/10]'}`}>
        {/* Thumbnail — scaled up so the equirect's low-distortion centre fills the frame */}
        {video.thumbnail_url && (
          <img
            src={video.thumbnail_url}
            alt={video.title}
            className="absolute inset-0 w-full h-full object-cover transition-all duration-500"
            style={{
              transform: `scale(${isHovered ? hoverScale : baseScale})`,
              transformOrigin: 'center center',
              opacity: isHovered && src ? 0 : 1,
              filter: 'contrast(1.05) saturate(1.08)',
            }}
          />
        )}

        {/* Hover-play preview — same centre-zoom treatment */}
        {src && (
          <video
            ref={videoRef}
            src={src}
            muted
            loop
            playsInline
            className="absolute inset-0 w-full h-full object-cover transition-all duration-500"
            style={{
              transform: `scale(${hoverScale})`,
              transformOrigin: 'center center',
              opacity: isHovered ? 1 : 0,
              filter: 'contrast(1.05) saturate(1.08)',
            }}
          />
        )}

        {/* Tiny-planet fallback when no thumbnail exists yet */}
        {!video.thumbnail_url && !src && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ background: 'radial-gradient(ellipse at 50% 90%, #0f172a 0%, #0a0e1a 60%)' }}
          >
            <div
              className="rounded-full"
              style={{
                width: '60%',
                aspectRatio: '1',
                background: 'radial-gradient(circle at 40% 40%, #15803d 0%, #166534 35%, #713f12 55%, #422006 75%, transparent 100%)',
                boxShadow: `0 0 80px ${accent}66, inset -20px -30px 60px rgba(0,0,0,0.6)`,
              }}
            />
          </div>
        )}

        {/* Inner vignette — darkens corners for cinematic feel and readable UI overlays */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse at center, transparent 55%, rgba(10,14,26,0.35) 100%)',
          }}
        />

        {/* Motion streaks on hover */}
        <div className={`absolute inset-0 pointer-events-none transition-opacity duration-500 z-10 ${isHovered ? 'opacity-75' : 'opacity-0'}`}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                top: `${14 + i * 18}%`,
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

        {/* Bottom fade for title-over-image readability */}
        <div className="absolute bottom-0 left-0 right-0 h-2/5 pointer-events-none"
          style={{ background: 'linear-gradient(180deg, transparent 0%, rgba(10,14,26,0.55) 60%, rgba(10,14,26,0.95) 100%)' }}
        />

        {/* Watermark — subtle, not obnoxious */}
        <div className="absolute bottom-3 left-3 z-10 pointer-events-none opacity-45 select-none">
          <span className="text-[9px] font-display font-semibold text-white uppercase tracking-[0.25em] drop-shadow-lg">
            SkyStock · Avata 360
          </span>
        </div>

        {/* Top-left badges */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5 z-20">
          {video.featured && (
            <span className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-display font-bold text-white uppercase tracking-wider"
              style={{ background: 'linear-gradient(135deg, #f97316, #f59e0b)', boxShadow: '0 4px 14px -2px rgba(249,115,22,0.5)' }}
            >
              <Star className="w-3 h-3" fill="currentColor" /> Featured
            </span>
          )}
          <span className="px-2 py-1 rounded-full bg-sky-950/85 backdrop-blur-sm text-[10px] font-mono text-sky-100 uppercase tracking-wider border border-sky-700/40">
            {video.resolution}·{video.fps}
          </span>
        </div>

        {/* 360° angle badge */}
        <div className="absolute top-3 right-3 z-20">
          <span
            className="flex items-center gap-1 px-2.5 py-1 rounded-full backdrop-blur-md text-[10px] font-display font-bold uppercase tracking-wider"
            style={{
              background: 'rgba(10,14,26,0.8)',
              border: `1px solid ${accent}88`,
              color: '#ffffff',
            }}
          >
            <InfinityIcon className="w-3 h-3" style={{ color: accent }} />
            360°
          </span>
        </div>

        {/* Duration badge — top-right under 360° */}
        <div className="absolute bottom-3 right-3 z-20">
          <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-sky-950/85 backdrop-blur-sm text-[11px] font-mono text-sky-100 tabular-nums border border-sky-700/40">
            <Clock className="w-3 h-3" />
            {formatDuration(video.duration_seconds)}
          </span>
        </div>

        {/* Play CTA — shows on hover */}
        <div className={`absolute inset-0 flex items-center justify-center transition-all duration-300 z-20 ${isHovered ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}>
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center backdrop-blur-md"
            style={{
              background: `linear-gradient(135deg, ${accent}dd, rgba(249,115,22,0.85))`,
              boxShadow: `0 0 36px ${accent}aa, 0 10px 24px -6px rgba(0,0,0,0.5)`,
            }}
          >
            <Play className="w-7 h-7 text-white ml-0.5" fill="white" />
          </div>
        </div>

        {/* Reframe teaser chip — bottom-left above watermark, implies interactivity */}
        <div className={`absolute bottom-9 left-3 z-20 transition-all duration-300 ${isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'}`}>
          <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-ember-500/20 backdrop-blur-md text-[10px] font-display font-semibold text-ember-200 uppercase tracking-wider border border-ember-400/40">
            <Sparkles className="w-3 h-3" />
            Reframe any angle
          </span>
        </div>
      </div>

      {/* Info */}
      <div className="p-4 relative z-20">
        <h3 className={`font-display font-bold text-white group-hover:text-sky-200 transition-colors line-clamp-1 ${featured ? 'text-2xl' : 'text-base'}`}>
          {video.title}
        </h3>

        {video.description && (
          <p className="mt-1 text-[13px] text-sky-400/90 line-clamp-2 leading-relaxed">{video.description}</p>
        )}

        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-3 text-[11px] text-sky-500">
            {video.location && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" /> {video.location}
              </span>
            )}
          </div>

          <div
            className="flex items-baseline gap-1.5 px-2.5 py-1 rounded-lg"
            style={{
              background: 'linear-gradient(135deg, rgba(249,115,22,0.12), rgba(245,158,11,0.08))',
              border: '1px solid rgba(249,115,22,0.35)',
            }}
          >
            <span className="text-[9px] uppercase tracking-wider text-ember-400/80 font-mono">from</span>
            <span className="font-display font-bold text-ember-300 text-base leading-none tabular-nums">
              {formatPrice(video.price_cents)}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
