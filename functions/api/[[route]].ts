import { Hono } from 'hono';
import { cors } from 'hono/cors';

interface Env {
  DB: D1Database;
  R2: R2Bucket;
  CLERK_SECRET_KEY: string;
  PAYPAL_CLIENT_ID: string;
  PAYPAL_CLIENT_SECRET: string;
  RESEND_API_KEY: string;
  RESEND_FROM_EMAIL: string;
  ADMIN_USER_IDS: string;
  SITE_URL: string;
  SITE_NAME: string;
  UPLOAD_API_KEY?: string;
}

const app = new Hono<{ Bindings: Env }>().basePath('/api');

app.use('*', cors());

// ============================
// HELPERS
// ============================

function generateId() {
  return crypto.randomUUID();
}

async function getPayPalAccessToken(env: Env): Promise<string> {
  const auth = btoa(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`);
  const res = await fetch('https://api-m.sandbox.paypal.com/v1/oauth2/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  const data = await res.json() as any;
  return data.access_token;
}

async function verifyAdmin(req: Request, env: Env): Promise<boolean> {
  // Verify Clerk session token
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return false;

  try {
    // Simple Clerk session verification
    // In production, use Clerk's JWT verification with JWKS
    const token = authHeader.slice(7);
    const res = await fetch('https://api.clerk.com/v1/sessions/verify', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.CLERK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token }),
    });
    if (!res.ok) return false;

    const session = await res.json() as any;
    const adminIds = env.ADMIN_USER_IDS?.split(',') || [];
    return adminIds.includes(session.user_id);
  } catch {
    return false;
  }
}

async function sendDownloadEmail(env: Env, to: string, videoTitle: string, token: string) {
  const downloadUrl = `${env.SITE_URL}/download?token=${token}`;
  const siteName = env.SITE_NAME || 'SkyStock FPV';

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `${siteName} <${env.RESEND_FROM_EMAIL || 'noreply@skystock.com'}>`,
      to: [to],
      subject: `Your Download is Ready — ${videoTitle}`,
      html: `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#060a14;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#060a14;padding:40px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
  <!-- Header -->
  <tr><td style="padding:24px 32px;text-align:center;">
    <h1 style="margin:0;font-size:22px;font-weight:700;color:#7db4e8;letter-spacing:1px;">${siteName}</h1>
  </td></tr>
  <!-- Main Card -->
  <tr><td style="background:linear-gradient(145deg,#0f1628,#141d36);border:1px solid rgba(59,108,181,0.25);border-radius:16px;padding:40px 32px;">
    <!-- Icon -->
    <div style="text-align:center;margin-bottom:24px;">
      <div style="display:inline-block;width:64px;height:64px;line-height:64px;border-radius:50%;background:rgba(16,185,129,0.12);font-size:28px;text-align:center;">✅</div>
    </div>
    <h2 style="margin:0 0 8px;text-align:center;font-size:24px;font-weight:700;color:#e8edf5;">Your Download is Ready</h2>
    <p style="margin:0 0 24px;text-align:center;font-size:15px;color:#7b8fad;">Thank you for your purchase!</p>
    <!-- Video Card -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(10,14,26,0.6);border:1px solid rgba(59,108,181,0.15);border-radius:12px;margin-bottom:24px;">
    <tr><td style="padding:16px 20px;">
      <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#4a6a94;font-weight:600;">Purchased Footage</p>
      <p style="margin:0;font-size:17px;font-weight:600;color:#e8edf5;">${videoTitle}</p>
    </td></tr></table>
    <!-- CTA Button -->
    <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:8px 0 24px;">
      <a href="${downloadUrl}" style="display:inline-block;padding:16px 40px;background:linear-gradient(135deg,#f97316,#eab308);color:#0a0e1a;text-decoration:none;border-radius:12px;font-size:16px;font-weight:700;letter-spacing:0.3px;">
        Download Full Video
      </a>
    </td></tr></table>
    <!-- Details -->
    <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid rgba(59,108,181,0.15);padding-top:20px;">
    <tr>
      <td style="padding:8px 0;font-size:13px;color:#4a6a94;width:50%;">⬇️ Download limit</td>
      <td style="padding:8px 0;font-size:13px;color:#c8d4e6;text-align:right;">5 downloads</td>
    </tr>
    <tr>
      <td style="padding:8px 0;font-size:13px;color:#4a6a94;">⏰ Link expires</td>
      <td style="padding:8px 0;font-size:13px;color:#c8d4e6;text-align:right;">72 hours</td>
    </tr>
    <tr>
      <td style="padding:8px 0;font-size:13px;color:#4a6a94;">📦 Format</td>
      <td style="padding:8px 0;font-size:13px;color:#c8d4e6;text-align:right;">Full unwatermarked 4K MP4</td>
    </tr>
    <tr>
      <td style="padding:8px 0;font-size:13px;color:#4a6a94;">📜 License</td>
      <td style="padding:8px 0;font-size:13px;color:#c8d4e6;text-align:right;">Royalty-free</td>
    </tr>
    </table>
  </td></tr>
  <!-- Footer -->
  <tr><td style="padding:24px 32px;text-align:center;">
    <p style="margin:0 0 8px;font-size:12px;color:#3a4d6e;">If the button doesn't work, copy this link:</p>
    <p style="margin:0 0 16px;font-size:11px;color:#4a6a94;word-break:break-all;">${downloadUrl}</p>
    <p style="margin:0;font-size:11px;color:#2a3a54;">${siteName} — Premium FPV aerial footage from Central Queensland, Australia</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`,
    }),
  });
}

async function sendReceiptEmail(env: Env, to: string, videoTitle: string, amountCents: number, currency: string, orderId: string, token: string) {
  const downloadUrl = `${env.SITE_URL}/download?token=${token}`;
  const siteName = env.SITE_NAME || 'SkyStock FPV';
  const amount = (amountCents / 100).toFixed(2);

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `${siteName} <${env.RESEND_FROM_EMAIL || 'noreply@skystock.com'}>`,
      to: [to],
      subject: `Receipt — ${siteName} Purchase #${orderId.slice(0, 8)}`,
      html: `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#060a14;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#060a14;padding:40px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
  <tr><td style="padding:24px 32px;text-align:center;">
    <h1 style="margin:0;font-size:22px;font-weight:700;color:#7db4e8;letter-spacing:1px;">${siteName}</h1>
  </td></tr>
  <tr><td style="background:linear-gradient(145deg,#0f1628,#141d36);border:1px solid rgba(59,108,181,0.25);border-radius:16px;padding:40px 32px;">
    <div style="text-align:center;margin-bottom:24px;">
      <div style="display:inline-block;width:64px;height:64px;line-height:64px;border-radius:50%;background:rgba(16,185,129,0.12);font-size:28px;text-align:center;">🧾</div>
    </div>
    <h2 style="margin:0 0 8px;text-align:center;font-size:24px;font-weight:700;color:#e8edf5;">Purchase Receipt</h2>
    <p style="margin:0 0 24px;text-align:center;font-size:15px;color:#7b8fad;">Here's your receipt for this purchase.</p>
    <!-- Receipt Table -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(10,14,26,0.6);border:1px solid rgba(59,108,181,0.15);border-radius:12px;margin-bottom:24px;">
    <tr><td style="padding:16px 20px;">
      <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="padding:8px 0;font-size:13px;color:#4a6a94;">Order ID</td>
        <td style="padding:8px 0;font-size:13px;color:#c8d4e6;text-align:right;font-family:monospace;">${orderId.slice(0, 8)}...</td>
      </tr>
      <tr>
        <td style="padding:8px 0;font-size:13px;color:#4a6a94;">Video</td>
        <td style="padding:8px 0;font-size:13px;color:#e8edf5;text-align:right;font-weight:600;">${videoTitle}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;font-size:13px;color:#4a6a94;">License</td>
        <td style="padding:8px 0;font-size:13px;color:#c8d4e6;text-align:right;">Royalty-free</td>
      </tr>
      <tr style="border-top:1px solid rgba(59,108,181,0.15);">
        <td style="padding:12px 0 4px;font-size:15px;color:#e8edf5;font-weight:700;">Total</td>
        <td style="padding:12px 0 4px;font-size:15px;color:#f97316;text-align:right;font-weight:700;">$${amount} ${currency}</td>
      </tr>
      </table>
    </td></tr></table>
    <p style="margin:0;text-align:center;font-size:13px;color:#7b8fad;">Payment processed securely via PayPal.</p>
  </td></tr>
  <tr><td style="padding:24px 32px;text-align:center;">
    <a href="${downloadUrl}" style="font-size:13px;color:#5a9ce6;text-decoration:underline;">Go to your download</a>
    <p style="margin:16px 0 0;font-size:11px;color:#2a3a54;">${siteName} — Premium FPV aerial footage from Central Queensland, Australia</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`,
    }),
  });
}

