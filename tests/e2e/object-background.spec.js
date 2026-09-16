// A background on any object.
//
// One button that opens one panel, because the panel is where the object's
// background is set: a colour and a picture, and what the picture does - tile
// it, move it, scale it - with a footer that either resets those to their
// defaults (keeping the picture) or deletes it (taking it and the file off the
// object). It is the page's background panel one button shorter: the page's
// fourth is the scroll toggle, which an object has no use for.
//
// The button used to be two buttons in one - with no image it WAS the file
// input, and only an object that already had a picture got a panel - and these
// tests used to assert that. The upload is one of the panel's buttons now, at
// 32px in an unlabelled row of three, and the tile toggle greys out when there
// is no picture to tile.
//
// The image belongs to the OBJECT: it uploads with preferred_module 'object'
// - the module's own name, since upload_files() dispatches by calling
// "{preferred_module}_upload" - and the object's name, and the url points at the object
// rather than at the file in the shared directory, which is the arrangement
// image objects already use. The colour is the object's own background-color:
// a text object stores it as text-background-color, as it always has, and
// every other kind as object-background-color.

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
// the panel has three number fields (x, y and scale), so the scale one is
// named - the bare .glue-popover-field matches all of them
const scaleField = (page) => pop(page).locator('.glue-background-scale .glue-popover-field');
const cssOf = (page, id, prop) => page.evaluate(([i, p]) =>
	getComputedStyle(document.getElementById(i))[p], [id, prop]);
const posOf = (page, id) => page.evaluate((i) => {
	const el = document.getElementById(i);
	return [parseFloat(el.style.left), parseFloat(el.style.top)];
}, id);
const attrs = (hg) => hg.readObject('100000000001').attrs;

async function select(page, id) {
	await byId(page, id).click();
	await expect(bgBtn(page)).toBeVisible();
	await page.waitForTimeout(400);		// the menu fades in
}

test('with no image, the button opens the panel and the picker is in it',
	async ({ page, hg }) => {
		const a = hg.addObject('100000000001', ATTRS, 'A');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await select(page, a);

		await bgBtn(page).click();
		await expect(pop(page)).toBeVisible();
		// the row of three: set the colour, set the picture, tile it
		await expect(pop(page).locator('.glue-background-btn')).toHaveCount(3);
		await expect(pop(page).locator('.glue-background-color')).toHaveCount(1);
		// the picture button IS a file picker, the way the menu button was
		const input = pop(page).locator('.glue-background-image input[type=file]');
		await expect(input).toBeAttached();
		expect(await input.evaluate((e) => getComputedStyle(e).display),
			'the picker is hidden on an object that has no background yet').not.toBe('none');
		// nothing to tile, so the toggle is greyed out and inert
		await expect(pop(page).locator('.glue-background-tile'))
			.toHaveClass(/glue-background-off/);

		// and with no picture to move the panel leaves the object its own drag
		// - arming a background that is not there would swallow it silently
		const before = await posOf(page, a);
		const b = await byId(page, a).boundingBox();
		await page.mouse.move(b.x + b.width/2, b.y + b.height/2);
		await page.mouse.down();
		await page.mouse.move(b.x + b.width/2 + 40, b.y + b.height/2, { steps: 5 });
		await page.mouse.up();
		await expect.poll(async () => (await posOf(page, a))[0])
			.toBeGreaterThan(before[0] + 30);
	});

test('uploading sets it as the object background, stored on the object',
	async ({ page, hg }) => {
		const a = hg.addObject('100000000001', ATTRS, 'A');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await select(page, a);

		await bgBtn(page).click();
		await expect(pop(page)).toBeVisible();
		await pop(page).locator('.glue-background-image input[type=file]')
			.setInputFiles(SAMPLE);

		await expect.poll(() => attrs(hg)['object-background-file'], { timeout: 10000 })
			.toBe('sample.png');
		expect(await cssOf(page, a, 'backgroundImage')).toContain('url(');
		// the file landed in the page's shared directory
		expect(fs.readdirSync(path.join(CONTENT, hg.pageName.split('.')[0], 'shared')))
			.toContain('sample.png');
		// the panel stays open - what you do next (tiling, sizing, moving) is in
		// here - and the tile toggle has something to tile now
		await expect(pop(page)).toBeVisible();
		await expect(pop(page).locator('.glue-background-tile'))
			.not.toHaveClass(/glue-background-off/);
	});

