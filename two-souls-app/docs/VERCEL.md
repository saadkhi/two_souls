# Vercel deployment

The frontend, routing, API, sessions, commerce actions, and environment configuration are contained in one Vercel project. Postgres is attached through Vercel Marketplace and file storage uses Vercel Blob. Registration email, Google sign-in, and SMS delivery use credentials stored in the Vercel project; no credentials are compiled into the browser.

## 1. Import and build

Import the repository in Vercel. The checked-in configuration selects:

- Framework: Vite
- Install command: `npm ci`
- Build command: `npm run build`
- Output directory: `dist`
- Runtime: Node.js 24, from `package.json`

Do not add a separate root directory. `vercel.json` sends `/api/*` to the single `api/index.js` Function, preserves real static files, and falls back to `index.html` only for browser routes.

## 2. Attach storage

In the Vercel project dashboard:

1. Add a Postgres provider from the Storage/Marketplace area. Ensure its pooled connection string is exposed as `DATABASE_URL` in Production and Preview.
2. Add a Vercel Blob store. Vercel supplies `BLOB_READ_WRITE_TOKEN` when it is connected to the project.

The first API request creates the schema and seeds the bundled settings, content, collections, products, reviews, and shipping zone. The SQL is also available in `server/auth/schema.sql` and `db/schema.sql`; `npm run db:schema` prints the combined schema for review or manual application.

## 3. Configure environment variables

Copy the names from `.env.example` into Vercel Project Settings → Environment Variables.

Required for the complete store:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Pooled Postgres connection string. |
| `BLOB_READ_WRITE_TOKEN` | Public catalog and private receipt storage. |
| `APP_URL` | Exact deployed origin, such as `https://shop.example.com`. |
| `DATA_ENCRYPTION_KEY` | At least 32 random characters for protected MFA data. |
| `ADMIN_EMAILS` | Comma-separated owner accounts. |
| `ADMIN_PASSWORD` | Initial password used only when an owner does not exist yet. |
| `RESEND_API_KEY` / `EMAIL_FROM` | Verification and password-reset email. |

Optional:

| Variable | Purpose |
| --- | --- |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth. Register `APP_URL/api/auth/oauth/google/callback`. |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM` | SMS MFA. |
| `MFA_REQUIRED` | Set to `true` to require enrollment; otherwise MFA is optional. |
| `DATABASE_POOL_SIZE` | Connections per warm Function instance, clamped to 1–10. |

Generate a production encryption key locally, for example with `openssl rand -base64 48`, and paste only the result into Vercel. Never put a secret in a `VITE_*` variable because Vite exposes those values to browsers.

Use separate Preview and Production databases when testing schema or admin changes. After changing environment variables, redeploy so every Function instance receives the new values.

## 4. First deployment checks

1. Open `/` and scroll through the full 3D bottle sequence.
2. Visit `/shop`, add a fragrance, and complete a test COD order.
3. Sign in with `ADMIN_EMAILS` and `ADMIN_PASSWORD`, then verify `/admin` data editing and a public image upload.
4. Register a separate customer, verify the email, log out/in, and request a password reset.
5. If enabled, test Google OAuth, authenticator MFA, SMS MFA, and private receipt upload/download.
6. Confirm direct loads of `/product/noir-oud`, `/account`, and `/admin/orders` do not return 404.

Run the repository checks before pushing:

```bash
npm run check:deployment
```

## Security and operational notes

- Sessions are random, database-backed, revocable, and stored in Secure HttpOnly SameSite cookies.
- Mutations reject cross-origin browser requests and accept JSON only.
- Product pricing, stock, discounts, delivery, tax, and totals are recomputed in a database transaction; browser totals are never trusted.
- Public image uploads require an administrator. Receipts are private, signature-checked, limited to 3 MB, and never expose their Blob URL to the browser.
- Repeated auth attempts are rate-limited in Postgres. Configure provider-side limits and alerts as well.
- The bundled seed catalog is included. Records or private files that exist outside this repository are not; obtain a separate export before replacing an existing production system.
- Vercel plan limits and acceptable-use terms can change. Confirm that the selected plan permits the intended commercial traffic before opening the store to customers.
