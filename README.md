# BlueBlueLink

Self-owned rebuild of JinHyeongLink, a Korean real-time vehicle location sharing app for telling a waiting friend when the driver will arrive.

## Current Status

- Local git repository initialized on 2026-05-05.
- Linear project created: https://linear.app/bluebluelink/project/bluebluelink-87834a653f2b
- Initial Linear backlog created from the Base44 spec, mobile screenshots, and parallel agent review.
- GitHub remote connected: https://github.com/luciancah/bluebluelink.git

## Local Development Account

Development builds include a demo driver account:

- Email: `driver@example.com`
- Password: `ride-home`

The demo account is only enabled when `NODE_ENV=development`.

## Naver Maps Credentials

`apps/web/.env` needs the browser-safe Maps client ID:

```bash
VITE_NAVER_MAPS_CLIENT_ID=<Naver Maps Client ID>
```

`apps/api/.env` needs the server-side REST credentials:

```bash
NAVER_MAPS_API_KEY_ID=<Naver Maps Client ID>
NAVER_MAPS_API_KEY=<Naver Maps Client Secret>
NAVER_MAPS_BASE_URL=https://maps.apigw.ntruss.com
```

Keep the client secret only in the API environment.

## Product Direction

Core MVP:

- Authenticated owner dashboard for creating and managing location shares.
- Sender page at `/broadcast/:id` for foreground GPS broadcasting.
- Public tracking page at `/track/:code` with optional PIN protection.
- Honest live/stale/expired/stopped states in Korean.

Next phases:

- Naver Maps rendering and server-side Naver REST API proxy.
- Korean geocoding, reverse geocoding, route, and traffic-aware ETA.
- Installable PWA app shell and reliable foreground location sending.
- Mobile UX polish focused on "when will the driver arrive?"

Important constraint:

- A PWA should not promise reliable continuous GPS after the app/page is closed. The planned MVP treats location sharing as foreground/active-session behavior.

## Linear Milestones

1. Foundation
2. Live Sharing MVP
3. Naver Maps & ETA
4. PWA & Reliability
5. UX Polish & Launch

## GitHub Setup

Create an empty GitHub repository, then connect it from this folder:

```bash
git remote add origin git@github.com:<owner>/<repo>.git
git branch -M main
git push -u origin main
```

Use HTTPS instead of SSH if that is how your GitHub auth is configured.
