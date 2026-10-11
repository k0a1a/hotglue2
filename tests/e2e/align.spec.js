// Aligning several selected objects to the first-selected one (the anchor) -
// SOW-alignment-tool.md, with the anchor the FIRST (oldest) selected object -
// danja's call, 2026-10-09: pick what to line up with, then what to line up
// to it. The multi-select toolbar sits on it, it is drawn differently from
// the rest, and each button moves the OTHER objects so one edge or centre
// meets the anchor's. Positions are checked on the boxes as they are on
// screen.

const { test, expect, waitForEditor } = require('./fixtures/hotglue.js');

const box = (left, top, w, h, extra = {}) => ({
	type: 'text', module: 'text',
	'object-left': `${left}px`, 'object-top': `${top}px`,
	'object-width': `${w}px`, 'object-height': `${h}px`, 'object-zindex': '100',
	'text-background-color': '#ffff00', ...extra,
});

const byId = (page, id) => page.locator(`[id="${id}"]`);
const rect = (page, id) => byId(page, id).evaluate((el) => {
	const r = el.getBoundingClientRect();
	return { left: r.left, top: r.top, right: r.right, bottom: r.bottom,
		cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
});

// three objects of different sizes, in different places. A is the one the
// others line up to: it is selected FIRST.
async function setup(page, hg) {
	const a = hg.addObject('100000000001', box(300, 300, 200, 100), 'A');
	const b = hg.addObject('100000000002', box(100, 100, 100, 50), 'B');
	const c = hg.addObject('100000000003', box(600, 500, 150, 80), 'C');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 3);
	await byId(page, a).click();
	await byId(page, b).click({ modifiers: ['Shift'] });
	await byId(page, c).click({ modifiers: ['Shift'] });
	return { a, b, c };
}

const btn = (page, name) => page.locator(`#glue-multisel-${name}`);

test('the first-selected object is the anchor, and is drawn differently',
	async ({ page, hg }) => {
		const { a, b, c } = await setup(page, hg);
		await expect(byId(page, a)).toHaveClass(/glue-anchor/);
		await expect(byId(page, b)).not.toHaveClass(/glue-anchor/);
		await expect(byId(page, c)).not.toHaveClass(/glue-anchor/);
		const outline = (id) => byId(page, id).evaluate((el) => getComputedStyle(el).outlineStyle);
		expect(await outline(a)).toBe('solid');
		expect(await outline(b)).toBe('dashed');

		// let go of the anchor: the next-selected one takes over
		await byId(page, a).click({ modifiers: ['Shift'] });
		await expect(byId(page, b)).toHaveClass(/glue-anchor/);
		await expect(byId(page, a)).not.toHaveClass(/glue-anchor/);

		// and a lone selection has no anchor mark and no toolbar
		await byId(page, b).click({ modifiers: ['Shift'] });
		await expect(page.locator('.glue-anchor')).toHaveCount(0);
		await expect(page.locator('.glue-multisel')).toBeHidden();
	});

test('the toolbar sits on the anchor, and only while there are two or more',
	async ({ page, hg }) => {
		const { a, b } = await setup(page, hg);
		const bar = page.locator('.glue-multisel');
		await expect(bar).toBeVisible();
		const ar = await rect(page, a);
		const br = await bar.boundingBox();
		// above the anchor, from its left edge, and clear of it by the 20px
		// the object menus keep
		expect(Math.abs(br.x - ar.left)).toBeLessThan(2);
		expect(Math.abs(ar.top - (br.y + br.height) - 20)).toBeLessThan(2);
		// with the object menus' 5px between buttons
		const boxes = await bar.locator('.glue-btn-icon').evaluateAll((els) =>
			els.map((e) => e.getBoundingClientRect()));
		expect(Math.round(boxes[1].left - boxes[0].right)).toBe(5);
		// each button 30x30, not $.glue.icon's 32
		for (const bb of boxes) {
			expect(Math.round(bb.width)).toBe(30);
			expect(Math.round(bb.height)).toBe(30);
		}
		// six buttons, the edges first and the centres after the gap
		await expect(bar.locator('.glue-btn-icon')).toHaveCount(6);
		await expect(bar.locator('.glue-btn-icon').first()).toHaveAttribute('id', 'glue-multisel-left');

		// one object selected: gone
		await page.mouse.click(5, 5);
		await byId(page, b).click();
		await expect(bar).toBeHidden();
	});

