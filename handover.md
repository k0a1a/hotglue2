# Handover: Hotglue jQuery Removal & PHP Modernization

**Status:** Complete (2026-07-31). All phases below (0 through jQuery-core
removal) have been implemented and jQuery/jQuery UI have been fully removed
from the editor frontend. This file is kept as historical planning context;
see the git log for the actual commit-by-commit implementation.

**Full detail:** see `MODERNIZATION.md` in this same directory. This file is a
short pointer/checklist version of it.

## What this project is

Hotglue's editor UI runs on jQuery 1.5.2 / jQuery UI 1.8.6 / Farbtastic /
jquery.xcolor, all ~2010-2011 vintage. Confirmed by tracing every asset-loading
path in the PHP: **jQuery never ships to published/public pages** — it's
confined to the authenticated `?edit` editor and a few auth-gated admin routes
(`/pages`, `/page/revisions`, `/code`). So this is safe to do incrementally;
nothing about it is a breaking change for live sites while in progress.

Separately, a PHP modernization pass closes real PHP 8.1+ deprecation-notice
risk (no PHP 8 *fatal* blockers exist today).

## Decisions already made (don't re-litigate without reason)

| Area | Decision |
|---|---|
| Drag/resize library | [Moveable](https://github.com/daybrush/moveable) (`Draggable`/`Resizable`/`Snappable`/`Groupable` modules) |
| Alpine.js | Property panels/menus/dialogs only — canvas engine (drag math, z-stack, event bus) stays vanilla JS |
| Migration strategy | Strangler-fig — keep `edit.js`'s `$.glue.*` API surface stable, swap internals incrementally, don't touch the ~40 dependent module files' call sites |
| Color picker | Native `<input type="color">` replaces Farbtastic entirely (Farbtastic never handled alpha here anyway) |
| Build tooling | No build step — native ES modules via `<script type="module">`, matching the project's existing zero-bundler philosophy |
| Browser baseline | Modern evergreen only (Chrome/Firefox/Safari/Edge, last ~2 years). No IE/polyfills. |
| Testing | Add Playwright e2e coverage for select/drag/resize/multi-select — currently zero JS test infra exists |
| PHP scope | Surface-level only this pass: null-safety, `array()`→`[]`, dead code, `E_STRICT`. The procedural/global-state architecture is explicitly deferred, not part of this effort. |

## Suggested entry point (Phase 0, `MODERNIZATION.md` §9)

Start with the zero-risk cleanup — it builds familiarity with the codebase
before touching anything load-bearing:

1. Delete confirmed-dead files: `modules/transform/jquery.transform-0.9.3.min.js`,
   `modules/transform/jquery-css-transform.js`,
   `modules/transform/jquery.transform2d.js` (unreferenced by any `html_add_js`
   call — verified).
2. Delete the dead legacy `sendAsBinary`/`getAsBinary` upload fallback in
   `js/edit.js:1692-1730` (no browser needs it anymore).
3. Fix two pre-existing bugs found during the audit, unrelated to jQuery but
   convenient to fix while in this code:
   - `modules/webvideo/webvideo-edit.js:179` — `register_alter_pre_save`
     registered under the wrong module name (`'iframe'` instead of
     `'webvideo'`).
   - `module_image.inc.php:396` — misplaced paren:
     `intval($obj['image-resized-height'] == $height)` should be
     `intval($obj['image-resized-height']) == $height`.
4. Swap `glue.js`'s `$.post()`-based `$.glue.backend()` for `fetch()`, keeping
   the exact same call signature so no caller needs to change.

Then proceed through Phases 1-5 in `MODERNIZATION.md` §9 (color picker → canvas
drag/resize core → event-bus/`.data()` replacement → per-module panel ports to
Alpine → remove jQuery from asset loading entirely), building the Playwright
suite alongside each phase rather than at the end.

## Landmines — read before touching these

Full detail in `MODERNIZATION.md` §8. The short version:

- **`edit.js`'s save path serializes objects to literal HTML strings that are
  the on-disk storage format for every existing page.** Changing how that
  serialization happens (`$.glue.object.save()`) risks corrupting or
  mis-rendering already-published pages on next load. Verify byte-for-byte-
  equivalent-enough output, don't just assume `element.outerHTML` is a safe
  drop-in without checking.
- **`.data('owner', obj)` is an undocumented contract used at 47 call sites
  across ~15 files.** Set once in `edit.js:391`, read everywhere else. Needs
  one clean replacement (a `WeakMap`) introduced before any consumer file is
  touched.
- **jQuery UI's viewport-edge auto-scroll during drag is never explicitly
  coded anywhere** — it's a default behavior of `.draggable()`. Easy to lose
  silently when swapping to Moveable; put it in the test suite explicitly.
- **`text-edit.js` has a documented Chrome-specific event-propagation quirk**
  around isolating textarea typing from canvas drag/selection handlers. This
  is the highest-risk single file in the whole migration — schedule it last
  among the per-module ports (Phase 4), with dedicated manual QA.
- **`lock.js` calls jQuery UI's `.draggable()`/`.resizable()` API directly**,
  not through `edit.js`'s wrappers — it must be ported in the same phase as
  the core drag/resize engine, not independently.

## Open items not decided yet (flagged, not resolved)

These came up during the audit but were explicitly scoped out of this
assessment — worth a future conversation, not blockers for starting Phase 0:

- PHP global-state refactor (`html.inc.php`/`modules.inc.php`'s `$html`/
  `$hooks`/`$modules`/`$services` globals) — testability improvement, bigger
  effort, deferred.
- Auth hardening (constant-time comparison for HTTP Basic; HTTP Digest's
  MD5 usage is spec-mandated, not fixable without changing the auth scheme
  entirely) — flagged as a known limitation, not requested.
