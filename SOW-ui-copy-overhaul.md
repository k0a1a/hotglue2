# SOW — UI copy overhaul (consistent labels / tooltips / descriptions)

Status: to implement (ng). Produce consistent UI copy for ALL editor controls from a
provided control inventory, against the style guide below. This is a CONSTRAINED GENERATION
task: the inventory + the style rules + the worked examples fully determine the output — the
job is to APPLY the guide to the inventory, not invent a voice. The style guide here extends
UI-codex §6 (naming/voice) and should be folded back into it as the durable reference.

## Process (ITERATIVE — do NOT one-shot all of it)

1. **Batch 1 for review:** produce copy for ONE popover/toolbar's worth of controls first.
2. **Danja reviews** for voice, accuracy, length, consistency.
3. **Calibrate** the rules/examples from the review feedback.
4. **Full run:** only then produce copy for the whole inventory, with the calibrated guide.
Copy is voice-sensitive and subjective; the first batch catches "too formal / too long /
wrong term" before it's applied to everything.

## Voice (Hotglue's voice)

<<< DANJA TO CALIBRATE — the single most important input. Fill/adjust: >>>
- Plain, warm, friendly, a little playful. Human — like a person explaining, not a config
  file or a corporate dialog. DIY / indie-web, anti-corporate. Matches the sheep, the
  "more knobs" naming, the whole Hotglue character.
- **Avoid (anti-examples):** "Configure", "Utilize", "Parameters", "Submit", "Enable/Disable"
  as verbs, stiff/technical/cold phrasing, marketing fluff. (Danja: expand this list — what
  specifically grates?)
- NOT telegraphic/robotic in DESCRIPTIONS (full sentences read naturally, keep articles).

## String types — different rules per type (from UI-codex §6)

Each control may need one or more of these; the rules differ by type:

- **Label / button / menu item** — TERSE, drop articles, imperative. Scanned, not read.
  e.g. "Attach download", "Make link", "More knobs". (Short; set a max length, e.g. ~24 chars.)
- **Tooltip (short)** — name the control + optionally the key interaction/modifier. One line.
  e.g. "Glow — soft coloured halo (drag to scrub)". (Interaction hints like "drag to scrub",
  "hold Shift for fine" belong HERE, concise.)
- **Description (sentence)** — natural language, KEEP articles, warm, reads like a person
  explaining. 1–2 sentences max. e.g. "Attaches the download to the selected text or image
  object." (Where a longer "what/why" is wanted.)

Rules:
- **Capitalization:** <<< DANJA: pick one — sentence case (recommended, warmer) vs title
  case — and apply everywhere. >>>
- **Punctuation:** <<< DANJA: do tooltips/labels end in a period? (recommend: labels/tooltips
  no terminal period; descriptions yes.) Apply consistently. >>>
- **Interaction hints** (drag/Shift/double-click): include in TOOLTIPS, concise; not in labels.

## Consistency / glossary (one term per concept)

Same concept = same word everywhere. Reflect existing conventions ("more knobs" not
"advanced"; frame=page-scope convention where copy references scope).
<<< DANJA TO FILL the canonical term for each concept — examples to set: >>>
- the unit a user places -> "object" (NOT element / item / thing)
- the whole page -> "page" (NOT canvas / sheet / document?)  <<< confirm >>>
- the site -> "site"
- progressive disclosure -> "more knobs" (never "advanced")
- (add: glow / shadow / border naming; "download" vs "file"; etc.)
Every output must use these canonical terms; flag any control whose function implies a term
not yet in the glossary (so Danja can set it) rather than inventing a synonym.

## Worked examples (THE calibration anchor — fill with real ones)

<<< DANJA TO PROVIDE 5–6 real input->output examples across control types. The model
pattern-matches hard on these — they encode the voice better than the prose rules. Include at
least one BAD->GOOD pair. Template: >>>

- Button:      [control: make-link]  -> label: "Make link"
- Toggle:      [control: inside-glow] -> label: "Inside"  tooltip: "Glow inside the object instead of around it"
- Scrubby:     [control: glow-size]   -> label: "glow"  tooltip: "Glow size — drag to scrub, Shift for fine"
- Complex:     [control: object-code] -> tooltip: "Add CSS or JS to this object"  description: "Write styles or a script that apply to just this object."
- BAD -> GOOD:  "Configure object border parameters and effects"
                -> "Round the corners, set the border style and width"
<<< replace the above with Danja's actual preferred phrasings — these are placeholders to
show the shape. >>>

## Input format (the control inventory Danja provides)

Danja provides the controls sorted by context/functionality. Each entry should give:
- control id / name,
- context (which popover / toolbar / zone it lives in),
- function (what it does, in Danja's words — the source of truth for meaning),
- which string-types are needed (label / tooltip / description — or "all").
The copy must be ACCURATE to the stated function — if the function is unclear, ASK rather
than guess (wrong copy is worse than none).

## Output format

- Return copy keyed by control id, grouped by the same context ordering as the input, in a
  structure that drops straight into the code (a table or a keyed file — confirm the exact
  shape with Danja). One row per control with its label / tooltip / description as needed.
- Keep it mechanically mergeable (stable keys) so re-runs/edits are easy.

## Constraints

- APPLY the style guide to the inventory; do not drift into generic SaaS voice.
- Accurate to each control's stated function; ask when unclear, never invent behaviour.
- Use the canonical glossary terms; flag missing terms rather than inventing synonyms.
- Per-string-type rules (labels terse/no-article; descriptions natural/with-article);
  consistent capitalization + punctuation.
- Iterative: batch 1 -> review -> calibrate -> full run.
- Fold the finalized voice/format/glossary rules back into UI-codex §6 as the durable guide.

## Definition of done

- A calibrated style guide (voice + string-type rules + glossary + examples) — refined via
  the batch-1 review — exists and is reflected into UI-codex §6.
- Consistent copy (labels / tooltips / descriptions as needed) is produced for EVERY control
  in the provided inventory, keyed by control id, in the agreed drop-in output format.
- Copy is accurate to each control's function, uses canonical terms, follows per-type and
  capitalization/punctuation rules, and reads in the Hotglue voice (not generic/corporate).
- Any controls with unclear function or missing glossary terms were flagged for Danja, not
  guessed.
