# Hotglue `ng` — Roadmap / Backlog

A single index of the work-in-flight and the "someday" list, so the scattered task
docs have one home. Not a rigid roadmap — a living list. Roughly grouped by status.

This is the feature/dev backlog for the hotglue **application**. Service operations for
any particular install — accounts, UserCake, mail, hosting, moderation — belong in that
service's own repo, not here, and are deliberately absent.

Maintained as work lands: when something ships it moves to *Done*, and its task doc is
updated to describe what was BUILT rather than what was planned — several of these
designs changed materially once they met real pages, and a stale spec is worse than
none. Last reconciled against the tree on 2026-09-02, that time by walking every commit
since the previous reconciliation and grepping the tree behind each icon and PNG claim —
which is how the icon section's "still needs drawing" table turned out to have been stale
by two features and one sweep that had already been undone, and a shipped SOW turned out
never to have been listed here at all.

---

## Task docs (detailed specs — read these when building)

All of these have shipped, so each one now records what was BUILT — read them for the
reasoning, not as a plan. One further design lives only in git history; see below.
Checked against the tree on 2026-09-02.

### In this directory, and SHIPPED

- **SOW-mobile-guided-view.md** — `js/mobile-guided.js`: pan/zoom viewing of the intact
  fixed canvas on small screens. Now a record of what was built, not a plan. Note the
  design changed substantially from the original brief: there is **no content
  inspection** (no entry-point selection, no text/image classification, no font
  measurement) — each guessed wrong on real pages. It opens at 75% of the canvas's
  LIMITING dimension, reveals to natural size, and double-tap returns to the opening
  view. The browser's pinch floor is a hard 0.25 and everything follows from that.
- **SOW-object-properties.md** — the per-object action now opens an "Object Properties"
  dialog showing the object as the `<div>` it renders as. Validation runs in three
  places, and the render-path filter is the one that holds: `glue.update_object` is a
  generic key/value setter, so a guard only on the write path is one POST from bypass.
- **SOW-text-link-ui.md** — select text → URL dialog → `<a href>`, with scheme
  validation, escaping, and edit/remove. Text objects are edited as raw HTML in a
  TEXTAREA, not contenteditable, so the original brief's `execCommand` approach did not
  apply at all.
- **SOW-centered-layout.md** — centered vs infinite page layout, promoted from the spike
  and shipped. Objects keep their exact coordinates; infinite is stored by absence so no
  existing page changes.
- **SPIKE-centered-layout.md** — the exploration that preceded it. Kept because it
  records what was measured before anything was built, including two things the original
  plan got wrong.
- **SOW-glow-shadow-effects.md** — *(BUILT; see the edge-panel Done entries.)* The glow,
  its marble extras and the directional drop shadow, built 2026-08-23/24 as the edge
  panel's "more knobs" fold. It shipped with the commit that first wrote it and was never
  listed here — the file's own status line still said "to implement" until 2026-09-02;
  corrected. Read it for the two-effects-stay-distinct design question, which the fold
  kept to.

### In this directory, NOT yet built

- **SOW-text-controls-redesign.md** — *(all three popovers — Font, Spacing, and since
  2026-08-25 Padding — are BUILT; the padding relocation itself is not the one this SOW
  planned, see below.)* Collapse the text menu's eight formatting buttons into Font and
  Spacing popovers plus a standalone Color button, and move padding out to object
  properties. Reconciled against the tree on 2026-08-23: the paragraphs marked
  **CHECKED** are what the code actually does, and three of them change the plan — the
  controls style the whole object rather than a selection (so the spec'd three-state
  toggles have no partial state to read), `text-decoration` is stored nowhere at all (so
  underline/strikethrough are a storage change, not just a UI one), and there is no
  reusable popover component yet (the colour picker's placement would have to be lifted
  out first — it was, that same night, as `$.glue.popover`). A fourth paragraph changed
  on 2026-08-24: run-level formatting for a SELECTED run now exists as the editing strip
  (see Done) — the per-selection half; the object-level controls still style the whole
  object, so the three-state read is unchanged. The padding relocation shipped on
  2026-08-25 as a popover off the text menu — a uniform row, per-side knobs in a fold,
  a reset to the module's default — which is NOT the move into object properties this
  SOW planned: the padding button still opens its panel from the menu, and Object
  Properties has never hosted padding.

- **SOW-object-shape.md** — *(BUILT; the doc records what it grew into.)* Rounded
  corners (ported from Superglue) and a new edge fadeout, scoped 2026-08-23 and built
  the same night. Read it for what the scope met on contact: the two properties became
  one edge panel with a border and a glow, the fade ended up as two intersected
  gradients rather than either radial, and objects could only have a border at all once
  the editor's selection stopped being one.

### In git history only

- **MOBILE-VIEW-DESIGN.md** — the author-curated "mark elements mobile-friendly →
  stacked view" approach, a DIFFERENT design from the pan/zoom one that shipped. That
  choice has been made: pan/zoom is the mobile view, and this is **not** being pursued.
  Kept findable rather than resurrected — `git show 6e6bd6b:MOBILE-VIEW-DESIGN.md` — and
  it still holds a useful survey of seven approaches if the question is ever reopened.

---

## Done / shipped

