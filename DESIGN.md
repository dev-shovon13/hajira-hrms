---
name: Hajira
description: Attendance and leave, drawn as running stitches on an indigo-dyed shell over cool cotton.
colors:
  indigo-rail: "#1e2756"
  indigo-raised: "#2a3570"
  indigo-rail-border: "#343f7c"
  rail-thread: "#dce0f5"
  rail-muted: "#a1a9d4"
  marigold: "#f2b33d"
  cotton-ground: "#f6f7fb"
  card-white: "#ffffff"
  indigo-ink: "#141a33"
  slate-ink: "#545b78"
  cotton-wash: "#eef0f7"
  accent-wash: "#e9ecf7"
  hairline: "#e3e6f0"
  input-stroke: "#d3d7e5"
  focus-indigo: "#4a57a8"
  off-thread: "#c9cddb"
  present-thread: "#2f8f5b"
  late-thread: "#d9971c"
  absent-thread: "#c8372d"
  leave-thread: "#2f6fd6"
  holiday-thread: "#7a4cc2"
  halfday-thread: "#0e8a8a"
  present-ink: "#22704a"
  late-ink: "#8f5d07"
  absent-ink: "#a42a21"
  leave-ink: "#2257ad"
  holiday-ink: "#6240a1"
  halfday-ink: "#0a6a6a"
  present-wash: "#e7f4ec"
  late-wash: "#fbf1dd"
  absent-wash: "#faeae8"
  leave-wash: "#e8f0fc"
  holiday-wash: "#f1ebfa"
  halfday-wash: "#e2f3f3"
  chart-present: "#2f8f5b"
  chart-late: "#d9971c"
  chart-absent: "#c8372d"
  chart-leave: "#2f6fd6"
  leave-annual: "#4457c9"
  leave-casual: "#d55181"
  leave-sick: "#1f9fd0"
  leave-other: "#7c829c"
  dark-cloth: "#0e1124"
  dark-card: "#151935"
  dark-popover: "#181c3c"
  dark-rail: "#0a0d1e"
  dark-ink: "#e7e9f5"
  dark-slate-ink: "#a6acce"
  dark-hairline: "#262c55"
  dark-focus: "#8f9bff"
  dark-off-thread: "#3a4070"
  dark-present-thread: "#4fbf85"
  dark-late-thread: "#f0b44a"
  dark-absent-thread: "#ef6a5e"
  dark-leave-thread: "#6fa0ff"
  dark-holiday-thread: "#a988f0"
  dark-halfday-thread: "#3cc2c2"
  dark-chart-present: "#33a06a"
  dark-chart-late: "#c0880e"
  dark-chart-absent: "#e2546e"
  dark-chart-leave: "#4f82ec"
  dark-leave-annual: "#5866d6"
  dark-leave-casual: "#d55181"
  dark-leave-sick: "#1aa3c9"
  dark-leave-other: "#8a90b0"
typography:
  figure-xl:
    fontFamily: "Anek Latin, ui-sans-serif, system-ui, sans-serif"
    fontSize: "4.5rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.03em"
    fontFeature: "tnum"
  figure-lg:
    fontFamily: "Anek Latin, ui-sans-serif, system-ui, sans-serif"
    fontSize: "3rem"
    fontWeight: 600
    lineHeight: 1
    fontFeature: "tnum"
  figure:
    fontFamily: "Anek Latin, ui-sans-serif, system-ui, sans-serif"
    fontSize: "2rem"
    fontWeight: 600
    lineHeight: 1.05
    fontFeature: "tnum"
  figure-sm:
    fontFamily: "Anek Latin, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.1
    fontFeature: "tnum"
  headline:
    fontFamily: "Anek Latin, ui-sans-serif, system-ui, sans-serif"
    fontSize: "2rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Anek Latin, ui-sans-serif, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 600
    lineHeight: 1.375
  body:
    fontFamily: "Anek Latin, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
  body-sm:
    fontFamily: "Anek Latin, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.43
  label:
    fontFamily: "Anek Latin, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.4
  caption:
    fontFamily: "Anek Latin, ui-sans-serif, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1
    fontFeature: "tnum"
rounded:
  sm: "8px"
  md: "10px"
  lg: "12px"
  xl: "16px"
  full: "9999px"
spacing:
  stitch: "4px"
  xs: "8px"
  sm: "12px"
  md: "16px"
  card: "20px"
  card-wide: "24px"
  section: "32px"
