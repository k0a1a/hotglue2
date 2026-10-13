// The page background in the mobile guided view.
//
// The background is an inline style on <html>, so the transform on the guided
// canvas never reached it: a tile kept its size while the content around it
// was scaled. js/mobile-guided.js now scales background-size and positions
// background-position with the same scale and pan the transform uses.
//
// Checked structurally, not by eye: the origin of the tile pattern must sit
// where page x=0 / y=0 sits, whatever the scale, so the pattern moves and
// scales WITH the content.

const fs = require('fs');
const path = require('path');
const { test, expect, CONTENT, serializeObject } = require('./fixtures/hotglue.js');

const SAMPLE = fs.readFileSync(path.join(__dirname, 'fixtures', 'sample.png'));	// 120x80
const PHONE = { width: 360, height: 649 };
const LEFT = 300, TOP = 500;
const OBJ = (left, top, w = 400, h = 300) => ({
	type: 'text', module: 'text',
	'object-left': `${left}px`, 'object-top': `${top}px`,
	'object-width': `${w}px`, 'object-height': `${h}px`, 'object-zindex': '100',
	'text-background-color': '#ffff00',
});

function seed(hg, pageAttrs) {
	const dir = path.join(CONTENT, hg.pageName.split('.')[0], 'shared');
	fs.mkdirSync(dir, { recursive: true, mode: 0o777 });
	fs.writeFileSync(path.join(dir, 'bg.png'), SAMPLE);
	const rev = path.join(CONTENT, hg.pageName.split('.').join('/'));
	fs.mkdirSync(rev, { recursive: true, mode: 0o777 });
	fs.writeFileSync(path.join(rev, 'page'), serializeObject(Object.assign({
		'page-background-file': 'bg.png', 'page-background-repeat': 'repeat',
	}, pageAttrs)));
	// a canvas much wider than the phone, with content away from the origin
	hg.addObject('100000000001', OBJ(LEFT, TOP), 'A');
	hg.addObject('100000000002', OBJ(1500, 2500), 'B');
}

const probe = (page) => page.evaluate(() => {
	const c = document.getElementById('hg-mg-canvas');
	const st = document.documentElement.style;
	const o = document.querySelector('.object').getBoundingClientRect();
	const num = (v) => parseFloat(v);
	const pos = st.backgroundPosition.split(' ').map(num);
	const size = st.backgroundSize.split(' ');
	return {
		scale: c ? +new DOMMatrixReadOnly(getComputedStyle(c).transform).a.toFixed(4) : null,
		pos, size, attachment: st.backgroundAttachment,
		// the first object's document position
		docLeft: o.left + window.scrollX, docTop: o.top + window.scrollY,
		leftPx: parseFloat(document.querySelector('.object').style.left),
		topPx: parseFloat(document.querySelector('.object').style.top),
	};
});

// where page x=0,y=0 sits in the document, read off the first object
const origin = (r) => [r.docLeft - r.scale * r.leftPx, r.docTop - r.scale * r.topPx];

async function landed(page, hg, url) {
	await page.setViewportSize(PHONE);
	await page.goto(url || `/?${hg.pageName}`);
	await expect.poll(async () => (await probe(page)).scale, { timeout: 8000 }).toBe(0.5625);
	await page.waitForTimeout(400);
}

test('the tile pattern starts where the page does, and its size scales with the content',
	async ({ page, hg }) => {
		seed(hg, {});		// no size: the image's own, 120 canvas px
		await landed(page, hg);
		const r = await probe(page);

		expect(r.attachment).toBe('scroll');
		// 120px natural width x the scale
		expect(parseFloat(r.size[0])).toBeCloseTo(120 * r.scale, 2);
		// the pattern's origin is page x=0, y=0
		const [ox, oy] = origin(r);
		expect(r.pos[0]).toBeCloseTo(ox, 0);
		expect(r.pos[1]).toBeCloseTo(oy, 0);
	});

test('a percentage size is resolved against 1280px, then scaled', async ({ page, hg }) => {
	seed(hg, { 'page-background-size': '50% auto' });
	await landed(page, hg);
	const r = await probe(page);
	expect(parseFloat(r.size[0])).toBeCloseTo(0.5 * 1280 * r.scale, 2);
	// blink serialises 'Wpx auto' back as just 'Wpx'; gecko keeps the auto
	expect([undefined, 'auto']).toContain(r.size[1]);
});

test('a stored position moves with the content', async ({ page, hg }) => {
	seed(hg, { 'page-background-image-position': '40px 30px' });
	await landed(page, hg);
	const r = await probe(page);
	const [ox, oy] = origin(r);
	expect(r.pos[0]).toBeCloseTo(ox + 40 * r.scale, 0);
	expect(r.pos[1]).toBeCloseTo(oy + 30 * r.scale, 0);
});

test('the pattern stays aligned with the content after the double-tap overview',
	async ({ page, hg }) => {
		seed(hg, { 'page-background-size': '25% auto' });
		await landed(page, hg);

		await page.evaluate(() => document.body.dispatchEvent(new MouseEvent('dblclick',
			{ bubbles: true, clientX: 100, clientY: 100 })));
		await expect.poll(async () => (await probe(page)).scale, { timeout: 4000 })
			.toBeLessThan(0.5625);
		await page.waitForTimeout(900);		// the move, and the hand-over
		const r = await probe(page);

		expect(parseFloat(r.size[0])).toBeCloseTo(0.25 * 1280 * r.scale, 1);
		const [ox, oy] = origin(r);
		expect(r.pos[0]).toBeCloseTo(ox, 0);
		expect(r.pos[1]).toBeCloseTo(oy, 0);
	});

test('a fixed background becomes a scrolling one', async ({ page, hg }) => {
	seed(hg, { 'page-background-attachment': 'fixed' });
	await landed(page, hg);
	expect((await probe(page)).attachment).toBe('scroll');
});

test('cover leaves the background alone', async ({ page, hg }) => {
	seed(hg, { 'page-background-size': 'cover' });
	await landed(page, hg);
	const st = await page.evaluate(() => ({
		size: document.documentElement.style.backgroundSize,
		pos: document.documentElement.style.backgroundPosition,
		att: document.documentElement.style.backgroundAttachment,
	}));
	expect(st.size).toBe('cover');
	expect(st.att).not.toBe('scroll');
});

test('a page without a background image is untouched', async ({ page, hg }) => {
	hg.addObject('100000000001', OBJ(100, 100), 'A');
	hg.addObject('100000000002', OBJ(1500, 4000), 'B');
	await page.setViewportSize(PHONE);
	await page.goto(`/?${hg.pageName}`);
	await expect.poll(async () => (await probe(page)).scale, { timeout: 8000 }).toBe(0.5625);
	expect(await page.evaluate(() => document.documentElement.style.backgroundSize)).toBe('');
});
