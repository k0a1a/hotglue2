# SOW — Mobile Guided View (`js/mobile-guided.js`)

Status: **implemented on `ng`** (`4ee9dc0` … `4809d62`). This document now records the
design as built, and the measurements that forced each decision. Where an earlier
draft of this SOW specified something different, that is called out — the reversals
cost debugging round trips and are kept so nobody re-derives them.

Goal: make fixed-canvas Hotglue pages readable and navigable on phones WITHOUT
reflowing or moving any content. Pages stay pixel-exact; a pan/zoom viewing layer is
added for small screens only.

## Summary — the whole behaviour in four steps

1. **Open showing 75% of the canvas's LIMITING dimension**, anchored at the canvas
   origin (centred on the other axis). Not 100%: the last quarter is one drag away, and
   75% is that much more legible.
2. **Zoom in to the canvas origin at NATURAL SIZE** (`scale = 1`), where the page
   looks exactly as authored. One continuous 1.5s move, after a 0.5s dwell.
3. From there the visitor **pinch-zooms freely** (out as far as that opening view, in
   as far as they like) and **drags** to reach the rest.
4. **Double-tap toggles the whole composition into view** and back to natural size. The
   browser's pinch range cannot reach contain-fit on a large canvas, so this moves the
   transform instead, which is subject to no floor at all.

This is VIEWING-mode only, small-screen only. It does NOT affect the editor, desktop
viewing, or the stored page data. Nothing about the page is reordered or reflowed.

### It deliberately does not inspect the content

The script never looks at what is on the page — no font measurement, no
text-led/image-led classification, no entry-point selection. An earlier design (and an
earlier draft of this SOW) specified all three. Each was a guess and each guessed wrong
on a real page:

- Entry-point selection chose a **68x21px label reading "\*ZINES"** at x=1279 over the
  **500x715 poster** at (31,30) that actually opens `content/zinecamp2015`. Adding a
  size floor to fix that only moved the guess around.
- Readable-scale-from-font-size landed `content/mort` at a scale where its median image
  rendered **57px across**.
- Ratio-based classification existed only to feed those two.

A fixed fraction of the width, and natural size, need no guesses and behave identically
on every page and in every browser. The simplification removed 105 lines net.

Geometry is still needed, and is read from the **inline styles Hotglue writes on every
object** (`el.style.left/top/width/height`, falling back to `offsetWidth/Height`), so it
is correct before a single image has finished loading.

## Activation conditions (all must hold)

- **Viewing mode.** Gated in `common.inc.php` — the script is loaded in the `else`
  branch of the `$add_glue` test, so it is never present in the editor at all. This is
  a load-time gate, not a runtime one, deliberately: the editor is not a mobile-viewing
  surface and the script must never fight the editor's own drag/resize handling.
- **The page has objects.** No `.object` elements ⇒ return.
- **Small screen**: layout viewport width ≤ **768px**.
- **Canvas wider than the viewport.** A page that already fits needs no intervention.

`?guided=1` / `?guided=0` override the last two (see *Dev/QA overrides*). Neither can
override the view-mode gate.

## Mechanism — where scale and translation live

- **Scale lives in a CSS `transform` PERMANENTLY.** Native page zoom cannot be set or
  animated programmatically: `visualViewport.scale` is read-only, and scale is only
  settable via the viewport meta at parse time. The reveal must also abort on touch, so
  handing scale off to native zoom would mean swapping coordinate spaces at the exact
  moment the user's finger lands.
- **Everything sits in one wrapper (`#hg-mg-canvas`) under a single uniform
  `scale()`**, so relative positions are exact and no object moves with respect to any
  other. The wrapper is `position:absolute; top:0; left:0; transform-origin:0 0`, and
  objects are `position:absolute`, so the canvas must sit at the origin of a positioned
  ancestor for every offset to survive untouched.
- **Translation converts to DOCUMENT scrolling**, with `body` itself sized to the scaled
  canvas (`canvasW * scale` by `canvasH * scale`). Native momentum panning is kept for
  free. Only a NEGATIVE pan — the centring case, when the scaled canvas is narrower or
  shorter than the viewport — stays in the transform, because a scroll offset cannot go
  negative.