components:
  button-primary:
    backgroundColor: "{colors.indigo-rail}"
    textColor: "{colors.card-white}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "40px"
    typography: "{typography.body-sm}"
  button-primary-hover:
    backgroundColor: "{colors.indigo-raised}"
  button-outline:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.indigo-ink}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "40px"
  button-outline-hover:
    backgroundColor: "{colors.accent-wash}"
  button-success:
    backgroundColor: "{colors.present-ink}"
    textColor: "{colors.card-white}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "40px"
  button-check-in:
    backgroundColor: "{colors.indigo-rail}"
    textColor: "{colors.card-white}"
    rounded: "{rounded.xl}"
    padding: "0 28px"
    height: "56px"
  input:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.indigo-ink}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
    height: "40px"
  card:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.indigo-ink}"
    rounded: "{rounded.xl}"
    padding: "{spacing.card}"
  badge-present:
    backgroundColor: "{colors.present-wash}"
    textColor: "{colors.present-ink}"
    rounded: "{rounded.full}"
    padding: "0 10px"
    height: "24px"
  badge-pending:
    backgroundColor: "{colors.leave-wash}"
    textColor: "{colors.leave-ink}"
    rounded: "{rounded.full}"
    padding: "0 10px"
    height: "24px"
  nav-item:
    backgroundColor: "{colors.indigo-rail}"
    textColor: "{colors.rail-thread}"
    rounded: "{rounded.lg}"
    padding: "0 12px"
    height: "40px"
  nav-item-active:
    backgroundColor: "{colors.indigo-raised}"
    textColor: "{colors.card-white}"
  nav-count:
    backgroundColor: "{colors.marigold}"
    textColor: "{colors.indigo-rail}"
    rounded: "{rounded.full}"
    padding: "0 6px"
    typography: "{typography.caption}"
---

# Design System: Hajira

## Overview

**Creative North Star: "The Running Stitch"**

Every working day is a stitch. Attendance, shift windows and leave quotas are drawn as rows of short rounded threads, the way a nakshi kantha is sewn: a month reads at a glance as one stitched row, a shift as a seam pulled through the day, a quota as stitches still to be used. The stitch carries state through its form as well as its hue: a solid stitch is final, a dashed stitch is pending, a hairline is a day off or a day already spent. Colour is never the only carrier.

The world is an indigo-dyed shell on cool cotton. A deep indigo rail holds navigation; the working ground is a cool, faintly blue off-white (never cream); work happens on white cards with hairline rules and a barely-there lift. Status colours behave as thread, not as fills: they appear as thin marks, as accessible ink on a pale wash, and as chart series, each in its own validated step. One marigold is the needle: the active-nav stitch, today's dot, the head of the "now" needle, waiting counts. Dark mode re-dyes the same cloth indigo-black, brightens the threads, and lets marigold take over as the primary action colour.

Density is that of a working tool: one workhorse family (Anek Latin), compact 13 to 17px text, and a fixed figure ramp so that the one number that matters on a card (the clock, a count, a day total) clearly outranks everything near it. The category default this world refuses is the slate dashboard of identical KPI cards with a single blue accent.

**Key Characteristics:**
- Indigo rail and indigo primary on a cool cotton ground; white cards with hairline borders.
- Status as thread: mark, ink and wash per status, never a raw hex in a component.
- Solid = final, dashed = pending, hairline = off or used; state lives in the stitch's form.
- One marigold needle, used sparingly for "you are here" and "waiting" moments.
- Anek Latin throughout; tabular figures for every time, date number and count.
- A 4px stitch module; month grids reflow by whole cells.

## Colors

A cool indigo-and-cotton cloth with six status threads, one marigold needle, and separately validated steps for charts and leave types.

### Primary
- **Indigo Rail** (indigo-rail): the navigation rail, the primary button, checked checkboxes and switches, and the active FullCalendar button. It is the dye of the whole shell. In dark mode the primary action becomes Marigold and the rail darkens to Dark Rail.
- **Indigo Raised** (indigo-raised): primary-button hover and the active nav item's raised plate on the rail.
- **Rail Thread / Rail Muted** (rail-thread, rail-muted): nav labels and group headings on the rail; Indigo Rail Border draws the rail's internal rules.

