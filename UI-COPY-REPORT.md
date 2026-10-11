# UI copy overhaul - full report for refinement

Companion to `SOW-ui-copy-overhaul.md`. Covers every tooltip and control label in the
editor (`modules/*/*-edit.js`, `modules/page*/…`, `js/edit.js`). Status of the work, the
rules agreed with danja so far, then one table per context with current and proposed copy.

## Implementation status (2026-10-11)

Every `proposed` row in sections 1-13 is now in the code, in the `.min.js` copies and in the
specs. Not applied: `flag` rows (`new-webvideo`, `text-shadow-opacity` label, `bg-scroll`,
`object-copy-full` kept as proposed but unconfirmed) and all of section 14 (messages).
Number-field `title:` options were added for font size, line, letter, word, text shadow rows,
page background x/y/scale and grid x/y. Also changed, not listed above: the static video/audio/
iframe toggle state tooltips (`autoplay on - click to turn off`, `loop on ...`, `player controls
shown ...`, `sound muted - click to unmute`, `scrollbars shown ...`) and the published-page
shield titles in `module_{iframe,webvideo,audio,video}.inc.php` (`click to select this ...`).
The `new-webvideo` tooltip is unchanged. Suite: all green except the known `icons.spec.js`.

## How to use this report

1. Refine the **Rules** and **Glossary** first - everything else follows from them.
2. Edit the **Proposed** column in place (keep the keys). Strike a row by writing `KEEP` in
   Proposed. Answer the **Open questions** at the end.
3. Hand the file back for implementation. Keys are stable, so edits map one-to-one onto
   strings in the code. Rows with status `applied` are already in the code and tested; they
   are included so the whole set can be read against one voice.

Status column: `applied` = in the code now, `proposed` = not yet changed, `flag` = the
meaning is unclear to the author of this report, so a decision is needed before applying.

## Rules agreed so far (danja, this session)

- Scope: **tooltips only** for now (no descriptions). Alert and error messages are listed
  separately in section 14 and are not touched until approved.
- **lowercase**, no terminal period.
- **Technical, precise terms** over friendly ones (one word per concept).
- Shape: `name` or `name - hint`. A hyphen with a space either side (` - `), never a colon
  and never a long dash.
- Number fields (scrub fields) end with the shared hint
  `- drag sideways, shift coarse, alt fine, or type` (`$.glue.popover.number_hint`).
  Fields get a name first: `padding top - drag sideways, shift coarse, alt fine, or type`.
- Spelling: `color` (not colour), `center` (not centre), `url` and `html` in lowercase.
- Action buttons name the action (`bring to front`, `delete object`). Property controls
  name the property (`corner radius`, `object opacity`). Toggles name the thing, then the
  effect of a click when the state matters (`inner glow - also glow inside the object`).
- Where the state changes the meaning, the tooltip says the state and what a click does:
  `cut off content bigger than the object - click to let it show`.

## Glossary (proposed - confirm)

| concept | use | do not use |
|---|---|---|
| the thing you place | object | element (except "reading order" - see Q4), item, box |
| the whole page | page | canvas, sheet, document |
| all pages | site | |
| progressive disclosure | more knobs | advanced |
| make non-editable | freeze / frozen (code and files still say `lock`) | lock, protect |
| layer order | bring to front / bring forward / send backward / send to back | to top, level up |
| layout modes | absolute layout (unbounded canvas), centered layout (fixed-width container) | wide, infinite |
| edge softening | edge fade | feather |
| soft halo / hard drop | glow / shadow | |
| file attached to a page | download (the object type), asset (any uploaded media) | |
| transparency of an object | opacity | transparency |

---

## 1. Main menu - new / create (click empty page)

| key | where | current | proposed | status |
|---|---|---|---|---|
| `new-text` | text-edit.js:3276 | create a text object | new text object | proposed |
| `new-webvideo` | webvideo-edit.js:14 | embed a video or audio track | embed web video or audio - paste a link | flag (Q8) |
| `new-iframe` | iframe-edit.js:51 | embed another webpage | embed webpage | proposed |
| `upload-asset` | edit.js:4643 | upload an asset - an image, video or sound file | upload asset - image, video, audio or html file | proposed (html added: the picker accepts it, the tooltip omits it) |
| `upload-file` | edit.js:4664 | upload a file - any file, stored as a download object | upload file - any file, stored as a download object | proposed (only the colon-to-hyphen was done; this drops "a") |
| `paste` | object-edit.js (paste-from-clipboard) | paste copied object | paste copied object | KEEP |
| `undo` | edit.js:3469 | undo the last change | undo last change | proposed |
| `redo` | edit.js:3477 | redo the last undone change | redo last undone change | proposed |

