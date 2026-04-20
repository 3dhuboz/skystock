import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import { ArrowRight, Clapperboard, Sparkles, CheckCircle2, Loader2, AlertTriangle } from 'lucide-react';
import { useIsSeller } from '../lib/seller';
import { Logo } from '../components/Logo';
import toast from 'react-hot-toast';

interface ApplicationState {
  display_name: string;
  location: string;
  bio: string;
  rpl_number: string;             // CASA RePL (optional)
  payout_paypal_email: string;    // where we send monthly PayPal payouts
  payout_notes: string;           // free-text notes (invoice ref, alt contact, etc.)
  avata_confirmation: boolean;
  casa_confirmation: boolean;
  rights_confirmation: boolean;
}

export default function SellerApply() {
  const { user, isLoaded } = useUser();
  const { isSeller, hasApplied } = useIsSeller();
  const navigate = useNavigate();

  const [form, setForm] = useState<ApplicationState>({
    display_name: '',
    location: '',
    bio: '',
    rpl_number: '',
    payout_paypal_email: '',
    payout_notes: '',
    avata_confirmation: false,
    casa_confirmation: false,
    rights_confirmation: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (isSeller) navigate('/seller/clips', { replace: true });
    if (hasApplied) setSubmitted(true);
  }, [isSeller, hasApplied, navigate]);

  // On mount (user signed in), check if they've already submitted an application —
  // a sellers row exists in D1 even when Clerk publicMetadata hasn't been flipped yet.
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const clerk = (window as any).Clerk;
        const token = await clerk?.session?.getToken?.();
        if (!token) return;
        const res = await fetch('/api/seller/me', { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) return;
        const { seller } = await res.json();
        if (seller) setSubmitted(true);
      } catch { /* ignore */ }
    })();
  }, [user]);

  // Poll seller/me once the user has submitted — as soon as the admin approves,
  // Clerk's publicMetadata.role takes ≤60s to propagate; meanwhile the D1 row
  // gives us a fast signal that the approval happened.
  useEffect(() => {
    if (!submitted || isSeller) return;
    const id = window.setInterval(async () => {
      try {
        const clerk = (window as any).Clerk;
        const token = await clerk?.session?.getToken?.();
        if (!token) return;
        const res = await fetch('/api/seller/me', { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) return;
        const { seller } = await res.json();
        if (seller?.approved) {
          // Ask Clerk to re-pull the session so publicMetadata.role refreshes,
          // then hard-navigate into the seller workspace.
          try { await clerk?.session?.reload?.(); } catch {}
          window.location.href = '/seller/clips';
        }
      } catch { /* ignore */ }
    }, 12000);
    return () => window.clearInterval(id);
  }, [submitted, isSeller]);

  useEffect(() => {
    if (user && !form.display_name) {
      setForm(f => ({
        ...f,
        display_name: user.fullName || user.firstName || user.emailAddresses?.[0]?.emailAddress?.split('@')[0] || '',
      }));
    }
  }, [user]);

  const canSubmit =
    form.display_name.trim().length >= 2 &&
    form.location.trim().length >= 2 &&
    /@/.test(form.payout_paypal_email) &&
    form.avata_confirmation &&
    form.casa_confirmation &&
    form.rights_confirmation &&
    !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !user) return;
    setSubmitting(true);
    try {
      const clerk = (window as any).Clerk;
      const token = await clerk?.session?.getToken?.();
      const res = await fetch('/api/seller/apply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          display_name: form.display_name.trim(),
          location: form.location.trim(),
          bio: form.bio.trim(),
          rpl_number: form.rpl_number.trim(),
          payout_paypal_email: form.payout_paypal_email.trim(),
          payout_notes: form.payout_notes.trim(),
          email: user.emailAddresses?.[0]?.emailAddress,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as any).message || `HTTP ${res.status}`);
      }
      setSubmitted(true);
      toast.success('Application submitted — we\'ll review within 48h');
    } catch (e: any) {
      toast.error(e.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  }

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-sky-950 flex items-center justify-center">
        <Loader2 className="w-5 h-5 text-sky-400 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-sky-950 flex items-center justify-center px-4">
        <div
          className="max-w-md w-full rounded-3xl p-8 text-center"
          style={{
            background: 'linear-gradient(180deg, rgba(20,29,54,0.92), rgba(10,14,26,0.95))',
            border: '1px solid rgba(59,108,181,0.3)',
          }}
        >
          <Logo size={48} glow />
          <h1 className="font-display font-bold text-2xl text-white mt-4 mb-2">Sign in first</h1>
          <p className="text-sky-400 text-sm mb-6">You'll need a SkyStock account to apply as a seller.</p>
          <Link
            to="/sign-in?redirect_url=/seller/apply"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-display font-semibold text-white"
            style={{ background: 'linear-gradient(135deg, #38bdf8 0%, #f97316 100%)' }}
          >
            Sign in <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-sky-950 py-12 px-4">
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

      <div className="relative max-w-2xl mx-auto">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-ember-400 mb-3">
          <Sparkles className="w-3.5 h-3.5" />
          Invite-only · Seller beta
        </div>
        <h1 className="font-display font-bold text-4xl md:text-5xl text-white tracking-tight leading-none">
          Sell your{' '}
          <span
            style={{
              backgroundImage: 'linear-gradient(90deg, #7dd3fc 0%, #f97316 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            Avata 360
          </span>{' '}
          footage.
        </h1>
        <p className="text-sky-400 mt-3 max-w-xl">
          SkyStock takes 20%. You keep 80%. We handle the checkout, watermarked previews, in-browser editor, email delivery, and download hosting.
        </p>

        {/* Submitted confirmation */}
        {submitted ? (
          <div
            className="mt-10 rounded-3xl p-8 text-center"
            style={{
              background: 'linear-gradient(180deg, rgba(16,185,129,0.12), rgba(10,14,26,0.95))',
              border: '1px solid rgba(16,185,129,0.4)',
            }}
          >
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: 'rgba(16,185,129,0.2)', border: '1px solid rgba(16,185,129,0.5)' }}
            >
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            </div>
            <h2 className="font-display font-bold text-2xl text-white mb-2">Application received</h2>
            <p className="text-sky-400 mb-5">
              We review every application personally. You'll get an email within 48 hours.
            </p>
            <Link
              to="/browse"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-display font-medium text-sky-300 border border-sky-700/40 hover:text-white"
            >
              Back to library <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="mt-10 rounded-3xl p-6 sm:p-8 space-y-5"
            style={{
              background: 'linear-gradient(180deg, rgba(20,29,54,0.85), rgba(10,14,26,0.95))',
              border: '1px solid rgba(59,108,181,0.3)',
              boxShadow: '0 30px 80px -30px rgba(0,0,0,0.6), 0 0 0 1px rgba(249,115,22,0.15)',
            }}
          >
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-sky-400 mb-1.5">Display name *</label>
              <input
                value={form.display_name}
                onChange={(e) => setForm(f => ({ ...f, display_name: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl bg-sky-900/40 border border-sky-700/30 text-white focus:outline-none focus:border-ember-400/60"
                placeholder="Steve H"
                maxLength={60}
              />
              <p className="text-[11px] text-sky-600 mt-1">Shown on your clips and seller page.</p>
            </div>

            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-sky-400 mb-1.5">Location *</label>
              <input
                value={form.location}
                onChange={(e) => setForm(f => ({ ...f, location: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl bg-sky-900/40 border border-sky-700/30 text-white focus:outline-none focus:border-ember-400/60"
                placeholder="Rockhampton, QLD"
                maxLength={80}
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-sky-400 mb-1.5">Short bio</label>
              <textarea
                value={form.bio}
                onChange={(e) => setForm(f => ({ ...f, bio: e.target.value }))}
                rows={2}
                className="w-full px-4 py-3 rounded-xl bg-sky-900/40 border border-sky-700/30 text-white resize-none focus:outline-none focus:border-ember-400/60"
                placeholder="FPV pilot since 2022, shooting mostly Queensland coastline and ranges."
                maxLength={240}
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-sky-400 mb-1.5">PayPal email for payouts *</label>
              <input
                type="email"
                value={form.payout_paypal_email}
                onChange={(e) => setForm(f => ({ ...f, payout_paypal_email: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl bg-sky-900/40 border border-sky-700/30 text-white focus:outline-none focus:border-ember-400/60"
                placeholder="your-paypal@example.com"
                maxLength={160}
              />
              <p className="text-[11px] text-sky-600 mt-1">
                We send payouts via PayPal every month (or on-demand once your pending balance clears A$20). Use the email attached to your PayPal account.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-sky-400 mb-1.5">CASA RePL <span className="text-sky-600 normal-case">(optional)</span></label>
                <input
                  value={form.rpl_number}
                  onChange={(e) => setForm(f => ({ ...f, rpl_number: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl bg-sky-900/40 border border-sky-700/30 text-white focus:outline-none focus:border-ember-400/60"
                  placeholder="RePL-123456"
                  maxLength={24}
                />
              </div>
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-sky-400 mb-1.5">Notes <span className="text-sky-600 normal-case">(optional)</span></label>
                <input
                  value={form.payout_notes}
                  onChange={(e) => setForm(f => ({ ...f, payout_notes: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl bg-sky-900/40 border border-sky-700/30 text-white focus:outline-none focus:border-ember-400/60"
                  placeholder="ABN, invoice ref, etc."
                  maxLength={120}
                />
              </div>
            </div>

            {/* Attestations */}
            <div className="space-y-2.5 pt-3 border-t border-sky-800/30">
              <div className="text-[10px] font-mono uppercase tracking-wider text-sky-500">You confirm</div>
              {[
                { key: 'avata_confirmation' as const, label: 'My footage is shot on a DJI Avata 360 (or comparable native-360° aerial rig).' },
                { key: 'casa_confirmation' as const, label: 'All flights comply with CASA rules (licensed where required, legal airspace, not over people without consent).' },
                { key: 'rights_confirmation' as const, label: 'I own or control the rights to every clip I\'ll upload and grant SkyStock a non-exclusive licence to sell.' },
              ].map(chk => (
                <label key={chk.key} className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form[chk.key]}
                    onChange={(e) => setForm(f => ({ ...f, [chk.key]: e.target.checked }))}
                    className="mt-1 w-4 h-4 accent-ember-500 flex-shrink-0"
                  />
                  <span className="text-xs text-sky-300 leading-relaxed">{chk.label}</span>
                </label>
              ))}
            </div>

            <div className="flex items-start gap-3 rounded-xl border border-amber-400/30 bg-amber-500/8 px-4 py-3">
              <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-200/90 leading-relaxed">
                We vet every applicant. False attestations = permanent removal and any pending payouts forfeited.
              </div>
            </div>

            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-display font-semibold text-sm text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.01]"
              style={{
                background: 'linear-gradient(135deg, #f97316 0%, #fb923c 100%)',
                boxShadow: '0 12px 32px -10px rgba(249,115,22,0.45)',
              }}
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clapperboard className="w-4 h-4" />}
              {submitting ? 'Submitting…' : 'Submit application'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
