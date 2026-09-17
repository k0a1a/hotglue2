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
Checked against the tree on 2026-09-14.

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
- **SOW-copy-paste-objects.md** — `glue.get_object` / `glue.paste_object` plus
  `$.glue.clipboard`, built 2026-09-14. Its "Where the brief met the code" section is the
  part worth reading: the z-order the brief asked for became the editor's own `to_top`,
  and a symlinked object turned out to have to be copied as its target — assets and all —
  or the paste would look in the linking page for files that were never there.

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

Shipped 2026-09-14 — copy/paste objects, the page-copy feature's missing half
(`SOW-copy-paste-objects.md`, now a record of what was built):

- **Copy an object, change page, paste it.** Ctrl+C / Ctrl+V, a copy button in the object
  context menu's top row (the icons already existed), and a paste button in the single-click
  menu that shows itself only when there is something to paste. The clipboard is one
  localStorage snapshot of the object **as it is stored** — attributes and content, not
  the DOM — which is what makes the copy complete by construction: the attributes nothing
  in the editor displays have nowhere to get lost. It expires an hour after it was last
  used, and pasting puts the hour back; a paste never consumes it, so one object pastes as
  often as you like.
- **Two services do the file work**, in `module_glue.inc.php`: `glue.get_object` (resolves
  a symlink to its target, splits the stored object into attrs + content) and
  `glue.paste_object` (validates the target page, copies the referenced per-page assets,
  writes the object under a fresh id, appends it to the page's stored reading order,
  renders it back). Fonts are never copied — they are site-wide and already resolve — and
  the asset list is the one the modules' own `has_reference` hooks define.
- **A symlinked object is copied as what it points at**, assets and all: the resolution in
  `get_object` means the paste draws from the *target* page's `shared/`, which is where a
  naive copy would have looked in the wrong place entirely.
- **"On top" is the editor's own `to_top`** (above what it intersects, 0–199 band), not
  `max+1` — danja's call, so a paste stays inside the band the rest of the stack lives in.
  Same-page paste overlays the original exactly, as the SOW asks; clone still offsets by a
  grid cell, and the two coexist.
- **One defect found on the way, in the editor's own chrome**: `.glue-menu-enabled`'s green
  can never paint on a `.glue-btn-icon` — both are one class and the icon frame's rule
  comes later in `css/edit.css`, so any icon button that tried it was silently unlit (only
  the older PNG-background toggles ever worked). Noted on the rule rather than worked
  around: the copy button marks a full clipboard with a 2px dot in its corner and says so in
  its tooltip (`copy object [previous data present]`), because the editor's green claims a
  state of the object whose menu it is in and the clipboard is one slot for the whole
  editor.
- Covered by `tests/e2e/copy-paste.spec.js`, which asserts against the page directory as
  well as the DOM — including collision renaming, a source asset deleted between copy and
  paste, the untouched font registry, and a hand-written clipboard trying to walk asset
  names out of the page's `shared/`.

Shipped 2026-09-14 — the background image is moved by grabbing the object itself:

- **The background panel's move pad became the panel itself.** The pad was a small square
  in the panel you dragged to slide the image behind the object; danja asked for the gesture
  to be over the element, and it now is: **opening the panel hands the object's own drag to
  the background**, so you grab the object and the image slides under it — which is the only
  way to judge a picture against the thing it sits behind. While it is open the object
  cannot be moved or resized; that is the trade, and the reason to close the panel when you
  are done moving the background.
- **Two `x` and `y` rows are the same position by hand** — the house slider-plus-field rows,
  following the drag live, so dragging is how you find the position and typing is how you
  fix it. The slider's ends are a drag length rather than a limit (the field keeps the real
  number, and gets the extra width a sign needs); x 0 y 0 is the corner and is not written,
  absent meaning it as everywhere else in that panel. The pad's
  click-with-no-drag-puts-it-back is deliberately not carried over — a stray click on the
  object quietly wiping the position is a trap, and the footer's reset still does it.
  *(The page background kept its own pad for a day — a page has nothing behind it to grab;
  it took the same two rows on 2026-09-15, see below.)*
- **Two small generic pieces in `$.glue.popover`**, both used only by that panel: an
  `on_close` hook on the panel (every way a panel goes away comes through `close()`, so
  that is the one place the panel is told to put back what it took — Escape, a click
  outside, deselect, another panel opening), and `.keep_open_target`, an element the
  outside-click close treats as part of the panel. The second is needed because the
  pointerup that ends a drag on the object still sends a click, which would otherwise close
  the panel after every single drag. The arm saves the Moveable `draggable`/`resizable` and
  puts them back rather than setting a fixed true, so a **locked** object stays locked
  (lock.js's own state survives for free).
- **The object's clicks are swallowed while the panel is open** (capture phase,
  `stopPropagation` + `preventDefault`): cancelling pointerdown does not stop the click that
  follows it, and without this the drag would end in a text object starting to edit, or in a
  plain click selecting. Right-clicks are left alone so the context menu still opens.

Shipped 2026-09-15 — the pointer says what can be dragged:

