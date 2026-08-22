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
const urlField = (page) => page.locator('.glue-modal-field input').first();
const classField = (page) => page.locator('.glue-modal-field input').nth(1);
const okButton = (page) => page.locator('.glue-modal-buttons button:has-text("OK")');

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

test('the markup is hidden while editing, and the link is underlined', async ({ page, hg }) => {
	// the whole point of WYSIWYG editing: no tags on screen
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
		await expect(page.locator('.glue-tag-problem')).toContainText('not allowed');
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
	await page.locator('.glue-modal-buttons button:has-text("Remove link")').click();
	await finish(page, a);
	await expect.poll(() => stored(hg)).toBe('see this now');
});

test('a class can be put on the link', async ({ page, hg }) => {
	const a = hg.addObject('100000000001', ATTRS, 'hello world');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await startEditing(page, a);
	await select(page, a, 'world');
	await openDialog(page);
	await urlField(page).fill('https://example.org/');
	await classField(page).fill('cta');
	await okButton(page).click();
	await finish(page, a);
	await expect.poll(() => stored(hg))
		.toBe('hello <a href="https://example.org/" class="cta">world</a>');
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
