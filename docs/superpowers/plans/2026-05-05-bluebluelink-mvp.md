# BlueBlueLink MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a self-owned Korean live vehicle location sharing MVP with a React/Vite frontend, Fastify API, Postgres data model, and clear foreground GPS contract.

**Architecture:** Use an npm workspace monorepo with `apps/web`, `apps/api`, and `packages/shared`. The web app owns routes and UX; the API owns auth, share-session lifecycle, location writes, public tracking reads, SSE fanout, and future Naver REST proxying. Shared TypeScript schemas keep DTOs and status rules consistent across the app.

**Tech Stack:** React 18, Vite, TypeScript, React Router, TanStack Query, Tailwind CSS, shadcn/ui, lucide-react, sonner, Fastify, Prisma, Postgres, Vitest, React Testing Library, Playwright.

---

## File Structure

- Create `package.json`: root npm workspace scripts.
- Create `tsconfig.base.json`: shared TypeScript compiler settings.
- Create `docs/superpowers/specs/2026-05-05-bluebluelink-mvp-design.md`: product design source.
- Create `docs/superpowers/plans/2026-05-05-bluebluelink-mvp.md`: this implementation plan.
- Create `packages/shared`: session types, validation schemas, formatting, and unit tests.
- Create `apps/web`: Vite React SPA for dashboard, sender, and public tracking routes.
- Create `apps/api`: Fastify API, Prisma schema, auth/session services, public tracking endpoints, and SSE.

## Task 1: Monorepo Foundation (`BLU-6`, `BLU-7`)

**Files:**
- Create: `package.json`
- Create: `tsconfig.base.json`
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/index.ts`
- Create: `apps/web/package.json`
- Create: `apps/api/package.json`

- [ ] **Step 1: Add root workspace manifest**

Create `package.json` with:

```json
{
  "name": "bluebluelink",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "scripts": {
    "dev:web": "npm --workspace @bluebluelink/web run dev",
    "dev:api": "npm --workspace @bluebluelink/api run dev",
    "build": "npm --workspaces --if-present run build",
    "test": "npm --workspaces --if-present run test",
    "lint": "npm --workspaces --if-present run lint",
    "typecheck": "npm --workspaces --if-present run typecheck"
  },
  "engines": {
    "node": ">=20.11.0",
    "npm": ">=10.0.0"
  }
}
```

- [ ] **Step 2: Add shared TypeScript config**

Create `tsconfig.base.json` with:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true
  }
}
```

- [ ] **Step 3: Add package manifests**

Create `packages/shared/package.json` with:

```json
{
  "name": "@bluebluelink/shared",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "zod": "^3.24.1"
  },
  "devDependencies": {
    "typescript": "^5.7.2",
    "vitest": "^2.1.8"
  }
}
```

Create minimal `apps/web/package.json` and `apps/api/package.json` so workspace install can resolve.

- [ ] **Step 4: Install dependencies**

Run:

```bash
npm install
```

Expected: root `package-lock.json` is created and npm exits with code 0.

- [ ] **Step 5: Verify workspace**

Run:

```bash
npm run typecheck
```

Expected: typecheck passes for packages that have implementation files, or exits cleanly when only empty package shells exist.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json tsconfig.base.json packages apps
git commit -m "chore: add monorepo workspace"
```

## Task 2: Shared Session Domain (`BLU-7`, `BLU-13`)

**Files:**
- Create: `packages/shared/src/session.ts`
- Create: `packages/shared/src/session.test.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Write failing tests for status and stale logic**

Create `packages/shared/src/session.test.ts` with tests for:

