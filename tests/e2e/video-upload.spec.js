// Video upload - the formats the video module claims beyond the mp4/webm/
// ogg set (2026-09-24). Each upload becomes a video object that re-encodes
// to mp4 in the background: anything unclaimed would fall back to a
// download object, so the counts below pin the whole dispatch. The upload
// route is image-upload.spec.js's: alt+o opens the 'new' menu without the
// single/double-click timing race, then the generic upload button takes the
// file.

const path = require('path');
const { test, expect, waitForEditor } = require('./fixtures/hotglue.js');

const FORMATS = ['sample.mov', 'sample.avi', 'sample.mkv', 'sample.wmv', 'sample.qt'];

async function uploadViaNewMenu(page, file) {
	await page.keyboard.press('Alt+o');
	const input = page.locator('input[title="upload an asset: an image, video or sound file"]').first();
	await expect(input).toBeAttached();
	await page.evaluate(() => {
		document.querySelector('input[title="upload an asset: an image, video or sound file"]').parentElement
			.dispatchEvent(new MouseEvent('click', { bubbles: true }));
	});
	await input.setInputFiles(file);
}

test('the additional video formats all become video objects', async ({ page, hg }) => {
	hg.addObject('100000000001', {
		type: 'text', module: 'text', 'object-left': '50px', 'object-top': '50px',
		'object-width': '100px', 'object-height': '50px', 'object-zindex': '100',
		'text-background-color': 'transparent',
	}, 'seed');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);

	for (let i = 0; i < FORMATS.length; i++) {
		await uploadViaNewMenu(page, path.join(__dirname, 'fixtures', FORMATS[i]));
		await expect(page.locator('.video.object')).toHaveCount(i + 1, { timeout: 10000 });
	}
	// all five finalize their background encode - five real <video> elements
	// means none of the uploads fell back to a download object
	await expect(page.locator('.video.object video')).toHaveCount(FORMATS.length,
		{ timeout: 30000 });

	const ids = hg.ids().filter((f) => f !== '100000000001' && f !== 'page');
	expect(ids.length).toBe(FORMATS.length);
	for (const id of ids) {
		const attrs = hg.readObject(id).attrs;
		expect(attrs['type']).toBe('video');
		expect(attrs['video-file']).toBeTruthy();
	}
});
