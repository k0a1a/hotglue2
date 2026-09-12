// "Make link" for a selection inside a text object - SOW-text-link-ui.md.
//
// Text objects are edited WYSIWYG: the rendered div is contenteditable, so a
// link shows as underlined text rather than as its markup. The source form is
// still what gets stored, and is only materialised when editing ends - so these
// assert on the stored content after leaving edit mode, which exercises the
// whole chain rather than an intermediate.
//
// The source-mode toggle (</> in the text menu) puts the textarea back for
// editing literal markup; the last test covers that path, which splices tags as
// strings instead of manipulating the DOM.

const { test, expect, waitForEditor } = require('./fixtures/hotglue.js');

const ATTRS = {
	type: 'text', module: 'text',
	'object-left': '200px', 'object-top': '200px',
	'object-width': '300px', 'object-height': '120px', 'object-zindex': '100',
	'text-background-color': 'transparent',
};

const byId = (page, id) => page.locator(`[id="${id}"]`);
const stored = (hg) => hg.readObject('100000000001').content;

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

const openDialog = (page) => page.getByTitle(/turn the selected text into a link/).click();
const urlField = (page) => page.locator('.glue-link-field').first();
const classField = (page) => page.locator('.glue-link-field').nth(1);
const okButton = (page) => page.locator('.glue-link-buttons button:has-text("OK")');

async function finish(page, id) {
	await page.evaluate((i) => window.$.glue.text.stop_editing(document.getElementById(i)), id);
}

