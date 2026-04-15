import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, SlidersHorizontal, X, Grid3X3, LayoutGrid } from 'lucide-react';
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
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [location, setLocation] = useState('All Locations');
  const [sort, setSort] = useState('newest');
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await getPublishedVideos({ search, sort });
        setVideos(data.videos);
      } catch {
        let filtered = [...DEMO_VIDEOS];
        if (search) {
          const q = search.toLowerCase();
          filtered = filtered.filter(v =>
            v.title.toLowerCase().includes(q) ||
            v.description.toLowerCase().includes(q) ||
            v.tags.some(t => t.includes(q))
          );
        }
        if (location !== 'All Locations') {
          filtered = filtered.filter(v => v.location.includes(location));
        }
        if (sort === 'price_low') filtered.sort((a, b) => a.price_cents - b.price_cents);
        if (sort === 'price_high') filtered.sort((a, b) => b.price_cents - a.price_cents);
        if (sort === 'popular') filtered.sort((a, b) => b.download_count - a.download_count);
        if (sort === 'newest') filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setVideos(filtered);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [search, location, sort]);

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
        </button>
      </div>

      {/* Expanded Filters */}
      {filtersOpen && (
        <div className="glass-card p-6 mb-8 animate-fade-in">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-mono text-sky-400 uppercase mb-2">Location</label>
              <select
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="input-field"
              >
                {LOCATIONS.map(loc => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-mono text-sky-400 uppercase mb-2">Sort By</label>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="input-field"
              >
                {SORT_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Results count */}
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-sky-500">
          {videos.length} clip{videos.length !== 1 ? 's' : ''} found
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
      ) : videos.length === 0 ? (
        <div className="text-center py-20">
          <Search className="w-12 h-12 text-sky-700 mx-auto mb-4" />
          <h3 className="font-display font-semibold text-xl text-sky-300 mb-2">No clips found</h3>
          <p className="text-sky-500">Try adjusting your search or filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {videos.map((video) => (
            <VideoCard key={video.id} video={video} />
          ))}
        </div>
      )}
    </div>
  );
}
