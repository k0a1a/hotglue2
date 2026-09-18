// The font popover: the type's sizes, styles and alignments in one panel, in
// place of the three buttons that used to be here - one that cycled through
// faces a click at a time, one that had to be dragged to change the size, and
// one that cycled bold -> italic -> both -> normal.
//
// What the panel SHOWS since 2026-09-17 is four sizes as buttons (s, n, b, x),
// the four styles with the colour beside them, and the four alignments; the
// face came back out above the fold on 2026-09-18, and the exact size and
// everything else stay under "more knobs". So `own` below - the panel's own
// rows, outside the fold - is the three rows the panel opens on plus the
// face, and the size field and the slider are reached through openFold.
//
// Two things about it are worth pinning down beyond "the controls work".
//
// SCOPE IS THE WHOLE OBJECT. Every control in this menu styles the object, not
// a selection, so the toggles are two-state: there is no partial state to be
// in. If per-selection styling is ever built, these tests are what says what
// the object-level behaviour was.
//
// UNDERLINE AND STRIKETHROUGH ARE ONE CSS PROPERTY, and nothing stored it
// before this panel existed. hotglue's save maps a fixed list of properties to
// object attributes and drops the rest, so both of those toggles look right on
// screen and vanish on reload unless module_text.inc.php knows about
// text-decoration. That is the failure this file exists to catch.

const { test, expect, waitForEditor } = require('./fixtures/hotglue.js');

const ATTRS = {
	type: 'text', module: 'text',
	'object-left': '340px', 'object-top': '300px',
	'object-width': '220px', 'object-height': '120px', 'object-zindex': '100',
	'text-background-color': 'transparent', 'text-font-size': '18px',
};

const byId = (page, id) => page.locator(`[id="${id}"]`);
const fontBtn = (page) => page.getByTitle(/font: face, size and style/);
const pop = (page) => page.locator('.glue-font-popover');
// the panel's own rows, not the ones inside the advanced fold
const own = (page) => page.locator('.glue-font-popover > .glue-popover-row');
const fold = (page) => pop(page).locator('.glue-popover-advanced');
const sizeBtn = (page, which) => page.locator(`.glue-font-size-${which}`);
const toggle = (page, which) => page.locator(`.glue-font-toggle-${which}`);

// the exact size and the rest of the panel live in the fold (the face moved
// out above it on 2026-09-18): a control in there is in the DOM whether or
// not it is open, so counts and classes read the same either way and it is
// clicking, filling and selecting that need the way in
async function openFold(page) {
	await pop(page).locator('.glue-popover-disclosure').click();
	await expect(fold(page)).toBeVisible();
}
const cssOf = (page, id, prop) => page.evaluate(([i, p]) =>
	getComputedStyle(document.getElementById(i))[p], [id, prop]);

async function open(page, id) {
	const obj = byId(page, id);
	if (!(await obj.evaluate((e) => e.classList.contains('glue-selected')))) {
		await obj.click();
	}
	await expect(fontBtn(page)).toBeVisible();
	await page.waitForTimeout(400);		// the menu fades in
	await fontBtn(page).click();
	await expect(pop(page)).toBeVisible();
}

test('one button opens the panel, and the three it replaced are gone',
	async ({ page, hg }) => {
		const a = hg.addObject('100000000001', ATTRS, 'A');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await open(page, a);

		// the four sizes the panel opens on, and the styles and alignments
		await expect(sizeBtn(page, 's')).toBeVisible();
		await expect(sizeBtn(page, 'n')).toBeVisible();
		await expect(sizeBtn(page, 'b')).toBeVisible();
		await expect(sizeBtn(page, 'x')).toBeVisible();
		await expect(page.locator('.glue-font-toggle')).toHaveCount(4);
		await expect(page.locator('.glue-align-btn')).toHaveCount(4);
		// and no track among the panel's own rows: the size is folded now, and
		// the six knobs in the fold are scrubs - rows you drag, not sliders
		await expect(own(page).locator('.glue-popover-slider')).toHaveCount(0);
		// the face is out in the open above the fold (2026-09-18); the exact
		// size and the reset are in the fold - the reset clears the whole
		// panel, more than the rows above it set
		await expect(page.locator('.glue-font-face-btn')).toBeVisible();
		await expect(fold(page)).toBeHidden();
		await openFold(page);
		await expect(fold(page).locator('.glue-popover-scrub')).toHaveCount(6);
		await expect(fold(page).locator('.glue-popover-slider')).toHaveCount(0);
		await expect(own(page).locator('.glue-popover-reset')).toHaveCount(0);

		for (const gone of ['text-font-size', 'text-font-face', 'text-font-style']) {
			expect(await page.locator(`#glue-contextmenu-${gone}`).count(),
				`${gone} is still in the menu`).toBe(0);
		}
	});

