# The popout panels — the house style

**As of 2026-09-17**, the day every panel was brought onto one shape. Read this before
building a panel or changing one; the convention is also written once in the code, in the
comment above `$.glue.popover.icon_row()` in `js/edit.js`, because that is where someone
about to build one will be looking.

## What a popout is

A panel that opens beside the object (or page) being edited. It never covers the object:
`$.glue.popover` in `js/edit.js` places it, measuring the VISUAL viewport and scoring the
four sides of the object plus the pointer, with covering the selected object disqualifying
a candidate outright and covering the editor's own menus only breaking a tie. That is the
design codex — "no menu or interface shall interfere with page elements" — enforced in one
function, which is why a panel's size changing (a fold opening) means it is placed again.

The panels are editor-only chrome: `css/edit.css` and the module `*-edit.css` files never
ship to a published page.

## The convention

> A panel opens as **one row of icon buttons** — the verbs, at the panel's own 26px, named
> in their tooltips and nowhere else — and **one fold labelled "more knobs"** under it,
> holding everything that is a value rather than an act: the scrub rows, the fields, the
> delete, the reset. Exactly one fold per panel. A panel with nothing to fold has an icon
> row and no fold, rather than an empty one.

Which control is which falls out of one question: **is it an act or a value?** Tile the
picture is an act; how big the picture is, is a value. The acts are drawn as icons at the
top, the values are rows inside the fold. A destructive act (removing a background) goes in
the fold with the values, not in the icon row.

### The parts

In `$.glue.popover` (`js/edit.js`), beside `row()`, `fold()`, `number_row()`, `slider_row()`,
`color_button()`, `reset()` and `delete()`:

- `icon_row()` — an unlabelled row carrying `.glue-popover-icons`. Fill it, then append it
  to the panel.
- `icon_button(name, title)` — one act in such a row: `$.glue.icon()` with
  `.glue-popover-icon` and the panel's own 26px, since `$.glue.icon()` sizes its own box at
  the toolbar's 32. The mask comes down from 30 to 22 with it (`css/edit.css`); a mask
  scaled past its box does not overflow, it disappears.

### The number row: a scrub, not a slider

A panel's numbers — the font size, the spacings, the corner's round, the glow's spread, the
paddings, the transparency — are **scrubs** since 2026-09-17: first as
`SOW-scrubby-numbers.md` built them, then in the shape the day's second SOW
(`SOW-scrubby-number-component.md`) named. That second one is the specification; it is what
the row below is built to.

```
label        [  24 ↔ ]  px        <- the row IS the handle: drag it sideways
```

Three ways in, and the row is all three: **drag it sideways** (the whole row, not just the
field), **type into the field** (Enter or blur stores it, Escape takes it back), or **nudge**
it a step at a time with the up/down keys or the browser's own steppers — which are what a
finger gets, and stay for that reason. While a drag is running, **Shift coarsens it and
Alt/Cmd refines it**, four either way, read from the move event rather than taken at the
press so either key can be pressed or let go in the middle of a drag. (On a Linux desktop
that moves windows with Alt+drag the window manager may eat that press before the page sees
it; Shift and a Mac's Cmd are unaffected.)

The `↔` is the affordance, and the only one that survives on glass: nothing hovers on a touch
screen, so the row has to say what it can do as well as do it. It is a sibling of the field
rather than anything drawn inside it, so it costs the digits no width. The cursor over the
row is the grabbing hand — `grab`, closing to `grabbing` for the length of a drag — rather
than the more conventional `ew-resize`: danja's call in the component's SOW, and the hand
reads with the glyph.

**Escape belongs to the field before it belongs to the panel.** The first press takes the
value back to what it was when the caret arrived and leaves the panel open; the second, with
nothing left to take back, closes the panel. Typing applies live, so a cancel has to put the
OBJECT back too — and it stores what it took back only if this row had already stored
something. See the trap below for why that condition is not a nicety.

`number_row(label, opts)` builds the row and returns `{row, set}` — the same interface it has
always had, so every call site was already right. `opts` is `min`, `max`, `step`, `value`,
`unit`, `decimals`, `apply(value, commit)`, plus three the drag reads:

- `fine` — a control whose useful band is a fraction of its declared range (the em spacings,
  whose `-0.2 … 1` is a fence around the ±0.1 anybody sets): the drag crosses the span in
  about three gestures rather than one.
- `coarse` — a control whose span is large in absolute terms (the ±500px position rows,
  where the default would move a picture 5px per pixel of drag): the opposite.
- neither — the derived default, `span / 200`: one comfortable gesture crosses the declared
  range, snapped to the row's own `step`.
- `hard` — `[lo, hi]`, either end `null`: the range the value can **mean**, which typed input
  is clamped to. `min`/`max` is what a drag traverses and is deliberately not a cap on typing
  — display type at 300px in a row that drags to 100, asserted in
  text-font-popover.spec.js — but the object's opacity is the case that made this an option.
  That row divides by a hundred and puts the result straight into the element, and CSS
  **clamps** an opacity outside 0..1 rather than throwing the declaration away, while the
  number itself is what is stored. Measured in both engines: a typed -50 leaves
  `opacity: -0.5` on the object — so it goes invisible — and `object-opacity: -0.5` in the
  object file, and a typed 150 leaves 1.5 in both while the page renders 1. The panel showed
  the number that was typed and the file kept a number opacity cannot take. The rounds,
  fades, widths, blurs, paddings and the text shadow's radius take `[0, null]` (a magnitude,
  where a negative is what the setter silently reads as "none"), the three alphas take
  `[0, 100]`, and the four padding rows take `[0, max]` because their `apply` already clamps
  to that — saying it as well is what makes the FIELD show the padding the object has rather
  than the number that was typed into it. Clamped on commit only: clamping while the digits
  are being typed would fight the typist, and the value is settled by then.

