import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { AwsClient } from 'aws4fetch';

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
  R2_ACCOUNT_ID: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  R2_BUCKET_NAME: string;
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

function decodeJwtPayload(token: string): any | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    // base64url → base64
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4 === 0 ? b64 : b64 + '='.repeat(4 - (b64.length % 4));
    return JSON.parse(atob(pad));
  } catch {
    return null;
  }
}

async function verifyAdmin(req: Request, env: Env): Promise<boolean> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return false;
  if (!env.CLERK_SECRET_KEY) return false;

  try {
    const token = authHeader.slice(7);

    // 1. Parse JWT payload to get session ID (`sid`) and user ID (`sub`).
    //    This doesn't verify the signature — step 2 does that via Clerk's session-lookup endpoint,
    //    which is authenticated with CLERK_SECRET_KEY and will reject any forged session ID.
    const payload = decodeJwtPayload(token);
    if (!payload) return false;

    const userId: string | undefined = payload.sub;
    const sessionId: string | undefined = payload.sid;
    const exp: number | undefined = payload.exp;

    if (!userId || !sessionId) return false;
    if (exp && Date.now() / 1000 > exp) return false;

    // 2. Confirm the session exists, is active, and is still tied to this user.
    const res = await fetch(`https://api.clerk.com/v1/sessions/${sessionId}`, {
      headers: { Authorization: `Bearer ${env.CLERK_SECRET_KEY}` },
    });
    if (!res.ok) return false;
    const session = await res.json() as any;
    if (session.status !== 'active' || session.user_id !== userId) return false;

    // 3. Allow-list check.
    const adminIds = env.ADMIN_USER_IDS?.split(',').map(s => s.trim()).filter(Boolean) || [];
    return adminIds.includes(userId);
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

// Orders for the current visitor — looked up by buyer_email. The Account page
// uses this to show "My Purchases" without needing admin auth. Rate-limiting
// or session-gating can be added later; for now, knowing an email is enough.
app.get('/me/orders', async (c) => {
  const email = (c.req.query('email') || '').trim().toLowerCase();
  if (!email || !email.includes('@')) return c.json({ purchases: [] });

  const rows = await c.env.DB.prepare(
    `SELECT o.id, o.video_id, o.amount_cents, o.currency, o.status,
            o.created_at, o.completed_at,
            v.title as video_title,
            t.token as download_token
       FROM orders o
       LEFT JOIN videos v ON v.id = o.video_id
       LEFT JOIN download_tokens t ON t.order_id = o.id AND t.expires_at > datetime('now')
      WHERE LOWER(o.buyer_email) = ?
      ORDER BY o.created_at DESC
      LIMIT 100`
  ).bind(email).all();

  const purchases = (rows.results || []).map((r: any) => ({
    id: r.id,
    kind: 'raw' as const,
    clip_title: r.video_title || r.video_id,
    clip_id: r.video_id,
    price_cents: r.amount_cents,
    currency: r.currency,
    status: r.status,
    created_at: r.created_at,
    download_token: r.download_token || undefined,
  }));

  return c.json({ purchases });
});

// ============================
// SELLER: apply + self-serve
// ============================

/** Helper: decode Clerk JWT payload, return {userId,sessionId} (or null).
 *  Shared between verifyAdmin + verifySignedIn. Note: this does NOT verify the
 *  signature — call Clerk /v1/sessions/{sid} to fully authenticate. */
function decodeClerkJwt(req: Request): { userId: string | null; sessionId: string | null } {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return { userId: null, sessionId: null };
  const payload = decodeJwtPayload(authHeader.slice(7));
  return { userId: payload?.sub || null, sessionId: payload?.sid || null };
}

/** Authenticate a regular signed-in visitor (not necessarily admin/seller).
 *  Returns userId if the Clerk session is active, otherwise null. */
async function verifySignedIn(req: Request, env: Env): Promise<string | null> {
  const { userId, sessionId } = decodeClerkJwt(req);
  if (!userId || !sessionId || !env.CLERK_SECRET_KEY) return null;
  try {
    const res = await fetch(`https://api.clerk.com/v1/sessions/${sessionId}`, {
      headers: { Authorization: `Bearer ${env.CLERK_SECRET_KEY}` },
    });
    if (!res.ok) return null;
    const session = await res.json() as any;
    if (session.status !== 'active' || session.user_id !== userId) return null;
    return userId;
  } catch { return null; }
}

/** POST /seller/apply — creates (or upserts) a sellers row with approved=0.
 *  Requires a signed-in Clerk session; the seller row's id IS the Clerk user id.
 *  Admin decides to approve via /admin/sellers/:id/approve. */
app.post('/seller/apply', async (c) => {
  const userId = await verifySignedIn(c.req.raw, c.env);
  if (!userId) return c.json({ message: 'Not signed in' }, 401);

  const body = await c.req.json().catch(() => ({} as any));
  const { display_name, location, bio, rpl_number, payout_notes, email } = body;

  if (!display_name || !location || !payout_notes) {
    return c.json({ message: 'display_name, location and payout_notes are required' }, 400);
  }

  await c.env.DB.prepare(
    `INSERT INTO sellers (id, display_name, bio, location, email, payout_notes, rpl_number, approved, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, datetime('now'), datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
       display_name = excluded.display_name,
       bio = excluded.bio,
       location = excluded.location,
       email = excluded.email,
       payout_notes = excluded.payout_notes,
       rpl_number = excluded.rpl_number,
       updated_at = datetime('now')`
  ).bind(userId, display_name.slice(0, 60), (bio || '').slice(0, 240), location.slice(0, 80),
         (email || '').slice(0, 160), payout_notes.slice(0, 120), (rpl_number || '').slice(0, 24)).run();

  return c.json({ ok: true, id: userId, status: 'pending_review' });
});

/** GET /seller/me — is this visitor a seller? Returns their row if so. */
app.get('/seller/me', async (c) => {
  const userId = await verifySignedIn(c.req.raw, c.env);
  if (!userId) return c.json({ seller: null });
  const row = await c.env.DB.prepare('SELECT * FROM sellers WHERE id = ?').bind(userId).first();
  return c.json({ seller: row || null });
});

/** Helper: require an approved seller. Returns the Clerk userId or null. */
async function requireApprovedSeller(req: Request, env: Env): Promise<string | null> {
  const userId = await verifySignedIn(req, env);
  if (!userId) return null;
  const row = await env.DB.prepare('SELECT approved FROM sellers WHERE id = ?').bind(userId).first() as any;
  return row?.approved ? userId : null;
}

/** POST /seller/videos — create a clip owned by this seller, status auto-pending_review. */
app.post('/seller/videos', async (c) => {
  const sellerId = await requireApprovedSeller(c.req.raw, c.env);
  if (!sellerId) return c.json({ message: 'Not an approved seller' }, 403);

  const data = await c.req.json();
  const id = generateId();
  await c.env.DB.prepare(
    `INSERT INTO videos (id, title, description, location, tags, price_cents, resolution, fps,
       duration_seconds, status, seller_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_review', ?)`
  ).bind(id, data.title, data.description || '', data.location || '', JSON.stringify(data.tags || []),
    data.price_cents, data.resolution || '4K', data.fps || 60, data.duration_seconds || 0,
    sellerId).run();

  const video = await c.env.DB.prepare('SELECT * FROM videos WHERE id = ?').bind(id).first();
  return c.json(video, 201);
});

/** POST /seller/videos/:id/upload-url — presigned R2 URL, scoped to own clip. */
app.post('/seller/videos/:id/upload-url', async (c) => {
  const sellerId = await requireApprovedSeller(c.req.raw, c.env);
  if (!sellerId) return c.json({ message: 'Not an approved seller' }, 403);
  const videoId = c.req.param('id');
  const owner = await c.env.DB.prepare('SELECT seller_id FROM videos WHERE id = ?').bind(videoId).first() as any;
  if (!owner || owner.seller_id !== sellerId) return c.json({ message: 'Not your clip' }, 403);

  const { type, filename, contentType } = await c.req.json();
  const ext = (filename?.split('.').pop() || '').toLowerCase();
  const safeExt = type === 'thumbnail' ? (ext || 'jpg') : (ext || 'mp4');
  const key = `videos/${videoId}/${type}.${safeExt}`;
  const ct = contentType || (type === 'thumbnail' ? 'image/jpeg' : 'video/mp4');
  const bucket = c.env.R2_BUCKET_NAME || 'skystock-videos';
  const r2Host = `${c.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  const signed = await import('aws4fetch').then(({ AwsClient }) => new AwsClient({
    accessKeyId: c.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: c.env.R2_SECRET_ACCESS_KEY!,
    service: 's3',
    region: 'auto',
  }).sign(`https://${r2Host}/${bucket}/${key}`, { method: 'PUT', headers: { 'Content-Type': ct }, aws: { signQuery: true } }));
  return c.json({ uploadUrl: signed.url, key, contentType: ct });
});

/** POST /seller/videos/:id/confirm-upload — verify R2 head and update the column. */
app.post('/seller/videos/:id/confirm-upload', async (c) => {
  const sellerId = await requireApprovedSeller(c.req.raw, c.env);
  if (!sellerId) return c.json({ message: 'Not an approved seller' }, 403);
  const videoId = c.req.param('id');
  const owner = await c.env.DB.prepare('SELECT seller_id FROM videos WHERE id = ?').bind(videoId).first() as any;
  if (!owner || owner.seller_id !== sellerId) return c.json({ message: 'Not your clip' }, 403);

  const { type, key } = await c.req.json();
  const obj = await c.env.R2.head(key);
  if (!obj) return c.json({ message: 'Upload not found in R2' }, 404);
  const column = type === 'original' ? 'original_key' : type === 'preview' ? 'preview_key' : type === 'thumbnail' ? 'thumbnail_key' : null;
  if (!column) return c.json({ message: 'Invalid upload type' }, 400);
  await c.env.DB.prepare(`UPDATE videos SET ${column} = ?, updated_at = datetime('now') WHERE id = ?`).bind(key, videoId).run();
  if (type === 'original') {
    await c.env.DB.prepare('UPDATE videos SET file_size_bytes = ? WHERE id = ?').bind(obj.size, videoId).run();
  }
  return c.json({ key, size: obj.size });
});

/** GET /seller/clips — the visitor's own uploaded clips + per-clip stats. */
app.get('/seller/clips', async (c) => {
  const userId = await verifySignedIn(c.req.raw, c.env);
  if (!userId) return c.json({ message: 'Not signed in' }, 401);

  const rows = await c.env.DB.prepare(
    `SELECT v.*,
            (SELECT COUNT(*) FROM orders o WHERE o.video_id = v.id AND o.status = 'completed') as sale_count,
            (SELECT COALESCE(SUM(o.amount_cents), 0) FROM orders o WHERE o.video_id = v.id AND o.status = 'completed') as gross_cents
       FROM videos v
      WHERE v.seller_id = ? AND v.status != 'archived'
      ORDER BY v.created_at DESC`
  ).bind(userId).all();

  const seller = await c.env.DB.prepare('SELECT revenue_share_bps FROM sellers WHERE id = ?').bind(userId).first() as any;
  const share = (seller?.revenue_share_bps ?? 8000) / 10000;

  const clips = (rows.results || []).map((v: any) => ({
    id: v.id,
    title: v.title,
    status: v.status,
    price_cents: v.price_cents,
    resolution: v.resolution,
    fps: v.fps,
    duration_seconds: v.duration_seconds,
    sale_count: v.sale_count || 0,
    gross_cents: v.gross_cents || 0,
    earnings_cents: Math.round((v.gross_cents || 0) * share),
    created_at: v.created_at,
    moderation_notes: v.moderation_notes,
    thumbnail_url: v.thumbnail_key ? getR2PublicUrl(v.thumbnail_key) : null,
  }));

  const totals = clips.reduce((acc, c) => ({
    sales: acc.sales + c.sale_count,
    gross: acc.gross + c.gross_cents,
    earnings: acc.earnings + c.earnings_cents,
  }), { sales: 0, gross: 0, earnings: 0 });

  return c.json({ clips, share_bps: seller?.revenue_share_bps ?? 8000, totals });
});

// ============================
// ADMIN: moderation queue + seller approval
// ============================

/** GET /admin/sellers — list of all sellers (approved + pending). */
app.get('/admin/sellers', async (c) => {
  const rows = await c.env.DB.prepare('SELECT * FROM sellers ORDER BY approved ASC, created_at DESC').all();
  return c.json({ sellers: rows.results || [] });
});

/** POST /admin/sellers/:id/approve */
app.post('/admin/sellers/:id/approve', async (c) => {
  await c.env.DB.prepare(
    `UPDATE sellers SET approved = 1, approved_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`
  ).bind(c.req.param('id')).run();
  return c.json({ ok: true });
});

/** POST /admin/sellers/:id/reject  body: { reason } */
app.post('/admin/sellers/:id/reject', async (c) => {
  const { reason } = await c.req.json().catch(() => ({} as any));
  await c.env.DB.prepare(
    `UPDATE sellers SET approved = 0, payout_notes = ?, updated_at = datetime('now') WHERE id = ?`
  ).bind(`REJECTED: ${reason || 'no reason given'}`, c.req.param('id')).run();
  return c.json({ ok: true });
});

/** GET /admin/moderation — clips waiting for review (status='pending_review'). */
app.get('/admin/moderation', async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT v.*, s.display_name as seller_name, s.location as seller_location
       FROM videos v
       LEFT JOIN sellers s ON s.id = v.seller_id
      WHERE v.status = 'pending_review'
      ORDER BY v.created_at ASC`
  ).all();

  const clips = (rows.results || []).map((v: any) => ({
    ...v,
    tags: JSON.parse(v.tags || '[]'),
    thumbnail_url: v.thumbnail_key ? getR2PublicUrl(v.thumbnail_key) : null,
    preview_url: v.preview_key ? getR2PublicUrl(v.preview_key) : null,
    watermarked_url: v.watermarked_key ? getR2PublicUrl(v.watermarked_key) : null,
  }));
  return c.json({ clips });
});

/** POST /admin/moderation/:id/approve — publish the clip. */
app.post('/admin/moderation/:id/approve', async (c) => {
  await c.env.DB.prepare(
    `UPDATE videos SET status='published', moderation_notes=NULL, updated_at=datetime('now') WHERE id = ?`
  ).bind(c.req.param('id')).run();
  return c.json({ ok: true });
});

/** POST /admin/moderation/:id/reject  body: { reason } — send back to draft with notes. */
app.post('/admin/moderation/:id/reject', async (c) => {
  const { reason } = await c.req.json().catch(() => ({} as any));
  await c.env.DB.prepare(
    `UPDATE videos SET status='draft', moderation_notes=?, updated_at=datetime('now') WHERE id = ?`
  ).bind(reason || 'rejected without reason', c.req.param('id')).run();
  return c.json({ ok: true });
});

// ============================
// PUBLIC: MEDIA (R2 proxy)
// ============================

app.get('/media/:key{.+}', async (c) => {
  const key = c.req.param('key');

  // Parse HTTP Range request header — required for <video> to seek in large files.
  // Without this the browser tries to buffer the whole 3 GB master, hanging on load.
  const rangeHeader = c.req.header('Range');
  if (rangeHeader) {
    const head = await c.env.R2.head(key);
    if (!head) return c.json({ message: 'Not found' }, 404);
    const total = head.size;
    const m = /bytes=(\d*)-(\d*)/.exec(rangeHeader);
    let start = m && m[1] !== '' ? parseInt(m[1], 10) : 0;
    let end   = m && m[2] !== '' ? parseInt(m[2], 10) : total - 1;
    if (!Number.isFinite(start) || start < 0) start = 0;
    if (!Number.isFinite(end)   || end   >= total) end = total - 1;
    if (start > end) return new Response('Range not satisfiable', { status: 416 });

    const object = await c.env.R2.get(key, { range: { offset: start, length: end - start + 1 } });
    if (!object) return c.json({ message: 'Not found' }, 404);

    const headers = new Headers();
    headers.set('Content-Type', object.httpMetadata?.contentType || head.httpMetadata?.contentType || 'application/octet-stream');
    headers.set('Accept-Ranges', 'bytes');
    headers.set('Content-Length', String(end - start + 1));
    headers.set('Content-Range', `bytes ${start}-${end}/${total}`);
    headers.set('Cache-Control', 'public, max-age=3600');
    return new Response(object.body, { status: 206, headers });
  }

  const object = await c.env.R2.get(key);
  if (!object) return c.json({ message: 'Not found' }, 404);

  const headers = new Headers();
  headers.set('Content-Type', object.httpMetadata?.contentType || 'application/octet-stream');
  headers.set('Cache-Control', 'public, max-age=3600');
  headers.set('Accept-Ranges', 'bytes');
  headers.set('Content-Length', String(object.size));
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

// Integration health — probes each third-party service with its configured credentials
app.get('/admin/integrations/health', async (c) => {
  const env = c.env;
  const timeout = (ms: number) => new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));

  async function probePayPal() {
    try {
      if (!env.PAYPAL_CLIENT_ID || !env.PAYPAL_CLIENT_SECRET) {
        return { status: 'missing', detail: 'Credentials not set' };
      }
      const auth = btoa(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`);
      const res = await Promise.race([
        fetch('https://api-m.sandbox.paypal.com/v1/oauth2/token', {
          method: 'POST',
          headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
          body: 'grant_type=client_credentials',
        }),
        timeout(8000),
      ]);
      if (!res.ok) return { status: 'error', detail: `HTTP ${res.status}` };
      const data = await res.json() as any;
      return data.access_token ? { status: 'ok', detail: 'Sandbox token issued' } : { status: 'error', detail: 'No token returned' };
    } catch (e: any) {
      return { status: 'error', detail: e.message || 'Network error' };
    }
  }

  async function probeClerk() {
    try {
      if (!env.CLERK_SECRET_KEY) return { status: 'missing', detail: 'CLERK_SECRET_KEY not set' };
      const res = await Promise.race([
        fetch('https://api.clerk.com/v1/users?limit=1', {
          headers: { Authorization: `Bearer ${env.CLERK_SECRET_KEY}` },
        }),
        timeout(8000),
      ]);
      if (!res.ok) return { status: 'error', detail: `HTTP ${res.status}` };
      return { status: 'ok', detail: 'API reachable' };
    } catch (e: any) {
      return { status: 'error', detail: e.message || 'Network error' };
    }
  }

  async function probeResend() {
    try {
      if (!env.RESEND_API_KEY) return { status: 'missing', detail: 'RESEND_API_KEY not set' };
      const res = await Promise.race([
        fetch('https://api.resend.com/domains', {
          headers: { Authorization: `Bearer ${env.RESEND_API_KEY}` },
        }),
        timeout(8000),
      ]);
      if (res.status === 401 || res.status === 403) return { status: 'error', detail: `Auth rejected (HTTP ${res.status})` };
      if (!res.ok) return { status: 'error', detail: `HTTP ${res.status}` };
      return { status: 'ok', detail: 'API reachable' };
    } catch (e: any) {
      return { status: 'error', detail: e.message || 'Network error' };
    }
  }

  async function probeR2() {
    try {
      if (!env.R2) return { status: 'missing', detail: 'R2 binding not configured' };
      await env.R2.head('__healthcheck__').catch(() => null);
      return { status: 'ok', detail: 'Bucket reachable' };
    } catch (e: any) {
      return { status: 'error', detail: e.message || 'R2 error' };
    }
  }

  async function probeD1() {
    try {
      if (!env.DB) return { status: 'missing', detail: 'D1 binding not configured' };
      await env.DB.prepare('SELECT 1 as x').first();
      return { status: 'ok', detail: 'Database reachable' };
    } catch (e: any) {
      return { status: 'error', detail: e.message || 'D1 error' };
    }
  }

  const [paypal, clerk, resend, r2, d1] = await Promise.all([
    probePayPal(), probeClerk(), probeResend(), probeR2(), probeD1(),
  ]);

  return c.json({ paypal, clerk, resend, r2, d1, checked_at: Date.now() });
});

