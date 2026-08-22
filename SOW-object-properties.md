# SOW — Object Properties editor (replace "object target" action)

Status: **implemented** on `ng`. Covered by `tests/e2e/object-properties.spec.js`
(11 tests). This document now records the design as built, including the parts of
the original plan that turned out not to describe this repository.
Goal: replace the current per-object "target" action with an "Object Properties"
action that lets the user see and edit the object's identity/attributes, presented
as the actual `<div>` element it renders as — honest and self-documenting.

## Corrections to this document

Three premises in the original draft were wrong for this codebase, and one risk it
worried about was already handled. Recorded here because each would send the next
reader somewhere unhelpful.

- **There is no "terser build".** The Constraints section said to build minified
  assets with one. Hotglue has no build step at all: for its own JS the `*.min.js`
  files are hand-synced COPIES, and `tests/e2e/min-files.spec.js` enforces their
  freshness. `modules/object/object-edit.min.js` was refreshed by copying.
- **The "json.php stripslashes corruption" and "create.php credential-escaping
  fatal" are not in this repo.** There is no `create.php`, and `stripslashes`
  appears only inside a commented-out block at `json.php:32`. Those examples came
  from somewhere else; the escaping concern was still right, just not for that
  reason.
- **Copy/clone did not need touching.** `clone_object()` does
  `array_merge($old, $new)` over the whole property set, so new properties travel
  automatically. There is no field-by-field copy logic to forget.
- **Storage corruption was already prevented.** `save_object()` strips `\r` and
  `\n` from every value, so a newline in a class or attribute cannot inject a fake
  property line. Verified by trying it.

**The real vulnerability was somewhere the draft did not look.** `html.inc.php:228`
emits attribute NAMES with `htmlspecialchars(..., ENT_NOQUOTES)`, which deliberately
leaves quotes alone, while values use `ENT_COMPAT` and are safe. So an attribute
named `x" onload="alert(1)` would close the attribute and inject an event handler.
That is why the name charset below is strict, and why it is enforced in the RENDER
path and not only on save.

## What was already there

About 60% of this existed. The contextmenu key `object-target` registered a modal
showing a read-only object id and an editable custom-class field, and
`object-custom-class` was already applied at render. What was missing was custom
attributes, any validation at all, and the tag presentation.

Note `object-target` means two unrelated things: that contextmenu key, and the
stored property for a link's `target="_blank"` set by the separate link action.

## Concept

The editing UI shows the object AS the `<div>` it is, with fixed parts displayed
read-only and editable parts as inline fields. Conceptually:

```
<div id='01010101' class='object [ editable class input ]' [ custom attributes ] >
```

- `id` — shown READ-ONLY (it's the object's stable identity; never editable).
- `class` — the system base class(es) shown fixed, plus an input to ADD user classes.
- custom attributes — user can add arbitrary attributes (e.g. `name="foo"`,
  `data-x="y"`) to the object's container, with a denylist of unsafe/system ones.

This presentation makes it obvious what's being edited (it's a div), teaches users
what an object is, and fits Hotglue's transparency. It applies to ALL object types
(text, image, video) since all render as positioned containers.

## What's editable vs fixed

### id — READ-ONLY
- Display the object's id (the timestamped identifier, e.g. `01010101`). This is the
  object file name / reference key — it MUST remain immutable.
- Show it so users can copy it to target the object from page-level `/code`, but it
  is NOT an input. No path lets the user change it.

### class — fixed base + editable additions
- The system base class(es) Hotglue puts on every object (e.g. `object`, and any
  module-type or positioning classes) are shown but FIXED — the user cannot remove or
  alter them.
- Provide an input where the user ADDS their own classes (space-separated). These are
  APPENDED to the system classes, never replacing them.
- CONFIRM which classes are system-critical before building: inspect what classes
  Hotglue renders on an object container by default (base `object`, module type,
  z-index/positioning helpers?) and treat ALL of those as fixed. User classes append.
- Validate class names: only valid CSS class-name characters (letters, digits, `-`,
  `_`; must not start with a digit). Reject/strip invalid tokens so a malformed class
  can't break the class attribute or inject other attributes.