## 2. Main menu - page (double-click empty page)

| key | where | current | proposed | status |
|---|---|---|---|---|
| `page-new` | page-edit.js:377 | create a new page | new page | proposed |
| `page-options` | page-edit.js:273 | page options - change title of the page, URL, make it a start page, or delete it | page options - title, url, start page, password, delete | proposed |
| `page-background` | page-edit.js:949 | set page background | page background | proposed |
| `reading-order` | page-edit.js:361 | reading order - assign element importance, H1 being of most importance, through H6 | reading order - the order screen readers follow | proposed (Q4) |
| `grid` | page-edit.js:1077 | show grid (50x50) | grid settings - 50x50 | proposed |
| `layout-to-centered` | page-edit.js:1097 | center page content in a fixed-width container | switch to centered layout - fixed-width container | proposed |
| `layout-to-absolute` | page-edit.js:1099 | page content sits on an unbounded canvas | switch to absolute layout - unbounded canvas | proposed (it names the destination now; the old one described the current state) |
| `site-options` | page_browser-edit.js:16 | site options - set site icon (favicon), manage pages, add fonts | site options - favicon, pages, fonts | proposed |
| `page-code` | user_code-edit.js:11 | add custom JavaScript code and CSS definitions | page code - css and javascript for this page | proposed |
| `container-handle` | page-edit.js:38 | drag to set how wide the centered container is | container width - drag to resize | proposed |

## 3. Object menu (select an object)

| key | where | current | proposed | status |
|---|---|---|---|---|
| `object-properties` | object-edit.js:2174 | object properties - background, opacity, padding, flip, link | same | applied |
| `object-border` | object-edit.js:2109 | border properties - corners, border, clip, fade, glow, shadow | same | applied |
| `object-code` | user_code-edit.js:360 | code for this object - CSS that applies to it alone, and JavaScript that is handed it | object code - css and javascript for this object | proposed |
| `object-html-attributes` | object-edit.js (object-html-attributes) | object HTML attributes - id, class and custom values | html attributes - id, class and custom attributes | proposed |
| `object-symlink` | object-edit.js (shared-w-other-pages) | make this object appear on all pages | show on all pages - repeat this object on every page | proposed (Q5) |
| `object-clone` | object-edit.js:2048 | create a clone of this object | clone object | proposed |
| `object-align` | object-edit.js | align objects | align objects - select two or more with shift+click | proposed |
| `object-copy` | object-edit.js | copy object to clipboard - paste copied object on any page of your site | copy object - paste it on any page of the site | proposed |
| `object-copy-full` | object-edit.js | copy object to clipboard - [previous data present] | copy object - replaces the copied object | proposed (Q6) |
| `object-freeze` | lock.js:143 | freeze object | freeze object | KEEP |
| `object-unfreeze` | lock.js:143 | object is frozen, click to unfreeze it | unfreeze object - this object is frozen | proposed |
| `object-delete` | object-edit.js (delete) | delete object (UNDOABLE) | delete object - can be undone | proposed |

## 4. Object properties popout (done in batch 1 and 3)

