# SOW — Font picker as a "roller" / drum selector

Status: BUILT (2026-09-21). This file records what was built — the design below is the brief as
written; what shipped follows it with the deviations listed under "As built".

## As built (2026-09-21)

- The face wheel (`.glue-font-face-list`) is a 60px window — two rows and two peeks —
  ALWAYS present in the panel, in-flow in the face row (the button that once opened it is
  gone, danja's call, 2026-09-21). No centre band, no scrollbar, no preview sample, and
  no edge fade (2026-09-22, danja's call) — the rows simply clip at the window.
- The interactions, danja's calls the same day: **the drag is the way around the drum**
  (pointer events move the scrollTop; the release snaps to the nearest row; touch-action
  none so a finger owns the gesture), **the click is the pick** — nothing applies without
  one, and the wheel follows the applied row into the centre — and **hovering hands the
  wheel the keyboard**: while the pointer is over it, ArrowUp/ArrowDown scroll one row at
  a time, without applying. The mouse wheel scrolls the drum at HALF pace (danja's call,
  2026-09-21), and the cursor is ns-resize - the number rows' sideways one stood up.
- A pick wraps the run's span or writes the object's style, exactly as the dropdown did —
  a click always applies, so re-picking the face a MIXED run reports clears the odd faces
  out by construction (the old `face_reel_mixed` guard died with the settle).
- Open-centered on the current face, instant (no spin); the drum follows the face when the
  target retargets. First/last rows reach the centre exactly via two spacer pads (content,
  not container padding — engine bug history). There is nothing to dismiss — the wheel is
  part of the panel, and Escape closes the panel itself.
- Deviations from the brief: make-min, not a terser build (the project has no build step);
  mouse drag has no momentum/fling; the 60px window shows two rows and two peeks rather
  than three full rows — the peeks are what the brief asked for, and since 2026-09-22 they
  simply clip at the window's edges, no fade.
  Tests: the wheel tests in `tests/e2e/text-font-popover.spec.js` and the run-target tests
  in `tests/e2e/text-formatting.spec.js`.

---

## Concept

Think iOS time-picker drum / slot-machine reel:
- A fixed-height viewport showing ~3 rows: **previous font (top, partially visible /
  dimmed), selected font (center, full/emphasized), next font (bottom, partially visible /
  dimmed)**.
- The CENTER row is the current selection. Scrolling moves the list through the window;
  whatever lands in the center becomes selected.
- The partial visibility of the top/bottom neighbors is the affordance — it signals "there
  are more items; scroll to reach them."

## Visual / layout

- Narrow, short viewport (roughly 3 rows tall — center + a peek of one above and one
  below). Keep it compact so it never needs to cover the styled object.
- **Center slot** is visually distinguished as the selection: full opacity, slightly
  larger or bolder, and/or a subtle highlight band across the center row (as in the
  reference image — the middle item has a highlight). The center highlight is the "this is
  selected" cue.
- **Top and bottom rows** are partially visible and/or dimmed (fading toward the edges) —
  the classic drum look — reinforcing that they're the neighbors you can scroll to. A soft
  fade/gradient mask at top and bottom edges sells the "rolling drum" feel (optional but
  nice).
- Each row renders the font name IN ITS OWN typeface (as the current list does), so the
  user sees each font's look. (A fixed sample word like "Hamburg" may accompany the name
  per the separate preview decision — follow whatever the list currently shows.)
- The scroll affordance from the reference (an up/down arrows glyph at the right) can
  remain as an extra hint that it scrolls vertically.

## Interaction

Selection = whatever font is in the CENTER slot. The user moves the list so their desired
font is centered. Support BOTH input methods:

1. **Scroll action** — mouse wheel / trackpad scroll over the picker scrolls the list
   up/down through the window (one notch per item, or smooth with snap — see snapping).
2. **Drag** — press and drag the list up or down (pointer/touch), the list follows the
   drag, and on release it settles with an item centered (see snapping). This is the
   touch-primary method and the "grab the drum and spin it" feel.

### Snapping (important for the roller feel)
- The list SNAPS so an item is always cleanly centered — you never rest between two items.
  After a scroll notch or a drag-release, the nearest item animates to the center slot and
  becomes selected.
- A drag with velocity can "fling" (momentum) and then snap — optional nicety; at minimum,
  drag-release snaps to nearest.

### Selection commit
- The centered item IS the selected font, applied LIVE (the styled text updates as the
  centered font changes — consistent with the other live-apply controls). Rely on undo for
  revert.
- Decide (and be consistent): does selection apply continuously as items pass through
  center during a scroll, or only on settle? Recommend **apply on settle/snap** (so a fast
  scroll past 20 fonts doesn't thrash live-restyling on every passing font) — apply when
  the list comes to rest on an item.

## Touch-friendly (required — ng supports touch)

- Use Pointer Events (mouse, touch, pen one path).
- Drag-to-spin is the natural touch interaction; ensure a generous drag target (the whole
  picker viewport).
- `touch-action` set so vertical drag on the picker scrolls the DRUM, and doesn't fight
  page/popover scroll ambiguously — scope it to the picker element; the drag inside the
  picker controls the roller, not the page.
- Momentum/fling on touch feels natural if easy; snap-on-release is the requirement.

## Codex compliance (why this exists)

- The picker is COMPACT (≈3 rows), so it fits beside the toolbar WITHOUT covering the
  styled object — satisfying the "a control must not eclipse the element it was called for"
  rule that the old tall dropdown violated. Placement should still avoid the object's rect
  (collision-aware), but the small height makes that easy.

## Details / edge cases

- **Long font lists** — the roller handles any length (you scroll/spin through). Consider
  keeping a type-to-filter option if the list is very long (optional; the roller alone is
  fine for moderate lists).
- **Wrap-around vs. ends** — decide whether scrolling past the last font wraps to the first
  (endless drum) or stops at the ends (hard top/bottom). Recommend STOP at ends (clearer
  where you are in the list) unless the endless-drum feel is wanted.
- **Keyboard** — up/down arrow keys move the selection by one (accessible + precise), Enter
  confirms if there's a confirm step (there may not be — live-apply-on-settle needs no
  explicit confirm).
- **Current font on open** — when the picker opens, the currently-selected font is centered
  (not the top of the list). Scroll position initializes to center the active font.
- **Reads current state on open**, live-apply, dismiss on click-away/Escape — consistent
  with the other popover controls.

## Constraints

- Vanilla JS + Alpine, consistent with ng. No jQuery. No heavy carousel/picker library —
  a roller is a scrollable list with snap + a centered-selection readout; implementable in
  a modest amount of vanilla code (or CSS scroll-snap + a center-detection observer).
- Consider CSS scroll-snap (`scroll-snap-type: y mandatory`, snap points on items) as a
  lightweight base for the snapping, with JS to detect which item is centered and to drive
  drag; keeps it simple.
- Compact height so it never eclipses the styled object; collision-aware placement.
- Build minified assets via the project's terser build.

## Definition of done

- The font picker is a compact roller/drum: a ~3-row window with the selected font centered
  (highlighted), previous/next peeking (dimmed/faded) above and below as the scroll
  affordance.
- Scrolling (wheel) and dragging (pointer/touch) both move the list; it snaps so an item is
  always centered; the centered item is the selection, applied live on settle.
- Opens with the current font centered; reads current state; dismisses normally.
- Touch works (drag-to-spin, generous target, snap-on-release, no scroll-hijack of the
  page); keyboard up/down moves selection.
- Compact enough to not cover the styled object (codex-compliant); collision-aware
  placement; no jQuery.
