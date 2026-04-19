import { useEffect, useRef } from 'react';

/**
 * Procedural "FPV flight + snap" loop for the landing hero viewport.
 * No video asset required — draws a perspective cockpit view on a canvas
 * showing obstacles whooshing past, a pause-and-snap moment (freeze +
 * shutter flash), then resumes.
 */
export default function FpvShowcase() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // Obstacle field — pillars/trees placed on a "cylinder" the camera flies through.
    // Each has an angular offset (radians around the forward axis) and a z (distance).
    type Obstacle = { theta: number; z: number; tall: number; tint: string; side: 1 | -1 };
    const MAX_Z = 1.6;
    const spawnObstacle = (z = MAX_Z): Obstacle => {
      const side = Math.random() > 0.5 ? 1 : -1;
      const spread = 0.35 + Math.random() * 0.35; // horizontal offset from center
      return {
        theta: side * spread,
        z,
        tall: 0.6 + Math.random() * 0.55,
        tint: Math.random() > 0.6 ? '#f97316' : (Math.random() > 0.5 ? '#38bdf8' : '#0f172a'),
        side,
      };
    };
    const obstacles: Obstacle[] = Array.from({ length: 28 }, () => spawnObstacle(Math.random() * MAX_Z));

    // Speed streaks — horizontal dashes emerging from vanishing point.
    type Streak = { y: number; offset: number; life: number };
    const streaks: Streak[] = Array.from({ length: 26 }, () => ({
      y: Math.random(),
      offset: Math.random(),
      life: Math.random(),
    }));

    // Rings (waypoint gates) — occasional visual landmark, looped z.
    type Ring = { z: number; rot: number };
    const rings: Ring[] = [
      { z: MAX_Z * 0.8, rot: 0.15 },
      { z: MAX_Z * 0.25, rot: -0.2 },
    ];

    // State machine: FLY → DECEL → SNAP → ACCEL → FLY …
    const CYCLE = {
      fly: 6.5,
      decel: 0.55,
      snap: 0.9,
      accel: 0.55,
    };
    const total = CYCLE.fly + CYCLE.decel + CYCLE.snap + CYCLE.accel;

    let t0 = performance.now();
    let rafId = 0;

    const draw = () => {
      const now = performance.now();
      const dt = Math.min(0.05, (now - t0) / 1000);
      t0 = now;

      const W = canvas.width;
      const H = canvas.height;
      const cx = W / 2;
      const cy = H / 2;

      // Progress through the cycle
      const cycleT = ((now / 1000) % total);
      let phase: 'fly' | 'decel' | 'snap' | 'accel';
      let flashAlpha = 0;
      let speedMul = 1;
      let cameraRoll = 0;
      if (cycleT < CYCLE.fly) {
        phase = 'fly';
        speedMul = 1;
        cameraRoll = Math.sin(now / 900) * 0.04; // subtle bank
      } else if (cycleT < CYCLE.fly + CYCLE.decel) {
        phase = 'decel';
        const p = (cycleT - CYCLE.fly) / CYCLE.decel;
        speedMul = 1 - p;
        cameraRoll = Math.sin(now / 900) * 0.04 * (1 - p);
      } else if (cycleT < CYCLE.fly + CYCLE.decel + CYCLE.snap) {
        phase = 'snap';
        speedMul = 0;
        const p = (cycleT - CYCLE.fly - CYCLE.decel) / CYCLE.snap;
        // Flash ramps up fast and fades — the "camera snap" feel.
        flashAlpha = p < 0.22 ? p / 0.22 : Math.max(0, 1 - (p - 0.22) / 0.6);
      } else {
        phase = 'accel';
        const p = (cycleT - CYCLE.fly - CYCLE.decel - CYCLE.snap) / CYCLE.accel;
        speedMul = p;
      }

      // Background — sky gradient + horizon
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#0a1938');
      bg.addColorStop(0.5, '#142c52');
      bg.addColorStop(0.85, '#1f3c63');
      bg.addColorStop(1, '#0f1e2e');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // Camera roll transform
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(cameraRoll);
      ctx.translate(-cx, -cy);

      // Sun/hot-spot
      const sun = ctx.createRadialGradient(cx, cy - H * 0.05, 0, cx, cy - H * 0.05, W * 0.5);
      sun.addColorStop(0, 'rgba(249,115,22,0.35)');
      sun.addColorStop(0.4, 'rgba(249,115,22,0.08)');
      sun.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = sun;
      ctx.fillRect(0, 0, W, H);

      // Ground grid — receding horizon lines
      const HORIZON_Y = cy + H * 0.18;
      ctx.strokeStyle = 'rgba(125,211,252,0.12)';
      ctx.lineWidth = 1 * dpr;
      for (let i = 1; i < 10; i++) {
        const z = i / 10;
        const y = HORIZON_Y + (H - HORIZON_Y) * z * z;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }
      // Vertical perspective lines
      ctx.strokeStyle = 'rgba(125,211,252,0.08)';
      for (let i = -6; i <= 6; i++) {
        const x = cx + i * W * 0.12;
        ctx.beginPath();
        ctx.moveTo(x, HORIZON_Y);
        ctx.lineTo(cx + i * W * 0.45, H);
        ctx.stroke();
      }

      // Speed streaks — more intense when flying fast
      const streakAlpha = 0.15 + speedMul * 0.6;
      ctx.strokeStyle = `rgba(255,255,255,${streakAlpha})`;
      ctx.lineWidth = 1 * dpr;
      for (const s of streaks) {
        s.life -= dt * (0.4 + speedMul * 2.2);
        if (s.life <= 0) {
          s.life = 1;
          s.y = Math.random();
          s.offset = Math.random();
        }
        // Project from vanishing point outward
        const radius = (1 - s.life) * W * 0.7;
        const angle = s.offset * Math.PI * 2;
        const x0 = cx + Math.cos(angle) * radius * 0.3;
        const y0 = HORIZON_Y + Math.sin(angle) * radius * 0.2;
        const x1 = cx + Math.cos(angle) * radius;
        const y1 = HORIZON_Y + Math.sin(angle) * radius * 0.8;
        ctx.globalAlpha = streakAlpha * s.life;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // Rings (waypoint gates) — flown through
      for (const r of rings) {
        r.z -= dt * 0.22 * speedMul;
        if (r.z <= 0.05) { r.z = MAX_Z; r.rot = (Math.random() - 0.5) * 0.5; }
        const scale = 1 / Math.max(0.05, r.z);
        const rx = cx + Math.sin(r.rot) * 40 * dpr * scale;
        const ry = HORIZON_Y - 30 * dpr * scale;
        const ringR = 60 * dpr * scale;
        const alpha = Math.min(1, (MAX_Z - r.z) * 0.9);
        ctx.strokeStyle = `rgba(249,115,22,${alpha * 0.6})`;
        ctx.lineWidth = Math.max(1, 4 * dpr * Math.min(1, scale * 0.5));
        ctx.beginPath();
        ctx.ellipse(rx, ry, ringR, ringR * 0.28, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = `rgba(125,211,252,${alpha * 0.35})`;
        ctx.lineWidth = 1 * dpr;
        ctx.beginPath();
        ctx.ellipse(rx, ry, ringR * 1.15, ringR * 0.32, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Obstacles — pillars/trees on both sides
      obstacles.sort((a, b) => b.z - a.z);  // far first
      for (const o of obstacles) {
        o.z -= dt * 0.6 * speedMul;
        if (o.z <= 0.02) {
          Object.assign(o, spawnObstacle());
          o.z = MAX_Z;
        }
        const scale = 1 / Math.max(0.08, o.z);
        const x = cx + Math.sin(o.theta) * W * 0.7 * scale;
        const baseY = HORIZON_Y + 10 * dpr;
        const topY = baseY - 140 * dpr * scale * o.tall;
        const width = 12 * dpr * scale;
        const alpha = Math.min(1, (MAX_Z - o.z) * 0.8);
        // Shadow
        ctx.fillStyle = `rgba(0,0,0,${alpha * 0.7})`;
        ctx.fillRect(x - width * 0.5, topY, width, baseY - topY);
        // Tint stripe
        ctx.fillStyle = `${o.tint}${Math.floor(alpha * 180).toString(16).padStart(2, '0')}`;
        ctx.fillRect(x - width * 0.3, topY + (baseY - topY) * 0.18, width * 0.6, (baseY - topY) * 0.35);
      }

      // Foreground reticle / HUD
      ctx.strokeStyle = 'rgba(125,211,252,0.5)';
      ctx.lineWidth = 1 * dpr;
      ctx.beginPath();
      ctx.arc(cx, cy, 18 * dpr, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - 28 * dpr, cy); ctx.lineTo(cx - 22 * dpr, cy);
      ctx.moveTo(cx + 22 * dpr, cy); ctx.lineTo(cx + 28 * dpr, cy);
      ctx.moveTo(cx, cy - 28 * dpr); ctx.lineTo(cx, cy - 22 * dpr);
      ctx.moveTo(cx, cy + 22 * dpr); ctx.lineTo(cx, cy + 28 * dpr);
      ctx.stroke();

      ctx.restore();

      // SNAP flash overlay
      if (flashAlpha > 0) {
        ctx.fillStyle = `rgba(255,255,255,${flashAlpha * 0.9})`;
        ctx.fillRect(0, 0, W, H);
      }

      // SNAP corner brackets + label during snap phase
      if (phase === 'snap' || phase === 'decel') {
        const bracketAlpha = phase === 'snap' ? 1 : (cycleT - CYCLE.fly) / CYCLE.decel;
        ctx.strokeStyle = `rgba(249,115,22,${bracketAlpha})`;
        ctx.lineWidth = 3 * dpr;
        const pad = 24 * dpr;
        const len = 22 * dpr;
        // top-left
        ctx.beginPath();
        ctx.moveTo(pad, pad + len); ctx.lineTo(pad, pad); ctx.lineTo(pad + len, pad); ctx.stroke();
        // top-right
        ctx.beginPath();
        ctx.moveTo(W - pad - len, pad); ctx.lineTo(W - pad, pad); ctx.lineTo(W - pad, pad + len); ctx.stroke();
        // bottom-left
        ctx.beginPath();
        ctx.moveTo(pad, H - pad - len); ctx.lineTo(pad, H - pad); ctx.lineTo(pad + len, H - pad); ctx.stroke();
        // bottom-right
        ctx.beginPath();
        ctx.moveTo(W - pad - len, H - pad); ctx.lineTo(W - pad, H - pad); ctx.lineTo(W - pad, H - pad - len); ctx.stroke();

        ctx.fillStyle = `rgba(249,115,22,${bracketAlpha})`;
        ctx.font = `${11 * dpr}px "JetBrains Mono", monospace`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.fillText('● SNAP', W - pad - 4 * dpr, H - pad - 6 * dpr);
      }

      rafId = requestAnimationFrame(draw);
    };
    rafId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ display: 'block' }}
    />
  );
}
