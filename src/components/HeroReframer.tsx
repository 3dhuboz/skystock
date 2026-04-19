import { useEffect, useRef, useState } from 'react';
import { createScene, type LensName, type SceneHandle } from '../lib/editor';

/**
 * Renders the hero clip through the editor's WebGL shader so it looks CORRECT
 * (no equirectangular warping) and cycles lens projections — Wide → FPV → Asteroid
 * — with continuous yaw, so the hero literally IS the 360°-reframing product demo.
 *
 * Falls back to a plain video tag if WebGL fails or the scene can't attach.
 */
interface HeroReframerProps {
  src: string;
  poster?: string | null;
  /** Cycle through lenses every N seconds. Set to 0 to stay on Wide. Default 6. */
  lensCycleSec?: number;
  /** Show the small "Lens: Wide" chip at the bottom-left. Default true. */
  showLensLabel?: boolean;
  /** Autoplay muted by default. */
  autoplay?: boolean;
  /** External play/pause control — if undefined, stays playing. */
  playing?: boolean;
  /** Class applied to the canvas. */
  canvasClassName?: string;
  /** Callback fired when the source video fires timeupdate (for external progress bars). */
  onTimeUpdate?: (currentTime: number, duration: number) => void;
}

export default function HeroReframer({
  src,
  poster,
  lensCycleSec = 6,
  showLensLabel = true,
  autoplay = true,
  playing,
  canvasClassName = 'absolute inset-0 w-full h-full',
  onTimeUpdate,
}: HeroReframerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const sceneRef = useRef<SceneHandle | null>(null);
  const [fallback, setFallback] = useState(false);
  const [lensLabel, setLensLabel] = useState<string>('Wide');

  // Set up the scene once the video + canvas are ready.
  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    let disposed = false;
    let rafId = 0;
    let lensCycleTimer = 0;

    const start = async () => {
      try {
        // Wait for enough video data to render a frame.
        if (video.readyState < 2) {
          await new Promise<void>((resolve, reject) => {
            const onReady = () => { cleanup(); resolve(); };
            const onError = () => { cleanup(); reject(new Error('video load failed')); };
            const cleanup = () => {
              video.removeEventListener('loadeddata', onReady);
              video.removeEventListener('error', onError);
            };
            video.addEventListener('loadeddata', onReady);
            video.addEventListener('error', onError);
          });
        }
        if (disposed) return;

        const rect = canvas.getBoundingClientRect();
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const W = Math.max(16, Math.round(rect.width * dpr));
        const H = Math.max(16, Math.round(rect.height * dpr));
        canvas.width = W;
        canvas.height = H;

        const scene = createScene(canvas);
        scene.setOutputSize(W, H);
        scene.setWatermarkEnabled(false);
        scene.setVideo(video);
        scene.setLens('wide');
        // Keep the camera static — we reframe with the lens, no preset motion.
        // Short clips with Orbit look like wobble; Static looks like a proper camera.
        scene.setPreset('static');
        scene.setTrim(0, Math.max(4, video.duration || 30));
        sceneRef.current = scene;

        const labels: Record<LensName, string> = {
          wide: 'Wide',
          ultraWide: 'Ultra Wide',
          fpv: 'FPV',
          asteroid: 'Tiny Planet',
          rabbitHole: 'Sky Tunnel',
        };

        if (lensCycleSec > 0) {
          const lenses: LensName[] = ['wide', 'fpv', 'asteroid', 'wide', 'ultraWide'];
          let idx = 0;
          scene.setLens(lenses[idx]);
          setLensLabel(labels[lenses[idx]]);
          lensCycleTimer = window.setInterval(() => {
            if (disposed || !sceneRef.current) return;
            idx = (idx + 1) % lenses.length;
            sceneRef.current.setLens(lenses[idx]);
            setLensLabel(labels[lenses[idx]]);
          }, lensCycleSec * 1000);
        } else {
          scene.setLens('wide');
          setLensLabel(labels.wide);
        }

        // Start playback (muted autoplay is allowed).
        video.muted = true;
        video.loop = true;
        if (autoplay) {
          try { await video.play(); } catch { /* autoplay policy — stay muted */ }
        }

        // Handle canvas resizes.
        const ro = new ResizeObserver(() => {
          if (disposed || !sceneRef.current) return;
          const r = canvas.getBoundingClientRect();
          const dpr2 = Math.min(2, window.devicePixelRatio || 1);
          sceneRef.current.setOutputSize(Math.round(r.width * dpr2), Math.round(r.height * dpr2));
        });
        ro.observe(canvas);

        // Cleanup bookkeeping uses the outer disposed flag + refs.
        (scene as any).__ro = ro;
      } catch (e) {
        console.error('HeroReframer scene setup failed, falling back to <video>', e);
        setFallback(true);
      }
    };

    start();

    return () => {
      disposed = true;
      if (lensCycleTimer) window.clearInterval(lensCycleTimer);
      if (rafId) cancelAnimationFrame(rafId);
      const scene = sceneRef.current;
      if (scene) {
        try { (scene as any).__ro?.disconnect?.(); } catch {}
        try { scene.dispose?.(); } catch {}
      }
      sceneRef.current = null;
    };
  }, [src]);

  if (fallback) {
    return (
      <video
        src={src}
        poster={poster || undefined}
        autoPlay muted loop playsInline
        className="absolute inset-0 w-full h-full object-cover"
      />
    );
  }

  return (
    <>
      {/* Hidden source video — its frames are sampled by the shader. */}
      <video
        ref={videoRef}
        src={src}
        poster={poster || undefined}
        crossOrigin="anonymous"
        muted loop playsInline
        style={{ position: 'absolute', left: '-9999px', top: 0, width: 1, height: 1, opacity: 0 }}
      />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ display: 'block' }}
      />
      {/* Lens label — tiny chip bottom-left */}
      <div className="absolute bottom-4 left-4 z-[5] pointer-events-none flex items-center gap-2 px-2.5 py-1 rounded-full backdrop-blur-md"
        style={{ background: 'rgba(10,14,26,0.6)', border: '1px solid rgba(249,115,22,0.4)' }}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-ember-400 animate-pulse" />
        <span className="text-[10px] font-display font-semibold text-white uppercase tracking-[0.2em]">Lens: {lensLabel}</span>
      </div>
    </>
  );
}
