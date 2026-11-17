# Repository guidance

This repository contains the Two Souls Vite storefront and its Vercel Node Function backend. Keep user-facing behavior, the cinematic scene, sample catalog, reusable export, and commerce rules intact unless a request explicitly changes them.

## Architecture

- Browser code calls only same-origin `/api/*` routes through `src/api/storeClient.js`.
- `api/index.js` is the single Vercel Function entry point.
- `server/auth/` owns account, session, OAuth, and MFA tables.
- `server/entities.js` owns authorization for domain records.
- `server/actions.js` owns trusted pricing, coupons, stock changes, order placement, and tracking.
- `server/uploads.js` owns validated Vercel Blob uploads and private downloads.
- Secrets belong only in Vercel environment settings or an ignored local `.env.local` file. Never add them to `VITE_*` variables.

## Commands

```bash
npm ci
npm run dev
npm run check:deployment
```

Use `apply_patch` for source edits, preserve user changes, and keep generated dependency folders and credentials out of commits and archives.
