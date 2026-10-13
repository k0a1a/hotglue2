// Where the site's favicon sits in the head.
//
// A page can bring an icon of its own in its custom HEAD (a hard-coded
// <link rel="icon">, say, from before the site had a favicon), and a browser
// that is offered several icons takes the later. The favicon the owner
// uploaded for the whole site is a deliberate choice, so it is written LAST,
// after the user HEAD definitions. The installation's own default icons
// (FAVICON, FAVICON_SET) stay early, so an owner's icon still beats those.

const fs = require('fs');
const path = require('path');
const { test, expect, CONTENT, serializeObject } = require('./fixtures/hotglue.js');

const SAMPLE = fs.readFileSync(path.join(__dirname, 'fixtures', 'sample.png'));
const OPTIONS = path.join(CONTENT, '_options');
const USERHEAD = path.join(CONTENT, 'userhead');
const OWN_ICON = '<link rel="icon" href="data:image/x-icon;base64,AAAA" type="image/x-icon">';
const rm = (p) => fs.rmSync(p, { recursive: true, force: true, maxRetries: 10 });

let hadUserhead, userheadWas;
test.beforeEach(() => {
	hadUserhead = fs.existsSync(USERHEAD);
	userheadWas = hadUserhead ? fs.readFileSync(USERHEAD) : null;
	rm(OPTIONS);
});
test.afterEach(() => {
	rm(OPTIONS);
	if (hadUserhead) fs.writeFileSync(USERHEAD, userheadWas); else rm(USERHEAD);
});

function siteFavicon() {
	fs.mkdirSync(path.join(OPTIONS, 'head'), { recursive: true, mode: 0o777 });
	fs.mkdirSync(path.join(OPTIONS, 'shared'), { recursive: true, mode: 0o777 });
	fs.writeFileSync(path.join(OPTIONS, 'shared', 'fav.png'), SAMPLE);
	fs.writeFileSync(path.join(OPTIONS, 'head', 'page'), serializeObject({
		'page-favicon-file': 'fav.png', 'page-favicon-mime': 'image/png',
	}));
}
const ownIcon = () => fs.writeFileSync(USERHEAD, OWN_ICON + '\n');

async function head(page, hg) {
	hg.addObject('100000000001', {
		type: 'text', module: 'text', 'object-left': '10px', 'object-top': '10px',
		'object-width': '100px', 'object-height': '40px', 'object-zindex': '100',
	}, 'x');
	const res = await page.request.get(`/?${hg.pageName}`);
	const html = await res.text();
	return html.slice(0, html.indexOf('</head>'));
}

test('the uploaded site favicon comes after an icon the page brings in its own HEAD',
	async ({ page, hg }) => {
		siteFavicon();
		ownIcon();
		const h = await head(page, hg);

		const own = h.indexOf('data:image/x-icon');
		const site = h.lastIndexOf('href="/?favicon"');
		expect(own, 'the page\'s own icon should be in the head').toBeGreaterThan(-1);
		expect(site, 'the site favicon should be in the head').toBeGreaterThan(-1);
		expect(site, 'the site favicon must be written after the page\'s own icon').toBeGreaterThan(own);

		// and the browser's last icon link is the site's
		await page.goto(`/?${hg.pageName}`);
		const icons = await page.evaluate(() => [...document.head.querySelectorAll('link[rel~="icon"]')]
			.map((l) => l.getAttribute('href')));
		expect(icons[icons.length - 1]).toBe('/?favicon');
	});

test('it carries its mime type, and the home-screen icon is there too', async ({ page, hg }) => {
	siteFavicon();
	const h = await head(page, hg);
	expect(h).toContain('<link rel="icon" href="/?favicon" type="image/png">');
	expect(h).toContain('<link rel="shortcut icon" href="/?favicon" type="image/png">');
	expect(h).toContain('<link rel="apple-touch-icon" href="/?favicon">');
});

test('a site favicon is in the head of a page with no custom HEAD as well', async ({ page, hg }) => {
	siteFavicon();
	const h = await head(page, hg);
	expect(h).not.toContain('user HEAD definitions');
	expect(h).toContain('href="/?favicon"');
});

test('without a site favicon the installation\'s defaults stay early, and the owner\'s icon is last',
	async ({ page, hg }) => {
		ownIcon();
		const h = await head(page, hg);
		const dflt = h.indexOf('href="/img/favicon.ico"');
		const own = h.indexOf('data:image/x-icon');
		expect(dflt, 'the default icon should be declared').toBeGreaterThan(-1);
		expect(own, 'the owner\'s icon should be declared').toBeGreaterThan(-1);
		expect(own, 'an owner\'s icon must still come after the defaults').toBeGreaterThan(dflt);
		expect(h).not.toContain('/?favicon');
	});
