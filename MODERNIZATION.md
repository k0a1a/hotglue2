# Hotglue Modernization Assessment: jQuery Removal & PHP Cleanup

Status: **implementation complete** (jQuery/jQuery UI/Farbtastic/xcolor removal,
all phases in §9; PHP modernization pass, §10; `IE8_COMPAT` removed). This
document is kept as the detailed rationale/plan and a record of what was
explicitly deferred (§13). `handover.md` is the project's current operational
summary - what it is, how to work on it, what is built and what is left - and carries
the short version of this document's history at the end.

## 1. Executive summary

Hotglue's frontend is built on jQuery 1.5.2 + jQuery UI 1.8.6 (custom build) +
Farbtastic + jquery.xcolor, all vendored circa 2010–2011. The good news, confirmed
by tracing every asset-loading path in the PHP: **none of this ships to visitors of
published pages.** jQuery only loads inside the authenticated editor (`?edit`) and
a small number of auth-gated admin routes. This is a tooling modernization, not a
breaking change for live sites, and it can proceed incrementally without a
flag-day cutover.

The hard part isn't "jQuery calls" — it's that `js/edit.js` (1919 lines) implements
a bespoke plugin/event-bus framework (the `$.glue.*` namespace) that roughly 40
other editor-only JS files depend on as an API contract: menu/context-menu
registries, a synthetic event bus, a `.data('owner', obj)` convention, and
DOM-class-as-state-machine conventions (`.glue-selected`, `.locked`, `.object`).
The plan below preserves that contract (strangler-fig migration) rather than
rewriting it and all 40 call sites at once.

On the PHP side, there are no PHP 8-fatal blockers (no removed functions, no SQL,
no `eval`/`exec`). The real work is a null-safety pass around ~213 `@`-suppressed
calls (PHP 8.1+ deprecation-notice risk), a mechanical `array()` → `[]` pass across
266 sites, and a handful of dead code removals. The procedural/global-state
architecture (38 `global` declarations, concentrated in `html.inc.php` and
`modules.inc.php`) is explicitly **out of scope** for this pass — see §13.

## 2. Scope & method

Audited: all of `js/`, `css/`, every `modules/<name>/*.js` editor and runtime
file, all `module_*.inc.php` PHP controllers/hooks, `html.inc.php`,
`controller.inc.php`, `modules.inc.php`, `common.inc.php`, `config.inc.php`, and
`tests/UtilTest.php`. Four research passes were run in parallel:

1. Editor-core JS (`js/edit.js`, `js/glue.js`, `js/create_page.js`)
2. Per-module editor JS (`modules/*/*-edit.js`, 14 files)
3. Public-facing runtime JS and asset-loading logic (every `html_add_js`/
   `html_add_css` call site and its gating condition)
4. PHP legacy/deprecated-construct scan (PHP 8.0–8.5 focus)

All findings below are traceable to specific `file:line` locations found during
that audit.

## 3. Risk profile: where jQuery actually loads

Central gate: `common.inc.php:78-116`, `default_html($add_glue)`. jQuery,
`glue.js`, and (from `controller_edit`) jQuery UI/Farbtastic/xcolor/`edit.js` load
only when `$add_glue` is true.

| Route | Controller | `$add_glue` | Auth |
|---|---|---|---|
| Published page view | `controller_show` (`controller.inc.php:249`) | **false** — jQuery never loads | none (public) |
| `?edit` | `controller_edit` (`controller.inc.php:98`) | true | required (`controller.inc.php:129`) |
| `/create_page` | `controller_create_page` (`controller.inc.php:40`) | true | required (`controller.inc.php:74`) |
| `/pages` | `controller_pages` (`module_page_browser.inc.php:26`) | true | `PAGES_NEED_AUTH`, default `true` (`config.inc.php:59`), **configurable** |
| `/page/revisions` | `controller_revisions` (`module_revisions_browser.inc.php:50`) | true | `REVISIONS_NEED_AUTH`, default `true` (`config.inc.php:60`), **configurable** |
| `/code` | `controller_user_code_stylesheet` (`module_user_code.inc.php:39`) | true | hardcoded `true` (`module_user_code.inc.php:98-99`), not configurable |

