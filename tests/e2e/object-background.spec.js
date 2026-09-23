// The object properties panel - and the background, which is most of it.
//
// One button that opens one panel, because the panel is where an object's own
// properties are set: what is under and on it (a colour and a picture, and what
// the picture does - tile it, move it, scale it), the inset between its box and
// its content (padding), and two things about the object itself (its flip and
// its transparency). The panel is a list of sections and each draws its own
// controls; the reset - the fold's last row, with the delete - runs them all
// and saves once, and the delete takes the picture and the file off the object.
//
// Since 2026-09-17 the panel is the house style, in two pieces: an icon row
// that is the panel from the outside - set the colour, set the picture, tile
// it, flip it both ways - and ONE "more knobs" fold holding everything with a
// label in it: x, y, scale, the padding, the transparency, and the delete and
// reset as its last row. The fold is closed when the panel opens, which is the
// whole point of it and the thing these tests had to learn. The rows are in the
// DOM either way, so counts and classes read the same folded or open - it is
// clicking, filling, tapping and measuring that need the way in (openFold
// below), and opening re-places the panel, so measure after it and never before.
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
// The background section is the page's background panel one action shorter: the
// page's fourth is the scroll toggle, which an object has no use for. The
// picture button used to BE the menu button - with no image the whole button
// was the file input, and only an object that already had a picture got a panel
// at all - and these tests used to assert that. The upload is one of the
// panel's actions now, and the four controls that describe the picture - the
// tile toggle up in the row, x, y and scale down in the fold - grey out and go
// inert together while there is no picture to describe.
//
// The image belongs to the OBJECT: it uploads with preferred_module 'object'
// - the module's own name, since upload_files() dispatches by calling
// "{preferred_module}_upload" - and the object's name, and the url points at the object
// rather than at the file in the shared directory, which is the arrangement
// image objects already use. The colour is the object's own background-color:
// a text object stores it as text-background-color, as it always has, and
// every other kind as object-background-color.
//
// Image objects have the full panel, background section included, since
// 2026-09-23: the picture moved out of the object's background-image into a
// child <img> (module_image.inc.php), so the background properties belong to
// the section alone and an image's transparency can show a colour or a
// picture through - danja's call. Before that the picture WAS the background
// and the section was omitted for the class.

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
// the panel's one fold, and the way in to everything with a label in it. The
// rows are in the DOM whether or not it is open, so counts and classes do not
// need it; anything that clicks, fills, taps or measures does, because a
// display:none control has no box to aim at.
const disclosure = (page) => pop(page).locator('.glue-popover-disclosure');
const advanced = (page) => pop(page).locator('.glue-popover-advanced');
async function openFold(page) {
	await disclosure(page).click();
	await expect(advanced(page)).toBeVisible();
}
// the panel's number fields (x, y, scale, padding, and the opacity one), so the
// ones that need naming are named - the bare .glue-popover-field matches several
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
		// the row of five: set the colour, set the picture, tile it, flip it
		// both ways - the panel from the outside, and one action more than the
		// page's panel has, which is the flip the page has no use for
		await expect(pop(page).locator('.glue-popover-icon')).toHaveCount(5);
		await expect(pop(page).locator('.glue-background-color')).toHaveCount(1);
		// and everything with a label is behind the one fold, closed to start
		// with: opening the panel on what you came for, not on ten rows
		await expect(disclosure(page)).toHaveCount(1);
		await expect(advanced(page)).toBeHidden();
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

