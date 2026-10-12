// Same-site URLs are domain-relative (/css/main.css, /?page.head.1, ...): no
// scheme or host, so a page viewed through any domain keeps working, and no
// dependence on the page's own path. A bare '?name' or 'css/x.css' resolves
// against the path the page was opened at - on hotglue.me a page is also
// reachable as /plot (an .htaccess rewrite to index.php?plot that drops the
// query), where '?plot.head.1' became /plot?plot.head.1 and answered with the
// page's own HTML instead of the picture.

const fs = require('fs');
const path = require('path');
const { test, expect, CONTENT } = require('./fixtures/hotglue.js');

const SAMPLE_BYTES = fs.readFileSync(path.join(__dirname, 'fixtures', 'sample.png'));

function seed(hg) {
	const dir = path.join(CONTENT, hg.pageName.split('.')[0], 'shared');
	fs.mkdirSync(dir, { recursive: true, mode: 0o777 });
	fs.writeFileSync(path.join(dir, 'sample.png'), SAMPLE_BYTES);
}

const IMAGE = {
	type: 'image', module: 'image',
	'image-file': 'sample.png', 'image-file-mime': 'image/png',
	'image-file-width': '16', 'image-file-height': '16',
	'object-left': '40px', 'object-top': '40px',
	'object-width': '160px', 'object-height': '160px', 'object-zindex': '100',
};

test('every same-site url on a page is domain-relative, and a deep path still gets its css',
	async ({ page, hg }) => {
		seed(hg);
		const imgId = hg.addObject('100000000001', IMAGE);
		hg.addObject('100000000002', {
			type: 'text', module: 'text', 'object-left': '300px', 'object-top': '40px',
			'object-width': '200px', 'object-height': '40px', 'object-zindex': '100',
			'object-link': 'some-other-page',
		}, 'linked');

		// the page, as the server renders it
		const html = await (await page.request.get(`/?${hg.pageName}`)).text();
		const urls = [...html.matchAll(/\b(?:src|href)="([^"#][^"]*)"/g)].map((m) => m[1])
			.filter((u) => !/^(https?:)?\/\//.test(u) && !/^(mailto|data|javascript):/.test(u));
		expect(urls.length).toBeGreaterThan(5);
		// none is relative to the document: all start at the site root
		expect(urls.filter((u) => !u.startsWith('/'))).toEqual([]);
		// and none carries the host
		expect(html).not.toMatch(/\b(?:src|href)="https?:\/\/127\.0\.0\.1/);
		// the picture and the link, specifically
		expect(html).toContain(`src="/?${imgId}"`);
		expect(html).toMatch(/href="\/\?some-other-page"/);

		// opened under a path that is not the site root (what /plot is on
		// hotglue.me): the stylesheets still load and the picture still shows
		await page.goto(`/some/deep/path/?${hg.pageName}`);
		expect(await page.evaluate(() => [...document.styleSheets]
			.filter((s) => /main\.css/.test(s.href || ''))
			.map((s) => s.cssRules.length > 0))).toEqual([true]);
		await expect.poll(() => page.locator('img').first()
			.evaluate((i) => i.complete && i.naturalWidth)).toBeGreaterThan(0);
	});
