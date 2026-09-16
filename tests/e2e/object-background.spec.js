// The object properties panel - and the background, which is most of it.
//
// One button that opens one panel, because the panel is where an object's own
// properties are set: what is under and on it (a colour and a picture, and what
// the picture does - tile it, move it, scale it), the inset between its box and
// its content (padding), and two things about the object itself (its flip and
// its transparency). The panel is a list of sections and each draws its own
// rows; the footer's reset runs them all and saves once, and the background's
// delete button takes the picture and the file off the object.
//
// It was "object background" until 2026-09-16, and the padding, the flip and
// the transparency were somewhere else - the text menu's own padding button,
// and the object adjustments panel. Danja's call joined them: one panel per
// idea, and the idea is the object's own properties. What is left in the
// adjustments panel is the relation between an object and its neighbours
// (z-level), which is not a property of the object at all.
//
// This file keeps the background's name because the background is what most of
// its tests are about; the flip, the transparency and the object-with-no-
// background-section are here too, because it is the same panel's spec.
//
// The background section is the page's background panel one button shorter: the
// page's fourth is the scroll toggle, which an object has no use for. The
// picture button used to BE the menu button - with no image the whole button
// was the file input, and only an object that already had a picture got a panel
// at all - and these tests used to assert that. The upload is one of the
// panel's buttons now, at 32px in an unlabelled row of three, and the four
// controls that describe the picture - the tile toggle, x, y and scale - grey
// out and go inert together while there is no picture to describe.
//
// The image belongs to the OBJECT: it uploads with preferred_module 'object'
// - the module's own name, since upload_files() dispatches by calling
// "{preferred_module}_upload" - and the object's name, and the url points at the object
// rather than at the file in the shared directory, which is the arrangement
// image objects already use. The colour is the object's own background-color:
// a text object stores it as text-background-color, as it always has, and
// every other kind as object-background-color.
//
// Image objects have the panel, without its background section. A sized image
// object is painted *as* a background - the module puts the picture on the
// object's own background-image - so a section that also owned "the background"
// would be a second owner of one picture. It used to be kept out of the panel
// entirely by a veto in image-edit.js; the panel omits the one section instead,
// which is why an image object still gets its flip and its transparency.

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
const propsBtn = (page) => page.locator('#glue-contextmenu-object-properties');
const pop = (page) => page.locator('.glue-properties-popover');
// the panel has six number fields (x, y, scale, padding, and the opacity one),
// so the ones that need naming are named - the bare .glue-popover-field would
// match several
const scaleField = (page) => pop(page).locator('.glue-background-scale .glue-popover-field');
const opacityField = (page) => pop(page).locator('.glue-opacity-row .glue-popover-field');
const flipV = (page) => page.getByTitle('flip vertically');
const flipH = (page) => page.getByTitle('flip horizontally');
// everything in the panel that is about the picture - the tile toggle and the
// three number rows - and how many of the four are greyed out (.glue-background-
// off, the opacity-and-pointer-events state the toggles have always used)
const picture_controls = (page) => pop(page).locator(
	'.glue-background-tile, .glue-background-pos, .glue-background-scale');
const greyed = (page) => picture_controls(page).evaluateAll((els) =>
	els.filter((e) => e.classList.contains('glue-background-off')).length);
const cssOf = (page, id, prop) => page.evaluate(([i, p]) =>
	getComputedStyle(document.getElementById(i))[p], [id, prop]);
const posOf = (page, id) => page.evaluate((i) => {
	const el = document.getElementById(i);
	return [parseFloat(el.style.left), parseFloat(el.style.top)];
}, id);
const transformOf = (page, id) => page.evaluate((i) =>
	document.getElementById(i).style.getPropertyValue('transform'), id);
const opacityOf = (page, id) => page.evaluate((i) =>
	getComputedStyle(document.getElementById(i)).opacity, id);
const attrs = (hg) => hg.readObject('100000000001').attrs;

async function select(page, id) {
	await byId(page, id).click();
	await expect(propsBtn(page)).toBeVisible();
	await page.waitForTimeout(400);		// the menu fades in
}

