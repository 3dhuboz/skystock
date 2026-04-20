-- Phase 2 (PayPal variant): seller payouts via PayPal Payouts API.

-- Seller's PayPal email for payouts. Separate from sellers.email (Clerk login)
-- because many people use different addresses for their PayPal account.
ALTER TABLE sellers ADD COLUMN payout_paypal_email TEXT;

-- Track which completed orders have been paid out to the seller.
ALTER TABLE orders ADD COLUMN paid_out_at TEXT;
ALTER TABLE orders ADD COLUMN payout_id TEXT;

-- Batch records — one row per admin-triggered payout run. A single row can
-- represent a single-seller payout OR a multi-seller batch.
CREATE TABLE IF NOT EXISTS payouts (
  id TEXT PRIMARY KEY,                       -- our internal id
  seller_id TEXT,                            -- null = multi-seller batch
  total_cents INTEGER NOT NULL,
  currency TEXT DEFAULT 'AUD',
  paypal_batch_id TEXT,                      -- PayPal's payout_batch_id
  paypal_batch_status TEXT,                  -- PENDING, SUCCESS, DENIED...
  order_ids TEXT NOT NULL,                   -- JSON array of order ids included
  created_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT,
  note TEXT
);

CREATE INDEX IF NOT EXISTS idx_orders_unpaid
  ON orders(seller_id, paid_out_at)
  WHERE status = 'completed' AND paid_out_at IS NULL;
