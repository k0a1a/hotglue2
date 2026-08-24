// The "change padding" panel: one slider-plus-field for all four sides, a
// folded-away "more knobs" section with a row per side, and a reset back to
// the module default.
//
// Padding is internal: the outer box never moves, every row compensates the
// object's width/height by the padding it adds. And storage follows the box:
// symmetric sides save as the text-padding-x/y pair (the format objects have
// had for years), asymmetric sides save as per-side attributes that the
// renderer applies first.
//
// A field entry applies live on input; it is committed - written to the
// object file - on the field's change event. fill() alone fires only input,
// so each entry below dispatches change too.

const { test, expect, waitForEditor } = require('./fixtures/hotglue.js');

const ID = '100000000001';			// the object's basename (what readObject wants)
const ATTRS = {
	type: 'text', module: 'text',
	'object-left': '200px', 'object-top': '200px',
	'object-width': '250px', 'object-height': '120px', 'object-zindex': '100',
	'text-background-color': '#ffdd55', 'text-font-size': '18px',
};

const byId = (page, id) => page.locator(`[id="${id}"]`);
const panel = (page) => page.locator('.glue-popover.glue-padding-popover');
const boxOf = (page, id) => page.evaluate((i) => {
	const el = document.getElementById(i);
	return el.offsetWidth+','+el.offsetHeight;
}, id);

// type a value into a row's field and commit it (change is the commit)
async function fillRow(page, row, v) {
	await row.locator('.glue-popover-field').fill(String(v));
	await row.locator('.glue-popover-field').dispatchEvent('change');
}

async function openPanel(page, hg) {
	hg.addObject(ID, ATTRS, 'hello world');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await byId(page, `${hg.pageName}.${ID}`).click();
	await page.getByTitle(/change padding/).click();
	await expect(panel(page)).toBeVisible();
	return `${hg.pageName}.${ID}`;		// the DOM id the object element carries
}

test('the uniform row applies one value to all four sides', async ({ page, hg }) => {
	const a = await openPanel(page, hg);
	const before = await boxOf(page, a);

	await fillRow(page, panel(page).locator('.glue-popover-row').first(), 30);

	const pad = await page.evaluate((i) => {
		const s = getComputedStyle(document.getElementById(i));
		return [s.paddingLeft, s.paddingRight, s.paddingTop, s.paddingBottom];
	}, a);
	expect(pad[0]).toBe('30px');
	expect(pad[1]).toBe('30px');
	expect(pad[2]).toBe('30px');
	expect(pad[3]).toBe('30px');

	// internal padding: the box did not move, the content area shrank. The
	// stored width keeps the OUTER box: the renderer inflates the CSS width
	// by the padding, so a stored width of 250 shows as 250+15+15=280, and
	// the panel compensates the CSS width by the padding it adds - 220 stored
	// here means 280 outer again on the next load
	await expect.poll(() => boxOf(page, a)).toBe(before);
	await expect.poll(() => hg.readObject(ID).attrs['object-width'])
		.toBe('220px');		// 250 stored minus the 30 the padding adds
	// symmetric sides stay the x/y pair, the storage format objects
	// have always used
	const attrs = hg.readObject(ID).attrs;
	expect(attrs['text-padding-x']).toBe('30px');
	expect(attrs['text-padding-y']).toBe('30px');
	expect(attrs['text-padding-left']).toBeUndefined();
	expect(attrs['text-padding-top']).toBeUndefined();
});

test('the "more knobs" section sets each side on its own and stores it per-side',
	async ({ page, hg }) => {
		const a = await openPanel(page, hg);
		const before = await boxOf(page, a);

		// folded away to start with
		const knobs = panel(page).locator('.glue-popover-advanced');
		await expect(knobs).toBeHidden();
		await panel(page).locator('.glue-popover-disclosure').click();
		await expect(knobs).toBeVisible();

		// rows are top, right, bottom, left
		await fillRow(page, knobs.locator('.glue-popover-row').nth(0), 20);

		await expect.poll(() => page.evaluate((i) =>
			getComputedStyle(document.getElementById(i)).paddingTop, a)).toBe('20px');
		// the other sides are untouched, keeping the module defaults
		await expect.poll(() => page.evaluate((i) =>
			getComputedStyle(document.getElementById(i)).paddingBottom, a)).toBe('12px');
		await expect.poll(() => page.evaluate((i) =>
			getComputedStyle(document.getElementById(i)).paddingLeft, a)).toBe('15px');

		// asymmetric sides save as longhands (the box is fixed, so the stored
		// height shrank by the 8px the top gained over its 12px default;
		// left=right=15 still keeps the x pair)
		await expect.poll(() => hg.readObject(ID).attrs['text-padding-top'])
			.toBe('20px');
		await expect.poll(() => hg.readObject(ID).attrs['text-padding-bottom'])
			.toBe('12px');
		expect(hg.readObject(ID).attrs['text-padding-y']).toBeUndefined();
		expect(hg.readObject(ID).attrs['text-padding-x']).toBe('15px');
		await expect.poll(() => hg.readObject(ID).attrs['object-height'])
			.toBe('112px');		// 120 stored minus the 8 the top gained

		// and the asymmetry survives a reload through the render path
		await page.reload();
		await waitForEditor(page, 1);
		await expect.poll(() => page.evaluate((i) =>
			getComputedStyle(document.getElementById(i)).paddingTop, a)).toBe('20px');
		await expect.poll(() => page.evaluate((i) =>
			getComputedStyle(document.getElementById(i)).paddingBottom, a)).toBe('12px');
		await expect.poll(() => boxOf(page, a)).toBe(before);
	});

test('reset goes back to the default padding without moving the box',
	async ({ page, hg }) => {
		const a = await openPanel(page, hg);
		const before = await boxOf(page, a);

		await fillRow(page, panel(page).locator('.glue-popover-row').first(), 40);
		await expect.poll(() => page.evaluate((i) =>
			getComputedStyle(document.getElementById(i)).paddingLeft, a)).toBe('40px');
		expect(hg.readObject(ID).attrs['text-padding-x']).toBe('40px');

		// the module default is 12px top and bottom, 15px left and right
		await panel(page).locator('.glue-popover-reset').click();
		const pad = await page.evaluate((i) => {
			const s = getComputedStyle(document.getElementById(i));
			return [s.paddingTop, s.paddingRight, s.paddingBottom, s.paddingLeft];
		}, a);
		expect(pad).toEqual(['12px', '15px', '12px', '15px']);
		await expect.poll(() => boxOf(page, a)).toBe(before);
		// nothing padding-related is left in the object file
		await expect.poll(() => {
			const attrs = hg.readObject(ID).attrs;
			return attrs['text-padding-x'] === undefined
				&& attrs['text-padding-y'] === undefined
				&& attrs['text-padding-top'] === undefined
				&& attrs['text-padding-left'] === undefined;
		}).toBe(true);
	});
