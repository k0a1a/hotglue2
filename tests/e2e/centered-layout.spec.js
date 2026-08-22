// Centered layout mode.
//
// Pages default to 'infinite' - hotglue's original unbounded canvas - and opt
// in per page. In centered mode the objects are wrapped in a
// position:relative container with margin:0 auto, and keep their EXACT stored
// coordinates: the wrapper's origin is where those coordinates were already
// measured from, so nothing about an object file changes and switching modes
// is only a question of whether the wrapper is emitted.
//
// The spike that preceded this (SPIKE-centered-layout.md) established the
// make-or-break property: dragging in centered mode stores the same coordinate
// infinite mode would. That is the first test here.

const { test, expect, waitForEditor } = require('./fixtures/hotglue.js');

const OBJ = (left, top) => ({
	type: 'text', module: 'text',
	'object-left': `${left}px`, 'object-top': `${top}px`,
	'object-width': '160px', 'object-height': '80px', 'object-zindex': '100',
	'text-background-color': 'transparent',
});
const WIDTH = 900;

const byId = (page, id) => page.locator(`[id="${id}"]`);
const rectOf = (page, id) => page.evaluate((i) => {
	const r = document.getElementById(i).getBoundingClientRect();
	return { x: Math.round(r.x), y: Math.round(r.y) };
}, id);

// opt the page in, the way the toggle does
function makeCentered(hg, width = WIDTH) {
	hg.addObject('page', { 'page-layout-mode': 'centered', 'page-container-width': String(width) });
}

async function drag(page, from, dx, dy) {
	await page.mouse.move(from[0], from[1]);
	await page.mouse.down();
	for (let i = 1; i <= 8; i++) {
		await page.mouse.move(from[0] + (dx * i) / 8, from[1] + (dy * i) / 8);
	}
	await page.mouse.up();
}

test('dragging stores the same coordinate in both modes', async ({ page, hg }) => {
	const results = {};
	for (const mode of ['infinite', 'centered']) {
		hg.destroy(); hg.create();
		const a = hg.addObject('100000000001', OBJ(200, 150), 'A');
		if (mode === 'centered') makeCentered(hg);
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		const r = await rectOf(page, a);
		await drag(page, [r.x + 80, r.y + 40], 120, 60);
		await expect.poll(() => hg.readObject('100000000001').attrs['object-left'],
			{ timeout: 4000 }).not.toBe('200px');
		results[mode] = {
			left: hg.readObject('100000000001').attrs['object-left'],
			top: hg.readObject('100000000001').attrs['object-top'],
		};
	}
	expect(results.centered, 'centered mode must store what infinite mode would')
		.toEqual(results.infinite);
});

test('infinite mode emits no wrapper at all', async ({ page, hg }) => {
	const a = hg.addObject('100000000001', OBJ(200, 150), 'A');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	expect(await page.locator('#hg-centered-wrapper').count(),
		'existing pages must render exactly as before').toBe(0);
	expect(await page.evaluate((i) =>
		document.getElementById(i).parentElement.tagName, a)).toBe('BODY');
});

test('centered mode wraps objects without moving their coordinates',
	async ({ page, hg }) => {
		const a = hg.addObject('100000000001', OBJ(200, 150), 'A');
		makeCentered(hg);
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);

		const info = await page.evaluate((i) => {
			const el = document.getElementById(i);
			return {
				parent: el.parentElement.id,
				offsetParent: el.offsetParent ? el.offsetParent.id : null,
				offsetLeft: el.offsetLeft,
				styleLeft: el.style.left,
			};
		}, a);
		expect(info.parent).toBe('hg-centered-wrapper');
		expect(info.offsetParent, 'the wrapper must be the positioning ancestor')
			.toBe('hg-centered-wrapper');
		expect(info.offsetLeft).toBe(200);
		expect(info.styleLeft, 'the stored coordinate must not change').toBe('200px');
		expect(hg.readObject('100000000001').attrs['object-left']).toBe('200px');
	});

test('the container re-centers on resize, in the editor too', async ({ page, hg }) => {
	// canvas.update() pins a pixel width on body in infinite mode, which would
	// center the wrapper once and never again - it has to branch on the mode
	const a = hg.addObject('100000000001', OBJ(200, 150), 'A');
	makeCentered(hg);
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);

	for (const width of [1280, 1100, 950]) {
		await page.setViewportSize({ width, height: 720 });
		await page.waitForTimeout(120);
		const vw = await page.evaluate(() => document.documentElement.clientWidth);
		expect((await rectOf(page, a)).x, `at viewport ${vw}`)
			.toBe(Math.round((vw - WIDTH) / 2) + 200);
	}
});

test('the page background still spans the viewport', async ({ page, hg }) => {
	hg.addObject('100000000001', OBJ(200, 150), 'A');
	hg.addObject('page', {
		'page-layout-mode': 'centered', 'page-container-width': String(WIDTH),
		'page-background-color': '#ff6600',
	});
	await page.goto(`/?${hg.pageName}`);
	await page.waitForTimeout(300);
	const out = await page.evaluate(() => ({
		htmlBg: getComputedStyle(document.documentElement).backgroundColor,
		wrapper: Math.round(document.getElementById('hg-centered-wrapper').getBoundingClientRect().width),
		viewport: document.documentElement.clientWidth,
	}));
	expect(out.htmlBg, 'the background is carried by the page, not the container')
		.toBe('rgb(255, 102, 0)');
	expect(out.wrapper).toBeLessThan(out.viewport);
});

