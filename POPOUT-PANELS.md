# The popout panels — the house style

**As of 2026-09-17**, the day every panel was brought onto one shape. Read this before
building a panel or changing one; the convention is also written once in the code, in the
comment above `$.glue.popover.icon_row()` in `js/edit.js`, because that is where someone
about to build one will be looking.

## What a popout is

A panel that opens beside the object (or page) being edited. It never covers the object:
`$.glue.popover` in `js/edit.js` places it, measuring the VISUAL viewport and scoring the
four sides of the object plus the pointer, with covering the selected object disqualifying
a candidate outright and covering the editor's own menus only breaking a tie. That is the
design codex — "no menu or interface shall interfere with page elements" — enforced in one
function, which is why a panel's size changing (a fold opening) means it is placed again.

The panels are editor-only chrome: `css/edit.css` and the module `*-edit.css` files never
ship to a published page.

## The convention

> A panel opens as **one row of icon buttons** — the verbs, at the panel's own 26px, named
> in their tooltips and nowhere else — and **one fold labelled "more knobs"** under it,
> holding everything that is a value rather than an act: sliders, fields, the delete, the
> reset. Exactly one fold per panel. A panel with nothing to fold has an icon row and no
> fold, rather than an empty one.

Which control is which falls out of one question: **is it an act or a value?** Tile the
picture is an act; how big the picture is, is a value. The acts are drawn as icons at the
top, the values are rows inside the fold. A destructive act (removing a background) goes in
the fold with the values, not in the icon row.

### The parts

In `$.glue.popover` (`js/edit.js`), beside `row()`, `fold()`, `number_row()`, `color_button()`,
`reset()` and `delete()`:

- `icon_row()` — an unlabelled row carrying `.glue-popover-icons`. Fill it, then append it
  to the panel.
- `icon_button(name, title)` — one act in such a row: `$.glue.icon()` with
  `.glue-popover-icon` and the panel's own 26px, since `$.glue.icon()` sizes its own box at
  the toolbar's 32. The mask comes down from 30 to 22 with it (`css/edit.css`); a mask
  scaled past its box does not overflow, it disappears.

`fold(pop, label)` is unchanged and does the work: it returns `{toggle, body}`, both of
which the caller appends, and it re-places the panel on every toggle. It has no
open-by-default and does not need one.

### The frame

Every panel wears the menu elements' frame, so a panel and the menu that opened it read as
one family: `border: 1px solid #000` over `rgba(255, 255, 255, 0.8)`, no shadow. The colour
picker, and the text editing strip that docks to a text object, still wear the older
chrome (`#f2f2f2`, a silver hairline drawn as a 1px shadow spread, and a drop shadow) —
the picker because it is vanilla-picker's own drawing, the strip because it is not a popout.

### Size

A panel is **as wide and as tall as its content**. No panel pins a width. What a panel with
knobs comes out at is therefore its widest row, and for a number row that is
`.glue-popover-slider`'s 80px — the one number to change if the panels want to be tighter
or looser. It is fixed on purpose: a range input's own width is the browser's, and Chrome
and Firefox disagree about it by a third. `max-width: calc(100vw - 16px)` keeps a
naturally wide row (a url field) from pushing a panel off a narrow viewport, and the tall
folds carry `max-height: 42vh; overflow-y: auto`.

Height was always the content's. Note the consequence of the width being the content's: a
panel that opens on its icon row is the width of that row, and **gets wider when the fold
is opened**, since a `display: none` fold contributes nothing to layout.

A field that is wide **by nature** — a url, a sentence — says its own width, the same way
the slider says 80: `.glue-object-link-field` is 240px and `.glue-image-alt-field` is 180,
both overriding `.glue-popover-field`'s 44 with its `flex: 0 0 auto` kept. A content-sized
panel does not otherwise give such a field any width to have: an empty `<input>` left to
itself is the browser's own 150px (Chromium) or 143 (Firefox), which is not a url anybody
reads. See the trap below for the shape that does *not* work.

## The panels, as they stand

