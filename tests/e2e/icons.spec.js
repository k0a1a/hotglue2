// The SuperGlue SVG icon set (img/icons, generated from the upstream artwork
// by tools/prep-icons.js) is arriving in batches over several weeks, so these
// tests are aimed at the ways adding one goes wrong quietly.
//
// A button built by $.glue.icon() is a <div> with a background colour and the
// SVG as a CSS mask. If the mask never loads - a typo in the name, a file that
// did not get regenerated, a prep run that produced invalid XML, a URL that
// resolves against the stylesheet instead of the document - a mask that failed
// to load masks EVERYTHING out, and the button paints nothing at all. It is
// still in the DOM, still clickable, still 32x32, and Playwright's
// toBeVisible() still passes, because layout is fine; it is only paint that is
// missing. Nothing throws and nothing looks wrong unless you are watching the
// network. That is exactly the kind of breakage that reaches a release, and it
// did happen to the first batch.
//
// So: check that every icon a page asks for actually arrives, that a button
// really paints with its mask and not without it, and that the generated files
// are well-formed before anyone wires a button to them.

const fs = require('fs');
const path = require('path');
const { test, expect, waitForEditor, ROOT } = require('./fixtures/hotglue.js');

const ICON_DIR = path.join(ROOT, 'img', 'icons');

const OBJ = {
	type: 'text', module: 'text',
	'object-left': '200px', 'object-top': '200px',
	'object-width': '160px', 'object-height': '80px', 'object-zindex': '100',
	'text-background-color': 'transparent',
};

