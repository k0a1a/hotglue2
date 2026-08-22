// Uploading an image - MODERNIZATION.md section 11, the last scenario:
// "Upload an image; verify the preload/flicker-avoidance swap completes
// cleanly (section 7, image-edit.js)."
//
// The route matters and is not obvious. The page menu's file input is the page
// BACKGROUND button - page_upload() claims a file only when preferred_module
// is 'page' - while the generic upload button lives in the 'new' menu
// (js/edit.js), which opens on a SINGLE click on the background, behind a
// 300ms timer that distinguishes it from the double-click that opens the page
// menu. alt+o opens the same menu without the timing race, so that is what
// these use.

const fs = require('fs');
const path = require('path');
const { test, expect, waitForEditor, ROOT, CONTENT } = require('./fixtures/hotglue.js');

const SAMPLE = path.join(__dirname, 'fixtures', 'sample.png');

async function uploadViaNewMenu(page, file) {
	await page.keyboard.press('Alt+o');
	const input = page.locator('div:has(img[src*="upload.png"]) input[type=file]').first();
	await expect(input).toBeAttached();
	// The button's own click handler is what records WHERE the upload should
	// land ($.glue.menu.spawn_coords()), and the file input is a transparent
	// overlay on top of it - so fire the button's click first, then hand the
	// input its file. Driving the file chooser instead skips the handler.
	await page.evaluate(() => {
		document.querySelector('img[src*="upload.png"]').parentElement
			.dispatchEvent(new MouseEvent('click', { bubbles: true }));
	});
	await input.setInputFiles(file);
}

const sharedDir = (hg) => path.join(CONTENT, hg.pageName.split('.')[0], 'shared');

test('uploading an image creates an image object and stores the file',
	async ({ page, hg }) => {
		hg.addObject('100000000001', {
			type: 'text', module: 'text', 'object-left': '50px', 'object-top': '50px',
			'object-width': '100px', 'object-height': '50px', 'object-zindex': '100',
			'text-background-color': 'transparent',
		}, 'seed');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);

		await uploadViaNewMenu(page, SAMPLE);
		await expect(page.locator('.image.object')).toHaveCount(1, { timeout: 10000 });

		// the file itself landed in the page's shared directory
		expect(fs.readdirSync(sharedDir(hg))).toContain('sample.png');

		// and an image object was written, with the dimensions read off the file
		await expect.poll(() => hg.ids().length, { timeout: 5000 }).toBeGreaterThan(1);
		const id = hg.ids().find((f) => f !== '100000000001' && f !== 'page');
		const attrs = hg.readObject(id).attrs;
		expect(attrs['type']).toBe('image');
		expect(attrs['image-file']).toBe('sample.png');
		expect(attrs['image-file-width']).toBe('120');
		expect(attrs['image-file-height']).toBe('80');
	});

test('the uploaded image renders on the published page', async ({ page, hg }) => {
	hg.addObject('100000000001', {
		type: 'text', module: 'text', 'object-left': '50px', 'object-top': '50px',
		'object-width': '100px', 'object-height': '50px', 'object-zindex': '100',
		'text-background-color': 'transparent',
	}, 'seed');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await uploadViaNewMenu(page, SAMPLE);
	await expect(page.locator('.image.object')).toHaveCount(1, { timeout: 10000 });

	await page.goto(`/?${hg.pageName}`);
	const img = page.locator('.image.object');
	await expect(img).toHaveCount(1);
	// it is actually painted, not just present
	expect(await img.evaluate((el) => {
		const bg = getComputedStyle(el).backgroundImage;
		return bg && bg !== 'none' ? 'background' : el.querySelector('img') ? 'img' : 'none';
	})).not.toBe('none');
});

test('resizing an image leaves no preload leftovers behind', async ({ page, hg }) => {
	// image-edit.js swaps in a preloaded copy when an image is resized, to
	// avoid a flicker, and removes the temporary element on a timer. If that
	// swap does not complete, the temporary copies accumulate in the page.
	hg.addObject('100000000001', {
		type: 'text', module: 'text', 'object-left': '50px', 'object-top': '50px',
		'object-width': '100px', 'object-height': '50px', 'object-zindex': '100',
		'text-background-color': 'transparent',
	}, 'seed');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await uploadViaNewMenu(page, SAMPLE);
	await expect(page.locator('.image.object')).toHaveCount(1, { timeout: 10000 });

	const before = await page.locator('.object').count();
	const img = page.locator('.image.object');
	await img.click();
	const handle = page.locator('.moveable-control.moveable-se');
	await expect(handle).toBeVisible();
	const b = await handle.boundingBox();
	await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
	await page.mouse.down();
	for (let i = 1; i <= 6; i++) await page.mouse.move(b.x + i * 15, b.y + i * 10);
	await page.mouse.up();
	await page.waitForTimeout(1200);			// let the preload timer run out

	expect(await page.locator('.object').count(),
		'a preload copy was left behind in the page').toBe(before);
	await expect(page.locator('.image.object')).toHaveCount(1);
});
