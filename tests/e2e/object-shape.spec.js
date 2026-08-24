// The edge panel: rounded corners and a soft fade, on any object.
//
// Both are one number in px, stored as an object-* attribute the same way
// object-opacity and object-overflow are, and both have to survive the save,
// the reload and the published page - a shape that only exists in the editor
// is worth nothing.
//
// The fade stores only its DISTANCE, as --glue-fade, plus a class; the
// gradient itself lives in css/main.css so there is one of it rather than one
// in the editor and one in the renderer. That is the thing most likely to rot
// here, so the tests check what is STORED as well as what is drawn.

const { test, expect, waitForEditor } = require('./fixtures/hotglue.js');

const ATTRS = {
	type: 'text', module: 'text',
	'object-left': '300px', 'object-top': '300px',
	'object-width': '240px', 'object-height': '140px', 'object-zindex': '100',
	'text-background-color': '#ff7755',
};

const byId = (page, id) => page.locator(`[id="${id}"]`);
const edgeBtn = (page) => page.getByTitle(/edges: rounded corners/);
const pop = (page) => page.locator('.glue-edge-popover');
const field = (page, n) => pop(page).locator('.glue-popover-field').nth(n);
const cssOf = (page, id, prop) => page.evaluate(([i, p]) =>
	getComputedStyle(document.getElementById(i))[p], [id, prop]);
const attrs = (hg) => hg.readObject('100000000001').attrs;

const ROUND = 0, FADE = 1, WIDTH = 2;

async function open(page, id) {
	const obj = byId(page, id);
	if (!(await obj.evaluate((e) => e.classList.contains('glue-selected')))) {
		await obj.click();
	}
	await expect(edgeBtn(page)).toBeVisible();
	await page.waitForTimeout(400);		// the menu fades in
	await edgeBtn(page).click();
	await expect(pop(page)).toBeVisible();
}

async function setRow(page, n, value) {
	const f = field(page, n);
	await f.fill(String(value));
	await f.dispatchEvent('input');
	await f.dispatchEvent('change');
}

test('one button opens a panel with both numbers and a reset', async ({ page, hg }) => {
	const a = hg.addObject('100000000001', ATTRS, 'A');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await open(page, a);

	// three on the panel itself; the fold has two more of its own
	await expect(pop(page).locator(':scope > .glue-popover-row .glue-popover-slider'))
		.toHaveCount(3);
	// and the reset is in the fold with them, not under the rows above it
	await expect(pop(page).locator(':scope > .glue-popover-row .glue-popover-reset'))
		.toHaveCount(0);
	await expect(pop(page).locator('.glue-popover-advanced .glue-popover-reset'))
		.toHaveCount(1);
	// the sliders reach "fully round" and no further: half the shorter side
	// of the object as it is actually drawn, padding and selection border
	// included, which is not the same as the width and height it stores
	const half = await byId(page, a).evaluate((e) =>
		Math.round(Math.min(e.offsetWidth, e.offsetHeight)/2));
	expect(await pop(page).locator('.glue-popover-slider').first()
		.getAttribute('max')).toBe(String(half));
});

