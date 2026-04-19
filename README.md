# SkyStock FPV

Premium 360° aerial FPV drone footage marketplace. Stock videos captured on the DJI Avata 360 across Central Queensland, Australia — every clip ships as a full spherical master, so buyers can reframe any angle in Insta360 Studio, Adobe Premiere, DaVinci Resolve, or any 360-capable editor.

## Tech Stack

- **Frontend**: React 18 + Vite + TypeScript + Tailwind CSS
- **Backend**: Cloudflare Pages Functions (Hono)
- **Database**: Cloudflare D1
- **Storage**: Cloudflare R2
- **Auth**: Clerk
- **Payments**: PayPal REST API
- **Email**: Resend

## Setup

### Prerequisites
- Node.js 18+
- Cloudflare account
- Clerk account
- PayPal Developer account
- Resend account

### 1. Install dependencies
```bash
npm install
```

### 2. Cloudflare Resources
```bash
# Create D1 database
wrangler d1 create skystock-db

# Create R2 bucket
wrangler r2 bucket create skystock-videos
```
Update `wrangler.toml` with your D1 database ID.

### 3. Initialize Database
```bash
npm run db:init          # local
npm run db:init:remote   # production
```

### 4. Environment Variables
Copy `.env.example` to `.env` and fill in your Clerk + PayPal keys.

Set Cloudflare secrets:
```bash
wrangler pages secret put CLERK_SECRET_KEY
wrangler pages secret put PAYPAL_CLIENT_SECRET
wrangler pages secret put RESEND_API_KEY
wrangler pages secret put ADMIN_USER_IDS
```

### 5. Development
```bash
npm run dev
```

### 6. Deploy
```bash
npm run deploy
```

## Project Structure
```
skystock/
├── db/schema.sql              # D1 database schema
├── functions/api/             # Cloudflare Pages Functions (API)
├── public/                    # Static assets
├── src/
│   ├── components/            # React components
│   │   └── admin/             # Admin panel components
│   ├── pages/                 # Page components
│   │   └── admin/             # Admin pages
│   └── lib/                   # Types, API client, utilities
├── COWORK_BRIEF.md            # Full project specification
├── wrangler.toml              # Cloudflare config
└── package.json
```

## License
All footage rights reserved. Code is proprietary.