const MODES = {
	center: ['x', 'cx'], left: ['x', 'left'], right: ['x', 'right'],
	middle: ['y', 'cy'], top: ['y', 'top'], bottom: ['y', 'bottom'],
};
for (const [mode, [axis, key]] of Object.entries(MODES)) {
	test(`${mode} lines the others up with the anchor and leaves it alone`,
		async ({ page, hg }) => {
			const { a, b, c } = await setup(page, hg);
			const before = { a: await rect(page, a), b: await rect(page, b), c: await rect(page, c) };
			await btn(page, mode).click();

			const after = { a: await rect(page, a), b: await rect(page, b), c: await rect(page, c) };
			expect(after.a).toEqual(before.a);
			for (const id of ['b', 'c']) {
				expect(Math.abs(after[id][key] - after.a[key]), `${id} ${key}`).toBeLessThan(1.5);
				// the other axis is not touched
				const other = axis == 'x' ? 'top' : 'left';
				expect(after[id][other]).toBeCloseTo(before[id][other], 0);
			}

			// and it was saved: the stored coordinates are the new ones
			const stored = axis == 'x' ? 'object-left' : 'object-top';
			const num = (v) => parseFloat(v);
			await expect.poll(() => {
				const o = hg.readObject('100000000002').attrs;
				return Math.round(num(o[stored]));
			}, { timeout: 5000 }).toBe(Math.round(await byId(page, b)
				.evaluate((el, s) => parseFloat(el.style[s == 'object-left' ? 'left' : 'top']), stored)));
		});
}

test('a locked object stays where it is', async ({ page, hg }) => {
	const a = hg.addObject('100000000001', box(300, 300, 200, 100), 'A');
	const b = hg.addObject('100000000002', box(100, 100, 100, 50), 'B');
	const l = hg.addObject('100000000003', box(600, 500, 150, 80, { 'object-lock': 'locked' }), 'L');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 3);
	// a locked object cannot be shift-clicked in, so all three are put in
	// directly, A first
	await page.evaluate((ids) => ids.forEach((id) => $.glue.sel.select(document.getElementById(id))),
		[a, b, l]);
	const before = await rect(page, l);
	await btn(page, 'left').click();
	expect(Math.abs((await rect(page, b)).left - (await rect(page, a)).left)).toBeLessThan(1.5);
	expect(await rect(page, l)).toEqual(before);
});

test('one undo puts every moved object back', async ({ page, hg }) => {
	const { a, b, c } = await setup(page, hg);
	const before = { b: await rect(page, b), c: await rect(page, c) };
	await btn(page, 'center').click();
	expect(Math.abs((await rect(page, b)).cx - (await rect(page, a)).cx)).toBeLessThan(1.5);

	await page.evaluate(() => $.glue.undo.undo());
	await expect.poll(async () => (await rect(page, b)).left).toBeCloseTo(before.b.left, 0);
	await expect.poll(async () => (await rect(page, c)).left).toBeCloseTo(before.c.left, 0);
});

test('an anchor at the top edge puts the toolbar below it, on screen', async ({ page, hg }) => {
	const a = hg.addObject('100000000001', box(0, 0, 200, 100), 'A');
	const b = hg.addObject('100000000002', box(400, 300, 100, 50), 'B');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 2);
	await byId(page, a).click();
	await byId(page, b).click({ modifiers: ['Shift'] });
	const bar = await page.locator('.glue-multisel').boundingBox();
	const ar = await rect(page, a);
	expect(bar.y).toBeGreaterThanOrEqual(0);
	// below it, with the same 20px of clear space
	expect(Math.abs(bar.y - ar.bottom - 20)).toBeLessThan(2);
	const vp = page.viewportSize();
	expect(bar.x + bar.width).toBeLessThanOrEqual(vp.width);
});

test('the single-object menu has an align button that says what to do', async ({ page, hg }) => {
	const a = hg.addObject('100000000001', box(300, 300, 200, 100), 'A');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await byId(page, a).click();
	let message = '';
	page.once('dialog', (d) => { message = d.message(); d.dismiss(); });
	await page.locator('#glue-contextmenu-object-align').click();
	expect(message).toContain('Select two or more objects (Shift+click) to align to the first selected object');
});