test('it opens beside the object, not over it', async ({ page, hg }) => {
	// the same rule the colour picker follows, and the reason $.glue.popover
	// exists as one thing rather than two
	const a = hg.addObject('100000000001', ATTRS, 'A');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await open(page, a);

	const o = await byId(page, a).boundingBox();
	const p = await pop(page).boundingBox();
	const overlaps = p.x < o.x + o.width && o.x < p.x + p.width &&
		p.y < o.y + o.height && o.y < p.y + p.height;
	expect(overlaps, 'the panel is sitting on top of the object').toBe(false);
});

test('it reads the object it was opened on', async ({ page, hg }) => {
	const a = hg.addObject('100000000001', {
		...ATTRS, 'text-font-size': '37px', 'text-font-weight': 'bold',
		'text-text-decoration': 'underline',
	}, 'A');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await open(page, a);

	await openFold(page);
	await expect(fold(page).locator('.glue-popover-field').first()).toHaveValue('37');
	// 37px is none of the four sizes the panel shows, so all four are unlit:
	// the honest picture rather than rounding to the nearest
	await expect(sizeBtn(page, 's')).not.toHaveClass(/glue-font-size-on/);
	await expect(sizeBtn(page, 'n')).not.toHaveClass(/glue-font-size-on/);
	await expect(sizeBtn(page, 'b')).not.toHaveClass(/glue-font-size-on/);
	await expect(sizeBtn(page, 'x')).not.toHaveClass(/glue-font-size-on/);
	await expect(toggle(page, 'bold')).toHaveClass(/glue-font-toggle-on/);
	await expect(toggle(page, 'underline')).toHaveClass(/glue-font-toggle-on/);
	await expect(toggle(page, 'italic')).not.toHaveClass(/glue-font-toggle-on/);
	await expect(toggle(page, 'strike')).not.toHaveClass(/glue-font-toggle-on/);
});

test('the size field takes a value past its drag range', async ({ page, hg }) => {
	const a = hg.addObject('100000000001', ATTRS, 'A');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await open(page, a);

	await openFold(page);
	const field = fold(page).locator('.glue-popover-field').first();

	await field.fill('42');
	await field.dispatchEvent('input');
	await expect.poll(() => cssOf(page, a, 'fontSize')).toBe('42px');

	// Display type runs past the end of any sensible drag range. The row's
	// max is 100 - it is what the DRAG stops at, and ArrowUp/Down in the
	// field with it - and the field keeps the real number. Until
	// 2026-09-17 this asserted that the slider parked at 100 while the field
	// said 300; there is no slider to park now, so what is asserted is the
	// half that still exists: the range is the row's, the value is the field's.
	await field.fill('300');
	await field.dispatchEvent('input');
	await expect(field).toHaveValue('300');
	await expect.poll(() => cssOf(page, a, 'fontSize')).toBe('300px');
	expect(await field.getAttribute('max')).toBe('100');
});

