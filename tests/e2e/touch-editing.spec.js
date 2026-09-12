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

test('a finger drags the padding slider in the padding panel without scrolling the page',
	async ({ page, hg, browserName }) => {
		test.skip(browserName !== 'chromium',
			'no way to synthesise a touch drag outside Chromium');
		// the padding button used to be a drag target itself; it opens a panel
		// now (the way the transparency button became a slider in the
		// adjustment popout), and the panel's slider is a native range input:
		// no gesture layer, no touch-action, a finger just drags it
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

		await page.getByTitle(/change padding/).tap();
		const panel = page.locator('.glue-popover.glue-padding-popover');
		await expect(panel).toBeVisible();

		const outerBefore = await page.evaluate((i) => {
			const el = document.getElementById(i);
			return el.offsetWidth+','+el.offsetHeight;
		}, a);
		const slider = panel.locator('input[type="range"]').first();
		const box = await slider.boundingBox();
		const cdp = await page.context().newCDPSession(page);
		const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', {
			type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }],
		});
		// the thumb starts where the current padding is; drag it rightward
		// along the track - not to an exact per-pixel value, a native
		// slider's thumb geometry is the browser's, not the test's
		await touch('touchStart', box.x + box.width/2, box.y + box.height/2);
		for (let i = 1; i <= 8; i++) {
			await touch('touchMove', box.x + box.width/2 + i*5, box.y + box.height/2);
		}
		await touch('touchEnd');

		// the uniform row applies to all four sides, and it moved off the
		// default rather than resetting to it
		const pad = await page.evaluate((i) => {
			const s = getComputedStyle(document.getElementById(i));
			return [s.paddingLeft, s.paddingRight, s.paddingTop, s.paddingBottom];
		}, a);
		expect(pad[0]).not.toBe('15px');
		expect(pad[0]).toBe(pad[1]);
		expect(pad[0]).toBe(pad[2]);
		expect(pad[0]).toBe(pad[3]);

		// padding is internal: the outer box did not move, and the stored
		// size is the shrunken content area the panel computed it as
		await expect.poll(() => page.evaluate((i) => {
			const el = document.getElementById(i);
			return el.offsetWidth+','+el.offsetHeight;
		}, a)).toBe(outerBefore);
		const v = parseInt(pad[0]);
		await expect.poll(async () => {
			const stored = hg.readObject(a.split('.').pop()).attrs;
			const box = await page.evaluate((i) => {
				const el = document.getElementById(i);
				return [el.offsetWidth, el.offsetHeight];
			}, a);
			return stored['text-padding-x'] === v+'px'
				&& stored['text-padding-y'] === v+'px'
				&& stored['object-width'] === (box[0]-2*v)+'px'
				&& stored['object-height'] === (box[1]-2*v)+'px';
		}).toBe(true);
		// the finger let go over the panel, so the click that follows the
		// gesture must not have deselected the object
		await expect(byId(page, a)).toHaveClass(/glue-selected/);
		// the page can scroll, so a scroll here would prove the slider's
		// touch handling was missing
		expect(await page.evaluate(() => window.scrollY)).toBe(0);
	});

test('a tap on the padding button opens the padding panel without changing anything',
	async ({ page, hg, browserName }) => {
		// the button used to be a drag target whose click reset the padding;
		// the reset lives in the panel now, and opening it must be inert
		test.skip(browserName !== 'chromium',
			'no way to synthesise a touch drag outside Chromium');
		const a = hg.addObject('100000000001', ATTRS, 'hello world');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await byId(page, a).tap();
		await expect(byId(page, a)).toHaveClass(/glue-selected/);
		await page.waitForTimeout(400);		// the menu fades in

		// the box as it stands after selection, before the tap on the button
		const outerBefore = await page.evaluate((i) => {
			const el = document.getElementById(i);
			return el.offsetWidth+','+el.offsetHeight;
		}, a);
		const button = page.getByTitle(/change padding/);
		const box = await button.boundingBox();
		const cdp = await page.context().newCDPSession(page);
		await cdp.send('Input.dispatchTouchEvent', {
			type: 'touchStart', touchPoints: [{ x: box.x + box.width/2, y: box.y + box.height/2 }],
		});
		await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });

		// the panel is open, no padding was applied (there is no module
		// default any more), and the box has not moved
		await expect(page.locator('.glue-popover.glue-padding-popover')).toBeVisible();
		await expect.poll(() => page.evaluate((i) =>
			getComputedStyle(document.getElementById(i)).paddingLeft, a)).toBe('0px');
		await expect.poll(() => page.evaluate((i) => {
			const el = document.getElementById(i);
			return el.offsetWidth+','+el.offsetHeight;
		}, a)).toBe(outerBefore);
		await expect(byId(page, a)).toHaveClass(/glue-selected/);
	});
