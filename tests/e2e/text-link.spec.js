// Making text a link - the link row of the text panel.
//
// Text objects are edited WYSIWYG: the rendered div is contenteditable, so a
// link shows as underlined text rather than as its markup. The source form is
// still what gets stored, and is only materialised when editing ends - so these
// assert on the stored content after leaving edit mode, which exercises the
// whole chain rather than an intermediate.
//
// The panel's link row is a url field and one button, and it is the run's
// own: it grays out while nothing is selected, and comes alive when a run
// is. No link under the selection - the button says 'make link' and wraps
// the selected run; a link - it says 'remove link', the url pre-fills so
// Enter edits the href, and the button unwraps. Whatever non-empty string is
// typed becomes the href; no validation, no rewriting.
//
// The source-mode toggle (</> in the text menu) puts the textarea back for
// editing literal markup; the last test covers that path.

const { test, expect, waitForEditor } = require('./fixtures/hotglue.js');

const ATTRS = {
	type: 'text', module: 'text',
	'object-left': '200px', 'object-top': '200px',
	'object-width': '300px', 'object-height': '120px', 'object-zindex': '100',
	'text-background-color': 'transparent',
};

const byId = (page, id) => page.locator(`[id="${id}"]`);
const stored = (hg) => hg.readObject('100000000001').content;
const panel = (page) => page.locator('.glue-font-popover');
const fontBtn = (page) => page.getByTitle(/font: face, size and style/);
const linkRow = (page) => page.locator('.glue-text-strip-link');
const urlField = (page) => linkRow(page).locator('.glue-link-field').first();
const linkButton = (page) => linkRow(page).locator('button').first();

async function startEditing(page, id) {
	await byId(page, id).click();
	await byId(page, id).click();
	await expect.poll(() => page.evaluate((i) =>
		document.querySelector(`[id="${i}"] > .glue-text-render`).isContentEditable, id)).toBe(true);
}

// editing first, then the panel from the menu - it is the WYSIWYG
// surface's toolbar, and the link row lives in it
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

// type into a field the way a person does: the click's mousedown is what
// snapshots the live selection before focus collapses it
async function typeInto(loc, value) {
	await loc.click();
	await loc.fill(value);
}

async function finish(page, id) {
	await page.evaluate((i) => window.$.glue.text.stop_editing(document.getElementById(i)), id);
}

test('the link row is part of the panel, and grays until a run is selected',
	async ({ page, hg }) => {
	const a = hg.addObject('100000000001', ATTRS, 'hello world');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await openPanel(page, a);

	// no icon to press - the url field and its button are there from the
	// moment the panel opens; with nothing selected, the row is grayed
	await expect(linkRow(page)).toBeVisible();
	await expect(urlField(page)).toBeVisible();
	await expect(linkButton(page)).toHaveText('make link');
	await expect(linkRow(page)).toHaveClass(/glue-popover-disabled/);

	// a run selected inside the render brings it alive
	await select(page, a, 'world');
	await expect(linkRow(page)).not.toHaveClass(/glue-popover-disabled/);
	// and no backdrop over the page
	expect(await page.locator('.glue-modal-backdrop').count()).toBe(0);
});

test('Enter wraps a selection in an anchor', async ({ page, hg }) => {
	const a = hg.addObject('100000000001', ATTRS, 'hello world');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await openPanel(page, a);
	await select(page, a, 'world');

	await typeInto(urlField(page), 'https://example.org/a?b=1&c=2');
	await urlField(page).press('Enter');
	await finish(page, a);

	await expect.poll(() => stored(hg))
		.toBe('hello <a href="https://example.org/a?b=1&amp;c=2">world</a>');
});

test('the add-link button wraps a selection, and then offers remove',
	async ({ page, hg }) => {
		const a = hg.addObject('100000000001', ATTRS, 'hello world');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await openPanel(page, a);
		await select(page, a, 'world');

		await typeInto(urlField(page), 'https://example.org/');
		await linkButton(page).click();
		// the caret now sits inside the new link: the button flips to remove
		await expect(linkButton(page)).toHaveText('remove link');
		await finish(page, a);
		await expect.poll(() => stored(hg))
			.toBe('hello <a href="https://example.org/">world</a>');
	});

test('the markup is hidden while editing, and the link is underlined',
	async ({ page, hg }) => {
	// the whole point of WYSIWYG editing: no tags on screen, and the
	// link is underlined while editing so the author can see it - the
	// editor affordance (.text a in text-edit.css). Published pages keep
	// the historical a-reset: the author's own CSS decides there
	const a = hg.addObject('100000000001', ATTRS, 'see <a href="https://example.org/">this</a> now');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await startEditing(page, a);

	const shown = await page.evaluate((i) =>
		document.querySelector(`[id="${i}"] > .glue-text-render`).innerText, a);
	expect(shown, 'raw markup is visible while editing').not.toContain('<a href');
	expect(shown).toContain('this');
	expect(await page.evaluate((i) => getComputedStyle(
		document.querySelector(`[id="${i}"] a`)).textDecorationLine, a)).toContain('underline');
});

