// Semantic headings (SOW-accessibility.md, Feature 4): a text object can
// render as h1..h6, so screen readers get a structure to navigate by.
//
// The stored text-heading-level key maps to the wrapper's TAG: render sets
// the tag from the key, save maps the tag back to the key. reset.css
// neutralises the browser's heading defaults, so an h2 renders visually
// identical to a div and the author's text-* properties keep controlling
// appearance.

const { test, expect, waitForEditor } = require('./fixtures/hotglue.js');

const ATTRS = {
	type: 'text', module: 'text',
	'object-left': '120px', 'object-top': '80px',
	'object-width': '200px', 'object-height': '40px', 'object-zindex': '100',
	'text-background-color': 'transparent',
};

const byId = (page, id) => page.locator(`[id="${id}"]`);
const headingBtn = (page) => page.locator('#glue-contextmenu-text-heading');
const pop = (page) => page.locator('.glue-heading-popover');
const attrs = (hg) => hg.readObject('100000000001').attrs;

async function openPopover(page, id) {
	await byId(page, id).click();
	await expect(headingBtn(page)).toBeVisible();
	await page.waitForTimeout(400);		// the menu fades in
	await headingBtn(page).click();
	await expect(pop(page)).toBeVisible();
}

test('text-heading-level renders the wrapper as a heading', async ({ page, hg }) => {
	const id = hg.addObject('100000000001', { ...ATTRS, 'text-heading-level': 'h2' }, 'A chapter');
	await page.goto(`/?${hg.pageName}`);
	await expect(byId(page, id)).toHaveJSProperty('tagName', 'H2');
	await expect(byId(page, id)).toHaveClass(/text/);
	await expect(byId(page, id)).toContainText('A chapter');
});

test('an unmarked text object still renders as a div', async ({ page, hg }) => {
	const id = hg.addObject('100000000001', ATTRS, 'plain');
	await page.goto(`/?${hg.pageName}`);
	await expect(byId(page, id)).toHaveJSProperty('tagName', 'DIV');
});

test('a heading renders visually identical to a sibling div', async ({ page, hg }) => {
	const h = hg.addObject('100000000001', { ...ATTRS, 'text-heading-level': 'h2' }, 'heading');
	const d = hg.addObject('100000000002', ATTRS, 'plain');
	await page.goto(`/?${hg.pageName}`);
	const size = (id) => page.evaluate((i) =>
		getComputedStyle(document.getElementById(i)).fontSize, id);
	expect(await size(h), 'reset.css must neutralise the heading default').toBe(await size(d));
	expect(await byId(page, d)).toHaveJSProperty('tagName', 'DIV');
});

test('the popover swaps the tag and stores the level', async ({ page, hg }) => {
	const id = hg.addObject('100000000001', ATTRS, 'title');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);

	await openPopover(page, id);
	await pop(page).locator('.glue-heading-toggle', { hasText: 'H1' }).click();
	await expect.poll(() => attrs(hg)['text-heading-level']).toBe('h1');
	await expect(byId(page, id)).toHaveJSProperty('tagName', 'H1');

	await openPopover(page, id);
	await pop(page).locator('.glue-heading-toggle', { hasText: 'H2' }).click();
	await expect.poll(() => attrs(hg)['text-heading-level']).toBe('h2');
	await expect(byId(page, id)).toHaveJSProperty('tagName', 'H2');

	// back to a plain text object: the key must go away entirely
	await openPopover(page, id);
	await pop(page).locator('.glue-heading-toggle', { hasText: 'normal' }).click();
	await expect.poll(() => attrs(hg)['text-heading-level']).toBeUndefined();
	await expect(byId(page, id)).toHaveJSProperty('tagName', 'DIV');
});

test('the popover marks the object\'s current level', async ({ page, hg }) => {
	const id = hg.addObject('100000000001', { ...ATTRS, 'text-heading-level': 'h3' }, 'x');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await openPopover(page, id);
	await expect(pop(page).locator('.glue-heading-toggle.glue-font-toggle-on'))
		.toHaveText('H3');
});

test('the full h1-h6 ladder is offered, and the reset rides a row, pushed right',
	async ({ page, hg }) => {
		const id = hg.addObject('100000000001', ATTRS, 'title');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);

		// each rung: set_heading replaces the object node and closes the
		// popover, so it is reopened for the next one
		await openPopover(page, id);
		for (const l of ['H1', 'H2', 'H3', 'H4', 'H5', 'H6']) {
			await pop(page).locator('.glue-heading-toggle', { hasText: l }).click();
			await expect.poll(() => attrs(hg)['text-heading-level'])
				.toBe(l.toLowerCase());
			await expect(byId(page, id)).toHaveJSProperty('tagName', l);
			if (l !== 'H6') {
				await openPopover(page, id);
			}
		}

		// the reset does not span the panel: it is the small frame riding
		// its own row, pushed to the panel's right end
		await openPopover(page, id);
		const pb = await pop(page).boundingBox();
		const rb = await pop(page).locator('.glue-popover-reset').boundingBox();
		expect(rb.width).toBeLessThan(pb.width / 2);
		expect(rb.x + rb.width).toBeGreaterThan(pb.x + pb.width - 20);
	});
