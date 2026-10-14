# Hajira: attendance & leave management

A full-stack employee attendance and leave system: check-in/check-out with server-side timestamps, shifts with grace periods, leave with balances and multi-level approval, attendance corrections, a holiday calendar, notifications, role dashboards and exportable reports.

*Hajira* (হাজিরা) means "attendance" in Bangla. The seed data is a fictional Dhaka software company: Asia/Dhaka time, Friday–Saturday weekend, Bangladeshi public holidays and Labour Act–style leave types.

> Portfolio project. All people, companies and records in the seed data are made up.

---

## Features

**Attendance**
- One-tap check-in/out with a live, server-synced clock. Timestamps are always taken on the server.
- Late detection (shift start + grace), early-leave detection, worked hours, overtime and half days.
- Statuses: `PRESENT · LATE · ABSENT · HALF_DAY · ON_LEAVE · HOLIDAY · WEEKEND`.
- A nightly job settles each day and marks people absent only when there was no check-in, no approved leave, no holiday and it was a working day.
- Forgotten check-outs are closed automatically at shift end and flagged for review.
- Optional check-in restriction to office IPs (exact addresses or `103.48.16.*` prefixes).
- Double check-in is impossible: there is a unique constraint on `(userId, date)`.
- Night shifts that cross midnight are supported.

**Shifts**
- Fixed, night and flexible shifts with start/end, grace minutes, a half-day threshold and weekly days off.
- Assign a shift to people or to a whole department from a chosen date; history is kept.

**Leave**
- Leave types with a yearly quota, carry-forward (capped), maximum consecutive days, half days, and "document required after N days".
- Balances per employee, type and year.
- The day count excludes weekly offs and holidays. The apply form shows the exact working days before you submit.
- A request is blocked when the balance is insufficient (except for unpaid leave) or the dates overlap another request.
- Approval chain is configurable (manager → HR, manager only, or HR only). The balance is deducted only on final approval, and requests can be cancelled while pending.
- Team calendar (FullCalendar) showing who is away.

**Everything else**
- Attendance regularization (correction requests) → manager approval → record updated + audit entry.
- Late policy: "X late marks = 1 leave day deducted", applied monthly.
- In-app notifications (bell with unread count) and email for leave decisions, late warnings, missing check-outs and account approval.
- Audit log for attendance edits, leave decisions, role changes and settings, with a before/after diff.
- Reports: a monthly attendance sheet, a late report and a leave report, each exportable to **Excel** and **PDF**.
- Dashboards for employees, managers and HR/admins.

**Auth & security**
- Register → email verification → HR approval. HR can also invite people by email.
- Forgot password with a 15-minute single-use link, and password change from the profile.
- JWT access token (15 min) and refresh token (7 days with "remember me", otherwise a browser session). Both are httpOnly cookies. Refresh tokens rotate, are stored hashed, and reuse detection revokes the whole token family.
- Role-based access on the API (`EMPLOYEE · MANAGER · HR · ADMIN`, plus a seeded super admin) and route protection in Next middleware.
- argon2id password hashing; helmet, CORS with credentials, rate limits on login/register/reset, hpp and compression.

---

## Tech stack

| | |
|---|---|
| **Web** (`/client`) | Next.js 15 (App Router) · TypeScript · Tailwind CSS v4 · shadcn/ui-style components on Radix · lucide-react · framer-motion · next-themes · TanStack Query + axios · react-hook-form + zod · TanStack Table · recharts · FullCalendar · react-day-picker · date-fns(-tz) · sonner · zustand · nextjs-toploader · react-dropzone · cmdk |
| **API** (`/server`) | Express · TypeScript · Prisma + PostgreSQL · zod · argon2 · jsonwebtoken · helmet · cors · express-rate-limit · hpp · compression · pino · node-cron · nodemailer · multer (+ Cloudinary or local disk) · exceljs · pdfkit · swagger-ui-express + zod-to-openapi |
| **Shared** (`/shared`) | zod schemas, enums and response types used by both apps |

---

## Getting started

### Prerequisites
- Node.js 20 or newer (developed on Node 24)
- PostgreSQL 14 or newer

### 1. Install
```bash
npm install
```

### 2. Configure
```bash
cp server/.env.example server/.env
cp client/.env.example client/.env.local
```
In `server/.env`:
- set `DATABASE_URL` to your database (create it first, e.g. `CREATE DATABASE hajira;`);
- generate the two JWT secrets:
  ```bash
  node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
  ```

Leave `SMTP_HOST` empty in development: emails, including their verification and reset links, are printed to the API log. Leave `CLOUDINARY_URL` empty to store uploads in `server/uploads`.

#### Using Neon instead of local Postgres
The project is linked to a Neon project (`neon.ts`, `.neon`). Running `neon env pull` in the repo root writes two variables to `.env.local`:
- `DATABASE_URL`: the pooled URL (host ends in `-pooler`), used by the app.
- `DATABASE_URL_UNPOOLED`: the direct URL, which Prisma Migrate uses through `directUrl`.

The API (`server/src/config/env.ts`) and the Prisma CLI (`server/prisma.config.ts`) load the database settings in the same order:
1. real environment variables;
2. the repo-root `.env.local` (Neon);
3. `server/.env`.

