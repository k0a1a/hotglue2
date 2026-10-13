// Resizing an image: its proportions are kept by default, and holding Shift
// frees them - the picture then stretches to fill the frame.
//
// This is the INVERSE of every other object, where shift locks the aspect
// ratio (resize.spec.js). The stretch is stored as image-stretch=yes, read
// back from the object-fit on the <img> child by image_alter_save(); without
// it the picture letterboxes (object-fit: contain, danja's call 2026-09-23).

const fs = require('fs');
const path = require('path');
const { test, expect, waitForEditor, CONTENT } = require('./fixtures/hotglue.js');

const SAMPLE_BYTES = fs.readFileSync(path.join(__dirname, 'fixtures', 'sample.png'));	// 120x80
const RATIO = 120 / 80;
const byId = (page, id) => page.locator(`[id="${id}"]`);

function seed(hg) {
	const dir = path.join(CONTENT, hg.pageName.split('.')[0], 'shared');
	fs.mkdirSync(dir, { recursive: true, mode: 0o777 });
	fs.writeFileSync(path.join(dir, 'sample.png'), SAMPLE_BYTES);
	return hg.addObject('100000000001', {
		type: 'image', module: 'image',
		'image-file': 'sample.png', 'image-file-mime': 'image/png',
		'image-file-width': '120', 'image-file-height': '80',
		'object-left': '300px', 'object-top': '300px',
		'object-width': '240px', 'object-height': '160px', 'object-zindex': '100',
	});
}

const sizeOf = (page, id) => page.evaluate((i) => {
	const el = document.getElementById(i);
	return [parseFloat(el.style.width), parseFloat(el.style.height)];
}, id);
const fitOf = (page, id) => page.evaluate((i) =>
	document.getElementById(i).querySelector(':scope > img').style.objectFit, id);

async function dragHandle(page, direction, dx, dy, modifier) {
	const handle = page.locator(`.moveable-control.moveable-${direction}`);
	await expect(handle).toBeVisible();
	const b = await handle.boundingBox();
	const from = [b.x + b.width / 2, b.y + b.height / 2];
	if (modifier) await page.keyboard.down(modifier);
	await page.mouse.move(from[0], from[1]);
	await page.mouse.down();
	for (let i = 1; i <= 6; i++) {
		await page.mouse.move(from[0] + (dx * i) / 6, from[1] + (dy * i) / 6);
	}
	await page.mouse.up();
	if (modifier) await page.keyboard.up(modifier);
}

async function open(page, hg, id) {
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await expect(byId(page, id).locator('img')).toHaveJSProperty('complete', true);
	await byId(page, id).click();
}

test('an image keeps its proportions when resized without shift', async ({ page, hg }) => {
	const id = seed(hg);
	await open(page, hg, id);

	await dragHandle(page, 'e', 120, 0);
	const [w, h] = await sizeOf(page, id);
	expect(w, 'the resize did not grow the image').toBeGreaterThan(300);
	expect(Math.abs(w / h - RATIO), `proportions drifted: ${w}x${h}`).toBeLessThan(0.02);
	expect(await fitOf(page, id)).toBe('contain');
});

test('shift frees the proportions and stretches the picture, and it is stored',
	async ({ page, hg }) => {
		const id = seed(hg);
		await open(page, hg, id);

		await dragHandle(page, 'e', 120, 0, 'Shift');
		const [w, h] = await sizeOf(page, id);
		expect(w, 'the resize did not grow the image').toBeGreaterThan(300);
		expect(h, 'shift should leave the height alone').toBeCloseTo(160, 0);
		expect(await fitOf(page, id)).toBe('fill');

		await expect.poll(() => hg.readObject('100000000001').attrs['image-stretch']).toBe('yes');

		// and it is what a visitor sees
		await page.goto(`/?${hg.pageName}`);
		await expect(byId(page, id).locator('> img')).toHaveCSS('object-fit', 'fill');
	});

test('a stretched image keeps its stretched proportions on the next plain resize',
	async ({ page, hg }) => {
		const id = seed(hg);
		await open(page, hg, id);
		await dragHandle(page, 'e', 120, 0, 'Shift');
		await expect.poll(() => hg.readObject('100000000001').attrs['image-stretch']).toBe('yes');
		const [w0, h0] = await sizeOf(page, id);

		await byId(page, id).click();
		await dragHandle(page, 'e', 60, 0);
		const [w, h] = await sizeOf(page, id);
		expect(w).toBeGreaterThan(w0 + 20);
		expect(Math.abs(w / h - w0 / h0), `${w}x${h} drifted from ${w0}x${h0}`).toBeLessThan(0.02);
		expect(await fitOf(page, id)).toBe('fill');
	});

test('shift-resizing back to the picture\'s own proportions drops the stretch',
	async ({ page, hg }) => {
		const id = seed(hg);
		await open(page, hg, id);
		await dragHandle(page, 'e', 120, 0, 'Shift');
		await expect.poll(() => hg.readObject('100000000001').attrs['image-stretch']).toBe('yes');

		await byId(page, id).click();
		// drag back by exactly the excess, so the frame has the picture's own shape again
		const [w0, h0] = await sizeOf(page, id);
		await dragHandle(page, 'e', -(w0 - h0 * RATIO), 0, 'Shift');
		const [w, h] = await sizeOf(page, id);
		expect(Math.abs(w / h - RATIO), `${w}x${h} is not the picture's shape`).toBeLessThan(0.01);
		expect(await fitOf(page, id)).toBe('contain');
		await expect.poll(() => hg.readObject('100000000001').attrs['image-stretch']).toBeUndefined();
	});

test('a plain resize of a non-image object is still free', async ({ page, hg }) => {
	// the inversion is for images only: resize.spec.js covers shift on text, this
	// guards that the image branch did not leak
	const id = hg.addObject('100000000001', {
		type: 'text', module: 'text',
		'object-left': '300px', 'object-top': '300px',
		'object-width': '200px', 'object-height': '100px',
		'object-zindex': '100', 'text-background-color': 'transparent',
	}, 'A');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await byId(page, id).click();

	await dragHandle(page, 'e', 140, 0);
	const [w0, h0] = await sizeOf(page, id);
	expect(h0, 'plain resize of a text object must stay free').toBeCloseTo(100, 0);
	expect(w0).toBeGreaterThan(250);
});
