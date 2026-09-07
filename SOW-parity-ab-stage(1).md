# SOW — Real-content parity harness + A/B comparison stage

Status: to implement. Migration-gating (do before moving hotglue.me to ng) AND produces
the launch screencast. One build, three uses: QA validation, object-by-object triage,
and the recorded A/B video.

## Purpose

Before cutting hotglue.me over to the `ng` engine, prove that `ng` renders and saves REAL
historical user pages identically to the current engine — the one thing the e2e suite
(which runs on synthetic `content-e2e/` fixtures) cannot tell us. Then reuse the same
tool to record a side-by-side A/B screencast for Mastodon/Instagram ("15 years of pages,
rebuilt engine, nothing lost").


## What "parity" means (read before the checks — this is the crux)

Parity is NOT "ng output is byte-identical to current." Many prod pages render
BADLY on current — deleted image files, module features that broke years ago, pages
untouched since 2011. Byte-parity with a broken current render is both unachievable and
meaningless, and treating every difference as a finding makes the triage report an
infinite-finding generator so cutover never happens.

Parity is judged **per-page**, against three verdicts, not two:
- **MATCH** — ng renders/saves the page equivalently to current. Pass.
- **REGRESSION** — ng is *worse* than current (dropped/moved/corrupted an object,
  changed a coordinate, mangled an attribute current preserved). This is what the gate
  blocks on — fix before cutover.
- **NO WORSE / INTENDED** — ng differs from current but is **not worse**: either the page
  was already broken on current (rot) and ng reproduces or improves it, or ng
  *deliberately* changed behavior (see Check B "intended cleanup"). Recorded and accepted
  per page.

Maintain a per-page **known-broken / accepted-difference list**: pages whose current
render is already broken, and specific differences reviewed and signed off as "no worse"
or "intended." The gate is: **no unresolved REGRESSIONs**, not "zero differences." Without
this bucket the harness never lets you ship.

## Part 1 — Getting real content onto an isolated ng instance

CRITICAL: never run this against live production content. Work on COPIES, on an isolated
instance. The test's save-round-trip step writes files — it must never touch real user
data.

### Selecting the sample
- Input: a list of a few dozen page URLs / usernames (hand-picked + random). Sampling
  should be STRATIFIED, not purely random, to hit the cases where bugs hide:
  - old pages (2011-era) and recent ones,
  - every module represented (text, image, video, embed/iframe, webvideo, code),
  - very large / object-heavy pages,
  - pages with custom `/code`,
  - infinite layout (NOT centered — see note below),
  - **pages never re-saved since the old-editor era** (the true worst case for the
    round-trip check — content written by a years-old editor version, never touched
    since),
  - pages with unusual characters / encodings,
  - image-heavy and text-heavy.
  Plus a handful of known-weird pages deliberately included.
- Record the sample list (username -> content path) as the harness input.

  **No centered-layout stratum.** Centered mode is a NEW ng feature; production has run
  the dev/master lineage and NO prod page carries `page-layout-mode=centered`. This is
  not a gap: old pages have no `page-layout-mode` key at all, so ng defaults them to
  `infinite` (infinite is stored by absence) and renders them exactly as current does.
  Centered-mode correctness is a new-feature concern covered by `centered-layout.spec.js`,
  not a migration-parity concern. Do not sample or synthesize centered pages here.

### Copying content to the isolated instance
- For each sampled user/page, COPY its `content/` directory (and any referenced
  `shared/` assets and uploaded files the page needs) from a snapshot/backup of prod
  into the isolated instance's content tree. Copy, never move; never read-write against
  live.
- Preserve the exact directory structure the engines expect (content/<page>/head/... ,
  shared/, usr/ sharding as applicable) so both engines resolve assets identically.
- Note asset dependencies: pages reference uploaded images/video, fonts
  (`page-custom-fonts`), backgrounds, favicons — copy those too, or the render differs
  for reasons that aren't engine bugs. The copy step must bring the whole dependency set,
  not just the object files.

### Serving both engines from ONE origin (required for the stage to work)
- Stand up BOTH engines against the SAME copied content, served from a SINGLE origin at
  different paths, e.g.:
    /current/<page>   -> current engine rendering
    /ng/<page>        -> ng engine rendering
    /stage/           -> the A/B stage page
- One origin is REQUIRED: the stage reads into both iframes' DOMs (object coordinates,
  content) to draw boxes and compare — cross-origin iframes would block
  `contentDocument` access. Path-based mounting on one host avoids all CORS friction.
