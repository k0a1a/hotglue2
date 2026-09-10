# SOW — New default favicon: Hotglue orange diamond (SVG + PNG)

Status: to implement. Small task. Replaces the current glue-gun favicon, which users
repeatedly ask to remove because at favicon size the "glue" context is lost and it reads
as a gun. New default: a friendly orange diamond in Hotglue's brand style.

## Why

- The glue-gun favicon loses all "glue" meaning at 16x16 and reads as a firearm to many
  users — off-putting, and blocking in some contexts (schools/workplaces/regions).
- The diamond is already core to the Hotglue/Superglue visual language, and orange is a
  Hotglue signature colour — so an orange diamond distills the brand to its purest mark:
  on-brand, legible at 16px, and unambiguous (a diamond is just a diamond).

## The design (matches the attached reference, in Hotglue orange)

Reproduce the look of the reference image, recoloured to Hotglue orange:
- **Rounded-corner diamond** — a rotated square with generously rounded corners (soft,
  friendly, not a sharp spike).
- **Two-tone depth** — a darker-orange edge/underside band along the bottom-right, with
  the lighter-orange face sitting on top, giving a subtle layered/3D feel (as in the
  reference's darker blue back + lighter blue face).
- **Glossy highlight** — an elongated rounded light streak in the upper-left, plus a
  small separate light dot just below it (the "shiny surface" cue from the reference).
  Highlight colour: a light tint of the face orange, or a soft translucent white.
- Otherwise flat/solid and clean — no extra clutter.

### Colours
- **Face**: Hotglue's brand orange — PULL THE EXACT HEX from the current UI (the editor
  chrome / page background orange) so the favicon matches the rest of Hotglue, rather than
  an arbitrary orange.
- **Edge/underside**: a darker shade of that same orange (e.g. ~15-25% darker) for the
  depth band.
- **Highlight**: a lighter tint of the face orange or a soft semi-transparent white.
- Confirm the chosen orange has enough contrast to stay recognisable on both light and
  dark browser tab bars (test against both).

## Deliverables (formats & sizes)

- **Primary: SVG favicon** — the diamond as clean vector (rounded-corner rotated square +
  depth band + highlight). Scales crisply to any size; modern browsers use it directly.
- **PNG fallbacks** for older browsers / specific slots:
  - 16x16, 32x32 (classic favicon sizes),
  - 180x180 (Apple touch icon),
  - 192x192 and 512x512 (Android / PWA / web-app manifest), if the manifest references
    them.
- **favicon.ico** (multi-size, containing at least 16 + 32) for legacy support.
- Wire them up with the appropriate `<link rel="icon" ...>` / `apple-touch-icon` /
  manifest entries.

### 16px legibility check (important)
- The diamond, depth band, and highlight must still READ at 16x16 — verify the design
  doesn't turn muddy when scaled down. If the highlight/depth detail muddies at 16px,
  provide a SIMPLIFIED 16px variant (e.g. flat diamond, minimal or no highlight) rather
  than a muddy shrink of the full design. Legibility at small size beats detail.

## Where it applies

- **hotglue.me** itself (marketing/service site + editor).
- The **default favicon for user sites** (`*.hotglue.me` and custom domains) that haven't
  set their own. (This is where most of the "remove the gun" complaints come from — users
  don't want it on THEIR published site's tab.)

## Related (separate, optional follow-up — note only)

The fuller fix for "I don't like the default favicon" is letting users UPLOAD their own
per-site favicon (already on the roadmap's someday list). That turns the complaint into a
two-click self-serve override and fits Hotglue's make-it-yours ethos. NOT part of this
SOW — this SOW just swaps the DEFAULT to something inoffensive and on-brand — but the two
compose: neutral friendly default (this) + user override (later) fully resolves the
complaints. Build the default so a future per-site favicon cleanly overrides it.

## Constraints

- Match the existing brand orange (pull the hex from current UI; don't invent one).
- Keep it simple enough to read at 16px; provide a simplified small variant if needed.
- Provide all standard sizes/formats + correct `<link>`/manifest wiring, so it renders
  everywhere (tabs, bookmarks, mobile home screen, PWA).

## Definition of done

- The glue-gun favicon is replaced by an orange rounded-corner diamond (depth band +
  highlight, per the reference) in Hotglue's brand orange.
- Delivered as SVG (primary) + PNG fallbacks (16, 32, 180, 192, 512) + multi-size .ico,
  wired via the correct link/manifest tags.
- Verified legible and unambiguous at 16x16 (simplified small variant if the full detail
  muddies), and recognisable on both light and dark tab bars.
- Applied to hotglue.me and as the default for user sites; the EXISTING per-site favicon
  override continues to take precedence (not regressed).
