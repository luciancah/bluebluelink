# BlueBlueLink MVP Design

Date: 2026-05-05
Linear: [BLU-5](https://linear.app/bluebluelink/issue/BLU-5/finalize-mvp-design-and-implementation-plan)
Project: [BlueBlueLink](https://linear.app/bluebluelink/project/bluebluelink-87834a653f2b)

## Summary

BlueBlueLink is a self-owned rebuild of 진형링크, a Korean mobile-first web app for sharing a driver's live location with a waiting friend. The product should answer the friend's real question first: "언제 도착해?" Raw coordinates are secondary.

The first build will preserve the Base44 app's core flows while replacing Base44-specific helpers with owned frontend, backend, and data boundaries. Naver Maps and traffic-aware ETA are planned as a focused follow-up once the live-sharing foundation is working.

## Goals

- Authenticated owner dashboard for creating and managing temporary location shares.
- Sender route at `/broadcast/:id` for foreground GPS broadcasting.
- Public receiver route at `/track/:code` with optional PIN protection.
- Clear Korean states for active, stale, stopped, expired, denied permission, and unavailable location.
- Owned backend and database model that can support Naver REST API proxying without leaking server secrets.
- PWA app shell and resilient foreground tracking without promising closed-app background GPS.

## Non-Goals

- Native-app-grade continuous background GPS after the page/app is closed.
- Multi-driver groups, chat, full trip history playback, analytics, admin tooling, or geofencing.
- Naver routing/ETA in the first scaffold slice.
- Long-term precise location history retention.

## Product Language

The UI should avoid technical or streamer-like wording when possible:

- Prefer `위치 공유`, `공유 중`, `공유 중지`, `친구에게 공유`.
- Reduce or hide `세션`, `라이브 세션`, and `방송` in end-user flows.
- Use Korean relative time: `방금 업데이트됨`, `12초 전 업데이트됨`, `1시간 남음`.
- Prefer Korean address, landmark, destination, ETA, and stale-state labels before coordinates.

## Architecture

Use a TypeScript monorepo:

- `apps/web`: React 18 + Vite SPA.
- `apps/api`: Fastify HTTP API.
- `packages/shared`: shared validation schemas, DTO types, status enums, and formatting helpers.

The frontend remains a thin SPA using React Router, TanStack Query, Tailwind CSS, shadcn/ui, lucide-react, sonner, and a small map abstraction. The backend owns auth, session lifecycle, public tracking reads, location writes, SSE fanout, rate limits, and later Naver REST proxy endpoints.

Postgres is the persistent store. Prisma is the first ORM/migration layer because it gives a clear schema, repeatable migrations, and generated TypeScript types. Plain latitude/longitude columns are enough for MVP; PostGIS can be added later if route/history/geospatial querying becomes real product scope.

## Routes

- `/`: owner dashboard. Requires login.
- `/broadcast/:id`: sender view. Requires owner session or signed sender token.
- `/track/:code`: public receiver view. Does not require login, but respects session code, PIN, expiry, and status.

## Data Model

### User

- `id`
- `email`
- `password_hash` or future magic-link identity fields
- `created_at`
- `updated_at`

### ShareSession

- `id`
- `owner_id`
- `session_code`
- `session_name`
- `status`: `active`, `expired`, `stopped`
- `expires_at`
- `last_updated_location`
- `latitude`
- `longitude`
- `accuracy_meters`
- `pin_code_hash`
- `destination_name`
- `destination_lat`
- `destination_lng`
- `created_at`
- `updated_at`
- `stopped_at`

PINs are never stored as plain text. Normal request logs must not include precise coordinates or PIN values.

## Auth And Access

The dashboard uses an HTTP-only cookie session. The sender route should initially require the logged-in owner session. A signed sender token can be added when we want a shareable sender-only URL.

The public tracking route returns only the data needed by the waiting friend: status, latest location, freshness, destination, route/ETA when available, and safe display metadata. It must not expose owner email, internal IDs beyond public code, PIN hashes, or private audit data.

## Live Location Flow

1. Owner creates a location share.
2. Owner opens `/broadcast/:id`.
3. Sender page requests geolocation permission in a secure context.
4. Sender page starts `navigator.geolocation.watchPosition` only while the share is active.
5. Sender sends throttled location updates to the API with latitude, longitude, accuracy, and timestamp.
6. API validates ownership, session status, expiry, and location quality.
7. API stores the latest location in Postgres and emits an update to connected receivers.
8. Receiver page uses SSE for one-way updates and falls back to polling when disconnected.

Stale location is a product state, not a hidden failure. The viewer should see when the last update is old.

## PWA And Platform Contract

The app can be installable and resilient for foreground use with a manifest, icons, service worker, app-shell caching, wake lock attempts, and reconnect/retry behavior.

The app must not claim reliable continuous GPS while closed or backgrounded. Service workers can cache/proxy requests and wake for specific events, but they do not provide persistent GPS tracking. If closed-app background GPS becomes mandatory, the product needs a native app or native wrapper track.

Reference docs:

- [MDN Geolocation API](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API)
- [MDN watchPosition](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/watchPosition)
- [web.dev Web App Manifest](https://web.dev/learn/pwa/web-app-manifest)
- [web.dev Service Workers](https://web.dev/learn/pwa/service-workers)

## Naver Maps Plan

Naver integration is split into two layers:

- Client-visible JavaScript map rendering config in the web app.
- Server-held Naver Cloud REST credentials in the API for geocoding, reverse geocoding, and directions.

No Naver REST secret may appear in bundled JavaScript, logs, screenshots, or public config. The API proxy will validate inputs, rate limit requests, normalize errors, and monitor quota/cost exposure.

Reference docs:

- [Naver Maps JavaScript API](https://navermaps.github.io/maps.js.ncp/docs/naver.maps.Map.html)
- [Naver Cloud Maps overview](https://api.ncloud-docs.com/docs/en/ainaverapi-maps-overview)
- [Naver Directions 5](https://api.ncloud-docs.com/docs/en/ai-naver-mapsdirections-driving)
- [Naver Geocoding](https://api.ncloud-docs.com/docs/en/ai-naver-mapsgeocoding-geocode)

## UI Structure

### Dashboard

The dashboard should be quick for a driver under time pressure:

- Primary action: create/share location.
- Active shares first.
- Past shares compact and address-first.
- Destructive stop/delete actions confirm or offer undo.
- Coordinates are available only as secondary detail.

### Sender View

The sender view should separate location acquisition, upload, and viewer-visible state:

- `GPS 확인 중`
- `위치 전송 중`
- `방금 전송됨`
- `업데이트 지연`
- `공유 종료됨`

It should show the current map, current accuracy/freshness, stop action, and share handoff.

### Receiver View

The receiver view should be ETA-first:

- `도착까지 N분` when route data is available.
- Distance, destination or pickup name, and freshness.
- Stale warning after the configured threshold.
- Driver stopped/expired/no-location states.
- Map view with vehicle, viewer, destination, and route when available.

## Error Handling

Errors use stable app-level codes and natural Korean copy. Required states:

- Not logged in.
- Session not found.
- Session expired.
- Session stopped.
- PIN required.
- Invalid PIN.
- Too many PIN attempts.
- Geolocation permission denied.
- Geolocation unavailable.
- Insecure context.
- Location stale.
- Realtime disconnected with polling fallback.
- Naver API unavailable or quota-limited.

## Testing Strategy

- Unit tests for session status, expiry, code generation, PIN hashing/checking, stale logic, and Korean formatting helpers.
- API integration tests for create, list, stop, public lookup, PIN gate, sender location update, and SSE/polling fallback.
- Component tests for dashboard states, sender permission states, and receiver stale/expired states.
- Browser smoke test for dashboard to broadcast to public tracking.
- Manual mobile matrix for iOS Safari, installed iOS web app, Android Chrome, installed Android PWA, screen lock/background, relaunch, offline, and poor GPS accuracy.

## Implementation Slices

1. Foundation: monorepo, frontend shell, backend shell, shared schemas, database migration.
2. Live Sharing MVP: dashboard lifecycle, sender flow, public tracking, SSE/polling, privacy protections.
3. Naver Maps & ETA: credentials/proxy, Naver renderer, geocoding/reverse geocoding, directions/ETA.
4. PWA & Reliability: manifest, service worker, foreground tracking contract, manual device matrix.
5. UX Polish & Launch: Korean copy, share handoff, accessibility, compact history, launch QA.

## Review Notes

- No unresolved placeholders remain.
- The design intentionally separates live sharing from Naver ETA so development can start before Naver credentials are available.
- The design makes the PWA limitation explicit to avoid shipping misleading UX.
