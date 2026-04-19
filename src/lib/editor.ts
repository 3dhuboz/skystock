import * as THREE from 'three';

export type PresetName = 'static' | 'orbit' | 'flyThrough' | 'reveal' | 'reverseReveal';

export const PRESETS: { id: PresetName; label: string; description: string }[] = [
  { id: 'static',         label: 'Static',         description: 'No motion. The camera holds wherever you drag it.' },
  { id: 'orbit',          label: 'Orbit',          description: 'Continuous 360° pan around the horizon. One direction, no wobble.' },
  { id: 'flyThrough',     label: 'Fly-through',    description: 'Smooth forward glide — gentle yaw drift, slight nose-down, one soft bank. No shake.' },
  { id: 'reveal',         label: 'Reveal',         description: 'Starts tilted down, rises to horizon.' },
  { id: 'reverseReveal',  label: 'Reverse Reveal', description: 'Opens on horizon, drifts down and away.' },
];

export type LensName = 'fpv' | 'wide' | 'ultraWide' | 'asteroid' | 'rabbitHole';

export interface Keyframe {
  /** Absolute time in seconds (on the video timeline). */
  t: number;
  yaw: number;
  pitch: number;
  zoom: number;
  lens: LensName;
  /** Easing curve OUT of this keyframe (applies to the segment a→b). */
  ease?: EasingCurve;
}

function lerpAngle(a: number, b: number, t: number): number {
  const diff = ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  return a + diff * t;
}

function applyEasing(k: number, curve: EasingCurve): number {
  switch (curve) {
    case 'linear':   return k;
    case 'smooth':   return k * k * (3 - 2 * k);  // smoothstep — S-curve
    case 'ease-in':  return k * k;
    case 'ease-out': return 1 - (1 - k) * (1 - k);
    case 'hold':     return k < 1 ? 0 : 1;        // stays on A until the very end
    default:         return k * k * (3 - 2 * k);
  }
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
  const rawK = (t - a.t) / Math.max(0.0001, b.t - a.t);
  const k = applyEasing(rawK, a.ease ?? 'smooth');
  return {
    t,
    yaw:   lerpAngle(a.yaw, b.yaw, k),
    pitch: a.pitch + (b.pitch - a.pitch) * k,
    zoom:  a.zoom + (b.zoom - a.zoom) * k,
    lens:  k < 0.5 ? a.lens : b.lens,
  };
}

export const LENSES: { id: LensName; label: string; fov: number; pitchBias: number; description: string }[] = [
  { id: 'fpv',        label: 'FPV',        fov: 115, pitchBias: 0,               description: 'Wide goggle view with forward dive, edge-curl & bank. Actually feels like flying.' },
  { id: 'wide',       label: 'Wide',       fov:  75, pitchBias: 0,               description: 'Standard perspective — your reframed view.' },
  { id: 'ultraWide',  label: 'Ultra Wide', fov: 120, pitchBias: 0,               description: 'Expanded field of view. More scene in every frame.' },
  { id: 'asteroid',   label: 'Asteroid',   fov: 170, pitchBias: -Math.PI / 2 + 0.05, description: 'Tiny planet — the world curls below you. The signature 360° shot.' },
  { id: 'rabbitHole', label: 'Rabbit Hole', fov: 170, pitchBias:  Math.PI / 2 - 0.05, description: 'Looking straight up through a sky tunnel. Inverse asteroid.' },
];

/** Returns camera Euler deltas for the given preset at normalized time t ∈ [0,1].
 *
 *  These deltas are ADDED on top of the user's drag-set framing in the render loop, so the user's
 *  chosen "starting angle" is preserved and the preset becomes a subtle motion layered on top —
 *  matching DJI Mimo's feel, where presets don't override your reframing. Amplitudes are small
 *  (±15-30°) so the framing stays coherent through the shot. */
export interface CameraDelta {
  yaw: number;
  pitch: number;
  roll: number;
  /** Multiplicative zoom delta (1 = no change). Used by "push in" / Fly-through
   *  to progress from wide → tight without changing the user's base zoom. */
  zoomMul?: number;
}

/** Returns camera deltas for the given preset at time t (0..1 across the trim window).
 *  `intensity` scales the motion amplitude — 1 is the default, 0.5 halves the range,
 *  2 doubles it. Lets users slow down Orbit and soften Fly-through without touching
 *  clip playback speed. */
export function cameraFor(preset: PresetName, t: number, intensity = 1): CameraDelta {
  const k = Math.max(0, intensity);
  switch (preset) {
    case 'static':
      // No motion at all — camera sits wherever the user dragged it.
      return { yaw: 0, pitch: 0, roll: 0 };
    case 'orbit':
      // Continuous one-direction pan. At k=1 the orbit completes 360° across the
      // trim window; k=0.25 means it only sweeps 90°, much slower-feeling.
      return {
        yaw: t * Math.PI * 2 * k,
        pitch: 0,
        roll: 0,
      };
    case 'flyThrough':
      // Proper "push in" — gentle forward dolly via zoom interpolation, plus a
      // subtle yaw curve and one soft bank. Reads as flying into the shot.
      return {
        yaw:   (t - 0.5) * 0.35 * k,                   // ±10° at k=1
        pitch: -0.05 * k - Math.sin(t * Math.PI) * 0.02 * k,
        roll:  Math.sin(t * Math.PI) * 0.05 * k,
        // Zoom progresses 1.0 → ~1.25 across the clip at k=1. Pushing IN, not wobble.
        zoomMul: 1 + t * 0.25 * k,
      };
    case 'reveal':
      // Start pitched down 45° and lift smoothly to level.
      return {
        yaw: (t - 0.5) * 0.4 * k,
        pitch: -0.8 * (1 - t) * (1 - t) * k,
        roll: 0,
      };
    case 'reverseReveal':
      // Start level, drift down 45° by end of clip.
      return {
        yaw: -t * 0.4 * k,
        pitch: -0.8 * t * t * k,
        roll: 0,
      };
  }
}

