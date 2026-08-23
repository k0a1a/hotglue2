# SOW — Text controls redesign (Font / Spacing / Color)

Status: **Font and Spacing popovers BUILT 2026-08-23** (`text_font_popover()` and
`text_spacing_popover()` in `modules/text/text-edit.js`, tests in
`tests/e2e/text-font-popover.spec.js` and `text-spacing-popover.spec.js`). Still to do:
moving padding out to object properties. Branch: `ng`.

Decisions taken while building, so the record is not just the plan:
- **Toggles are two-state** — option (a) under Row 3. Per-selection styling was not
  built and stays a separate question.
- **`$.glue.popover` now exists** (`js/edit.js`), the colour picker's placement lifted
  out: it decides where a panel goes so every popover lands in the same places for the
  same reasons. It also carries `row()` and `number_row()`, the slider-and-field control
  both panels are built from — and the colour picker's alpha now uses it too, so the
  editor has one kind of slider rather than one per panel.
- **`text-decoration` is now stored**, as `text-text-decoration`, saved and rendered by
  `module_text.inc.php` alongside `text-font-style` / `text-font-weight`.
- The three buttons the Font panel replaces (`text-font-size`, `text-font-face`,
  `text-font-style`) and the four the Spacing panel replaces (`text-line-height`,
  `text-letter-spacing`, `text-word-spacing`, `text-align`) are gone from the menu. Left
  as their own buttons: padding, font colour, background colour, "make background
  transparent", link and source — thirteen buttons down to six.
- **Alignment moved INTO the Spacing panel**, as four buttons rather than the old cycle,
  which was not in this SOW's sketch. Grouping it with spacing rather than leaving it
  outside is what makes the row short, and four buttons show which alignment is in force
  without clicking through the other three.
- **A reset button**, also not in the sketch: the three drag controls used to treat a
  click with no drag as "reset", which nothing told anyone. It clears line height, the
  two spacings and alignment by emptying the style properties, so the object file drops
  the attributes and a reset object is byte-identical to one nobody ever touched.

Reconciled against the tree on 2026-08-23 — the paragraphs marked **CHECKED** are what
the code actually does, and three of them change the plan. Read those before starting.

Goal: the text-formatting toolbar currently has 8 separate buttons (font size, font
color, font face, font style, line height, letter spacing, word spacing, padding) —
a full row, too much space. Collapse them into grouped popovers by conceptual family,
using the SAME popover pattern as the existing color picker.