- The transform reads right-to-left: `translate(-pan) scale(s) translate(-min)` — shift
  the bounding box to the origin, then scale, then pan. Pan is in post-scale
  (document) px.

### The bounding box

Coordinates go NEGATIVE on real pages, so the box is min/max across all objects — never
assume an origin at (0,0), and never assume content exists there:

| page | objects | origin | canvas |
|---|---|---|---|
| `content/zinecamp2015` | 65 | 32, 30 | 1642 x 5976 |
| `content/mort` | 95 | 28, **-13** | 4220 x 17590 |
| `content/wide` | 26 | 285, 100 | 6990 x 954 |

## The zoom floor — a flat 0.25, and nothing moves it

Measured on device, on both engines: **the browser will not zoom out past 0.25**, i.e.
a quarter of the layout viewport. Four readings, and every one bottomed out on the same
number:

| | viewport | docWidth | min scale reached | visible at min |
|---|---|---|---|---|
| Firefox, `zinecamp2015` | 360x649 | 3315 (padded) | 0.2500 | 1440x2596 = 4x |
| Firefox, `mort` | 360x649 | 4220 (unpadded) | 0.2500 | 1440x2596 = 4x |
| Chrome, `zinecamp2015` | 411x750 | 3275 (padded) | 0.2500 | 1644x3000 = 4x |
| Chrome, `mort` | 411x750 | 4220 (unpadded) | 0.2500 | 1644x3000 = 4x |

Two engines, two pages, two viewport widths, padded documents and unpadded ones —
0.2500 every time, and exactly 4x the layout viewport in each case (360→1440, 411→1644,
649→2596, 750→3000). Taken with `minimum-scale` both declared and omitted, via a
temporary `?minscale=0` switch (since removed along with the declaration), and with
`CACHE_TIME` at 0 so nothing came from cache. Note `controller.inc.php` keys its cache on
the page name alone, so if caching is ever enabled, a query-param A/B like that one will
silently serve one variant's HTML for the other.

### What this replaces

An earlier version of this document stated the floor as
`max(minimum-scale, viewport / documentWidth)` and built three mechanisms on it. All
three are wrong, and the code no longer contains any of them:

- **Document padding is gone.** Widening the document with blank space to lower
  `viewport / documentWidth` cannot work, because the floor does not depend on document
  width. `zinecamp2015` was carrying 1673px of blank canvas to "lower the zoom floor to
  0.1086" and the floor stayed at 0.25. It bought nothing and cost a screenful of empty
  space to scroll into.
- **`minimum-scale=0.1` did nothing, and is gone.** Engines clamp a declared
  minimum-scale into `[0.25, 5]`, so 0.1 was silently becoming 0.25. Omitting it changed
  no reading. `html_finalize()` now emits a plain
  `width=device-width, initial-scale=1`.
- **The width-keying rationale evaporates.** Commit `4809d62` gave up contain-fit and
  settled for 75%-of-width specifically because "an opening pulled back further than
  fit-width can never be returned to". The real constraint is simply
  `startScale > 0.25`, which has nothing to do with fit-width.

The `0.2199 against a fit-width of 0.2192` measurement quoted in `4809d62` — the reading
that founded the old rule — could not be reproduced on hardware, and a flat 0.25 floor
makes it impossible. It most likely came from desktop Chrome's responsive-design mode,
which does not clamp the way a device does. **Do not measure viewport behaviour in
responsive-design mode.**

### The consequence: a fixed 20x window

Both engines clamp pinch to `[0.25, 5]`. What the visitor sees is
`browserZoom × transform`, so our transform decides *where* that 20x window sits:

```
reachable scales = [0.25 × T, 5 × T]        T = our transform scale
```

Parked at natural size (`T = 1`) the window is `[0.25, 5]`: natural size is in it, and
4x pulled back is the far edge. **Anything further out than 4x the layout viewport is
unreachable by pinch, on any page, on any device.** That is a platform constant, not
something to tune.

The rule that follows is **not** "clamp everything into the window". It is:

> Where a view we need lies outside the window — which is the opening view on any large
> canvas — it must be reached by moving the TRANSFORM, not by pinching. That is what the
> double-tap toggle is for.

### Opening scale