### custom attributes — user-added, with a denylist
- Let the user add arbitrary HTML attributes to the object's container, as
  name/value pairs (e.g. `name`, `title`, `data-*`, `aria-*`, `role`).
- DENYLIST — the user must NOT be able to set these (reject with a clear message):
  - `id` — would break object identity/targeting.
  - `class` — managed by the class field above, not here.
  - `style` — would let the user override the absolute positioning
    (`left/top/width/height`) that IS Hotglue; positioning is managed by the object's
    own properties, not free-form style. (Object visual styling goes through the
    per-object CSS feature / object style properties, not a raw style attribute.)
  - Any `on*` event-handler attribute (`onclick`, `onload`, `onmouseover`, etc.) —
    these are inline JS injection. Per project decision, JS stays in page-level
    `/code`; do NOT allow inline event handlers here.
  - Anything else that could break rendering or the editor (e.g. `contenteditable`
    conflicting with the editor, `draggable` conflicting with Moveable) — review and
    extend the denylist as needed.
- Validate attribute NAMES (valid HTML attribute-name characters only) and handle
  attribute VALUES safely (see escaping below).

## Storage & escaping (HIGH ATTENTION — recurring bug class in this codebase)

- Stored as `object-custom-class` (space-separated tokens, pre-existing) and
  `object-attributes` (**one line of JSON**). JSON suits the flat file format: it
  never contains a raw newline, and a colon inside it is harmless because the
  parser splits each line on the FIRST colon only. Both verified round-tripping a
  value containing quotes, angle brackets, `&`, `:`, `=` and non-ASCII.
- The flat file format is line-based `key:value`. Attribute values and class strings
  may contain spaces, quotes, colons, `<`, `>`, `=`, and other chars that can CORRUPT
  the file format or the rendered HTML. This is the SAME class of bug that caused the
  json.php stripslashes corruption and the create.php credential-escaping fatal —
  handle it deliberately:
  - Store values so that special characters / multi-token strings round-trip without
    breaking the object-file parser (encode if needed).
  - On RENDER, emit attributes with proper HTML attribute escaping (escape `"`, `<`,
    `>`, `&` in values) so a value can't break out of the attribute or inject markup.
  - NEVER allow a stored value to break either the object-file parse OR the page HTML.
- Test round-trip with awkward values: quotes, angle brackets, `=`, colons, spaces,
  unicode.

## Validation & error highlighting

Validate user input before storing, with visible inline error feedback. Principle
(same as the account forms / registration hardening): **client-side validation is
UX only — the SERVER is the gate.** Highlight errors client-side for the user, but
ALWAYS re-validate server-side before writing to the object file, because the client
can be bypassed (direct POST, scripted input).

No editor library needed — these are short structured inputs (class tokens,
attribute name/value pairs), not code. Use native HTML5 validation + a little vanilla
JS. (If a syntax-highlighted code editor is ever wanted for a FUTURE per-object CSS
feature, CodeJar (~2KB, vanilla) is the on-brand lightweight option — but it is NOT
needed here.)

### Client-side (UX — inline highlighting)
- **Class input**: native `pattern` for valid CSS class-name tokens
  (letters, digits, `-`, `_`; a token must not start with a digit; space-separated
  multiple tokens). Use the `:invalid` pseudo-class to highlight a bad value, plus a
  message span near the field naming the problem.
- **Attribute name**: native `pattern` for valid HTML attribute-name characters, plus
  a vanilla JS check against the DENYLIST (`id`, `class`, `style`, any `on*`, and the
  editor-conflicting names). On a denied name, highlight the field and show a clear
  message (e.g. "'style' can't be set here — positioning is managed by the object").
- **Attribute value**: flag characters that would need escaping / could break things,
  and reflect that inline (the value is still escaped on store/render regardless).
- Validate on input/blur for live feedback, and again on submit. Do NOT store while
  any field is invalid; highlight what's wrong.

### Server-side (the actual gate — mandatory)
Before writing to the object file, RE-VALIDATE everything the client checked; never
trust the client:
- Class tokens: strip/reject anything not matching the class-name charset. Ensure
  system/base classes are preserved and user classes only appended.
- Attribute names: reject any on the denylist (`id`, `class`, `style`, `on*`,
  editor-conflicting) and any not matching the attribute-name charset.