test('it opens beside the object, not over it', async ({ page, hg }) => {
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

test('rounding applies, stores and reaches the published page', async ({ page, hg }) => {
	const a = hg.addObject('100000000001', ATTRS, 'A');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await open(page, a);

	await setRow(page, ROUND, 24);
	await expect.poll(() => cssOf(page, a, 'borderTopLeftRadius')).toBe('24px');
	await expect.poll(() => attrs(hg)['object-border-radius']).toBe('24px');

	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	expect(await cssOf(page, a, 'borderTopLeftRadius')).toBe('24px');

	await page.goto(`/?${hg.pageName}`);
	expect(await page.evaluate(() =>
		getComputedStyle(document.querySelector('.object')).borderTopLeftRadius)).toBe('24px');
});

test('the fade stores its distance, not its gradient', async ({ page, hg }) => {
	// a mask-image string in an object file would mean commas and quotes in
	// the format, and the same gradient written out in two places
	const a = hg.addObject('100000000001', ATTRS, 'A');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await open(page, a);

	await setRow(page, FADE, 30);
	await expect.poll(() => attrs(hg)['object-edge-fade']).toBe('30px');
	expect(JSON.stringify(attrs(hg)), 'the gradient itself got into the object file')
		.not.toContain('gradient');

	// and the class is what turns the rule on
	await expect(byId(page, a)).toHaveClass(/glue-edge-fade/);
	expect(await cssOf(page, a, 'maskImage')).toContain('linear-gradient');
});

test('the fade survives a reload and reaches the published page',
	async ({ page, hg }) => {
		const a = hg.addObject('100000000001',
			{ ...ATTRS, 'object-edge-fade': '30px' }, 'A');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await expect(byId(page, a)).toHaveClass(/glue-edge-fade/);
		expect(await cssOf(page, a, 'maskImage')).toContain('linear-gradient');

		await page.goto(`/?${hg.pageName}`);
		const published = await page.evaluate(() => {
			const el = document.querySelector('.object');
			return [el.className, getComputedStyle(el).maskImage,
				el.style.getPropertyValue('--glue-fade')];
		});
		expect(published[0]).toContain('glue-edge-fade');
		expect(published[1]).toContain('linear-gradient');
		expect(published[2].trim()).toBe('30px');
	});

test('the fade actually paints', async ({ page, hg }) => {
	// The strongest check available, and the one that does not depend on
	// guessing the cause: shoot the object, take the mask away, shoot again.
	// A mask that never applied, a custom property that did not arrive and a
	// rule that does not match all collapse into "these pixels are identical".
	const a = hg.addObject('100000000001',
		{ ...ATTRS, 'object-edge-fade': '40px' }, 'A');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);

	const box = await byId(page, a).boundingBox();
	const clip = { x: box.x, y: box.y, width: box.width, height: box.height };
	const faded = await page.screenshot({ clip });
	await byId(page, a).evaluate((e) => e.classList.remove('glue-edge-fade'));
	const hard = await page.screenshot({ clip });
	expect(faded.equals(hard),
		'the object looks the same with and without its fade').toBe(false);
});

test('a border applies, stores and reaches the published page', async ({ page, hg }) => {
	// Objects could not have a border at all until the editor's selection
	// stopped being one on the same element: an author border made the
	// selection invisible and moved the object by half of ITS width.
	const a = hg.addObject('100000000001', ATTRS, 'A');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await open(page, a);

	await setRow(page, WIDTH, 6);
	await expect.poll(() => cssOf(page, a, 'borderTopWidth')).toBe('6px');
	// the style is implied by there being a width, not stored as a third thing
	expect(await cssOf(page, a, 'borderTopStyle')).toBe('solid');
	await expect.poll(() => attrs(hg)['object-border-width']).toBe('6px');
	expect(attrs(hg)['object-border-style'],
		'border-style got stored as well').toBe(undefined);

	await page.goto(`/?${hg.pageName}`);
	const published = await page.evaluate(() => {
		const cs = getComputedStyle(document.querySelector('.object'));
		return [cs.borderTopWidth, cs.borderTopStyle];
	});
	expect(published).toEqual(['6px', 'solid']);
});

test('a border does not move the object when it is selected', async ({ page, hg }) => {
	// what the old border-as-selection did: 6px there and 6px back
	const a = hg.addObject('100000000001',
		{ ...ATTRS, 'object-border-width': '6px' }, 'A');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);

	const at = () => page.evaluate((i) => {
		const o = document.getElementById(i);
		return [o.style.left, o.style.top];
	}, a);
	const before = await at();
	await byId(page, a).click();
	await expect(byId(page, a)).toHaveClass(/glue-selected/);
	expect(await at(), 'selecting moved the object').toEqual(before);

	// and the selection is visible on it, which an inline border used to hide
	expect(await cssOf(page, a, 'outlineStyle')).toBe('dashed');
});

