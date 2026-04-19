import { useState, useEffect } from 'react';
import { DollarSign, RefreshCw, Mail, ExternalLink, FileDown, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';
import { getAdminOrders, refundOrder } from '../../lib/api';
import type { Order } from '../../lib/types';
import { formatPrice, formatDateTime } from '../../lib/types';
import toast from 'react-hot-toast';

export default function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => { loadOrders(); }, [statusFilter]);

  async function loadOrders() {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await getAdminOrders({ status: statusFilter === 'all' ? undefined : statusFilter });
      setOrders(data.orders || []);
    } catch (e: any) {
      setLoadError(e?.message || 'Could not load orders');
      setOrders([]);
    } finally { setLoading(false); }
  }

  async function handleRefund(orderId: string) {
    if (!confirm('Are you sure you want to refund this order? This will refund the full amount via PayPal.')) return;
    try {
      await refundOrder(orderId);
      toast.success('Order refunded');
      loadOrders();
    } catch { toast.error('Refund failed'); }
  }

  const [page, setPage] = useState(1);
  const perPage = 15;

  const totalRevenue = orders.filter(o => o.status === 'completed').reduce((s, o) => s + o.amount_cents, 0);
  const statuses = ['all', 'completed', 'pending', 'refunded'];
  const totalPages = Math.max(1, Math.ceil(orders.length / perPage));
  const safePage = Math.min(page, totalPages);
  const paginatedOrders = orders.slice((safePage - 1) * perPage, safePage * perPage);

  function exportCSV() {
    const header = ['Order ID', 'Video', 'Buyer Name', 'Buyer Email', 'Amount (AUD)', 'Status', 'PayPal Order', 'Date'];
    const rows = orders.map(o => [
      o.id,
      o.video?.title || o.video_id,
      o.buyer_name || '',
      o.buyer_email,
      (o.amount_cents / 100).toFixed(2),
      o.status,
      o.paypal_order_id || '',
      o.created_at,
    ]);
    const csv = [header, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `skystock-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exported');
  }

  return (
    <div className="page-enter">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display font-bold text-2xl text-white">Orders</h1>
          <p className="text-sky-500 text-sm mt-1">{orders.length} total · {formatPrice(totalRevenue)} revenue</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCSV} className="btn-ghost text-sm"><FileDown className="w-4 h-4" /> Export CSV</button>
          <button onClick={loadOrders} className="btn-ghost text-sm"><RefreshCw className="w-4 h-4" /> Refresh</button>
        </div>
      </div>

      {loadError && (
        <div className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 mb-6">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <div className="text-xs text-red-300">
            <div className="font-display font-semibold">Couldn&apos;t load orders</div>
            <div className="text-red-400/80 mt-0.5 font-mono">{loadError}</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-1 p-1 bg-sky-900/40 rounded-xl border border-sky-700/20 mb-6 w-fit">
        {statuses.map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-4 py-2 rounded-lg text-sm font-display font-medium capitalize transition-all ${
              statusFilter === s ? 'bg-sky-700/50 text-white' : 'text-sky-400 hover:text-white'
            }`}>
            {s}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-sky-700/20">
                <th className="table-header">Order</th>
                <th className="table-header">Video</th>
                <th className="table-header">Buyer</th>
                <th className="table-header">Amount</th>
                <th className="table-header">Status</th>
                <th className="table-header">Date</th>
                <th className="table-header">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="table-cell text-center text-sky-500 py-12">Loading...</td></tr>
              ) : paginatedOrders.length === 0 ? (
                <tr><td colSpan={7} className="table-cell text-center text-sky-500 py-12">No orders found</td></tr>
              ) : paginatedOrders.map(order => (
                <tr key={order.id} className="border-b border-sky-800/30 hover:bg-sky-800/20 transition-colors">
                  <td className="table-cell">
                    <span className="font-mono text-xs text-sky-400">{order.id}</span>
                  </td>
                  <td className="table-cell font-display text-white">
                    {order.video?.title || order.video_id}
                  </td>
                  <td className="table-cell">
                    <div>
                      <p className="text-sky-200">{order.buyer_name || '—'}</p>
                      <p className="text-xs text-sky-500 flex items-center gap-1"><Mail className="w-3 h-3" />{order.buyer_email}</p>
                    </div>
                  </td>
                  <td className="table-cell font-mono font-medium text-ember-400">{formatPrice(order.amount_cents, order.currency)}</td>
                  <td className="table-cell">
                    <span className={
                      order.status === 'completed' ? 'badge-success' :
                      order.status === 'pending' ? 'badge-warning' :
                      order.status === 'refunded' ? 'badge-info' : 'badge-danger'
                    }>{order.status}</span>
                  </td>
                  <td className="table-cell text-sm text-sky-400">{formatDateTime(order.created_at)}</td>
                  <td className="table-cell">
                    <div className="flex items-center gap-1">
                      {order.paypal_order_id && (
                        <a href={`https://www.paypal.com/activity/payment/${order.paypal_order_id}`} target="_blank" rel="noopener"
                          className="p-2 rounded-lg hover:bg-sky-700/30 text-sky-400 hover:text-white transition-colors" title="View in PayPal">
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                      {order.status === 'completed' && (
                        <button onClick={() => handleRefund(order.id)}
                          className="p-2 rounded-lg hover:bg-red-500/20 text-sky-400 hover:text-red-400 transition-colors" title="Refund">
                          <DollarSign className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-sky-500">
            Showing {(safePage - 1) * perPage + 1}–{Math.min(safePage * perPage, orders.length)} of {orders.length}
          </p>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage <= 1}
              className="btn-ghost text-sm disabled:opacity-30 disabled:cursor-not-allowed">
              <ChevronLeft className="w-4 h-4" /> Prev
            </button>
            <span className="text-sm text-sky-400 font-mono">{safePage} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages}
              className="btn-ghost text-sm disabled:opacity-30 disabled:cursor-not-allowed">
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
