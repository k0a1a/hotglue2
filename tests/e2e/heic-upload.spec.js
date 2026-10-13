// A HEIC picture (iPhone photos) uploads as an ordinary image: the server
// converts it to a JPEG before it is stored, because only Safari can draw
// HEIC. Needs the imagick extension with HEIC support in the php that serves
// the tests; without it the upload is refused with a message, which is what
// the second test pins.

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { test, expect, waitForEditor, CONTENT } = require('./fixtures/hotglue.js');

const SAMPLE = path.join(__dirname, 'fixtures', 'sample.heic');
const HAS_HEIC = spawnSync('php', ['-r',
	'exit(class_exists("Imagick") && count((new Imagick)->queryFormats("HEIC")) ? 0 : 1);']).status === 0;

async function upload(page, hg, file) {
	hg.addObject('100000000001', {
		type: 'text', module: 'text', 'object-left': '50px', 'object-top': '50px',
		'object-width': '100px', 'object-height': '50px', 'object-zindex': '100',
		'text-background-color': 'transparent',
	}, 'seed');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await page.keyboard.press('Alt+o');
	const sel = 'input[title="upload asset - image, video, audio or html file"]';
	const input = page.locator(sel).first();
	await expect(input).toBeAttached();
	await page.evaluate((s) => document.querySelector(s).parentElement
		.dispatchEvent(new MouseEvent('click', { bubbles: true })), sel);
	await input.setInputFiles(file);
}

test('the asset picker offers heic files', async ({ page, hg }) => {
	hg.addObject('100000000001', {
		type: 'text', module: 'text', 'object-left': '50px', 'object-top': '50px',
		'object-width': '100px', 'object-height': '50px', 'object-zindex': '100',
	}, 'seed');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await page.keyboard.press('Alt+o');
	await expect(page.locator('input[title="upload asset - image, video, audio or html file"]').first())
		.toHaveAttribute('accept', /\.heic/);
});

test('a heic upload becomes a jpeg image object', async ({ page, hg }) => {
	test.skip(!HAS_HEIC, 'php has no imagick with HEIC support');
	await upload(page, hg, SAMPLE);
	await expect(page.locator('.image.object')).toHaveCount(1, { timeout: 10000 });
	const shared = path.join(CONTENT, hg.pageName.split('.')[0], 'shared');
	await expect.poll(() => fs.readdirSync(shared).filter((f) => f.endsWith('.jpg'))).toEqual(['sample.jpg']);
	expect(fs.readdirSync(shared).filter((f) => /heic/i.test(f))).toEqual([]);
	const buf = fs.readFileSync(path.join(shared, 'sample.jpg'));
	expect([buf[0], buf[1]]).toEqual([0xff, 0xd8]);
});

test('without HEIC support the upload is refused, not stored', async ({ page, hg }) => {
	test.skip(HAS_HEIC, 'php can read HEIC here');
	await upload(page, hg, SAMPLE);
	await page.waitForTimeout(1500);
	await expect(page.locator('.image.object')).toHaveCount(0);
	const shared = path.join(CONTENT, hg.pageName.split('.')[0], 'shared');
	expect(fs.existsSync(shared) ? fs.readdirSync(shared).filter((f) => /heic|jpg/i.test(f)) : []).toEqual([]);
});