export type TitlePosition = 'top' | 'center' | 'bottom';
export type EasingCurve = 'linear' | 'smooth' | 'ease-in' | 'ease-out' | 'hold';

export interface ColorAdjust {
  exposure: number;    // -2..+2 EV
  contrast: number;    // 0..2 (1 = neutral)
  saturation: number;  // 0..2 (1 = neutral)
  temperature: number; // -1..+1 (+ warm, - cool)
  highlights: number;  // -1..+1 (lift/tame highlights)
  shadows: number;     // -1..+1 (lift/tame shadows)
  tint: number;        // -1..+1 (green/magenta)
  vibrance: number;    // -1..+1 (smart saturation, preserves skin tones)
  dLogIntensity: number; // 0..1 (how strongly to apply D-Log M → Rec.709)
  horizonLevel: number;  // -1..+1 roll correction (radians: actual * π/4)
}

export const DEFAULT_COLOR: ColorAdjust = {
  exposure: 0, contrast: 1, saturation: 1, temperature: 0,
  highlights: 0, shadows: 0, tint: 0, vibrance: 0,
  dLogIntensity: 0, horizonLevel: 0,
};

export type DashboardWidgetId =
  | 'date' | 'timer' | 'speed' | 'altitude' | 'gForce' | 'tiltAngle'
  | 'altimeter' | 'location' | 'slope' | 'pace' | 'power' | 'cadence'
  | 'heartRate' | 'waterDepth' | 'torque' | 'totalMileage';

export interface DashboardWidget {
  id: DashboardWidgetId;
  label: string;
  unit: string;
  /** For mock data, base value + random amplitude for procedural demo values. */
  mockBase: number;
  mockAmp: number;
  /** Whether this widget applies to drone footage (subset shown by default). */
  droneRelevant: boolean;
}

export const DASHBOARD_WIDGETS: DashboardWidget[] = [
  { id: 'date',         label: 'DATE',    unit: '',      mockBase: 0,   mockAmp: 0,   droneRelevant: true  },
  { id: 'timer',        label: 'TIMER',   unit: '',      mockBase: 0,   mockAmp: 0,   droneRelevant: true  },
  { id: 'speed',        label: 'SPEED',   unit: 'km/h',  mockBase: 42,  mockAmp: 8,   droneRelevant: true  },
  { id: 'altitude',     label: 'ALT',     unit: 'm',     mockBase: 85,  mockAmp: 4,   droneRelevant: true  },
  { id: 'altimeter',    label: 'ALTIMETER', unit: 'm',   mockBase: 85,  mockAmp: 4,   droneRelevant: true  },
  { id: 'gForce',       label: 'G-FORCE', unit: 'G',     mockBase: 1.0, mockAmp: 0.3, droneRelevant: true  },
  { id: 'tiltAngle',    label: 'TILT',    unit: '°',     mockBase: -5,  mockAmp: 8,   droneRelevant: true  },
  { id: 'location',     label: 'LOCATION', unit: '',     mockBase: 0,   mockAmp: 0,   droneRelevant: true  },
  { id: 'slope',        label: 'SLOPE',   unit: '%',     mockBase: 0,   mockAmp: 5,   droneRelevant: true  },
  { id: 'torque',       label: 'TORQUE',  unit: 'N·m',   mockBase: 0,   mockAmp: 2,   droneRelevant: false },
  { id: 'pace',         label: 'PACE',    unit: 'min/km', mockBase: 5,  mockAmp: 0.5, droneRelevant: false },
  { id: 'power',        label: 'POWER',   unit: 'W',     mockBase: 180, mockAmp: 30,  droneRelevant: false },
  { id: 'cadence',      label: 'CADENCE', unit: 'rpm',   mockBase: 85,  mockAmp: 10,  droneRelevant: false },
  { id: 'heartRate',    label: 'HR',      unit: 'bpm',   mockBase: 120, mockAmp: 15,  droneRelevant: false },
  { id: 'waterDepth',   label: 'DEPTH',   unit: 'm',     mockBase: 0,   mockAmp: 0,   droneRelevant: false },
  { id: 'totalMileage', label: 'TOTAL',   unit: 'km',    mockBase: 12,  mockAmp: 0,   droneRelevant: false },
];

export type DashboardPosition = 'tl' | 'tr' | 'bl' | 'br';

export interface DashboardConfig {
  enabled: boolean;
  /** Which widgets are shown, in display order. */
  widgets: DashboardWidgetId[];
  position: DashboardPosition;
}

export const DEFAULT_DASHBOARD: DashboardConfig = {
  enabled: false,
  widgets: ['date', 'timer', 'speed', 'altitude'],
  position: 'tl',
};

export interface TelemetryFrame {
  t: number;               // seconds from clip start
  dateTime?: string;       // ISO-ish captured timestamp
  lat?: number;
  lon?: number;
  altRel?: number;         // relative altitude (m, typically from takeoff)
  altAbs?: number;         // absolute altitude (m, MSL)
  speed?: number;          // m/s — we'll convert to km/h for display
  yaw?: number;            // gimbal yaw
  pitch?: number;          // gimbal pitch
  roll?: number;           // gimbal roll
  iso?: number;
  shutter?: string;
  fnum?: number;
  ev?: number;
  focalLen?: number;
  colorTemp?: number;
}

/** Parses DJI SRT sidecar telemetry (as emitted by Avata / Mavic / Osmo drones).
 *  Each SRT entry contains bracketed key:value pairs plus gimbal angles. */
