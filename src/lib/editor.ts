import * as THREE from 'three';

export type PresetName = 'orbit' | 'flyThrough' | 'reveal' | 'reverseReveal';

export const PRESETS: { id: PresetName; label: string; description: string }[] = [
  { id: 'orbit',          label: 'Orbit',          description: 'Smooth 360° rotation around the horizon.' },
  { id: 'flyThrough',     label: 'Fly-through',    description: 'Dynamic yaw + tilt variation. Feels like flight.' },
  { id: 'reveal',         label: 'Reveal',         description: 'Starts tilted down, rises to horizon.' },
  { id: 'reverseReveal',  label: 'Reverse Reveal', description: 'Opens on horizon, drifts down and away.' },
];

export type LensName = 'wide' | 'ultraWide' | 'asteroid' | 'rabbitHole';

export interface Keyframe {
  /** Absolute time in seconds (on the video timeline). */
  t: number;
  yaw: number;
  pitch: number;
  zoom: number;
  lens: LensName;
}

function lerpAngle(a: number, b: number, t: number): number {
  const diff = ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  return a + diff * t;
}

/** Evaluate the keyframe track at time t. Holds at first/last keyframe outside the range.
 *  Returns null if the keyframes array is empty. */
export function evalKeyframes(frames: Keyframe[], t: number): Keyframe | null {
  if (frames.length === 0) return null;
  if (frames.length === 1) return frames[0];
  const sorted = frames.slice().sort((a, b) => a.t - b.t);
  if (t <= sorted[0].t) return sorted[0];
  if (t >= sorted[sorted.length - 1].t) return sorted[sorted.length - 1];
  let i = 0;
  while (i < sorted.length - 1 && sorted[i + 1].t <= t) i++;
  const a = sorted[i];
  const b = sorted[i + 1];
  const k = (t - a.t) / Math.max(0.0001, b.t - a.t);
  return {
    t,
    yaw:   lerpAngle(a.yaw, b.yaw, k),
    pitch: a.pitch + (b.pitch - a.pitch) * k,
    zoom:  a.zoom + (b.zoom - a.zoom) * k,
    // Lens snaps — cross-projection blending is a future enhancement.
    lens:  k < 0.5 ? a.lens : b.lens,
  };
}

export const LENSES: { id: LensName; label: string; fov: number; pitchBias: number; description: string }[] = [
  { id: 'wide',       label: 'Wide',       fov:  75, pitchBias: 0,               description: 'Standard perspective — your reframed view.' },
  { id: 'ultraWide',  label: 'Ultra Wide', fov: 120, pitchBias: 0,               description: 'Expanded field of view. More scene in every frame.' },
  { id: 'asteroid',   label: 'Asteroid',   fov: 170, pitchBias: -Math.PI / 2 + 0.05, description: 'Tiny planet — the world curls below you. The signature 360° shot.' },
  { id: 'rabbitHole', label: 'Rabbit Hole', fov: 170, pitchBias:  Math.PI / 2 - 0.05, description: 'Looking straight up through a sky tunnel. Inverse asteroid.' },
];

function clamp(n: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, n)); }

/** Returns camera Euler angles for the given preset at normalized time t ∈ [0,1]. */
export function cameraFor(preset: PresetName, t: number): { yaw: number; pitch: number; roll: number } {
  switch (preset) {
    case 'orbit':
      return {
        yaw: t * Math.PI * 2,
        pitch: Math.sin(t * Math.PI * 2) * 0.12,
        roll: 0,
      };
    case 'flyThrough':
      return {
        yaw: t * Math.PI * 1.5 + Math.sin(t * 6) * 0.25,
        pitch: Math.sin(t * Math.PI * 4) * 0.22,
        roll: Math.sin(t * Math.PI * 3) * 0.08,
      };
    case 'reveal':
      return {
        yaw: t * Math.PI * 0.6,
        pitch: clamp(-0.6 + t * 0.75, -0.6, 0.15),
        roll: 0,
      };
    case 'reverseReveal':
      return {
        yaw: -t * Math.PI * 0.6,
        pitch: clamp(0.15 - t * 0.75, -0.6, 0.15),
        roll: 0,
      };
  }
}

