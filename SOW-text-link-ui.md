# SOW — "Make link" UI for text objects

Status: **implemented** on `ng`, covered by `tests/e2e/text-link.spec.js`.
Goal: let a user select text inside a text object and turn it into a link via a small
URL input, instead of hand-typing `<a href="...">...</a>`. (Todo-list item: "allow
selected part of text be made a link, add a class to it too".)

## Corrections to this document

**Text objects are NOT contenteditable.** They are edited as a `<textarea>` holding
raw HTML source, with a separate `.glue-text-render` div showing the result when not
editing. `js/edit.js:2370` says so in as many words. Everything the Implementation
notes proposed therefore does not apply: `document.execCommand('createLink')` does
nothing to a textarea, and there is no Selection/Range API to manipulate — only
`selectionStart`/`selectionEnd`, which are plain character offsets. Making a link
means splicing literal `<a>` tags into the textarea's value.

That is simpler than the draft assumed, not harder, and it is also why the URL has
to be escaped as attribute SYNTAX: the user is authoring source, so a stray quote
produces broken markup rather than a broken DOM.

**A basic version already existed** — the 🔗 icon in the text context menu wrapped
the selection using `prompt()`. It escaped `"` and nothing else, had no URL
validation of any kind, and could not edit or remove an existing link. It was not
mentioned in the README or anywhere else, which is why it went unnoticed.

**There is no "terser build".** Hotglue has no build step; its own `*.min.js` files
are hand-synced copies, enforced by `tests/e2e/min-files.spec.js`.

**`javascript:` here is hygiene, not a security boundary.** The author is
authenticated and is typing raw HTML into a textarea, so they can already write
anything at all, this button included or not. It is refused because a link the UI
builds for you should never be something you did not ask for — not because it closes
a hole.

## Current behaviour

To make a link before this, the user typed `<a href="...">word</a>` by hand into the
source, or used the 🔗 button's bare `prompt()`.

## Target behaviour

1. User selects a word/phrase inside a text object (in the editor).
2. Triggers a "make link" action (toolbar button / context action on the object's
   text-editing controls).
3. A small UI appears with a URL input (and OK / Cancel).
4. On confirm, the selected text is wrapped in `<a href="THE_URL" class="...">…</a>`.
5. The link is now part of the text object's content and renders as a link when the
   page is viewed.

## Implementation notes

- The selection is a pair of character offsets into the textarea's value. The link
  is built as a string and spliced in. `selectionStart`/`selectionEnd` survive the
  textarea losing focus to the toolbar click, which is what makes reading them at
  that moment work at all.
- Finding an existing link to edit or remove is a REGEX over the source, not a
  parser: the textarea holds text that may not even be well-formed while it is being
  typed. It recognises a link this UI wrote, and fails by finding nothing rather than
  by mangling something. Nested or hand-broken markup can defeat it.
- **Vanilla JS** (no jQuery — consistent with the dejQuery'd `ng` editor).

## URL input & validation

- Small inline UI: a URL text field + OK / Cancel. Keep it minimal and on-brand.
- **Validate the URL** (client-side for UX, and sanitize on the way into the href):
  - Accept http/https URLs and internal/relative Hotglue links.
  - Handle the common "user typed `example.com` without a scheme" case: decide and be
    consistent — either auto-prepend `https://` or prompt. (Recommend auto-prepend
    `https://` when no scheme is present, so links actually work.)
  - **Reject dangerous schemes**: do NOT allow `javascript:` (that's script injection
    via a link — XSS), and be wary of `data:` URLs. Whitelist `http`, `https`,
    `mailto`, and internal/relative paths; reject the rest.
  - **Escape the URL** when writing it into the `href` attribute (a URL containing `"`
    or `<`/`>` must not break out of the attribute) — same escaping care as the object
    properties feature.
- Highlight an invalid/empty URL inline rather than silently doing nothing.

## Editing / removing an existing link

- If the user's selection is (or is inside) an existing `<a>`, the UI should:
  - pre-fill the current URL so they can EDIT it, and
  - offer a REMOVE-link option (unwrap the `<a>`, keep the text).
- Otherwise (creating a new link on the added feature is only "add", never fix, which
  is frustrating).

## Class on the link (from the todo item)

- Optionally add a class to the created `<a>` (e.g. a default link class) so linked
  text can be styled consistently / targeted from `/code` or per-object CSS. Small,
  include if cheap.

## Storage

- The link is plain HTML inside the text object's content, which is already stored
  as-is in the object file and round-trips today. So NO new storage mechanism — it's
  part of the existing text content. Just ensure the inserted `href` value is escaped
  so it can't break the object-file format or the rendered HTML.

## Out of scope for v1 (note, maybe later)

- **Automatic target selection** (the separate todo item: `_blank` for external,
  `_parent`/`_self` for internal links). Could extend this UI to auto-detect
  internal-vs-external and set `target` accordingly — but keep v1 to just the URL.
  Note it as a natural extension.
- A full rich-text toolbar (bold/italic/etc.) — this SOW is the link feature only.

## Constraints

- Vanilla JS, no jQuery.
- Works within the existing `contenteditable` text-editing flow — don't disrupt normal
  text editing or the object save path.
- No build step exists; the `*.min.js` copies must be refreshed alongside their
  sources (`min-files.spec.js` checks this).
- The created link must survive the normal text-object save/render round-trip.

## Editing now looks like viewing (WYSIWYG)

Raised while building, and then built: the markup is hidden while editing, so a
link shows as underlined text rather than as `<a href="...">word</a>`. At a large
font in a small object the markup was longer than the word it wrapped and swamped
the box entirely.

**The blocker was never `contenteditable` itself.** It is that the rendered HTML is
a lossy projection of the stored source, through five one-way transforms
(`module_text.inc.php`, `_text_render_content`):

```php
$s = resolve_aliases($s, $name);        // $BASEURL$, $page$, $rev$, $GLUE$ expanded
$s = html_encode_str_smart($s);
$s = str_replace("\n", "<br>\n", $s);   // TEXT_AUTO_BR
$s = str_replace("\xc2\xa0", '&nbsp;', $s);
$s = resolve_relative_urls($s);         // relative -> absolute
```

Editing that output and saving `innerHTML` back would bake every one of them in on
the first edit of every text object: `$BASEURL$` becomes a hardcoded domain, relative
links become absolute, every newline becomes a literal `<br>`.

So editing does NOT use the view render. `$.glue.text.to_editing_html()` /
`from_editing_html()` are a separate, deliberately reversible pair: no alias
expansion, no url rewriting, nothing encoded. The only transform is
newline <-> `<br>`, and the `<br>` elements it inserts are MARKED
(`data-glue-nl`), so a `<br>` the author typed themselves survives as a `<br>`
rather than silently becoming a newline. Both forms render identically, but
rewriting one into the other is still editing someone's file behind their back.

`tests/e2e/text-roundtrip.spec.js` is the guard: it opens each of thirteen content
samples, changes nothing, closes, and compares stored bytes. Ten are byte-identical.
The three that change are the browser's HTML parser canonicalising markup, and are
pinned by name:

| stored | after a no-edit round trip |
|---|---|
| `raw & here` | `raw &amp; here` (invalid, repaired) |
| `<A HREF="...">` | `<a href="...">` |
| `href=x` | `href="x"` |

All three render identically. Everything that mattered survives: aliases, relative
links, anchors, authored `<br>`, newlines, entities, inline tags, link classes.

**The storage format is unchanged** - same `content` property, same raw HTML, no new
encoding, no migration.

Also handled, because a contenteditable div is not a textarea:

- **Keyboard isolation.** The editor's shortcuts are bound on `documentElement`, so
  without stopping propagation Delete deletes the object being typed into and the
  arrows move it. The textarea had this; the div needed its own.
- **Enter inserts our own marked `<br>`.** Left alone, blink wraps the new line in a
  `<div>` and gecko inserts a bare `<br>`, so the same keystroke would produce
  different source on the two engines.
- **Paste is forced to plain text.** Rich paste brings the source document's spans,
  styles and classes, and they are indistinguishable from markup the author wrote.
- **A source-mode toggle** (`</>` in the text menu) puts the textarea back. It is the
  way to edit literal markup, and the way to repair anything WYSIWYG canonicalises.

The link dialog therefore has two implementations: DOM manipulation in WYSIWYG mode,
and the original string splicing in source mode.

## Definition of done

- Selecting text in a text object and triggering "make link" opens a small URL input;
  confirming wraps the selection in a valid, escaped `<a href>`.
- URLs are validated (scheme handling, `javascript:`/dangerous schemes rejected, value
  escaped); invalid input is highlighted, not silently dropped.
- Selecting existing linked text lets the user edit the URL or remove the link.
- The link persists through save and renders correctly when the page is viewed.
- No jQuery; normal text editing and saving are unaffected.
