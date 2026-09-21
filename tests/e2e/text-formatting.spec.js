// Run-level formatting through the text panel: B/I/U/S, colour, an arbitrary-px
// size, the face, the spacings and the shadow for a SELECTED RUN of text, while
// the object is edited WYSIWYG - and the same panel acting on the WHOLE OBJECT
// when nothing is selected (a caret is nothing). The run wraps its effects in
// semantic tags (<b>/<i>/<u>/<s>/<span style="...">) that the storage and
// render pipeline pass through byte-for-byte; the object writes obj.style.*,
// stored as attributes. Both are asserted on what is STORED after leaving edit
// mode, the way text-link.spec.js does.
//
// The size field acts on a snapshot taken on pointerdown (programmatic focus
// collapses the selection first, so these tests click first, then fill and
// dispatch - a typed digit appends to the pre-filled field instead of
// replacing its value). Every run control takes the same snapshot on its own
// press, so a pick can reach its handler without a preceding mousedown and
// still act on the run the press was made on.
// Wrappers nest innermost-last: clicking italic, then underline, then strike
// stores <i><u><s>world</s></u></i>.
// Stored forms are the browser's canonical serializations: a size keeps
// "font-size: 24px;", a colour becomes "color: rgb(255, 0, 0);", and a
// font-family's quotes come back as &quot; - the bytes html_encode_str_smart
// passes through are whatever the editor wrote, so these assert on those.

const { test, expect, waitForEditor } = require('./fixtures/hotglue.js');

const ID = '100000000001';			// the object's basename (what readObject wants)
const ATTRS = {
	type: 'text', module: 'text',
	'object-left': '200px', 'object-top': '200px',
	'object-width': '300px', 'object-height': '120px', 'object-zindex': '100',
	'text-background-color': 'transparent',
};

const byId = (page, id) => page.locator(`[id="${id}"]`);
const stored = (hg) => hg.readObject(ID).content;
const panel = (page) => page.locator('.glue-font-popover');
const fontBtn = (page) => page.getByTitle(/font: face, size and style/);

async function startEditing(page, id) {
	await byId(page, id).click();
	await byId(page, id).click();
	await expect.poll(() => page.evaluate((i) =>
		document.querySelector(`[id="${i}"] > .glue-text-render`).isContentEditable, id)).toBe(true);
}

// the panel is the WYSIWYG surface's toolbar: it is opened from the menu the
// way every panel is, and it follows the object through editing
async function openPanel(page, id) {
	await startEditing(page, id);
	await expect(fontBtn(page)).toBeVisible();
	await page.waitForTimeout(400);		// the menu fades in
	await fontBtn(page).click();
	await expect(panel(page)).toBeVisible();
}

// Put the selection over a substring of the rendered text, the way dragging
// across it would.
async function select(page, id, needle, collapse) {
	const ok = await page.evaluate(([i, n, c]) => {
		const render = document.querySelector(`[id="${i}"] > .glue-text-render`);
		const walker = document.createTreeWalker(render, NodeFilter.SHOW_TEXT);
		let node;
		while ((node = walker.nextNode())) {
			const at = node.data.indexOf(n);
			if (at === -1) continue;
			const r = document.createRange();
			r.setStart(node, at);
			r.setEnd(node, c ? at : at + n.length);
			const s = window.getSelection();
			s.removeAllRanges();
			s.addRange(r);
			return true;
		}
		return false;
	}, [id, needle, !!collapse]);
	expect(ok, `could not find ${JSON.stringify(needle)} in the rendered text`).toBe(true);
}

async function finish(page, id) {
	await page.evaluate((i) => window.$.glue.text.stop_editing(document.getElementById(i)), id);
}

// what is actually being typed into
const surface = (page, id) => page.locator(`[id="${id}"] > .glue-text-render`);
// the four acts, named by their short tooltips (the panel acts on either
// target, so "bold the selected text" would lie half the time)
const fmtBtn = (page, kind) => panel(page).locator(`.glue-popover-icon[title="${kind}"]`);
// the fold's first field is the exact size
const sizeField = (page) => panel(page)
	.locator('.glue-popover-advanced .glue-popover-field').first();
const alignRow = (page) => panel(page).locator('.glue-popover-row')
	.filter({ has: page.locator('.glue-align-btn') });
const resetRow = (page) => panel(page).locator('.glue-popover-row')
	.filter({ has: page.locator('.glue-popover-reset') });
