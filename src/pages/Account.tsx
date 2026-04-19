import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useUser, UserButton } from '@clerk/clerk-react';
import {
  Wand2, Download, Clock, Sparkles, Film, Clapperboard,
  CreditCard, Mail, ShoppingBag, ArrowUpRight, Shield,
  Infinity as InfinityIcon,
} from 'lucide-react';
import { formatPrice } from '../lib/types';
import { useIsAdmin } from '../lib/admin';

interface Edit {
  id: string;
  clip_title: string;
  clip_id: string;
  created_at: string;
  duration_seconds: number;
  status: 'draft' | 'exported' | 'paid';
  thumbnail_url?: string;
  price_cents?: number;
}

interface Purchase {
  id: string;
  kind: 'raw' | 'clean-edit' | 'bundle';
  clip_title: string;
  price_cents: number;
  created_at: string;
  download_token?: string;
}

const DEMO_EDITS: Edit[] = [
  { id: 'e1', clip_title: 'Sunrise Over The Gemfields', clip_id: '1', created_at: '2026-04-18', duration_seconds: 18, status: 'draft' },
  { id: 'e2', clip_title: 'Reef Coastline Rush', clip_id: '2', created_at: '2026-04-12', duration_seconds: 30, status: 'paid', price_cents: 499 },
  { id: 'e3', clip_title: 'Cane Fields at Dusk', clip_id: '3', created_at: '2026-04-05', duration_seconds: 24, status: 'exported' },
];

const DEMO_PURCHASES: Purchase[] = [
  { id: 'p1', kind: 'raw', clip_title: 'Sunrise Over The Gemfields', price_cents: 3999, created_at: '2026-04-18', download_token: 'tok_abc123' },
  { id: 'p2', kind: 'clean-edit', clip_title: 'Reef Coastline Rush', price_cents: 499, created_at: '2026-04-12' },
];

