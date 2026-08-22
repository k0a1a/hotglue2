// Drag modifiers, keyboard nudge and viewport-edge auto-scroll -
// MODERNIZATION.md section 11, scenarios 4, 5 and 6.
//
// Auto-scroll is section 8 item 4: "jQuery UI's viewport-edge auto-scroll
// during drag is never explicitly coded anywhere - it's a default behavior of
// .draggable(). Easy to lose silently when swapping to Moveable; put it in the
// test suite explicitly." It was not lost - js/edit.js:953-956 configures
// Moveable's scrollable/scrollThreshold and js/edit.js:1053 does the scrolling
// - but only one axis of it actually works. See the vertical test below.

const { test, expect, waitForEditor } = require('./fixtures/hotglue.js');

const box = (left, top, extra = {}) => ({
	type: 'text', module: 'text',
	'object-left': `${left}px`, 'object-top': `${top}px`,
	'object-width': '150px', 'object-height': '100px', 'object-zindex': '100',
	'text-background-color': 'transparent', ...extra,
});

const byId = (page, id) => page.locator(`[id="${id}"]`);
const posOf = (page, id) => page.evaluate((i) => {
	const el = document.getElementById(i);
	return [parseFloat(el.style.left), parseFloat(el.style.top)];
}, id);

// Press through a drag without releasing, so callers can assert mid-gesture.
async function dragHold(page, from, dx, dy, steps = 8) {
	await page.mouse.move(from[0], from[1]);
	await page.mouse.down();
	for (let i = 1; i <= steps; i++) {
		await page.mouse.move(from[0] + (dx * i) / steps, from[1] + (dy * i) / steps);
	}
}

// Sit at a point, jiggling so Moveable keeps getting pointer events, until
// `axis` scrolls or we give up. A fixed number of ticks was flaky: it passed
// in isolation and failed in a full run, because Moveable's scroll throttle
// (30ms) plus a loaded machine can outlast any wait short enough to be worth
// having. Polling for the outcome removes the guess.
async function holdUntilScroll(page, x, y, axis, ticks = 40) {
	const read = axis === 'x' ? (() => window.scrollX) : (() => window.scrollY);
	await page.mouse.move(x, y);
	for (let i = 0; i < ticks; i++) {
		await page.waitForTimeout(50);
		await page.mouse.move(x - (i % 2), y - (i % 2));	// keep events coming
		const at = await page.evaluate(read);
		if (at > 0) return at;
	}
	return 0;
}

test('shift-drag constrains movement to one axis', async ({ page, hg }) => {
	const a = hg.addObject('100000000001', box(200, 200), 'A');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);

	await page.keyboard.down('Shift');
	// mostly horizontal, so the axis should latch to x and top should not move
	await dragHold(page, [275, 250], 200, 40);
	const [left, top] = await posOf(page, a);
	await page.mouse.up();
	await page.keyboard.up('Shift');

	expect(top, 'shift-drag let the object move off-axis').toBe(200);
	expect(left).toBeGreaterThan(300);
});

test('grid snapping applies on drag, and ctrl suppresses it', async ({ page, hg }) => {
	const a = hg.addObject('100000000001', box(200, 200), 'A');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);

	// bit 2 is "snap while dragging" (js/edit.js:1023)
	const grid = await page.evaluate(() => {
		window.$.glue.grid.mode(2);
		return [window.$.glue.grid.x(), window.$.glue.grid.y()];
	});
	expect(grid[0], 'grid spacing should be a positive number').toBeGreaterThan(0);

	await dragHold(page, [275, 250], 137, 83);
	const snapped = await posOf(page, a);
	await page.mouse.up();
	expect(snapped[0] % grid[0], 'left did not snap to the grid').toBe(0);
	expect(snapped[1] % grid[1], 'top did not snap to the grid').toBe(0);

	// ctrl held: the same drag should land off-grid
	await page.keyboard.down('Control');
	await dragHold(page, [snapped[0] + 75, snapped[1] + 50], 137, 83);
	const free = await posOf(page, a);
	await page.mouse.up();
	await page.keyboard.up('Control');
	expect(free[0] % grid[0] !== 0 || free[1] % grid[1] !== 0,
		'ctrl-drag still snapped to the grid').toBe(true);
});

