// The zoom of the mobile guided view is a site setting (/?pages, "Mobile view"):
// 50-150% of a baseline that is itself 75% of natural size (natural size read
// as too zoomed in on a phone). 100% is the default and is stored by ABSENCE,
// so a site that never touched it keeps the files and html it had.
//
// What the feel of it is on a real phone stays with tests/e2e/android-check.js;
// this checks the plumbing and the scale the reveal lands on.

const fs = require('fs');
const path = require('path');
const { test, expect, CONTENT } = require('./fixtures/hotglue.js');

const OBJ = (left, top, w = 400, h = 300) => ({
	type: 'text', module: 'text',
	'object-left': `${left}px`, 'object-top': `${top}px`,
	'object-width': `${w}px`, 'object-height': `${h}px`, 'object-zindex': '100',
	'text-background-color': '#ffff00',
});
const PHONE = { width: 360, height: 649 };

// The site settings live on the startpage's own page-object, which the hermetic
// content tree does not have: make the startpage's directory for the test and
// take it away again (nothing else in the suite wants it; copy-paste.spec.js
// does the same for its font registry).
const START_DIR = path.join(CONTENT, 'start');
let hadStart = false;
test.beforeEach(() => {
	hadStart = fs.existsSync(START_DIR);
	fs.mkdirSync(path.join(START_DIR, 'head'), { recursive: true, mode: 0o777 });
	fs.rmSync(path.join(START_DIR, 'head', 'page'), { force: true });
});
test.afterEach(() => {
	if (hadStart) {
		fs.rmSync(path.join(START_DIR, 'head', 'page'), { force: true });
	} else {
		fs.rmSync(START_DIR, { recursive: true, force: true, maxRetries: 10 });
	}
});

const scaleOf = (page) => page.evaluate(() => {
	const c = document.getElementById('hg-mg-canvas');
	return c ? +new DOMMatrixReadOnly(getComputedStyle(c).transform).a.toFixed(4) : null;
});

async function setZoom(page, hg, pct) {
	await page.goto('/?pages');
	await page.locator(`#site_settings_guided_zoom input[value="${pct}"]`).check();
	// the change is saved through the backend; wait for it to land
	await page.waitForTimeout(500);
}

test('the settings page offers 50/75/100/125/150, with 100 the default', async ({ page }) => {
	await page.goto('/?pages');
	const radios = page.locator('#site_settings_guided_zoom input[type=radio]');
	await expect(radios).toHaveCount(5);
	expect(await radios.evaluateAll((els) => els.map((e) => e.value)))
		.toEqual(['50', '75', '100', '125', '150']);
	await expect(page.locator('#site_settings_guided_zoom input[value="100"]')).toBeChecked();
	await expect(page.locator('#site_settings_guided_zoom')).toContainText('100% (default)');
});

test('the default leaves the page html alone', async ({ page, hg }) => {
	hg.addObject('100000000001', OBJ(100, 100), 'A');
	await page.goto(`/?${hg.pageName}`);
	expect(await page.evaluate(() => document.body.hasAttribute('data-guided-zoom'))).toBe(false);
});

test('a chosen zoom is stored, shown after a reload and put on the page body',
	async ({ page, hg }) => {
		hg.addObject('100000000001', OBJ(100, 100), 'A');
		await setZoom(page, hg, 125);
		await page.reload();
		await expect(page.locator('#site_settings_guided_zoom input[value="125"]')).toBeChecked();

		await page.goto(`/?${hg.pageName}`);
		expect(await page.evaluate(() => document.body.getAttribute('data-guided-zoom')))
			.toBe('125');

		// and back to the default removes it again
		await setZoom(page, hg, 100);
		await page.goto(`/?${hg.pageName}`);
		expect(await page.evaluate(() => document.body.hasAttribute('data-guided-zoom'))).toBe(false);
	});

