import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, X, ChevronLeft, ChevronRight, Sparkles, SlidersHorizontal } from 'lucide-react';
import VideoCard from '../components/VideoCard';
import { getPublishedVideos } from '../lib/api';
import type { Video } from '../lib/types';

const LOCATIONS = ['All Locations', 'Rockhampton', 'Yeppoon', 'Emerald', 'Gladstone', 'Mackay', 'Byfield', 'Mount Morgan'];
const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'price_low', label: 'Price ↑' },
  { value: 'price_high', label: 'Price ↓' },
  { value: 'popular', label: 'Popular' },
  { value: 'featured', label: 'Featured' },
];
const RESOLUTIONS = ['All', '4K', '2.7K', '1080p'];
const DURATION_OPTIONS = [
  { value: 'all', label: 'Any Length' },
  { value: 'short', label: '<30s' },
  { value: 'medium', label: '30–60s' },
  { value: 'long', label: '60s+' },
];
const PRICE_OPTIONS = [
  { value: 'all', label: 'Any Price' },
  { value: 'under25', label: 'Under $25' },
  { value: '25to40', label: '$25–$40' },
  { value: 'over40', label: '$40+' },
];
const PER_PAGE = 12;

const DEMO_VIDEOS: Video[] = [
  { id: '1', title: 'Sunrise Over The Gemfields', description: 'Golden hour FPV sweep across the sapphire mining fields of Central QLD', location: 'Emerald, QLD', tags: ['sunrise', 'mining', 'golden-hour'], price_cents: 3999, duration_seconds: 47, resolution: '4K', fps: 60, file_size_bytes: 524288000, preview_key: '', watermarked_key: '', original_key: '', thumbnail_key: '', status: 'published', download_count: 24, view_count: 312, featured: true, created_at: '2025-01-15', updated_at: '2025-01-15' },
  { id: '2', title: 'Reef Coastline Rush', description: 'Low-altitude coastal run following the breaking waves along Yeppoon foreshore', location: 'Yeppoon, QLD', tags: ['coast', 'waves', 'ocean'], price_cents: 2999, duration_seconds: 35, resolution: '4K', fps: 60, file_size_bytes: 412000000, preview_key: '', watermarked_key: '', original_key: '', thumbnail_key: '', status: 'published', download_count: 41, view_count: 589, featured: true, created_at: '2025-01-20', updated_at: '2025-01-20' },
  { id: '3', title: 'Cane Fields at Dusk', description: 'Sweeping dive through sugar cane fields as the sun sets over the Mackay hinterland', location: 'Mackay, QLD', tags: ['farming', 'sunset', 'rural'], price_cents: 2499, duration_seconds: 52, resolution: '4K', fps: 60, file_size_bytes: 610000000, preview_key: '', watermarked_key: '', original_key: '', thumbnail_key: '', status: 'published', download_count: 18, view_count: 203, featured: false, created_at: '2025-02-01', updated_at: '2025-02-01' },
  { id: '4', title: 'Rocky Outback Circuit', description: 'High-speed FPV circuit around Mount Archer lookout with panoramic valley views', location: 'Rockhampton, QLD', tags: ['outback', 'mountain', 'panoramic'], price_cents: 3499, duration_seconds: 40, resolution: '4K', fps: 60, file_size_bytes: 480000000, preview_key: '', watermarked_key: '', original_key: '', thumbnail_key: '', status: 'published', download_count: 33, view_count: 410, featured: false, created_at: '2025-02-10', updated_at: '2025-02-10' },
  { id: '5', title: 'Stockyard Creek Dive', description: 'Immersive proximity flight through ancient rainforest canopy along the creek bed', location: 'Byfield, QLD', tags: ['rainforest', 'creek', 'nature'], price_cents: 3999, duration_seconds: 58, resolution: '4K', fps: 60, file_size_bytes: 720000000, preview_key: '', watermarked_key: '', original_key: '', thumbnail_key: '', status: 'published', download_count: 56, view_count: 724, featured: true, created_at: '2025-02-14', updated_at: '2025-02-14' },
  { id: '6', title: 'Harbour City Orbit', description: 'Smooth orbital shot around Gladstone harbour showcasing industrial and natural beauty', location: 'Gladstone, QLD', tags: ['harbour', 'industrial', 'city'], price_cents: 2999, duration_seconds: 44, resolution: '4K', fps: 60, file_size_bytes: 520000000, preview_key: '', watermarked_key: '', original_key: '', thumbnail_key: '', status: 'published', download_count: 12, view_count: 165, featured: false, created_at: '2025-02-20', updated_at: '2025-02-20' },
  { id: '7', title: 'Mount Etna Cave Approach', description: 'Dramatic FPV approach through limestone karst landscape toward bat caves at golden hour', location: 'Rockhampton, QLD', tags: ['caves', 'limestone', 'golden-hour'], price_cents: 4499, duration_seconds: 62, resolution: '4K', fps: 60, file_size_bytes: 780000000, preview_key: '', watermarked_key: '', original_key: '', thumbnail_key: '', status: 'published', download_count: 29, view_count: 387, featured: false, created_at: '2025-03-01', updated_at: '2025-03-01' },
  { id: '8', title: 'Keppel Island Flyover', description: 'Crystal-clear waters and white sand beaches from an immersive FPV perspective', location: 'Yeppoon, QLD', tags: ['island', 'beach', 'tropical'], price_cents: 4999, duration_seconds: 71, resolution: '4K', fps: 60, file_size_bytes: 890000000, preview_key: '', watermarked_key: '', original_key: '', thumbnail_key: '', status: 'published', download_count: 67, view_count: 912, featured: true, created_at: '2025-03-05', updated_at: '2025-03-05' },
];