| key | current | proposed | status |
|---|---|---|---|
| `props-bg-color` | background color | background color | applied |
| `props-bg-image` | background image - pick a file | same | applied |
| `props-bg-tile` | tile background image | same | applied |
| `props-flip-h` | flip horizontally | same | applied |
| `props-flip-v` | flip vertically | same | applied |
| `props-layer-front` | bring to front | same | applied (wording never confirmed) |
| `props-layer-forward` | bring forward | same | applied (wording never confirmed) |
| `props-layer-backward` | send backward | same | applied (wording never confirmed) |
| `props-layer-back` | send to back | same | applied (wording never confirmed) |
| `props-link-url` | link address - full url, page name or anchor (#top) | same | applied |
| `props-link-make` | put a link on this object | same | applied |
| `props-link-update` | apply the edited address | same | applied |
| `props-link-remove` | remove the link from this object | same | applied |
| `props-link-target` | link target - where the link opens | same | applied |
| `props-obj-x/y` | object x position / object y position (+ number hint) | same | applied |
| `props-obj-scale` | object scale, % of size when opened (+ hint) | same | applied |
| `props-bg-x/y` | background x position / background y position (+ hint) | same | applied |
| `props-bg-scale` | background scale, % of object width (+ hint) | same | applied |
| `props-opacity` | object opacity (+ hint) | same | applied |
| `props-padding` | padding, all sides (+ hint) | same | applied |
| `props-padding-top/right/bottom/left` | padding top, padding right ... (+ hint) | same | applied |
| `props-blend` | how the object blends with what is behind it (edit.js:1323) | blend mode - how the object blends with what is behind it | proposed |

Section titles inside the panel (`object properties`, `background properties`) and row labels
(`x`, `y`, `scale`, `opacity`, `padding`, `target`) are labels, not tooltips; left alone.

## 5. Border properties popout (done in batch 2)

| key | current | proposed | status |
|---|---|---|---|
| `edge-round` | corner radius (+ hint) | same | applied |
| `edge-fade` | edge fade - softens the object inward from its sides (+ hint) | same | applied |
| `edge-width` | border width (+ hint) | same | applied |
| `edge-style` | border style | same | applied |
| `edge-color` | border color | same | applied |
| `edge-clip-on` | cut off content bigger than the object - click to let it show | same | applied |
| `edge-clip-off` | content bigger than the object shows - click to cut it off | same | applied |
| `glow-spread` | glow spread (+ hint) | same | applied |
| `glow-opacity` | glow opacity (+ hint) | same | applied |
| `glow-color` | glow color | same | applied |
| `glow-inner` | inner glow - also glow inside the object | same | applied |
| `glow-color2` | glow second color | same | applied |
| `shadow-color` | shadow color | same | applied |
| `shadow-distance/angle/blur/spread` | shadow distance / angle / blur / spread (+ hint) | same | applied |

## 6. Text object menu and popout

Menu buttons:

| key | where | current | proposed | status |
|---|---|---|---|---|
| `text-panel` | text-edit.js:3428 | change font-face, style, color.. | text properties - font, size, style, color, spacing, shadow | proposed |
| `text-heading` | text-edit.js:3448 | heading level | heading level - h1 to h6 | proposed |
| `text-source` | text-edit.js:3369 | switch between editing the text as it looks and editing its HTML source | edit html source - switch between visual and source editing | proposed |

Popout controls:

| key | where | current | proposed | status |
|---|---|---|---|---|
| `font-bold` | text-edit.js:1889 | bold | bold | KEEP |
| `font-italic` | " | italic | italic | KEEP |
| `font-underline` | " | underline | underline | KEEP |
| `font-strike` | " | strikethrough | strikethrough | KEEP |
| `font-color` | text-edit.js:1912 | text colour | text color | proposed |
| `font-size-s` | text-edit.js:2318 | small: 14px | font size small - 14px | proposed (colon, and "font size") |
| `font-size-n` | " | normal: 24px | font size normal - 24px | proposed |
| `font-size-b` | " | big: 32px | font size big - 32px | proposed |
| `font-size-x` | " | extra: 48px | font size extra big - 48px | proposed |
| `font-size` | text-edit.js:2355 | (generic number hint) | font size, exact - (+ hint) | proposed |
| `text-align-left` | text-edit.js:2411 | align left | align text left | proposed |
| `text-align-center` | " | align centre | align text center | proposed |
| `text-align-right` | " | align right | align text right | proposed |
| `text-align-justify` | " | justify | justify text | proposed |
| `text-list-ul` | text-edit.js:2440 | bulleted list | bulleted list - each selected line becomes an item | proposed |
| `text-list-ol` | " | numbered list | numbered list - each selected line becomes an item | proposed |
| `text-padding` | text-edit.js:2475 | press and drag to position the text inside the object | text padding - press and drag to move the text inside the object | proposed |
| `text-line` | text-edit.js:2608 | (generic number hint) | line height - (+ hint) | proposed |
| `text-letter` | text-edit.js:2641 | (generic number hint) | letter spacing - (+ hint) | proposed |
| `text-word` | text-edit.js:2669 | (generic number hint) | word spacing - (+ hint) | proposed |
| `text-shadow-blur` | text-edit.js:2767 | (generic; row label "shadow") | text shadow blur - (+ hint) | proposed |
| `text-shadow-opacity` | text-edit.js:2781 | (generic; row label "fade") | text shadow opacity - (+ hint) | flag (Q7: the row label says "fade" but it is the shadow's opacity) |
| `text-shadow-distance` | text-edit.js:2805 | (generic) | text shadow distance - (+ hint) | proposed |
| `text-shadow-angle` | text-edit.js:2818 | (generic) | text shadow angle - (+ hint) | proposed |
| `text-shadow-spread` | text-edit.js:2830 | (generic) | text shadow spread - (+ hint) | proposed |
| `text-shadow-color` | text-edit.js:2846 | shadow colour | text shadow color | proposed |
| `text-link-url` | text-edit.js:651 | the address the selected text links to | link address - where the selected text links to | proposed |
| `text-link-make` | text-edit.js:656 | wrap the selected text in a link to this address | put a link on the selected text | proposed |
| `text-link-update` | text-edit.js:805 | apply the edited address to the link | apply the edited address | proposed |
| `text-link-remove` | text-edit.js:809 | take the link off the text | remove the link from the selected text | proposed |
| `text-link-target` | text-edit.js:671 | where clicking the link opens it | link target - where the link opens | proposed |
| `text-link-disabled` | text-edit.js:252,463 | this link is disabled for editing | link disabled while editing | proposed |
| `heading-plain` | text-edit.js:3251 | render this text as a plain text object | plain text - no heading | proposed |
| `heading-N` | text-edit.js:3254 | render this text as a H1 heading (and H2...H6) | heading level 1 (h1) ... heading level 6 (h6) | proposed |

## 7. Image object

| key | where | current | proposed | status |
|---|---|---|---|---|
| `image-description` | image-edit.js:347 | image description | image description - alt text and decorative | proposed |
| `image-download` | image-edit.js:353 | download original file | download original file | KEEP |
| `image-decorative` | image-edit.js:249 | mark the image as decorative (screen readers skip it) | decorative image - screen readers skip it | proposed |

## 8. Video and audio objects

Video and audio use the same set; `audio` replaces `video` in each.

| key | where | current | proposed | status |
|---|---|---|---|---|
| `video-autoplay` | video-edit.js:228 | toggle automatic playback of video | autoplay - start playing when the page loads | proposed |
| `video-loop` | video-edit.js:233 | toggle looping of video | loop - play again at the end | proposed |
| `video-controls` | video-edit.js:238 | show or hide control elements | player controls - show or hide | proposed |
| `video-sound` | video-edit.js:243 | mute or unmute video | sound - mute or unmute | proposed |
| `video-download` | video-edit.js:248 | download original file | download original file | KEEP |
| `audio-autoplay` / `-loop` / `-controls` / `-sound` | audio-edit.js:195-210 | as video, with "audio" | as video, same wording | proposed |

## 9. Iframe and web video objects

| key | where | current | proposed | status |
|---|---|---|---|---|
| `iframe-scroll` | iframe-edit.js:105 | toggle scrollbars on and off | scrollbars - show or hide | proposed |
| `iframe-shield` | iframe-edit.js:79 | click here to select/edit this embed | click to select this embed | proposed |

## 10. Download object

| key | where | current | proposed | status |
|---|---|---|---|---|
| `download-file` | download-edit.js:347 | download file | download file | KEEP |
| `download-attach-box` | download-edit.js:328 | attach the download to a selected text or image object | attach download - to the selected text or image object | proposed |
| `download-attach` | download-edit.js:136,146 | attach a file to download | attach download to this object | proposed |
| `download-detach` | download-edit.js:146 | detach the download | detach download | proposed |
| `download-public` | download-edit.js:242 | this download is public - click to make it private | public download - click to make it private | proposed |
| `download-private` | download-edit.js:246 | (private state, same pattern) | private download - click to make it public | proposed |

## 11. HTML attributes panel

| key | where | current | proposed | status |
|---|---|---|---|---|
| `attr-id` | object-edit.js:138 | the object's id - select and copy it to target this object from the page's code | object id - select and copy it to target this object from page code | proposed |
| `attr-copy-id` | object-edit.js:139 | copy the object's id | copy object id | proposed |
| `attr-copied` | object-edit.js:147 | copied | copied | KEEP |
| `attr-selected` | object-edit.js:166 | select done - press ctrl+c | selected - press ctrl+c | proposed |
| `attr-remove` | object-edit.js:221 | remove this attribute | remove attribute | proposed |

Placeholders (not tooltips): `your own classes`, `name`, `value` - left alone.

## 12. Page panels

| key | where | current | proposed | status |
|---|---|---|---|---|
| `page-title` | page-edit.js:130 | the title shown in the browser tab and to search engines | page title - shown in the browser tab and to search engines | proposed |
| `page-url` | page-edit.js:150 | the URL of this page | page url | proposed |
| `page-start` | page-edit.js:181 | make this the page visitors land on | start page - the page visitors land on | proposed |
| `page-password` | page-edit.js:205,208 | protect this page with a password | page password - protect this page | proposed |
| `page-password-clear` | page-edit.js:214 | remove the password | remove page password | proposed |
| `reading-up` | page-edit.js:323 | move up in the reading order | move up in the reading order | KEEP |
| `reading-down` | page-edit.js:336 | move down in the reading order | move down in the reading order | KEEP |
| `bg-color` | page-edit.js:538 | set page background color | page background color | proposed |
| `bg-image` | page-edit.js:572 | set page background image | page background image - pick a file | proposed |
| `bg-video` | page-edit.js:611 | set page background video | page background video - pick a file | proposed |
| `bg-tile` | page-edit.js:653 | tile page background image | tile page background image | KEEP |
| `bg-scroll` | page-edit.js:738 | scroll page background image | scroll page background image - moves with the page | flag (Q9) |
| `bg-x/y/scale` | page-edit.js:820,833,862 | (generic number hint) | page background x position / y position / scale, % of page width - (+ hint) | proposed |
| `grid-show-on` | page-edit.js:990 | the grid is drawn - click to remove it | grid shown - click to hide it | proposed |
| `grid-show-off` | page-edit.js:994 | no grid - click to draw it | grid hidden - click to show it | proposed |
| `grid-interlock-on` | page-edit.js:1015 | x and y move together - click to set them separately | grid x and y linked - click to set them separately | proposed |
| `grid-interlock-off` | page-edit.js:1015 | x and y are set separately - click to interlock them | grid x and y separate - click to link them | proposed |
| `grid-x/y` | page-edit.js:1049,1061 | (generic number hint) | grid x spacing / grid y spacing - (+ hint) | proposed |

## 13. Multi-select (align) toolbar

| key | where | current | proposed | status |
|---|---|---|---|---|
| `align-left` | edit.js:3890 | align left edges to the first-selected object | align left edges to the first selected object | proposed |
| `align-right` | edit.js:3892 | align right edges to the first-selected object | align right edges to the first selected object | proposed |
| `align-top` | edit.js:3894 | align top edges to the first-selected object | align top edges to the first selected object | proposed |
| `align-bottom` | edit.js:3896 | align bottom edges to the first-selected object | align bottom edges to the first selected object | proposed |
| `align-center` | edit.js:3898 | align horizontal centres to the first-selected object | align horizontal centers to the first selected object | proposed |
| `align-middle` | edit.js:3900 | align vertical centres to the first-selected object | align vertical centers to the first selected object | proposed |

Multi-select left menu (`object-freeze` / `object-unfreeze`, `object-delete`) uses the
copy in section 3 unchanged; each acts on every selected object.

## 14. Messages (alerts and errors) - not tooltips, not applied

Alerts are shown with `$.glue.error()` (`alert('Hotglue message: ' + s)`). Today they mix
sentence case and lowercase and say "There was a problem...". Proposed rule: lowercase, no
period, say what failed and what to try. Listed so the whole set can be reviewed; implement
only if approved (Q10).

| key | where | current | proposed |
|---|---|---|---|
| `msg-align-hint` | object-edit.js | Select two or more objects (Shift+click) to align to the first selected object | select two or more objects (shift+click) to align to the first selected object |
| `msg-attach-none` | download-edit.js:95,100 | Select text or image object (Shift + click) to attach download to it | select a text or image object (shift+click) to attach the download to it |
| `msg-attach-many` | download-edit.js:84 | select exactly one text or image object to attach the download to | select exactly one text or image object to attach the download to |
| `msg-attach-link` | download-edit.js:110 | this object is already a link | this object is already a link |
| `msg-attach-has` | download-edit.js:114 | this object already has a download | this object already has a download |
| `msg-link-select` | text-edit.js:715 | Select the text you want to turn into a link first, or put the cursor inside an existing link to edit it. | select the text to link first, or put the cursor inside an existing link to edit it |
| `msg-embed` | webvideo-edit.js:28 | There was a problem embedding the link | could not embed the link |
| `msg-upload` | edit.js:4555, page-edit.js:578,617, object-edit.js:1567 | There was a problem uploading a file (status N) | could not upload the file (status N) |
| `msg-upload-size` | edit.js:4557, page-edit.js:580,619 | There was a problem uploading a file. Make sure you are not exceeding the file size limits set in the server configuration. | could not upload the file - check the file size limit in the server configuration |
| `msg-server` | edit.js:4840, page-edit.js:587,626 | There was a problem communicating with the server | could not reach the server |
| `msg-upload-detail` | edit.js:4842, page-edit.js:589,628 | There was a problem uploading the file (...) | could not upload the file (...) |
| `msg-too-large` | edit.js:4771 | file too large (max N) | file too large - max N |
| `msg-browser` | edit.js:4822 | Your browser is not supported. Update to a recent version of Firefox or Chrome. | this browser is not supported - update to a recent firefox or chrome |
| `msg-favicon` | page_browser.js:215 | There was a problem uploading the favicon | could not upload the favicon |
| `msg-fonts-upload` | page_browser.js:302 | There was a problem uploading the font | could not upload the font |
| `msg-fonts-limit` | page_browser.js:306 | You can upload up to 10 custom fonts - remove one before adding another | up to 10 custom fonts - remove one before adding another |
| `msg-attrs` | object-edit.js:96 | This object's custom attributes could not be read and have been left alone. | this object's custom attributes could not be read and were left alone |
| `msg-no-object` | edit.js:4847 | The server did not reply with any object. The file type ... (long) | the server did not return an object - the file type may not be supported, or check the log file |
| `msg-clear-bg` | object-edit.js (confirm) | Do you want to clear the current background image? | clear the current background image? |

---

## Open questions for the reviewer

1. **Verb forms.** Actions are verb phrases (`delete object`, `new page`) and properties are
   nouns (`corner radius`). Confirm this split, or pick one form for everything.
2. **"new ..." vs "create a ...".** The proposal uses `new text object`, `new page`. Say if
   `create` should stay.
3. **Number hint.** `- drag sideways, shift coarse, alt fine, or type` is long. Keep, or shorten
   to `- drag or type`? (The modifiers only exist on number fields.)
4. **"element" in reading order.** The reading order panel is about page structure and
   headings, where "element" is the right technical word; the proposal avoids it by
   describing the effect instead. Confirm.
5. **"show on all pages".** The code calls it a symlink; the tooltip says what a user gets.
6. **Copy tooltip with data present.** The current `[previous data present]` is a debug-style
   marker. The proposal says what a click does (replaces the copied object). Confirm that is
   what happens.
7. **Text shadow "fade" row.** The row label is `fade` but it controls the shadow's opacity.
   The proposed tooltip says `opacity`; the visible row label should probably change too.
   That is a label, so it needs an explicit yes.
8. **Web video tooltip.** `embed web video or audio - paste a link` assumes the dialog takes
   a pasted link (youtube, vimeo, ...). Needs checking against what it actually accepts.
9. **Page background "scroll".** Unclear whether it means the picture scrolls with the
   page or stays fixed. State the behaviour in the hint.
10. **Messages (section 14).** Apply the lowercase / no-period rule to alerts too, or leave
    them in sentence case?
11. **Layer wording.** `bring to front` etc. was applied without confirmation.
12. **Per-state tooltips for toggles.** Video/audio toggles currently have one static tooltip.
    State-aware wording (`unmute` when muted) would need code changes, not just copy.
13. **UI-codex §6.** This report's rules and glossary are meant to be folded into it. The file
    was not found in the repo root; where does it live?

## Implementation notes (for whoever applies the final copy)

- Strings live next to the controls (grep the file:line column). There is no central table, so
  a pass is a series of small edits; keep the keys in this report as comments if useful.
- Every edit must be mirrored into the matching `.min.js` (the repo keeps comment-stripped
  copies; see `tests/e2e/min-files.spec.js`).
- e2e tests find many buttons by `getByTitle(...)`. Changing a tooltip means changing the
  tests that use it. Grep `tests/e2e` for the old string before editing.
- Number fields take `title:` in `$.glue.popover.number_row(label, { title: '...' })`; the
  hint is appended automatically.
- Toggles that swap tooltips by state (clip, freeze, public/private, grid show/interlock,
  layout mode) set `title` in a sync function; change both states together.
- Run `npx playwright test --config tests/e2e/playwright.config.js --project=chromium`.
  Known unrelated failure: `icons.spec.js` (align icon SVG files are not stripped).
