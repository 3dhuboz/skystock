import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, ShieldX, Check, X, Loader2, AlertTriangle, MapPin, Clock, User, ExternalLink } from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';
import toast from 'react-hot-toast';

interface PendingClip {
  id: string;
  title: string;
  description: string;
  location: string;
  tags: string[];
  price_cents: number;
  duration_seconds: number;
  resolution: string;
  fps: number;
  seller_id: string;
  seller_name?: string;
  seller_location?: string;
  thumbnail_url: string | null;
  preview_url: string | null;
  watermarked_url: string | null;
  created_at: string;
}

interface PendingSeller {
  id: string;
  display_name: string;
  location: string;
  bio: string;
  email: string;
  rpl_number: string;
  payout_notes: string;
  approved: number;
  created_at: string;
  revenue_share_bps: number;
}

export default function AdminModeration() {
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [sellers, setSellers] = useState<PendingSeller[]>([]);
  const [clips, setClips] = useState<PendingClip[]>([]);
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const t = await getToken();
      const [sRes, cRes] = await Promise.all([
        fetch('/api/admin/sellers', { headers: { Authorization: `Bearer ${t}` } }),
        fetch('/api/admin/moderation', { headers: { Authorization: `Bearer ${t}` } }),
      ]);
      if (!sRes.ok) throw new Error(`sellers HTTP ${sRes.status}`);
      if (!cRes.ok) throw new Error(`moderation HTTP ${cRes.status}`);
      const sData = await sRes.json();
      const cData = await cRes.json();
      setSellers(sData.sellers || []);
      setClips(cData.clips || []);
    } catch (e: any) {
      setErr(e?.message || 'load failed');
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => { load(); }, [load]);

  async function mark(url: string, key: string, success: string) {
    setBusy(b => ({ ...b, [key]: true }));
    try {
      const t = await getToken();
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success(success);
      await load();
    } catch (e: any) {
      toast.error(e?.message || 'failed');
    } finally {
      setBusy(b => ({ ...b, [key]: false }));
    }
  }

  async function rejectWithReason(url: string, key: string) {
    const reason = window.prompt('Reason for rejection (shown to the seller):');
    if (!reason) return;
    setBusy(b => ({ ...b, [key]: true }));
    try {
      const t = await getToken();
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success('Rejected');
      await load();
    } catch (e: any) {
      toast.error(e?.message || 'failed');
    } finally {
      setBusy(b => ({ ...b, [key]: false }));
    }
  }

  const pendingSellers = sellers.filter(s => !s.approved);
  const approvedSellers = sellers.filter(s => s.approved);

  return (
    <div className="page-enter space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl text-white">Moderation</h1>
          <p className="text-sky-500 mt-1">Approve sellers + review pending clips</p>
        </div>
        <button
          onClick={load}
          className="btn-ghost text-sm"
          disabled={loading}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Refresh'}
        </button>
      </div>

      {err && (
        <div className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <div className="text-xs text-red-300 font-mono">{err}</div>
        </div>
      )}

      {/* Pending sellers */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="w-4 h-4 text-ember-400" />
          <h2 className="font-display font-semibold text-lg text-white">Pending sellers</h2>
          <span className="ml-1 px-2 py-0.5 rounded-full bg-ember-500/15 border border-ember-400/40 text-[10px] font-mono text-ember-300">
            {pendingSellers.length}
          </span>
        </div>
        {pendingSellers.length === 0 ? (
          <div className="glass-card p-6 text-sm text-sky-500">No applications waiting.</div>
        ) : (
          <div className="space-y-3">
            {pendingSellers.map(s => (
              <div key={s.id} className="glass-card p-5 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-sky-300" />
                      <h3 className="font-display font-semibold text-white">{s.display_name}</h3>
                      <span className="text-xs text-sky-600 font-mono">{s.id.slice(0, 14)}…</span>
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-xs text-sky-400">
                      <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {s.location || '—'}</span>
                      {s.rpl_number && <span className="font-mono">RePL {s.rpl_number}</span>}
                      <span className="text-sky-600">applied {new Date(s.created_at).toLocaleDateString()}</span>
                    </div>
                    {s.bio && <p className="mt-3 text-xs text-sky-300 leading-relaxed">{s.bio}</p>}
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <div className="text-[10px] font-mono uppercase text-sky-600 mb-0.5">Email</div>
                        <div className="text-sky-200 font-mono break-all">{s.email || '—'}</div>
                      </div>
                      <div>
                        <div className="text-[10px] font-mono uppercase text-sky-600 mb-0.5">Payout</div>
                        <div className="text-sky-200 font-mono break-all">{s.payout_notes}</div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-2 border-t border-sky-800/30">
                  <button
                    onClick={() => mark(`/api/admin/sellers/${s.id}/approve`, `s-${s.id}`, 'Seller approved')}
                    disabled={busy[`s-${s.id}`]}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-display font-semibold text-white"
                    style={{ background: 'linear-gradient(135deg, #10b981, #34d399)' }}
                  >
                    {busy[`s-${s.id}`] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    Approve
                  </button>
                  <button
                    onClick={() => rejectWithReason(`/api/admin/sellers/${s.id}/reject`, `s-${s.id}`)}
                    disabled={busy[`s-${s.id}`]}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-sky-300 border border-sky-700/40 hover:border-red-500/40 hover:text-red-300"
                  >
                    <X className="w-3.5 h-3.5" /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Pending clips */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <ShieldX className="w-4 h-4 text-amber-400" />
          <h2 className="font-display font-semibold text-lg text-white">Clips awaiting review</h2>
          <span className="ml-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-400/40 text-[10px] font-mono text-amber-300">
            {clips.length}
          </span>
        </div>
        {clips.length === 0 ? (
          <div className="glass-card p-6 text-sm text-sky-500">No clips in the queue.</div>
        ) : (
          <div className="space-y-3">
            {clips.map(v => (
              <div key={v.id} className="glass-card p-5 flex flex-col md:flex-row gap-5">
                <div className="md:w-64 shrink-0">
                  <div className="aspect-video rounded-xl overflow-hidden bg-sky-950 relative">
                    {v.preview_url ? (
                      <video src={v.preview_url} muted loop playsInline autoPlay className="w-full h-full object-cover" style={{ transform: 'scale(1.55)' }} />
                    ) : v.thumbnail_url ? (
                      <img src={v.thumbnail_url} alt="" className="w-full h-full object-cover" style={{ transform: 'scale(1.55)' }} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-sky-700 text-xs">No preview</div>
                    )}
                    <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full bg-sky-950/80 border border-sky-700/40 text-[10px] font-mono text-sky-200">
                      {v.resolution}·{v.fps}fps · {Math.round(v.duration_seconds)}s
                    </div>
                  </div>
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  <h3 className="font-display font-semibold text-white">{v.title}</h3>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-sky-400">
                    <span className="flex items-center gap-1"><User className="w-3 h-3" /> {v.seller_name || v.seller_id.slice(0, 12)}</span>
                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {v.location}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(v.created_at).toLocaleString()}</span>
                    <span className="text-ember-300 font-mono">${(v.price_cents / 100).toFixed(2)}</span>
                  </div>
                  <p className="text-xs text-sky-400/90 leading-relaxed line-clamp-3">{v.description}</p>
                  <div className="flex flex-wrap gap-1">
                    {(v.tags || []).map(t => (
                      <span key={t} className="px-2 py-0.5 rounded-full bg-sky-900/40 border border-sky-700/30 text-[10px] font-mono text-sky-400">#{t}</span>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <button
                      onClick={() => mark(`/api/admin/moderation/${v.id}/approve`, `c-${v.id}`, 'Clip published')}
                      disabled={busy[`c-${v.id}`]}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-display font-semibold text-white"
                      style={{ background: 'linear-gradient(135deg, #10b981, #34d399)' }}
                    >
                      {busy[`c-${v.id}`] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      Approve & publish
                    </button>
                    <button
                      onClick={() => rejectWithReason(`/api/admin/moderation/${v.id}/reject`, `c-${v.id}`)}
                      disabled={busy[`c-${v.id}`]}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-sky-300 border border-sky-700/40 hover:border-red-500/40 hover:text-red-300"
                    >
                      <X className="w-3.5 h-3.5" /> Reject
                    </button>
                    <Link
                      to={`/admin/videos/${v.id}`}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-sky-400 hover:text-sky-200"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Open in admin editor
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Approved sellers — reference list */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <h2 className="font-display font-semibold text-lg text-white">Approved sellers</h2>
          <span className="ml-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-400/40 text-[10px] font-mono text-emerald-300">
            {approvedSellers.length}
          </span>
        </div>
        {approvedSellers.length === 0 ? (
          <div className="glass-card p-6 text-sm text-sky-500">No approved sellers yet.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {approvedSellers.map(s => <ApprovedSellerCard key={s.id} seller={s} getToken={getToken} />)}
          </div>
        )}
      </section>
    </div>
  );
}

interface ApprovedSellerCardProps {
  seller: PendingSeller;
  getToken: () => Promise<string | null>;
}

function ApprovedSellerCard({ seller, getToken }: ApprovedSellerCardProps) {
  const [bps, setBps] = useState<number>(seller.revenue_share_bps ?? 8000);
  const [saving, setSaving] = useState(false);

  async function save(newBps: number) {
    setSaving(true);
    try {
      const t = await getToken();
      const res = await fetch(`/api/admin/sellers/${seller.id}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
        body: JSON.stringify({ bps: newBps }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setBps(newBps);
      toast.success(`Share set to ${(newBps / 100).toFixed(0)}%`);
    } catch (e: any) {
      toast.error(e?.message || 'failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="glass-card p-4">
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="font-display font-semibold text-white truncate">{seller.display_name}</div>
        <a
          href={`/s/${seller.id}`}
          target="_blank"
          rel="noopener"
          className="text-[10px] font-mono text-sky-400 hover:text-white shrink-0 uppercase tracking-wider"
        >
          profile →
        </a>
      </div>
      <div className="text-xs text-sky-400">{seller.location}</div>
      <div className="text-[10px] font-mono text-sky-600 mt-2 break-all line-clamp-1">{seller.id}</div>

      <div className="mt-3 pt-3 border-t border-sky-800/30">
        <div className="text-[10px] font-mono uppercase text-sky-500 tracking-wider mb-1.5">Revenue share</div>
        <div className="flex items-center gap-1">
          {[7000, 8000, 8500, 10000].map(opt => {
            const active = bps === opt;
            const label = opt === 10000 ? 'No fee' : `${(opt / 100).toFixed(0)}%`;
            return (
              <button
                key={opt}
                onClick={() => save(opt)}
                disabled={saving || active}
                className={`flex-1 px-1 py-1 rounded text-[10px] font-mono transition-all ${
                  active
                    ? 'bg-ember-500/25 border border-ember-400/50 text-ember-200'
                    : 'bg-sky-900/40 border border-sky-800/40 text-sky-400 hover:text-white'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