test('the colour button picks a colour, stored the way a text object stores one',
	async ({ page, hg }) => {
		const a = hg.addObject('100000000001', ATTRS, 'A');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await select(page, a);
		await bgBtn(page).click();
		await expect(pop(page)).toBeVisible();

		await pop(page).locator('.glue-background-color').click();
		await expect(page.locator('.picker_wrapper')).toBeVisible();
		// an exact colour rather than aiming at the gradient. Enter in the hex
		// field is vanilla-picker's own "done", so the picker closes on it
		const field = page.locator('.picker_editor input');
		await field.fill('#ff0000');
		await field.press('Enter');
		await expect(page.locator('.picker_wrapper')).toBeHidden();

		expect(await cssOf(page, a, 'backgroundColor')).toBe('rgb(255, 0, 0)');
		// text-background-color, as it has been since long before there was a
		// panel - the new object-background-color is for every other kind
		await expect.poll(() => attrs(hg)['text-background-color']).toBe('#ff0000');
		expect(attrs(hg)['object-background-color']).toBe(undefined);

		// and it reaches the published page
		await page.goto(`/?${hg.pageName}`);
		expect(await page.evaluate(() =>
			getComputedStyle(document.querySelector('.object')).backgroundColor))
			.toBe('rgb(255, 0, 0)');
	});

test("on any other kind of object the colour is the object's own",
	async ({ page, hg }) => {
		// an image object: not a text object, so text_alter_save() does not
		// carry the colour - object_alter_save()/object_alter_render_early()
		// do, in object-background-color.
		//
		// Unsized, deliberately: with image-file-width/-height the module paints
		// the picture onto the OBJECT as its background-image, and the panel
		// reads any background-image as a background of its own - the colour
		// button would ask to clear "the current background image" before it
		// opened the picker, and Playwright's default is to dismiss a dialog,
		// which is the cancel path. Unsized, the module appends an <img> and the
		// object's own background is empty, which is the state this test is
		// about.
		const a = hg.addObject('100000000002', {
			type: 'image', module: 'image',
			'image-file': 'sample.png', 'image-file-mime': 'image/png',
			'object-left': '300px', 'object-top': '300px',
			'object-width': '120px', 'object-height': '80px', 'object-zindex': '100',
		});
		fs.mkdirSync(path.join(CONTENT, hg.pageName.split('.')[0], 'shared'),
			{ recursive: true });
		fs.copyFileSync(SAMPLE,
			path.join(CONTENT, hg.pageName.split('.')[0], 'shared', 'sample.png'));
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		const attrsOf = () => hg.readObject('100000000002').attrs;

		await select(page, a);
		await bgBtn(page).click();
		await expect(pop(page)).toBeVisible();
		await pop(page).locator('.glue-background-color').click();
		const field = page.locator('.picker_editor input');
		await field.fill('#00ff00');
		await field.press('Enter');
		await expect(page.locator('.picker_wrapper')).toBeHidden();

		await expect.poll(() => attrsOf()['object-background-color']).toBe('#00ff00');
		expect(attrsOf()['text-background-color'], 'a non-text object has no text colour')
			.toBe(undefined);

		// it survives a reload, which is object_alter_render_early() reading it
		// back out of the attribute, and reaches the published page
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		expect(await cssOf(page, a, 'backgroundColor')).toBe('rgb(0, 255, 0)');
		await page.goto(`/?${hg.pageName}`);
		expect(await page.evaluate(() =>
			getComputedStyle(document.querySelector('.object')).backgroundColor))
			.toBe('rgb(0, 255, 0)');
	});