test('with no image, the button opens the panel and the picker is in it',
	async ({ page, hg }) => {
		const a = hg.addObject('100000000001', ATTRS, 'A');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await select(page, a);

		await propsBtn(page).click();
		await expect(pop(page)).toBeVisible();
		// the row of three: set the colour, set the picture, tile it
		await expect(pop(page).locator('.glue-background-btn')).toHaveCount(3);
		await expect(pop(page).locator('.glue-background-color')).toHaveCount(1);
		// the picture button IS a file picker, the way the menu button was
		const input = pop(page).locator('.glue-background-image input[type=file]');
		await expect(input).toBeAttached();
		expect(await input.evaluate((e) => getComputedStyle(e).display),
			'the picker is hidden on an object that has no background yet').not.toBe('none');
		// nothing to tile, move or size, so the four controls that do those
		// things are greyed out and inert: the tile toggle and the x, y and
		// scale number rows
		await expect(pop(page).locator('.glue-background-tile'))
			.toHaveClass(/glue-background-off/);
		expect(await greyed(page), 'a row about a picture that is not there is live')
			.toBe(4);
		// and nothing ELSE is greyed: the flip and the transparency are about
		// the object, not its background, and are there whatever it has
		await expect(pop(page).locator('.glue-opacity-row'))
			.not.toHaveClass(/glue-background-off/);
		await expect(flipV(page)).toBeVisible();

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

		await propsBtn(page).click();
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
		// here - and the picture wakes the four controls that describe it where
		// they stand: the tile toggle and the x, y and scale rows
		await expect(pop(page)).toBeVisible();
		await expect(pop(page).locator('.glue-background-tile'))
			.not.toHaveClass(/glue-background-off/);
		await expect.poll(() => greyed(page),
			{ message: 'the upload did not wake the picture rows' }).toBe(0);
	});

