---
version: 1
slug: "client-src-app"
primary_target: "client/src/app"
related_targets: []
---

# Surface brief: Hajira web app (client/src/app)

Scope: the whole authenticated app shell plus auth pages. Visitor mode: **Operate** (employees check in and apply for leave; managers approve; HR administers). Audience, roles and rules live in PRODUCT.md.

## Direction contract

THESIS: Every working day is a stitch. Attendance, shifts and leave quotas are drawn as running stitches (solid = final, dashed = pending, struck = cancelled), so a month reads at a glance like a kantha row. Refuses the category default: a slate shadcn dashboard of identical KPI cards with one blue accent.

OWN-WORLD: Deep indigo shell (rail #1E2756) on cool cotton ground (#F6F7FB, never cream); white work surfaces with hairline rules; status colours as thread (present green #2F8F5B, late amber #D9971C, absent madder #C8372D, leave blue #2F6FD6, holiday purple #7A4CC2, half-day teal #0E8A8A); one marigold (#F2B33D) for the active-nav mark and focus moments. Anek Latin, one workhorse family, tabular figures for all times. Dark mode: indigo-black cloth (#0E1124), threads brightened.

STORY: An employee opens the app at the office gate, sees the clock, their shift seam and one action, and checks in. Later they read their month as a stitched row, apply for leave with the day count shown before submitting, and watch it move through the approvers. Managers clear a queue; HR reads the company in stitch-coloured trends and exports.

FIRST VIEWPORT: Indigo left rail (logo, grouped nav, user at the foot); top bar with search, notification bell with count, theme toggle and user menu. Main: greeting and date line; the Today card on the left (live server-synced clock at display size, shift line, the primary Check in/Check out button, and the shift seam below: the day 06:00–21:00 as a dashed track with the shift window stitched in, grace marked, a "now" needle and the actual in/out stitches); the month card on the right (31 day-stitches with dates, today dashed, counts with thread swatches beneath). Second row: leave quotas as stitched rows (one stitch per day, used versus available) and recent activity. On a phone, the Today card owns the whole first screen.

FORM: Running Stitch (nakshi kantha), candidate 5 of 7 on the ordered list; seed key 9f0dc48b. Raises: stitch form carries state alongside hue (from Emission-Line Rail); phone check-in owns the first screen (Vertical Feed); figures on a fixed size ramp (Star Atlas); 4px stitch module, grids reflow by whole cells (Grid Specimen); one-device-pixel rules, few ink values (Centre-Rail Setting). Signature interaction: on check-in, today's stitch is pulled through: the dashed stitch tightens to solid along the seam and the month row (one orchestrated motion, ~600ms, exponential ease-out; reduced-motion users get an instant state change).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
