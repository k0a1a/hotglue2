// Where the colour picker opens.
//
// Its popup is anchored to a position:fixed element, so it needs VIEWPORT
// coordinates. It used to be given $.glue.menu.spawn_coords(), which is in
// PAGE space AND is captured when the menu opens rather than when the picker
// does - so the popup appeared wherever the page had been scrolled to at some
// earlier moment. Measured before the fix: the same 655,30 regardless of which
// button was clicked, on a scrolled page and on a centered page alike.
//
// This is not a centered-layout bug, it just became obvious there: centring
// moves the button but the popup stayed put.

const { test, expect, waitForEditor } = require('./fixtures/hotglue.js');

const OBJ = (left, top) => ({
	type: 'text', module: 'text',
	'object-left': `${left}px`, 'object-top': `${top}px`,
	'object-width': '200px', 'object-height': '100px', 'object-zindex': '100',
	'text-background-color': '#ffff00',
});

for (const [name, centered] of [['infinite', false], ['centered', true]]) {
	test(`the picker opens next to its button and on screen (${name})`, async ({ page, hg }) => {
		const a = hg.addObject('100000000001', OBJ(300, 900), 'A');
		hg.addObject('100000000002', OBJ(300, 2000), 'far');		// make the page tall
		if (centered) {
			hg.addObject('page', { 'page-layout-mode': 'centered', 'page-container-width': '900' });
		}
		await page.goto(hg.editUrl());
		await waitForEditor(page, 2);
		await page.locator(`[id="${a}"]`).click();

		const button = page.getByTitle(/background color/i).first();
		const bb = await button.boundingBox();
		await button.click();

		const popup = page.locator('.picker_wrapper');
		await expect(popup).toBeVisible();
		const pb = await popup.boundingBox();
		const viewport = page.viewportSize();

		expect(pb.y, 'the picker opened off the top of the window').toBeGreaterThanOrEqual(0);
		expect(pb.y + pb.height, 'the picker opened off the bottom of the window')
			.toBeLessThanOrEqual(viewport.height + 1);
		expect(pb.x, 'the picker opened off the left of the window').toBeGreaterThanOrEqual(0);
		expect(pb.x + pb.width, 'the picker opened off the right of the window')
			.toBeLessThanOrEqual(viewport.width + 1);
		// near the button that opened it, if no longer pinned to it: it is
		// placed beside the OBJECT now, and the button is beside the object
		expect(Math.abs(pb.y - bb.y), 'the picker is nowhere near its button')
			.toBeLessThan(400);

		// and nothing paints over it - objects go up to z-index 199 and the
		// one being recoloured is by definition right underneath
		const onTop = await page.evaluate(() => {
			const r = document.querySelector('.picker_wrapper').getBoundingClientRect();
			const at = document.elementFromPoint(
				Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2));
			return !!(at && at.closest('.picker_wrapper'));
		});
		expect(onTop, 'something is painting over the colour picker').toBe(true);
	});
}

// --- size, and the per-page recent colours -------------------------------
//
// The picker opened at vanilla-picker's 250x315 default, which is a lot of
// window for one swatch of colour, on top of the object being coloured. It is
// roughly half that now; the hex field is what makes shrinking it safe, since
// an exact colour can always be typed. Above that field sit the last five
// colours used on THIS page, stored on the page object as page-recent-colors
// so they are there for whoever opens the page next.

const bgOf = (page, id) => page.evaluate((i) =>
	getComputedStyle(document.getElementById(i)).backgroundColor, id);

async function openPicker(page, id) {
	// only select if it is not selected already - a SECOND click on a text
	// object is what puts it into edit mode, which is not what a test
	// reopening the picker means
	const obj = page.locator(`[id="${id}"]`);
	if (!(await obj.evaluate((e) => e.classList.contains('glue-selected')))) {
		await obj.click();
	}
	await page.getByTitle(/background color/i).first().click();
	await expect(page.locator('.picker_wrapper')).toBeVisible();
}