// AI fill — send a frame image to a vision LLM and get back suggested listing metadata.
// Prefers OpenRouter (cheaper, multi-model) and falls back to the Anthropic API direct.
app.post('/admin/ai-fill', async (c) => {
  const env = c.env;
  const useOpenRouter = !!env.OPENROUTER_API_KEY;
  const useAnthropic = !useOpenRouter && !!env.ANTHROPIC_API_KEY;
  if (!useOpenRouter && !useAnthropic) {
    return c.json({
      error: 'No AI provider configured. Set OPENROUTER_API_KEY (preferred) or ANTHROPIC_API_KEY via: wrangler pages secret put OPENROUTER_API_KEY',
    }, 500);
  }

  let body: { imageBase64?: string; mediaType?: string; hint?: string; filename?: string } = {};
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }
  const { imageBase64, mediaType = 'image/jpeg', hint = '', filename = '' } = body;
  if (!imageBase64) return c.json({ error: 'Missing imageBase64' }, 400);

  const systemPrompt = `You are a listings assistant for SkyStock FPV, a marketplace for 360° FPV drone footage shot on the DJI Avata 360 across Central Queensland, Australia. You write short, punchy listings.

Respond with STRICT JSON only — no prose, no markdown, no code fences. Schema:
{
  "title": string,              // 3-6 words, evocative, title case. E.g. "Sunrise Over The Gemfields"
  "description": string,        // 1-2 sentences. Mention the scene, motion, light, and the 360° reframing hook
  "location": string,           // city/region, "QLD" suffix if inferable. Empty string if unknown.
  "tags": string[],             // 4-7 lowercase tags, single words or hyphenated. E.g. ["coast","sunset","golden-hour"]
  "price_cents": number         // AUD price in cents. 2499 = $24.99. Use 2499-4999 based on scene quality/rarity.
}`;

  const userText = `Suggest listing metadata for this drone clip frame.
${filename ? `Filename hint: ${filename}\n` : ''}${hint ? `Location hint (TRUST THIS — it's the exact Central QLD location the operator shot at, e.g. "Frenchville Flyover", "Mt Archer"): ${hint}\n` : ''}
Rules:
- If a location hint is given, use it verbatim for the "location" field (append ", QLD" if not already present).
- Title may reference the hint (e.g. "Mt Archer Ridge Dive" when hint is "Mt Archer") but must still evoke the scene in the image.
- Description should lean into the 360° reframing hook: one clip, reframe any angle.

Respond with JSON only.`;

  async function callOpenRouter(): Promise<{ text: string } | { error: string; status: number }> {
    const model = env.OPENROUTER_MODEL || 'anthropic/claude-sonnet-4.5';
    const dataUrl = `data:${mediaType};base64,${imageBase64}`;
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': env.SITE_URL || 'https://skystock.pages.dev',
        'X-Title': env.SITE_NAME || 'SkyStock FPV',
      },
      body: JSON.stringify({
        model,
        max_tokens: 600,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: userText },
              { type: 'image_url', image_url: { url: dataUrl } },
            ],
          },
        ],
      }),
    });
    if (!res.ok) {
      return { error: `OpenRouter HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`, status: 502 };
    }
    const data = await res.json() as any;
    return { text: data?.choices?.[0]?.message?.content || '' };
  }

  async function callAnthropic(): Promise<{ text: string } | { error: string; status: number }> {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 600,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
              { type: 'text', text: userText },
            ],
          },
        ],
      }),
    });
    if (!res.ok) {
      return { error: `Anthropic HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`, status: 502 };
    }
    const data = await res.json() as any;
    return { text: data?.content?.[0]?.text || '' };
  }

  try {
    const result = useOpenRouter ? await callOpenRouter() : await callAnthropic();
    if ('error' in result) return c.json({ error: result.error }, result.status as 400 | 500 | 502);

    const text = result.text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return c.json({ error: 'AI returned no JSON', raw: text.slice(0, 400) }, 502);

    let parsed: any;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch (e: any) {
      return c.json({ error: `Failed to parse AI JSON: ${e.message}`, raw: jsonMatch[0].slice(0, 400) }, 502);
    }

    const tags: string[] = Array.isArray(parsed.tags)
      ? parsed.tags.map((t: any) => String(t).toLowerCase().trim()).filter(Boolean).slice(0, 8)
      : [];

    return c.json({
      title: String(parsed.title || '').slice(0, 120),
      description: String(parsed.description || '').slice(0, 800),
      location: String(parsed.location || '').slice(0, 80),
      tags,
      price_cents: Number.isFinite(parsed.price_cents) ? Math.max(0, Math.min(20000, Math.round(parsed.price_cents))) : 2999,
      provider: useOpenRouter ? 'openrouter' : 'anthropic',
    });
  } catch (e: any) {
    return c.json({ error: `AI fill failed: ${e.message || 'unknown'}` }, 500);
  }
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
  const video = await c.env.DB.prepare('SELECT * FROM videos WHERE id = ?').bind(c.req.param('id')).first() as any;
  if (!video) return c.json({ message: 'Not found' }, 404);
  return c.json({
    ...video,
    tags: JSON.parse(video.tags || '[]'),
    featured: !!video.featured,
    thumbnail_url: video.thumbnail_key ? getR2PublicUrl(video.thumbnail_key) : null,
    watermarked_url: video.watermarked_key ? getR2PublicUrl(video.watermarked_key) : null,
    preview_url: video.preview_key ? getR2PublicUrl(video.preview_key) : null,
    // Admin-only: URL to the full-quality 360° master for editor-source use.
    original_url: video.original_key ? getR2PublicUrl(video.original_key) : null,
  });
});

app.post('/admin/videos', async (c) => {
  const data = await c.req.json();
  const id = generateId();
  await c.env.DB.prepare(
    `INSERT INTO videos (id, title, description, location, tags, price_cents, resolution, fps, duration_seconds, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, data.title, data.description || '', data.location || '', JSON.stringify(data.tags || []),
    data.price_cents, data.resolution || '4K', data.fps || 60, data.duration_seconds || 0, data.status || 'draft').run();

  const video = await c.env.DB.prepare('SELECT * FROM videos WHERE id = ?').bind(id).first();
  return c.json(video, 201);
});