So when `.env.local` exists, everything uses Neon. Delete or rename it to go back to the local database in `server/.env`. On a host, set both variables in the platform's environment settings.

### 3. Migrate and seed
```bash
npm run db:migrate      # applies prisma/migrations
npm run db:seed         # demo company, ~2.5 months of attendance history
```

### 4. Run
```bash
npm run dev             # API on :4000 and web on :3000, together
```
Open **http://localhost:3000**. API docs (Swagger) are at **http://localhost:4000/api/docs**.

### Demo accounts

| Role | Email | Password |
|---|---|---|
| Super admin | `admin@hajira.test` | `Admin@12345` |
| HR | `hr@hajira.test` | `Demo@12345` |
| Manager | `manager@hajira.test` | `Demo@12345` |
| Employee | `employee@hajira.test` | `Demo@12345` |

The sign-in page lists these as one-click fills. Hide the list with `NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS=false`. Override the admin credentials with `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` before seeding.

The seed leaves the demo employee not checked in today, so you can try check-in. It also leaves pending leave and a pending correction for the manager, and two registrations waiting for HR.

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | API + web in watch mode |
| `npm run build` | Build the API (tsup) and the web app (next build) |
| `npm run typecheck` | Type-check shared, server and client |
| `npm run lint` | ESLint for server and client |
| `npm run db:migrate` / `db:seed` / `db:reset` | Prisma migrate / seed / reset + reseed |
| `npm run jobs:run -w server -- close-day [YYYY-MM-DD]` | Settle a day (absences etc.) by hand |
| `npm run jobs:run -w server -- auto-close` | Close forgotten check-outs now |
| `npm run jobs:run -w server -- late-policy [YYYY-MM]` | Apply the late policy for a month |
| `npm run jobs:run -w server -- leave-year [YYYY]` | Open a leave year (carry-forward) |

Scheduled jobs (node-cron, office timezone): auto-close every 15 minutes, close-day at 00:10, late policy on the 1st at 01:30, new leave year on 1 January. Disable them with `ENABLE_CRON=false`.

---

## Architecture

```
/shared   zod schemas · enums · DTO types (TypeScript source, used by both apps)
/server
  prisma/            schema.prisma · migrations · seed.ts
  src/
    config/env.ts    validated environment
    lib/             prisma · logger · tokens/cookies · time (UTC ↔ office tz) · schedule
                     (shift resolution, holidays, leave days) · mailer · notify · audit · upload · settings
    middleware/      auth (authenticate/authorize) · validate (zod) · rate limits · error handler
    modules/<feature>/{routes,controller,service,schema}.ts
    jobs/            cron schedule + tasks
    docs/openapi.ts  OpenAPI document generated from the zod schemas
/client
  src/app/(auth)     sign in · register · verify email · forgot/reset password · accept invite
  src/app/(app)      dashboard · attendance · leave · calendar · holidays · approvals · team ·
                     reports · employees · admin/* · audit-logs · profile
  src/components     ui primitives · data table · charts · shell · stitch (signature components)
  src/features       feature components (dashboard, leave, approvals, attendance …)
  src/middleware.ts  route protection by session + role
```

- **Layering:** routes → controllers (thin, HTTP only) → services (rules) → Prisma. A central `asyncHandler` passes errors to a single error handler.
- **Response shape:** every endpoint returns `{ success, data, message, meta?: { page, limit, total, totalPages } }`. Errors return `{ success: false, data: null, message, code, errors? }`, where `errors` holds field messages for forms.
- **Same-origin API:** Next rewrites `/api/v1/*` and `/uploads/*` to Express. The browser only talks to one origin, so auth cookies stay first-party and the Next middleware can see the session.
- **Time:** instants are stored in UTC. Calendar dates (attendance day, leave range, holiday) are office-local dates in a `DATE` column. The office timezone is a setting (default `Asia/Dhaka`).
- **Attendance rules** live in one pure module (`server/src/modules/attendance/engine.ts`), shared by check-in, check-out, corrections, HR edits, the nightly job and the seed.
- **Performance:** server-side pagination, sorting and filtering on every list; indexes on `(userId, date)`, status, department and createdAt; `select`/`include` limited to the fields used; gzip; cache headers on reference data; React Query caching with optimistic check-in and approvals; charts and the calendar dynamically imported.

---

## Design

The UI is built around one idea: **every working day is a stitch**, after the running stitch of *nakshi kantha* quilts. Attendance, shifts and leave quotas are drawn as stitches: solid when settled, dashed while pending, a hairline on days off. A month reads at a glance. Colour never carries meaning alone; every status also has a label or a stitch form.

- Indigo shell, cool cotton ground, and status colours as thread: present green, late amber, absent red, leave blue, holiday purple. Light and dark themes.
- Anek Latin throughout, with tabular figures for every time and count.
- Chart series colours are validated for colour-blind separation in both themes.

Design decisions are recorded in `DESIGN.md` and `PRODUCT.md`.

---

## Deploying

- **API:** `npm run build -w server`, then `npm run db:deploy -w server && npm start -w server`. Set `NODE_ENV=production` so cookies are `secure`, and set `TRUST_PROXY=true` behind a proxy so IP restriction and rate limits see the real client IP. Configure SMTP and, ideally, Cloudinary.
- **Web:** set `API_URL` to the API's internal URL, then `npm run build -w client && npm start -w client`.