test('the picker is small enough to leave the object visible', async ({ page, hg }) => {
	const a = hg.addObject('100000000001', OBJ(300, 300), 'A');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await openPicker(page, a);

	const b = await page.locator('.picker_wrapper').boundingBox();
	// 180px is the design ceiling - the width it was set to, and the most
	// that still leaves the object visible (the codex: no interface may
	// cover the page element being worked on)
	expect(b.width, 'the picker is back to its full default width')
		.toBeLessThanOrEqual(180);
	expect(b.height, 'the picker is back to its full default height').toBeLessThan(210);
	// and it is still usable: the hex field, the sample and Ok all present
	await expect(page.locator('.picker_editor input')).toBeVisible();
	await expect(page.locator('.picker_done button')).toBeVisible();
});

test('the page\'s recent colours show as swatches, above the hex field',
	async ({ page, hg }) => {
		const a = hg.addObject('100000000001', OBJ(300, 300), 'A');
		hg.addObject('page', { 'page-recent-colors': '#ff0000,#00aa55,#3355ff' });
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await openPicker(page, a);

		const swatches = page.locator('.glue-picker-swatch');
		await expect(swatches).toHaveCount(3);
		// the colour sits on an inner layer; the swatch itself carries the
		// checkerboard that a semi-transparent colour has to show against
		expect(await swatches.first().evaluate((e) =>
			getComputedStyle(e.firstElementChild).backgroundColor)).toBe('rgb(255, 0, 0)');

		// above the editor row, not beside it
		const row = await page.locator('.glue-picker-recent').boundingBox();
		const editor = await page.locator('.picker_editor').boundingBox();
		expect(row.y + row.height).toBeLessThanOrEqual(editor.y + 1);
	});

test('clicking a swatch recolours the object', async ({ page, hg }) => {
	const a = hg.addObject('100000000001', OBJ(300, 300), 'A');
	hg.addObject('page', { 'page-recent-colors': '#ff0000,#00aa55' });
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await openPicker(page, a);

	await page.locator('.glue-picker-swatch').nth(1).click();
	await expect.poll(() => bgOf(page, a)).toBe('rgb(0, 170, 85)');
});

test('a colour that gets used is remembered on the page, most recent first',
	async ({ page, hg }) => {
		const a = hg.addObject('100000000001', OBJ(300, 300), 'A');
		hg.addObject('page', { 'page-recent-colors': '#ff0000,#00aa55' });
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await openPicker(page, a);

		// type an exact colour rather than aiming at the gradient. Enter in
		// the hex field is vanilla-picker's own "done", so the picker closes
		// on it and there is no Ok left to click
		const field = page.locator('.picker_editor input');
		await field.fill('#123456');
		await field.press('Enter');
		await expect(page.locator('.picker_wrapper')).toBeHidden();

		await expect.poll(() => hg.readObject('page').attrs['page-recent-colors'])
			.toBe('#123456,#ff0000,#00aa55');
	});

test('the list keeps seven, without repeats, and they fit on one row',
	async ({ page, hg }) => {
		const seven = '#111111,#222222,#333333,#444444,#555555,#666666,#777777';
		const a = hg.addObject('100000000001', OBJ(300, 300), 'A');
		hg.addObject('page', { 'page-recent-colors': seven });
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await openPicker(page, a);

		// seven is what the panel's width allows: an eighth would wrap the
		// row and make the panel taller
		await expect(page.locator('.glue-picker-swatch')).toHaveCount(7);
		const tops = await page.evaluate(() =>
			[...document.querySelectorAll('.glue-picker-swatch')]
				.map((e) => Math.round(e.getBoundingClientRect().y)));
		expect(new Set(tops).size, 'the swatch row wrapped onto two lines').toBe(1);

		// re-using one that is already in the list moves it to the front
		// rather than adding an eighth
		await page.locator('.glue-picker-swatch').nth(2).click();
		await page.locator('.picker_done button').click();
		await expect.poll(() => hg.readObject('page').attrs['page-recent-colors'])
			.toBe('#333333,#111111,#222222,#444444,#555555,#666666,#777777');

		// and a new one pushes the oldest off the end
		await openPicker(page, a);
		const field = page.locator('.picker_editor input');
		await field.fill('#abcdef');
		await field.press('Enter');
		await expect(page.locator('.picker_wrapper')).toBeHidden();
		await expect.poll(() => hg.readObject('page').attrs['page-recent-colors'])
			.toBe('#abcdef,#333333,#111111,#222222,#444444,#555555,#666666');
	});