function getR2PublicUrl(key: string): string {
  // In production, use a custom domain or R2 public bucket URL
  return `/api/media/${key}`;
}

// ============================
// PUBLIC: VIDEOS
// ============================

app.get('/videos', async (c) => {
  const { search, tag, sort, page = '1', limit = '12' } = c.req.query();
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let where = "status = 'published'";
  const params: any[] = [];

  if (search) {
    where += " AND (title LIKE ? OR description LIKE ? OR location LIKE ?)";
    const s = `%${search}%`;
    params.push(s, s, s);
  }
  if (tag) {
    where += " AND tags LIKE ?";
    params.push(`%${tag}%`);
  }

  let orderBy = 'created_at DESC';
  if (sort === 'popular') orderBy = 'download_count DESC';
  if (sort === 'price_low') orderBy = 'price_cents ASC';
  if (sort === 'price_high') orderBy = 'price_cents DESC';
  if (sort === 'featured') orderBy = 'featured DESC, created_at DESC';
  if (sort === 'newest') orderBy = 'created_at DESC';

  const countResult = await c.env.DB.prepare(`SELECT COUNT(*) as total FROM videos WHERE ${where}`).bind(...params).first() as any;
  const total = countResult?.total || 0;

  const videos = await c.env.DB.prepare(
    `SELECT * FROM videos WHERE ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`
  ).bind(...params, parseInt(limit), offset).all();

  const videosWithUrls = videos.results.map((v: any) => ({
    ...v,
    tags: JSON.parse(v.tags || '[]'),
    featured: !!v.featured,
    thumbnail_url: v.thumbnail_key ? getR2PublicUrl(v.thumbnail_key) : null,
    watermarked_url: v.watermarked_key ? getR2PublicUrl(v.watermarked_key) : null,
    preview_url: v.preview_key ? getR2PublicUrl(v.preview_key) : null,
  }));

  return c.json({ videos: videosWithUrls, total });
});

