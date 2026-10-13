// The site options (favicon, custom fonts, the guided view, the last text
// font...) used to live on the STARTPAGE's own page-object. Deleting the
// startpage took them all, and with the directory gone writes failed with
// "Error opening start.head.page for writing"; changing the startpage left
// them behind. They now live in a reserved page of their own, _options, and
// deleting the startpage hands it to the first page that is left.
//
// The pages here are named zz-*.head because "head" is the revision the page
// list and the startpage rule go by (the suite's own pages are .default).

const fs = require('fs');
const path = require('path');
const { test, expect, CONTENT, serializeObject } = require('./fixtures/hotglue.js');

const SAMPLE = fs.readFileSync(path.join(__dirname, 'fixtures', 'sample.png'));
const POINTER = path.join(CONTENT, 'startpage');
const OPTIONS = path.join(CONTENT, '_options');
const rm = (p) => fs.rmSync(p, { recursive: true, force: true, maxRetries: 10 });

let hadPointer, pointerWas, hadOptions;
test.beforeEach(() => {
	hadPointer = fs.existsSync(POINTER);
	pointerWas = hadPointer ? fs.readFileSync(POINTER) : null;
	hadOptions = fs.existsSync(OPTIONS);
	rm(OPTIONS);
});
test.afterEach(() => {
	for (const f of fs.readdirSync(CONTENT)) {
		if (f.startsWith('zz-')) rm(path.join(CONTENT, f));
	}
	rm(OPTIONS);
	if (hadPointer) fs.writeFileSync(POINTER, pointerWas); else rm(POINTER);
});

function makePage(name) {
	const head = path.join(CONTENT, name, 'head');
	fs.mkdirSync(head, { recursive: true, mode: 0o777 });
	fs.mkdirSync(path.join(CONTENT, name, 'shared'), { recursive: true, mode: 0o777 });
	fs.writeFileSync(path.join(head, '100000000001'), serializeObject({
		type: 'text', module: 'text', 'object-left': '10px', 'object-top': '10px',
		'object-width': '100px', 'object-height': '40px', 'object-zindex': '100',
	}, 'x'));
}
const setPointer = (v) => fs.writeFileSync(POINTER, v);
const pointer = () => (fs.existsSync(POINTER) ? fs.readFileSync(POINTER, 'utf8') : null);

// the json.php convention: every value individually json-encoded
async function rpc(page, method, args = {}) {
	const form = { method: JSON.stringify(method) };
	for (const k of Object.keys(args)) form[k] = JSON.stringify(args[k]);
	return (await page.request.post('/json.php', { form })).json();
}

const zoomChecked = async (page, v) => {
	await page.goto('/?pages');
	await expect(page.locator(`#site_settings_guided_zoom input[value="${v}"]`)).toBeChecked();
};

test('deleting the startpage keeps the settings, and the first page left takes over',
	async ({ page }) => {
		makePage('zz-a'); makePage('zz-b'); makePage('zz-c');
		setPointer('zz-a.head');
		expect((await rpc(page, 'page.set_guided_zoom', { zoom: 125 }))['#error']).toBeFalsy();

		const del = await rpc(page, 'glue.delete_page', { page: 'zz-a.head' });
		expect(del['#error'], JSON.stringify(del)).toBeFalsy();
		expect(fs.existsSync(path.join(CONTENT, 'zz-a'))).toBe(false);

		expect(pointer()).toBe('zz-b.head');
		await zoomChecked(page, 125);

		// and a setting can still be written afterwards
		expect((await rpc(page, 'page.set_guided_zoom', { zoom: 50 }))['#error']).toBeFalsy();
		await zoomChecked(page, 50);
	});

test('deleting a page that is not the startpage leaves the pointer alone', async ({ page }) => {
	makePage('zz-a'); makePage('zz-b');
	setPointer('zz-b.head');
	await rpc(page, 'glue.delete_page', { page: 'zz-a.head' });
	expect(pointer()).toBe('zz-b.head');
});

test('deleting the last page removes the pointer', async ({ page }) => {
	makePage('zz-a');
	setPointer('zz-a.head');
	const del = await rpc(page, 'glue.delete_page', { page: 'zz-a.head' });
	expect(del['#error'], JSON.stringify(del)).toBeFalsy();
	expect(pointer()).toBe(null);
});