- DB-backed editor auth (`AUTH_METHOD='db'`).
- **Undo/redo** — `$.glue.undo` in `js/edit.js`, an in-memory stack 20 deep. It replaced
  the old server-side auto-snapshot system rather than building on it.
- **Favicon upload** — in site settings, with a clear action (`page-favicon-file`).
- **Upload & manage fonts** (woff/woff2/ttf) — site settings, with per-font removal
  (`page-custom-fonts`, `page.remove_font`).
- **Server-side video transcoding** — uploads are re-encoded via ffmpeg to one
  web-optimised variant with a generated poster, in the background, with a placeholder
  shown while it runs. See README's 2026-08 entry.
- **Relative internal links** — a link may be written as a bare page name and is resolved
  at render (`resolve_relative_urls()`); the link dialog deliberately leaves them alone
  rather than absolutising them.
- Editor dejQuery'd → vanilla + Moveable (drag/resize, touch-capable) + Alpine (chrome).
  HiDPI sharp images. PHP8 pass. Color picker later moved to vendored vanilla-picker.

Shipped 2026-08-22:

- **Mobile view** — DECIDED and shipped as pan/zoom of the intact canvas
  (`js/mobile-guided.js`): an exponentially-paced reveal and a double-tap overview
  toggle. The author-curated stacked alternative is **not** being pursued; see the note
  under *In git history only*.
- **Centered layout mode** — per-page, opt-in, no coordinate migration.
- **Object Properties dialog**, **text link dialog**, **WYSIWYG text editing** (the
  markup is hidden while editing; `</>` switches to source), **object overflow toggle**.
- **First JS test infrastructure**: a Playwright e2e suite, `tests/e2e/`, **446 tests
  passing on Chromium AND Firefox**. Hermetic — it runs its own PHP server against
  `content-e2e/` and never touches real content or credentials.
- **`tools/make-min.js`** — the "small one-off script" the `*.min.js` pairs were always
  described as coming from, finally written. `js/mobile-guided.js` is the only script a
  visitor to a published page downloads, and now ships at 4KB gzipped instead of 11KB.

Shipped 2026-08-23 — a day on the editor's own chrome:

- **The SuperGlue icon set, first batch wired.** `tools/prep-icons.js` regenerates
  `img/icons/` from the upstream artwork and honours its `extra/` folder of redraws;
  `$.glue.icon()` builds a button from one by name. Ten are in use, and the text menu is
  now almost entirely SVG. Details, including the licence question that still blocks
  release, under *Icon set refresh* below.
- **Free object rotation** — Moveable's rotation handle, hung off the right edge (the
  top is where the menu is), snapping to 15° by default with shift releasing it to any
  angle: the opposite of the usual binding, on the grounds that a heading accidentally
  left at 7° is the startling outcome, not a constrained one. It writes a `rotate(Ndeg)`
  term into the object's own transform, alongside whatever flip the flip button set —
  the two used to overwrite each other, which was invisible from either control alone. A
  90°-per-click button was built first and dropped: once the handle existed it was a
  second, worse way to the same value.
- **Handles outside the object** — resize handles used to straddle the edge, half of
  each lying over the author's content, against the design codex's "no menu or interface
  shall interfere with page elements". They sit 5px clear of it now, and the offset turns
  with the object: as a margin it was screen-space, so it pushed handles INTO anything
  rotated past 90°.
- **The chrome stays aligned to the object it belongs to.** The context menu is placed
  from the object's VISUAL box rather than its layout box (which a transform does not
  change), `$.glue.contextmenu.reposition()` runs that placement again on rotateEnd,
  resizeEnd and after an undo instead of only when the menu is built, and the handle
  offsets read their angle off the element's own matrix rather than Moveable's cached
  rect. Each of the three was a different way of describing the object as it was a
  moment ago.
