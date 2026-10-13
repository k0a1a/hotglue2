// Resizing an image: its proportions are kept by default, and holding Shift
// frees them. The picture always fills its frame (object-fit stays at its
// default, fill), so a frame of another shape IS a stretch - there is no flag,
// which is how every image made before the child-img rewrite (2026-09-23) is
// stored. A letterboxing default drew all of those with bars: 2105 of the
// 6019 images in the 2025 corpus have a frame more than 1% off the picture's
// own shape.
//
// This is the INVERSE of every other object, where shift locks the aspect
// ratio (resize.spec.js).

const fs = require('fs');
const path = require('path');
const { test, expect, waitForEditor, CONTENT } = require('./fixtures/hotglue.js');

const SAMPLE_BYTES = fs.readFileSync(path.join(__dirname, 'fixtures', 'sample.png'));	// 120x80
const RATIO = 120 / 80;
const byId = (page, id) => page.locator(`[id="${id}"]`);

function seed(hg, w, h) {
	const dir = path.join(CONTENT, hg.pageName.split('.')[0], 'shared');
	fs.mkdirSync(dir, { recursive: true, mode: 0o777 });
	fs.writeFileSync(path.join(dir, 'sample.png'), SAMPLE_BYTES);
	return hg.addObject('100000000001', {
		type: 'image', module: 'image',
		'image-file': 'sample.png', 'image-file-mime': 'image/png',
		'image-file-width': '120', 'image-file-height': '80',
		'object-left': '300px', 'object-top': '300px',
		'object-width': `${w}px`, 'object-height': `${h}px`, 'object-zindex': '100',
	});
}

const sizeOf = (page, id) => page.evaluate((i) => {
	const el = document.getElementById(i);
	return [parseFloat(el.style.width), parseFloat(el.style.height)];
}, id);

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

test('a stored image with a frame of another shape renders stretched, on the page and in the editor',
	async ({ page, hg }) => {
		// no flag anywhere: this is the shape every pre-2026-09-23 page has
		const id = seed(hg, 300, 100);
		for (const url of [`/?${hg.pageName}`, hg.editUrl()]) {
			await page.goto(url);
			const img = byId(page, id).locator('> img');
			await expect(img).toHaveCSS('object-fit', 'fill');
			const o = await byId(page, id).boundingBox();
			const i = await img.boundingBox();
			expect(Math.abs(i.width - o.width), 'the picture does not span the frame').toBeLessThan(1);
			expect(Math.abs(i.height - o.height), 'the picture does not span the frame').toBeLessThan(1);
		}
	});

test('an image keeps its proportions when resized without shift', async ({ page, hg }) => {
	const id = seed(hg, 240, 160);
	await open(page, hg, id);

	await dragHandle(page, 'e', 120, 0);
	const [w, h] = await sizeOf(page, id);
	expect(w, 'the resize did not grow the image').toBeGreaterThan(300);
	expect(Math.abs(w / h - RATIO), `proportions drifted: ${w}x${h}`).toBeLessThan(0.02);
});

test('shift frees the proportions, the picture stretches with the frame, and it is stored',
	async ({ page, hg }) => {
		const id = seed(hg, 240, 160);
		await open(page, hg, id);

		await dragHandle(page, 'e', 120, 0, 'Shift');
		const [w, h] = await sizeOf(page, id);
		expect(w, 'the resize did not grow the image').toBeGreaterThan(300);
		expect(h, 'shift should leave the height alone').toBeCloseTo(160, 0);
		await expect(byId(page, id).locator('> img')).toHaveCSS('object-fit', 'fill');

		// the frame is the whole record: no stretch flag is written
		await expect.poll(() => parseFloat(hg.readObject('100000000001').attrs['object-width']))
			.toBeGreaterThan(300);
		expect(hg.readObject('100000000001').attrs['image-stretch']).toBeUndefined();

		// and a visitor sees the picture spanning the frame
		await page.goto(`/?${hg.pageName}`);
		const o = await byId(page, id).boundingBox();
		const i = await byId(page, id).locator('> img').boundingBox();
		expect(Math.abs(i.width - o.width)).toBeLessThan(1);
		expect(Math.abs(i.height - o.height)).toBeLessThan(1);
	});

test('a plain resize of a stretched image keeps the frame\'s shape', async ({ page, hg }) => {
	const id = seed(hg, 300, 100);
	await open(page, hg, id);

	await dragHandle(page, 'e', 90, 0);
	const [w, h] = await sizeOf(page, id);
	expect(w).toBeGreaterThan(350);
	expect(Math.abs(w / h - 3), `${w}x${h} drifted from 3:1`).toBeLessThan(0.05);
});

test('a plain resize of a non-image object is still free', async ({ page, hg }) => {
	// the inversion is for images only: resize.spec.js covers shift on text,
	// this guards that the image branch did not leak
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