const linkRow = (page) => page.locator('.glue-text-strip-link');

async function openFold(page) {
	await panel(page).locator('.glue-popover-disclosure').click();
	await expect(panel(page).locator('.glue-popover-advanced')).toBeVisible();
}

// the roller (2026-09-21): the button opens it, wheel spins it to the
// needle's row, the settle applies it to the current target (click-to-pick
// is gone; selection = whatever lands in the centre, and the roller stays
// open)
async function pickFace(page, needle) {
	await panel(page).locator('.glue-font-face-btn').click();
	const reel = page.locator('.glue-font-face-list');
	await expect(reel).toHaveClass(/glue-font-face-open/);
	const idx = await reel.evaluate((list, n) => {
		const rows = list.querySelectorAll('.glue-font-face-opt');
		for (let i = 0; i < rows.length; i++) {
			if (rows[i].textContent.includes(n)) return i;
		}
		return -1;
	}, needle);
	expect(idx, `no face row contains ${JSON.stringify(needle)}`).toBeGreaterThan(-1);
	const box = await reel.boundingBox();
	await page.mouse.move(box.x + box.width/2, box.y + box.height/2);
	for (let i = 0; i < 60; i++) {
		const d = await reel.evaluate((list, j) => {
			const r = list.querySelectorAll('.glue-font-face-opt')[j];
			const lc = list.getBoundingClientRect();
			const rc = r.getBoundingClientRect();
			return (rc.top + rc.height/2) - (lc.top + list.clientHeight/2);
		}, idx);
		if (Math.abs(d) <= 1) break;
		await page.mouse.wheel(0, d);
		await page.waitForTimeout(80);	// snap + settle
	}
	const value = await reel.locator('.glue-font-face-opt').nth(idx)
		.getAttribute('data-value');
	await expect.poll(() => reel.locator('.glue-font-face-on')
		.getAttribute('data-value')).toBe(value);
}

async function add(page, hg, content, attrs) {
	const a = hg.addObject(ID, attrs || ATTRS, content);
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	return a;
}

test('the panel is the editing surface\'s toolbar, and Escape closes it',
	async ({ page, hg }) => {
	const a = await add(page, hg, 'hello world');
	await openPanel(page, a);

	// the four acts, the colour, the sizes, the alignments, the face and
	// the link row - with nothing selected, the link is the one that grays
	for (const kind of ['bold', 'italic', 'underline', 'strikethrough']) {
		await expect(fmtBtn(page, kind)).toHaveCount(1);
	}
	await expect(panel(page).locator('.glue-font-size-s')).toBeVisible();
	await expect(panel(page).locator('.glue-align-btn')).toHaveCount(4);
	await expect(panel(page).locator('.glue-font-face-btn')).toBeVisible();
	await expect(linkRow(page)).toBeVisible();
	await expect(linkRow(page)).toHaveClass(/glue-popover-disabled/);
	await expect(alignRow(page)).not.toHaveClass(/glue-popover-disabled/);

	// Escape closes the panel and ends the editing - the old strip's
	// contract, kept
	await page.keyboard.press('Escape');
	await expect(panel(page)).toBeHidden();
	await expect.poll(() => page.evaluate((i) =>
		document.getElementById(i).classList.contains('glue-text-editing'), a)).toBe(false);
	// a no-op edit stays byte-stable
	await expect.poll(() => stored(hg)).toBe('hello world');
});

test('clicking empty canvas ends editing and closes the panel', async ({ page, hg }) => {
	const a = await add(page, hg, 'hello world');
	await openPanel(page, a);
	await expect(panel(page)).toBeVisible();

	await page.mouse.click(30, 30);		// empty canvas: deselects, stops editing
	await expect.poll(() => page.evaluate((i) =>
		document.getElementById(i).classList.contains('glue-text-editing'), a)).toBe(false);
	await expect(panel(page)).toBeHidden();
});

test('source mode never shows the panel', async ({ page, hg }) => {
	// entering editing in source mode: the textarea, never the panel
	const a = await add(page, hg, 'hello world');
	await byId(page, a).click();
	await page.getByTitle(/editing its HTML source/).click();
	await byId(page, a).click();
	await expect(page.locator(`[id="${a}"] > .glue-text-input`)).toBeFocused();
	await expect(panel(page)).toBeHidden();

	// back out, source mode off, and into WYSIWYG: the panel opens on it
	await page.keyboard.press('Escape');		// exit source editing
	await page.getByTitle(/editing its HTML source/).click();	// back to WYSIWYG
	await openPanel(page, a);

	// switching to source mid-edit hides the panel again
	await page.getByTitle(/editing its HTML source/).click();
	await expect(panel(page)).toBeHidden();
});