app.get('/videos/:id', async (c) => {
  const video = await c.env.DB.prepare('SELECT * FROM videos WHERE id = ? AND status = ?').bind(c.req.param('id'), 'published').first();
  if (!video) return c.json({ message: 'Video not found' }, 404);

  return c.json({
    ...video,
    tags: JSON.parse((video as any).tags || '[]'),
    featured: !!(video as any).featured,
    thumbnail_url: (video as any).thumbnail_key ? getR2PublicUrl((video as any).thumbnail_key) : null,
    watermarked_url: (video as any).watermarked_key ? getR2PublicUrl((video as any).watermarked_key) : null,
    preview_url: (video as any).preview_key ? getR2PublicUrl((video as any).preview_key) : null,
  });
});

app.post('/videos/:id/view', async (c) => {
  await c.env.DB.prepare('UPDATE videos SET view_count = view_count + 1 WHERE id = ?').bind(c.req.param('id')).run();
  return c.json({ ok: true });
});

// ============================
// PUBLIC: MEDIA (R2 proxy)
// ============================

app.get('/media/:key{.+}', async (c) => {
  const key = c.req.param('key');
  const object = await c.env.R2.get(key);
  if (!object) return c.json({ message: 'Not found' }, 404);

  const headers = new Headers();
  headers.set('Content-Type', object.httpMetadata?.contentType || 'application/octet-stream');
  headers.set('Cache-Control', 'public, max-age=3600');

  return new Response(object.body, { headers });
});

// ============================
// PAYPAL
// ============================

app.post('/paypal/create-order', async (c) => {
  const { videoId, buyerEmail } = await c.req.json();

  const video = await c.env.DB.prepare('SELECT * FROM videos WHERE id = ? AND status = ?').bind(videoId, 'published').first() as any;
  if (!video) return c.json({ message: 'Video not found' }, 404);

  const priceStr = (video.price_cents / 100).toFixed(2);
  const orderId = generateId();

  // Create DB order
  await c.env.DB.prepare(
    'INSERT INTO orders (id, video_id, buyer_email, amount_cents, currency, status) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(orderId, videoId, buyerEmail, video.price_cents, 'AUD', 'pending').run();

  // Create PayPal order
  const token = await getPayPalAccessToken(c.env);
  const ppRes = await fetch('https://api-m.sandbox.paypal.com/v2/checkout/orders', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [{
        reference_id: `video_${videoId}`,
        description: `SkyStock FPV: ${video.title}`,
        amount: { currency_code: 'AUD', value: priceStr },
      }],
    }),
  });

  const ppOrder = await ppRes.json() as any;

  // Update order with PayPal ID
  await c.env.DB.prepare('UPDATE orders SET paypal_order_id = ? WHERE id = ?').bind(ppOrder.id, orderId).run();

  return c.json({ orderId, paypalOrderId: ppOrder.id });
});

