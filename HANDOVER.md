# SkyStock FPV — Session Handover

Last updated at the end of a long session where we went from a single-operator stock footage site to a full multi-seller marketplace with PayPal payouts.

---

## 1. What this is

**SkyStock FPV** is a 360° aerial footage marketplace specialised to the DJI Avata 360. Two sides to the business:

- **Buyers** browse clips, reframe them live in the browser through a custom WebGL shader, and buy either the raw 360° master (one-time) or a clean watermark-free edit export ($4.99 per edit).
- **Sellers** (Avata 360 operators) apply, upload clips, keep **80% of each sale**, get paid via **PayPal Payouts**.

The in-browser shader-based reframe editor is the product moat — no other stock footage marketplace lets you reframe a 360° source live.

**Live at:** https://skystock.pages.dev
**Repo:** https://github.com/3dhuboz/skystock
**Main branch:** `main` — every commit is deployed via `npm run deploy` or `wrangler pages deploy dist`.

---

## 2. Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend | React 18 + Vite + TypeScript + Tailwind | Brand palette: `sky-*` + `ember-*` (navy/orange) |
| Routing | react-router-dom v6 | BrowserRouter, routes in `src/App.tsx` |
| Auth | Clerk (dev instance, `pk_test_…`) | Session-based, `publicMetadata.role` drives seller gate |
| Backend | Cloudflare Workers (Hono) | `functions/api/[[route]].ts` (~1700 lines) |
| DB | Cloudflare D1 | Migrations in `db/migrations/` |
| Storage | Cloudflare R2 | Presigned URLs via `aws4fetch`, HTTP Range for streaming |
| Payments | PayPal Sandbox | `api-m.sandbox.paypal.com` — needs flipping to prod later |
| Payouts | PayPal Payouts API v1 | Same sandbox endpoint |
| Email | Resend | From `noreply@cupcycle.au` (change for prod) |
| AI | OpenRouter (preferred) or Anthropic | Used for AI Fill on uploads |
| Hosting | Cloudflare Pages | Deploy = `npm run deploy` |

---

## 3. Secrets + env

### Set as Cloudflare Pages secrets (via `wrangler pages secret put`)
- `CLERK_SECRET_KEY` — Clerk dev secret key
- `PAYPAL_CLIENT_SECRET` — PayPal sandbox app secret
- `RESEND_API_KEY` — Resend API key
- `OPENROUTER_API_KEY` — OpenRouter API key (used for AI Fill)
- `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ACCOUNT_ID` — for presigned R2 uploads
- `ANTHROPIC_API_KEY` — fallback AI provider (optional)

