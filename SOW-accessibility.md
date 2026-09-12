# SOW — Accessibility: semantic reading order, alt text, headings

Status: to implement (ng). A meaningful, overdue direction — prompted by a digital-art
teacher who STOPPED using Hotglue because pages were an "accessibility nightmare" (screen
readers couldn't follow the flow of text). Educational/institutional users often FACE
accessibility mandates, so this is disqualifying-if-absent for a whole audience, and the
ng overhaul is the cheap moment to build it in.

## The core problem

Hotglue's paradigm — absolute-positioned objects placed by pixel coordinates — decouples
VISUAL position from DOM/SOURCE order. Objects are emitted in creation/z-order, which is
arbitrary relative to the layout. Screen readers follow SOURCE order, so they read the
page in an order unrelated to what's on screen — "can't follow the flow of text." This is
inherent to "position anything anywhere," not a bug, but it IS fixable.

## Framing (honest scope)

Goal: make it POSSIBLE to build accessible pages, and make pages much MORE accessible BY
DEFAULT — NOT a guarantee of full WCAG compliance (contrast, focus, keyboard nav, ARIA
remain the author's/other work). The claim is "dramatically more accessible by default +
the tools to go further," not "fully compliant." Don't over-promise.

## Feature 1 — Automatic position-based DOM ordering (THE foundational win)

Emit object DOM in an order that follows VISUAL position — top-to-bottom, then
left-to-right — so source order matches the reading flow a sighted reader would follow.

- **Render-time sort, non-destructive.** At render, output object elements sorted by
  `object-top` (primary) then `object-left` (tie-break). Do NOT change stored data —
  objects keep their exact coordinates; only the ORDER of emission changes.
- **Visual layout is untouched.** Objects are `position:absolute`, so DOM/source order is
  independent of visual placement — reordering the source changes NOTHING visually. (Same
  independence the centered-layout wrapper relies on: source order and visual position are
  orthogonal.)
- **Retroactive + zero author effort.** Because it's automatic and derived from existing
  coordinates, EVERY existing page gets dramatically better screen-reader flow the moment
  this ships, with no author action. This is the highest-leverage part of the whole SOW.
- Tie-break rule with a ROW THRESHOLD (required): objects whose `top` values are within a
  small vertical threshold (N px) of each other count as the same "row" and are ordered
  left-to-right; rows are ordered top-to-bottom. This prevents tiny sub-pixel/near-alignment
  differences from scrambling a visual row's reading order. Make N a tunable constant;
  tune against real pages (start ~small, e.g. a handful of px, and adjust).

### Known limitation (why Feature 2 exists)
Pure top-then-left is correct for the MAJORITY of pages (roughly top-to-bottom layouts)
but WRONG for some:
- **multi-column layouts** — a human reads all of column 1 down, then column 2; top-sort
  interleaves columns (reads across rows) — wrong.
- **semantic groupings** — a caption meant to be read with its image, a sidebar meant to
  be read after the main text, etc.
- **intentionally non-linear/artistic** layouts where there may be no single right order.
So automatic ordering is the DEFAULT and a big improvement, but authors need an override.

## Feature 2 — Author-designated reading order (override for the exceptions)

Let the author explicitly set the reading sequence for a page's objects, overriding the
automatic position-based order where it's wrong (multi-column, grouped, artistic).

- UI to assign/reorder objects into an explicit reading sequence (e.g. a numbered order,
  or a drag-to-reorder list of the page's objects).
- When an author order is set, render emits objects in THAT order (still non-destructive
  to coordinates; still visually unchanged via absolute positioning).
- When no author order is set, fall back to the automatic position-based order (Feature 1).
- Store the author order as page/object metadata (e.g. an `object-reading-order` field or
  a per-page sequence list), consistent with the existing property scheme. Non-destructive
  to visual coordinates.

## Feature 3 — Easy alt text + decorative role on every image (cheapest, highest ROI — do FIRST)

Add to the IMAGE OBJECT PROPERTIES a coherent two-part control:
- **Decorative toggle** (meaningful vs. decorative) — the primary switch.
- **Alt-text input** — GATED by the toggle (see below).

Behaviour (the toggle gates the input — build them as ONE coherent control, not two that
can contradict):
- **Meaningful (toggle OFF, default):** show the alt-text input; author writes a
  description. Render emits `alt="<escaped text>"`, no `role`.
- **Decorative (toggle ON):** hide/disable the alt-text input (a decorative image must
  have EMPTY alt — there's nothing to write). Render emits `alt=""` AND
  `role="presentation"`, so screen readers correctly SKIP it rather than announcing
  "image". This prevents the invalid "marked decorative but has alt text" state.
- **Gentle no-alt nudge (non-blocking):** if an image is meaningful (not decorative) and
  has no alt text, show a subtle indicator in the editor — NOT a hard block (don't stop
  the author saving; just flag the accessibility gap). A decorative-marked image with
  empty alt is correct and gets NO nudge.

Render / escaping: emit `alt` (escaped — alt text is user input into an HTML attribute and
must not break the tag) and `role="presentation"` for decorative images. Usual
escaping-bug caution.

## Feature 4 — Semantic headings (H1-H3) on text objects

- Let the author designate a text object's semantic level: normal text, or heading
  (H1 / H2 / H3). Slots into the text/object properties UI already built (it's a property
  of the text, alongside font/size/style).
- Render: emit the chosen semantic element (`<h1>`/`<h2>`/`<h3>` vs. the normal text
  wrapper) so screen readers get the heading structure they use for navigation (jump
  between headings), and WAVE/WCAG heading checks pass.
- Keep visual styling independent of semantic level (an H2 shouldn't force a particular
  size — the author still controls appearance; the semantic tag is for structure, not
  look). Decouple "what element" from "how it looks".

## Priority / sequencing

1. **Alt text (Feature 3)** — cheapest, highest ROI, do first. Immediate WAVE win.
2. **Semantic headings (Feature 4)** — medium, slots into existing text/object properties.
3. **Automatic position-based DOM ordering (Feature 1)** — the foundational, retroactive
   win; needs render-order logic but no new author UI.
4. **Author reading-order override (Feature 2)** — hardest (new UI + metadata), handles the
   cases Feature 1 can't. Build after Feature 1 proves out.

## Interaction with existing ng work

- Feature 1 is the same class of render-time reorganization as the centered-layout wrapper
  (coordinates preserved, visual result unchanged, document structure changed) — reuse that
  proven "source order independent of visual position" property.
- Features 3 & 4 slot into the object-properties / text-controls UI already built.
- Verify against the render-parity harness: Feature 1 CHANGES DOM order deliberately, so
  the parity harness's per-object check must compare objects by IDENTITY, not by document
  position (an object moving in source order is INTENDED here, not a regression). Note this
  so the harness doesn't flag intentional reordering as a diff.

## Validation

- Test resulting pages through an accessibility checker (e.g. WAVE, axe) — the emailer
  specifically referenced WAVE. Target: reading order follows visual flow, images have alt
  (or are marked decorative), headings form a valid structure.
- Test with an actual screen reader on a few real pages (single-column, multi-column,
  image-heavy) to confirm the flow is genuinely followable.

## Constraints

- Non-destructive: no change to stored object coordinates; ordering/headings/alt are
  render-time + metadata only. Existing pages must render visually identically (only
  DOM order / semantics change).
- Vanilla JS + Alpine for any editor UI (reading-order list, alt field, heading selector),
  consistent with ng.
- Escaping care for alt text (user input into an attribute).
- Author controls appearance independently of semantic level.

## Definition of done

- Object DOM is emitted in visual reading order by default (top-then-left, with a row
  threshold), derived from coordinates at render time, non-destructive, improving every
  existing page's screen-reader flow with no author effort.
- Authors can override the automatic order with an explicit reading sequence for pages
  where position isn't reading order (multi-column/grouped/artistic).
- Image object properties have a decorative toggle + an alt-text input where the toggle
  GATES the input (decorative -> empty alt + role="presentation", input hidden; meaningful
  -> alt input shown, escaped on render). A non-blocking no-alt nudge appears only for
  meaningful images lacking alt.
- Text objects can be designated H1-H3, emitting semantic heading elements, with visual
  appearance controlled independently.
- Pages render VISUALLY identically (only DOM order/semantics change); verified with an
  accessibility checker and a real screen reader; the parity harness compares objects by
  identity so intentional reordering isn't flagged as a regression.
