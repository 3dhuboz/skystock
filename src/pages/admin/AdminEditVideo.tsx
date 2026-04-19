import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Trash2, Upload, Check, X, Loader2, Image as ImageIcon, Film, RefreshCw, Wrench } from 'lucide-react';
import { getAdminVideo, updateVideo, deleteVideo, uploadVideoFile, repairVideo } from '../../lib/api';
import type { Video } from '../../lib/types';
import toast from 'react-hot-toast';

type SlotType = 'preview' | 'thumbnail';

export default function AdminEditVideo() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [video, setVideo] = useState<Video | null>(null);
  const [form, setForm] = useState({
    title: '', description: '', location: '', tags: '',
    price: '29.99', resolution: '4K', fps: '60', status: 'draft' as 'draft' | 'published',
  });

  // Pending file re-uploads — user drops a new thumbnail/preview here; we upload on Save.
  const [pending, setPending] = useState<{ preview: File | null; thumbnail: File | null }>({
    preview: null,
    thumbnail: null,
  });
  const [uploadPct, setUploadPct] = useState<Record<SlotType, number>>({ preview: 0, thumbnail: 0 });
  const [uploadingSlot, setUploadingSlot] = useState<SlotType | null>(null);
  const [repairing, setRepairing] = useState(false);

  const reload = async () => {
    if (!id) return;
    const v = await getAdminVideo(id);
    setVideo(v);
    setForm({
      title: v.title,
      description: v.description || '',
      location: v.location || '',
      tags: (v.tags || []).join(', '),
      price: (v.price_cents / 100).toFixed(2),
      resolution: v.resolution,
      fps: String(v.fps),
      status: v.status as 'draft' | 'published',
    });
  };

  useEffect(() => {
    async function load() {
      try { await reload(); }
      catch { toast.error('Video not found'); navigate('/admin/videos'); }
      finally { setLoading(false); }
    }
    load();
  }, [id]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function uploadSlot(slot: SlotType, file: File) {
    if (!id) return;
    setUploadingSlot(slot);
    setUploadPct(p => ({ ...p, [slot]: 0 }));
    try {
      await uploadVideoFile(id, file, slot, pct => setUploadPct(p => ({ ...p, [slot]: pct })));
      setUploadPct(p => ({ ...p, [slot]: 100 }));
      toast.success(`${slot === 'preview' ? 'Preview' : 'Thumbnail'} uploaded`);
      setPending(p => ({ ...p, [slot]: null }));
      await reload();
    } catch (e: any) {
      toast.error(e?.message || 'Upload failed');
    } finally {
      setUploadingSlot(null);
    }
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
      toast.success('Video metadata saved');
      await reload();
    } catch (err: any) {
      toast.error(err.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleRepair() {
    if (!id) return;
    setRepairing(true);
    const t = toast.loading('Scanning R2 for orphaned uploads…');
    try {
      const res = await repairVideo(id);
      const found = Object.entries(res.report).filter(([, v]) => v.found && !v.skipped).map(([k]) => k);
      const missing = Object.entries(res.report).filter(([, v]) => !v.found).map(([k]) => k);
      if (found.length) {
        toast.success(`Re-linked: ${found.join(', ')}`, { id: t });
      } else if (missing.length) {
        toast(`Nothing to repair · missing in R2: ${missing.join(', ')}`, { id: t, icon: 'ℹ️' });
      } else {
        toast.success('All files already linked', { id: t });
      }
      await reload();
    } catch (e: any) {
      toast.error(e?.message || 'Repair failed', { id: t });
    } finally {
      setRepairing(false);
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

      {/* Media slots — fix missing thumbnail/preview without losing the metadata */}
      <div className="glass-card p-6 mb-6">
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <h2 className="font-display font-semibold text-white">Media files</h2>
            <span className="text-[10px] font-mono text-sky-500 uppercase tracking-wider">· Re-upload to fix</span>
          </div>
          <button
            type="button"
            onClick={handleRepair}
            disabled={repairing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-display font-medium text-ember-300 border border-ember-400/40 bg-ember-500/10 hover:bg-ember-500/20 transition-colors disabled:opacity-40"
            title="Scan R2 for files that uploaded but never got linked to this video"
          >
            {repairing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wrench className="w-3.5 h-3.5" />}
            {repairing ? 'Scanning…' : 'Auto-repair from R2'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <MediaSlot
            slot="thumbnail"
            label="Thumbnail"
            icon={<ImageIcon className="w-5 h-5 text-emerald-400" />}
            currentUrl={video?.thumbnail_url || null}
            currentKey={video?.thumbnail_key || ''}
            accept="image/*"
            pendingFile={pending.thumbnail}
            pct={uploadPct.thumbnail}
            uploading={uploadingSlot === 'thumbnail'}
            onPick={(f) => setPending(p => ({ ...p, thumbnail: f }))}
            onUpload={(f) => uploadSlot('thumbnail', f)}
          />
          <MediaSlot
            slot="preview"
            label="Watermarked preview"
            icon={<Film className="w-5 h-5 text-amber-400" />}
            currentUrl={video?.watermarked_url || null}
            currentKey={video?.preview_key || ''}
            accept="video/*"
            pendingFile={pending.preview}
            pct={uploadPct.preview}
            uploading={uploadingSlot === 'preview'}
            onPick={(f) => setPending(p => ({ ...p, preview: f }))}
            onUpload={(f) => uploadSlot('preview', f)}
          />
        </div>
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
        <div>
          <label className="block text-sm font-display font-medium text-sky-300 mb-2">Status</label>
          <div className="flex gap-3">
            <button type="button" onClick={() => setForm(p => ({ ...p, status: 'draft' }))}
              className={`flex-1 py-2 rounded-xl font-display font-medium text-sm border transition-all ${
                form.status === 'draft' ? 'bg-amber-500/15 border-amber-500/40 text-amber-400' : 'border-sky-700/30 text-sky-500'
              }`}>
              Draft
            </button>
            <button type="button" onClick={() => setForm(p => ({ ...p, status: 'published' }))}
              className={`flex-1 py-2 rounded-xl font-display font-medium text-sm border transition-all ${
                form.status === 'published' ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400' : 'border-sky-700/30 text-sky-500'
              }`}>
              Published
            </button>
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

interface SlotProps {
  slot: SlotType;
  label: string;
  icon: React.ReactNode;
  currentUrl: string | null;
  currentKey: string;
  accept: string;
  pendingFile: File | null;
  pct: number;
  uploading: boolean;
  onPick: (f: File | null) => void;
  onUpload: (f: File) => void;
}

function MediaSlot({ slot, label, icon, currentUrl, currentKey, accept, pendingFile, pct, uploading, onPick, onUpload }: SlotProps) {
  const has = !!currentKey;
  return (
    <div className="rounded-2xl p-4" style={{ background: 'rgba(10,14,26,0.5)', border: '1px solid rgba(59,108,181,0.2)' }}>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <div className="min-w-0">
          <div className="font-display font-semibold text-white">{label}</div>
          <div className={`text-[11px] font-mono ${has ? 'text-emerald-400' : 'text-amber-400'}`}>
            {has ? '✓ Uploaded' : '· Not uploaded'}
          </div>
        </div>
      </div>

      {/* Current asset preview */}
      {currentUrl && (
        <div className="mb-3 rounded-xl overflow-hidden border border-sky-700/30 bg-sky-950/50">
          {slot === 'thumbnail' ? (
            <img src={currentUrl} alt={label} className="w-full aspect-video object-cover" />
          ) : (
            <video src={currentUrl} muted playsInline controls className="w-full aspect-video object-cover" />
          )}
        </div>
      )}

      {/* Pending file or picker */}
      {pendingFile ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between p-2 rounded-lg bg-sky-900/40">
            <div className="flex items-center gap-2 min-w-0">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <div className="min-w-0">
                <div className="text-xs text-white truncate">{pendingFile.name}</div>
                <div className="text-[10px] text-sky-500 font-mono">{(pendingFile.size / (1024 * 1024)).toFixed(1)} MB</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onPick(null)}
              disabled={uploading}
              className="p-1 text-sky-500 hover:text-red-400 disabled:opacity-40"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {uploading && (
            <div>
              <div className="h-1.5 rounded-full bg-sky-900/60 overflow-hidden">
                <div
                  className="h-full rounded-full transition-[width] duration-200"
                  style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #38bdf8, #f97316)' }}
                />
              </div>
              <div className="text-[10px] font-mono text-sky-500 mt-1 text-right">{pct}%</div>
            </div>
          )}
          <button
            type="button"
            onClick={() => onUpload(pendingFile)}
            disabled={uploading}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-display font-semibold text-white disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #f97316, #fb923c)' }}
          >
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            {uploading ? `Uploading ${pct}%` : has ? 'Replace' : 'Upload'}
          </button>
        </div>
      ) : (
        <label
          className={`flex items-center justify-center gap-2 p-3 border border-dashed rounded-xl cursor-pointer transition-colors text-xs ${
            has ? 'border-sky-700/30 text-sky-500 hover:border-sky-500/40' : 'border-amber-500/40 text-amber-300 hover:bg-amber-500/5'
          }`}
        >
          {has ? <RefreshCw className="w-3.5 h-3.5" /> : <Upload className="w-3.5 h-3.5" />}
          {has ? 'Replace file' : 'Upload file'}
          <input type="file" accept={accept} className="hidden" onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onPick(f);
          }} />
        </label>
      )}
    </div>
  );
}
