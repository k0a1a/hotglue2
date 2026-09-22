# SOW — Download object (standalone box, or wrapped around text/image)

Status: BUILT (2026-09-22, danja's decisions). A download object holds an uploaded file
(pdf, zip, doc, any non-renderable type) and makes it downloadable on click.

As built: the wrap is BY REFERENCE with the TARGET's own render emitting the
`<a href download>` (decision b - the link pattern; view-only, the editor stays untouched so
the wrapped object edits normally). The box is 50x50, 2px border, 80% transparent, the file's
MIME subtype inside (full MIME as the tooltip, the extension as fallback). The box's attach
- the FIRST item of its menu's upper bar, nothing on the box itself (danja's call,
2026-09-22) - wraps the box
around the ONE text or image object currently selected: shift-click multi-select IS the
picking gesture (the earlier click-to-pick mode is gone). The
menu's attach falls back to the last compatible object selected, since the click that
opens the menu collapses the selection; the box never rotates and its menu carries no
overflow toggle. Text and image menus gain
attach/detach (attach uploads a file as a NEW download wrapped around the target; detach
puts the box back at its saved position). The pair is two attributes -
`download-wrap` on the target, `download-wrap-target` on the download, written via
glue.update_object. Copy-paste carries the pair and the file; deleting either half unwraps
the other; a private download wraps nothing in view. Tests:
tests/e2e/download-wrap.spec.js. It renders EITHER as its own
default box (MIME type shown) OR, when "wrapped" around a compatible object (text/image),
borrows that object's appearance so the download blends into the page's design. Reuses the
object model, the existing URL-link behaviour, per-page asset storage, and copy-paste asset
logic.

## Two states of a download object

The download object always holds a file (the "which file" is its constant property). Its
APPEARANCE has two states:

- **(a) Standalone** — default rendering: a box showing the file's MIME type / a label.
  A complete, usable download on its own (place it, it's a download box).
- **(b) Wrapped** — associated with a compatible object (a text object or image object);
  the download then borrows THAT object's appearance. The wrapped text/image becomes the
  clickable download; the default box is not shown. This is how an author customizes a
  download's look — by wrapping it around something they've already styled.

The download BEHAVIOUR (click → download the file) is identical in both states; only the
appearance differs (own box vs. wrapped object's look).

## The wrap — by reference, non-destructive, = `<a href download>`

- "Wrapping" means: at render, the wrapped object's markup is enclosed in
  `<a href="<file>" download="<friendly-name>">…</a>`. A wrapped text object renders as
  `<a href download>[the styled text]</a>`; a wrapped image as `<a href download>[the img]</a>`.
  The wrap IS this `<a>` enclosure.
- **By reference, not merge:** the download object stores a reference to the wrapped
  object's id ("I wrap object X"); at render, X's markup is wrapped. Both objects keep
  their own identity and data. **Non-destructive and reversible** — detach just drops the
  reference; both objects remain intact. (Consistent with the codebase's
  non-destructive/reversible patterns.)
- The wrapped object keeps ALL its own styling and editing — a wrapped TEXT object still
  uses the full text controls (font/size/color/underline/etc.), a wrapped IMAGE keeps its
  image properties. The download adds click-to-download AROUND it; it does not restyle it.
  (This is why the download object needs no styling controls of its own for the wrapped
  case — it borrows the target's.)

## Editor vs. view behaviour (the link pattern — already solved for URL links)

- **View mode:** clicking the download (standalone box, or the wrapped text/image)
  downloads the file.
- **Editor mode:** clicking a wrapped object EDITS it as normal (select/edit the text, move
  the image) — the download does NOT trigger. Download is a VIEW-MODE behaviour, inert in
  the editor, exactly like URL links don't navigate while editing. The wrapped object stays
  fully editable in the editor.
- No dashed editor indicator on the wrapped target (danja's call, 2026-09-22 - the outline
  went away; the menus and the hover-only title carry the association, which is visible,
  not hidden, either way).

## Attaching / detaching

Two ways to attach a download to a compatible object (mirror whatever's easiest + most
Hotglue):
- **Selection + the box's attach icon**: select a text/image object (shift-click for
  several, though the attach takes exactly one), press the attach icon on the download
  box - the box wraps the selected object. Multi-select is the picking gesture; the
  earlier click-to-pick mode was replaced by it (danja's call, 2026-09-22).
- **Attach button** on a compatible object's controls → opens the standard uploader →
  the uploaded file becomes the wrap target's download. (Also: attach could open a picker
  to point at an existing download object, or just upload — decide; upload is the simplest
  primary path.)
- **(Optional / later) drag a standalone download object onto a compatible object** to
  wrap it — direct-manipulation. This needs a drop-to-associate interaction (detect a
  download object dropped onto/over a text/image and interpret as "wrap"). Nice and very
  Hotglue, but it's a NEW interaction primitive (object-dropped-onto-object) — see
  Scope/phasing; can be a later enhancement over the attach-button.
- **Detach button** (shown on a wrapped object) → removes the wrap: the download object
  reverts to its standalone box (placed at a sensible position — e.g. where it was, or near
  the object), the text/image reverts to plain (no download). Reversible, loses nothing.

## Compatible objects

- **Text and image** objects can be wrapped (things where "click to download" makes sense).
- Exclude objects with their own click behaviour where a download wrap conflicts (e.g.
  video — it has its own controls). Define the compatible set explicitly; text + image for
  v1.

## Standalone download object's own bits

- Always owns the **file reference** (which uploaded file) and a **friendly download name**
  (the `download="…"` attribute — so `zine_final_v3.pdf` can download as `my-zine.pdf`,
  independent of the raw uploaded filename).
- In standalone state, renders the default box with the MIME type / a label. (Minimal — its
  purpose is either to be used as-is or to be wrapped.)

## PDF inline display — SEPARATE mode (noted, not the download behaviour)

- PDF is special: it can be DISPLAYED inline, not just downloaded. That's a DIFFERENT
  feature — a PDF rendered in a box via the browser's native viewer
  (`<embed>`/`<object>`/`<iframe>` at the PDF), NOT the `<a download>` wrap.
- Scope it as a separate "display inline" mode for PDF file objects (native browser embed,
  no PDF.js dependency for v1). A PDF can thus be either a download (wrap/box, all types) or
  an inline display (PDF only). Keep this distinct from the download-wrap; can be a follow-up
  to the download object.

## Asset handling & copy-paste

- The file is a **per-page asset** (like images) — stored in the page's directory, served
  for download. Participates in the copy-paste asset logic (SOW-copy-paste-objects.md):
  copying a wrapped text object must copy the download's file too, AND carry the wrap
  reference so the copy is still a download (copy both objects + the association, or the
  wrap breaks). Copying a standalone download copies its file.
- **Safe download serving:** serve uploaded files with `Content-Disposition: attachment`
  (or the `download` attr) and correct `Content-Type`; ensure an uploaded file can NEVER be
  executed server-side (e.g. an uploaded `.php` must download, not run). Confirm the
  download path serves inert. (Reuse existing upload-handling safety.)

## Scope / phasing

- **v1:** download object with standalone box + wrap-via-attach-button around text/image;
  detach; per-page asset + copy-paste-with-wrap; safe serving.
- **Later / optional:** drag-a-download-object-onto-a-target to wrap (the drop-to-associate
  interaction primitive); PDF inline-display mode; custom download-box styling; file-size
  display; thumbnails.

## Constraints

- Vanilla JS + Alpine, consistent with ng. No jQuery.
- Wrap is by reference (non-destructive), rendered as `<a href download>` around the
  target; download is view-mode-only, inert in editor (link pattern).
- Reuses text/image styling (wrapped object keeps its own), the uploader, per-page assets,
  copy-paste asset logic.
- Safe file serving (attachment disposition, correct type, never executable).
- Build minified assets via the project's terser build.

## Definition of done

- A download object holds an uploaded file and renders as a default MIME box standalone, or
  wrapped around a text/image object borrowing its appearance.
- Wrapping is by reference (non-destructive/reversible) and renders as
  `<a href download>` enclosing the wrapped object's markup; the wrapped object keeps its
  own styling/editing.
- Clicking downloads in VIEW mode; in the EDITOR the wrapped object edits normally
  (download inert); no dashed indicator on the wrapped target (2026-09-22).
- Attach (via attach button → uploader) associates a file with a compatible object
  (text/image); detach reverses cleanly (download → standalone box, target → plain).
- The file is a per-page asset served safely (attachment disposition, correct type, never
  executable); the file AND the wrap reference travel through copy-paste.
- Friendly download filename supported (`download` attr independent of raw filename).
- PDF inline-display is noted as a separate mode (not built as part of the download wrap in
  v1); drag-to-wrap is noted as a later enhancement over the attach button.
