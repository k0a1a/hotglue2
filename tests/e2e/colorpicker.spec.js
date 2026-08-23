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

// --- size, and the per-page recent colours -------------------------------
//
// The picker opened at vanilla-picker's 250x315 default, which is a lot of
// window for one swatch of colour, on top of the object being coloured. It is
// roughly half that now; the hex field is what makes shrinking it safe, since
// an exact colour can always be typed. Above that field sit the last five
// colours used on THIS page, stored on the page object as page-recent-colors
// so they are there for whoever opens the page next.

const bgOf = (page, id) => page.evaluate((i) =>
	getComputedStyle(document.getElementById(i)).backgroundColor, id);

async function openPicker(page, id) {
	await page.locator(`[id="${id}"]`).click();
	await page.getByTitle(/background color/i).first().click();
	await expect(page.locator('.picker_wrapper')).toBeVisible();
}

test('the picker is small enough to leave the object visible', async ({ page, hg }) => {
	const a = hg.addObject('100000000001', OBJ(300, 300), 'A');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await openPicker(page, a);

	const b = await page.locator('.picker_wrapper').boundingBox();
	expect(b.width, 'the picker is back to its full default width').toBeLessThan(180);
	expect(b.height, 'the picker is back to its full default height').toBeLessThan(210);
	// and it is still usable: the hex field, the sample and Ok all present
	await expect(page.locator('.picker_editor input')).toBeVisible();
	await expect(page.locator('.picker_done button')).toBeVisible();
});

test('the page\'s recent colours show as swatches, above the hex field',
	async ({ page, hg }) => {
		const a = hg.addObject('100000000001', OBJ(300, 300), 'A');
		hg.addObject('page', { 'page-recent-colors': '#ff0000,#00aa55,#3355ff' });
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await openPicker(page, a);

		const swatches = page.locator('.glue-picker-swatch');
		await expect(swatches).toHaveCount(3);
		expect(await swatches.first().evaluate((e) =>
			getComputedStyle(e).backgroundColor)).toBe('rgb(255, 0, 0)');

		// above the editor row, not beside it
		const row = await page.locator('.glue-picker-recent').boundingBox();
		const editor = await page.locator('.picker_editor').boundingBox();
		expect(row.y + row.height).toBeLessThanOrEqual(editor.y + 1);
	});

test('clicking a swatch recolours the object', async ({ page, hg }) => {
	const a = hg.addObject('100000000001', OBJ(300, 300), 'A');
	hg.addObject('page', { 'page-recent-colors': '#ff0000,#00aa55' });
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await openPicker(page, a);

	await page.locator('.glue-picker-swatch').nth(1).click();
	await expect.poll(() => bgOf(page, a)).toBe('rgb(0, 170, 85)');
});

test('a colour that gets used is remembered on the page, most recent first',
	async ({ page, hg }) => {
		const a = hg.addObject('100000000001', OBJ(300, 300), 'A');
		hg.addObject('page', { 'page-recent-colors': '#ff0000,#00aa55' });
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await openPicker(page, a);

		// type an exact colour rather than aiming at the gradient. Enter in
		// the hex field is vanilla-picker's own "done", so the picker closes
		// on it and there is no Ok left to click
		const field = page.locator('.picker_editor input');
		await field.fill('#123456');
		await field.press('Enter');
		await expect(page.locator('.picker_wrapper')).toBeHidden();

		await expect.poll(() => hg.readObject('page').attrs['page-recent-colors'])
			.toBe('#123456,#ff0000,#00aa55');
	});

test('the list keeps five, without repeats', async ({ page, hg }) => {
	const a = hg.addObject('100000000001', OBJ(300, 300), 'A');
	hg.addObject('page', { 'page-recent-colors': '#111111,#222222,#333333,#444444,#555555' });
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);

	// re-using one that is already in the list moves it to the front rather
	// than adding a sixth
	await openPicker(page, a);
	await page.locator('.glue-picker-swatch').nth(2).click();
	await page.locator('.picker_done button').click();
	await expect.poll(() => hg.readObject('page').attrs['page-recent-colors'])
		.toBe('#333333,#111111,#222222,#444444,#555555');

	// and a new one pushes the oldest off the end
	await openPicker(page, a);
	const field = page.locator('.picker_editor input');
	await field.fill('#abcdef');
	await field.press('Enter');
	await expect(page.locator('.picker_wrapper')).toBeHidden();
	await expect.poll(() => hg.readObject('page').attrs['page-recent-colors'])
		.toBe('#abcdef,#333333,#111111,#222222,#444444');
});