export interface SceneHandle {
  setVideo(video: HTMLVideoElement): void;
  setPreset(preset: PresetName): void;
  getPreset(): PresetName;
  setLens(lens: LensName): void;
  getLens(): LensName;
  /** Set trim window (in seconds). The preset's t normalizes over this window. */
  setTrim(inSec: number, outSec: number): void;
  /** Set the keyframe track. When non-empty, keyframes drive the camera and lens
   *  (preset is ignored). Manual drag still applies as an offset on top. */
  setKeyframes(frames: Keyframe[]): void;
  /** Returns the FINAL camera state at the current video time, including both
   *  the preset / keyframe interpolation AND the user's manual drag offsets.
   *  Use this to snapshot a keyframe. */
  captureState(): { yaw: number; pitch: number; zoom: number; lens: LensName };
  /** Resize the WebGL render target (output resolution). */
  setOutputSize(width: number, height: number): void;
  /** Reset user's manual drag offsets back to the pure preset path. */
  resetFrame(): void;
  captureStream(fps: number): MediaStream;
  getCanvas(): HTMLCanvasElement;
  dispose(): void;
}

// Fragment shader: samples the equirect video with four distinct projection modes.
// Wide/Ultra Wide = perspective; Asteroid = stereographic from north pole;
// Rabbit Hole = stereographic from south pole. The watermark is composited at the end.
const FRAG = /* glsl */`
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uVideo;
  uniform sampler2D uWm;
  uniform int uLens;          // 0=wide, 1=ultraWide, 2=asteroid, 3=rabbitHole
  uniform float uFovRad;      // for wide/ultraWide
  uniform float uYaw;
  uniform float uPitch;
  uniform float uRoll;
  uniform float uAspect;      // canvas width/height
  uniform float uZoom;        // 1.0 = default; <1 zooms in, >1 zooms out
  const float PI = 3.14159265358979;

  vec3 rayDir(vec2 uv) {
    // Centered screen coords, aspect-correct (x grows with aspect, y in [-1,1]).
    vec2 p = (uv * 2.0 - 1.0) * vec2(uAspect, 1.0);
    if (uLens == 2) {
      // Asteroid — stereographic from north pole. Center of screen = south pole (ground below).
      p *= 1.3 * uZoom;
      float r2 = dot(p, p);
      return normalize(vec3(2.0 * p.x, r2 - 1.0, -2.0 * p.y));
    }
    if (uLens == 3) {
      // Rabbit Hole — stereographic from south pole. Center = north pole (sky above).
      p *= 1.3 * uZoom;
      float r2 = dot(p, p);
      return normalize(vec3(2.0 * p.x, 1.0 - r2, -2.0 * p.y));
    }
    // Wide / Ultra Wide — standard pinhole. Zoom adjusts effective FOV.
    float fovScaled = uFovRad * uZoom;
    float f = 1.0 / tan(clamp(fovScaled, 0.1, PI - 0.05) * 0.5);
    return normalize(vec3(p.x, p.y, -f));
  }

  mat3 rotY(float a) { float c = cos(a), s = sin(a); return mat3( c,0.0,-s, 0.0,1.0,0.0,  s,0.0, c); }
  mat3 rotX(float a) { float c = cos(a), s = sin(a); return mat3(1.0,0.0,0.0, 0.0, c,-s, 0.0, s, c); }
  mat3 rotZ(float a) { float c = cos(a), s = sin(a); return mat3( c,-s,0.0, s, c,0.0, 0.0,0.0,1.0); }

  vec4 sampleEquirect(vec3 d) {
    // Equirectangular: u = longitude / 2π + 0.5, v = latitude / π + 0.5.
    // Convention: z = -forward, x = +right, y = +up.
    float u = atan(d.x, -d.z) / (2.0 * PI) + 0.5;
    float v = asin(clamp(d.y, -1.0, 1.0)) / PI + 0.5;
    return texture2D(uVideo, vec2(u, v));
  }

  void main() {
    vec3 d = rayDir(vUv);
    d = rotY(uYaw) * rotX(uPitch) * rotZ(uRoll) * d;
    vec4 col = sampleEquirect(d);

    // Watermark: 28% wide × 9% tall, anchored 2% from the bottom-right corner.
    vec2 wmAnchor = vec2(0.72, 0.03);  // bottom-left of watermark box
    vec2 wmSize = vec2(0.26, 0.09);
    vec2 wUv = (vUv - wmAnchor) / wmSize;
    if (wUv.x >= 0.0 && wUv.x <= 1.0 && wUv.y >= 0.0 && wUv.y <= 1.0) {
      vec4 wm = texture2D(uWm, wUv);
      col.rgb = mix(col.rgb, wm.rgb, wm.a * 0.55);
    }
    gl_FragColor = col;
  }
`;

const VERT = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