export function parseDJISrt(text: string): TelemetryFrame[] {
  const frames: TelemetryFrame[] = [];
  const blocks = text.split(/\r?\n\s*\r?\n/);
  for (const block of blocks) {
    const lines = block.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) continue;
    const timeLine = lines.find(l => /-->/.test(l));
    if (!timeLine) continue;
    const tm = timeLine.match(/(\d+):(\d+):(\d+)[,.](\d+)/);
    if (!tm) continue;
    const t = Number(tm[1]) * 3600 + Number(tm[2]) * 60 + Number(tm[3]) + Number(tm[4]) / 1000;
    const body = lines.filter(l => !/-->/.test(l) && !/^\d+$/.test(l)).join(' ');
    const frame: TelemetryFrame = { t };
    // Date/time is usually on its own line like "2026-04-17 16:18:06,123" — pick it up.
    const dtMatch = body.match(/(\d{4}-\d{2}-\d{2}[\sT]\d{2}:\d{2}:\d{2}[.,]?\d*)/);
    if (dtMatch) frame.dateTime = dtMatch[1].replace(',', '.');
    // Bracketed pairs.
    for (const m of body.matchAll(/\[([^\]]+)\]/g)) {
      const content = m[1];
      const pairs = content.split(/\s+(?=\w+\s*:)/);  // splits on start-of-next-key
      for (const p of pairs) {
        const [kRaw, ...rest] = p.split(':');
        const k = (kRaw || '').trim().toLowerCase();
        const valStr = rest.join(':').trim();
        const num = parseFloat(valStr);
        if (k === 'latitude')         frame.lat = num;
        else if (k === 'longitude')   frame.lon = num;
        else if (k === 'rel_alt')     frame.altRel = num;
        else if (k === 'abs_alt')     frame.altAbs = num;
        else if (k === 'drone_speed') frame.speed = num;
        else if (k === 'iso')         frame.iso = num;
        else if (k === 'shutter')     frame.shutter = valStr;
        else if (k === 'fnum')        frame.fnum = num;
        else if (k === 'ev')          frame.ev = num;
        else if (k === 'ct')          frame.colorTemp = num;
        else if (k === 'focal_len')   frame.focalLen = num;
      }
    }
    const gb = body.match(/gb_yaw\s*:\s*(-?[\d.]+)[^\d-]+gb_pitch\s*:\s*(-?[\d.]+)[^\d-]+gb_roll\s*:\s*(-?[\d.]+)/);
    if (gb) {
      frame.yaw = parseFloat(gb[1]);
      frame.pitch = parseFloat(gb[2]);
      frame.roll = parseFloat(gb[3]);
    }
    frames.push(frame);
  }
  return frames;
}

/** Binary-search nearest telemetry frame to the given time. */
export function lookupTelemetry(frames: TelemetryFrame[], t: number): TelemetryFrame | null {
  if (!frames.length) return null;
  let lo = 0, hi = frames.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (frames[mid].t < t) lo = mid + 1; else hi = mid;
  }
  const candidate = frames[lo];
  if (lo > 0 && Math.abs(frames[lo - 1].t - t) < Math.abs(candidate.t - t)) return frames[lo - 1];
  return candidate;
}

/** Mock data generator — produces plausible values that vary smoothly with video time.
 *  Replace with SRT/LRF parsing once flight-log support is built. */