app.post('/paypal/capture-order', async (c) => {
  const { paypalOrderId, orderId } = await c.req.json();

  const token = await getPayPalAccessToken(c.env);
  const captureRes = await fetch(`https://api-m.sandbox.paypal.com/v2/checkout/orders/${paypalOrderId}/capture`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });

  const captureData = await captureRes.json() as any;

  if (captureData.status !== 'COMPLETED') {
    return c.json({ message: 'Payment not completed' }, 400);
  }

  const captureId = captureData.purchase_units?.[0]?.payments?.captures?.[0]?.id || '';

  // Update order
  await c.env.DB.prepare(
    "UPDATE orders SET status = 'completed', paypal_capture_id = ?, completed_at = datetime('now') WHERE id = ?"
  ).bind(captureId, orderId).run();

  // Update video download count
  const order = await c.env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(orderId).first() as any;

  await c.env.DB.prepare('UPDATE videos SET download_count = download_count + 1 WHERE id = ?').bind(order.video_id).run();

  // Create download token
  const downloadToken = generateId();
  const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();

  await c.env.DB.prepare(
    'INSERT INTO download_tokens (id, order_id, video_id, token, expires_at, max_downloads) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(generateId(), orderId, order.video_id, downloadToken, expiresAt, 5).run();

  // Send emails (download link + receipt)
  const video = await c.env.DB.prepare('SELECT title FROM videos WHERE id = ?').bind(order.video_id).first() as any;
  try {
    await Promise.all([
      sendDownloadEmail(c.env, order.buyer_email, video.title, downloadToken),
      sendReceiptEmail(c.env, order.buyer_email, video.title, order.amount_cents, order.currency || 'AUD', orderId, downloadToken),
    ]);
  } catch (e) {
    console.error('Email send failed:', e);
  }

  return c.json({ success: true, downloadToken });
});

// ============================
// DOWNLOADS
// ============================

app.get('/download/validate', async (c) => {
  const token = c.req.query('token');
  if (!token) return c.json({ message: 'Token required' }, 400);

  const dl = await c.env.DB.prepare('SELECT * FROM download_tokens WHERE token = ?').bind(token).first() as any;
  if (!dl) return c.json({ valid: false, message: 'Invalid token' }, 404);

  if (new Date(dl.expires_at) < new Date()) {
    return c.json({ valid: false, message: 'Token expired' });
  }
  if (dl.download_count >= dl.max_downloads) {
    return c.json({ valid: false, message: 'Download limit reached' });
  }

  const video = await c.env.DB.prepare('SELECT * FROM videos WHERE id = ?').bind(dl.video_id).first() as any;

  return c.json({
    valid: true,
    video: {
      ...video,
      tags: JSON.parse(video.tags || '[]'),
      thumbnail_url: video.thumbnail_key ? getR2PublicUrl(video.thumbnail_key) : null,
    },
    remainingDownloads: dl.max_downloads - dl.download_count,
  });
});

app.get('/download/url', async (c) => {
  const token = c.req.query('token');
  if (!token) return c.json({ message: 'Token required' }, 400);

  const dl = await c.env.DB.prepare('SELECT * FROM download_tokens WHERE token = ?').bind(token).first() as any;
  if (!dl) return c.json({ message: 'Invalid token' }, 404);

  if (new Date(dl.expires_at) < new Date()) return c.json({ message: 'Token expired' }, 410);
  if (dl.download_count >= dl.max_downloads) return c.json({ message: 'Download limit reached' }, 410);

  const video = await c.env.DB.prepare('SELECT original_key, title FROM videos WHERE id = ?').bind(dl.video_id).first() as any;
  if (!video?.original_key) return c.json({ message: 'File not found' }, 404);

  // Increment download count
  await c.env.DB.prepare('UPDATE download_tokens SET download_count = download_count + 1 WHERE token = ?').bind(token).run();

  // Return direct download URL (with filename hint)
  const slug = video.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const ext = video.original_key.split('.').pop() || 'mp4';
  return c.json({ url: `/api/download/file/${token}`, filename: `skystock-${slug}.${ext}` });
});

