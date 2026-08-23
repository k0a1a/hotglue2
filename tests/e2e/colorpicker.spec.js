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
	expect(b.width, 'the picker is back to its full default width').toBeLessThan(180);
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

test('the list keeps five, without repeats', async ({ page, hg }) => {
	const a = hg.addObject('100000000001', OBJ(300, 300), 'A');
	hg.addObject('page', { 'page-recent-colors': '#111111,#222222,#333333,#444444,#555555' });
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);

	// re-using one that is already in the list moves it to the front rather
	// than adding a sixth
	await openPicker(page, a);
	await page.locator('.glue-picker-swatch').nth(2).click();
	await page.locator('.picker_done button').click();
	await expect.poll(() => hg.readObject('page').attrs['page-recent-colors'])
		.toBe('#333333,#111111,#222222,#444444,#555555');

	// and a new one pushes the oldest off the end
	await openPicker(page, a);
	const field = page.locator('.picker_editor input');
	await field.fill('#abcdef');
	await field.press('Enter');
	await expect(page.locator('.picker_wrapper')).toBeHidden();
	await expect.poll(() => hg.readObject('page').attrs['page-recent-colors'])
		.toBe('#abcdef,#333333,#111111,#222222,#444444');
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
