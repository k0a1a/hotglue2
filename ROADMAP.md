# Hotglue `ng` — Roadmap / Backlog

A single index of the work-in-flight and the "someday" list, so the scattered task
docs have one home. Not a rigid roadmap — a living list. Roughly grouped by status.

This is the feature/dev backlog for the hotglue **application**. Service operations for
any particular install — accounts, UserCake, mail, hosting, moderation — belong in that
service's own repo, not here, and are deliberately absent.

Maintained as work lands: when something ships it moves to *Done*, and its task doc is
updated to describe what was BUILT rather than what was planned — several of these
designs changed materially once they met real pages, and a stale spec is worse than
none. Last reconciled against the tree on 2026-08-23, that time by opening the code path
behind every remaining item rather than by re-reading the list — which is how two of them
turned out to be already built and a third to be half-built.

---

## Task docs (detailed specs — read these when building)

All of these have shipped, so each one now records what was BUILT — read them for the
reasoning, not as a plan. One further design lives only in git history; see below.
Checked against the tree on 2026-08-23.

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

### In this directory, NOT yet built

- **SOW-text-controls-redesign.md** — *(the Font and Spacing popovers are now BUILT;
  the padding relocation is not.)* Collapse the text menu's eight formatting buttons
  into Font and Spacing popovers plus a standalone Color button, and move padding out to
  object properties. Reconciled against the tree on 2026-08-23: the paragraphs marked
  **CHECKED** are what the code actually does, and three of them change the plan — the
  controls style the whole object rather than a selection (so the spec'd three-state
  toggles have no partial state to read), `text-decoration` is stored nowhere at all (so
  underline/strikethrough are a storage change, not just a UI one), and there is no
  reusable popover component yet (the colour picker's placement would have to be lifted
  out first).

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
- **First JS test infrastructure**: a Playwright e2e suite, `tests/e2e/`, **382 tests
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
  in `/code`.
- **Icon set refresh** — *(in progress. The first batch of the SuperGlue SVG set landed
  2026-08-23; more are being produced over the coming weeks, ahead of hotglue.me being
  updated.)*

  **Wiring is done and proven.** `tools/prep-icons.js` regenerates `img/icons/` from the
  upstream artwork (54 icons, 206K → 38K: the source files are ~85% Inkscape metadata,
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

  Wired so far: `sheep-icon3` for clone (the joke lands: everyone knows what a cloned
  sheep is, and the alternative is the two overlapping rectangles every toolbar has —
  the silhouette of the four drawings, since line work turns to mush at 30px),
  `undo`, `redo`, `hyperlink`,
  `font-color`, `background-color`, `background-color-remove`, `super-user` (the `</>`
  source toggle, which the artwork spells out exactly), `font-size` (the text menu's
  Font panel), `vertical-stack-space` (its Spacing panel), the four `align-*` inside
  that panel, and the layout toggle via `composition-mode-absolute`/`-centered` — that
  last one shows the mode you are switching TO, preserving the old split where the
  tooltip describes the present and the button names the destination.

  **Still needs drawing** — one placeholder left on `.glue-btn-label`:

  | label | what it does | file |
  |---|---|---|
  | `clip` / `show` | object clips or spills its overflow | `modules/object/object-edit.js` |

  It is STATEFUL, so it wants two icons or one with a clear on-state, and it flips live
  through Alpine (no reload) — so wiring it will also need a way to change an element's
  `--glue-icon` after construction, which `$.glue.icon()` only sets at build time. (The
  `</>` source toggle that used to be here is done: `super-user` in the set draws exactly
  that glyph.)

  **Unresolved: licensing.** The upstream files declare CC BY-NC-SA 3.0
  (`cc:prohibits CommercialUse`), credited to VERBALVISU.AL / SuperGlue project. Hotglue
  is GPLv3, which does not permit adding a non-commercial restriction to a distributed
  work, so this has to be settled before release — presumably by relicensing the set,
  which needs whoever holds the rights (the credit names both VERBALVISU.AL as author and
  the SuperGlue project as publisher). `tools/prep-icons.js` strips the per-file
  attribution blocks, so if attribution turns out to be required it needs to live in one
  NOTICE file rather than 54 copies.

  **Two names are swapped at source:** `align-left.svg` draws lines centred on a common
  axis and `align-center.svg` draws them flush against a left margin rule. The spacing
  popover maps them by what they depict, with a comment saying so — worth fixing in the
  upstream set, after which that table can be straightened out.

  **Open decision:** the set is 54 icons against today's 65 PNGs and does not map
  one-to-one. Mixing PNG and SVG shows seams at high zoom and on HiDPI, so at some point
  it is worth deciding whether the new set replaces all of them or only fills gaps.

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
  which then went to direct manipulation instead, so **nothing drives it yet**: the
  candidates are the buttons that already change a number by being dragged invisibly —
  transparency and border width (`modules/object/object-edit.js`), font size, line height
  and letter spacing (`modules/text/text-edit.js`), page background position
  (`modules/page/page-edit.js`). It is covered by `tests/e2e/rangeslider.spec.js` in both
  orientations, so adopting it is a call, not a build. If nothing adopts it, delete it.
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