### In `wrangler.toml` `[vars]` (not secret)
- `CLERK_PUBLISHABLE_KEY` + `VITE_CLERK_PUBLISHABLE_KEY`
- `PAYPAL_CLIENT_ID` + `VITE_PAYPAL_CLIENT_ID`
- `RESEND_FROM_EMAIL` = `noreply@cupcycle.au`
- `SITE_URL` = `https://skystock.pages.dev`
- `SITE_NAME` = `SkyStock FPV`
- `ADMIN_USER_IDS` = `user_3CZ73IGcVwlxf7T8DQW7hSKw7MN` (Steve's Clerk id)
- `ADMIN_EMAIL` = `""` — **YOU NEED TO SET THIS** for new-seller / new-clip alert emails to arrive
- `R2_BUCKET_NAME` = `skystock-videos`

### Local `.env`
- `VITE_CLERK_PUBLISHABLE_KEY`
- `VITE_PAYPAL_CLIENT_ID`

---

## 4. How to run things

```bash
# Install + build
npm install
npm run build

# Deploy (build + wrangler pages deploy in one)
npm run deploy

# Apply a D1 migration
npx wrangler d1 execute skystock-db --remote --file=./db/migrations/0003_paypal_payouts.sql

# Execute ad-hoc D1 SQL
npx wrangler d1 execute skystock-db --remote --command "SELECT * FROM sellers"

# Set a secret
npx wrangler pages secret put OPENROUTER_API_KEY --project-name=skystock
```

---

## 5. Key file map

```
src/
├── App.tsx                         # Routes + Auth/Admin/Seller gates
├── main.tsx                        # ClerkProvider + ErrorBoundary mount
├── index.css
├── lib/
│   ├── admin.ts                    # useIsAdmin, ADMIN_USER_IDS allow-list (mirror of wrangler)
│   ├── seller.ts                   # useIsSeller hook (reads publicMetadata.role)
│   ├── editor.ts                   # Core 360° editor library — shader, scene, LUTs, presets, auto-color
│   ├── api.ts                      # Frontend API helpers (request helper auto-attaches Clerk bearer on /admin/* + /seller/*)
│   └── types.ts                    # Video / Order / DashboardStats / UploadPayload / ColorPreset etc.
├── components/
│   ├── Layout.tsx                  # Public nav + footer (with Sellers column CTA)
│   ├── Logo.tsx                    # Three-chevron orbit mark, sky→ember gradient
│   ├── VideoCard.tsx               # Clip card, scale(1.55) centre-zooms to hide equirect warp
│   ├── HeroReframer.tsx            # Shader-rendered video with interactive lens chips + Reset
│   ├── FpvShowcase.tsx             # Procedural Canvas 2D animation (fallback for empty library)
│   ├── ErrorBoundary.tsx           # Catches React render crashes, shows stack + reload
│   └── admin/AdminLayout.tsx       # Admin sidebar + moderation-count badge
└── pages/
    ├── Home.tsx                    # Landing: hero + Avata spec strip + features + pricing + SELL YOUR FOOTAGE CTA
    ├── Browse.tsx                  # Library with chip filters
    ├── VideoDetail.tsx             # Twin-tier purchase (raw / reframe-and-export) + "Shot by {name}" chip
    ├── Editor.tsx                  # Main NLE — 1700+ lines. Motion/Lens/Speed/Color/Text/Keyframes tabs
    ├── SignInPage.tsx              # Clerk sign-in with brand chrome
    ├── Account.tsx                 # My edits / purchases, fetches /me/orders
    ├── SellerApply.tsx             # /seller/apply — onboarding form with PayPal email
    ├── SellerClips.tsx             # Seller's own clips + earnings (locked)
    ├── SellerUpload.tsx            # Thin wrapper around AdminUpload with sellerMode=true
    ├── SellerProfile.tsx           # Public /s/:id — creator page with clip grid
    ├── Success.tsx                 # Post-purchase — emerald victory page
    ├── Download.tsx                # Token-gated download
    └── admin/
        ├── Dashboard.tsx           # Real stats, empty-state-safe
        ├── AdminVideos.tsx
        ├── AdminUpload.tsx         # Supports sellerMode prop — one component, two endpoints
        ├── AdminEditVideo.tsx      # Media re-upload + Auto-repair from R2
        ├── AdminOrders.tsx
        ├── AdminModeration.tsx     # Seller approval + clip review + revenue-share override
        ├── AdminPayouts.tsx        # Per-seller PayPal payout send + history
        └── AdminSettings.tsx       # Real integration health probes

functions/api/[[route]].ts          # Entire backend — public API, admin, seller, PayPal, Resend, payouts

db/
├── schema.sql                      # Original schema
└── migrations/
    ├── 0001_marketplace.sql        # sellers table + videos.seller_id
    ├── 0002_order_payouts.sql      # orders.seller_payout_cents etc.
    └── 0003_paypal_payouts.sql     # payouts table + orders.paid_out_at
```

---

## 6. Current state by feature

### ✅ Live and working
- **Public library** (`/`, `/browse`, `/video/:id`, `/s/:seller_id`)
- **Editor** (`/edit/:id`) — motion tiles, lens tiles + RockSteady / Horizon Leveling toggles + live Pan/Tilt/Roll/FOV telemetry readouts, LUT picker with 12 presets across Pro/Nature/Urban/Mood, speed preset tiles with waveforms, keyframe easing curve icons, HH:MM:SS:FF timecode, filmstrip timeline, inline clip badges, motion intensity slider, dashboard overlay toggle
- **Admin pipeline** (`/admin/*`) — gated by Clerk user id allow-list
- **Admin can auto-repair orphaned R2 uploads** via `/admin/videos/:id/repair`
- **Admin gets 4K master source in the editor**, customers see watermarked preview. `/api/media/` supports HTTP Range so 3GB files stream.
- **Auto error recovery on stale chunks** — lazy-loaded Editor chunk gets auto-reloaded once on 404.
- **Upload flow** — AI Fill (OpenRouter → Claude Sonnet 4.5 with vision), auto-thumbnail (center-crop watermarked), auto-preview (24s lens-cycle showcase via WebGL shader + MediaRecorder)
- **Account page** — fetches real orders from `/me/orders`

### ✅ Marketplace Phase 1 (invite-only seller beta)
- `/seller/apply` — form with PayPal email, attestations, polls for approval
- `/admin/moderation` — approve/reject sellers + clips + revenue share override (70/80/85/100%)
- Approve button flips Clerk `publicMetadata.role = 'seller'` automatically
- `/seller/clips` — dashboard with earnings (locked at capture time, never retroactive)
- `/seller/upload` — reuses AdminUpload with `sellerMode` prop → `/seller/videos` endpoints
- `/s/:seller_id` — public creator page with clip grid
- `"Shot by {seller_name}"` attribution chip on VideoDetail links to profile
- 5 transactional emails via Resend: applied, approved, clip-live, clip-rejected, admin-notify-new-*

### ✅ Marketplace Phase 2 (PayPal payouts)
- `/admin/payouts` — summary + history + per-seller Pay Out button
- Calls PayPal Payouts API v1 (`recipient_type: EMAIL`)
- `orders.paid_out_at` / `orders.payout_id` set on success
- Confirmation prompt before sending
- History with colour-coded PayPal status pills

### ⚠️ Needs attention
- **`ADMIN_EMAIL` is empty** in `wrangler.toml` — new-seller / new-clip admin alerts won't fire. Set to your inbox and redeploy.
- **PayPal endpoints still point at sandbox** (`api-m.sandbox.paypal.com`). Swap to `api-m.paypal.com` in `functions/api/[[route]].ts` (search for `sandbox`) when you go live.
- **Purchase flow never end-to-end tested** with a real PayPal sandbox account. Buy a clip, check email delivery, check the download token, check orders.seller_payout_cents is recorded.
- **Credentials exposed in chat**: the Clerk `sk_test_…` and OpenRouter `sk-or-v1-…` keys were pasted plain-text during the session. Rotate both when you get a chance.
- **The `dLogM` property** on `ColorAdjust` — `computeAutoColor` returns a `dLogM: boolean` but the type only has `dLogIntensity: number`. The Editor's Auto handler reads `auto.dLogM ? 1 : existing` so it works, but `tsc --noEmit` complains. Low priority.

### 🔜 Suggested next work
**Phase 2.5 / pre-prod polish**
1. **Sandbox → production** flip for PayPal (env flag, not a code change)
2. Admin inbox email set in `wrangler.toml`
3. **Purchase flow end-to-end test** using a PayPal sandbox buyer account
4. **Seller draft persistence** — currently editor state is in-memory; add IndexedDB so sellers don't lose work
5. **Recurring monthly payout cron** — `wrangler.toml` Cron Triggers + `scheduled()` handler that runs the first of each month
6. **Seller profile avatars + social links** — currently just display name + location + bio

**Quality of life**
7. Multi-clip "Apply to all" in the editor (lens/color bulk)
8. CASA RePL validation — hit their public API to confirm the number
9. DMCA / takedown endpoint — buyer-side form to report copyright issues
10. ABN collection for AU sellers (marketplace GST kicks in over $75k/yr turnover)

**Content / product**
11. More LUT presets (we have 12, Adobe Stock has dozens)
12. Dashboard telemetry baked into exports (the `setDashboard()` API is wired into the scene but the export path doesn't currently respect it)
13. Music library expansion (`STOCK_MUSIC` in `lib/editor.ts` — only a handful there)

---

## 7. Database schema overview

### `videos`
Original columns: `id, title, description, location, tags (JSON), price_cents, duration_seconds, resolution, fps, file_size_bytes, preview_key, watermarked_key, original_key, thumbnail_key, status, download_count, view_count, featured, created_at, updated_at`

Added by migrations:
- `seller_id` (TEXT, nullable — null = admin-owned legacy clip)
- `seller_payout_cents` (cache, not currently used — authoritative is on orders)
- `moderation_notes` (rejection reason, shown in seller's clip list)

### `orders`
Original: `id, video_id, buyer_email, buyer_name, paypal_order_id, paypal_capture_id, amount_cents, currency, status, created_at, completed_at`

Added by migrations:
- `platform_fee_cents` / `seller_payout_cents` / `seller_id` / `revenue_share_bps` — locked at capture
- `paid_out_at` / `payout_id` — set when the admin sends a PayPal Payouts batch

### `sellers`
- `id` (Clerk user id = primary key)
- `display_name, bio, location, email, rpl_number, payout_notes`
- `payout_paypal_email` — where payouts are sent
- `payout_method` ('manual' default)
- `stripe_account_id` (unused in PayPal-only mode, kept for future)
- `revenue_share_bps` (default 8000 = 80%)
- `approved` (0/1), `approved_at`
- `total_payout_cents` (lifetime paid cache)
- `clip_count` (cache, not actively maintained)

### `payouts`
- `id, seller_id, total_cents, currency, paypal_batch_id, paypal_batch_status, order_ids (JSON), created_at, completed_at, note`

### `download_tokens`
Unchanged from original — `id, order_id, video_id, token, expires_at, max_downloads, download_count`

---

## 8. Architecture decisions worth knowing

**Why Clerk `publicMetadata.role` and not a server-side lookup per request**
Flipping Clerk metadata on approve means `useIsSeller()` is a sync hook reading the already-cached user object — no D1 roundtrip per page load. The `role` value is signed in the session JWT so the client can't lie about it. D1 is still authoritative (every seller endpoint re-checks `requireApprovedSeller()`).

**Why earnings are locked at capture time**
If `sellers.revenue_share_bps` changes, past earnings would be retroactively wrong. So every completed order snapshots `seller_payout_cents`, `platform_fee_cents`, `seller_id`, `revenue_share_bps` at PayPal-capture time. `/seller/clips` reads the sum of stored payout cents, not a live computation.

**Why admin allow-list, not Clerk org roles**
Cheaper — free Clerk plan has no org role support. `ADMIN_USER_IDS` var lists Clerk user ids verbatim. Future could swap to org roles without much effort.

**Why Range support in `/api/media/`**
3 GB 4K masters crash the browser without `<video>` seeking. The Range handler reads the `Range` header, calls `R2.get(key, { range: { offset, length } })`, and returns 206 Partial Content with `Content-Range + Content-Length`. Browsers seek immediately.

**Why a wrapper `lazyWithReload` for the Editor chunk**
Every deploy changes the Three.js chunk hash. Visitors with the old app shell cached get "Failed to fetch dynamically imported module" and a blank screen. Wrapper catches the import rejection, flips sessionStorage, reloads once. Stops the infinite reload loop if reload-and-retry also fails.

**Why PayPal Payouts not Stripe Connect**
Steve uses PayPal. No onboarding flow for sellers — just an email address. No partner agreement. The money flows out the same account it comes in through. Tradeoff: no automated GST handling (Australian marketplace GST > $75k/yr is manual BAS work with your accountant).

**Why the centre-zoom trick on VideoCards**
Equirectangular 360° frames have low-distortion centres and warped edges. `transform: scale(1.55)` on `object-fit: cover` zooms into the centre — the warped trees on the sides are cropped out of frame. Cheap, effective, no shader cost per card.

**Why the editor defaults to Static preset**
The old default was Orbit with a sine-wave yaw. On a short clip that's visibly wobbling. Static = no motion until the user opts in. Orbit / Fly-through now use monotonic (not oscillating) paths.

---

## 9. Common tasks cheatsheet

### Add a new seller manually
```sql
INSERT INTO sellers (id, display_name, location, email, payout_paypal_email,
                     revenue_share_bps, approved, approved_at)
VALUES ('user_xxx', 'Jane D', 'Byron Bay, NSW', 'jane@email.com',
        'jane@paypal.com', 8000, 1, datetime('now'));
```
Then flip their Clerk metadata via the Clerk dashboard OR hit `/api/admin/sellers/user_xxx/approve` (which also sets the role).

### Backfill a clip's seller ownership
```sql
UPDATE videos SET seller_id = 'user_xxx' WHERE id = 'video_uuid';
```

### Change a seller's revenue share
Use the moderation page UI or:
```bash
curl -X POST -H "Authorization: Bearer $CLERK_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"bps": 8500}' \
     https://skystock.pages.dev/api/admin/sellers/user_xxx/share
```

### Send a PayPal payout manually
Open `/admin/payouts`, click **Pay out** on the row. Confirmation prompt shows recipient + amount.

### Deploy
```bash
npm run deploy
# or:
npm run build && npx wrangler pages deploy dist
```

---

## 10. Active admin user

- **Clerk user id:** `user_3CZ73IGcVwlxf7T8DQW7hSKw7MN`
- **Display name in seller table:** `Steve H`
- **Revenue share:** 100% (admin's own clips, no platform fee)
- **Location:** `Rockhampton, QLD`
- **Existing clips owned:**
  - `99547666-5fa9-4971-ab60-20438c1905d1` — Rigglesford Park Tree-Lined Path
  - (plus Frenchville Sunrise Over Suburbs — check `SELECT id FROM videos WHERE seller_id='user_3CZ73IGcVwlxf7T8DQW7hSKw7MN'`)

---

## 11. Recent commits (most recent first)

- `1c6de60` — Phase 2: PayPal Payouts API for seller payouts
- `a1bb6fa` — Lock seller payout at checkout + revenue share override UI
- `9c37b45` — Marketplace discoverability + attribution backfill + admin moderation badge
- `68f0d83` — Public seller profile pages (/s/:id) + admin email fix
- `d431b54` — Transactional emails for seller lifecycle + apply-page status detection
- `806cb75` — Auto-flip Clerk role on seller approve/reject
- `990554d` — Marketplace Phase 1 complete — sellers can upload, admins can moderate
- `25b4190` — Marketplace Phase 1 step 1-3: D1 migration + useIsSeller + /seller/apply

Full log: `git log --oneline -40`.

---

## 12. If something's on fire

### Deploys fine but `/admin` is blank
ErrorBoundary caught a crash — scroll down the error page for stack + component tree. Most recent fix: `Dashboard.tsx` crashed when backend didn't return `revenue_by_month`; the API response is now normalised with `Array.isArray(x) ? x : []` defensively.

### Editor won't load
Check `/assets/Editor-XXX.js` 404 in the network tab. The `lazyWithReload` wrapper should force a reload once; if it's still 404 after reload, the Cloudflare Pages deploy is stale or failed. Redeploy with `npm run deploy`.

### PayPal payout says ERROR
Check `payouts.paypal_batch_status` in D1. Sandbox PayPal needs to have a balance — fund it from the sandbox dashboard at developer.paypal.com → Accounts. Live PayPal needs your real account to have the funds.

### Emails not arriving
- `RESEND_API_KEY` set? (`npx wrangler pages secret list --project-name=skystock` won't show values, only names.)
- `RESEND_FROM_EMAIL` is `noreply@cupcycle.au` — the domain needs to be verified in Resend or emails silently drop.
- Admin alerts specifically: `ADMIN_EMAIL` still empty in `wrangler.toml`? Fill it in and redeploy.

### D1 schema out of sync
Run `SELECT sql FROM sqlite_master WHERE type='table'` against the remote DB to see what's actually deployed, then replay any migration files that haven't run. Migrations are idempotent (`CREATE TABLE IF NOT EXISTS`, `ALTER TABLE` will fail gracefully on second run — ignore the error).

---

Good luck. Everything's committed, deployed, and reproducible from this file + the repo.