```
openBase   = min(1, min(fitWidth, fitHeight) / 0.75)      // contain-fit / 0.75
startScale = openBase × zoomComp
```

75% of whichever dimension is **limiting**, with **no floor** — the opening is allowed
to sit below what the visitor can pinch back out to. Two separate corrections got it
here, and both are worth keeping written down because each looks like a bug from the
outside.

**Limiting, not width.** Keyed to width alone, a tall page opens on a thin horizontal
band: `content/zinecamp2015` is 1642x5976, so 75% of its width is only 37% of its
height, and the visitor sees a strip across the top rather than a composition. Taking
the more constrained dimension shows 75% of that one and 100% of the other:

| page @ vw 360 | width rule | limiting rule | reveal move |
|---|---|---|---|
| `content/zinecamp2015` | 0.2923 — 75% w, **37% h** | 0.1448 — 100% w, 75% h | 6.9x |
| `content/mort` | 0.1137 — 75% w, **32% h** | 0.0492 — 100% w, 75% h | 20.3x |
| `content/wide` | 0.0687 — 75% w, 100% h | 0.0687 — unchanged | 14.6x |

A wide, short canvas is unaffected, since width is limiting there anyway — the rule
generalizes rather than special-casing orientation.

**No floor.** Since an opening below 0.25 cannot be returned to *by pinch*, it was
briefly clamped to `0.25 × 1.25 = 0.3125`. That kept the guarantee and destroyed the
view: `content/wide` opened on 16% of its composition and `content/mort` on 27%, which
read — correctly — as having no pulled-back view at all. A reveal that pulls back by a
sixth is not a reveal.

The clamp was only ever needed because pinch was the only way back. Double-tap is not
subject to the floor, so the guarantee survives by a different route: double-tap returns
to `openBase` exactly, and the whole composition is a pinch further out from there,
since `openBase` is contain-fit divided by 0.75 and `0.25 × openBase` is comfortably
below contain-fit.
| `content/zinecamp2015` | 0.2923 | [0.0258, 0.516] | yes |

So the opening is reached by double-tapping out and pinching back in, rather than by
pinch alone. Reveal moves are 3.4x, 8.8x and 14.6x respectively.


### The layout viewport is not a device constant

`documentElement.clientWidth` is the input every scale divides by, and it is **not a
property of the phone**. Measured on one handset, same page, same session:

| | layout viewport |
|---|---|
| Firefox Android | 360 x 649 |
| Chrome, stock (page zoom 150%) | **274 x 500** |
| Chrome, page zoom 100% | 411 x 750 |

Two effects stack. The engines disagree on the CSS-px basis for the same panel (Firefox
360 vs Chrome 411, a DPR difference) *before* zoom enters. Then Chrome applies a default
page zoom that **follows the OS display/font-size setting**, whose own default varies
with the device's screen size. 150% is what this device ships with — not a user tweak —
and `411 / 1.5 = 274`, `750 / 1.5 = 500`, exactly.

Page zoom needs no compensation: unlike pinch zoom it resizes the layout viewport rather
than multiplying on top of it, so `clientWidth` reports the truth and everything
downstream stays consistent. The problem is only that its value cannot be predicted, so
**no scale here may be expressed as a bare constant tuned to one device**. Since the
floor is a flat 0.25 of whatever the layout viewport turns out to be, expressing the
opening relative to the floor makes reachability hold for every `vw` automatically.

### Landing scale is 1.0 — natural size

Anything derived from fitting the canvas to the screen lands zoomed OUT by construction:
fit-width on `content/zinecamp2015` is 0.2192, at which its 18px body text renders
**4px**. The reveal would end with nothing legible and nothing zoomed into. At 1:1 the
page appears exactly as authored, which is both the readable scale and the honest one,
and needs no content inspection to arrive at. No cap is needed — 1.0 IS natural size, so
it cannot upscale anything.

Both the opening and the landing are anchored at the canvas origin, so on a tall page
the reveal is a pure zoom with no pan. Centring (the negative-pan branch) engages only
when the scaled canvas is smaller than the viewport on an axis — the normal case for a
wide, short canvas like `content/wide`.

## Restored pinch level — the recurring trap

