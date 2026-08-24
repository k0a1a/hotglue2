// Editing with a finger.
//
// The editor was unreachable on a phone, and for one reason: Moveable's
// gesture layer calls preventDefault() on touchstart by default, which stops
// the browser synthesising the click that follows a tap. Everything the
// editor does begins with that click - selecting an object, opening its menu,
// and (a second tap later) editing its text - so a tap did nothing at all,
// silently, while a mouse worked perfectly.
//
// These run in a touch context. They are not a claim that the editor is
// COMFORTABLE on a phone - the drag-only controls still need a mouse, and
// hover tooltips still carry meaning that a finger cannot ask for - only that
// the basic loop is reachable, which it was not.

const { test, expect, waitForEditor } = require('./fixtures/hotglue.js');

test.use({ hasTouch: true, viewport: { width: 390, height: 780 } });

const ATTRS = {
	type: 'text', module: 'text',
	'object-left': '30px', 'object-top': '60px',
	'object-width': '250px', 'object-height': '120px', 'object-zindex': '100',
	'text-background-color': '#ffdd55', 'text-font-size': '18px',
};

const byId = (page, id) => page.locator(`[id="${id}"]`);

test('a tap selects the object and brings up its menu', async ({ page, hg }) => {
	const a = hg.addObject('100000000001', ATTRS, 'hello world');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);

	await byId(page, a).tap();
	await expect(byId(page, a)).toHaveClass(/glue-selected/);
	await expect(page.locator('.glue-contextmenu-left').first()).toBeVisible();
});

test('a second tap starts editing the text', async ({ page, hg }) => {
	const a = hg.addObject('100000000001', ATTRS, 'hello world');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);

	await byId(page, a).tap();
	await expect(byId(page, a)).toHaveClass(/glue-selected/);
	await byId(page, a).tap();
	await expect.poll(() => page.evaluate((i) =>
		document.querySelector(`[id="${i}"] > .glue-text-render`).isContentEditable, a))
		.toBe(true);
});

test('a tap on a menu button opens its panel', async ({ page, hg }) => {
	// the panels are the touch-ready half of the editor, by accident: they
	// were built out of range inputs, number fields and taps
	const a = hg.addObject('100000000001', ATTRS, 'hello world');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);

	await byId(page, a).tap();
	await page.waitForTimeout(400);		// the menu fades in
	await page.getByTitle(/font: face, size and style/).tap();
	await expect(page.locator('.glue-font-popover')).toBeVisible();
	// and a tap outside closes it again
	await page.touchscreen.tap(360, 700);
	await expect(page.locator('.glue-font-popover')).toHaveCount(0);
});

test('an object can be dragged with a finger, and the drag is not a tap',
	async ({ page, hg, browserName }) => {
		// Chromium only, and not because the behaviour is: a touch DRAG has
		// to be dispatched through CDP, since Playwright's touchscreen can
		// only tap. What is being tested here belongs to Moveable's gesture
		// layer, which is the same code on both engines.
		test.skip(browserName !== 'chromium',
			'no way to synthesise a touch drag outside Chromium');
		// letting the click through is what makes tapping work; a drag must
		// not also end in one, or it would select or deselect whatever it
		// finished over
		const a = hg.addObject('100000000001', ATTRS, 'drag me');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await byId(page, a).tap();
		await expect(byId(page, a)).toHaveClass(/glue-selected/);

		const box = await byId(page, a).boundingBox();
		const cdp = await page.context().newCDPSession(page);
		const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', {
			type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }],
		});
		await touch('touchStart', box.x + 120, box.y + 60);
		for (let i = 1; i <= 8; i++) {
			await touch('touchMove', box.x + 120 + i * 10, box.y + 60 + i * 5);
		}
		await touch('touchEnd');

		await expect.poll(() => page.evaluate((i) =>
			parseInt(document.getElementById(i).style.left, 10), a)).toBe(110);
		// still selected: the drag did not end in a click that toggled it
		await expect(byId(page, a)).toHaveClass(/glue-selected/);
		// and the page stayed put rather than scrolling under the finger
		expect(await page.evaluate(() => window.scrollY)).toBe(0);
	});

test('the page menu still opens from a tap on the background', async ({ page, hg }) => {
	hg.addObject('100000000001', ATTRS, 'hello');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);

	await page.touchscreen.tap(360, 700);
	await expect(page.locator('.glue-menu-new, .glue-menu').first()).toBeVisible();
});