| panel | built by | shows | folds |
|---|---|---|---|
| object properties | `object_properties_popover()`, `modules/object/object-edit.js:998` | colour · picture · tile · flip-h · flip-v | x, y, scale, padding (text only), transparency, delete, reset |
| page background | `page_background_popover()`, `modules/page/page-edit.js:387` | colour · picture · tile · scroll | x, y, scale, delete, reset |
| font | `text_font_popover()`, `modules/text/text-edit.js:1431` | sizes s/n/b/x (8, 16, 24, 32) · four style toggles + colour · four alignments | face, exact size, three spacings, shadow + its colour, source note, reset |
| edge | `object_edge_popover()`, `modules/object/object-edit.js:486` | style + colour · round · width | fade, glow, drop shadow, reset |
| adjust (z-level) | `object_adjust_popover()`, `modules/object/object-edit.js:893` | four z buttons | nothing — an icon row and no fold |
| object link | `object_link_popover()`, `modules/object/object-edit.js:1707` | the url | the target |

### The exceptions, and why

- **The object link panel's fold is not "more knobs"** and says so: `target: _blank`. A
  target is a STORED value, and an object that has one must not have it invisible in a fold
  named for knobs nobody may want. That is the one fold whose label names its contents.
- **The font panel keeps its face and its exact size out front**: they are values, so the
  rule would fold them, and a font panel that opens without a font is a worse panel.
- **The adjust panel has no fold** — four acts and a reset is the whole panel. The
  convention asks for no fold rather than an empty one.

### Panels deliberately left as they are

`image properties` (two controls, one a sentence-long field), `heading` (its controls are
words), `grid` (two text-glyph toggles with no honest artwork in the set), `page settings`
and `reading order` (fields and a list). Each is already at its minimum; converting them
would mean inventing a glyph to justify a row.

## Building the next one

1. `var pop = $.glue.popover.open(obj, 'glue-x-popover')` — the class names the panel and is
   how it toggles closed on a second click.
2. `var icons = $.glue.popover.icon_row();` and one `icon_button(name, title)` per act.
3. `var fold = $.glue.popover.fold(pop, 'more knobs');` — one per panel.
4. Draw the values into `fold.body` with `row()` / `number_row()` / `color_button()`, and
   put the delete and the reset at the end of it.
5. Append `icons`, `fold.toggle`, `fold.body` to `pop`, in that order, then
   `$.glue.popover.show(pop)`. Append order is the only thing that decides what the panel
   looks like, so a row may be built anywhere and appended where it belongs.
6. Give every row that a test will need to name a class of its own — the fold is one list
   now, and a bare `.glue-popover-field` matches several rows in it.
7. `node tools/make-min.js <file>` for every JS file touched, then the specs.

## Traps that have cost time

- **One disclosure per panel.** Specs locate `.glue-popover-advanced` inside a panel
  without naming a section, so a second fold is a Playwright strict-mode violation — and
  it would be two ways to hide the same control anyway. This is what flattened the padding
  section's own "more knobs" fold into the panel's, and cost its four side rows the
  anonymity of being a fold's whole contents (they carry `.glue-padding-top` and its
  siblings now).
- **A fold hides; it does not disable.** The panel is built once and never rebuilt, so
  handlers that run while the fold is closed (a grey-out sync, an upload's finish) keep
  working. Nothing needs to be woken when the fold opens.
- **Counts read closed; clicks, fills, taps and `boundingBox()` do not.** A row inside a
  closed fold is in the DOM for `toHaveCount`/`toHaveClass`/`toHaveValue` and has no box for
  anything that acts on it. And opening the fold RE-PLACES the panel, so measure after.
- **A panel cannot open onto the object.** Watch this when a panel grows: the fold's height
  is the usual reason a panel is tall.
- **Icons are masks, and a mask reads alpha only.** Judge artwork by its alpha at 22px in a
  panel (30 in the toolbar); a mask that fails to load paints nothing while every test that
  only asks "is it visible" passes.
- **A wide field is sized with `width`, not with `flex-basis`.** The intuitive move for a
  field that should take a fixed share of a content-sized panel is `flex: 0 0 240px`, and it
  is wrong in a way only one browser shows: measured, Chromium gives a 240px field in a
  278px panel, and Firefox gives a 240px field in a **182px panel** — hanging out through the
  panel's frame. The max-content width of a single-line flex container is pulled back down by
  an item whose own content is narrower than its base size, and only Chromium lets the base
  size win. `width: 240px` on a `flex: 0 0 auto` item agrees in both.
- **`node tools/make-min.js`** after editing any of hotglue's own JS: `USE_MIN_FILES`
  defaults to true, so the `.min.js` copy is what a default install serves, and
  `tests/e2e/min-files.spec.js` fails when a copy falls behind its source.
- **Nothing in here touches storage.** The panels read and write the same attributes they
  always did; a panel is a view of the object file, and the file format is the product.
