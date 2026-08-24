# Handover — hotglue `ng`

**As of 2026-08-24.** Branch `ng`, 117 commits ahead of `dev`, which has not moved.
`dev` is the repo's default branch; nothing on `ng` has been merged back, and that is
the first strategic decision waiting for someone.

This file is the operational summary: what the project is, how to work on it, what was
built recently, and what is left. The backlog lives in `ROADMAP.md` and is maintained as
work lands; the per-feature specs are the `SOW-*.md` files; `MODERNIZATION.md` is the
history and reasoning of the jQuery removal, and `CLAUDE.md` is the short orientation a
new pair of hands (or a model) reads first.

---

## What hotglue is

A PHP web application for making free-form, drag-and-drop web pages in the browser.
**No database**: everything is flat files under `content/`, addressed by dotted names
(`page.revision.object`) that map straight onto directories. An object is a file of
`key:value` lines, a blank line, then its content. That file format is the product; it
is what round-trips through every feature, and most of the care in this codebase is
about not disturbing it.

The editor frontend (`js/`, `modules/*/*-edit.js`) is vanilla JavaScript on a bespoke
plugin/event-bus framework under `$.glue.*`, with Moveable for drag/resize/rotate and
Alpine for a few reactive tooltips. It is loaded only inside the authenticated editor
and never ships to a published page — the one script a visitor downloads is
`js/mobile-guided.js`.

---

## Working on it

```bash
php -S localhost:8001                  # danja keeps :8000; use another port
cp user-config.inc.php-dist user-config.inc.php
chmod -R 0777 content

npm run test:e2e                       # Playwright, 446 tests, chromium + firefox
composer install && vendor/bin/phpunit tests/UtilTest.php
```

The e2e suite is **hermetic**: `tests/e2e/server-router.php` starts its own PHP server on
:8123 and `@define`s `CONTENT_DIR=content-e2e`, test credentials, `USE_MIN_FILES=false`
and `LOG_LEVEL=debug` before hotglue loads. It never touches real content, real
credentials, or a running dev server. `content-e2e/log.txt` is the debugging tool of
choice — it has resolved more than one dead end in a single line.

Two loops that are easy to forget:

```bash
node tools/make-min.js js/edit.js      # after editing ANY of hotglue's own js
node tools/prep-icons.js ../superglue-ng/documentation/UI-icons-SVG-nobg img/icons
```

`USE_MIN_FILES` defaults to **true**, so the `.min.js` copy is what a default install
serves. A fix that forgets the copy ships nothing while the source, the suite and any
`USE_MIN_FILES=false` developer all look fine. `tests/e2e/min-files.spec.js` guards it.

---

## The architecture, in the order you will meet it

- **Two entry points.** `index.php` for viewing and editing (controllers keyed on the
  first two query arguments); `json.php` for the editor's RPC, whose POST parameters are
  each individually JSON-encoded.
- **Modules** are `module_*.inc.php`, auto-discovered, implementing named hooks
  (`module image` + hook `render_object` = `image_render_object()`), and registering
  services the frontend calls by name.
- **The round trip is the thing to understand.** An object is stored as attributes;
  `*_render_object()` turns attributes into DOM; `*_alter_save()` reads the DOM back into
  attributes. Anything not on that list is dropped on save. A feature is not finished
  until it survives save → reload → published page, which is why so many tests end by
  loading `?page` without `/edit`.
- **`$.glue.owner(elem[, obj])`** — a WeakMap set once in `edit.js`, read at ~50 call
  sites across ~15 module files. Undocumented but load-bearing.
- **`$.glue.object.save()`** serializes objects to literal HTML that is the on-disk
  format for every existing page. Changing it risks corrupting stored pages.

---

## Conventions that are load-bearing

These were established or discovered the hard way. Breaking one of them tends to look
fine and fail later.

1. **Absent means default.** Only store an attribute when it is set to something other
   than the default: overflow stores only `hidden`, border style stores only what is not
   `solid`, a zeroed radius/fade/glow removes its attributes entirely. An object reset to
   plain must end up byte-identical to one nobody ever touched.
2. **Store the ingredients, not the composed value.** The edge fade stores a distance and
   the glow stores a colour, a radius and a strength; the gradients themselves live once
   in `css/main.css`. A `mask-image` string in an object file would put commas and quotes
   in the format and write the same gradient in two places that must agree forever.
3. **`css/main.css` ships to visitors; `css/edit.css` does not.** Anything a published
   page needs to draw has to be in the first.
4. **Icons are masks, and a mask reads alpha only.** Judge new artwork by rendering its
   ALPHA at 30px — the colour in the file never reaches the screen. A black drawing and a
   white one are identical in the toolbar and completely different in a file browser.
5. **`preferred_module` must be a module's own name.** `upload_files()` dispatches by
   building `"{preferred_module}_upload"` and calling it, so a hyphenated name is
   silently not callable and the file falls through to whichever module claims it first.
6. **Panels are placed by `$.glue.popover`**, which measures the VISUAL viewport (an
   on-screen keyboard shrinks that and not the layout one) and scores candidate positions
   so that covering the object disqualifies a position while covering our own menus is
   only a tie-break. "No menu or interface shall interfere with page elements" is the
   design codex, and it is enforced here.
7. **Tests assert what is STORED as well as what is drawn**, and the paint-critical ones
   A/B against a deliberately broken version — a mask that fails to load hides its
   element while still passing `toBeVisible()`.

