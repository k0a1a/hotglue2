// The upload size cap (UPLOAD_MAX_SIZE): refused client-side before the
// bytes leave the browser, and server-side before anything touches disk -
// the same wording both places. The harness pins a small cap (200KB, see
// server-router.php), so the oversized file is generated into a temp file
// rather than committed as a fixture.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { test, expect, waitForEditor } = require('./fixtures/hotglue.js');

const tooBig = () => {
	const p = path.join(os.tmpdir(), 'hg-e2e-oversize.bin');
	fs.writeFileSync(p, Buffer.alloc(300000, 0x41));
	return p;
};

test('the editor refuses an oversized file before uploading it', async ({ page, hg }) => {
	hg.addObject('100000000001', {
		type: 'text', module: 'text', 'object-left': '50px', 'object-top': '50px',
		'object-width': '100px', 'object-height': '50px', 'object-zindex': '100',
		'text-background-color': 'transparent',
	}, 'seed');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);

	await page.keyboard.press('Alt+o');
	const input = page.locator('input[title="upload an asset: an image, video or sound file"]').first();
	await expect(input).toBeAttached();
	const dialog = page.waitForEvent('dialog');
	await input.setInputFiles(tooBig());
	expect((await dialog).message()).toBe('file too large (max 195KB)');

	// nothing was sent: no object, no file in shared
	await page.waitForTimeout(300);
	expect(hg.ids()).toEqual(['100000000001']);
});

test('the server refuses an oversized upload with the same wording', async ({ page, hg }) => {
	hg.addObject('100000000001', {
		type: 'text', module: 'text', 'object-left': '50px', 'object-top': '50px',
		'object-width': '100px', 'object-height': '50px', 'object-zindex': '100',
		'text-background-color': 'transparent',
	}, 'seed');

	// straight at json.php, past the client pre-check
	const resp = await page.request.post('/json.php', {
		multipart: {
			method: JSON.stringify('glue.upload_files'),
			page: JSON.stringify(hg.pageName),
			user_file0: { name: 'big.bin', mimeType: 'application/octet-stream', buffer: Buffer.alloc(300000, 0x41) },
		},
	});
	// json.php wraps the error: the status travels as #error_code in the body
	const body = await resp.json();
	expect(body['#error_code']).toBe(413);
	expect(body['#data']).toBe('file too large (max 195KB)');
	expect(hg.ids()).toEqual(['100000000001']);
});