- **`$.glue.popover`** — the placement rule ("beside the object, never over it, nearest
  the pointer that still fits") and the slider-and-field row, lifted out of the colour
  picker and the text module so the panels cannot drift apart. Three controls use the
  same row now: font size, the text spacings, and the picker's alpha.
- **Font popover** — face, size and style in one panel, replacing three buttons that
  each had to be cycled or dragged. Two-state B/I/U/S toggles (the controls style the
  whole object, so there is no partial state to show), a size field that is not capped by
  its slider, and `text-decoration` finally stored — nothing saved it before, so
  underline and strikethrough would have vanished on reload.
- **The link panel is a rollout**, not a modal: two fields and a button no longer come
  with a backdrop across the page, and it opens beside the object instead of centred on
  the viewport — which is to say, on top of the text being linked. It commits on OK
  rather than applying live, since it rewrites markup around a selection.
- **Spacing popover** — line height, letter spacing, word spacing, alignment and a
  reset, replacing four buttons: three that had to be dragged (where a click meant
  "reset", which nothing told you) and the alignment cycle. Spacings in em, line height
  shown as a multiple; reset clears the properties rather than storing defaults. Between
  the two panels the text menu is down from thirteen buttons to six.
- **The colour picker, reworked.** Half its old 250x315. It opens in the nearest free
  space beside the object rather than at the pointer, which used to put it on top of the
  thing being recoloured, and the speech-bubble tail went with that. Transparency is a
  slider and a number field in percent rather than vanilla-picker's gradient bar, which
  showed the effect of the value without ever showing the value — note it is the alpha
  of that one colour, which the object-transparency button cannot express since it fades
  everything at once; both controls exist for now. The sample is square, the hex field
  fits `#rrggbbaa`, and the seven most recent colours on the page are swatches above it,
  stored as `page-recent-colors` so they are there for whoever opens the page next. A new
  text object now takes the most recent of them instead of a random colour, so a run of
  them comes out in the palette being worked in.

Shipped later the same night — the editor's panels, and what objects can be:

- **The link dialog became a rollout**, on the same placement rule as everything else:
  two fields and a button no longer come with a backdrop across the page.
- **Selection is an outline, not a border.** It was a border on the object itself since
  2010, so selecting one moved its content by a pixel and three separate places had to
  shift it back. That is also what made an object's own border impossible.
- **An edge panel for every object**: rounded corners, the soft fade, and a border —
  width, style, colour — with a "more knobs" fold holding a *glow* (a radial-gradient
  background that leaves the content sharp where the fade (a mask) would not), its
  marble extras (an inner glow, a second colour for the sides) and a directional
  drop shadow — one formula in css/main.css composing every member into a single
  box-shadow from stored ingredients.
- **One typography panel.** Spacing and alignment folded into the font panel's "more
  knobs" section, which also gained a text shadow and the text colour; the text menu went from
  thirteen buttons to five. One reset, in the fold, for the whole panel.
- **A tap works on a phone.** The editor was unreachable there for one reason:
  Moveable's gesture layer calls `preventDefault()` on touchstart, which stops the
  browser synthesising the click that follows a tap — and every path into the editor
  starts with that click. Selecting an object, opening its menu, editing its text: all
  silently dead on touch, all fine with a mouse. `preventDefault: false` plus
  `preventClickEventOnDrag: true` lets the tap through while keeping a drag from ending
  in one. `tests/e2e/touch-editing.spec.js` runs in a touch context and holds it.
- **A background image on any object** — the browser's own file picker when there is
  none, a panel to tile, drag or remove when there is. It uploads with the object's name
  and the object serves it, the way image objects already serve their picture.
- **The panels are one set of parts**: `$.glue.popover` places them (beside the object,
  never over it), folds them, builds their rows, their colour buttons and their resets.
  Four panels and the colour picker's alpha are built from the same pieces.
- **The drag-only controls work on touch.** `$.glue.slider` used to bind
  `mousemove`/`mouseup`, which touch never sends during a drag, so every drag-only
  control was dead on a phone. It listens for pointer events now, each trigger binds
  `pointerdown` with `touch-action: none` on itself (or the browser claims the gesture
  for scrolling and the drag becomes a pointercancel), and the colour picker's anchor
  follows the same stream. One thing the migration surfaced: Moveable's gesture layer
  claims every touch that starts on the container, so a finger on a menu button was
  dragging the object underneath it in parallel — which hid the menus (and, through a
  tooltip update that expects a live element, silently dropped the drag's save). The
  Moveable `onDragStart` filter hands chrome touches back to the control that got them,
  and a throwing change handler can no longer orphan a drag's listeners. The three drags
  `tests/e2e/touch-editing.spec.js` performs with a finger — transparency, padding in
  two dimensions without the page scrolling, and a tap that keeps its click — hold it.

Bugs found while building the above, each invisible from reading the code:

- The editor's canvas shortcuts fired while a field had focus: Delete (handled on
  KEYUP, which is why the earlier keydown guard missed it) deleted the selected object
  while you cleared a url, ctrl+a selected every object on the page, and the arrows
  nudged them. The two text editing surfaces had each solved this for themselves by
  stopping propagation; the editor's own inputs never had one.
- Moveable's control box sat at z-index 99999 (inherited from matching jQuery UI's old
  handles), which put the resize handles above every piece of editor UI — including the
  colour picker opened from the menu of the very object whose handles then painted over
  it. Only visible when a handle happened to land on the picker's gradient square.
- vanilla-picker builds its wrapper ONCE and reuses it; hiding the picker only detaches
  the anchor. Anything added to that wrapper is still there next time it opens, so the
  alpha row grew a copy per open.
- The flip button read the transform through `getComputedStyle()`, which flattens the
  function list to a single `matrix()`. A rotated object matched none of the flip states,
  so flipping it silently wiped the rotation.
- Two icon names are swapped in the upstream set: `align-left.svg` draws lines centred
  and `align-center.svg` draws them flush left. The buttons are mapped by what the
  artwork shows.
- `upload_files()` dispatches by building `"{preferred_module}_upload"` and calling it,
  so a preferred_module with a hyphen in it is not a function name, is silently not
  callable, and the file falls through to the generic hooks — where the image module
  turns it into a new object. Nothing logs a complaint.
- The image module paints its picture with `background-image`, so a save rule that read
  `background-repeat` off any element that had one wrote two new attributes into every
  image object on every save. `save-serialization.spec.js` caught it.
- A panel avoided ITSELF: `.glue-popover` was added to what a popover must not cover (so
  the colour picker would not cover the panel that opened it), and a panel is in the DOM
  before it is placed. That is what put a panel on top of its own object.