- **Objects carry the move cursor in the editor, content included** (`css/edit.css`; that
  file is the editor's alone, so published pages are untouched). The rule reaches into the
  descendants deliberately: `cursor` inherits, but a child that declares its own keeps it,
  and the two that do are exactly the ones that lie here — a **link**, whose hand says
  "this goes somewhere" when in the editor clicking one does nothing at all, and a **text
  object's own surface**, whose I-beam says "this selects text" when a drag from it moves
  the object. Same cursor as the page background's pad, which is the editor's own use of
  "drag this".
- **`.locked` objects take it back** (`cursor: default`) — they cannot be dragged, and the
  pointer no longer promises they can. While a text object is **edited** the I-beam returns
  (`glue-text-editing`): that is where the caret is, and inside the contenteditable a link
  really is what is under the pointer. The three rules are ordered so the more specific
  state wins without `!important`.

Shipped 2026-09-15 — the page background's panel is the object's panel:

- **The page's move pad is gone, and the two `x`/`y` rows took its place** — same labels,
  same range, same arithmetic as the object panel's, so the two panels are now the same
  panel wherever it makes sense for them to be. Only the thing underneath differs: the
  page writes `background-position` on `document.documentElement` and the
  `page-background-image-position` attr on the page object, the object writes its own
  style and the attr on itself.
- **The page has no grab gesture, deliberately.** A page has nothing behind it to grab —
  a drag out on the empty canvas belongs to the objects and the page's own single-click
  menu — so the by-hand pair IS the page's whole move control. (The object panel's mode
  works because the object is a thing with an edge you can see the image against; on the
  page, the thing you are judging against is the whole viewport, which is already in front
  of you.)
