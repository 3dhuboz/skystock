-- SkyStock Database Schema

DROP TABLE IF EXISTS download_tokens;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS videos;
DROP TABLE IF EXISTS settings;

CREATE TABLE videos (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  tags TEXT DEFAULT '[]',
  price_cents INTEGER NOT NULL DEFAULT 2999,
  duration_seconds INTEGER,
  resolution TEXT DEFAULT '4K',
  fps INTEGER DEFAULT 60,
  file_size_bytes INTEGER,
  preview_key TEXT,
  watermarked_key TEXT,
  original_key TEXT,
  thumbnail_key TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  download_count INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  featured INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  video_id TEXT NOT NULL,
  buyer_email TEXT NOT NULL,
  buyer_name TEXT,
  paypal_order_id TEXT,
  paypal_capture_id TEXT,
  amount_cents INTEGER NOT NULL,
  currency TEXT DEFAULT 'AUD',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT,
  FOREIGN KEY (video_id) REFERENCES videos(id)
);

CREATE TABLE download_tokens (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  video_id TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  download_count INTEGER DEFAULT 0,
  max_downloads INTEGER DEFAULT 5,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (video_id) REFERENCES videos(id)
);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Default settings
INSERT INTO settings (key, value) VALUES ('default_price_cents', '2999');
INSERT INTO settings (key, value) VALUES ('watermark_text', 'SKYSTOCK FPV');
INSERT INTO settings (key, value) VALUES ('max_downloads_per_purchase', '5');
INSERT INTO settings (key, value) VALUES ('download_link_expiry_hours', '72');

-- Indexes
CREATE INDEX idx_videos_status ON videos(status);
CREATE INDEX idx_videos_featured ON videos(featured);
CREATE INDEX idx_orders_video_id ON orders(video_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_buyer_email ON orders(buyer_email);
CREATE INDEX idx_download_tokens_token ON download_tokens(token);
CREATE INDEX idx_download_tokens_order_id ON download_tokens(order_id);