```ts
import { describe, expect, it } from "vitest";
import {
  getSessionAvailability,
  isLocationStale,
  shareSessionSchema,
} from "./session";

describe("share session domain", () => {
  it("marks expired sessions unavailable", () => {
    const result = getSessionAvailability({
      status: "active",
      expiresAt: "2026-05-05T09:00:00.000Z",
      now: new Date("2026-05-05T10:00:00.000Z"),
    });

    expect(result).toEqual({ available: false, reason: "expired" });
  });

  it("marks stopped sessions unavailable", () => {
    const result = getSessionAvailability({
      status: "stopped",
      expiresAt: "2026-05-05T11:00:00.000Z",
      now: new Date("2026-05-05T10:00:00.000Z"),
    });

    expect(result).toEqual({ available: false, reason: "stopped" });
  });

  it("accepts active unexpired sessions", () => {
    const result = getSessionAvailability({
      status: "active",
      expiresAt: "2026-05-05T11:00:00.000Z",
      now: new Date("2026-05-05T10:00:00.000Z"),
    });

    expect(result).toEqual({ available: true, reason: null });
  });

  it("marks old location updates stale", () => {
    expect(
      isLocationStale({
        lastUpdatedLocation: "2026-05-05T09:59:00.000Z",
        now: new Date("2026-05-05T10:00:10.000Z"),
        staleAfterSeconds: 30,
      }),
    ).toBe(true);
  });

  it("validates public share session shape", () => {
    expect(() =>
      shareSessionSchema.parse({
        id: "session_1",
        sessionCode: "AB12CD34",
        sessionName: "퇴근길",
        status: "active",
        expiresAt: "2026-05-05T11:00:00.000Z",
        lastUpdatedLocation: null,
        latitude: null,
        longitude: null,
        accuracyMeters: null,
        destinationName: null,
        destinationLat: null,
        destinationLng: null,
      }),
    ).not.toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
npm --workspace @bluebluelink/shared run test
```

Expected: FAIL because `session.ts` does not exist yet.

- [ ] **Step 3: Implement session domain**

Create `packages/shared/src/session.ts` with:

```ts
import { z } from "zod";

export const shareSessionStatusSchema = z.enum(["active", "expired", "stopped"]);
export type ShareSessionStatus = z.infer<typeof shareSessionStatusSchema>;

export const shareSessionSchema = z.object({
  id: z.string().min(1),
  sessionCode: z.string().min(6).max(16),
  sessionName: z.string().min(1).max(80),
  status: shareSessionStatusSchema,
  expiresAt: z.string().datetime(),
  lastUpdatedLocation: z.string().datetime().nullable(),
  latitude: z.number().min(-90).max(90).nullable(),
  longitude: z.number().min(-180).max(180).nullable(),
  accuracyMeters: z.number().nonnegative().nullable(),
  destinationName: z.string().min(1).max(120).nullable(),
  destinationLat: z.number().min(-90).max(90).nullable(),
  destinationLng: z.number().min(-180).max(180).nullable(),
});

export type ShareSession = z.infer<typeof shareSessionSchema>;

export type SessionUnavailableReason = "expired" | "stopped";

export function getSessionAvailability(input: {
  status: ShareSessionStatus;
  expiresAt: string;
  now: Date;
}): { available: true; reason: null } | { available: false; reason: SessionUnavailableReason } {
  if (input.status === "stopped") {
    return { available: false, reason: "stopped" };
  }

  if (input.status === "expired" || new Date(input.expiresAt) <= input.now) {
    return { available: false, reason: "expired" };
  }

  return { available: true, reason: null };
}

export function isLocationStale(input: {
  lastUpdatedLocation: string | null;
  now: Date;
  staleAfterSeconds: number;
}): boolean {
  if (!input.lastUpdatedLocation) {
    return true;
  }

  const ageMs = input.now.getTime() - new Date(input.lastUpdatedLocation).getTime();
  return ageMs > input.staleAfterSeconds * 1000;
}
```

Export it from `packages/shared/src/index.ts`:

```ts
export * from "./session";
```

- [ ] **Step 4: Verify**

Run:

```bash
npm --workspace @bluebluelink/shared run test
npm --workspace @bluebluelink/shared run typecheck
```

Expected: both pass.

- [ ] **Step 5: Commit**