test('the style dropdown applies, and stores only what is not the default',
	async ({ page, hg }) => {
		const a = hg.addObject('100000000001',
			{ ...ATTRS, 'object-border-width': '4px' }, 'A');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await open(page, a);

		const select = pop(page).locator('.glue-border-style');
		expect(await select.evaluate((s) =>
			[...s.options].map((o) => o.value))).toEqual(
			['solid', 'dashed', 'double', 'groove', 'inset', 'outset', 'ridge']);

		await select.selectOption('double');
		await expect.poll(() => cssOf(page, a, 'borderTopStyle')).toBe('double');
		await expect.poll(() => attrs(hg)['object-border-style']).toBe('double');

		// solid is the default and goes back to being unstored, the way
		// absent means visible for overflow
		await select.selectOption('solid');
		await expect.poll(() => attrs(hg)['object-border-style']).toBe(undefined);
		expect(await cssOf(page, a, 'borderTopStyle')).toBe('solid');
	});

test('picking a style on an object with no border gives it one',
	async ({ page, hg }) => {
		// a style with no width to draw in is invisible, and a control that
		// appears to do nothing reads as broken
		const a = hg.addObject('100000000001', ATTRS, 'A');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await open(page, a);

		await pop(page).locator('.glue-border-style').selectOption('ridge');
		await expect.poll(() => cssOf(page, a, 'borderTopWidth')).toBe('1px');
		await expect(field(page, WIDTH)).toHaveValue('1');

		// and it round-trips: a style with no stored width would come back as
		// no border at all, since the renderer only draws a style when there
		// is a width to draw it in
		await expect.poll(() => attrs(hg)['object-border-width']).toBe('1px');
		await page.goto(`/?${hg.pageName}`);
		expect(await page.evaluate(() => {
			const cs = getComputedStyle(document.querySelector('.object'));
			return [cs.borderTopWidth, cs.borderTopStyle];
		})).toEqual(['1px', 'ridge']);
	});

test('the colour button recolours the border, and leaves the panel open',
	async ({ page, hg }) => {
		// the picker counts as part of the panel that opened it - otherwise
		// the panel closes the moment the picker is touched, which is the
		// first thing anyone does with it
		const a = hg.addObject('100000000001',
			{ ...ATTRS, 'object-border-width': '6px' }, 'A');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await open(page, a);

		await pop(page).locator('.glue-border-color').click();
		await expect(page.locator('.picker_wrapper')).toBeVisible();
		await expect(pop(page), 'the panel closed when the picker opened')
			.toHaveCount(1);

		const hex = page.locator('.picker_editor input');
		await hex.fill('#0000ff');
		await hex.press('Enter');
		await expect.poll(() => cssOf(page, a, 'borderTopColor')).toBe('rgb(0, 0, 255)');
		await expect.poll(() => attrs(hg)['object-border-color']).toBe('rgb(0, 0, 255)');
	});

test('the fade reaches all four edges, not just two', async ({ page, hg }) => {
	// Each gradient on its own fades one axis and leaves a band straight
	// through the middle untouched; they are INTERSECTED to fade all four.
	// With the default compositing they would union instead and the left and
	// right edges would stay hard - which looks close enough to right in a
	// screenshot of the whole object, and is exactly what this catches. It is
	// also the check that would notice a browser without mask-composite.
	const faded = hg.addObject('100000000001',
		{ ...ATTRS, 'object-edge-fade': '30px' }, 'A');
	hg.addObject('100000000002',
		{ ...ATTRS, 'object-top': '500px' }, 'A');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 2);

	// a strip down the middle of each object's LEFT edge, which is the part
	// only the horizontal gradient can fade
	const strip = async (id) => {
		const b = await byId(page, id).boundingBox();
		return page.screenshot({ clip: {
			x: b.x, y: b.y + b.height/2 - 4, width: 12, height: 8,
		} });
	};
	const withFade = await strip(faded);
	const without = await strip(`${hg.pageName}.100000000002`);
	expect(withFade.equals(without),
		'the left edge is as hard as an unfaded object - the two gradients are not being intersected')
		.toBe(false);
});

// --- advanced: the glow --------------------------------------------------
//
// A blob of colour behind the content. Deliberately a different mechanism
// from the fade: the fade is a mask and takes the text with it, while this is
// a background and leaves the text sharp - which is the whole point of it.

const advanced = (page) => pop(page).locator('.glue-popover-advanced');
// the fold's own fields, below the panel's three: 0 spread, 1 opacity,
// 2 distance, 3 angle, 4 blur, 5 drop spread
const advField = (page, n) => advanced(page).locator('.glue-popover-field').nth(n);