test('whatever string is typed becomes the href', async ({ page, hg }) => {
	for (const typed of ['https://example.org/a?b=1', '#section', 'mypage',
		'example.org/page', 'javascript:alert(1)']) {
		const a = hg.addObject('100000000001', ATTRS, 'hello world');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await openPanel(page, a);
		await select(page, a, 'world');
		await typeInto(urlField(page), typed);
		await urlField(page).press('Enter');
		await finish(page, a);
		await expect.poll(() => stored(hg)).toContain(`href="${typed}"`);
	}
});

test('a url containing quotes cannot break out of the href', async ({ page, hg }) => {
	const a = hg.addObject('100000000001', ATTRS, 'hello world');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await openPanel(page, a);
	await select(page, a, 'world');

	await typeInto(urlField(page), 'https://example.org/" onmouseover="alert(1)');
	await urlField(page).press('Enter');
	await finish(page, a);

	const src = await stored(hg);
	expect(src, 'the url broke out of the attribute').not.toMatch(/"\s+onmouseover=/);
	expect(await page.evaluate((i) =>
		document.querySelector(`[id="${i}"] a`).getAttribute('onmouseover'), a)).toBeNull();
});

test('a selection inside a link pre-fills the url and offers remove',
	async ({ page, hg }) => {
		const a = hg.addObject('100000000001', ATTRS,
			'see <a href="https://old.example/">this</a> now');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await openPanel(page, a);
		await select(page, a, 'this', true);		// cursor inside the link

		// the selectionchange sync pre-fills the field and flips the button
		await expect.poll(async () => urlField(page).inputValue()).toBe('https://old.example/');
		await expect(linkButton(page)).toHaveText('remove link');

		// editing the url flips the button to 'update link'
		await typeInto(urlField(page), 'https://new.example/');
		await expect(linkButton(page)).toHaveText('update link');
		await linkButton(page).click();
		await finish(page, a);
		await expect.poll(() => stored(hg)).toBe('see <a href="https://new.example/">this</a> now');

		// and the button takes it out again
		await openPanel(page, a);
		await select(page, a, 'this', true);
		await expect.poll(async () => urlField(page).inputValue()).toBe('https://new.example/');
		await linkButton(page).click();
		await finish(page, a);
		await expect.poll(() => stored(hg)).toBe('see this now');
	});

test('Escape empties the field without linking anything', async ({ page, hg }) => {
	const a = hg.addObject('100000000001', ATTRS, 'hello world');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await openPanel(page, a);
	await select(page, a, 'world');

	await typeInto(urlField(page), 'https://example.org');
	await urlField(page).press('Escape');
	await expect(urlField(page)).toHaveValue('');
	await finish(page, a);
	await expect.poll(() => hg.readObject('100000000001').content)
		.not.toContain('<a');
});

test('the link renders on the published page', async ({ page, hg }) => {
	const a = hg.addObject('100000000001', ATTRS, 'hello world');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await openPanel(page, a);
	await select(page, a, 'world');
	await typeInto(urlField(page), 'https://example.org/');
	await urlField(page).press('Enter');
	await finish(page, a);
	await expect.poll(() => stored(hg)).toContain('example.org');

	await page.goto(`/?${hg.pageName}`);
	const link = page.locator('.object a');
	await expect(link).toHaveAttribute('href', 'https://example.org/');
	await expect(link).toHaveText('world');
});

test('the canvas shortcuts leave a focused field alone', async ({ page, hg }) => {
	// Delete is handled on keyup on documentElement and deletes the selected
	// object; clearing the url field with it took the object with it. Same
	// for ctrl+a, which selected every object on the page, and the arrows,
	// which nudged them. The two text editing surfaces had solved this for
	// themselves by stopping propagation; the editor's own inputs had not.
	const a = hg.addObject('100000000001', ATTRS, 'hello world');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await openPanel(page, a);
	await select(page, a, 'world');

	await typeInto(urlField(page), 'https://example.org/a');
	await urlField(page).press('Control+a');
	await urlField(page).press('Delete');
	await urlField(page).press('ArrowLeft');

	// still one object, still selected, field cleared (and nothing linked)
	await expect(byId(page, a)).toHaveCount(1);
	await expect(urlField(page)).toHaveValue('');
});

test('source mode puts the textarea back, markup and all', async ({ page, hg }) => {
	const a = hg.addObject('100000000001', ATTRS, 'see <a href="https://example.org/">this</a> now');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await byId(page, a).click();
	await page.getByTitle(/editing its HTML source/).click();
	await byId(page, a).click();

	const ta = page.locator(`[id="${a}"] > .glue-text-input`);
	await expect(ta).toBeFocused();
	expect(await ta.inputValue(), 'source mode should show the literal markup')
		.toBe('see <a href="https://example.org/">this</a> now');
});
