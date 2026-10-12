# Statement of work

## Project objective
Maintain and evolve Hotglue — a PHP web application for making free-form,
drag-and-drop web pages in the browser, with no database (flat files under
`content/`). The `ng` line carries the next-generation vanilla-JS editor;
production (the `dev` branch) serves hotglue.me and all user sites.

## Current milestone
The `ng` editor line: the vanilla-JS `$.glue.*` editor, the object **code
panel** (teaches `& { }` for the object's own rules; the scoper takes rules
with selectors only), the icon system, and the hermetic Playwright suite.
Recent commits (as of 2026-10-07) are the code-panel scoping and an icon push.

## Acceptance criteria
- A feature is done when it survives **save → reload → published page**
  (load `?page` without `/edit`), which is why most specs end there.
- Editor behaviour verified by the hermetic Playwright e2e suite on **both**
  engines (chromium + firefox); paint-critical specs A/B against a deliberately
  broken version. Tests assert what is STORED as well as what is drawn.
- Stored page content remains loadable: `$.glue.object.save()` output is the
  on-disk format — a serialization change must not corrupt existing pages.

## Constraints
- PHP 8; no database; content addressed by dotted names under `content/`.
- Vanilla-JS editor; no jQuery. Editor JS loads only in the authenticated
  editor and never ships to a published page (the one visitor script is
  `js/mobile-guided.js`).
- `css/main.css` ships to visitors; `css/edit.css` does not.

## Out of scope
- Service operations for a live install (accounts, UserCake, mail, hosting,
  moderation) — those belong in the account repo, not this one.
- The parity A/B stage (a deliberately separate side project).
- Reopening the deferred decisions: PHP global-state refactor, auth hardening,
  real build tooling (MODERNIZATION.md §13).

## Priority and authority
Project owner: danja. The owner's instructions define scope; verify
implementation facts against current source. Subsystem detail belongs in
focused notes; this file stays compact.