```bash
git add packages/shared
git commit -m "feat: add shared session domain"
```

## Task 3: Web App Shell (`BLU-6`)

**Files:**
- Create: `apps/web/index.html`
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/app/App.tsx`
- Create: `apps/web/src/app/router.tsx`
- Create: `apps/web/src/pages/DashboardPage.tsx`
- Create: `apps/web/src/pages/BroadcastPage.tsx`
- Create: `apps/web/src/pages/TrackingPage.tsx`
- Create: `apps/web/src/styles.css`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/tsconfig.json`

- [ ] **Step 1: Install web dependencies**

Run:

```bash
npm install -w @bluebluelink/web @vitejs/plugin-react vite typescript react react-dom react-router-dom @tanstack/react-query lucide-react sonner
npm install -w @bluebluelink/web -D vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

Expected: dependencies are added under `apps/web/package.json`.

- [ ] **Step 2: Add route smoke test**

Create `apps/web/src/app/router.test.tsx` testing that `/`, `/broadcast/demo`, and `/track/demo` render Korean headings.

- [ ] **Step 3: Implement routes**

Implement placeholder pages with these visible headings:

- Dashboard: `내 위치 공유`
- Broadcast: `위치 공유 중`
- Tracking: `도착 정보`

Use React Router route params for `id` and `code`.

- [ ] **Step 4: Verify**

Run:

```bash
npm --workspace @bluebluelink/web run test
npm --workspace @bluebluelink/web run typecheck
npm --workspace @bluebluelink/web run build
```

Expected: tests, typecheck, and build pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web package.json package-lock.json
git commit -m "feat: scaffold web app shell"
```

## Task 4: API Skeleton (`BLU-7`)

**Files:**
- Create: `apps/api/src/server.ts`
- Create: `apps/api/src/config.ts`
- Create: `apps/api/src/routes/health.ts`
- Create: `apps/api/src/server.test.ts`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/vitest.config.ts`

- [ ] **Step 1: Install API dependencies**

Run:

```bash
npm install -w @bluebluelink/api fastify @fastify/cors @fastify/cookie zod dotenv
npm install -w @bluebluelink/api -D tsx typescript vitest
```

Expected: dependencies are added under `apps/api/package.json`.

- [ ] **Step 2: Write health test**

Create a Vitest test that builds the Fastify app and asserts `GET /health` returns:

```json
{ "ok": true, "service": "bluebluelink-api" }
```

- [ ] **Step 3: Implement API app factory**

Export `buildServer()` from `apps/api/src/server.ts`. Keep `listen()` in a separate path so tests do not open a port.

- [ ] **Step 4: Verify**

Run:

```bash
npm --workspace @bluebluelink/api run test
npm --workspace @bluebluelink/api run typecheck
```

Expected: both pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api package.json package-lock.json
git commit -m "feat: scaffold api server"
```

## Task 5: Prisma Schema And Session Persistence (`BLU-7`, `BLU-9`, `BLU-13`)

**Files:**
- Create: `apps/api/prisma/schema.prisma`
- Create: `apps/api/src/db/prisma.ts`
- Create: `apps/api/src/sessions/sessionRepository.ts`
- Create: `apps/api/src/sessions/sessionRepository.test.ts`
- Create: `apps/api/.env.example`

- [ ] **Step 1: Install Prisma**

Run:

```bash
npm install -w @bluebluelink/api @prisma/client
npm install -w @bluebluelink/api -D prisma
```

Expected: Prisma dependencies are added.

- [ ] **Step 2: Add Prisma schema**

Model `User` and `ShareSession` with fields from the design spec. Use `pinCodeHash` instead of `pinCode`. Add unique indexes for `User.email` and `ShareSession.sessionCode`.

- [ ] **Step 3: Add repository tests**

Tests cover creating a session, finding by code, stopping a session, and omitting `pinCodeHash` from public DTO mapping.

- [ ] **Step 4: Verify generated client**