`slider_row(label, opts)` is the old body, kept for the two numeric controls that still want
a **track** rather than a scrub, and it should stay at two: the colour picker's alpha (a
slider is what an alpha is, and the picker is vanilla-picker's own drawing) and the text
editing strip's inline slider (a docked strip is as wide as the object, so a track costs it
nothing). See the exceptions below.

`fold(pop, label)` is unchanged and does the work: it returns `{toggle, body}`, both of
which the caller appends, and it re-places the panel on every toggle. It has no
open-by-default and does not need one.

### The frame

Every panel wears the menu elements' frame, so a panel and the menu that opened it read as
one family: `border: 1px solid #000` over `rgba(255, 255, 255, 0.8)`, no shadow. The colour
picker, and the text editing strip that docks to a text object, still wear the older
chrome (`#f2f2f2`, a silver hairline drawn as a 1px shadow spread, and a drop shadow) —
the picker because it is vanilla-picker's own drawing, the strip because it is not a popout.

### Size

A panel is **as wide and as tall as its content**. No panel pins a width. What a panel with
knobs comes out at is therefore its widest row, and for a number row that is the scrub:
**`label + 7 + field + 7 + ↔ + 7 + unit`** — about 124px for a short label and 143 for
`padding`. The field is `calc(5ch + 20px)` and the arrow a flat 12; the unit is 16.

`ch` and not a number, for the field: it follows the font, and the two engines disagree about
an `<input>`'s own width by a third. Measured 2026-09-17 at the panel's 11px sans-serif, `ch`
is 6.1px in Chromium and 6.3 in Firefox, so the field is 50.6 there and 51.5 here; the widest
value any row emits is the signed hundredth the two em spacings produce, `-0.05`, at 25.1px
and 25.4px. Five ch is five characters of digit room — the arrow and the browser's steppers
are *additional* width, never taken out of it — and the 20 buys the steppers (16px of them in
Firefox, drawn over the field in Chromium) and the hairline border. Narrowing the field until
`-0.05` clipped put the floor at 44px in Chromium and 48 in Firefox, so this clears it in
both. The 20 is the one number to change if the knobs want to be tighter or looser.