test('wrapping a selection produces an anchor in the stored source', async ({ page, hg }) => {
	const a = hg.addObject('100000000001', ATTRS, 'hello world');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await startEditing(page, a);
	await select(page, a, 'world');
	await openDialog(page);

	await urlField(page).fill('https://example.org/a?b=1&c=2');
	await okButton(page).click();
	await finish(page, a);

	await expect.poll(() => stored(hg))
		.toBe('hello <a href="https://example.org/a?b=1&amp;c=2">world</a>');
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

test('a bare domain gets https, an anchor and a page name do not', async ({ page, hg }) => {
	for (const [typed, expected] of [
		['example.org/page', 'https://example.org/page'],
		['#section', '#section'],
		['mypage', 'mypage'],
	]) {
		const a = hg.addObject('100000000001', ATTRS, 'hello world');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await startEditing(page, a);
		await select(page, a, 'world');
		await openDialog(page);
		await urlField(page).fill(typed);
		await okButton(page).click();
		await finish(page, a);
		await expect.poll(() => stored(hg)).toContain(`href="${expected}"`);
	}
});

test('javascript: and data: urls are refused', async ({ page, hg }) => {
	const a = hg.addObject('100000000001', ATTRS, 'hello world');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await startEditing(page, a);
	await select(page, a, 'world');
	await openDialog(page);

	for (const bad of ['javascript:alert(1)', 'data:text/html,<script>1</script>']) {
		await urlField(page).fill(bad);
		await expect(page.locator('.glue-popover-problem')).toContainText('not allowed');
		await expect(okButton(page)).toBeDisabled();
	}
	await urlField(page).fill('');
	await expect(okButton(page)).toBeDisabled();
});

test('a url containing quotes cannot break out of the href', async ({ page, hg }) => {
	const a = hg.addObject('100000000001', ATTRS, 'hello world');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await startEditing(page, a);
	await select(page, a, 'world');
	await openDialog(page);

	await urlField(page).fill('https://example.org/" onmouseover="alert(1)');
	await okButton(page).click();
	await finish(page, a);

	const src = await stored(hg);
	expect(src, 'the url broke out of the attribute').not.toMatch(/"\s+onmouseover=/);
	expect(await page.evaluate((i) =>
		document.querySelector(`[id="${i}"] a`).getAttribute('onmouseover'), a)).toBeNull();
});

test('an existing link is pre-filled, editable and removable', async ({ page, hg }) => {
	const a = hg.addObject('100000000001', ATTRS, 'see <a href="https://old.example/">this</a> now');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await startEditing(page, a);
	await select(page, a, 'this', true);			// cursor inside the link
	await openDialog(page);
	await expect(urlField(page)).toHaveValue('https://old.example/');

	await urlField(page).fill('https://new.example/');
	await okButton(page).click();
	await finish(page, a);
	await expect.poll(() => stored(hg)).toBe('see <a href="https://new.example/">this</a> now');

	// and now remove it
	await startEditing(page, a);
	await select(page, a, 'this', true);
	await openDialog(page);
	await page.locator('.glue-link-buttons button:has-text("Remove link")').click();
	await finish(page, a);
	await expect.poll(() => stored(hg)).toBe('see this now');
});

test('a class can be put on the link, behind the add-class button', async ({ page, hg }) => {
	const a = hg.addObject('100000000001', ATTRS, 'hello world');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await startEditing(page, a);
	await select(page, a, 'world');
	await openDialog(page);
	// the class input stays hidden until asked for
	await expect(classField(page)).toBeHidden();
	await urlField(page).fill('https://example.org/');
	await page.locator('.glue-link-add-class').click();
	await expect(classField(page)).toBeVisible();
	await classField(page).fill('cta');
	await okButton(page).click();
	await finish(page, a);
	await expect.poll(() => stored(hg))
		.toBe('hello <a href="https://example.org/" class="cta">world</a>');
});

test('an existing link with a class opens with the class input shown',
	async ({ page, hg }) => {
		const a = hg.addObject('100000000001', ATTRS,
			'see <a href="https://example.org/" class="cta">this</a> now');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await startEditing(page, a);
		await select(page, a, 'this', true);
		await openDialog(page);
		await expect(classField(page)).toBeVisible();
		await expect(classField(page)).toHaveValue('cta');
		await expect(page.locator('.glue-link-add-class')).toBeHidden();
	});

test('the link renders on the published page', async ({ page, hg }) => {
	const a = hg.addObject('100000000001', ATTRS, 'hello world');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await startEditing(page, a);
	await select(page, a, 'world');
	await openDialog(page);
	await urlField(page).fill('https://example.org/');
	await okButton(page).click();
	await finish(page, a);
	await expect.poll(() => stored(hg)).toContain('example.org');

	await page.goto(`/?${hg.pageName}`);
	const link = page.locator('.object a');
	await expect(link).toHaveAttribute('href', 'https://example.org/');
	await expect(link).toHaveText('world');
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

// --- the strip row, rather than the popover it used to be -----------------
//
// The link entry is part of the run-formatting strip now: the strip's link
// button reveals a url/class row UNDER the size slider, docked with the
// strip to the object's bottom edge. Same contract as the old popover:
// Enter commits, Escape closes without linking, and the editor's canvas
// shortcuts leave a focused field alone.

test('the link row docks into the strip, under the size slider', async ({ page, hg }) => {
	const a = hg.addObject('100000000001', ATTRS, 'hello world');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await startEditing(page, a);
	await select(page, a, 'world');
	await openDialog(page);

	const row = page.locator('.glue-text-strip-link');
	await expect(row).toBeVisible();
	// the row sits below the size slider, inside the strip
	const slider = await page.locator('.glue-text-size-slider').boundingBox();
	const r = await row.boundingBox();
	expect(r.y, 'the link row is not under the size slider').toBeGreaterThan(slider.y);
	// and no backdrop over the page
	expect(await page.locator('.glue-modal-backdrop').count()).toBe(0);
});

test('Escape closes it without linking anything', async ({ page, hg }) => {
	const a = hg.addObject('100000000001', ATTRS, 'hello world');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await startEditing(page, a);
	await select(page, a, 'world');
	await openDialog(page);

	await urlField(page).fill('https://example.org');
	await page.keyboard.press('Escape');
	await expect(page.locator('.glue-text-strip-link')).toBeHidden();
	await finish(page, a);
	await expect.poll(() => hg.readObject('100000000001').content)
		.not.toContain('<a');
});

test('Enter in the url field is the same as OK', async ({ page, hg }) => {
	const a = hg.addObject('100000000001', ATTRS, 'hello world');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await startEditing(page, a);
	await select(page, a, 'world');
	await openDialog(page);

	await urlField(page).fill('https://example.org');
	await urlField(page).press('Enter');
	await expect(page.locator('.glue-text-strip-link')).toBeHidden();
	await finish(page, a);
	await expect.poll(() => hg.readObject('100000000001').content)
		.toContain('href="https://example.org"');
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
	await startEditing(page, a);
	await select(page, a, 'world');
	await openDialog(page);

	await urlField(page).fill('https://example.org/a');
	await urlField(page).press('Control+a');
	await urlField(page).press('Delete');
	await urlField(page).press('ArrowLeft');

	// still open, still one object, still selected
	await expect(page.locator('.glue-text-strip-link')).toBeVisible();
	await expect(byId(page, a)).toHaveCount(1);
	await expect(urlField(page)).toHaveValue('');
});
