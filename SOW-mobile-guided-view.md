# SOW — Mobile Guided View (`js/mobile-guided.js`)

Status: to implement. Branch: `ng`.
Goal: make fixed-canvas Hotglue pages readable and navigable on phones WITHOUT
reflowing or moving any content. Pages stay pixel-exact; we add a pan/zoom viewing
layer for small screens only.

## Summary

On small screens, when a page is wider than the viewport, load `js/mobile-guided.js`
which:
1. Lands the viewer at a sensible ENTRY POINT (top-most content), zoomed to a scale
   where text there is READABLE (or, for image-only pages, fit to the content).
2. Lets the user freely PAN (drag in all directions) and ZOOM (pinch in AND out) to
   explore the rest of the composition.

This is VIEWING-mode only, small-screen only. It must NOT affect the editor, desktop
viewing, or the stored page data. Nothing about the page is reordered or reflowed.

## Activation conditions (all must hold)

- Viewing mode (NOT the editor — confirm the edit-mode guard).
- Small screen (define a viewport-width threshold, e.g. <= 768px; prefer viewport
  width over user-agent sniffing).
- Page content width > viewport width (a page that already fits needs NO
  intervention — leave it alone).

If any fails, do nothing (normal rendering).

## Determining the initial zoom + entry point

Hotglue pages are absolute-positioned; content is scattered, coordinates may be
NEGATIVE, and there may be NO content at literal (0,0). Always derive the bounding box
from the actual min/max across objects — never assume an origin at (0,0). (Measured:
`content/mort` starts at y = **-13**.)

### Classifying the page: text-led or image-led

Do NOT branch on the boolean "does this page contain any text object?" — it misroutes
real pages. Measured: `content/mort` has exactly **1 text object among 95** (92 images,
2 iframes), so a boolean test sends a visually image-only page down the text path and
anchors it on a lone 100x100 box at y = -13 whose font is inherited (i.e. unknowable
server-side).

Branch on a RATIO instead: treat a page as text-led only when text is a meaningful
share of it. Start at **>15% of positioned objects** (or a comparable share of
bounding-box area) and tune against the two test pages:

| page | text / objects | | verdict |
|---|---|---|---|
| `content/zinecamp2015` | 32 / 65 | 49% | text-led |
| `content/mort` | 1 / 95 | 1% | image-led |

### A. Text-led pages (the common case)

- **Entry point = the top-most (smallest `object-top`), then left-most
  (`object-left`) TEXT element.** Anchor the initial view there, NOT at geometric
  (0,0) — (0,0) may be empty.
- **Readable scale**: pick a scale so the BODY text at the entry region renders at a
  comfortable size after scaling (target ~16px CSS, hard floor ~12px). Formula:
  `scale = target_px / entry_region_font_px`.
  - Target the DOMINANT/body text size in the entry region, NOT the largest heading
    (a 72px title would zoom out too far) and NOT the single smallest caption (an 8px
    caption would zoom in absurdly). Sample the body-ish text near the entry point.
  - Apply a floor and ceiling to the resulting scale so outliers don't produce absurd
    zoom (e.g. clamp scale to a sane range).
  - Factor `devicePixelRatio` so "readable" is consistent across low-DPI and retina
    devices.

### B. Image-led pages (real example: `content/mort/`)

- No usable font to key on. Instead **fit to the content bounding box width** so the
  visual composition is viewable, then let the user pinch to explore. Do NOT zoom into
  one image arbitrarily — show the composition, let them navigate.
- If the page has a token text object or two (as `content/mort` does), ignore them for
  scale purposes. They are not what the visitor came for.

### Data source: measure client-side (server-side data is NOT sufficient)

**Decided by measurement, not preference.** An earlier draft made server-side parsing
the primary path with client-side as a fallback. Counting the real test pages reversed
that: explicit `text-font-size` is present on only a minority of text objects.

| page | text objects | with explicit `text-font-size` | |
|---|---|---|---|
| `content/zinecamp2015` | 32 | 10 | **31%** |
| `content/mort` | 1 | 0 | **0%** |