Mobile browsers remember the visitor's pinch level per tab and restore it on reload.
**Our transform and the browser's zoom MULTIPLY**, so a page reloaded at 0.1 rendered a
tenth of its intended size. It cannot be reset from here: `initial-scale` is only
advisory on a reload, and forcing re-evaluation means mutating the viewport meta, which
Firefox ignores. So it is measured (`visualViewport.scale`) and divided out:

```
zoomComp = 1 / clamp(0.25, 4, zoom0)
```

Clamped, because fully compensating a 0.1 restore would mean a 10x transform and a
document tens of thousands of pixels across. The layout viewport does not move with
zoom, so every measured figure stays correct; only the scales handed to the transform
need adjusting.

That multiplication is the trap that keeps recurring — it also broke a double-tap
overview toggle and killed zoom-out entirely when the document was sized to the
viewport. **Any scale set from script is only meaningful relative to the browser's
current zoom.**

## Double-tap — back to how it opened

The pinch window is 20x wide and fixed. Parked at natural size it reaches 4x pulled back
and no further, which does not reach the opening view on a large canvas — `content/mort`
opens at 0.1137 against a floor of 0.25. So the opening view is offered as a deliberate
gesture rather than by fighting the floor.

- **Double-tap** animates the transform back to `openBase` — **the exact scale and pan
  the reveal opened with** — over `TOGGLE_MS` = 400ms. Verified: the resulting transform
  string is identical to the one the reveal starts from, centring residue included.
- **Double-tap again** returns to natural size, **centred on whatever was tapped** — so
  the pulled-back view doubles as a way to choose where to go next, which is the standard
  map gesture and needs no new UI.
- Pinch works normally inside each state. The two states are two positions of the same
  20x window.
- **The whole composition is still reachable**, by pinching OUT from the opening view:
  that state's window is `[0.25 × openBase, 5 × openBase]`, and contain-fit is
  `0.75 × openBase`, comfortably inside it. This holds by construction now that
  `openBase` is defined as contain-fit ÷ 0.75, on any canvas and any viewport.
- **Degenerate case guarded:** a canvas barely larger than the screen puts `openBase` at
  natural size, which would leave the toggle with two identical states. It falls back to
  contain-fit there. The reveal is imperceptible on those pages for the same reason.
- **It compensates for the current pinch level** (`visualViewport.scale`, clamped to
  `[0.25, 4]` exactly as the load-time compensation does). Without this, double-tapping
  while pinched out to the floor lands at a quarter of the intended scale. This is the
  third place the transform-times-browser-zoom multiplication has bitten; it is the
  reason the earlier double-tap was removed in `4809d62`, and it is a bug, not a reason
  the gesture cannot work.
- **Armed only once the view has settled**, in `handoff()`. During the reveal a touch
  means ABORT, not toggle.
- `width=device-width` already disables the browser's own double-tap zoom on both
  engines, so there is nothing to compete with.
- A `dblclick` listener mirrors it for desktop iteration under `?guided=1`.

**Not a continuous zoom-out past 0.25**, which is not buildable: once the browser
clamps, `visualViewport.scale` stops moving, so there is no signal for how much further
the fingers are still spreading — the gesture is swallowed. Reacting on `touchend` with
a discrete step would read as the zoom sticking and then lurching. A deliberate,
animated, user-initiated move is honest about what we can and cannot see.

Implementation notes that are load-bearing:

- Scroll cannot be transitioned, so the current scroll is folded back into the transform
  before animating and handed back to scroll in `handoff()` at the end — the same
  pattern the reveal uses.
- The backstop timer (`TOGGLE_MS + 250`) must not fire a second time after
  `transitionend` has already handed over. By then the visitor may have panned, and
  re-running `handoff()` would yank them back to wherever the toggle landed.
- `transitionend` BUBBLES; filter on `target` and `propertyName` here too.

## The reveal ("Powers of Ten")

On arrival, hold the pulled-back view briefly so the composition registers, then move
continuously in to natural size at the origin. This teaches spatial awareness with zero
UI chrome — the visitor learns "this is a big canvas I can explore" by seeing it happen.

Constants (`js/mobile-guided.js`):

