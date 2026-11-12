# Snip Backend (updated)

## Install and run

```bash
npm install
npm run dev
```

Production:

```bash
npm start
```

## Environment variables

Copy `.env.example` to `.env` and fill in real values. Do not commit `.env`.

Required:
- `MONGO_URI` (or the existing `mongoDbConnectionString`)
- `JWT_KEY`
- `API_BASE_URL` (public backend URL; used in generated short links and activation emails)
- `CLIENT_URL` (frontend URL; used for post-activation redirect and password-reset links)
- `BREVO_API_KEY`
- `BREVO_SENDER_EMAIL` (must be a verified Brevo sender)

Optional:
- `PORT`
- `BREVO_SENDER_NAME`
- `CORS_ORIGINS` (comma-separated additional frontend origins)

## Authentication endpoints

- `POST /api/auth/register` — creates an inactive account and sends activation email.
- `GET /api/auth/verify-email/:token` — verifies the email and redirects to frontend `/login?verified=true`.
- `POST /api/auth/resend-activation` — resend activation email using `{ "email": "..." }`.
- `POST /api/auth/login` — refuses login until email is activated.
- `POST /api/auth/forgot-password`
- `GET /api/auth/reset-password/:token/verify`
- `PATCH /api/auth/reset-password/:token`
- `GET /api/auth/profile` (Bearer token)
- `GET /api/auth/verify-token` (Bearer token)

## URL endpoints

- `POST /api/urls/shorten` — accepts `{ "originalUrl": "https://..." }`; optional JWT associates the link with that user. Guest links remain unowned.
- `GET /api/urls/my-links?page=1&limit=10` (Bearer token)
- `GET /api/urls/stats` (Bearer token) — returns `stats.totalLinks`, `stats.urlsToday`, `stats.urlsThisMonth`, `stats.totalClicks`, seven-day `chartData` (`date`, `urls`, `clicks`) and `topLinks`.
- `DELETE /api/urls/:id` (Bearer token)
- `GET /:shortCode` — redirects and increments click count.

## Compatibility note

The user schema defaults `isEmailVerified` to true for existing database records that predate email activation. New registrations explicitly set it to false until the activation link is used. This avoids locking out existing users during deployment.