test('a typed value is clamped to what its row can MEAN, and what each key does to a drag',
	async ({ page, hg }) => {
		// The test above is the half of the range where a typed value runs past
		// min/max and is kept - min/max is what a DRAG traverses. This is the
		// other half: a magnitude or a percentage has a range it means, and a
		// typed value outside it is not the object's value but a number the
		// file would keep while the page rendered something else. Read off the
		// object file, because that is where the disagreement lands.
		const a = hg.addObject('100000000001',
			{ ...ATTRS, 'text-shadow-radius': '8' }, 'A');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await open(page, a);
		await openFold(page);

		const knob = (label) => fold(page).locator('.glue-popover-scrub')
			.filter({ has: page.locator(`.glue-popover-label:text-is("${label}")`) });
		const commit = async (label, value) => {
			const f = knob(label).locator('.glue-popover-field');
			await f.fill(String(value));
			await f.dispatchEvent('input');
			await f.dispatchEvent('change');
			return f.inputValue();
		};
		const attrs = () => hg.readObject('100000000001').attrs;

		// a line-height of -2 is a declaration the browser drops: the object
		// would render at its default while the file kept the number
		expect(await commit('line', -2)).toBe('0.00');
		await expect.poll(() => cssOf(page, a, 'lineHeight')).toBe('0em');

		// the shadow radius goes through a writer that reads anything at or
		// below zero as "no shadow", so -5 used to take the shadow off and
		// leave -5 in the field as the reason it had gone
		expect(await commit('shadow', -5)).toBe('0.0');
		await expect.poll(() => attrs()['text-shadow-radius']).toBe(undefined);

		// a percentage of opacity is the case the clamp was added for: the file
		// used to keep whatever was typed - 150 - while the page clamped it, so
		// neither the panel nor the object file said what the shadow was doing
		await commit('shadow', 8);
		expect(await commit('fade', 150)).toBe('100');
		await expect.poll(() => attrs()['text-shadow-alpha']).toBe('100');
		expect(await commit('fade', -20)).toBe('0');

		// a row with no hard range still keeps whatever is typed into it, which
		// is what stops this being a cap on every row: letter-spacing is signed
		expect(await commit('letter', -0.05)).toBe('-0.05');
		await expect.poll(() => cssOf(page, a, 'letterSpacing')).toBe('-0.05em');

		// Shift coarsens the drag and Alt refines it, four either way, read
		// from the move event so either key can be pressed mid-drag. Letter
		// spacing drags at 1.2em per 600px, so 40px is 0.08 by hand.
		const drag = async (dx, modifier) => {
			await commit('letter', 0);
			const box = await knob('letter').boundingBox();
			const y = box.y + box.height/2;
			const x = box.x + box.width/2;
			if (modifier) await page.keyboard.down(modifier);
			await page.mouse.move(x, y);
			await page.mouse.down();
			await page.mouse.move(x + dx/2, y, { steps: 4 });
			await page.mouse.move(x + dx, y, { steps: 4 });
			await page.mouse.up();
			if (modifier) await page.keyboard.up(modifier);
			return knob('letter').locator('.glue-popover-field').inputValue();
		};
		expect(await drag(40)).toBe('0.08');
		expect(await drag(40, 'Shift')).toBe('0.32');
		expect(await drag(40, 'Alt')).toBe('0.02');
		// and Control is not a modifier: the pair is Shift and Alt/Cmd, and a
		// key that is not one of them must leave the drag alone
		expect(await drag(40, 'Control')).toBe('0.08');
	});

test('the row shows its arrow, and Escape takes a typed value back',
	async ({ page, hg }) => {
		// The two halves of a scrub that the pointer cannot demonstrate: the
		// ↔ glyph, which is the affordance on a touch screen where there is
		// no hover to change a cursor, and the Escape every field is expected
		// to have. The drag itself is text-spacing-popover.spec.js's; this is
		// what the row looks like and what a key press does to it.
		const a = hg.addObject('100000000001',
			{ ...ATTRS, 'text-letter-spacing': '0em' }, 'A');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await open(page, a);
		await openFold(page);

		const row = fold(page).locator('.glue-popover-scrub')
			.filter({ has: page.locator('.glue-popover-label:text-is("letter")') });
		const field = row.locator('.glue-popover-field');
		const stored = () => hg.readObject('100000000001').attrs['text-letter-spacing'];

		// one arrow per knob row, drawn inside the field's own right end
		// since 2026-09-17 (where the browser's steppers used to be), and a
		// numeric keyboard when a finger taps the field
		await expect(fold(page).locator('.glue-popover-scrub-arrow')).toHaveCount(6);
		await expect(row.locator('.glue-popover-scrub-arrow')).toHaveText('↔');
		await expect(field).toHaveAttribute('inputmode', 'decimal');
		expect(await row.evaluate((e) => getComputedStyle(e).cursor),
			'the row does not read as a handle').toBe('grab');

		// typing applies live, so the object moves as the number is typed...
		await field.fill('0.15');
		await field.dispatchEvent('input');
		await expect.poll(() => cssOf(page, a, 'letterSpacing')).toBe('0.15em');
		// ...and Escape puts it back. Nothing was stored - typing alone never
		// stores - so there is nothing to store back, and the file keeps the
		// value it had rather than gaining the default of an attribute it
		// never had.
		await page.keyboard.press('Escape');
		await expect.poll(() => cssOf(page, a, 'letterSpacing')).toBe('normal');
		await expect(field).toHaveValue('0.00');
		expect(stored(), 'the cancel wrote to the file').toBe('0em');
		// the panel is still open: that Escape was the field's, not its
		await expect(pop(page)).toBeVisible();

		// A value that HAS been stored is the other case. Escape takes it back
		// on disk as well, because an editor showing 0 while the file says 0.2
		// is the editor lying about the page.
		await field.fill('0.2');
		await field.dispatchEvent('input');
		await page.keyboard.press('Enter');
		await expect.poll(stored).toBe('0.2em');
		await page.keyboard.press('Escape');
		await expect(field).toHaveValue('0.00');
		await expect.poll(stored).toBe('0em');

		// the third way in: the arrow keys nudge by one step. The editor has
		// its own arrow-key nudge - it moves the selected object - and the
		// field has to win that while the caret is in it.
		const pos = byId(page, a);
		const left = await pos.evaluate((e) => e.style.left);
		const was = await field.inputValue();
		await field.click();
		await page.keyboard.press('ArrowUp');
		await expect(field).not.toHaveValue(was);
		expect(await pos.evaluate((e) => e.style.left),
			'the object moved while a number was being nudged').toBe(left);
	});

