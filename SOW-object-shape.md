# SOW — Object shape: rounded corners, and a soft edge

Status: scoped, not built. Branch: `ng`.

Two per-object properties that change what an object's edges look like:

- **Rounded corners** — ported from Superglue, where it is a slider on the object
  toolbar and goes all the way to a circle.
- **Edge fadeout** — new. The object's content fades out towards its edges instead of
  stopping at them.

They are one piece of work because they are the same shape of problem: a single number
per object, stored as an `object-*` attribute, applied as CSS, edited with one slider,
and needing to survive the save → reload → published-page round trip.

## What already exists to build on

Checked in the tree on 2026-08-23, so the estimate below is not guesswork:

- **`module_object.inc.php` already does this pattern twice.** `object-opacity` and
  `object-overflow` are read in `object_render_object()` and written in
  `object_alter_save()`, each one four lines, each storing only when the CSS property is
  actually set so an untouched object keeps exactly the markup it had. Both new
  properties are that pattern again.
- **`$.glue.rangeslider` (`js/edit.js`) is the control**, and this is what it was built
  for: a bar that appears beside a menu button while the button is dragged, with the
  handle showing where in the range the value is — which is what Superglue's own corner
  control looks like. It has no caller today; the roadmap says adopt it or delete it.
  Adopting it here settles that.
- **`css/main.css` ships to visitors as well as the editor**, which is where any rule
  the published page needs has to live. `css/edit.css` is editor-only.
- **Masks are known ground.** The icon set is drawn with `mask-image`, including the
  trap: a mask that fails to load masks *everything* out, so the element silently paints
  nothing while still being the right size and still passing `toBeVisible()`.
  `tests/e2e/icons.spec.js` has the A/B screenshot technique that catches it.

## Rounded corners

**Storage:** `object-border-radius`, a length. Save and render alongside `object-opacity`
in `module_object.inc.php`. Absent means square, so nothing changes for existing pages.

**Units — decide before building:** px is what hotglue stores everywhere else and keeps
a corner the same when an object is resized; a designer who chose 8px wants 8px.
Percent survives a resize proportionally and reaches a pill or an ellipse at 50%, which
is how Superglue's near-circular example is drawn. **Recommendation: px**, with the
slider's maximum derived from the object's own box (`min(width, height) / 2`, which IS
fully round), so the circle case is still one drag away.

**The part that is not one line:** `border-radius` does not clip children. A text
object paints its own background so it rounds correctly, but an image or video object
keeps its square corners inside the rounded box. The fix is one rule in `css/main.css`:

```css
.object > img, .object > video, .object > iframe { border-radius: inherit; }
```

which follows the object without touching the overflow toggle. Rounding via
`overflow: hidden` instead would fight the existing clip/show button, which is the
author's decision about something else.

## Edge fadeout

**Storage:** `object-edge-fade`, a length: how far in from each edge the fade reaches.

**Do not store the gradient.** Store the number, put it on the element as a custom
property, and let ONE rule in `css/main.css` build the mask from it. Storing a whole
`mask-image` string in an object attribute means commas and quotes in the file format
and the same gradient written out in two places (the editor's JS and the PHP render)
that must agree forever — the centered-layout wrapper is the cautionary tale for that.
So: `object_render_object()` sets `--glue-fade` and adds a `glue-edge-fade` class, the
editor does the same while dragging, and the CSS is written once.

The class matters: the rule must apply only to objects that asked for it. Putting a mask
on every object on the page costs a compositing layer each and risks the
mask-that-hides-everything failure on objects nobody has touched.

**Two ways to draw it — decide before building:**

- **Rectangle-faithful:** two linear gradients, one per axis, combined with
  `mask-composite: intersect`. Fades all four edges evenly and keeps the corners square
  in feel. Chrome 120+ and Firefox 53+; where it is not supported the default `add`
  composite degrades to a weaker vignette rather than to nothing.
- **Radial vignette:** one `radial-gradient`, no compositing, works everywhere. Fades
  the corners more than the edges, which reads as a soft oval rather than a soft
  rectangle.

**Recommendation: the two-gradient version**, since "fade the edges" is what was asked
for and the degradation is graceful.

**Interaction with rounded corners:** none — different properties, they compose.

## UI

One button each in the object context menu (left column), next to clone and
transparency, each opening `$.glue.rangeslider` on drag. Live apply while dragging, save
on release, which is what every other slider in that menu does.

**Both need artwork.** Nothing in the current set reads as "corner radius" or "soft
edge"; the closest are `border-width` and `graphic-shape`, and neither says it. Two
drawings for the upstream `extra/` folder, and `.glue-btn-label` placeholders until they
arrive — noting that the roadmap currently has exactly one placeholder left, so this
adds two back.

## Tests

`tests/e2e/object-shape.spec.js`, following what the existing specs do:

- each value applies live, is stored as its `object-*` attribute, survives a reload, and
  reaches the published page (`?page` without `/edit`);
- dragging back to zero REMOVES the attribute rather than storing `0px` — the rule the
  overflow toggle and both panel resets already follow;
- an image object's corners round with the object (the `border-radius: inherit` rule);
- the fade actually paints, by the A/B screenshot technique in `icons.spec.js`: shoot
  the object, repoint the mask at nothing, shoot again, and require the two to differ.
  Without this a broken mask reads as a pass everywhere else.

## Effort

Rounded corners: half a day including tests, most of it the media-child rule and the
round trip. Edge fade: about the same, with `mask-composite` the only real unknown —
worth a ten-minute spike in both engines before committing to the two-gradient version.
The slider adoption is shared and small.

## Out of scope

- Per-corner radii and per-edge fades. Superglue has one value for all four corners, and
  a four-handle UI is a different design problem.
- Shadows, borders and other edge treatments.
- Any change to the overflow toggle.
