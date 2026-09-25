// The font popover: the type's sizes, styles and alignments in one panel, in
// place of the three buttons that used to be here - one that cycled through
// faces a click at a time, one that had to be dragged to change the size, and
// one that cycled bold -> italic -> both -> normal.
//
// What the panel SHOWS since 2026-09-18 is ONE editor for both targets: the
// four acts as icons with the colour beside them, four sizes as buttons
// (s, n, b, x) with the Typeface sample, and the four alignments; the face and the
// link row follow, and the exact size, the spacings, the shadow and the
// reset stay under "more knobs". So `own` below - the panel's own rows,
// outside the fold - is what the panel opens on, and the size field and the
// scrubs are reached through openFold.
//
// Two things about it are worth pinning down beyond "the controls work".
//
// SCOPE HERE IS THE WHOLE OBJECT. These tests open the panel with nothing
// selected - a caret - so every control targets the object and the toggles
// are two-state: there is no third, partial state to be in. The run target
// is text-formatting.spec.js's; what this file pins is the object-level
// behaviour the run target reads through.
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
// the panel's four acts, named by their short tooltips (they act on either
// target, so "bold the selected text" would lie half the time)
const toggle = (page, which) => pop(page)
	.locator(`.glue-popover-icon[title="${which == 'strike' ? 'strikethrough' : which}"]`);

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
		await expect(pop(page).locator('.glue-popover-icon[data-fmt]')).toHaveCount(4);
		await expect(page.locator('.glue-align-btn')).toHaveCount(4);
		// and no track among the panel's own rows: the size is folded now, and
		// the six knobs in the fold are scrubs - rows you drag, not sliders
		await expect(own(page).locator('.glue-popover-slider')).toHaveCount(0);
		// the face wheel is out in the open above the fold (the button that
		// opened it is gone, 2026-09-21); the exact size and the reset are
		// in the fold - the reset clears the whole panel, more than the rows
		// above it set
		await expect(page.locator('.glue-font-face-list')).toBeVisible();
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
	await expect(toggle(page, 'bold')).toHaveClass(/glue-btn-active/);
	await expect(toggle(page, 'underline')).toHaveClass(/glue-btn-active/);
	await expect(toggle(page, 'italic')).not.toHaveClass(/glue-btn-active/);
	await expect(toggle(page, 'strike')).not.toHaveClass(/glue-btn-active/);
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
		// computed line-height is the resolved length: 0em comes back as 0px
		await expect.poll(() => cssOf(page, a, 'lineHeight')).toBe('0px');

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
		// computed letter-spacing is the resolved length: -0.05em of the
		// object's 18px is -0.9px
		await expect.poll(() => cssOf(page, a, 'letterSpacing')).toBe('-0.9px');

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
		// computed letter-spacing is the resolved length: 0.15em of the
		// object's 18px is 2.7px
		await expect.poll(() => cssOf(page, a, 'letterSpacing')).toBe('2.7px');
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
		// the panel opens on these rather than on the scrub: most objects
		// are set in one of four sizes, and the exact number is the fold's
		const a = hg.addObject('100000000001',
			{ ...ATTRS, 'text-font-size': '24px', 'text-line-height': '36px' }, 'A');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await open(page, a);

		// 24 is normal, so it is the one that is lit
		await expect(sizeBtn(page, 'n')).toHaveClass(/glue-font-size-on/);
		await expect(sizeBtn(page, 's')).not.toHaveClass(/glue-font-size-on/);
		await expect(sizeBtn(page, 'b')).not.toHaveClass(/glue-font-size-on/);
		await expect(sizeBtn(page, 'x')).not.toHaveClass(/glue-font-size-on/);

		// the two ends of the scale: 14 and 48, with big and normal between
		// them (2026-09-21, danja's call)
		for (const [which, px] of [['s', 14], ['x', 48]]) {
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

		// the scrub in the fold is the same number seen the other way round
		await openFold(page);
		await expect(fold(page).locator('.glue-popover-field').first()).toHaveValue('48');
	});

