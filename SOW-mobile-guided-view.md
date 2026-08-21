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

Hotglue pages are absolute-positioned; content is scattered and there may be NO
content at literal (0,0). Two page types need different handling:

### A. Pages WITH text (the common case)

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

### B. Pages with NO text (e.g. image-only — real example: `content/mort/`)

- No font to key on. Instead **fit to the content bounding box width** (or the
  dominant image) so the visual composition is viewable, then let the user pinch to
  explore. Do NOT zoom into one image arbitrarily — show the composition, let them
  navigate.

### Data source: server-side first, client-side fallback

- **Server-side (preferred, fast):** parse the page's object files in `head/` for
  `text-font-size` (and `object-top`/`object-left`/`object-width`/`object-height`
  for geometry). Example object file:
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
  From these you can compute: the content bounding box (max object-left+width, etc.),
  which elements are text, their positions, and their font sizes — enough to pick the
  entry point and readable scale before render.
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
  in `html.inc.php` now emits a fixed `width=device-width, initial-scale=1` — so
  zoom-out likely already works here. VERIFY on a real device before doing any work
  for it. Whatever viewport is emitted, keep it free of `maximum-scale` and
  `user-scalable=no`.
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

On first arrival, briefly show the WHOLE page (so the user grasps the composition and
understands there's more than fits the screen), then smoothly zoom/pan IN to the entry
point at the readable scale. This teaches spatial awareness with zero UI chrome — the
user learns "this is a big canvas I can explore" by seeing it happen.

Spec (get these right or the reveal goes from charming to annoying):
- **Animation**: start at fit-whole-page scale (~75% of viewport width so it's clearly
  "the whole thing" with a margin), end at the computed readable scale at the entry
  point (text pages) / composition-fit (image pages). Continuous zoom+pan between the
  two — an Eames-style continuous move, NOT a cut. Prefer CSS transforms/transitions
  (GPU-accelerated) over per-frame JS.
- **Brief**: long enough to register the composition, short enough it never feels like
  a trapped loading screen. Tune to feel; err shorter.
- **Interruptible**: if the user touches the screen DURING the reveal, abort the
  animation immediately and hand them control at the current scale/position. Never
  trap them in a non-skippable intro.
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
- Test on REAL pages of both types: a text-heavy page (`content/zinecamp2015/`) and
  an image-only page (`content/mort/`). Confirm the text page lands readable at a
  sensible entry point, and the image page fits the composition. Test on actual
  phone viewport sizes, not just a narrowed desktop window.

## Definition of done

- On first arrival at a wider-than-viewport page on a small screen, the "Powers of
  Ten" reveal plays: whole page shown briefly, then a smooth continuous zoom/pan to
  the readable entry point. It is interruptible (touch aborts it), plays on each page
  load but never on a same-page anchor jump, and is SKIPPED when
  `prefers-reduced-motion` is set.
- After the reveal/skip, a text page sits zoomed to a readable scale at the top-most
  text element; the user can pan and pinch-zoom (in AND out) freely.
- An image-only page loads fit to its composition; pan/pinch works.
- Pages that already fit the viewport, the editor, and desktop viewing are all
  unaffected.
- Font size / geometry taken from server-side `head/` object files where available,
  with a client-side measurement fallback when absent or ambiguous.
- Pinch-zoom-OUT works. (May already hold on `ng`, since the canvas-width viewport
  override that caused the zoom-in-only behaviour has been reverted — verify on a
  device rather than assuming work is needed here.)
- No auto-zoom; zoom is user-initiated. (Optional double-tap-to-readable if cheap.)
- `mobile-guided.js` is vanilla, loaded only under the activation conditions, and
  doesn't touch stored data.