test('the object serves its own background, and it survives a reload',
	async ({ page, hg }) => {
		// the url points at the OBJECT; object_serve_resource() hands the
		// file over, the way image objects serve their picture
		const a = hg.addObject('100000000001', ATTRS, 'A');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await select(page, a);
		await bgBtn(page).click();
		await expect(pop(page)).toBeVisible();
		await pop(page).locator('.glue-background-image input[type=file]')
			.setInputFiles(SAMPLE);
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

test('the background button leads the top row, and the object-wide pair rides it',
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

		// both moved buttons ride the top row instead of the left column
		await expect(page.locator('#glue-contextmenu-object-adjust'))
			.toHaveClass(/glue-contextmenu-top/);
		await expect(page.locator('#glue-contextmenu-object-background'))
			.toHaveClass(/glue-contextmenu-top/);
		await expect(page.locator('.glue-contextmenu-left#glue-contextmenu-object-adjust'))
			.toHaveCount(0);
		await expect(page.locator('.glue-contextmenu-left#glue-contextmenu-object-background'))
			.toHaveCount(0);
		// background is prio 0 - the object-wide setting the rest of the row is
		// read against - so it is left-most, ahead of the text items (prios
		// 1-5), and adjust (7) stays at the end of them
		const order = await page.evaluate(() =>
			[...document.querySelectorAll('.glue-contextmenu-top')]
				.map((b) => b.id));
		expect(order[0]).toBe('glue-contextmenu-object-background');
		expect(order.indexOf('glue-contextmenu-object-background'))
			.toBeLessThan(order.indexOf('glue-contextmenu-text-font'));
		expect(order.indexOf('glue-contextmenu-text-font'))
			.toBeLessThan(order.indexOf('glue-contextmenu-object-adjust'));
	});

test('with an image, the panel opens onto the image it describes',
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
		await expect(pop(page).locator('.glue-background-btn')).toHaveCount(3);
		await expect(pop(page).locator('.glue-background-tile')).toHaveCount(1);
		// nothing stored about the tiling, so it is the renderer's own default
		// - no-repeat - and the toggle is lit only when the image repeats
		await expect(pop(page).locator('.glue-background-tile'))
			.not.toHaveClass(/glue-background-off/);
		await expect(pop(page).locator('.glue-background-tile'))
			.not.toHaveClass(/glue-btn-active/);
		// the position's two rows, x and y
		await expect(pop(page).locator('.glue-background-pos')).toHaveCount(2);
	});

test('tiling toggles and stores, and dragging the object moves the image',
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

		await pop(page).locator('.glue-background-tile').click();
		await expect.poll(() => cssOf(page, a, 'backgroundRepeat')).toBe('repeat');
		await expect.poll(() => attrs(hg)['object-background-repeat']).toBe('repeat');

		// the panel being open IS the move mode: there is no pad any more, and a
		// drag on the object itself moves the image, not the object
		const before = await posOf(page, a);
		const b = await byId(page, a).boundingBox();
		const cx = b.x + b.width/2;
		const cy = b.y + b.height/2;
		await page.mouse.move(cx, cy);
		await page.mouse.down();
		await page.mouse.move(cx + 30, cy + 20, { steps: 5 });
		await page.mouse.up();
		await expect.poll(() => cssOf(page, a, 'backgroundPosition')).toBe('30px 20px');
		await expect.poll(() => attrs(hg)['object-background-position']).toBe('30px 20px');
		expect(await posOf(page, a), 'the object moved instead of its image')
			.toEqual(before);

		// a click with no drag is NOT the pad's put-it-back: it leaves the
		// position alone (and does not start editing the text either)
		await page.mouse.click(cx, cy);
		await expect.poll(() => attrs(hg)['object-background-position']).toBe('30px 20px');
		expect(await cssOf(page, a, 'backgroundPosition')).toBe('30px 20px');

		// closing the panel gives the object its own drag back
		await page.keyboard.press('Escape');
		await expect(pop(page)).toHaveCount(0);
		const resting = await posOf(page, a);
		const b2 = await byId(page, a).boundingBox();
		await page.mouse.move(b2.x + b2.width/2, b2.y + b2.height/2);
		await page.mouse.down();
		await page.mouse.move(b2.x + b2.width/2 + 40, b2.y + b2.height/2, { steps: 5 });
		await page.mouse.up();
		// the object drags again: 40px asked for, at least 30 delivered
		await expect.poll(async () => (await posOf(page, a))[0])
			.toBeGreaterThan(resting[0] + 30);
		expect(await cssOf(page, a, 'backgroundPosition'), 'the background moved with it')
			.toBe('30px 20px');
	});

