import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Play, Pause,
  Clock, MapPin, Film,
  HardDrive, Gauge, ShoppingCart, ArrowLeft,
  Shield, CheckCircle2, Infinity as InfinityIcon, Sparkles,
  Wand2, Download, Eye,
} from 'lucide-react';
import HeroReframer from '../components/HeroReframer';
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
        setVideo({
          id: id || '1',
          title: 'Sunrise Over The Gemfields',
          description: 'Golden hour 360° FPV sweep across the sapphire mining fields of Central QLD. This breathtaking footage captures the raw beauty of the gem fields as first light breaks over the horizon. The DJI Avata 360 sweeps low across the terrain, delivering a full spherical master you can reframe to any angle — hero the horizon, drop into the cockpit POV, or pan to the mining rigs in the foreground. One clip, every angle.',
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
        try {
          const data = await getPublishedVideos({});
          const related = data.videos.filter((rv: Video) => rv.id !== id).slice(0, 3);
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
    if (playing) videoRef.current.pause();
    else videoRef.current.play().catch(() => {});
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
        <div className="aspect-video rounded-3xl animate-pulse bg-sky-800/20 mb-8" />
        <div className="h-8 w-1/2 bg-sky-800/20 rounded animate-pulse mb-4" />
        <div className="h-4 w-3/4 bg-sky-800/15 rounded animate-pulse" />
      </div>
    );
  }

  if (!video) {
    return (
      <div className="text-center py-20">
        <h2 className="font-display text-2xl text-white mb-2">Clip not found</h2>
        <Link to="/browse" className="btn-ghost mt-4">Back to library</Link>
      </div>
    );
  }

  const editPrice = 499; // $4.99 clean edit export
  const rawEditPremium = 2999; // $29.99 raw + edit bundle

  return (
    <div className="page-enter relative">
      {/* Motion streak backdrop */}
      <div className="absolute inset-x-0 top-0 h-[500px] pointer-events-none opacity-40 overflow-hidden">
        {Array.from({ length: 12 }).map((_, i) => {
          const top = (i * 47) % 100;
          const left = (i * 71) % 100;
          const width = 180 + (i * 23) % 280;
          const rotate = -20 + (i * 7) % 40;
          const hue = i % 3 === 0 ? '#f97316' : i % 3 === 1 ? '#38bdf8' : '#7dd3fc';
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                top: `${top}%`,
                left: `${left}%`,
                width: `${width}px`,
                height: '1.5px',
                background: `linear-gradient(90deg, transparent, ${hue}55, transparent)`,
                transform: `rotate(${rotate}deg)`,
                filter: 'blur(0.5px)',
              }}
            />
          );
        })}
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Back */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-sky-400 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to library
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8">
          {/* Viewport column */}
          <div>
            <div
              className={`relative rounded-3xl overflow-hidden group ${(video.preview_url || video.watermarked_url) ? 'cursor-pointer' : ''}`}
              onClick={(video.preview_url || video.watermarked_url) ? togglePlay : undefined}
              style={{
                border: '1px solid rgba(59,108,181,0.3)',
                boxShadow: '0 30px 80px -30px rgba(0,0,0,0.6), 0 0 0 1px rgba(249,115,22,0.15)',
              }}
            >
              {(video.preview_url || video.watermarked_url) ? (
                <div className="w-full aspect-video relative">
                  <HeroReframer
                    src={(video.preview_url || video.watermarked_url) as string}
                    poster={video.thumbnail_url}
                    lensCycleSec={8}
                    showLensLabel={true}
                  />
                </div>
              ) : video.thumbnail_url ? (
                <img
                  src={video.thumbnail_url}
                  alt={video.title}
                  className="w-full aspect-video object-cover"
                />
              ) : (
                <div className="w-full aspect-video flex items-center justify-center"
                  style={{
                    background: 'radial-gradient(ellipse at 50% 80%, #0f172a 0%, #0a0e1a 70%)',
                  }}
                >
                  <div
                    className="rounded-full"
                    style={{
                      width: '40%',
                      aspectRatio: '1',
                      background: 'radial-gradient(circle at 40% 40%, #15803d 0%, #166534 35%, #713f12 55%, #422006 75%, transparent 100%)',
                      boxShadow: '0 0 120px rgba(249,115,22,0.4), inset -20px -30px 60px rgba(0,0,0,0.6)',
                    }}
                  />
                </div>
              )}

              <div className="watermark-overlay">
                <span className="watermark-text">SKYSTOCK FPV</span>
              </div>

              {/* 360° floating badge */}
              <div className="absolute top-4 right-4 flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-md"
                style={{
                  background: 'rgba(10,14,26,0.7)',
                  border: '1px solid rgba(249,115,22,0.5)',
                }}
              >
                <InfinityIcon className="w-4 h-4 text-ember-400" />
                <span className="text-xs font-display font-bold text-white uppercase tracking-wider">360° Master</span>
              </div>

              {/* Play overlay — only when there is a real video to play */}
              {(video.preview_url || video.watermarked_url) ? (
                <div className={`absolute inset-0 flex items-center justify-center transition-opacity ${playing ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'}`}>
                  <div
                    className="w-20 h-20 rounded-full flex items-center justify-center backdrop-blur-md transition-transform hover:scale-110"
                    style={{
                      background: 'linear-gradient(135deg, rgba(56,189,248,0.8), rgba(249,115,22,0.8))',
                      boxShadow: '0 0 40px rgba(249,115,22,0.5)',
                    }}
                  >
                    {playing ? (
                      <Pause className="w-8 h-8 text-white" fill="white" />
                    ) : (
                      <Play className="w-8 h-8 text-white ml-1" fill="white" />
                    )}
                  </div>
                </div>
              ) : (
                <div className="absolute bottom-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/15 border border-amber-400/40 backdrop-blur-md">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  <span className="text-[11px] font-display font-medium text-amber-200">Preview video not uploaded yet</span>
                </div>
              )}

              {/* Low-res preview badge — top-left, unmistakable. Clean 4K is the paid product. */}
              {(video.preview_url || video.watermarked_url) && (
                <>
                  <div
                    className="absolute top-4 left-4 z-[5] pointer-events-none flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-md"
                    style={{
                      background: 'rgba(10,14,26,0.75)',
                      border: '1px solid rgba(245,158,11,0.45)',
                    }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                    <span className="text-[10px] font-display font-semibold text-amber-200 uppercase tracking-[0.18em]">
                      Low-res preview · clean 4K with purchase
                    </span>
                  </div>
                  <div className="absolute bottom-3 right-3 z-[5] pointer-events-none text-[10px] font-mono text-white/60 uppercase tracking-wider">
                    Watermarked · {formatDuration(video.duration_seconds)}
                  </div>
                </>
              )}
            </div>

            {/* Title block */}
            <div className="mt-6">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-ember-400 mb-2">
                <Sparkles className="w-3.5 h-3.5" />
                {video.location || 'Central QLD'}
              </div>
              <h1 className="font-display font-bold text-3xl sm:text-4xl text-white tracking-tight">{video.title}</h1>

              <div className="flex flex-wrap items-center gap-3 mt-4 text-sm">
                {video.location && (
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-900/40 border border-sky-700/30 text-sky-300">
                    <MapPin className="w-3.5 h-3.5" /> {video.location}
                  </span>
                )}
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-900/40 border border-sky-700/30 text-sky-300">
                  <Eye className="w-3.5 h-3.5" /> {video.view_count} views
                </span>
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-900/40 border border-sky-700/30 text-sky-300">
                  <Download className="w-3.5 h-3.5" /> {video.download_count} downloads
                </span>
                <span className="text-xs text-sky-600 font-mono">Uploaded {formatDate(video.created_at)}</span>
                {video.seller_id && video.seller_name && (
                  <Link
                    to={`/s/${video.seller_id}`}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-ember-500/10 border border-ember-400/40 text-ember-200 hover:bg-ember-500/20 transition-colors text-xs"
                  >
                    Shot by <strong className="font-display font-semibold">{video.seller_name}</strong>
                  </Link>
                )}
              </div>

              <p className="mt-5 text-sky-300 leading-relaxed max-w-3xl">{video.description}</p>

              <div className="flex flex-wrap gap-2 mt-5">
                {video.tags.map(tag => (
                  <Link
                    key={tag}
                    to={`/browse?q=${tag}`}
                    className="px-3 py-1 rounded-full bg-sky-900/40 text-xs font-mono text-sky-400 border border-sky-700/20 hover:border-ember-400/40 hover:text-ember-300 transition-colors"
                  >
                    #{tag}
                  </Link>
                ))}
              </div>
            </div>

            {/* Spec strip */}
            <div
              className="mt-6 rounded-2xl p-5 grid grid-cols-2 sm:grid-cols-4 gap-4"
              style={{
                background: 'linear-gradient(180deg, rgba(20,29,54,0.6), rgba(10,14,26,0.75))',
                border: '1px solid rgba(59,108,181,0.25)',
              }}
            >
              {[
                { icon: <Film className="w-4 h-4" />, label: 'RESOLUTION', value: video.resolution, note: 'H.265' },
                { icon: <Gauge className="w-4 h-4" />, label: 'FRAME RATE', value: `${video.fps}fps`, note: 'smooth' },
                { icon: <Clock className="w-4 h-4" />, label: 'DURATION', value: formatDuration(video.duration_seconds), note: `${video.duration_seconds}s` },
                { icon: <HardDrive className="w-4 h-4" />, label: 'FILE SIZE', value: formatFileSize(video.file_size_bytes), note: '360° master' },
              ].map((spec, i) => (
                <div key={i} className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-1.5 text-[10px] font-mono text-sky-500 uppercase tracking-wider">
                    {spec.icon}
                    {spec.label}
                  </div>
                  <span className="font-display font-bold text-lg text-white leading-none">{spec.value}</span>
                  <span className="text-[10px] text-sky-600 font-mono">{spec.note}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Twin-tier purchase sidebar */}
          <div>
            <div className="sticky top-24 space-y-4">
              {/* Tier 1: Raw master */}
              <div
                className="rounded-3xl p-6"
                style={{
                  background: 'linear-gradient(180deg, rgba(20,29,54,0.85), rgba(10,14,26,0.95))',
                  border: '1px solid rgba(59,108,181,0.3)',
                }}
              >
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-sky-400 mb-2">
                  <Download className="w-3 h-3" />
                  Option 1 · Raw footage
                </div>
                <h3 className="font-display font-bold text-xl text-white mb-1">360° Master</h3>
                <p className="text-xs text-sky-500 mb-4">Full spherical file. Edit anywhere — Premiere, Resolve, After Effects.</p>

                <div className="flex items-baseline gap-2 mb-4">
                  <span
                    className="font-display font-extrabold text-4xl"
                    style={{
                      backgroundImage: 'linear-gradient(90deg, #f97316 0%, #fdba74 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                    }}
                  >
                    {formatPrice(video.price_cents)}
                  </span>
                  <span className="text-xs text-sky-600 font-mono">AUD · one-time</span>
                </div>

                <div className="space-y-2 mb-5">
                  {[
                    'Royalty-free commercial license',
                    'Full unwatermarked equirectangular 4K',
                    'Up to 5 re-downloads for 72h',
                    'Instant email delivery',
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-sky-300">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      {item}
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => setShowCheckout(true)}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-display font-semibold text-sm text-white transition-all hover:scale-[1.02]"
                  style={{
                    background: 'linear-gradient(135deg, #f97316 0%, #fb923c 100%)',
                    boxShadow: '0 10px 30px -10px rgba(249,115,22,0.5)',
                  }}
                >
                  <ShoppingCart className="w-4 h-4" />
                  Buy 360° master
                </button>

                <div className="mt-3 flex items-center gap-1.5 text-[11px] text-sky-600">
                  <Shield className="w-3 h-3" /> Secure PayPal checkout
                </div>
              </div>

              {/* Tier 2: Edit in browser */}
              <div
                className="rounded-3xl p-6 relative overflow-hidden"
                style={{
                  background: 'linear-gradient(180deg, rgba(56,189,248,0.08), rgba(10,14,26,0.95))',
                  border: '1px solid rgba(56,189,248,0.3)',
                }}
              >
                <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full pointer-events-none"
                  style={{ background: 'radial-gradient(circle, rgba(56,189,248,0.25), transparent 70%)' }}
                />

                <div className="relative">
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-sky-300 mb-2">
                    <Wand2 className="w-3 h-3" />
                    Option 2 · Edit in browser
                  </div>
                  <h3 className="font-display font-bold text-xl text-white mb-1">Reframe & Export</h3>
                  <p className="text-xs text-sky-400 mb-4">Skip the download. Open in our editor, pick your angles, export finished video.</p>

                  <div className="space-y-2 mb-5">
                    {[
                      '360° reframing · Wide / Narrow / FPV / Fisheye',
                      'Keyframe camera moves & color grading',
                      'Auto D-Log M tonemap · stock music',
                      'Export 1080p / 4K · H.264 / MP4',
                    ].map((item, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-sky-200">
                        <CheckCircle2 className="w-3.5 h-3.5 text-sky-300 shrink-0 mt-0.5" />
                        {item}
                      </div>
                    ))}
                  </div>

                  {/* Two inline price tiers */}
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <div className="p-3 rounded-xl bg-sky-950/40 border border-sky-700/30">
                      <div className="text-[10px] font-mono uppercase text-sky-500 tracking-wider">Preview</div>
                      <div className="font-display font-bold text-white text-lg leading-none mt-1">Free</div>
                      <div className="text-[10px] text-sky-600 mt-1">Watermarked</div>
                    </div>
                    <div className="p-3 rounded-xl border"
                      style={{
                        background: 'linear-gradient(135deg, rgba(56,189,248,0.15), rgba(249,115,22,0.1))',
                        borderColor: 'rgba(56,189,248,0.4)',
                      }}
                    >
                      <div className="text-[10px] font-mono uppercase text-sky-300 tracking-wider">Clean export</div>
                      <div className="font-display font-bold text-lg leading-none mt-1"
                        style={{
                          backgroundImage: 'linear-gradient(90deg, #7dd3fc, #f97316)',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          backgroundClip: 'text',
                        }}
                      >
                        {formatPrice(editPrice)}
                      </div>
                      <div className="text-[10px] text-sky-400 mt-1">Per edit</div>
                    </div>
                  </div>

                  <Link
                    to={`/edit/${video.id}`}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-display font-semibold text-sm text-white transition-all hover:scale-[1.02]"
                    style={{
                      background: 'linear-gradient(135deg, #38bdf8 0%, #0ea5e9 100%)',
                      boxShadow: '0 10px 30px -10px rgba(56,189,248,0.5)',
                    }}
                  >
                    <Wand2 className="w-4 h-4" />
                    Open editor
                  </Link>

                  <div className="mt-3 text-[11px] text-sky-500 text-center font-mono">
                    Try it free — pay only on export
                  </div>
                </div>
              </div>

              {/* Bundle button */}
              <button
                type="button"
                onClick={() => setShowCheckout(true)}
                className="w-full rounded-2xl p-4 text-center transition-all hover:scale-[1.01] hover:border-ember-400/60 group"
                style={{
                  background: 'linear-gradient(180deg, rgba(20,29,54,0.5), rgba(10,14,26,0.6))',
                  border: '1px dashed rgba(59,108,181,0.3)',
                }}
              >
                <div className="text-[10px] font-mono uppercase tracking-wider text-sky-500 mb-1 group-hover:text-ember-400 transition-colors">
                  Bundle · best value
                </div>
                <div className="text-xs text-sky-200">
                  Raw master + unlimited edits ·{' '}
                  <span className="font-display font-bold text-ember-300">{formatPrice(rawEditPremium)}</span>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Related */}
        {relatedVideos.length > 0 && (
          <div className="mt-16 pt-10 border-t border-sky-700/20">
            <h2 className="font-display font-bold text-2xl text-white mb-6">More from Central QLD</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {relatedVideos.map(rv => (
                <VideoCard key={rv.id} video={rv} />
              ))}
            </div>
          </div>
        )}
      </div>

      <CheckoutModal
        video={video}
        isOpen={showCheckout}
        onClose={() => setShowCheckout(false)}
        onSuccess={handlePurchaseSuccess}
      />
    </div>
  );
}
