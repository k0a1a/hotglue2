# Editor frontend — the `$.glue.*` framework

`js/edit.js` is a bespoke plugin/event-bus framework under `$.glue.*`
(canvas/sel/object/stack/menu/contextmenu/slider/colorpicker/upload/grid).
~40 editor-only JS files (`modules/*/*-edit.js`) depend on it as an API
contract. It loads only in the authenticated editor (gated by `$add_glue` in
`common.inc.php`'s `default_html()`) and never ships to a published page.
Vanilla DOM; Moveable for drag/resize; Alpine for a few reactive icons.
Migration history: `MODERNIZATION.md`.

## The two load-bearing conventions
- **`$.glue.object.save()`** serializes DOM objects to literal HTML strings —
  the on-disk storage format for every existing page. Changing serialization
  risks corrupting stored pages.
- **`$.glue.owner(elem[, obj])`** is a WeakMap-backed getter/setter, set once
  in `edit.js`, read at ~50 call sites across ~15 module files. Replaces the
  old jQuery `.data('owner', obj)`. Undocumented but load-bearing.

## Storage conventions (they matter more than the UI)
- **Absent means default** — store only what differs, so a reset object is
  byte-identical to an untouched one.
- **Store the ingredients, not the composed value** — the edge fade stores a
  distance, the glow a colour/radius/strength; the gradients live once in
  `css/main.css`. A `mask-image` string in an object file would put commas and
  quotes in the format and write the same gradient in two places that must
  agree forever.
- **A feature is finished when it survives save → reload → published page** —
  which is why the specs end by loading `?page` without `/edit`.

## Panels — one set of parts
Every panel is composed from `$.glue.popover` (open/show/close, place, row,
number_row, fold, color_button, delete). Placement is a **scored search**
against the **visual** viewport: covering the object disqualifies a position,
covering our own menus is a tie-break, distance from the pointer decides the
rest. "No menu or interface shall interfere with page elements" is the design
codex, enforced here. There is **no `reset`** any more (danja took the reset
button off every popout, 2026-09-28 — the helper, section resets and their
specs went with it); do not add one back. In-tree contract: `POPOUT-PANELS.md`.
House shape: one icon row of *acts* over one "more knobs" fold holding the
*values*; exactly one fold per panel.

## Editor-specific traps
- **Moveable's `onXxx` constructor options are shadowed dead code.** The
  constructor spreads `{ref, ...nextOptions, ...events}` and the internal
  events wiring is spread LAST, so every `onXxx` option (e.g. the editor's
  `onDragStart` hand-back) is shadowed and never runs. Touch hand-backs must
  live in the `m.on('dragStart', ...)` listener and abort with `e.stop()`
  (emit returns `!isStop`; listener return values are ignored). See the
  dragStart listener comment in `js/edit.js`.
- **Moveable's `preventDefault: true`** swallows the click a tap synthesises —
  that single default made the whole editor unreachable on touch while a mouse
  worked. The fix is `preventDefault: false` +
  `preventClickEventOnDrag: true`.
- **Moveable's gesture layer claims every touch on the container** (its
  mousedown hears only the target). A finger on a menu button dragged the
  object underneath in parallel — and `glue-movestart` hid the menus under the
  same finger. Filtered in `onDragStart`; any new touch-capable chrome must be
  added to that filter's selector list.
- **`$.glue.icon()`** sizes its button **inline at 32px**, so a CSS `width`
  rule on `.glue-btn-icon` silently loses the cascade (the button stays 32).
  Only the glyph's `::before { mask-size }` works from CSS. Set the box in JS
  next to the `icon_button()` call; size the mask in `css/edit.css`.
- **Icons are masks; a mask reads ALPHA only.** Judge new artwork by rendering
  its ALPHA at 30px — the file's colour never reaches the screen. When
  stripping any icon, grep it for `<text` (a live `<text>` depends on the
  viewer's installed fonts; the S/N/B/X set was the case, converted to
  outlines 2026-09-28).
- **`.glue-popover-label` must stay content-sized** — never add a fixed width
  back; it squeezes the control sharing the row (the colour picker's opacity
  slider shrank to a nub). The rule is in a comment in `css/edit.css`; the
  e2e guard is the content-sized probe in `tests/e2e/object-shape.spec.js`.
