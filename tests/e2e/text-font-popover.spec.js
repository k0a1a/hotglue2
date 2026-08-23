// The font popover: face, size and style in one panel, in place of the three
// buttons that used to be here - one that cycled through faces a click at a
// time, one that had to be dragged to change the size, and one that cycled
// bold -> italic -> both -> normal.
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
const toggle = (page, which) => page.locator(`.glue-font-toggle-${which}`);
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

		await expect(page.locator('.glue-font-face')).toBeVisible();
		await expect(page.locator('.glue-popover-slider')).toBeVisible();
		await expect(page.locator('.glue-font-toggle')).toHaveCount(4);

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

	await expect(page.locator('.glue-popover-field')).toHaveValue('37');
	await expect(toggle(page, 'bold')).toHaveClass(/glue-font-toggle-on/);
	await expect(toggle(page, 'underline')).toHaveClass(/glue-font-toggle-on/);
	await expect(toggle(page, 'italic')).not.toHaveClass(/glue-font-toggle-on/);
	await expect(toggle(page, 'strike')).not.toHaveClass(/glue-font-toggle-on/);
});

test('the size field and slider stay in step, and the field is not capped',
	async ({ page, hg }) => {
		const a = hg.addObject('100000000001', ATTRS, 'A');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await open(page, a);

		const field = page.locator('.glue-popover-field');
		const slider = page.locator('.glue-popover-slider');

		await field.fill('42');
		await field.dispatchEvent('input');
		await expect(slider).toHaveValue('42');
		await expect.poll(() => cssOf(page, a, 'fontSize')).toBe('42px');

		// display type runs past the end of any sensible drag range: the
		// slider parks at its maximum and the field keeps the real number
		await field.fill('300');
		await field.dispatchEvent('input');
		await expect(slider).toHaveValue('100');
		await expect(field).toHaveValue('300');
		await expect.poll(() => cssOf(page, a, 'fontSize')).toBe('300px');
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

		const field = page.locator('.glue-popover-field');
		await field.fill('30');
		await field.dispatchEvent('input');
		await field.dispatchEvent('change');

		await expect.poll(() => hg.readObject('100000000001').attrs['text-font-size'])
			.toBe('30px');
		// the ratio was 2, so 30px of type gets 60px of line
		await expect.poll(() => hg.readObject('100000000001').attrs['text-line-height'])
			.toBe('60px');
	});

test('the face dropdown lists the faces and applies one', async ({ page, hg }) => {
	const a = hg.addObject('100000000001', ATTRS, 'A');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await open(page, a);

	const select = page.locator('.glue-font-face');
	const values = await select.evaluate((s) =>
		[...s.querySelectorAll('option')].map((o) => o.value));
	expect(values.length, 'no faces were offered at all').toBeGreaterThan(1);
	// each name is written in its own face - the point of the list
	expect(await select.evaluate((s) => {
		const o = s.querySelectorAll('option')[1];
		return o.style.fontFamily === o.value;
	}), 'the options are not set in the face they name').toBe(true);

	const pick = values[values.length - 1];
	await select.selectOption(pick);
	await expect.poll(() => cssOf(page, a, 'fontFamily')).toBe(pick);
	await expect.poll(() => hg.readObject('100000000001').attrs['text-font-family'])
		.toBeTruthy();
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

		await pop(page).locator('.glue-popover-color').click();
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