- In the test harness, not the app, and the cause of nearly every unreproducible
  failure this suite has had: `Fixture.destroy()` removes the page directory in
  teardown while the editor is still landing a save it started as the test ended, and a
  file appearing mid-walk makes the rmdir fail with ENOTEMPTY — failing the test AFTER
  every assertion in it had passed. Always a different test, always fast, never on a
  rerun. `rmSync`'s `maxRetries` is for exactly this.
- Also the harness: `Fixture.readObject()` threw ENOENT for an object file that did not
  exist yet, which makes `expect.poll()` fail outright instead of retrying.

Bugs the tests found that nobody had reported — worth noting, because each was invisible
from reading the code:

- `$.glue.live` resolved selectors lazily, so handlers saw class changes made earlier in
  the same dispatch. One click on a text object jumped straight into editing, and two
  text objects could not be multi-selected at all.
- Drag auto-scroll worked horizontally and never vertically — the axis that matters, on
  canvases that run far taller than wide.
- `$.glue.object.unregister()` left an object permanently undraggable.
- Five places where centered mode's two coordinate spaces were mixed.

Shipped 2026-08-24 — text, one run at a time:

- **Run-level text formatting.** B/I/U/S, a colour, a font face, and an arbitrary-px
  size (a slider and a manual-entry field) for a SELECTED RUN of text, while the
  object is edited WYSIWYG — the first formatting that styles part of a text object
  rather than all of it. No PHP touched: the strip writes semantic tags (`<b>/<i>/<u>/<s>`
  and a `<span style="…">`) into the stored content, which the render path passes
  through byte-for-byte. The strip is a page-space toolbar docked below the object,
  flipping above it when there is no room, and selection-aware in the way that has
  to be: every control snapshots the selection on mousedown, because the editor's
  document-level mousedown guard is what keeps a range alive across clicks on a
  `<div>` button, and programmatic focus would collapse it first (the face dropdown
  also falls back to the last-known selection, since a pick can reach `change` with
  no mousedown at all). Toggles nest innermost-last (`<i><u><s>`); size, face and
  colour all join ONE span per run, whichever order they are picked in; a collapsed
  caret gets a zero-width-pad scaffold so typing lands inside the tag, and abandoned
  scaffolds are swept out of the source on the way back to storage. Hidden in source
  mode, closed by Escape or a canvas click. 19 tests in `tests/e2e/text-formatting.spec.js`
  on both engines, asserting the STORED bytes.
- **Square handles everywhere.** The popover sliders' thumbs — padding, font, glow,
  edges, opacity, the colour picker's alpha row — and the picker's round gradient
  cursor are squares now, matching the editor's other handles instead of the
  browsers' circles.
- **The text menu's top row, in the requested order.** Change background, make
  background transparent, font, padding, source, link — explicit priorities rather
  than the registration order the six buttons shared.
- **The e2e suite passed 500** — 537 passing on Chromium and Firefox, the
  formatting spec's 19 tests included.

Shipped the night of 2026-08-24 and into the 25th, after the last entry — the icon set
takes over the object's chrome, and the panels grow:

- **The object-adjustment popout.** Flip, z-level and transparency fold three menu
  buttons with hidden gestures into one panel. The gestures were: a flip that cycled
  through four states, and z-level and transparency that were both drag-distance
  sliders — drag right, drag further right. The popout trades the hidden gestures for
  visible controls: flip becomes two independent toggles, so "flipped both ways" is a
  state rather than a stop on the way back to none, and the z-level gets explicit
  buttons (to the ends, or one level at a time — the single-level swaps save both
  objects). The work surfaced a Moveable bug along the way: the onDragStart hand-back
  the chrome relies on was shadowed by Moveable's internal event wiring, so it now
  lives in the live dragStart listener, which is where it actually stops the event.
- **Padding gets a panel.** The text menu's padding button used to be a drag-only
  control with a click-to-reset; it opens a panel now: one uniform row (showing what a
  drag would set all four sides to), per-side knobs in a "more knobs" fold, and a reset
  that clears the inline padding so the module's CSS default shows again — with the
  box compensated so nothing moves while you look. Sides clamp at half the shorter
  dimension; the field may say more, the apply clamps.
- **The text placeholders and PNG buttons of the object chrome became icons** through
  the night: `clip` (its state is now the pressed-in frame — which is the answer to the
  runtime-glyph-swap question the icon section used to raise), `delete`,
  `shared-w-other-pages`, the edge buttons, the padlock `lock`, `object-props` (code
  brackets) and `object-link` (the broken link), and the link glyph's frame redrawn to
  hug the artwork. Icon buttons hover by their frame now, not by the glyph: pointer
  cursor, a grey fill, and no red. (Download/upload and the new-text-object button
  followed later on the 25th — see below.) The clone sheep's placeholders (`sheep-icon4`
  and the earlier sheep) settled on `sheep-icon5`,
  and **the sheep blinks**: a lid painted in the button's own fill drops over its eyes
  via a `::after`, on a wandering 3–30s clock — the cycle is re-rolled on every
  `animationiteration`, and each roll rewrites the keyframes' percentages too, so the
  three fades stay a fixed half second while the pause between blinks wanders. The
  colour picker settled at 180px wide.