### Secondary
- **Marigold** (marigold): the needle. The 3px active-nav stitch at the rail edge, the dot under today's day-stitch, the head of the shift seam's "now" needle, nav count pills (with Indigo Rail text), text selection (45% mix), the top loading bar, and today's underline in the calendar. In dark mode it is also the primary button fill.

### Tertiary: the status threads
Each status has three roles: a **thread** for marks (stitches, legend swatches, badge swatches), an **ink** for text that meets AA on light surfaces, and a **wash** for badge backgrounds.
- **Present** (present-thread / present-ink / present-wash): worked days, approved requests, the success action.
- **Late** (late-thread / late-ink / late-wash): late arrival and the grace bracket on the shift seam. Never pending.
- **Absent** (absent-thread / absent-ink / absent-wash): absence, rejection, destructive actions, error-state illustrations.
- **Leave** (leave-thread / leave-ink / leave-wash): days on leave and every pending request. Leave Ink is also the link colour.
- **Holiday** (holiday-thread) and **Half-day** (halfday-thread): public or company holidays and half days, with matching ink and wash.
- **Off Thread** (off-thread): weekly offs, blank days, used quota, the day track of the shift seam.

### Chart and leave-type steps
- **Chart series** (chart-present, chart-late, chart-absent, chart-leave; dark-chart-*): the four status series in fixed order Present, Late, Absent, On leave. Validated with the dataviz palette validator against #ffffff in light and #151935 in dark; the dark steps were chosen separately (lightness 0.48 to 0.67) rather than reusing the brightened dark threads.
- **Leave-type identity** (leave-annual, leave-casual, leave-sick; dark-leave-*): one hue per everyday leave type, everywhere it appears (quota stitches, the HR donut, the team calendar, admin swatches). Validated together for colour-blind separation and kept clear of every status thread. Rarer types (maternity, paternity, unpaid) share **Leave Slate** (leave-other), and the donut groups them as "Other" in the same slate.

### Neutral
- **Cotton Ground** (cotton-ground): the page background. Cool, never cream.
- **Card White** (card-white): cards, inputs, popovers, outline buttons.
- **Indigo Ink** (indigo-ink): body and heading text.
- **Slate Ink** (slate-ink): secondary text, labels, axis ticks, placeholders.
- **Cotton Wash / Accent Wash** (cotton-wash, accent-wash): secondary buttons, skeletons, avatar fallbacks, hover and selected rows, today's calendar cell.
- **Hairline / Input Stroke** (hairline, input-stroke): one-pixel card and table rules, chart grid; input and outline-button strokes.
- **Focus Indigo** (focus-indigo): the focus ring, caret, and the scheduled-shift thread on the seam.
- **Dark cloth** (dark-cloth, dark-card, dark-popover, dark-rail, dark-ink, dark-slate-ink, dark-hairline, dark-focus, dark-off-thread): the indigo-black dark theme.

### Named Rules
**The Thread Rule.** Status colour is drawn as thread: marks use the thread token, text uses the ink token on its wash. Components reference roles (CSS variables), never raw hex.

**The Dashed-Is-Pending Rule.** Pending is always a dashed thread in its own hue; a pending leave request is drawn dashed in the leave hue, never amber. Amber means late, and only late.

**The One Needle Rule.** Marigold marks "you are here" and "waiting": the active nav stitch, today, the now-needle, counts, selection. It is never a fill for cards, charts or status.

**The Separate Steps Rule.** Charts use the validated chart steps and leave types use their identity hues; neither borrows the thread tokens directly, and a new series or leave type must be re-validated in both themes before it ships.

## Typography

**Display Font:** Anek Latin (with ui-sans-serif, system-ui, sans-serif), loaded through next/font
**Body Font:** Anek Latin
**Label/Mono Font:** Anek Latin; no mono face (keyboard hints use the sans)

**Character:** One workhorse family, slightly condensed and warm, carrying everything from the 72px clock to 11px day numbers. Hierarchy comes from the fixed figure ramp and weight, not from a second face.

### Hierarchy
- **Figure XL** (600, 4.5rem, line-height 1, -0.03em, tabular): the live clock on the Today card. One per screen.
- **Figure LG / Figure** (600, 3rem / 2rem): reserved steps of the fixed ramp for a card's single dominant number.
- **Figure SM** (600, 1.5rem, line-height 1.1, tabular): counts under the month row, legend values, donut totals, leave day counts, shift times.
- **Headline** (600, 1.75rem on phones, 2rem from sm, leading tight, -0.015em): the page header greeting or title, balanced wrap.
- **Title** (600, 17px, leading snug): card titles.
- **Body** (400, 15px): detail values, page descriptions (max 65ch), nav labels.
- **Body SM** (400 or 500, 14px): table cells, inputs, buttons, secondary card text.
- **Label** (400 to 500, 13px, Slate Ink): field labels, legend labels, nav group headings, small buttons. Sentence case, no tracking.
- **Caption** (11px, tabular): day numbers under stitches, nav count pills.

