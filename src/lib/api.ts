import type { Video, Order, DashboardStats, UploadPayload } from './types';

const API_BASE = '/api';

async function getClerkToken(): Promise<string | null> {
  try {
    const clerk = (window as any).Clerk;
    if (!clerk?.session) return null;
    const token = await clerk.session.getToken();
    return token || null;
  } catch {
    return null;
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string> | undefined),
  };

  // Admin + Seller endpoints need a Clerk session bearer. Attach automatically so every
  // caller (createVideo, uploadVideoFile, confirm-upload, dashboard, orders, settings,
  // seller apply, seller uploads) is authed without passing the token through by hand.
  if (path.startsWith('/admin/') || path.startsWith('/seller/')) {
    const token = await getClerkToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: 'Request failed' }));
    throw new Error((body as { message?: string }).message || `HTTP ${res.status}`);
  }

  return res.json();
}

// ---- Public API ----

export async function getPublishedVideos(params?: {
  search?: string;
  tag?: string;
  sort?: string;
  page?: number;
  limit?: number;
}): Promise<{ videos: Video[]; total: number }> {
  const query = new URLSearchParams();
  if (params?.search) query.set('search', params.search);
  if (params?.tag) query.set('tag', params.tag);
  if (params?.sort) query.set('sort', params.sort);
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));
  return request(`/videos?${query}`);
}

export async function getVideo(id: string): Promise<Video> {
  return request(`/videos/${id}`);
}

export async function recordView(id: string): Promise<void> {
  await request(`/videos/${id}/view`, { method: 'POST' });
}

// ---- PayPal ----

export async function createPayPalOrder(videoId: string, buyerEmail: string): Promise<{ orderId: string; paypalOrderId: string }> {
  return request('/paypal/create-order', {
    method: 'POST',
    body: JSON.stringify({ videoId, buyerEmail }),
  });
}

export async function capturePayPalOrder(paypalOrderId: string, orderId: string): Promise<{ success: boolean; downloadToken: string }> {
  return request('/paypal/capture-order', {
    method: 'POST',
    body: JSON.stringify({ paypalOrderId, orderId }),
  });
}

// ---- Downloads ----

export async function validateDownload(token: string): Promise<{ valid: boolean; video: Video; remainingDownloads: number }> {
  return request(`/download/validate?token=${token}`);
}

export async function getDownloadUrl(token: string): Promise<{ url: string }> {
  return request(`/download/url?token=${token}`);
}

// ---- Admin API ----

export async function getAdminDashboard(): Promise<DashboardStats> {
  return request('/admin/dashboard');
}

export async function getAdminRevenue(): Promise<{ months: { month: string; total: number }[] }> {
  return request('/admin/dashboard/revenue');
}

export async function getAdminVideos(params?: {
  status?: string;
  page?: number;
}): Promise<{ videos: Video[]; total: number }> {
  const query = new URLSearchParams();
  if (params?.status) query.set('status', params.status);
  if (params?.page) query.set('page', String(params.page));
  return request(`/admin/videos?${query}`);
}

export async function getAdminVideo(id: string): Promise<Video> {
  return request(`/admin/videos/${id}`);
}

export async function createVideo(data: UploadPayload): Promise<Video> {
  return request('/admin/videos', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateVideo(id: string, data: Partial<UploadPayload>): Promise<Video> {
  return request(`/admin/videos/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteVideo(id: string): Promise<void> {
  await request(`/admin/videos/${id}`, { method: 'DELETE' });
}

export async function publishVideo(id: string): Promise<Video> {
  return request(`/admin/videos/${id}/publish`, { method: 'POST' });
}

export async function unpublishVideo(id: string): Promise<Video> {
  return request(`/admin/videos/${id}/unpublish`, { method: 'POST' });
}

export async function toggleFeatured(id: string): Promise<Video> {
  return request(`/admin/videos/${id}/feature`, { method: 'POST' });
}

export async function repairVideo(id: string): Promise<{
  videoId: string;
  report: Record<string, { found: boolean; key?: string; size?: number; skipped?: string }>;
}> {
  return request(`/admin/videos/${id}/repair`, { method: 'POST' });
}

// ---- Seller uploads (mirrors admin flow but hits /seller/* endpoints; enforces
//      ownership on the backend). Status is always pending_review after createSellerVideo. ----

export async function createSellerVideo(data: UploadPayload): Promise<Video> {
  return request('/seller/videos', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function uploadSellerVideoFile(
  videoId: string,
  file: File,
  type: 'original' | 'preview' | 'thumbnail',
  onProgress?: (pct: number) => void
): Promise<{ key: string; url: string }> {
  const { uploadUrl, key, contentType } = await request<{ uploadUrl: string; key: string; contentType: string }>(
    `/seller/videos/${videoId}/upload-url`,
    {
      method: 'POST',
      body: JSON.stringify({
        type,
        filename: file.name,
        contentType: file.type,
        size: file.size,
      }),
    }
  );
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    });
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed: ${xhr.status}`));
    });
    xhr.addEventListener('error', () => reject(new Error('Upload failed')));
    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('Content-Type', contentType);
    xhr.send(file);
  });
  await request(`/seller/videos/${videoId}/confirm-upload`, {
    method: 'POST',
    body: JSON.stringify({ type, key }),
  });
  return { key, url: uploadUrl };
}

export async function uploadVideoFile(
  videoId: string,
  file: File,
  type: 'original' | 'preview' | 'thumbnail',
  onProgress?: (pct: number) => void
): Promise<{ key: string; url: string }> {
  const { uploadUrl, key, contentType } = await request<{ uploadUrl: string; key: string; contentType: string }>(
    `/admin/videos/${videoId}/upload-url`,
    {
      method: 'POST',
      body: JSON.stringify({
        type,
        filename: file.name,
        contentType: file.type,
        size: file.size,
      }),
    }
  );

  // PUT directly to R2 via presigned URL
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed: ${xhr.status} ${xhr.responseText}`));
    });
    xhr.addEventListener('error', () => reject(new Error('Upload failed')));
    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('Content-Type', contentType);
    xhr.send(file);
  });

  // Record the key + size in D1 via worker
  await request(`/admin/videos/${videoId}/confirm-upload`, {
    method: 'POST',
    body: JSON.stringify({ type, key }),
  });

  return { key, url: uploadUrl };
}

export async function getAdminOrders(params?: {
  status?: string;
  page?: number;
}): Promise<{ orders: Order[]; total: number }> {
  const query = new URLSearchParams();
  if (params?.status) query.set('status', params.status);
  if (params?.page) query.set('page', String(params.page));
  return request(`/admin/orders?${query}`);
}

export async function refundOrder(id: string): Promise<Order> {
  return request(`/admin/orders/${id}/refund`, { method: 'POST' });
}
