// Reading order (SOW-accessibility.md, Features 1 + 2): the DOM is emitted
// in the visual reading order - top-to-bottom, left-to-right within a row -
// instead of filesystem order, so screen readers follow the page the way a
// sighted reader does, and authors can override it per page with a stored
// page-reading-order list. The objects are absolutely positioned, so the
// visual layout is untouched by any of this.

const { test, expect, waitForEditor } = require('./fixtures/hotglue.js');

const ATTRS = (top, left) => ({
	type: 'text', module: 'text',
	'object-left': left + 'px', 'object-top': top + 'px',
	'object-width': '200px', 'object-height': '40px', 'object-zindex': '100',
	'text-background-color': 'transparent',
});

const byId = (page, id) => page.locator(`[id="${id}"]`);

// the DOM order of the page's objects, by suffix
const domOrder = (page) => page.evaluate(() =>
	Array.from(document.querySelectorAll('.object'))
		.map((el) => el.id.split('.').pop()));

test('objects are emitted top-to-bottom regardless of creation order',
	async ({ page, hg }) => {
		// seeded in creation/scandir order that contradicts the layout:
		// bottom first, middle second, top last
		hg.addObject('100000000001', ATTRS(300, 100), 'bottom');
		hg.addObject('100000000002', ATTRS(160, 100), 'middle');
		const top = hg.addObject('100000000003', ATTRS(20, 100), 'top');
		await page.goto(`/?${hg.pageName}`);
		await expect(byId(page, top)).toBeAttached();
		expect(await domOrder(page)).toEqual(['100000000003', '100000000002', '100000000001']);
	});

test('objects within one row threshold order left-to-right', async ({ page, hg }) => {
	hg.addObject('100000000001', ATTRS(100, 300), 'right');
	hg.addObject('100000000002', ATTRS(90, 40), 'left');
	const next = hg.addObject('100000000003', ATTRS(200, 10), 'next row');
	await page.goto(`/?${hg.pageName}`);
	await expect(byId(page, next)).toBeAttached();
	expect(await domOrder(page)).toEqual(['100000000002', '100000000001', '100000000003']);
});

test('the stored page-reading-order overrides the automatic order',
	async ({ page, hg }) => {
		hg.addObject('100000000001', ATTRS(20, 100), 'first');
		hg.addObject('100000000002', ATTRS(120, 100), 'second');
		const third = hg.addObject('100000000003', ATTRS(220, 100), 'third');
		hg.addObject('page', { 'page-reading-order': '["100000000003","100000000001"]' });
		await page.goto(`/?${hg.pageName}`);
		await expect(byId(page, third)).toBeAttached();
		expect(await domOrder(page)).toEqual(
			['100000000003', '100000000001', '100000000002']);
	});

test('stale names in the override are skipped', async ({ page, hg }) => {
	hg.addObject('100000000001', ATTRS(20, 100), 'a');
	const b = hg.addObject('100000000002', ATTRS(120, 100), 'b');
	hg.addObject('page', { 'page-reading-order': '["100000009999","100000000002"]' });
	await page.goto(`/?${hg.pageName}`);
	await expect(byId(page, b)).toBeAttached();
	expect(await domOrder(page)).toEqual(['100000000002', '100000000001']);
});

test('the page-menu panel stores the reordered sequence', async ({ page, hg }) => {
	hg.addObject('100000000001', ATTRS(20, 100), 'a');
	hg.addObject('100000000002', ATTRS(120, 100), 'b');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 2);

	// the page menu opens with alt+p (js/edit.js menu shortcuts)
	await page.keyboard.press('Alt+P');
	await expect(page.locator('[title="reading order"]')).toBeVisible();
	await page.locator('[title="reading order"]').click();
	await expect(page.locator('.glue-reading-order-popover')).toBeVisible();

	// the rows follow the current (automatic) order
	const labels = page.locator('.glue-reading-order-row .glue-popover-label');
	await expect(labels).toHaveCount(2);
	await expect(labels.nth(0)).toHaveText('100000000001');
	await expect(labels.nth(1)).toHaveText('100000000002');

	// move the second object up
	await page.locator('.glue-reading-order-row').nth(1)
		.locator('.glue-reading-order-btn').first().click();
	await expect.poll(() => hg.readObject('page').attrs['page-reading-order'])
		.toBe('["100000000002","100000000001"]');

	// reset drops the stored override entirely
	await page.locator('.glue-reading-order-popover .glue-popover-reset').click();
	await expect.poll(() => hg.readObject('page').attrs['page-reading-order']).toBeUndefined();
});