export default function Account() {
  const { user, isLoaded } = useUser();
  const { isAdmin } = useIsAdmin();
  const [tab, setTab] = useState<'edits' | 'purchases'>('edits');
  const [edits, setEdits] = useState<Edit[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);

  useEffect(() => {
    // TODO wire up real API when user has edits/purchases tables
    setEdits(DEMO_EDITS);
    setPurchases(DEMO_PURCHASES);
  }, []);

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-sky-950 flex items-center justify-center">
        <div className="text-sky-400 text-sm">Loading…</div>
      </div>
    );
  }

  const displayName = user?.firstName || user?.emailAddresses?.[0]?.emailAddress?.split('@')[0] || 'there';

  return (
    <div className="min-h-screen relative overflow-hidden bg-sky-950">
      {/* Motion streak backdrop */}
      <div className="absolute inset-x-0 top-0 h-[400px] pointer-events-none opacity-40 overflow-hidden">
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

      {/* Top nav */}
      <nav className="relative z-10 border-b border-sky-700/20 backdrop-blur-xl" style={{ background: 'rgba(10,14,26,0.7)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-sky-500 to-ember-500 flex items-center justify-center">
              <Clapperboard className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-display font-bold text-lg text-white tracking-tight">SkyStock</span>
              <span className="font-display font-light text-xs text-ember-400 ml-1">FPV</span>
            </div>
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/browse" className="text-sm text-sky-300 hover:text-white transition-colors">Browse</Link>
            {isAdmin && (
              <Link
                to="/admin"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-ember-400/40 bg-ember-500/10 text-ember-300 text-xs font-display font-semibold hover:bg-ember-500/20 transition-colors"
              >
                <Shield className="w-3.5 h-3.5" /> Admin
              </Link>
            )}
            <UserButton afterSignOutUrl="/" appearance={{ variables: { colorPrimary: '#f97316' } }} />
          </div>
        </div>
      </nav>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Header */}
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-ember-400 mb-3">
          <Sparkles className="w-3.5 h-3.5" />
          Your Flight Deck
        </div>
        <h1 className="font-display font-bold text-4xl md:text-5xl text-white tracking-tight">
          Welcome back,{' '}
          <span
            style={{
              backgroundImage: 'linear-gradient(90deg, #7dd3fc 0%, #f97316 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            {displayName}
          </span>
        </h1>
        <p className="text-sky-400 mt-2 max-w-xl">
          Your edits, purchases, and receipts — all in one place.
        </p>

        {/* Admin quick-access — only for admin user IDs */}
        {isAdmin && (
          <Link
            to="/admin"
            className="mt-6 group flex items-center gap-4 rounded-2xl p-4 transition-all hover:scale-[1.01]"
            style={{
              background: 'linear-gradient(135deg, rgba(249,115,22,0.12), rgba(56,189,248,0.08))',
              border: '1px solid rgba(249,115,22,0.4)',
              boxShadow: '0 10px 30px -10px rgba(249,115,22,0.25)',
            }}
          >
            <div
              className="w-12 h-12 shrink-0 rounded-xl flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, #f97316, #fb923c)',
                boxShadow: '0 0 20px rgba(249,115,22,0.4)',
              }}
            >
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-ember-400 mb-0.5">
                Admin · Backend access
              </div>
              <div className="font-display font-bold text-white text-lg leading-tight">Open Admin Panel</div>
              <div className="text-xs text-sky-400 mt-0.5">Upload raw clips, manage videos, view orders, configure settings.</div>
            </div>
            <ArrowUpRight className="w-5 h-5 text-ember-300 group-hover:text-white transition-colors" />
          </Link>
        )}

        {/* Quick stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-8">
          {[
            { icon: <Wand2 className="w-4 h-4" />, label: 'Edits in progress', value: edits.filter(e => e.status === 'draft').length, tint: '#38bdf8' },
            { icon: <Download className="w-4 h-4" />, label: 'Raw purchases', value: purchases.filter(p => p.kind === 'raw').length, tint: '#f97316' },
            { icon: <Film className="w-4 h-4" />, label: 'Clean exports', value: edits.filter(e => e.status === 'paid').length, tint: '#fdba74' },
            { icon: <CreditCard className="w-4 h-4" />, label: 'Lifetime spent', value: formatPrice(purchases.reduce((s, p) => s + p.price_cents, 0)), tint: '#7dd3fc' },
          ].map((stat, i) => (
            <div
              key={i}
              className="rounded-2xl p-4"
              style={{
                background: 'linear-gradient(180deg, rgba(20,29,54,0.7), rgba(10,14,26,0.85))',
                border: `1px solid ${stat.tint}33`,
              }}
            >
              <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider mb-2" style={{ color: stat.tint }}>
                {stat.icon}
                {stat.label}
              </div>
              <div className="font-display font-bold text-2xl text-white leading-none">{stat.value}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mt-10 mb-5 border-b border-sky-700/20">
          {[
            { id: 'edits', icon: <Wand2 className="w-4 h-4" />, label: 'My Edits' },
            { id: 'purchases', icon: <ShoppingBag className="w-4 h-4" />, label: 'Purchases & Receipts' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as 'edits' | 'purchases')}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-display font-semibold transition-colors relative ${
                tab === t.id ? 'text-white' : 'text-sky-500 hover:text-sky-300'
              }`}
            >
              {t.icon}
              {t.label}
              {tab === t.id && (
                <div
                  className="absolute bottom-0 left-0 right-0 h-0.5"
                  style={{ background: 'linear-gradient(90deg, #38bdf8, #f97316)' }}
                />
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === 'edits' ? (
          edits.length === 0 ? (
            <EmptyState
              icon={<Wand2 className="w-8 h-8" />}
              title="No edits yet"
              body="Pick a clip and reframe it in our browser editor. Your drafts will live here."
              cta={{ to: '/browse', label: 'Browse clips' }}
            />
          ) : (
            <div className="space-y-3">
              {edits.map(edit => (
                <EditRow key={edit.id} edit={edit} />
              ))}
            </div>
          )
        ) : purchases.length === 0 ? (
          <EmptyState
            icon={<ShoppingBag className="w-8 h-8" />}
            title="No purchases yet"
            body="When you buy a raw master or clean export, it shows up here with receipts and download links."
            cta={{ to: '/browse', label: 'Browse clips' }}
          />
        ) : (
          <div className="space-y-3">
            {purchases.map(p => (
              <PurchaseRow key={p.id} purchase={p} />
            ))}
          </div>
        )}

        {/* Footer hint */}
        <div
          className="mt-10 rounded-2xl p-5 text-center"
          style={{
            background: 'linear-gradient(180deg, rgba(20,29,54,0.5), rgba(10,14,26,0.6))',
            border: '1px dashed rgba(59,108,181,0.3)',
          }}
        >
          <div className="flex items-center justify-center gap-2 text-xs text-sky-500">
            <Mail className="w-3.5 h-3.5" />
            Need help? Receipts and download links are also emailed to {user?.emailAddresses?.[0]?.emailAddress || 'your inbox'}.
          </div>
        </div>
      </div>
    </div>
  );
}