- **Editing text stopped showing the editor.** The WYSIWYG surface lost its focus
  ring, border and shadow, and the dashed outline that used to frame it is gone —
  when you edit text, the page shows the text.
- A bug the suite caught, worth noting: **the colour picker's alpha slider snapped
  back to opaque the moment a finger let go.** vanilla-picker swallows every click
  inside its panel, and a range input commits on the track click or the end of a drag —
  Chromium cancels that whole commit when the click's default is prevented. The alpha
  row's clicks now stop before the library's handler sees them, the way the swatches'
  clicks already did. Regression tests on both engines hold it.

Shipped 2026-08-25 — the context menu's top row, and what a panel's footer can say:

- **Object adjustments and background ride the top row.** The object-wide pair used to
  sit at the bottom of the left column, far from the text items they follow in the
  workflow. `register()` takes a fifth flag now — "opt out of the left column" — and the
  pair registers with priorities 7/8, riding the top row right after the text items
  (1–6). A placement test (top-row class, no left-column membership, row order) plus
  the menu-geometry suites hold it: 148 tests green on both engines.
- **The background panel's footer split in two.** One reset button used to do both
  jobs. Now the footer holds two: a red **delete** that removes the image *and* the
  file the object names, and a **reset** that keeps the image but puts tiling, scale
  and position back to their defaults — no-repeat, the natural size, the corner. A new
  parts-bin piece, `$.glue.popover.delete()`, the destructive sibling of reset, styled
  in the colour of the panel's problem notes. 16 tests green on both engines; one pins
  the reset semantics — the image survives, the three attributes drop or default, the
  panel shows the defaults again.
- **No "upload a video" in the new-object menu.** The dedicated button was only a
  discoverability affordance — video files still upload through the generic upload
  button and drag-drop, as the deleted comment itself noted — and the video module's
  upload/encode pipeline is untouched. 62 tests green on both engines, min freshness
  included.
- **The remaining new-menu and module buttons converted too**: `download` and `upload`
  (their artwork redrawn upstream as solid arrows with no tray, in the set's `extra/`
  folder), the new-text-object button dropping its `<img src=…/text.png>` for
  `text-object`, and the background button's glyph redrawn to the tile-image artwork
  brought into its frame — so the menu shows what the panel does.

Shipped 2026-08-30 — the page's own background catches up, and a morning's sweep proves
the icon take-over was one commit away:

- **Page background: tiling and size (panel + render).** The page-background panel
  grows the tile and size rows, and `module_page.inc.php` now renders
  `page-background-repeat` and `page-background-size` to the published page — written
  only when set, per the absent-means-default convention, so no existing page changes.
- **The new-object menu and page chrome converted in the same commit**: `embed-webpage`
  (iframe), `embed-webvideo`, `site-code`, and `site-settings` — the last replacing a
  hand-styled `⚙` text div — took mask buttons, every colour button across the panels
  moved onto the one `color-swatch` glyph (retiring `color-quadrant`), and the image
  module's three 2010-vintage context-menu buttons — tile, restore natural size, and
  position-drag, still writing `-moz-background-size` — came off: what they did is the
  background panel's job now, which any object gets. The module keeps its natural-size
  bookkeeping on resize and its download button.
- **Popover labels fit their text.** The fixed label column is gone — a width always
  squeezes the control sharing the row (the colour picker's opacity slider shrank to a
  nub), and every label is a different length anyway. The width kept coming back and
  the rule now lives in a comment; the e2e assertion that used to expect the fixed
  column now probes that each label is exactly as wide as its text.
- **A sweep, a revert, and a reconciliation.** One commit swept the fifteen PNGs and
  two icons it assumed the take-over had finished with — it had not: the page module
  and the new-object menu still loaded them, and the icons deleted were still being
  called. The PNGs were restored the same morning, and the icon directory was then
  re-committed to what the editor actually loads — the missing drawings added
  (`color-swatch`, the embed pair, the page/settings glyphs), four unused sheep frames
  dropped. That afternoon the conversion commit above removed the last PNG references,
  so the restored fifteen are orphans again: nothing in the tree loads them, and a
  later sweep can finish what the first one started a few hours too early.

Shipped 2026-09-01 — the rotate knob's own cursor, and no long-press magnifier on the
control box:

- The rotation handle is a Moveable control, and Moveable's default for it is
  `cursor: alias`. It draws its own now — the classic rotate glyph, a white-outlined
  ring with an arrowhead at the top, as an inline SVG data-URI with its hotspot at the
  centre — alias kept as the fallback.
- The round green arrow that appeared on click-and-hold was not ours at all: it is the
  browser's long-press UI (Android's text-selection magnifier), triggered by a
  long-press landing on the handle. `user-select: none` stops the selection gesture at
  the source, `touch-action: none` hands the whole gesture to the page so Moveable's
  drag listeners get it, and `-webkit-touch-callout: none` covers the iOS callout.
  Both rules need `!important` like their neighbours: Moveable's stylesheet is injected
  by css-styled with a generated class prefix that outranks plain selectors here. CSS
  only — nothing else moved.

---

## Bigger initiatives (need their own SOW when picked up)