- Both engines point at the same copied content tree so any difference is the ENGINE,
  not the data.

## Part 2 — The three checks

### Check A — Render parity: TWO-REGIME diff (PRIMARY, deterministic)
A whole-document diff is noise by construction: the two engines' outer skeletons differ
BY DESIGN (doctype, page chrome, css/js includes, engine-era markup). But you cannot just
discard the outer document — a doctype change can shift a 2010-era page's layout for real.
So Check A is TWO comparisons with two different normalization regimes:

- **A1 — per-object comparison (the workhorse).** For each Hotglue object, compare its
  element, inline styles, coordinates (top/left/width/height), and subtree between the two
  renders. This is where real content bugs live — dropped/moved objects, wrong
  coordinates, corrupted/extra attributes (e.g. the historic
  background-repeat-written-to-every-image bug). `transform` gets the page-layout-mode
  treatment rather than a regime of its own: it is an ng-era storage key, written only by
  an explicit rotate/flip action and never applied or written by the engine on its own,
  so old prod pages carry none of ng's form — absent means identity — and there is
  nothing to compare. Old-engine flips are a different artifact: the dev-lineage flip
  module stored them as 2010-vintage vendor-prefixed matrices in the style attribute,
  which the generic inline-style diff covers, and what ng's editor does with one on save
  is Check B's INTENDED-CLEANUP/REGRESSION call, not an A1 regime. Deterministic and exact; points at the
  specific object/attribute. Normalise away legitimately-irrelevant differences
  (whitespace, attribute order).
- **A2 — coarse outer-document comparison.** Compare only the structural skeleton that can
  cause real layout shifts: doctype, container width, body classes/attributes. Do NOT
  diff the full chrome/includes (those differ by design). A2 catches "the page shifted
  because ng's doctype changed the rendering mode", which A1's per-object diff would miss.

Both feed the three-verdict model above (per-object regression vs. intended vs. match).
Before writing the normalizer, **audit each engine's object-layer output for volatility**
— any date, random id, or array-order output will show up as a diff that isn't a diff.

### Check B — Save round-trip: file diff (CRITICAL — data safety)
- The scariest failure: opening a page in the ng editor and saving silently mutates
  stored content.
- For each page: snapshot its content files, load into the ng editor, trigger a save
  WITHOUT editing, diff the content files before vs. after.
- Changes to a merely-opened-and-saved page classify into two verdicts, NOT one:
  - **REGRESSION** — ng lost, moved, or corrupted content current would have kept. Blocks
    the gate; fix before cutover.
  - **INTENDED CLEANUP** — ng *deliberately* drops old-engine cruft on save (e.g. it
    writes `background-repeat` only-when-set where the old engine wrote it always; it no
    longer writes the old server-side auto-snapshot/revision artifacts). This is desirable,
    not a bug — but it WILL show in the diff, so it must be reviewed and ACCEPTED per page,
    or Check B becomes a false-alarm factory.
- Make the round-trip exercise the FULL path: parse stored bytes → DOM → serialize back
  (a "save" only tests anything if the editor genuinely parsed and re-serialized). And
  DEFINE the file set compared: object files yes; decide explicitly whether
  revision/artifact files count (ng writes none; old pages may carry old ones — those
  appearing/disappearing is intended cleanup, not regression).
- Deterministic text diff, no visual noise. Highest-value, cleanest check.

### Check C — Visual parity: screenshot diff (SECONDARY, backstop)
- Playwright screenshots both renders under identical conditions and pixel-diffs them,
  catching visual differences the HTML diff misses (CSS effects painting, layout).
- MUST mitigate non-determinism or it floods false positives:
  - block external resources (remote images/iframes/embeds) so a slow/failed remote load
    isn't read as an engine diff,
  - freeze animations/video at frame 0, wait for fonts to load before capturing,
  - fixed viewport + device-pixel-ratio, identical waits both sides,
  - per-pixel + total-difference tolerance so antialiasing noise doesn't trip it.
