import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, SlidersHorizontal, X, ChevronLeft, ChevronRight } from 'lucide-react';
import VideoCard from '../components/VideoCard';
import { getPublishedVideos } from '../lib/api';
import type { Video } from '../lib/types';

const LOCATIONS = ['All Locations', 'Rockhampton', 'Yeppoon', 'Emerald', 'Gladstone', 'Mackay', 'Byfield', 'Mount Morgan'];
const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'price_low', label: 'Price: Low to High' },
  { value: 'price_high', label: 'Price: High to Low' },
  { value: 'popular', label: 'Most Popular' },
  { value: 'featured', label: 'Featured' },
];
const RESOLUTIONS = ['All', '4K', '2.7K', '1080p'];
const DURATION_OPTIONS = [
  { value: 'all', label: 'Any Duration' },
  { value: 'short', label: 'Under 30s' },
  { value: 'medium', label: '30s – 60s' },
  { value: 'long', label: 'Over 60s' },
];
const PRICE_OPTIONS = [
  { value: 'all', label: 'Any Price' },
  { value: 'under25', label: 'Under $25' },
  { value: '25to40', label: '$25 – $40' },
  { value: 'over40', label: 'Over $40' },
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

  // Read initial state from URL params
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [location, setLocation] = useState(searchParams.get('location') || 'All Locations');
  const [sort, setSort] = useState(searchParams.get('sort') || 'newest');
  const [resolution, setResolution] = useState(searchParams.get('resolution') || 'All');
  const [duration, setDuration] = useState(searchParams.get('duration') || 'all');
  const [price, setPrice] = useState(searchParams.get('price') || 'all');
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1', 10));
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Sync filters to URL params
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

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [search, location, sort, resolution, duration, price]);

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

  // Client-side filtering (server doesn't support all filters yet)
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

  // Sorting for demo fallback (API handles sort for real data)
  const sorted = [...filtered];
  if (sort === 'price_low') sorted.sort((a, b) => a.price_cents - b.price_cents);
  else if (sort === 'price_high') sorted.sort((a, b) => b.price_cents - a.price_cents);
  else if (sort === 'popular') sorted.sort((a, b) => b.download_count - a.download_count);
  else if (sort === 'oldest') sorted.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  else if (sort === 'featured') sorted.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
  else sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // Pagination
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
    <div className="page-enter max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-display font-bold text-3xl text-white">Browse Footage</h1>
        <p className="text-sky-400 mt-1">Premium FPV clips from across Central Queensland</p>
      </div>

      {/* Search & Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-sky-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search footage... (e.g. coast, sunset, rainforest)"
            className="input-field pl-12"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-sky-500 hover:text-sky-300">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <button
          onClick={() => setFiltersOpen(!filtersOpen)}
          className={`btn-ghost ${filtersOpen ? 'bg-sky-800/40 border-sky-500/40' : ''}`}
        >
          <SlidersHorizontal className="w-4 h-4" /> Filters
          {activeFilterCount > 0 && (
            <span className="ml-1.5 w-5 h-5 rounded-full bg-ember-500 text-white text-xs flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Expanded Filters */}
      {filtersOpen && (
        <div className="glass-card p-6 mb-8 animate-fade-in">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <label className="block text-xs font-mono text-sky-400 uppercase mb-2">Location</label>
              <select value={location} onChange={(e) => setLocation(e.target.value)} className="input-field">
                {LOCATIONS.map(loc => <option key={loc} value={loc}>{loc}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-mono text-sky-400 uppercase mb-2">Resolution</label>
              <select value={resolution} onChange={(e) => setResolution(e.target.value)} className="input-field">
                {RESOLUTIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-mono text-sky-400 uppercase mb-2">Duration</label>
              <select value={duration} onChange={(e) => setDuration(e.target.value)} className="input-field">
                {DURATION_OPTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-mono text-sky-400 uppercase mb-2">Price Range</label>
              <select value={price} onChange={(e) => setPrice(e.target.value)} className="input-field">
                {PRICE_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
          </div>
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-sky-700/20">
            <div>
              <label className="block text-xs font-mono text-sky-400 uppercase mb-2">Sort By</label>
              <select value={sort} onChange={(e) => setSort(e.target.value)} className="input-field w-auto">
                {SORT_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </div>
            {activeFilterCount > 0 && (
              <button onClick={clearFilters} className="btn-ghost text-sm">
                <X className="w-3.5 h-3.5" /> Clear all filters
              </button>
            )}
          </div>
        </div>
      )}

      {/* Results count */}
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-sky-500">
          {sorted.length} clip{sorted.length !== 1 ? 's' : ''} found
          {sorted.length > PER_PAGE && (
            <span className="ml-1">· Page {safePage} of {totalPages}</span>
          )}
        </p>
      </div>

      {/* Video Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="glass-card overflow-hidden">
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {paginatedVideos.map((video) => (
            <VideoCard key={video.id} video={video} />
          ))}
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && !loading && (
        <div className="flex items-center justify-center gap-2 mt-10">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={safePage <= 1}
            className="btn-ghost disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" /> Previous
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
                  <span key={`e${i}`} className="px-2 text-sky-600">...</span>
                ) : (
                  <button
                    key={item}
                    onClick={() => setPage(item)}
                    className={`w-10 h-10 rounded-xl text-sm font-display font-medium transition-all ${
                      safePage === item
                        ? 'bg-sky-600 text-white'
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
            className="btn-ghost disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
