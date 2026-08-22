# SPIKE / TEST — Centered vs Infinite page layout (port from Superglue)

Status: **EXPLORATORY TEST — not a committed feature.** Branch: `ng` (work in a
scratch/experimental area, NOT on anything shippable).

## Working mode for this task (READ FIRST)

This is a **prototype/spike to validate the approach**, not a build-to-ship SOW.
- **Do NOT commit** anything unless explicitly asked. Work in a throwaway/experimental
  state so it's easy to discard.
- The goal is to **answer the open questions below** — chiefly "does the centered
  wrapper approach actually work without moving objects or breaking the editor's
  coordinate math" — and report findings, NOT to deliver a finished feature.
- Prefer the smallest experiment that proves or disproves the approach. It's fine to
  hardcode, stub, or fake page-level settings for the test rather than building the
  real storage/UI.
- If the approach proves out, we'll turn this into a real SOW and build it properly
  then. If it reveals a blocker, we want to know cheaply, before investing.

## Questions this spike should answer

1. Does wrapping objects in `position:relative; width:<W>; margin:0 auto` center the
   content responsively while objects keep their EXACT existing coordinates (no data
   change, no visual jump)?
2. Does the editor's coordinate math (Moveable + save path) still work when the
   positioning ancestor is the wrapper instead of the page/body? I.e. drag an object in
   centered mode — is the stored coordinate the same one infinite mode would store for
   that visual position? **This is the make-or-break question.**
3. Does the full-width background survive (background full-viewport, only content
   centered)?
4. Does toggling infinite<->centered leave objects visually in place?
5. Any surprises with overflow objects (positioned beyond the container width)?

Report what works, what doesn't, and whether the wrapper approach is sound — then stop
and await direction before any real implementation or commit.

## Goal (what we're testing toward)

Add a per-page layout mode:
- **Infinite** (current behaviour, the DEFAULT): objects absolutely positioned from
  the page origin; background/canvas extends indefinitely. This is exactly how every
  Hotglue page works today — must be unchanged.
- **Centered**: page content sits in a fixed-width container CENTERED in the viewport
  (re-centers responsively on resize). Objects inside it keep their exact coordinates.
  The container width is set by draggable handles (the red triangle handles in
  Superglue). Background extends full-width; only the content is centered.

## Core architectural decision (this is what makes it tractable)

**Do NOT change object coordinates and do NOT introduce a second coordinate system.**
Instead, in centered mode, wrap all objects in a centering WRAPPER div:

```css
.hg-centered-wrapper {
  position: relative;      /* REQUIRED: makes absolute children position relative to
                              THIS wrapper, not the viewport */
  width: <container-width>px;
  margin: 0 auto;          /* centers the wrapper responsively, in pure CSS, for free */
}
```

- Objects remain `position:absolute` with their EXISTING `object-left`/`object-top`
  values — now measured from the wrapper's origin instead of the page origin. Since the
  wrapper's origin coincides with where object coordinates were already measured from,
  **objects do not move and stored data does not change.**
- `margin: 0 auto` re-centers on window resize automatically (browser handles it) — no
  JS, no resize handler. (A static `body` margin would center at only ONE viewport
  width and break on resize — do NOT use that; the auto-margin wrapper is the fix.)
- **`position: relative` on the wrapper is load-bearing** — without it, absolute
  children position against the viewport and everything breaks. Get this right.

This means switching a page between modes is essentially adding/removing the wrapper —
objects don't jump, because the wrapper origin lines up with their existing reference
point.

## Storage

- **Page-level property** for layout mode: e.g. `layout-mode: centered|infinite`
  (default `infinite`). Store where page-level settings live (page config / the page
  object).
- **Container width** (centered mode): e.g. `container-width: <px>`, set by the handles.
- Object files are UNCHANGED — no per-object coordinate migration. This is the whole
  point of the wrapper approach.

## Rendering

- **Infinite mode (default):** render exactly as today — objects absolute from page
  origin, no wrapper (or a full-width, left-anchored wrapper that changes nothing).
  This path MUST be byte-for-byte today's behaviour; zero regression for existing pages.