test('a size change is stored, and keeps line-height in proportion',
	async ({ page, hg }) => {
		// the old size control moved line-height with the font size, holding
		// whatever ratio was in effect; changing size here must not flatten a
		// line-height someone set on purpose
		const a = hg.addObject('100000000001',
			{ ...ATTRS, 'text-font-size': '20px', 'text-line-height': '40px' }, 'A');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await open(page, a);

		await openFold(page);
		const field = fold(page).locator('.glue-popover-field').first();
		await field.fill('30');
		await field.dispatchEvent('input');
		await field.dispatchEvent('change');

		await expect.poll(() => hg.readObject('100000000001').attrs['text-font-size'])
			.toBe('30px');
		// the ratio was 2, so 30px of type gets 60px of line
		await expect.poll(() => hg.readObject('100000000001').attrs['text-line-height'])
			.toBe('60px');
	});

test('the four sizes set the size, light up, and keep line-height in step',
	async ({ page, hg }) => {
		// the panel opens on these rather than on the slider: most objects are
		// set in one of four sizes, and the exact number is the fold's
		const a = hg.addObject('100000000001',
			{ ...ATTRS, 'text-font-size': '16px', 'text-line-height': '24px' }, 'A');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await open(page, a);

		// 16 is normal, so it is the one that is lit
		await expect(sizeBtn(page, 'n')).toHaveClass(/glue-font-size-on/);
		await expect(sizeBtn(page, 's')).not.toHaveClass(/glue-font-size-on/);
		await expect(sizeBtn(page, 'b')).not.toHaveClass(/glue-font-size-on/);
		await expect(sizeBtn(page, 'x')).not.toHaveClass(/glue-font-size-on/);

		// the two ends of the scale: 8 and 32, with big now in between them
		for (const [which, px] of [['s', 8], ['x', 32]]) {
			await sizeBtn(page, which).click();
			await expect.poll(() => cssOf(page, a, 'fontSize')).toBe(px+'px');
			await expect.poll(() => hg.readObject('100000000001').attrs['text-font-size'])
				.toBe(px+'px');
			await expect(sizeBtn(page, which)).toHaveClass(/glue-font-size-on/);
			await expect(sizeBtn(page, 'n')).not.toHaveClass(/glue-font-size-on/);
			// the ratio in force was 1.5, and it holds, as it did through the
			// drag control this replaced
			await expect.poll(() => hg.readObject('100000000001').attrs['text-line-height'])
				.toBe(Math.round(px*1.5)+'px');
		}

		// the slider in the fold is the same number seen the other way round
		await openFold(page);
		await expect(fold(page).locator('.glue-popover-field').first()).toHaveValue('32');
	});