test('every icon the editor asks for is served', async ({ page, hg }) => {
	const failed = [];
	page.on('response', (r) => {
		if (/\/img\/icons\//.test(r.url()) && !r.ok()) {
			failed.push(`${r.status()} ${r.url()}`);
		}
	});

	hg.addObject('100000000001', OBJ, 'A');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	// select the object so the object context menu (and its icons) render
	await page.locator('.object').first().click();
	await expect(page.locator('.glue-btn-icon').first()).toBeVisible();

	// Read the mask URL the way the BROWSER resolved it, not the raw custom
	// property. A relative url() in a custom property resolves against the
	// stylesheet that uses the var(), not the document, so the two can differ
	// by a whole directory - which is exactly how the first batch shipped
	// briefly broken, every icon 404ing from /css/img/icons/ while the raw
	// property looked perfectly correct.
	const asked = await page.evaluate(() =>
		[...document.querySelectorAll('.glue-btn-icon')].map((e) => {
			// the mask lives on ::before, not on the button: the button draws
			// the border and pale fill, and a mask would clip those away too
			const s = getComputedStyle(e, '::before');
			const v = s.maskImage || s.webkitMaskImage || '';
			const m = v.match(/url\(["']?([^"')]+)/);
			return m ? m[1] : null;
		}));
	expect(asked.length, 'no icon buttons were rendered at all').toBeGreaterThan(0);
	expect(asked.filter((u) => !u), 'a .glue-btn-icon has no --glue-icon set').toHaveLength(0);

	const results = await Promise.all(asked.map(async (u) => {
		const r = await page.request.get(u);
		return { u, status: r.status(), type: r.headers()['content-type'] || '' };
	}));
	expect(results.filter((r) => r.status !== 200),
		'these icons 404ed, so their buttons paint nothing at all').toEqual([]);
	expect(results.filter((r) => !/svg/i.test(r.type)),
		'these icons were served with a non-SVG content type').toEqual([]);
	expect(failed, 'icon requests that failed while loading the page').toEqual([]);
});

test('an icon button is masked, sized and coloured',
	async ({ page, hg }) => {
		hg.addObject('100000000001', OBJ, 'A');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await page.locator('.object').first().click();

		const btn = page.locator('.glue-btn-icon').first();
		await expect(btn).toBeVisible();
		const box = await btn.boundingBox();
		expect(box.width, 'icon buttons match the 32px PNG ones beside them').toBe(32);
		expect(box.height).toBe(32);

		const css = await btn.evaluate((e) => {
			const glyph = getComputedStyle(e, '::before');
			const frame = getComputedStyle(e);
			return {
				// gecko and blink report this under different property names
				mask: glyph.maskImage || glyph.webkitMaskImage,
				size: glyph.maskSize || glyph.webkitMaskSize,
				colour: glyph.backgroundColor,
				frameFill: frame.backgroundColor,
				frameBorder: frame.borderTopWidth+' '+frame.borderTopStyle,
			};
		});
		expect(css.mask, 'the SVG is not being used as a mask').toContain('url(');
		expect(css.mask).not.toBe('none');
		// white artwork on light chrome is why this is a mask at all - the
		// colour has to come from CSS, and it must not be white
		expect(css.colour).not.toBe('rgb(255, 255, 255)');
		expect(css.colour).not.toBe('rgba(0, 0, 0, 0)');
		// the frame is what keeps line art readable over an arbitrary object,
		// and it has to be on the button, not on the masked box
		expect(css.frameBorder, 'the icon button lost its border').toBe('1px solid');
		expect(css.frameFill, 'the icon button lost its half-transparent fill')
			.toBe('rgba(255, 255, 255, 0.85)');
	});

test('an icon button paints something', async ({ page, hg }) => {
	// The strongest check available, and the only one that does not depend on
	// guessing the cause: render the button, then repoint it at a file that
	// does not exist and render again. If the mask is doing any work at all
	// the two must differ. A 404, an empty file, invalid XML and a mask that
	// silently never applied all collapse into "these pixels are identical".
	hg.addObject('100000000001', OBJ, 'A');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await page.locator('.object').first().click();

	const btn = page.locator('.glue-btn-icon').first();
	await btn.waitFor({ state: 'visible' });
	const clip = await btn.evaluate((e) => {
		const b = e.getBoundingClientRect();
		return { x: b.x, y: b.y, width: b.width, height: b.height };
	});
	const painted = await page.screenshot({ clip });
	await btn.evaluate((e) =>
		e.style.setProperty('--glue-icon', 'url("/img/icons/__no_such_icon.svg")'));
	// give the failed load a chance to settle before comparing
	await expect.poll(async () => (await page.screenshot({ clip })).length)
		.not.toBe(painted.length);
	const blank = await page.screenshot({ clip });
	expect(painted.equals(blank),
		'the button looks the same with and without its mask, so the mask is not painting')
		.toBe(false);
});

test('the generated icon files are well-formed and stripped', async () => {
	const files = fs.readdirSync(ICON_DIR).filter((f) => f.endsWith('.svg'));
	expect(files.length, 'img/icons is empty - run tools/prep-icons.js').toBeGreaterThan(0);

	const problems = [];
	for (const f of files) {
		const s = fs.readFileSync(path.join(ICON_DIR, f), 'utf8');
		if (!/^<svg[\s>]/.test(s.trim())) problems.push(`${f}: does not start with <svg`);
		if (!/viewBox=/.test(s)) problems.push(`${f}: no viewBox, so it will not scale to the mask`);
		if (/<metadata|rdf:RDF|<sodipodi:|<inkscape:/i.test(s)) {
			problems.push(`${f}: still carries Inkscape metadata - regenerate with tools/prep-icons.js`);
		}
		// a mask reads alpha only, but a stray <image> or <script> would mean
		// the strip let through something that is not line art
		if (/<script|<image\b|xlink:href/i.test(s)) problems.push(`${f}: contains a script or embedded image`);
	}
	expect(problems).toEqual([]);
});

test('icon names are addressable as plain words', async () => {
	// $.glue.icon('clone') has to map to a file, and the coming batches will
	// be dropped in by name, so the naming has to stay predictable
	const files = fs.readdirSync(ICON_DIR).filter((f) => f.endsWith('.svg'));
	const odd = files.filter((f) => !/^[a-z0-9]+(-[a-z0-9]+)*\.svg$/.test(f));
	expect(odd, 'these names are not lowercase-hyphenated, so $.glue.icon() cannot address them')
		.toEqual([]);
});
