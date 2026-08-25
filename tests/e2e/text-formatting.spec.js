// Run-level formatting: B/I/U/S and an arbitrary-px size for a SELECTED RUN of
// text, while the object is edited WYSIWYG. The strip (modules/text/text-edit.js)
// docks to the object's bottom edge and wraps the selection in semantic tags
// (<b>/<i>/<u>/<s>/<span style="font-size:Npx">) that the storage and render
// pipeline pass through byte-for-byte - so these assert on the STORED content
// after leaving edit mode, the way text-link.spec.js does.
//
// The size field acts on a snapshot taken on mousedown (programmatic focus
// collapses the selection first, so these tests click then type - never
// fill()). The face dropdown's pick needs no click: a pick can reach change
// without any mousedown (selectOption, the keyboard path), so the handler
// falls back to the last-known selection itself.
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

async function startEditing(page, id) {
	await byId(page, id).click();
	await byId(page, id).click();
	await expect.poll(() => page.evaluate((i) =>
		document.querySelector(`[id="${i}"] > .glue-text-render`).isContentEditable, id)).toBe(true);
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
const strip = (page) => page.locator('.glue-text-strip');
const fmtBtn = (page, kind) => page.locator(`.glue-text-strip .glue-btn-icon[title="${kind} the selected text"]`);
const sizeField = (page) => page.locator('.glue-text-strip .glue-text-size');

async function add(page, hg, content) {
	const a = hg.addObject(ID, ATTRS, content);
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	return a;
}

test('the strip appears while editing and hides on Escape', async ({ page, hg }) => {
	const a = await add(page, hg, 'hello world');
	await startEditing(page, a);

	await expect(strip(page)).toBeVisible();
	for (const kind of ['bold', 'italic', 'underline', 'strikethrough']) {
		await expect(fmtBtn(page, kind)).toHaveCount(1);
	}
	await expect(sizeField(page)).toBeVisible();
	await expect(page.locator('.glue-text-strip .glue-text-size-slider')).toBeVisible();
	// two rows: the size slider and its field on their own line, under the
	// toggles and face
	await expect.poll(() => page.evaluate(() => {
		const q = (s) => document.querySelector(s);
		const field = q('.glue-text-strip .glue-text-size');
		return field.parentElement ===
			q('.glue-text-strip .glue-text-size-slider').parentElement
			&& field.parentElement !==
			q('.glue-text-strip .glue-btn-icon[title="bold the selected text"]').parentElement;
	})).toBe(true);

	await page.keyboard.press('Escape');
	await expect.poll(() => page.evaluate((i) =>
		document.getElementById(i).classList.contains('glue-text-editing'), a)).toBe(false);
	await expect(strip(page)).toBeHidden();
	// a no-op edit stays byte-stable
	await expect.poll(() => stored(hg)).toBe('hello world');
});

test('clicking empty canvas ends editing and hides the strip', async ({ page, hg }) => {
	const a = await add(page, hg, 'hello world');
	await startEditing(page, a);
	await expect(strip(page)).toBeVisible();

	await page.mouse.click(30, 30);		// empty canvas: deselects, stops editing
	await expect.poll(() => page.evaluate((i) =>
		document.getElementById(i).classList.contains('glue-text-editing'), a)).toBe(false);
	await expect(strip(page)).toBeHidden();
});

test('source mode never shows the strip', async ({ page, hg }) => {
	// entering editing in source mode: the textarea, never the strip
	const a = await add(page, hg, 'hello world');
	await byId(page, a).click();
	await page.getByTitle(/editing its HTML source/).click();
	await byId(page, a).click();
	await expect(page.locator(`[id="${a}"] > .glue-text-input`)).toBeFocused();
	await expect(strip(page)).toBeHidden();

	// back out, source mode off, and into WYSIWYG: the strip docks to it
	await page.keyboard.press('Escape');		// exit source editing
	await page.getByTitle(/editing its HTML source/).click();	// back to WYSIWYG
	await byId(page, a).click();
	await byId(page, a).click();
	await expect.poll(() => page.evaluate((i) =>
		document.querySelector(`[id="${i}"] > .glue-text-render`).isContentEditable, a)).toBe(true);
	await expect(strip(page)).toBeVisible();

	// switching to source mid-edit hides the strip again
	await page.getByTitle(/editing its HTML source/).click();
	await expect(strip(page)).toBeHidden();
});

test('select-then-bold stores a b tag in the content', async ({ page, hg }) => {
	const a = await add(page, hg, 'hello world');
	await startEditing(page, a);
	await select(page, a, 'world');
	await fmtBtn(page, 'bold').click();
	await finish(page, a);
	await expect.poll(() => stored(hg)).toBe('hello <b>world</b>');
});

test('toggle-off unwraps', async ({ page, hg }) => {
	const a = await add(page, hg, 'hello <b>world</b>');
	await startEditing(page, a);
	await select(page, a, 'world');
	// the caret inside the run lights the toggle (state readback)
	await expect(fmtBtn(page, 'bold')).toHaveClass(/glue-btn-active/);
	await fmtBtn(page, 'bold').click();
	await finish(page, a);
	await expect.poll(() => stored(hg)).toBe('hello world');
});

test('italic, underline and strike combine, innermost last', async ({ page, hg }) => {
	const a = await add(page, hg, 'hello world');
	await startEditing(page, a);
	await select(page, a, 'world');
	await fmtBtn(page, 'italic').click();
	await fmtBtn(page, 'underline').click();
	await fmtBtn(page, 'strikethrough').click();
	await finish(page, a);
	await expect.poll(() => stored(hg)).toBe('hello <i><u><s>world</s></u></i>');
});

test('the size field writes a span, one span per run not per digit', async ({ page, hg }) => {
	const a = await add(page, hg, 'hello world');
	await startEditing(page, a);
	await select(page, a, 'world');
	await sizeField(page).click();		// real click: mousedown snapshots the selection
	await page.keyboard.type('24');
	await page.keyboard.press('Enter');	// change: commit, caret back to the run
	await page.keyboard.press('Escape');
	// CSSOM-serialized style attribute: space after the colon, trailing
	// semicolon - the canonical form both engines write
	await expect.poll(() => stored(hg))
		.toBe('hello <span style="font-size: 24px;">world</span>');
});

test('the face dropdown writes a font-family span', async ({ page, hg }) => {
	const a = await add(page, hg, 'hello world');
	await startEditing(page, a);
	await select(page, a, 'world');
	// the option's label is the face name without its CSS quotes; the stored
	// value is the family string from the .glue-font rule, quotes included
	await page.locator('.glue-text-face').selectOption({ label: 'Courier New, Courier, monospace' });
	await finish(page, a);
	await expect.poll(() => stored(hg))
		.toBe('hello <span style="font-family: &quot;Courier New&quot;, Courier, monospace;">world</span>');
});

test('a face picked after a size joins the same span', async ({ page, hg }) => {
	const a = await add(page, hg, 'hello world');
	await startEditing(page, a);
	await select(page, a, 'world');
	await sizeField(page).click();
	await page.keyboard.type('24');
	await page.keyboard.press('Enter');
	await page.locator('.glue-text-face').selectOption({ label: 'Courier New, Courier, monospace' });
	await finish(page, a);
	await expect.poll(() => stored(hg)).toBe('hello <span style="font-size: 24px; ' +
		'font-family: &quot;Courier New&quot;, Courier, monospace;">world</span>');
});

test('"default" unwraps a run-level face', async ({ page, hg }) => {
	const a = await add(page, hg, 'hello <span style="font-family: \'Courier New\', Courier, monospace;">world</span>');
	await startEditing(page, a);
	await select(page, a, 'world');
	await page.locator('.glue-text-face').selectOption({ label: 'default' });
	await finish(page, a);
	await expect.poll(() => stored(hg)).toBe('hello world');
});

test('the color button wraps the selection in a color span', async ({ page, hg }) => {
	const a = await add(page, hg, 'hello world');
	await startEditing(page, a);
	await select(page, a, 'world');
	await page.getByTitle('color of the selected text').click();
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

test('the size slider writes a span, the manual entry follows', async ({ page, hg }) => {
	const a = await add(page, hg, 'hello world');
	await startEditing(page, a);
	await select(page, a, 'world');
	const slider = page.locator('.glue-text-strip .glue-text-size-slider');
	await slider.click();				// mousedown snapshots the selection
	await slider.evaluate((el) => {
		el.value = '20';
		el.dispatchEvent(new Event('input', { bubbles: true }));
		el.dispatchEvent(new Event('change', { bubbles: true }));
	});
	await page.keyboard.press('Escape');
	await expect.poll(() => stored(hg))
		.toBe('hello <span style="font-size: 20px;">world</span>');
});

test('a color picked after a size joins the same span', async ({ page, hg }) => {
	const a = await add(page, hg, 'hello world');
	await startEditing(page, a);
	await select(page, a, 'world');
	await sizeField(page).click();
	await page.keyboard.type('24');
	await page.keyboard.press('Enter');
	await page.getByTitle('color of the selected text').click();
	const field = page.locator('.picker_editor input');
	await field.fill('#ff0000');
	await field.dispatchEvent('input');
	await field.press('Enter');
	await expect(page.locator('.picker_wrapper')).toBeHidden();
	await finish(page, a);
	await expect.poll(() => stored(hg)).toBe('hello <span style="font-size: 24px; ' +
		'color: rgb(255, 0, 0);">world</span>');
});

test('collapsed-caret bold: typed text is bold, no scaffold persists', async ({ page, hg }) => {
	const a = await add(page, hg, 'hello world');
	await startEditing(page, a);
	await surface(page, a).click();
	await page.keyboard.press('End');
	await fmtBtn(page, 'bold').click();
	await page.keyboard.type(' there');
	await page.keyboard.press('Escape');
	// the caret sits inside the scaffold, so the typed space is part of the
	// bold run - the run is " there", not just "there". Firefox's editor
	// stores a line-leading typed space as a non-breaking one, so normalize
	// that single difference; everything else is asserted byte-for-byte
	await expect.poll(() => stored(hg).replace(/\u00a0/g, ' '))
		.toBe('hello world<b> there</b>');
});

test('an abandoned scaffold does not persist', async ({ page, hg }) => {
	const a = await add(page, hg, 'hello world');
	await startEditing(page, a);
	await surface(page, a).click();
	await page.keyboard.press('End');
	await fmtBtn(page, 'bold').click();	// empty <b> with only the caret pad
	await page.keyboard.press('Escape');
	await expect.poll(() => stored(hg)).toBe('hello world');
});

test('formatting survives reload and renders on the published page', async ({ page, hg }) => {
	const a = await add(page, hg, 'hello <b>world</b>');
	await startEditing(page, a);
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
	await startEditing(page, a);
	await select(page, a, 'world');
	await fmtBtn(page, 'bold').click();
	await finish(page, a);
	await expect.poll(() => stored(hg)).toBe('hello <b>world</b>');
	expect(hg.readObject(ID).attrs['text-font-size']).toBe('37px');
});

test('a bold object does not light the strip toggle', async ({ page, hg }) => {
	const attrs = { ...ATTRS, 'text-font-weight': 'bold' };
	const a = hg.addObject(ID, attrs, 'hello world');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await startEditing(page, a);
	await select(page, a, 'world');
	// the sync reads explicit tags only, and stops at the render div - the
	// object-level weight lives outside it
	await expect(fmtBtn(page, 'bold')).not.toHaveClass(/glue-btn-active/);
});

test('the strip sits beside/below the object, not over it', async ({ page, hg }) => {
	const a = await add(page, hg, 'hello world');
	await startEditing(page, a);

	const s = await strip(page).boundingBox();
	const o = await byId(page, a).boundingBox();
	const overlaps = s.x < o.x + o.width && o.x < s.x + s.width &&
		s.y < o.y + o.height && o.y < s.y + s.height;
	expect(overlaps, 'the strip is sitting on top of the text being edited').toBe(false);
});
