import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Play, Camera, Shield, Zap, MapPin, ChevronRight } from 'lucide-react';
import VideoCard from '../components/VideoCard';
import { getPublishedVideos } from '../lib/api';
import type { Video } from '../lib/types';

export default function Home() {
  const [featuredVideos, setFeaturedVideos] = useState<Video[]>([]);
  const [latestVideos, setLatestVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [featured, latest] = await Promise.all([
          getPublishedVideos({ sort: 'featured', limit: 3 }),
          getPublishedVideos({ sort: 'newest', limit: 6 }),
        ]);
        setFeaturedVideos(featured.videos);
        setLatestVideos(latest.videos);
      } catch {
        // Demo data when API isn't connected
        const demoVideos: Video[] = [
          { id: '1', title: 'Sunrise Over The Gemfields', description: 'Golden hour FPV sweep across the sapphire mining fields of Central QLD', location: 'Emerald, QLD', tags: ['sunrise', 'mining', 'golden-hour'], price_cents: 3999, duration_seconds: 47, resolution: '4K', fps: 60, file_size_bytes: 524288000, preview_key: '', watermarked_key: '', original_key: '', thumbnail_key: '', status: 'published', download_count: 24, view_count: 312, featured: true, created_at: '2025-01-15', updated_at: '2025-01-15' },
          { id: '2', title: 'Reef Coastline Rush', description: 'Low-altitude coastal run following the breaking waves along Yeppoon foreshore', location: 'Yeppoon, QLD', tags: ['coast', 'waves', 'ocean'], price_cents: 2999, duration_seconds: 35, resolution: '4K', fps: 60, file_size_bytes: 412000000, preview_key: '', watermarked_key: '', original_key: '', thumbnail_key: '', status: 'published', download_count: 41, view_count: 589, featured: true, created_at: '2025-01-20', updated_at: '2025-01-20' },
          { id: '3', title: 'Cane Fields at Dusk', description: 'Sweeping dive through sugar cane fields as the sun sets over the Mackay hinterland', location: 'Mackay, QLD', tags: ['farming', 'sunset', 'rural'], price_cents: 2499, duration_seconds: 52, resolution: '4K', fps: 60, file_size_bytes: 610000000, preview_key: '', watermarked_key: '', original_key: '', thumbnail_key: '', status: 'published', download_count: 18, view_count: 203, featured: false, created_at: '2025-02-01', updated_at: '2025-02-01' },
          { id: '4', title: 'Rocky Outback Circuit', description: 'High-speed FPV circuit around Mount Archer lookout with panoramic valley views', location: 'Rockhampton, QLD', tags: ['outback', 'mountain', 'panoramic'], price_cents: 3499, duration_seconds: 40, resolution: '4K', fps: 60, file_size_bytes: 480000000, preview_key: '', watermarked_key: '', original_key: '', thumbnail_key: '', status: 'published', download_count: 33, view_count: 410, featured: false, created_at: '2025-02-10', updated_at: '2025-02-10' },
          { id: '5', title: 'Stockyard Creek Dive', description: 'Immersive proximity flight through ancient rainforest canopy along the creek bed', location: 'Byfield, QLD', tags: ['rainforest', 'creek', 'nature'], price_cents: 3999, duration_seconds: 58, resolution: '4K', fps: 60, file_size_bytes: 720000000, preview_key: '', watermarked_key: '', original_key: '', thumbnail_key: '', status: 'published', download_count: 56, view_count: 724, featured: true, created_at: '2025-02-14', updated_at: '2025-02-14' },
          { id: '6', title: 'Harbour City Orbit', description: 'Smooth orbital shot around Gladstone harbour showcasing industrial and natural beauty', location: 'Gladstone, QLD', tags: ['harbour', 'industrial', 'city'], price_cents: 2999, duration_seconds: 44, resolution: '4K', fps: 60, file_size_bytes: 520000000, preview_key: '', watermarked_key: '', original_key: '', thumbnail_key: '', status: 'published', download_count: 12, view_count: 165, featured: false, created_at: '2025-02-20', updated_at: '2025-02-20' },
        ];
        setFeaturedVideos(demoVideos.filter(v => v.featured));
        setLatestVideos(demoVideos);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="page-enter">
      {/* Hero Section */}
      <section className="relative hero-gradient overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28 lg:py-36">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 mb-6">
              <span className="px-3 py-1.5 rounded-full bg-ember-500/15 text-ember-400 text-xs font-mono font-medium border border-ember-500/25">
                DJI Avata 360 · Central QLD
              </span>
            </div>

            <h1 className="font-display font-extrabold text-4xl sm:text-5xl lg:text-6xl text-white leading-[1.1] tracking-tight">
              Stock FPV footage
              <br />
              <span className="bg-gradient-to-r from-sky-400 via-sky-300 to-ember-400 bg-clip-text text-transparent">
                that moves.
              </span>
            </h1>

            <p className="mt-6 text-lg sm:text-xl text-sky-300/80 leading-relaxed max-w-xl font-body">
              Full 360° spherical FPV footage you can reframe to any angle in post.
              One clip, infinite final cuts — captured on the DJI Avata 360
              across Central Queensland's most stunning landscapes.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link to="/browse" className="btn-ember text-base px-8 py-4">
                <Play className="w-5 h-5" /> Browse Footage
              </Link>
              <a href="#how-it-works" className="btn-ghost text-base px-6 py-4">
                How it works <ArrowRight className="w-4 h-4" />
              </a>
            </div>

            {/* Stats */}
            <div className="mt-12 flex items-center gap-8 text-sm">
              <div>
                <span className="font-display font-bold text-2xl text-white">360°</span>
                <span className="block text-sky-500 mt-0.5">Spherical Source</span>
              </div>
              <div className="w-px h-10 bg-sky-700/30" />
              <div>
                <span className="font-display font-bold text-2xl text-white">4K</span>
                <span className="block text-sky-500 mt-0.5">Reframed Output</span>
              </div>
              <div className="w-px h-10 bg-sky-700/30" />
              <div>
                <span className="font-display font-bold text-2xl text-white">∞</span>
                <span className="block text-sky-500 mt-0.5">Reframe Angles</span>
              </div>
            </div>
          </div>
        </div>

        {/* Decorative elements */}
        <div className="absolute top-20 right-10 w-72 h-72 bg-sky-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-40 w-48 h-48 bg-ember-500/5 rounded-full blur-3xl" />
      </section>

      {/* Featured Videos */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="font-display font-bold text-2xl text-white">Featured Clips</h2>
            <p className="text-sky-500 mt-1">Hand-picked aerial masterpieces</p>
          </div>
          <Link to="/browse" className="btn-ghost text-sm">
            View all <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="glass-card aspect-video animate-pulse bg-sky-800/20" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredVideos.map((video) => (
              <VideoCard key={video.id} video={video} featured />
            ))}
          </div>
        )}
      </section>

      {/* Latest Clips */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="font-display font-bold text-2xl text-white">Latest Uploads</h2>
            <p className="text-sky-500 mt-1">Fresh footage hot off the drone</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {latestVideos.map((video) => (
            <VideoCard key={video.id} video={video} />
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <h2 className="font-display font-bold text-3xl text-white">How It Works</h2>
          <p className="text-sky-400 mt-2">Three steps to stunning aerial footage</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              icon: <Play className="w-7 h-7" />,
              title: 'Preview',
              description: 'Browse the library and watch watermarked flat-frame samples. Every piece is a 360° spherical master shot on the DJI Avata 360 across Central QLD.',
              color: 'from-sky-500 to-sky-600',
            },
            {
              icon: <Shield className="w-7 h-7" />,
              title: 'Purchase',
              description: 'Pay securely via PayPal. One-time purchase with a royalty-free license for unlimited commercial and personal use.',
              color: 'from-emerald-500 to-emerald-600',
            },
            {
              icon: <Zap className="w-7 h-7" />,
              title: 'Download & Reframe',
              description: 'Grab the full 360° master (up to 5 downloads per purchase). Drop it into Insta360 Studio, Adobe Premiere, DaVinci Resolve or any 360-capable editor and compose any angle — your cut, your story.',
              color: 'from-ember-500 to-amber-500',
            },
          ].map((step, i) => (
            <div key={i} className="glass-card p-8 text-center group hover:border-sky-500/30 transition-all duration-300">
              <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${step.color} flex items-center justify-center mx-auto mb-5 text-white group-hover:scale-110 transition-transform`}>
                {step.icon}
              </div>
              <h3 className="font-display font-semibold text-lg text-white mb-3">{step.title}</h3>
              <p className="text-sm text-sky-400 leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Location callout */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="glass-card p-8 md:p-12 flex flex-col md:flex-row items-center gap-8 overflow-hidden relative">
          <div className="absolute top-0 right-0 w-64 h-64 bg-ember-500/5 rounded-full blur-3xl" />
          <div className="flex-1 relative z-10">
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="w-5 h-5 text-ember-400" />
              <span className="font-display font-medium text-ember-400">Central Queensland, Australia</span>
            </div>
            <h2 className="font-display font-bold text-2xl md:text-3xl text-white mb-4">
              Perspectives from the heart of Queensland
            </h2>
            <p className="text-sky-400 leading-relaxed mb-6">
              From the rugged outback ranges to pristine coastlines, sugar cane fields to the gem
              fields — every clip captures a unique slice of Central QLD as a full 360° spherical
              master, ready for you to reframe into whichever angle tells your story.
            </p>
            <div className="flex flex-wrap gap-2">
              {['Rockhampton', 'Yeppoon', 'Emerald', 'Gladstone', 'Mackay', 'Byfield', 'Mount Morgan'].map(loc => (
                <span key={loc} className="px-3 py-1 rounded-full bg-sky-800/40 text-xs font-mono text-sky-300 border border-sky-700/20">
                  {loc}
                </span>
              ))}
            </div>
          </div>
          <div className="w-full md:w-80 h-52 rounded-2xl bg-gradient-to-br from-sky-700/30 to-ember-500/10 flex items-center justify-center">
            <Camera className="w-16 h-16 text-sky-600" />
          </div>
        </div>
      </section>
    </div>
  );
}