Note: `/page/revisions` and `module_revisions_browser.inc.php` (row above)
were removed entirely in 2026-08, unrelated to this jQuery-removal effort -
see the README's "RECENT CHANGES" for why. Table left as-is as an accurate
record of the audit at the time it was written.

Every per-object module's editor JS (`download-edit.js`, `image-edit.js`, etc.) is
additionally gated inside its own `*_render_page_early` hook by
`if ($args['edit'])`, e.g. `module_image.inc.php:305-322`,
`module_text.inc.php:390-414`. `module_lock.inc.php:72-84` and
`module_transform.inc.php:84-98` go further with an explicit
`else { return false; }` for the non-edit case.

**Caveat to flag for operators:** if a site disables `PAGES_NEED_AUTH` or
`REVISIONS_NEED_AUTH`, `/pages` or `/page/revisions` become unauthenticated public
URLs that do load jQuery. Not a concern for the default configuration.

Unconditional-on-public-pages assets are CSS-only and jQuery-independent:
`video.css` (`module_video.inc.php:108-117`), `download.css`
(`module_download.inc.php:50-68`), and inline `@font-face`/WOFF CSS
(`module_text.inc.php:265-324`). The only way arbitrary JS reaches a public page
today is if a site operator pastes it into the custom-code module
(`module_user_code.inc.php:119-127`, unconditional `html_add_head_inline`) — that's
user content, not a Hotglue dependency.

## 4. What `edit.js` actually is

Not a page script — a small framework. It defines, under `$.glue.*`:

- `canvas`, `sel` — selection state, keyboard shortcuts, click/drag-to-select
- `object` — register/unregister/save (serializes a cloned DOM node to an HTML
  string via the classic `$('<div></div>').html(elem).html()` outerHTML trick,
  `edit.js:891-907`) — **this HTML string is the literal persistence format**
  written to flat-file content storage, so any DOM-shape quirks from jQuery's
  `.clone()`/`.css()` are baked into stored pages and must be reproduced by
  whatever replaces this call.
- `stack` — z-index management: `intersecting()` AABB test + a `compress()`
  algorithm that renumbers z-index to close gaps, only saving objects whose
  z-index actually changed (`edit.js:1341-1498`)
- `menu`, `contextmenu` — priority-sorted, vetoable plugin registries that ~40
  module files call `$.glue.menu.register(...)` / `$.glue.contextmenu.register(...)`
  against (`edit.js:165-420, 603-787`)
- `slider` — a hand-rolled generic mouse-drag helper (**not** jQuery UI's
  `.slider()` widget, despite the name — `edit.js:1315-1339`), reused by every
  module's drag-to-adjust controls (transparency, z-index, font-size, etc.)
- `colorpicker` — thin Farbtastic wrapper
- `upload` — already mostly framework-free: raw `XMLHttpRequest` + `FormData`
  (`edit.js:1641-1738`), including dead legacy `sendAsBinary`/`getAsBinary`
  fallback code for browsers that no longer exist (safe to delete)
- `grid` — snap-to-grid guides, uses `$.color`/`xcolor` for grid-line contrast math

Drag (`.draggable()`, `edit.js:873`) and resize (`.resizable()`, `edit.js:877`) are
jQuery UI widgets, but the product-defining behavior is custom code layered on
their event hooks: synced multi-select drag (jQuery UI has no native concept of
this — `edit.js:1188-1230` manually recomputes deltas for every other selected
object), Ctrl-to-toggle grid snap mid-drag (`edit.js:1138-1151`), Shift-to-axis-
constrain (`edit.js:1152-1177`), and keyboard-arrow nudge that bypasses the widget
entirely (`edit.js:985-1042`). jQuery UI's **implicit default auto-scroll near the
viewport edge** is used but never explicitly coded anywhere — easy to silently
lose in a rewrite that isn't checked against it specifically.

Consumer coupling: `.data('owner', obj)` is set once in `edit.js:391`
(`$.glue.contextmenu.show`) and read back via `$(this).data('owner')` at **47 call
sites across ~15 module files** (`object-edit.js`, `text-edit.js`,
`image-edit.js`, `video-edit.js`, `webvideo-edit.js`, `download-edit.js`,
`lock.js`, `transform.js`, `iframe-edit.js`, etc.). This is an implicit,
undocumented API — any replacement needs an equivalent keyed-storage mechanism
(a `WeakMap` is the natural fit) reachable from all of those files.