- **Contextual per-object toolbar model** — port Superglue's mature UX (contextual
  toolbars attached to the selected object + inline popovers for properties/color/
  link/image-source/code + layer controls). Superglue editor is a browser ADDON — its
  code won't port; use it as a **design reference**, reimplement in `ng`'s
  vanilla+Alpine+Moveable stack. If pursued, **fold in** SOW-object-properties and
  SOW-text-link-ui as popovers within this model rather than building them standalone.
  NOTE: re-evaluate each feature's trust/safety posture. Superglue was
  single-tenant-per-user and could afford to be permissive (raw per-object HTML editing,
  for instance); a hotglue install can host many authors who do not trust each other, so
  dial that back — keep per-object code scoped to classes and attributes, with JS staying
  in `/code`. (One piece of it exists already: the run-formatting strip that docks to a
  text object while it is edited WYSIWYG — 2026-08-24, see Done.)
- **Icon set refresh** — *(the wiring is complete for the editor's own chrome: every
  menu and panel button took a mask icon on 2026-08-25 and 08-30 — see Done. The
  licensing question below is the only thing left blocking release.)*

  **Wiring is done and proven.** `tools/prep-icons.js` regenerates `img/icons/` from the
  upstream artwork (54 files at first wiring, 206K → 38K — 78 now, as redraws and new
  drawings keep landing upstream: the source files are ~85% Inkscape metadata,
  RDF and attribution blocks that a mask never reads). An `extra/` subdirectory of the
  source holds what is not part of the set proper — redraws under a name already in it,
  and the odd one-off under a name of its own — and the tool converts those last so a
  redraw wins; copying one in by hand would be undone by the next regeneration.
  `$.glue.icon(name, title)` in `js/glue.js` builds a button from a file in there by
  plain name. Adding an icon is a drop-in: put the file upstream, re-run the tool, call
  `$.glue.icon('thing')`.

  The icons are **one colour plus transparency, and that colour is white** — invisible on
  this editor's light chrome. So they are applied as a CSS `mask-image` with the visible
  colour coming from `.glue-btn-icon` in `css/edit.css`, which is also what buys
  hover/on/off states. An `<img src=…>` could not do either. Buttons stay `<div>`s.

  The mask sits on `.glue-btn-icon::before`, not on the button, because a mask clips the
  element it is set on — border and background included — and the button needs both: the
  PNGs carry a frame in their artwork, and without one the line art dissolves into
  whatever object is underneath (a magenta background, a photo). So the button draws a
  1px black border and an 85%-opaque white fill — the set is one dark colour with no
  highlights of its own, so it wants maximum contrast behind it — and
  `::before` carries the glyph and its hover colour. `--glue-icon` still lives on the
  button and inherits down, so swapping artwork at runtime is unaffected.

  Wired now — the whole object and text chrome, all on `$.glue.icon(name, title)`: the
  clone sheep (the set's one joke: everyone knows what a cloned sheep is, and the
  alternative is the two overlapping rectangles every toolbar has — a silhouette rather
  than line work, which turns to mush at 30px; `sheep-icon5` since its artwork grew a
  real eyelid — it blinks, see Done), `undo`, `redo`, `delete`, the padlock `lock`, the
  broken-link `object-link` and code-brackets `object-props`, `hyperlink`, `font-size`
  (the Font panel), `padding`, `background-color-remove` (make background transparent),
  `super-user` (the `</>` source toggle), `border-radius1` (the object's edge panel),
  `clip` (state shown by the pressed-in frame), `page-background-image` (both background
  buttons), `change-layer` (the adjustments fold's button) with its `flip-h`/`flip-v`
  and `layer-top`/`layer-up`/`layer-down`/`layer-bottom`, the four `font-style-*` on the
  run-format strip, the four `align-*` inside the font panel's fold (still mapped by
  what the artwork shows — two names are swapped at source), `download`/`upload` (the
  solid arrows, redrawn upstream in the `extra/` folder), `text-object`,
  `embed-webpage`, `embed-webvideo` and `site-code` on the new-object menu,
  `site-settings`, `page-title`, `page-new` and `shared-w-other-pages` in the
  page-browser chrome, and the layout toggle via
  `composition-mode-absolute`/`-centered` — that last one shows the mode you are
  switching TO, preserving the old split where the tooltip describes the present and the
  button names the destination. Every colour button in every panel shares one glyph,
  `color-swatch` (which succeeded `color-quadrant`); the change-background-colour
  buttons are colour buttons and share it too, and only the make-transparent action
  keeps a glyph of its own.

  Judge new artwork by rendering its ALPHA at 30px, which is what a mask paints: the
  colour in the file never reaches the screen, so a black drawing and a white one look
  identical in the toolbar and completely different in a file browser. That is also how
  an intermediate save containing an embedded PNG was caught masking as a solid black
  square.

  The last placeholder is gone: the clip toggle took the set's `clip` glyph on
  2026-08-25, and its state is the button's pressed-in frame — the same state language
  every toggle in the chrome speaks by now. That is also the answer to the design
  question the placeholder kept raising: a state shown by the frame needs no second
  glyph, so nothing ever had to change an element's `--glue-icon` after construction.
  No text-label buttons are left; the two `<img>` PNG buttons that survive are the
  iframe module's change-URL and the video module's reset-size, named in the open
  decision below.

  **Unresolved: licensing.** The upstream files declare CC BY-NC-SA 3.0
  (`cc:prohibits CommercialUse`), credited to VERBALVISU.AL / SuperGlue project. Hotglue
  is GPLv3, which does not permit adding a non-commercial restriction to a distributed
  work, so this has to be settled before release — presumably by relicensing the set,
  which needs whoever holds the rights (the credit names both VERBALVISU.AL as author and
  the SuperGlue project as publisher). `tools/prep-icons.js` strips the per-file
  attribution blocks, so if attribution turns out to be required it needs to live in one
  NOTICE file rather than 78 copies.

  **Two names are swapped at source:** `align-left.svg` draws lines centred on a common
  axis and `align-center.svg` draws them flush against a left margin rule. The spacing
  popover maps them by what they depict, with a comment saying so — worth fixing in the
  upstream set, after which that table can be straightened out.

  **Open decision:** what is left in PNG is two-state artwork pairs (scroll on/off,
  autoplay on/off, …), small runtime pictures, two `<img>` menu buttons no set member
  fits yet (the iframe module's change-URL, the video module's reset-size), and fifteen
  unreferenced PNGs: the ones restored on 2026-08-30, which that afternoon's conversion
  orphaned again (nothing in the tree loads them), so the second sweep can happen
  whenever it is wanted. Whether the two-state pairs and the last two buttons ever
  convert to the set is the remaining call: mask buttons show one state with their
  pressed-in frame, and the set carries no on/off pairs, so each would want a redraw
  first. Mixing PNG and SVG shows seams at high zoom and on HiDPI — the chrome that
  matters has stopped mixing.

  **Landmine, hit once already:** a relative `url()` inside a custom property resolves
  against the stylesheet that uses the `var()`, not the document — so `img/icons/x.svg`
  set on an element was fetched from `/css/img/icons/x.svg` (because `css/edit.css` is
  where the `var()` is consumed), 404'd, and every icon vanished. A mask that fails to
  load masks *everything* out, so the buttons painted nothing at all: correct size,
  correct position, still clickable, `toBeVisible()` still true, just no pixels. Nothing
  logged an error. `$.glue.icon()` now resolves against `document.baseURI` before setting
  the property.

  `tests/e2e/icons.spec.js` guards that: it reads the mask URL as the browser resolved it
  (not the raw property, which looked perfectly fine while broken), fetches it, and A/B's
  the button against a deliberately broken icon to prove the mask paints. Plus a check
  that the generated files are well-formed and stripped.
- **Parametric entry, wherever a control has a number behind it** — *(not for now; noted
  so the shape is agreed before controls get built one at a time.)* Every direct-
  manipulation control in the editor is a gesture with an exact value underneath it, and
  the value is currently unreachable: you can drag an object to roughly 300px, but not
  type 300. The proposal is one consistent affordance — a marked corner on the button or
  handle, which opens a small entry UI for the number itself. Candidates: size,
  position, rotation, z-index/layering, exact colour values, font size, and more as they
  turn up.

  Worth doing once, as a pattern, rather than six times as six dialogs: the marker, the
  panel and the commit/cancel behaviour should be the same wherever it appears, or it
  stops reading as a single affordance. Note the pieces that already exist and should be
  folded in rather than duplicated — `$.glue.popover.number_row()` is now this idea for
  three controls (a slider paired with a field that is not capped by it), the colour
  picker's hex field is it for a colour, the Object Properties dialog already edits some
  values as text, and `$.glue.rangeslider` is the drag half of the same problem. What is
  left is the controls that have no panel to put a field in — position, size, z-index —
  which is where the marked corner comes in. If the contextual per-object toolbar above
  is ever picked up, this belongs inside it.
- **Local JS build** — partly addressed and deliberately stopped short. `tools/make-min.js`
  now generates a `.min.js` copy by stripping whole-line comments, and
  `tests/e2e/min-files.spec.js` fails when a copy falls behind its source, so the
  source↔min sync problem is solved. A real terser build is still open, but is only worth
  it if the remaining bytes matter: every other JS file is editor-only, so the one file
  on the visitor path is already handled. Note the pairs are NOT uniform — some are
  byte-identical copies, one drops its licence header, one is genuinely minified, and
  the new one is comment-stripped. Any build must cope with that or normalise it
  deliberately.

---

## Smaller items / "someday" list

Features and niceties not yet spec'd — the running to-do:

- **"Fit to screen" opt-in (page or site setting)** — let a page/site OPT IN to
  scaling narrow / old-1024×768 pages up to fill the viewport on large (e.g. 4K)
  displays. Explicitly opt-in, NOT automatic: auto-zoom on desktop is intrusive
  (overrides the user's own browser zoom, can upscale-blur bitmaps, behaves anomalously
  vs the rest of the web). As a page/site-author choice it's defensible (author knows
  if their design upscales well). Related: the centered layout already makes narrow
  pages look intentional (framed) rather than broken on wide screens — that may scratch
  most of this itch without zooming. So: build only if centering isn't enough; keep it
  author-opt-in.