- **Centered mode:** emit the `position:relative; width:<container-width>; margin:0 auto`
  wrapper and place all objects inside it. Their coordinates are unchanged.
- **Background stays full-width.** In Superglue's centered layout the background (e.g.
  the orange) spans the whole viewport while only content is centered. So the
  page/body background is full-width; the centering wrapper is transparent and holds
  only the objects. Ensure the wrapper does not clip or constrain the full-width
  background.

## Editor

- **Mode toggle**: UI to switch the page between infinite and centered.
- **Container-width handles**: in centered mode, show the draggable handles (the red
  triangles on either side in Superglue) that set `container-width`. Dragging updates
  the wrapper width live.
- Objects are edited inside the wrapper in centered mode — dragging/positioning works
  as normal, just within the (centered, relative) wrapper. Confirm Moveable and the
  editor's coordinate math work correctly when the positioning ancestor is the wrapper
  rather than the page/body (the editor must read/write coordinates relative to the
  same origin the wrapper establishes, so what the user sees matches what's stored).
- Show the container edges (the dashed guide lines in the Superglue screenshots) so the
  author sees the centered boundary while editing.

## Migration / compatibility (critical — ~60k existing pages)

- **All existing pages default to `infinite`** — opt-in to centered per page. Nothing
  changes for any current page unless the author switches it. (Same additive,
  non-destructive principle as the mobile-view work.)
- The infinite render path must exactly reproduce current behaviour (regression-test
  against real existing pages: they must render identically).

## Edge cases to define

- **Objects positioned beyond the container width** (e.g. an object at `left:1500px` in
  a 1000px centered container): in infinite mode it was fine (no width limit); in
  centered mode it overflows the wrapper. Decide behaviour — recommend ALLOW overflow
  (don't clip), matching how absolute positioning normally behaves; the object simply
  extends past the centered container. Do NOT silently move or clip user content.
- **Switching modes** should not move objects (the wrapper-origin alignment ensures
  this) — verify on a real page that toggling infinite<->centered leaves objects
  visually in place.
- **Container width smaller/larger than content** — define sensible min/max for the
  handles so the container can't be dragged to 0 or absurdly wide.

## Interaction with other features

- **Mobile guided view** (SOW-mobile-guided-view.md): centered mode gives a KNOWN
  content width (the container width), which is helpful for the mobile fit/scale
  calculation. The mobile logic should understand both modes — in centered mode, the
  container width is the natural "page width" to fit; in infinite mode, use the content
  bounding box as before. Note the intersection; don't need to solve both in one pass,
  but don't let them conflict.

## Constraints

- Vanilla JS (no jQuery), consistent with the `ng` editor. Centering itself is pure CSS
  (`margin:0 auto`); the handles/toggle are vanilla JS.
- Object files and their coordinates are NOT modified by this feature.
- Build minified assets via the project's terser build.
- The infinite path is the existing behaviour and must not regress.

## Out of scope

- Per-object relative/constraint positioning (NOT this — objects stay absolute; only
  the container is centered).
- Responsive reflow of object positions (Hotglue stays fixed-canvas; centered just
  centers the fixed canvas, it does not reflow content).

## Spike success criteria (what "done" means for the TEST)

The spike succeeds if it answers the questions above with evidence — NOT if it ships a
feature. Specifically, demonstrate (even with hardcoded/stubbed settings):
- A page rendered with the centered wrapper: content centered, re-centers on resize
  (pure CSS), objects at their EXACT existing coordinates, full-width background intact.
- The editor coordinate-math check (question 2): dragging an object in centered mode
  stores the same coordinate infinite mode would — or a clear report of what breaks.
- Toggling modes leaves objects in place; overflow objects behave sanely.
- A short findings summary: is the wrapper approach sound? Any blockers? What would a
  real implementation need to handle that the spike revealed?

Then STOP — no commit, no finished feature — and await direction. If sound, we convert
this into a real SOW (storage, editor UI, handles, migration) and build it deliberately.