test('select-then-bold stores a b tag in the content', async ({ page, hg }) => {
	const a = await add(page, hg, 'hello world');
	await openPanel(page, a);
	await select(page, a, 'world');
	await fmtBtn(page, 'bold').click();
	await finish(page, a);
	await expect.poll(() => stored(hg)).toBe('hello <b>world</b>');
});

test('toggle-off unwraps', async ({ page, hg }) => {
	const a = await add(page, hg, 'hello <b>world</b>');
	await openPanel(page, a);
	await select(page, a, 'world');
	// the run inside the tag lights the toggle (state readback)
	await expect(fmtBtn(page, 'bold')).toHaveClass(/glue-btn-active/);
	await fmtBtn(page, 'bold').click();
	await finish(page, a);
	await expect.poll(() => stored(hg)).toBe('hello world');
});

test('italic, underline and strike combine, innermost last', async ({ page, hg }) => {
	const a = await add(page, hg, 'hello world');
	await openPanel(page, a);
	await select(page, a, 'world');
	await fmtBtn(page, 'italic').click();
	await fmtBtn(page, 'underline').click();
	await fmtBtn(page, 'strikethrough').click();
	await finish(page, a);
	await expect.poll(() => stored(hg)).toBe('hello <i><u><s>world</s></u></i>');
});

test('the size field writes a span, one span per run not per digit', async ({ page, hg }) => {
	const a = await add(page, hg, 'hello world');
	await openPanel(page, a);
	await select(page, a, 'world');
	await openFold(page);
	await sizeField(page).click();		// real click: pointerdown snapshots the selection
	await sizeField(page).fill('24');
	await sizeField(page).dispatchEvent('input');
	await sizeField(page).dispatchEvent('change');	// commit, caret back to the run
	await page.keyboard.press('Escape');
	// CSSOM-serialized style attribute: space after the colon, trailing
	// semicolon - the canonical form both engines write
	await expect.poll(() => stored(hg))
		.toBe('hello <span style="font-size: 24px;">world</span>');
});

test('the face roller writes a font-family span', async ({ page, hg }) => {
	const a = await add(page, hg, 'hello world');
	await openPanel(page, a);
	await select(page, a, 'world');
	// the row's label is the family string cut to 24 characters
	// (2026-09-18), and the value is the full name the span stores
	await pickFace(page, 'Courier New');
	// the roller stays open after the settle - spinning on is the point
	await expect(panel(page).locator('.glue-font-face-list'))
		.toHaveClass(/glue-font-face-open/);
	await finish(page, a);
	await expect.poll(() => stored(hg))
		.toBe('hello <span style="font-family: &quot;Courier New&quot;, Courier, monospace;">world</span>');
});

test('a face picked after a size joins the same span', async ({ page, hg }) => {
	const a = await add(page, hg, 'hello world');
	await openPanel(page, a);
	await select(page, a, 'world');
	await openFold(page);
	await sizeField(page).click();
	await sizeField(page).fill('24');
	await sizeField(page).dispatchEvent('input');
	await sizeField(page).dispatchEvent('change');
	await pickFace(page, 'Courier New');
	await finish(page, a);
	await expect.poll(() => stored(hg)).toBe('hello <span style="font-size: 24px; ' +
		'font-family: &quot;Courier New&quot;, Courier, monospace;">world</span>');
});

test('the default row is the inherited font, and unwraps a run-level face',
	async ({ page, hg }) => {
	const a = await add(page, hg, 'hello <span style="font-family: \'Courier New\', Courier, monospace;">world</span>');
	await openPanel(page, a);
	await select(page, a, 'world');
	// the row is named by what the run inherits (the page's font), not
	// by the word "default" - it is in the DOM whether the roller is open
	await expect(page.locator('.glue-font-face-opt[data-value=""]'))
		.toContainText('Verdana');
	await pickFace(page, 'default');
	await finish(page, a);
	await expect.poll(() => stored(hg)).toBe('hello world');
});