- Attribute values: escape for safe storage in the key:value object file (no format
  corruption) AND for safe HTML output on render (escape `"`, `<`, `>`, `&`).
- If server-side finds invalid input that the client "passed", reject the save with a
  clear error rather than storing something malformed — and treat that as a signal
  (a bypassed client) worth not trusting.
- Fail safe: on any validation failure, do NOT write a partial/corrupt object file.

## Rendering

- On page render, the object's container `<div>` gets: its system classes + user
  classes (combined into one `class` attribute), and the user's custom attributes
  (denylist-filtered, values escaped).
- The object's positioning/style (absolute left/top/width/height from its existing
  properties) is UNCHANGED and takes precedence — user classes/attributes must not be
  able to override positioning (the `style` denylist enforces this).
- Applies in both editing and viewing mode? Classes/attributes are safe to reflect in
  the editor (they don't execute code). Showing them live in the editor is fine and
  on-brand — BUT ensure a user class/attribute can't interfere with the editor's own
  hooks (see editor-safety below).

## Editor safety

- User-added classes/attributes must not collide with or break the editor's own
  handles. Moveable/Alpine and the editor select objects via their own classes/ids —
  ensure user classes are ADDITIVE and the editor keys off the SYSTEM classes/id, not
  a full-class-string match, so a user adding a class can't detach the object from the
  editor's control.
- The `id` being read-only protects the primary editor/reference handle.
- The `style` and `on*` denylist protects positioning and prevents inline JS in the
  edit context.

## Copy / clone / snapshot

- The new `object-class` / `object-attributes` properties must travel with the object
  through copy-object, clone-page, and snapshot/revision paths. Check those paths
  carry the new fields (easy to forget a new property in the copy logic).

## Out of scope

- Per-object inline CSS (separate feature — may come later; this SOW is
  identity/classes/attributes only).
- Per-object JS / inline event handlers — explicitly NOT here; JS stays in `/code`.
- Editing the object's positioning or module content (existing features, unchanged).

## Constraints

- Vanilla JS (consistent with the dejQuery'd `ng` editor). No jQuery.
- The "target" action being replaced: confirm what it currently does and ensure
  nothing depending on it breaks (or that its function is preserved/migrated).
- No build step exists. `modules/object/object-edit.min.js` is a plain copy of the
  source and must be refreshed alongside it (`min-files.spec.js` checks this).

## Where validation actually lives

Three layers, deliberately separate:

1. **The modal** validates as you type — feedback only, and it disables OK.
2. **`object.set_properties`** re-validates and REFUSES a bad save with a reason.
   Nothing is written until every field passes, so a rejected save cannot leave
   half the properties updated.
3. **The render path** (`object_alter_render_early`) filters independently.

Layer 3 is the one that actually holds, and the reason is worth keeping: the editor
writes through `glue.update_object`, a **generic key/value setter** that will store
any property under any name. A guard that only runs on the write path can therefore
be walked around with a single POST. There is a test that does exactly that — writes
a hostile `object-attributes` straight past the service — and asserts the renderer
drops it while keeping the valid attribute beside it.

## Definition of done

- The per-object action (formerly "target") opens an "Object Properties" view showing
  the object as a `<div>`: `id` read-only, system `class`(es) fixed with an input to
  add user classes, and a way to add custom attributes.
- User classes append to (never replace) system classes; invalid class names rejected.
- Custom attributes can be added, with the denylist (`id`, `class`, `style`, `on*`,
  and editor-conflicting attrs) enforced and clearly messaged.
- Classes/attributes persist in the object file WITHOUT corrupting its format, and
  render on the page with proper HTML escaping.
- Positioning and editor control are unaffected by user classes/attributes.
- New properties travel through copy/clone/snapshot.
- id remains immutable; no path allows changing it. ✔ (all of the above verified in
  `tests/e2e/object-properties.spec.js`)

## Noted while building, not acted on

`$.glue.object.unregister()` does not clear edit.js's `reg_objs` guard
(`js/edit.js:929`), so a `register()` after an `unregister()` silently does nothing
and the object loses its Moveable until a reload. Nothing here needs re-registering
— a class change is just a classList edit — so the modal simply does not do it. But
the asymmetry is a live trap for anyone who assumes the pair round-trips.