app.put('/admin/videos/:id', async (c) => {
  const data = await c.req.json();
  const id = c.req.param('id');
  await c.env.DB.prepare(
    `UPDATE videos SET title = ?, description = ?, location = ?, tags = ?, price_cents = ?,
     resolution = ?, fps = ?, duration_seconds = COALESCE(?, duration_seconds),
     status = ?, updated_at = datetime('now') WHERE id = ?`
  ).bind(data.title, data.description || '', data.location || '', JSON.stringify(data.tags || []),
    data.price_cents, data.resolution, data.fps,
    Number.isFinite(data.duration_seconds) ? data.duration_seconds : null,
    data.status, id).run();

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
  const ext = (filename?.split('.').pop() || '').toLowerCase();
  const safeExt = type === 'thumbnail' ? (ext || 'jpg') : (ext || 'mp4');
  const key = `videos/${videoId}/${type}.${safeExt}`;
  const ct = contentType || (type === 'thumbnail' ? 'image/jpeg' : 'video/mp4');

  const bucket = c.env.R2_BUCKET_NAME || 'skystock-videos';
  const endpoint = `https://${c.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${bucket}/${key}`;

  const aws = new AwsClient({
    accessKeyId: c.env.R2_ACCESS_KEY_ID,
    secretAccessKey: c.env.R2_SECRET_ACCESS_KEY,
    service: 's3',
    region: 'auto',
  });

  // Presign a PUT. 1-hour expiry is plenty for one upload.
  const signed = await aws.sign(
    new Request(`${endpoint}?X-Amz-Expires=3600`, {
      method: 'PUT',
      headers: { 'Content-Type': ct },
    }),
    { aws: { signQuery: true } }
  );

  return c.json({ uploadUrl: signed.url, key, contentType: ct });
});

