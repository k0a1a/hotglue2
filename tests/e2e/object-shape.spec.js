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

test('the advanced section is folded away until it is asked for',
	async ({ page, hg }) => {
		const a = hg.addObject('100000000001', ATTRS, 'A');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await open(page, a);

		await expect(advanced(page)).toBeHidden();
		await pop(page).locator('.glue-popover-disclosure').click();
		await expect(advanced(page)).toBeVisible();
		// the glow (spread + strength) and the two shadow bands' thicknesses
		await expect(advanced(page).locator('.glue-popover-slider')).toHaveCount(4);
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
			'object-glow-spread': '40' }, 'A');
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
});

// --- the shadow bands -------------------------------------------------------
//
// The glow's solid cousins: a band outside the box and one inside it, each a
// thickness and a colour. Same deal as the glow - ingredients stored, one
// composed rule in css/main.css - but now TWO members share the class, so a
// test here also guards the "one band does not invent another" logic.

test('a band inside and a band outside, and each goes when its zero lands',
	async ({ page, hg }) => {
		const a = hg.addObject('100000000001', {
			...ATTRS, 'object-shadow-in': '10', 'object-shadow-in-color': '#0044ff',
			'object-shadow-out': '8', 'object-shadow-out-color': '#00cc00',
		}, 'A');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);

		// both bands load, composed into the one box-shadow list
		await expect(byId(page, a)).toHaveClass(/glue-glow/);
		const shadow = await cssOf(page, a, 'boxShadow');
		expect(shadow).toContain('inset');
		expect(shadow).toContain('10px');
		expect(shadow).toContain('8px');
		// the ingredients, not the shadow, are what is stored
		await expect.poll(() => attrs(hg)['object-shadow-in']).toBe('10');
		await expect.poll(() => attrs(hg)['object-shadow-out']).toBe('8');

		// a zero on one band takes that band off, leaving the other alone
		await open(page, a);
		await pop(page).locator('.glue-popover-disclosure').click();
		const insetField = advanced(page).locator('.glue-popover-field').nth(2);
		const outerField = advanced(page).locator('.glue-popover-field').nth(3);
		await insetField.fill('0');
		await insetField.dispatchEvent('input');
		await insetField.dispatchEvent('change');
		await expect.poll(() => attrs(hg)['object-shadow-in']).toBe(undefined);
		await expect.poll(() => attrs(hg)['object-shadow-in-color']).toBe(undefined);
		await expect.poll(() => attrs(hg)['object-shadow-out']).toBe('8');
		await expect(byId(page, a)).toHaveClass(/glue-glow/);

		// and the last one off takes the class with it
		await outerField.fill('0');
		await outerField.dispatchEvent('input');
		await outerField.dispatchEvent('change');
		await expect.poll(() => attrs(hg)['object-shadow-out']).toBe(undefined);
		await expect(byId(page, a)).not.toHaveClass(/glue-glow/);
	});

test('one band does not invent another, on the page or in storage',
	async ({ page, hg }) => {
		// only an outer band: no glow attrs stored, and the composed rule
		// has to come out with exactly that one band visible - no halo
		// springing up at the rule's old default of a 40px black glow
		const a = hg.addObject('100000000001', {
			...ATTRS, 'object-shadow-out': '12', 'object-shadow-out-color': '#00ff00',
		}, 'A');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);

		await expect(byId(page, a)).toHaveClass(/glue-glow/);
		expect(JSON.stringify(attrs(hg))).not.toContain('glow');

		await page.goto(`/?${hg.pageName}`);
		const published = await page.evaluate(() => {
			const el = document.querySelector('.object');
			return [el.className, getComputedStyle(el).boxShadow];
		});
		expect(published[0]).toContain('glue-glow');
		expect(published[1]).toContain('12px');
		expect(published[1]).toContain('rgb(0, 255, 0)');
	});

test('the reset clears the bands with the rest of the panel', async ({ page, hg }) => {
	const a = hg.addObject('100000000001',
		{ ...ATTRS, 'object-shadow-in': '10', 'object-shadow-in-color': '#0044ff',
			'object-glow-color': '#ff8c42', 'object-glow-spread': '40' }, 'A');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await open(page, a);

	await pop(page).locator('.glue-popover-disclosure').click();
	await pop(page).locator('.glue-popover-reset').click();
	await expect.poll(() => attrs(hg)['object-shadow-in']).toBe(undefined);
	await expect.poll(() => attrs(hg)['object-shadow-in-color']).toBe(undefined);
	await expect.poll(() => attrs(hg)['object-glow-spread']).toBe(undefined);
	await expect(byId(page, a)).not.toHaveClass(/glue-glow/);
	// and the panel says what is true now
	await expect(advanced(page).locator('.glue-popover-field').nth(2)).toHaveValue('0');
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