**CHECKED — it is 8 of 13, not 8 of 8.** `modules/text/text-edit.js` registers thirteen
buttons in the `text` menu: the eight above plus link, the `</>` source toggle,
background color, "make background transparent", and align. Collapsing eight still
leaves five, so the row does not become short. Worth deciding as part of this whether
background color + "make background transparent" become a group of their own — that
second button is now nearly redundant, since the color picker grew a transparency
slider (its alpha, not the object's opacity).

## The collapse

8 buttons → **3 buttons**:
- **Font** (popover) — font face, size, style toggles. See full spec below.
- **Spacing** (popover) — line height, letter spacing, word spacing. Sketch below;
  build after Font.
- **Color** (standalone button) — UNCHANGED, keeps calling the existing color picker.
  Color is frequent and already works; leave it as its own button.

  *(The picker itself was reworked separately — half the size, placed beside the object,
  a transparency row and per-page recent colours — and the LINK dialog became a rollout
  on the same popover machinery as Font and Spacing. Neither changed this plan.)*

**Padding** (the 8th button): REMOVE from the text-controls row. It's the text's inset
from the object's sides — a property of the object/container, not typography. It is
ALSO currently BROKEN. Relocate it to the Object Properties feature
(SOW-object-properties.md) and fix it there. Do not carry it into the Font/Spacing
popovers.

**NOT CHECKED — "broken" wants a repro before anyone fixes it.** The control does two
things at once: it sets padding AND resizes the object to compensate, so the text box
stays where it was. First suspect is an asymmetry between its two paths — the drag
computes width from `orig_w+2*orig_x-2*val_x`, i.e. from the size at mousedown, while
the reset recomputes it from the CURRENT `offsetWidth`. Write down what actually goes
wrong before the fix moves house, or it moves house and stays broken.

## General popover behaviour (applies to Font and Spacing)

Match the EXISTING color-picker popover for consistency:
- Opens near its button; dismisses on click-away / Escape; stays on-screen near edges.

  **CHECKED — "near its button" is no longer what the color picker does**, and the
  reason applies here too: it opens in the nearest free space beside the OBJECT, because
  opening at the button (or the pointer) put it on top of the thing being edited. Same
  rule for these popovers — a Font popover covering the text whose font is being chosen
  is the same mistake.
- **Applies live** — canvas text updates as the user adjusts (they're making a visual
  judgement; they must see it). Rely on the existing undo for revert; no separate
  cancel needed.
- **Reads current state on open** — controls reflect the selected text's CURRENT values
  (dropdowns show current font/style, slider at current size, toggles lit to match).
- **Scope**: apply to whatever the other text controls apply to (selected text within
  the object, or whole text object — match existing behaviour and keep ALL text
  controls consistent). Confirm the current scope and follow it.

  **CHECKED — the scope is the WHOLE OBJECT.** Every one of these controls reads
  `getComputedStyle(obj)` and writes `obj.style.*` on the text object itself: font
  style (`text-edit.js:1028`), font size (`:862`), face, line height, letter and word
  spacing all do the same. Nothing here touches a selection. The only two things in the
  module that work on selected text are the link dialog and WYSIWYG editing, and both
  wrap ranges by hand — text objects are edited as raw HTML in a TEXTAREA, not
  contenteditable, so there is no `execCommand` to lean on. This has a consequence for
  the style toggles; see Row 3.
- Vanilla JS + Alpine for the reactive popover state (consistent with `ng`). No jQuery.

## Font popover — full spec

Opens on the "Font" button (like the color picker opens now). Three rows:

### Row 1 — font face dropdown
- Lists ALL available faces: default fonts + user-uploaded fonts (font upload is
  already implemented — pull from wherever available fonts are registered so the list
  stays in sync).

  **CHECKED — one source: `site_custom_fonts()` in `common.inc.php:732`.** It is what
  the site-settings font manager lists (`module_page_browser.inc.php:62`) and what
  `module_text.inc.php` already emits the `@font-face` rules from, so reading it keeps
  the dropdown in sync by construction. Note the existing face control also remembers
  the last face picked, site-wide, as `page-last-text-font`, and that memory is applied
  to newly created text objects — it should keep working.
- **Render each font name in its own typeface** (set each option's font-family to
  itself) so the user sees what each looks like.
- Nice-to-have: visually distinguish/group user-uploaded vs default (e.g. a separator
  or "Your fonts" / "Default fonts" grouping) so uploads are easy to find.
- Selecting a font applies it live.

### Row 2 — size: slider + manual entry
- A horizontal slider AND a manual numeric entry field, kept BIDIRECTIONALLY in sync
  (drag slider → field updates; type in field → slider moves).
- Slider covers the common range (e.g. ~8–100px, tune to taste). The manual field must
  accept values BEYOND the slider's max (someone may want large display text) — do not
  let the slider's range cap what the field allows.
- Two notes on what already exists. `$.glue.rangeslider` (`js/edit.js`) is NOT this: it
  is a bar that appears next to a menu button while the button is dragged, for the
  buttons that have no popover — inside a popover a plain `<input type="range">` plus a
  number field is simpler and does the two-way sync for free. And the roadmap carries a
  "parametric entry" item, the same idea generalised (a way to type the exact number
  behind any direct-manipulation control); this row is a specific instance of it, so
  whatever pattern the field takes here is worth being able to repeat.
- Unit: px (matches stored `text-font-size:11px` format).
- Live preview as the slider drags.

### Row 3 — style: four square toggle buttons in one line
Four small square toggles, each rendering the letter **T** IN its own effect (the
button demonstrates what it does):
- **Bold** — heavy "T" (maps to `font-weight`)
- **Italic** — slanted "T" (maps to `font-style`)
- **Underline** — "T" with underline (maps to `text-decoration`)
- **Strikethrough** — "T" with line through (maps to `text-decoration`)

No "Normal" button — normal is simply the state where none are active. (Optional
FUTURE nicety: a separate "clear formatting" reset; not in this SOW.)

**CHECKED — two of these four toggles do not exist in any form, and one of them is a
storage change.** `font-weight` and `font-style` are stored (`text-font-weight`,
`text-font-style` in `module_text.inc.php`), so bold and italic are a UI change over
something real: today they are ONE button that cycles bold → italic → bold+italic →
normal, and splitting it into two independent toggles is exactly the improvement this
SOW wants.

`text-decoration` appears NOWHERE — not in `modules/text/text-edit.js`, not in
`module_text.inc.php`. Underline and strikethrough have no control and no stored
property. And hotglue's save maps a fixed list of CSS properties to object attributes
and drops everything else, so setting `obj.style.textDecoration` from the popover will
look right on screen and vanish on save. Both `text_alter_save()` and
`text_render_object()` have to learn a new key (`text-text-decoration`) for these two
toggles to survive a reload. That contradicts "the redesign is a UI change, not a
storage change" under Storage below — it is one, for U and S.

Toggle behaviour (get these right — the fiddly bits):
- **Independent & combinable** — any combination valid (bold+italic+underline at once).
  Clicking one doesn't affect the others.
- **Three visual states, all distinguishable on the translucent-gray chrome:**
  - **off** — style on none of the selection
  - **on** — style on ALL of the selection (clear active/pressed look)
  - **indeterminate** — style on PART of the selection (mixed). A visually distinct
    third state (e.g. dimmed/partial fill) — clearly different from both on and off.
- **Read state on open/selection-change:** uniform-applied → on, uniform-absent → off,
  mixed → indeterminate.
- **On click:** off → apply to all (on); on → remove from all (off); **indeterminate →
  apply to all (on)**. A click ALWAYS produces a uniform result. Indeterminate is
  display-only — it reflects a mixed selection and is never a state you click INTO.

  **CHECKED — indeterminate cannot arise yet, so the three-state rules are spec'd for a
  model hotglue does not have.** These controls style the whole object (see Scope), so a
  style is either on it or not: there is no partial state to read and nothing to resolve
  on click. Two ways to go, and this SOW should pick one rather than leave it to
  whoever builds it:

  a) **Two-state toggles on the object** — what the collapse needs and no more. The
     three-state rules above become dead spec: delete them or park them.
  b) **Per-selection styling first** — the toggles then mean exactly what this section
     says, but it is a different and much larger job: wrapping and unwrapping ranges by
     hand in the object's HTML the way the link dialog does, deciding what happens where
     spans overlap, and keeping it stable through the source-view round trip. That wants
     its own SOW; it is not a detail of collapsing a toolbar.

  Recommendation: (a) now, (b) later if wanted at all — noting that inline markup typed
  by hand in source view (`<b>`, `<i>`) already produces mixed text that a whole-object
  toggle silently ignores, which is the argument for (b) eventually.
