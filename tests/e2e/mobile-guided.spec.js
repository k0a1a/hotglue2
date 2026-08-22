// The mobile guided view - js/mobile-guided.js, SOW-mobile-guided-view.md.
//
// Everything about this feature had been established by hand on phones and
// nothing by test, which is the wrong way round for code that ships to every
// visitor. What can be checked in a desktop browser at a phone-sized viewport
// is checked here, on BOTH engines; what genuinely needs hardware - the pinch
// floor and real touch gestures - stays in tests/e2e/android-check.js.

const { test, expect } = require('./fixtures/hotglue.js');

const OBJ = (left, top, w = 400, h = 300) => ({
	type: 'text', module: 'text',
	'object-left': `${left}px`, 'object-top': `${top}px`,
	'object-width': `${w}px`, 'object-height': `${h}px`, 'object-zindex': '100',
	'text-background-color': '#ffff00',
});
const PHONE = { width: 360, height: 649 };

// a canvas far larger than the viewport, and taller than it is wide
function bigPage(hg) {
	hg.addObject('100000000001', OBJ(100, 100), 'A');
	hg.addObject('100000000002', OBJ(1500, 4000), 'B');
}

const state = (page) => page.evaluate(() => {
	const c = document.getElementById('hg-mg-canvas');
	return {
		active: !!c,
		scale: c ? +new DOMMatrixReadOnly(getComputedStyle(c).transform).a.toFixed(4) : null,
		easing: c ? getComputedStyle(c).transitionTimingFunction : null,
	};
});

test('activates on a small screen when the canvas is wider than the viewport',
	async ({ page, hg }) => {
		bigPage(hg);
		await page.setViewportSize(PHONE);
		await page.goto(`/?${hg.pageName}`);
		await expect.poll(async () => (await state(page)).active).toBe(true);
	});

test('leaves a page that already fits alone', async ({ page, hg }) => {
	// one small object: nothing overflows, so there is nothing to guide
	hg.addObject('100000000001', OBJ(10, 10, 200, 100), 'A');
	await page.setViewportSize(PHONE);
	await page.goto(`/?${hg.pageName}`);
	await page.waitForTimeout(600);
	expect((await state(page)).active, 'a page that fits must be left untouched').toBe(false);
});

test('stays out of the editor entirely', async ({ page, hg }) => {
	bigPage(hg);
	await page.setViewportSize(PHONE);
	await page.goto(hg.editUrl());
	await page.waitForTimeout(600);
	expect((await state(page)).active, 'the guided view must never load in the editor')
		.toBe(false);
	expect(await page.evaluate(() =>
		Array.from(document.scripts).some((s) => /mobile-guided/.test(s.src))),
	'the script itself should not even be on the page').toBe(false);
});

test('does not activate on a wide screen, and ?guided=1 forces it', async ({ page, hg }) => {
	bigPage(hg);
	await page.setViewportSize({ width: 1280, height: 720 });
	await page.goto(`/?${hg.pageName}`);
	await page.waitForTimeout(500);
	expect((await state(page)).active).toBe(false);

	await page.goto(`/?${hg.pageName}&guided=1`);
	await expect.poll(async () => (await state(page)).active).toBe(true);
});

test('?guided=0 turns it off on a small screen', async ({ page, hg }) => {
	bigPage(hg);
	await page.setViewportSize(PHONE);
	await page.goto(`/?${hg.pageName}&guided=0`);
	await page.waitForTimeout(600);
	expect((await state(page)).active).toBe(false);
});

test('opens at 75% of the limiting dimension and reveals to natural size',
	async ({ page, hg }) => {
		bigPage(hg);
		await page.setViewportSize(PHONE);
		await page.goto(`/?${hg.pageName}&debug=1`);
		await expect.poll(async () => (await state(page)).active).toBe(true);

		// canvas is 1900 x 4200 from the two objects above
		const dbg = await page.evaluate(() => {
			const t = document.getElementById('hg-mg-dbg').textContent;
			const g = (k) => (new RegExp(k + ': ([\\d.]+)').exec(t) || [])[1];
			return { fitWidth: +g('fitWidth'), fitHeight: +g('fitHeight'), start: +g('startScale') };
		});
		// the LIMITING dimension drives it - here the height
		const limiting = Math.min(dbg.fitWidth, dbg.fitHeight);
		expect(dbg.start).toBeCloseTo(limiting / 0.75, 3);
		expect(dbg.fitHeight, 'this fixture should be height-limited')
			.toBeLessThan(dbg.fitWidth);

		await expect.poll(async () => (await state(page)).scale, { timeout: 8000 }).toBe(1);
	});