- Output flagged candidates for human triage, not a pass/fail — expect a review step.

## Part 3 — The A/B comparison stage (in-browser, authentic, dual-use)

A single "stage" HTML page that IS both the object-by-object triage view AND the
screencast scene. Everything real, drawn from actual object data, recorded as one window
with no compositing.

### Structure
- One stage page, two iframes:
    left  iframe -> /current/<page>
    right iframe -> /ng/<page>
  plus an overlay layer (absolutely-positioned divs or a canvas) on top, driven by the
  stage's JS. Because it's ONE page / ONE JS context, the two panes are inherently in
  sync — no drift, no post-alignment.
- Layout variants (parameter): side-by-side (landscape — Mastodon/desktop) and
  stacked top/bottom (portrait — Instagram mobile), since two side-by-side panes get tiny
  on a phone.

### Authentic green-box highlighting (real, not staged)
- For each Hotglue OBJECT on the page (the discrete positioned divs — Hotglue's real
  units), the stage reads the object's bounding rect INSIDE each iframe
  (`iframe.contentDocument.querySelector(...).getBoundingClientRect()`) and draws a
  highlight box at that exact position over BOTH panes. Boxes hug the real objects.
- The match is REAL: per-object DOM/coordinate/content comparison between the two iframes
  (position, size, key styles, content). Match -> the box flashes GREEN + a check; no
  match -> it flags (amber/red) and is a finding. The green flash reflects a genuine
  comparison, so the video is honest proof, not a decorative effect.
  (True pixel-diff needs rasterising iframe regions, which the browser can't do cleanly
  for this live scene — keep pixel-diff in Check C via Playwright; the stage's live check
  is DOM/coordinate/content, which is real and sufficient for "these objects match".)

### Sequencing & rhythm (the watchable part)
- Objects highlight SEQUENTIALLY on both sides in sync (document order / top-to-bottom),
  each holding a beat, flashing green on match; greens ACCUMULATE until the page is fully
  green-ticked — a completion payoff — then cut to the next page.
- Timing is JS-driven; support syncing the tick cadence to a musical beat (fixed BPM
  interval, or driven off an audio element's currentTime) so ticks land on the beat.
- Across a montage, the scan pace can accelerate (later pages tick faster) to build
  energy.
- Keep it RESTRAINED and in Hotglue's visual voice — light overlay, tasteful boxes/ticks,
  the PAGES stay the star. Not an enterprise-QA HUD (no scan lines, percentages, dashboard
  clutter).

### Recording (minimal/no post)
- Option A: OS/OBS screen-record the stage window; trim + add a title/caption card after.
- Option B (cleaner, reproducible): in-browser capture via `getDisplayMedia` /
  canvas-stream + `MediaRecorder`, music via Web Audio — re-runnable to regenerate the
  video. Either way the whole SCENE is real and in one window; post is just trim + card.
- Record at high resolution (side-by-side needs width — 1920x1080+ for landscape).

## Implementation traps (verify/handle these — several are silent or day-eaters)

- **Subpath rendering is a PRECONDITION — verify it FIRST.** The one-origin stage requires
  both engines served under paths (`/current/`, `/ng/`) on one host. But current is a
  2010-era PHP app with largely ROOT-ABSOLUTE asset paths (`/css/…`); it may not render
  correctly under a subpath. ng has real base_url/baseURI handling (the icon landmine fix
  was exactly this); current may not. **Confirm both engines render under a subpath before
  committing to the one-origin stage** — this is the likeliest day-eater, and if current
  can't, the stage design needs rethinking (e.g. per-engine hostnames with the stage
  proxying, or rewriting asset paths).
- **Pin which commit serves `/current`.** Serve current from a worktree of dev/master at a
  TAGGED commit, or "current" drifts under you mid-validation and results stop being
  reproducible.
- **`canvas.captureStream()` carries NO audio track** — Option B records SILENT video
  unless the Web Audio score is routed through a `MediaStreamAudioDestinationNode` whose
  stream is combined with the canvas video track into the MediaRecorder. Silent failure:
  you find out after recording. One line here, a wasted session in practice.
