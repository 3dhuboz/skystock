-- Phase 1.5: record the seller payout split at checkout time so later changes to
-- sellers.revenue_share_bps can't retroactively rewrite past earnings.

ALTER TABLE orders ADD COLUMN platform_fee_cents INTEGER DEFAULT 0;
ALTER TABLE orders ADD COLUMN seller_payout_cents INTEGER DEFAULT 0;
ALTER TABLE orders ADD COLUMN seller_id TEXT;         -- cached for fast seller-earnings queries
ALTER TABLE orders ADD COLUMN revenue_share_bps INTEGER DEFAULT 8000;  -- what split applied

CREATE INDEX IF NOT EXISTS idx_orders_seller ON orders(seller_id);