Run:

```bash
npm --workspace @bluebluelink/api exec prisma generate
npm --workspace @bluebluelink/api run test
```

Expected: Prisma client generates and tests pass using repository mocks or a local test database configured by `DATABASE_URL`.

- [ ] **Step 5: Commit**

```bash
git add apps/api package.json package-lock.json
git commit -m "feat: add session persistence schema"
```

## Task 6: Auth And Session API (`BLU-8`)

**Files:**
- Create: `apps/api/src/auth/password.ts`
- Create: `apps/api/src/auth/sessionCookie.ts`
- Create: `apps/api/src/routes/auth.ts`
- Create: `apps/api/src/routes/auth.test.ts`
- Modify: `apps/api/src/server.ts`

- [ ] **Step 1: Write auth route tests**

Cover login success, login failure, logout, and `GET /auth/me`.

- [ ] **Step 2: Implement password hashing and cookies**

Use `argon2` for password hashing. Use HTTP-only, same-site cookies. In production, cookies must be `secure`.

- [ ] **Step 3: Verify**

Run:

```bash
npm --workspace @bluebluelink/api run test
npm --workspace @bluebluelink/api run typecheck
```

Expected: auth tests and typecheck pass.

- [ ] **Step 4: Commit**

```bash
git add apps/api package.json package-lock.json
git commit -m "feat: add auth session API"
```

## Task 7: Share Session API (`BLU-9`, `BLU-11`, `BLU-13`)

**Files:**
- Create: `apps/api/src/routes/shareSessions.ts`
- Create: `apps/api/src/routes/shareSessions.test.ts`
- Create: `apps/api/src/sessions/codeGenerator.ts`
- Create: `apps/api/src/sessions/pin.ts`
- Modify: `apps/api/src/server.ts`

- [ ] **Step 1: Write route tests**

Cover:

- authenticated create/list/stop/delete;
- public lookup by code;
- PIN required;
- invalid PIN;
- expired/stopped public responses;
- rate-limited PIN attempts.

- [ ] **Step 2: Implement session routes**

Use these API paths:

- `POST /api/share-sessions`
- `GET /api/share-sessions`
- `POST /api/share-sessions/:id/stop`
- `DELETE /api/share-sessions/:id`
- `GET /api/public/share-sessions/:code`
- `POST /api/public/share-sessions/:code/verify-pin`

- [ ] **Step 3: Verify**

Run:

```bash
npm --workspace @bluebluelink/api run test
npm --workspace @bluebluelink/api run typecheck
```

Expected: tests and typecheck pass.

- [ ] **Step 4: Commit**

```bash
git add apps/api
git commit -m "feat: add share session API"
```

## Task 8: Sender Location Updates (`BLU-10`, `BLU-18`)

**Files:**
- Create: `apps/api/src/routes/locationUpdates.ts`
- Create: `apps/api/src/routes/locationUpdates.test.ts`
- Create: `apps/web/src/features/broadcast/useLocationBroadcast.ts`
- Create: `apps/web/src/features/broadcast/locationQuality.ts`
- Create: `apps/web/src/features/broadcast/locationQuality.test.ts`
- Modify: `apps/web/src/pages/BroadcastPage.tsx`

- [ ] **Step 1: Write location quality tests**

Cover accepted accuracy, rejected impossible coordinates, stale update detection, and throttled update cadence.

- [ ] **Step 2: Implement API endpoint**

Use:

- `PATCH /api/share-sessions/:id/location`

Request body:

```json
{
  "latitude": 37.3898,
  "longitude": 126.95278,
  "accuracyMeters": 20,
  "capturedAt": "2026-05-05T10:00:00.000Z"
}
```

- [ ] **Step 3: Implement sender hook**

Use `navigator.geolocation.watchPosition` only after explicit user action on the active sender page. Stop watching on route unmount, stop action, logout, or session expiry.

- [ ] **Step 4: Verify**

Run:

