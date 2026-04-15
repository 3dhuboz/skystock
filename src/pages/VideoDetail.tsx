import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Play, Pause, Volume2, VolumeX,
  Clock, MapPin, Eye, Download, Camera, Film,
  HardDrive, Gauge, ShoppingCart, ArrowLeft,
  Shield, Zap, CheckCircle2
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getVideo, getPublishedVideos, recordView } from '../lib/api';
import { formatPrice, formatDuration, formatFileSize, formatDate } from '../lib/types';
import type { Video } from '../lib/types';
import CheckoutModal from '../components/CheckoutModal';
import VideoCard from '../components/VideoCard';

export default function VideoDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);

  const [video, setVideo] = useState<Video | null>(null);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [progress, setProgress] = useState(0);

  // Checkout state
  const [showCheckout, setShowCheckout] = useState(false);
  const [relatedVideos, setRelatedVideos] = useState<Video[]>([]);

  useEffect(() => {
    async function load() {
      if (!id) return;
      try {
        const v = await getVideo(id);
        setVideo(v);
        recordView(id).catch(() => {});
      } catch {
        // Demo fallback
        setVideo({
          id: id || '1',
          title: 'Sunrise Over The Gemfields',
          description: 'Golden hour FPV sweep across the sapphire mining fields of Central QLD. This breathtaking footage captures the raw beauty of the gem fields as first light breaks over the horizon, illuminating the unique red earth landscape with warm golden tones. The DJI Avata 2 sweeps low across the terrain, providing an immersive perspective that traditional drone footage simply cannot match.',
          location: 'Emerald, QLD',
          tags: ['sunrise', 'mining', 'golden-hour', 'outback', 'landscape'],
          price_cents: 3999,
          duration_seconds: 47,
          resolution: '4K',
          fps: 60,
          file_size_bytes: 524288000,
          preview_key: '', watermarked_key: '', original_key: '', thumbnail_key: '',
          status: 'published',
          download_count: 24,
          view_count: 313,
          featured: true,
          created_at: '2025-01-15',
          updated_at: '2025-01-15',
        });
        // Fetch related videos
        try {
          const data = await getPublishedVideos({});
          const related = data.videos
            .filter((rv: Video) => rv.id !== id)
            .slice(0, 3);
          setRelatedVideos(related);
        } catch {
          setRelatedVideos([]);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (playing) {
      videoRef.current.pause();
    } else {
      videoRef.current.play().catch(() => {});
    }
    setPlaying(!playing);
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    setProgress((videoRef.current.currentTime / videoRef.current.duration) * 100);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    videoRef.current.currentTime = pct * videoRef.current.duration;
  };

  function handlePurchaseSuccess(downloadToken: string, email: string) {
    setShowCheckout(false);
    navigate(`/success?token=${downloadToken}&email=${encodeURIComponent(email)}`);
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="glass-card aspect-video animate-pulse bg-sky-800/20 rounded-2xl mb-8" />
        <div className="h-8 w-1/2 bg-sky-800/20 rounded animate-pulse mb-4" />
        <div className="h-4 w-3/4 bg-sky-800/15 rounded animate-pulse" />
      </div>
    );
  }

  if (!video) {
    return (
      <div className="text-center py-20">
        <h2 className="font-display text-2xl text-white mb-2">Video not found</h2>
        <Link to="/browse" className="btn-ghost mt-4">Back to browse</Link>
      </div>
    );
  }

  return (
    <div className="page-enter max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Back */}
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-sky-400 hover:text-sky-200 mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Video Player Column */}
        <div className="lg:col-span-2">
          {/* Video Player */}
          <div className="video-preview-container glass-card overflow-hidden relative group cursor-pointer" onClick={togglePlay}>
            {/* Video element */}
            {video.watermarked_url ? (
              <video
                ref={videoRef}
                src={video.watermarked_url}
                muted={muted}
                playsInline
                onTimeUpdate={handleTimeUpdate}
                onEnded={() => setPlaying(false)}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-sky-800/60 to-sky-900/60 flex items-center justify-center">
                <Film className="w-20 h-20 text-sky-700" />
              </div>
            )}

            {/* Watermark */}
            <div className="watermark-overlay">
              <span className="watermark-text">SKYSTOCK FPV</span>
            </div>

            {/* Play/Pause overlay */}
            <div className={`absolute inset-0 flex items-center justify-center transition-opacity ${playing ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'}`}>
              <div className="w-20 h-20 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center border border-white/25 transition-transform hover:scale-110">
                {playing ? (
                  <Pause className="w-8 h-8 text-white" fill="white" />
                ) : (
                  <Play className="w-8 h-8 text-white ml-1" fill="white" />
                )}
              </div>
            </div>

            {/* Controls bar */}
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-sky-950/90 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
              {/* Progress bar */}
              <div className="h-1 bg-sky-800 rounded-full mb-3 cursor-pointer" onClick={(e) => { e.stopPropagation(); handleSeek(e); }}>
                <div className="h-full bg-ember-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button onClick={(e) => { e.stopPropagation(); togglePlay(); }} className="text-white hover:text-ember-400 transition-colors">
                    {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); setMuted(!muted); }} className="text-white hover:text-ember-400 transition-colors">
                    {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                  </button>
                  <span className="text-xs font-mono text-sky-300">
                    {formatDuration(video.duration_seconds)}
                  </span>
                </div>
                <span className="text-xs font-mono text-sky-400">Preview — Watermarked</span>
              </div>
            </div>
          </div>

          {/* Video Info */}
          <div className="mt-6">
            <h1 className="font-display font-bold text-2xl sm:text-3xl text-white">{video.title}</h1>

            <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-sky-400">
              {video.location && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-ember-400" /> {video.location}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Eye className="w-4 h-4" /> {video.view_count} views
              </span>
              <span className="flex items-center gap-1.5">
                <Download className="w-4 h-4" /> {video.download_count} downloads
              </span>
              <span className="text-sky-600">Uploaded {formatDate(video.created_at)}</span>
            </div>

            <p className="mt-5 text-sky-300 leading-relaxed">{video.description}</p>

            {/* Tags */}
            <div className="flex flex-wrap gap-2 mt-5">
              {video.tags.map(tag => (
                <Link
                  key={tag}
                  to={`/browse?q=${tag}`}
                  className="px-3 py-1 rounded-full bg-sky-800/40 text-xs font-mono text-sky-300 border border-sky-700/20 hover:border-sky-500/30 transition-colors"
                >
                  #{tag}
                </Link>
              ))}
            </div>
          </div>

          {/* Technical Specs */}
          <div className="glass-card p-6 mt-6">
            <h3 className="font-display font-semibold text-sky-200 mb-4">Technical Specifications</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { icon: <Film className="w-5 h-5" />, label: 'Resolution', value: video.resolution },
                { icon: <Gauge className="w-5 h-5" />, label: 'Frame Rate', value: `${video.fps} fps` },
                { icon: <Clock className="w-5 h-5" />, label: 'Duration', value: formatDuration(video.duration_seconds) },
                { icon: <HardDrive className="w-5 h-5" />, label: 'File Size', value: formatFileSize(video.file_size_bytes) },
              ].map((spec, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="text-sky-500 mt-0.5">{spec.icon}</div>
                  <div>
                    <span className="block text-xs text-sky-500 font-mono">{spec.label}</span>
                    <span className="block text-sm font-display font-semibold text-white">{spec.value}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-sky-700/20 flex items-center gap-2 text-sm text-sky-500">
              <Camera className="w-4 h-4" />
              Shot on DJI Avata 2 · Central Queensland, Australia
            </div>
          </div>
        </div>

        {/* Purchase Sidebar */}
        <div className="lg:col-span-1">
          <div className="glass-card p-6 sticky top-24">
            <div className="text-center mb-6">
              <span className="font-display font-extrabold text-4xl bg-gradient-to-r from-ember-400 to-amber-400 bg-clip-text text-transparent">
                {formatPrice(video.price_cents)}
              </span>
              <span className="block text-xs text-sky-500 font-mono mt-1">AUD · One-time purchase</span>
            </div>

            {/* License info */}
            <div className="space-y-3 mb-6">
              {[
                { icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />, text: 'Royalty-free license' },
                { icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />, text: 'Commercial & personal use' },
                { icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />, text: 'Full unwatermarked 4K file' },
                { icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />, text: 'Up to 5 downloads' },
                { icon: <Shield className="w-4 h-4 text-sky-400" />, text: 'Secure PayPal checkout' },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 text-sm text-sky-300">
                  {item.icon}
                  {item.text}
                </div>
              ))}
            </div>

            <button onClick={() => setShowCheckout(true)} className="btn-ember w-full text-base py-4">
              <ShoppingCart className="w-5 h-5" /> Buy Now
            </button>

            {/* Quick info */}
            <div className="mt-6 pt-6 border-t border-sky-700/20">
              <div className="flex items-center gap-2 text-xs text-sky-500">
                <Zap className="w-3.5 h-3.5" />
                Instant download link sent to your email after payment
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Related Videos */}
      {relatedVideos.length > 0 && (
        <div className="mt-12 pt-8 border-t border-sky-700/20">
          <h2 className="font-display font-bold text-xl text-white mb-6">More Footage You Might Like</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {relatedVideos.map(rv => (
              <VideoCard key={rv.id} video={rv} />
            ))}
          </div>
        </div>
      )}

      {/* PayPal Checkout Modal */}
      <CheckoutModal
        video={video}
        isOpen={showCheckout}
        onClose={() => setShowCheckout(false)}
        onSuccess={handlePurchaseSuccess}
      />
    </div>
  );
}