**The arrow did not widen a single panel.** Measured with the folds open, before and after:
font 233×401, properties 172×335, edge 177×399 — unchanged, because a knob row at
`label + 100` still comes in under whatever already decided each panel (the icon row's 158,
the font panel's face `<select>` at 219). `max-width: calc(100vw - 16px)` keeps a naturally
wide row (a url field) from pushing a panel off a narrow viewport, and the tall folds carry
`max-height: 42vh; overflow-y: auto`.

Measured, so nobody has to guess again: the icon row is 158px, so **every panel is at least
172** (`158 + 6 + 6 + 1 + 1`); the properties panel is 172 open and closed, its widest knob
row being the padding scrub at 143; the edge panel is 177, set by its two pair rows; the font
panel is 172 closed and **233 open**, set by the face `<select>` at 219 — the scrub rows there
run 121 to 142 and are not what decides it. Before the scrubs (and the 80px slider they
replaced) a panel with knobs was carrying a knob row's width whether or not a knob was the
widest thing in it; now it usually is not.

Height was always the content's. Note the consequence of the width being the content's: a
panel that opens on its icon row is the width of that row, and **gets wider when the fold
is opened**, since a `display: none` fold contributes nothing to layout.

**Two columns were considered and not built** (measured 2026-09-17, when the scrubs went
in) — see the end of this section.

A field whose subject is words rather than a number says its own width, the same way the
scrub's field says `calc(5ch + 20px)`: `.glue-object-link-field` (the link panel's url and
target) is 150px and `.glue-image-alt-field` is 180, both overriding `.glue-popover-field`'s
44 with its `flex: 0 0 auto` kept. A content-sized panel does not otherwise give such a field
any width to have: an empty `<input>` left to itself is the browser's own 150px (Chromium) or
143 (Firefox), and a panel sized by *that* is sized by a browser default. The link panel's
150 is danja's number — *"link field width 150px"* — and it is a width those two fields
declare rather than inherit, so the panel comes out at 203 in Chromium and 206 in Firefox
instead of at whatever an empty box would have asked for. It was 240 for the afternoon of
2026-09-17, which read a page with a path and a query whole but made the link panel the
widest thing in the editor at 282. See the trap below for the shape that does *not* work.

Pairing knob rows — x with y, top with bottom, letter with word — would halve the number of
rows, and it is what "a denser reflow" in the scrubs' SOW meant. It was not built, and the
arrow has since closed the one place it would have fitted: a pair costs
`143 + 7 + 143 = 293` at the widest labels and about 252 at the narrowest, against a
properties panel of 172, an edge panel of 177 and a font fold of 219. A pair of knob rows is
wide by construction — two labels and two fields side by side — so these rows do not pair at
any width this editor has. Pairing them would take a narrower field, or a label above its
field rather than beside it, which is a different panel.

## The panels, as they stand

| panel | built by | shows | folds |
|---|---|---|---|
| object properties | `object_properties_popover()`, `modules/object/object-edit.js:998` | colour · picture · tile · flip-h · flip-v | x, y, scale, padding (text only), transparency, delete, reset |
| page background | `page_background_popover()`, `modules/page/page-edit.js:387` | colour · picture · tile · scroll | x, y, scale, delete, reset |
| font | `text_font_popover()`, `modules/text/text-edit.js:1436` | sizes s/n/b/x (8, 16, 24, 32) · four style toggles + colour · four alignments | face, exact size, three spacings, shadow + its colour, source note, reset |
| edge | `object_edge_popover()`, `modules/object/object-edit.js:486` | style + colour · round · width | fade, glow, drop shadow, reset |
| adjust (z-level) | `object_adjust_popover()`, `modules/object/object-edit.js:893` | four z buttons | nothing — an icon row and no fold |
| object link | `object_link_popover()`, `modules/object/object-edit.js:1727` | link · target (two labelled rows) | nothing — no acts, and the two rows are the panel |

### The exceptions, and why

- **The object link panel has no fold, and no acts either.** It was the one panel whose fold
  label named its contents (`target: _blank`) — a target is a STORED value and must not be
  invisible in a fold named for knobs nobody may want — until danja's *"don't fold target in
  link panel"* on 2026-09-17. A fold with one row in it was never hiding anything an author
  would thank it for, and the panel is now the two rows the prompt's two questions deserve:
  link, target, and the delete under them.
- **The font panel keeps its face and its exact size out front**: they are values, so the
  rule would fold them, and a font panel that opens without a font is a worse panel.
- **Two panels have no fold, and neither has an empty one.** The adjust panel is four acts
  and a reset; the object link panel above is two rows and a delete. The convention asks for
  no fold rather than for an empty one, and these are what that looks like.
- **Two numeric controls keep their track** (`slider_row()`), and they are the only two.
  The colour picker's **alpha** is a range input: an alpha is a position on a bar, the bar is
  the picker's own drawing, and danja's call when the scrubs went in was to leave the picker
  exactly as it was. The **text editing strip**'s inline slider is the other: the strip is
  docked to the object and as wide as it, so a track costs the width nothing, and it is being
  dragged while the text is being looked at rather than in a panel with other knobs beside
  it. Everything else in the editor that is a number is a scrub.

### Panels deliberately left as they are

`image properties` (two controls, one a sentence-long field), `heading` (its controls are
words), `grid` (two text-glyph toggles with no honest artwork in the set), `page settings`
and `reading order` (fields and a list). Each is already at its minimum; converting them
would mean inventing a glyph to justify a row.

## Building the next one

