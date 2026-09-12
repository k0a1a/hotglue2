// Reading order (SOW-accessibility.md, Feature 1): the DOM is emitted in
// the visual reading order - top-to-bottom, left-to-right within a row -
// instead of filesystem order, so screen readers follow the page the way a
// sighted reader does. (The author override, Feature 2, extends this file
// later.) The objects are absolutely positioned, so the visual layout is
// untouched by any of this.

const { test, expect } = require('./fixtures/hotglue.js');

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