/** Set up a shader-based 360 viewer that supports perspective and stereographic lenses. */
export function createScene(canvas: HTMLCanvasElement): SceneHandle {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: false });
  renderer.setPixelRatio(1);

  const scene = new THREE.Scene();
  // We use an ortho camera; the shader does all the projection math.
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  // Watermark bitmap (drawn once onto a canvas, then uploaded as a texture).
  const wmCanvas = document.createElement('canvas');
  wmCanvas.width = 1024;
  wmCanvas.height = 256;
  drawWatermark(wmCanvas);
  const wmTex = new THREE.CanvasTexture(wmCanvas);
  wmTex.colorSpace = THREE.SRGBColorSpace;
  wmTex.minFilter = THREE.LinearFilter;
  wmTex.magFilter = THREE.LinearFilter;
  wmTex.needsUpdate = true;

  // Empty placeholder video texture; swapped in setVideo().
  const blankCanvas = document.createElement('canvas');
  blankCanvas.width = 2; blankCanvas.height = 2;
  const blankCtx = blankCanvas.getContext('2d')!;
  blankCtx.fillStyle = '#000';
  blankCtx.fillRect(0, 0, 2, 2);
  let videoTex: THREE.Texture = new THREE.CanvasTexture(blankCanvas);
  videoTex.colorSpace = THREE.SRGBColorSpace;

  const material = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uVideo:  { value: videoTex },
      uWm:     { value: wmTex },
      uLens:   { value: 0 },
      uFovRad: { value: (75 * Math.PI) / 180 },
      uYaw:    { value: 0 },
      uPitch:  { value: 0 },
      uRoll:   { value: 0 },
      uAspect: { value: 16 / 9 },
      uZoom:   { value: 1.0 },
    },
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  scene.add(quad);

  let videoEl: HTMLVideoElement | null = null;
  let preset: PresetName = 'orbit';
  let lens: LensName = 'wide';
  let raf = 0;
  let yawOffset = 0;
  let pitchOffset = 0;
  let zoom = 1.0;  // < 1 zooms in; > 1 zooms out
  let trimIn = 0;
  let trimOut = Infinity;
  let keyframes: Keyframe[] = [];
  // Cache the interpolated base state for captureState().
  let lastBaseYaw = 0;
  let lastBasePitch = 0;
  let lastBaseZoom = 1.0;
  let lastBaseLens: LensName = 'wide';
  const PITCH_LIMIT = Math.PI / 2 - 0.05;
  const ZOOM_MIN = 0.3;
  const ZOOM_MAX = 3.0;

  // Click-drag reframe
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  canvas.style.cursor = 'grab';
  canvas.addEventListener('pointerdown', (e) => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
    canvas.style.cursor = 'grabbing';
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    const sens = (Math.PI / 2) / Math.max(canvas.clientWidth, 1);
    yawOffset -= dx * sens;
    pitchOffset -= dy * sens;
    if (pitchOffset > PITCH_LIMIT) pitchOffset = PITCH_LIMIT;
    if (pitchOffset < -PITCH_LIMIT) pitchOffset = -PITCH_LIMIT;
  });
  const endDrag = (e: PointerEvent) => {
    if (!dragging) return;
    dragging = false;
    try { canvas.releasePointerCapture(e.pointerId); } catch {}
    canvas.style.cursor = 'grab';
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('pointerleave', endDrag);

  // Wheel to zoom (works for all lenses).
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const factor = Math.exp(e.deltaY * 0.001);
    zoom *= factor;
    if (zoom < ZOOM_MIN) zoom = ZOOM_MIN;
    if (zoom > ZOOM_MAX) zoom = ZOOM_MAX;
  }, { passive: false });

  function loop() {
    raf = requestAnimationFrame(loop);

    if (videoEl && videoEl.readyState >= 2 && videoEl.duration) {
      let baseYaw: number;
      let basePitch: number;
      let roll = 0;
      let baseZoom: number;
      let effectiveLens: LensName;

      const kf = evalKeyframes(keyframes, videoEl.currentTime);
      if (kf) {
        // Keyframes override the preset path.
        baseYaw = kf.yaw;
        basePitch = kf.pitch;
        baseZoom = kf.zoom;
        effectiveLens = kf.lens;
      } else {
        // Preset-driven — t normalized to trim window.
        const outSec = trimOut === Infinity ? videoEl.duration : Math.min(trimOut, videoEl.duration);
        const win = Math.max(0.01, outSec - trimIn);
        const tp = Math.min(1, Math.max(0, (videoEl.currentTime - trimIn) / win));
        const c = cameraFor(preset, tp);
        baseYaw = c.yaw;
        basePitch = c.pitch;
        roll = c.roll;
        baseZoom = 1.0;
        effectiveLens = lens;
      }

      const lensDef = LENSES.find(l => l.id === effectiveLens)!;
      const lensIdx = ['wide', 'ultraWide', 'asteroid', 'rabbitHole'].indexOf(effectiveLens);
      material.uniforms.uLens.value = lensIdx;
      material.uniforms.uFovRad.value = (lensDef.fov * Math.PI) / 180;
      material.uniforms.uZoom.value = baseZoom * zoom;

      const pitchBias = lensIdx >= 2 ? 0 : lensDef.pitchBias;
      let finalPitch = basePitch + pitchOffset + pitchBias;
      if (finalPitch > PITCH_LIMIT) finalPitch = PITCH_LIMIT;
      if (finalPitch < -PITCH_LIMIT) finalPitch = -PITCH_LIMIT;
      material.uniforms.uYaw.value = baseYaw + yawOffset;
      material.uniforms.uPitch.value = finalPitch;
      material.uniforms.uRoll.value = roll;

      lastBaseYaw = baseYaw;
      lastBasePitch = basePitch;
      lastBaseZoom = baseZoom;
      lastBaseLens = effectiveLens;
    } else {
      // Pre-video: just render whatever the static lens is.
      const lensDef = LENSES.find(l => l.id === lens)!;
      const lensIdx = ['wide', 'ultraWide', 'asteroid', 'rabbitHole'].indexOf(lens);
      material.uniforms.uLens.value = lensIdx;
      material.uniforms.uFovRad.value = (lensDef.fov * Math.PI) / 180;
      material.uniforms.uZoom.value = zoom;
    }
    renderer.render(scene, camera);
  }
  loop();

  const handle: SceneHandle = {
    setVideo(v) {
      videoEl = v;
      const tex = new THREE.VideoTexture(v);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.wrapS = THREE.RepeatWrapping;
      material.uniforms.uVideo.value = tex;
      videoTex = tex;
    },
    setPreset(p) { preset = p; },
    getPreset() { return preset; },
    setLens(l) { lens = l; },
    getLens() { return lens; },
    setTrim(inSec, outSec) { trimIn = Math.max(0, inSec); trimOut = outSec; },
    setKeyframes(frames) { keyframes = frames.slice().sort((a, b) => a.t - b.t); },
    captureState() {
      return {
        yaw:   lastBaseYaw + yawOffset,
        pitch: Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, lastBasePitch + pitchOffset)),
        zoom:  lastBaseZoom * zoom,
        lens:  lastBaseLens,
      };
    },
    setOutputSize(w, h) {
      renderer.setSize(w, h, false);
      material.uniforms.uAspect.value = w / h;
    },
    resetFrame() { yawOffset = 0; pitchOffset = 0; zoom = 1.0; },
    captureStream(fps) { return canvas.captureStream(fps); },
    getCanvas() { return canvas; },
    dispose() {
      cancelAnimationFrame(raf);
      renderer.dispose();
      material.dispose();
      quad.geometry.dispose();
      wmTex.dispose();
      if (videoTex && 'dispose' in videoTex) videoTex.dispose();
    },
  };
  (window as any).__skystockEditor = { get preset() { return preset; }, get lens() { return lens; }, get videoEl() { return videoEl; }, handle };
  return handle;
}

