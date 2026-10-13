// The site's favicon against an icon a page brings in its own HEAD.
//
// A page can carry a hard-coded <link rel="icon"> in its custom HEAD, kept from
// before the site had a favicon. A browser offered several icons chooses mostly
// by size, NOT by order - an inline, fully transparent 16x16 data: icon beat the
// uploaded favicon on a real site and the tab showed an empty icon - so the
// favicon the owner uploaded for the whole site is the ONLY icon the page
// declares: the other icon links are dropped from the user HEAD when the page is
// written (what is stored is untouched), and the site's is written after it.
// The installation's own default icons (FAVICON, FAVICON_SET) are not emitted
// when a site favicon is set, and with none set an owner's icon still comes
// after the defaults and beats them.

const fs = require('fs');
const path = require('path');
const { test, expect, CONTENT, serializeObject } = require('./fixtures/hotglue.js');

const SAMPLE = fs.readFileSync(path.join(__dirname, 'fixtures', 'sample.png'));
const OPTIONS = path.join(CONTENT, '_options');
const USERHEAD = path.join(CONTENT, 'userhead');
const OWN_ICON = '<link href="data:image/x-icon;base64,AAAA" rel="icon" type="image/x-icon" />';
// what else sits in a user HEAD, and must survive the icon being dropped
const OTHER = '<meta name="description" content="a site">\n<style>a > div { color: #777; }</style>';
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
const ownIcon = (extra = '') => fs.writeFileSync(USERHEAD, OWN_ICON + '\n' + OTHER + '\n' + extra);

async function head(page, hg) {
	hg.addObject('100000000001', {
		type: 'text', module: 'text', 'object-left': '10px', 'object-top': '10px',
		'object-width': '100px', 'object-height': '40px', 'object-zindex': '100',
	}, 'x');
	const res = await page.request.get(`/?${hg.pageName}`);
	const html = await res.text();
	return html.slice(0, html.indexOf('</head>'));
}

test('the page\'s own icon is dropped when the site has a favicon, and the rest of its HEAD stays',
	async ({ page, hg }) => {
		siteFavicon();
		ownIcon('<link rel="shortcut icon" href="/old.ico">\n<link rel="apple-touch-icon" href="/old.png">\n');
		const h = await head(page, hg);

		expect(h, 'the page\'s own inline icon must not be declared').not.toContain('data:image/x-icon');
		expect(h).not.toContain('/old.ico');
		expect(h).not.toContain('/old.png');
		// the rest of the user HEAD is untouched
		expect(h).toContain('user HEAD definitions');
		expect(h).toContain('<meta name="description" content="a site">');
		expect(h).toContain('a > div { color: #777; }');
		// the site favicon is there, after it
		expect(h.lastIndexOf('href="/?favicon"')).toBeGreaterThan(h.indexOf('user HEAD definitions'));

		// and every icon link the browser sees is the site's
		await page.goto(`/?${hg.pageName}`);
		const icons = await page.evaluate(() => [...document.head.querySelectorAll('link')]
			.filter((l) => /icon/i.test(l.getAttribute('rel')))
			.map((l) => l.getAttribute('rel') + '=' + l.getAttribute('href')));
		expect(icons).toEqual(['shortcut icon=/?favicon', 'icon=/?favicon', 'apple-touch-icon=/?favicon']);
	});

test('an svg icon with a > inside its value is dropped whole, not cut in half', async ({ page, hg }) => {
	siteFavicon();
	fs.writeFileSync(USERHEAD, '<link rel="icon" href="data:image/svg+xml,<svg xmlns=\'http://www.w3.org/2000/svg\'><rect/></svg>">\n<p id="kept">kept</p>\n');
	const h = await head(page, hg);
	expect(h).not.toContain('<rect/>');
	expect(h).not.toContain('</svg>');
	expect(h).toContain('<p id="kept">kept</p>');
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
