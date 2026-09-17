# SOW — Scrubby number inputs (replace slider rows in popovers)

Status: to implement (ng). UI densification. Replaces the label+slider+input+unit slider
rows in the control popovers with compact "scrubby" number inputs — drag-to-adjust,
type-to-set — keeping the fiddle-by-feel interaction while removing the full-width slider
tracks. Goal: minimize UI without losing adjustability.

## Motivation

Current popovers use one slider per value (e.g. size, line, letter, word, shadow, fade in
the font "more knobs" panel; round/fade/width/glow/opacity/etc. in the edge panel). Each
slider is a full-width row (label + track + number field + unit), so a handful of sliders
dominate the popover's height and width. A slider's real value is "drag to feel the value"
+ "sense of range" — but for many of these controls the useful range is tiny (e.g.
letter-spacing -0.05 to 0.1em) where a slider is imprecise and near-useless, and the track
just costs space. A scrubby number keeps the drag-to-fiddle and drops the track.

## What a scrubby number input is

A compact numeric field that supports THREE ways to set a value, in one element, with no
separate slider track:
1. **Drag to scrub** — click-and-drag horizontally on the field (or its label) to change
   the value continuously (drag right = increase, left = decrease). This IS the
   fiddle-by-feel that the slider provided.
2. **Type to set** — click/focus and type an exact value (precision).
3. **Step** — the existing up/down arrows (▲▼) nudge by one increment (fine adjust + the
   touch-friendly fallback — see touch below).

Pattern reference: the numeric inputs in Photoshop / After Effects / Figma / Blender —
draggable-scrub number fields, the standard for dense creative-tool numeric UIs.

## Behaviour details

- **Drag direction/mapping:** horizontal drag; right = larger, left = smaller. Map drag
  distance to value change at a sensible default sensitivity per control (tune so a
  comfortable drag covers the common range without being twitchy).
- **Modifier keys for granularity (optional, nice):** hold Shift while dragging for
  coarser steps, Alt/Cmd (or similar) for finer steps. Pro-tool convention; free precision
  control. Discoverable-enough; not required for v1 but cheap.
- **Respect each control's range/step/unit:** min/max/step and unit (px, em, %) per
  control, same as the current sliders/fields enforce. The manual-type path may allow
  values beyond the drag's comfortable range (as the size field does today — don't let the
  scrub range cap what can be typed), unless a hard min/max applies.
- **Live apply:** value applies live as you scrub/type/step (same as the sliders do now) —
  the user sees the effect on the object in real time. Rely on undo for revert.
- **Cursor affordance:** on hover/drag over the scrub zone, show a horizontal-resize
  cursor (ew-resize) so the drag affordance is discoverable.
- **Read current value on open:** the field shows the object's current value when the
  popover opens (as now).

## Layout payoff (do this too)

Without slider tracks, each control is ~half the width. Reflow the popovers from
one-control-per-row to a **two-column grid** where it makes sense (e.g. line | letter,
word | shadow), roughly halving popover height as well as width. Result: a compact grid of
label + scrubby-value + unit, much denser than the stacked slider rows, while keeping full
adjustability. (Group logically — keep related pairs together; don't split a pair across
columns awkwardly.)

## Touch (required — ng supports touch)

Scrubby-drag-on-a-number is mouse-friendly but fiddly on touch (small target; drag can
conflict with scrolling the popover). So on touch:
- Make the scrub target GENEROUS — the whole label+value row is draggable, not just the
  small number (bigger hit target), OR
- Rely on the **stepper arrows (▲▼) as the primary touch adjustment** (tap to nudge) plus
  type-to-set, with scrub as a mouse enhancement.
- Ensure a scrub gesture inside the popover doesn't hijack popover/page scrolling
  (distinguish a horizontal-scrub intent from a vertical-scroll intent, or require the
  drag to start on the value/label specifically).
Net: mouse users get scrub (compact + fiddle), touch users get steppers + type, everyone
gets type-to-set. Three input paths, one compact field, no track.

## Scope

- Replace slider rows with scrubby number inputs across the popovers that currently use
  sliders (font "more knobs": size, line, letter, word, shadow, fade; edge/border panel:
  round, fade, width, glow, opacity, distance, angle, blur, spread; and any others using
  the slider pattern). Apply consistently so all numeric controls behave identically.
- Color pickers, dropdowns, toggles, and text/URL inputs are UNCHANGED — this is only
  about the numeric slider rows.

## Optional per-control refinement (consider, not required)

For values that are "set once, rarely iterated" rather than "fiddled by feel" (e.g. maybe
word spacing), a plain number field (type + step, no scrub) may suffice — but defaulting
ALL numerics to scrubby is simpler and consistent, so only drop scrub for a control if
there's a clear reason. Keep behaviour consistent unless a specific control argues
otherwise.

## Constraints

- Vanilla JS + Alpine, consistent with ng. No jQuery. No slider/scrubber library unless
  trivially small and justified — a scrubby input is a small amount of vanilla
  pointer-event code (pointerdown/move/up, accumulate delta -> value).
- Use Pointer Events (not mouse-only) so mouse, touch, and pen are handled uniformly, with
  the touch caveats above.
- Live apply + read-current-on-open, matching existing popover behaviour.
- Build minified assets via the project's terser build.

## Definition of done

- The slider rows in the control popovers are replaced by scrubby number inputs: horizontal
  drag-to-adjust, type-to-set, and stepper nudge — in one compact field, no slider track.
- Each control keeps its range/step/unit and live-apply behaviour; the field reads the
  current value on open; a resize cursor signals the drag affordance.
- Popovers are reflowed denser (two-column grid where sensible), reducing their footprint
  while keeping full adjustability.
- Touch works: generous scrub target and/or steppers as the touch adjustment, type-to-set
  always available, and scrubbing doesn't hijack scrolling.
- Non-numeric controls (color, dropdown, toggle, text/URL) are unchanged; behaviour is
  consistent across all numeric controls; no jQuery.