test('an out-of-range zoom is refused by the service', async ({ page }) => {
	// straight at json.php: the editor's backend() wrapper swallows error bodies
	const res = await page.request.post('/json.php', {
		form: { method: JSON.stringify('page.set_guided_zoom'), zoom: JSON.stringify(300) },
	});
	// json.php answers 200 and carries the error in the body
	const body = await res.json();
	expect(body['#error'], 'a zoom outside the choices must not be accepted').toBeTruthy();
	expect(body['#error_code']).toBe(400);
	await page.goto('/?pages');
	await expect(page.locator('#site_settings_guided_zoom input[value="100"]')).toBeChecked();
});

const scriptOnPage = (page) => page.evaluate(() =>
	Array.from(document.scripts).some((x) => /mobile-guided/.test(x.src)));

test('the guided view is on by default, and the zoom choices are live', async ({ page }) => {
	await page.goto('/?pages');
	await expect(page.locator('#site_settings_guided_on')).toBeChecked();
	await expect(page.locator('#site_settings_guided_zoom input[value="100"]')).toBeEnabled();
});

test('switching it off keeps the script off the page, even for ?guided=1',
	async ({ page, hg }) => {
		hg.addObject('100000000001', OBJ(100, 100), 'A');
		hg.addObject('100000000002', OBJ(1500, 4000), 'B');
		await page.setViewportSize(PHONE);

		await page.goto(`/?${hg.pageName}`);
		expect(await scriptOnPage(page), 'on by default').toBe(true);

		await page.goto('/?pages');
		await page.locator('#site_settings_guided_on').uncheck();
		await expect(page.locator('#site_settings_guided_zoom input[value="100"]')).toBeDisabled();
		await page.waitForTimeout(500);

		await page.goto(`/?${hg.pageName}`);
		expect(await scriptOnPage(page), 'off: the script must not even be loaded').toBe(false);
		await page.goto(`/?${hg.pageName}&guided=1`);
		await page.waitForTimeout(600);
		expect(await scaleOf(page), '?guided=1 has nothing to force while the site has it off')
			.toBe(null);

		// and the choice is still there after a reload of the settings
		await page.goto('/?pages');
		await expect(page.locator('#site_settings_guided_on')).not.toBeChecked();
		await expect(page.locator('#site_settings_guided_zoom input[value="100"]')).toBeDisabled();
	});

test('switching it back on restores it, and a chosen zoom survives the round trip',
	async ({ page, hg }) => {
		hg.addObject('100000000001', OBJ(100, 100), 'A');
		hg.addObject('100000000002', OBJ(1500, 4000), 'B');
		await setZoom(page, hg, 125);

		await page.goto('/?pages');
		await page.locator('#site_settings_guided_on').uncheck();
		await page.waitForTimeout(500);
		await page.locator('#site_settings_guided_on').check();
		await page.waitForTimeout(500);
		await expect(page.locator('#site_settings_guided_zoom input[value="125"]')).toBeChecked();
		await expect(page.locator('#site_settings_guided_zoom input[value="125"]')).toBeEnabled();

		await page.setViewportSize(PHONE);
		await page.goto(`/?${hg.pageName}`);
		expect(await scriptOnPage(page)).toBe(true);
		await expect.poll(() => scaleOf(page), { timeout: 8000 }).toBe(0.9375);
	});

test('the guided toggle service refuses a non-boolean', async ({ page }) => {
	const res = await page.request.post('/json.php', {
		form: { method: JSON.stringify('page.set_guided'), enabled: JSON.stringify('maybe') },
	});
	const body = await res.json();
	expect(body['#error_code']).toBe(400);
});

for (const [pct, scale] of [[50, 0.375], [75, 0.5625], [100, 0.75], [125, 0.9375], [150, 1.125]]) {
	test(`${pct}% lands the guided view at ${scale} (75% of natural size x ${pct}%)`,
		async ({ page, hg }) => {
			hg.addObject('100000000001', OBJ(100, 100), 'A');
			hg.addObject('100000000002', OBJ(1500, 4000), 'B');
			await setZoom(page, hg, pct);

			await page.setViewportSize(PHONE);
			await page.goto(`/?${hg.pageName}`);
			await expect.poll(() => scaleOf(page), { timeout: 8000 }).toBe(scale);
		});
}
