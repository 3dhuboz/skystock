import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Download, Loader2, Play, Pause, Film, Wand2, Upload, RotateCcw, Aperture, Gauge } from 'lucide-react';
import { PRESETS, PresetName, LENSES, LensName, createScene, SceneHandle, pickSupportedMime, startExport, ExportHandle } from '../lib/editor';
import { getVideo } from '../lib/api';
import { Video } from '../lib/types';

type Phase = 'loading-meta' | 'loading-video' | 'ready' | 'exporting' | 'done' | 'error';

export default function Editor() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const srcOverride = searchParams.get('src');

  const [video, setVideo] = useState<Video | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('loading-meta');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [preset, setPreset] = useState<PresetName>('orbit');
  const [lens, setLens] = useState<LensName>('wide');
  const [speed, setSpeed] = useState<number>(1);
  const [duration, setDuration] = useState<number>(0);
  const [playhead, setPlayhead] = useState<number>(0);
  const [trimIn, setTrimIn] = useState<number>(0);
  const [trimOut, setTrimOut] = useState<number>(0);
  const playheadRafRef = useRef<number>(0);
  const [playing, setPlaying] = useState(false);
  const [exportBytes, setExportBytes] = useState(0);
  const [exportElapsed, setExportElapsed] = useState(0);
  const [downloadBlobUrl, setDownloadBlobUrl] = useState<string | null>(null);
  const [downloadMime, setDownloadMime] = useState<string>('video/mp4');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<SceneHandle | null>(null);
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const exportRef = useRef<ExportHandle | null>(null);
  const exportStartRef = useRef<number>(0);

  // Fetch video metadata
  useEffect(() => {
    if (srcOverride) {
      // Dev mode: use query-string src, skip metadata fetch
      setSourceUrl(srcOverride);
      setPhase('loading-video');
      return;
    }
    if (!id) {
      // No id and no src: show the local-file fallback picker
      setPhase('error');
      setErrorMsg('No clip selected. Drop a 360 MP4 to try the editor locally.');
      return;
    }
    (async () => {
      try {
        const v = await getVideo(id);
        setVideo(v);
        // TODO: swap to a dedicated /editor-source endpoint that returns a
        // short-lived signed URL for a reduced-quality 360 master.
        const src = v.preview_url || v.watermarked_url || null;
        if (!src) throw new Error('No streamable source available for this clip.');
        setSourceUrl(src);
        setPhase('loading-video');
      } catch (e: any) {
        setErrorMsg(e?.message ?? 'Failed to load video metadata.');
        setPhase('error');
      }
    })();
  }, [id, srcOverride]);

  // Set up Three.js scene + hidden <video> element once we have a source URL
  useEffect(() => {
    if (!sourceUrl || !canvasRef.current) return;

    const scene = createScene(canvasRef.current);
    sceneRef.current = scene;
    scene.setOutputSize(1920, 1080);

    const videoEl = document.createElement('video');
    videoEl.crossOrigin = 'anonymous';
    videoEl.playsInline = true;
    videoEl.loop = true;
    videoEl.muted = true;
    videoEl.preload = 'auto';
    videoEl.src = sourceUrl;
    videoElRef.current = videoEl;

    const onReady = () => {
      scene.setVideo(videoEl);
      setDuration(videoEl.duration || 0);
      setTrimIn(0);
      setTrimOut(videoEl.duration || 0);
      setPhase('ready');
      videoEl.play().then(() => setPlaying(true)).catch(() => {});
    };
    const onError = () => {
      setErrorMsg('Failed to load video stream.');
      setPhase('error');
    };

    videoEl.addEventListener('loadeddata', onReady, { once: true });
    videoEl.addEventListener('error', onError, { once: true });
    videoEl.load();

    return () => {
      videoEl.pause();
      videoEl.removeAttribute('src');
      videoEl.load();
      scene.dispose();
      sceneRef.current = null;
      videoElRef.current = null;
    };
  }, [sourceUrl]);

  // Apply preset changes to scene
  useEffect(() => {
    sceneRef.current?.setPreset(preset);
  }, [preset]);

  // Apply lens changes to scene
  useEffect(() => {
    sceneRef.current?.setLens(lens);
  }, [lens]);

  // Apply speed to the video element
  useEffect(() => {
    if (videoElRef.current) videoElRef.current.playbackRate = speed;
  }, [speed]);

  // Apply trim to the scene (for preset t normalization) + enforce loop-within-trim during preview
  useEffect(() => {
    sceneRef.current?.setTrim(trimIn, trimOut);
  }, [trimIn, trimOut]);

  // Watch playhead + enforce loop between trim handles during preview (not during export).
  useEffect(() => {
    const tick = () => {
      const v = videoElRef.current;
      if (v) {
        setPlayhead(v.currentTime);
        if (phase === 'ready' && v.loop && v.currentTime >= trimOut && trimOut > trimIn) {
          v.currentTime = trimIn;
        } else if (phase === 'ready' && v.currentTime < trimIn - 0.1) {
          v.currentTime = trimIn;
        }
      }
      playheadRafRef.current = requestAnimationFrame(tick);
    };
    playheadRafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(playheadRafRef.current);
  }, [trimIn, trimOut, phase]);

  // Play/pause toggle
  const togglePlay = () => {
    const v = videoElRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setPlaying(true); }
    else { v.pause(); setPlaying(false); }
  };

  // Export flow
  const handleExport = async () => {
    const scene = sceneRef.current;
    const v = videoElRef.current;
    if (!scene || !v) return;

    const mime = pickSupportedMime();
    if (!mime) {
      setErrorMsg('Your browser does not support MediaRecorder video export.');
      setPhase('error');
      return;
    }

    setPhase('exporting');
    setExportBytes(0);
    setDownloadBlobUrl(null);
    exportStartRef.current = performance.now();

    v.loop = false;
    v.currentTime = trimIn;
    await v.play();
    setPlaying(true);

    const stream = scene.captureStream(30);
    const handle = startExport(stream, mime, (bytes) => {
      setExportBytes(bytes);
      setExportElapsed(performance.now() - exportStartRef.current);
    });
    exportRef.current = handle;

    const onTimeUpdate = () => {
      if (v.currentTime >= trimOut) {
        v.pause();
        handle.stop();
        v.removeEventListener('timeupdate', onTimeUpdate);
      }
    };
    v.addEventListener('timeupdate', onTimeUpdate);
    const stopWhenDone = () => handle.stop();
    v.addEventListener('ended', stopWhenDone, { once: true });

    const blob = await handle.done;
    v.removeEventListener('timeupdate', onTimeUpdate);
    const url = URL.createObjectURL(blob);
    setDownloadBlobUrl(url);
    setDownloadMime(handle.mime);
    setPhase('done');
    v.loop = true; // restore preview loop
    v.currentTime = trimIn;
    v.play().catch(() => {});
  };

  const cancelExport = () => {
    exportRef.current?.stop();
    setPhase('ready');
  };

  const downloadExt = downloadMime.startsWith('video/mp4') ? 'mp4' : 'webm';
  const exportSizeMB = (exportBytes / 1024 / 1024).toFixed(1);

  const seekTo = useCallback((sec: number) => {
    if (videoElRef.current) videoElRef.current.currentTime = Math.max(0, Math.min(duration, sec));
  }, [duration]);

  const trimDuration = Math.max(0, trimOut - trimIn);

  return (
    <div className="fixed inset-0 bg-[#0a0e1a] text-white flex flex-col">
      {/* Header */}
      <header className="flex items-center gap-4 px-6 py-3 border-b border-sky-800/30 flex-shrink-0">
        <Link to={id ? `/video/${id}` : '/browse'} className="btn-ghost text-sm">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <div className="flex-1 min-w-0">
          <div className="font-display font-semibold text-sm truncate">
            {video?.title || (srcOverride ? 'Editor (dev preview)' : 'Editor')}
          </div>
          <div className="text-xs text-sky-500 font-mono truncate">
            {PRESETS.find(p => p.id === preset)?.description}
          </div>
        </div>
        <div className="text-xs text-sky-600 font-mono hidden lg:block">
          Preview fits screen · export = 1920×1080
        </div>
        <button
          onClick={handleExport}
          disabled={phase !== 'ready'}
          className="btn-ember text-sm px-5 py-2.5 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Download className="w-4 h-4" />
          Export 1080p
        </button>
      </header>

      {/* Stage */}
      <div className="flex-1 relative bg-black min-h-0">
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

        {phase === 'loading-meta' || phase === 'loading-video' ? (
          <div className="absolute inset-0 flex items-center justify-center text-sky-400 text-sm">
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
            {phase === 'loading-meta' ? 'Loading clip…' : 'Streaming 360 source…'}
          </div>
        ) : null}

        {phase === 'error' ? (
          <div className="absolute inset-0 flex items-center justify-center flex-col gap-4 text-center px-6">
            <div className="text-sky-300 font-medium max-w-md">{errorMsg || 'Something went wrong.'}</div>
            <label className="btn-ember text-sm px-5 py-2.5 cursor-pointer">
              <Upload className="w-4 h-4" />
              Load 360 MP4
              <input
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const url = URL.createObjectURL(f);
                  setSourceUrl(url);
                  setPhase('loading-video');
                  setErrorMsg('');
                }}
              />
            </label>
            <Link to="/browse" className="btn-ghost text-xs">Or browse clips</Link>
          </div>
        ) : null}

        {phase === 'exporting' ? (
          <div className="absolute inset-x-0 bottom-0 bg-sky-950/90 backdrop-blur border-t border-sky-800/50 px-6 py-4 flex items-center gap-4">
            <Loader2 className="w-5 h-5 animate-spin text-ember-400" />
            <div className="flex-1">
              <div className="text-sm font-medium">Rendering your edit…</div>
              <div className="text-xs text-sky-400 font-mono">
                {exportSizeMB} MB · {(exportElapsed / 1000).toFixed(1)}s elapsed · real-time render
              </div>
            </div>
            <button onClick={cancelExport} className="btn-ghost text-xs">Cancel</button>
          </div>
        ) : null}

        {phase === 'done' && downloadBlobUrl ? (
          <div className="absolute inset-x-0 bottom-0 bg-sky-950/90 backdrop-blur border-t border-sky-800/50 px-6 py-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Film className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium">Your edit is ready.</div>
              <div className="text-xs text-sky-400 font-mono">
                {exportSizeMB} MB · watermarked · free export
              </div>
            </div>
            <a
              href={downloadBlobUrl}
              download={`skystock-${id || 'edit'}.${downloadExt}`}
              className="btn-ember text-sm px-5 py-2.5"
            >
              <Download className="w-4 h-4" /> Download
            </a>
            <button
              onClick={() => setPhase('ready')}
              className="btn-ghost text-xs"
            >
              Edit more
            </button>
          </div>
        ) : null}
      </div>

      {/* Timeline: scrub + trim handles */}
      {duration > 0 ? (
        <Timeline
          duration={duration}
          playhead={playhead}
          trimIn={trimIn}
          trimOut={trimOut}
          disabled={phase === 'exporting'}
          onSeek={seekTo}
          onTrimChange={(a, b) => { setTrimIn(a); setTrimOut(b); }}
        />
      ) : null}

      {/* Footer: two rows — motion presets + lens presets */}
      <footer className="px-6 py-3 border-t border-sky-800/30 flex-shrink-0 space-y-2">
        {/* Row 1: motion presets */}
        <div className="flex items-center gap-3 overflow-x-auto">
          <button
            onClick={togglePlay}
            disabled={phase !== 'ready'}
            className="btn-ghost text-xs flex-shrink-0 disabled:opacity-40"
          >
            {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {playing ? 'Pause' : 'Play'}
          </button>
          <div className="w-px h-8 bg-sky-800/40 flex-shrink-0" />
          <div className="text-xs text-sky-500 uppercase font-mono flex-shrink-0 pr-2 flex items-center gap-1.5 w-32">
            <Wand2 className="w-3.5 h-3.5" />
            Motion
          </div>
          {PRESETS.map(p => (
            <button
              key={p.id}
              onClick={() => setPreset(p.id)}
              disabled={phase !== 'ready'}
              className={
                'px-4 py-2 rounded-lg text-sm font-medium transition-all flex-shrink-0 ' +
                (preset === p.id
                  ? 'bg-ember-500/20 text-ember-400 border border-ember-500/40'
                  : 'bg-sky-900/30 text-sky-300 border border-sky-800/30 hover:bg-sky-800/40')
              }
            >
              {p.label}
            </button>
          ))}
          <div className="w-px h-8 bg-sky-800/40 flex-shrink-0" />
          <button
            onClick={() => sceneRef.current?.resetFrame()}
            disabled={phase !== 'ready'}
            className="btn-ghost text-xs flex-shrink-0 disabled:opacity-40"
            title="Reset to the preset's default angle"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset frame
          </button>
        </div>
        {/* Row 2: lens presets */}
        <div className="flex items-center gap-3 overflow-x-auto">
          <div className="text-xs text-sky-500 uppercase font-mono flex-shrink-0 pr-2 flex items-center gap-1.5 w-32 pl-[72px]">
            <Aperture className="w-3.5 h-3.5" />
            Lens
          </div>
          {LENSES.map(l => (
            <button
              key={l.id}
              onClick={() => setLens(l.id)}
              disabled={phase !== 'ready'}
              title={l.description}
              className={
                'px-4 py-2 rounded-lg text-sm font-medium transition-all flex-shrink-0 ' +
                (lens === l.id
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                  : 'bg-sky-900/30 text-sky-400 border border-sky-800/30 hover:bg-sky-800/40')
              }
            >
              {l.label}
            </button>
          ))}
          <div className="flex-1" />
          <div className="text-xs text-sky-600 font-mono hidden md:block flex-shrink-0">
            Drag to reframe · scroll to zoom
          </div>
        </div>
        {/* Row 3: speed */}
        <div className="flex items-center gap-3 overflow-x-auto">
          <div className="text-xs text-sky-500 uppercase font-mono flex-shrink-0 pr-2 flex items-center gap-1.5 w-32 pl-[72px]">
            <Gauge className="w-3.5 h-3.5" />
            Speed
          </div>
          {[0.25, 0.5, 1, 2, 4].map(s => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              disabled={phase !== 'ready'}
              className={
                'px-4 py-2 rounded-lg text-sm font-medium transition-all flex-shrink-0 min-w-[72px] ' +
                (speed === s
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-sky-900/30 text-sky-400 border border-sky-800/30 hover:bg-sky-800/40')
              }
            >
              {s === 1 ? '1× Normal' : s < 1 ? `${s}× Slow` : `${s}× Fast`}
            </button>
          ))}
          <div className="flex-1" />
          <div className="text-xs text-sky-600 font-mono hidden md:block flex-shrink-0">
            Speed bakes into the export
          </div>
        </div>
      </footer>
    </div>
  );
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const rem = s - m * 60;
  return `${m}:${rem.toFixed(1).padStart(4, '0')}`;
}