69% of zinecamp's text inherits its size from the stylesheet, so the object files
cannot answer "how large does this text actually render?" — the single number the
readable scale depends on. Server-side data is therefore a hint at best.

- **Client-side measurement is the PRIMARY path.** Measure the RENDERED page: find the
  text elements near the entry point and read their true size via
  `getBoundingClientRect()` / `getComputedStyle()`, then compute the scale from that.
  For image-led pages, measure the content bounding box from rendered elements. This
  also absorbs the cases object files can never cover: inherited sizes, non-px units,
  and web fonts whose rendered metrics differ from what was declared.
- **v1 needs NO PHP beyond loading the script.** Computing entirely client-side means
  `render_page()` and the viewport emission are left alone — worth keeping in mind,
  since the canvas-width override there was deliberately reverted off `ng`. Add a
  server-side hint later ONLY if the render-then-adjust flash proves visible in
  practice.
- **Reference (not the v1 path):** the object files in `head/` do carry
  `object-top`/`object-left`/`object-width`/`object-height` for every object, plus
  `text-font-size` on the minority of text objects that set it explicitly. Example
  object file:
  ```
  type:text
  module:text
  object-top:886.111133863897px
  object-left:1277.10076976117px
  object-width:269.777777671814px
  object-height:465.777777671814px
  text-font-size:11px
  ...text...
  ```
  Geometry from these files is reliable and would be enough for the bounding box, the
  text/image ratio and the entry-point PICK. Only the readable SCALE is unavailable,
  because it depends on font sizes that mostly aren't recorded — which is why v1
  measures everything client-side rather than splitting the work across two sources.
  NOTE: no existing helper does this. A `_page_canvas_width()` in `module_glue.inc.php`
  previously walked these same files for `object-left`/`object-width` and would have
  been the natural thing to extend, but it was reverted off `ng` with the rest of the
  earlier mobile work. Write it fresh — it is a `scandir()` + `load_object()` loop, and
  `load_object()` is still present.
- **Client-side fallback (robust):** server data is NOT one-size-fits-all — some text
  has no explicit `text-font-size` (inherits from stylesheet), sizes may be non-px,
  web fonts may render differently, and image-only pages have no font lines at all
  (real example: `content/mort/head/*` has zero `font` matches). So when server-side
  data is absent/ambiguous, fall back to measuring the RENDERED page client-side:
  find text elements near the entry point, measure their actual pixel size
  (`getBoundingClientRect` / computed style), compute scale from that. For image-only
  pages, measure the content bounding box from rendered elements.
- Implementation choice (decide during build): compute entry+scale server-side and
  pass to `mobile-guided.js` as data attributes / a small inline config, OR compute
  entirely client-side on load, OR hybrid (server hint + client verify). Hybrid is
  most robust; pure client-side is simplest and handles all edge cases at the cost of
  a brief render-then-adjust. Start with whichever is simpler to get correct;
  correctness of the readable scale matters more than avoiding a flash.

## Pan & zoom behaviour

- After landing at the entry point + readable scale, the user can **pan freely**
  (drag in all directions) — they know there's more because the page is clearly
  larger than the screen.
- **Pinch to zoom BOTH IN AND OUT.** NOTE: production hotglue.me only allows zoom-IN,
  not out. The cause is NOT `maximum-scale` / `user-scalable` — neither is set
  anywhere in this codebase. It is the viewport's `width=` value: when the declared
  width exceeds the device width, browsers clamp MINIMUM zoom to the scale at which
  that width fits, so you cannot zoom out past fit-to-canvas. On `ng` the
  canvas-width override that caused this has already been reverted — `html_finalize()`
  in `html.inc.php` now emits a fixed `width=device-width, initial-scale=1`.
  **VERIFIED on a real phone (2026-08-21): pinch-zoom-out works. No work required.**
  This also confirms the diagnosis — removing the `width=` override was what fixed it,
  so relaxing `maximum-scale` would have been a no-op. Whatever viewport is emitted in
  future, keep it free of `maximum-scale` and `user-scalable=no`, and do NOT reinstate
  a canvas-width `width=` value: that is what broke zoom-out in the first place.
