import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, X, Film, Image, FileVideo, Check } from 'lucide-react';
import { createVideo, uploadVideoFile } from '../../lib/api';
import toast from 'react-hot-toast';

export default function AdminUpload() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});

  const [form, setForm] = useState({
    title: '',
    description: '',
    location: '',
    tags: '',
    price: '29.99',
    resolution: '4K',
    fps: '60',
    status: 'draft' as 'draft' | 'published',
  });

  const [files, setFiles] = useState<{
    original: File | null;
    preview: File | null;
    thumbnail: File | null;
  }>({ original: null, preview: null, thumbnail: null });

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function handleFileDrop(type: 'original' | 'preview' | 'thumbnail') {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) setFiles(prev => ({ ...prev, [type]: file }));
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title) { toast.error('Title is required'); return; }
    if (!files.original) { toast.error('Original video file is required'); return; }

    setSubmitting(true);
    try {
      // 1. Create video record
      const video = await createVideo({
        title: form.title,
        description: form.description,
        location: form.location,
        tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
        price_cents: Math.round(parseFloat(form.price) * 100),
        resolution: form.resolution,
        fps: parseInt(form.fps),
        status: form.status,
      });

      // 2. Upload files
      if (files.original) {
        await uploadVideoFile(video.id, files.original, 'original', pct => setUploadProgress(p => ({ ...p, original: pct })));
      }
      if (files.preview) {
        await uploadVideoFile(video.id, files.preview, 'preview', pct => setUploadProgress(p => ({ ...p, preview: pct })));
      }
      if (files.thumbnail) {
        await uploadVideoFile(video.id, files.thumbnail, 'thumbnail', pct => setUploadProgress(p => ({ ...p, thumbnail: pct })));
      }

      toast.success('Video uploaded successfully!');
      navigate('/admin/videos');
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setSubmitting(false);
    }
  }

  const fileZone = (type: 'original' | 'preview' | 'thumbnail', label: string, accept: string, icon: React.ReactNode) => (
    <div className="glass-card p-6">
      <div className="flex items-center gap-3 mb-4">
        {icon}
        <div>
          <h3 className="font-display font-semibold text-white">{label}</h3>
          <p className="text-xs text-sky-500">
            {type === 'original' ? 'Full quality unwatermarked file' :
             type === 'preview' ? 'Watermarked short preview clip' :
             'Thumbnail image (16:9 ratio)'}
          </p>
        </div>
      </div>

      {files[type] ? (
        <div className="flex items-center justify-between p-3 bg-sky-800/30 rounded-xl">
          <div className="flex items-center gap-3">
            <Check className="w-5 h-5 text-emerald-400" />
            <div>
              <p className="text-sm text-white">{files[type]!.name}</p>
              <p className="text-xs text-sky-500">{(files[type]!.size / (1024 * 1024)).toFixed(1)} MB</p>
            </div>
          </div>
          <button onClick={() => setFiles(prev => ({ ...prev, [type]: null }))} className="p-1 text-sky-500 hover:text-red-400">
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <label className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-sky-700/30 rounded-xl cursor-pointer hover:border-sky-500/40 hover:bg-sky-800/10 transition-all">
          <Upload className="w-8 h-8 text-sky-500 mb-2" />
          <span className="text-sm text-sky-400">Drop file or click to upload</span>
          <input type="file" accept={accept} onChange={handleFileDrop(type)} className="hidden" />
        </label>
      )}

      {uploadProgress[type] !== undefined && uploadProgress[type] < 100 && (
        <div className="mt-3">
          <div className="flex justify-between text-xs text-sky-400 mb-1">
            <span>Uploading...</span>
            <span>{uploadProgress[type]}%</span>
          </div>
          <div className="h-2 bg-sky-800/40 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-sky-500 to-ember-500 rounded-full transition-all" style={{ width: `${uploadProgress[type]}%` }} />
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="page-enter max-w-4xl">
      <h1 className="font-display font-bold text-2xl text-white mb-2">Upload New Video</h1>
      <p className="text-sky-500 text-sm mb-8">Add new FPV footage to your library</p>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Metadata */}
        <div className="glass-card p-6 space-y-5">
          <div>
            <label className="block text-sm font-display font-medium text-sky-300 mb-2">Title *</label>
            <input name="title" value={form.title} onChange={handleChange} className="input-field" placeholder="e.g., Sunrise Over The Gemfields" required />
          </div>

          <div>
            <label className="block text-sm font-display font-medium text-sky-300 mb-2">Description</label>
            <textarea name="description" value={form.description} onChange={handleChange} rows={3} className="input-field resize-none" placeholder="Describe the footage, flight path, conditions..." />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-display font-medium text-sky-300 mb-2">Location</label>
              <input name="location" value={form.location} onChange={handleChange} className="input-field" placeholder="e.g., Yeppoon, QLD" />
            </div>
            <div>
              <label className="block text-sm font-display font-medium text-sky-300 mb-2">Tags (comma separated)</label>
              <input name="tags" value={form.tags} onChange={handleChange} className="input-field" placeholder="coast, sunset, nature" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div>
              <label className="block text-sm font-display font-medium text-sky-300 mb-2">Price (AUD)</label>
              <input name="price" type="number" step="0.01" min="0" value={form.price} onChange={handleChange} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-display font-medium text-sky-300 mb-2">Resolution</label>
              <select name="resolution" value={form.resolution} onChange={handleChange} className="input-field">
                <option value="4K">4K (3840×2160)</option>
                <option value="2.7K">2.7K (2720×1530)</option>
                <option value="1080p">1080p (1920×1080)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-display font-medium text-sky-300 mb-2">Frame Rate</label>
              <select name="fps" value={form.fps} onChange={handleChange} className="input-field">
                <option value="120">120 fps</option>
                <option value="60">60 fps</option>
                <option value="30">30 fps</option>
                <option value="24">24 fps</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-display font-medium text-sky-300 mb-2">Initial Status</label>
            <div className="flex gap-3">
              <button type="button" onClick={() => setForm(p => ({ ...p, status: 'draft' }))}
                className={`flex-1 py-3 rounded-xl font-display font-medium text-sm border transition-all ${
                  form.status === 'draft' ? 'bg-amber-500/15 border-amber-500/40 text-amber-400' : 'border-sky-700/30 text-sky-500 hover:border-sky-600/40'
                }`}>
                Draft
              </button>
              <button type="button" onClick={() => setForm(p => ({ ...p, status: 'published' }))}
                className={`flex-1 py-3 rounded-xl font-display font-medium text-sm border transition-all ${
                  form.status === 'published' ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400' : 'border-sky-700/30 text-sky-500 hover:border-sky-600/40'
                }`}>
                Publish Immediately
              </button>
            </div>
          </div>
        </div>

        {/* File Uploads */}
        <div className="space-y-4">
          <h2 className="font-display font-semibold text-lg text-white">Video Files</h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {fileZone('original', 'Original Video *', 'video/*', <FileVideo className="w-6 h-6 text-sky-400" />)}
            {fileZone('preview', 'Watermarked Preview', 'video/*', <Film className="w-6 h-6 text-amber-400" />)}
            {fileZone('thumbnail', 'Thumbnail Image', 'image/*', <Image className="w-6 h-6 text-emerald-400" />)}
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-end gap-4 pt-4">
          <button type="button" onClick={() => navigate('/admin/videos')} className="btn-ghost">Cancel</button>
          <button type="submit" disabled={submitting} className="btn-ember px-8">
            {submitting ? 'Uploading...' : 'Upload Video'}
          </button>
        </div>
      </form>
    </div>
  );
}
