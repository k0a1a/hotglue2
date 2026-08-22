// "Make link" for a selection inside a text object - SOW-text-link-ui.md.
//
// Text objects are edited as a TEXTAREA holding raw HTML source, NOT as
// contenteditable (js/edit.js:2370 says so outright). So execCommand and the
// Selection/Range API are not available here: making a link means splicing
// literal <a> tags into the textarea's value around the selected characters,
// and the URL has to be escaped as attribute SYNTAX on the way in.

const { test, expect, waitForEditor } = require('./fixtures/hotglue.js');

const textObject = (content) => ({
	attrs: {
		type: 'text', module: 'text',
		'object-left': '200px', 'object-top': '200px',
		'object-width': '300px', 'object-height': '120px', 'object-zindex': '100',
		'text-background-color': 'transparent',
	},
	content,
});

const byId = (page, id) => page.locator(`[id="${id}"]`);
const source = (page, id) => page.evaluate((i) =>
	document.querySelector(`[id="${i}"] > .glue-text-input`).value, id);

// Enter editing, select a character range in the source, open the link dialog.
async function openLink(page, id, from, to) {
	await byId(page, id).click();
	await byId(page, id).click();				// second click enters editing
	await expect(page.locator(`[id="${id}"] > .glue-text-input`)).toBeFocused();
	await page.evaluate(([i, f, t]) => {
		const ta = document.querySelector(`[id="${i}"] > .glue-text-input`);
		ta.setSelectionRange(f, t);
	}, [id, from, to]);
	await page.locator('.glue-contextmenu, .glue-ui').first().waitFor({ state: 'attached' });
	await page.getByTitle(/turn the selected text into a link/).click();
	await expect(page.locator('.glue-modal[role="dialog"]')).toBeVisible();
}

const urlField = (page) => page.locator('.glue-modal-field input').first();
const classField = (page) => page.locator('.glue-modal-field input').nth(1);
const okButton = (page) => page.locator('.glue-modal-buttons button:has-text("OK")');

test('wrapping a selection produces an escaped anchor', async ({ page, hg }) => {
	const o = textObject('hello world');
	const a = hg.addObject('100000000001', o.attrs, o.content);
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);

	await openLink(page, a, 6, 11);				// "world"
	await urlField(page).fill('https://example.org/a?b=1&c=2');
	await okButton(page).click();

	await expect.poll(() => source(page, a))
		.toBe('hello <a href="https://example.org/a?b=1&amp;c=2">world</a>');
});

test('a bare domain gets https, an anchor and a page name do not', async ({ page, hg }) => {
	for (const [typed, expected] of [
		['example.org/page', 'https://example.org/page'],
		['#section', '#section'],
		['mypage', 'mypage'],
	]) {
		const o = textObject('hello world');
		const a = hg.addObject('100000000001', o.attrs, o.content);
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await openLink(page, a, 6, 11);
		await urlField(page).fill(typed);
		await okButton(page).click();
		await expect.poll(() => source(page, a)).toContain(`href="${expected}"`);
	}
});

test('javascript: and data: urls are refused', async ({ page, hg }) => {
	const o = textObject('hello world');
	const a = hg.addObject('100000000001', o.attrs, o.content);
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await openLink(page, a, 6, 11);

	for (const bad of ['javascript:alert(1)', 'data:text/html,<script>1</script>']) {
		await urlField(page).fill(bad);
		await expect(page.locator('.glue-tag-problem')).toContainText('not allowed');
		await expect(okButton(page)).toBeDisabled();
	}
	// an empty url is refused too, rather than silently doing nothing
	await urlField(page).fill('');
	await expect(okButton(page)).toBeDisabled();
	// and nothing was written
	expect(await source(page, a)).toBe('hello world');
});

test('a url containing quotes cannot break out of the href', async ({ page, hg }) => {
	const o = textObject('hello world');
	const a = hg.addObject('100000000001', o.attrs, o.content);
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await openLink(page, a, 6, 11);

	await urlField(page).fill('https://example.org/" onmouseover="alert(1)');
	await okButton(page).click();

	const src = await source(page, a);
	expect(src).not.toMatch(/"\s+onmouseover/);
	expect(src).toContain('&quot;');
});

test('an existing link is pre-filled and can be edited', async ({ page, hg }) => {
	const o = textObject('see <a href="https://old.example/">this</a> now');
	const a = hg.addObject('100000000001', o.attrs, o.content);
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);

	// cursor inside the anchor's text, no selection
	await openLink(page, a, 40, 40);
	await expect(urlField(page)).toHaveValue('https://old.example/');

	await urlField(page).fill('https://new.example/');
	await okButton(page).click();
	await expect.poll(() => source(page, a))
		.toBe('see <a href="https://new.example/">this</a> now');
});

test('an existing link can be removed, keeping the text', async ({ page, hg }) => {
	const o = textObject('see <a href="https://old.example/">this</a> now');
	const a = hg.addObject('100000000001', o.attrs, o.content);
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);

	await openLink(page, a, 40, 40);
	await page.locator('.glue-modal-buttons button:has-text("Remove link")').click();
	await expect.poll(() => source(page, a)).toBe('see this now');
});

test('a class can be put on the link', async ({ page, hg }) => {
	const o = textObject('hello world');
	const a = hg.addObject('100000000001', o.attrs, o.content);
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);

	await openLink(page, a, 6, 11);
	await urlField(page).fill('https://example.org/');
	await classField(page).fill('cta');
	await okButton(page).click();
	await expect.poll(() => source(page, a))
		.toBe('hello <a href="https://example.org/" class="cta">world</a>');
});

test('the link survives the save and renders on the page', async ({ page, hg }) => {
	const o = textObject('hello world');
	const a = hg.addObject('100000000001', o.attrs, o.content);
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);

	await openLink(page, a, 6, 11);
	await urlField(page).fill('https://example.org/');
	await okButton(page).click();
	// leaving edit mode is what persists text content (glue.update_object)
	await page.keyboard.press('Escape');
	await expect.poll(() => hg.readObject('100000000001').content)
		.toContain('<a href="https://example.org/">world</a>');

	await page.goto(`/?${hg.pageName}`);			// viewing mode
	const link = page.locator('.object a');
	await expect(link).toHaveAttribute('href', 'https://example.org/');
	await expect(link).toHaveText('world');
});