export default function Browse() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [allVideos, setAllVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [location, setLocation] = useState(searchParams.get('location') || 'All Locations');
  const [sort, setSort] = useState(searchParams.get('sort') || 'newest');
  const [resolution, setResolution] = useState(searchParams.get('resolution') || 'All');
  const [duration, setDuration] = useState(searchParams.get('duration') || 'all');
  const [price, setPrice] = useState(searchParams.get('price') || 'all');
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1', 10));
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const syncParams = useCallback(() => {
    const params: Record<string, string> = {};
    if (search) params.q = search;
    if (location !== 'All Locations') params.location = location;
    if (sort !== 'newest') params.sort = sort;
    if (resolution !== 'All') params.resolution = resolution;
    if (duration !== 'all') params.duration = duration;
    if (price !== 'all') params.price = price;
    if (page > 1) params.page = String(page);
    setSearchParams(params, { replace: true });
  }, [search, location, sort, resolution, duration, price, page, setSearchParams]);

  useEffect(() => { syncParams(); }, [syncParams]);
  useEffect(() => { setPage(1); }, [search, location, sort, resolution, duration, price]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await getPublishedVideos({ search, sort });
        setAllVideos(data.videos);
      } catch {
        setAllVideos(DEMO_VIDEOS);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [search, sort]);

  const filtered = allVideos.filter(v => {
    if (location !== 'All Locations' && !v.location?.includes(location)) return false;
    if (resolution !== 'All' && v.resolution !== resolution) return false;
    if (duration === 'short' && v.duration_seconds >= 30) return false;
    if (duration === 'medium' && (v.duration_seconds < 30 || v.duration_seconds > 60)) return false;
    if (duration === 'long' && v.duration_seconds <= 60) return false;
    if (price === 'under25' && v.price_cents >= 2500) return false;
    if (price === '25to40' && (v.price_cents < 2500 || v.price_cents > 4000)) return false;
    if (price === 'over40' && v.price_cents <= 4000) return false;
    return true;
  });

  const sorted = [...filtered];
  if (sort === 'price_low') sorted.sort((a, b) => a.price_cents - b.price_cents);
  else if (sort === 'price_high') sorted.sort((a, b) => b.price_cents - a.price_cents);
  else if (sort === 'popular') sorted.sort((a, b) => b.download_count - a.download_count);
  else if (sort === 'oldest') sorted.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  else if (sort === 'featured') sorted.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
  else sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const totalPages = Math.max(1, Math.ceil(sorted.length / PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const paginatedVideos = sorted.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);

  const activeFilterCount = [
    location !== 'All Locations',
    resolution !== 'All',
    duration !== 'all',
    price !== 'all',
  ].filter(Boolean).length;

  function clearFilters() {
    setSearch('');
    setLocation('All Locations');
    setSort('newest');
    setResolution('All');
    setDuration('all');
    setPrice('all');
  }

  return (
    <div className="page-enter">
      {/* Hero header with motion streaks */}
      <div className="relative overflow-hidden pb-8 pt-12"
        style={{
          background: 'linear-gradient(180deg, rgba(20,29,54,0.9), rgba(10,14,26,0) 100%)',
        }}
      >
        <div className="absolute inset-0 pointer-events-none opacity-50">
          {Array.from({ length: 14 }).map((_, i) => {
            const top = (i * 41) % 100;
            const left = (i * 67) % 100;
            const width = 160 + (i * 17) % 260;
            const rotate = -15 + (i * 5) % 30;
            const hue = i % 3 === 0 ? '#f97316' : i % 3 === 1 ? '#38bdf8' : '#7dd3fc';
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  top: `${top}%`,
                  left: `${left}%`,
                  width: `${width}px`,
                  height: '1.5px',
                  background: `linear-gradient(90deg, transparent, ${hue}55, transparent)`,
                  transform: `rotate(${rotate}deg)`,
                  filter: 'blur(0.5px)',
                }}
              />
            );
          })}
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-ember-400 mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            Library · DJI Avata 360
          </div>
          <h1 className="font-display font-bold text-4xl md:text-5xl text-white leading-none tracking-tight">
            One clip.{' '}
            <span
              style={{
                backgroundImage: 'linear-gradient(90deg, #7dd3fc 0%, #f97316 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              Any angle.
            </span>
          </h1>
          <p className="text-sky-400 mt-3 max-w-xl">
            Raw 360° footage from across Central Queensland. Download as-is, or reframe every angle in our editor.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        {/* Search bar */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-sky-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search: coast, sunset, rainforest, caves…"
              className="w-full pl-12 pr-10 py-3.5 rounded-2xl bg-sky-900/40 border border-sky-700/30 text-white placeholder:text-sky-600 focus:outline-none focus:border-ember-400/60 focus:bg-sky-900/60 transition-all"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-sky-500 hover:text-sky-300">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            onClick={() => setAdvancedOpen(!advancedOpen)}
            className={`flex items-center gap-2 px-4 py-3.5 rounded-2xl border text-sm font-display transition-all ${
              advancedOpen
                ? 'bg-ember-500/15 border-ember-400/40 text-ember-300'
                : 'bg-sky-900/40 border-sky-700/30 text-sky-300 hover:bg-sky-900/60'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            Advanced
            {activeFilterCount > 0 && (
              <span className="ml-1 w-5 h-5 rounded-full bg-ember-500 text-white text-[10px] flex items-center justify-center font-bold">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Sort chips row */}
        <div className="flex flex-wrap gap-2 mb-5">
          <span className="text-xs uppercase tracking-wider text-sky-600 self-center mr-1">Sort</span>
          {SORT_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setSort(opt.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-display font-medium transition-all ${
                sort === opt.value
                  ? 'bg-gradient-to-r from-sky-500 to-ember-500 text-white shadow-lg shadow-ember-500/20'
                  : 'bg-sky-900/40 border border-sky-700/30 text-sky-400 hover:text-white hover:bg-sky-900/60'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Location chips row */}
        <div className="flex flex-wrap gap-2 mb-6">
          <span className="text-xs uppercase tracking-wider text-sky-600 self-center mr-1">Place</span>
          {LOCATIONS.map(loc => (
            <button
              key={loc}
              onClick={() => setLocation(loc)}
              className={`px-3 py-1.5 rounded-full text-xs font-display font-medium transition-all ${
                location === loc
                  ? 'bg-sky-500/25 border border-sky-400/50 text-white'
                  : 'bg-sky-900/40 border border-sky-700/30 text-sky-400 hover:text-white hover:bg-sky-900/60'
              }`}
            >
              {loc === 'All Locations' ? 'All' : loc}
            </button>
          ))}
        </div>

        {/* Advanced filters panel */}
        {advancedOpen && (
          <div
            className="rounded-2xl p-5 mb-6 animate-fade-in"
            style={{
              background: 'linear-gradient(180deg, rgba(20,29,54,0.7), rgba(10,14,26,0.85))',
              border: '1px solid rgba(59,108,181,0.25)',
            }}
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-[11px] font-mono text-sky-500 uppercase mb-2 tracking-wider">Resolution</label>
                <div className="flex flex-wrap gap-1.5">
                  {RESOLUTIONS.map(r => (
                    <button
                      key={r}
                      onClick={() => setResolution(r)}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-mono transition-all ${
                        resolution === r
                          ? 'bg-ember-500/25 border border-ember-400/50 text-ember-200'
                          : 'bg-sky-900/30 border border-sky-700/30 text-sky-400 hover:text-white'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-mono text-sky-500 uppercase mb-2 tracking-wider">Duration</label>
                <div className="flex flex-wrap gap-1.5">
                  {DURATION_OPTIONS.map(d => (
                    <button
                      key={d.value}
                      onClick={() => setDuration(d.value)}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-mono transition-all ${
                        duration === d.value
                          ? 'bg-ember-500/25 border border-ember-400/50 text-ember-200'
                          : 'bg-sky-900/30 border border-sky-700/30 text-sky-400 hover:text-white'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-mono text-sky-500 uppercase mb-2 tracking-wider">Price</label>
                <div className="flex flex-wrap gap-1.5">
                  {PRICE_OPTIONS.map(p => (
                    <button
                      key={p.value}
                      onClick={() => setPrice(p.value)}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-mono transition-all ${
                        price === p.value
                          ? 'bg-ember-500/25 border border-ember-400/50 text-ember-200'
                          : 'bg-sky-900/30 border border-sky-700/30 text-sky-400 hover:text-white'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {activeFilterCount > 0 && (
              <div className="flex justify-end mt-4 pt-4 border-t border-sky-700/20">
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1.5 text-xs text-sky-400 hover:text-ember-400 transition-colors"
                >
                  <X className="w-3 h-3" /> Clear all filters
                </button>
              </div>
            )}
          </div>
        )}

        {/* Results count */}
        <div className="flex items-center justify-between mb-5">
          <p className="text-sm text-sky-500">
            <span className="text-white font-display font-semibold">{sorted.length}</span> clip{sorted.length !== 1 ? 's' : ''}
            {sorted.length > PER_PAGE && (
              <span className="ml-1">· Page {safePage} of {totalPages}</span>
            )}
          </p>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="rounded-3xl overflow-hidden" style={{ background: 'rgba(20,29,54,0.5)', border: '1px solid rgba(59,108,181,0.2)' }}>
                <div className="aspect-video bg-sky-800/20 animate-pulse" />
                <div className="p-4 space-y-3">
                  <div className="h-5 w-3/4 bg-sky-800/20 rounded animate-pulse" />
                  <div className="h-4 w-full bg-sky-800/15 rounded animate-pulse" />
                  <div className="h-4 w-1/2 bg-sky-800/15 rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : paginatedVideos.length === 0 ? (
          <div className="text-center py-20">
            <Search className="w-12 h-12 text-sky-700 mx-auto mb-4" />
            <h3 className="font-display font-semibold text-xl text-sky-300 mb-2">No clips found</h3>
            <p className="text-sky-500 mb-4">Try adjusting your search or filters</p>
            {activeFilterCount > 0 && (
              <button onClick={clearFilters} className="btn-ghost">Clear all filters</button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {paginatedVideos.map((video) => (
              <VideoCard key={video.id} video={video} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && !loading && (
          <div className="flex items-center justify-center gap-2 mt-12">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-sky-900/40 border border-sky-700/30 text-sky-300 text-sm hover:bg-sky-900/60 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" /> Prev
            </button>

            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 2)
                .reduce<(number | 'ellipsis')[]>((acc, p, i, arr) => {
                  if (i > 0 && p - (arr[i - 1]) > 1) acc.push('ellipsis');
                  acc.push(p);
                  return acc;
                }, [])
                .map((item, i) =>
                  item === 'ellipsis' ? (
                    <span key={`e${i}`} className="px-2 text-sky-600">…</span>
                  ) : (
                    <button
                      key={item}
                      onClick={() => setPage(item)}
                      className={`w-10 h-10 rounded-xl text-sm font-display font-semibold transition-all ${
                        safePage === item
                          ? 'bg-gradient-to-r from-sky-500 to-ember-500 text-white shadow-lg shadow-ember-500/30'
                          : 'text-sky-400 hover:bg-sky-800/40 hover:text-white'
                      }`}
                    >
                      {item}
                    </button>
                  )
                )}
            </div>

            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-sky-900/40 border border-sky-700/30 text-sky-300 text-sm hover:bg-sky-900/60 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