### Named Rules
**The Tabular Figures Rule.** Every time, date number, count and day total is set with tabular figures, so columns of numbers and a ticking clock never jitter.

**The Fixed Figure Ramp Rule.** Figures take a step from the fixed ramp (1.5, 2, 3, 4.5rem), never a fluid clamp; the one number that matters on a card outranks everything near it.

## Layout

The app is a rail-and-canvas shell. On large screens a sticky indigo rail (252px, collapsing to 76px icon-only with tooltips) runs the full page height; the canvas has a sticky 64px top bar (search with Ctrl K hint, notifications with count, theme toggle, user menu) over a translucent, blurred Cotton Ground. Main content is centred to a 1400px maximum with 16 / 24 / 32px side padding (phone / sm / lg) and a 24 to 32px top gutter. Below lg the rail becomes a left sheet opened from the top bar.

Dashboards are two-column card grids on desktop that stack on phones. On phones the Today card (clock, shift line, the check-in action and the shift seam) owns the whole first screen; everything else follows below it.

Spacing runs on a 4px stitch module: stitch gaps of 3 to 6px, 8 / 12 / 16px inside components, 20px card padding on phones and 24px from sm, 24px between nav groups and between cards. Grids of days reflow by whole cells: the month row is 16 cells per line on phones and the full 31 on wider screens (the large variant stacks as two seams).

### Named Rules
**The Today-First Rule.** On a phone, the first screen belongs to today: the clock, the shift, and the one check-in or check-out action.

**The Whole-Cell Rule.** Day grids reflow by whole stitches, never by squeezing or truncating a day.

## Elevation & Depth

Nearly flat. Depth comes from tone first (indigo rail against cotton ground, white cards on cotton) and from one-pixel hairlines, with two soft, indigo-tinted shadows. Shadows are tinted by a theme-level shadow colour (indigo in light, near-black in dark), never neutral grey.

### Shadow Vocabulary
- **Raised** (`box-shadow: 0 1px 2px hsl(228 40% 20% / 0.06), 0 2px 6px -2px hsl(228 40% 20% / 0.08)`): resting cards, primary, destructive and success buttons, switch thumbs.
- **Float** (`box-shadow: 0 4px 10px -2px hsl(228 40% 20% / 0.1), 0 16px 32px -8px hsl(228 40% 20% / 0.18)`): popovers, tooltips, chart tooltips, menus and dialogs.

### Named Rules
**The Hairline-and-Lift Rule.** A card is a hairline plus Raised, nothing heavier. Float is only for things that sit above the page.

## Shapes

Gently rounded throughout from a 12px base: 8px for small controls, 10px for buttons and inputs, 12px for nav items and popovers, 16px for cards and the large check-in button. Pills (fully rounded) are for badges, nav counts, avatars and every stitch: threads have round caps, at 3px for standard stitches, 6px for the large month row, 1 to 2px for hairline offs. Rules are one device pixel. The stitch-line utility draws a running stitch as a repeating dash (default 8px thread, 6px gap) whose colour comes from a `--thread` variable.

## Components

### Buttons
Quiet and solid; the action is the only filled thing on most cards.
- **Shape:** gently rounded (10px), 40px tall, 16px side padding, 14px medium text, 8px icon gap; sizes from 32px (sm) to 56px (xl, 16px radius, 18px text) for check-in.
- **Primary:** Indigo Rail fill, white text, Raised shadow; Marigold fill with indigo text in dark mode.
- **Hover / Focus / Active:** fill shifts to the hover step over 150ms ease-out; focus is a 2px Focus Indigo ring offset 2px; pressed nudges down 1px. Loading shows a spinner and disables.
- **Outline / Secondary / Ghost:** Input Stroke on Card White; Cotton Wash fill; transparent. All hover to Accent Wash.
- **Success:** Present Ink fill with white text (bright Present thread with dark ink in dark mode) for approve actions.
- **Link:** Leave Ink, underline on hover, 3 to 4px underline offset.