1. `var pop = $.glue.popover.open(obj, 'glue-x-popover')` — the class names the panel and is
   how it toggles closed on a second click.
2. `var icons = $.glue.popover.icon_row();` and one `icon_button(name, title)` per act.
3. `var fold = $.glue.popover.fold(pop, 'more knobs');` — one per panel.
4. Draw the values into `fold.body` with `row()` / `number_row()` / `color_button()`, and
   put the delete and the reset at the end of it.
5. Append `icons`, `fold.toggle`, `fold.body` to `pop`, in that order, then
   `$.glue.popover.show(pop)`. Append order is the only thing that decides what the panel
   looks like, so a row may be built anywhere and appended where it belongs.
6. Give every row that a test will need to name a class of its own — the fold is one list
   now, and a bare `.glue-popover-field` matches several rows in it.
7. `node tools/make-min.js <file>` for every JS file touched, then the specs.

## Traps that have cost time

- **A scrub has three states and the browser's own helpers only cover two.** The row is a
  drag handle, a press that does not travel is a click (so the field can be clicked into and
  typed in), and the value must not change on the way through. Hence the 4px threshold before
  a press is `armed`, and `min`/`max` on the field set from the row's range.
- **`min` and `max` on a scrub's field are the LENGTH OF THE DRAG, not a limit.** A typed
  value is kept however far past them it is (display type at 300px in a row that drags to
  100), which is the same contract the field had when a slider sat beside it. The attributes
  are on the field because the browser's own steppers honour them and because that is where
  a test looks — not because anything clamps the typed path.
- **Escape in a scrub field is the field's, and the commit it does is conditional.** The
  panel closes on `keydown` at `documentElement` in the bubble phase, so the field's own
  handler stops the event to cancel an edit — and must NOT stop it when there is nothing to
  cancel, or the panel would become unclosable from the keyboard while the caret sits in the
  fold. Cancel means "back to the value at focus", which is the only value a cancel can be
  about. Whether it also *stores* that value is the subtle half: if the row has already
  stored something (a change event, or a drag that finished and saved) the file must be put
  back too, or the editor shows 0 while the page says 0.15; but if nothing was ever stored,
  committing the pre-edit value writes the DEFAULT of an attribute that may not have existed
  — a cancel that changes the object it was undoing. So the row tracks whether anything
  reached the file, and Escape commits only then. Both halves are measured in both engines;
  the typed-and-cancelled file is byte-identical.
- **A panel that commits cannot leave the commit to blur.** The link panel stores nothing
  until a field is finished with — Enter, or the panel closing — and its first version
  explained itself with "clicking away commits, because the field blurs before the click
  lands". Measured, that is not what happens: every close goes through
  `$.glue.popover.close()`, which REMOVES the panel and the focused field in it, and removal
  fires `change` and `blur` in Chromium and neither in Firefox. So Escape stored in Chromium
  what it was meant to drop, and a url typed and then clicked away from was committed in
  Chromium and silently dropped in Firefox — the same gesture, two different files. The panel
  now says which of the two things a close is (`discarding`, set by the field's own Escape
  `keydown`) and does the committing itself in `pop.on_close`, which `close()` calls before it
  removes anything, so both fields are still there to read. One close can then commit twice —
  the panel's own, then Chromium's on removal; the second is a no-op, because `write()`
  returns early when the fields already say what is stored.
- **`grab`/`grabbing` has to be a class, not `:active`.** The one-word way to write "the hand
  closes while you drag" is `.glue-popover-scrub:active { cursor: grabbing }`, and it is wrong
  in Firefox: measured, the cursor stayed `grab` through a whole drag there while Chromium
  showed `grabbing` from the press. Firefox does not activate an element whose `pointerdown`
  was prevented, and every drag in this editor prevents it. The row adds
  `.glue-popover-scrub-dragging` when the press has travelled far enough to be a drag and
  drops it on release — which also means a click into the field never flashes a closed hand.
- **A drag that ends outside the panel sends a click, and that click is a click on whatever
  it landed on.** The trailing click after a drag is dispatched at the nearest common
  ancestor of the pointerdown and the pointerup, which for a scrub released over the page is
  the page — and the editor reads a click on the page as *deselect*, which closes the panel
  by `glue-deselect` even though the popover's own dismissal handler was told to ignore it.
  So the control raises a flag as its drag ends (`swallow_next_click()`), and the
  capture-phase click handler on `documentElement` reads it
  (`take_swallowed_click()`), stops the event dead with `stopPropagation()` *and*
  `preventDefault()` — capture phase, because the delegated handlers in `glue.js` are on
  `document` in the bubble phase and anything later has already lost. The flag is cleared on
  the next `pointerdown` (`clear_swallowed_click()`), since a drag released off the window
  sends no click at all and the flag would otherwise lie in wait for one somebody makes
  later.