## 5. Decisions

Made jointly with the maintainer on 2026-07-30; all four picked the recommended
option:

| Decision | Choice | Why |
|---|---|---|
| Drag/resize engine | **Moveable** (daybrush) | Its `Draggable`/`Resizable`/`Snappable`/`Groupable` modules map almost exactly onto the custom behavior `edit.js` currently hand-rolls (Groupable = synced multi-select drag/resize; Snappable = grid snap). Actively maintained, TypeScript source, MIT, modular imports. |
| Alpine.js scope | **Panels/menus only** — canvas core stays vanilla | Alpine's declarative bindings fit toolbar/property-panel/menu/dialog UI; the canvas engine (drag math, z-stacking, event bus) stays imperative — that's not what Alpine is for. |
| Migration strategy | **Strangler-fig**: preserve the `$.glue.*` API surface, swap internals incrementally | The ~40 module-editor files keep calling `glue.menu`/`contextmenu`/`object`/`sel`/`stack` unchanged; lowest short-term risk, ships in stages. |
| PHP scope | **Surface-level only**: null-safety, `array()`→`[]`, dead code, `E_STRICT` | Closes real PHP 8.1+ deprecation-notice risk without touching the procedural/global-state architecture (`html.inc.php`/`modules.inc.php`), which is a separate, larger effort deferred out of this pass. |
| Color picker | **Native `<input type="color">`** | Farbtastic in this codebase only ever handles opaque hex colors (object transparency is a separate CSS-opacity slider, unaffected) — nothing is lost, and it removes a whole plugin. |
| Build tooling | **No-build**: native ES modules via `<script type="module">` | Matches the project's existing zero-bundler philosophy (`html_add_js()` just queues `<script src>` URLs, no build step exists today). npm packages vendored/copied in; minified copies produced by a small one-off script, same convention as today's `*.min.js` pairs. |
| Browser baseline | **Modern evergreen only** (last ~2 years of Chrome/Firefox/Safari/Edge) | Drops IE/old-Safari support (already nominal-only per `INSTALL`'s Firefox 3.6+/Chrome 8+/IE8 targets from ~2011). Enables native ES modules, optional chaining, Pointer Events, `<input type=color>` with no polyfills. |
| Testing | **Add Playwright e2e coverage** for select/drag/resize/multi-select | The biggest risk in this migration is silently losing jQuery-UI-implicit behavior (edge auto-scroll, drag-start distance threshold). A handful of interaction tests catches regressions and gives future contributors a safety net; currently zero JS test infrastructure exists. |

## 6. Library choices in detail

**Moveable** (`github.com/daybrush/moveable`) — drag/resize/rotate/scale/group
library, MIT, no runtime dependencies, actively maintained, TypeScript source.
Import only `Draggable`, `Resizable`, `Snappable`, and `Groupable` — Hotglue
doesn't need rotate/scale/warp. `Groupable` in particular removes the need to
hand-roll multi-select delta-sync math (`edit.js:1188-1230` today). Keyboard nudge
and the drag-start distance threshold stay custom (Moveable doesn't cover them),
same as today.

**Alpine.js** — `x-data`/`x-show`/`x-model`/`x-on` for property panels, context
menus, and the file-upload progress UI. Roughly 15KB min+gzip, no build step
required (works via a plain `<script defer src="alpine.js">` + `x-` attributes in
markup), which fits the no-build decision above. Scope: the ~40 `*-edit.js`
module files' *panel rendering and state*, not the canvas drag/resize/event-bus
core.

**Native `<input type="color">`** replaces Farbtastic (`js/farbtastic.js`,
`css/farbtastic.css`) entirely — zero JS, zero CSS, built into every evergreen
browser. `jquery.xcolor`'s complementary/average color math (used only for
grid-line contrast, `edit.js`'s `grid` module) is ~20 lines of vanilla color math
to reimplement directly — not worth a library for.

**`fetch()`** replaces `$.glue.backend`'s `$.post()` wrapper (`glue.js:22-66`).
Single chokepoint, single migration: keep the same `$.glue.backend(method, args,
callback)` call signature (strangler-fig — see §5) so none of the ~40 caller
sites need to change, just reimplement the body with `fetch()` +
`AbortController` (for the existing 10s timeout, `glue.js:23`) instead of
`$.ajaxSetup`/`$(document).ajaxError`.

## 7. Per-module migration notes

| Module | Editor JS | jQuery/jQuery UI surface | Migration note | Risk |
|---|---|---|---|---|
| transform | `transform.js` (92 lines) | `.css()` get/set of `transform`/vendor-prefixed props only | Already effectively vanilla — swap `.css()` for `element.style.transform`. **Delete** unreferenced `jquery.transform-0.9.3.min.js`, `jquery-css-transform.js`, `jquery.transform2d.js` (confirmed dead, not loaded by any `html_add_js` call — `module_transform.inc.php:89-92`) | Low |
| page_browser, revisions_browser, user_code | `*-edit.js` (17-18 lines each) | Single menu registration + `window.location` on click | Trivial, near-identical, easiest ports in the codebase | Low |
| download | `download-edit.js` (85 lines) | `.live()`, `$.glue.backend` | Standard pattern, no jQuery UI | Low |
| object | `object-edit.js` (171 lines) | `$.glue.slider` (transparency), `$.glue.stack` | Standard pattern | Low |
| video | `video-edit.js` (205 lines) | `.attr()`/`.removeAttr()` toggles, native `loadedmetadata` listener already used | Mostly boolean attribute toggles | Low |
| webvideo | `webvideo-edit.js` (183 lines) | `$(obj).data()` used as a manual client-side cache | Replace `.data()` cache with a plain object/WeakMap. **Pre-existing bug found**: `register_alter_pre_save('iframe', ...)` at line 179 registers under the wrong module name (`'iframe'` instead of `'webvideo'`) — copy-paste artifact from `iframe-edit.js`; worth fixing while touching this file | Low, +1 bug fix |
| iframe | `iframe-edit.js` (118 lines) | `$.browser.webkit` browser-sniff workaround (`.src` reassignment hack, lines 78-92) | `$.browser` removal makes the workaround permanently dead code (functionality regression on Chrome, not a crash) — needs an explicit fix, not just deletion, when porting | Medium |
| lock | `lock.js` (83 lines) | **Direct** `.draggable('disable'/'enable')`/`.resizable('disable'/'enable')` calls | Load-bearing on whatever drag/resize library is chosen (Moveable) — must be ported alongside the core engine, not independently. Also documents a project-wide convention (`lock.js:11-17`): any module binding handlers to objects must exclude `.locked` — preserve this semantically | Medium |
| page | `page-edit.js` (295 lines) | Farbtastic colorpicker, `$.glue.slider` ×2, `$.glue.upload.button` | Colorpicker → native `<input type=color>` per §5/§6 | Medium |
| image | `image-edit.js` (270 lines) | `.clone()` + `.one()` one-shot custom events for image-preload flicker avoidance (lines 96-132); Firefox-specific comment re: `background-position-x/-y` | The clone/preload/swap dance is bespoke DOM+timer choreography, not a jQuery idiom per se — needs careful direct porting, not a mechanical find-replace | Medium-High |
| text | `text-edit.js` (774 lines, largest module file) | 5× `$.glue.slider` controls, Farbtastic ×2, `.live()` ×3 for `stopPropagation()` isolation between textarea typing and canvas drag/select | See risk register §8 — several genuinely fragile, load-bearing behaviors here | High |

## 8. Hidden difficulties / risk register

Ranked by how easy each is to silently break:

1. **Text-editing event isolation** (`text-edit.js:302` area) — `.live()` binds on
   `mousedown`/`keydown`/`keypress`/`keyup` inside the text-editing textarea exist
   specifically to `stopPropagation()` so typing doesn't trigger the canvas's
   document-level drag/selection handlers. A comment documents a
   **Chrome-10.0.634.0-specific quirk** requiring explicit re-application of
   background-color to the child textarea — evidence this interaction has broken
   before and needed a targeted fix. Port this behavior explicitly and test typing
   + simultaneous canvas interactions, don't assume it "just works" once jQuery is
   gone.
2. **Save-serialization equivalence.** `$.glue.object.save()`
   (`edit.js:891-907`) turns a cloned DOM node into an HTML string, which is the
   literal on-disk persistence format for every object in every existing Hotglue
   page. `text-edit.js:757-773`'s `register_alter_pre_save` strips the live
   `<textarea>`/`.glue-text-render` DOM first, with a comment explaining that
   naive `.val()` serialization double-HTML-encodes textarea content. Any
   replacement of the outerHTML step (trivial: `element.outerHTML`) must be
   verified to produce byte-for-byte-equivalent-enough HTML that existing stored
   pages still parse correctly on load.
3. **`.data('owner')` contract** (§4) — 47 call sites across ~15 files depend on
   this. Needs a single, well-defined replacement mechanism (WeakMap) introduced
   once, in `edit.js`, before touching any consumer.
4. **jQuery UI's implicit auto-scroll near viewport edges** — never explicitly
   coded, easy to lose. Add to the Playwright test list explicitly.
5. **`webvideo-edit.js:179` pre-save hook bug** — pre-existing, unrelated to
   jQuery, worth fixing during the same touch (see §7 table).
6. **Unescaped tooltip interpolation** — `edit.js:1617`,
   `.prepend('<input type="file" title="'+options.tooltip+'" ...>')` interpolates
   `options.tooltip` into an HTML string with no escaping. Low risk today
   (tooltips are hardcoded strings from other module code, not user input) but a
   latent XSS pattern worth closing while rewriting this code path.
7. **`module_image.inc.php:396` intval() paren bug** (PHP side, found during the
   PHP scan, not jQuery-related) — `intval($obj['image-resized-height'] ==
   $height)` should be `intval($obj['image-resized-height']) == $height`; the
   `intval()` of a boolean always yields 0 or 1. Fix alongside other image-module
   work.
8. **Safe deletions** (do these first, zero risk, immediate cleanup value):
   `modules/transform/jquery.transform-0.9.3.min.js`,
   `modules/transform/jquery-css-transform.js`,
   `modules/transform/jquery.transform2d.js` (confirmed dead — §7); the legacy
   `sendAsBinary`/`getAsBinary` multipart fallback in `edit.js:1692-1730`;
   `modules/firefox/` entirely (module already disabled via
   `module_firefox.inc.php-disabled`, confirm with maintainer before deleting
   since it's currently just unreachable rather than removed).

## 9. Migration strategy & phases

Strangler-fig: `edit.js`'s public `$.glue.*` API surface (method names,
signatures, event names fired via `.trigger()`/now `CustomEvent`, and the DOM
class-name conventions `.object`/`.glue-selected`/`.locked`) stays stable
throughout, so consumer files (§7) don't need to change in lockstep with the
core. Suggested order:

- **Phase 0 — free wins, no architecture change.** Delete dead transform-plugin
  files and dead upload fallback code (§8 item 8). Fix `webvideo-edit.js:179`
  and `module_image.inc.php:396`. Swap `glue.js`'s `$.post()` for `fetch()`
  behind the same `$.glue.backend()` signature.
- **Phase 1 — color picker.** Replace Farbtastic with native
  `<input type="color">` in `page-edit.js` and `text-edit.js`; reimplement
  xcolor's complementary/average math inline in `edit.js`'s grid module. Delete
  `js/farbtastic.js`, `js/jquery.xcolor-1.2.1.js`, `css/farbtastic.css`.
- **Phase 2 — canvas core: drag/resize.** Port `$.glue.object`'s
  register/unregister to wire up Moveable's `Draggable`/`Resizable`/`Snappable`/
  `Groupable` instead of jQuery UI, preserving all custom behavior (grid-snap
  toggle, axis-constrain, keyboard nudge, multi-select sync via `Groupable`).
  Explicit test for viewport-edge auto-scroll (risk register #4). Port `lock.js`
  in the same phase since it directly calls the widget API being replaced.
- **Phase 3 — event bus & `.data()` replacement.** Introduce the WeakMap-based
  `.data('owner')` replacement and convert `.trigger()`/`.live()` to
  `CustomEvent`/`addEventListener` with delegation, still under the same
  `$.glue.*` method names.
- **Phase 4 — per-module panel ports to Alpine.js.** Module-by-module, starting
  with the trivial ones (`page_browser-edit.js`, `revisions_browser-edit.js`,
  `user_code-edit.js`), ending with `text-edit.js` last given its size and the
  fragile event-isolation behavior in risk register #1.
  `image-edit.js`'s clone/preload dance (risk register item, §7) is the other
  high-care port — schedule with dedicated manual QA.
  Fix the `iframe-edit.js` `$.browser.webkit` regression (§7) during this phase.
- **Phase 5 — remove jQuery/jQuery UI entirely** from `default_html()`/
  `controller_edit` once no file references `$`/`jQuery` anymore. Delete
  `js/jquery-1.5.2*.js`, `js/jquery-ui-1.8.6*.js` and associated CSS handle
  classes if no longer targeted (`css/edit.css:131,137-148`'s
  `.ui-resizable*`/`.ui-draggable-dragging` selectors — recheck against
  whatever DOM structure Moveable produces; note Hotglue never used jQuery UI's
  ThemeRoller CSS, only its structural/behavioral output, so there's no theme
  CSS to strip).
- **Ongoing — Playwright suite** (§11) built up alongside phases 2-4, not
  bolted on at the end, so each phase is checked against the previous behavior
  before the next begins.

## 10. PHP modernization plan (surface-level scope)

**Status (2026-07-31): items 2-6 done, item 1 done in a scoped form, item 7
already done.** On closer inspection during implementation, most of the
~204 `@`-suppressed calls this section originally flagged turned out to be
legitimate uses unrelated to null-safety (filesystem/GD operations like
`@mkdir`/`@unlink`/`@fopen`/`@getimagesize`, plus `@define`/`@require_once`
for idempotent/optional loading) - only two things were real risks: the
named `save_state()` bug (fixed - see below) and the 32-site
`@is_array()`/`@is_string()`/`@is_numeric()` idiom (converted to explicit
`isset()` checks). The 38 `global` declarations and auth hardening remain
out of scope, as originally decided in §13.

No PHP 8.0–8.5 fatal blockers found (zero hits for `create_function`, `each()`,
`ereg*`, old `mysql_*`, `utf8_encode`/`decode`, `${}` interpolation, curly-brace
string offsets — codebase is clean on hard removals). Work items, in priority
order:

1. **Null-safety pass** (highest priority — the one real PHP 8.1+ deprecation-
   notice risk). Centers on `html.inc.php`'s `elem_attr()`/`elem_css()` getters,
   which explicitly `return NULL;` when a key is absent (`html.inc.php:143,180`),
   and the ~213 `@`-suppressed calls that exist precisely because a key might be
   missing — dominant idiom is `@is_array($elem['key'])` /
   `@is_string(...)` standing in for `isset()`. Worst-offender files:
   `module_glue.inc.php` (43 `@` sites), `html.inc.php` (32). This needs a
   file-by-file manual pass (replacing `@is_array($x['k'])` with
   `isset($x['k']) && is_array($x['k'])` or `??`), not a mechanical script,
   since some suppressions are hiding real null-propagation paths (e.g.
   `module_glue.inc.php:1225,1230,1234,1238` pass `elem_attr($elem, 'id')`
   — which can return `NULL` — straight into `object_exists()`, `_obj_lock()`,
   `load_object()`, `quot()` with no guard).
2. **Mechanical `array()` → `[]`** — 266 sites across 20 files, safe to
   script/regex, zero behavior change.
3. **`E_STRICT` reference** — `config.inc.php:12`,
   `error_reporting(E_ALL & ~E_STRICT);` → `error_reporting(E_ALL);`
   (`E_STRICT` was folded into `E_ALL` in PHP 5.4; referencing the standalone
   constant is deprecated as of PHP 8.4).
4. **Dead version-gated code** — `tests/UtilTest.php:12`'s
   `version_compare(PHP_VERSION, '7.1', '>=')` skip-guard and its target
   polyfill (`util.inc.php`'s `is_iterable()` shim) are permanently dead on any
   supported PHP 8.x floor; delete both. `common.inc.php:348`'s
   `version_compare(PHP_VERSION, '5.3.0', '>=')` branch is similarly always-true;
   collapse to the single branch.
5. **`list()` → `[]` destructuring** — one occurrence,
   `common.inc.php:283`.
6. **Test tooling** — `tests/UtilTest.php:31-33` uses the `@expectedException`
   PHPUnit docblock annotation, deprecated in PHPUnit 8, removed in PHPUnit 10+;
   update to `$this->expectException(...)` if/when the test suite is touched.
7. **Incidental bug fix** — `module_image.inc.php:396` (see §8 item 7).

Explicitly **not** in this pass (see §13): the 38 `global` declarations
concentrated in `html.inc.php` (17) and `modules.inc.php` (9), and auth hardening
(HTTP Basic uses a plaintext, non-constant-time `==` compare —
`common.inc.php:286`; HTTP Digest's MD5 usage is RFC 2617-mandated, not a PHP
issue).

## 11. Testing strategy

No JS test infrastructure exists today. Playwright e2e scenarios to add,
matched to the risk register (§8):

- Select a single object; drag it; verify position persists after reload.
- Multi-select (shift-click) two+ objects; drag one; verify all move together
  (Groupable sync — the highest-value regression test given this was entirely
  custom code before).
- Resize via each of the 8 handles.
- Ctrl-drag to toggle grid snap mid-drag; Shift-drag to constrain to an axis.
- Keyboard arrow-key nudge of a selected object.
- Drag an object near the viewport edge — verify auto-scroll still occurs
  (regression target for the implicit-behavior-loss risk, §8 item 4).
- Type inside a text object's textarea while another object is selected —
  verify canvas drag/selection handlers don't fire (§8 item 1).
- Lock an object; verify drag/resize are disabled and it's excluded from
  keyboard/mouse handlers bound by other modules (§7, `lock.js`).
- Upload an image; verify the preload/flicker-avoidance swap completes cleanly
  (§7, `image-edit.js`).
- Save and reload a page containing at least one object of every module type;
  diff persisted HTML structure before/after the migration for each module as
  it's ported, to validate save-serialization equivalence (§8 item 2).

## 12. Browser support baseline

Modern evergreen only: current Chrome, Firefox, Safari, Edge (roughly last 2
years). No IE, no polyfills for Pointer Events, ES modules, optional chaining,
or `<input type="color">`. This supersedes the ~2011-era Firefox 3.6+/Chrome
8+/IE8 targets in `INSTALL`/`config.inc.php`'s `IE8_COMPAT` flag — `IE8_COMPAT`
itself only ever affected `background-size` fallbacks in the image/iframe
modules (`module_image.inc.php:115`, `module_iframe.inc.php:74`), not the JS
being replaced here, and can be removed once this migration lands.

## 13. Deferred / explicitly out of scope for this pass

- **PHP global-state architecture** (`$html`, `$hooks`/`$modules`/`$services`
  globals in `html.inc.php`/`modules.inc.php`) — real testability improvement,
  but a separate, larger effort; revisit once the JS migration is stable.
- **Auth hardening** (constant-time comparison for HTTP Basic, moving off
  MD5-based HTTP Digest) — flagged as a known limitation, not requested as part
  of "jQuery removal + PHP8.5 cleanup," and changing auth mechanics has its own
  compatibility/deployment considerations that deserve separate discussion.
- ~~**Custom-styled color-picker UX**~~ — *actioned 2026-08*: the native
  `<input type="color">` picker's platform-dependent UI (a swatch grid on
  some Linux/Chromium setups) turned out to be a real complaint - trying
  shades required repeatedly reopening/confirming instead of a continuous
  drag-to-preview. Replaced with the vendored `js/vanilla-picker.js`
  library behind the same `$.glue.colorpicker` API, so `page-edit.js`/
  `text-edit.js` needed no changes. See README's "RECENT CHANGES".
- **Build-step tooling** (esbuild/Vite) — deferred in favor of no-build ES
  modules; revisit if/when npm dependency management (for Moveable/Alpine
  version bumps) becomes painful to do by hand.