test('the zoom is paced in log space, not linearly', async ({ page, hg }) => {
	// a CSS transition interpolates scale LINEARLY, which over these ratios
	// puts most of the apparent movement in the first fraction of the move.
	// zoom_transition() supplies a sampled linear() easing instead.
	bigPage(hg);
	await page.setViewportSize(PHONE);
	await page.goto(`/?${hg.pageName}`);
	await expect.poll(async () => (await state(page)).active).toBe(true);
	await expect.poll(async () => (await state(page)).easing || '',
		{ timeout: 5000 }).toContain('linear(');
});

test('honours prefers-reduced-motion by landing directly', async ({ browser, hg }) => {
	bigPage(hg);
	const context = await browser.newContext({
		reducedMotion: 'reduce', viewport: PHONE,
		httpCredentials: { username: 'e2e', password: 'e2e-secret' },
		baseURL: 'http://127.0.0.1:8123',
	});
	const page = await context.newPage();
	await page.goto(`/?${hg.pageName}`);
	await expect.poll(async () => (await state(page)).active).toBe(true);
	// no dwell, no animation - it is simply already there
	expect((await state(page)).scale, 'reduced motion should skip the reveal entirely')
		.toBe(1);
	await context.close();
});

test('lands on content rather than on empty canvas', async ({ page, hg }) => {
	// The canvas origin is the leftmost/topmost object ANYWHERE on the page,
	// which need not be anywhere near where the reveal ends. On content/mort
	// the leftmost object is 2230px down and the topmost is off to the right,
	// so landing at the origin spent 157px of a 384px screen on blank
	// background horizontally and 249px vertically.
	//
	// This is not the entry-point selection removed in 4809d62 - it chooses no
	// object to feature, it only declines to land on nothing.
	hg.addObject('100000000001', OBJ(900, 800), 'what you should land on');
	hg.addObject('100000000002', OBJ(20, 6000), 'leftmost, but far below');
	hg.addObject('100000000003', OBJ(3000, 0), 'topmost, but far right');
	await page.setViewportSize(PHONE);
	await page.goto(`/?${hg.pageName}&debug=1`);
	await expect.poll(async () => (await state(page)).active).toBe(true);
	await expect.poll(async () => (await state(page)).scale, { timeout: 8000 }).toBe(1);

	// measure the empty margin the visitor is left looking at
	const gap = await page.evaluate(() => {
		let left = 999, top = 999;
		for (let y = 4; y < 640; y += 4) {
			for (let x = 0; x < 356; x += 4) {
				const el = document.elementFromPoint(x, y);
				if (el && el.closest('.object')) {
					if (x < left) left = x;
					if (y < top) top = y;
					break;
				}
			}
		}
		return { left, top };
	});
	expect(gap.left, 'landed with empty canvas to the left of the content')
		.toBeLessThan(24);
	expect(gap.top, 'landed with empty canvas above the content').toBeLessThan(24);
});

test('a page whose content starts at the origin is not shifted', async ({ page, hg }) => {
	// the trim must do nothing when there is nothing to trim
	hg.addObject('100000000001', OBJ(40, 40), 'A');
	hg.addObject('100000000002', OBJ(1500, 4000), 'B');
	await page.setViewportSize(PHONE);
	await page.goto(`/?${hg.pageName}&debug=1`);
	await expect.poll(async () => (await state(page)).active).toBe(true);
	const landing = await page.evaluate(() =>
		(/landingPan: ([^\n]*)/.exec(document.getElementById('hg-mg-dbg').textContent) || [])[1]);
	expect(landing, 'nothing to trim, so nothing should move').toBe('0,0');
});
