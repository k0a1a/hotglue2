// Uploading an HTML file: it is shown in an iframe object, like a website
// embed, so it resizes like one - not offered back as a download. The page
// runs in a sandbox with no origin of its own: its scripts work, but it is a
// stranger to the site and the editor.
//
// Same route as image-upload.spec.js: the 'new' menu's upload button.

const fs = require('fs');
const path = require('path');
const { test, expect, waitForEditor, CONTENT } = require('./fixtures/hotglue.js');

const SAMPLE = path.join(__dirname, 'fixtures', 'sample-page.html');
const SEED = {
	type: 'text', module: 'text', 'object-left': '50px', 'object-top': '50px',
	'object-width': '100px', 'object-height': '50px', 'object-zindex': '100',
	'text-background-color': 'transparent',
};
const BTN = 'input[title="upload an asset: an image, video or sound file"]';

async function upload(page, file) {
	await page.keyboard.press('Alt+o');
	const input = page.locator(BTN).first();
	await expect(input).toBeAttached();
	await page.evaluate((sel) => {
		document.querySelector(sel).parentElement
			.dispatchEvent(new MouseEvent('click', { bubbles: true }));
	}, BTN);
	await input.setInputFiles(file);
}

const sharedDir = (hg) => path.join(CONTENT, hg.pageName.split('.')[0], 'shared');
const newId = (hg) => hg.ids().find((f) => f !== '100000000001' && f !== 'page');

test('an uploaded html file becomes an iframe object, not a download',
	async ({ page, hg }) => {
		hg.addObject('100000000001', SEED, 'seed');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);

		await upload(page, SAMPLE);
		await expect(page.locator('.iframe.object')).toHaveCount(1, { timeout: 10000 });
		await expect(page.locator('.download.object')).toHaveCount(0);

		expect(fs.readdirSync(sharedDir(hg))).toContain('sample-page.html');
		await expect.poll(() => newId(hg), { timeout: 5000 }).toBeTruthy();
		const attrs = hg.readObject(newId(hg)).attrs;
		expect(attrs['type']).toBe('iframe');
		expect(attrs['iframe-file']).toBe('sample-page.html');
		expect(attrs['iframe-scroll']).toBe('scroll');
		expect(attrs['iframe-url']).toBeUndefined();
		// it resizes like any embed
		await expect(page.locator('.iframe.object')).toHaveClass(/resizable/);
	});

test('the page runs in the frame, in a sandbox with no origin of its own',
	async ({ page, hg }) => {
		hg.addObject('100000000001', SEED, 'seed');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await upload(page, SAMPLE);
		await expect(page.locator('.iframe.object')).toHaveCount(1, { timeout: 10000 });

		const frame = page.locator('.iframe.object > iframe');
		// the script ran: it rewrites the paragraph
		await expect(page.frameLocator('.iframe.object > iframe').locator('#a')).toHaveText('ran');
		const sandbox = await frame.getAttribute('sandbox');
		expect(sandbox).toContain('allow-scripts');
		expect(sandbox).not.toContain('allow-same-origin');
		// the address is the object's own, not the file's path in content/
		expect(await frame.getAttribute('src')).toContain(newId(hg));
	});

test('the object url serves the file as html under a sandbox policy',
	async ({ page, hg, request }) => {
		hg.addObject('100000000001', SEED, 'seed');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await upload(page, SAMPLE);
		await expect(page.locator('.iframe.object')).toHaveCount(1, { timeout: 10000 });

		const src = await page.locator('.iframe.object > iframe').getAttribute('src');
		const res = await request.get(new URL(src, page.url()).toString());
		expect(res.status()).toBe(200);
		expect(res.headers()['content-type']).toContain('text/html');
		const csp = res.headers()['content-security-policy'];
		expect(csp).toContain('sandbox');
		expect(csp).not.toContain('allow-same-origin');
	});

test('saving the object keeps the file and does not invent an address',
	async ({ page, hg }) => {
		hg.addObject('100000000001', SEED, 'seed');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await upload(page, SAMPLE);
		await expect(page.locator('.iframe.object')).toHaveCount(1, { timeout: 10000 });
		await expect.poll(() => newId(hg), { timeout: 5000 }).toBeTruthy();
		const id = newId(hg);

		// the scrollbar toggle saves the object through the iframe's own save
		await page.locator('.iframe.object .glue-iframe-shield').click();
		await page.waitForTimeout(400);		// the menu fades in
		await page.locator('.glue-btn-icon[title*="scrollbars"]').first().click();
		await expect.poll(() => hg.readObject(id).attrs['iframe-scroll'], { timeout: 5000 }).toBeUndefined();

		const attrs = hg.readObject(id).attrs;
		expect(attrs['iframe-file']).toBe('sample-page.html');
		expect(attrs['iframe-url']).toBeUndefined();
	});

test('the asset uploader offers html files in its file picker', async ({ page, hg }) => {
	hg.addObject('100000000001', SEED, 'seed');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await page.keyboard.press('Alt+o');
	const accept = await page.locator(BTN).first().getAttribute('accept');
	for (const t of ['image/*', 'video/*', 'audio/*', '.html', '.htm']) {
		expect(accept.split(','), t + ' missing from the picker').toContain(t);
	}
});