- **Embed objects: the green box means "wrapper matches", not "content matches".** For
  embed-webpage/webvideo/iframe objects, the wrapper rect is readable, but the inner
  remote content is cross-origin even inside your same-origin iframe — the stage cannot
  compare what's inside a YouTube embed. Define per-module "content match" accordingly; the
  video should not linger on embed objects, and Check A (object layer) is what really
  covers them.
- **Viewport/scroll alignment in the stage.** If the iframes scroll, `getBoundingClientRect`
  is viewport-relative — either size each iframe to its content's full height (long pages
  → very tall stage) or sync `scrollTo` across both panes from the one JS context (trivial,
  do this). 
- **Freeze motion via JS, identically in both iframes** — pause videos and set
  `currentTime = 0` inside both iframes for Check C, rather than relying on resource-blocking
  (blocking blanks embeds; JS-freeze keeps layout intact and identical on both sides).
- **Custom /code pages are their own bucket.** User-authored code executes in the harness
  (PHP include on render) — isolated-instance-safe, but non-deterministic (timers, external
  calls) and environment-sensitive, so it's the least useful stratum for Check A and the
  video. Sample them, bucket their findings separately, and prefer CODELESS page copies for
  the photogenic screencast passes.
- **Check C external-blocking blanks embed inners** — fine for screenshots (both sides
  equally blank, and explicitly-sized wrappers won't collapse the layout), but the
  SCREENCAST wants real embeds: select embed-light pages for the video, or accept real
  network loads on the recording passes specifically.

## Triage report (QA output, separate from the video)

- Group findings by check and by discrepancy type, worst first: HTML-diff structural
  differences, save-round-trip mutations (highest priority), screenshot visual flags.
- For each flagged page, the stage view opens it object-by-object so the specific
  differing object is visible. The report is the migration checklist: nothing flagged
  unresolved before cutover.

## Ordering / when

- The HARNESS (Parts 1-2 + the stage as triage view) runs BEFORE the move — it's the
  migration-gating validation; fix everything it finds first.
- The SCREENCAST (Part 3 recording) happens AFTER parity is confirmed — it's the
  victory-lap announcement, and it must not publicly A/B a page that still has a bug.

## Constraints

- Isolated instance, copies of content only, never live data; save-round-trip especially
  must be sandboxed.
- One origin, path-mounted engines, so the stage can read both iframes (no CORS).
- Reuse the existing Playwright setup for Checks A-C; the stage is vanilla JS/HTML.
- Both engines must serve the SAME copied content incl. all asset dependencies (uploads,
  fonts, backgrounds, shared/) or differences will be data, not engine.

## Definition of done

- A stratified sample (few dozen URLs, random + deliberately-weird, INCLUDING pages never
  re-saved since the old-editor era; NO centered-layout stratum) of real content is copied,
  with dependencies, to an isolated instance serving current + ng + stage from one origin —
  AFTER verifying both engines render under a subpath (the one-origin precondition).
- Parity is judged PER-PAGE against three verdicts (match / regression / no-worse-or-
  intended), with a per-page known-broken/accepted-difference bucket; the gate is
  "no unresolved REGRESSIONs", not "zero differences".
- Check A compares the OBJECT LAYER per-object (A1) PLUS a coarse outer-document skeleton
  (A2: doctype, container width, body classes) — two normalization regimes, not one.
- Check B classifies each round-trip mutation as REGRESSION vs. INTENDED CLEANUP, with
  cleanup accepted explicitly per page; it exercises the full parse→DOM→serialize path and
  defines its file set. Regression is top priority.
- Screenshot diff runs with non-determinism mitigations and flags visual candidates for
  review (not naive pass/fail).
- The in-browser A/B stage shows both renders side-by-side (and stacked variant), draws
  per-object boxes from real coordinates, flashes green on REAL per-object matches,
  sequences object-by-object with beat-syncable timing, and is recordable as one window.
- The stage doubles as the object-by-object triage view for flagged pages.
- Nothing flagged remains unresolved before cutover; the screencast is recorded only
  after parity is confirmed.