// The roller (2026-09-21, SOW-font-roller-picker): the suite's first wheel
// usage. The drum spins natively on wheel; the snap lands a row centred and
// the settle applies it. These helpers wheel until a row is centred and the
// settle has landed on it.
const reel = (page) => page.locator('.glue-font-face-list');
const onValue = (page) => page.locator('.glue-font-face-on').getAttribute('data-value');
async function openReel(page) {
	// the wheel is ALWAYS present in the panel (2026-09-21, danja's call) -
	// nothing opens it; this is just the visibility contract the tests hang
	// off
	await expect(reel(page)).toBeVisible();
}
test('the roller lists the faces compactly, opens centred, and applies on click',
	async ({ page, hg }) => {
	const a = hg.addObject('100000000001', ATTRS, 'A');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await open(page, a);
	await openReel(page);
	// compact - a 60px window, not the 40vh dropdown it replaced
	const h = (await reel(page).boundingBox()).height;
	expect(h, 'the roller is not compact').toBeLessThanOrEqual(64);
	const opts = reel(page).locator('.glue-font-face-opt');
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
	// it opens centred on the current face: the on-row's centre is the
	// reel's centre (within the rounding the panel's fractional position
	// forces)
	await expect.poll(() => reel(page).evaluate((list) => {
		const on = list.querySelector('.glue-font-face-on');
		const lc = list.getBoundingClientRect();
		const rc = on.getBoundingClientRect();
		return Math.abs((rc.top + rc.height/2) - (lc.top + list.clientHeight/2));
	})).toBeLessThan(3);
	// the up-down affordance, drawn on the wheel's right end like the
	// number rows' sideways one, pinned to the ROW so the rows scroll
	// under it - and the vertical cursor to match
	await expect(page.locator('.glue-font-face-arrow')).toHaveText('\u2195');
	expect(await reel(page).evaluate((l) => getComputedStyle(l).cursor))
		.toBe('ns-resize');
	// no headings and no default row: every row is a face (2026-09-21,
	// danja's call)
	expect(await reel(page).evaluate((l) =>
		l.querySelectorAll('.glue-font-face-opt').length)).toBe(values.length);
	expect(await reel(page).evaluate((l) =>
		l.querySelectorAll('.glue-font-face-group').length)).toBe(0);
	// the click applies the row and the wheel follows it into the centre
	// (2026-09-21, danja's call: no scrolling - the click is the whole
	// interaction, and nothing applies without one)
	const onIdx = values.indexOf(await onValue(page));
	await opts.nth(onIdx + 1).click();
	await expect.poll(() => onValue(page)).toBe(values[onIdx + 1]);
	await expect.poll(() => cssOf(page, a, 'fontFamily')).toBe(values[onIdx + 1]);
	await expect.poll(() => hg.readObject('100000000001').attrs['text-font-family'])
		.toBeTruthy();
	await expect.poll(() => reel(page).evaluate((list) => {
		const on = list.querySelector('.glue-font-face-on');
		const lc = list.getBoundingClientRect();
		const rc = on.getBoundingClientRect();
		return Math.abs((rc.top + rc.height/2) - (lc.top + list.clientHeight/2));
	})).toBeLessThan(3);
	// the wheel scrolls the drum at HALF pace (2026-09-21, danja's call) -
	// 400px of wheel is 200px of drum - and applies nothing
	const wheelBefore = await reel(page).evaluate((l) => l.scrollTop);
	const box = await reel(page).boundingBox();
	await page.mouse.move(box.x + box.width/2, box.y + box.height/2);
	await page.mouse.wheel(0, 400);
	await page.waitForTimeout(120);
	const moved = (await reel(page).evaluate((l) => l.scrollTop)) - wheelBefore;
	expect(moved, 'the wheel did not scroll the drum').toBeGreaterThan(0);
	expect(moved, 'the wheel was not slowed by 200%').toBeLessThanOrEqual(200);
	await expect.poll(() => onValue(page)).toBe(values[onIdx + 1]);
});

