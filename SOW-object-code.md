# SOW — Per-object code (CSS/JS), edited on the object, stored in page /code

Status: to implement (ng). v1. A "code" popout on an object lets the author write CSS and/or
JS "for this object" — but the code is actually stored in the page's `/code` (head),
auto-scoped to the object by its id. This gives the local/educational/cool UX of per-object
code WITHOUT the risks of storing code in the object file. SUPERSEDES the earlier
inline-custom-style approach (SOW-object-custom-style.md) — this /code-backed design covers
both CSS and JS and is safer.

## Why this architecture (edit-on-object, store-in-/code)

- **No object-file corruption.** Code (multi-line, special chars) lives in `/code` — which
  already safely stores arbitrary code — NOT in the flat key:value object file. The recurring
  escaping-bug risk on object files is sidestepped entirely.
- **Recoverable (separate = safe).** Broken user code sits in `/code`, separate from the
  object; the object itself never gets tangled with broken code. One place to fix/clear.
- **Same security surface as `/code`, not a new one.** The code ends up in `/code` anyway, so
  this is the EXISTING `/code` capability with a friendlier per-object front-end — no new
  injection vector; inherits whatever guardrails `/code` has.
- **CSS auto-scopes cleanly.** Prefixing the user's CSS with the object's id selector
  (`#<objid>`) confines it to the object automatically — the user doesn't need to know the id
  or write selectors.
- This also RESOLVES the earlier "CSS per-object yes, JS stays in /code" split: per-object JS
  is no longer riskier than /code JS — it IS /code JS, just edited through the object.

## v1 — the working core

### The popout
- A "code" action on an object opens a popout with a **textarea**.
- The user writes **`<style> ... </style>` and/or `<script> ... </script>` blocks** in the
  textarea. The tags denote TYPE (style vs script); the user can include multiple blocks and
  mix both (styling + behaviour for the object together). This is the clear, DIY-legible way
  to let them write both.

### Scoping (automatic — the UX win)
On save, the textarea content is stored in the page `/code` (head), auto-associated with THIS
object by its id — the user does NOT write the id or selectors:
- **`<style>` content** -> auto-scoped to the object: prefix the user's rules with the
  object's id selector (`#<objid>`) so the CSS affects only this object (and its children).
  Handle the common cases (plain rules, and declarations the user may write expecting "this
  object"); for v1, scope by id-prefixing the emitted CSS. (Selector-rewriting edge cases
  like `@media`/`:hover`/comma-selectors: handle reasonably; a simple robust prefixing that
  covers the common cases is enough for v1 — note any limitation.)
- **`<script>` content** -> stored in `/code`, wrapped so it (a) runs AFTER the object exists
  in the DOM (DOMContentLoaded / after render — an object-scoped script that runs before its
  object exists would fail), and (b) is HANDED A REFERENCE to the object element (e.g. a
  variable/`el` = the `#<objid>` element) so the user can act on "this object" without
  knowing the id.

### Honesty about JS scope (do not over-promise)
- CSS is genuinely CONFINED by the id-prefix. JS is NOT — it runs in the global page context;
  it's given a HANDLE to the object but can still touch anything on the page (it IS JS, same
  as `/code` JS). So per-object JS is "JS with a reference to this object", NOT "JS sandboxed
  to this object". Don't imply sandboxing in the UI.

### Editing round-trip (part of v1 — don't skip)
- Reopening the "code" popout must show the user WHAT THEY WROTE (their `<style>`/`<script>`
  blocks), NOT the id-scoped/wrapped version generated for `/code`. So: store their RAW input
  (to show back) and generate the scoped/wrapped `/code` version from it, OR reliably
  strip-the-scoping for display. The user always sees their clean code, not the machinery.

### Storage model
- The object's code lives in the page `/code`, keyed by the object's id (which is stable/
  immutable — confirmed in the object-properties work). The object file itself is unchanged
  (it already has the id).
- Keep the user's raw input associated with the object id (for the round-trip) plus the
  generated scoped `/code` output.

## Lifecycle details (v1)

- **On object delete:** remove the object's associated `/code` block (tidiness — otherwise an
  orphaned block referencing a now-missing id lingers; harmless but cruft). Remove on delete.
- **On object copy/clone:** a copied object gets a NEW id, so its `/code` reference won't
  match — copying an object with associated code must copy AND re-id the code block to the new
  object's id, or the copy loses its styling/behaviour. (Ties to the copy-paste-objects asset
  logic — carry the associated code like an asset.)
- **Id stability:** the code references the object by its immutable id, so the reference won't
  break under normal editing. Good.

## Safety (inherited + explicit)

- Same security surface as `/code` (no new injection vector) — inherits `/code`'s guardrails.
- CSS confined by id-prefix; JS associated-not-confined (stated honestly).
- Object JS runs only after the object is in the DOM.
- Escaping: storing in `/code` avoids object-file corruption; still emit/store safely per the
  normal `/code` handling.
- Multi-tenant: unchanged from `/code` — it's the same capability, same per-subdomain origin
  isolation.

## Out of scope — staged for later (keep v1 focused)

- **v1.5 — example snippets:** a small curated set of examples the user can insert (e.g. CSS
  "make this object orbit in a circle", JS "randomise that movement", a couple more). This is
  the educational/delight payload and is worth doing SOON — but it's content to write, not
  mechanism, so it does NOT block the v1 core. Fast-follow.
- **v2 / maybe — last-N-inputs history dropdown:** a dropdown of the user's recent code
  inputs. Deferred: convenience not capability, unclear value (recent snippets across
  different objects may not be relevant to the current one), extra machinery. Add later only
  if users want it.

## Constraints

- Vanilla JS + Alpine (popout), consistent with ng. No jQuery.
- Store in page `/code` keyed by object id; object file unchanged.
- CSS auto-scoped by id-prefix; JS wrapped to run-after-object-exists + handed the object
  reference.
- Clean editing round-trip (show raw user input, not generated machinery).
- Remove associated `/code` on object delete; copy+re-id on object copy/clone.
- Build minified assets via the project's terser build.

## Definition of done

- A "code" popout on an object offers a textarea where the author writes `<style>` and/or
  `<script>` blocks (multiple/mixed allowed).
- On save, the content is stored in the page `/code` keyed by the object's id: CSS
  auto-scoped via `#<objid>` prefix (confined to the object); JS wrapped to run after the
  object exists and handed a reference to it.
- Reopening the popout shows the author's own clean input (not the scoped/wrapped version).
- Object delete removes the associated `/code`; object copy/clone copies and re-ids it.
- No object-file changes/corruption; same security surface as `/code`; JS honestly
  "associated not confined" (no sandboxing implied).
- Examples (v1.5) and history dropdown (v2) are explicitly deferred — v1 is the textarea +
  scoped-/code-storage + round-trip core.
