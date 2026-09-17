# SOW — Scrubby number input component (with ↔ affordance)

Status: to implement (ng). Defines the reusable scrubby-number-input component that
replaces standard number inputs / slider rows across the control popovers. Matches the
attached design: a number field with a `↔` (double-headed horizontal arrow) affordance to
its right and the unit label after it (e.g. `[ 0    ↔ ] px`). Supersedes/implements the
input described in SOW-scrubby-numbers.md — this is the concrete component spec.

## Visual (matches attached image)

A single row per value:
`label` ... `[ value-field   ↔ ]` `unit`
- **label** (e.g. "round", "width") — left.
- **value field** — the number, editable; the `↔` glyph sits at the right end of the field
  (inside or immediately adjacent), as in the image.
- **unit** (e.g. "px", "em", "%") — after the field, static.
- The `↔` is the scrub affordance — a double-headed horizontal arrow signalling
  "drag horizontally to change". Keep it visually light (it's a hint, not a button), but
  as-shown it's clearly visible (per the attached design).

No slider track. This replaces both old sliders and plain number inputs with one
consistent component.


### Field width
- Size the number field to fit its digits in a fixed, compact width using `ch` units
  (`ch` = width of the "0" glyph), so all instances align into a tidy grid.
- Target ~4 characters — BUT pick the width to fit the WIDEST REAL value each control
  emits, so nothing clips:
  - integer-px controls (round, width, blur, spread, glow, distance, angle, etc.) fit
    easily in 4ch (e.g. `9999`).
  - signed-decimal `em` controls (letter, word spacing) produce values like `-0.05`,
    which is 5 characters — 4ch would CLIP them.
- Therefore: use ONE uniform field width sized to the widest real case (≈ 5ch of digit
  space) for grid consistency and no clipping — OR, if preferred, 4ch for integer controls
  and a slightly wider field only for the signed-decimal ones. Uniform is simpler and keeps
  the grid aligned; don't clip real values either way.
- The `ch`-based width is for the DIGITS only; the `↔` affordance and the stepper arrows
  (▲▼) are ADDITIONAL width, not eating into the digit space.
- On typed input longer than the field, the value scrolls horizontally within the field
  (standard input behaviour) rather than overflowing/breaking layout.

## Interactions — three ways to set the value

1. **Scrub (drag horizontally):** press on the field / the `↔` and drag horizontally —
   right increases, left decreases — value updates live as you drag. This is the primary
   fiddle-by-feel interaction.
2. **Type:** click/tap into the field and type an exact value (precision). Enter / blur
   commits; Escape cancels back to the pre-edit value.
3. **(Optional) keyboard nudge when focused:** Up/Down arrow keys step the value by one
   increment (cheap, accessible, keep if easy).

### Cursor / affordance
- On hover over the scrub zone, the cursor changes to a **grabbing hand** (`grab`, and
  `grabbing` while actively dragging). (Per request — note: `ew-resize` `↔` is the more
  conventional scrub cursor, but the grabbing hand is fine and arguably friendlier; use
  the grab/grabbing pair as specified.)
- The `↔` glyph is the persistent visible affordance (works where no cursor exists, i.e.
  touch).

### Behaviour details
- **Live apply** while scrubbing/typing — the object updates in real time; rely on undo
  for revert.
- **Read current value on open** — the field shows the object's current value when the
  popover opens.
- **Range / step / unit per control** — honor each control's min/max/step and unit, same
  as the fields do now. The type path may allow values beyond the comfortable scrub range
  (don't let scrub sensitivity cap what can be typed) unless a hard min/max applies.
- **Scrub sensitivity** — map drag distance to value change sensibly per control (tune so
  a comfortable drag covers the common range without being twitchy). Optional modifier
  keys (Shift = coarser, Alt/Cmd = finer) if cheap; not required.
- **Clamping / validation** — invalid typed input (non-numeric, out of hard range) is
  rejected/clamped gracefully, not stored broken.

## Touch-friendly (required — ng supports touch)

- Use **Pointer Events** (pointerdown/move/up) so mouse, touch, and pen share one code
  path.
- **Generous touch target** — the scrub zone (field + `↔`) must be large enough to grab on
  a small screen; consider making the whole field+arrow area the drag target, not just the
  tiny glyph.
- **Don't hijack scrolling** — a horizontal scrub inside the popover must not fight
  vertical scroll of the popover/page. Distinguish horizontal-drag intent from
  vertical-scroll (e.g. only start scrubbing once horizontal movement exceeds a small
  threshold, and/or require the drag to begin on the field/arrow), and use
  `touch-action: none` on the scrub element only (not the whole popover) so the browser
  doesn't steal the gesture.
- **Type on touch** — tapping the field opens the numeric keyboard for direct entry
  (`inputmode="decimal"` so touch keyboards show numbers).
- Net: touch users can drag (generous target) OR tap-to-type; mouse users drag or type;
  the `↔` visibly hints the drag on both.

## Reusable component

- Build it ONCE as a reusable component (vanilla JS + Alpine, consistent with ng) and use
  it everywhere numeric values are set (font "more knobs": size, line, letter, word,
  shadow, fade; edge/border: round, width, glow, opacity, distance, angle, blur, spread;
  etc.). Consistent look and behaviour across all of them.
- Props/config per instance: label, unit, min, max, step, scrub sensitivity, current
  value, and an on-change callback (live apply).

## Scope

- Replaces standard number inputs AND old slider rows in the control popovers with this
  component.
- Color pickers, dropdowns, toggles, and text/URL inputs are unchanged.
- The unit label and `↔` layout should match the attached design consistently across all
  instances.

## Constraints

- Vanilla JS + Alpine; Pointer Events; no jQuery; no heavy slider/scrubber library (a
  scrubby input is a small amount of pointer-event code).
- `touch-action: none` scoped to the scrub element only, so scrolling elsewhere is
  unaffected.
- `inputmode="decimal"` on the field for touch numeric entry.
- Live apply + read-current-on-open, matching existing popover behaviour.
- Build minified assets via the project's terser build.

## Definition of done

- A single reusable scrubby-number component renders as `label [ value ↔ ] unit` per the
  attached design, used across all numeric controls in the popovers.
- Value can be set three ways: horizontal drag-scrub (live), typing (Enter/blur commit,
  Escape cancel), and keyboard nudge when focused.
- Hover shows a grabbing-hand cursor (`grab` / `grabbing`); the `↔` glyph is the persistent
  visible affordance for touch.
- Touch works: generous drag target, tap-to-type with numeric keyboard, and scrubbing does
  not hijack popover/page scrolling (Pointer Events + scoped `touch-action: none` +
  horizontal-intent threshold).
- Each instance honors its range/step/unit; typed values may exceed scrub range within hard
  limits; invalid input is clamped/rejected gracefully; live apply; reads current value on
  open.
- The number field has a fixed compact width (ch-based, sized to the widest real value so
  no value clips; ↔ and steppers are additional width; typed overflow scrolls within the
  field), consistent across all instances for grid alignment.
- Non-numeric controls unchanged; consistent look/behaviour across all instances; no jQuery.
