# SOW — Centered layout mode

Status: **implemented** on `ng` (`f2b3ffa` and follow-ups). Covered by
`tests/e2e/centered-layout.spec.js`. This document records the design as built and
the reasoning behind it; `SPIKE-centered-layout.md` records the exploration that
preceded it, including the parts of the original plan that turned out to be wrong.

## What it does

A page is in one of two layout modes:

- **infinite** — hotglue's original unbounded canvas. The default, and unchanged for
  every page that has not opted in.
- **centered** — the page's objects sit in a fixed-width container that stays in the
  middle of the window and re-centers as the window is resized.

The mode toggle is in the page menu. In centered mode two dashed handles at the
container's edges show its boundary and set its width by dragging.

## The one idea that makes it tractable

**No object coordinate changes, and no second coordinate system in the data.**
Centered mode wraps the objects in

```html
<div id="hg-centered-wrapper" style="position: relative; width: Wpx; margin: 0 auto;">
```

Objects stay `position: absolute` with their existing `object-left`/`object-top`.
`position: relative` on the wrapper is load bearing: it makes the wrapper the
positioning ancestor, so those coordinates are now measured from the wrapper's origin
instead of the page's. The wrapper's origin is where they were already measured from,
so nothing moves and no object file changes. Switching modes is only a question of
whether the wrapper is emitted.

Verified as the first test in the suite, because everything else rests on it: dragging
an object in centered mode stores the same coordinate infinite mode would.

## Storage

Two properties on the page object:

- `page-layout-mode` — `centered`, or **absent** for infinite
- `page-container-width` — px, clamped to `PAGE_MIN_CONTAINER_WIDTH` ..
  `PAGE_MAX_CONTAINER_WIDTH` (config.inc.php)

Infinite is stored by ABSENCE. A page nobody has switched keeps exactly the file it
had, and switching back removes the property rather than writing `infinite`.

## Rendering

`page_render_page_late()` in `module_page.inc.php`. In infinite mode it emits nothing
at all, so existing pages render as they always have.

The container cannot be built by moving child elements around: `render_object()`
appends each object to the body as an HTML **string**, not as an element tree. So
`page_render_page_early()` records where the objects begin in the body markup and the
late hook splices the wrapper around that range. The spike had injected the wrapper
client-side and never met this.

## Two coordinate spaces, and the bug class that comes with them

This is the real cost of the feature and the thing most likely to bite later.

An object's `offsetLeft`/`offsetTop` are measured from its positioning ancestor — the
page in infinite mode, the container in centered mode. Editor chrome is positioned
against the page in both. **Every place that mixes the two is a bug**, and each is
invisible until someone uses that particular feature on a centered page.

`$.glue.canvas` carries the three helpers that fix it in one place:

- `origin()` — where object coordinates sit in page space (`{x:0,y:0}` in infinite mode,
  so every call is a no-op on an existing page)
- `add(elem)` — put a newly created object on the canvas, which is the container in
  centered mode
- `from_page(x, y)` — convert a page point (a click's `pageX/pageY`, menu spawn
  coordinates) into the space object coordinates are stored in

Five instances were found and fixed:

| what | symptom without the fix |
|---|---|
| context menus | drawn beside the container instead of beside the object |
| scroll-into-view (Tab, arrow keys) | scrolls to the wrong place, silently |
| the drawn grid | lines do not match the positions objects snap to |
| object creation (text, iframe, webvideo, clone) | new objects land outside the container, then jump on reload |
| upload placement | dropped files land centring-width to the right of the drop |

The audit that found the last one classified all 41 uses of
`pageX`/`pageY`/`offsetLeft`/`offsetTop` across the editor. The rest are object-space
arithmetic on both sides — drag deltas, the selection border shift, the z-stack
intersection test, `$.glue.slider`'s `pageX` **deltas**, image re-centring — and are
correct as they are. Adding an origin to those would break them.

## Two more things the container broke, both non-obvious

- **`$.glue.canvas.update()` pinned a pixel width on body**, sized to the content
  bounding box. `margin: 0 auto` centers within body, so a px-width body centers the
  container once and never again. Measured: the object stayed at the same screen x
  through viewports of 1280, 1100 and 950. It now branches on the mode, sizing the
  container's height and leaving body's width to the viewport.
- **The container swallowed every background click.** It spans the canvas, and the
  editor decides what is a background click with `e.target == document.body` — so the
  page menu would not open and objects would not deselect. `pointer-events: none` on
  the container with `auto` on the objects inside lets the events through.

## Deliberate behaviours

- **Content beyond the container is not clipped or moved.** It simply extends past it.
  On a real page this is the norm rather than an edge case: 4 of the 7 objects on
  `content/start` fall outside a 900px container.
- **The page background still spans the window.** It is painted by `<html>`, which a
  child's width cannot constrain; the container is transparent and holds only objects.
- **Toggling modes moves content on screen.** It cannot not: centring is a move. What
  does not change is the stored data. The spike document asked to verify objects stay
  "visually in place", which is not achievable and is not the right criterion.

## Not done

- **Mobile guided view interaction.** It activates on centered pages and nests
  correctly (`#hg-mg-canvas` contains the container), with figures identical to
  infinite mode - so it is not broken. Whether the centring reads correctly at phone
  scale has not been looked at on a device. In centered mode the container width is
  the natural "page width" for the mobile fit, which the mobile code does not know
  about yet.
- **A default container width derived from content.** The handles start from
  `PAGE_DEFAULT_CONTAINER_WIDTH`, so switching an existing page to centered will
  usually put most of its content outside the container until the width is dragged
  out. A default based on the content bounding box would be kinder.
