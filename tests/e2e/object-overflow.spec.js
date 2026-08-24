// Overflow toggle in the object context menu.
//
// Objects are fixed-size absolutely positioned boxes, and content bigger than
// the box spills out of it - the browser default, and what hotglue has always
// done. This lets an object clip instead.
//
// Absent means visible: only 'hidden' is ever stored, so an object nobody has
// touched keeps exactly the markup it had.

const { test, expect, waitForEditor } = require('./fixtures/hotglue.js');

// deliberately more text than fits in the box
const ATTRS = {
	type: 'text', module: 'text',
	'object-left': '150px', 'object-top': '150px',
	'object-width': '120px', 'object-height': '40px', 'object-zindex': '100',
	'text-background-color': 'transparent', 'text-font-size': '16px',
};
const LONG = 'this text is considerably longer than the box it lives in';

const byId = (page, id) => page.locator(`[id="${id}"]`);
const toggle = (page) => page.getByTitle(/content bigger than this object/);
const overflowOf = (page, id) => page.evaluate((i) =>
	getComputedStyle(document.getElementById(i)).overflow, id);

async function select(page, id) {
	await byId(page, id).click();
	await expect(toggle(page)).toBeVisible();
}

test('the toggle clips the object and stores it', async ({ page, hg }) => {
	const a = hg.addObject('100000000001', ATTRS, LONG);
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await select(page, a);

	expect(await overflowOf(page, a), 'objects should spill by default').toBe('visible');
	await toggle(page).click();
	expect(await overflowOf(page, a)).toBe('hidden');

	await expect.poll(() => hg.readObject('100000000001').attrs['object-overflow'])
		.toBe('hidden');
});

test('clipping survives a reload', async ({ page, hg }) => {
	const a = hg.addObject('100000000001', { ...ATTRS, 'object-overflow': 'hidden' }, LONG);
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	expect(await overflowOf(page, a)).toBe('hidden');

	// and on the published page, not just in the editor
	await page.goto(`/?${hg.pageName}`);
	expect(await page.evaluate(() =>
		getComputedStyle(document.querySelector('.object')).overflow)).toBe('hidden');
});

test('toggling back removes the property rather than storing visible',
	async ({ page, hg }) => {
		// absent means visible - storing 'visible' would put a property on every
		// object anyone ever clicked this on, for no change in behaviour
		const a = hg.addObject('100000000001', { ...ATTRS, 'object-overflow': 'hidden' }, LONG);
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await select(page, a);

		await toggle(page).click();
		expect(await overflowOf(page, a)).toBe('visible');
		await expect.poll(() => hg.readObject('100000000001').attrs['object-overflow'])
			.toBeUndefined();
	});

test('the pressed-in frame and the tooltip say what is true now',
	async ({ page, hg }) => {
		// The text label ('clip'/'show') became the SuperGlue clip icon; the
		// state it used to spell out is the pressed-in frame the flip toggles
		// use, and the tooltip still says what clicking will do.
		const a = hg.addObject('100000000001', ATTRS, LONG);
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await select(page, a);

		await expect(toggle(page)).toHaveAttribute('title', /spills out/);
		await expect(toggle(page)).not.toHaveClass(/glue-btn-active/);
		await toggle(page).click();
		await expect(toggle(page)).toHaveClass(/glue-btn-active/);
		await expect(toggle(page)).toHaveAttribute('title', /cut off/);
	});

test('clipping is not lost when the object is next moved', async ({ page, hg }) => {
	// save_state rebuilds an object's properties from the element it is sent,
	// so a property the save path does not know about disappears on the next
	// drag. object_alter_save has to map overflow both ways for this to hold.
	const a = hg.addObject('100000000001', { ...ATTRS, 'object-overflow': 'hidden' }, LONG);
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	// deliberately NOT selected: selecting shifts the object by half the
	// selection border, and this test is about overflow, not that
	await page.evaluate((i) => {
		const el = document.getElementById(i);
		el.style.left = '400px';
		window.$.glue.object.save(el);
	}, a);

	await expect.poll(() => hg.readObject('100000000001').attrs['object-left']).toBe('400px');
	expect(hg.readObject('100000000001').attrs['object-overflow'],
		'the overflow setting was dropped by an unrelated save').toBe('hidden');
});