test('the face dropdown lists the faces and applies one', async ({ page, hg }) => {
	const a = hg.addObject('100000000001', ATTRS, 'A');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await open(page, a);
	// the dropdown is a custom list (2026-09-18): the button opens it, and
	// the list is what the hover sample hangs off - a native select's list
	// is the OS's own and reports no option the pointer is over
	await page.locator('.glue-font-face-btn').click();
	const list = page.locator('.glue-font-face-list');
	await expect(list).toBeVisible();
	const opts = list.locator('.glue-font-face-opt');
	const values = await opts.evaluateAll((os) => os.map((o) => o.dataset.value));
	expect(values.length, 'no faces were offered at all').toBeGreaterThan(1);
	// each name is written in its own face - the point of the list
	expect(await opts.first().evaluate((o) => o.style.fontFamily === o.dataset.value),
		'the options are not set in the face they name').toBe(true);
	// and every displayed name is 24 characters or fewer - the value it
	// writes is still the full family string (danja's call, 2026-09-18)
	expect(await opts.evaluateAll((os) =>
		Math.max(...os.map((o) => o.textContent.length))))
		.toBeLessThanOrEqual(24);

	const pick = values[values.length - 1];
	const pick_opt = opts.nth(values.length - 1);
	// the hover alone already wears the face in the sample, before
	// anything is picked - the point of the custom list
	await pick_opt.hover();
	await expect.poll(() => page.evaluate(() =>
		getComputedStyle(document.querySelector('.glue-font-preview')).fontFamily))
		.toBe(pick);
	await pick_opt.click();
	await expect.poll(() => cssOf(page, a, 'fontFamily')).toBe(pick);
	await expect.poll(() => hg.readObject('100000000001').attrs['text-font-family'])
		.toBeTruthy();
	// the sample keeps the picked face once the list has closed
	await expect.poll(() => page.evaluate(() =>
		getComputedStyle(document.querySelector('.glue-font-preview')).fontFamily))
		.toBe(pick);
});

test('bold and italic are independent, and combinable', async ({ page, hg }) => {
	// they used to be one button cycling bold -> italic -> both -> normal
	const a = hg.addObject('100000000001', ATTRS, 'A');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await open(page, a);

	await toggle(page, 'bold').click();
	await expect.poll(() => cssOf(page, a, 'fontWeight')).toBe('700');
	expect(await cssOf(page, a, 'fontStyle'), 'bold turned italic on too').toBe('normal');

	await toggle(page, 'italic').click();
	await expect.poll(() => cssOf(page, a, 'fontStyle')).toBe('italic');
	expect(await cssOf(page, a, 'fontWeight'), 'italic turned bold off').toBe('700');

	await toggle(page, 'bold').click();
	await expect.poll(() => cssOf(page, a, 'fontWeight')).toBe('400');
	expect(await cssOf(page, a, 'fontStyle'), 'unbolding turned italic off').toBe('italic');
});

test('underline and strikethrough combine rather than overwrite',
	async ({ page, hg }) => {
		// one css property, two toggles: the classic way to get this wrong is
		// for the second to replace the first
		const a = hg.addObject('100000000001', ATTRS, 'A');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await open(page, a);

		await toggle(page, 'underline').click();
		await expect.poll(() => cssOf(page, a, 'textDecorationLine')).toBe('underline');

		await toggle(page, 'strike').click();
		const both = await cssOf(page, a, 'textDecorationLine');
		expect(both).toContain('underline');
		expect(both).toContain('line-through');

		await toggle(page, 'underline').click();
		await expect.poll(() => cssOf(page, a, 'textDecorationLine')).toBe('line-through');
	});

test('a decoration survives the save, the reload and the published page',
	async ({ page, hg }) => {
		// nothing stored text-decoration before this panel, and a property
		// that is not on the save list is dropped: this is the check that
		// module_text.inc.php learned it
		const a = hg.addObject('100000000001', ATTRS, 'A');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await open(page, a);

		await toggle(page, 'underline').click();
		await toggle(page, 'strike').click();
		await expect.poll(() => hg.readObject('100000000001').attrs['text-text-decoration'])
			.toMatch(/underline/);

		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		expect(await cssOf(page, a, 'textDecorationLine')).toContain('underline');
		expect(await cssOf(page, a, 'textDecorationLine')).toContain('line-through');

		await page.goto(`/?${hg.pageName}`);
		const published = await page.evaluate(() =>
			getComputedStyle(document.querySelector('.object')).textDecorationLine);
		expect(published).toContain('underline');
		expect(published).toContain('line-through');
	});

test('turning both decorations off removes the property rather than storing none',
	async ({ page, hg }) => {
		const a = hg.addObject('100000000001',
			{ ...ATTRS, 'text-text-decoration': 'underline' }, 'A');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await open(page, a);

		await toggle(page, 'underline').click();
		await expect.poll(() => hg.readObject('100000000001').attrs['text-text-decoration'])
			.toBe(undefined);
	});