// --- placement -----------------------------------------------------------
//
// "No menu or interface shall interfere with page elements" (the hotglue
// design codex) applies to the picker too, and it applies hardest here: it
// used to open at the pointer, which is inside the object as often as not, so
// it covered the very thing being recoloured. It goes beside the object now -
// right, below, left or above, whichever is nearest to the pointer and still
// fits on screen.

const overlaps = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width &&
	a.y < b.y + b.height && b.y < a.y + a.height;

test('the picker does not cover the object it is recolouring', async ({ page, hg }) => {
	const a = hg.addObject('100000000001', OBJ(300, 250), 'A');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await openPicker(page, a);

	const obj = await page.locator(`[id="${a}"]`).boundingBox();
	const pick = await page.locator('.picker_wrapper').boundingBox();
	expect(overlaps(pick, obj), 'the picker is sitting on top of the object').toBe(false);
});

test('nor the menu it was opened from', async ({ page, hg }) => {
	// covering the row the button lives in is not as bad as covering the
	// object, but the free canvas is right there
	const a = hg.addObject('100000000001', OBJ(300, 250), 'A');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await openPicker(page, a);

	const pick = await page.locator('.picker_wrapper').boundingBox();
	const items = await page.evaluate(() =>
		[...document.querySelectorAll('.glue-contextmenu-left, .glue-contextmenu-top')]
			.map((e) => {
				const b = e.getBoundingClientRect();
				return { id: e.id, x: b.x, y: b.y, width: b.width, height: b.height };
			}));
	expect(items.length, 'no menu was open, so this proved nothing').toBeGreaterThan(0);
	const hit = items.filter((i) => overlaps(pick, i)).map((i) => i.id);
	expect(hit, 'the picker is covering menu buttons').toEqual([]);
});

test('it moves to the other side when there is no room on the first',
	async ({ page, hg }) => {
		// an object hard against the right edge of the window has no free
		// space to its right, which is where the picker would rather go
		const viewport = page.viewportSize();
		const a = hg.addObject('100000000001', OBJ(viewport.width - 260, 250), 'A');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await openPicker(page, a);

		const obj = await page.locator(`[id="${a}"]`).boundingBox();
		const pick = await page.locator('.picker_wrapper').boundingBox();
		expect(overlaps(pick, obj), 'the picker is sitting on top of the object').toBe(false);
		expect(pick.x + pick.width, 'the picker hangs off the right of the window')
			.toBeLessThanOrEqual(viewport.width + 1);
	});

test('the speech-bubble tail is gone', async ({ page, hg }) => {
	// it pointed back at a corner of the popup itself once the popup stopped
	// opening at the pointer
	const a = hg.addObject('100000000001', OBJ(300, 250), 'A');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await openPicker(page, a);

	expect(await page.locator('.picker_arrow').evaluate((e) =>
		getComputedStyle(e).display)).toBe('none');
});

// --- transparency --------------------------------------------------------
//
// The picker has an alpha slider now, sitting under the gradient square and
// above the recent colours. It is the alpha of THIS colour, not the opacity
// of the object: a half-transparent background under fully solid text, which
// the object-transparency button cannot express since it fades everything at
// once. Both exist; they do different things.
//
// What comes back has to be something $.glue.color.parse() reads and CSS
// accepts, and - this is the part that matters for existing pages - an
// untouched opaque colour has to keep being stored as plain #rrggbb.