- **`touch-action: pan-y` on a scrub row, NOT `none`.** Every other drag in the editor says
  `none` — nothing scrolls under it and the browser must not claim the gesture. A scrub lives
  in a fold with `max-height: 42vh; overflow-y: auto`, so `none` would take the fold's scroll
  away wherever a knob happens to be. The component's SOW asks for `none` scoped to the row —
  and in the line above that, asks that a horizontal scrub "must not fight vertical scroll of
  the popover/page". `pan-y` is the reading that satisfies both: no scroll can steal a
  sideways drag (the browser has no horizontal pan to claim it with) and no knob can steal a
  scroll. A vertical drag ends in a `pointercancel`, which `$.glue.slider` finishes cleanly
  with the deltas it has seen.
- **A finger needs the row taller than a mouse does.** Measured: a scrub row is 19px — the
  field's own height — so `@media (pointer: coarse)` pads it to 27 (`.glue-popover-scrub`,
  `css/edit.css`). Four and not five: at five the properties panel's fold overflows its 42vh
  cap on a 780px phone by a few pixels, which reads as a bug rather than as the mobile
  insurance the cap was written as.
- **One disclosure per panel.** Specs locate `.glue-popover-advanced` inside a panel
  without naming a section, so a second fold is a Playwright strict-mode violation — and
  it would be two ways to hide the same control anyway. This is what flattened the padding
  section's own "more knobs" fold into the panel's, and cost its four side rows the
  anonymity of being a fold's whole contents (they carry `.glue-padding-top` and its
  siblings now).
- **A fold hides; it does not disable.** The panel is built once and never rebuilt, so
  handlers that run while the fold is closed (a grey-out sync, an upload's finish) keep
  working. Nothing needs to be woken when the fold opens.
- **Counts read closed; clicks, fills, taps and `boundingBox()` do not.** A row inside a
  closed fold is in the DOM for `toHaveCount`/`toHaveClass`/`toHaveValue` and has no box for
  anything that acts on it. And opening the fold RE-PLACES the panel, so measure after.
- **A panel cannot open onto the object.** Watch this when a panel grows: the fold's height
  is the usual reason a panel is tall.
- **Icons are masks, and a mask reads alpha only.** Judge artwork by its alpha at 22px in a
  panel (30 in the toolbar); a mask that fails to load paints nothing while every test that
  only asks "is it visible" passes.
- **An icon's file name is not the action's name.** Danja's `flip-horizontal.svg` and
  `flip-vertical.svg` are named for the AXIS their dashed line draws — horizontal file, line
  drawn left-to-right across the middle, shape reflected above and below it — which is the
  opposite of the words in the tooltips beside them, since "flip horizontally" means the
  left-to-right mirror (`scaleX(-1)`). So `object_flip_section()` asks for `flip-vertical`
  for the horizontal act and `flip-horizontal` for the vertical one, and says so in a comment
  there. Judge by the picture, not the file name: render both and look. The font panel's four
  align buttons have carried a swapped pair the same way since they were drawn.
- **A field in a content-sized panel is sized with `width`, not with `flex-basis`.** The
  intuitive move is `flex: 0 0 <n>px` on the field, and it does not do the same thing in both
  engines. Measured at 240, the width the link field had for an afternoon: Chromium gives a
  240px field in a 278px panel, and Firefox a 240px field in a **182px panel** — out through
  the panel's frame. The max-content width of a single-line flex container is pulled back down
  by an item whose own content is narrower than its base size, and only Chromium lets the base
  size win. At today's 150 the same pair, re-measured, disagrees more quietly: the field is
  150 either way, but Chromium's panel is 203 with a 39px label column and Firefox's is
  **195.5 with a 31.5px one** — the field's base size wins over the label's share of the row.
  `width` on a `flex: 0 0 auto` item is the shape both engines agree on, and it is what
  `.glue-object-link-field` does.
- **`node tools/make-min.js`** after editing any of hotglue's own JS: `USE_MIN_FILES`
  defaults to true, so the `.min.js` copy is what a default install serves, and
  `tests/e2e/min-files.spec.js` fails when a copy falls behind its source.
- **Nothing in here touches storage.** The panels read and write the same attributes they
  always did; a panel is a view of the object file, and the file format is the product.