test('the color button wraps the selection in a color span', async ({ page, hg }) => {
	const a = await add(page, hg, 'hello world');
	await openPanel(page, a);
	await select(page, a, 'world');
	await page.getByTitle('text colour').click();
	await expect(page.locator('.picker_wrapper')).toBeVisible();
	const field = page.locator('.picker_editor input');
	await field.fill('#ff0000');
	await field.dispatchEvent('input');		// drives the picker's change, applies live
	await field.press('Enter');			// vanilla-picker's own "done"
	await expect(page.locator('.picker_wrapper')).toBeHidden();
	await finish(page, a);
	await expect.poll(() => stored(hg))
		.toBe('hello <span style="color: rgb(255, 0, 0);">world</span>');
});

test('a color picked after a size joins the same span', async ({ page, hg }) => {
	const a = await add(page, hg, 'hello world');
	await openPanel(page, a);
	await select(page, a, 'world');
	await openFold(page);
	await sizeField(page).click();
	await sizeField(page).fill('24');
	await sizeField(page).dispatchEvent('input');
	await sizeField(page).dispatchEvent('change');
	await page.getByTitle('text colour').click();
	const field = page.locator('.picker_editor input');
	await field.fill('#ff0000');
	await field.dispatchEvent('input');
	await field.press('Enter');
	await expect(page.locator('.picker_wrapper')).toBeHidden();
	await finish(page, a);
	await expect.poll(() => stored(hg)).toBe('hello <span style="font-size: 24px; ' +
		'color: rgb(255, 0, 0);">world</span>');
});

test('a caret makes the controls act on the whole object', async ({ page, hg }) => {
	// nothing selected is the OBJECT's target: the same bold click that
	// wraps a run writes the object's attribute when a caret is all there
	// is - and the content is not touched
	const a = await add(page, hg, 'hello world');
	await openPanel(page, a);
	await surface(page, a).click();
	await page.keyboard.press('End');
	await fmtBtn(page, 'bold').click();
	await expect(fmtBtn(page, 'bold')).toHaveClass(/glue-btn-active/);
	await expect.poll(() => hg.readObject(ID).attrs['text-font-weight']).toBe('bold');
	await finish(page, a);
	await expect.poll(() => stored(hg)).toBe('hello world');
});

test('the bold toggle lights for a bold object, and not for its runs',
	async ({ page, hg }) => {
	// the two targets read two different places: the object's computed
	// style, or the run's explicit tags only (the walk stops at the render
	// div, so the object-level weight lives outside it)
	const a = await add(page, hg, 'hello world', { ...ATTRS, 'text-font-weight': 'bold' });
	await openPanel(page, a);
	// a caret: the object's own weight lights the toggle
	await expect(fmtBtn(page, 'bold')).toHaveClass(/glue-btn-active/);
	// a run inside it: nothing explicit on the run, so the toggle is dark
	await select(page, a, 'world');
	await expect(fmtBtn(page, 'bold')).not.toHaveClass(/glue-btn-active/);
});

test('with a run selected, the object-only rows gray out', async ({ page, hg }) => {
	// align and reset cannot retarget: text-align is a block property and
	// a reset clears the object's attributes - they gray, and the link row
	// (the run's own) comes alive
	const a = await add(page, hg, 'hello world');
	await openPanel(page, a);
	await select(page, a, 'world');
	await expect(alignRow(page)).toHaveClass(/glue-popover-disabled/);
	await expect(resetRow(page)).toHaveClass(/glue-popover-disabled/);
	await expect(linkRow(page)).not.toHaveClass(/glue-popover-disabled/);
	for (const kind of ['bold', 'italic', 'underline', 'strikethrough']) {
		await expect(fmtBtn(page, kind)).not.toHaveClass(/glue-popover-disabled/);
	}
});

test('letter spacing wraps the selected run', async ({ page, hg }) => {
	// the spacings retarget too: a run gets its em on a span, the object
	// gets it in its style (text-spacing-popover.spec.js owns the object
	// half of this row)
	const a = await add(page, hg, 'hello world');
	await openPanel(page, a);
	await select(page, a, 'world');
	await openFold(page);
	const letterField = panel(page).locator('.glue-popover-advanced .glue-popover-field').nth(2);
	await letterField.click();
	await letterField.fill('0.5');
	await letterField.dispatchEvent('input');
	await letterField.dispatchEvent('change');
	await page.keyboard.press('Escape');
	await expect.poll(() => stored(hg))
		.toBe('hello <span style="letter-spacing: 0.5em;">world</span>');
});

