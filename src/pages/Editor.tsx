import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Download, Loader2, Play, Pause, Film, Wand2, Upload, RotateCcw, Aperture, Gauge, Diamond, Trash2, Music, X, Type, Palette } from 'lucide-react';
import { PRESETS, PresetName, LENSES, LensName, Keyframe, EasingCurve, ColorAdjust, DEFAULT_COLOR, TitlePosition, createScene, SceneHandle, pickSupportedMime, startExport, ExportHandle } from '../lib/editor';
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
  const [keyframes, setKeyframes] = useState<Keyframe[]>([]);
  const [musicName, setMusicName] = useState<string>('');
  const [title, setTitle] = useState<string>('');
  const [titleDuration, setTitleDuration] = useState<number>(3);
  const [titlePosition, setTitlePosition] = useState<TitlePosition>('center');
  const [color, setColor] = useState<ColorAdjust>(DEFAULT_COLOR);
  const [defaultEasing, setDefaultEasing] = useState<EasingCurve>('smooth');
  type TabId = 'motion' | 'lens' | 'speed' | 'keyframes' | 'color' | 'text';
  const [activeTab, setActiveTab] = useState<TabId>('motion');
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
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

  const deleteKeyframe = useCallback((t: number) => {
    setKeyframes(prev => prev.filter(k => k.t !== t));
  }, []);

  const moveKeyframe = useCallback((fromT: number, toT: number) => {
    setKeyframes(prev => {
      const next = prev.map(k => k.t === fromT ? { ...k, t: toT } : k);
      return next.sort((a, b) => a.t - b.t);
    });
  }, []);

  const clearKeyframes = useCallback(() => setKeyframes([]), []);

  const loadMusic = useCallback((file: File) => {
    // Clean up any previous audio
    audioElRef.current?.pause();
    if (audioElRef.current) audioElRef.current.src = '';
    audioCtxRef.current?.close().catch(() => {});

    const url = URL.createObjectURL(file);
    const audio = new Audio(url);
    audio.crossOrigin = 'anonymous';
    audio.loop = true;
    audio.preload = 'auto';
    audioElRef.current = audio;
    setMusicName(file.name);

    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const src = ctx.createMediaElementSource(audio);
    const dest = ctx.createMediaStreamDestination();
    src.connect(ctx.destination);  // speakers (preview)
    src.connect(dest);              // export stream
    audioCtxRef.current = ctx;
    audioDestRef.current = dest;

    const v = videoElRef.current;
    if (v && !v.paused) audio.play().catch(() => {});
  }, []);

  const removeMusic = useCallback(() => {
    audioElRef.current?.pause();
    if (audioElRef.current) audioElRef.current.src = '';
    audioCtxRef.current?.close().catch(() => {});
    audioElRef.current = null;
    audioCtxRef.current = null;
    audioDestRef.current = null;
    setMusicName('');
  }, []);

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
          <div className="font-display font-semibold text-sm truncate">
            {video?.title || (srcOverride ? 'Editor (dev preview)' : 'Editor')}
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
          <label className="btn-ghost text-xs cursor-pointer">
            <Music className="w-4 h-4" />
            Add music
            <input
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) loadMusic(f);
                e.target.value = '';
              }}
            />
          </label>
        )}
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

      {/* Unified toolbar: transport + tabs in one row */}
      <footer className="border-t border-sky-800/30 flex-shrink-0 bg-sky-950/30">
        <div className="px-4 h-11 flex items-center gap-2 border-b border-sky-800/30">
          <button
            onClick={togglePlay}
            disabled={phase !== 'ready'}
            className="flex-shrink-0 w-8 h-8 rounded-md flex items-center justify-center hover:bg-sky-800/40 disabled:opacity-40 transition-colors"
            title={playing ? 'Pause' : 'Play'}
          >
            {playing ? <Pause className="w-4 h-4 text-sky-200" /> : <Play className="w-4 h-4 text-sky-200" />}
          </button>
          <div className="font-mono text-xs text-sky-400 tabular-nums w-14 flex-shrink-0">
            {formatTime(playhead)}
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
                className={
                  'px-3 h-8 text-xs font-medium uppercase tracking-wider flex items-center gap-1.5 rounded-md transition-colors ' +
                  (active
                    ? 'text-ember-300 bg-ember-500/10'
                    : 'text-sky-500 hover:text-sky-300 hover:bg-sky-800/30')
                }
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
                {t.id === 'keyframes' && keyframes.length > 0 ? (
                  <span className="ml-0.5 px-1.5 py-0.5 text-[10px] leading-none rounded bg-ember-500/30 text-ember-200">
                    {keyframes.length}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <div className="px-4 h-12 flex items-center gap-2 overflow-x-auto">
          {activeTab === 'motion' ? (
            <>
              {PRESETS.map(p => (
                <button
                  key={p.id}
                  onClick={() => setPreset(p.id)}
                  disabled={phase !== 'ready'}
                  title={p.description}
                  className={
                    'px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex-shrink-0 ' +
                    (preset === p.id
                      ? 'bg-ember-500/20 text-ember-300 border border-ember-500/40'
                      : 'bg-sky-900/30 text-sky-300 border border-sky-800/30 hover:bg-sky-800/40')
                  }
                >
                  {p.label}
                </button>
              ))}
              <div className="flex-1" />
              <div className="text-[11px] text-sky-600 font-mono truncate">
                {PRESETS.find(p => p.id === preset)?.description}
              </div>
            </>
          ) : null}

          {activeTab === 'lens' ? (
            <>
              {LENSES.map(l => (
                <button
                  key={l.id}
                  onClick={() => setLens(l.id)}
                  disabled={phase !== 'ready'}
                  title={l.description}
                  className={
                    'px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex-shrink-0 ' +
                    (lens === l.id
                      ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                      : 'bg-sky-900/30 text-sky-400 border border-sky-800/30 hover:bg-sky-800/40')
                  }
                >
                  {l.label}
                </button>
              ))}
              <div className="flex-1" />
              <div className="text-[11px] text-sky-600 font-mono truncate">
                {LENSES.find(l => l.id === lens)?.description}
              </div>
            </>
          ) : null}

          {activeTab === 'speed' ? (
            <>
              {[0.25, 0.5, 1, 2, 4].map(s => (
                <button
                  key={s}
                  onClick={() => setSpeed(s)}
                  disabled={phase !== 'ready'}
                  className={
                    'px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all flex-shrink-0 font-mono ' +
                    (speed === s
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-sky-900/30 text-sky-400 border border-sky-800/30 hover:bg-sky-800/40')
                  }
                >
                  {s}×
                </button>
              ))}
              <div className="flex-1" />
              <div className="text-[11px] text-sky-600 font-mono">
                {speed === 1 ? 'Real-time' : speed < 1 ? 'Slow-motion' : 'Hyperlapse'} · bakes into export
              </div>
            </>
          ) : null}

          {activeTab === 'keyframes' ? (
            <>
              <button
                onClick={addKeyframe}
                disabled={phase !== 'ready'}
                className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex-shrink-0 bg-ember-500/20 text-ember-300 border border-ember-500/40 hover:bg-ember-500/30 disabled:opacity-40"
                title="Capture current frame at the playhead"
              >
                <Diamond className="w-3.5 h-3.5 fill-current" />
                Add @ {formatTime(playhead)}
              </button>
              <label className="text-[10px] text-sky-500 uppercase tracking-wider ml-2 flex-shrink-0">
                Transition
              </label>
              <select
                value={defaultEasing}
                onChange={(e) => setDefaultEasing(e.target.value as EasingCurve)}
                className="h-8 px-2 bg-sky-900/40 border border-sky-800/40 rounded text-xs text-sky-200 flex-shrink-0 focus:outline-none focus:border-ember-500/50"
                title="Easing curve for new keyframes (existing keyframes keep their own curve)"
              >
                <option value="linear">Linear</option>
                <option value="smooth">Smooth (S-curve)</option>
                <option value="ease-in">Ease in</option>
                <option value="ease-out">Ease out</option>
                <option value="hold">Hold</option>
              </select>
              {keyframes.length > 0 ? (
                <button
                  onClick={clearKeyframes}
                  disabled={phase !== 'ready'}
                  className="btn-ghost text-xs flex-shrink-0 disabled:opacity-40"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear
                </button>
              ) : null}
              <div className="flex-1" />
              <div className="text-[11px] text-sky-600 font-mono truncate">
                {keyframes.length === 0
                  ? 'No keyframes — preset drives the camera · Shift-click a diamond to delete'
                  : `${keyframes.length} keyframe${keyframes.length === 1 ? '' : 's'} · preset overridden · Shift-click to delete`}
              </div>
            </>
          ) : null}

          {activeTab === 'color' ? (
            <div className="flex items-center gap-5 flex-1">
              {([
                { key: 'exposure',    label: 'Exposure',   min: -2, max: 2, step: 0.05, def: 0 },
                { key: 'contrast',    label: 'Contrast',   min:  0, max: 2, step: 0.05, def: 1 },
                { key: 'saturation',  label: 'Saturation', min:  0, max: 2, step: 0.05, def: 1 },
                { key: 'temperature', label: 'Warm / Cool', min: -1, max: 1, step: 0.05, def: 0 },
              ] as const).map(s => (
                <label key={s.key} className="flex items-center gap-2 text-xs">
                  <span className="text-sky-400 w-20 flex-shrink-0">{s.label}</span>
                  <input
                    type="range"
                    min={s.min} max={s.max} step={s.step}
                    value={color[s.key]}
                    onChange={(e) => setColor({ ...color, [s.key]: Number(e.target.value) })}
                    className="w-24 accent-ember-500"
                  />
                  <span className="font-mono text-sky-500 tabular-nums w-10 text-right">
                    {color[s.key] >= 0 ? '+' : ''}{color[s.key].toFixed(2)}
                  </span>
                </label>
              ))}
              <button
                onClick={() => setColor(DEFAULT_COLOR)}
                className="btn-ghost text-xs flex-shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </button>
            </div>
          ) : null}

          {activeTab === 'text' ? (
            <div className="flex items-center gap-3 flex-1">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value.slice(0, 60))}
                placeholder="Title card text…"
                maxLength={60}
                className="h-8 px-3 flex-1 max-w-[320px] rounded bg-sky-900/40 border border-sky-800/40 text-sm text-sky-100 placeholder-sky-600 focus:outline-none focus:border-ember-500/50"
              />
              <label className="flex items-center gap-2 text-xs">
                <span className="text-sky-400">Duration</span>
                <input
                  type="range" min={1} max={10} step={0.5}
                  value={titleDuration}
                  onChange={(e) => setTitleDuration(Number(e.target.value))}
                  className="w-24 accent-ember-500"
                />
                <span className="font-mono text-sky-500 tabular-nums w-10">{titleDuration.toFixed(1)}s</span>
              </label>
              <div className="flex items-center gap-1">
                {(['top', 'center', 'bottom'] as const).map(p => (
                  <button
                    key={p}
                    onClick={() => setTitlePosition(p)}
                    className={
                      'px-2.5 h-7 text-xs rounded transition-colors capitalize ' +
                      (titlePosition === p
                        ? 'bg-ember-500/20 text-ember-300 border border-ember-500/40'
                        : 'bg-sky-900/30 text-sky-400 border border-sky-800/30 hover:bg-sky-800/40')
                    }
                  >
                    {p}
                  </button>
                ))}
              </div>
              {title ? (
                <button
                  onClick={() => setTitle('')}
                  className="btn-ghost text-xs flex-shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                  Clear
                </button>
              ) : null}
              <div className="flex-1" />
              <div className="text-[11px] text-sky-600 font-mono">
                {title ? `Shows first ${titleDuration.toFixed(1)}s` : 'Type to add a title card'}
              </div>
            </div>
          ) : null}
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