async function setAdvRow(page, n, value) {
	const f = advField(page, n);
	await f.fill(String(value));
	await f.dispatchEvent('input');
	await f.dispatchEvent('change');
}

test('the advanced section is folded away until it is asked for',
	async ({ page, hg }) => {
		const a = hg.addObject('100000000001', ATTRS, 'A');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await open(page, a);

		await expect(advanced(page)).toBeHidden();
		await pop(page).locator('.glue-popover-disclosure').click();
		await expect(advanced(page)).toBeVisible();
		// the glow (spread + strength) and the drop shadow's distance,
		// angle, blur and spread
		await expect(advanced(page).locator('.glue-popover-slider')).toHaveCount(6);
	});

test('the four face controls sit in a 2x2 grid, not four rows',
	async ({ page, hg }) => {
		const a = hg.addObject('100000000001', ATTRS, 'A');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await open(page, a);
		await pop(page).locator('.glue-popover-disclosure').click();

		// the glow, its inside toggle, the duotone and the drop shadow's
		// colour - two labels and a 26px button each, so they share rows
		await expect(advanced(page)
			.locator('.glue-popover-pair .glue-popover-label'))
			.toHaveText(['glow', 'glow inside', '2nd glow', 'shadow']);

		// the pair labels take the base label width, not a wider one of
		// their own: 63px is exactly as wide as the longest ("glow
		// inside") needs, so nothing wraps
		const widths = await advanced(page).evaluate(() =>
			[...document.querySelectorAll('.glue-popover-pair .glue-popover-label')]
				.map((l) => getComputedStyle(l).width));
		expect(widths).toEqual(['63px', '63px', '63px', '63px']);

		// the two rows line up as columns: each control's x matches the one
		// directly below it
		const xs = await advanced(page).evaluate(() => {
			const x = (sel) => Math.round(document
				.querySelector('.glue-popover-advanced ' + sel)
				.getBoundingClientRect().x);
			return [x('.glue-glow-color'), x('.glue-glow-color2'),
				x('.glue-glow-inner-toggle'), x('.glue-drop-color')];
		});
		expect(xs[0]).toBe(xs[1]);	// glow and 2nd glow share column 1
		expect(xs[2]).toBe(xs[3]);	// inside and drop shadow share column 2

		// and the whole fold fits its 42vh cage, so nothing hides below it
		const cage = await advanced(page).evaluate((el) => ({
			client: el.clientHeight,
			scroll: el.scrollHeight,
			max: parseFloat(getComputedStyle(el).maxHeight),
			inner: window.innerHeight,
		}));
		expect(cage.scroll).toBeLessThanOrEqual(cage.client);
		expect(cage.max).toBeCloseTo(cage.inner * 0.42, 1);
	});

test('the glow applies, stores its ingredients and reaches the published page',
	async ({ page, hg }) => {
		const a = hg.addObject('100000000001', ATTRS, 'A');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await open(page, a);
		await pop(page).locator('.glue-popover-disclosure').click();

		const spread = advanced(page).locator('.glue-popover-field').first();
		// the blur radius of the halo, in px
		await spread.fill('45.5');
		await spread.dispatchEvent('input');
		await spread.dispatchEvent('change');

		await expect(byId(page, a)).toHaveClass(/glue-glow/);
		expect(await cssOf(page, a, 'boxShadow')).toContain('45.5px');
		await expect.poll(() => attrs(hg)['object-glow-spread']).toBe('45.5');
		// the shadow itself is not what gets stored
		expect(JSON.stringify(attrs(hg))).not.toContain('shadow');

		await page.goto(`/?${hg.pageName}`);
		const published = await page.evaluate(() => {
			const el = document.querySelector('.object');
			return [el.className, getComputedStyle(el).boxShadow,
				getComputedStyle(el).maskImage];
		});
		expect(published[0]).toContain('glue-glow');
		expect(published[1]).toContain('45.5px');
		// a background, not a mask: the content stays sharp
		expect(published[2]).toBe('none');
	});