test('the shadow wraps the selected run', async ({ page, hg }) => {
	// the run's span carries the COMPOSED text-shadow (the object composes
	// its own in css/main.css); the bytes are the authored color-mix form
	const a = await add(page, hg, 'hello world');
	await openPanel(page, a);
	await select(page, a, 'world');
	await openFold(page);
	const shadowField = panel(page).locator('.glue-popover-advanced .glue-popover-field').nth(4);
	await shadowField.click();
	await shadowField.fill('6');
	await shadowField.dispatchEvent('input');
	await shadowField.dispatchEvent('change');
	await page.keyboard.press('Escape');
	// the span stores the composed value, in the engine's own
	// serialization: the colour first, #000000 or rgb(0, 0, 0), and the
	// offsets zero-padded
	await expect.poll(() => stored(hg)).toMatch(
		/text-shadow: color-mix\(in srgb, (?:#000000|rgb\(0, 0, 0\)) 80%, transparent\) 0px 0px 6px;/);
	// and the render draws it
	expect(await page.evaluate((i) => getComputedStyle(
		document.querySelector(`[id="${i}"] .glue-text-render span`)).textShadow, a))
		.toContain('6px');
});

test('a face applied over differently-faced words takes them both',
	async ({ page, hg }) => {
	// the wrapper alone cannot beat the words' own spans - their faces
	// would win inside it and the pick would change nothing. The apply
	// clears the face on the spans it wraps; their other styles stay.
	const a = await add(page, hg,
		'hello <span style="font-family: \'Courier New\', Courier, monospace;">big</span> ' +
		'<span style="font-family: Georgia, serif; font-size: 24px;">world</span>');
	await openPanel(page, a);
	// select across both words: the helper finds one text node, so the
	// range is built by hand from the first styled word to the last
	await page.evaluate((i) => {
		const render = document.querySelector(`[id="${i}"] > .glue-text-render`);
		const walker = document.createTreeWalker(render, NodeFilter.SHOW_TEXT);
		const nodes = [];
		let n;
		while ((n = walker.nextNode())) nodes.push(n);
		const r = document.createRange();
		r.setStart(nodes[1], 0);			// 'big'
		r.setEnd(nodes[3], nodes[3].data.length);	// 'world'
		const s = window.getSelection();
		s.removeAllRanges();
		s.addRange(r);
	}, a);
	await pickFace(page, 'Courier New');
	await finish(page, a);
	// the wrapper wears the new face; the size on the second word's span
	// stays, and the two old faces are gone
	await expect.poll(() => stored(hg)).toBe(
		'hello <span style="font-family: &quot;Courier New&quot;, Courier, monospace;">big ' +
		'<span style="font-size: 24px;">world</span></span>');
});

test('formatting survives reload and renders on the published page', async ({ page, hg }) => {
	const a = await add(page, hg, 'hello <b>world</b>');
	await openPanel(page, a);
	await select(page, a, 'world');
	await expect(fmtBtn(page, 'bold')).toHaveClass(/glue-btn-active/);
	await finish(page, a);

	await page.goto(`/?${hg.pageName}`);
	const b = page.locator('.object b');
	await expect(b).toHaveText('world');
	expect(await page.evaluate(() => getComputedStyle(
		document.querySelector('.object b')).fontWeight)).toBe('700');
});

test('run formatting leaves object-level font attributes alone', async ({ page, hg }) => {
	const attrs = { ...ATTRS, 'text-font-size': '37px' };
	const a = hg.addObject(ID, attrs, 'hello world');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await openPanel(page, a);
	await select(page, a, 'world');
	await fmtBtn(page, 'bold').click();
	await finish(page, a);
	await expect.poll(() => stored(hg)).toBe('hello <b>world</b>');
	expect(hg.readObject(ID).attrs['text-font-size']).toBe('37px');
});

test('the panel sits beside/below the object, not over it', async ({ page, hg }) => {
	const a = await add(page, hg, 'hello world');
	await openPanel(page, a);

	const s = await panel(page).boundingBox();
	const o = await byId(page, a).boundingBox();
	const overlaps = s.x < o.x + o.width && o.x < s.x + s.width &&
		s.y < o.y + o.height && o.y < s.y + s.height;
	expect(overlaps, 'the panel is sitting on top of the text being edited').toBe(false);
});
