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

test('the sheep blinks: an eyelid covers its eyes every half minute',
	async ({ page, hg }) => {
		// the clone button's sheep is the one joke in the icon set, and it
		// gets the one animation: the eyelid from the icon's artwork
		// (sheep-eyelid.svg, the hidden "eyelids" layer extracted into a
		// mask of its own - nothing inside an SVG used as a mask can be
		// shown from outside it) paints over the eyes for half a second.
		// The cycle length is rolled fresh at every cycle end (3-30s), so
		// the pauses wander; only the range is stable. Assert the
		// animation is armed - the lid is invisible for most of the
		// cycle, so this is the reliable part to check.
		hg.addObject('100000000001', OBJ, 'A');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await page.locator('.object').first().click();

		const sheep = page.locator('.glue-btn-icon.glue-sheep').first();
		await expect(sheep).toBeVisible();
		const blink = await sheep.evaluate((el) => {
			const s = getComputedStyle(el, '::after');
			return {
				name: s.animationName,
				duration: s.animationDuration,
				iterations: s.animationIterationCount,
				colour: s.backgroundColor,
				mask: s.maskImage || s.webkitMaskImage || '',
				size: s.maskSize || s.webkitMaskSize,
			};
		});
		expect(blink.name).toBe('glue-sheep-blink');
		// the duration is random per cycle: only its range is promised
		const d = parseFloat(blink.duration);
		expect(Number.isFinite(d)).toBe(true);
		expect(d).toBeGreaterThanOrEqual(3);
		expect(d).toBeLessThanOrEqual(30);
		expect(blink.duration).toMatch(/s$/);
		expect(blink.iterations).toBe('infinite');
		// the eyelid is the FACE's paint, not the button's fill: the eyes
		// are holes in the mask, so covering them with the face colour
		// makes them vanish - the pale fill would only merge the two pale
		// dots into a bar, which reads as no blink at all
		expect(blink.colour).toBe('rgb(51, 51, 51)');
		// and it is the artwork's own eyelid shape, as a mask of its own
		expect(blink.mask).toContain('sheep-eyelid.svg');
		expect(blink.size).toBe('30px 30px');
		// the eyelid's rect in that file sits over the eyes' row with a
		// little margin, so it covers them when it shows
		const eyelid = fs.readFileSync(
			path.join(ICON_DIR, 'sheep-eyelid.svg'), 'utf8');
		const rect = eyelid.match(/<rect[^>]*x="([\d.]+)"[^>]*y="([\d.]+)"[^>]*width="([\d.]+)"[^>]*height="([\d.]+)"/);
		expect(rect, 'the eyelid mask has no rect').not.toBeNull();
		const [, ex, ey, ew, eh] = rect.map(parseFloat);
		expect(ex + ew).toBeGreaterThan(18.5);	// reaches past the eyes
		expect(ey).toBeLessThan(11);			// starts above them
		expect(ey + eh).toBeGreaterThan(15);	// and ends below them

		// the face turns #c00 on hover; the eyelid follows it, or it would
		// sit on the red face as a dark bar
		await sheep.hover();
		const hover = await sheep.evaluate((el) =>
			getComputedStyle(el, '::after').backgroundColor);
		expect(hover).toBe('rgb(204, 0, 0)');
	});

test('the blink cycle is re-rolled at every wrap', async ({ page, hg }) => {
		// The duration only needs to be in 3-30s; what makes the blinks
		// wander is that the button rolls a fresh value every time the
		// animation's cycle ends - and rewrites the keyframes too, because
		// the fades are a fixed half second each and keyframes are
		// fractions of whatever the cycle is. Speed the cycle up so a wrap
		// lands quickly, then watch the rolled custom property change to a
		// new value in range - if the listener were missing or pointed at
		// the wrong element, the property would sit frozen at its first
		// roll.
		hg.addObject('100000000001', OBJ, 'A');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await page.locator('.object').first().click();

		const sheep = page.locator('.glue-btn-icon.glue-sheep').first();
		await expect(sheep).toBeVisible();
		const rolled = () => sheep.evaluate((el) => {
			const v = el.style.getPropertyValue('--glue-sheep-cycle');
			const d = parseFloat(v);
			return { v, ok: Number.isFinite(d) && d >= 3 && d <= 30 };
		});
		const first = await rolled();
		expect(first.ok, 'the first roll is missing or out of range: ' + first.v)
			.toBe(true);

		// the roll also rewrites the injected @keyframes so the three
		// phases - closing, fully down, opening - each measure 0.5s of
		// the cycle that was rolled (the stylesheet's fallback curve is
		// for 30s and would stretch or snap the fades at any other length)
		const d = parseFloat(first.v);
		const phases = await page.evaluate(() => {
			const s = [...document.head.querySelectorAll('style')]
				.find((s) => /@keyframes glue-sheep-blink/.test(s.textContent));
			if (!s) return null;
			const m = s.textContent.match(
				/0%, ([\d.]+)% \{ opacity: 0; \} ([\d.]+)% \{ opacity: 1; \} ([\d.]+)%, 100% \{ opacity: 0; \} /);
			return m ? [m[1], m[2], m[3]].map(parseFloat) : null;
		});
		expect(phases, 'the injected keyframes are missing').not.toBeNull();
		const phase = (a, b) => Math.abs((b - a) / 100 * d - 0.5);
		expect(phase(phases[0], phases[1]), 'closing is not ~0.5s').toBeLessThan(0.1);
		expect(phase(phases[1], phases[2]), 'fully-down is not ~0.5s').toBeLessThan(0.1);
		expect(phase(phases[2], 100), 'opening is not ~0.5s').toBeLessThan(0.1);

		await page.addStyleTag({
			content: '.glue-btn-icon.glue-sheep::after { animation-duration: 0.5s; }',
		});
		await expect.poll(async () => (await rolled()).ok
			&& (await rolled()).v !== first.v, { timeout: 5000, intervals: [100] })
			.toBe(true);
	});

test('the sheep blink actually fires', async ({ page, hg }) => {
		// The properties above only prove the blink is armed; the one thing
		// they cannot show is that the animation RUNS. Speed the cycle up
		// once the page is loaded - a duration change rescales the running
		// cycle, so the next blink lands within a couple of seconds - and
		// watch the lid's opacity spike for real, drop, and spike again.
		hg.addObject('100000000001', OBJ, 'A');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await page.locator('.object').first().click();

		const sheep = page.locator('.glue-btn-icon.glue-sheep').first();
		await expect(sheep).toBeVisible();

		await page.addStyleTag({
			content: [
				'.glue-btn-icon.glue-sheep::after { animation-duration: 6s; }',
				// and a dwell long enough for a 100ms poll to land in -
				// the real cycle's blink, sped up to 6s, would be over
				// in an instant (the later @keyframes rule wins)
				'@keyframes glue-sheep-blink { 0%, 50% { opacity: 0; } '
					+ '60% { opacity: 1; } 90%, 100% { opacity: 0; } }',
			].join('\n'),
		});

		const lid = () => sheep.evaluate((el) =>
			parseFloat(getComputedStyle(el, '::after').opacity));
		await expect.poll(lid, { timeout: 6000, intervals: [100] })
			.toBeGreaterThan(0.5);
		await expect.poll(lid, { timeout: 6000, intervals: [100] })
			.toBeLessThan(0.5);
		await expect.poll(lid, { timeout: 6000, intervals: [100] })
			.toBeGreaterThan(0.5);
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
