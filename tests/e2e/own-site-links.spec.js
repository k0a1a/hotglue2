// Links saved as full addresses of this very site (http://old-domain/?page,
// http://127.0.0.1:8123/page, ...) are drawn as domain-relative ones, so a
// site viewed through another domain - or whose old domain is gone - keeps its
// visitors on the site. Anything that is not this site, or not a plain page
// address, is left exactly as saved.

const { test, expect } = require('./fixtures/hotglue.js');

const TEXT = (link) => ({
	type: 'text', module: 'text',
	'object-left': '20px', 'object-top': '20px', 'object-width': '200px',
	'object-height': '40px', 'object-zindex': '100', 'object-link': link,
});

const CASES = [
	// [stored link, rendered href]
	['http://old-domain.test/programme', '/?programme'],
	['https://www.old-domain.test/programme', '/?programme'],
	['http://old-domain.test/?programme', '/?programme'],
	['https://old-domain.test/?dyeing+process+%232', '/?dyeing+process+%232'],
	['http://old-domain.test/programme/', '/?programme'],
	['http://old-domain.test/', '/'],
	['http://old-domain.test', '/'],
	['http://old-domain.test/?programme#top', '/?programme#top'],
	['http://127.0.0.1:8123/?start', '/?start'],
	// not this site, or not something we can map with certainty: untouched
	['http://elsewhere.test/programme', 'http://elsewhere.test/programme'],
	['http://old-domain.test.evil.test/programme', 'http://old-domain.test.evil.test/programme'],
	['http://old-domain.test/img/photo.png', 'http://old-domain.test/img/photo.png'],
	['http://old-domain.test/?a&b=1', 'http://old-domain.test/?a&b=1'],
	// a bare page name still becomes a page link
	['programme', '/?programme'],
];

test('an object link to an address of this site is drawn domain-relative', async ({ page, hg }) => {
	CASES.forEach(([link], i) => hg.addObject(String(100000000001 + i), TEXT(link), 'x'+i));
	const html = await (await page.request.get(`/?${hg.pageName}`)).text();
	const hrefs = [...html.matchAll(/<a href="([^"]*)"/g)].map((m) => m[1].replace(/&amp;/g, '&'));
	const want = CASES.map(([, href]) => href).sort();
	expect(hrefs.filter((h) => !/^\/(css|img|js)\//.test(h)).sort()).toEqual(want);
});

test('a text link to an address of this site is drawn domain-relative, others untouched',
	async ({ page, hg }) => {
		hg.addObject('100000000001', {
			type: 'text', module: 'text', 'object-left': '20px', 'object-top': '20px',
			'object-width': '300px', 'object-height': '40px', 'object-zindex': '100',
		}, '<a href="http://old-domain.test/programme">own</a> '
			+ '<a href="http://elsewhere.test/programme">other</a>');
		const html = await (await page.request.get(`/?${hg.pageName}`)).text();
		expect(html).toContain('<a href="/?programme">own</a>');
		expect(html).toContain('<a href="http://elsewhere.test/programme">other</a>');
	});
