# Two Souls — 3D perfume storefront

Two Souls is a Vite/React perfume storefront built around a photorealistic, scroll-directed Three.js bottle. Anime.js coordinates the bottle twist, atomizer press, mist, copy transitions, and liquid motion. The repository also contains the shop, cart, checkout, customer accounts, admin screens, reusable scene export, and offline cinematic-media workflow.

The complete application is designed for one Vercel project:

- Vite static frontend and SPA routing
- one Vercel Node Function at `api/index.js`
- Postgres records, users, sessions, MFA, inventory, orders, and settings
- Vercel Blob public product images and private payment receipts
- password accounts, email verification/reset, Google OAuth, authenticator MFA, and optional SMS MFA
- transactional order placement with server-side pricing, stock locks, coupons, tax, delivery fees, and idempotency

## Local start

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Open `http://localhost:5173`. The cinematic landing page and bundled sample catalog render without a database. Accounts, admin tools, persistent catalog changes, checkout, and uploads require the environment services described in [docs/VERCEL.md](docs/VERCEL.md).

## Validation

```bash
npm run check:deployment
```

This compiles Vercel routing, tests the API boundary and cinematic behavior, builds the production site, and verifies that every public asset is present byte-for-byte.

## Important directories

- `src/components/site/PerfumeScene.jsx` — WebGL bottle, physical glass/liquid, lighting, mist, and render-quality controls
- `src/components/site/ScrollExperience.jsx` — page-wide scroll choreography
- `src/api/storeClient.js` — same-origin browser API client
- `api/index.js` — Vercel Function router
- `server/` — authentication, entities, uploads, and transactional commerce actions
- `db/schema.sql` and `server/auth/schema.sql` — Postgres schema
- `public/` — catalog images, HDR environment, film assets, and posters
- `reusable/` and `exports/perfume-component/` — standalone component handoff
- `src/vendor/` and `scripts/media-pipeline.mjs` — pinned Open Generative AI and Freefield integration sources

Deployment and environment setup are in [docs/VERCEL.md](docs/VERCEL.md). The optional offline media workflow is in [docs/MEDIA-PIPELINE.md](docs/MEDIA-PIPELINE.md).