```bash
npm run test
npm run typecheck
```

Expected: all workspace tests and typechecks pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api apps/web packages/shared
git commit -m "feat: add sender location updates"
```

## Task 9: Public Tracking And Realtime (`BLU-11`, `BLU-12`)

**Files:**
- Create: `apps/api/src/realtime/locationHub.ts`
- Create: `apps/api/src/routes/realtime.ts`
- Create: `apps/api/src/routes/realtime.test.ts`
- Create: `apps/web/src/features/tracking/useTrackingSession.ts`
- Modify: `apps/web/src/pages/TrackingPage.tsx`

- [ ] **Step 1: Write realtime tests**

Cover SSE subscribe, location update fanout, disconnect cleanup, and polling fallback.

- [ ] **Step 2: Implement SSE endpoint**

Use:

- `GET /api/public/share-sessions/:code/events`

Events:

- `location`
- `stopped`
- `expired`
- `heartbeat`

- [ ] **Step 3: Implement web tracking hook**

Use EventSource first. If EventSource errors repeatedly, fall back to TanStack Query polling every 5 seconds and show a Korean disconnected state.

- [ ] **Step 4: Verify**

Run:

```bash
npm run test
npm run typecheck
```

Expected: all workspace tests and typechecks pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api apps/web
git commit -m "feat: add public realtime tracking"
```

## Task 10: PWA Shell And Mobile QA (`BLU-17`, `BLU-18`, `BLU-19`, `BLU-20`)

**Files:**
- Create: `apps/web/public/manifest.webmanifest`
- Create: `apps/web/public/icons/icon-192.png`
- Create: `apps/web/public/icons/icon-512.png`
- Create: `apps/web/src/pwa/registerServiceWorker.ts`
- Modify: `apps/web/src/main.tsx`
- Modify: `apps/web/src/pages/DashboardPage.tsx`
- Modify: `apps/web/src/pages/BroadcastPage.tsx`
- Modify: `apps/web/src/pages/TrackingPage.tsx`

- [ ] **Step 1: Add manifest and service worker registration**

Use Korean app names:

```json
{
  "name": "진형링크",
  "short_name": "진형링크",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#2563eb",
  "lang": "ko-KR",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

- [ ] **Step 2: Add Korean copy pass**

Replace technical terms in user-facing UI:

- `세션` becomes `위치 공유` in most labels.
- `방송` becomes `공유 중` or `위치 전송`.
- Mixed English relative time is replaced with Korean formatting helpers.

- [ ] **Step 3: Add mobile accessibility pass**

Add accessible labels for icon-only controls, numeric keypad for PIN, visible focus states, safe-area padding, reduced-motion support, and tap targets at least 44px.

- [ ] **Step 4: Verify**

Run:

```bash
npm run build
npm run test
npm run typecheck
```

Expected: build, tests, and typecheck pass.

- [ ] **Step 5: Manual QA**

Record manual results for:

- iOS Safari foreground share.
- Installed iOS web app foreground share.
- Android Chrome foreground share.
- Installed Android PWA foreground share.
- Screen lock/background recovery behavior.
- Offline app shell behavior.

- [ ] **Step 6: Commit**

```bash
git add apps/web docs
git commit -m "feat: add pwa and mobile polish"
```

## Final Verification

- [ ] Run full test suite:

```bash
npm run test
npm run typecheck
npm run build
```

- [ ] Confirm git state:

```bash
git status --short --branch
```

Expected: clean working tree on the feature branch.

- [ ] Update Linear:

Move completed issues to Done only after their tests pass and the commit is present locally.

## Execution Recommendation

Use subagent-driven execution by Linear issue:

- Agent 1: `BLU-6` web shell.
- Agent 2: `BLU-7` API/database shell.
- Parent session: review both, resolve integration, run full verification.
- Continue with `BLU-8` through `BLU-13` after the foundation compiles.

This keeps write scopes separate and lets the first real code land in small, reviewable commits.