test('content wider than the container overflows rather than clipping',
	async ({ page, hg }) => {
		hg.addObject('100000000001', OBJ(200, 150), 'in');
		const far = hg.addObject('100000000002', OBJ(WIDTH + 300, 150), 'out');
		makeCentered(hg);
		await page.goto(`/?${hg.pageName}`);
		await page.waitForTimeout(200);
		expect(await page.evaluate(() =>
			getComputedStyle(document.getElementById('hg-centered-wrapper')).overflow))
			.toBe('visible');
		expect(await page.evaluate((i) =>
			document.getElementById(i).getBoundingClientRect().width, far))
			.toBeGreaterThan(0);
	});

test('the toggle switches modes and stores infinite by absence', async ({ page, hg }) => {
	hg.addObject('100000000001', OBJ(200, 150), 'A');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);

	// page menu opens on double-clicking the background
	await page.mouse.dblclick(900, 500);
	await page.getByTitle(/click to center it in a fixed-width container/).click();
	await page.waitForLoadState('load');
	await expect(page.locator('#hg-centered-wrapper')).toHaveCount(1);
	expect(hg.readObject('page').attrs['page-layout-mode']).toBe('centered');

	await page.mouse.dblclick(900, 500);
	await page.getByTitle(/click for the unbounded canvas/).click();
	await page.waitForLoadState('load');
	await expect(page.locator('#hg-centered-wrapper')).toHaveCount(0);
	expect(hg.readObject('page').attrs['page-layout-mode'],
		'infinite is the default and is stored by absence').toBeUndefined();
});

test('the edge handles set the container width', async ({ page, hg }) => {
	hg.addObject('100000000001', OBJ(200, 150), 'A');
	makeCentered(hg);
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);

	const handles = page.locator('.glue-container-handle');
	await expect(handles).toHaveCount(2);
	const right = handles.nth(1);
	const box = await right.boundingBox();
	// drag the right edge outward by 100 - centered, so the width grows by 200
	await page.mouse.move(box.x + 4, 300);
	await page.mouse.down();
	await page.mouse.move(box.x + 54, 300);
	await page.mouse.move(box.x + 104, 300);
	await page.mouse.up();

	await expect.poll(() => Number(hg.readObject('page').attrs['page-container-width']),
		{ timeout: 4000 }).toBeGreaterThan(WIDTH + 150);
});

test('the context menu appears next to the object, not offset by the centring',
	async ({ page, hg }) => {
		// An object's offsetLeft is measured from the centring container, but
		// the menus are appended to body and positioned in PAGE space. Without
		// adding the container's offset they land short by however far the
		// container is centred - which put them off to the left of the object,
		// over the empty canvas beside it.
		const a = hg.addObject('100000000001', OBJ(400, 300), 'A');
		makeCentered(hg);
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await byId(page, a).click();

		const menu = page.locator('.glue-contextmenu, [id^="glue-contextmenu"]').first();
		await expect(menu).toBeVisible();
		const objBox = await byId(page, a).boundingBox();
		const menuBox = await menu.boundingBox();
		// the menu sits above/left of the object but must be near it, not off
		// beside the container
		expect(Math.abs(menuBox.x - objBox.x),
			`menu at x=${Math.round(menuBox.x)} but object at x=${Math.round(objBox.x)}`)
			.toBeLessThan(200);
	});

test('the same object gets the same menu position in both modes', async ({ page, hg }) => {
	const seen = {};
	for (const mode of ['infinite', 'centered']) {
		hg.destroy(); hg.create();
		const a = hg.addObject('100000000001', OBJ(400, 300), 'A');
		if (mode === 'centered') makeCentered(hg);
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await byId(page, a).click();
		const menu = page.locator('.glue-contextmenu, [id^="glue-contextmenu"]').first();
		await expect(menu).toBeVisible();
		const objBox = await byId(page, a).boundingBox();
		const menuBox = await menu.boundingBox();
		// distance from the object is what should match, not absolute position
		seen[mode] = Math.round(menuBox.x - objBox.x);
	}
	expect(seen.centered, 'the menu should sit the same distance from its object in both modes')
		.toBe(seen.infinite);
});

test('the drawn grid lines up with where objects snap', async ({ page, hg }) => {
	// snapping is in object space, the grid is drawn in page space - they have
	// to agree or the user snaps to positions the grid does not show
	const a = hg.addObject('100000000001', OBJ(200, 150), 'A');
	makeCentered(hg);
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);

	const gridX = await page.evaluate(() => {
		window.$.glue.grid.mode(1 | 2);			// draw it, and snap to it
		window.$.glue.grid.update(true);
		return window.$.glue.grid.x();
	});
	await page.waitForTimeout(150);

	// drag so the object snaps, then check a grid line sits at its left edge
	const r = await rectOf(page, a);
	await drag(page, [r.x + 80, r.y + 40], 137, 0);
	const snappedX = await page.evaluate((i) =>
		Math.round(document.getElementById(i).getBoundingClientRect().x), a);
	const lines = await page.evaluate(() => Array.from(
		document.querySelectorAll('.glue-grid-y')).map((e) =>
		Math.round(e.getBoundingClientRect().x)));

	expect(await page.evaluate((i) => parseFloat(document.getElementById(i).style.left) % 50, a),
		'the object should have snapped to the grid').toBe(0);
	expect(lines.some((x) => Math.abs(x - snappedX) <= 1),
		`no grid line at the snapped edge ${snappedX} (nearest lines ${lines
			.sort((p, q) => Math.abs(p - snappedX) - Math.abs(q - snappedX)).slice(0, 3)})`)
		.toBe(true);
	expect(gridX).toBeGreaterThan(0);
});
