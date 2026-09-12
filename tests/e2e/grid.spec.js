// The grid panel: the page menu's grid button opens a panel with a
// show/remove toggle and x/y size sliders that are interlocked until
// unlocked. The size is remembered per page (page-grid-x/y on the page
// pseudo-object), the default is 100x100, and the grid is drawn as
// dotted lines.

const { test, expect, waitForEditor } = require('./fixtures/hotglue.js');

const ATTRS = {
	type: 'text', module: 'text',
	'object-left': '100px', 'object-top': '100px',
	'object-width': '250px', 'object-height': '120px', 'object-zindex': '100',
	'text-background-color': '#ffdd55',
};

const pop = (page) => page.locator('.glue-grid-popover');
const gridOf = (page) => page.evaluate(() => [window.$.glue.grid.x(), window.$.glue.grid.y()]);
const pageAttrs = (hg) => hg.readObject('page').attrs;

async function openPanel(page) {
	await page.keyboard.press('Alt+P');
	await expect(page.getByTitle(/grid \(/)).toBeVisible();
	await page.getByTitle(/grid \(/).click();
	await expect(pop(page)).toBeVisible();
}

// type a value into a row's field and commit it (change is the commit)
async function fillRow(page, row, v) {
	await row.locator('.glue-popover-field').fill(String(v));
	await row.locator('.glue-popover-field').dispatchEvent('change');
}

test('a page without stored size gets the 100x100 default', async ({ page, hg }) => {
	hg.addObject('100000000001', ATTRS, 'A');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	expect(await gridOf(page)).toEqual([100, 100]);
});

test('the stored per-page size is picked up', async ({ page, hg }) => {
	hg.addObject('100000000001', ATTRS, 'A');
	hg.addObject('page', { 'page-grid-x': '140', 'page-grid-y': '90' });
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	expect(await gridOf(page)).toEqual([140, 90]);
});

test('the panel stores the size on the page, x and y interlocked', async ({ page, hg }) => {
	hg.addObject('100000000001', ATTRS, 'A');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);

	await openPanel(page);
	// rows: show grid, interlocked, then x and y
	const rows = pop(page).locator('.glue-popover-row');
	await fillRow(page, rows.nth(2), 120);
	// locked: y followed x
	expect(await gridOf(page)).toEqual([120, 120]);
	await expect.poll(() => pageAttrs(hg)['page-grid-x']).toBe('120');
	await expect.poll(() => pageAttrs(hg)['page-grid-y']).toBe('120');

	// and the size survives a reload through the stored page attrs
	await page.reload();
	await waitForEditor(page, 1);
	expect(await gridOf(page)).toEqual([120, 120]);
});

test('unlocking lets x and y be set separately', async ({ page, hg }) => {
	hg.addObject('100000000001', ATTRS, 'A');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);

	await openPanel(page);
	await pop(page).locator('.glue-grid-lock').click();
	await expect(pop(page).locator('.glue-grid-lock')).toHaveText('x≠y');

	const rows = pop(page).locator('.glue-popover-row');
	await fillRow(page, rows.nth(2), 120);
	await fillRow(page, rows.nth(3), 80);
	expect(await gridOf(page)).toEqual([120, 80]);
	await expect.poll(() => pageAttrs(hg)['page-grid-x']).toBe('120');
	await expect.poll(() => pageAttrs(hg)['page-grid-y']).toBe('80');

	// a page with different x and y opens unlocked
	await page.reload();
	await waitForEditor(page, 1);
	await openPanel(page);
	await expect(pop(page).locator('.glue-grid-lock')).toHaveText('x≠y');
});

test('the show toggle draws and removes the dotted grid', async ({ page, hg }) => {
	hg.addObject('100000000001', ATTRS, 'A');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	expect(await page.evaluate(() => document.querySelectorAll('.glue-grid').length)).toBe(0);

	await openPanel(page);
	await pop(page).locator('.glue-grid-show-toggle').click();
	await expect.poll(() => page.evaluate(() =>
		document.querySelectorAll('.glue-grid').length)).toBeGreaterThan(0);

	// the lines are dotted: a radial-gradient paints the dots
	expect(await page.evaluate(() =>
		getComputedStyle(document.querySelector('.glue-grid'))
			.backgroundImage.includes('radial-gradient'))).toBe(true);

	await pop(page).locator('.glue-grid-show-toggle').click();
	await expect.poll(() => page.evaluate(() =>
		document.querySelectorAll('.glue-grid').length)).toBe(0);
});