| | |
|---|---|
| `REVEAL_DWELL_MS` | 500 — hold at the pulled-back view before moving |
| `REVEAL_MS` | 1500 — the zoom/pan move |
| easing | computed per move — see *Pacing* below |
| `LOAD_WAIT_MS` | 2500 — cap on waiting for images |

- **One continuous CSS transform transition**, not a cut and not per-frame JS.

### Pacing: the zoom is exponential, not linear

Apparent size is multiplicative, so a zoom only feels even if each frame
multiplies the last by a constant. A CSS transition interpolates the transform
matrix LINEARLY, which over these ratios is visibly wrong. Measured on a device
before the fix, `content/mort`'s 19x move went **0.0525 → 0.7218 in its first
~400ms** and then crawled — nearly three quarters of the way in a quarter of the
time.

The fix is an easing, not a duration. Solving

```
start + (end - start) · e(t) = start · ratio^t
  ⇒  e(t) = (ratio^t - 1) / (ratio - 1)
```

gives the curve that makes a linear interpolation trace an exponential one. It is
sampled into a CSS `linear()` easing, composed with an ease-in-out applied to
TIME so the move still starts and stops softly. `zoom_transition()` builds it per
move, and the double-tap toggle uses the same thing — that move is the larger of
the two (`content/wide` toggles across 13.7x in 400ms).

**This must stay on the compositor.** Driving it per frame from
`requestAnimationFrame` gets the curve right and then loses it again to jank: on
`content/mort`, whose 92 images keep the main thread busy, rAF frames were
measured stalling for **533ms** mid-move, which is far worse than the pacing
problem being fixed. Measured after the fix, on the same page and device: 19x over
1312ms in 290 frames with no stall, log-progress 0.17 / 0.65 / 0.96 at the
quarter, half and three-quarter marks — a clean S-curve in log space.

`linear()` needs Chrome 113+, Firefox 112+ or Safari 17.2+, which the project's
evergreen baseline covers. Where it is missing, `log_easing()` returns null and
the move falls back to a plain cubic-bezier: the pacing is lost, nothing breaks.
- **Wait for `window.load` (capped at 2.5s), then for the page to be VISIBLE, then
  dwell.** The script is deferred, so it runs before a single image has painted;
  animating from there spends the pulled-back view on a blank page. Visibility is
  gated on `visibilitychange` explicitly — a page opened in a background tab must still
  have its reveal when the visitor finally looks.
- **Interruptible on TOUCH, not on movement**: abort on `touchstart`/`pointerdown` in
  the capture phase — any touch, including a plain tap. Do NOT wait to classify the
  gesture as a drag or pinch first: if you do, the opening pixels of the gesture fight
  the running animation and it feels broken. The abort reads the computed transform
  matrix and hands over from exactly there, so there is no visual jump. Never trap the
  visitor in a non-skippable intro.
- **Respect `prefers-reduced-motion`**: skip the animation entirely and land directly at
  natural size. Accessibility requirement — zoom animation can cause motion sickness.
- **Once per page load; replays across pages, not within one.** No flag or bookkeeping
  is needed: Hotglue view-mode navigation is plain full-page loads (verified — no
  `pushState` / `hashchange` anywhere in view-mode JS), while a same-page fragment jump
  never re-parses the document, so the script simply does not re-run. Back-navigation
  restored from bfcache likewise does not re-run it, so the reveal is skipped and the
  visitor's prior position is kept — which is the wanted behaviour.

An earlier draft specified pulling back to **contain-fit** (the whole canvas, both axes,
floored at a quarter of fit-width) and **skipping the reveal on image-led pages**. Both
are gone: contain-fit is below the zoom floor and therefore unreturnable (consequence 1
above), and with no classification there is no image-led branch to skip. The reveal now
plays on every activating page.

## Pinch-zoom-out — works, within the 0.25 floor

**VERIFIED on a real phone (2026-08-22): pinch-zoom-out works on both engines**, down to
the flat 0.25 floor documented above. `minimum-scale=0.1` turned out not to be what made
it work — it was clamped to 0.25, changed no measurement either way, and has been
removed.

