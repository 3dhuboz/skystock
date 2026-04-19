import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Film, ShoppingBag, DollarSign, Download, TrendingUp,
  ArrowUpRight, ChevronRight, Clock, Upload, AlertTriangle,
} from 'lucide-react';
import { getAdminDashboard, getAdminRevenue } from '../../lib/api';
import { formatPrice, formatDate } from '../../lib/types';
import type { DashboardStats } from '../../lib/types';

const EMPTY_STATS: DashboardStats = {
  total_videos: 0,
  published_videos: 0,
  total_orders: 0,
  total_revenue_cents: 0,
  total_downloads: 0,
  recent_orders: [],
  top_videos: [],
  revenue_by_month: [],
};

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const [data, revenueData] = await Promise.all([
          getAdminDashboard(),
          getAdminRevenue().catch(() => null),
        ]);
        // Backend /admin/dashboard doesn't include revenue_by_month or top_videos by default —
        // guarantee every array field is defined so the render can't throw on .length / .map.
        const safe: DashboardStats = {
          ...EMPTY_STATS,
          ...data,
          recent_orders: Array.isArray(data?.recent_orders) ? data.recent_orders : [],
          top_videos: Array.isArray(data?.top_videos) ? data.top_videos : [],
          revenue_by_month: Array.isArray(data?.revenue_by_month) ? data.revenue_by_month : [],
        };
        if (revenueData?.months?.length) {
          const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          safe.revenue_by_month = revenueData.months.reverse().map(m => {
            const monthIdx = parseInt(m.month.split('-')[1], 10) - 1;
            return { month: monthNames[monthIdx] || m.month, revenue: m.total };
          });
        }
        setStats(safe);
      } catch (e: any) {
        setLoadError(e?.message || 'Could not load dashboard');
        setStats(EMPTY_STATS);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const hasRevenue = stats.revenue_by_month.length > 0;
  const maxRevenue = hasRevenue ? Math.max(...stats.revenue_by_month.map(m => m.revenue), 1) : 1;

  return (
    <div className="page-enter space-y-8">
      <div>
        <h1 className="font-display font-bold text-2xl text-white">Dashboard</h1>
        <p className="text-sky-500 mt-1">
          {loading ? 'Loading real-time stats…' : 'Overview of your SkyStock FPV store'}
        </p>
      </div>

      {loadError && (
        <div className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <div className="text-xs text-red-300">
            <div className="font-display font-semibold">Couldn&apos;t load dashboard</div>
            <div className="text-red-400/80 mt-0.5 font-mono">{loadError}</div>
          </div>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Revenue', value: formatPrice(stats.total_revenue_cents), icon: DollarSign, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
          { label: 'Total Orders', value: stats.total_orders, icon: ShoppingBag, color: 'text-sky-400', bg: 'bg-sky-500/10' },
          { label: 'Published Videos', value: `${stats.published_videos} / ${stats.total_videos}`, icon: Film, color: 'text-ember-400', bg: 'bg-ember-500/10' },
          { label: 'Total Downloads', value: stats.total_downloads, icon: Download, color: 'text-amber-400', bg: 'bg-amber-500/10' },
        ].map((stat, i) => (
          <div key={i} className="stat-card">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-sky-500 uppercase">{stat.label}</span>
              <div className={`w-9 h-9 rounded-xl ${stat.bg} flex items-center justify-center`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
            </div>
            <span className="font-display font-bold text-2xl text-white mt-2">{stat.value}</span>
          </div>
        ))}
      </div>

      {/* Revenue Chart & Recent Orders */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Revenue Chart */}
        <div className="lg:col-span-3 glass-card p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-display font-semibold text-white">Revenue Trend</h3>
              <p className="text-xs text-sky-500 mt-0.5">Monthly revenue in AUD</p>
            </div>
            <div className="flex items-center gap-1 text-xs text-emerald-400">
              <TrendingUp className="w-4 h-4" /> +22.7%
            </div>
          </div>

          {hasRevenue ? (
            <div className="flex items-end gap-3 h-48">
              {stats.revenue_by_month.map((m, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-2">
                  <span className="text-[10px] font-mono text-sky-500">
                    {formatPrice(m.revenue)}
                  </span>
                  <div
                    className="w-full rounded-t-lg bg-gradient-to-t from-sky-600 to-sky-400 transition-all duration-500 min-h-[8px]"
                    style={{ height: `${(m.revenue / maxRevenue) * 100}%` }}
                  />
                  <span className="text-xs font-mono text-sky-500">{m.month}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-48 flex flex-col items-center justify-center text-center gap-2">
              <DollarSign className="w-8 h-8 text-sky-700" />
              <div className="text-sm font-display font-semibold text-sky-400">
                {loading ? 'Loading revenue…' : 'No sales yet'}
              </div>
              {!loading && (
                <div className="text-xs text-sky-600">Revenue chart appears once you have completed orders.</div>
              )}
            </div>
          )}
        </div>

        {/* Recent Orders */}
        <div className="lg:col-span-2 glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-white">Recent Orders</h3>
            <Link to="/admin/orders" className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1">
              View all <ChevronRight className="w-3 h-3" />
            </Link>
          </div>

          {stats.recent_orders.length > 0 ? (
            <div className="space-y-3">
              {stats.recent_orders.map((order) => (
                <div key={order.id} className="flex items-center gap-3 p-3 rounded-xl bg-sky-900/20 hover:bg-sky-900/30 transition-colors">
                  <div className={`w-2 h-2 rounded-full ${
                    order.status === 'completed' ? 'bg-emerald-400' :
                    order.status === 'pending' ? 'bg-amber-400' : 'bg-red-400'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-sky-200 truncate">{order.video?.title || 'Video'}</p>
                    <p className="text-xs text-sky-500">{order.buyer_email}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-display font-semibold text-white">{formatPrice(order.amount_cents)}</span>
                    <span className="block text-[10px] text-sky-600 flex items-center gap-1 justify-end">
                      <Clock className="w-3 h-3" /> {formatDate(order.created_at)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 flex flex-col items-center text-center gap-2">
              <ShoppingBag className="w-6 h-6 text-sky-700" />
              <div className="text-sm font-display font-semibold text-sky-400">
                {loading ? 'Loading orders…' : 'No orders yet'}
              </div>
              {!loading && (
                <div className="text-xs text-sky-600">Customer purchases show up here as they happen.</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { to: '/admin/videos/new', icon: Upload, label: 'Upload New Footage', desc: 'Add a new video clip', color: 'from-sky-500 to-sky-600' },
          { to: '/admin/videos', icon: Film, label: 'Manage Videos', desc: `${stats.total_videos} videos total`, color: 'from-ember-500 to-amber-500' },
          { to: '/admin/orders', icon: ShoppingBag, label: 'View Orders', desc: `${stats.total_orders} orders processed`, color: 'from-emerald-500 to-emerald-600' },
        ].map((action, i) => (
          <Link
            key={i}
            to={action.to}
            className="glass-card-hover p-6 flex items-start gap-4 group"
          >
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${action.color} flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform`}>
              <action.icon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h4 className="font-display font-semibold text-white flex items-center gap-1">
                {action.label} <ArrowUpRight className="w-4 h-4 text-sky-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              </h4>
              <p className="text-sm text-sky-500 mt-0.5">{action.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