test('the fold makes the panel taller without putting it over the object',
	async ({ page, hg }) => {
		// Panels are placed by $.glue.popover.place_for(), which scores every
		// candidate position with covering the selected object first - "no menu
		// or interface shall interfere with page elements". The fold changes the
		// panel's height, which is why fold() re-places on every toggle, and this
		// is the tallest this panel gets: the assertion is made with the fold
		// OPEN, which is the harder of the two cases.
		const a = hg.addObject('100000000001', ATTRS, 'A');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await select(page, a);
		await propsBtn(page).click();
		await expect(pop(page)).toBeVisible();
		await openFold(page);

		const panel = await pop(page).boundingBox();
		const object = await byId(page, a).boundingBox();
		const overlaps =
			panel.x < object.x + object.width && object.x < panel.x + panel.width &&
			panel.y < object.y + object.height && object.y < panel.y + panel.height;
		expect(overlaps, 'the open fold put the panel over the object').toBe(false);
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

test('an image object has the full panel, background section included',
	async ({ page, hg }) => {
		// the picture is a child img now (2026-09-23), so the background
		// section owns the object's background alone - no second owner, no
		// omission. The panel matches every other object's: colour, picture,
		// tile, position and scale, plus the flip pair and the transparency.
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
		// the background section is there in full
		await expect(p.locator('.glue-background-color')).toHaveCount(1);
		await expect(p.locator('.glue-background-image')).toHaveCount(1);
		await expect(p.locator('.glue-background-tile')).toHaveCount(1);
		await expect(p.locator('.glue-background-pos')).toHaveCount(2);
		await expect(p.locator('.glue-background-scale')).toHaveCount(1);
		// the flip pair in the row and, in the fold, the padding, the
		// transparency and the reset - the padding section came to image
		// objects with the video's in 2026-09-23
		await expect(p.locator('.glue-popover-icon')).toHaveCount(5);
		await expect(flipV(page)).toBeVisible();
		await expect(flipH(page)).toBeVisible();
		await openFold(page);
		await expect(p.locator('.glue-padding-row')).toHaveCount(1);
		await expect(p.locator('.glue-opacity-row')).toBeVisible();
		await expect(p.locator('.glue-popover-reset')).toBeVisible();
	});

test('an image object renders and keeps its background colour',
	async ({ page, hg }) => {
		// the picture (a child img) covers the frame; the background colour
		// shows through whatever the picture is transparent about - and the
		// save round-trip keeps the attr (2026-09-23)
		const img = hg.addObject('100000000004', {
			type: 'image', module: 'image',
			'image-file': 'sample.png', 'image-file-mime': 'image/png',
			'image-file-width': '120', 'image-file-height': '80',
			'object-background-color': '#ff0000',
			'object-left': '700px', 'object-top': '300px',
			'object-width': '120px', 'object-height': '80px', 'object-zindex': '100',
		});
		fs.mkdirSync(path.join(CONTENT, hg.pageName.split('.')[0], 'shared'),
			{ recursive: true });
		fs.copyFileSync(SAMPLE,
			path.join(CONTENT, hg.pageName.split('.')[0], 'shared', 'sample.png'));

		await page.goto(`/?${hg.pageName}`);
		await expect(byId(page, img).locator('img')).toHaveCount(1);
		// the picture keeps its proportions (contain), so the bars show the
		// background through - danja's call, 2026-09-23
		await expect(byId(page, img).locator('img')).toHaveCSS('object-fit', 'contain');
		await expect(byId(page, img)).toHaveCSS('background-color', 'rgb(255, 0, 0)');

		// and the editor's save keeps it
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await page.evaluate(() => new Promise((res) => {
			window.$.glue.backend({ method: 'glue.save_state',
				html: window.$.glue.object.to_html(document.querySelector('.image.object')) }, res);
		}));
		expect(hg.readObject('100000000004').attrs['object-background-color']).toBe('#ff0000');
	});

test('an image object renders and keeps its padding', async ({ page, hg }) => {
	// the picture letterboxes inside the padded content box, and the save
	// round-trip keeps the attrs (danja's call, 2026-09-23)
	const img = hg.addObject('100000000005', {
		type: 'image', module: 'image',
		'image-file': 'sample.png', 'image-file-mime': 'image/png',
		'image-file-width': '120', 'image-file-height': '80',
		'object-padding-x': '10px',
		'object-left': '700px', 'object-top': '400px',
		'object-width': '120px', 'object-height': '80px', 'object-zindex': '100',
	});
	fs.mkdirSync(path.join(CONTENT, hg.pageName.split('.')[0], 'shared'),
		{ recursive: true });
	fs.copyFileSync(SAMPLE,
		path.join(CONTENT, hg.pageName.split('.')[0], 'shared', 'sample.png'));

	await page.goto(`/?${hg.pageName}`);
	await expect(byId(page, img)).toHaveCSS('padding-left', '10px');
	await expect(byId(page, img)).toHaveCSS('padding-right', '10px');

	// and the editor's save keeps it
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await page.evaluate(() => new Promise((res) => {
		window.$.glue.backend({ method: 'glue.save_state',
			html: window.$.glue.object.to_html(document.querySelector('.image.object')) }, res);
	}));
	expect(hg.readObject('100000000005').attrs['object-padding-x']).toBe('10px');
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
		await expect(pop(page).locator('.glue-popover-icon')).toHaveCount(5);
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
		await openFold(page);

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
		await openFold(page);
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
	// the delete is the fold's last row now, with the reset - the house style's
	// one cost, and the reason this test has to go looking for it
	await openFold(page);

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
		await openFold(page);

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

test('transparency: typing applies live, the change commits',
	async ({ page, hg }) => {
		const a = hg.addObject('100000000001', ATTRS, 'A');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await select(page, a);
		await propsBtn(page).click();
		await expect(pop(page)).toBeVisible();
		// the row is the fold's, like every other labelled control: it is in the
		// DOM either way, but a folded row has no box to aim at
		await openFold(page);

		// one control, not two: the row is a scrub since 2026-09-17 - a number
		// you drag sideways or type into - so the slider whose live value this
		// test used to move is gone, and the two halves of the contract (applies
		// as you type, stores when you are done) are the field's input and change
		const field = opacityField(page);

		// the row opens at the object's current opacity
		expect(await field.inputValue()).toBe('100');

		// an input applies live (commit false)...
		await field.fill('30');
		await field.dispatchEvent('input');
		expect(await opacityOf(page, a)).toBe('0.3');
		// ...and the change that ends the edit is what stores it
		await field.dispatchEvent('change');
		await expect.poll(() => attrs(hg)['object-opacity']).toBe('0.3');

		// and the same contract for a value typed properly and confirmed
		await field.fill('60');
		await field.press('Enter');
		expect(await opacityOf(page, a)).toBe('0.6');
		await expect.poll(() => attrs(hg)['object-opacity']).toBe('0.6');
		expect(await field.inputValue()).toBe('60');
	});

test('the one reset clears every section it owns, in one save',
	async ({ page, hg }) => {
		// The panel's reset - the fold's last row, beside the delete - runs each
		// section's own reset in the order the sections were drawn, then saves
		// once. An object with all four sections set - a text object with a
		// background picture, padding, a flip and a dim - is the case that
		// exercises all of them.
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
		await openFold(page);

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
		// the fold is opened before `before` is read, not after: opening it
		// builds nothing and writes nothing, and reading the file with it open
		// makes that part of what this test proves rather than an assumption
		await openFold(page);

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