Production hotglue.me only allows zoom-IN. The cause is NOT `maximum-scale` /
`user-scalable` — neither is set anywhere in this codebase. It is the viewport's
`width=` value: when the declared width exceeds the device width, browsers clamp minimum
zoom to the scale at which that width fits, so you cannot zoom out past fit-to-canvas.
On `ng` that canvas-width override was reverted; `html_finalize()` now emits a plain
`width=device-width, initial-scale=1`.

Regression-check only: any change that reinstates a `width=<canvas>` viewport breaks this
again. Never add `user-scalable=no` or `maximum-scale`, and do not re-add
`minimum-scale` — it cannot lower the floor, and the belief that it could cost several
rounds of debugging.

## Browser landmines (measured, not theorised)

Each of these cost a debugging round trip.

- **Never use `window.innerWidth` for the scale math. Use
  `document.documentElement.clientWidth`.** `innerWidth` is the VISUAL viewport and is
  not trustworthy: Chrome desktop reported 512 against a real 497 (it counts the
  scrollbar), and Firefox reported **1572 for a 393px viewport** and 1440 for a 360px
  one — 4x out, on both desktop responsive-design mode and Android. Every scale divides
  by this, so the pull-back computed 0.66 instead of 0.16 and the reveal collapsed from
  5x to 1.35x. It also made behaviour depend on WHICH PHYSICAL DISPLAY the window was
  on, via the OS scale factor. `clientWidth` is the layout viewport, in CSS px, stable
  under both pinch-zoom and display scaling.

- **Size `body` ITSELF and let the DOCUMENT scroll. Do not use a fixed-position scroll
  container, and do not overflow `body` with an oversized child.** Both wrong answers
  were tried:
  - An oversized DIV inside `body` fails in Firefox, which reported `scrollWidth` 1460
    while setting `scrollLeftMax` to **0.43** and refusing to scroll at all — so
    `window.scrollTo` and direct `scrollLeft` assignment both did nothing and the view
    snapped back to the origin. That failure is specifically about a CHILD overflowing
    `body`.
  - A fixed, viewport-sized box with an inner sizer (which an earlier draft of this SOW
    prescribed as the fix for the above) breaks pinch-zoom: a fixed box is pinned to the
    LAYOUT viewport while pinch acts on the VISUAL one, so zooming out merely shrinks the
    box into blank space, and with no document overflow the browser may refuse to zoom
    out at all. Pinch-zoom in AND out is a hard requirement and it needs real document
    overflow.

  `body`'s own box is ordinary scroll content and avoids both, which is why it is sized
  rather than wrapped.

- **Everything works in CSS px. Do NOT factor in `devicePixelRatio`.** A CSS pixel is
  already density-normalised. An earlier draft required multiplying by DPR; it would
  make text roughly three times too large on a modern handset, and it would deliberately
  reintroduce a bug already hit for real — keying anything off device pixels made the
  page behave differently on a 1080p laptop panel than on a 1440p external display, via
  the OS scale factor.

- **`transitionend` BUBBLES.** Filter on `event.target` and `propertyName`, or a
  transition on any descendant object ends the reveal early. No Hotglue CSS currently
  transitions `.object`, but per-site `user_code` CSS could add one at any time.

- **`requestAnimationFrame` does not fire while the document is hidden.** Do not gate the
  reveal on it; gate on `visibilitychange` explicitly.

- **A phone's console is not reachable from the dev machine**, which is why `?debug=1`
  exists. Diagnosing this class of bug by reasoning from symptoms failed repeatedly;
  asking the browser directly (`scrollLeftMax`, `visualViewport.scale`) settled it
  immediately.

## Dev/QA overrides (not A/B infrastructure)

- `?guided=1` forces activation on a wide screen; `?guided=0` forces it off on a phone.
  For desktop iteration and side-by-side comparison on a device.
- `?debug=1` paints the computed state onto the page itself — viewport, canvas box and
  origin, fit-width, opening and target scale, restored-zoom
  compensation, requested vs achieved scroll — and refreshes once the reveal has
  finished. It also POLLS (every 250ms) to report how far the browser ACTUALLY lets the
  visitor pinch out, versus how far the opening view needs. Polled rather than driven by
  `visualViewport`'s resize event because that event proved undependable: three
  on-device runs returned no reading at all, which could equally mean "the zoom never
  changed" or "the event never fired". It samples three independent witnesses —
  `visualViewport.scale`, `innerWidth` (the visual viewport, so it moves with pinch even
  where the event is silent) and Gecko's `scrollLeftMax` — so that no single engine's
  quirk can hide a change. All three sitting still while you pinch means zoom-out is
  genuinely blocked. Inert without the parameter.
