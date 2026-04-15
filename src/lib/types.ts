export interface Video {
  id: string;
  title: string;
  description: string;
  location: string;
  tags: string[];
  price_cents: number;
  duration_seconds: number;
  resolution: string;
  fps: number;
  file_size_bytes: number;
  preview_key: string;
  watermarked_key: string;
  original_key: string;
  thumbnail_key: string;
  status: 'draft' | 'published' | 'archived';
  download_count: number;
  view_count: number;
  featured: boolean;
  created_at: string;
  updated_at: string;
  // Computed URLs
  preview_url?: string;
  watermarked_url?: string;
  thumbnail_url?: string;
}

export interface Order {
  id: string;
  video_id: string;
  buyer_email: string;
  buyer_name: string;
  paypal_order_id: string;
  paypal_capture_id: string;
  amount_cents: number;
  currency: string;
  status: 'pending' | 'completed' | 'refunded' | 'failed';
  created_at: string;
  completed_at: string;
  // Joined
  video?: Video;
}

export interface DownloadToken {
  id: string;
  order_id: string;
  video_id: string;
  token: string;
  expires_at: string;
  download_count: number;
  max_downloads: number;
  created_at: string;
}

export interface DashboardStats {
  total_videos: number;
  published_videos: number;
  total_orders: number;
  total_revenue_cents: number;
  total_downloads: number;
  recent_orders: Order[];
  top_videos: Video[];
  revenue_by_month: { month: string; revenue: number }[];
}

export interface UploadPayload {
  title: string;
  description: string;
  location: string;
  tags: string[];
  price_cents: number;
  resolution: string;
  fps: number;
  status: 'draft' | 'published';
}

export function formatPrice(cents: number, currency = 'AUD'): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency,
  }).format(cents / 100);
}

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function generateId(): string {
  return crypto.randomUUID?.() || 
    'xxxx-xxxx-xxxx'.replace(/x/g, () => Math.floor(Math.random() * 16).toString(16));
}