- Prefer NATIVE touch pan/zoom where possible (momentum/inertia feels better than
  custom JS panning). Only hand-roll if native can't deliver the initial-scale +
  entry-point positioning.
- **Do NOT auto-zoom.** (An earlier design considered auto-zooming-in after a
  drag-while-zoomed-out; it was DROPPED — inferring intent and overriding the user's
  gesture is annoying. The user zooms in/out themselves.)
- OPTIONAL (nice-to-have, user-initiated): double-tap to zoom to the readable scale
  centered on the tapped point. Standard gesture, no intent-guessing. Add only if
  cheap; not required for v1.

## Initial "Powers of Ten" reveal (IN for v1)

On arrival, briefly pull back to show the page's full WIDTH (so the user grasps the
composition and understands there's more than fits the screen), then smoothly zoom/pan
IN to the entry point at the readable scale. This teaches spatial awareness with zero
UI chrome — the user learns "this is a big canvas I can explore" by seeing it happen.

**"The whole page" is not literally achievable — pull back to fit-WIDTH, not
fit-contain.** Hotglue canvases are far taller than a phone is:

| | canvas | aspect | fit-width @390 | true contain-fit |
|---|---|---|---|---|
| `content/zinecamp2015` | 1642 x 5976 | 1 : 3.6 | 0.238 | 0.141 |
| `content/mort` | 4220 x 17590 | 1 : 4.2 | 0.092 | **0.048** |
| phone | 390 x 844 | 1 : 2.2 | | |

Contain-fitting `content/mort` renders it as a 202px-wide sliver at 4.8% scale, where
92 images are unrecognisable mush — a reveal starting from noise teaches nothing. So
pull back to fit-width and accept that the vertical extent still overflows (zinecamp
by ~1.7 screens, mort by ~2). Reword any "whole page" phrasing accordingly.

Spec (get these right or the reveal goes from charming to annoying):
- **Animation**: start at 75% of the fit-WIDTH scale (so the full canvas width sits on
  screen with a margin), end at the computed readable scale at the entry point.
  Continuous zoom+pan between the two — an Eames-style continuous move, NOT a cut.
  Prefer CSS transforms/transitions (GPU-accelerated) over per-frame JS.
- **SKIP the reveal on image-led pages.** Their target IS composition-fit, so start and
  end scales nearly coincide and the move is imperceptible — measured start-to-end
  zoom ratio:
  - `content/zinecamp2015` (text-led): `0.178 -> 0.941` = **5.3x**, a real move.
  - `content/mort` (image-led): `0.069 -> 0.092` = **1.33x**, not worth animating.
  Land image-led pages directly at composition-fit. If a reveal is wanted for them
  later it needs a DIFFERENT target (e.g. zoom in to the dominant image), which is a
  separate design question — not v1.
- **Brief**: **1.5s** for the whole zoom/pan move. Long enough to register the
  composition, short enough it never reads as a loading screen. Tune on a real device
  if needed, but err shorter — past ~2.5s it starts to feel like one.
- **Interruptible on TOUCH, not on movement**: abort on `touchstart`/`pointerdown` —
  any touch, including a plain tap. Do NOT wait for drag or pinch movement to be
  detected first: if you do, the opening pixels of the user's gesture fight the
  running animation, which feels broken. Abort by reading the computed transform
  matrix, writing it back as an inline style and dropping the transition, so control
  is handed over at exactly the current scale/position with no visual jump. Never
  trap the user in a non-skippable intro.
- **Once per page load; replays across pages, not within one.** The reveal plays on
  arrival at each page, including internal links to OTHER pages. It must NOT play for
  same-page anchor jumps. No flag or bookkeeping is needed to achieve this: Hotglue
  view-mode navigation is plain full-page loads (verified — no `pushState` /
  `hashchange` anywhere in view-mode JS), while a same-page fragment jump is a
  same-document navigation that never re-parses the document, so the script simply
  does not re-run. Play unconditionally on load and both halves of the rule hold.
  NOTE: back-navigation restored from bfcache also does not re-run the script, so the
  reveal is skipped and the user's prior position is kept — which is the wanted
  behaviour.