test('the glow paints, and a glow of zero takes itself off', async ({ page, hg }) => {
	const a = hg.addObject('100000000001', {
		...ATTRS, 'text-background-color': 'transparent',
		'object-glow-color': '#ff8c42', 'object-glow-spread': '45',
		'object-glow-alpha': '90',
	}, 'A');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);

	const box = await byId(page, a).boundingBox();
	// The halo is painted AROUND the box, never inside it: the zero-offset
	// blur of a box-shadow stays outside the border, so clipping the
	// element's own rectangle would show no difference at all (and removing
	// the class would be indistinguishable from keeping it). Clip a margin
	// around the box, where the halo actually lives.
	const margin = 60;
	const clip = {
		x: Math.max(0, box.x - margin), y: Math.max(0, box.y - margin),
		width: box.width + 2 * margin, height: box.height + 2 * margin,
	};
	const glowing = await page.screenshot({ clip });
	await byId(page, a).evaluate((e) => e.classList.remove('glue-glow'));
	const plain = await page.screenshot({ clip });
	expect(glowing.equals(plain), 'the glow is not painting anything').toBe(false);

	// and back to nothing at all, rather than a glow of zero
	await open(page, a);
	await pop(page).locator('.glue-popover-disclosure').click();
	const spread = advanced(page).locator('.glue-popover-field').first();
	await spread.fill('0');
	await spread.dispatchEvent('input');
	await spread.dispatchEvent('change');
	await expect(byId(page, a)).not.toHaveClass(/glue-glow/);
	await expect.poll(() => attrs(hg)['object-glow-spread']).toBe(undefined);
	await expect.poll(() => attrs(hg)['object-glow-color']).toBe(undefined);
});

test('zero removes the attributes rather than storing them', async ({ page, hg }) => {
	// an object dragged back to square should look exactly like one nobody
	// ever touched
	const a = hg.addObject('100000000001',
		{ ...ATTRS, 'object-border-radius': '24px', 'object-edge-fade': '30px',
			'object-border-width': '5px', 'object-glow-color': '#ff8c42',
			'object-glow-spread': '40', 'object-glow-inner': '1',
			'object-glow-color2': '#ff00ff',
			'object-drop-color': '#000000', 'object-drop-distance': '20',
			'object-drop-angle': '135deg', 'object-drop-blur': '16',
			'object-drop-spread': '4' }, 'A');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await open(page, a);

	// the reset lives in the fold now, with the knobs it also clears
	await pop(page).locator('.glue-popover-disclosure').click();
	await pop(page).locator('.glue-popover-reset').click();
	await expect.poll(() => attrs(hg)['object-border-radius']).toBe(undefined);
	await expect.poll(() => attrs(hg)['object-edge-fade']).toBe(undefined);
	await expect.poll(() => attrs(hg)['object-border-width']).toBe(undefined);
	await expect(byId(page, a)).not.toHaveClass(/glue-edge-fade/);
	// and the panel says what is true now
	await expect(field(page, ROUND)).toHaveValue('0');
	await expect(field(page, FADE)).toHaveValue('0');
	await expect(pop(page).locator('.glue-border-style')).toHaveValue('solid');
	await expect.poll(() => attrs(hg)['object-glow-spread']).toBe(undefined);
	// the glow's toggle and second colour, and the whole drop shadow
	await expect.poll(() => attrs(hg)['object-glow-inner']).toBe(undefined);
	await expect.poll(() => attrs(hg)['object-glow-color2']).toBe(undefined);
	await expect.poll(() => attrs(hg)['object-drop-color']).toBe(undefined);
	await expect.poll(() => attrs(hg)['object-drop-distance']).toBe(undefined);
	await expect.poll(() => attrs(hg)['object-drop-angle']).toBe(undefined);
	await expect.poll(() => attrs(hg)['object-drop-blur']).toBe(undefined);
	await expect.poll(() => attrs(hg)['object-drop-spread']).toBe(undefined);
	// and the new knobs are back at the defaults a shadow is born with
	await expect(advField(page, 2)).toHaveValue('12');
	await expect(advField(page, 3)).toHaveValue('135');
	await expect(advField(page, 4)).toHaveValue('16');
	await expect(advField(page, 5)).toHaveValue('0');
	await expect(advanced(page).locator('.glue-glow-inner-toggle'))
		.not.toHaveClass(/glue-font-toggle-on/);
});

