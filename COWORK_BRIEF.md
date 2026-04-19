# SkyStock FPV — Cowork Project Brief

## Project Overview
A stock video footage marketplace for selling 360° FPV drone footage shot on the DJI Avata 360 across Central Queensland, Australia. Buyers browse watermarked flat-frame previews and pay via PayPal to download the full 360° spherical master — which they can reframe to any angle in post using Insta360 Studio, Adobe Premiere, DaVinci Resolve, or any 360-capable editor. One clip, infinite final cuts.

## Tech Stack
- **Frontend**: React 18 + Vite + TypeScript + Tailwind CSS
- **Backend**: Cloudflare Workers (Pages Functions) with Hono
- **Database**: Cloudflare D1 (SQLite)
- **Storage**: Cloudflare R2 (video files)
- **Auth**: Clerk (admin panel authentication)
- **Payments**: PayPal REST API (orders + captures)
- **Email**: Resend (download links to buyers)
- **Deployment**: Cloudflare Pages
- **Version Control**: Git + GitHub

## Brand Identity
- **Name**: SkyStock FPV
- **Aesthetic**: Dark aviation-inspired UI. Deep navy (#0a0e1a) backgrounds, sky-blue (#3b6cb5) accents, ember-orange (#f97316) CTAs.
- **Fonts**: Outfit (display/headings), DM Sans (body), JetBrains Mono (technical/badges)
- **Tone**: Premium, cinematic, Australian. Locations across Central QLD: Rockhampton, Yeppoon, Emerald, Gladstone, Mackay, Byfield, Mount Morgan.

## Current Progress (Files Already Created)
The following files are complete and ready:

### Config Files
- `package.json` — All dependencies defined
- `wrangler.toml` — CF Pages, D1, R2 bindings (needs real IDs)
- `vite.config.ts` — Vite + React setup
- `tsconfig.json` — TypeScript config with path aliases
- `tailwind.config.js` — Custom theme with sky/ember colors, animations
- `postcss.config.js` — PostCSS with Tailwind + Autoprefixer
- `index.html` — Entry HTML with Google Fonts
- `public/favicon.svg` — SkyStock branded favicon

### Database
- `db/schema.sql` — Full D1 schema (videos, orders, download_tokens, settings tables + indexes)

### Frontend Source (Completed)
- `src/index.css` — Global styles, glass-card components, buttons, watermark overlay
- `src/main.tsx` — React entry with ClerkProvider
- `src/App.tsx` — Full routing (public + admin with Clerk auth guard)
- `src/lib/types.ts` — All TypeScript types + utility formatters
- `src/lib/api.ts` — Complete API client (public + admin endpoints)
- `src/components/Layout.tsx` — Public navbar + footer
- `src/components/VideoCard.tsx` — Video grid card with hover preview
- `src/pages/Home.tsx` — Hero section + featured/latest videos + how-it-works + location callout (includes demo data fallback)

## Remaining Work — BUILD THESE FILES

### Priority 1: Remaining Frontend Pages

#### `src/pages/Browse.tsx`
Full browse/search page with:
- Search bar (text search across title, description, location, tags)
- Filter sidebar: tags, price range, resolution, duration range, sort by (newest, popular, price low/high)
- Responsive video grid using VideoCard component
- Pagination (12 per page)
- Empty state when no results
- URL search params for shareable filtered URLs

#### `src/pages/VideoDetail.tsx`
Single video detail page with:
- Large watermarked video player (HTML5 video with custom controls)
- Watermark overlay text "SKYSTOCK FPV" at 25deg rotation, 15% opacity
- Video metadata: title, description, location, tags, resolution, fps, duration, file size
- Price display with "Buy Now" CTA button
- PayPal checkout modal (see CheckoutModal component below)
- Related videos grid (same tags/location)
- View count increment on load (POST /api/videos/:id/view)

#### `src/components/CheckoutModal.tsx`
PayPal checkout flow:
- Modal overlay with email input field for buyer
- PayPal Smart Buttons using @paypal/react-paypal-js PayPalScriptProvider + PayPalButtons
- createOrder: calls POST /api/paypal/create-order with videoId + buyerEmail
- onApprove: calls POST /api/paypal/capture-order, then redirects to /success?token=xxx
- Loading states, error handling
- Currency: AUD

#### `src/pages/Success.tsx`
Post-purchase success page:
- Shows purchase confirmation with video title
- Download button that fetches secure download URL
- Shows remaining downloads count (max 5)
- "Download link also sent to your email" message
- Reads token from URL query param

#### `src/pages/Download.tsx`
Download landing page (from email links):
- Validates token via GET /api/download/validate?token=xxx
- Shows video info + remaining downloads
- Download button → GET /api/download/url?token=xxx → redirects to presigned R2 URL
- Expired/invalid token error states

### Priority 2: Admin Backend UI

#### `src/components/admin/AdminLayout.tsx`
Admin shell with:
- Fixed left sidebar (240px) with nav links: Dashboard, Videos, Upload, Orders, Settings
- SkyStock FPV logo at top
- Clerk UserButton in sidebar footer
- Main content area with Outlet
- Mobile: collapsible sidebar with hamburger
- Admin sidebar nav items with icons from lucide-react

#### `src/pages/admin/Dashboard.tsx`
Admin dashboard with:
- Stat cards row: Total Videos, Published, Total Orders, Revenue (AUD), Downloads
- Revenue chart (simple bar chart by month, use recharts or custom SVG)
- Recent orders table (last 10)
- Top performing videos list (by downloads)
- Quick action buttons: Upload New Video, View Store

#### `src/pages/admin/AdminVideos.tsx`
Video management list:
- Table with columns: Thumbnail, Title, Location, Status, Price, Views, Downloads, Actions
- Status filter tabs: All, Published, Draft, Archived
- Bulk actions: Publish, Unpublish, Delete
- Row actions: Edit, Publish/Unpublish, Toggle Featured, Delete (with confirmation)
- Click row to navigate to edit page
- Pagination

#### `src/pages/admin/AdminUpload.tsx`
Video upload form:
- react-dropzone for drag & drop video file upload
- Upload progress bar with percentage
- Form fields:
  - Title (required)
  - Description (textarea)
  - Location (text, e.g., "Yeppoon, QLD")
  - Tags (comma-separated input, renders as pills)
  - Price in AUD (number input, stored as cents)
  - Resolution dropdown (4K, 2.7K, 1080p)
  - FPS dropdown (24, 30, 60, 120)
  - Status: Draft or Published
- Separate upload zones for: Original (full quality), Preview (watermarked short clip), Thumbnail (image)
- On submit: POST /api/admin/videos to create record, then upload files to R2 via presigned URLs
- Success → redirect to /admin/videos

#### `src/pages/admin/AdminEditVideo.tsx`
Edit existing video:
- Same form as upload but pre-filled
- Option to replace video files
- Preview current thumbnail/video
- Save changes → PUT /api/admin/videos/:id
- Delete with confirmation modal

#### `src/pages/admin/AdminOrders.tsx`
Order management:
- Table: Order ID, Video, Buyer Email, Amount, Status, Date, Actions
- Status filter tabs: All, Completed, Pending, Refunded
- Row action: Refund (calls POST /api/admin/orders/:id/refund via PayPal API)
- Click to expand order details (PayPal IDs, download token info)
- Export to CSV button
- Pagination

#### `src/pages/admin/AdminSettings.tsx`
Settings page:
- Default video price
- Watermark text
- Max downloads per purchase
- Download link expiry (hours)
- PayPal credentials status (connected/not)
- Resend email config
- Save settings → updates D1 settings table

### Priority 3: Cloudflare Workers API (Pages Functions)

All API routes go in `functions/api/` directory. Use Hono framework for routing.

#### `functions/api/[[route]].ts` — Main API entry
Single catch-all route file using Hono with these route groups:

**Public Routes:**
- `GET /api/videos` — List published videos with search, filter, sort, pagination
- `GET /api/videos/:id` — Get single published video (with computed R2 URLs)
- `POST /api/videos/:id/view` — Increment view count

**PayPal Routes:**
- `POST /api/paypal/create-order` — Create PayPal order + DB order record
  - Calls PayPal Orders API: POST https://api-m.paypal.com/v2/checkout/orders (or sandbox)
  - Body: { intent: "CAPTURE", purchase_units: [{ amount: { currency_code: "AUD", value: "29.99" } }] }
  - Auth: Basic auth with PAYPAL_CLIENT_ID:PAYPAL_CLIENT_SECRET, get access token first
  - Returns { orderId, paypalOrderId }

- `POST /api/paypal/capture-order` — Capture completed payment
  - Calls PayPal: POST /v2/checkout/orders/:paypalOrderId/capture
  - On success: update DB order status to 'completed'
  - Generate download token (crypto.randomUUID), save to download_tokens table
  - Send email via Resend with download link
  - Returns { success: true, downloadToken }

**Download Routes:**
- `GET /api/download/validate` — Check token validity, return video info + remaining downloads
- `GET /api/download/url` — Generate presigned R2 URL for the original video file
  - Decrement remaining downloads
  - Return temporary URL (R2 presigned, expires in 1 hour)

**Admin Routes (all require Clerk auth verification):**
Middleware: Verify Clerk session token from Authorization header.
Check user ID is in ADMIN_USER_IDS env var.

- `GET /api/admin/dashboard` — Aggregate stats from D1
- `GET /api/admin/videos` — List all videos (any status)
- `GET /api/admin/videos/:id` — Get single video
- `POST /api/admin/videos` — Create video record
- `PUT /api/admin/videos/:id` — Update video
- `DELETE /api/admin/videos/:id` — Soft delete (set status=archived)
- `POST /api/admin/videos/:id/publish` — Set status=published
- `POST /api/admin/videos/:id/unpublish` — Set status=draft
- `POST /api/admin/videos/:id/feature` — Toggle featured flag
- `POST /api/admin/videos/:id/upload-url` — Generate R2 presigned upload URL
  - Returns { uploadUrl, key } for direct browser→R2 upload

- `GET /api/admin/orders` — List orders with filters
- `POST /api/admin/orders/:id/refund` — Refund via PayPal Refunds API

### Priority 4: Environment & Deployment

#### `.env.example`
```
VITE_CLERK_PUBLISHABLE_KEY=pk_test_xxx
VITE_PAYPAL_CLIENT_ID=xxx
```

#### `.gitignore`
```
node_modules/
dist/
.wrangler/
.env
.env.local
.dev.vars
```

#### `README.md`
Full setup instructions:
1. Clone repo
2. npm install
3. Create Cloudflare account, create D1 database + R2 bucket
4. Set up Clerk application (get publishable + secret keys)
5. Set up PayPal Developer account (get client ID + secret)
6. Set up Resend account (get API key, verify domain)
7. Update wrangler.toml with D1 database ID
8. Run db:init to create tables
9. Set secrets: wrangler pages secret put CLERK_SECRET_KEY, etc.
10. npm run dev for local development
11. npm run deploy for production

#### Git Setup
```bash
git init
git add .
git commit -m "Initial commit: SkyStock FPV stock footage marketplace"
git remote add origin https://github.com/USERNAME/skystock.git
git branch -M main
git push -u origin main
```

## PayPal Integration Details

### Auth Flow
1. Get access token: POST https://api-m.sandbox.paypal.com/v1/oauth2/token
   - Header: Authorization: Basic base64(CLIENT_ID:CLIENT_SECRET)
   - Body: grant_type=client_credentials
2. Use token for all subsequent API calls

### Create Order
POST https://api-m.sandbox.paypal.com/v2/checkout/orders
```json
{
  "intent": "CAPTURE",
  "purchase_units": [{
    "reference_id": "video_<VIDEO_ID>",
    "description": "SkyStock FPV: <VIDEO_TITLE>",
    "amount": {
      "currency_code": "AUD",
      "value": "29.99"
    }
  }]
}
```

### Capture Order
POST https://api-m.sandbox.paypal.com/v2/checkout/orders/<ORDER_ID>/capture

### Refund
POST https://api-m.sandbox.paypal.com/v2/payments/captures/<CAPTURE_ID>/refund

### Switch to Production
Change base URL from api-m.sandbox.paypal.com to api-m.paypal.com

## Resend Email Template
On successful purchase, send email with:
- Subject: "Your SkyStock FPV Download is Ready"
- From: noreply@yourdomain.com
- Body: Video title, download link (https://skystock.pages.dev/download?token=xxx), mention 5 download limit and 72hr expiry

## Key Design Decisions
- Watermark is applied client-side on preview video (CSS overlay), but admin should upload a pre-watermarked preview clip for distribution
- Original unwatermarked files are stored in R2 and only accessible via time-limited presigned URLs after purchase
- Download tokens expire after 72 hours and allow max 5 downloads
- All prices stored in cents (integer) to avoid floating point issues
- Demo data is built into Home.tsx so the storefront looks populated even before any videos are uploaded
- Clerk protects admin routes; only user IDs in ADMIN_USER_IDS env var can access admin panel