test('a drag moves the drum without applying - only the click applies',
	async ({ page, hg }) => {
	const a = hg.addObject('100000000001', ATTRS, 'A');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await open(page, a);
	await openReel(page);
	const opts = reel(page).locator('.glue-font-face-opt');
	const values = await opts.evaluateAll((os) => os.map((o) => o.dataset.value));
	const onIdx = values.indexOf(await onValue(page));
	const before = await reel(page).evaluate((l) => l.scrollTop);
	// drag down 40px: the drum follows the pointer
	const box = await reel(page).boundingBox();
	await page.mouse.move(box.x + box.width/2, box.y + box.height/2);
	await page.mouse.down();
	await page.mouse.move(box.x + box.width/2, box.y + box.height/2 + 40, { steps: 5 });
	await page.mouse.up();
	await page.waitForTimeout(200);		// the release snap settles
	// the drum follows the pointer: dragging down walks toward the
	// earlier rows, so the scrollTop goes down with the finger
	expect(await reel(page).evaluate((l) => l.scrollTop),
		'the drum did not move').toBeLessThan(before);
	// nothing applied - the on-row is unchanged, the object untouched
	await expect.poll(() => onValue(page)).toBe(values[onIdx]);
	expect(hg.readObject('100000000001').attrs['text-font-family']).toBe(undefined);
	// and the drum rests on a row, never between rows - the row is just
	// not the applied one (nothing applied)
	await expect.poll(() => reel(page).evaluate((l) => {
		const rows = l.querySelectorAll('.glue-font-face-opt');
		const lc = l.getBoundingClientRect();
		let min = Infinity;
		rows.forEach((r) => {
			const rc = r.getBoundingClientRect();
			min = Math.min(min, Math.abs((rc.top + rc.height/2) -
				(lc.top + l.clientHeight/2)));
		});
		return min;
	})).toBeLessThan(2);
});

test('the arrows scroll the drum while the pointer is over it, without applying',
	async ({ page, hg }) => {
	const a = hg.addObject('100000000001', ATTRS, 'A');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await open(page, a);
	await openReel(page);
	const opts = reel(page).locator('.glue-font-face-opt');
	const values = await opts.evaluateAll((os) => os.map((o) => o.dataset.value));
	const onIdx = values.indexOf(await onValue(page));
	const before = await reel(page).evaluate((l) => l.scrollTop);
	// hovering hands the wheel the keyboard - no click needed
	await reel(page).hover();
	await page.keyboard.press('ArrowDown');
	// one full row - the rows are uniform 26px, within the rounding the
	// panel's fractional position forces on the scroll positions
	await expect.poll(() => reel(page).evaluate((l) => l.scrollTop))
		.toBeGreaterThan(before + 24);
	await expect.poll(() => reel(page).evaluate((l) => l.scrollTop))
		.toBeLessThan(before + 28);
	// the scroll does not apply: the on-row and the object are untouched
	await expect.poll(() => onValue(page)).toBe(values[onIdx]);
	expect(hg.readObject('100000000001').attrs['text-font-family']).toBe(undefined);
	// ArrowUp walks back
	await page.keyboard.press('ArrowUp');
	await expect.poll(() => reel(page).evaluate((l) => l.scrollTop))
		.toBeGreaterThan(before - 2);
	await expect.poll(() => reel(page).evaluate((l) => l.scrollTop))
		.toBeLessThan(before + 2);
});

test('the page holds still while a popout is open', async ({ page, hg }) => {
	// any popout locks the page's scroll - a wheel or a finger meant for
	// the panel must not scroll the page under it (danja's call,
	// 2026-09-21)
	const a = hg.addObject('100000000001', ATTRS, 'A');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	expect(await page.evaluate(() => getComputedStyle(document.body).overflow))
		.toBe('visible');
	await open(page, a);
	expect(await page.evaluate(() => getComputedStyle(document.body).overflow))
		.toBe('hidden');
	await page.keyboard.press('Escape');
	await expect(pop(page)).toBeHidden();
	expect(await page.evaluate(() => getComputedStyle(document.body).overflow))
		.toBe('visible');
});