test('the colour button picks a colour, stored the way a text object stores one',
	async ({ page, hg }) => {
		const a = hg.addObject('100000000001', ATTRS, 'A');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await select(page, a);
		await propsBtn(page).click();
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
		// an iframe object: not a text object, so text_alter_save() does not
		// carry the colour - object_alter_save()/object_alter_render_early()
		// do, in object-background-color.
		//
		// An image object is not a text object either, and it does get the
		// panel - but without its background section, so it has no colour
		// button to click. An iframe has no background of its own: the module
		// puts a transparent one on the inner iframe, never on the object,
		// which is the state this test is about.
		const a = hg.addObject('100000000002', {
			type: 'iframe', module: 'iframe',
			'object-left': '300px', 'object-top': '300px',
			'object-width': '120px', 'object-height': '80px', 'object-zindex': '100',
			'iframe-url': '//example.org/',
		});
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		const attrsOf = () => hg.readObject('100000000002').attrs;

		await select(page, a);
		await propsBtn(page).click();
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

test('an image object has the panel, minus the background section',
	async ({ page, hg }) => {
		// A sized image object is painted *as* a background: the module puts
		// the picture on the object's own background-image, and
		// image_alter_save() reads the tiling and position back out of that
		// same property. So the background section would find the picture where
		// it looks for a background, offer to clear it, and write its own
		// settings into the image's - which is why the panel does not build
		// that section for the class.
		//
		// It used to be a veto in image-edit.js instead, and the whole panel
		// went with it - so this test used to assert the button was absent. It
		// is the section that is absent now, and the test that follows is the
		// other half of what the veto used to take away.
		const img = hg.addObject('100000000003', {
			type: 'image', module: 'image',
			'image-file': 'sample.png', 'image-file-mime': 'image/png',
			'image-file-width': '120', 'image-file-height': '80',
			'object-left': '600px', 'object-top': '300px',
			'object-width': '120px', 'object-height': '80px', 'object-zindex': '100',
		});
		fs.mkdirSync(path.join(CONTENT, hg.pageName.split('.')[0], 'shared'),
			{ recursive: true });
		fs.copyFileSync(SAMPLE,
			path.join(CONTENT, hg.pageName.split('.')[0], 'shared', 'sample.png'));
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);

		await byId(page, img).click();
		await expect(propsBtn(page)).toBeVisible();
		await propsBtn(page).click();
		await expect(page.locator('.glue-popover.glue-properties-popover')).toBeVisible();

		const p = page.locator('.glue-properties-popover');
		// no background section: no colour button, no picture picker, no tile
		// toggle, and none of its three number rows or its delete button
		await expect(p.locator('.glue-background-btn')).toHaveCount(0);
		await expect(p.locator('.glue-background-tile')).toHaveCount(0);
		await expect(p.locator('.glue-background-pos')).toHaveCount(0);
		await expect(p.locator('.glue-background-scale')).toHaveCount(0);
		await expect(p.locator('.glue-popover-delete')).toHaveCount(0);
		// the rest of the panel is there: the flip, the transparency, the reset
		await expect(flipV(page)).toBeVisible();
		await expect(flipH(page)).toBeVisible();
		await expect(p.locator('.glue-opacity-row')).toBeVisible();
		await expect(p.locator('.glue-popover-reset')).toBeVisible();
		// and no padding either - that is the text module's own, and this is
		// not a text object
		await expect(p.locator('.glue-padding-row')).toHaveCount(0);
	});

test('the object serves its own background, and it survives a reload',
	async ({ page, hg }) => {
		// the url points at the OBJECT; object_serve_resource() hands the
		// file over, the way image objects serve their picture
		const a = hg.addObject('100000000001', ATTRS, 'A');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await select(page, a);
		await propsBtn(page).click();
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

test('the properties button leads the top row, and the object-wide pair rides it',
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
		await expect(propsBtn(page)).toHaveClass(/glue-contextmenu-top/);
		await expect(page.locator('.glue-contextmenu-left#glue-contextmenu-object-adjust'))
			.toHaveCount(0);
		await expect(page.locator('.glue-contextmenu-left#glue-contextmenu-object-properties'))
			.toHaveCount(0);
		// properties is prio 0 - the object-wide setting the rest of the row is
		// read against - so it is left-most, ahead of the text items (prios
		// 1-2), and adjust (7) stays at the end of them
		const order = await page.evaluate(() =>
			[...document.querySelectorAll('.glue-contextmenu-top')]
				.map((b) => b.id));
		expect(order[0]).toBe('glue-contextmenu-object-properties');
		expect(order.indexOf('glue-contextmenu-object-properties'))
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

		await propsBtn(page).click();
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
		await propsBtn(page).click();
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
		await propsBtn(page).click();
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
		await propsBtn(page).click();
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
	await propsBtn(page).click();
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
		await propsBtn(page).click();
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

//
// --- the flip ---------------------------------------------------------------
//
// The flip is two toggles, one per axis, independent of each other. They were
// in the adjustments panel until 2026-09-16, so the tests below came from
// object-adjust.spec.js with the toggles. The state lives in a matrix() term of
// the object's transform, which the transform module owns and stores whole - so
// these assert against the flat file the same way the rotation spec does.
//

test('the flip toggles are independent, tracked, and round-trip',
	async ({ page, hg }) => {
		const a = hg.addObject('100000000001', ATTRS, 'A');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await select(page, a);
		await propsBtn(page).click();
		await expect(pop(page)).toBeVisible();

		const active = (loc) => loc.evaluate((el) =>
			el.classList.contains('glue-btn-active'));

		// nothing flipped, nothing active
		expect(await transformOf(page, a)).toBe('');
		expect(await active(flipV(page))).toBe(false);
		expect(await active(flipH(page))).toBe(false);

		// one axis at a time: h is the a entry of the matrix, v the d
		await flipV(page).click();
		expect(await transformOf(page, a)).toContain('matrix(1, 0, 0, -1, 0, 0)');
		expect(await active(flipV(page))).toBe(true);
		expect(await active(flipH(page))).toBe(false);

		await flipH(page).click();
		expect(await transformOf(page, a)).toContain('matrix(-1, 0, 0, -1, 0, 0)');
		expect(await active(flipH(page))).toBe(true);

		// stored whole, the same way the rotation is
		await expect.poll(() => attrs(hg)['transform-flip'])
			.toBe('matrix(-1, 0, 0, -1, 0, 0)');

		// reopening the panel restores the toggle state from the object. The
		// panel opens at the click point and covers the menu, so the way to
		// close it is Escape, not a second click on the opener.
		await page.keyboard.press('Escape');
		await expect(pop(page)).toHaveCount(0);
		await propsBtn(page).click();
		await expect(pop(page)).toBeVisible();
		expect(await active(flipV(page))).toBe(true);
		expect(await active(flipH(page))).toBe(true);

		// each toggle off again removes just its axis, then all of it
		await flipH(page).click();
		expect(await transformOf(page, a)).toContain('matrix(1, 0, 0, -1, 0, 0)');
		expect(await active(flipH(page))).toBe(false);
		await flipV(page).click();
		expect(await transformOf(page, a)).toBe('');
		await expect.poll(() => attrs(hg)['transform-flip']).toBe(undefined);
	});

//
// --- the transparency -------------------------------------------------------
//

test('transparency: the slider applies live, the field commits',
	async ({ page, hg }) => {
		const a = hg.addObject('100000000001', ATTRS, 'A');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await select(page, a);
		await propsBtn(page).click();
		await expect(pop(page)).toBeVisible();

		const slider = pop(page).locator('.glue-opacity-row .glue-popover-slider');
		const field = opacityField(page);

		// the row opens at the object's current opacity
		expect(await slider.inputValue()).toBe('100');
		expect(await field.inputValue()).toBe('100');

		// a slider move applies live (commit false)...
		await slider.evaluate((el) => {
			el.value = 30;
			el.dispatchEvent(new Event('input', { bubbles: true }));
		});
		expect(await opacityOf(page, a)).toBe('0.3');
		// ...and the change that ends the drag is what stores it
		await slider.evaluate((el) => {
			el.dispatchEvent(new Event('change', { bubbles: true }));
		});
		await expect.poll(() => attrs(hg)['object-opacity']).toBe('0.3');

		// the field does the same for a typed value
		await field.fill('60');
		await field.press('Enter');
		expect(await opacityOf(page, a)).toBe('0.6');
		await expect.poll(() => attrs(hg)['object-opacity']).toBe('0.6');
		expect(await field.inputValue()).toBe('60');
	});

test('the one reset clears every section it owns, in one save',
	async ({ page, hg }) => {
		// The panel's footer runs each section's own reset in the order the
		// sections were drawn, then saves once. An object with all four
		// sections set - a text object with a background picture, padding, a
		// flip and a dim - is the case that exercises all of them.
		const a = hg.addObject('100000000001',
			{ ...ATTRS, 'object-background-file': 'sample.png',
				'object-background-mime': 'image/png',
				'object-background-repeat': 'repeat',
				'object-background-position': '30px 20px',
				'object-background-scale': '150',
				'transform-flip': 'matrix(-1, 0, 0, -1, 0, 0)',
				'object-opacity': '0.4' }, 'A');
		fs.mkdirSync(path.join(CONTENT, hg.pageName.split('.')[0], 'shared'),
			{ recursive: true });
		fs.copyFileSync(SAMPLE,
			path.join(CONTENT, hg.pageName.split('.')[0], 'shared', 'sample.png'));
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await select(page, a);
		await propsBtn(page).click();
		await expect(pop(page)).toBeVisible();

		await pop(page).locator('.glue-popover-reset').click();

		// the picture itself stays: only the delete button takes it off
		await expect.poll(() => attrs(hg)['object-background-file']).toBe('sample.png');
		expect(await cssOf(page, a, 'backgroundImage')).toContain('url(');
		// and every section is back at its default
		await expect.poll(() => attrs(hg)['object-background-repeat']).toBe('no-repeat');
		await expect.poll(() => attrs(hg)['object-background-position']).toBe(undefined);
		await expect.poll(() => attrs(hg)['object-background-scale']).toBe(undefined);
		await expect.poll(() => attrs(hg)['transform-flip']).toBe(undefined);
		await expect.poll(() => attrs(hg)['object-opacity']).toBe(undefined);
		expect(await transformOf(page, a)).toBe('');
		expect(await opacityOf(page, a)).toBe('1');
		await expect(scaleField(page)).toHaveValue('100');
		expect(await flipV(page).evaluate((el) =>
			el.classList.contains('glue-btn-active'))).toBe(false);
		expect(await flipH(page).evaluate((el) =>
			el.classList.contains('glue-btn-active'))).toBe(false);
		expect(await opacityField(page).inputValue()).toBe('100');
	});

test('reset writes nothing at all on an object nobody has touched',
	async ({ page, hg }) => {
		// Each section's reset clears only what is set, so a reset on an
		// untouched object is a save that stores nothing new: the file stays
		// byte-identical and the object is not handed a width and height it
		// never asked for (the padding reset compensates the box, and only does
		// so when there is padding to compensate).
		const a = hg.addObject('100000000001', ATTRS, 'A');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await select(page, a);
		await propsBtn(page).click();
		await expect(pop(page)).toBeVisible();

		const before = hg.readObject('100000000001').attrs;
		await pop(page).locator('.glue-popover-reset').click();
		await page.waitForTimeout(600);		// a save would have landed by now

		expect(hg.readObject('100000000001').attrs, 'the reset wrote something')
			.toEqual(before);
		// the box especially: the padding reset compensates the object's width
		// and height, and on an object with no padding it must not
		expect(await byId(page, a).evaluate((el) => el.style.width)).toBe('');
		expect(await byId(page, a).evaluate((el) => el.style.height)).toBe('');
		expect(await byId(page, a).evaluate((el) => el.style.paddingLeft)).toBe('');
	});
