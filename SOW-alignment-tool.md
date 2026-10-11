# SOW — Alignment tool (multi-object), anchored to the first-selected object

Status: to implement (ng). Align multiple selected objects relative to an ANCHOR (the
first-selected object), via an explicit multi-selection toolbar that appears on the anchor.
Removes the current friction of pixel-by-pixel nudging to line objects up.

## Core model

- **Anchor = the FIRST-selected object.** When several objects are selected, the one
  selected FIRST is the anchor; the others align TO it. This is predictable and gives the
  user control ("pick the one to line up with, then the ones to line up to it"), avoiding
  the "align to what?" ambiguity of bounding-box/topmost approaches. *(Revised 2026-10-09 at
  danja's call: the FIRST-selected object. Pick the reference first, then the things to line
  up to it, so the toolbar sits where you started; letting go of the anchor hands it to the
  next-selected one.)*
- **Explicit alignment modes — do NOT infer the axis from arrangement.** Inferring the axis
  from how objects are positioned ("mostly horizontal -> align horizontally") is
  unpredictable and fights common cases (e.g. aligning the TOPS of a horizontal row). Offer
  the alignment modes and let the user pick:
  - Horizontal: **align left / center / right** (objects' left edges / centres / right edges
    line up with the anchor's).
  - Vertical: **align top / middle / bottom**.
  - These use the conventional, instantly-recognizable align icons.
- **Center as the sensible default/first action** — the most common "just line these up".
  (Center is an explicit default, NOT an inferred axis.) The other modes are a click away.

## Where the menu appears — Option A: on the anchor, anchor visually marked

- The alignment controls appear as a small toolbar attached to the ANCHOR (first-selected)
  object — consistent with the editor's single-object contextual model (chrome attaches to
  an object), and semantically meaningful: the menu is on the thing everything aligns TO.
- **The anchor MUST be visually distinguished** from the other selected objects (e.g. a
  different selection-outline colour/style, or an "anchor" marker). This is REQUIRED, not
  optional, for two reasons:
  1. The user must know WHICH object is the anchor to predict the alignment result (the whole
     model depends on it).
  2. It explains why the menu is there (on the anchor = the align target).
- **Collision-aware positioning** — the anchor may be anywhere in the selection (buried,
  edge). Position the toolbar visibly (flip/shift to stay on-screen, avoid fully overlapping
  other objects), reusing the popover/contextual-toolbar positioning logic.

## Frame it as the MULTI-SELECTION toolbar (extensible), not just "align"

Multi-selection is a new editor STATE with more multi-object actions likely later (distribute,
group, bulk lock/delete/move…). Build this as the **multi-select-actions toolbar** anchored to
the first-selected object, currently holding ALIGN, so future multi-object features have a
home — same pattern as the single-object contextual toolbar, for the multi-select state.

## Prerequisites (confirm in the selection model)

- **Selection remembers ORDER** — which object was selected first (= anchor). Confirm the
  selection model tracks selection order; if not, add it (small).
- **The anchor can be rendered distinctly** — confirm the selection rendering can mark one
  object (the anchor) differently from the others; if not, add it.
- (Moveable / the existing selection handling likely knows order and can style per-object —
  verify.)

## Behaviour

- Alignment applies to the OBJECT positions (absolute coordinates) — compute each non-anchor
  object's new top/left so the chosen edge/centre matches the anchor's, write the new
  coordinates (the normal save path). Applies live / on click.
- Multi-axis: left/center/right affect the horizontal coordinate; top/middle/bottom the
  vertical. The user can apply one then another (e.g. center horizontally, then align tops).
- Undo: alignment is undoable (reuse the existing undo).
- Only non-anchor objects move; the anchor stays put (it's the reference).

## Out of scope / later (v2)

- **Distribute** (even spacing between 3+ objects) — a natural companion in the same toolbar;
  frequently wanted ("space these evenly"). Note as v2.
- Grouping, bulk actions (lock/delete/move-together) — the multi-select toolbar is the home
  for these when/if added; not v1.
- Snapping / smart guides while dragging — separate, bigger feature; not here.

## Constraints

- Vanilla JS + Alpine, consistent with ng. No jQuery.
- Reuse the contextual-toolbar positioning (collision-aware) and the conventional align icons
  (per the UI codex — bare glyphs / consistent style; the align-left/center/right etc. icons
  are standard and recognizable).
- Anchor-distinction rendering is required (not optional).
- Alignment writes object coordinates via the normal save path; undoable.
- Build minified assets via the project's terser build.

## Definition of done

- Selecting multiple objects shows a multi-selection toolbar attached to the ANCHOR
  (first-selected) object, which is visually distinguished from the other selected objects.
- The toolbar offers explicit alignment modes — left / center / right / top / middle / bottom
  (conventional icons) — with center as the sensible default; the axis is NOT inferred.
- Applying an alignment moves the non-anchor objects so the chosen edge/centre matches the
  anchor's; the anchor stays put; changes write object coordinates and are undoable.
- The toolbar is collision-aware-positioned (visible even when the anchor is buried/edge).
- The selection model tracks selection order (anchor = first) and can render the anchor
  distinctly.
- Built as the extensible multi-select-actions toolbar (align now; distribute/other later),
  with distribute and bulk actions noted as v2.
