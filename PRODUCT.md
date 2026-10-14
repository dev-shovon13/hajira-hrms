# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

- Monorepo: `/client` and `/server`, TypeScript everywhere.
- Client: Next.js 15 (App Router), Tailwind CSS, shadcn/ui (Radix), lucide-react, framer-motion, next-themes, TanStack Query + axios, react-hook-form + zod, TanStack Table, recharts, date-fns(-tz), react-day-picker, FullCalendar, sonner, zustand, nextjs-toploader, react-dropzone.
- Server: Express + TypeScript, Prisma + PostgreSQL, zod, argon2, JWT access/refresh tokens in httpOnly cookies, helmet/cors/rate-limit/hpp, compression, pino, node-cron, nodemailer, multer (Cloudinary or local), exceljs, pdfkit, swagger-ui-express with zod-to-openapi.
- Layered server architecture: routes → controllers → services → Prisma. Every response has the shape `{ success, data, message, meta: { page, limit, total } }`.

## Users

A role-based Employee Attendance & Leave Management system with four roles:

- **EMPLOYEE**: checks in and out (often from a phone), applies for leave, views their own attendance, leave and balances.
- **MANAGER**: everything an employee can do, plus approving or rejecting team leave and regularization requests, and viewing team attendance.
- **HR / ADMIN**: manage employees, departments, designations, shifts, leave types, holidays and policies; approve new accounts; view all reports. A seeded SUPER ADMIN is the first user.

The real audience is a **reviewer** (recruiter, interviewer, hiring engineer) judging the author's skill. Each role should be served as if this were a real product. Roles carry equal weight.

## Product Purpose

A portfolio project. It demonstrates a production-quality, full-stack attendance and leave system with real auth, RBAC, server-side business rules and end-to-end workflows behind a UI that holds up as a real SaaS product.

## Positioning

Not commercial, so there is no market claim. What sets it apart from typical portfolio CRUD apps: the business rules are real and enforced on the server. Examples: server-side timestamps, late and early detection against shift and grace period, a nightly absence job, leave day counts that exclude weekends and holidays, multi-level approvals that deduct balances only on final approval, and audited regularization.

## Operating Context

- Locale: Bangladesh. The office timezone defaults to Asia/Dhaka and is configurable. All times are stored in UTC.
- Holidays include Bangladeshi public holidays plus company holidays. Leave types follow Labour Act conventions (casual, sick, annual, unpaid, maternity/paternity).
- Check-in has to be easy on a phone. Admin, reporting and approval work is mostly done on desktop.
- Reviewers usually explore through the seeded accounts, one per role.

## Capabilities and Constraints

Covered in full by the build spec: auth (register → PENDING → approval, invites, email verification, password reset, refresh-token rotation), attendance with shifts, leave with balances and approvals, holidays, regularization, late policy, notifications (in-app and email), audit log, role dashboards, and reports with Excel/PDF export.

Status colors are fixed by the brief: green present, amber late, red absent, blue leave, purple holiday.

Payroll and recruitment/onboarding came up in the init interview but are not in this build spec. Whether they come later is undecided.

Undecided: product name, deploy target, email provider in production (dev uses a local or test transport), Cloudinary versus local uploads in production.

## Brand Commitments

None yet. No name, logo or voice has been set.

## Evidence on Hand

None. All data is seeded demo data for a plausible Bangladeshi organization. Never present demo data as real customers or usage.

## Product Principles

1. **The server is the source of truth.** Timestamps, status calculation, balances and permissions are decided on the server and never trusted from the client.
2. **Every role is a first-class product.** The employee, manager and HR/admin experiences each get full design attention.
3. **Real workflows, not screens.** A feature counts as done only when it works end to end (apply → approve → balance deducted → calendar updated → notification sent).
4. **Ship-quality states.** Empty, loading, error and permission-denied states get the same care as the happy path.

## Accessibility & Inclusion

Keyboard navigation, visible focus states and ARIA labels throughout (Radix primitives as the baseline). Status colors must never be the only signal, so every status also carries a label or icon.
