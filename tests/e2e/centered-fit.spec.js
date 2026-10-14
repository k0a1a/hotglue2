// A centered page's container is what fits a phone: the author's container
// width decides how the site looks there (page_centered_fit(), module_page.inc.php).
// A head script lays the viewport out at the container's width while the device
// is narrower than it, objects past the container are clipped so one of them
// cannot shrink the whole page, and the guided view is not loaded.
//
// Chromium only: Playwright's isMobile (a real mobile viewport with a
// visual-viewport scale) does not exist in Firefox. Hardware stays with
// android-check.js.

const fs = require('fs');
const path = require('path');
const { test, expect, CONTENT } = require('./fixtures/hotglue.js');

const CONTAINER = 509;
const OBJ = (left, top, w, h) => ({
	type: 'text', module: 'text',
	'object-left': `${left}px`, 'object-top': `${top}px`,
	'object-width': `${w}px`, 'object-height': `${h}px`, 'object-zindex': '100',
	'text-background-color': '#ffff00',
});

test.beforeEach(({ browserName }) => {
	test.skip(browserName !== 'chromium', 'isMobile emulation is Chromium only');
});

function centered(hg) {
	hg.addObject('page', { 'page-layout-mode': 'centered', 'page-container-width': String(CONTAINER) });
	hg.addObject('100000000001', OBJ(20, 20, 300, 100), 'A');
	// sticks out far past the container, and one far down
	hg.addObject('100000000002', OBJ(400, 60, 900, 100), 'B');
	hg.addObject('100000000003', OBJ(20, 1800, 300, 100), 'C');
}

const fitOf = (page) => page.evaluate(() => ({
	meta: document.querySelector('meta[name=viewport]').content,
	layoutW: document.documentElement.clientWidth,
	scale: window.visualViewport.scale,
	scrollW: document.documentElement.scrollWidth,
	wrapperW: document.getElementById('hg-centered-wrapper').getBoundingClientRect().width,
	wrapperX: document.getElementById('hg-centered-wrapper').getBoundingClientRect().x,
	guided: !!document.getElementById('hg-mg-canvas') || !!document.querySelector('script[src*="mobile-guided"]'),
}));

test.describe('a phone', () => {
	test.use({ isMobile: true, hasTouch: true, viewport: { width: 393, height: 851 }, deviceScaleFactor: 2.75 });

	test('the container fills the screen, sticking-out objects are clipped, no guided view',
		async ({ page, hg }) => {
			centered(hg);
			await page.goto(`/?${hg.pageName}`);
			await page.waitForTimeout(500);
			const f = await fitOf(page);
			expect(f.meta).toBe('width=' + CONTAINER);
			expect(f.layoutW, 'the page is laid out at the container width').toBe(CONTAINER);
			expect(f.scale * f.layoutW, 'and scaled to the device').toBeCloseTo(393, 0);
			expect(f.scrollW, 'no horizontal overflow').toBeLessThanOrEqual(CONTAINER);
			expect(Math.round(f.wrapperW)).toBe(CONTAINER);
			expect(Math.round(f.wrapperX)).toBe(0);
			expect(f.guided, 'the guided view is not loaded here').toBe(false);
			// the object far down is still reachable
			const h = await page.evaluate(() => document.documentElement.scrollHeight);
			expect(h).toBeGreaterThan(1850);
		});

	test('the site switch for the guided view off gives plain device-width', async ({ page, hg }) => {
		centered(hg);
		const dir = path.join(CONTENT, '_options', 'head');
		fs.mkdirSync(dir, { recursive: true, mode: 0o777 });
		try {
			await page.goto('/?pages');
			await page.request.post('/json.php', { form: {
				method: JSON.stringify('page.set_guided'), enabled: JSON.stringify(false) } });
			await page.goto(`/?${hg.pageName}`);
			const f = await fitOf(page);
			expect(f.meta).toBe('width=device-width, initial-scale=1');
			expect(f.layoutW).toBe(393);
			expect(f.guided).toBe(false);
		} finally {
			fs.rmSync(path.join(CONTENT, '_options'), { recursive: true, force: true, maxRetries: 10 });
		}
	});

	test('an infinite page keeps the guided view', async ({ page, hg }) => {
		hg.addObject('100000000001', OBJ(20, 20, 300, 100), 'A');
		hg.addObject('100000000002', OBJ(1500, 3000, 300, 100), 'B');
		await page.goto(`/?${hg.pageName}`);
		await expect.poll(() => page.evaluate(() => !!document.getElementById('hg-mg-canvas'))).toBe(true);
		expect((await fitOf(page).catch(() => ({}))).meta).toBeUndefined();	// no wrapper on an infinite page
	});
});

test.describe('a tablet', () => {
	test.use({ isMobile: true, hasTouch: true, viewport: { width: 768, height: 1024 } });

	test('a device wider than the container is not scaled up past 1:1', async ({ page, hg }) => {
		centered(hg);
		await page.goto(`/?${hg.pageName}`);
		await page.waitForTimeout(300);
		const f = await fitOf(page);
		expect(f.meta).toBe('width=device-width, initial-scale=1');
		expect(f.scale).toBe(1);
		expect(f.layoutW).toBe(768);
		expect(Math.round(f.wrapperW)).toBe(CONTAINER);
	});
});

test.describe('a desktop', () => {
	test('nothing changes: the object may stick out, no clipping', async ({ page, hg }) => {
		centered(hg);
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.goto(`/?${hg.pageName}`);
		const o = await page.evaluate(() => getComputedStyle(document.getElementById('hg-centered-wrapper')).overflowX);
		expect(o).toBe('visible');
		expect((await fitOf(page)).meta).toBe('width=device-width, initial-scale=1');
	});

	test('the editor is untouched', async ({ page, hg }) => {
		centered(hg);
		await page.goto(hg.editUrl());
		const hasScript = await page.evaluate(() => document.documentElement.innerHTML.includes('centered page: the container width'));
		expect(hasScript).toBe(false);
	});
});
