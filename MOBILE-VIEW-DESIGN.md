# Hotglue — Mobile View: Design Notes

Status: design agreed, not yet implemented. Target branch: `ng` (the modernized
vanilla-JS / Moveable / Alpine editor).
Audience: implementer (Claude Code) + future maintainer.

## Problem

Hotglue pages are **absolute-positioned fixed canvases**. On a phone they either
(a) scale down until text is unreadable, or (b) require horizontal scrolling to
reach off-screen elements. Neither is acceptable, and we must NOT convert Hotglue
to a reflow/responsive-CSS model — pixel-exact spatial composition is the whole
point of the tool and must stay intact on desktop.

Key insight driving the whole design: **people arriving on mobile want information,
not composition.** They come to get the nav, the key text, the one video — not to
marvel at the spatial design. So the mobile view should be a *curated, linear
information view*, authored by the page owner, NOT the desktop canvas shrunk.

## Core model

Author **opts in** by marking individual elements as **"mobile-friendly."** On a
narrow viewport, Hotglue renders those marked elements as a **vertical stack**,
each fit to the phone width, in an order derived from their desktop position.
Unmarked elements are not rendered in the stack; the full desktop composition
remains reachable via a separate "full page" view.

This is **additive and non-destructive**: it changes nothing about the desktop
canvas, and nothing about existing pages until an author chooses to curate.

### Behaviour rules (these are the spec)

1. **Opt-in marking.** Each object gets a boolean `mobile-friendly` (or similar)
   property. Default: unmarked.

2. **Stacking order = desktop top-down.** Marked elements stack in ascending Y
   (top of desktop page first). Tiebreak by ascending X (left first) for elements
   at the same/similar Y. This is the DEFAULT order — no author effort needed.

3. **Order override.** Allow a manual order override for the cases where
   visual-top != importance. Optional per element; only used when the author
   bothers. Auto-Y is the fallback whenever no override is set.

4. **Marked elements fit the phone width.** When rendered in the stack, an element
   renders at mobile-appropriate width (fit to frame / sensible max-width), stacked
   vertically. For MVP: auto-fit to frame width; do NOT require the author to set
   mobile sizes per element.

5. **Unmarked elements are NOT rendered in the stack.** The mobile stack is clean
   and info-first. Do NOT bleed unmarked absolutely-positioned elements behind the
   stack — on a 390px screen that produces overlap/horizontal-scroll mess. Instead:

6. **Full composition is reachable as a separate mode.** Provide an affordance
   ("view full page" / pinch-out) that switches to the scaled, pinch-zoomable
   desktop canvas (all elements, unmarked included). This is the "scroll around to
   see everything / marvel at the design if you want" path — a deliberate alternate
   view, not a default backdrop.

7. **Zero marks => fall back to scale-to-fit.** A page with NO mobile-friendly
   elements marked must behave exactly as plain scale-to-fit + pinch-zoom of the
   full canvas (see "Default / no-curation" below). The curated stack only engages
   once >= 1 element is marked. This guarantees all ~15k existing pages are
   unaffected on ship day.

## Default / no-curation behaviour (un-annotated pages)

For pages the author never touches:
- Emit a viewport that scales the full canvas to the phone width (fit-to-width),
  with pinch-zoom ENABLED (do not lock `user-scalable` / `maximum-scale`).
- Canvas width = bounding box of all objects (max x+width). Hotglue already stores
  object positions/sizes, so this is computable at render time. If object
  dimensions aren't reliably known server-side (e.g. images sized on load), a
  client-side measure-then-set-viewport pass is the fallback.
- Result: whole composition visible, shrunk, zoomable for detail. No horizontal
  scroll. This is the safe baseline; the curated stack is the opt-in upgrade.

## Editor UX

The marking + ordering happens in the editor, reusing interactions Hotglue users
already know.

- **Mobile-preview mode**: a distinct editor mode that renders a **narrow
  phone-shaped frame** (~390px wide). The visual switch to a tall narrow column is
  what signals "this is now a list / sequence", so dragging here means *reorder*,
  not *reposition*. Do the ordering in this framed mode, NOT on the full desktop
  canvas (spatial context fights sequential meaning).
- **Reuse drag.** Hotglue users already drag objects. In the phone frame, dragging
  an element up/down reorders the stack (standard list-reorder pattern). No new
  gesture to learn — the phone frame recontextualizes the familiar drag.
- **Marking** an element mobile-friendly: a per-object toggle (context-menu item /
  icon). Decide interaction, but the property is per-object.