function EditRow({ edit }: { edit: Edit }) {
  const statusMeta: Record<Edit['status'], { label: string; tint: string }> = {
    draft: { label: 'Draft', tint: '#7dd3fc' },
    exported: { label: 'Watermarked export', tint: '#fdba74' },
    paid: { label: 'Clean export · Paid', tint: '#10b981' },
  };
  const meta = statusMeta[edit.status];

  return (
    <div
      className="rounded-2xl p-4 flex items-center gap-4 transition-colors hover:border-sky-500/40"
      style={{
        background: 'linear-gradient(180deg, rgba(20,29,54,0.7), rgba(10,14,26,0.85))',
        border: '1px solid rgba(59,108,181,0.25)',
      }}
    >
      {/* Thumb */}
      <div
        className="w-24 h-14 shrink-0 rounded-xl overflow-hidden relative"
        style={{
          background: 'radial-gradient(ellipse at 50% 80%, #0f172a, #0a0e1a)',
        }}
      >
        <div
          className="absolute inset-0 m-auto rounded-full"
          style={{
            width: '60%',
            aspectRatio: '1',
            background: 'radial-gradient(circle at 40% 40%, #15803d 0%, #713f12 60%, transparent 100%)',
            boxShadow: '0 0 20px rgba(249,115,22,0.4)',
          }}
        />
        <div className="absolute top-1 right-1 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-sky-950/70 border border-ember-500/40">
          <InfinityIcon className="w-2.5 h-2.5 text-ember-400" />
          <span className="text-[9px] font-mono text-white">360</span>
        </div>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="font-display font-semibold text-white truncate">{edit.clip_title}</div>
        <div className="flex items-center gap-3 mt-1 text-[11px] text-sky-500 font-mono">
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {edit.duration_seconds}s</span>
          <span>Edited {edit.created_at}</span>
          {edit.price_cents && (
            <span className="text-ember-300">Paid {formatPrice(edit.price_cents)}</span>
          )}
        </div>
      </div>

      {/* Status */}
      <div
        className="shrink-0 px-3 py-1 rounded-full text-[11px] font-display font-medium"
        style={{
          background: `${meta.tint}1a`,
          color: meta.tint,
          border: `1px solid ${meta.tint}55`,
        }}
      >
        {meta.label}
      </div>

      {/* Action */}
      <Link
        to={`/edit/${edit.clip_id}`}
        className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-sky-900/40 border border-sky-700/30 text-sky-200 text-xs font-display font-medium hover:bg-sky-900/60 transition-colors"
      >
        Open <ArrowUpRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  );
}

function PurchaseRow({ purchase }: { purchase: Purchase }) {
  const kindMeta: Record<Purchase['kind'], { label: string; tint: string; icon: JSX.Element }> = {
    raw: { label: 'Raw 360° master', tint: '#f97316', icon: <Download className="w-3.5 h-3.5" /> },
    'clean-edit': { label: 'Clean edit export', tint: '#38bdf8', icon: <Wand2 className="w-3.5 h-3.5" /> },
    bundle: { label: 'Raw + unlimited edits', tint: '#10b981', icon: <InfinityIcon className="w-3.5 h-3.5" /> },
  };
  const meta = kindMeta[purchase.kind];

  return (
    <div
      className="rounded-2xl p-4 flex items-center gap-4"
      style={{
        background: 'linear-gradient(180deg, rgba(20,29,54,0.7), rgba(10,14,26,0.85))',
        border: '1px solid rgba(59,108,181,0.25)',
      }}
    >
      <div
        className="w-10 h-10 shrink-0 rounded-xl flex items-center justify-center"
        style={{
          background: `${meta.tint}1a`,
          color: meta.tint,
          border: `1px solid ${meta.tint}44`,
        }}
      >
        {meta.icon}
      </div>

      <div className="flex-1 min-w-0">
        <div className="font-display font-semibold text-white truncate">{purchase.clip_title}</div>
        <div className="flex items-center gap-3 mt-1 text-[11px] text-sky-500 font-mono">
          <span style={{ color: meta.tint }}>{meta.label}</span>
          <span>{purchase.created_at}</span>
        </div>
      </div>

      <div className="shrink-0 font-display font-bold text-ember-300">
        {formatPrice(purchase.price_cents)}
      </div>

      {purchase.download_token && (
        <Link
          to={`/download?token=${purchase.download_token}`}
          className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-display font-medium text-white transition-colors"
          style={{
            background: 'linear-gradient(135deg, #f97316, #fb923c)',
          }}
        >
          <Download className="w-3.5 h-3.5" />
          Download
        </Link>
      )}
    </div>
  );
}

function EmptyState({ icon, title, body, cta }: { icon: JSX.Element; title: string; body: string; cta: { to: string; label: string } }) {
  return (
    <div className="text-center py-16">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
        style={{
          background: 'linear-gradient(135deg, rgba(56,189,248,0.15), rgba(249,115,22,0.15))',
          border: '1px solid rgba(59,108,181,0.25)',
          color: '#7dd3fc',
        }}
      >
        {icon}
      </div>
      <h3 className="font-display font-bold text-xl text-white mb-2">{title}</h3>
      <p className="text-sky-400 max-w-sm mx-auto mb-5 text-sm">{body}</p>
      <Link
        to={cta.to}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-display font-semibold text-white transition-all hover:scale-[1.02]"
        style={{
          background: 'linear-gradient(135deg, #38bdf8 0%, #f97316 100%)',
          boxShadow: '0 10px 30px -10px rgba(249,115,22,0.4)',
        }}
      >
        {cta.label} <ArrowUpRight className="w-4 h-4" />
      </Link>
    </div>
  );
}
