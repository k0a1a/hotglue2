# Architecture overview

Hotglue is a PHP web application for making free-form, drag-and-drop web pages
in the browser. **No database** — everything is flat files under `content/`,
addressed by dotted names (`page.revision.object`) that map straight onto
directories. An object is a file of `key:value` lines, a blank line, then its
content. That file format is the product; most of the care in this codebase is
about not disturbing it. Targets PHP 8.

## Main components
- `index.php` — view/edit entry point. `parse_query_string()` dispatches to
  controllers keyed on the first two positional query arguments.
- `json.php` — the editor's RPC. POST parameters are each individually
  JSON-encoded values.
- `module_*.inc.php` — feature modules, auto-discovered by `load_modules()`;
  a `-disabled` suffix turns one off. `module_glue.inc.php` = objects,
  revisions, locking.
- `html.inc.php` — programmatic HTML building (`body()`, `elem()`,
  `elem_attr()`, `html_add_css`/`html_add_js` asset queue, `html_finalize()`).
- `config.inc.php` / `user-config.inc.php` — settings as constants; the user
  file overrides.
- `js/edit.js` — the `$.glue.*` editor framework (canvas/sel/object/stack/menu/
  contextmenu/slider/colorpicker/upload/grid). Vanilla JS; Moveable for
  drag/resize, Alpine for a few reactive icons. ~40 dependent editor JS files
  (`modules/*/*-edit.js`) treat it as an API contract. Loads only inside the
  authenticated editor — never on a published page (the one visitor script is
  `js/mobile-guided.js`).
- `tests/e2e/` — hermetic Playwright suite (both engines).
  `tests/UtilTest.php` — PHPUnit for `util.inc.php`.

## Important interfaces and data flow
- Extension points: `register_controller($arg0,$arg1,$func,$args)`,
  `register_service($name,$func,$args)` / `run_service()`, and named hooks via
  `invoke_hook()` (module `image` + hook `render_object` =
  `image_render_object()`).
- **The round trip is the thing to understand.** An object is stored as
  attributes; `*_render_object()` turns attributes into DOM; `*_alter_save()`
  reads the DOM back into attributes. Anything not on that list is dropped on
  save. A feature is not finished until it survives save → reload → published
  page, which is why most specs end by loading `?page` without `/edit`.
- **Storage format**: `$.glue.object.save()` serializes an object to literal
  HTML — the on-disk format for every existing page. Changing serialization
  risks corrupting stored pages.
- **`$.glue.owner(elem[, obj])`** — a WeakMap-backed getter/setter, set once in
  `edit.js`, read at ~50 call sites across ~15 module files. Undocumented but
  load-bearing (replaces the old jQuery `.data('owner', obj)`).

## Build and test entry points
- Run: `php -S localhost:8001` (danja keeps :8000);
  `cp user-config.inc.php-dist user-config.inc.php`; `chmod -R 0777 content`.
- `npm run test:e2e` — Playwright, chromium + firefox, hermetic.
- `composer install && vendor/bin/phpunit tests/UtilTest.php`.
- After editing ANY of hotglue's own js: `node tools/make-min.js js/edit.js`
  (`USE_MIN_FILES` defaults true, so the `.min.js` copy is what a default
  install serves).
- `content-e2e/log.txt` is the debugging tool of choice — the suite runs
  `LOG_LEVEL=debug`.
- `img/icons/` is maintained directly (the upstream dir + `tools/prep-icons.js`
  are retired); `tests/e2e/icons.spec.js` guards the files' form.

## Further notes
- `subsystems/editor-frontend.md` — the `$.glue.*` framework, the storage
  conventions, and the editor-specific traps.
- In-tree, kept current: `handover.md` (operational summary — read first),
  `ROADMAP.md` (backlog), `MODERNIZATION.md` (jQuery-removal history),
  `POPOUT-PANELS.md` (panel contract), `SOW-*.md` (per-feature specs).
- Deferred by decision (picking one up reopens a decision, MODERNIZATION.md
  §13): the PHP global-state refactor, auth hardening, real build tooling.
