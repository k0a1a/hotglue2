// Where the colour picker opens.
//
// Its popup is anchored to a position:fixed element, so it needs VIEWPORT
// coordinates. It used to be given $.glue.menu.spawn_coords(), which is in
// PAGE space AND is captured when the menu opens rather than when the picker
// does - so the popup appeared wherever the page had been scrolled to at some
// earlier moment. Measured before the fix: the same 655,30 regardless of which
// button was clicked, on a scrolled page and on a centered page alike.
//
// This is not a centered-layout bug, it just became obvious there: centring
// moves the button but the popup stayed put.

const { test, expect, waitForEditor } = require('./fixtures/hotglue.js');

const OBJ = (left, top) => ({
	type: 'text', module: 'text',
	'object-left': `${left}px`, 'object-top': `${top}px`,
	'object-width': '200px', 'object-height': '100px', 'object-zindex': '100',
	'text-background-color': '#ffff00',
});

for (const [name, centered] of [['infinite', false], ['centered', true]]) {
	test(`the picker opens next to its button and on screen (${name})`, async ({ page, hg }) => {
		const a = hg.addObject('100000000001', OBJ(300, 900), 'A');
		hg.addObject('100000000002', OBJ(300, 2000), 'far');		// make the page tall
		if (centered) {
			hg.addObject('page', { 'page-layout-mode': 'centered', 'page-container-width': '900' });
		}
		await page.goto(hg.editUrl());
		await waitForEditor(page, 2);
		await page.locator(`[id="${a}"]`).click();

		const button = page.getByTitle(/background color/i).first();
		const bb = await button.boundingBox();
		await button.click();

		const popup = page.locator('.picker_wrapper');
		await expect(popup).toBeVisible();
		const pb = await popup.boundingBox();
		const viewport = page.viewportSize();

		expect(Math.abs(pb.x - bb.x), 'the picker should sit beside its button').toBeLessThan(120);
		expect(pb.y, 'the picker opened off the top of the window').toBeGreaterThanOrEqual(0);
		expect(pb.y + pb.height, 'the picker opened off the bottom of the window')
			.toBeLessThanOrEqual(viewport.height + 1);

		// and nothing paints over it - objects go up to z-index 199 and the
		// one being recoloured is by definition right underneath
		const onTop = await page.evaluate(() => {
			const r = document.querySelector('.picker_wrapper').getBoundingClientRect();
			const at = document.elementFromPoint(
				Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2));
			return !!(at && at.closest('.picker_wrapper'));
		});
		expect(onTop, 'something is painting over the colour picker').toBe(true);
	});
}
