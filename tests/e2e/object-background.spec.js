// A background image on any object.
//
// One button with two states, because only one of them needs a panel: with no
// image on the object the button IS the file input - the browser's own picker
// - and with an image already there the input is switched off and the button
// opens a panel to tile it, move it or take it off.
//
// The image belongs to the OBJECT: it uploads with preferred_module 'object'
// - the module's own name, since upload_files() dispatches by calling
// "{preferred_module}_upload" - and the object's name, and the url points at the object
// rather than at the file in the shared directory, which is the arrangement
// image objects already use.

const fs = require('fs');
const path = require('path');
const { test, expect, waitForEditor, CONTENT } = require('./fixtures/hotglue.js');

const SAMPLE = path.join(__dirname, 'fixtures', 'sample.png');

const ATTRS = {
	type: 'text', module: 'text',
	'object-left': '300px', 'object-top': '300px',
	'object-width': '240px', 'object-height': '140px', 'object-zindex': '100',
	'text-background-color': 'transparent',
};

const byId = (page, id) => page.locator(`[id="${id}"]`);
const bgBtn = (page) => page.locator('#glue-contextmenu-object-background');
const pop = (page) => page.locator('.glue-background-popover');
const cssOf = (page, id, prop) => page.evaluate(([i, p]) =>
	getComputedStyle(document.getElementById(i))[p], [id, prop]);
const attrs = (hg) => hg.readObject('100000000001').attrs;

async function select(page, id) {
	await byId(page, id).click();
	await expect(bgBtn(page)).toBeVisible();
	await page.waitForTimeout(400);		// the menu fades in
}

test('with no image, the button is the file picker itself', async ({ page, hg }) => {
	const a = hg.addObject('100000000001', ATTRS, 'A');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await select(page, a);

	const input = bgBtn(page).locator('input[type=file]');
	await expect(input).toBeAttached();
	expect(await input.evaluate((e) => getComputedStyle(e).display),
		'the picker is hidden on an object that has no background yet').not.toBe('none');
	// and no panel opens on top of it
	await bgBtn(page).click({ position: { x: 2, y: 2 }, force: true });
	await expect(pop(page)).toHaveCount(0);
});

test('uploading sets it as the object background, stored on the object',
	async ({ page, hg }) => {
		const a = hg.addObject('100000000001', ATTRS, 'A');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await select(page, a);

		await bgBtn(page).locator('input[type=file]').setInputFiles(SAMPLE);

		await expect.poll(() => attrs(hg)['object-background-file'], { timeout: 10000 })
			.toBe('sample.png');
		expect(await cssOf(page, a, 'backgroundImage')).toContain('url(');
		// the file landed in the page's shared directory
		expect(fs.readdirSync(path.join(CONTENT, hg.pageName.split('.')[0], 'shared')))
			.toContain('sample.png');
	});

test('the object serves its own background, and it survives a reload',
	async ({ page, hg }) => {
		// the url points at the OBJECT; object_serve_resource() hands the
		// file over, the way image objects serve their picture
		const a = hg.addObject('100000000001', ATTRS, 'A');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await select(page, a);
		await bgBtn(page).locator('input[type=file]').setInputFiles(SAMPLE);
		await expect.poll(() => attrs(hg)['object-background-file'], { timeout: 10000 })
			.toBe('sample.png');

		const res = await page.request.get(`/?${a}`);
		expect(res.status(), 'the object did not serve its background').toBe(200);
		expect(res.headers()['content-type']).toContain('image');

		// and on the published page, from the stored attribute alone
		await page.goto(`/?${hg.pageName}`);
		const bg = await page.evaluate(() =>
			getComputedStyle(document.querySelector('.object')).backgroundImage);
		expect(bg).toContain('url(');
		expect(bg, 'the published page points at the shared file directly')
			.not.toContain('shared');
	});

test('with an image, the button opens the panel instead of the picker',
	async ({ page, hg }) => {
		const a = hg.addObject('100000000001',
			{ ...ATTRS, 'object-background-file': 'sample.png',
				'object-background-mime': 'image/png' }, 'A');
		fs.mkdirSync(path.join(CONTENT, hg.pageName.split('.')[0], 'shared'),
			{ recursive: true });
		fs.copyFileSync(SAMPLE,
			path.join(CONTENT, hg.pageName.split('.')[0], 'shared', 'sample.png'));
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await select(page, a);

		expect(await bgBtn(page).locator('input[type=file]')
			.evaluate((e) => getComputedStyle(e).display),
		'the file picker is still in front of the button').toBe('none');

		await bgBtn(page).click();
		await expect(pop(page)).toBeVisible();
		await expect(pop(page).locator('.glue-background-repeat')).toHaveCount(1);
		await expect(pop(page).locator('.glue-background-pad')).toHaveCount(1);
	});

test('tiling toggles and stores, and dragging moves the image',
	async ({ page, hg }) => {
		const a = hg.addObject('100000000001',
			{ ...ATTRS, 'object-background-file': 'sample.png',
				'object-background-mime': 'image/png' }, 'A');
		fs.mkdirSync(path.join(CONTENT, hg.pageName.split('.')[0], 'shared'),
			{ recursive: true });
		fs.copyFileSync(SAMPLE,
			path.join(CONTENT, hg.pageName.split('.')[0], 'shared', 'sample.png'));
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await select(page, a);
		await bgBtn(page).click();
		await expect(pop(page)).toBeVisible();

		await pop(page).locator('.glue-background-repeat').click();
		await expect.poll(() => cssOf(page, a, 'backgroundRepeat')).toBe('repeat');
		await expect.poll(() => attrs(hg)['object-background-repeat']).toBe('repeat');

		// dragging the pad moves the image; a click with no drag puts it back
		const pad = pop(page).locator('.glue-background-pad');
		const b = await pad.boundingBox();
		await page.mouse.move(b.x + b.width/2, b.y + b.height/2);
		await page.mouse.down();
		await page.mouse.move(b.x + b.width/2 + 30, b.y + b.height/2 + 20, { steps: 5 });
		await page.mouse.up();
		await expect.poll(() => cssOf(page, a, 'backgroundPosition')).toBe('30px 20px');
		await expect.poll(() => attrs(hg)['object-background-position']).toBe('30px 20px');

		await pad.click();
		await expect.poll(() => attrs(hg)['object-background-position']).toBe(undefined);
	});

test('removing it takes the image off the object', async ({ page, hg }) => {
	const a = hg.addObject('100000000001',
		{ ...ATTRS, 'object-background-file': 'sample.png',
			'object-background-mime': 'image/png' }, 'A');
	fs.mkdirSync(path.join(CONTENT, hg.pageName.split('.')[0], 'shared'),
		{ recursive: true });
	fs.copyFileSync(SAMPLE,
		path.join(CONTENT, hg.pageName.split('.')[0], 'shared', 'sample.png'));
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await select(page, a);
	await bgBtn(page).click();
	await expect(pop(page)).toBeVisible();

	await pop(page).locator('.glue-popover-reset').click();
	await expect(pop(page)).toHaveCount(0);
	await expect.poll(() => attrs(hg)['object-background-file']).toBe(undefined);
	expect(await cssOf(page, a, 'backgroundImage')).toBe('none');
});
