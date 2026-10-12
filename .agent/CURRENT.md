# Current handoff

## Task and status
Populating the project memory (`.agent/` docs + durable memory) from the
repo's own docs and prior session notes. No code task active.

## Established facts
- Checkout `src-ng` on branch `ng`, HEAD `422f7dd` (2026-10-07).
- Recent commits are the **code panel**: teaching it to write the object's own
  rules as `& { }` (the same form as `&.name` / `&:hover`); the scoper takes
  rules **with selectors only** (a bare declaration is dropped, with a warning
  in the panel while still saving what was written); and an icon push
  (c9890ca) that had to bring back `list-ordered.svg`, which it had dropped
  from the page menu's reading-order button.
- The e2e suite is hermetic Playwright under `tests/e2e/`, both engines;
  recent code-panel specs run 28 per browser.
- The editor is vanilla JS on the `$.glue.*` framework; jQuery removed
  (MODERNIZATION.md).
- Deployment (verified 2026-09-10): `/var/www-hotglue/src` (branch `dev`)
  serves hotglue.me root **and** every `user.hotglue.me` site; the public demo
  at hotglue.me/ng is `/var/www-hotglue/hotglue.me-ng` tracking `hotglue2`
  branch `ng-dev`; private ng work happens in `k0a1a/hotglue2-ng` branch `ng`
  (this clone). A commit on `ng` does NOT reach hotglue.me or any user site —
  work meant for the live platform has to land on `dev`.

## Changes made
- Populated SOW.md, ARCHITECTURE.md, `subsystems/editor-frontend.md`,
  CURRENT.md, and durable memory records. No source changes.

## Validation
- None run this session (no code changed). e2e: `npm run test:e2e`.
  PHPUnit: `composer install && vendor/bin/phpunit tests/UtilTest.php`.

## Relevant files and durable notes
- `handover.md` (operational summary, as of 2026-08-24), `ROADMAP.md`
  (backlog), `MODERNIZATION.md`, `POPOUT-PANELS.md`, `SOW-*.md`.
- Durable memory: pinch floor 0.25; Moveable onXxx/preventDefault/gesture
  traps; `$.glue.object.save` storage format; `$.glue.owner`; storage
  conventions; min.js staleness; e2e harness; deployment topology.

## Open questions and rejected approaches
Three decisions waiting, none of them code (from handover.md, still open):
1. **Merge `ng` to `dev`, or don't.** `ng` is well ahead of `dev` (117 commits
   as of the 2026-08-24 handover); `dev` is the default branch and has not moved.
2. **The icon set's licence** — upstream files declare CC BY-NC-SA 3.0;
   hotglue is GPLv3, which cannot carry a non-commercial restriction. Blocks
   release; needs whoever holds the rights.
3. **`$.glue.rangeslider` — adopt or delete.** Built for rotation (which went
   to direct manipulation instead); fully tested, no caller.

Highest-value work left (handover.md): editing on a phone past the first tap;
the last placeholder button (`clip`/`show`); centered mode's flat 960px default
width; and reproducing the reported padding bug BEFORE relocating it.

## Next concrete action
Nothing queued. Read `handover.md` first for anything deeper — it is the current
operational summary and is kept current as work lands.

## Resume instructions
Start a new chat with AGENT_INSTRUCTIONS.md as instructions. Call
project_state(). Load only the files needed for the next action. This handoff
replaces the old transcript.