- **The reset syncs the panel, not just the page**: the rows come back to the corner, the
  tile toggle re-reads (the page's default IS repeat, so it lights) and the scale field
  returns to 100 — the object panel's reset already did all three, and the page's only did
  the first implicitly. `glue-background-scale` names the scale row now that the panel has
  three number fields, the way `glue-background-repeat` names the tile toggle.
- `tests/e2e/object-background.spec.js` was brought back in line with the 09-14 change it
  had gone stale against (it still looked for the object panel's pad): it drags the object
  and asserts the object did not move, that a plain click does *not* put the image back,
  and that closing the panel hands the object's own drag over again. There is still no
  page-background spec — the page's panel is untested.

Shipped 2026-09-16 — the background panel becomes the background, on the page and then on
the object (danja's drawings, `img/icons/background-scroll.svg`, `tile.svg`,
`background-color.svg` — worn for a day, see the colour-button bullet — `background-image.svg`
and `background-set.svg`):

- **"Background scrolls" left the page menu for the page background panel**, as a `scroll`
  row next to `tile`, and it is a toggle: on (the default) means the image scrolls with
  the page, off means it is `fixed`. It is the page's alone by nature — an object and its
  background move together, so there is nothing for such a control to say about one.
- **The state needs no second glyph.** The two-state pair that was there
  (`page-background-scroll-on.png` / `-off.png`, deleted with the button) became one
  drawing plus the pressed-in frame (`glue-btn-active`) — the state language the flip,
  clip and format toggles already speak. That is the open decision in the icon section
  below answered for this pair: yes, a PNG on/off pair can convert, and it converts to one
  glyph whose frame carries the state.
- **On writes no attribute at all.** `page-background-attachment: fixed` is the whole of
  what the toggle stores; going back to on empties the inline style and drops the attr,
  since `background-attachment: scroll` is the CSS default and absent means default here
  as it does for every other row in that panel.
- **Sized like the panel's other controls** (26px against the toolbar's 32): the box is
  set inline where the toggle is built, and `.glue-background-scroll` brings the artwork
  down to 22px — the same trick, in the same place in `css/edit.css`, as
  `.glue-popover-color`. `#glue-menu-page-background-scroll` and the two PNGs are gone
  from `modules/page/`, so the PNG inventory below is one pair shorter. (The page's own
  controls have since gone back up to the toolbar's 32 — the last bullets here.)
- **Then the tile toggle took `tile.svg`, in both background panels**, in that same shape:
  one drawing, state in the frame, tooltip naming the state. Those two were the other kind
  of conversion the set makes — a *drawn* glyph for a *typed* one: they were white squares
  wearing the text glyph `▦` in `.glue-font-toggle`, so they were the set's unfinished
  business rather than the PNG sweep's. `▦` survives in the two toggles this did not touch
  (the grid panel's show and the image panel's decorative), and each tile toggle is now an
  icon button whose state `object-background.spec.js` asserts on. (The object panel's copy
  of that class was `glue-background-repeat` until the end of the day, when its row was
  rebuilt and it took `glue-background-tile` — see the last bullets.)
- **Then what the background IS moved in as well, and the page menu's background button
  became a plain opener.** The panel's first row gained two buttons: one opens the picker
  (`background-color`), one is a file picker (`background-image`, via
  `$.glue.upload.button()`), and the menu button that used to *be* the upload whenever the
  page had no background now only opens the panel — so it opens whether or not there is a
  background, which a page with none needs in order to get one. It is called "page
  background" rather than "background image" for the same reason: it opens the background
  whole, picture and colour. The page menu's own colour button went with it (danja's call:
  moved, not duplicated), and its shift-click "type a colour instead" went with that — the
  picker is the one way in now.
- **The colour button clears the picture first, as it always has**, confirm and all,
  because a colour sits *behind* an opaque picture: picking one with a picture up looks
  like nothing happened. It is the one colour button in the editor that is not
  `$.glue.popover.color_button()` — the shared one sets the colour of a thing that is
  there, and this one replaces what the background is, and it can be cancelled before the
  picker opens, which a `current()` callback cannot express. It briefly wore a glyph of its
  own (`background-color`) to say so; it took the shared `color-swatch` back the same day
  (danja's call, end of 09-16 — a colour button is a colour button, and the difference is
  in what the click does, which the tooltip says, not in the drawing). That
  clear *and* the panel's own remove button now share one `page_bg_clear()` — dropping the
  picture is the same act whether you asked for it or asked for a colour in its place, and
  the old colour button left the repeat/position/size attrs behind when it cleared, which
  this does not.
- **The panel opens on a page with no background now**, where the menu button would not
  have opened it before. The tiling, scroll, position and scale rows are therefore
  reachable with nothing to apply them to; they are not wrong (they write what the next
  picture will obey) but they are ahead of themselves.
- **Then the row became a toolbar of four, at the size the icons are drawn.** Danja's call:
  one unlabelled row holding the colour, the picture and both toggles, on the toolbar's own
  32px box rather than the panel's 26 — which is `$.glue.icon()`'s default, so the box's 1px
  border leaves the 30x30 padding box `.glue-btn-icon::before` draws its 30px artwork
  against, and there is nothing to override. `.glue-background-btn` marks the four (it does
  no more than stop the flex row shrinking them). The `tile` and `scroll` labels came off
  with the size change — they were there to fill the panel's label column, and a toolbar
  needs no labelling — and the tooltips now name the four actions ("set page background
  color", "set page background image", "tile page background image", "scroll page
  background image"), which means the two toggles lost the state-naming tooltips they had
  had for a day.
- **And the two toggles grey out when the page has no picture.** With none under them,
  tiling and scrolling describe a background that is not there, so `.glue-background-off`
  (opacity, and `pointer-events: none` with it — a control that cannot act should not take
  the cursor or light its frame on hover) sits on both until an image arrives. That is the
  question the bullet above left open, answered: not hidden, greyed. `sync_has()` reads
  `page_bg_has()` when the panel opens, and the upload's `finish` calls it again, so a
  picture dropped in while the panel is open wakes them where they stand.
- **`.glue-background-repeat` stayed the object panel's own.** One class was on both
  panels' tile toggles, so the page's would have dragged the object's 26px/22px sizing up
  with it had the page's kept the name. It did not: the page's four go by
  `.glue-background-btn` plus one class each (`glue-background-color`, `-image`, `-tile`,
  `-scroll`). *(Later the same day the object panel's row followed the page's onto the
  toolbar size, took `.glue-background-btn` and `glue-background-tile` itself, and the
  22px mask rule went out of `css/edit.css` — the question this bullet left open is
  answered, see the last bullets.)*
- **And the page menu's button took a drawing of its own** (`background-set`, danja's):
  a frame with one corner filled, where `page-background-image` had been. Prep note: the
  file arrived as `background_set.svg`, and `tools/prep-icons.js` hyphenates underscores
  (`icon_font_size.svg` → `font-size.svg`), so it lives in `img/icons/` as
  `background-set.svg` — the name a regeneration would produce anyway.
- **Then the object's button followed it, and the panel behind it became the background.**
  Danja's call: the object panel gets the page's panel minus the scroll toggle, its menu
  button takes `background-set` too, and it moves to the **left-most** position in the top
  row (`object-background` at prio 0, ahead of the text items' 1–5 and the adjustments'
  7 — *the text items are 1–3 as of the bullet below: their own two background buttons
  went with them*). `page-background-image` is what all that leaves behind: nothing in the tree
  references it any more, and it stays in `img/icons/` for danja to keep or drop.
- **Its two-state menu button went the way the page's went**, for the same reason as the
  page's: with no image the button *was* the file input, and only an object that already
  had a picture got a panel. The panel can set the picture itself, so the button has
  nothing left to do but open it — and it opens whether or not there is a background,
  since an object with none needs somewhere to get one. The upload is one of the panel's
  buttons now, so it is reachable on an object that has no background, and the panel stays
  open through it: what you do next — tiling, sizing, moving — is all in there.
- **The panel's first row is the page's, one button shorter**: the colour, the picture and
  the tile toggle, unlabelled, at `$.glue.icon()`'s own 32px box, sharing
  `.glue-background-btn` and greying the tile toggle through `.glue-background-off` when
  there is no picture — the page panel's classes throughout, since the two panels now
  behave identically here. The tile toggle lost its `tile` label with the size, and the
  three are named in their tooltips ("set object background color", "set object background
  image", "tile object background image").
- **The colour button moved in with the rest** — the same one the page's panel has, the
  clear-first confirm and all — which raised the question of where an object's colour is
  *kept*. Text objects have kept theirs in `text-background-color` since long before there
  was a panel (the text module writes and renders it itself), but nothing kept it for any
  other kind of object: a colour picked on an image or an iframe would have lived in the
  editor's DOM and nowhere else, and been gone on the next load. So
  `object_alter_save()`/`object_alter_render_early()` gained `object-background-color`,
  guarded with `elem_has_class($elem, 'text')` on both sides so text objects keep the
  attribute they have always had and an untouched object file stays byte-identical.
- **The panel arms the drag only when there is a picture to move.** Opening the panel hands
  the object's own drag over to `background-position` — that is the panel's move mode — and
  an object with no background has nothing for a drag to move, so arming it there would
  swallow the object's drag silently. `arm()` is now called on open only
  `if (object_has_background(obj))`, and from the upload's `finish` when a picture arrives
  while the panel is open.
- **`tests/e2e/object-background.spec.js` again.** The behaviour it pinned is gone, so the
  tests that pinned it changed with it: the upload now goes through the panel's own
  `.glue-background-image input[type=file]`, the tile toggle is `.glue-background-tile`,
  the top-row order test now asserts the background button leads the row, and the old
  "with no image the button is the picker" test asserts what replaced it (the panel opens,
  the picker is in it, the toggle is greyed, and the object keeps its own drag). Two colour
  tests are new: one for a text object, which must still store `text-background-color`, and
  one for a non-text object, which must store the new `object-background-color` and read it
  back through a reload. (That second one used an image object for a few hours; the veto
  below took the button off that class, so its object is an iframe now.)
- **A wrinkle the colour button inherits, noticed while writing its test.** An image object
  rendered with `image-file-width`/`-height` paints its picture as a `background-image` on
  the object *itself* (`module_image.inc.php`), and `object_has_background()` — "the object
  has an inline background-image", the object's reading of the page's `page_bg_has()` —
  cannot tell that picture from a background the panel put there. So on such an object the
  colour button asks whether to clear "the current background image" and, yes, blanks the
  module's own picture in the editor until the next load; the tile toggle and the armed
  drag write `background-repeat`/`-position`, which `image_alter_save()` reads back as
  `image-background-repeat`/`-position`. None of it is new — the panel's delete button has
  done the same since the panel existed — and none of it is stored wrongly; it was undecided
  rather than broken: whether the panel owns "the object's background" or only "the
  background the object module did not paint" was a call nobody had made. Danja made it the
  same day; see the next bullet.
- **An image object has no background button — danja's call on the wrinkle.** *"Remove
  'object background' UI icon from image object menu."* So the answer is the second reading:
  "an object's background" means, on every kind of object, the background the module did not
  paint. `modules/image/image-edit.js` vetoes the item for the class, as it already vetoed
  `object-link`; the veto runs at menu build time and splices the name out of both columns,
  so the button is gone from an image object's menu
  whatever its size, sized (picture on the object's background-image) or unsized (picture in
  an `<img>`, where the panel would have worked but only until something resized the
  object). The panel and the image module were never going to share `background-image`
  politely — "has a background" *is* that property — and the module is the one that knows
  what its painting means, so the panel is the one that leaves.
- **What the veto leaves orphaned.** `image-background-repeat` and
  `image-background-position` keep their reader and their renderer
  (`image_alter_save()`, `module_image.inc.php`) but lose their last writer: they were the
  context menu's tiling and position buttons, which went when the panel took them over, and
  the panel now keeps out of an image object. A picture drawn at exactly the object's size
  has nothing to tile and nowhere to be positioned, so nothing visible is lost. Written
  down rather than settled, though: tiling an image object would be a request to the image
  module's own panel, not to this one.
- **And a third test pins it** (`tests/e2e/object-background.spec.js`): an image object's
  menu comes up with its own items in it and no background button, and the text object on
  the same page still gets one — an absence alone would also be what a button that failed
  to render at all looks like.
- **Then the text menu's own two background buttons went.** *"Remove
  'change backgroud color' and 'make background transparent' buttons from top menu
  (superseeded by 'objet background')"* — prio 1 and 2 of the top row, and the panel's one
  colour button covers both. It is the same picker onto `obj.style.backgroundColor`, which
  `text_alter_save()` stores as `text-background-color` — exactly what the first button set —
  and "transparent" is that picker's alpha row taken to 0%: `to_css()` keeps the keyword
  rather than writing `rgba()` zeroes, so what lands on the object is the same string the
  second button wrote outright, and `object-edit.js` already reads that keyword as "cleared"
  for the glow and shadow colours. The pair's only other machinery was setting the
  `.glue-text-input` textarea's background alongside the object's own, an old Chrome
  workaround; the textarea is `background: inherit` now, so the object's colour is enough.
  The first button's shift-click `prompt()` for typing a colour as CSS rather than hex goes
  with them — the picker's hex field is the typed path. The remaining text items renumbered
  to 1–3 (font, padding, source) so the row reads as one sequence again.
- **`background-color-remove.svg` loses its last wearer**, the third drawing to go quiet in
  as many days: the make-transparent button was its only one. It stays in `img/icons/` like
  the other two, and it ends the exception the icon inventory carried — "only the
  make-transparent action keeps a glyph of its own" — there being no make-transparent action
  left for a glyph to belong to.
- **Two specs opened the picker through the text menu** and open it through the panel now:
  `colorpicker.spec.js` (its `openPicker()`, and the placement test's button lookup) and
  `blend.spec.js`. The picker is unchanged, only the address of its button — but both helpers
  had to learn that a panel is *toggled* by its menu button (`popover.open()` closes what it
  reopens) and is usually still standing from the previous open within one test.
- Not covered by a spec: the page background panel still has none — the same gap as before,
  and now the only one in either panel. Neither of the two buttons that went had a spec;
  what noticed was the pair of specs that reach the picker through them.
- **The rows that describe a picture grey out without one — danja's call.** *"In 'object
  background' popout x, y, scale sliders should be grayed out unless background image in
  set."* The tile toggle had done this alone since the panel was built, on the reasoning the
  page panel's two toggles share (greyed and inert rather than hidden, `.glue-background-off`
  being opacity plus `pointer-events: none` — a control that cannot act should take neither
  the cursor nor a hover frame). Now the two position rows and the scale row wear the class
  with it, so nothing in the panel can be dragged, typed into or hovered into promising a
  move or a size for a background that is not there. `sync_has()` reads
  `object_has_background()` once and toggles all four, and it moved down the function to
  after the scale row — the last of the four to exist — so the one call that sets them stands
  after everything it sets. The upload's `finish` calls it as before, so a picture dropped in
  while the panel is open wakes all four where they stand; the two ways out of that state
  (the colour button's clear, the footer's delete) both close the panel, so there is no
  second waking to arrange. The armed drag was already conditional on a picture; this is the
  same condition made visible.
- **`css/edit.css`'s note on `.glue-background-off` was rewritten with it.** It spoke only of
  toggles ("a toggle with nothing to toggle"), and the class now covers three labelled number
  rows as well — where it also means the slider cannot be dragged and the field cannot be
  typed into, which is worth saying in the one place the state is defined.
- **The page panel's x, y and scale rows are the object's "to the letter" and still act on
  nothing.** That panel greys its two toggles alone, so it now differs from the object's in
  the one thing the two panels were built to share. Danja asked about the object panel and
  the page's is a separate call; the same three lines are there to write if it is wanted.
- **Both halves of it are pinned in `tests/e2e/object-background.spec.js`**: the no-image
  test counts four greyed controls — the tile toggle and the three rows — and the upload test
  counts none once a picture lands. The helper is one selector list of the four and a count
  of how many carry the class, so a renamed class fails it rather than passing vacuously.

Shipped 2026-09-16 — **the background panel becomes the object properties panel**, and three
controls move into it. Danja: *"move 'change padding' and 'flip vertically / horizontally'
and 'transparency' from under 'object adjustments' to 'object background' and rename it to
'object properties'."* Three answers given before any of it was written:

- **The z-level stays where it is, and keeps the name.** Asked whether "object adjustments"
  should go too, danja's answer was that it stays: it keeps its button, its tooltip and its
  four z buttons. What it loses is the flip and the transparency — so it is now one row, a
  reset, and nothing else, which is the honest size of what is left of it. The panel was
  three relations wearing one name; the two that were *properties* left, and the one that is
  a relation (where the object sits among its neighbours) stayed.
- **The padding rows are built for text objects only.** *"Only build for text."*
  `text-padding-x` / `text-padding-y` is the only padding hotglue stores
  (`module_text.inc.php`), so the section is the text module's to build even though the panel
  is every object's. An iframe object's panel has no padding section at all — not a greyed
  one, an absent one.
- **An image object gets the panel, minus its background section.** With the veto lifted, an
  image object would otherwise have lost the flip and the transparency too, since they would
  live in a panel it was kept out of. It does not, and it never sees the background section.

What that came to:

- **The panel is a list of sections now, and one panel function builds it.**
  `object_properties_popover()` calls four: `object_background_section()` (the old
  `object_background_popover()` with its own open/footer/show taken off it),
  `object_padding_section()`, `object_flip_section()` and `object_transparency_section()`.
  Each draws its own rows into the popover and hands back a `reset` for what it owns; the
  background's `remove` is the footer's delete button, since the picture is the only thing in
  here that can be taken off an object. The footer runs every reset in the order the sections
  were drawn and saves **once** — one write, and nothing left behind that the save happened
  before.
- **Absent, not greyed.** A section an object cannot have is not drawn at all. That is a
  different thing from `.glue-background-off`, which greys a control that is about something
  not there *yet* (a tile toggle with no picture); a property this kind of object does not
  have is not a control waiting for something to arrive.
- **Each reset clears only what is set**, so a reset on an object nobody has touched writes
  nothing new. The padding reset guards on the four sides being zero — it compensates the
  object's width and height, and an object nobody has padded must not be handed a width and
  height it never asked for. The flip reset guards on an axis actually being flipped, and the
  background reset on there being a picture. `object-background.spec.js` pins it: the file
  after the reset is the file before it, byte for byte.
- **The button is `object-properties`, titled "object properties", and it keeps
  `background-set`.** The icon is unchanged (danja's call): a filled square is what an
  object's properties panel looks like from here, and the button has not moved — still
  prio 0, left-most in the top row.
- **The modal became "object attributes".** It was "object properties: id, classes and custom
  attributes", and there cannot be two. The panel has the better claim to the name — what is
  under an object, and how it is flipped, is as much a property of it as the id is — and the
  modal is about the object as an element: what it is called, what classes it carries, what it
  points at, which is its attributes. So the button is `object attributes`, and the dialog it
  opens carries the same two words as its accessible name (`$.glue.modal.open`'s label is an
  `aria-label`; nothing renders it). `object-properties.spec.js` (which tests the modal, and
  keeps its name) looks the button up by its tooltip now.
- **`modules/image/image-edit.js` loses its `object-background` veto**, and the long comment
  explaining it became the comment explaining where the problem went instead: the panel omits
  the section for the class, which a veto could not do — a veto is per class and all or
  nothing, and it cannot tell a sized image object from an unsized one without the button
  coming and going with the object's size.
- **`text_padding_popover()` and its "change padding" button are gone from
  `modules/text/text-edit.js`**, which is what `SOW-text-controls-redesign.md` said to do
  with them ("It's the text's inset from the object's sides — a property of the
  object/container, not typography"). The remaining text items renumbered again: font 1,
  source 2 (it was 3), heading 11. The text menu's own controls are now font, source and
  heading — everything else it had was about the object rather than the type.
- **The two panels no longer share a class.** `glue-background-popover` was the object's
  panel *and* the page's (`page-edit.js`); the object's is `glue-properties-popover` now, so
  `css/edit.css`'s `width: 200px` rule is the page's alone and the object's has one of its
  own (230px — its labels are the longest any panel has, and a content-sized
  `.glue-popover-label` takes that width out of the slider beside it).
- **The move mode is untouched, and worth knowing about.** Opening the panel with a picture
  present still hands the object's own drag to `background-position` — that is the mode, and
  it now lasts as long as a panel with more reasons to be open. Nothing about it changed
  here; it is written down because the panel it belongs to got bigger around it.
- **Specs.** `object-adjust.spec.js` is the z panel's now: the flip and transparency tests
  moved to `object-background.spec.js` with the toggles, and it gained one for the reset that
  checks the z index is cleared *and* the flip and the opacity are not (they are no longer
  this panel's to clear). `object-background.spec.js` is the properties panel's spec and
  keeps its name — the background is still most of what it tests — and the image test is
  inverted: the class gets the button, and the absence is the section's. `text-padding.spec.js`
  drives the section in its new panel, naming its rows through `.glue-padding-row` (the panel
  has six number fields and a bare `.glue-popover-field` matches several); it gained a test
  that a non-text object's panel has no padding section and no fold. `rotate.spec.js`,
  `colorpicker.spec.js`, `blend.spec.js` and `touch-editing.spec.js` all reach their controls
  through the renamed button and class, and `touch-editing.spec.js`'s padding tests name their
  slider now — the panel has five, and `.first()` was landing on the x row.

Shipped 2026-09-16 — **"make the object a link" stops being a `prompt()`**. Danja: *"replace
'make object a link' (browser native) URL prompt with a prompt that looks like our other
popouts."* It was the last native dialog in the editor, and it was doing two jobs badly: the
address and the target went into one string separated by a space, and the only thing that said
so was the prompt's own help line. Editing an existing link meant reading it back out of that
string and reassembling it.

- **The panel is a `link` row, a folded `target` row, and a delete.** `object_link_popover()`
  in `modules/object/object-edit.js`, `$.glue.popover` parts throughout. The address is now a
  field you can read a url in — `glue-object-link-popover` is 330px wide (the widest panel,
  after the properties panel's 230) and its two fields take the row's remainder rather than a
  width, through `.glue-object-link-field`; the number field they share
  `.glue-popover-field` with is 44px on purpose and would have left them at that.
- **The fold names what it holds, which no other fold does.** Every other fold in the editor
  is "more knobs" — controls an object may never use. A target is *stored*: an object that has
  one must not have it invisible in a closed fold, so this one's label reads `target: _blank`
  and is rewritten as the value is committed, so it can never stand there naming a target that
  has since been changed or taken off. `fold()` owns the label, so the disclosure is read back
  for the arrow it has written — a listener registered second on the same element, running
  after fold's own.
- **Nothing is written until the field is committed** — Enter, or clicking away. Every other
  panel applies while it is being dragged; a url is typed, and half a url is not a value worth
  storing. Escape therefore drops what was typed since the last commit, the way Escape on the
  prompt dropped everything, and clicking away commits, because the field blurs before the
  outside click lands. An emptied address field takes the link off, and a target with no link
  to open is not stored. None of it is undoable either way: undo replays the DOM, and a link
  is never in the DOM — the renderer wraps the object in an `<a>` in viewing mode only
  (`module_object.inc.php:414`), and the panel is handed the object as loaded for that reason.
- **The button, its icon and its prio are unchanged**, and so is its veto for iframe and
  download objects. `glue.load_object` is still the round trip that gets the current link; the
  panel just replaces what the callback then did with it.
- **`tests/e2e/object-link.spec.js` is new** — the link action had no spec at all. Four tests:
  an object with no link gets one typed in, an existing link and target are shown whole and
  taking it off takes the target too, Escape discards where clicking away commits, and the
  renderer wraps the object in viewing mode and not in the editor. Two traps are written into
  it: `fill()` fires `change` and would commit before the test meant to, and `ctrl+a` is the
  editor's select-all-objects with a `preventDefault()`, so the field is emptied one Backspace
  at a time. **Not run** — the suite is danja's to run.

Shipped 2026-09-17 — **the icon-row popout: a panel's actions first, everything labelled under
"more knobs"**. Danja: *"There is a new concept for popouts like this one. On click we only
show actions represented by icons — in the case of 'object properties' those would be
'background color', 'background image', 'tile background', 'flip horizontal', 'flip
vertical'. Everything else — the sliders and input fields, as well as the reset button — are
tucked away under 'more knobs'."*

The shape was not new to the tree — the font panel has had it since the spacing redesign
(icon toggles, one fold holding the labelled controls **and its own reset**) — but nothing had
written it down and no other panel followed it. It is now the house style, stated once:

> A panel opens as one row of icon buttons — the verbs, at the panel's own 26px, named in
> their tooltips and nowhere else — and one fold labelled "more knobs" under it, holding
> everything that is a value rather than an act. Exactly one fold per panel. A panel with
> nothing to fold has an icon row and no fold, rather than an empty one.

- **Two parts in `$.glue.popover`, and the convention in a comment beside them.**
  `icon_row()` hands back the empty row (`.glue-popover-icons`) to fill and `icon_button(name,
  title)` is one action in it (`.glue-popover-icon`, which replaced `.glue-background-btn` on
  both panels — the class had one declaration and no behaviour, and its comment became the
  shared one). `fold()` itself is untouched, including its inability to open by default; what
  the panels needed was not a new mechanism but the same one in the same place every time.
- **And the row is the PANEL's 26px, not the toolbar's 32** — *"resize object properties popout
  button to 26x26px"*, later the same day, which reverses the 09-16 call that put that row on the
  toolbar's own box ("the size the icons are drawn at"). The icons are drawn at 30 and a panel
  control is 26, and a row of actions inside a panel is a panel control — which is what the
  colour buttons, the font panel's toggles and the align buttons have been all along, so the
  panels' rows were the one thing in them at the toolbar's size. `icon_button()` sets the box
  inline, because `$.glue.icon()` sizes its own at 32, and `.glue-popover-icon::before` brings
  the mask down to 22 — the same bring-down `.glue-popover-color` and `.glue-align-btn` do;
  without it the artwork is clipped by the box it is drawn in, which on a mask means it simply
  disappears. One helper, so both background panels and the adjust panel's four follow together
  and the twins stay twins.
- **And a panel is as wide as its content, not a number written in CSS** — *"minimize popout size
  by only making a popout as wide/tall as there is content."* Six panels pinned a width (object
  link 330, text link 330, edge 265, font 250, properties 230, page background 200) and the other
  five never had one; the six are gone. What a panel comes out at is its widest row, and for a
  panel with knobs that is now decided by ONE number: `.glue-popover-slider` is 80px, about what
  the longest labels ('padding', 'opacity') had left of the old 230 — and it is a fixed number on
  purpose, since a range input's own width is the browser's and Chrome and Firefox disagree about
  it by a third. Height was always the content's; the tall folds keep their 42vh cap.

  Two consequences worth knowing, both of them the point rather than side effects. A panel that
  opens on its icon row is now the width of that row — the properties panel's five buttons come
  out at 170px where 230 was pinned — **and it widens when the fold is opened**, because a
  `display: none` fold contributes nothing to layout and its rows are the widest thing in there.
  `fold()` already re-places the panel on every toggle for exactly this kind of reason, so it
  re-anchors rather than jumping. And the link panels are now as wide as a url field rather than
  as wide as someone once decided a url field should be.
- **And the panel wears the menu's own frame** — *"make popout element have 1px black border, no
  shadow, and 80% transparance of the backgound (trying to tie popout with the main menu
  elements)"*. Which is what `.glue-btn-icon` and the context menu items wear already: 1px of
  black over `rgba(255, 255, 255, 0.8)` — the panel had the colour picker's chrome until then
  (`#f2f2f2`, the hairline drawn as a 1px shadow spread, and a soft drop shadow). **Two things
  still wear that older chrome and were left**: the picker itself, which is vanilla-picker's own
  drawing and restyled in this file only where it has to be, and the text editing strip that
  docks to a text object while it is edited — not a popout, so not this call. Say the word and
  either follows.
- **Object properties is an icon row and one fold.** The row is the five danja named — set the
  colour, set the picture, tile it, flip horizontally, flip vertically — and the fold holds
  the background's x, y and scale, the padding, the transparency, then the delete and reset as
  its last row. **The flip pair swapped order with it** (the code drew vertical first; the
  concept names horizontal first), and the footer is gone entirely.
- **The padding's own "more knobs" fold is flattened into the panel's, and that is what the
  one-fold rule costs.** A panel may hold only one disclosure — `text-padding.spec.js` locates
  `.glue-popover-advanced` inside the panel without naming a section, so a second fold is a
  strict-mode failure — and two folds would be two ways to hide the same knob. The four sides
  were that fold's whole contents, so a bare row could reach one; sharing the fold with the
  background, the padding and the transparency, **each side now carries a class of its own**
  (`.glue-padding-top` / `-right` / `-bottom` / `-left`, order preserved).
- **The page's background panel is the same panel, one action shorter**: colour, picture, tile
  and scroll over a fold holding x, y, scale and the delete and reset.
- **Everything that reads a value keeps working while the fold is closed**, which is the point
  of the fold being `display`-only: `sync_has()` still greys the tile toggle and the three
  rows, the upload's `finish` still wakes them where they stand, and `arm()`'s move mode
  (opening the panel hands the object's drag to `background-position`) is unaffected. The fold
  is **not** opened by the upload: toggling it re-places the panel, so it would jump as the
  file dialog closes.
- **The known cost, written down rather than discovered**: "remove the background image" is
  destructive and now lives in a closed fold. The panel opens on what you came for and not on
  what you might; that is the trade, and it is the one thing to revisit if it bites.
- **`page-background.spec.js` is new** — the page's panel had **no spec at all**, which is the
  gap that made converting it the riskier half of this. Four tests: the four actions and the
  closed fold on a page with no picture, the fold's rows with one, the position and scale
  writing `page-background-image-position` / `-size` and surviving a reload, and the delete
  taking the picture off the page. `object-background.spec.js` gained the fold discipline (the
  delete, the reset, the scale field and the byte-identical reset all open it first — and that
  last one now reads the file with the fold already open, so "opening writes nothing" is part
  of what it proves) and one new test that the open fold does not put the panel over the
  object, which is the constraint `place_for()` exists for.
- **Then the font panel, twice in one day.** First: *"For 'font' button, show font selection,
  size controls, four style options + color and four align options. Everything else folded under
  'more knobs'."* — which took the four alignments out of the fold, where they had been since
  the spacing redesign, to sit under the style row at the 26px the style toggles wear. Then:
  *"show three font sizes [s 8px], [n 16px], [b 32px], then style and align as it is, move font
  selection and size slider + input under 'more knobs'."* — which is the panel as it stands:

  | | |
  |---|---|
  | shown | **s / n / b / x** (8, 16, 24, 32px), the four style toggles with the colour beside them, the four alignments |
  | folded | the face dropdown, the size slider and its field, the three spacings, the shadow and its colour, the note, the reset |

  The sizes are letters rather than drawings — there is no artwork for "8px" that reads at
  26px — and **each letter is set at the size it applies**, the same joke as the T wearing its own
  effect; the one in force is lit, and a size that is none of them leaves all of them unlit
  rather than rounding to the nearest. There were three (**s / n / b**, 8/16/32) until a fourth
  was asked for the same day — *"add [x 32px] font sie button to font"* — and b moved down to 24
  rather than x duplicating it: the row is a scale now, 8, 16, 24, 32, and what it called big is
  what it now calls extra. The buttons and the slider are two views of one number, so
  they share one writer (`set_size`, which holds line-height in step as the old drag control did
  and re-syncs the buttons) — the one place this panel was in danger of drifting. **And the
  `style` and `align` labels came off in a third pass the same day** — *"remove 'style' and
  'align' lables from font popout"* — which is the convention reached from the other end: the
  panel now shows three rows of buttons, each named in its tooltip and nowhere else, with no
  labelled rows among them and no exception left to write down.
  This panel is also where the convention came FROM — its fold has held the labelled controls
  and its own reset since the spacing redesign — so it is the one the house style was read off
  and the last to be converted to it.
- **The edge panel too, and it is the one where a control moved the other way.** *"For 'edges'
  button, show style and color, then 'round' and 'width' sliders. everything else under 'more
  knobs'."* So the panel shows the border's style dropdown with the colour button beside it,
  then the two numbers that act on them; and **the fade — a row of the panel since the panel
  existed — joins the glow and the drop shadow in the fold.** That is the first control this
  work has folded away rather than unfolded, and it is worth knowing the fade is there: it is
  the panel's own headline effect, and the reset at the fold's foot clears it with the rest.
  The rows are built in one order and appended in another now — the style row is built last —
  because the append order is the only thing that fixes what a panel looks like, which is worth
  saying out loud in a file where the build order reads like the display order. The panel's
  spec had `const ROUND = 0, FADE = 1, WIDTH = 2` for its fields, and now reads
  `ROUND = 0, WIDTH = 1, FADE = 2`: the field lookup is document order across the whole panel,
  so folding the fade moved it behind the two that stayed.
- **Which panels did NOT convert, and why** — the concept fits panels whose controls are
  actions, and there are more that aren't than that are:
  - **link** — the url field *is* the panel; its fold holds a stored target, which is the
    documented exception to the label rule.
  - **adjust / z-level** — four actions and a reset: it takes the shared row and button classes
    (four lines) and stays as it is, with no fold, because there is nothing to fold.
  - **image properties, heading, grid, page settings, reading order** — single fields, word
    buttons, or text-glyph toggles with no honest artwork in the set. Each is already at its
    minimum, and converting them would be churn with a glyph invented to justify it.

Two things noticed and deliberately not done: the disclosure is still a `div` with a click
listener and no keyboard path (pre-existing in every panel that has one — `SOW-accessibility.md`
is where that lives), and `img/icons/transparency.svg` stays unused, since transparency is a
slider and the concept puts sliders in the fold.

**Not run** — the suite is danja's to run. Suggested, with `colorpicker`, `blend` and `rotate`
on the list precisely because they should need no edits:

```
npx playwright test --config tests/e2e/playwright.config.js \
  object-background text-padding touch-editing page-background \
  text-font-popover text-spacing-popover object-shape colorpicker blend rotate min-files
```

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
  upstream artwork (54 files at first wiring, 206K → 38K — 87 now, as redraws and new
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
  (the Font panel), `padding`,
  `super-user` (the `</>` source toggle), `border-radius1` (the object's edge panel),
  `clip` (state shown by the pressed-in frame), `background-set` (both background
  buttons — the page's and the object's — danja's drawing, since 09-16),
  `tile` (the tile toggles in both background panels), `background-image`
  (the picture button, the upload, in both background panels),
  `change-layer` (the adjustments button) with its
  `layer-top`/`layer-up`/`layer-down`/`layer-bottom`, `flip-vertical`/`flip-horizontal` (the
  properties panel's two toggles — danja's redraw, in place of the set's `flip-v`/`flip-h`,
  09-16), the four `font-style-*` on the
  run-format strip, the four `align-*` inside the font panel's fold (still mapped by
  what the artwork shows — two names are swapped at source), `download`/`upload` (the
  solid arrows, redrawn upstream in the `extra/` folder), `text-object`,
  `embed-webpage`, `embed-webvideo` and `site-code` on the new-object menu,
  `site-settings`, `page-title`, `page-new` and `shared-w-other-pages` in the
  page-browser chrome, and the layout toggle via
  `composition-mode-absolute`/`-centered` — that last one shows the mode you are
  switching TO, preserving the old split where the tooltip describes the present and the
  button names the destination. Every colour button in every panel shares one glyph,
  `color-swatch` (which succeeded `color-quadrant`), and that is now every colour button
  without exception: the two background panels' took `background-color` for a day and gave
  it back on danja's call at the end of 09-16, since a colour button is a colour button
  whatever the click does with the colour. The make-transparent action, which alone kept a
  glyph of its own, went the next day with the button that wore it.

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

  **Open decision:** *(narrowed on 2026-09-16: the scroll pair converted — danja drew one
  glyph, `background-scroll.svg`, and the toggle's state is its pressed-in frame. So the
  answer to "would the pairs convert?" is yes, and the recipe is that one. The pairs that
  are left need the same redraw.)* What is left in PNG is two-state artwork pairs
  (autoplay on/off, loop on/off, …), small runtime pictures, two `<img>` menu buttons no
  set member fits yet (the iframe module's change-URL, the video module's reset-size), and
  fifteen unreferenced PNGs: the ones restored on 2026-08-30, which that afternoon's
  conversion orphaned again (nothing in the tree loads them), so the second sweep can happen
  whenever it is wanted — the scroll pair's two files went with the button rather than
  joining them. Whether the surviving pairs and the last two buttons convert is still the
  call, each wanting a redraw first. Mixing PNG and SVG shows seams at high zoom and on
  HiDPI — the chrome that matters has stopped mixing.

  Two of the SVGs have lost their last reference the same way, and are kept rather than
  deleted, like the PNGs: `page-background-image.svg` (the object's background button until
  09-16), `background-color.svg` (both background panels' colour button, worn for a day
  before it took `color-swatch`) and `background-color-remove.svg` (the text menu's
  make-background-transparent button, which went when the background panel took the colour
  over). None is a placeholder and none is broken; nothing in the tree loads them.

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
- **Copy objects between pages** — **Done, 2026-09-14** (see the Done entry, and
  `SOW-copy-paste-objects.md`). Copying a *page* already worked: `glue.copy_page`
  (`module_glue.inc.php:857`), reachable from the page browser
  (`modules/page_browser/page_browser.js:68`). Objects were the missing half —
  `glue.clone_object` derives its target page from the source object's own name, so it
  could only ever clone within one page; `glue.get_object`/`glue.paste_object` are the
  pair that crosses.
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
