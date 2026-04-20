-- Phase 1 marketplace migration: add seller ownership + moderation fields to
-- videos, and introduce the sellers table. Safe to re-run (IF NOT EXISTS /
-- harmless-if-present ALTERs).
-- Apply with:
--   npx wrangler d1 execute skystock-db --remote --file=./db/migrations/0001_marketplace.sql
--
-- D1's SQLite doesn't support `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, so
-- we run the ALTER once and ignore failures on re-run using the --json flag.

ALTER TABLE videos ADD COLUMN seller_id TEXT;
ALTER TABLE videos ADD COLUMN seller_payout_cents INTEGER DEFAULT 0;
ALTER TABLE videos ADD COLUMN moderation_notes TEXT;

CREATE TABLE IF NOT EXISTS sellers (
  id TEXT PRIMARY KEY,                            -- Clerk user id (user_xxx)
  display_name TEXT,                              -- "Steve H", "Byron Drone Co"
  bio TEXT,                                       -- short operator blurb
  location TEXT,                                  -- "Rockhampton, QLD"
  email TEXT,                                     -- Clerk email cached for payouts
  payout_method TEXT DEFAULT 'manual',            -- 'manual' | 'stripe_connect' (phase 2)
  stripe_account_id TEXT,                         -- phase 2
  payout_notes TEXT,                              -- phase 1: BSB/acc/BPAY ref; encrypted later
  revenue_share_bps INTEGER DEFAULT 8000,         -- 80.00% default seller take, basis points
  rpl_number TEXT,                                -- CASA RePL (optional)
  approved INTEGER DEFAULT 0,                     -- 0=pending, 1=approved
  approved_at TEXT,
  total_payout_cents INTEGER DEFAULT 0,           -- lifetime paid out
  clip_count INTEGER DEFAULT 0,                   -- cache
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_videos_seller ON videos(seller_id);
CREATE INDEX IF NOT EXISTS idx_videos_status ON videos(status);
CREATE INDEX IF NOT EXISTS idx_sellers_approved ON sellers(approved);
