import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Trash2 } from 'lucide-react';
import { getAdminVideo, updateVideo, deleteVideo } from '../../lib/api';
import type { Video } from '../../lib/types';
import toast from 'react-hot-toast';

export default function AdminEditVideo() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: '', description: '', location: '', tags: '',
    price: '29.99', resolution: '4K', fps: '60', status: 'draft' as 'draft' | 'published',
  });

  useEffect(() => {
    async function load() {
      try {
        const video = await getAdminVideo(id!);
        setForm({
          title: video.title,
          description: video.description || '',
          location: video.location || '',
          tags: (video.tags || []).join(', '),
          price: (video.price_cents / 100).toFixed(2),
          resolution: video.resolution,
          fps: String(video.fps),
          status: video.status as 'draft' | 'published',
        });
      } catch {
        toast.error('Video not found');
        navigate('/admin/videos');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await updateVideo(id!, {
        title: form.title,
        description: form.description,
        location: form.location,
        tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
        price_cents: Math.round(parseFloat(form.price) * 100),
        resolution: form.resolution,
        fps: parseInt(form.fps),
        status: form.status,
      });
      toast.success('Video updated');
    } catch (err: any) {
      toast.error(err.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm('Are you sure you want to archive this video? It will no longer be available for purchase.')) return;
    try {
      await deleteVideo(id!);
      toast.success('Video archived');
      navigate('/admin/videos');
    } catch { toast.error('Delete failed'); }
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-sky-500">Loading...</div>;

  return (
    <div className="page-enter max-w-3xl">
      <button onClick={() => navigate('/admin/videos')} className="flex items-center gap-2 text-sky-400 hover:text-white mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Videos
      </button>

      <div className="flex items-center justify-between mb-8">
        <h1 className="font-display font-bold text-2xl text-white">Edit Video</h1>
        <button onClick={handleDelete} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors text-sm">
          <Trash2 className="w-4 h-4" /> Archive
        </button>
      </div>

      <form onSubmit={handleSave} className="glass-card p-6 space-y-5">
        <div>
          <label className="block text-sm font-display font-medium text-sky-300 mb-2">Title</label>
          <input name="title" value={form.title} onChange={handleChange} className="input-field" required />
        </div>
        <div>
          <label className="block text-sm font-display font-medium text-sky-300 mb-2">Description</label>
          <textarea name="description" value={form.description} onChange={handleChange} rows={3} className="input-field resize-none" />
        </div>
        <div className="grid grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-display font-medium text-sky-300 mb-2">Location</label>
            <input name="location" value={form.location} onChange={handleChange} className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-display font-medium text-sky-300 mb-2">Tags</label>
            <input name="tags" value={form.tags} onChange={handleChange} className="input-field" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-5">
          <div>
            <label className="block text-sm font-display font-medium text-sky-300 mb-2">Price (AUD)</label>
            <input name="price" type="number" step="0.01" value={form.price} onChange={handleChange} className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-display font-medium text-sky-300 mb-2">Resolution</label>
            <select name="resolution" value={form.resolution} onChange={handleChange} className="input-field">
              <option value="4K">4K</option><option value="2.7K">2.7K</option><option value="1080p">1080p</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-display font-medium text-sky-300 mb-2">FPS</label>
            <select name="fps" value={form.fps} onChange={handleChange} className="input-field">
              <option value="120">120</option><option value="60">60</option><option value="30">30</option><option value="24">24</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-end gap-4 pt-4 border-t border-sky-700/20">
          <button type="button" onClick={() => navigate('/admin/videos')} className="btn-ghost">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">
            <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