// Repair — when an upload landed in R2 but confirm-upload never ran (e.g. the auth bug
// that sent every /admin/* request through with no Bearer), the file is still there at
// a predictable key. This endpoint scans for orphans and re-links them to the DB row.
app.post('/admin/videos/:id/repair', async (c) => {
  const videoId = c.req.param('id');
  const video = await c.env.DB.prepare('SELECT * FROM videos WHERE id = ?').bind(videoId).first() as any;
  if (!video) return c.json({ message: 'Not found' }, 404);

  const report: Record<string, { found: boolean; key?: string; size?: number; skipped?: string }> = {};
  const candidates: { type: 'original' | 'preview' | 'thumbnail'; column: string; extensions: string[] }[] = [
    { type: 'original',  column: 'original_key',  extensions: ['mp4', 'mov', 'MP4', 'MOV', 'webm'] },
    { type: 'preview',   column: 'preview_key',   extensions: ['mp4', 'webm', 'mov'] },
    { type: 'thumbnail', column: 'thumbnail_key', extensions: ['jpg', 'jpeg', 'png', 'webp'] },
  ];

  for (const c0 of candidates) {
    // If the DB already has a key, leave it alone (no point clobbering).
    if (video[c0.column]) {
      report[c0.type] = { found: true, key: video[c0.column], skipped: 'already set' };
      continue;
    }
    let found: { key: string; size: number } | null = null;
    for (const ext of c0.extensions) {
      const key = `videos/${videoId}/${c0.type}.${ext}`;
      try {
        const head = await c.env.R2.head(key);
        if (head) { found = { key, size: head.size }; break; }
      } catch { /* noop, try next */ }
    }
    if (!found) {
      report[c0.type] = { found: false };
      continue;
    }
    await c.env.DB.prepare(`UPDATE videos SET ${c0.column} = ?, updated_at = datetime('now') WHERE id = ?`)
      .bind(found.key, videoId).run();
    if (c0.type === 'original') {
      await c.env.DB.prepare('UPDATE videos SET file_size_bytes = ? WHERE id = ?').bind(found.size, videoId).run();
    }
    report[c0.type] = { found: true, key: found.key, size: found.size };
  }

  return c.json({ videoId, report });
});

app.post('/admin/videos/:id/confirm-upload', async (c) => {
  const { type, key } = await c.req.json();
  const videoId = c.req.param('id');

  const obj = await c.env.R2.head(key);
  if (!obj) return c.json({ message: 'Upload not found in R2' }, 404);

  const column = type === 'original' ? 'original_key' :
                 type === 'preview' ? 'preview_key' :
                 type === 'thumbnail' ? 'thumbnail_key' : null;
  if (!column) return c.json({ message: 'Invalid upload type' }, 400);

  await c.env.DB.prepare(`UPDATE videos SET ${column} = ?, updated_at = datetime('now') WHERE id = ?`).bind(key, videoId).run();

  if (type === 'original') {
    await c.env.DB.prepare('UPDATE videos SET file_size_bytes = ? WHERE id = ?').bind(obj.size, videoId).run();
  }

  return c.json({ key, size: obj.size });
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