- **Per-object inline CSS** — extend the object-properties class feature with scoped
  inline CSS (auto-scoped to the object). Safe to run live in the editor (CSS can't
  break editor logic). Deferred from the object-properties SOW.
- **Copy objects between pages** — copying a *page* is already done and always was:
  `glue.copy_page` (`module_glue.inc.php:857`), reachable from the page browser
  (`modules/page_browser/page_browser.js:68`). Objects are the missing half —
  `glue.clone_object` derives its target page from the source object's own name, so it
  can only ever clone within one page.
- **Adopt the range slider for the remaining drag controls.** `$.glue.rangeslider`
  (`js/edit.js`) draws a visible bar next to a menu button while it is dragged, in the
  toolbar's own frame — the readout Superglue's editor has. It was built for rotation,
  which then went to direct manipulation instead, so **nothing drives it yet** (its
  `attach` was converted to pointer events with the rest, so a drag works on touch too,
  but nothing calls it): the candidates are the buttons that already change a number by
  being dragged invisibly — transparency and border width
  (`modules/object/object-edit.js`), font size, line height and letter spacing
  (`modules/text/text-edit.js`), page background position (`modules/page/page-edit.js`).
  It is covered by `tests/e2e/rangeslider.spec.js` in both orientations, so adopting it
  is a call, not a build. If nothing adopts it, delete it.