interface TimelineProps {
  duration: number;
  playhead: number;
  trimIn: number;
  trimOut: number;
  disabled: boolean;
  onSeek: (sec: number) => void;
  onTrimChange: (a: number, b: number) => void;
}

function Timeline({ duration, playhead, trimIn, trimOut, disabled, onSeek, onTrimChange }: TimelineProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<'in' | 'out' | 'scrub' | null>(null);

  const toPct = (t: number) => (duration > 0 ? (t / duration) * 100 : 0);
  const fromClientX = useCallback((x: number): number => {
    const el = trackRef.current;
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (x - r.left) / r.width));
    return pct * duration;
  }, [duration]);

  const onPointerDown = (mode: 'in' | 'out' | 'scrub') => (e: React.PointerEvent) => {
    if (disabled) return;
    draggingRef.current = mode;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const t = fromClientX(e.clientX);
    if (mode === 'scrub') onSeek(t);
    if (mode === 'in') onTrimChange(Math.min(t, trimOut - 0.1), trimOut);
    if (mode === 'out') onTrimChange(trimIn, Math.max(t, trimIn + 0.1));
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const mode = draggingRef.current;
    if (!mode) return;
    const t = fromClientX(e.clientX);
    if (mode === 'scrub') onSeek(t);
    if (mode === 'in') onTrimChange(Math.max(0, Math.min(t, trimOut - 0.1)), trimOut);
    if (mode === 'out') onTrimChange(trimIn, Math.max(trimIn + 0.1, Math.min(duration, t)));
  };
  const onPointerUp = () => { draggingRef.current = null; };

  const inPct = toPct(trimIn);
  const outPct = toPct(trimOut);
  const phPct = toPct(playhead);
  const trimLen = Math.max(0, trimOut - trimIn);

  return (
    <div className="px-6 py-3 border-t border-sky-800/30 bg-sky-950/40 flex-shrink-0">
      <div className="flex items-center gap-3 text-xs font-mono mb-2">
        <span className="text-sky-500 w-16">{formatTime(playhead)}</span>
        <div className="flex-1" />
        <span className="text-sky-500 uppercase text-[10px] tracking-wider">
          Trim: {formatTime(trimLen)} of {formatTime(duration)}
        </span>
        <div className="flex-1" />
        <span className="text-sky-500 w-16 text-right">{formatTime(duration)}</span>
      </div>
      <div
        ref={trackRef}
        className="relative h-10 bg-sky-900/50 rounded-lg select-none cursor-pointer"
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {/* Scrubbable background */}
        <div
          className="absolute inset-0 rounded-lg"
          onPointerDown={onPointerDown('scrub')}
        />
        {/* Active trim region */}
        <div
          className="absolute top-0 bottom-0 bg-ember-500/15 border-y-2 border-ember-500/50 pointer-events-none"
          style={{ left: `${inPct}%`, width: `${outPct - inPct}%` }}
        />
        {/* In handle */}
        <div
          onPointerDown={onPointerDown('in')}
          className="absolute top-0 bottom-0 -ml-1.5 w-3 bg-ember-500 rounded cursor-ew-resize shadow-lg z-10 flex items-center justify-center"
          style={{ left: `${inPct}%` }}
          title={`Trim in: ${formatTime(trimIn)}`}
        >
          <div className="h-5 w-0.5 bg-ember-900/60" />
        </div>
        {/* Out handle */}
        <div
          onPointerDown={onPointerDown('out')}
          className="absolute top-0 bottom-0 -ml-1.5 w-3 bg-ember-500 rounded cursor-ew-resize shadow-lg z-10 flex items-center justify-center"
          style={{ left: `${outPct}%` }}
          title={`Trim out: ${formatTime(trimOut)}`}
        >
          <div className="h-5 w-0.5 bg-ember-900/60" />
        </div>
        {/* Playhead */}
        <div
          className="absolute top-[-6px] bottom-[-6px] w-0.5 bg-white pointer-events-none z-20 shadow"
          style={{ left: `${phPct}%` }}
        >
          <div className="absolute -top-1 -translate-x-1/2 w-2 h-2 bg-white rounded-full" />
          <div className="absolute -bottom-1 -translate-x-1/2 w-2 h-2 bg-white rounded-full" />
        </div>
      </div>
    </div>
  );
}
