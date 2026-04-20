import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { DollarSign, Send, Loader2, AlertTriangle, RefreshCw, CheckCircle2, XCircle, Clock, Mail } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatPrice, formatDateTime } from '../../lib/types';

interface SellerOwed {
  id: string;
  display_name: string;
  payout_paypal_email: string | null;
  revenue_share_bps: number;
  owed_cents: number;
  unpaid_order_count: number;
  lifetime_paid_cents: number;
}

interface PayoutHistoryItem {
  id: string;
  seller_id: string;
  seller_name: string | null;
  total_cents: number;
  currency: string;
  paypal_batch_id: string | null;
  paypal_batch_status: string | null;
  order_ids: string[];
  created_at: string;
  completed_at: string | null;
  note: string | null;
}

export default function AdminPayouts() {
  const { getToken } = useAuth();
  const [sellers, setSellers] = useState<SellerOwed[]>([]);
  const [history, setHistory] = useState<PayoutHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const t = await getToken();
      const [sRes, hRes] = await Promise.all([
        fetch('/api/admin/payouts/summary', { headers: { Authorization: `Bearer ${t}` } }),
        fetch('/api/admin/payouts/history', { headers: { Authorization: `Bearer ${t}` } }),
      ]);
      if (!sRes.ok) throw new Error(`summary HTTP ${sRes.status}`);
      if (!hRes.ok) throw new Error(`history HTTP ${hRes.status}`);
      const sData = await sRes.json();
      const hData = await hRes.json();
      setSellers(sData.sellers || []);
      setHistory(hData.payouts || []);
    } catch (e: any) {
      setErr(e?.message || 'load failed');
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => { load(); }, [load]);

  async function sendPayout(sellerId: string, displayName: string, owedCents: number, paypalEmail: string | null) {
    if (!paypalEmail) {
      toast.error('Seller has no PayPal email on file');
      return;
    }
    const confirm = window.confirm(
      `Send ${formatPrice(owedCents)} to ${displayName} (${paypalEmail}) via PayPal?\n\nThis will debit your PayPal balance.`
    );
    if (!confirm) return;
    setSendingId(sellerId);
    try {
      const t = await getToken();
      const res = await fetch('/api/admin/payouts/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
        body: JSON.stringify({ seller_id: sellerId }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.message || data.error || `HTTP ${res.status}`);
      }
      toast.success(`Payout sent · PayPal batch ${data.paypal_batch_id?.slice(0, 12)}…`);
      await load();
    } catch (e: any) {
      toast.error(e?.message || 'Payout failed');
    } finally {
      setSendingId(null);
    }
  }

  const totalOwed = sellers.reduce((s, x) => s + x.owed_cents, 0);
  const totalPaid = sellers.reduce((s, x) => s + x.lifetime_paid_cents, 0);

  return (
    <div className="page-enter space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl text-white">Payouts</h1>
          <p className="text-sky-500 mt-1">PayPal Payouts API · debits your PayPal balance</p>
        </div>
        <button onClick={load} disabled={loading} className="btn-ghost text-sm">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Refresh
        </button>
      </div>

      {err && (
        <div className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <div className="text-xs text-red-300 font-mono">{err}</div>
        </div>
      )}

      {/* Totals */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-sky-500 uppercase">Outstanding balance</span>
            <div className="w-9 h-9 rounded-xl bg-ember-500/10 flex items-center justify-center text-ember-400">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <span className="font-display font-bold text-2xl text-white mt-2">{formatPrice(totalOwed)}</span>
          <div className="text-xs text-sky-600 mt-1">across {sellers.filter(s => s.owed_cents > 0).length} seller{sellers.filter(s => s.owed_cents > 0).length === 1 ? '' : 's'}</div>
        </div>
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-sky-500 uppercase">Lifetime paid</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <span className="font-display font-bold text-2xl text-white mt-2">{formatPrice(totalPaid)}</span>
        </div>
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-sky-500 uppercase">Approved sellers</span>
            <div className="w-9 h-9 rounded-xl bg-sky-500/10 flex items-center justify-center text-sky-400">
              <Mail className="w-5 h-5" />
            </div>
          </div>
          <span className="font-display font-bold text-2xl text-white mt-2">{sellers.length}</span>
        </div>
      </div>

      {/* Per-seller owed */}
      <section>
        <h2 className="font-display font-semibold text-lg text-white mb-3">Pending by seller</h2>
        {sellers.length === 0 ? (
          <div className="glass-card p-6 text-sm text-sky-500">No approved sellers yet.</div>
        ) : (
          <div className="glass-card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-sky-700/20">
                  <th className="table-header">Seller</th>
                  <th className="table-header">PayPal email</th>
                  <th className="table-header text-right">Share</th>
                  <th className="table-header text-right">Unpaid sales</th>
                  <th className="table-header text-right">Owed</th>
                  <th className="table-header text-right">Lifetime paid</th>
                  <th className="table-header text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {sellers.map(s => {
                  const canSend = s.owed_cents > 0 && !!s.payout_paypal_email;
                  return (
                    <tr key={s.id} className="border-b border-sky-800/30">
                      <td className="table-cell font-display text-white">{s.display_name}</td>
                      <td className="table-cell text-xs text-sky-400 font-mono">{s.payout_paypal_email || <span className="text-amber-400">— none on file</span>}</td>
                      <td className="table-cell text-xs font-mono text-sky-400 text-right">{(s.revenue_share_bps / 100).toFixed(0)}%</td>
                      <td className="table-cell text-sky-300 text-right tabular-nums">{s.unpaid_order_count}</td>
                      <td className="table-cell font-mono font-semibold text-ember-400 text-right tabular-nums">{formatPrice(s.owed_cents)}</td>
                      <td className="table-cell text-xs text-sky-500 text-right tabular-nums">{formatPrice(s.lifetime_paid_cents)}</td>
                      <td className="table-cell text-right">
                        <button
                          onClick={() => sendPayout(s.id, s.display_name, s.owed_cents, s.payout_paypal_email)}
                          disabled={!canSend || sendingId === s.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-display font-semibold text-white transition-all disabled:opacity-40"
                          style={{ background: canSend ? 'linear-gradient(135deg, #f97316, #fb923c)' : '#334155' }}
                        >
                          {sendingId === s.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                          Pay out
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* History */}
      <section>
        <h2 className="font-display font-semibold text-lg text-white mb-3">Recent payouts</h2>
        {history.length === 0 ? (
          <div className="glass-card p-6 text-sm text-sky-500">No payouts sent yet.</div>
        ) : (
          <div className="glass-card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-sky-700/20">
                  <th className="table-header">When</th>
                  <th className="table-header">Seller</th>
                  <th className="table-header">Batch</th>
                  <th className="table-header">Status</th>
                  <th className="table-header text-right">Orders</th>
                  <th className="table-header text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {history.map(p => (
                  <tr key={p.id} className="border-b border-sky-800/30">
                    <td className="table-cell text-xs text-sky-400">{formatDateTime(p.created_at)}</td>
                    <td className="table-cell text-sky-200">{p.seller_name || '—'}</td>
                    <td className="table-cell text-[11px] font-mono text-sky-500 break-all">{p.paypal_batch_id || '—'}</td>
                    <td className="table-cell">
                      <StatusPill status={p.paypal_batch_status || 'UNKNOWN'} />
                    </td>
                    <td className="table-cell text-sky-300 text-right tabular-nums">{p.order_ids.length}</td>
                    <td className="table-cell font-mono font-semibold text-ember-400 text-right tabular-nums">{formatPrice(p.total_cents, p.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const ok = status === 'SUCCESS' || status === 'PENDING' || status === 'PROCESSING';
  const err = status === 'DENIED' || status === 'ERROR' || status === 'CANCELED';
  const Icon = ok ? (status === 'SUCCESS' ? CheckCircle2 : Clock) : err ? XCircle : Clock;
  const color = ok ? (status === 'SUCCESS' ? '#34d399' : '#fbbf24') : err ? '#f87171' : '#7dd3fc';
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider"
      style={{ background: `${color}1a`, color, border: `1px solid ${color}55` }}
    >
      <Icon className="w-3 h-3" />
      {status}
    </span>
  );
}
