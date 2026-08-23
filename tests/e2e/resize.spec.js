// Resize handles - MODERNIZATION.md section 11, scenario 3.
//
// That scenario says "resize via each of the 8 handles". There are THREE, not
// eight, and deliberately so: js/edit.js:947 sets
// renderDirections: ['e', 's', 'se'] because jQuery UI's resizable() only
// exposed those by default, so Moveable was configured to match. The
// assessment's "8" was an assumption about Moveable's defaults rather than a
// reading of what hotglue offers. Testing the three that exist - and asserting
// no others appear - is the faithful version of that scenario.

const { test, expect, waitForEditor } = require('./fixtures/hotglue.js');

const SIZE = { w: 200, h: 150 };
const AT = { left: 300, top: 300 };

const seed = (hg) => hg.addObject('100000000001', {
	type: 'text', module: 'text',
	'object-left': `${AT.left}px`, 'object-top': `${AT.top}px`,
	'object-width': `${SIZE.w}px`, 'object-height': `${SIZE.h}px`,
	'object-zindex': '100', 'text-background-color': 'transparent',
}, 'A');

const byId = (page, id) => page.locator(`[id="${id}"]`);
const sizeOf = (page, id) => page.evaluate((i) => {
	const el = document.getElementById(i);
	return [parseFloat(el.style.width), parseFloat(el.style.height)];
}, id);

// Drag a Moveable control by a delta. The handles are overlay elements outside
// the object (js/edit.js:1109 notes this), so they are located rather than
// computed from the object's box.
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

test('exactly the e, s and se handles are offered', async ({ page, hg }) => {
	const a = seed(hg);
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await byId(page, a).click();

	// Handles render asynchronously (js/edit.js:963 kicks off the render pass
	// Moveable needs before the control box becomes visible), so wait for them
	// rather than reading the DOM the instant the click returns.
	await expect(page.locator('.moveable-control.moveable-direction')).toHaveCount(3);
	const dirs = await page.evaluate(() => Array.from(
		document.querySelectorAll('.moveable-control.moveable-direction'))
		.map((el) => el.getAttribute('data-direction')).sort());
	expect(dirs).toEqual(['e', 's', 'se']);
});

test('no resize handles appear until an object is selected', async ({ page, hg }) => {
	const a = seed(hg);
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	// js/edit.js:944 - resizable is false until glue-select
	expect(await page.locator('.moveable-control.moveable-direction').count()).toBe(0);
	// Then prove that assertion was not vacuous: selecting DOES produce them,
	// so a count of zero above meant "not yet offered" rather than "not yet
	// rendered".
	await byId(page, a).click();
	await expect(page.locator('.moveable-control.moveable-direction')).toHaveCount(3);
});

for (const [dir, dx, dy, expects] of [
	['e', 120, 0, 'width only'],
	['s', 0, 90, 'height only'],
	['se', 120, 90, 'both'],
]) {
	test(`the ${dir} handle resizes ${expects}`, async ({ page, hg }) => {
		const a = seed(hg);
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await byId(page, a).click();

		await dragHandle(page, dir, dx, dy);
		const [w, h] = await sizeOf(page, a);

		if (dx) expect(w, 'width should have grown').toBeGreaterThan(SIZE.w + 50);
		else expect(w, 'width should not have changed').toBe(SIZE.w);
		if (dy) expect(h, 'height should have grown').toBeGreaterThan(SIZE.h + 40);
		else expect(h, 'height should not have changed').toBe(SIZE.h);

		// resizeEnd saves (js/edit.js:1097)
		await expect.poll(() => hg.readObject('100000000001').attrs['object-width'])
			.toBe(`${w}px`);
		expect(hg.readObject('100000000001').attrs['object-height']).toBe(`${h}px`);
	});
}

test('shift keeps the aspect ratio while resizing', async ({ page, hg }) => {
	const a = seed(hg);
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await byId(page, a).click();

	const ratio = SIZE.w / SIZE.h;
	await dragHandle(page, 'e', 140, 0, 'Shift');
	const [w, h] = await sizeOf(page, a);

	expect(w, 'shift-resize did not grow the object').toBeGreaterThan(SIZE.w + 50);
	// the e handle drives width; height should follow to preserve the ratio
	expect(Math.abs(w / h - ratio), `aspect ratio drifted: ${w}x${h} is ${w / h}, wanted ${ratio}`)
		.toBeLessThan(0.02);
});

test('a resize does not move the object', async ({ page, hg }) => {
	const a = seed(hg);
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await byId(page, a).click();

	const before = await page.evaluate((i) => {
		const el = document.getElementById(i);
		return [parseFloat(el.style.left), parseFloat(el.style.top)];
	}, a);
	await dragHandle(page, 'se', 120, 90);
	const after = await page.evaluate((i) => {
		const el = document.getElementById(i);
		return [parseFloat(el.style.left), parseFloat(el.style.top)];
	}, a);
	// none of e/s/se move the top-left anchor
	expect(after, 'resizing shifted the object').toEqual(before);
});

test('the handles sit outside the object, not across it', async ({ page, hg }) => {
	// "No menu or interface shall interfere with page elements" - the hotglue
	// design codex, and the early menu mock-up in hotglue-misc
	// (visuals/hotglue-menu-early-sq.jpg) draws every control clear of the
	// box. Moveable centres each handle ON the edge instead, leaving half of
	// it lying over the author's content, so css/edit.css pushes each one out
	// along its own axis.
	//
	// Worth a test rather than trusting the stylesheet: Moveable's CSS is
	// injected by css-styled, which prefixes its selectors with a generated
	// class, so its own .moveable-control outranks anything written here
	// short of !important - the offsets can look perfectly correct in the
	// file and do nothing at all.
	const a = seed(hg);
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await byId(page, a).click();
	await expect(page.locator('.moveable-control').first()).toBeVisible();

	const obj = await byId(page, a).boundingBox();
	const handles = await page.evaluate(() =>
		[...document.querySelectorAll('.moveable-control.moveable-direction')].map((e) => {
			const b = e.getBoundingClientRect();
			return { dir: (e.className.match(/moveable-(n|e|s|w|ne|nw|se|sw)\b/) || [])[1],
				left: b.left, top: b.top, right: b.right, bottom: b.bottom };
		}));
	expect(handles.length).toBe(3);

	// clear of the object's edge, with the 5px gap css/edit.css leaves
	for (const h of handles) {
		if (h.dir.includes('e')) {
			expect(h.left, `the ${h.dir} handle lies over the object`)
				.toBeGreaterThanOrEqual(obj.x + obj.width + 4);
		}
		if (h.dir.includes('s')) {
			expect(h.top, `the ${h.dir} handle lies over the object`)
				.toBeGreaterThanOrEqual(obj.y + obj.height + 4);
		}
	}
});