### Badges
- **Style:** 24px pill, 12px semibold text in the status ink on its wash, led by a 10 by 3px thread swatch. A badge is a word plus a stitch, never colour alone.
- **State:** pending requests carry a dashed swatch in the leave hue; approved present, rejected absent, cancelled neutral.

### Cards / Containers
- **Corner Style:** 16px.
- **Background:** Card White (Dark Card in dark).
- **Shadow Strategy:** Raised at rest (see Elevation & Depth).
- **Border:** one-pixel Hairline.
- **Internal Padding:** 20px on phones, 24px from sm; header and content share the inset. Rows inside cards are divided by hairlines.

### Inputs / Fields
- **Style:** 40px tall, Input Stroke border, Card White fill, 10px radius, 12px side padding, 14px text, Slate Ink placeholder.
- **Focus:** border shifts to Focus Indigo with a 3px ring at 20% Focus Indigo.
- **Error / Disabled:** invalid fields take an Absent border and ring; disabled fields fade to 60% with a not-allowed cursor. Field labels are 14px medium; detail labels are 13px Slate Ink over 15px values.

### Navigation
- **Rail:** grouped links (13px Rail Muted group labels in sentence case), 40px items with an 18px line icon and 15px label in Rail Thread at 85%. Hover raises the plate; the active item sits on Indigo Raised in white with a 3 by 20px marigold stitch at the rail's left edge. Waiting counts are marigold pills. Focus rings on the rail are marigold. The user sits at the rail's foot above the collapse control.
- **Mobile:** the same rail inside a left sheet; the top bar shows a menu button and the logo.

### Stitch Row (signature)
The month as one stitch per day in its status thread, with the day number below in tabular caption text. Solid for settled days, dashed (4px thread, 3px gap) for pending, a dotted hairline for blank days, a solid hairline for weekly offs. Today is bold with a marigold dot beneath. Each day carries a full spoken description and a tooltip. A legend of counts (Figure SM) with thread swatches sits below.

### Shift Seam (signature)
The day (shift start minus three hours to end plus three hours) as a dashed hairline track. The scheduled shift is stitched in dashed Focus Indigo, the grace period is bracketed in late amber at 15% fill, the worked thread is drawn solid in the day's status colour, and a foreground needle with a marigold head marks now. Time ticks are 12px tabular Slate Ink.

### Quota Stitch (signature)
A leave quota as one 3px stitch per day in the leave type's identity hue: available days solid, pending days dashed, used days a 1px Off Thread hairline. Quotas larger than 30 days group several days per stitch and say so ("Each stitch is 4 days"). Unpaid or zero quotas are stated in words instead.

### Empty and Error States
A needle-and-thread line illustration (dashed thread in the context's hue, Off Thread running stitches) above a semibold title and a short Slate Ink description, centred, with an optional action. Errors use the absent thread and a "Try again" link.

### Motion
The pull-through: when today's stitch is settled, it draws in left to right with a clip reveal over 600ms on cubic-bezier(0.16, 1, 0.3, 1); the worked thread on the shift seam scales out from the check-in point on the same curve. Reduced-motion users get the end state instantly.

## Do's and Don'ts

### Do:
- **Do** express status through a stitch's form as well as its hue: solid for final, dashed for pending, hairline for off or used.
- **Do** draw every pending request as a dashed thread in the leave hue.
- **Do** pair every colour mark with a word: badges, legends and chart tooltips always carry a label.
- **Do** use tabular figures for every time, date number and count, and take figure sizes from the fixed ramp.
- **Do** keep cards to a one-pixel hairline plus the Raised shadow on Card White over Cotton Ground.
- **Do** use the validated chart steps for status series and the leave-type identity hues for leave types, and re-validate before adding a series.
- **Do** give the phone's first screen to the Today card.

### Don't:
- **Don't** colour pending amber; amber is lateness only.
- **Don't** use raw hex in components; reference the role variables so both themes follow.
- **Don't** spread marigold beyond the needle moments (active nav, today, now, counts, selection), except as the dark-mode primary.
- **Don't** warm the ground toward cream; the cotton is cool.
- **Don't** add a second type family or a fluid clamp for figures.
- **Don't** build screens from rows of identical KPI cards with one blue accent.
- **Don't** reuse the bright dark-mode threads as chart series; the dark chart steps were chosen separately.