- **Editing on a phone, beyond the first tap** — danja, 2026-08-24. *(The tap itself
  now works: see the Done entry. What is left is whether the rest is usable.)*

  **Checked on a real phone** (Galaxy S23, Chrome, over ADB) on 2026-08-24: tap selects,
  a second tap opens the keyboard and edits the text, typing saves to disk, a finger
  drags an object without the page scrolling, and the panels open and are usable. Two
  things only the device showed, both since fixed: panels were placed by the LAYOUT
  viewport and landed under the on-screen keyboard (274x500 layout against 274x308
  visual with the keyboard up), and a drag no longer selected what it dragged, because
  the click that used to do that is now suppressed.

  Known to be missing, from reading the code rather than guessing:

  - **Nine controls can only be dragged with a mouse.** — *Done, see the Done entry:
    `$.glue.slider` and its triggers now speak pointer events, so the same gestures
    work for mouse and finger.* The parametric-entry item above is still the design
    question — a phone has no way to type a number in a drag — but the drags themselves
    are no longer the block.
  - **Tooltips are the only label** most buttons have, and `title=` does not exist on
    touch. That got worse when the icons replaced text placeholders, not better.
  - **Double-tap is taken.** Text editing is a second click, which works, but the
    browser also wants that gesture for zoom.
  - **The menu runs off the screen.** The top row is laid out left to right from the
    object's corner and does not wrap, so on a 274px viewport two of its buttons were
    past the right edge with only five modules loaded.
  - **The canvas is wider than the phone**, and the editor has no equivalent of the
    guided view's fit-and-reveal — it is deliberately kept out of the editor
    (`common.inc.php`). Whether editing should happen inside a scaled view, or at 1:1
    with panning, is the open design question: the first needs Moveable to understand a
    transform, the second needs a lot of scrolling.
- **New uploader / better upload handling** — client-side resize/transcode before
  upload, which cuts media bloat at source rather than after it lands.
- **Link target auto-select** — `_blank` for external links, `_self` for internal ones,
  chosen automatically in the link dialog. Explicitly out of scope when that dialog was
  built; the natural extension of it. Note a target can already be set BY HAND, but only
  on the old object-link prompt (`modules/object/object-edit.js:462`, typed after the URL
  and a space); the text link dialog has no target field at all, so this wants deciding
  once for both. (Favicon upload and relative internal links, which shared this bullet on
  the old todo list, are both done.)

The three below were each re-checked in the code on 2026-08-23 and are **open**, with
where to look, because all three have a shipped near-neighbour that makes them look done:

- **Centered mode: a content-derived default width.** Switching an existing page to
  centered puts most of its content outside the default container until the handles are
  dragged out — on `content/start`, 4 of 7 objects. A default from the content bounding
  box would be kinder than a fixed number. Open: `page_set_layout()`
  (`module_page.inc.php:463`) writes `page-layout-mode` and nothing else, the toggle
  (`modules/page/page-edit.js:92`) posts no width, and the render path starts from a flat
  `PAGE_DEFAULT_CONTAINER_WIDTH` of 960 (`module_page.inc.php:269`). Nothing anywhere
  reads object coordinates. What *did* ship is the neighbouring decision — content too
  wide overflows rather than clips, and `centered-layout.spec.js` holds it there.
- **Mobile guided view × centered mode.** It activates and nests correctly, but in
  centered mode the container width is the natural "page width" for the fit and the
  mobile code does not know about it. Open: `js/mobile-guided.js` names neither the
  container, the layout mode nor `page-container-width`, and still fits to the min/max
  bounding box of `.object` (around line 149). What *did* ship is the similar-sounding
  "lands on content rather than on empty canvas", which was about negative origins.
- **Firefox on Android** — the desktop suite covers Gecko, but the pinch floor and touch
  gestures can only be checked on a device, and `tests/e2e/android-check.js` drives
  Chrome only (it requires `chromium` and speaks CDP to a browser already running on the
  phone). Playwright cannot drive Firefox on Android, so this stays manual. What *did*
  ship is Gecko coverage on the desktop suite, which is not the same claim.



---