test('changing the startpage keeps the settings', async ({ page }) => {
	makePage('zz-a'); makePage('zz-b');
	setPointer('zz-a.head');
	await rpc(page, 'page.set_guided_zoom', { zoom: 125 });
	await rpc(page, 'glue.set_startpage', { page: 'zz-b.head' });
	expect(pointer()).toBe('zz-b.head');
	await zoomChecked(page, 125);
});

test('settings can be written when the startpage does not exist at all', async ({ page }) => {
	// the state the sites that deleted "start" are in
	setPointer('zz-gone.head');
	const r = await rpc(page, 'page.set_guided_zoom', { zoom: 150 });
	expect(r['#error'], JSON.stringify(r)).toBeFalsy();
	await zoomChecked(page, 150);
});

test('a site with its settings on the startpage is brought over, and nothing is taken away',
	async ({ page, request }) => {
		makePage('zz-a');
		setPointer('zz-a.head');
		const shared = path.join(CONTENT, 'zz-a', 'shared');
		fs.writeFileSync(path.join(shared, 'fav.png'), SAMPLE);
		fs.writeFileSync(path.join(shared, 'Face.woff2'), Buffer.from('not a real font'));
		fs.writeFileSync(path.join(CONTENT, 'zz-a', 'head', 'page'), serializeObject({
			'page-favicon-file': 'fav.png', 'page-favicon-mime': 'image/png',
			'page-custom-fonts': '[{"file":"Face.woff2","name":"Face"}]',
			'page-last-text-font': 'Face', 'page-guided': 'off', 'page-guided-zoom': '125',
			'page-title': 'not a site option',
		}));

		expect(fs.existsSync(OPTIONS)).toBe(false);
		await page.goto('/?pages');			// the first read does it

		const moved = fs.readFileSync(path.join(OPTIONS, 'head', 'page'), 'utf8');
		for (const k of ['page-favicon-file:fav.png', 'page-last-text-font:Face',
			'page-guided:off', 'page-guided-zoom:125', 'page-custom-fonts:']) {
			expect(moved, k).toContain(k);
		}
		expect(moved, 'only site options move').not.toContain('page-title');
		expect(fs.existsSync(path.join(OPTIONS, 'shared', 'fav.png'))).toBe(true);
		expect(fs.existsSync(path.join(OPTIONS, 'shared', 'Face.woff2'))).toBe(true);
		// nothing was taken away from the startpage
		expect(fs.existsSync(path.join(shared, 'fav.png'))).toBe(true);
		expect(fs.readFileSync(path.join(CONTENT, 'zz-a', 'head', 'page'), 'utf8'))
			.toContain('page-favicon-file:fav.png');

		// and the site behaves as it did: the favicon is served, the guided
		// view is off, the font is declared from the new place
		const fav = await request.get('/?favicon');
		expect(fav.status()).toBe(200);
		await page.goto('/?zz-a.head');
		expect(await page.evaluate(() =>
			Array.from(document.scripts).some((s) => /mobile-guided/.test(s.src)))).toBe(false);
	});

test('the site options are not a page', async ({ page }) => {
	await page.goto('/?pages');			// makes _options
	expect(fs.existsSync(path.join(OPTIONS, 'head'))).toBe(true);

	// not reachable as a page
	const res = await page.goto('/?_options');
	expect(res.status()).toBe(404);
	expect((await page.goto('/?_options.head/edit')).status()).toBe(404);

	// not in the list of pages, not creatable, copyable, renamable or deletable
	expect((await rpc(page, 'glue.pagenames'))['#data']).not.toContain('_options');
	for (const [method, args] of [
		['glue.create_page', { page: '_options.other' }],
		['glue.delete_page', { page: '_options.head' }],
	]) {
		const r = await rpc(page, method, args);
		expect(r['#error_code'], method).toBe(400);
	}
	expect(fs.existsSync(path.join(OPTIONS, 'head'))).toBe(true);
	await page.goto('/?pages');
	await expect(page.locator('.page_browser_entry[id="_options"]')).toHaveCount(0);
});
