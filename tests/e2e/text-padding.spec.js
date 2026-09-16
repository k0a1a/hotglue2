// Padding: one slider-plus-field for all four sides, a folded-away "more knobs"
// section with a row per side, and a reset back to flush.
//
// The rows are a section of the OBJECT PROPERTIES panel, not a panel of their
// own. They were the text menu's "change padding" button until 2026-09-16: the
// text's inset from the object's sides is a property of the object, not
// typography, which is what the text-controls SOW said when the Font and
// Spacing panels were built. The section is still the text module's to build -
// text-padding-x / text-padding-y is the only padding hotglue stores, so
// object_properties_popover() in modules/object/object-edit.js only draws it
// for a text object - and the panel's one reset runs its reset with the other
// sections'. The rows carry .glue-padding-row so they can be named inside a
// panel that has six number fields.
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
const panel = (page) => page.locator('.glue-popover.glue-properties-popover');
// the uniform row, named: the panel it lives in has an x, a y, a scale and an
// opacity row besides, so a bare .glue-popover-row would match the wrong one
const uniform = (page) => panel(page).locator('.glue-padding-row');
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
	await page.getByTitle('object properties').click();
	await expect(panel(page)).toBeVisible();
	return `${hg.pageName}.${ID}`;		// the DOM id the object element carries
}

test('the uniform row applies one value to all four sides', async ({ page, hg }) => {
	const a = await openPanel(page, hg);
	const before = await boxOf(page, a);

	await fillRow(page, uniform(page), 30);

	const pad = await page.evaluate((i) => {
		const s = getComputedStyle(document.getElementById(i));
		return [s.paddingLeft, s.paddingRight, s.paddingTop, s.paddingBottom];
	}, a);
	expect(pad[0]).toBe('30px');
	expect(pad[1]).toBe('30px');
	expect(pad[2]).toBe('30px');
	expect(pad[3]).toBe('30px');

	// internal padding: the box did not move, the content area shrank. The
	// stored width keeps the OUTER box, and the panel compensates the CSS
	// width by the padding it adds - 190 stored here means the 250 box
	// again on the next load once the 30 left and 30 right come back
	await expect.poll(() => boxOf(page, a)).toBe(before);
	await expect.poll(() => hg.readObject(ID).attrs['object-width'])
		.toBe('190px');		// 250 stored minus the 30 left and 30 right
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
		// the other sides are untouched - there is no module default any
		// more, a bare side is flush
		await expect.poll(() => page.evaluate((i) =>
			getComputedStyle(document.getElementById(i)).paddingBottom, a)).toBe('0px');
		await expect.poll(() => page.evaluate((i) =>
			getComputedStyle(document.getElementById(i)).paddingLeft, a)).toBe('0px');

		// asymmetric sides save as longhands (the box is fixed, so the
		// stored height shrank by the 20px the top gained; the panel writes
		// all four sides, so the untouched ones store as 0px)
		await expect.poll(() => hg.readObject(ID).attrs['text-padding-top'])
			.toBe('20px');
		expect(hg.readObject(ID).attrs['text-padding-bottom']).toBe('0px');
		expect(hg.readObject(ID).attrs['text-padding-y']).toBeUndefined();
		expect(hg.readObject(ID).attrs['text-padding-x']).toBe('0px');
		await expect.poll(() => hg.readObject(ID).attrs['object-height'])
			.toBe('100px');		// 120 stored minus the 20 the top gained

		// and the asymmetry survives a reload through the render path
		await page.reload();
		await waitForEditor(page, 1);
		await expect.poll(() => page.evaluate((i) =>
			getComputedStyle(document.getElementById(i)).paddingTop, a)).toBe('20px');
		await expect.poll(() => page.evaluate((i) =>
			getComputedStyle(document.getElementById(i)).paddingBottom, a)).toBe('0px');
		await expect.poll(() => boxOf(page, a)).toBe(before);
	});

test('the panel only draws the section for a text object, and there it is flush to start',
	async ({ page, hg }) => {
		// An iframe object: not a text object, so no padding section - the
		// section is not greyed out, it is not built. The rest of the panel is.
		hg.addObject(ID, {
			type: 'iframe', module: 'iframe',
			'object-left': '200px', 'object-top': '200px',
			'object-width': '120px', 'object-height': '80px', 'object-zindex': '100',
			'iframe-url': '//example.org/',
		});
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await byId(page, `${hg.pageName}.${ID}`).click();
		await page.getByTitle('object properties').click();
		await expect(panel(page)).toBeVisible();

		await expect(panel(page).locator('.glue-padding-row')).toHaveCount(0);
		await expect(panel(page).locator('.glue-popover-disclosure')).toHaveCount(0);
		// and the panel is still the panel: the flip and the transparency
		await expect(page.getByTitle('flip vertically')).toBeVisible();
		await expect(panel(page).locator('.glue-opacity-row')).toBeVisible();
	});

test('reset goes back to no padding without moving the box',
	async ({ page, hg }) => {
		const a = await openPanel(page, hg);
		const before = await boxOf(page, a);

		await fillRow(page, uniform(page), 40);
		await expect.poll(() => page.evaluate((i) =>
			getComputedStyle(document.getElementById(i)).paddingLeft, a)).toBe('40px');
		expect(hg.readObject(ID).attrs['text-padding-x']).toBe('40px');

		// there is no module default any more - reset means flush, like the
		// historical engine renders a bare text object. The panel's reset is
		// one button and runs every section's, of which this object has only
		// the padding's to do anything with.
		await panel(page).locator('.glue-popover-reset').click();
		const pad = await page.evaluate((i) => {
			const s = getComputedStyle(document.getElementById(i));
			return [s.paddingTop, s.paddingRight, s.paddingBottom, s.paddingLeft];
		}, a);
		expect(pad).toEqual(['0px', '0px', '0px', '0px']);
		await expect.poll(() => boxOf(page, a)).toBe(before);
		// nothing padding-related is left in the object file
		await expect.poll(() => {
			const attrs = hg.readObject(ID).attrs;
			return attrs['text-padding-x'] === undefined
				&& attrs['text-padding-y'] === undefined
				&& attrs['text-padding-top'] === undefined
				&& attrs['text-padding-left'] === undefined;
		}).toBe(true);
		// and the row shows it, rather than still reading the old value
		await expect(uniform(page).locator('.glue-popover-field')).toHaveValue('0');
	});
