import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { Upload, Loader2, Clock, Eye, DollarSign, Film, ArrowUpRight, ShieldAlert, Sparkles, Clapperboard } from 'lucide-react';
import { Logo } from '../components/Logo';
import { formatPrice, formatDuration } from '../lib/types';

interface SellerClip {
  id: string;
  title: string;
  status: 'draft' | 'pending_review' | 'published' | 'archived';
  price_cents: number;
  resolution: string;
  fps: number;
  duration_seconds: number;
  sale_count: number;
  gross_cents: number;
  earnings_cents: number;
  /** true when earnings came from recorded sales; false when it's a projection at the current share. */
  earnings_locked: boolean;
  created_at: string;
  moderation_notes: string | null;
  thumbnail_url: string | null;
}

interface SellerClipsResponse {
  clips: SellerClip[];
  share_bps: number;
  totals: { sales: number; gross: number; earnings: number };
}

const STATUS_META: Record<SellerClip['status'], { label: string; tint: string }> = {
  draft:           { label: 'Draft',            tint: '#7dd3fc' },
  pending_review:  { label: 'In review',        tint: '#fbbf24' },
  published:       { label: 'Live · for sale',  tint: '#34d399' },
  archived:        { label: 'Archived',         tint: '#94a3b8' },
};

export default function SellerClips() {
  const { getToken } = useAuth();
  const [data, setData] = useState<SellerClipsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const t = await getToken();
      const res = await fetch('/api/seller/clips', { headers: { Authorization: `Bearer ${t}` } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (e: any) {
      setErr(e?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="min-h-screen relative overflow-hidden bg-sky-950 text-white">
      {/* Motion streak backdrop */}
      <div className="absolute inset-x-0 top-0 h-[400px] pointer-events-none opacity-35 overflow-hidden">
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

      {/* Top bar */}
      <nav className="relative z-10 border-b border-sky-700/20 backdrop-blur-xl" style={{ background: 'rgba(10,14,26,0.7)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <Logo size={32} />
            <div>
              <span className="font-display font-bold text-white">SkyStock</span>
              <span className="block text-[10px] font-mono text-ember-400 uppercase tracking-widest">Seller</span>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/browse" className="text-sm text-sky-300 hover:text-white">Browse</Link>
            <Link to="/account" className="text-sm text-sky-300 hover:text-white">Account</Link>
            <Link
              to="/seller/upload"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-display font-semibold text-white"
              style={{ background: 'linear-gradient(135deg, #f97316, #fb923c)' }}
            >
              <Upload className="w-3.5 h-3.5" /> Upload clip
            </Link>
          </div>
        </div>
      </nav>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-ember-400 mb-3">
          <Sparkles className="w-3.5 h-3.5" />
          Seller workspace
        </div>
        <h1 className="font-display font-bold text-4xl md:text-5xl tracking-tight leading-none">
          <span
            style={{
              backgroundImage: 'linear-gradient(90deg, #7dd3fc 0%, #f97316 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            Your clips
          </span>
        </h1>
        <p className="text-sky-400 mt-3">
          80% seller take · 20% platform fee · monthly payouts (manual during beta)
        </p>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-8">
          {[
            { label: 'Total clips', value: data ? String(data.clips.length) : '—', icon: <Film className="w-4 h-4" />, tint: '#7dd3fc' },
            { label: 'Sales', value: data ? String(data.totals.sales) : '—', icon: <Eye className="w-4 h-4" />, tint: '#38bdf8' },
            { label: 'Gross revenue', value: data ? formatPrice(data.totals.gross) : '—', icon: <DollarSign className="w-4 h-4" />, tint: '#fbbf24' },
            { label: 'Your earnings', value: data ? formatPrice(data.totals.earnings) : '—', icon: <DollarSign className="w-4 h-4" />, tint: '#34d399' },
          ].map((s, i) => (
            <div key={i} className="rounded-2xl p-4" style={{ background: 'linear-gradient(180deg, rgba(20,29,54,0.7), rgba(10,14,26,0.85))', border: `1px solid ${s.tint}33` }}>
              <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider mb-2" style={{ color: s.tint }}>
                {s.icon} {s.label}
              </div>
              <div className="font-display font-bold text-2xl leading-none">{s.value}</div>
            </div>
          ))}
        </div>

        {/* Clip list */}
        <div className="mt-10 flex items-center justify-between">
          <h2 className="font-display font-semibold text-lg">All clips</h2>
          {data && <div className="text-xs text-sky-500">Revenue share: <span className="text-ember-300 font-mono">{(data.share_bps / 100).toFixed(0)}%</span></div>}
        </div>

        {err && (
          <div className="mt-3 flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
            <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div className="text-xs text-red-300 font-mono">{err}</div>
          </div>
        )}

        {loading && !data ? (
          <div className="mt-6 flex items-center gap-2 text-sky-400 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading your clips…
          </div>
        ) : data && data.clips.length === 0 ? (
          <div
            className="mt-6 rounded-3xl p-10 text-center"
            style={{ background: 'linear-gradient(180deg, rgba(20,29,54,0.6), rgba(10,14,26,0.8))', border: '1px dashed rgba(59,108,181,0.35)' }}
          >
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
              style={{
                background: 'linear-gradient(135deg, rgba(56,189,248,0.15), rgba(249,115,22,0.15))',
                border: '1px solid rgba(59,108,181,0.25)',
                color: '#7dd3fc',
              }}
            >
              <Clapperboard className="w-7 h-7" />
            </div>
            <h3 className="font-display font-bold text-xl mb-2">Upload your first clip</h3>
            <p className="text-sky-400 text-sm max-w-sm mx-auto mb-5">
              Drop a 360° MP4. We'll extract a thumbnail, record a watermarked preview, and queue it for review. Approved clips go live on the library within 48h.
            </p>
            <Link
              to="/seller/upload"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-display font-semibold text-white transition-all hover:scale-[1.02]"
              style={{
                background: 'linear-gradient(135deg, #f97316 0%, #fb923c 100%)',
                boxShadow: '0 10px 30px -10px rgba(249,115,22,0.5)',
              }}
            >
              <Upload className="w-4 h-4" /> Upload clip
            </Link>
          </div>
        ) : data ? (
          <div className="mt-4 space-y-3">
            {data.clips.map(v => {
              const meta = STATUS_META[v.status];
              return (
                <div
                  key={v.id}
                  className="rounded-2xl p-4 flex items-center gap-4"
                  style={{ background: 'linear-gradient(180deg, rgba(20,29,54,0.7), rgba(10,14,26,0.85))', border: '1px solid rgba(59,108,181,0.25)' }}
                >
                  <div className="w-28 h-16 shrink-0 rounded-lg overflow-hidden bg-sky-950 relative">
                    {v.thumbnail_url ? (
                      <img src={v.thumbnail_url} alt="" className="w-full h-full object-cover" style={{ transform: 'scale(1.55)' }} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-sky-700"><Film className="w-4 h-4" /></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-display font-semibold text-white truncate">{v.title}</h3>
                      <span
                        className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider"
                        style={{
                          background: `${meta.tint}1a`,
                          color: meta.tint,
                          border: `1px solid ${meta.tint}55`,
                        }}
                      >
                        {meta.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-sky-500 font-mono">
                      <span>{v.resolution}·{v.fps}</span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {formatDuration(v.duration_seconds)}</span>
                      <span>{formatPrice(v.price_cents)}</span>
                      <span>{v.sale_count} sales</span>
                      {v.earnings_locked ? (
                        <span className="text-emerald-300">earned {formatPrice(v.earnings_cents)}</span>
                      ) : v.status === 'published' ? (
                        <span className="text-sky-600">~{formatPrice(v.earnings_cents)} per sale</span>
                      ) : null}
                    </div>
                    {v.status === 'draft' && v.moderation_notes && (
                      <div className="mt-2 text-[11px] text-red-300 bg-red-500/10 border border-red-500/30 rounded px-2 py-1 inline-block">
                        Rejected: {v.moderation_notes}
                      </div>
                    )}
                  </div>
                  <Link
                    to={`/video/${v.id}`}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-sky-900/40 border border-sky-700/30 text-sky-200 text-xs hover:bg-sky-900/60"
                  >
                    Preview <ArrowUpRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