test('the glow is a stack of layers, not a single blur', async ({ page, hg }) => {
	// one layer at the reach, one at twice it, one at four times it - a 1-2-4
	// stack, so a big glow fades to nothing instead of being one big circle
	// with a hard edge
	const a = hg.addObject('100000000001', {
		...ATTRS, 'object-glow-color': '#ff8c42', 'object-glow-spread': '45.5',
		'object-glow-alpha': '90',
	}, 'A');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);

	const shadow = await cssOf(page, a, 'boxShadow');
	expect(shadow).toContain('45.5px');
	expect(shadow).toContain('91px');
	expect(shadow).toContain('182px');
});

test('the inner glow is a toggle, and turning it on materialises the glow',
	async ({ page, hg }) => {
		const a = hg.addObject('100000000001', ATTRS, 'A');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await open(page, a);
		await pop(page).locator('.glue-popover-disclosure').click();

		// how many inset layers are actually carrying paint: colour-mix of
		// transparent serialises as colour(srgb 0 0 0 / 0) and plain
		// transparent as rgba(0, 0, 0, 0) - either of them possibly wrapped
		// across lines, so whitespace is normalised first - and a layer with
		// no alpha is not a layer at all
		// how many inset layers are actually carrying paint. The list cannot
		// be split on ', ' - the colours themselves contain ', ' - so it is
		// matched whole: an inset layer in a colour-mix colour with an alpha
		// between 0 and 1. Alpha 1 never occurs here, and a transparent layer
		// serialises as / 0) or as rgba(0, 0, 0, 0), neither of which matches.
		const lit = () => page.evaluate((i) => {
			const bs = getComputedStyle(document.getElementById(i)).boxShadow
				.replace(/\s+/g, ' ');
			return (bs.match(/color\(srgb[^)]*\/ 0\.\d+\) [^,]*inset/g) || [])
				.length;
		}, a);

		// a fresh object: no glow, and nothing inside it
		expect(await lit()).toBe(0);
		await advanced(page).locator('.glue-glow-inner-toggle').click();

		// an inner glow is a toggle that gives the glow its defaults, not a
		// button that appears to do nothing
		await expect.poll(() => attrs(hg)['object-glow-color']).toBe('#ff8844');
		await expect.poll(() => attrs(hg)['object-glow-spread']).toBe('40');
		await expect.poll(() => attrs(hg)['object-glow-inner']).toBe('1');
		// the three inset centre layers are lit now
		expect(await lit()).toBe(3);

		// and off again: the gate attribute goes, the glow itself stays
		await advanced(page).locator('.glue-glow-inner-toggle').click();
		await expect.poll(() => attrs(hg)['object-glow-inner']).toBe(undefined);
		expect(await lit()).toBe(0);
		await expect.poll(() => attrs(hg)['object-glow-spread']).toBe('40');
	});

test('a second colour makes the glow duotone, and transparent turns it off',
	async ({ page, hg }) => {
		const a = hg.addObject('100000000001', {
			...ATTRS, 'object-glow-color': '#ffffff', 'object-glow-spread': '50',
			'object-glow-alpha': '90', 'object-glow-inner': '1',
			'object-glow-color2': '#ff00ff',
		}, 'A');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);

		// the side layers: inset ±(spread*0.4) at blurs spread*1.6 and
		// spread*6, outside ∓(spread*0.2) with the same blurs - the marble
		// geometry, so a 50px reach means 20px/80px inside and 10px/300px
		// out. colour-mix serialises as color(srgb ...), which differs by
		// engine, so only the LENGTHS are asserted.
		const shadow = await cssOf(page, a, 'boxShadow');
		expect(shadow).toContain('20px 0px 80px');
		expect(shadow).toContain('-20px 0px 300px');
		expect(shadow).toContain('-10px 0px 80px');
		expect(shadow).toContain('10px 0px 300px');
		await expect.poll(() => attrs(hg)['object-glow-color2']).toBe('#ff00ff');

		// and back to one colour: the transparent pick removes it entirely
		await open(page, a);
		await pop(page).locator('.glue-popover-disclosure').click();
		await advanced(page).locator('.glue-glow-color2').click();
		const hex = page.locator('.picker_editor input');
		await hex.fill('#ff00ff00');
		await hex.press('Enter');
		await expect.poll(() => attrs(hg)['object-glow-color2']).toBe(undefined);
		// the first colour is still there, and so is the class
		await expect.poll(() => attrs(hg)['object-glow-color']).toBe('#ffffff');
		await expect(byId(page, a)).toHaveClass(/glue-glow/);
	});

