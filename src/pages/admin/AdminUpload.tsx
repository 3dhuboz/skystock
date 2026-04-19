import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, X, Film, Image, FileVideo, Check, Sparkles, Loader2, Wand2, Aperture } from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';
import { createVideo, uploadVideoFile } from '../../lib/api';
import { createScene, type LensName } from '../../lib/editor';
import toast from 'react-hot-toast';

interface AiFillResponse {
  title?: string;
  description?: string;
  location?: string;
  tags?: string[];
  price_cents?: number;
  error?: string;
}

export default function AdminUpload() {
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [aiFilling, setAiFilling] = useState(false);
  const [thumbBusy, setThumbBusy] = useState(false);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewProgress, setPreviewProgress] = useState(0);

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

  // Detected from the original video file — duration (seconds) stays hidden in form state
  // and gets posted to the backend on submit. Resolution/fps also auto-fill the dropdowns.
  const [detectedDuration, setDetectedDuration] = useState<number>(0);

  const [files, setFiles] = useState<{
    original: File | null;
    preview: File | null;
    thumbnail: File | null;
  }>({ original: null, preview: null, thumbnail: null });

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }

  // Read duration, width and height from a video file.
  async function probeVideoMetadata(file: File): Promise<{ durationSeconds: number; width: number; height: number } | null> {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const v = document.createElement('video');
      v.preload = 'metadata';
      v.muted = true;
      v.onloadedmetadata = () => {
        const out = {
          durationSeconds: Number.isFinite(v.duration) ? Math.round(v.duration) : 0,
          width: v.videoWidth,
          height: v.videoHeight,
        };
        URL.revokeObjectURL(url);
        resolve(out);
      };
      v.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
      v.src = url;
    });
  }

  function resolutionLabelFor(width: number, height: number): '4K' | '2.7K' | '1080p' | null {
    const major = Math.max(width, height);
    if (major >= 3500) return '4K';
    if (major >= 2600) return '2.7K';
    if (major >= 1800) return '1080p';
    return null;
  }

  function handleFileDrop(type: 'original' | 'preview' | 'thumbnail') {
    return async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setFiles(prev => ({ ...prev, [type]: file }));
      // Auto-fill duration + resolution from the original file.
      if (type === 'original' && file.type.startsWith('video/')) {
        const meta = await probeVideoMetadata(file);
        if (meta) {
          setDetectedDuration(meta.durationSeconds);
          const detectedRes = resolutionLabelFor(meta.width, meta.height);
          if (detectedRes) setForm(prev => ({ ...prev, resolution: detectedRes }));
        }
      }
    };
  }

  // --- AI Fill: extract a frame, send to Claude, populate form -------------
  const extractFrame = useCallback(async (file: File): Promise<{ base64: string; mediaType: string }> => {
    const url = URL.createObjectURL(file);
    try {
      const video = document.createElement('video');
      video.preload = 'auto';
      video.muted = true;
      video.playsInline = true;
      video.crossOrigin = 'anonymous';
      video.src = url;

      // Wait for metadata so we know duration + dimensions.
      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () => reject(new Error('Could not load video metadata'));
      });

      // Seek to 25% through, or 2s, whichever is sooner — avoids black openers.
      const target = Math.min(video.duration * 0.25, 2);
      video.currentTime = isFinite(target) && target > 0 ? target : 0;
      await new Promise<void>((resolve, reject) => {
        video.onseeked = () => resolve();
        video.onerror = () => reject(new Error('Could not seek video'));
      });

      // Downscale — equirectangular 4K is overkill for a vision prompt and slows the API.
      const maxSide = 1280;
      const scale = Math.min(1, maxSide / Math.max(video.videoWidth, video.videoHeight));
      const w = Math.max(16, Math.round(video.videoWidth * scale));
      const h = Math.max(16, Math.round(video.videoHeight * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context unavailable');
      ctx.drawImage(video, 0, 0, w, h);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
      const base64 = dataUrl.split(',')[1];
      return { base64, mediaType: 'image/jpeg' };
    } finally {
      URL.revokeObjectURL(url);
    }
  }, []);

  const extractImage = useCallback(async (file: File): Promise<{ base64: string; mediaType: string }> => {
    const url = URL.createObjectURL(file);
    try {
      const img = new globalThis.Image();
      img.crossOrigin = 'anonymous';
      img.src = url;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Could not load image'));
      });
      const maxSide = 1280;
      const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(16, Math.round(img.naturalWidth * scale));
      const h = Math.max(16, Math.round(img.naturalHeight * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context unavailable');
      ctx.drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
      return { base64: dataUrl.split(',')[1], mediaType: 'image/jpeg' };
    } finally {
      URL.revokeObjectURL(url);
    }
  }, []);

  // --- Auto-thumbnail: grab a 16:9 forward-facing slice from the 360° equirect ----
  // Draws a centered crop (60% width × full height) onto a 1920x1080 canvas, then
  // overlays a subtle SKYSTOCK FPV watermark so the thumbnail matches the preview.
  async function generateThumbnail() {
    const video = files.original;
    if (!video) { toast.error('Attach the original video first'); return; }
    setThumbBusy(true);
    const t = toast.loading('Extracting thumbnail frame…');
    const url = URL.createObjectURL(video);
    try {
      const v = document.createElement('video');
      v.preload = 'auto';
      v.muted = true;
      v.playsInline = true;
      v.src = url;
      await new Promise<void>((resolve, reject) => {
        v.onloadedmetadata = () => resolve();
        v.onerror = () => reject(new Error('Could not load video'));
      });
      const target = Math.min(v.duration * 0.25, 2);
      v.currentTime = isFinite(target) && target > 0 ? target : 0;
      await new Promise<void>((resolve, reject) => {
        v.onseeked = () => resolve();
        v.onerror = () => reject(new Error('Seek failed'));
      });

      const OUT_W = 1920, OUT_H = 1080;
      const canvas = document.createElement('canvas');
      canvas.width = OUT_W;
      canvas.height = OUT_H;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas unavailable');

      // Center-crop a 16:9 forward window from the equirectangular frame.
      // For a standard equirect, the forward direction is centered horizontally; we grab
      // the middle ~60% of width and full height (which is already the horizon band).
      const cropWFrac = 0.6;
      const sw = v.videoWidth * cropWFrac;
      const sh = Math.min(v.videoHeight, sw * (OUT_H / OUT_W));
      const sx = (v.videoWidth - sw) / 2;
      const sy = (v.videoHeight - sh) / 2;
      ctx.drawImage(v, sx, sy, sw, sh, 0, 0, OUT_W, OUT_H);

      // Watermark — match the preview look
      ctx.save();
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = '#ffffff';
      ctx.font = '600 48px "DM Sans", system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 8;
      ctx.fillText('SkyStock FPV', OUT_W - 32, OUT_H - 32);
      ctx.restore();

      const blob: Blob = await new Promise((resolve, reject) =>
        canvas.toBlob(b => b ? resolve(b) : reject(new Error('Blob encode failed')), 'image/jpeg', 0.9)
      );
      const stem = video.name.replace(/\.[^.]+$/, '');
      const thumbFile = new File([blob], `${stem}-thumb.jpg`, { type: 'image/jpeg' });
      setFiles(prev => ({ ...prev, thumbnail: thumbFile }));
      toast.success('Thumbnail ready', { id: t });
    } catch (e: any) {
      toast.error(`Thumbnail failed: ${e.message || 'unknown'}`, { id: t });
    } finally {
      URL.revokeObjectURL(url);
      setThumbBusy(false);
    }
  }

  // --- Auto-preview: record an 18s SHOWCASE that cycles Wide → FPV → Tiny Planet lens
  // projections through the editor's shader, so the preview IS the demo of the 360°
  // reframing pitch. Watermarked, MediaRecorder out.
  async function generatePreview() {
    const video = files.original;
    if (!video) { toast.error('Attach the original video first'); return; }
    setPreviewBusy(true);
    setPreviewProgress(0);
    const t = toast.loading('Recording reframed showcase preview…');
    const url = URL.createObjectURL(video);

    // Off-screen canvas that the shader scene will render into.
    const hiddenCanvas = document.createElement('canvas');
    hiddenCanvas.width = 1280;
    hiddenCanvas.height = 720;
    hiddenCanvas.style.position = 'fixed';
    hiddenCanvas.style.left = '-9999px';
    document.body.appendChild(hiddenCanvas);

    let scene: ReturnType<typeof createScene> | null = null;
    const sourceVideo = document.createElement('video');
    sourceVideo.preload = 'auto';
    sourceVideo.muted = true;
    sourceVideo.playsInline = true;
    sourceVideo.src = url;

    try {
      await new Promise<void>((resolve, reject) => {
        sourceVideo.onloadedmetadata = () => resolve();
        sourceVideo.onerror = () => reject(new Error('Could not load video'));
      });

      scene = createScene(hiddenCanvas);
      scene.setOutputSize(1280, 720);
      scene.setWatermarkEnabled(true);
      scene.setVideo(sourceVideo);

      // Showcase programme — three chapters, each with a different lens + orbit motion.
      // Real clip is long; sample the middle 24s window so we skip intros and outros.
      const previewLen = 24;
      const startOffset = Math.max(0, Math.min(sourceVideo.duration * 0.15, sourceVideo.duration - previewLen - 0.5));
      const endOffset = Math.min(startOffset + previewLen, sourceVideo.duration - 0.1);
      const chapters: { lens: LensName; durationSec: number }[] = [
        { lens: 'wide', durationSec: 8 },        // 0–8s  : Wide establishing shot
        { lens: 'fpv', durationSec: 8 },         // 8–16s : FPV dive feel
        { lens: 'asteroid', durationSec: 8 },    // 16–24s: Tiny planet flourish
      ];

      // Use the orbit preset for continuous yaw motion across the whole showcase.
      scene.setPreset('orbit');
      scene.setTrim(startOffset, endOffset);

      // Seek + prime
      sourceVideo.currentTime = startOffset;
      await new Promise<void>((resolve, reject) => {
        sourceVideo.onseeked = () => resolve();
        sourceVideo.onerror = () => reject(new Error('Seek failed'));
      });

      // Recorder on the shader-rendered canvas.
      const candidates = [
        'video/mp4;codecs=avc1.42E01E',
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm',
      ];
      const mime = candidates.find(m => (window as any).MediaRecorder?.isTypeSupported?.(m)) || '';
      if (!mime) throw new Error('MediaRecorder not supported in this browser');

      const stream = hiddenCanvas.captureStream(30);
      const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4_500_000 });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };

      let stopped = false;
      const stopAll = () => {
        if (stopped) return;
        stopped = true;
        try { recorder.state !== 'inactive' && recorder.stop(); } catch {}
        try { sourceVideo.pause(); } catch {}
      };

      // Lens chapter timer — switches lens at the right boundaries.
      let currentChapter = 0;
      scene.setLens(chapters[0].lens);

      const tickChapter = () => {
        const elapsed = sourceVideo.currentTime - startOffset;
        let accum = 0;
        let target = 0;
        for (let i = 0; i < chapters.length; i++) {
          accum += chapters[i].durationSec;
          if (elapsed < accum) { target = i; break; }
          target = i;
        }
        if (target !== currentChapter) {
          currentChapter = target;
          scene?.setLens(chapters[target].lens);
        }
        setPreviewProgress(Math.min(100, Math.round((elapsed / previewLen) * 100)));
        if (sourceVideo.currentTime >= endOffset || sourceVideo.ended) stopAll();
        else if (!stopped) requestAnimationFrame(tickChapter);
      };

      recorder.start();
      await sourceVideo.play();
      tickChapter();

      const blob: Blob = await new Promise((resolve) => {
        recorder.onstop = () => resolve(new Blob(chunks, { type: mime }));
      });

      const stem = video.name.replace(/\.[^.]+$/, '');
      const ext = mime.includes('mp4') ? 'mp4' : 'webm';
      const previewFile = new File([blob], `${stem}-preview.${ext}`, { type: mime });
      setFiles(prev => ({ ...prev, preview: previewFile }));
      toast.success(`Preview ready · 24s showcase (${(blob.size / (1024 * 1024)).toFixed(1)} MB)`, { id: t });
    } catch (e: any) {
      toast.error(`Preview failed: ${e.message || 'unknown'}`, { id: t });
    } finally {
      URL.revokeObjectURL(url);
      try { scene?.dispose?.(); } catch {}
      try { hiddenCanvas.remove(); } catch {}
      setPreviewBusy(false);
      setPreviewProgress(0);
    }
  }

  async function runAiFill() {
    const source = files.thumbnail || files.original;
    if (!source) {
      toast.error('Attach a video (or thumbnail) first so AI has something to look at');
      return;
    }
    setAiFilling(true);
    const pending = toast.loading('Extracting frame…');
    try {
      const { base64, mediaType } = source.type.startsWith('image/')
        ? await extractImage(source)
        : await extractFrame(source);

      toast.loading('Asking Claude for a listing…', { id: pending });
      const token = await getToken();
      const res = await fetch('/api/admin/ai-fill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          imageBase64: base64,
          mediaType,
          hint: form.location.trim(),
          filename: source.name,
        }),
      });
      const data = (await res.json()) as AiFillResponse;
      if (!res.ok || data.error) {
        toast.error(data.error || `AI fill failed (HTTP ${res.status})`, { id: pending });
        return;
      }

      setForm(prev => ({
        ...prev,
        title: data.title || prev.title,
        description: data.description || prev.description,
        location: data.location || prev.location,
        tags: Array.isArray(data.tags) && data.tags.length ? data.tags.join(', ') : prev.tags,
        price: Number.isFinite(data.price_cents) ? (data.price_cents! / 100).toFixed(2) : prev.price,
      }));
      toast.success('AI suggestions applied — review and edit', { id: pending });
    } catch (e: any) {
      toast.error(e.message || 'AI fill failed', { id: pending });
    } finally {
      setAiFilling(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title) { toast.error('Title is required'); return; }
    if (!files.original) { toast.error('Original video file is required'); return; }

    setSubmitting(true);
    setUploadProgress({});
    try {
      const video = await createVideo({
        title: form.title,
        description: form.description,
        location: form.location,
        tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
        price_cents: Math.round(parseFloat(form.price) * 100),
        resolution: form.resolution,
        fps: parseInt(form.fps),
        duration_seconds: detectedDuration || 0,
        status: form.status,
      });

      const queue: { type: 'original' | 'preview' | 'thumbnail'; file: File }[] = [];
      if (files.original) queue.push({ type: 'original', file: files.original });
      if (files.preview) queue.push({ type: 'preview', file: files.preview });
      if (files.thumbnail) queue.push({ type: 'thumbnail', file: files.thumbnail });

      for (const item of queue) {
        await uploadVideoFile(video.id, item.file, item.type, pct => setUploadProgress(p => ({ ...p, [item.type]: pct })));
        setUploadProgress(p => ({ ...p, [item.type]: 100 }));
      }

      toast.success('Video uploaded successfully!');
      navigate('/admin/videos');
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setSubmitting(false);
    }
  }

  // Combined upload progress for the overlay — weighted by file size so the big raw
  // video drives the bar, not the tiny thumbnail.
  const uploadTotals = (() => {
    const items = [
      { type: 'original' as const, file: files.original },
      { type: 'preview' as const, file: files.preview },
      { type: 'thumbnail' as const, file: files.thumbnail },
    ].filter(x => x.file) as { type: 'original' | 'preview' | 'thumbnail'; file: File }[];
    const totalBytes = items.reduce((s, x) => s + x.file.size, 0) || 1;
    const doneBytes = items.reduce((s, x) => s + (x.file.size * (uploadProgress[x.type] || 0)) / 100, 0);
    return {
      items,
      totalBytes,
      doneBytes,
      percent: Math.min(100, Math.round((doneBytes / totalBytes) * 100)),
    };
  })();

  function fmtMB(bytes: number) {
    return bytes > 900 * 1024 * 1024
      ? `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
      : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  const fileZone = (type: 'original' | 'preview' | 'thumbnail', label: string, accept: string, icon: React.ReactNode) => (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          {icon}
          <div className="min-w-0">
            <h3 className="font-display font-semibold text-white">{label}</h3>
            <p className="text-xs text-sky-500">
              {type === 'original' ? 'Full quality unwatermarked file' :
               type === 'preview' ? 'Watermarked short preview clip' :
               'Thumbnail image (16:9 ratio)'}
            </p>
          </div>
        </div>
        {type === 'thumbnail' && (
          <button
            type="button"
            onClick={generateThumbnail}
            disabled={!files.original || thumbBusy}
            className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-display font-semibold text-ember-300 border border-ember-400/40 bg-ember-500/10 hover:bg-ember-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title={files.original ? 'Extract a forward-facing frame from the 360° master' : 'Attach the original video first'}
          >
            {thumbBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Aperture className="w-3 h-3" />}
            Auto
          </button>
        )}
        {type === 'preview' && (
          <button
            type="button"
            onClick={generatePreview}
            disabled={!files.original || previewBusy}
            className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-display font-semibold text-ember-300 border border-ember-400/40 bg-ember-500/10 hover:bg-ember-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title={files.original ? 'Record a 6s watermarked teaser' : 'Attach the original video first'}
          >
            {previewBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
            {previewBusy ? `${previewProgress}%` : 'Auto'}
          </button>
        )}
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

  const hasSource = !!(files.thumbnail || files.original);

  return (
    <div className="page-enter max-w-4xl relative">
      {/* Full-screen upload overlay — shown while the submit is in flight */}
      {submitting && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center px-4">
          <div
            className="w-full max-w-xl rounded-3xl p-8"
            style={{
              background: 'linear-gradient(180deg, rgba(20,29,54,0.95), rgba(10,14,26,0.98))',
              border: '1px solid rgba(249,115,22,0.35)',
              boxShadow: '0 30px 80px -30px rgba(249,115,22,0.35)',
            }}
          >
            <div className="flex items-center gap-3 mb-5">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #38bdf8, #f97316)' }}
              >
                <Upload className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="font-display font-bold text-white text-lg">Uploading clip</div>
                <div className="text-xs text-sky-400">
                  {fmtMB(uploadTotals.doneBytes)} of {fmtMB(uploadTotals.totalBytes)} sent · keep this tab open
                </div>
              </div>
            </div>

            {/* Big percent */}
            <div className="flex items-baseline gap-2 mb-2">
              <span
                className="font-display font-extrabold text-5xl leading-none"
                style={{
                  backgroundImage: 'linear-gradient(90deg, #7dd3fc, #f97316)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                {uploadTotals.percent}%
              </span>
              <span className="text-xs text-sky-500 font-mono">combined progress</span>
            </div>

            {/* Master bar */}
            <div className="h-3 rounded-full bg-sky-900/60 overflow-hidden mb-6">
              <div
                className="h-full rounded-full transition-[width] duration-300"
                style={{
                  width: `${uploadTotals.percent}%`,
                  background: 'linear-gradient(90deg, #38bdf8, #f97316)',
                  boxShadow: '0 0 20px rgba(249,115,22,0.5)',
                }}
              />
            </div>

            {/* Per-file breakdown */}
            <div className="space-y-3">
              {uploadTotals.items.map(item => {
                const pct = uploadProgress[item.type] || 0;
                return (
                  <div key={item.type}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <div className="flex items-center gap-2">
                        <span className="font-display font-semibold text-sky-200 capitalize">{item.type}</span>
                        <span className="text-sky-600 font-mono">{fmtMB(item.file.size)}</span>
                      </div>
                      <span className={`font-mono ${pct >= 100 ? 'text-emerald-400' : 'text-ember-300'}`}>
                        {pct >= 100 ? '✓ Done' : `${pct}%`}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-sky-900/60 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-[width] duration-200"
                        style={{
                          width: `${pct}%`,
                          background: pct >= 100
                            ? 'linear-gradient(90deg, #10b981, #34d399)'
                            : 'linear-gradient(90deg, #38bdf8, #f97316)',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 text-[11px] text-sky-600 text-center font-mono">
              Uploading directly to Cloudflare R2 · large files take time
            </div>
          </div>
        </div>
      )}

      <h1 className="font-display font-bold text-2xl text-white mb-2">Upload New Video</h1>
      <p className="text-sky-500 text-sm mb-8">
        Add new FPV footage to your library. Attach the video, optionally type the location, then click <strong className="text-ember-300">AI Fill</strong> to auto-populate the rest.
      </p>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* AI Fill banner */}
        <div
          className="rounded-2xl p-4 flex items-center gap-4"
          style={{
            background: 'linear-gradient(135deg, rgba(56,189,248,0.12), rgba(249,115,22,0.12))',
            border: '1px solid rgba(249,115,22,0.35)',
          }}
        >
          <div
            className="w-11 h-11 shrink-0 rounded-xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #38bdf8, #f97316)',
              boxShadow: '0 0 20px rgba(249,115,22,0.35)',
            }}
          >
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-display font-semibold text-white">AI Fill</div>
            <div className="text-xs text-sky-400 mt-0.5">
              {hasSource
                ? (form.location
                    ? <>Using <span className="text-ember-300">&ldquo;{form.location}&rdquo;</span> as location hint. Claude will generate title, description, tags, and a suggested price.</>
                    : 'Type a location like "Frenchville Flyover" or "Mt Archer" below for best results, or leave blank to let Claude guess from the frame.')
                : 'Attach a video (or thumbnail) below, then come back here.'}
            </div>
          </div>
          <button
            type="button"
            onClick={runAiFill}
            disabled={!hasSource || aiFilling}
            className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl font-display font-semibold text-sm text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.02]"
            style={{
              background: 'linear-gradient(135deg, #f97316, #fb923c)',
              boxShadow: '0 10px 24px -10px rgba(249,115,22,0.55)',
            }}
          >
            {aiFilling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {aiFilling ? 'Thinking…' : 'AI Fill'}
          </button>
        </div>

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
              <label className="block text-sm font-display font-medium text-sky-300 mb-2">
                Location <span className="text-[10px] font-mono text-ember-400 uppercase tracking-wider ml-1">· AI hint</span>
              </label>
              <input name="location" value={form.location} onChange={handleChange} className="input-field" placeholder='e.g., "Frenchville Flyover" or "Mt Archer"' />
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
