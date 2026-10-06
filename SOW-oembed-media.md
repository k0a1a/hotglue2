# SOW — Rebuild the media-embed module on oEmbed (from YouTube/Vimeo-only)

Status: to implement (ng). The current embed module hardcodes YouTube + Vimeo (bespoke
URL parsing → iframe per service). Rebuild it around **oEmbed** so it supports many
providers via one mechanism (paste a URL → get the embed), with a curated, security-minded
provider whitelist prioritized for Hotglue's artist/musician audience.

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

## Three resolution tiers (not every provider has oEmbed)

Providers fall into three tiers; each whitelisted provider maps to the tier it needs:

**Tier 1 — oEmbed** (YouTube, Vimeo, SoundCloud, Spotify, Mixcloud): paste URL → the
provider's oEmbed endpoint → embed HTML. The primary path.

**Tier 2 — URL → iframe template** (services where the public URL CONTAINS what's needed,
or a simple transform yields the embed URL): direct string transform to the embed iframe.
(PeerTube-style / anything whose embed URL derives directly from the public URL.)

**Tier 3 — Open Graph / meta scrape** (no-oEmbed services where the public URL does NOT
contain the embed id, so you must fetch the page to get it):
- **Bandcamp is here — NOT tier 2.** Bandcamp has **no oEmbed endpoint**, AND its embed
  iframe needs Bandcamp's internal NUMERIC album/track id (`album=123456789`) which is
  **not present in the public URL** (`artist.bandcamp.com/album/slug` is just a slug). So a
  URL→iframe template can't work — you don't have the numeric id.
- Resolution: **fetch the public URL server-side and read the `og:video` /
  `og:video:secure_url` Open Graph meta tag**, whose content IS the Bandcamp
  `EmbeddedPlayer` URL (with the numeric id already in it). Build the iframe from that.
  (Reading `og:video` is more robust than scraping the raw numeric id out of page HTML —
  Open Graph is stable because Bandcamp maintains it for social-media link previews.)
- This tier generalizes to other no-oEmbed providers that expose Open Graph embed/video
  meta.

**Instagram / Facebook** — oEmbed exists but is GATED behind a Meta app/token
(authenticated access): IG needs a Meta app + token, not just a URL — MORE work than the
others. Treat IG as PHASE 2 / optional; don't block the rebuild on it.

Tier-3 (and tier-1) both require SERVER-SIDE fetching (CORS rules out client-side
cross-origin fetches of provider pages/endpoints) and CACHING (see caching) — do NOT
fetch-and-scrape the Bandcamp page (or call oEmbed) on every render.

## Migration from the current YouTube/Vimeo module

- Existing embedded YouTube/Vimeo objects must KEEP WORKING — don't break existing pages.
  Either: (a) the oEmbed path handles YT/Vimeo (it does — both are oEmbed providers) and
  existing objects re-resolve cleanly, or (b) keep the existing YT/Vimeo rendering for
  already-stored objects and use oEmbed for new ones. Prefer (a) if existing stored objects
  re-resolve identically; verify existing embeds render the same after the switch (parity
  concern — check against real existing embed objects).
- Store what's needed to re-render: at minimum the source URL (and provider); consider
  caching the resolved embed HTML (see caching) so render doesn't hit the oEmbed endpoint
  every page view.

## Caching (important — don't hit oEmbed endpoints on every page view)

- Resolving a URL via oEmbed is a network call to the provider. Do NOT do this on every
  page render — cache the resolved embed HTML (per object, or per URL) after first
  resolution. Re-resolve only when needed (URL changes, cache expiry, or manual refresh).
- Decide cache location (with the object's stored data, or a shared URL→embed cache) and a
  sensible TTL / invalidation. This keeps rendering fast and avoids hammering providers
  (and avoids the page breaking if a provider's oEmbed endpoint is slow/down at view time —
  serve the cached embed).

## Security / privacy (multi-tenant + ethos)

- **Whitelist only** — never resolve/embed arbitrary non-whitelisted providers (arbitrary
  third-party iframes on the shared domain = risk).
- **Sanitize/validate oEmbed responses** — oEmbed returns HTML from a third party; validate
  it's from the expected provider and is the expected embed shape (iframe to the provider's
  domain), don't blindly inject arbitrary returned HTML. Constrain to iframe embeds to
  known provider hosts.
- **Validate scraped embed URLs (tier 3)** — a URL extracted from a page's `og:video` must
  be validated to be the expected provider's embed host/shape (e.g. a
  `bandcamp.com/EmbeddedPlayer/...` URL) before building the iframe — never build an iframe
  from an unvalidated scraped URL. Handle "og:video not found / unexpected" gracefully.
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
  No jQuery.
- Server-side oEmbed resolution (fetch the provider endpoint server-side, cache it) — don't
  rely on client-side cross-origin calls to provider oEmbed endpoints.
- Whitelist-gated; response validation; cached; existing YT/Vimeo embeds must not break.
- Build minified assets via the project's terser build.

## Scope / phasing

- **v1:** oEmbed mechanism + providers.json + whitelist (YouTube, Vimeo, PeerTube,
  SoundCloud, Mixcloud, Spotify) + Open-Graph-meta-scrape path for Bandcamp (fetch page →
  `og:video` → iframe) + caching + migration of existing YT/Vimeo + response validation.
- **Phase 2 / optional:** Instagram (needs Meta app/token), TikTok, Dailymotion, and any
  further whitelist additions; a "refresh embed" action; provider-specific options (start
  time, autoplay-off, theme) where oEmbed/iframe params allow.

## Definition of done

- The embed module resolves pasted media URLs via THREE tiers — oEmbed (providers.json),
  URL→iframe template, and Open-Graph meta-scrape — gated to a curated whitelist. Bandcamp
  is resolved via the meta-scrape tier (fetch page → `og:video` EmbeddedPlayer URL →
  iframe), NOT a URL template (its embed needs a numeric id absent from the public URL).
- Whitelist includes (v1) YouTube, Vimeo, PeerTube, SoundCloud, Mixcloud, Spotify, Bandcamp;
  Instagram/TikTok/Dailymotion noted as phase 2.
- Resolved embeds are cached (no oEmbed call per page view; cached embed served if provider
  is slow/down); responses validated (known provider, iframe shape) not blindly injected.
- Existing YouTube/Vimeo embed objects continue to render (verified against real existing
  objects); no broken pages.
- Non-whitelisted/unresolvable URLs show a clear message; embeds are responsive within the
  object box; server-side resolution; no jQuery.