- **Respect `prefers-reduced-motion`**: if the user has OS-level reduced-motion set,
  SKIP the animation entirely and land directly at the readable zoom. Accessibility
  requirement (zoom animation can cause motion sickness) — not optional.
- After the reveal (or the skip), the user is at the readable scale/entry point and
  free pan/zoom (below) takes over.

## Out of scope for v1 (note, don't build)

- Any content reordering / linearization / stacked mobile view. That is a SEPARATE,
  author-driven approach: the author opts a page in and MARKS which elements belong
  in a curated mobile stack, which is then derived in Y-order with author override.
  It was specified in MOBILE-VIEW-DESIGN.md, which has since been reverted off `ng`
  (recover with `git show 6e6bd6b:MOBILE-VIEW-DESIGN.md` if needed). This SOW is
  pan/zoom of the intact composition only.
- Per-page author controls / mobile annotations (also part of that separate approach).
- Remembering the visitor's zoom/position per page across visits — parked for later.
  If built: prefer `localStorage` keyed by page name over a cookie, since a cookie is
  re-sent on EVERY http request for no benefit here. Note it interacts with the
  reveal — a restored zoom means either skipping the reveal on that page, or
  animating to the saved scale instead of the computed readable one. Decide then.

## Constraints

- `js/mobile-guided.js` is VANILLA JS (consistent with the dejQuery'd `ng` editor).
  No jQuery.
- Loads ONLY in viewing mode on small screens meeting the activation conditions.
  Must not load in the editor or affect desktop.
- Must not modify stored page data — this is a pure view-layer overlay.
- Must not break pages that already fit (activation condition guards this).
- If a minified copy is shipped, follow the project's ACTUAL convention: there is no
  build pipeline at all — no bundler, no `package.json`, no terser config. See
  MODERNIZATION.md's "Build tooling" row: the project is deliberately no-build, and
  minified copies are produced by a small one-off script, matching today's
  `*.min.js` pairs. Do not hand-minify.
- Test on REAL pages of both types: a text-led page (`content/zinecamp2015/`, 1642 x
  5976, 32 text / 65 objects) and an image-led page (`content/mort/`, 4220 x 17590,
  1 text / 95 objects). Confirm the text page lands readable at a sensible entry point
  — measured: top-most text sits at x=1279 of a 1642px canvas, i.e. 78% across, so
  anchoring at (0,0) would land on empty canvas — and that the image page fits the
  composition. Test on actual phone viewport sizes, not just a narrowed desktop
  window.

## Definition of done

- On arrival at a wider-than-viewport TEXT-LED page on a small screen, the "Powers of
  Ten" reveal plays: the page's full WIDTH shown briefly, then a smooth continuous
  1.5s zoom/pan to the readable entry point. It is interruptible (any touch aborts
  it), plays on each page load but never on a same-page anchor jump, and is SKIPPED
  when `prefers-reduced-motion` is set.
- After the reveal/skip, a text-led page sits zoomed to a readable scale at the
  top-most text element; the user can pan and pinch-zoom (in AND out) freely.
- An image-led page lands DIRECTLY at composition-fit with no reveal; pan/pinch works.
- Pages are classified text-led vs image-led by RATIO, not by a boolean "has any
  text" test — `content/mort` (1 text object of 95) must classify as image-led.
- Bounding boxes are computed from actual min/max and handle NEGATIVE coordinates
  (`content/mort` starts at y = -13).
- Entry point and readable scale are measured CLIENT-SIDE from the rendered page.
  Correct on text whose size is inherited rather than declared — which is 69% of
  `content/zinecamp2015`'s text objects, so this is the common case, not an edge one.
- ~~Pinch-zoom-OUT works.~~ **DONE — verified on a real phone, 2026-08-21.** Already
  satisfied on `ng` by the revert of the canvas-width viewport override; no code
  needed. Only regression-check it: any change that reinstates a `width=<canvas>`
  viewport would break it again.
- No auto-zoom; zoom is user-initiated. (Optional double-tap-to-readable if cheap.)
- `mobile-guided.js` is vanilla, loaded only under the activation conditions, and
  doesn't touch stored data.