---

## What was built in this stretch (2026-08-22 → 08-24)

Detail and reasoning are in `ROADMAP.md`'s Done section; this is the shape of it.

- **A Playwright suite from nothing**: 250 tests two days ago, **446 now**, 25 spec
  files, both engines. It has found real bugs on almost every feature it touched.
- **The SuperGlue icon set, first batch**: `tools/prep-icons.js` regenerates `img/icons/`
  from the upstream artwork (54 icons, 206K → 38K) and honours its `extra/` folder of
  redraws. Fifteen icons are wired.
- **Free rotation** on Moveable's handle, off the right edge, snapping to 15° with shift
  for any angle — and the chrome (menus, handles) now stays aligned to the object through
  turning, resizing and undoing.
- **The panels.** Font (face, size, style, colour, and a "more knobs" fold with spacing,
  alignment and a text shadow), Edge (corners, fade, border, and a fold with a glow),
  Background image (tile, move, remove), and the link dialog turned from a modal into a
  rollout. The text menu went from thirteen buttons to five. All four are built from one
  set of parts in `$.glue.popover`.
- **The colour picker**, halved in size, placed beside the object, with a real
  transparency row, a square sample, room for `#rrggbbaa`, and the page's seven most
  recent colours as swatches — which also seed new text objects.
- **Selection became an outline**, not a border on the object. Three coordinate fixups
  went with it, and it is what makes an object's own border possible at all.
- **The editor works on a phone** — verified on a Galaxy S23 over ADB. Tap selects, a
  second tap edits, typing saves, a finger drags.

---

## What is left, in the order I would take it

**Decisions, not code:**

1. **Merge `ng` to `dev`, or don't.** 117 commits is a lot of unmerged work.
2. **The icon set's licence.** The upstream files declare CC BY-NC-SA 3.0; hotglue is
   GPLv3, which cannot carry a non-commercial restriction. This blocks release and needs
   whoever holds the rights. `ROADMAP.md` has the detail.
3. **`$.glue.rangeslider` — adopt or delete.** Built for rotation, which went to direct
   manipulation instead; it still has no caller, and is fully tested.

**Work, roughly by value:**

4. **The nine mouse-only drag controls.** Every `$.glue.slider` caller — transparency,
   padding, page background position, grid size, guides, image scale, the background pad —
   binds `mousedown` and listens for `mousemove`, which touch never sends during a drag.
   They are dead on a phone. Moving them to `$.glue.popover.number_row()` fixes that and
   is the same work as the "parametric entry" roadmap item.
5. **Editing on a phone, past the first tap**: the menu row does not wrap (two buttons
   were off a 274px viewport), tooltips are the only label most buttons have, and the
   canvas is wider than the screen with no fit-and-reveal in the editor. `ROADMAP.md` has
   the measured detail.
6. **`clip`/`show` is the last text placeholder button** and needs artwork plus a way to
   change `--glue-icon` after construction, since it flips live through Alpine.
7. **Centered mode's default width** still lands on a flat 960px, putting most of an
   existing page outside the container.
8. **Padding is reported broken** and is scheduled to move to Object Properties — but
   nobody has reproduced it yet. Do that first; `SOW-text-controls-redesign.md` names the
   suspect.
9. **Per-selection text styling** (bold *this word*) — the font panel's toggles are
   object-wide because that is all the module can do. It needs range wrapping by hand,
   and deserves its own SOW.
10. **Firefox on Android** — the desktop suite covers Gecko, but the pinch floor and
    touch gestures need hardware, and `tests/e2e/android-check.js` drives Chrome only.

---

## Traps that have already cost time

- **`.min.js` staleness** — see above. It has shipped a fix to nobody before.
- **Moveable's `preventDefault: true`** swallows the click a tap synthesises. That single
  default made the entire editor unreachable on touch, silently, while a mouse worked.
- **Moveable's `getRect()` is cached** and `updateRect()` only schedules a recompute, so
  anything that changes an object and immediately measures it reads the old value.
- **A mask that fails to load hides everything**, at the right size, still clickable,
  with nothing in the console.
- **vanilla-picker builds its wrapper once and reuses it**; anything added to that
  wrapper survives into the next open.
- **The image module paints its picture with `background-image`**, so a save rule that
  reads background properties off any element will write into every image object.
- **Test-harness races**: `Fixture.destroy()` removes a page directory while the editor
  is still saving into it, and `readObject()` on a file that does not exist yet. Both are
  fixed, and both presented as unreproducible one-off failures in unrelated tests for a
  day before being understood.

---

## Historical: the jQuery removal (2026-07)

The editor was jQuery 1.5.2 / jQuery UI 1.8.6 / Farbtastic / xcolor, all 2010-vintage.
That work is **complete** — jQuery is gone entirely, replaced by vanilla DOM APIs,
Moveable and Alpine — and `MODERNIZATION.md` holds the phase-by-phase reasoning, the
per-file notes and the landmines. Two decisions recorded there were later revised by
events: the colour picker went to a vendored **vanilla-picker** rather than
`<input type="color">` (which cannot be styled or positioned), and there is still **no
build step** — `tools/make-min.js` writes comment-stripped copies instead.

Explicitly deferred there and still deferred: the PHP global-state refactor, auth
hardening, and real build tooling. Picking one up reopens a decision rather than
finishing something.
