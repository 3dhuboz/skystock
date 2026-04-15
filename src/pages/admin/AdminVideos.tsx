import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Eye, Download, Star, Edit2, Trash2, Globe, EyeOff, ChevronLeft, ChevronRight } from 'lucide-react';
import { getAdminVideos, publishVideo, unpublishVideo, toggleFeatured, deleteVideo } from '../../lib/api';
import type { Video } from '../../lib/types';
import { formatPrice, formatDate } from '../../lib/types';
import toast from 'react-hot-toast';

export default function AdminVideos() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadVideos();
  }, [statusFilter]);

  async function loadVideos() {
    setLoading(true);
    try {
      const data = await getAdminVideos({ status: statusFilter === 'all' ? undefined : statusFilter });
      setVideos(data.videos);
    } catch {
      // Demo data fallback
      setVideos([
        { id: '1', title: 'Sunrise Over The Gemfields', description: '', location: 'Emerald, QLD', tags: [], price_cents: 3999, duration_seconds: 47, resolution: '4K', fps: 60, file_size_bytes: 524288000, preview_key: '', watermarked_key: '', original_key: '', thumbnail_key: '', status: 'published', download_count: 24, view_count: 312, featured: true, created_at: '2025-01-15', updated_at: '2025-01-15' },
        { id: '2', title: 'Reef Coastline Rush', description: '', location: 'Yeppoon, QLD', tags: [], price_cents: 2999, duration_seconds: 35, resolution: '4K', fps: 60, file_size_bytes: 412000000, preview_key: '', watermarked_key: '', original_key: '', thumbnail_key: '', status: 'published', download_count: 41, view_count: 589, featured: false, created_at: '2025-01-20', updated_at: '2025-01-20' },
        { id: '3', title: 'Cane Fields at Dusk', description: '', location: 'Mackay, QLD', tags: [], price_cents: 2499, duration_seconds: 52, resolution: '4K', fps: 60, file_size_bytes: 610000000, preview_key: '', watermarked_key: '', original_key: '', thumbnail_key: '', status: 'draft', download_count: 0, view_count: 0, featured: false, created_at: '2025-02-01', updated_at: '2025-02-01' },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function handlePublish(id: string) {
    try {
      await publishVideo(id);
      toast.success('Video published');
      loadVideos();
    } catch { toast.error('Failed to publish'); }
  }

  async function handleUnpublish(id: string) {
    try {
      await unpublishVideo(id);
      toast.success('Video unpublished');
      loadVideos();
    } catch { toast.error('Failed to unpublish'); }
  }

  async function handleFeature(id: string) {
    try {
      await toggleFeatured(id);
      toast.success('Featured status toggled');
      loadVideos();
    } catch { toast.error('Failed to toggle featured'); }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to archive this video?')) return;
    try {
      await deleteVideo(id);
      toast.success('Video archived');
      loadVideos();
    } catch { toast.error('Failed to delete'); }
  }

  const [page, setPage] = useState(1);
  const perPage = 15;

  const filteredVideos = videos.filter(v =>
    !search || v.title.toLowerCase().includes(search.toLowerCase()) || v.location?.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(filteredVideos.length / perPage));
  const safePage = Math.min(page, totalPages);
  const paginatedVideos = filteredVideos.slice((safePage - 1) * perPage, safePage * perPage);

  const statuses = ['all', 'published', 'draft', 'archived'];

  return (
    <div className="page-enter">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display font-bold text-2xl text-white">Videos</h1>
          <p className="text-sky-500 text-sm mt-1">{videos.length} total videos</p>
        </div>
        <Link to="/admin/videos/new" className="btn-ember">
          <Plus className="w-4 h-4" /> Upload New
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-sky-600" />
          <input
            type="text"
            placeholder="Search videos..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input-field pl-10"
          />
        </div>
        <div className="flex gap-1 p-1 bg-sky-900/40 rounded-xl border border-sky-700/20">
          {statuses.map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-4 py-2 rounded-lg text-sm font-display font-medium capitalize transition-all ${
                statusFilter === s
                  ? 'bg-sky-700/50 text-white'
                  : 'text-sky-400 hover:text-white'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-sky-700/20">
                <th className="table-header">Video</th>
                <th className="table-header">Location</th>
                <th className="table-header">Status</th>
                <th className="table-header">Price</th>
                <th className="table-header">Views</th>
                <th className="table-header">Sales</th>
                <th className="table-header">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="table-cell text-center text-sky-500 py-12">Loading...</td></tr>
              ) : paginatedVideos.length === 0 ? (
                <tr><td colSpan={7} className="table-cell text-center text-sky-500 py-12">No videos found</td></tr>
              ) : paginatedVideos.map(video => (
                <tr key={video.id} className="border-b border-sky-800/30 hover:bg-sky-800/20 transition-colors">
                  <td className="table-cell">
                    <div className="flex items-center gap-3">
                      <div className="w-20 h-12 rounded-lg bg-sky-800/40 flex-shrink-0 overflow-hidden">
                        {video.thumbnail_url ? (
                          <img src={video.thumbnail_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-sky-700/30 to-sky-800/30" />
                        )}
                      </div>
                      <div>
                        <Link to={`/admin/videos/${video.id}`} className="font-display font-medium text-white hover:text-sky-300 transition-colors">
                          {video.title}
                        </Link>
                        <p className="text-xs text-sky-500 mt-0.5">{video.resolution} · {video.fps}fps</p>
                      </div>
                    </div>
                  </td>
                  <td className="table-cell text-sky-400">{video.location || '—'}</td>
                  <td className="table-cell">
                    <span className={video.status === 'published' ? 'badge-success' : video.status === 'draft' ? 'badge-warning' : 'badge-danger'}>
                      {video.status}
                    </span>
                    {video.featured && (
                      <span className="ml-2 badge bg-amber-500/15 text-amber-400 border border-amber-500/25">
                        <Star className="w-3 h-3 mr-1" fill="currentColor" /> featured
                      </span>
                    )}
                  </td>
                  <td className="table-cell font-mono text-ember-400">{formatPrice(video.price_cents)}</td>
                  <td className="table-cell">
                    <span className="flex items-center gap-1 text-sky-400"><Eye className="w-3.5 h-3.5" /> {video.view_count}</span>
                  </td>
                  <td className="table-cell">
                    <span className="flex items-center gap-1 text-sky-400"><Download className="w-3.5 h-3.5" /> {video.download_count}</span>
                  </td>
                  <td className="table-cell">
                    <div className="flex items-center gap-1">
                      <Link to={`/admin/videos/${video.id}`} className="p-2 rounded-lg hover:bg-sky-700/30 text-sky-400 hover:text-white transition-colors" title="Edit">
                        <Edit2 className="w-4 h-4" />
                      </Link>
                      {video.status === 'draft' ? (
                        <button onClick={() => handlePublish(video.id)} className="p-2 rounded-lg hover:bg-emerald-500/20 text-sky-400 hover:text-emerald-400 transition-colors" title="Publish">
                          <Globe className="w-4 h-4" />
                        </button>
                      ) : video.status === 'published' ? (
                        <button onClick={() => handleUnpublish(video.id)} className="p-2 rounded-lg hover:bg-amber-500/20 text-sky-400 hover:text-amber-400 transition-colors" title="Unpublish">
                          <EyeOff className="w-4 h-4" />
                        </button>
                      ) : null}
                      <button onClick={() => handleFeature(video.id)} className="p-2 rounded-lg hover:bg-amber-500/20 text-sky-400 hover:text-amber-400 transition-colors" title="Toggle Featured">
                        <Star className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(video.id)} className="p-2 rounded-lg hover:bg-red-500/20 text-sky-400 hover:text-red-400 transition-colors" title="Archive">
                        <Trash2 className="w-4 h-4" />
                      </button>
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
            Showing {(safePage - 1) * perPage + 1}–{Math.min(safePage * perPage, filteredVideos.length)} of {filteredVideos.length}
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