- **Live preview**: author must be able to SEE the resulting mobile stack as they
  mark/order. Ideal: desktop canvas and phone-frame side by side; minimum: a fast
  toggle between canvas mode and mobile-preview mode. Without this authors are
  flying blind.

## Data model

- Per-object properties (rides on Hotglue's existing object property model):
  - `mobile-friendly` : bool (is this element in the mobile stack?)
  - `mobile-order`    : optional int/float (override; absent => use auto Y-order)
- Prefer per-object properties over a separate per-page "mobile manifest" — the
  object model already exists and per-object is simpler to edit inline. Order is
  derived (auto Y) unless `mobile-order` is set.

## Scope discipline — MVP vs later

**MVP (build + validate this first):**
- per-object `mobile-friendly` toggle
- phone-frame mobile-preview mode
- drag-to-reorder in the frame; auto Y-order default
- marked elements auto-fit to frame width, stacked
- unmarked elements hidden from stack; "view full page" affordance to the
  scaled/zoomable canvas
- zero-marks => scale-to-fit fallback

**Later (do NOT build yet):**
- per-element mobile font size / mobile-specific styling
- three-way element role (mobile-hidden / mobile-stacked / mobile-pinned e.g.
  a nav bar pinned to top)
- breakpoints / multiple mobile widths
- landscape-specific hints
- author-controlled mobile width per element

Resist turning this into a second layout engine. The MVP loop is: *see phone frame
-> mark + drag to curate/order -> that's the mobile view.* If that loop feels
native, everything else is additive.

## Validation before committing to the model

Prototype against a **real, complex page** (a busy art portfolio with many
positioned elements), not a clean mock. Mark 4-5 elements, check the auto-Y stack
reads as a coherent mobile info-page. If Y-order produces nonsense on real art
pages (importance may not follow Y there), the override becomes load-bearing rather
than occasional — which is a signal to reconsider the default ordering. Test on the
messiest real page available; that's where the model holds or reveals its gap.

Success test for the editor UX: a Hotglue user drops into mobile-preview mode and
starts dragging elements into order **without being told how**. If they intuit it,
the interaction is right.

## Design principles (the "why", so implementation stays on-philosophy)

- Do NOT make Hotglue responsive/reflow. Desktop stays fixed-canvas, sacrosanct.
- Mobile view = author-curated linear info view, opt-in, additive.
- Serve mobile visitors' actual intent (get info), not shrunk composition.
- Non-destructive: existing pages unchanged until the author curates.
- Reuse the known drag interaction; let a phone-shaped frame recontextualize it.
- Keep the fixed composition reachable (full-page view), just not as a messy
  bleed-through backdrop.

## Survey of approaches (prior art in this problem space)

"Fixed/absolute layout that can't reflow, must work on mobile" is a known problem
across domains (PDF viewers, maps, comics, fixed-canvas site builders, native UI).
The approaches below are roughly ordered by author effort. Our chosen design (see
above) is a deliberate combination of several; the rest are documented so the
implementer understands what was considered and rejected, and why.

**1. Scale-to-fit + pinch-zoom ("treat the page as an image/map").**
Set viewport to the design width; browser shrinks the whole canvas to fit; native
pinch-zoom for detail. Zero author effort, composition perfectly preserved.
Weakness: text unreadable at fit-scale, pinch-to-read is tedious.
=> WE USE THIS as the no-curation DEFAULT (see "Default / no-curation behaviour").
Correct as a baseline, insufficient as the only answer.

**2. Semantic zoom / level-of-detail (maps, taken further).**
Maps change *what is shown* per zoom level (city names zoomed out, streets zoomed
in). Applied here: show only important elements when zoomed out, reveal detail on
zoom in. Essentially our mobile-friendly marking reframed as a zoom continuum
rather than a mode switch. More elegant in theory, much harder to author and build.
=> NOT chosen — over-engineered for Hotglue; same insight delivered more simply by
explicit marking + a mode switch.

**3. Guided view / author-defined focus path (COMICS — the closest analog).**
Digital comics have Hotglue's exact problem: fixed spatial composition that must
work on phones. The industry solution is "Guided View" — the author defines a
*sequence of framed views/focus regions* across the fixed page, and the phone steps
through them one at a time, each framed to fit the screen, in author order. The
reader taps through; pan/zoom framing is preserved.
Why it's the interesting one: it's the ONLY approach that solves the exact problem
(fixed composition on phones) while PRESERVING the spatial framing instead of
flattening to a linear stack. Our current design linearizes marked elements into a
vertical list — clean and info-first, but it LOSES the spatial character that makes
a Hotglue page a Hotglue page. Guided view keeps it: a guided tour of the
composition rather than an info-stack.
Tradeoffs: more to build (a viewport-path "player" that frames+pans between focus
regions vs. a CSS stack); worse for the pure-info case (a nav menu wants a list, not
a guided tour). May differ BY PAGE TYPE — info pages want the stack (our model),
art pages might be better served by guided view.
=> NOT chosen for MVP, but explicitly worth understanding before committing to
linearize-to-stack. Look at how a comics guided-view player is modelled (e.g.
ComiXML / "Guided View" panel sequencing). The open question it raises:
**does Hotglue's mobile view want to be a linear info-stack, or a guided tour of
the composition?** Likely answer: even art-Hotglue authors mostly want mobile
visitors to get info/links, and the pure-composition case is served well enough by
scale-to-fit + pinch-zoom (#1) — so the stack is right for the common case. But
guided-view could be a *second* author-chosen mobile mode later (info pages ->
stack; art pages -> guided tour). Understanding why we're NOT doing it now sharpens
why the stack is right.

**4. Separate mobile layout, author-authored ("two designs").**
Author positions everything twice (desktop + mobile). Max control, max work. What
early fixed-canvas builders did (early Wix, Adobe Muse, Webflow per-breakpoint).
The industry arc is telling: they all started here, found authors WON'T do the
double work, and moved to "auto-derive a mobile layout from the desktop one, then
let the author adjust."
=> NOT chosen (pure form) — nobody does the work. But note our Y-order-with-override
model IS the mature endpoint of this arc (auto-derive + adjust). We're landing where
the mature tools landed, skipping the dual-authoring dead end.

**5. Auto-reflow with author hints / constraints ("proper responsive").**
Elements carry constraints ("pin top-left", "below X", "fill width"); a solver
reflows per screen (iOS Auto Layout, Android ConstraintLayout, Figma auto-layout).
Powerful, but means abandoning pure absolute positioning for a constraint model.
=> REJECTED — this is a philosophical rewrite, not a feature. It changes what
Hotglue *is*. Explicitly out of scope; the whole design premise is "layout cannot
be made responsive, and we don't want it to be."

**6. Content extraction / reader mode ("strip the design entirely").**
Browser Reader Mode / Instapaper: discard layout, extract text+images into a clean
linear document. The nuclear form of "mobile wants info".
=> Our marking approach is a softer, author-controlled version of this: instead of
an algorithm GUESSING what's content, the author MARKS it (authors know their page).
Same underlying insight (on mobile, content > layout), better execution. We took the
insight, not the mechanism.

**7. Responsive scaling with a readable floor (scale + min-scale).**
Scale the canvas down but not below a text-legibility floor; accept horizontal
scroll past that point (some fixed-layout ebook/magazine formats). This was the
earlier "adaptive zoom for readability" idea.
=> NOT chosen as primary — horizontal scroll remains bad mobile UX. It's a middle
option between "unreadably small" (#1) and "curate a mobile view" (our model), and
we chose to curate instead.

### Where our design sits

We picked **#4-as-derived (auto mobile view from desktop + override) crossed with
#6 (author-marked content curation)**, defaulting to **#1 (scale-to-fit + pinch-
zoom) for the uncurated case**. This skips the dead ends (#4-pure dual authoring,
#5 constraint rewrite), matches the mature-tool arc (auto-derive + adjust), and
honours the "mobile = info" insight (#6) without going nuclear (#6-pure reader mode
discards too much authorial intent).

The one live question left open by this survey: **guided view (#3)** is the only
model native to our exact problem that keeps the spatial composition. We're not
building it for MVP, but it's the natural candidate for a future *second* mobile
mode (author chooses stack vs guided tour per page). Worth a look at a comics
guided-view implementation before finalizing the stack model, if only to confirm
the linear stack is the right call for the common (info-seeking) case.

## Related context in the codebase

- Editor is now vanilla JS on branch `ng`; drag/resize handled by **Moveable**
  (pointer-events, touch-capable), chrome icons by **Alpine.js**. The phone-frame
  reorder should build on Moveable, consistent with the new stack.
- Object positions/sizes live in the page/object data (absolute x/y/w/h) — that's
  the source for both the canvas-width computation and the auto Y-ordering.
- See also MODERNIZATION.md / handover.md on the `ng` branch for the jQuery->vanilla
  migration write-up.
