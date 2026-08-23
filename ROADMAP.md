# Hotglue `ng` — Roadmap / Backlog

A single index of the work-in-flight and the "someday" list, so the scattered task
docs have one home. Not a rigid roadmap — a living list. Roughly grouped by status.

This is the feature/dev backlog for the hotglue **application**. Service operations for
any particular install — accounts, UserCake, mail, hosting, moderation — belong in that
service's own repo, not here, and are deliberately absent.

Maintained as work lands: when something ships it moves to *Done*, and its task doc is
updated to describe what was BUILT rather than what was planned — several of these
designs changed materially once they met real pages, and a stale spec is worse than
none. Last reconciled against the tree on 2026-08-23.

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

### In git history only

- **MOBILE-VIEW-DESIGN.md** — the author-curated "mark elements mobile-friendly →
  stacked view" approach, a DIFFERENT design from the pan/zoom one that shipped.
  Deliberately reverted off `ng`; recover with `git show 6e6bd6b:MOBILE-VIEW-DESIGN.md`.
  Do not restore it without deciding the question under "Mobile view" below.

---

## Done / shipped

- DB-backed editor auth (`AUTH_METHOD='db'`).
- Editor dejQuery'd → vanilla + Moveable (drag/resize, touch-capable) + Alpine (chrome).
  HiDPI sharp images. PHP8 pass. Color picker later moved to vendored vanilla-picker.

Shipped 2026-08-22/23:

- **Mobile guided view** — pan/zoom on small screens, with an exponentially-paced
  reveal and a double-tap overview toggle.
- **Centered layout mode** — per-page, opt-in, no coordinate migration.
- **Object Properties dialog**, **text link dialog**, **WYSIWYG text editing** (the
  markup is hidden while editing; `</>` switches to source), **object overflow toggle**.
- **First JS test infrastructure**: a Playwright e2e suite, `tests/e2e/`, **240 tests
  passing on Chromium AND Firefox**. Hermetic — it runs its own PHP server against
  `content-e2e/` and never touches real content or credentials.
- **`tools/make-min.js`** — the "small one-off script" the `*.min.js` pairs were always
  described as coming from, finally written. `js/mobile-guided.js` is the only script a
  visitor to a published page downloads, and now ships at 4KB gzipped instead of 11KB.

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
- **Mobile view** — pan/zoom has SHIPPED as the default. The open half of the decision
  is whether the author-curated stack (MOBILE-VIEW-DESIGN, in git history only) is still
  wanted as an opt-in alongside it. Worth deciding before anyone restores that doc.
- **Icon set refresh** — adopt (and extend) the Superglue icon set on the translucent
  gray editor chrome. Addresses the old "redesign menu icons" item. **Now more pressing:
  six buttons currently ship a text label as a placeholder** — undo, redo, link, `</>`,
  clip/show and centre/wide — all carrying `.glue-btn-label`, which is a ready-made list
  of what needs drawing. Get SVG source if available (scalable, CSS-colorable); match the
  style rigorously when extending it for new Hotglue features; interaction states
  (hover/active/disabled) and keep the tooltips.
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
- **Copy pages / copy objects between pages** — from the old todo list.
- **Object rotate / flip / mirror** — Moveable supports these natively now; low-hanging.
- **New uploader / better upload handling** — client-side resize/transcode before
  upload, which cuts media bloat at source rather than after it lands.
- **favicon upload, relative internal links, link target auto-select** (`_blank`
  external / `_self` internal) — small QoL from the old todo list.
- **Upload & manage fonts** (woff) — modern web fonts make this much easier than the
  2011 WebType-era plan.
- **Centered mode: a content-derived default width.** Switching an existing page to
  centered puts most of its content outside the default container until the handles are
  dragged out — on `content/start`, 4 of 7 objects. A default from the content bounding
  box would be kinder than a fixed number.
- **Mobile guided view × centered mode.** It activates and nests correctly, but in
  centered mode the container width is the natural "page width" for the fit and the
  mobile code does not know about it.
- **Firefox on Android** — the desktop suite covers Gecko, but the pinch floor and touch
  gestures can only be checked on a device, and `tests/e2e/android-check.js` drives
  Chrome only. Playwright cannot drive Firefox on Android, so this stays manual.

*(Undo is already implemented — `$.glue.undo` in `js/edit.js`, an in-memory stack 20
deep. It replaced the old server-side auto-snapshot system rather than building on it.)*

---