- Neither may override the view-mode gate: this must never load in the editor.
- These are NOT an A/B mechanism. Hotglue has no analytics, tracking or event collection
  of any kind and no datastore but flat files, so there is nothing to measure against;
  and a URL parameter cannot bucket organic traffic anyway. They are for qualitative
  comparison — hand someone a phone and toggle.

## Constraints

- `js/mobile-guided.js` is VANILLA JS (consistent with the dejQuery'd `ng` editor). No
  jQuery.
- Loaded from `common.inc.php` with `html_add_js(..., 3, true)` — deferred, so the
  objects it measures are parsed before it runs.
- Loaded **unminified regardless of `USE_MIN_FILES`** for now: there is no `.min.js` pair
  yet, and `USE_MIN_FILES` defaults to true, so keying off it would 404 in any default
  install. If a minified copy is ever shipped, follow the project's ACTUAL convention —
  there is no build pipeline at all (no bundler, no `package.json`, no terser config; see
  MODERNIZATION.md's "Build tooling" row), and the existing `*.min.js` pairs were produced
  by a small one-off script. Do not hand-minify.
- Must not modify stored page data — this is a pure view-layer overlay.
- Must not break pages that already fit (activation condition guards this).

## Out of scope (noted, not built)

- Any content reordering / linearization / stacked mobile view. That is a SEPARATE,
  author-driven approach: the author opts a page in and MARKS which elements belong in a
  curated mobile stack, derived in Y-order with author override. It was specified in
  MOBILE-VIEW-DESIGN.md, which has since been reverted off `ng` (recover with
  `git show 6e6bd6b:MOBILE-VIEW-DESIGN.md`). This work is pan/zoom of the intact
  composition only.
- Per-page author controls / mobile annotations (also part of that separate approach).
- Remembering the visitor's zoom/position per page across visits. If built: prefer
  `localStorage` keyed by page name over a cookie, since a cookie is re-sent on EVERY
  http request for no benefit here. Note it interacts with the reveal — a restored zoom
  means either skipping the reveal on that page, or animating to the saved scale instead
  of natural size.
- Auto-zoom of any kind. An early design considered auto-zooming-in after a
  drag-while-zoomed-out; DROPPED — inferring intent and overriding the user's gesture is
  annoying. Zoom is user-initiated.

## Definition of done — all met

- On arrival at a wider-than-viewport page on a small screen, the reveal plays: the
  opening view held for 0.5s, then a smooth continuous 1.5s zoom to natural size at the
  canvas origin. ✔
- It aborts on any touch, plays on each page load but never on a same-page anchor jump,
  and is SKIPPED when `prefers-reduced-motion` is set. ✔
- After the reveal or the skip, the visitor can pan and pinch-zoom in AND out freely, and
  **can always return to the view the reveal opened with** — via double-tap plus pinch,
  since the transform is not subject to the browser's 0.25 pinch floor. ✔
- Double-tap returns to the exact view the reveal opened with, and again to natural size
  centred on the tapped point, compensating for the current pinch level. The whole
  composition is a pinch further out from there. ✔
- Bounding boxes are computed from actual min/max and handle NEGATIVE coordinates
  (`content/mort` starts at y = -13). ✔
- No content inspection: no font measurement, no page classification, no entry-point
  selection. ✔
- Pinch-zoom-OUT works — verified on a real phone, both engines, 2026-08-22, down to the
  platform's flat 0.25 floor. ✔
- `mobile-guided.js` is vanilla, loaded only under the activation conditions, and doesn't
  touch stored data. ✔

Tested against a text page (`content/zinecamp2015`, 1642 x 5976), an image page
(`content/mort`, 4220 x 17590, origin y = -13) and a wide-and-short page
(`content/wide`, 6990 x 954, which exercises the floor clamp and the centring branch), on
actual phone viewport sizes rather than a narrowed desktop window — and never in
responsive-design mode, which does not reproduce the pinch clamp.
