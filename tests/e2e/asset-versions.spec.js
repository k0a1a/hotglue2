// Versions on asset URLs.
//
// The web server lets browsers keep css and js for a day, and the urls never
// changed, so after an update a returning visitor ran the OLD script against
// the NEW page for up to 24 hours (a settings checkbox that did nothing, for
// one). html_add_css()/html_add_js() now put the file's modification time on
// the url of every local css/js file as ?v=, which changes exactly when the
// file does.

const fs = require('fs');
const path = require('path');
const { test, expect, ROOT } = require('./fixtures/hotglue.js');

const OBJ = {
	type: 'text', module: 'text', 'object-left': '10px', 'object-top': '10px',
	'object-width': '100px', 'object-height': '40px', 'object-zindex': '100',
};

// every local stylesheet and script the page asks for
const assetsOf = (page) => page.evaluate(() => [
	...document.querySelectorAll('link[rel="stylesheet"][href]'),
	...document.querySelectorAll('script[src]'),
].map((e) => e.getAttribute('href') || e.getAttribute('src'))
	.filter((u) => u.startsWith('/') && !u.startsWith('//')));

async function check(page, url) {
	await page.goto(url);
	const assets = await assetsOf(page);
	expect(assets.length, 'the page should load some local assets').toBeGreaterThan(2);
	for (const u of assets) {
		const m = /^(\/[^?]+\.(?:css|js))\?v=(\d+)$/.exec(u);
		expect(m, `${u} should carry ?v=<mtime>`).not.toBeNull();
		// and it IS the file's modification time
		const mtime = Math.floor(fs.statSync(path.join(ROOT, m[1])).mtimeMs / 1000);
		expect(Number(m[2]), `${u} should carry the file's own mtime`).toBe(mtime);
	}
	return assets;
}

test('a published page versions every local script and stylesheet', async ({ page, hg }) => {
	hg.addObject('100000000001', OBJ, 'x');
	const assets = await check(page, `/?${hg.pageName}`);
	expect(assets.some((u) => u.startsWith('/css/main.css?v='))).toBe(true);
});

test('the editor versions its scripts and stylesheets too', async ({ page, hg }) => {
	hg.addObject('100000000001', OBJ, 'x');
	const assets = await check(page, hg.editUrl());
	expect(assets.some((u) => /^\/js\/edit(\.min)?\.js\?v=\d+$/.test(u))).toBe(true);
});

test('the options page versions the script that saves its settings', async ({ page }) => {
	const assets = await check(page, '/?pages');
	expect(assets.some((u) => /^\/modules\/page_browser\/page_browser(\.min)?\.js\?v=\d+$/.test(u))).toBe(true);
});

test('a versioned url is still served', async ({ page, hg }) => {
	hg.addObject('100000000001', OBJ, 'x');
	await page.goto(`/?${hg.pageName}`);
	for (const u of await assetsOf(page)) {
		const res = await page.request.get(u);
		expect(res.status(), u).toBe(200);
	}
});

test('urls that are not this install\'s own files are left as they are', async ({ page, hg }) => {
	hg.addObject('100000000001', OBJ, 'x');
	await page.goto(`/?${hg.pageName}`);
	// nothing external or inline picked up a ?v=
	const odd = await page.evaluate(() => [
		...document.querySelectorAll('link[href], script[src]'),
	].map((e) => e.getAttribute('href') || e.getAttribute('src'))
		.filter((u) => /^(https?:)?\/\//.test(u) && /[?&]v=\d+$/.test(u)));
	expect(odd).toEqual([]);
});
