import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Play, Clock, MapPin, Eye, Download, Star } from 'lucide-react';
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

  return (
    <Link
      to={`/video/${video.id}`}
      className={`group block glass-card-hover overflow-hidden ${
        featured ? 'md:col-span-2 md:row-span-2' : ''
      }`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Video / Thumbnail */}
      <div className={`relative overflow-hidden ${featured ? 'aspect-[21/9]' : 'aspect-video'}`}>
        {/* Thumbnail */}
        {video.thumbnail_url && (
          <img
            src={video.thumbnail_url}
            alt={video.title}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
              isHovered ? 'opacity-0' : 'opacity-100'
            }`}
          />
        )}

        {/* Video preview on hover */}
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

        {/* Fallback gradient background */}
        {!video.thumbnail_url && (
          <div className="absolute inset-0 bg-gradient-to-br from-sky-800 to-sky-900" />
        )}

        {/* Watermark overlay */}
        <div className="watermark-overlay">
          <span className="watermark-text text-lg">SKYSTOCK</span>
        </div>

        {/* Play icon on hover */}
        <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-200 ${
          isHovered ? 'opacity-100' : 'opacity-0'
        }`}>
          <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
            <Play className="w-6 h-6 text-white ml-0.5" fill="white" />
          </div>
        </div>

        {/* Top badges */}
        <div className="absolute top-3 left-3 flex items-center gap-2">
          {video.featured && (
            <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/90 text-xs font-display font-semibold text-sky-950">
              <Star className="w-3 h-3" fill="currentColor" /> Featured
            </span>
          )}
          <span className="px-2 py-1 rounded-lg bg-sky-950/80 backdrop-blur-sm text-xs font-mono text-sky-200">
            {video.resolution} · {video.fps}fps
          </span>
        </div>

        {/* Duration badge */}
        <div className="absolute bottom-3 right-3">
          <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-sky-950/80 backdrop-blur-sm text-xs font-mono text-sky-200">
            <Clock className="w-3 h-3" />
            {formatDuration(video.duration_seconds)}
          </span>
        </div>

        {/* Bottom gradient */}
        <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-sky-950/80 to-transparent" />
      </div>

      {/* Info */}
      <div className="p-4">
        <h3 className={`font-display font-semibold text-white group-hover:text-sky-300 transition-colors line-clamp-1 ${
          featured ? 'text-xl' : 'text-base'
        }`}>
          {video.title}
        </h3>

        {video.description && (
          <p className="mt-1 text-sm text-sky-400 line-clamp-2">{video.description}</p>
        )}

        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs text-sky-500">
            {video.location && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" /> {video.location}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Eye className="w-3 h-3" /> {video.view_count}
            </span>
            <span className="flex items-center gap-1">
              <Download className="w-3 h-3" /> {video.download_count}
            </span>
          </div>

          <span className="font-display font-bold text-ember-400 text-lg">
            {formatPrice(video.price_cents)}
          </span>
        </div>
      </div>
    </Link>
  );
}