// Direct file delivery with proper download headers
app.get('/download/file/:token', async (c) => {
  const token = c.req.param('token');

  const dl = await c.env.DB.prepare('SELECT * FROM download_tokens WHERE token = ?').bind(token).first() as any;
  if (!dl) return c.json({ message: 'Invalid token' }, 404);

  if (new Date(dl.expires_at) < new Date()) return c.json({ message: 'Token expired' }, 410);
  if (dl.download_count >= dl.max_downloads) return c.json({ message: 'Download limit reached' }, 410);

  const video = await c.env.DB.prepare('SELECT original_key, title FROM videos WHERE id = ?').bind(dl.video_id).first() as any;
  if (!video?.original_key) return c.json({ message: 'File not found' }, 404);

  const object = await c.env.R2.get(video.original_key);
  if (!object) return c.json({ message: 'File not found in storage' }, 404);

  const slug = video.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const ext = video.original_key.split('.').pop() || 'mp4';
  const filename = `skystock-${slug}.${ext}`;

  const headers = new Headers();
  headers.set('Content-Type', object.httpMetadata?.contentType || 'video/mp4');
  headers.set('Content-Disposition', `attachment; filename="${filename}"`);
  headers.set('Content-Length', String(object.size));
  headers.set('Cache-Control', 'no-store');

  return new Response(object.body, { headers });
});

// ============================
// ADMIN
// ============================

// Admin auth middleware (supports Clerk session token or API key)
app.use('/admin/*', async (c, next) => {
  // Check for API key auth (for CLI upload tool)
  const apiKey = c.req.header('X-API-Key');
  if (apiKey && c.env.UPLOAD_API_KEY && apiKey === c.env.UPLOAD_API_KEY) {
    await next();
    return;
  }
  // Fall back to Clerk session auth
  const isAdmin = await verifyAdmin(c.req.raw, c.env);
  if (!isAdmin) return c.json({ message: 'Unauthorized' }, 401);
  await next();
});

app.get('/admin/dashboard', async (c) => {
  const [totalVideos, publishedVideos, totalOrders, revenue, downloads, recentOrders, topVideos] = await Promise.all([
    c.env.DB.prepare("SELECT COUNT(*) as c FROM videos WHERE status != 'archived'").first() as any,
    c.env.DB.prepare("SELECT COUNT(*) as c FROM videos WHERE status = 'published'").first() as any,
    c.env.DB.prepare("SELECT COUNT(*) as c FROM orders WHERE status = 'completed'").first() as any,
    c.env.DB.prepare("SELECT COALESCE(SUM(amount_cents), 0) as total FROM orders WHERE status = 'completed'").first() as any,
    c.env.DB.prepare('SELECT COALESCE(SUM(download_count), 0) as total FROM videos').first() as any,
    c.env.DB.prepare("SELECT o.*, v.title as video_title FROM orders o LEFT JOIN videos v ON o.video_id = v.id ORDER BY o.created_at DESC LIMIT 10").all(),
    c.env.DB.prepare("SELECT * FROM videos WHERE status = 'published' ORDER BY download_count DESC LIMIT 5").all(),
  ]);

  return c.json({
    total_videos: totalVideos?.c || 0,
    published_videos: publishedVideos?.c || 0,
    total_orders: totalOrders?.c || 0,
    total_revenue_cents: revenue?.total || 0,
    total_downloads: downloads?.total || 0,
    recent_orders: recentOrders.results,
    top_videos: topVideos.results.map((v: any) => ({ ...v, tags: JSON.parse(v.tags || '[]'), featured: !!v.featured })),
  });
});

