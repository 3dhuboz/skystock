import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MapPin, Loader2, Sparkles, Film, Eye, Download, ArrowLeft } from 'lucide-react';
import VideoCard from '../components/VideoCard';
import type { Video } from '../lib/types';

interface ProfileResponse {
  seller: {
    id: string;
    display_name: string;
    bio: string | null;
    location: string | null;
    member_since: string;
  };
  clips: Video[];
  totals: { clips: number; views: number; sales: number };
}

export default function SellerProfile() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<ProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/sellers/${encodeURIComponent(id)}`);
        if (res.status === 404) { if (!cancelled) setNotFound(true); return; }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = (await res.json()) as ProfileResponse;
        if (!cancelled) setData(body);
      } catch {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-5 h-5 text-sky-400 animate-spin" />
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="page-enter max-w-lg mx-auto px-4 py-20 text-center">
        <h1 className="font-display font-bold text-2xl text-white mb-3">Seller not found</h1>
        <p className="text-sky-400 mb-5">This operator isn't approved or the link is stale.</p>
        <Link
          to="/browse"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-display font-medium text-sky-300 border border-sky-700/40 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" /> Back to library
        </Link>
      </div>
    );
  }

  const memberYear = new Date(data.seller.member_since).getFullYear();

  return (
    <div className="page-enter">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0" style={{
          background: 'linear-gradient(120deg, #0a0e1a 0%, #0e1426 60%, #17224a 100%)',
        }} />
        <div className="absolute inset-0 pointer-events-none opacity-40">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="absolute h-px"
              style={{
                top: `${8 + i * 7}%`,
                left: '-10%', right: '-10%',
                background: `rgba(${i % 2 ? '125,211,252' : '251,146,60'},${0.06 + (i % 3) * 0.03})`,
                transform: 'rotate(-3deg)',
                height: i % 4 === 0 ? 2 : 1,
              }}
            />
          ))}
        </div>

        <div className="relative max-w-7xl mx-auto px-6 lg:px-12 py-16">
          <Link
            to="/browse"
            className="inline-flex items-center gap-2 text-sm text-sky-400 hover:text-white mb-8 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to library
          </Link>

          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-ember-400 mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            SkyStock seller · Avata 360
          </div>
          <h1 className="font-display font-bold text-5xl md:text-6xl text-white tracking-tight leading-none">
            <span
              style={{
                backgroundImage: 'linear-gradient(90deg, #7dd3fc 0%, #f97316 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              {data.seller.display_name}
            </span>
          </h1>
          <div className="flex items-center gap-4 mt-4 text-sm text-sky-400">
            {data.seller.location && (
              <span className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4" /> {data.seller.location}
              </span>
            )}
            <span className="text-sky-600">Member since {memberYear}</span>
          </div>
          {data.seller.bio && (
            <p className="mt-5 text-sky-300 max-w-2xl leading-relaxed">{data.seller.bio}</p>
          )}

          {/* Stat row */}
          <div className="mt-8 grid grid-cols-3 gap-3 max-w-xl">
            {[
              { label: 'Clips',     value: data.totals.clips,  icon: <Film className="w-4 h-4" />,     tint: '#7dd3fc' },
              { label: 'Views',     value: data.totals.views,  icon: <Eye className="w-4 h-4" />,      tint: '#38bdf8' },
              { label: 'Downloads', value: data.totals.sales,  icon: <Download className="w-4 h-4" />, tint: '#f97316' },
            ].map((s, i) => (
              <div key={i} className="rounded-2xl p-4"
                style={{
                  background: 'linear-gradient(180deg, rgba(20,29,54,0.7), rgba(10,14,26,0.85))',
                  border: `1px solid ${s.tint}33`,
                }}
              >
                <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider mb-1.5" style={{ color: s.tint }}>
                  {s.icon} {s.label}
                </div>
                <div className="font-display font-bold text-2xl text-white leading-none tabular-nums">{s.value}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Clips */}
      <section className="max-w-7xl mx-auto px-6 lg:px-12 pb-16">
        <h2 className="font-display font-bold text-2xl text-white mb-5">Clips from {data.seller.display_name}</h2>
        {data.clips.length === 0 ? (
          <div
            className="rounded-2xl p-8 text-center"
            style={{
              background: 'linear-gradient(180deg, rgba(20,29,54,0.5), rgba(10,14,26,0.7))',
              border: '1px dashed rgba(59,108,181,0.3)',
            }}
          >
            <div className="text-sm text-sky-400">No published clips yet.</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {data.clips.map(v => <VideoCard key={v.id} video={v} />)}
          </div>
        )}
      </section>
    </div>
  );
}