test('a click outside closes it, and Escape closes it', async ({ page, hg }) => {
	const a = hg.addObject('100000000001', ATTRS, 'A');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await open(page, a);

	await page.mouse.click(30, 30);
	await expect(pop(page)).toHaveCount(0);

	await open(page, a);
	await page.keyboard.press('Escape');
	await expect(pop(page)).toHaveCount(0);
});

test('the text colour lives in the panel now, not in the menu',
	async ({ page, hg }) => {
		// it was a button of its own until this panel existed; the colour of
		// the type belongs with how the type looks
		const a = hg.addObject('100000000001', ATTRS, 'A');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await open(page, a);

		expect(await page.locator('#glue-contextmenu-text-font-color').count(),
			'the standalone font colour button is still in the menu').toBe(0);

		await own(page).locator('.glue-popover-color').click();
		await expect(page.locator('.picker_wrapper')).toBeVisible();
		// the panel stays open while the picker is used
		await expect(pop(page)).toHaveCount(1);

		const hex = page.locator('.picker_editor input');
		await hex.fill('#3366cc');
		await hex.press('Enter');
		await expect.poll(() => cssOf(page, a, 'color')).toBe('rgb(51, 102, 204)');
		await expect.poll(() => hg.readObject('100000000001').attrs['text-font-color'])
			.toBe('rgb(51, 102, 204)');
	});

test('the text shadow stores its ingredients and reaches the published page',
	async ({ page, hg }) => {
		// text-shadow with no offset: a halo around the letters rather than a
		// shadow beside them. Stored like the object glow - a radius, a
		// strength and a colour - with the value composed in css/main.css, so
		// the shadow itself exists in one place rather than in the editor and
		// the renderer both.
		const a = hg.addObject('100000000001', ATTRS, 'A');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await open(page, a);
		await pop(page).locator('.glue-popover-disclosure').click();

		const fold = pop(page).locator('.glue-popover-advanced');
		// the fold's fields in order: size, line, letter, word, shadow, fade -
		// the shadow's radius is the fifth, two places further down than it was
		// before the size joined them (2026-09-17)
		const radius = fold.locator('.glue-popover-field').nth(4);
		await radius.fill('8');
		await radius.dispatchEvent('input');
		await radius.dispatchEvent('change');

		await expect(byId(page, a)).toHaveClass(/glue-text-shadow/);
		expect(await cssOf(page, a, 'textShadow')).toContain('8px');
		await expect.poll(() => hg.readObject('100000000001').attrs['text-shadow-radius'])
			.toBe('8');
		expect(JSON.stringify(hg.readObject('100000000001').attrs),
			'the composed shadow got into the object file').not.toContain('rgba(');

		await page.goto(`/?${hg.pageName}`);
		const published = await page.evaluate(() => {
			const el = document.querySelector('.object');
			return [el.className, getComputedStyle(el).textShadow];
		});
		expect(published[0]).toContain('glue-text-shadow');
		expect(published[1]).toContain('8px');
	});

test('a shadow radius of zero takes the shadow off', async ({ page, hg }) => {
	const a = hg.addObject('100000000001',
		{ ...ATTRS, 'text-shadow-radius': '8', 'text-shadow-color': '#ff0000' }, 'A');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await open(page, a);
	await pop(page).locator('.glue-popover-disclosure').click();

	const radius = pop(page).locator('.glue-popover-advanced .glue-popover-field').nth(4);
	await radius.fill('0');
	await radius.dispatchEvent('input');
	await radius.dispatchEvent('change');
	await expect(byId(page, a)).not.toHaveClass(/glue-text-shadow/);
	await expect.poll(() => hg.readObject('100000000001').attrs['text-shadow-radius'])
		.toBe(undefined);
});

test('the fold says where new fonts come from', async ({ page, hg }) => {
	// the dropdown lists what is installed; uploading is site-wide and lives
	// in site settings, which is not somewhere anyone would think to look
	// from here. The note sits under the face, out in the open.
	const a = hg.addObject('100000000001', ATTRS, 'A');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await open(page, a);

	const link = pop(page).locator('.glue-font-note a');
	await expect(link).toHaveText('site settings');
	expect(await link.getAttribute('href')).toContain('?pages');
});