test('the open roller never covers the styled object', async ({ page, hg }) => {
	// the codex this roller exists for: a compact control that does not
	// eclipse the element it was called for
	const a = hg.addObject('100000000001', ATTRS, 'A');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await open(page, a);
	await openReel(page);
	const o = await byId(page, a).boundingBox();
	const r = await reel(page).boundingBox();
	const overlaps = r.x < o.x + o.width && o.x < r.x + r.width &&
		r.y < o.y + o.height && o.y < r.y + r.height;
	expect(overlaps, 'the roller is sitting on top of the styled object').toBe(false);
});

test('an object-wide size takes the run sizes off', async ({ page, hg }) => {
	// a run's own size span would beat the object's size for its text -
	// the object-wide size is what the whole object wears, so the spans'
	// sizes come off, and the change is persisted in the content
	const a = hg.addObject('100000000001', ATTRS,
		'hello <span style="font-size: 16px;">world</span>');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await open(page, a);
	await sizeBtn(page, 'x').click();
	await expect.poll(() => cssOf(page, a, 'fontSize')).toBe('48px');
	await expect.poll(() => hg.readObject('100000000001').content)
		.toBe('hello world');
	await expect.poll(() => hg.readObject('100000000001').attrs['text-font-size'])
		.toBe('48px');
	// the size span is gone from the page too
	expect(await page.evaluate((i) =>
		document.querySelector(`[id="${i}"] .glue-text-render span`), a)).toBeNull();
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

test('a fade with no shadow seeds the radius, like the colour does',
	async ({ page, hg }) => {
	const a = hg.addObject('100000000001', ATTRS, 'A');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await open(page, a);
	await openFold(page);
	const fade = fold(page).locator('.glue-popover-scrub')
		.filter({ has: page.locator('.glue-popover-label:text-is("fade")') })
		.locator('.glue-popover-field');
	await fade.fill('40');
	await fade.dispatchEvent('input');
	await fade.dispatchEvent('change');
	await expect.poll(() => hg.readObject('100000000001').attrs['text-shadow-radius'])
		.toBe('6');
	await expect.poll(() => hg.readObject('100000000001').attrs['text-shadow-alpha'])
		.toBe('40');
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

test('the padding button drags all four sides at once, and back',
	async ({ page, hg }) => {
		const id = hg.addObject('100000000001', ATTRS, 'padded');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await open(page, id);

		const btn = page.locator('.glue-font-padding');
		const b = await btn.boundingBox();
		const cx = b.x + b.width / 2;
		const cy = b.y + b.height / 2;

		// drag right 40px: the padding follows the distance, all four sides
		await page.mouse.move(cx, cy);
		await page.mouse.down();
		await page.mouse.move(cx + 40, cy, { steps: 4 });
		await page.mouse.up();

		const pads = await page.evaluate((i) => {
			const el = document.getElementById(i);
			const c = getComputedStyle(el);
			return [c.paddingTop, c.paddingRight, c.paddingBottom, c.paddingLeft, el.offsetWidth].join(',');
		}, id);
		expect(pads).toBe('40px,40px,40px,40px,220');	// the frame compensation keeps the outer size
		await expect.poll(() => hg.readObject('100000000001').attrs['text-padding-x']).toBe('40px');
		await expect.poll(() => hg.readObject('100000000001').attrs['text-padding-y']).toBe('40px');

		// a vertical drag works the same way: the dominant axis is the
		// slider, so up or down adjusts exactly like left or right
		await page.mouse.move(cx, cy);
		await page.mouse.down();
		await page.mouse.move(cx, cy - 30, { steps: 4 });
		await page.mouse.up();
		await expect.poll(() => hg.readObject('100000000001').attrs['text-padding-x']).toBe('30px');
		await page.mouse.move(cx, cy - 30);
		await page.mouse.down();
		await page.mouse.move(cx, cy, { steps: 4 });
		await page.mouse.up();

		// and back to nothing
		await page.mouse.move(cx, cy);
		await page.mouse.down();
		await page.mouse.move(cx, cy, { steps: 4 });
		await page.mouse.up();
		await expect.poll(() => hg.readObject('100000000001').attrs['text-padding-x']).toBeUndefined();
		await expect.poll(() => hg.readObject('100000000001').attrs['text-padding-y']).toBeUndefined();
	});
