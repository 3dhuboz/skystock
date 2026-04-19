import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Camera, Aperture, Wand2, Crosshair, Gauge, Palette, Monitor, Check } from 'lucide-react';
import VideoCard from '../components/VideoCard';
import FpvShowcase from '../components/FpvShowcase';
import { getPublishedVideos } from '../lib/api';
import type { Video } from '../lib/types';

export default function Home() {
  const [latestVideos, setLatestVideos] = useState<Video[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const latest = await getPublishedVideos({ sort: 'newest', limit: 6 });
        setLatestVideos(latest.videos);
      } catch {
        setLatestVideos([]);
      }
    }
    load();
  }, []);

  // Pick the featured or most-recent clip for the hero viewport + as background
  // art for the feature tiles.
  const hero = latestVideos.find(v => v.featured) || latestVideos[0] || null;
  const heroClipUrl = hero?.preview_url || hero?.watermarked_url || null;
  const heroPoster = hero?.thumbnail_url || null;
  const heroLocation = hero?.location || 'Central QLD, Australia';

  return (
    <div className="page-enter">
      {/* ====== HERO ====== */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0" style={{
          background: 'linear-gradient(120deg, #0a0e1a 0%, #0e1426 60%, #17224a 100%)',
        }} />
        {/* motion streaks */}
        <div className="absolute inset-0 pointer-events-none opacity-60">
          {Array.from({ length: 14 }).map((_, i) => (
            <div key={i} className="absolute h-px"
              style={{
                top: `${8 + i * 7}%`,
                left: '-10%', right: '-10%',
                background: `rgba(${i % 2 ? '125,211,252' : '251,146,60'},${0.04 + (i % 3) * 0.03})`,
                transform: 'rotate(-3deg)',
                height: i % 4 === 0 ? 2 : 1,
              }}
            />
          ))}
        </div>
        <div className="relative max-w-7xl mx-auto px-6 lg:px-12 py-20 lg:py-28">
          <div className="grid lg:grid-cols-[1fr_auto] gap-16 items-center">
            {/* Left: Copy */}
            <div className="max-w-xl">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-ember-500/12 text-ember-400 text-[11px] font-mono font-medium border border-ember-500/30 tracking-[0.2em]">
                <span className="w-1.5 h-1.5 rounded-full bg-ember-400 animate-pulse" />
                DJI AVATA 360 · CENTRAL QUEENSLAND
              </div>
              <h1 className="mt-6 font-display font-extrabold text-6xl lg:text-7xl xl:text-[104px] text-white leading-[0.98] tracking-tight">
                One clip.
                <br />
                <span style={{
                  backgroundImage: 'linear-gradient(90deg, #7dd3fc 0%, #f97316 50%, #fdba74 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}>
                  Infinite angles.
                </span>
              </h1>
              <p className="mt-7 text-lg text-sky-300/70 leading-relaxed font-body">
                Cinematic 360° aerial footage from Central Queensland — shot on the DJI Avata 360. Buy the raw master for your NLE, or reframe it into your own cut in the browser. Every lens, every angle, every direction: yours.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-4">
                <Link to="/browse" className="btn-ember text-base px-8 py-4">
                  Browse clips <ArrowRight className="w-5 h-5" />
                </Link>
                <Link to="/edit" className="btn-ghost text-base px-7 py-4 border-sky-600/40">
                  Try the editor — free
                </Link>
              </div>
              <div className="mt-12 flex items-start gap-12">
                {[
                  ['360°', 'SPHERICAL SOURCE'],
                  ['5.7K', 'CAPTURE · 4K OUT'],
                  ['∞', 'REFRAME ANGLES'],
                ].map(([big, small]) => (
                  <div key={small}>
                    <div className="font-display font-bold text-3xl text-white">{big}</div>
                    <div className="mt-1 text-[10px] font-mono text-sky-400 tracking-[0.3em]">{small}</div>
                  </div>
                ))}
              </div>
            </div>
            {/* Right: viewport — real clip if we have one, procedural showcase otherwise */}
            <div className="w-full lg:w-[580px]">
              <div className="relative aspect-[4/3] rounded-3xl overflow-hidden border border-sky-600/50 shadow-[0_30px_100px_-30px_rgba(0,0,0,0.8)] bg-[#0d1a38]">
                {heroClipUrl ? (
                  <video
                    key={heroClipUrl}
                    src={heroClipUrl}
                    poster={heroPoster || undefined}
                    autoPlay
                    muted
                    loop
                    playsInline
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : (
                  <FpvShowcase />
                )}
                {/* HUD */}
                <div className="absolute top-5 left-5 z-10 pointer-events-none">
                  <div className="text-[10px] font-mono text-ember-400 tracking-[0.3em]">{heroClipUrl ? 'PREVIEW · LIVE' : 'FPV · LIVE DEMO'}</div>
                  <div className="mt-1 font-display font-semibold text-lg text-white drop-shadow-lg">{heroLocation}</div>
                </div>
                {/* watermark badge */}
                <div className="absolute bottom-4 right-4 z-10 pointer-events-none text-[11px] font-mono text-white/40">skystock.pages.dev</div>
                {/* Gradient vignette so HUD reads clean over bright footage */}
                {heroClipUrl && (
                  <div className="absolute inset-0 pointer-events-none z-[5]"
                    style={{ background: 'linear-gradient(180deg, rgba(10,14,26,0.55) 0%, transparent 25%, transparent 70%, rgba(10,14,26,0.55) 100%)' }}
                  />
                )}
              </div>
              <div className="mt-3 flex items-center justify-between text-xs">
                <div className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-full bg-ember-500/14 border border-ember-500/40">
                  <span className="text-[10px] font-mono text-ember-300 tracking-[0.25em]">LIVE</span>
                  <span className="text-sky-100 font-medium">Reframing in the browser</span>
                </div>
                <div className="text-[10px] font-mono text-sky-400 tracking-[0.3em]">CLIP 01 of 148</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ====== AVATA 360 SPEC STRIP ====== */}
      <section className="border-y border-sky-800/30 bg-[#0e1426]">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 py-10 flex flex-wrap items-center justify-center gap-x-12 gap-y-6">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-full border-2 border-ember-500"
              style={{ background: 'radial-gradient(circle at center, #f97316 0%, #571f08 100%)' }}
            />
            <div>
              <div className="text-[10px] font-mono text-sky-400 tracking-[0.3em]">SHOT ON</div>
              <div className="font-display font-bold text-white text-lg">DJI Avata 360</div>
            </div>
          </div>
          <div className="hidden sm:block w-px h-10 bg-sky-800/50" />
          {[
            ['SENSOR', '1/1.3" CMOS'],
            ['CAPTURE', '5.7K · 60 fps'],
            ['PROFILE', 'D-Log M 10-bit'],
            ['FIELD OF VIEW', '360° Spherical'],
            ['RESOLUTION', 'Dual 4K lenses'],
          ].map(([label, val]) => (
            <div key={label}>
              <div className="text-[10px] font-mono text-sky-400 tracking-[0.3em]">{label}</div>
              <div className="mt-0.5 font-display font-semibold text-white">{val}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ====== FEATURE GRID ====== */}
      <section className="max-w-7xl mx-auto px-6 lg:px-12 py-24">
        <div className="text-center mb-14 max-w-3xl mx-auto">
          <div className="text-[11px] font-mono text-ember-400 tracking-[0.35em]">BECAUSE THE SOURCE IS 360°</div>
          <h2 className="mt-3 font-display font-bold text-4xl lg:text-5xl text-white leading-tight">
            The camera captured everything. You pick the shot.
          </h2>
          <p className="mt-4 text-sky-400/70 text-lg leading-relaxed">
            Every feature below rides on one simple fact: the Avata 360 records the full sphere. We give you every angle, projection, speed, and grade inside one browser editor.
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { kicker: 'REFRAME', icon: Wand2, title: 'Drag to pick your angle',
              desc: 'Every clip is a full 360° sphere. Drag the preview to aim wherever the shot wanted to go — the camera already had it covered.',
              grad: 'linear-gradient(135deg,#f97316,#3b6cb5)' },
            { kicker: 'LENS MODES', icon: Aperture, title: '5 projections, one click',
              desc: 'Wide, Ultra Wide, FPV, Asteroid (tiny planet), Rabbit Hole (sky tunnel). Switch lenses on the same source, no re-shoot.',
              grad: 'linear-gradient(135deg,#7dd3fc,#2c477a)' },
            { kicker: 'TRACKING', icon: Crosshair, title: 'Shift-click a subject',
              desc: 'Tell the editor where to aim at three or four moments. It interpolates smooth camera keyframes between them — instant subject tracking.',
              grad: 'linear-gradient(135deg,#8cb259,#f97316)' },
            { kicker: 'SPEED', icon: Gauge, title: '0.25× slo-mo → 4× hyperlapse',
              desc: 'Ramp the same 60 fps source into heroic slow-motion or urgent fast-cuts. Speed bakes into export.',
              grad: 'linear-gradient(135deg,#33c199,#0d4066)' },
            { kicker: 'GRADE', icon: Palette, title: 'D-Log M → Rec.709 in shader',
              desc: 'One slider de-logs flat DJI footage. Full colourist grade (exposure / highlights / shadows / tint / vibrance) with a single Auto button.',
              grad: 'linear-gradient(135deg,#fba55a,#5a1a66)' },
            { kicker: 'EXPORT', icon: Monitor, title: '9:16 TikTok · 1:1 IG · 16:9',
              desc: 'Same 360° source, three aspect ratios. TikTok, Reels, Shorts, YouTube, Instagram — one-click swap, clean MP4 per format.',
              grad: 'linear-gradient(135deg,#7dd3fc,#f97316 50%,#fdba74)' },
          ].map(f => {
            const Icon = f.icon;
            return (
              <div key={f.kicker} className="glass-card p-8 group hover:border-sky-500/40 transition-colors">
                <div className="w-32 h-20 rounded-xl relative overflow-hidden mb-6" style={{ background: f.grad }}>
                  {heroPoster && (
                    <img
                      src={heroPoster}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover opacity-55 mix-blend-luminosity"
                    />
                  )}
                  <div className="absolute inset-0" style={{ background: f.grad, opacity: heroPoster ? 0.55 : 0 }} />
                  <Icon className="absolute bottom-3 right-3 w-6 h-6 text-white drop-shadow-lg" />
                </div>
                <div className="text-[10px] font-mono text-ember-400 tracking-[0.35em]">{f.kicker}</div>
                <h3 className="mt-3 font-display font-semibold text-white text-xl leading-snug">{f.title}</h3>
                <p className="mt-3 text-sm text-sky-400/80 leading-relaxed">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ====== LATEST CLIPS ====== */}
      {latestVideos.length > 0 && (
        <section className="max-w-7xl mx-auto px-6 lg:px-12 pb-16">
          <div className="flex items-center justify-between mb-8">
            <div>
              <div className="text-[11px] font-mono text-ember-400 tracking-[0.35em]">LATEST UPLOADS</div>
              <h2 className="mt-2 font-display font-bold text-3xl text-white">Fresh off the drone</h2>
            </div>
            <Link to="/browse" className="btn-ghost text-sm">View all <ArrowRight className="w-4 h-4" /></Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {latestVideos.map(v => <VideoCard key={v.id} video={v} />)}
          </div>
        </section>
      )}

      {/* ====== HOW IT WORKS ====== */}
      <section className="bg-[#0e1426] border-y border-sky-800/30 py-24">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="text-center mb-14">
            <div className="text-[11px] font-mono text-ember-400 tracking-[0.35em]">HOW IT WORKS</div>
            <h2 className="mt-3 font-display font-bold text-4xl text-white">From clip to export in under two minutes</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              ['01', 'Pick a clip', 'Browse the library filtered by location, tags, lens angle. Every clip ships with a free reframe preview.'],
              ['02', 'Reframe', "Drag the viewport to aim. Pick a motion preset, tweak a lens, set keyframes if you want to track a subject."],
              ['03', 'Grade & cut', 'D-Log slider brings the colour back. Trim to the highlight. Add music from the library. Pick 9:16 / 1:1 / 16:9.'],
              ['04', 'Export', 'Watermarked preview is free. $4.99 buys the clean MP4 to your inbox. $29.99 buys the raw 360° master for your NLE.'],
            ].map(([n, title, desc]) => (
              <div key={n} className="glass-card p-7">
                <div className="font-display font-extrabold text-5xl" style={{
                  backgroundImage: 'linear-gradient(180deg,#f97316 0%,rgba(249,115,22,0.2) 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}>{n}</div>
                <h3 className="mt-4 font-display font-semibold text-white text-lg">{title}</h3>
                <p className="mt-2 text-sm text-sky-400/80 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ====== PRICING ====== */}
      <section className="max-w-7xl mx-auto px-6 lg:px-12 py-24">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <div className="text-[11px] font-mono text-ember-400 tracking-[0.35em]">SIMPLE PRICING</div>
          <h2 className="mt-3 font-display font-bold text-4xl text-white">Pay for the cut you actually want</h2>
          <p className="mt-4 text-sky-400/70 text-base leading-relaxed">No subscriptions. No gotchas. Preview for free, then decide whether you want the clean edit or the raw 360° master.</p>
        </div>
        <div className="grid lg:grid-cols-3 gap-6 items-stretch">
          {[
            {
              kicker: 'FREE', price: '$0', note: 'watermarked preview', title: 'Preview export', cta: 'Start free', accent: false,
              bullets: ['1080p MP4 at 9:16, 1:1 or 16:9', 'Full editor access (reframe, lens, color, speed, music, title)', '"skystock.pages.dev" watermark bottom-right', 'Great for socials with attribution'],
            },
            {
              kicker: 'MOST POPULAR', price: '$4.99', note: 'AUD · per clean edit', title: 'Clean edit', cta: 'Buy clean edit', accent: true,
              bullets: ['Everything in Free, with no watermark', 'Delivered to your inbox when the render finishes', 'Commercial use of your edited cut', 'Re-edit the same source as many times as you like'],
            },
            {
              kicker: 'FOR PROS', price: '$29.99', note: 'AUD · one-time', title: 'Raw 360° master', cta: 'Get the raw master', accent: false,
              bullets: ['Full 5.7K equirectangular MP4', 'D-Log M 10-bit profile, untouched', 'Take it into Premiere / Resolve / Insta360 Studio', 'Unlimited exports from the file, forever'],
            },
          ].map(t => (
            <div key={t.title}
              className={
                'rounded-3xl p-9 flex flex-col ' +
                (t.accent ? 'border-2 border-ember-500 bg-[#141d36] shadow-[0_24px_80px_-20px_rgba(249,115,22,0.25)]' : 'glass-card')
              }>
              <div className={'text-[11px] font-mono tracking-[0.3em] ' + (t.accent ? 'text-ember-400' : 'text-sky-400')}>{t.kicker}</div>
              <div className="mt-4 flex items-baseline gap-2">
                <span className={'font-display font-extrabold text-5xl ' + (t.accent ? 'text-ember-400' : 'text-white')}>{t.price}</span>
                <span className="text-sm text-sky-400/60 font-medium">{t.note}</span>
              </div>
              <h3 className="mt-2 font-display font-semibold text-white text-xl">{t.title}</h3>
              <ul className="mt-5 space-y-2.5 text-sm text-sky-400/80 leading-relaxed flex-1">
                {t.bullets.map(b => (
                  <li key={b} className="flex gap-2.5 items-start">
                    <Check className={'w-4 h-4 mt-0.5 flex-shrink-0 ' + (t.accent ? 'text-ember-400' : 'text-sky-400')} />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
              <Link to="/browse" className={
                'mt-7 rounded-xl text-sm font-medium py-3.5 text-center transition-colors ' +
                (t.accent ? 'bg-ember-500 hover:bg-ember-400 text-white' : 'border border-sky-700/50 text-white hover:bg-sky-800/40')
              }>
                {t.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