test('scale sizes the image, stores the bare number, and zero removes it',
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

		// an image nobody has scaled shows 100 - and nothing is stored, so a
		// fresh object and an untouched one stay byte-identical
		const field = scaleField(page);
		await expect(field).toHaveValue('100');
		expect(attrs(hg)['object-background-scale']).toBe(undefined);

		// typing a number sizes it, the height keeping the image's own ratio;
		// only the bare number is stored, never the composed '150% auto'
		await field.fill('150');
		await field.blur();
		// chromium reports the redundant 'auto' back as dropped ('150%');
		// firefox keeps it - the percentage is the part that matters
		await expect.poll(() => cssOf(page, a, 'backgroundSize')).toContain('150%');
		await expect.poll(() => attrs(hg)['object-background-scale']).toBe('150');
		expect(JSON.stringify(attrs(hg))).not.toContain('% auto');

		// it survives a reload and reaches the published page
		await page.goto(`/?${hg.pageName}`);
		expect(await page.evaluate(() =>
			getComputedStyle(document.querySelector('.object')).backgroundSize))
			.toContain('150%');

		// and back in the editor, a zero in the field removes the attribute
		// again - the "absent means default" convention
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await select(page, a);
		await bgBtn(page).click();
		await expect(pop(page)).toBeVisible();
		await scaleField(page).fill('0');
		await scaleField(page).blur();
		await expect.poll(() => attrs(hg)['object-background-scale']).toBe(undefined);
		await expect.poll(() => cssOf(page, a, 'backgroundSize')).toBe('auto');
	});

test('deleting it takes the image off the object', async ({ page, hg }) => {
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

	await pop(page).locator('.glue-popover-delete').click();
	await expect(pop(page)).toHaveCount(0);
	await expect.poll(() => attrs(hg)['object-background-file']).toBe(undefined);
	expect(await cssOf(page, a, 'backgroundImage')).toBe('none');
});

test('reset puts tiling, scale and move back to defaults, keeping the image',
	async ({ page, hg }) => {
		const a = hg.addObject('100000000001',
			{ ...ATTRS, 'object-background-file': 'sample.png',
				'object-background-mime': 'image/png',
				'object-background-repeat': 'repeat',
				'object-background-position': '30px 20px',
				'object-background-scale': '150' }, 'A');
		fs.mkdirSync(path.join(CONTENT, hg.pageName.split('.')[0], 'shared'),
			{ recursive: true });
		fs.copyFileSync(SAMPLE,
			path.join(CONTENT, hg.pageName.split('.')[0], 'shared', 'sample.png'));
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await select(page, a);
		await bgBtn(page).click();
		await expect(pop(page)).toBeVisible();
		// the panel is in the non-default state it was given, the position rows
		// reading it back out of the stored attribute
		await expect(pop(page).locator('.glue-background-tile'))
			.toHaveClass(/glue-btn-active/);
		await expect(pop(page).locator('.glue-background-pos .glue-popover-field'))
			.toHaveValues(['30', '20']);

		await pop(page).locator('.glue-popover-reset').click();
		// only the delete button takes the image off; the panel stays open
		await expect(pop(page)).toBeVisible();
		await expect.poll(() => attrs(hg)['object-background-file']).toBe('sample.png');
		expect(await cssOf(page, a, 'backgroundImage')).toContain('url(');
		// tiling, scale and move are back to their defaults: no-repeat (the
		// renderer's own default when the attribute is absent), the natural
		// size, and the corner
		await expect.poll(() => attrs(hg)['object-background-repeat'])
			.toBe('no-repeat');
		await expect.poll(() => attrs(hg)['object-background-position']).toBe(undefined);
		await expect.poll(() => attrs(hg)['object-background-scale']).toBe(undefined);
		expect(await cssOf(page, a, 'backgroundRepeat')).toBe('no-repeat');
		await expect.poll(() => cssOf(page, a, 'backgroundSize')).toBe('auto');
		// and the panel shows the defaults again
		await expect(pop(page).locator('.glue-background-tile'))
			.not.toHaveClass(/glue-btn-active/);
		await expect(scaleField(page)).toHaveValue('100');
		// the two position rows are back at the corner with it
		await expect(pop(page).locator('.glue-background-pos .glue-popover-field'))
			.toHaveValues(['0', '0']);
	});
