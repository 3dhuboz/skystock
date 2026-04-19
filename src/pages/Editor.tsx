import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Download, Loader2, Play, Pause, Film, Wand2, Upload, RotateCcw, Aperture, Gauge, Diamond, Trash2, Music, X, Type, Palette, Monitor, Smartphone, Square, Plus, Volume2, VolumeX } from 'lucide-react';
import { PRESETS, PresetName, LENSES, LensName, Keyframe, EasingCurve, ColorAdjust, DEFAULT_COLOR, TitlePosition, createScene, SceneHandle, pickSupportedMime, startExport, ExportHandle, computeAutoColor, STOCK_MUSIC, StockTrack } from '../lib/editor';
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
  const [preset, setPreset] = useState<PresetName>('static');
  const [lens, setLens] = useState<LensName>('wide');
  const [speed, setSpeed] = useState<number>(1);
  // DJI-style stabilisation toggles — RockSteady dampens motion, Horizon Leveling
  // locks horizon to world-up. Hooked to the scene as cosmetic state for now; full
  // treatment lives in the shader motion stack.
  const [rockSteady, setRockSteady] = useState<boolean>(true);
  const [horizonLevel, setHorizonLevel] = useState<boolean>(true);
  // Live camera telemetry — driven by the scene, shown as numeric readouts under
  // the Lens tab so the editor reads as a real camera UI not a toy.
  const [camReadout, setCamReadout] = useState<{ yawDeg: number; pitchDeg: number; rollDeg: number; fovDeg: number; zoom: number }>({
    yawDeg: 0, pitchDeg: 0, rollDeg: 0, fovDeg: 75, zoom: 1,
  });
  const [duration, setDuration] = useState<number>(0);
  const [playhead, setPlayhead] = useState<number>(0);
  const [trimIn, setTrimIn] = useState<number>(0);
  const [trimOut, setTrimOut] = useState<number>(0);
  const [keyframes, setKeyframes] = useState<Keyframe[]>([]);
  const [musicName, setMusicName] = useState<string>('');
  const [musicPickerOpen, setMusicPickerOpen] = useState<boolean>(false);
  const [paywallOpen, setPaywallOpen] = useState<boolean>(false);
  const [paywallTier, setPaywallTier] = useState<'free' | 'clean'>('free');
  const [paywallEmail, setPaywallEmail] = useState<string>('');
  const CLEAN_EXPORT_PRICE = 4.99;

  interface ClipSettings {
    preset: PresetName;
    lens: LensName;
    speed: number;
    color: ColorAdjust;
    keyframes: Keyframe[];
    title: string;
    titleDuration: number;
    titlePosition: TitlePosition;
  }
  const DEFAULT_CLIP_SETTINGS: ClipSettings = {
    preset: 'static',
    lens: 'wide',
    speed: 1,
    color: DEFAULT_COLOR,
    keyframes: [],
    title: '',
    titleDuration: 3,
    titlePosition: 'center',
  };
  interface ClipEntry { id: string; name: string; url: string; trimIn: number; trimOut: number; settings: ClipSettings }
  const [clips, setClips] = useState<ClipEntry[]>([]);
  const [activeClipId, setActiveClipId] = useState<string>('');
  const [title, setTitle] = useState<string>('');
  const [titleDuration, setTitleDuration] = useState<number>(3);
  const [titlePosition, setTitlePosition] = useState<TitlePosition>('center');
  const [color, setColor] = useState<ColorAdjust>(DEFAULT_COLOR);
  const [defaultEasing, setDefaultEasing] = useState<EasingCurve>('smooth');
  type AspectId = '16:9' | '9:16' | '1:1';
  const [aspect, setAspect] = useState<AspectId>('16:9');
  type TabId = 'motion' | 'lens' | 'speed' | 'keyframes' | 'color' | 'text';
  const [activeTab, setActiveTab] = useState<TabId>('motion');
  // Footer panel height — drag the top edge to resize. 0 = collapsed (just the toolbar row).
  const [panelHeight, setPanelHeight] = useState<number>(48);

  const ASPECT_DIMS: Record<AspectId, { w: number; h: number; label: string }> = {
    '16:9': { w: 1920, h: 1080, label: '1920×1080' },
    '9:16': { w: 1080, h: 1920, label: '1080×1920' },
    '1:1':  { w: 1080, h: 1080, label: '1080×1080' },
  };
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const [musicVolume, setMusicVolume] = useState<number>(0.8);
  const [musicMuted, setMusicMuted] = useState<boolean>(false);
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
    const dims = ASPECT_DIMS[aspect];
    scene.setOutputSize(dims.w, dims.h);

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

  // When a new sourceUrl is set (via file picker, ?src=, or clip metadata), register it as a clip.
  useEffect(() => {
    if (!sourceUrl) return;
    setClips(prev => {
      if (prev.some(c => c.url === sourceUrl)) return prev;
      const name = (() => {
        if (sourceUrl.startsWith('blob:')) return `Clip ${prev.length + 1}`;
        try { return decodeURIComponent(new URL(sourceUrl, window.location.href).pathname.split('/').pop() || 'Clip'); }
        catch { return `Clip ${prev.length + 1}`; }
      })();
      const id = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);
      // First clip takes the current session state as its defaults; subsequent clips start clean.
      const settings: ClipSettings = prev.length === 0
        ? { preset, lens, speed, color, keyframes, title, titleDuration, titlePosition }
        : DEFAULT_CLIP_SETTINGS;
      const clip: ClipEntry = { id, name, url: sourceUrl, trimIn: 0, trimOut: 0, settings };
      setActiveClipId(id);
      return [...prev, clip];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceUrl]);

  // Live-sync session state into the active clip's settings so per-clip edits persist.
  useEffect(() => {
    if (!activeClipId) return;
    setClips(prev => prev.map(c => c.id === activeClipId ? {
      ...c,
      trimIn,
      trimOut,
      settings: { preset, lens, speed, color, keyframes, title, titleDuration, titlePosition },
    } : c));
  }, [activeClipId, trimIn, trimOut, preset, lens, speed, color, keyframes, title, titleDuration, titlePosition]);

  const addClipFile = useCallback((file: File) => {
    const url = URL.createObjectURL(file);
    setSourceUrl(url);
    setPhase('loading-video');
  }, []);

  const switchClip = useCallback((id: string) => {
    const c = clips.find(x => x.id === id);
    if (!c) return;
    // Set activeClipId first so the sync-to-clip effect targets the NEW clip with new values.
    setActiveClipId(id);
    setSourceUrl(c.url);
    setPhase('loading-video');
    setTrimIn(c.trimIn);
    setTrimOut(c.trimOut);
    setPreset(c.settings.preset);
    setLens(c.settings.lens);
    setSpeed(c.settings.speed);
    setColor(c.settings.color);
    setKeyframes(c.settings.keyframes);
    setTitle(c.settings.title);
    setTitleDuration(c.settings.titleDuration);
    setTitlePosition(c.settings.titlePosition);
  }, [clips]);

  const removeClip = useCallback((id: string) => {
    setClips(prev => {
      const next = prev.filter(c => c.id !== id);
      if (activeClipId === id && next.length > 0) {
        const nextActive = next[0];
        setActiveClipId(nextActive.id);
        setSourceUrl(nextActive.url);
        setPhase('loading-video');
        setTrimIn(nextActive.trimIn);
        setTrimOut(nextActive.trimOut);
        setPreset(nextActive.settings.preset);
        setLens(nextActive.settings.lens);
        setSpeed(nextActive.settings.speed);
        setColor(nextActive.settings.color);
        setKeyframes(nextActive.settings.keyframes);
        setTitle(nextActive.settings.title);
        setTitleDuration(nextActive.settings.titleDuration);
        setTitlePosition(nextActive.settings.titlePosition);
      } else if (next.length === 0) {
        setActiveClipId('');
        setSourceUrl(null);
      }
      return next;
    });
  }, [activeClipId]);

  // Push keyframes to the scene
  useEffect(() => {
    sceneRef.current?.setKeyframes(keyframes);
  }, [keyframes]);

  // Title + position + duration, fade in/out at start of the trimmed region
  useEffect(() => {
    sceneRef.current?.setTitle(title, trimIn, trimIn + titleDuration, titlePosition);
  }, [title, trimIn, titleDuration, titlePosition]);

  // Color grading
  useEffect(() => {
    sceneRef.current?.setColor(color);
  }, [color]);


  // Aspect ratio: resize render target when it changes.
  useEffect(() => {
    const dims = ASPECT_DIMS[aspect];
    sceneRef.current?.setOutputSize(dims.w, dims.h);
  }, [aspect]);

  // Watch playhead + enforce loop between trim handles during preview (not during export).
  useEffect(() => {
    const tick = () => {
      const v = videoElRef.current;
      if (v) {
        setPlayhead(v.currentTime);
        if (phase === 'ready' && v.loop && v.currentTime >= trimOut && trimOut > trimIn) {
          v.currentTime = trimIn;
          if (audioElRef.current) audioElRef.current.currentTime = 0;
        } else if (phase === 'ready' && v.currentTime < trimIn - 0.1) {
          v.currentTime = trimIn;
          if (audioElRef.current) audioElRef.current.currentTime = 0;
        }
      }
      // Camera telemetry readout — poll the scene each frame for live yaw/pitch/zoom.
      const s = sceneRef.current;
      if (s && s.captureState) {
        const st = s.captureState();
        const lensDef = LENSES.find(l => l.id === st.lens);
        const fovDeg = (lensDef?.fov || 75) / (st.zoom || 1);
        setCamReadout({
          yawDeg: ((st.yaw * 180) / Math.PI) % 360,
          pitchDeg: (st.pitch * 180) / Math.PI,
          rollDeg: 0,
          fovDeg,
          zoom: st.zoom,
        });
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

  // Export flow — triggered from the paywall modal after a tier is chosen.
  const runExport = async (tier: 'free' | 'clean') => {
    const scene = sceneRef.current;
    const v = videoElRef.current;
    if (!scene || !v) return;

    const mime = pickSupportedMime();
    if (!mime) {
      setErrorMsg('Your browser does not support MediaRecorder video export.');
      setPhase('error');
      return;
    }

    // Clean tier hides the watermark in the shader for the render duration.
    scene.setWatermarkEnabled(tier !== 'clean');

    setPhase('exporting');
    setExportBytes(0);
    setDownloadBlobUrl(null);
    exportStartRef.current = performance.now();

    v.loop = false;
    v.currentTime = trimIn;
    // Restart music from top so it aligns with the export's first frame
    if (audioElRef.current) {
      audioElRef.current.currentTime = 0;
      await audioElRef.current.play().catch(() => {});
    }
    await v.play();
    setPlaying(true);

    const stream = scene.captureStream(30);
    // Mix in the music audio track if loaded
    if (audioDestRef.current) {
      for (const track of audioDestRef.current.stream.getAudioTracks()) {
        stream.addTrack(track);
      }
    }
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
    // Restore watermark on preview so the live view always shows it.
    scene.setWatermarkEnabled(true);
    v.loop = true; // restore preview loop
    v.currentTime = trimIn;
    v.play().catch(() => {});
  };

  // Opens the export paywall modal. Actual rendering happens via runExport() after tier choice.
  const handleExport = () => {
    if (phase !== 'ready') return;
    setPaywallTier('free');
    setPaywallEmail('');
    setPaywallOpen(true);
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

  const addKeyframe = useCallback(() => {
    const s = sceneRef.current;
    const v = videoElRef.current;
    if (!s || !v) return;
    const st = s.captureState();
    const newKf: Keyframe = { t: v.currentTime, yaw: st.yaw, pitch: st.pitch, zoom: st.zoom, lens: st.lens, ease: defaultEasing };
    setKeyframes(prev => {
      const filtered = prev.filter(k => Math.abs(k.t - newKf.t) > 0.2);
      return [...filtered, newKf].sort((a, b) => a.t - b.t);
    });
    s.resetFrame();
  }, [defaultEasing]);

  const setKeyframeEasing = useCallback((t: number, ease: EasingCurve) => {
    setKeyframes(prev => prev.map(k => k.t === t ? { ...k, ease } : k));
  }, []);

  // Shift-click anywhere on the viewport → add a tracking keyframe aimed at the clicked point.
  const handleCanvasShiftClick = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!e.shiftKey) return;
    const s = sceneRef.current;
    const v = videoElRef.current;
    if (!s || !v || phase !== 'ready') return;
    e.preventDefault();
    e.stopPropagation();
    const r = e.currentTarget.getBoundingClientRect();
    const u = (e.clientX - r.left) / r.width;
    const vN = (e.clientY - r.top) / r.height;
    const aim = s.aimAt([u, vN]);
    if (!aim) return;
    const st = s.captureState();
    const newKf: Keyframe = { t: v.currentTime, yaw: aim.yaw, pitch: aim.pitch, zoom: st.zoom, lens: st.lens, ease: defaultEasing };
    setKeyframes(prev => {
      const filtered = prev.filter(k => Math.abs(k.t - newKf.t) > 0.2);
      return [...filtered, newKf].sort((a, b) => a.t - b.t);
    });
    s.resetFrame();
  }, [phase, defaultEasing]);

  const deleteKeyframe = useCallback((t: number) => {
    setKeyframes(prev => prev.filter(k => k.t !== t));
  }, []);

  const startPanelResize = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = panelHeight;
    const onMove = (ev: PointerEvent) => {
      const delta = startY - ev.clientY; // drag up = positive = grow
      const next = Math.max(0, Math.min(400, startH + delta));
      setPanelHeight(next);
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [panelHeight]);

  const moveKeyframe = useCallback((fromT: number, toT: number) => {
    setKeyframes(prev => {
      const next = prev.map(k => k.t === fromT ? { ...k, t: toT } : k);
      return next.sort((a, b) => a.t - b.t);
    });
  }, []);

  const clearKeyframes = useCallback(() => setKeyframes([]), []);

  const loadMusicFromUrl = useCallback((url: string, displayName: string) => {
    // Clean up any previous audio
    audioElRef.current?.pause();
    if (audioElRef.current) audioElRef.current.src = '';
    audioCtxRef.current?.close().catch(() => {});

    const audio = new Audio(url);
    audio.crossOrigin = 'anonymous';
    audio.loop = true;
    audio.preload = 'auto';
    audioElRef.current = audio;
    setMusicName(displayName);

    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const src = ctx.createMediaElementSource(audio);
    const gain = ctx.createGain();
    gain.gain.value = musicMuted ? 0 : musicVolume;
    const dest = ctx.createMediaStreamDestination();
    src.connect(gain);
    gain.connect(ctx.destination); // speakers (preview)
    gain.connect(dest);             // export stream
    audioCtxRef.current = ctx;
    audioDestRef.current = dest;
    gainNodeRef.current = gain;

    const v = videoElRef.current;
    if (v && !v.paused) audio.play().catch(() => {});
  }, []);

  const loadMusic = useCallback((file: File) => {
    loadMusicFromUrl(URL.createObjectURL(file), file.name);
  }, [loadMusicFromUrl]);

  const pickStockTrack = useCallback((t: StockTrack) => {
    loadMusicFromUrl(t.url, `${t.title} — ${t.mood}`);
    setMusicPickerOpen(false);
  }, [loadMusicFromUrl]);

  const removeMusic = useCallback(() => {
    audioElRef.current?.pause();
    if (audioElRef.current) audioElRef.current.src = '';
    audioCtxRef.current?.close().catch(() => {});
    audioElRef.current = null;
    audioCtxRef.current = null;
    audioDestRef.current = null;
    gainNodeRef.current = null;
    setMusicName('');
  }, []);

  // Live-update gain when volume or mute changes
  useEffect(() => {
    if (!gainNodeRef.current) return;
    gainNodeRef.current.gain.value = musicMuted ? 0 : musicVolume;
  }, [musicVolume, musicMuted]);

  // Keep music playback in sync with video play/pause state
  useEffect(() => {
    const audio = audioElRef.current;
    if (!audio) return;
    if (playing) audio.play().catch(() => {});
    else audio.pause();
  }, [playing]);

  const trimDuration = Math.max(0, trimOut - trimIn);

  return (
    <div className="fixed inset-0 bg-[#0a0e1a] text-white flex flex-col">
      {/* Header */}
      <header className="flex items-center gap-4 px-6 py-3 border-b border-sky-800/30 flex-shrink-0">
        <Link to={id ? `/video/${id}` : '/browse'} className="btn-ghost text-sm">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <div className="flex-1 min-w-0">
          <div className="font-display font-semibold text-sm truncate flex items-center gap-2">
            {video?.title || (srcOverride ? 'Editor (dev preview)' : 'Editor')}
            {video && (
              <span
                className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-mono uppercase tracking-wider"
                style={{
                  background: 'rgba(245,158,11,0.12)',
                  border: '1px solid rgba(245,158,11,0.4)',
                  color: '#fbbf24',
                }}
                title="You are editing the low-quality watermarked preview. Purchase the raw 360° master for clean 4K/60 export."
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                Low-res preview
              </span>
            )}
          </div>
          <div className="text-xs text-sky-500 font-mono truncate">
            {PRESETS.find(p => p.id === preset)?.description}
          </div>
        </div>
        {/* Music chip */}
        {musicName ? (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-medium max-w-[240px]">
            <Music className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">{musicName}</span>
            <button
              onClick={removeMusic}
              className="opacity-60 hover:opacity-100 flex-shrink-0"
              title="Remove music"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setMusicPickerOpen(true)}
            className="btn-ghost text-xs"
          >
            <Music className="w-4 h-4" />
            Add music
          </button>
        )}
        <button
          onClick={handleExport}
          disabled={phase !== 'ready'}
          className="btn-ember text-sm px-5 py-2.5 disabled:opacity-40 disabled:cursor-not-allowed"
          title={`Export at ${ASPECT_DIMS[aspect].label}`}
        >
          <Download className="w-4 h-4" />
          Export {ASPECT_DIMS[aspect].label}
        </button>
      </header>

      {/* Clip tab bar (multi-clip workspace) */}
      {clips.length > 0 ? (
        <div className="flex items-stretch border-b border-sky-800/30 bg-sky-950/20 flex-shrink-0 overflow-x-auto">
          {clips.map(c => {
            const active = c.id === activeClipId;
            return (
              <div
                key={c.id}
                className={
                  'flex items-center gap-2 px-3 h-9 border-r border-sky-800/30 flex-shrink-0 cursor-pointer transition-colors ' +
                  (active ? 'bg-sky-900/60 text-sky-100' : 'text-sky-500 hover:bg-sky-900/30')
                }
                onClick={() => switchClip(c.id)}
              >
                <Film className={'w-3.5 h-3.5 flex-shrink-0 ' + (active ? 'text-ember-400' : '')} />
                <span className="text-xs max-w-[160px] truncate">{c.name}</span>
                {clips.length > 1 ? (
                  <button
                    onClick={(e) => { e.stopPropagation(); removeClip(c.id); }}
                    className="opacity-50 hover:opacity-100 flex-shrink-0"
                    title="Remove clip"
                  >
                    <X className="w-3 h-3" />
                  </button>
                ) : null}
              </div>
            );
          })}
          <label className="flex items-center gap-1.5 px-3 h-9 cursor-pointer text-sky-500 hover:bg-sky-900/40 text-xs flex-shrink-0">
            <Plus className="w-3.5 h-3.5" />
            Add clip
            <input
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) addClipFile(f);
                e.target.value = '';
              }}
            />
          </label>
        </div>
      ) : null}

      {/* Main workspace: left icons | center preview+timeline+transport | right property sidebar */}
      <div className="flex-1 flex min-h-0">
        {/* Left icon strip — tool selector (DJI-like) */}
        <aside className="w-16 border-r border-sky-800/30 bg-sky-950/40 flex flex-col items-stretch py-2 flex-shrink-0">
          {([
            { id: 'motion',    label: 'Motion',    icon: Wand2 },
            { id: 'lens',      label: 'Lens',      icon: Aperture },
            { id: 'speed',     label: 'Speed',     icon: Gauge },
            { id: 'color',     label: 'Color',     icon: Palette },
            { id: 'text',      label: 'Text',      icon: Type },
            { id: 'keyframes', label: 'Keyframes', icon: Diamond },
          ] as const).map(t => {
            const active = activeTab === t.id;
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                title={t.label}
                className={
                  'relative h-14 flex flex-col items-center justify-center gap-1 transition-colors ' +
                  (active
                    ? 'text-ember-300 bg-ember-500/10'
                    : 'text-sky-500 hover:text-sky-300 hover:bg-sky-900/40')
                }
              >
                {active ? <div className="absolute left-0 top-2 bottom-2 w-0.5 bg-ember-400 rounded-r" /> : null}
                <Icon className="w-4 h-4" />
                <span className="text-[9px] font-mono uppercase tracking-wider">{t.label}</span>
                {t.id === 'keyframes' && keyframes.length > 0 ? (
                  <span className="absolute top-1 right-1 px-1 py-0 text-[9px] leading-tight rounded bg-ember-500/40 text-ember-100">
                    {keyframes.length}
                  </span>
                ) : null}
              </button>
            );
          })}
        </aside>

        {/* Center column: stage + timeline + transport */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 relative bg-black min-h-0 flex items-center justify-center">
            <canvas
              ref={canvasRef}
              className="max-w-full max-h-full"
              style={{ aspectRatio: aspect.replace(':', ' / ') }}
              onPointerDown={handleCanvasShiftClick}
            />

            {/* Corner badge on the preview itself — unmistakable low-res notice */}
            {phase === 'ready' && video && (
              <div
                className="absolute top-3 left-3 z-10 pointer-events-none flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-md"
                style={{
                  background: 'rgba(10,14,26,0.75)',
                  border: '1px solid rgba(245,158,11,0.45)',
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-[10px] font-display font-semibold text-amber-200 uppercase tracking-[0.18em]">
                  Low-res preview · clean 4K with purchase
                </span>
              </div>
            )}

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
                    {exportSizeMB} MB · {paywallTier === 'clean' ? 'clean · paid' : 'watermarked · preview'}
                  </div>
                </div>
                <a
                  href={downloadBlobUrl}
                  download={`skystock-${id || 'edit'}-${aspect.replace(':', 'x')}${paywallTier === 'clean' ? '-clean' : ''}.${downloadExt}`}
                  className="btn-ember text-sm px-5 py-2.5"
                >
                  <Download className="w-4 h-4" /> Download
                </a>
                {paywallTier === 'free' ? (
                  <button
                    onClick={() => { setPaywallTier('clean'); setPaywallOpen(true); }}
                    className="btn-ghost text-xs"
                    title={`Re-render clean (no watermark) for $${CLEAN_EXPORT_PRICE.toFixed(2)}`}
                  >
                    Remove watermark — ${CLEAN_EXPORT_PRICE.toFixed(2)}
                  </button>
                ) : null}
                <button onClick={() => setPhase('ready')} className="btn-ghost text-xs">
                  Edit more
                </button>
              </div>
            ) : null}
          </div>

          {/* Timeline: scrub + trim handles + keyframe markers */}
          {duration > 0 ? (
            <Timeline
              duration={duration}
              playhead={playhead}
              trimIn={trimIn}
              trimOut={trimOut}
              keyframes={keyframes}
              disabled={phase === 'exporting'}
              onSeek={seekTo}
              onTrimChange={(a, b) => { setTrimIn(a); setTrimOut(b); }}
              onDeleteKeyframe={deleteKeyframe}
              onMoveKeyframe={moveKeyframe}
            />
          ) : null}

          {/* Music track bar — visible whenever a track is loaded */}
          {musicName ? (
            <MusicTrackBar
              name={musicName}
              playing={playing}
              muted={musicMuted}
              volume={musicVolume}
              onMuteToggle={() => setMusicMuted(m => !m)}
              onVolumeChange={setMusicVolume}
              onRemove={removeMusic}
              onReplace={() => setMusicPickerOpen(true)}
            />
          ) : null}

          {/* Transport bar (compact, under timeline) */}
          <div className="px-4 h-10 flex items-center gap-2 border-t border-sky-800/30 flex-shrink-0 bg-sky-950/30">
          <button
            onClick={togglePlay}
            disabled={phase !== 'ready'}
            className="flex-shrink-0 w-8 h-8 rounded-md flex items-center justify-center hover:bg-sky-800/40 disabled:opacity-40 transition-colors"
            title={playing ? 'Pause' : 'Play'}
          >
            {playing ? <Pause className="w-4 h-4 text-sky-200" /> : <Play className="w-4 h-4 text-sky-200" />}
          </button>
          <div className="font-mono text-xs text-sky-400 tabular-nums flex-shrink-0 flex items-baseline gap-1.5">
            <span className="text-white">{formatTimecode(playhead, 30)}</span>
            <span className="text-sky-600">/</span>
            <span>{formatTimecode(duration, 30)}</span>
          </div>
          <button
            onClick={() => sceneRef.current?.resetFrame()}
            disabled={phase !== 'ready'}
            className="flex-shrink-0 w-8 h-8 rounded-md flex items-center justify-center hover:bg-sky-800/40 disabled:opacity-40 transition-colors"
            title="Reset drag + zoom to the preset's default"
          >
            <RotateCcw className="w-3.5 h-3.5 text-sky-300" />
          </button>
          <div className="w-px h-5 bg-sky-800/50 mx-1 flex-shrink-0" />
          {/* Aspect ratio segmented control */}
          <div className="flex items-center rounded-md bg-sky-900/40 p-0.5 flex-shrink-0">
            {([
              { id: '16:9' as const, Icon: Monitor,    title: '16:9 · YouTube' },
              { id: '9:16' as const, Icon: Smartphone, title: '9:16 · TikTok / Reels / Shorts' },
              { id: '1:1'  as const, Icon: Square,     title: '1:1 · Instagram' },
            ]).map(a => (
              <button
                key={a.id}
                onClick={() => setAspect(a.id)}
                title={a.title}
                className={
                  'px-2 h-6 rounded flex items-center justify-center transition-colors ' +
                  (aspect === a.id
                    ? 'bg-ember-500/25 text-ember-300'
                    : 'text-sky-500 hover:text-sky-300')
                }
              >
                <a.Icon className="w-3.5 h-3.5" />
              </button>
            ))}
          </div>
          <div className="flex-1" />
          <div className="text-[11px] text-sky-600 font-mono hidden md:block">
            Drag to reframe · scroll to zoom · shift-click to track
          </div>
        </div>
        {/* End center column */}
        </div>

        {/* Right property sidebar */}
        <aside className="w-[320px] border-l border-sky-800/30 bg-sky-950/40 flex flex-col flex-shrink-0 overflow-hidden">
          <div className="px-4 h-10 flex items-center border-b border-sky-800/30 flex-shrink-0">
            <h3 className="font-display font-semibold text-xs uppercase tracking-wider text-ember-400">
              {activeTab === 'motion'     ? 'Motion'
              : activeTab === 'lens'      ? 'Lens'
              : activeTab === 'speed'     ? 'Speed'
              : activeTab === 'color'     ? 'Color'
              : activeTab === 'text'      ? 'Text'
              : activeTab === 'keyframes' ? 'Keyframes'
              : ''}
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {activeTab === 'motion' ? (
            <div className="space-y-3">
              {keyframes.length > 0 ? (
                <div className="rounded-md bg-ember-500/10 border border-ember-500/30 p-2.5 text-[11px] text-ember-200 leading-relaxed">
                  <div className="font-medium mb-1">Keyframes are driving the camera</div>
                  <div className="text-ember-300/70">
                    {keyframes.length} keyframe{keyframes.length === 1 ? '' : 's'} set — motion preset below is ignored until you clear them.
                  </div>
                  <button
                    onClick={() => setActiveTab('keyframes')}
                    className="mt-1.5 text-ember-300 hover:text-ember-100 underline text-[11px]"
                  >
                    Manage keyframes →
                  </button>
                </div>
              ) : null}
              {/* Motion preset tiles — visual thumbnails per DJI Studio's camera motion picker */}
              <div className="text-[10px] font-mono uppercase text-sky-500 tracking-wider">Camera Motion</div>
              <div className="grid grid-cols-2 gap-2">
                {PRESETS.map(p => {
                  const active = preset === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setPreset(p.id)}
                      disabled={phase !== 'ready'}
                      title={p.description}
                      className={`relative aspect-[4/3] rounded-lg overflow-hidden text-left transition-all ${
                        active ? 'ring-2 ring-ember-400 scale-[1.02]' : 'ring-1 ring-sky-800/40 hover:ring-sky-600/60'
                      }`}
                      style={{ background: '#0a0e1a' }}
                    >
                      <MotionPresetThumb presetId={p.id} />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                      <div className="absolute bottom-1.5 left-2 right-2">
                        <div className="text-[11px] font-display font-bold text-white leading-none drop-shadow-lg">{p.label}</div>
                      </div>
                      {active && (
                        <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-ember-400 shadow-[0_0_8px_rgba(249,115,22,0.8)]" />
                      )}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-sky-500 leading-relaxed">
                {PRESETS.find(p => p.id === preset)?.description}
              </p>
              <div className="pt-3 border-t border-sky-800/30">
                <button
                  onClick={() => sceneRef.current?.resetFrame()}
                  disabled={phase !== 'ready'}
                  className="btn-ghost text-xs w-full justify-center disabled:opacity-40"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset framing
                </button>
                <p className="text-[11px] text-sky-600 mt-2 leading-relaxed">
                  Drag the viewport to reframe · scroll to zoom · shift-click to track a subject.
                </p>
              </div>
            </div>
          ) : null}

          {activeTab === 'lens' ? (
            <div className="space-y-4">
              {/* Stabilisation toggles — RockSteady + Horizon Leveling, DJI-style */}
              <div className="rounded-lg border border-sky-800/40 bg-sky-950/40 p-3 space-y-2.5">
                <div className="text-[10px] font-mono uppercase text-sky-500 tracking-wider">Stabilisation</div>
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-xs text-sky-200 font-display">RockSteady</span>
                  <span className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${rockSteady ? 'bg-ember-500' : 'bg-sky-800'}`}
                    onClick={() => setRockSteady(!rockSteady)}
                  >
                    <span className={`inline-block h-3 w-3 rounded-full bg-white transition-transform ${rockSteady ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                  </span>
                </label>
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-xs text-sky-200 font-display">Horizon Leveling</span>
                  <span className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${horizonLevel ? 'bg-ember-500' : 'bg-sky-800'}`}
                    onClick={() => setHorizonLevel(!horizonLevel)}
                  >
                    <span className={`inline-block h-3 w-3 rounded-full bg-white transition-transform ${horizonLevel ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                  </span>
                </label>
              </div>

              {/* Lens tile grid — visual thumbnails with gradient per projection */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[10px] font-mono uppercase text-sky-500 tracking-wider">Manual Framing</div>
                  <button
                    onClick={() => sceneRef.current?.resetFrame()}
                    className="text-[10px] font-mono text-sky-500 hover:text-ember-300 transition-colors"
                    title="Re-center yaw/pitch/zoom"
                  >
                    RESET
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {LENSES.map(l => {
                    const active = lens === l.id;
                    const grad = l.id === 'fpv'       ? 'linear-gradient(135deg,#f97316,#7c2d12)'
                               : l.id === 'wide'      ? 'linear-gradient(135deg,#7dd3fc,#1e3a8a)'
                               : l.id === 'ultraWide' ? 'linear-gradient(135deg,#38bdf8,#312e81)'
                               : l.id === 'asteroid'  ? 'radial-gradient(circle at 50% 75%,#15803d 0%,#713f12 45%,#0a0e1a 85%)'
                               : /* rabbitHole */       'radial-gradient(circle at 50% 30%,#38bdf8 0%,#1e3a8a 60%,#0a0e1a 90%)';
                    return (
                      <button
                        key={l.id}
                        onClick={() => setLens(l.id)}
                        disabled={phase !== 'ready'}
                        className={`relative aspect-[16/10] rounded-lg overflow-hidden text-left transition-all ${
                          active ? 'ring-2 ring-ember-400 scale-[1.02]' : 'ring-1 ring-sky-800/40 hover:ring-sky-600/60'
                        }`}
                        style={{ background: grad }}
                      >
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                        <div className="absolute bottom-1.5 left-2 right-2">
                          <div className="text-[11px] font-display font-bold text-white leading-none drop-shadow-lg">{l.label}</div>
                          <div className="text-[9px] font-mono text-white/70 mt-0.5">FOV {l.fov}°</div>
                        </div>
                        {active && (
                          <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-ember-400 shadow-[0_0_8px_rgba(249,115,22,0.8)]" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Zoom slider with angle readout */}
              <div className="rounded-lg border border-sky-800/40 bg-sky-950/40 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase text-sky-500 tracking-wider">Zoom</span>
                  <span className="text-xs font-mono text-ember-300 tabular-nums">{camReadout.fovDeg.toFixed(1)}°</span>
                </div>
                <input
                  type="range"
                  min={0.5}
                  max={2}
                  step={0.01}
                  value={camReadout.zoom}
                  onChange={(e) => {
                    const z = Number(e.target.value);
                    const s = sceneRef.current;
                    if (s && (s as any).setZoom) (s as any).setZoom(z);
                  }}
                  className="w-full accent-ember-500"
                />
              </div>

              {/* Live camera telemetry readouts */}
              <div className="rounded-lg border border-sky-800/40 bg-sky-950/40 p-3 grid grid-cols-2 gap-x-3 gap-y-2">
                {[
                  { label: 'FOV',        value: `${camReadout.fovDeg.toFixed(1)}°`, color: '#7dd3fc' },
                  { label: 'Correction', value: camReadout.zoom.toFixed(2),         color: '#f97316' },
                  { label: 'Pan',        value: `${camReadout.yawDeg.toFixed(1)}°`, color: '#7dd3fc' },
                  { label: 'Tilt',       value: `${camReadout.pitchDeg.toFixed(1)}°`, color: '#7dd3fc' },
                  { label: 'Roll',       value: `${camReadout.rollDeg.toFixed(1)}°`, color: '#7dd3fc' },
                ].map(r => (
                  <div key={r.label}>
                    <div className="text-[9px] font-mono uppercase text-sky-600 tracking-wider leading-none">{r.label}</div>
                    <div className="text-xs font-mono tabular-nums mt-0.5" style={{ color: r.color }}>{r.value}</div>
                  </div>
                ))}
              </div>

              <p className="text-[11px] text-sky-500 leading-relaxed">
                {LENSES.find(l => l.id === lens)?.description}
              </p>
            </div>
          ) : null}

          {activeTab === 'speed' ? (
            <div className="space-y-3">
              <div className="text-[10px] font-mono uppercase text-sky-500 tracking-wider">Rate</div>
              <div className="grid grid-cols-5 gap-1.5">
                {[0.25, 0.5, 1, 2, 4].map(s => (
                  <button
                    key={s}
                    onClick={() => setSpeed(s)}
                    disabled={phase !== 'ready'}
                    className={
                      'py-2 rounded-md text-xs font-mono transition-all ' +
                      (speed === s
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-sky-900/30 text-sky-400 border border-sky-800/30 hover:bg-sky-800/40')
                    }
                  >
                    {s}×
                  </button>
                ))}
              </div>
              <div>
                <input
                  type="range" min={0.1} max={4} step={0.05}
                  value={speed}
                  onChange={(e) => setSpeed(Number(e.target.value))}
                  className="w-full accent-emerald-500"
                />
                <div className="flex justify-between text-[10px] font-mono text-sky-600 mt-1">
                  <span>0.1×</span><span>1×</span><span>4×</span>
                </div>
              </div>
              <p className="text-[11px] text-sky-500 leading-relaxed">
                {speed === 1 ? 'Real-time — original speed.' : speed < 1 ? `Slow-motion — ${(1 / speed).toFixed(2)}× dilation.` : `Hyperlapse — ${speed}× compression.`} Bakes into export.
              </p>
            </div>
          ) : null}

          {activeTab === 'color' ? (
            <div className="space-y-3">
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const v = videoElRef.current;
                    if (!v) return;
                    const auto = computeAutoColor(v, color.dLogIntensity > 0);
                    setColor({ ...color, ...auto, dLogIntensity: auto.dLogM ? 1 : color.dLogIntensity });
                  }}
                  disabled={phase !== 'ready'}
                  className="flex-1 px-3 py-2 rounded-md bg-ember-500/20 text-ember-300 border border-ember-500/40 hover:bg-ember-500/30 text-xs font-medium transition-colors disabled:opacity-40"
                >
                  Auto
                </button>
                <button
                  onClick={() => setColor(DEFAULT_COLOR)}
                  className="btn-ghost text-xs"
                  title="Reset all"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="space-y-2 pt-2 border-t border-sky-800/30">
                <div className="text-[10px] font-mono uppercase text-sky-500 tracking-wider">Log profile</div>
                <label className="flex items-center gap-2 text-xs">
                  <span className="text-sky-300 w-16 font-medium">D-Log M</span>
                  <input
                    type="range" min={0} max={1} step={0.01}
                    value={color.dLogIntensity}
                    onChange={(e) => setColor({ ...color, dLogIntensity: Number(e.target.value) })}
                    className="flex-1 accent-sky-500"
                  />
                  <span className="font-mono text-sky-500 tabular-nums w-8 text-right">{Math.round(color.dLogIntensity * 100)}%</span>
                </label>
              </div>
              <div className="space-y-2 pt-2 border-t border-sky-800/30">
                <div className="text-[10px] font-mono uppercase text-sky-500 tracking-wider">Light</div>
                {([
                  { key: 'exposure',    label: 'Exposure',   min: -2, max: 2, step: 0.05 },
                  { key: 'contrast',    label: 'Contrast',   min:  0, max: 2, step: 0.05 },
                  { key: 'highlights',  label: 'Highlights', min: -1, max: 1, step: 0.05 },
                  { key: 'shadows',     label: 'Shadows',    min: -1, max: 1, step: 0.05 },
                ] as const).map(s => (
                  <label key={s.key} className="flex items-center gap-2 text-xs">
                    <span className="text-sky-300 w-16">{s.label}</span>
                    <input type="range" min={s.min} max={s.max} step={s.step} value={color[s.key]}
                      onChange={(e) => setColor({ ...color, [s.key]: Number(e.target.value) })}
                      className="flex-1 accent-ember-500" />
                    <span className="font-mono text-sky-500 tabular-nums w-10 text-right">
                      {color[s.key] >= 0 ? '+' : ''}{color[s.key].toFixed(2)}
                    </span>
                  </label>
                ))}
              </div>
              <div className="space-y-2 pt-2 border-t border-sky-800/30">
                <div className="text-[10px] font-mono uppercase text-sky-500 tracking-wider">Color</div>
                {([
                  { key: 'temperature', label: 'Temp',       min: -1, max: 1, step: 0.05 },
                  { key: 'tint',        label: 'Tint',       min: -1, max: 1, step: 0.05 },
                  { key: 'saturation',  label: 'Saturation', min:  0, max: 2, step: 0.05 },
                  { key: 'vibrance',    label: 'Vibrance',   min: -1, max: 1, step: 0.05 },
                ] as const).map(s => (
                  <label key={s.key} className="flex items-center gap-2 text-xs">
                    <span className="text-sky-300 w-16">{s.label}</span>
                    <input type="range" min={s.min} max={s.max} step={s.step} value={color[s.key]}
                      onChange={(e) => setColor({ ...color, [s.key]: Number(e.target.value) })}
                      className="flex-1 accent-ember-500" />
                    <span className="font-mono text-sky-500 tabular-nums w-10 text-right">
                      {color[s.key] >= 0 ? '+' : ''}{color[s.key].toFixed(2)}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          {activeTab === 'text' ? (
            <div className="space-y-3">
              <div className="text-[10px] font-mono uppercase text-sky-500 tracking-wider">Title card</div>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value.slice(0, 60))}
                placeholder="Title card text…"
                maxLength={60}
                className="w-full h-9 px-3 rounded bg-sky-900/40 border border-sky-800/40 text-sm text-sky-100 placeholder-sky-600 focus:outline-none focus:border-ember-500/50"
              />
              <label className="flex items-center gap-2 text-xs">
                <span className="text-sky-300 w-16">Duration</span>
                <input type="range" min={1} max={10} step={0.5}
                  value={titleDuration}
                  onChange={(e) => setTitleDuration(Number(e.target.value))}
                  className="flex-1 accent-ember-500" />
                <span className="font-mono text-sky-500 tabular-nums w-10 text-right">{titleDuration.toFixed(1)}s</span>
              </label>
              <div>
                <div className="text-[10px] font-mono uppercase text-sky-500 tracking-wider mb-1.5">Position</div>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['top', 'center', 'bottom'] as const).map(p => (
                    <button
                      key={p}
                      onClick={() => setTitlePosition(p)}
                      className={
                        'py-2 text-xs rounded transition-colors capitalize ' +
                        (titlePosition === p
                          ? 'bg-ember-500/20 text-ember-300 border border-ember-500/40'
                          : 'bg-sky-900/30 text-sky-400 border border-sky-800/30 hover:bg-sky-800/40')
                      }
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              {title ? (
                <button onClick={() => setTitle('')} className="btn-ghost text-xs w-full justify-center">
                  <X className="w-3.5 h-3.5" /> Clear
                </button>
              ) : null}
              <p className="text-[11px] text-sky-500 leading-relaxed pt-2 border-t border-sky-800/30">
                {title ? `Shows for the first ${titleDuration.toFixed(1)}s of the trim window, with a 0.3s fade in and out.` : 'Type a title to add a card overlay at the start of the clip.'}
              </p>
            </div>
          ) : null}

          {activeTab === 'keyframes' ? (
            <div className="space-y-3">
              <button
                onClick={addKeyframe}
                disabled={phase !== 'ready'}
                className="w-full px-3 py-2 rounded-md bg-ember-500/20 text-ember-300 border border-ember-500/40 hover:bg-ember-500/30 text-sm font-medium transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
              >
                <Diamond className="w-3.5 h-3.5 fill-current" />
                Add keyframe @ {formatTime(playhead)}
              </button>
              <label className="flex items-center gap-2 text-xs">
                <span className="text-sky-300 w-20">Transition</span>
                <select
                  value={defaultEasing}
                  onChange={(e) => setDefaultEasing(e.target.value as EasingCurve)}
                  className="flex-1 h-8 px-2 bg-sky-900/40 border border-sky-800/40 rounded text-xs text-sky-200 focus:outline-none focus:border-ember-500/50"
                >
                  <option value="linear">Linear</option>
                  <option value="smooth">Smooth (S-curve)</option>
                  <option value="ease-in">Ease in</option>
                  <option value="ease-out">Ease out</option>
                  <option value="hold">Hold</option>
                </select>
              </label>
              <div className="pt-2 border-t border-sky-800/30">
                <div className="text-[10px] font-mono uppercase text-sky-500 tracking-wider mb-2">
                  {keyframes.length} keyframe{keyframes.length === 1 ? '' : 's'}
                </div>
                {keyframes.length === 0 ? (
                  <p className="text-[11px] text-sky-600 leading-relaxed">
                    Shift-click the viewport to track a subject, or use the button above to capture the current frame.
                  </p>
                ) : (
                  <div className="space-y-1 max-h-60 overflow-y-auto">
                    {keyframes.map(kf => (
                      <div key={kf.t} className="flex items-center gap-2 px-2 py-1.5 rounded bg-sky-900/30 border border-sky-800/30">
                        <Diamond className="w-2.5 h-2.5 text-emerald-400 fill-current flex-shrink-0" />
                        <button
                          onClick={() => seekTo(kf.t)}
                          className="font-mono text-xs text-sky-200 tabular-nums flex-shrink-0 hover:text-ember-300"
                        >
                          {formatTime(kf.t)}
                        </button>
                        <select
                          value={kf.ease ?? 'smooth'}
                          onChange={(e) => setKeyframeEasing(kf.t, e.target.value as EasingCurve)}
                          className="flex-1 min-w-0 h-6 px-1 bg-sky-950 border border-sky-800/50 rounded text-[10px] text-sky-300 focus:outline-none focus:border-ember-500/40"
                        >
                          <option value="linear">Linear</option>
                          <option value="smooth">Smooth</option>
                          <option value="ease-in">Ease in</option>
                          <option value="ease-out">Ease out</option>
                          <option value="hold">Hold</option>
                        </select>
                        <button
                          onClick={() => deleteKeyframe(kf.t)}
                          className="text-sky-600 hover:text-red-400 flex-shrink-0"
                          title="Delete keyframe"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {keyframes.length > 0 ? (
                <button
                  onClick={clearKeyframes}
                  className="btn-ghost text-xs w-full justify-center"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear all
                </button>
              ) : null}
            </div>
          ) : null}
          </div>
        </aside>
      {/* End main workspace */}
      </div>

      {/* Export paywall modal */}
      {paywallOpen ? (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setPaywallOpen(false)}>
          <div
            className="bg-sky-950 border border-sky-800/50 rounded-xl shadow-2xl max-w-lg w-full flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-sky-800/50">
              <div className="flex items-center gap-2">
                <Download className="w-4 h-4 text-ember-400" />
                <h3 className="font-display font-semibold text-sm text-white">Export your edit</h3>
              </div>
              <button onClick={() => setPaywallOpen(false)} className="text-sky-500 hover:text-sky-200">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <button
                onClick={() => setPaywallTier('free')}
                className={
                  'w-full text-left p-4 rounded-xl border transition-colors ' +
                  (paywallTier === 'free'
                    ? 'bg-sky-500/10 border-sky-400/50'
                    : 'bg-sky-900/30 border-sky-800/30 hover:border-sky-700/50')
                }
              >
                <div className="flex items-start gap-3">
                  <div className="w-4 h-4 mt-0.5 rounded-full border-2 border-sky-400 flex-shrink-0 flex items-center justify-center">
                    {paywallTier === 'free' ? <div className="w-2 h-2 rounded-full bg-sky-400" /> : null}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-baseline justify-between">
                      <div className="font-semibold text-sky-100">Preview export</div>
                      <div className="text-sm font-mono text-sky-500">Free</div>
                    </div>
                    <div className="text-xs text-sky-500 mt-1">
                      {ASPECT_DIMS[aspect].label} MP4 · watermarked "skystock.pages.dev"
                    </div>
                    <div className="text-[11px] text-sky-600 mt-2">
                      Great for sharing on socials with attribution back to SkyStock.
                    </div>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setPaywallTier('clean')}
                className={
                  'w-full text-left p-4 rounded-xl border transition-colors ' +
                  (paywallTier === 'clean'
                    ? 'bg-ember-500/10 border-ember-400/50'
                    : 'bg-sky-900/30 border-sky-800/30 hover:border-sky-700/50')
                }
              >
                <div className="flex items-start gap-3">
                  <div className="w-4 h-4 mt-0.5 rounded-full border-2 border-ember-400 flex-shrink-0 flex items-center justify-center">
                    {paywallTier === 'clean' ? <div className="w-2 h-2 rounded-full bg-ember-400" /> : null}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-baseline justify-between">
                      <div className="font-semibold text-ember-200">Clean export</div>
                      <div className="text-sm font-mono text-ember-300">${CLEAN_EXPORT_PRICE.toFixed(2)} AUD</div>
                    </div>
                    <div className="text-xs text-sky-400 mt-1">
                      {ASPECT_DIMS[aspect].label} MP4 · no watermark · your edit, fully yours.
                    </div>
                    <div className="text-[11px] text-sky-600 mt-2">
                      One-time purchase for this specific edit. Use the clean file commercially.
                    </div>
                  </div>
                </div>
              </button>

              {paywallTier === 'clean' ? (
                <div className="pt-2">
                  <label className="text-[10px] font-mono uppercase text-sky-500 tracking-wider">Delivery email</label>
                  <input
                    type="email"
                    value={paywallEmail}
                    onChange={(e) => setPaywallEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="mt-1 w-full h-9 px-3 rounded bg-sky-900/40 border border-sky-800/40 text-sm text-sky-100 placeholder-sky-600 focus:outline-none focus:border-ember-500/50"
                  />
                  <div className="text-[11px] text-sky-600 mt-1.5">
                    We'll mail you the clean MP4 once payment clears.
                  </div>
                </div>
              ) : null}
            </div>
            <div className="px-5 py-3 border-t border-sky-800/50 flex items-center justify-between">
              <button onClick={() => setPaywallOpen(false)} className="btn-ghost text-xs">
                Cancel
              </button>
              <button
                onClick={() => {
                  if (paywallTier === 'clean' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(paywallEmail)) return;
                  setPaywallOpen(false);
                  runExport(paywallTier);
                }}
                disabled={paywallTier === 'clean' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(paywallEmail)}
                className="btn-ember text-sm px-5 py-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {paywallTier === 'free' ? 'Render watermarked' : `Pay $${CLEAN_EXPORT_PRICE.toFixed(2)} + render`}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Music picker modal */}
      {musicPickerOpen ? (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setMusicPickerOpen(false)}>
          <div
            className="bg-sky-950 border border-sky-800/50 rounded-xl shadow-2xl max-w-lg w-full max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-sky-800/50">
              <div className="flex items-center gap-2">
                <Music className="w-4 h-4 text-ember-400" />
                <h3 className="font-display font-semibold text-sm text-white">Add music</h3>
              </div>
              <button onClick={() => setMusicPickerOpen(false)} className="text-sky-500 hover:text-sky-200">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1">
              <div className="px-5 py-2 text-[10px] font-mono uppercase tracking-wider text-sky-500">
                Stock library
              </div>
              {STOCK_MUSIC.map(t => (
                <button
                  key={t.id}
                  onClick={() => pickStockTrack(t)}
                  className="w-full flex items-center gap-3 px-5 py-3 hover:bg-sky-900/40 text-left transition-colors border-b border-sky-800/20"
                >
                  <div className="w-8 h-8 rounded-md bg-gradient-to-br from-sky-500/30 to-ember-500/20 flex items-center justify-center flex-shrink-0">
                    <Music className="w-4 h-4 text-sky-300" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-sky-100 truncate">{t.title}</div>
                    <div className="text-[11px] text-sky-500 truncate">{t.mood}{t.attribution ? ` · ${t.attribution}` : ''}</div>
                  </div>
                  <span className="text-[10px] font-mono text-sky-600 flex-shrink-0">Use →</span>
                </button>
              ))}
            </div>
            <div className="px-5 py-3 border-t border-sky-800/50 flex items-center justify-between">
              <label className="btn-ghost text-xs cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                Upload your own
                <input
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) { loadMusic(f); setMusicPickerOpen(false); }
                    e.target.value = '';
                  }}
                />
              </label>
              <div className="text-[11px] text-sky-600 font-mono">
                Plays through preview · bakes into export
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Small vignette that visually represents each motion preset — used as the
 *  thumbnail background on the Motion preset tiles so the editor feels like a
 *  real preset picker (DJI Mimo / After Effects vibe) instead of labelled rectangles. */
function MotionPresetThumb({ presetId }: { presetId: PresetName }) {
  if (presetId === 'static') {
    return (
      <svg viewBox="0 0 100 75" className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="mp-static" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0f172a" /><stop offset="1" stopColor="#1e293b" />
          </linearGradient>
        </defs>
        <rect width="100" height="75" fill="url(#mp-static)" />
        <rect x="35" y="27" width="30" height="22" fill="none" stroke="#7dd3fc" strokeWidth="1.2" />
        <circle cx="50" cy="38" r="1.5" fill="#f97316" />
      </svg>
    );
  }
  if (presetId === 'orbit') {
    return (
      <svg viewBox="0 0 100 75" className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid slice">
        <defs>
          <radialGradient id="mp-orbit" cx="50%" cy="60%" r="70%">
            <stop offset="0" stopColor="#7dd3fc" stopOpacity=".4" />
            <stop offset="1" stopColor="#0a0e1a" />
          </radialGradient>
        </defs>
        <rect width="100" height="75" fill="url(#mp-orbit)" />
        <ellipse cx="50" cy="48" rx="34" ry="10" fill="none" stroke="#f97316" strokeWidth="2" />
        <ellipse cx="50" cy="48" rx="26" ry="6" fill="none" stroke="#7dd3fc" strokeWidth="1" strokeDasharray="2 2" opacity=".7" />
        <circle cx="84" cy="46" r="2.5" fill="#f97316" />
        <path d="M 80 40 L 86 42 L 82 48 Z" fill="#f97316" />
      </svg>
    );
  }
  if (presetId === 'flyThrough') {
    return (
      <svg viewBox="0 0 100 75" className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="mp-fly" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#1e3a8a" /><stop offset="1" stopColor="#7c2d12" />
          </linearGradient>
        </defs>
        <rect width="100" height="75" fill="url(#mp-fly)" />
        {Array.from({ length: 6 }).map((_, i) => (
          <line key={i} x1={10 + i * 14} y1={20 + i * 6} x2={30 + i * 14} y2={25 + i * 6}
            stroke="#fdba74" strokeWidth="1.4" opacity={0.3 + i * 0.1} />
        ))}
        <path d="M 50 38 L 70 30 L 70 34 L 82 34 L 82 42 L 70 42 L 70 46 Z" fill="#f97316" />
      </svg>
    );
  }
  if (presetId === 'reveal') {
    return (
      <svg viewBox="0 0 100 75" className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="mp-rev" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#422006" /><stop offset=".5" stopColor="#b45309" /><stop offset="1" stopColor="#7dd3fc" />
          </linearGradient>
        </defs>
        <rect width="100" height="75" fill="url(#mp-rev)" />
        <path d="M 50 60 L 50 25" stroke="#ffffff" strokeWidth="2" />
        <path d="M 45 30 L 50 22 L 55 30 Z" fill="#ffffff" />
      </svg>
    );
  }
  // reverseReveal
  return (
    <svg viewBox="0 0 100 75" className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="mp-revr" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7dd3fc" /><stop offset=".5" stopColor="#b45309" /><stop offset="1" stopColor="#422006" />
        </linearGradient>
      </defs>
      <rect width="100" height="75" fill="url(#mp-revr)" />
      <path d="M 50 15 L 50 50" stroke="#ffffff" strokeWidth="2" />
      <path d="M 45 45 L 50 53 L 55 45 Z" fill="#ffffff" />
    </svg>
  );
}

function formatTime(s: number): string {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const rem = s - m * 60;
  return `${m}:${rem.toFixed(1).padStart(4, '0')}`;
}

/** HH:MM:SS:FF timecode — drop-frame-less. fps defaults to 30. */
function formatTimecode(s: number, fps = 30): string {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const totalFrames = Math.round(s * fps);
  const ff = totalFrames % fps;
  const totalSeconds = Math.floor(totalFrames / fps);
  const ss = totalSeconds % 60;
  const mm = Math.floor(totalSeconds / 60) % 60;
  const hh = Math.floor(totalSeconds / 3600);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(hh)}:${pad(mm)}:${pad(ss)}:${pad(ff)}`;
}

interface TimelineProps {
  duration: number;
  playhead: number;
  trimIn: number;
  trimOut: number;
  keyframes: Keyframe[];
  disabled: boolean;
  onSeek: (sec: number) => void;
  onTrimChange: (a: number, b: number) => void;
  onDeleteKeyframe: (t: number) => void;
  onMoveKeyframe: (fromT: number, toT: number) => void;
}

function Timeline({ duration, playhead, trimIn, trimOut, keyframes, disabled, onSeek, onTrimChange, onDeleteKeyframe, onMoveKeyframe }: TimelineProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<'in' | 'out' | 'scrub' | { kind: 'kf'; origT: number; currentT: number; moved: boolean } | null>(null);

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
    if (typeof mode === 'object' && mode.kind === 'kf') {
      const startX = 0; // unused, kept for clarity
      void startX;
      mode.moved = true;
      const newT = Math.max(0, Math.min(duration, t));
      onMoveKeyframe(mode.currentT, newT);
      mode.currentT = newT;
      onSeek(newT);
      return;
    }
    if (mode === 'scrub') onSeek(t);
    if (mode === 'in') onTrimChange(Math.max(0, Math.min(t, trimOut - 0.1)), trimOut);
    if (mode === 'out') onTrimChange(trimIn, Math.max(trimIn + 0.1, Math.min(duration, t)));
  };
  const onPointerUp = () => {
    const mode = draggingRef.current;
    if (typeof mode === 'object' && mode && mode.kind === 'kf' && !mode.moved) {
      // Click without drag → seek to the keyframe
      onSeek(mode.origT);
    }
    draggingRef.current = null;
  };

  const inPct = toPct(trimIn);
  const outPct = toPct(trimOut);
  const phPct = toPct(playhead);
  const trimLen = Math.max(0, trimOut - trimIn);

  return (
    <div className="px-4 pt-2 pb-2 border-t border-sky-800/30 bg-sky-950/40 flex-shrink-0">
      <div className="relative mb-1.5 h-3">
        <span className="absolute left-0 text-[10px] font-mono text-sky-700 tabular-nums">0:00</span>
        <span className="absolute left-1/2 -translate-x-1/2 text-[10px] font-mono text-sky-700 uppercase tracking-wider">
          {formatTime(trimLen)} clip
        </span>
        <span className="absolute right-0 text-[10px] font-mono text-sky-700 tabular-nums">{formatTime(duration)}</span>
      </div>
      <div
        ref={trackRef}
        className="relative h-8 bg-sky-900/50 rounded-md select-none cursor-pointer"
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
        {/* Keyframe diamonds — drag to move, click to seek, shift-click to delete */}
        {keyframes.map((kf) => (
          <div
            key={kf.t}
            className="absolute top-1/2 w-0 h-0 -translate-x-1/2 -translate-y-1/2 z-20 group"
            style={{ left: `${toPct(kf.t)}%` }}
            title={`${formatTime(kf.t)} (${kf.ease ?? 'smooth'}) — drag to move, click to seek, shift-click to delete`}
            onPointerDown={(e) => {
              if (disabled) return;
              e.stopPropagation();
              if (e.shiftKey) { onDeleteKeyframe(kf.t); return; }
              draggingRef.current = { kind: 'kf', origT: kf.t, currentT: kf.t, moved: false };
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            }}
          >
            <div className="w-3 h-3 bg-emerald-400 rotate-45 border border-emerald-100 shadow-lg cursor-ew-resize group-hover:scale-125 transition-transform" />
          </div>
        ))}
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

interface MusicTrackBarProps {
  name: string;
  playing: boolean;
  muted: boolean;
  volume: number;
  onMuteToggle: () => void;
  onVolumeChange: (v: number) => void;
  onRemove: () => void;
  onReplace: () => void;
}

function MusicTrackBar({ name, playing, muted, volume, onMuteToggle, onVolumeChange, onRemove, onReplace }: MusicTrackBarProps) {
  const BARS = 44;
  return (
    <div className="px-4 py-2 border-t border-sky-800/30 bg-gradient-to-r from-ember-950/20 via-sky-950/30 to-ember-950/20 flex items-center gap-3 flex-shrink-0">
      {/* Mute / icon */}
      <button
        onClick={onMuteToggle}
        className={`flex-shrink-0 w-8 h-8 rounded-md flex items-center justify-center transition-colors ${
          muted ? 'text-sky-600 hover:text-sky-400' : 'text-ember-400 hover:text-ember-300'
        }`}
        title={muted ? 'Unmute music' : 'Mute music'}
      >
        {muted ? <VolumeX className="w-4 h-4" /> : <Music className="w-4 h-4" />}
      </button>

      {/* Track name */}
      <div className="flex-shrink-0 max-w-[180px]">
        <div className="text-[10px] font-mono uppercase tracking-wider text-sky-500 leading-none mb-0.5">Track</div>
        <div className="text-xs font-display font-semibold text-sky-100 truncate leading-tight" title={name}>{name}</div>
      </div>

      {/* Waveform-ish bars */}
      <div className="flex-1 h-8 flex items-center gap-[2px] overflow-hidden px-2 rounded-md bg-sky-950/50 border border-ember-500/15">
        {Array.from({ length: BARS }).map((_, i) => {
          const base = 0.25 + 0.75 * Math.abs(Math.sin(i * 1.7 + Math.cos(i * 0.31) * 2));
          const h = Math.max(2, Math.round(base * 22));
          const delay = `${(i * 53) % 900}ms`;
          return (
            <div
              key={i}
              style={{
                height: `${h}px`,
                animationDelay: delay,
                animationDuration: `${600 + (i * 37) % 500}ms`,
              }}
              className={`w-[3px] rounded-full ${
                muted ? 'bg-sky-700/40' : playing ? 'bg-gradient-to-t from-ember-500 to-sky-300 animate-pulse' : 'bg-ember-500/40'
              }`}
            />
          );
        })}
      </div>

      {/* Volume slider */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <Volume2 className={`w-3.5 h-3.5 ${muted ? 'text-sky-700' : 'text-sky-400'}`} />
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={muted ? 0 : volume}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            onVolumeChange(v);
            if (muted && v > 0) onMuteToggle();
          }}
          className="w-20 accent-ember-500"
          title={`Volume ${Math.round((muted ? 0 : volume) * 100)}%`}
        />
        <span className="text-[10px] font-mono text-sky-500 w-7 text-right">
          {Math.round((muted ? 0 : volume) * 100)}%
        </span>
      </div>

      {/* Replace / Remove */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={onReplace}
          className="px-2 h-7 rounded-md text-[11px] font-display font-medium text-sky-300 hover:text-white hover:bg-sky-800/40 transition-colors"
          title="Replace with another track"
        >
          Change
        </button>
        <button
          onClick={onRemove}
          className="w-7 h-7 rounded-md flex items-center justify-center text-sky-500 hover:text-ember-300 hover:bg-sky-800/40 transition-colors"
          title="Remove music"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