function drawWatermark(c: HTMLCanvasElement) {
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.font = '600 36px "Outfit", system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.fillText('SkyStock FPV', c.width - 16, c.height - 40);
  ctx.font = '500 20px "JetBrains Mono", ui-monospace, monospace';
  ctx.fillStyle = 'rgba(249,115,22,0.9)';
  ctx.fillText('skystock.pages.dev', c.width - 16, c.height - 12);
}

/** Pick the best MediaRecorder MIME the browser supports, MP4 preferred. */
export function pickSupportedMime(): string | null {
  const candidates = [
    'video/mp4;codecs=avc1',
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  for (const m of candidates) if (MediaRecorder.isTypeSupported(m)) return m;
  return null;
}

export interface ExportHandle {
  /** Promise resolving to the final Blob when recording stops. */
  done: Promise<Blob>;
  /** Cancel the recording early. */
  stop(): void;
  mime: string;
}

/** Start recording the given canvas stream. Caller triggers stop() when the source finishes. */
export function startExport(stream: MediaStream, mime: string, onProgressBytes: (bytes: number) => void): ExportHandle {
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 });
  const chunks: Blob[] = [];
  let totalBytes = 0;
  rec.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) {
      chunks.push(e.data);
      totalBytes += e.data.size;
      onProgressBytes(totalBytes);
    }
  };
  const done = new Promise<Blob>((resolve) => {
    rec.onstop = () => resolve(new Blob(chunks, { type: mime.split(';')[0] }));
  });
  rec.start(500);
  return {
    done,
    stop: () => { if (rec.state !== 'inactive') rec.stop(); },
    mime,
  };
}
