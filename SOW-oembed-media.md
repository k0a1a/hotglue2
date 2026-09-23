# SOW — Rebuild the media-embed module on oEmbed (from YouTube/Vimeo-only)

Status: BUILT (2026-09-23, danja's calls). The webvideo module resolves pasted media URLs
through the curated oEmbed whitelist (YouTube, Vimeo, SoundCloud, Spotify, Mixcloud),
the Bandcamp iframe template and PeerTube oEmbed discovery, validates every response
(single sandboxed iframe on the provider's own host), caches the embed in the page's
shared directory, and creates the object server-side; legacy YouTube/Vimeo objects
re-resolve from their reconstructed canonical URL. The hermetic suite exercises the
whole mechanism through the HG_STUB_OEMBED stub provider (tests/e2e/webvideo.spec.js);
the real providers need a live probe. The original module hardcoded YouTube + Vimeo
(bespoke URL parsing → iframe per service).

## Decisions (folded in 2026-09-23)

The open questions this document left hanging, settled:

1. **The cached embed HTML lives in a cache FILE per object, never in the object's
   attrs.** The `key:value` head is the storage format that round-trips through every
   feature; embedding third-party HTML there makes it a serialization/escaping hazard.
   The cache file sits in the page's directory (beside `shared/`), referenced by a
   `webvideo-cache-file` attr, so the copy-paste machinery carries it like any asset
   and the delete hooks remove it like the other file attrs. TTL + invalidation: the
   cache is rewritten whenever the URL changes; a re-resolve can be forced by removing
   the file; no time-based expiry in v1 (embeds change rarely, and a stale embed is
   better than a hanging one).
2. **Resolution happens at editor time, not view time.** The URL is resolved when the
   object is created or its URL changes (an async editor call, like an upload). The
   view render reads the cache only; a missing cache triggers one re-resolve with a
   timeout, and on failure the view renders the fallback (the URL as a link, or the
   "couldn't embed this link" message) rather than a broken page.
3. **providers.json is vendored into the repo, not fetched at runtime** (same policy as
   the vendored `js/moveable.js`). Refresh it by re-downloading the registry and
   re-committing; the provider matcher ports the registry's host+path patterns to PHP.
4. **Legacy objects migrate by URL reconstruction, then re-resolve through the new
   path.** Stored objects carry `webvideo-provider` + `webvideo-id`; the canonical
   source URL is reconstructed from those (`youtube.com/watch?v=<id>`,
   `vimeo.com/<id>`) and handed to the oEmbed path. Parity is verified against real
   existing embed objects before the switch lands.
5. **The object class stays `webvideo`.** Creation, vetoes, the
   `glue-webvideo-shield`, and Moveable registration all key on it.
6. **PeerTube resolves its whitelist-vs-security tension by self-consistency:** the
   embed iframe's origin must match the oEmbed endpoint's own host. Any instance may
   be used, but an instance's response can only embed that same instance.
7. **Validation is mechanical, per provider:** parse the returned `html`, require
   exactly one `<iframe>`, require its src origin to be in the provider's host
   allowlist (YouTube: `youtube.com`/`youtube-nocookie.com`; Vimeo:
   `player.vimeo.com`; Spotify: `open.spotify.com/embed`; SoundCloud:
   `w.soundcloud.com`; Mixcloud: `www.mixcloud.com`; PeerTube: rule 6). Anything else
   is rejected and stored as nothing.
8. **Emitted iframes carry `sandbox` and `referrerpolicy`** (the current module emits
   neither), and the stored URL and the resolved HTML go through the `elem_*`
   escaping path twice over (the recurring escaping caution).
9. **The e2e suite gets a stub oEmbed provider served by the hermetic harness**
   (`tests/e2e/server-router.php` serves a fake endpoint; a test-only config define
   injects the fake provider into the whitelist), so resolve/cache/validate/migration
   and the slow-or-down-provider fallback are all testable offline.
10. **The build tool is `tools/make-min.js`** (the comment-stripper, MODERNIZATION
    §5) — there is no terser in this project.

**v1 split** (each step shippable): (1) storage + resolution skeleton with YouTube and
Vimeo only, proving legacy parity; (2) whitelist expansion + the Bandcamp template +
caching/validation hardening + the stub-provider e2e; (3) phase-2 providers.

## Why oEmbed (the architectural change)

- **oEmbed is the standard**: a provider exposes an oEmbed endpoint; you send it the media
  URL, it returns the correct embed HTML. No more bespoke per-service parsing (extract
  YouTube id → build iframe; extract Vimeo id → build iframe; × N services).
- **Canonical registry**: `https://oembed.com/providers.json` lists oEmbed providers and
  their endpoints (YouTube, Vimeo, SoundCloud, Spotify, and hundreds more). Resolve a
  pasted URL to its provider/endpoint from this registry (or via oEmbed discovery on the
  page).
- **Future-proof + less code**: new providers / changed embed formats are handled by the
  provider's endpoint, not our code. Adding a service becomes "add it to the whitelist",
  not "write a new integration".
- **UX becomes "paste any (whitelisted) URL"** — user pastes a Bandcamp/Vimeo/SoundCloud/
  etc. link, the module resolves and embeds it. No per-service UI.

## Curated provider whitelist (NOT allow-all — security + curation)

oEmbed returns arbitrary third-party embed HTML/iframes. Allowing ANY provider means
arbitrary third-party iframes on `*.hotglue.me` (privacy, security, sketchy-embed
reputation risk on the shared domain). So: use oEmbed as the MECHANISM, but only allow a
WHITELIST of trusted providers. `providers.json` gives the endpoints; our whitelist
controls which are permitted.

Whitelist, prioritized for THIS audience (artists, musicians, indie/DIY web):

**Video**
- YouTube (universal) — keep
- Vimeo (art/film home — high for this audience) — keep
- PeerTube (federated, self-hosted video — on-brand for the Critical-Engineering/indie
  audience; matches any instance)
- TikTok, Dailymotion (secondary)

**Audio / music** (punch above mainstream weight for this audience)
- Bandcamp (THE indie-musician platform — high priority)
- SoundCloud (musicians/producers)
- Mixcloud (DJs/radio/long-form mixes — experimental/electronic audience)
- Spotify (track/album/playlist/podcast)

(Additional providers can be added to the whitelist later; the mechanism supports all
oEmbed providers, the whitelist is the gate.)

## Hybrid: oEmbed where available, iframe-template where not

Some providers are iframe-only (no oEmbed) or gated:
- **Bandcamp** — embeds are iframe-based (no open oEmbed); handle with a URL→iframe
  template (parse the album/track, build the Bandcamp iframe) rather than an oEmbed call.
- **Instagram / Facebook** — oEmbed exists but is GATED behind a Meta app/token
  (authenticated access). So IG needs a Meta app + token, not just a URL — MORE work than
  the others. Treat IG as PHASE 2 / optional due to the auth hoop; don't block the main
  rebuild on it.
- So the module has TWO resolution paths: (1) oEmbed (most providers), (2) a small set of
  URL→iframe templates for iframe-only providers (Bandcamp, and any others). A provider in
  the whitelist maps to whichever path it uses.

## Migration from the current YouTube/Vimeo module

- Existing embedded YouTube/Vimeo objects must KEEP WORKING — don't break existing pages.
  The stored `webvideo-provider` + `webvideo-id` reconstruct the canonical source URL,
  which then re-resolves through the oEmbed path (Decision 4) — verified against real
  existing embed objects for parity before the switch lands.
- Store what's needed to re-render: the source URL, the provider, and the reference to
  the cached embed file (Decision 1).

## Caching (important — don't hit oEmbed endpoints on every page view)

- Resolving a URL via oEmbed is a network call to the provider. Do NOT do this on every
  page render — the resolved embed HTML is cached per object, in a cache FILE in the
  page's directory, resolved at editor time (see Decisions 1 and 2). The view render
  reads the cache; a missing cache re-resolves once with a timeout, and a slow or down
  provider falls back to the cached embed or the fallback message rather than a broken
  page.

## Security / privacy (multi-tenant + ethos)

- **Whitelist only** — never resolve/embed arbitrary non-whitelisted providers (arbitrary
  third-party iframes on the shared domain = risk).
- **Sanitize/validate oEmbed responses** — oEmbed returns HTML from a third party; validate
  it's from the expected provider and is the expected embed shape (iframe to the provider's
  domain), don't blindly inject arbitrary returned HTML. Constrain to iframe embeds to
  known provider hosts.
- **Privacy note** — third-party embeds load third-party scripts/iframes (a privacy
  consideration for page visitors, consistent with the Critical-Engineering ethos). Not a
  blocker, but worth being deliberate about which providers are enabled.
- **Escaping** — the URL and any resolved values must be handled safely (the recurring
  escaping-bug caution) when stored in the object file and emitted.

## UX

- User pastes a media URL into the embed object; the module detects the provider (from the
  whitelist / providers.json), resolves the embed (oEmbed or iframe-template), and renders
  it in the object.
- Non-whitelisted / unresolvable URL → a clear message ("this service isn't supported yet"
  / "couldn't embed this link"), not a silent failure or a broken embed.
- The embedded media sits in the object's box, sized/positioned like any object (Moveable),
  responsive within the box.

## Constraints

- Vanilla JS + Alpine (client), PHP (server-side oEmbed fetch + cache), consistent with ng.
  No jQuery. Minified assets via `tools/make-min.js` (the project's comment-stripper;
  there is no terser build).

## Scope / phasing

- **v1:** oEmbed mechanism + providers.json + whitelist (YouTube, Vimeo, PeerTube,
  SoundCloud, Mixcloud, Spotify) + iframe-template path for Bandcamp + caching + migration
  of existing YT/Vimeo + response validation.
- **Phase 2 / optional:** Instagram (needs Meta app/token), TikTok, Dailymotion, and any
  further whitelist additions; a "refresh embed" action; provider-specific options (start
  time, autoplay-off, theme) where oEmbed/iframe params allow.

## Definition of done

- The embed module resolves pasted media URLs via oEmbed (providers.json), gated to a
  curated whitelist, with an iframe-template fallback for iframe-only providers (Bandcamp).
- Whitelist includes (v1) YouTube, Vimeo, PeerTube, SoundCloud, Mixcloud, Spotify, Bandcamp;
  Instagram/TikTok/Dailymotion noted as phase 2.
- Resolved embeds are cached (no oEmbed call per page view; cached embed served if provider
  is slow/down); responses validated (known provider, iframe shape) not blindly injected.
- Existing YouTube/Vimeo embed objects continue to render (verified against real existing
  objects); no broken pages.
- Non-whitelisted/unresolvable URLs show a clear message; embeds are responsive within the
  object box; server-side resolution; no jQuery.