test('arrow keys nudge the selection by a pixel and persist it', async ({ page, hg }) => {
	const a = hg.addObject('100000000001', box(200, 200), 'A');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);

	await byId(page, a).click();
	// Selecting shifts the object by half the selection border, so measure the
	// nudges as deltas from the SELECTED position rather than from the seeded
	// one - see group-drag.spec.js for what that offset is and why.
	const from = await posOf(page, a);
	await page.keyboard.press('ArrowRight');
	await page.keyboard.press('ArrowRight');
	await page.keyboard.press('ArrowDown');
	const to = await posOf(page, a);
	expect([to[0] - from[0], to[1] - from[1]], 'arrow keys should nudge one pixel each')
		.toEqual([2, 1]);

	// keyup triggers glue-movestop, which saves (js/edit.js:1601). What lands
	// on disk is the true position: the border offset is added back by
	// register_alter_pre_save('glue-selected'), so it is the seeded 200/200
	// plus the nudges, with no pixel left over.
	await expect.poll(() => hg.readObject('100000000001').attrs['object-left']).toBe('202px');
	expect(hg.readObject('100000000001').attrs['object-top']).toBe('201px');
});

test('shift-arrow nudges by a whole grid step', async ({ page, hg }) => {
	const a = hg.addObject('100000000001', box(200, 200), 'A');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);

	const [gx] = await page.evaluate(() => [window.$.glue.grid.x(), window.$.glue.grid.y()]);
	await byId(page, a).click();
	const before = (await posOf(page, a))[0];
	await page.keyboard.press('Shift+ArrowRight');
	expect((await posOf(page, a))[0] - before, 'shift-arrow should step one grid cell')
		.toBe(gx);
	await expect.poll(() => hg.readObject('100000000001').attrs['object-left'])
		.toBe(`${200 + gx}px`);
});

test('dragging to the right edge auto-scrolls the page', async ({ page, hg }) => {
	hg.addObject('100000000001', box(200, 200), 'A');
	hg.addObject('100000000002', box(3000, 2500), 'FAR');	// make the document large
	await page.goto(hg.editUrl());
	await waitForEditor(page, 2);

	const vw = await page.evaluate(() => document.documentElement.clientWidth);
	await dragHold(page, [275, 250], 900, 0);
	const scrolled = await holdUntilScroll(page, vw - 10, 250, 'x');
	await page.mouse.up();

	expect(scrolled, 'no horizontal auto-scroll while dragging at the edge')
		.toBeGreaterThan(0);
});

test('dragging to the bottom edge auto-scrolls the page', async ({ page, hg }) => {
	test.fail();
	// KNOWN BUG. Moveable measures its scroll-trigger zone from the rect of
	// scrollContainer, which is document.documentElement (js/edit.js:954).
	// That element's border box is the viewport WIDTH but the full document
	// HEIGHT - measured 1280x2624 against a 1280x720 viewport - so its bottom
	// edge sits ~1900px below the fold and the 40px scrollThreshold can never
	// be reached vertically. Moveable emits direction [1,0] on every tick and
	// never [0,1], so js/edit.js:1053 scrolls only sideways.
	//
	// It matters more than the horizontal case: hotglue canvases are typically
	// far taller than wide (content/zinecamp2015 is 1642x5976, content/mort
	// 4220x17590), so this is the axis people actually need.
	hg.addObject('100000000001', box(200, 200), 'A');
	hg.addObject('100000000002', box(3000, 2500), 'FAR');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 2);

	const vh = await page.evaluate(() => document.documentElement.clientHeight);
	await dragHold(page, [275, 250], 0, 400);
	const scrolled = await holdUntilScroll(page, 275, vh - 10, 'y');
	await page.mouse.up();

	expect(scrolled, 'no vertical auto-scroll while dragging at the edge')
		.toBeGreaterThan(0);
});