app.get('/admin/videos', async (c) => {
  const { status, page = '1' } = c.req.query();
  const limit = 20;
  const offset = (parseInt(page) - 1) * limit;

  let where = "status != 'archived'";
  const params: any[] = [];
  if (status && status !== 'all') {
    where = 'status = ?';
    params.push(status);
  }

  const total = await c.env.DB.prepare(`SELECT COUNT(*) as c FROM videos WHERE ${where}`).bind(...params).first() as any;
  const videos = await c.env.DB.prepare(
    `SELECT * FROM videos WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).bind(...params, limit, offset).all();

  return c.json({
    videos: videos.results.map((v: any) => ({
      ...v,
      tags: JSON.parse(v.tags || '[]'),
      featured: !!v.featured,
      thumbnail_url: v.thumbnail_key ? getR2PublicUrl(v.thumbnail_key) : null,
    })),
    total: total?.c || 0,
  });
});

app.get('/admin/videos/:id', async (c) => {
  const video = await c.env.DB.prepare('SELECT * FROM videos WHERE id = ?').bind(c.req.param('id')).first();
  if (!video) return c.json({ message: 'Not found' }, 404);
  return c.json({ ...video, tags: JSON.parse((video as any).tags || '[]'), featured: !!(video as any).featured });
});

app.post('/admin/videos', async (c) => {
  const data = await c.req.json();
  const id = generateId();
  await c.env.DB.prepare(
    `INSERT INTO videos (id, title, description, location, tags, price_cents, resolution, fps, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, data.title, data.description || '', data.location || '', JSON.stringify(data.tags || []),
    data.price_cents, data.resolution || '4K', data.fps || 60, data.status || 'draft').run();

  const video = await c.env.DB.prepare('SELECT * FROM videos WHERE id = ?').bind(id).first();
  return c.json(video, 201);
});

app.put('/admin/videos/:id', async (c) => {
  const data = await c.req.json();
  const id = c.req.param('id');
  await c.env.DB.prepare(
    `UPDATE videos SET title = ?, description = ?, location = ?, tags = ?, price_cents = ?,
     resolution = ?, fps = ?, status = ?, updated_at = datetime('now') WHERE id = ?`
  ).bind(data.title, data.description || '', data.location || '', JSON.stringify(data.tags || []),
    data.price_cents, data.resolution, data.fps, data.status, id).run();

  const video = await c.env.DB.prepare('SELECT * FROM videos WHERE id = ?').bind(id).first();
  return c.json(video);
});

app.delete('/admin/videos/:id', async (c) => {
  await c.env.DB.prepare("UPDATE videos SET status = 'archived', updated_at = datetime('now') WHERE id = ?").bind(c.req.param('id')).run();
  return c.json({ ok: true });
});

app.post('/admin/videos/:id/publish', async (c) => {
  await c.env.DB.prepare("UPDATE videos SET status = 'published', updated_at = datetime('now') WHERE id = ?").bind(c.req.param('id')).run();
  const video = await c.env.DB.prepare('SELECT * FROM videos WHERE id = ?').bind(c.req.param('id')).first();
  return c.json(video);
});

app.post('/admin/videos/:id/unpublish', async (c) => {
  await c.env.DB.prepare("UPDATE videos SET status = 'draft', updated_at = datetime('now') WHERE id = ?").bind(c.req.param('id')).run();
  const video = await c.env.DB.prepare('SELECT * FROM videos WHERE id = ?').bind(c.req.param('id')).first();
  return c.json(video);
});

app.post('/admin/videos/:id/feature', async (c) => {
  const video = await c.env.DB.prepare('SELECT featured FROM videos WHERE id = ?').bind(c.req.param('id')).first() as any;
  const newFeatured = video?.featured ? 0 : 1;
  await c.env.DB.prepare("UPDATE videos SET featured = ?, updated_at = datetime('now') WHERE id = ?").bind(newFeatured, c.req.param('id')).run();
  const updated = await c.env.DB.prepare('SELECT * FROM videos WHERE id = ?').bind(c.req.param('id')).first();
  return c.json(updated);
});

app.post('/admin/videos/:id/upload-url', async (c) => {
  const { type, filename, contentType } = await c.req.json();
  const videoId = c.req.param('id');
  const ext = filename.split('.').pop();
  const key = `videos/${videoId}/${type}.${ext}`;

  // For R2 direct upload, return the key and the worker will handle the upload
  // In production, use R2 presigned URLs for direct browser upload
  return c.json({ uploadUrl: `/api/admin/videos/${videoId}/upload/${type}`, key });
});

app.put('/admin/videos/:id/upload/:type', async (c) => {
  const videoId = c.req.param('id');
  const type = c.req.param('type');
  const body = await c.req.arrayBuffer();
  const contentType = c.req.header('Content-Type') || 'application/octet-stream';

  const ext = contentType.includes('video') ? 'mp4' : contentType.includes('image') ? 'jpg' : 'bin';
  const key = `videos/${videoId}/${type}.${ext}`;

  await c.env.R2.put(key, body, { httpMetadata: { contentType } });

  // Update video record with key
  const column = type === 'original' ? 'original_key' :
                 type === 'preview' ? 'preview_key' :
                 type === 'thumbnail' ? 'thumbnail_key' : 'watermarked_key';

  await c.env.DB.prepare(`UPDATE videos SET ${column} = ?, updated_at = datetime('now') WHERE id = ?`).bind(key, videoId).run();

  // If it's the original, also get file size
  if (type === 'original') {
    await c.env.DB.prepare('UPDATE videos SET file_size_bytes = ? WHERE id = ?').bind(body.byteLength, videoId).run();
  }

  return c.json({ key, url: getR2PublicUrl(key) });
});

// Admin orders
app.get('/admin/orders', async (c) => {
  const { status, page = '1' } = c.req.query();
  const limit = 20;
  const offset = (parseInt(page) - 1) * limit;

  let where = '1=1';
  const params: any[] = [];
  if (status && status !== 'all') { where = 'o.status = ?'; params.push(status); }

  const total = await c.env.DB.prepare(`SELECT COUNT(*) as c FROM orders o WHERE ${where}`).bind(...params).first() as any;
  const orders = await c.env.DB.prepare(
    `SELECT o.*, v.title as video_title FROM orders o LEFT JOIN videos v ON o.video_id = v.id WHERE ${where} ORDER BY o.created_at DESC LIMIT ? OFFSET ?`
  ).bind(...params, limit, offset).all();

  return c.json({
    orders: orders.results.map((o: any) => ({
      ...o,
      video: { id: o.video_id, title: o.video_title },
    })),
    total: total?.c || 0,
  });
});

app.post('/admin/orders/:id/refund', async (c) => {
  const orderId = c.req.param('id');
  const order = await c.env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(orderId).first() as any;
  if (!order) return c.json({ message: 'Order not found' }, 404);
  if (order.status !== 'completed') return c.json({ message: 'Can only refund completed orders' }, 400);

  // PayPal refund
  const token = await getPayPalAccessToken(c.env);
  const refundRes = await fetch(`https://api-m.sandbox.paypal.com/v2/payments/captures/${order.paypal_capture_id}/refund`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });

  if (!refundRes.ok) {
    return c.json({ message: 'PayPal refund failed' }, 500);
  }

  await c.env.DB.prepare("UPDATE orders SET status = 'refunded' WHERE id = ?").bind(orderId).run();

  // Invalidate download tokens
  await c.env.DB.prepare("UPDATE download_tokens SET expires_at = datetime('now') WHERE order_id = ?").bind(orderId).run();

  return c.json({ status: 'refunded' });
});

