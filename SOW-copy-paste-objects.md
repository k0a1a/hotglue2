# SOW — Copy/paste objects between pages (same site)

Status: **BUILT** (2026-09-14) — a record of what was made, not a plan. Frequently
requested; it was on the roadmap's someday list. The object model made this clean:
objects are self-contained files with absolute coordinates, so they're portable by
design. What the brief got right and what it met on contact is at the end.

## Flow

Clipboard-style copy/paste:
1. Select an object, **Copy**.
2. Navigate to another page of the same site (or stay on the same page).
3. **Paste** — the object is recreated on the current page.

- **One object at a time** for v1 (multi-select copy is a later extension; design so it
  can grow to multi, but don't build it now).
- **Object-in-transit is held CLIENT-SIDE** (survives the page navigation between copy and
  paste — switching pages is a page load, so the clipboard must persist across it on the
  client).
- **Paste to the SAME page is allowed** — it acts as a duplicate; users may expect it.
  (Coexists with the existing "clone object on page"; don't let them conflict confusingly.)
- **Ctrl+C / Ctrl+V** work as well as the buttons, with the same guards the rest of the
  editor's shortcuts use.

## Storage model (determines the copy logic — get this right)

- **Fonts: per-SITE** (shared across the user's pages). A copied text object referencing a
  font STILL RESOLVES on the target page -> **do NOT copy fonts.**
- **Everything else (images, background images, uploads): per-PAGE** (lives in the source
  page's directory). A copied object referencing them would BREAK on the target page unless
  the asset is copied too -> **copy the object's referenced per-page assets into the target
  page's directory along with the object.**

So the copy rule: **copy the object + its referenced per-page assets (images/backgrounds/
uploads); SKIP fonts (site-global, already resolvable).** The asset-walk must distinguish
per-page references (copy them) from site-global font references (leave them).

## Copy — what's captured (client-side)

On Copy, capture a COMPLETE snapshot to client storage:
- The object's **complete property set** — every field in the object definition (see
  "complete-property copy" below).
- A **manifest of the object's per-page asset references** (images, background image,
  uploads it points at) — NOT fonts.
- The **source page id** (so paste knows where to copy the assets FROM).

## Paste — what happens (server-side write)

On Paste into the current page:
1. Write the object into the current page's `head/` under a **FRESH UNIQUE ID** — do NOT
   reuse the source id (the target page might already have it; ids must be unique per
   page). The paste is a NEW object with the same properties.
2. Place it at **original coordinates** (preserve position — users often copy an object
   specifically to keep it in the same spot across pages, e.g. a header/logo) and at the
   **TOP z-index** (so it's visible and selected, not hidden behind existing content). Do
   NOT offset — offsetting would break the position-preservation intent.
3. **Copy the referenced per-page assets** from the source page's directory into the
   target page's directory (skip fonts). Update the object's references if any asset is
   renamed (see collision handling).
4. Select the pasted object so the user can immediately move/edit it.

## Sharp edges to handle (the subtle, discovered-later bugs)

### Complete-property copy (recurring bug class)
Copy the ENTIRE object definition — not a hand-picked subset of fields. The object may
carry recent additions: custom classes, custom attributes, per-object glow/shadow/border,
heading designation, link, opacity, padding, etc. A copy path that enumerates known fields
will silently DROP newer ones. Copy everything the object file contains, so the feature is
future-proof as more object properties are added.

### Asset name collisions on the target page
If a copied image object's asset (e.g. `photo.jpg`) would collide with a DIFFERENT existing
asset of the same name already in the target page's directory, copying it in must NOT
overwrite the target's existing asset. Handle the clash:
- Copy the asset under a unique name (e.g. suffix/rename) and UPDATE the pasted object's
  reference to point at the new name.
- Never overwrite an existing target-page asset. (This prevents "I pasted an object and it
  broke a different image already on the target page.")

### Missing source asset at paste time
Because assets are copied FROM the source page on paste, if the source page (or its asset)
no longer exists when the user pastes (e.g. they deleted it after copying), handle it
gracefully: paste the object, skip/placeholder the missing asset, do NOT crash or fail the
whole paste. (Low-frequency edge, but must fail soft.)

### Fresh ID uniqueness
The generated id must be unique on the TARGET page specifically (check against the target
page's existing objects, not just globally-timestamp-unique).

## Out of scope (v1)

- Multi-object copy/paste (design to allow it later; not built now).
- Copy/paste BETWEEN different sites/users (this SOW is same-site only — same user's
  pages).
- Copying fonts (they're site-global; no need).

## Constraints

- Vanilla JS + Alpine (client-side clipboard, copy/paste UI), consistent with ng. No jQuery.
- Client-held clipboard must survive page navigation (copy on page A, paste on page B after
  a page load).
- Server-side write for paste (new id, asset copy, collision handling) — the client
  clipboard describes WHAT to paste; the server performs the file operations safely.
- Escaping/format care consistent with the object-file format (a pasted object must not
  corrupt the target page's head/).
- After editing any of hotglue's own JS, refresh the served copy with
  `node tools/make-min.js js/<file>.js` — there is no build step; `USE_MIN_FILES`
  defaults to true, so the `.min.js` is what a default install serves.

## Definition of done

- A user can Copy one object, navigate to another page (or stay), and Paste it; the object
  is recreated with ALL its properties intact (complete-property copy — no dropped fields).
- The paste lands at the object's original coordinates, on top (highest z-index), and is
  selected.
- Per-page assets the object references (images/backgrounds/uploads) are copied into the
  target page's directory; fonts are NOT copied (site-global, resolve as-is).
- The pasted object gets a fresh unique id (unique on the target page).
- Asset name collisions on the target page are handled by renaming (no overwrite of
  existing target assets); missing source assets fail soft (object pastes, asset skipped).
- Paste to the same page works (acts as a duplicate) without conflicting with existing
  clone.
- No corruption of the target page's object files; no jQuery.

## What was built

**The clipboard is client-side and versioned.** `$.glue.clipboard` (`js/edit.js`) holds one
snapshot in `localStorage` under `glue.object-clipboard`: `{v, source_page, name, attrs,
content, used_at}`. It is the object as it is STORED, not as it is on screen — which is
the whole "complete property copy" requirement, since the attributes the editor never shows
(`image-file-mime`, the original dimensions, anything added later) exist in no DOM element.
Every read is guarded and any failure — a corrupt value, a privacy mode where
`localStorage` throws — reads as "nothing copied", so the feature degrades to absent
rather than broken.

**It expires an hour after it was last used**, and a paste puts the hour back. localStorage
has no session to end, so without a clock the snapshot simply lived forever and the paste
item and its dot stayed lit for a copy made weeks ago; the timestamp is the whole of the
mechanism. Reading an expired snapshot deletes the key rather than only reporting it empty,
so the state is derived in one place — `has_clipboard()`, the dot and the Ctrl+V branch all
ask the same question. A paste does NOT consume the clipboard: the same object pastes as
often as you like, which is most of what it is for, and the hour is what bounds it.

**Two services, `module_glue.inc.php`.** `glue.get_object` resolves a symlink to what it
points at (assets live on the *resolved* page), loads the object and splits it into
`{name, page, attrs, content}`. `glue.paste_object` takes that snapshot plus a target page
and does the write: validate the page, walk the asset attributes, create the object under a
fresh id, save, append the id to `page-reading-order` if the page has one, and hand back
the rendered HTML. The client then does exactly what the clone button does with a new
object — `canvas.add`, `object.register`, select, `stack.to_top`, `object.save` — so the
paste lands selected, on top, and as a single undo step that Ctrl+Z deletes.

**The asset walk uses the project's own definition of a reference**: the attribute list
mirrored by the modules' `has_reference` hooks (`image-file`, `image-resized-file`,
`download-file`, the four video attrs, `object-background-file`). Fonts are absent from it
by design and there is no field enumeration anywhere in the path — a new per-page asset
attribute needs adding to that list, and nothing else.

**Renaming reuses the upload path's helpers**, so a paste names files the way an upload
does: `dir_has_same_file()` first (a same-page paste is byte-identical and reuses the name
rather than duplicating the file), then `unique_filename()`, which starts at `_2`.

### Where the brief met the code

- **"TOP z-index" is the editor's own `to_top`**, not `max+1` (danja's call): the paste
  goes above the objects it actually intersects, inside the 0–199 band, and is a no-op
  when it overlaps nothing. A literal maximum would have pushed pastes past the band the
  rest of the editor keeps its stack in.
- **Same-page paste overlays the original**, at identical coordinates, as the brief
  requires. Clone offsets by a grid cell. The two behaviours coexist deliberately.
- **A symlinked object is copied as its target**: resolving in `get_object` means the
  paste carries the target's attributes *and* takes the asset from the target page's
  `shared/` — not the linking page's, which is where a naive copy would have looked.
- **The clipboard mark is a dot, not the editor's green.** `glue-menu-enabled` is the house
  "this state is on" colour and was the first attempt, but every other green in the editor
  describes the thing whose menu it sits in, and the clipboard is one slot for the whole
  editor: copy object A, select object B, and B's button read as if B were what was copied.
  A 2px dot in the icon's top right corner instead
  (`.glue-btn-icon.glue-clipboard-full::after`) says "the buffer is not empty" without
  claiming anything about the object — a badge, the way a corner mark is read.
- **A defect surfaced on the way**: `glue-menu-enabled`'s green can never paint on a
  `.glue-btn-icon`. Both selectors are one class and the icon frame's own fill is set in a
  later rule in `css/edit.css`, so the state was silently invisible on every icon button
  that tried it (only the older PNG-background toggles ever worked). Recorded as a comment
  on the rule, since the next stateful icon button will meet it.
- **`load_object()` returns content as `false`**, not `''`, when a file ends straight
  after its attributes. That travelled into the snapshot as a boolean and is now
  normalized to a string in `glue.get_object`.

### Known limits

- **One object at a time.** Ctrl+C ignores a multi-selection rather than half-copying it;
  the snapshot format carries a single object, and the seed of a `clipboard` array is
  there for a later multi version.
- **Same site only**, as scoped — the clipboard names a source page on this install.
- **The clipboard is not per-user, and an hour is its only bound.** localStorage belongs to
  the origin, so on an install where two editors share one, the second inherits the first's
  clipboard until it expires. The version check is what makes the format safe to change:
  `version: 2` added `used_at` and an older snapshot reads as "nothing copied" rather than
  as a corrupt object.

### Tests

`tests/e2e/copy-paste.spec.js` — 12 tests, both engines. They assert on the page directory
as well as the DOM, because the client half and the server half are separate code paths: a
paste that looks right while writing the wrong file is the failure worth catching. Beyond
the happy paths that covers collision renaming (with the target's file checked byte for
byte), a source asset that has vanished, the font registry left untouched, a symlinked
source, the empty-clipboard button state, Ctrl+C/V inside a text field, undo, the hour
running out and being put back, and a hand-written clipboard trying to walk asset names out
of the page's shared directory.