test('an opaque colour is still stored as plain hex', async ({ page, hg }) => {
	const a = hg.addObject('100000000001', OBJ(300, 250), 'A');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await openPicker(page, a);

	const field = page.locator('.picker_editor input');
	await field.fill('#123456');
	await field.press('Enter');
	// rgb(), not rgba(): the browser normalises whatever is assigned to a
	// style property, and what is stored is that serialisation - so the
	// meaningful assertion is that an opaque colour stays three-channel
	await expect.poll(() => hg.readObject('100000000001').attrs['text-background-color'])
		.toBe('rgb(18, 52, 86)');
});

test('a half-transparent colour is stored as rgba', async ({ page, hg }) => {
	const a = hg.addObject('100000000001', OBJ(300, 250), 'A');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await openPicker(page, a);

	// eight hex digits is how the picker's own field takes an alpha
	const field = page.locator('.picker_editor input');
	await field.fill('#ff00ff80');
	await field.press('Enter');

	await expect.poll(() => bgOf(page, a)).toMatch(/^rgba\(255, 0, 255, 0\.5/);
	await expect.poll(() => hg.readObject('100000000001').attrs['text-background-color'])
		.toMatch(/^rgba\(255, 0, 255, 0\.5/);
});

test('fully transparent is stored as the keyword, not rgba zero',
	async ({ page, hg }) => {
		// hotglue has always written 'transparent', and a page should not
		// start saying rgba(0, 0, 0, 0) just because the picker was opened
		const a = hg.addObject('100000000001', OBJ(300, 250), 'A');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await openPicker(page, a);

		const field = page.locator('.picker_editor input');
		await field.fill('#ff00ff00');
		await field.press('Enter');
		await expect.poll(() => hg.readObject('100000000001').attrs['text-background-color'])
			.toBe('transparent');
	});

test('an object stored with alpha opens with the slider where it left it',
	async ({ page, hg }) => {
		const a = hg.addObject('100000000001',
			{ ...OBJ(300, 250), 'text-background-color': 'rgba(255, 0, 255, 0.5)' }, 'A');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await openPicker(page, a);

		// the hex field is the readable version of where the slider is
		await expect(page.locator('.picker_editor input')).toHaveValue(/^#ff00ff8/i);
		await expect(page.locator('.glue-picker-alpha .glue-popover-field'))
			.toHaveValue('50');
		// and closing it again without touching anything changes nothing
		await page.locator('.picker_done button').click();
		expect(await bgOf(page, a)).toMatch(/^rgba\(255, 0, 255, 0\.5/);
	});

test('a transparent colour is remembered with its alpha', async ({ page, hg }) => {
	const a = hg.addObject('100000000001', OBJ(300, 250), 'A');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await openPicker(page, a);

	const field = page.locator('.picker_editor input');
	await field.fill('#ff00ff80');
	await field.press('Enter');
	// eight digits in the stored list: it is comma-separated, and rgba() is
	// full of commas
	await expect.poll(() => hg.readObject('page').attrs['page-recent-colors'])
		.toBe('#ff00ff80');

	// and the swatch puts that alpha back
	await openPicker(page, a);
	await page.locator('.glue-picker-swatch').first().click();
	await expect.poll(() => bgOf(page, a)).toMatch(/^rgba\(255, 0, 255, 0\.5/);
});

// --- the alpha row -------------------------------------------------------
//
// vanilla-picker's own alpha control is a gradient bar from the colour to a
// checkerboard, with a handle somewhere along it: it shows the effect of the
// value without ever showing the value, and there is no way to type one. It
// is replaced by the same slider-and-field row the font and spacing panels
// use, in percent.

const alphaField = (page) => page.locator('.glue-picker-alpha .glue-popover-field');
const alphaSlider = (page) => page.locator('.glue-picker-alpha .glue-popover-slider');

// the object's alpha as a 0..100 integer (100 when the colour is opaque -
// rgba() serialises a trailing .30 as 0.3, so compare numbers, not strings)
const alphaOf = (page, id) => page.evaluate((i) => {
	const m = getComputedStyle(document.getElementById(i)).backgroundColor
		.match(/\d+\.?\d*/g);
	return m && m.length === 4 ? Math.round(parseFloat(m[3]) * 100) : 100;
}, id);

test('transparency is a slider and a field, not the gradient bar',
	async ({ page, hg }) => {
		const a = hg.addObject('100000000001', OBJ(300, 250), 'A');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await openPicker(page, a);

		await expect(alphaSlider(page)).toBeVisible();
		await expect(alphaField(page)).toBeVisible();
		expect(await page.locator('.picker_alpha').evaluate((e) =>
			getComputedStyle(e).display), 'the old alpha bar is still there').toBe('none');
		// an untouched opaque colour is 100%
		await expect(alphaField(page)).toHaveValue('100');
	});

test('dragging the alpha slider keeps the value and applies it', async ({ page, hg }) => {
	// the library swallows every click inside the panel; a range input
	// COMMITS its value on click - the track click, and the end of a drag -
	// and Chromium cancels the commit (and reverts the value) when that
	// click is prevented. The alpha row's clicks stop before the library's
	// handler sees them, so the drag must end where the finger lets go -
	// the object stays at the dragged alpha instead of snapping back
	// opaque, and the slider stays where the drag left it.
	const a = hg.addObject('100000000001', OBJ(300, 300), 'A');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await openPicker(page, a);

	const slider = alphaSlider(page);
	const bb = await slider.boundingBox();
	// grab the thumb (the right end, value 100) and pull it leftward
	await page.mouse.move(bb.x + bb.width - 6, bb.y + bb.height / 2);
	await page.mouse.down();
	for (let i = 1; i <= 8; i++) {
		await page.mouse.move(
			bb.x + bb.width - 6 - (bb.width - 16) * i / 10, bb.y + bb.height / 2);
	}
	await page.mouse.up();

	// off the default, and the field says the same thing the slider does
	const v = parseInt(await slider.inputValue());
	expect(v).toBeLessThan(100);
	expect(v).toBeGreaterThan(0);
	await expect(alphaField(page)).toHaveValue(String(v));
	// the object carries the dragged alpha - not the opaque it would snap
	// back to if the commit had been cancelled (alphaOf returns 100 for an
	// opaque rgb(), so a cancelled commit fails this loudly)
	await expect.poll(() => alphaOf(page, a)).toBe(v);
});

test('a click on the alpha track commits the clicked value', async ({ page, hg }) => {
	const a = hg.addObject('100000000001', OBJ(300, 300), 'A');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await openPicker(page, a);

	const slider = alphaSlider(page);
	const bb = await slider.boundingBox();
	// a plain click at ~40% of the track: the thumb jumps there and the
	// click must keep it there rather than snap it back to 100
	await page.mouse.click(bb.x + bb.width * 0.4, bb.y + bb.height / 2);

	const v = parseInt(await slider.inputValue());
	expect(v).toBeGreaterThan(20);
	expect(v).toBeLessThan(80);
	await expect(alphaField(page)).toHaveValue(String(v));
	await expect.poll(() => alphaOf(page, a)).toBe(v);
});

test('typing an alpha applies it and stores it', async ({ page, hg }) => {
	const a = hg.addObject('100000000001', OBJ(300, 250), 'A');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await openPicker(page, a);

	const field = page.locator('.picker_editor input');
	await field.fill('#00ff00');
	await field.press('Enter');
	await openPicker(page, a);

	await alphaField(page).fill('25');
	await alphaField(page).dispatchEvent('input');
	await expect.poll(() => bgOf(page, a)).toMatch(/^rgba\(0, 255, 0, 0\.25/);
	await expect(alphaSlider(page)).toHaveValue('25');

	await page.locator('.picker_done button').click();
	await expect.poll(() => hg.readObject('100000000001').attrs['text-background-color'])
		.toMatch(/^rgba\(0, 255, 0, 0\.25/);
});

test('the row follows a colour that arrives from somewhere else',
	async ({ page, hg }) => {
		// the hex field and the swatches can both change the alpha, and the
		// row has to say what is true whichever it was
		const a = hg.addObject('100000000001', OBJ(300, 250), 'A');
		hg.addObject('page', { 'page-recent-colors': '#0000ff33' });
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await openPicker(page, a);

		const hex = page.locator('.picker_editor input');
		await hex.fill('#ff000080');
		await hex.dispatchEvent('input');
		await expect(alphaField(page)).toHaveValue('50');

		await page.locator('.glue-picker-swatch').first().click();
		await expect(alphaField(page)).toHaveValue('20');
	});

test('the sample is square and the hex field fits eight digits',
	async ({ page, hg }) => {
		const a = hg.addObject('100000000001',
			{ ...OBJ(300, 250), 'text-background-color': 'rgba(255, 0, 255, 0.5)' }, 'A');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await openPicker(page, a);

		const sample = await page.locator('.picker_sample').boundingBox();
		expect(Math.abs(sample.width - sample.height),
			'the colour sample is a bar, not a swatch').toBeLessThanOrEqual(1);

		// the hex field, the sample and Ok stay on one line: the field was
		// widened for the alpha digits and the panel with it
		const hex = await page.locator('.picker_editor').boundingBox();
		const ok = await page.locator('.picker_done').boundingBox();
		expect(Math.abs(hex.y - sample.y), 'the editor row wrapped').toBeLessThan(4);
		expect(Math.abs(hex.y - ok.y), 'the editor row wrapped').toBeLessThan(4);
		// and it shows all eight digits without clipping them
		await expect(page.locator('.picker_editor input')).toHaveValue(/^#ff00ff80$/i);
		const input = page.locator('.picker_editor input');
		expect(await input.evaluate((e) => e.scrollWidth <= e.clientWidth + 1),
			'the hex value does not fit its field').toBe(true);
	});

test('a new text object takes the last colour used on the page',
	async ({ page, hg }) => {
		// so a run of new objects comes out in the palette being worked in,
		// rather than in a different random colour each time
		hg.addObject('page', { 'page-recent-colors': '#3355ff,#ff0000' });
		await page.goto(hg.editUrl());
		await page.waitForFunction(() => window.$ && window.$.glue && window.$.glue.object);

		// the "new" menu opens on a click on empty canvas
		await page.mouse.click(500, 400);
		await page.getByTitle('add a new text object').click();
		await page.waitForFunction(() => document.querySelectorAll('.text.object').length === 1);

		expect(await page.evaluate(() =>
			getComputedStyle(document.querySelector('.text.object')).backgroundColor))
			.toBe('rgb(51, 85, 255)');
	});

test('and falls back to a random default on a page with no colours yet',
	async ({ page, hg }) => {
		await page.goto(hg.editUrl());
		await page.waitForFunction(() => window.$ && window.$.glue && window.$.glue.object);

		await page.mouse.click(500, 400);
		await page.getByTitle('add a new text object').click();
		await page.waitForFunction(() => document.querySelectorAll('.text.object').length === 1);

		const bg = await page.evaluate(() =>
			getComputedStyle(document.querySelector('.text.object')).backgroundColor);
		const defaults = await page.evaluate(() => $.glue.conf.object.default_colors);
		expect(defaults.length, 'no default colours are configured at all').toBeGreaterThan(0);
		// whichever one it picked, it is one of them
		const asRgb = await page.evaluate((list) => list.map((c) => {
			const d = document.createElement('div');
			d.style.backgroundColor = c;
			document.body.appendChild(d);
			const v = getComputedStyle(d).backgroundColor;
			d.remove();
			return v;
		}), defaults);
		expect(asRgb).toContain(bg);
	});