// Admin settings
app.get('/admin/settings', async (c) => {
  const rows = await c.env.DB.prepare('SELECT key, value FROM settings').all();
  const settings: Record<string, string> = {};
  for (const row of rows.results as any[]) {
    settings[row.key] = row.value;
  }
  return c.json(settings);
});

app.post('/admin/settings', async (c) => {
  const data = await c.req.json();
  const settingsMap: Record<string, string> = {
    default_price: 'default_price_cents',
    watermark_text: 'watermark_text',
    max_downloads: 'max_downloads_per_purchase',
    link_expiry_hours: 'download_link_expiry_hours',
  };

  for (const [formKey, dbKey] of Object.entries(settingsMap)) {
    if (data[formKey] !== undefined) {
      const value = formKey === 'default_price'
        ? String(Math.round(parseFloat(data[formKey]) * 100))
        : String(data[formKey]);
      await c.env.DB.prepare(
        "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = datetime('now')"
      ).bind(dbKey, value, value).run();
    }
  }

  return c.json({ ok: true });
});

// Admin dashboard revenue by month
app.get('/admin/dashboard/revenue', async (c) => {
  const rows = await c.env.DB.prepare(
    "SELECT strftime('%Y-%m', completed_at) as month, SUM(amount_cents) as total FROM orders WHERE status = 'completed' AND completed_at IS NOT NULL GROUP BY month ORDER BY month DESC LIMIT 6"
  ).all();
  return c.json({ months: rows.results });
});

// Cloudflare Pages Functions handler
export const onRequest: PagesFunction<Env> = async (context) => {
  return app.fetch(context.request, context.env, context as unknown as ExecutionContext);
};
