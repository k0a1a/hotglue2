// Image descriptions (SOW-accessibility.md, Feature 3): a decorative toggle
// plus an alt-text input on image objects.
//
// Two stored keys drive the render:
//   image-decorative  - the image is pure decoration: alt="" + role="presentation"
//   image-alt         - the description; emitted as the <img>'s alt in the
//                       unsized case, and as role="img" + aria-label on the
//                       wrapper in the sized (background-image) case, which is
//                       the common one since GD uploads record dimensions.
//
// The render must stay byte-identical to the old behaviour for images that
// carry neither key, and a no-op save must not introduce them (the
// image_alter_save round-trip unsets the keys when the DOM carries nothing).

const { test, expect, waitForEditor, serializeObject } = require('./fixtures/hotglue.js');

const ATTRS = {
	type: 'image', module: 'image',
	'object-left': '120px', 'object-top': '80px',
	'object-width': '200px', 'object-height': '150px', 'object-zindex': '100',
};
// the sized case: dimensions recorded, no <img> element at all
const SIZED = { ...ATTRS, 'image-file-width': '120', 'image-file-height': '80',
	'image-background-repeat': 'no-repeat' };

const byId = (page, id) => page.locator(`[id="${id}"]`);
const propsBtn = (page) => page.locator('#glue-contextmenu-image-properties');
const pop = (page) => page.locator('.glue-image-properties-popover');
const attrs = (hg) => hg.readObject('100000000001').attrs;

// Serialize every object on the page the way a save does, and wait for the
// backend to acknowledge each one (same technique as save-serialization.spec.js).
async function saveAll(page) {
	await page.evaluate(() => Promise.all(
		Array.from(document.querySelectorAll('.object')).map((el) => new Promise((res) => {
			window.$.glue.backend(
				{ method: 'glue.save_state', html: window.$.glue.object.to_html(el) }, res);
		}))));
}

test('sized image with image-alt renders role="img" and aria-label', async ({ page, hg }) => {
	const id = hg.addObject('100000000001', { ...SIZED, 'image-alt': 'a red balloon' });
	await page.goto(`/?${hg.pageName}`);
	await expect(byId(page, id)).toHaveAttribute('role', 'img');
	await expect(byId(page, id)).toHaveAttribute('aria-label', 'a red balloon');
	// and nothing else leaks
	expect(await byId(page, id).evaluate((e) => e.getAttribute('aria-label'))).toBe('a red balloon');
});

test('sized image marked decorative renders role="presentation" and no description',
	async ({ page, hg }) => {
		const id = hg.addObject('100000000001', { ...SIZED, 'image-decorative': 'yes' });
		await page.goto(`/?${hg.pageName}`);
		await expect(byId(page, id)).toHaveAttribute('role', 'presentation');
		await expect(byId(page, id)).not.toHaveAttribute('aria-label', /./);
	});

test('unsized image carries the description on the <img> child', async ({ page, hg }) => {
	const id = hg.addObject('100000000001', { ...ATTRS, 'image-alt': 'a red balloon' });
	await page.goto(`/?${hg.pageName}`);
	await expect(byId(page, id).locator('img')).toHaveAttribute('alt', 'a red balloon');
});

test('unsized decorative image has empty alt and role="presentation"', async ({ page, hg }) => {
	const id = hg.addObject('100000000001', { ...ATTRS, 'image-decorative': 'yes' });
	await page.goto(`/?${hg.pageName}`);
	const img = byId(page, id).locator('img');
	await expect(img).toHaveAttribute('alt', '');
	await expect(img).toHaveAttribute('role', 'presentation');
});

test('a no-op save of an image without description keys leaves the bytes untouched',
	async ({ page, hg }) => {
		hg.addObject('100000000001', SIZED);
		const before = hg.readObjectRaw('100000000001');

		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await saveAll(page);

		expect(hg.readObjectRaw('100000000001'), 'an unedited save rewrote the image object')
			.toBe(before);
	});

test('the popover stores the description on the object', async ({ page, hg }) => {
	const id = hg.addObject('100000000001', SIZED);
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await byId(page, id).click();
	await expect(propsBtn(page)).toBeVisible();
	await page.waitForTimeout(400);		// the menu fades in
	await propsBtn(page).click();
	await expect(pop(page)).toBeVisible();

	await pop(page).locator('input.glue-image-alt-field').fill('a red balloon');
	await pop(page).locator('input.glue-image-alt-field').blur();
	await expect.poll(() => attrs(hg)['image-alt']).toBe('a red balloon');
});

test('the decorative toggle gates the input and drops the description',
	async ({ page, hg }) => {
		const id = hg.addObject('100000000001', { ...SIZED, 'image-alt': 'a red balloon' });
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await byId(page, id).click();
		await expect(propsBtn(page)).toBeVisible();
		await page.waitForTimeout(400);
		await propsBtn(page).click();
		await expect(pop(page)).toBeVisible();

		// the seed has a description, so the nudge must be hidden
		await expect(pop(page).locator('.glue-popover-problem')).toBeHidden();
		// and the input is visible with the stored value
		await expect(pop(page).locator('input.glue-image-alt-field')).toHaveValue('a red balloon');

		await pop(page).locator('.glue-font-toggle').click();
		await expect.poll(() => attrs(hg)['image-decorative']).toBe('yes');
		expect(attrs(hg)['image-alt'], 'decorative implies no description').toBeUndefined();
		// the toggle gates the input
		await expect(pop(page).locator('input.glue-image-alt-field')).toBeHidden();
	});

test('the nudge shows only for meaningful images without a description',
	async ({ page, hg }) => {
		const id = hg.addObject('100000000001', SIZED);
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await byId(page, id).click();
		await expect(propsBtn(page)).toBeVisible();
		await page.waitForTimeout(400);
		await propsBtn(page).click();
		await expect(pop(page)).toBeVisible();

		// no description, not decorative: nudge visible
		await expect(pop(page).locator('.glue-popover-problem')).toBeVisible();

		await pop(page).locator('.glue-font-toggle').click();
		// decorative: nothing to describe, no nudge
		await expect(pop(page).locator('.glue-popover-problem')).toBeHidden();
	});
