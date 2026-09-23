// The colour picker's blend row: a dropdown for the parent object's
// mix-blend-mode, under the recent-colour swatches. Stored as
// object-mix-blend-mode (absent means normal - the browser default), so an
// untouched object keeps exactly the markup it had.

const { test, expect, waitForEditor } = require('./fixtures/hotglue.js');

const ATTRS = {
	type: 'text', module: 'text',
	'object-left': '200px', 'object-top': '200px',
	'object-width': '300px', 'object-height': '120px', 'object-zindex': '100',
	'text-background-color': '#ffdd55',
};

const byId = (page, id) => page.locator(`[id="${id}"]`);
const attrs = (hg) => hg.readObject('100000000001').attrs;

// The picker comes from the object properties panel: the text menu's own
// "change background color" went when the panel took the object's background
// over (with it "make background transparent", which was this picker's alpha
// row at 0%). The panel is the object background panel until 2026-09-16, when
// padding, flip and transparency joined its background section.
async function openPicker(page, id) {
	await byId(page, id).click();
	await page.waitForTimeout(400);		// the menu fades in
	// exact: getByTitle matches substrings, and this tooltip was the fragment
	// trap itself - the modal's button read "object properties: id, classes and
	// custom attributes" until 2026-09-16, so the plain match found two. It says
	// "object attributes" now and finds one again, but the whole name is what is
	// meant either way.
	await page.getByTitle('object properties: background color/image, transparency, padding, flip, link', { exact: true }).click();
	await page.getByTitle('set object background color', { exact: true }).click();
	await expect(page.locator('.picker_wrapper')).toBeVisible();
}

test('the blend row sits under the swatches and stores the mode',
	async ({ page, hg }) => {
		const id = hg.addObject('100000000001', ATTRS, 'hello world');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await openPicker(page, id);

		const blend = page.locator('.glue-picker-blend');
		await expect(blend).toBeVisible();
		// under the recent-colour swatches
		const sw = await page.locator('.glue-picker-recent').boundingBox();
		const b = await blend.boundingBox();
		expect(b.y, 'the blend row is not under the swatches').toBeGreaterThan(sw.y);

		await blend.locator('select').selectOption('multiply');
		await expect.poll(() => page.evaluate((i) =>
			getComputedStyle(document.getElementById(i)).mixBlendMode, id)).toBe('multiply');

		// closing the picker saves the object; the mode lands in the file
		await page.mouse.click(10, 10);
		await expect.poll(() => attrs(hg)['object-mix-blend-mode']).toBe('multiply');

		// and it survives a reload through the render path
		await page.reload();
		await waitForEditor(page, 1);
		await expect.poll(() => page.evaluate((i) =>
			getComputedStyle(document.getElementById(i)).mixBlendMode, id)).toBe('multiply');
	});

test('back to normal removes the stored mode', async ({ page, hg }) => {
	const id = hg.addObject('100000000001', {
		...ATTRS, 'object-mix-blend-mode': 'screen',
	});
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await expect.poll(() => page.evaluate((i) =>
		getComputedStyle(document.getElementById(i)).mixBlendMode, id)).toBe('screen');
	await openPicker(page, id);

	// the dropdown opens on what the object actually has
	await expect(page.locator('.glue-picker-blend select')).toHaveValue('screen');
	await page.locator('.glue-picker-blend select').selectOption('normal');
	await page.mouse.click(10, 10);
	await expect.poll(() => attrs(hg)['object-mix-blend-mode']).toBeUndefined();
	await expect.poll(() => page.evaluate((i) =>
		getComputedStyle(document.getElementById(i)).mixBlendMode, id)).toBe('normal');
});

test('an untouched object gains no blend key on save', async ({ page, hg }) => {
	hg.addObject('100000000001', ATTRS, 'hello world');
	const before = hg.readObjectRaw('100000000001');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await page.evaluate(() => Promise.all(
		Array.from(document.querySelectorAll('.object')).map((el) => new Promise((res) => {
			window.$.glue.backend(
				{ method: 'glue.save_state', html: window.$.glue.object.to_html(el) }, res);
		}))));
	expect(hg.readObjectRaw('100000000001'), 'an unedited save rewrote the object')
		.toBe(before);
});