- **Underline + strikethrough share `text-decoration`** — applying both must COMBINE
  them (`text-decoration: underline line-through`), not have one overwrite the other.
  Common gotcha; handle deliberately.
- Applies live; reflects the selection's current styles.

## Spacing popover — sketch (build after Font, same patterns)

Opens on a "Spacing" button. Groups the three spacing controls:
- **Line height**
- **Letter spacing**
- **Word spacing**

Each as a slider + manual entry (like Font's size row), synced, live preview, reading
current values on open. Same popover behaviour as above.

**BUILT**, on the shared row helper `text_popover_number_row()` that the Font panel's
size row also uses, plus alignment and reset as described at the top. Units, which are
not arbitrary: the three spacings are written in **em**, which is what the drag controls
they replace wrote and what keeps them proportional when the type is resized later. Line
height is SHOWN as a multiple of the font size (1.20, not 21.6px) because that is how it
is reasoned about, and stored as em like the rest. Letter and word spacing read as 0
when nothing is set, rather than showing the computed keyword 'normal', and negative
values are allowed — tightening is as legitimate as loosening.

## Storage

- These controls already map to stored text properties (`text-font-size`,
  `text-font-family`, etc.) — the redesign is a UI change, not a storage change. Style
  toggles map to `font-weight` / `font-style` / `text-decoration`. Confirm the property
  keys used and keep writing the same ones; don't change the object-file format.

  **CHECKED — the keys are:** `text-align`, `text-background-color`, `text-font-color`,
  `text-font-family`, `text-font-size`, `text-font-style`, `text-font-weight`,
  `text-letter-spacing`, `text-line-height`, `text-word-spacing`, and padding as
  `text-padding-x` / `text-padding-y` (two axes, not a CSS shorthand — worth knowing for
  the relocation). Keep writing exactly these. The exception is `text-decoration`, which
  is not among them and has to be added for underline/strikethrough; see Row 3.
- Usual escaping care when writing values (consistent with the codebase's recurring
  escaping-bug caution), though these are constrained numeric/enum values so risk is
  low.

## Constraints

- Vanilla JS + Alpine (reactive popover state). No jQuery.
- Reuse / match the existing color-picker popover's open/position/dismiss behaviour so
  all popovers feel identical.

  **CHECKED — there is no popover component to reuse.** What the color picker has is
  vanilla-picker's own popup plus `place_popup()` in `js/edit.js`, which measures the
  popup and puts it in the nearest free space beside the object — right, below, left or
  above, whichever is closest to the pointer and still fits on screen, never over the
  object or over the menu it was opened from. Making the popovers feel identical means
  lifting that placement out into something general FIRST, then building Font and
  Spacing on it. Worth it: this SOW adds two more popovers and the sketch implies more
  later.
- Build minified assets via the project's terser build.

  **CHECKED — there is no terser build.** `tools/make-min.js` writes a `.min.js` copy
  with whole-line comments stripped, and `tests/e2e/min-files.spec.js` fails when a copy
  falls behind its source. So: `node tools/make-min.js modules/text/text-edit.js` after
  editing. A real build is on the roadmap and was deliberately stopped short of.
- Keep tooltips on the Font / Spacing / Color buttons for learnability.

## Out of scope

- Spacing popover full build (sketched here; same template, do after Font).
- Padding fix/relocation (goes to SOW-object-properties.md).
- Any change to the color picker itself (Color stays as-is).
- "Clear formatting" reset (possible future nicety).

## Definition of done

- The 8 text buttons are collapsed to **Font** (popover), **Spacing** (popover), and
  **Color** (standalone, unchanged). Padding removed from this row (relocated to object
  properties). Five other buttons remain in the row and are out of scope here.
- The Font popover has: font-face dropdown (all faces incl. uploaded, rendered in their
  own typeface), size slider+field (synced, field unbounded), and four B/I/U/S square
  toggles.
- Toggles are independent/combinable, read the object's current styles on open, and
  combine underline+strikethrough correctly — with underline and strikethrough
  surviving a save, which needs a new stored property. Three-state only if per-selection
  styling is built first; see Row 3.
- Everything applies live, reads current state on open, and the popover opens/positions/
  dismisses exactly like the existing color picker.
- Stored text properties unchanged (UI redesign only); tooltips kept.