export function mockDashboardData(widgetId: DashboardWidgetId, videoTime: number): string {
  const w = DASHBOARD_WIDGETS.find(x => x.id === widgetId);
  if (!w) return '—';
  if (widgetId === 'date') {
    const d = new Date();
    return d.toLocaleDateString('en-AU') + ' ' + d.toLocaleTimeString('en-AU', { hour12: false });
  }
  if (widgetId === 'timer') {
    const m = Math.floor(videoTime / 60);
    const s = Math.floor(videoTime % 60);
    const h = Math.floor(videoTime * 100) % 100;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(h).padStart(2, '0')}`;
  }
  if (widgetId === 'location') {
    return `-23.374° · 150.511°`;  // Rockhampton-ish
  }
  // Smooth procedural value: base + amp * sin(t)
  const value = w.mockBase + w.mockAmp * Math.sin(videoTime * 0.3);
  return `${value.toFixed(widgetId === 'gForce' ? 2 : 1)} ${w.unit}`;
}

export function drawDashboard(canvas: HTMLCanvasElement, config: DashboardConfig, videoTime: number) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!config.enabled || config.widgets.length === 0) return;

  const pad = 20;
  const lineH = 64;
  const labelH = 20;
  const valueH = 36;

  // Layout: vertical stack of widgets, each showing LABEL + VALUE.
  ctx.shadowColor = 'rgba(0,0,0,0.85)';
  ctx.shadowBlur = 12;

  config.widgets.forEach((wid, idx) => {
    const widget = DASHBOARD_WIDGETS.find(x => x.id === wid);
    if (!widget) return;
    const y = pad + idx * lineH;
    // Label
    ctx.font = '500 18px "JetBrains Mono", ui-monospace, monospace';
    ctx.fillStyle = 'rgba(249, 115, 22, 0.95)';  // ember
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(widget.label, pad, y);
    // Value
    ctx.font = '700 32px "Outfit", system-ui, sans-serif';
    ctx.fillStyle = 'white';
    ctx.fillText(mockDashboardData(wid, videoTime), pad, y + labelH);
    void valueH;
  });

  ctx.shadowBlur = 0;
}

export interface StockTrack {
  id: string;
  title: string;
  mood: string;
  url: string;
  /** Optional attribution — shown in UI when the track is in use. */
  attribution?: string;
}

/** Starter library using SoundHelix's public royalty-free tracks. Swap these URLs for your own
 *  curated library (Pixabay Audio CDN, FMA, self-hosted) once you have licensing sorted. */
export const STOCK_MUSIC: StockTrack[] = [
  { id: 'sh1',  title: 'Skyline',        mood: 'Cinematic',     url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',  attribution: 'SoundHelix' },
  { id: 'sh5',  title: 'Afterglow',      mood: 'Uplifting',     url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3',  attribution: 'SoundHelix' },
  { id: 'sh8',  title: 'Wanderer',       mood: 'Chill',         url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3',  attribution: 'SoundHelix' },
  { id: 'sh11', title: 'Signal Tower',   mood: 'Electronic',    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-11.mp3', attribution: 'SoundHelix' },
  { id: 'sh13', title: 'High Altitude',  mood: 'Driving',       url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-13.mp3', attribution: 'SoundHelix' },
  { id: 'sh16', title: 'Horizon Line',   mood: 'Ambient',       url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-16.mp3', attribution: 'SoundHelix' },
];

/** Sample the given video element and derive auto color settings. Runs on a 64x32 scratch canvas
 *  so it's cheap enough to call live. Returns neutral settings if the video isn't ready. */
export function computeAutoColor(video: HTMLVideoElement, assumeDLogM = false): ColorAdjust {
  if (!video || video.readyState < 2) return DEFAULT_COLOR;
  const w = 64, h = 32;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) return DEFAULT_COLOR;
  try { ctx.drawImage(video, 0, 0, w, h); } catch { return DEFAULT_COLOR; }
  const data = ctx.getImageData(0, 0, w, h).data;
  let sumL = 0, minL = 255, maxL = 0, sumR = 0, sumG = 0, sumB = 0, sumSat = 0;
  const n = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    sumL += L; sumR += r; sumG += g; sumB += b;
    if (L < minL) minL = L;
    if (L > maxL) maxL = L;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    sumSat += mx === 0 ? 0 : (mx - mn) / mx;
  }
  const meanL = sumL / n / 255;
  const contrastRange = (maxL - minL) / 255;
  const meanSat = sumSat / n;
  const meanR = sumR / n / 255;
  const meanB = sumB / n / 255;

  // Exposure: push mean luminance toward 0.5 (mid-grey).
  const exposure = Math.max(-1.5, Math.min(1.5, Math.log2(0.5 / Math.max(0.04, meanL))));
  // Contrast: if the luminance range is narrow, boost.
  const contrast = contrastRange < 0.45 ? 1.25 : 1.05;
  // Saturation: aim for healthy 0.35; bump more if flat.
  const saturation = meanSat < 0.18 ? 1.35 : meanSat < 0.3 ? 1.15 : 1.05;
  // Temperature: if image leans blue, warm it (and vice-versa).
  const temperature = Math.max(-0.3, Math.min(0.3, (meanR - meanB) * -1.2));

  return { exposure, contrast, saturation, temperature, dLogM: assumeDLogM };
}

export interface SceneHandle {
  setVideo(video: HTMLVideoElement): void;
  /** Toggle the SkyStock watermark overlay. Clean exports bypass it. */
  setWatermarkEnabled(on: boolean): void;
  setPreset(preset: PresetName): void;
  /** Scale preset motion amplitude. 0.25..2 recommended. */
  setPresetIntensity(intensity: number): void;
  getPreset(): PresetName;
  setLens(lens: LensName): void;
  getLens(): LensName;
  /** Set trim window (in seconds). The preset's t normalizes over this window. */
  setTrim(inSec: number, outSec: number): void;
  /** Set a title card. Fades in/out over the given time window. Empty text = no title. */
  setTitle(text: string, inSec: number, outSec: number, position?: TitlePosition): void;
  /** Set color grading (exposure, contrast, saturation, temperature). */
  setColor(adj: ColorAdjust): void;
  /** Set dashboard/telemetry overlay config. */
  setDashboard(config: DashboardConfig): void;
  /** Set the keyframe track. When non-empty, keyframes drive the camera and lens
   *  (preset is ignored). Manual drag still applies as an offset on top. */
  setKeyframes(frames: Keyframe[]): void;
  /** Returns the FINAL camera state at the current video time, including both
   *  the preset / keyframe interpolation AND the user's manual drag offsets.
   *  Use this to snapshot a keyframe. */
  captureState(): { yaw: number; pitch: number; zoom: number; lens: LensName };
  /** Compute the yaw/pitch needed to center the given canvas UV in the frame.
   *  uv is (x,y) with origin at the top-left, 0..1. Returns null for stereographic
   *  lenses where "aim" doesn't have a natural meaning. */
  aimAt(uv: [number, number]): { yaw: number; pitch: number } | null;
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
  uniform sampler2D uTitle;
  uniform int uLens;          // 0=wide, 1=ultraWide, 2=asteroid, 3=rabbitHole
  uniform int uLensB;         // target lens for blending (-1 = no blend)
  uniform float uBlend;       // 0..1 blend amount between uLens and uLensB
  uniform float uFovRad;      // for wide/ultraWide
  uniform float uFovRadB;     // for the blend target lens
  uniform float uYaw;
  uniform float uPitch;
  uniform float uRoll;
  uniform float uAspect;      // canvas width/height
  uniform float uZoom;        // 1.0 = default; <1 zooms in, >1 zooms out
  uniform float uTitleOpacity; // 0..1
  uniform float uExposure;    // EV stops, -2..+2
  uniform float uContrast;    // 0..2, 1 = neutral
  uniform float uSaturation;  // 0..2, 1 = neutral
  uniform float uTemperature; // -1..+1, warm+/cool-
  uniform float uHighlights;  // -1..+1
  uniform float uShadows;     // -1..+1
  uniform float uTint;        // -1..+1 (+magenta, -green)
  uniform float uVibrance;    // -1..+1 (smart saturation)
  uniform float uDLogIntensity; // 0..1 how much D-Log→Rec709 to apply
  uniform sampler2D uDash;
  uniform vec2 uDashAnchor;   // bottom-left of dashboard box in UV
  uniform vec2 uDashSize;     // size in UV fraction
  uniform float uDashOpacity; // 0..1
  uniform float uWmOpacity;   // 0 = hide watermark (clean paid export), else standard tint
  uniform vec2  uTitlePos;    // title box anchor (x,y) in UV space
  uniform vec2  uTitleSize;   // title box size (w,h) in UV fraction
  const float PI = 3.14159265358979;

  vec3 rayDirFor(int lens, float fovRad, vec2 uv) {
    // Centered screen coords, aspect-correct (x grows with aspect, y in [-1,1]).
    vec2 p = (uv * 2.0 - 1.0) * vec2(uAspect, 1.0);
    if (lens == 2) {
      // Asteroid — stereographic from north pole. Center of screen = south pole (ground below).
      p *= 1.3 * uZoom;
      float r2 = dot(p, p);
      return normalize(vec3(2.0 * p.x, r2 - 1.0, -2.0 * p.y));
    }
    if (lens == 3) {
      // Rabbit Hole — stereographic from south pole. Center = north pole (sky above).
      p *= 1.3 * uZoom;
      float r2 = dot(p, p);
      return normalize(vec3(2.0 * p.x, 1.0 - r2, -2.0 * p.y));
    }
    // Wide / Ultra Wide / FPV — pinhole that smoothly blends to Panini (stereographic from the
    // backward pole) as the field of view opens past ~80°. Keeps the center rectilinear while
    // edges curl cleanly — no barrel smear when the camera zooms out, so the Avata 360's wide
    // capture actually looks wide instead of smeared.
    float fovScaled = clamp(fovRad * uZoom, 0.1, PI - 0.05);
    float f = 1.0 / tan(fovScaled * 0.5);
    vec3 pinRay = normalize(vec3(p.x, p.y, -f));
    float panBlend = smoothstep(1.4, 2.7, fovScaled); // 80° → 155°
    if (panBlend <= 0.001) return pinRay;
    // Panini scales p more as FOV grows so the full sphere is reachable at ~180°.
    vec2 pp = p * (0.9 + panBlend * 1.3);
    float r2 = dot(pp, pp);
    vec3 panRay = normalize(vec3(2.0 * pp.x, 2.0 * pp.y, r2 - 1.0) / (r2 + 1.0));
    return normalize(mix(pinRay, panRay, panBlend));
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
    mat3 rot = rotY(uYaw) * rotX(uPitch) * rotZ(uRoll);
    vec3 dA = rot * rayDirFor(uLens, uFovRad, vUv);
    vec4 col = sampleEquirect(dA);
    if (uLensB >= 0 && uBlend > 0.0) {
      vec3 dB = rot * rayDirFor(uLensB, uFovRadB, vUv);
      vec4 colB = sampleEquirect(dB);
      col = mix(col, colB, uBlend);
    }

    // --- Color grading (applied to the video before overlays) ---
    if (uDLogIntensity > 0.001) {
      vec3 graded = col.rgb;
      graded = pow(max(graded, vec3(0.0)), vec3(1.0 / 1.75));
      graded = (graded - 0.12) * 1.55;
      float dlm_luma = dot(graded, vec3(0.2126, 0.7152, 0.0722));
      graded = mix(vec3(dlm_luma), graded, 1.3);
      col.rgb = mix(col.rgb, clamp(graded, 0.0, 1.0), uDLogIntensity);
    }
    col.rgb *= exp2(uExposure);
    col.rgb = (col.rgb - 0.5) * uContrast + 0.5;
    float luma = dot(col.rgb, vec3(0.2126, 0.7152, 0.0722));
    // Highlights / shadows — weight by luma so each affects only its zone.
    float hiWeight = smoothstep(0.5, 1.0, luma);
    float shWeight = 1.0 - smoothstep(0.0, 0.5, luma);
    col.rgb += uHighlights * 0.35 * hiWeight;
    col.rgb += uShadows * 0.35 * shWeight;
    // Tint: green (-) / magenta (+) shift on red+blue vs green.
    col.rgb += vec3(uTint * 0.06, -uTint * 0.06, uTint * 0.06);
    // Saturation (global).
    col.rgb = mix(vec3(luma), col.rgb, uSaturation);
    // Vibrance: scales saturation more for low-sat pixels (protect skin-tones).
    float mx = max(col.r, max(col.g, col.b));
    float mn = min(col.r, min(col.g, col.b));
    float satPx = mx > 0.0 ? (mx - mn) / mx : 0.0;
    float vibBoost = uVibrance * (1.0 - satPx);
    col.rgb = mix(vec3(luma), col.rgb, 1.0 + vibBoost);
    // Temperature (warm/cool).
    col.rgb += vec3(uTemperature * 0.12, 0.0, -uTemperature * 0.12);
    col.rgb = clamp(col.rgb, 0.0, 1.0);

    // Watermark: ~26% wide × 9% tall, anchored 2% from the bottom-right corner.
    if (uWmOpacity > 0.001) {
      vec2 wmAnchor = vec2(0.72, 0.03);
      vec2 wmSize = vec2(0.26, 0.09);
      vec2 wUv = (vUv - wmAnchor) / wmSize;
      if (wUv.x >= 0.0 && wUv.x <= 1.0 && wUv.y >= 0.0 && wUv.y <= 1.0) {
        vec4 wm = texture2D(uWm, wUv);
        col.rgb = mix(col.rgb, wm.rgb, wm.a * uWmOpacity);
      }
    }

    // Title card: caller-controllable position + size.
    if (uTitleOpacity > 0.0) {
      vec2 tUv = (vUv - uTitlePos) / uTitleSize;
      if (tUv.x >= 0.0 && tUv.x <= 1.0 && tUv.y >= 0.0 && tUv.y <= 1.0) {
        vec4 tt = texture2D(uTitle, tUv);
        col.rgb = mix(col.rgb, tt.rgb, tt.a * uTitleOpacity);
      }
    }

    // Telemetry / dashboard HUD overlay.
    if (uDashOpacity > 0.0) {
      vec2 dUv = (vUv - uDashAnchor) / uDashSize;
      if (dUv.x >= 0.0 && dUv.x <= 1.0 && dUv.y >= 0.0 && dUv.y <= 1.0) {
        vec4 dash = texture2D(uDash, dUv);
        col.rgb = mix(col.rgb, dash.rgb, dash.a * uDashOpacity);
      }
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

  // Title card canvas — redrawn when title text changes.
  const titleCanvas = document.createElement('canvas');
  titleCanvas.width = 2048;
  titleCanvas.height = 512;
  const titleTex = new THREE.CanvasTexture(titleCanvas);
  titleTex.colorSpace = THREE.SRGBColorSpace;
  titleTex.minFilter = THREE.LinearFilter;
  titleTex.magFilter = THREE.LinearFilter;
  let titleText = '';
  let titleIn = 0;
  let titleOut = 3;
  let titlePosition: TitlePosition = 'center';

  // Dashboard/HUD overlay
  const dashCanvas = document.createElement('canvas');
  dashCanvas.width = 512;
  dashCanvas.height = 512;
  const dashTex = new THREE.CanvasTexture(dashCanvas);
  dashTex.colorSpace = THREE.SRGBColorSpace;
  dashTex.minFilter = THREE.LinearFilter;
  dashTex.magFilter = THREE.LinearFilter;
  let dashConfig: DashboardConfig = { ...DEFAULT_DASHBOARD };
  function repaintTitle() {
    const ctx = titleCanvas.getContext('2d')!;
    ctx.clearRect(0, 0, titleCanvas.width, titleCanvas.height);
    if (!titleText) return;
    ctx.font = '700 156px "Outfit", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const cx = titleCanvas.width / 2;
    const cy = titleCanvas.height / 2;
    ctx.shadowColor = 'rgba(0,0,0,0.85)';
    ctx.shadowBlur = 24;
    ctx.fillStyle = 'white';
    ctx.fillText(titleText, cx, cy);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(249,115,22,0.9)';
    ctx.lineWidth = 4;
    const w = ctx.measureText(titleText).width;
    const y = cy + 95;
    ctx.beginPath(); ctx.moveTo(cx - w / 2 - 40, y); ctx.lineTo(cx + w / 2 + 40, y); ctx.stroke();
    titleTex.needsUpdate = true;
  }

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
      uVideo:         { value: videoTex },
      uWm:            { value: wmTex },
      uTitle:         { value: titleTex },
      uLens:          { value: 0 },
      uLensB:         { value: -1 },
      uBlend:         { value: 0 },
      uFovRad:        { value: (75 * Math.PI) / 180 },
      uFovRadB:       { value: (75 * Math.PI) / 180 },
      uYaw:           { value: 0 },
      uPitch:         { value: 0 },
      uRoll:          { value: 0 },
      uAspect:        { value: 16 / 9 },
      uZoom:          { value: 1.0 },
      uTitleOpacity:  { value: 0 },
      uTitlePos:      { value: new THREE.Vector2(0.1, 0.66) },
      uTitleSize:     { value: new THREE.Vector2(0.8, 0.20) },
      uExposure:      { value: 0 },
      uContrast:      { value: 1 },
      uSaturation:    { value: 1 },
      uTemperature:   { value: 0 },
      uHighlights:    { value: 0 },
      uShadows:       { value: 0 },
      uTint:          { value: 0 },
      uVibrance:      { value: 0 },
      uDLogIntensity: { value: 0 },
      uDash:          { value: dashTex },
      uDashAnchor:    { value: new THREE.Vector2(0.02, 0.70) },
      uDashSize:      { value: new THREE.Vector2(0.26, 0.28) },
      uDashOpacity:   { value: 0 },
      uWmOpacity:     { value: 0.55 },
    },
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  scene.add(quad);

  // Shader knows four projection maths: indices 0=pinhole (FPV/Wide/UltraWide differ only by FOV),
  // 1=also pinhole (kept for legacy), 2=asteroid, 3=rabbit-hole. So fpv + wide + ultraWide all map to 0.
  const LENS_IDX: Record<LensName, number> = { fpv: 0, wide: 0, ultraWide: 0, asteroid: 2, rabbitHole: 3 };

  let videoEl: HTMLVideoElement | null = null;
  let preset: PresetName = 'static';
  let presetIntensity = 1; // 0.25..2 — scales motion amplitude per preset
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
  // FPV banking: track yaw velocity so we can bank the camera into turns.
  let prevYaw = 0;
  let bankRoll = 0;
  let prevFrameTime = 0;
  const PITCH_LIMIT = Math.PI / 2 - 0.05;
  const ZOOM_MIN = 0.25;   // Panini blend kicks in, so users can zoom out hard without smearing.
  const ZOOM_MAX = 3.5;

  // Click-drag reframe
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  canvas.style.cursor = 'grab';
  canvas.addEventListener('pointerdown', (e) => {
    // Shift-click is reserved for Editor.tsx (aim-at-subject). Don't start a drag.
    if (e.shiftKey) return;
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

  let lastDashPaint = 0;
  function loop() {
    raf = requestAnimationFrame(loop);

    // Repaint the dashboard canvas every 100ms with current telemetry values.
    if (dashConfig.enabled && videoEl) {
      const now = performance.now();
      if (now - lastDashPaint > 100) {
        lastDashPaint = now;
        drawDashboard(dashCanvas, dashConfig, videoEl.currentTime);
        dashTex.needsUpdate = true;
      }
    }


    if (videoEl && videoEl.readyState >= 2 && videoEl.duration) {
      let baseYaw: number;
      let basePitch: number;
      let roll = 0;
      let baseZoom: number;
      let effectiveLens: LensName;
      let lensB: LensName | null = null;
      let lensBlend = 0;

      const kf = evalKeyframes(keyframes, videoEl.currentTime);
      if (kf) {
        baseYaw = kf.yaw;
        basePitch = kf.pitch;
        baseZoom = kf.zoom;
        effectiveLens = kf.lens;

        // Work out whether we're mid-transition between two keyframes with different lenses.
        const sorted = keyframes.slice().sort((a, b) => a.t - b.t);
        let i = 0;
        while (i < sorted.length - 1 && sorted[i + 1].t <= videoEl.currentTime) i++;
        if (i < sorted.length - 1) {
          const a = sorted[i];
          const b = sorted[i + 1];
          if (a.lens !== b.lens) {
            const k = (videoEl.currentTime - a.t) / Math.max(0.0001, b.t - a.t);
            // Smooth S-curve for the blend — feels less jarring than linear.
            const sk = k * k * (3 - 2 * k);
            effectiveLens = a.lens;
            lensB = b.lens;
            lensBlend = Math.max(0, Math.min(1, sk));
          }
        }
      } else {
        const outSec = trimOut === Infinity ? videoEl.duration : Math.min(trimOut, videoEl.duration);
        const win = Math.max(0.01, outSec - trimIn);
        const tp = Math.min(1, Math.max(0, (videoEl.currentTime - trimIn) / win));
        const c = cameraFor(preset, tp, presetIntensity);
        baseYaw = c.yaw;
        basePitch = c.pitch;
        roll = c.roll;
        baseZoom = c.zoomMul ?? 1.0;
        effectiveLens = lens;
      }

      const lensDef = LENSES.find(l => l.id === effectiveLens)!;
      const lensIdx = LENS_IDX[effectiveLens];
      material.uniforms.uLens.value = lensIdx;
      material.uniforms.uFovRad.value = (lensDef.fov * Math.PI) / 180;
      if (lensB !== null) {
        const lensBDef = LENSES.find(l => l.id === lensB)!;
        material.uniforms.uLensB.value = LENS_IDX[lensB];
        material.uniforms.uFovRadB.value = (lensBDef.fov * Math.PI) / 180;
        material.uniforms.uBlend.value = lensBlend;
      } else {
        material.uniforms.uLensB.value = -1;
        material.uniforms.uBlend.value = 0;
      }
      material.uniforms.uZoom.value = baseZoom * zoom;

      const pitchBias = lensIdx >= 2 ? 0 : lensDef.pitchBias;
      let finalPitch = basePitch + pitchOffset + pitchBias;
      let finalYaw = baseYaw + yawOffset;
      // FPV lens: nose the camera down like goggles, bank into turns, and add ambient flight
      // micro-motion so even a static clip feels like the quad is airborne.
      let finalRoll = roll;
      if (effectiveLens === 'fpv') {
        finalPitch -= 0.31;  // ~18° forward dive — horizon sits in upper third like real FPV goggles
        const now = performance.now() / 1000;
        const dt = Math.max(0.016, Math.min(0.1, prevFrameTime ? (now - prevFrameTime) : 0.016));
        const yawVel = ((baseYaw + yawOffset) - prevYaw) / dt;
        // Bank into turns — cap ±25°.
        const targetRoll = Math.max(-0.44, Math.min(0.44, yawVel * 0.35));
        bankRoll = bankRoll + (targetRoll - bankRoll) * 0.12;
        // Ambient flight motion — motor vibration, breath-like bob, subtle drift. Sold as flying.
        const flightTime = videoEl.currentTime || now;
        const bobPitch = Math.sin(flightTime * 1.7) * 0.025 + Math.sin(flightTime * 5.3) * 0.008;  // ~1.5° slow + ~0.5° buzz
        const driftYaw = Math.sin(flightTime * 0.43) * 0.012;                                       // ~0.7° yaw drift
        const wobbleRoll = Math.sin(flightTime * 0.9) * 0.022 + Math.sin(flightTime * 4.1) * 0.006; // ~1.3° slow + ~0.35° buzz
        finalPitch += bobPitch;
        finalYaw += driftYaw;
        finalRoll = roll + bankRoll + wobbleRoll;
        prevFrameTime = now;
      } else {
        bankRoll = 0;
      }
      prevYaw = baseYaw + yawOffset;
      if (finalPitch > PITCH_LIMIT) finalPitch = PITCH_LIMIT;
      if (finalPitch < -PITCH_LIMIT) finalPitch = -PITCH_LIMIT;
      material.uniforms.uYaw.value = finalYaw;
      material.uniforms.uPitch.value = finalPitch;
      material.uniforms.uRoll.value = finalRoll;

      // Title opacity: fade in over 0.3s, hold, fade out over 0.3s.
      if (titleText && videoEl.currentTime >= titleIn && videoEl.currentTime <= titleOut) {
        const span = Math.max(0.01, titleOut - titleIn);
        const fadePart = Math.min(0.3, span * 0.25);
        const intoTitle = videoEl.currentTime - titleIn;
        const outOfTitle = titleOut - videoEl.currentTime;
        const fadeIn = Math.min(1, intoTitle / fadePart);
        const fadeOut = Math.min(1, outOfTitle / fadePart);
        material.uniforms.uTitleOpacity.value = Math.max(0, Math.min(1, Math.min(fadeIn, fadeOut)));
      } else {
        material.uniforms.uTitleOpacity.value = 0;
      }

      lastBaseYaw = baseYaw;
      lastBasePitch = basePitch;
      lastBaseZoom = baseZoom;
      lastBaseLens = effectiveLens;
    } else {
      const lensDef = LENSES.find(l => l.id === lens)!;
      material.uniforms.uLens.value = LENS_IDX[lens];
      material.uniforms.uLensB.value = -1;
      material.uniforms.uBlend.value = 0;
      material.uniforms.uFovRad.value = (lensDef.fov * Math.PI) / 180;
      material.uniforms.uZoom.value = zoom;
      material.uniforms.uTitleOpacity.value = 0;
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
    setWatermarkEnabled(on) {
      material.uniforms.uWmOpacity.value = on ? 0.55 : 0;
    },
    setPreset(p) { preset = p; },
    getPreset() { return preset; },
    setPresetIntensity(i) { presetIntensity = Math.max(0, Math.min(4, i)); },
    setLens(l) { lens = l; },
    getLens() { return lens; },
    setTrim(inSec, outSec) { trimIn = Math.max(0, inSec); trimOut = outSec; },
    setTitle(text, inSec, outSec, position) {
      titleText = text;
      titleIn = Math.max(0, inSec);
      titleOut = Math.max(titleIn + 0.2, outSec);
      if (position) titlePosition = position;
      repaintTitle();
      // Update title-box position in UV space based on position setting.
      const h = 0.20;
      const w = 0.8;
      const x = (1 - w) / 2;
      // Remember: uv.y is bottom-to-top (0 bottom, 1 top).
      const y = titlePosition === 'top'    ? (1 - h - 0.06)
            : titlePosition === 'bottom' ? 0.06
            : (1 - h) / 2; // center
      material.uniforms.uTitlePos.value.set(x, y);
      material.uniforms.uTitleSize.value.set(w, h);
    },
    setColor(adj) {
      material.uniforms.uExposure.value = adj.exposure;
      material.uniforms.uContrast.value = adj.contrast;
      material.uniforms.uSaturation.value = adj.saturation;
      material.uniforms.uTemperature.value = adj.temperature;
      material.uniforms.uHighlights.value = adj.highlights;
      material.uniforms.uShadows.value = adj.shadows;
      material.uniforms.uTint.value = adj.tint;
      material.uniforms.uVibrance.value = adj.vibrance;
      material.uniforms.uDLogIntensity.value = adj.dLogIntensity;
    },
    setDashboard(config) {
      dashConfig = config;
      material.uniforms.uDashOpacity.value = config.enabled ? 1 : 0;
      // Position the HUD box based on the corner selection.
      // uv origin is bottom-left; top positions need y near 1.
      const w = 0.26, h = 0.28;
      const margin = 0.025;
      const { position } = config;
      const x = (position === 'tr' || position === 'br') ? 1 - w - margin : margin;
      const y = (position === 'tl' || position === 'tr') ? 1 - h - margin : margin;
      material.uniforms.uDashAnchor.value.set(x, y);
      material.uniforms.uDashSize.value.set(w, h);
    },
    setKeyframes(frames) { keyframes = frames.slice().sort((a, b) => a.t - b.t); },
    captureState() {
      return {
        yaw:   lastBaseYaw + yawOffset,
        pitch: Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, lastBasePitch + pitchOffset)),
        zoom:  lastBaseZoom * zoom,
        lens:  lastBaseLens,
      };
    },
    aimAt(uv) {
      // Only meaningful for perspective (pinhole) lenses; stereographic returns null.
      const lensIdx = LENS_IDX[lastBaseLens];
      if (lensIdx !== 0) return null;
      const lensDef = LENSES.find(l => l.id === lastBaseLens)!;
      const fovRad = (lensDef.fov * Math.PI) / 180;
      const aspect = material.uniforms.uAspect.value as number;
      const effectiveZoom = lastBaseZoom * zoom;
      const f = 1 / Math.tan(Math.max(0.1, fovRad * effectiveZoom) * 0.5);
      // Screen-space point (flip y so up is positive, matching uv convention in shader).
      const px = (uv[0] * 2 - 1) * aspect;
      const py = (1 - uv[1]) * 2 - 1;  // input uv has origin top-left; GL uv has origin bottom-left
      // Camera-local ray direction.
      let dx = px, dy = py, dz = -f;
      const len = Math.hypot(dx, dy, dz);
      dx /= len; dy /= len; dz /= len;
      // Apply current rotation (YXZ: rotate around X by pitch, then Y by yaw; roll ~ 0 ignored).
      const curState = handle.captureState();
      const cx = Math.cos(curState.pitch), sx = Math.sin(curState.pitch);
      const ly = dy * cx - dz * sx;
      const lz = dy * sx + dz * cx;
      dy = ly; dz = lz;
      const cy = Math.cos(curState.yaw), sy = Math.sin(curState.yaw);
      const wx = dx * cy + dz * sy;
      const wz = -dx * sy + dz * cy;
      dx = wx; dz = wz;
      // World direction → target angles that would put this direction at screen center.
      const newYaw = Math.atan2(dx, -dz);
      const newPitch = Math.asin(Math.max(-1, Math.min(1, dy)));
      return { yaw: newYaw, pitch: newPitch };
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
      titleTex.dispose();
      dashTex.dispose();
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