test('the drop shadow casts at a distance and an angle, and stores both',
	async ({ page, hg }) => {
		const a = hg.addObject('100000000001', {
			...ATTRS, 'object-drop-color': '#000000', 'object-drop-distance': '20',
			'object-drop-angle': '90deg', 'object-drop-blur': '16',
			'object-drop-spread': '4',
		}, 'A');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);

		// 90 degrees casts straight down. The distance itself is exact in
		// both engines; on the sideways axis chromium resolves cos(90deg) to
		// a clean 0 while firefox carries a float sliver (-8.7e-7px), so the
		// distance is what is asserted, not the axis
		const shadow = await cssOf(page, a, 'boxShadow');
		expect(shadow).toContain('20px');
		expect(shadow).toContain('16px');
		expect(shadow).toContain('4px');
		// the ingredients, angle included, are what is stored
		await expect.poll(() => attrs(hg)['object-drop-angle']).toBe('90deg');

		// the angle round-trips through the save: 135deg is the display
		// default, so a stored 0deg would render the same as nothing and lie
		// on the reload
		await open(page, a);
		await pop(page).locator('.glue-popover-disclosure').click();
		await setAdvRow(page, 3, 135);
		await expect.poll(() => attrs(hg)['object-drop-angle']).toBe('135deg');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await expect.poll(() => attrs(hg)['object-drop-angle']).toBe('135deg');

		// and the whole shadow reaches the published page, at its 135 degrees
		await page.goto(`/?${hg.pageName}`);
		expect(await page.evaluate(() =>
			getComputedStyle(document.querySelector('.object')).boxShadow))
			.toContain('14.1421px');
	});

test('picking a drop colour materialises a shadow where there was none',
	async ({ page, hg }) => {
		const a = hg.addObject('100000000001', ATTRS, 'A');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await open(page, a);
		await pop(page).locator('.glue-popover-disclosure').click();

		await advanced(page).locator('.glue-drop-color').click();
		const hex = page.locator('.picker_editor input');
		await hex.fill('#000000');
		await hex.press('Enter');

		// a shadow is born at the defaults the knobs show, so what you see
		// is what gets stored
		await expect.poll(() => attrs(hg)['object-drop-distance']).toBe('12');
		await expect.poll(() => attrs(hg)['object-drop-angle']).toBe('135deg');
		await expect.poll(() => attrs(hg)['object-drop-blur']).toBe('16');
		await expect(byId(page, a)).toHaveClass(/glue-glow/);
		// and the picker's raw value is what lands in the custom property -
		// no browser normalisation happens on a --var, so what was typed is
		// what is stored
		await expect.poll(() => attrs(hg)['object-drop-color']).toBe('#000000');
	});

test('drop shadow knobs without a colour store nothing', async ({ page, hg }) => {
	// a shadow is born of a colour: until there is one, there is nothing to
	// cast, and dragging the knobs must not smuggle a shadow into the file
	const a = hg.addObject('100000000001', ATTRS, 'A');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await open(page, a);
	await pop(page).locator('.glue-popover-disclosure').click();

	await setAdvRow(page, 2, 30);
	await setAdvRow(page, 3, 45);
	expect(JSON.stringify(attrs(hg))).not.toContain('object-drop');
	await expect(byId(page, a)).not.toHaveClass(/glue-glow/);
});

