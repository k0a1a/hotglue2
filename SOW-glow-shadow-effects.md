# SOW — Glow & Shadow effects (edge controls → "more knobs")

Status: to implement. Branch: `ng`.
Goal: add parametric **glow** and **drop-shadow** effects to an object, generating the
underlying `box-shadow` CSS from a few user-friendly knobs — so users get glowing /
shadowed objects without hand-writing multi-layer `box-shadow` stacks. Lives in the
**"more knobs"** (extra options) section of the existing edge/border controls popover,
alongside border radius/style.

## Why here

Glow and shadow are edge/box effects — conceptually adjacent to border radius/style,
which already live in this popover. They belong in its "more knobs" subsection, not as
a separate top-level control. Same pattern as the border controls: expose parameters,
generate the CSS (users don't hand-write it), consistent with how radius/style already
work.

## Two distinct effects (don't merge into one confusing control)

Both are implemented via `box-shadow`, but users think of them separately and they take
different parameters. Offer them as two related options in "more knobs":

### Glow
A soft coloured halo around (and optionally inside) the object. Symmetric, no
directional offset. Parameters:
- **glow color** (use the existing color picker) — default a sensible bright.
- **size** — how far the glow spreads (drives the blur radius).
- **intensity** — how strong/bright (drives layer count / opacity / spread).
- (optional) **inner glow** toggle — add `inset` layers for a luminous interior (the
  "translucent marble" look) vs. outer-halo-only.
- (optional) **second color** — a duotone glow (e.g. magenta+cyan) for the marble
  effect; keep this in the deepest "more knobs" so the basic case stays one color.

Generates a layered `box-shadow` stack, e.g. (single-color outer glow):
```css
box-shadow: 0 0 <size>px <color>, 0 0 <size*2>px <color>, 0 0 <size*4>px <color>;
```
and, with inner glow, adds `inset` layers. The reference "marble" is:
```css
border-radius: 50%;
box-shadow:
  inset 0 0 50px #fff, inset 20px 0 80px #f0f, inset -20px 0 80px #0ff,
  inset 20px 0 300px #f0f, inset -20px 0 300px #0ff,
  0 0 50px #fff, -10px 0 80px #f0f, 10px 0 80px #0ff;
```
— i.e. the effect is a regular formula driven by color(s), size (blur radii), and
intensity (layer count). Generate it from the knobs; don't make the user type it.

### Drop-shadow
A directional shadow for depth. Parameters:
- **shadow color** (color picker) — default a translucent dark.
- **blur** — softness of the shadow.
- **distance** + **direction** (or **X/Y offset**) — how far and which way the shadow
  is cast.
- (optional) **spread**.

Generates a single (or few) `box-shadow`:
```css
box-shadow: <offsetX>px <offsetY>px <blur>px <spread>px <color>;
```

## Behaviour (match the existing popover patterns)

- Parameters use sliders + manual entry (synced, like the font-size control) and the
  existing color picker for colors.
- **Applies live** — the object updates as the user adjusts. Rely on undo for revert.
- **Reads current state on open** — if the object already has a glow/shadow, the knobs
  reflect it.
- Effects can be OFF (default) — an object with no glow/shadow gets no `box-shadow`.
  Provide a clear off/none state.
- Glow and shadow can coexist (both are `box-shadow` — see the combination note below).

## CRITICAL Hotglue-specific gotchas

1. **Overflow clipping kills the effect.** Glow/shadow extend FAR beyond the object's
   box (blur radii up to hundreds of px). If the object's container has
   `overflow: hidden`, the glow/shadow gets CLIPPED at the box edge and the effect is
   lost or wrong. VERIFY object containers do not clip overflow (or ensure this object
   doesn't) when a glow/shadow is applied. This is the #1 thing that will "not work".
2. **Combining glow + shadow (both are `box-shadow`).** `box-shadow` is a single
   property holding a comma-separated list. If a user has BOTH a glow and a drop-shadow,
   the generated layers must be COMBINED into one `box-shadow` value (glow layers +
   shadow layer together), not written as two separate `box-shadow` declarations (the
   second would overwrite the first). Same class of gotcha as underline+strikethrough
   sharing `text-decoration`. Generate one combined `box-shadow` from all active
   effects.
3. **Glow bleeds over neighbours.** A large halo visually overlaps adjacent objects —
   inherent to the effect, not a bug. Nothing to fix, just expected.
4. **Circle needs a square object.** `border-radius: 50%` (for the marble look) only
   makes a circle if the object's width == height; otherwise an ellipse. Not something
   to enforce, but note it (the radius control already exists in this popover).

## Storage

- Store the effect PARAMETERS (glow color/size/intensity/inner, shadow
  color/blur/offset), not the raw generated CSS — so the knobs can be re-read and
  re-edited, and the CSS regenerated on render. Add property keys to the object file
  (e.g. `glow-color`, `glow-size`, `glow-intensity`, `shadow-*`) consistent with the
  existing `object-*` / `text-*` property scheme.
- On render, generate the combined `box-shadow` from the stored parameters.
- Usual escaping care for stored values (colors, numbers — low risk, but keep the
  format clean).

## Constraints

- Vanilla JS + Alpine (reactive popover), consistent with `ng`. No jQuery.
- Reuse the existing color picker and slider+entry patterns.
- Build minified assets via the project's terser build.
- Keep the basic case SIMPLE (single-color glow, or a basic shadow) with the fancier
  bits (duotone, inner glow, spread) tucked deeper in "more knobs" — don't overwhelm.

## Out of scope

- `filter: blur()` / SVG-filter / blend-mode effects (this SOW is `box-shadow`-based
  glow + drop-shadow only).
- Text-glow via `text-shadow` (a possible SEPARATE effect for text objects — note as a
  future sibling, not built here).
- Animated / pulsing glow (`@keyframes`) — possible future nicety, not v1.

## Definition of done

- The edge/border controls' "more knobs" section offers **glow** and **drop-shadow** as
  two distinct parametric effects.
- Glow: color + size + intensity (+ optional inner-glow, + optional second color)
  generate a layered `box-shadow`; drop-shadow: color + blur + offset/direction
  (+ optional spread) generate a `box-shadow`.
- Both apply live, read current state on open, can be off by default, and COMBINE into a
  single `box-shadow` when used together.
- Effects are not clipped (overflow gotcha handled/verified).
- Parameters are stored (not raw CSS) and regenerated on render; object-file format
  intact.
- Vanilla + Alpine, reuses color picker + slider patterns, minified via terser.
