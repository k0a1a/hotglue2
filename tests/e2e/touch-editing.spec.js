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
// COMFORTABLE on a phone - hover tooltips still carry meaning that a finger
// cannot ask for - only that the basic loop is reachable, which it was not.
// The drag-only controls work too now: the shared drag primitive
// ($.glue.slider) listens for pointer events, the buttons set
// touch-action: none on themselves, and a finger drags them exactly like a
// mouse. The transparency control that used to be one of those drag buttons
// is a plain range input in the adjustment popout now, which a finger drags
// with no gesture layer of its own. The last tests are those drags.

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
		// and the panels are reachable from there without another tap
		await expect(page.locator('.glue-contextmenu-left').first()).toBeVisible();
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

test('dragging an unselected object selects it', async ({ page, hg, browserName }) => {
	// it always did, by way of the click that followed the mouseup. That
	// click is suppressed now so a drag does not toggle whatever it finished
	// over, which means the selection has to be said out loud instead.
	test.skip(browserName !== 'chromium',
		'no way to synthesise a touch drag outside Chromium');
	const a = hg.addObject('100000000001', ATTRS, 'drag me');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await expect(byId(page, a)).not.toHaveClass(/glue-selected/);

	const box = await byId(page, a).boundingBox();
	const cdp = await page.context().newCDPSession(page);
	const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', {
		type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }],
	});
	await touch('touchStart', box.x + 100, box.y + 50);
	for (let i = 1; i <= 8; i++) {
		await touch('touchMove', box.x + 100 + i * 8, box.y + 50);
	}
	await touch('touchEnd');

	await expect(byId(page, a)).toHaveClass(/glue-selected/);
	await expect(page.locator('.glue-contextmenu-left').first()).toBeVisible();
});

test('a finger drags the opacity slider in the adjustment popout',
	async ({ page, hg, browserName }) => {
		test.skip(browserName !== 'chromium',
			'no way to synthesise a touch drag outside Chromium');
		// the transparency button used to be a drag button itself; it is a
		// range input in the adjustment popout now, so the touch story is the
		// browser's own slider: no gesture layer, no touch-action, a finger
		// just drags it
		const a = hg.addObject('100000000001', ATTRS, 'hello');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await byId(page, a).tap();
		await expect(byId(page, a)).toHaveClass(/glue-selected/);
		await page.waitForTimeout(400);		// the menu fades in
		await page.getByTitle('object adjustments').tap();
		await expect(page.locator('.glue-popover.glue-adjust-popover')).toBeVisible();

		const slider = page.locator('.glue-popover-slider');
		const box = await slider.boundingBox();
		const cdp = await page.context().newCDPSession(page);
		const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', {
			type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }],
		});
		// the thumb sits at 100 (the right end); drag it to a third of the
		// way along the track
		await touch('touchStart', box.x + box.width - 3, box.y + box.height/2);
		for (let i = 1; i <= 8; i++) {
			await touch('touchMove', box.x + box.width/3 + i, box.y + box.height/2);
		}
		await touch('touchEnd');

		// the object is dimmed - not to an exact per-pixel value, a native
		// slider's thumb geometry is the browser's, not the test's
		const opacity = await page.evaluate((i) =>
			parseFloat(getComputedStyle(document.getElementById(i)).opacity), a);
		expect(opacity).toBeLessThan(1);
		expect(opacity).toBeGreaterThan(0);
		// readObject takes the object's basename, not the full DOM id
		await expect.poll(() => hg.readObject(a.split('.').pop()).attrs['object-opacity'])
			.toBe(String(opacity));
		// the finger let go over the panel, so the click that follows the
		// gesture must not have deselected the object
		await expect(byId(page, a)).toHaveClass(/glue-selected/);
		expect(await page.evaluate(() => window.scrollY)).toBe(0);
	});

test('a finger drags the padding button in two dimensions without scrolling the page',
	async ({ page, hg, browserName }) => {
		test.skip(browserName !== 'chromium',
			'no way to synthesise a touch drag outside Chromium');
		const a = hg.addObject('100000000001', ATTRS, 'hello world');
		// a second object far down the page, so the page genuinely can scroll
		// - the scrollY assertion below only proves something if it could
		hg.addObject('100000000002', {
			type: 'text', module: 'text',
			'object-left': '30px', 'object-top': '900px',
			'object-width': '100px', 'object-height': '40px', 'object-zindex': '100',
			'text-background-color': '#ffdd55',
		}, 'dummy');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 2);
		await byId(page, a).tap();
		await expect(byId(page, a)).toHaveClass(/glue-selected/);
		await page.waitForTimeout(400);		// the menu fades in

		const button = page.locator('img[src*="text-padding.png"]');
		const box = await button.boundingBox();
		const cdp = await page.context().newCDPSession(page);
		const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', {
			type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }],
		});
		await touch('touchStart', box.x + box.width/2, box.y + box.height/2);
		for (let i = 1; i <= 8; i++) {
			await touch('touchMove', box.x + box.width/2 + i*8, box.y + box.height/2 + i*15);
		}
		await touch('touchEnd');

		// 60px of drag at a sixth of a pixel per px of padding, on top of the
		// text default of 15px/12px (stored padding would be 25px/32px): the
		// on-screen padding is 15+floor(64/6)=25, 12+floor(120/6)=32
		await expect.poll(() => page.evaluate((i) =>
			getComputedStyle(document.getElementById(i)).paddingLeft, a)).toBe('25px');
		await expect.poll(() => page.evaluate((i) =>
			getComputedStyle(document.getElementById(i)).paddingTop, a)).toBe('32px');
		await expect.poll(() => hg.readObject(a.split('.').pop()).attrs['text-padding-x']).toBe('25px');
		await expect.poll(() => hg.readObject(a.split('.').pop()).attrs['text-padding-y']).toBe('32px');
		await expect(byId(page, a)).toHaveClass(/glue-selected/);
		// the page can scroll, so a scroll here would prove touch-action was
		// missing on the button
		expect(await page.evaluate(() => window.scrollY)).toBe(0);
	});

test('a tap without a drag on a drag button keeps its click behaviour',
	async ({ page, hg, browserName }) => {
		// the 15px dead zone means a click-without-drag leaves the value
		// alone, which is what the padding button's click has always done (the
		// transparency button that shared the primitive is a slider in the
		// adjustment popout now, with a native click of its own)
		test.skip(browserName !== 'chromium',
			'no way to synthesise a touch drag outside Chromium');
		const a = hg.addObject('100000000001', ATTRS, 'hello world');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await byId(page, a).tap();
		await expect(byId(page, a)).toHaveClass(/glue-selected/);
		await page.waitForTimeout(400);		// the menu fades in

		const button = page.locator('img[src*="text-padding.png"]');
		const box = await button.boundingBox();
		const cdp = await page.context().newCDPSession(page);
		await cdp.send('Input.dispatchTouchEvent', {
			type: 'touchStart', touchPoints: [{ x: box.x + box.width/2, y: box.y + box.height/2 }],
		});
		await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });

		// 15px is the text module's default padding; the tap must not have
		// nudged it
		await expect.poll(() => page.evaluate((i) =>
			getComputedStyle(document.getElementById(i)).paddingLeft, a)).toBe('15px');
		await expect(byId(page, a)).toHaveClass(/glue-selected/);
	});