test('glow and drop shadow compose into the one box-shadow',
	async ({ page, hg }) => {
		const a = hg.addObject('100000000001', {
			...ATTRS, 'object-glow-color': '#ff8c42', 'object-glow-spread': '45.5',
			'object-glow-alpha': '90',
			'object-drop-color': '#000000', 'object-drop-distance': '20',
			'object-drop-angle': '90deg', 'object-drop-blur': '16',
		}, 'A');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);

		// both effects in ONE list - if they were two declarations, the
		// second would have overwritten the first and only one signature
		// would appear. The drop's distance is asserted rather than its
		// 90-degree offset, which firefox resolves with a float sliver on
		// the sideways axis
		const shadow = await cssOf(page, a, 'boxShadow');
		expect(shadow).toContain('45.5px');
		expect(shadow).toContain('91px');
		expect(shadow).toContain('20px');
		expect(shadow).toContain('16px');
	});

test('clearing the drop colour takes the whole shadow off', async ({ page, hg }) => {
	const a = hg.addObject('100000000001', {
		...ATTRS, 'object-glow-color': '#ff8c42', 'object-glow-spread': '40',
		'object-drop-color': '#000000', 'object-drop-distance': '20',
		'object-drop-angle': '90deg', 'object-drop-blur': '16',
		'object-drop-spread': '4',
	}, 'A');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await open(page, a);
	await pop(page).locator('.glue-popover-disclosure').click();

	await advanced(page).locator('.glue-drop-color').click();
	const hex = page.locator('.picker_editor input');
	await hex.fill('#00000000');
	await hex.press('Enter');

	// every drop ingredient is gone at once, the glow survives, and so does
	// the class - the colour is the shadow's on-switch
	await expect.poll(() => attrs(hg)['object-drop-color']).toBe(undefined);
	await expect.poll(() => attrs(hg)['object-drop-distance']).toBe(undefined);
	await expect.poll(() => attrs(hg)['object-drop-angle']).toBe(undefined);
	await expect.poll(() => attrs(hg)['object-drop-blur']).toBe(undefined);
	await expect.poll(() => attrs(hg)['object-drop-spread']).toBe(undefined);
	await expect.poll(() => attrs(hg)['object-glow-spread']).toBe('40');
	await expect(byId(page, a)).toHaveClass(/glue-glow/);
});

test('the duotone glow and the drop shadow paint, unclipped, on the published page',
	async ({ page, hg }) => {
		// a marble with a cast shadow: inner glow, second colour and a drop,
		// the whole family at once. Nothing around an object clips its
		// box-shadow - SOW gotcha #1 - only the object's own clip toggle
		// can, and that is the author's choice.
		const a = hg.addObject('100000000001', {
			...ATTRS, 'text-background-color': 'transparent',
			'object-border-radius': '50%',
			'object-glow-color': '#ffffff', 'object-glow-spread': '40',
			'object-glow-alpha': '90', 'object-glow-inner': '1',
			'object-glow-color2': '#ff00ff',
			'object-drop-color': '#000000', 'object-drop-distance': '20',
			'object-drop-angle': '90deg', 'object-drop-blur': '16',
		}, 'A');
		await page.goto(`/?${hg.pageName}`);

		const box = await page.locator('.object').boundingBox();
		const margin = 60;
		const clip = {
			x: Math.max(0, box.x - margin), y: Math.max(0, box.y - margin),
			width: box.width + 2 * margin, height: box.height + 2 * margin,
		};
		const lit = await page.screenshot({ clip });
		await page.locator('.object').evaluate((e) => e.classList.remove('glue-glow'));
		const plain = await page.screenshot({ clip });
		expect(lit.equals(plain), 'the effects are not painting anything').toBe(false);
	});

test('media inside an object rounds with it', async ({ page, hg }) => {
	// border-radius does not clip children: a text object paints its own
	// background and rounds correctly, while an image would keep square
	// corners inside the rounded box. css/main.css makes media inherit it.
	const a = hg.addObject('100000000001',
		{ ...ATTRS, 'object-border-radius': '24px' }, 'A');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);

	const radius = await page.evaluate((i) => {
		const obj = document.getElementById(i);
		const img = document.createElement('img');
		img.src = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
		obj.appendChild(img);
		const v = getComputedStyle(img).borderTopLeftRadius;
		img.remove();
		return v;
	}, a);
	expect(radius, 'a direct media child does not follow the object').toBe('24px');
});
