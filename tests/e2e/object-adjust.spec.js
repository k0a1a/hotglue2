// The 'object adjustment' popout: flip, z-level and transparency in one
// panel. These were three menu buttons with hidden gestures - the flip
// cycled through four states, and the z-level and the transparency were both
// drag-distance sliders - and the popout trades those for visible controls.
//
// The stored formats are the ones the modules always used (transform-flip
// holds the whole transform, object-zindex and object-opacity hold the
// literal style values), so the round-trips below assert against the flat
// files exactly the way the rotation spec does.

const { test, expect, waitForEditor } = require('./fixtures/hotglue.js');

const OBJ = {
	type: 'text', module: 'text',
	'object-left': '300px', 'object-top': '300px',
	'object-width': '160px', 'object-height': '80px', 'object-zindex': '100',
	'text-background-color': 'transparent',
};

const byId = (page, id) => page.locator(`[id="${id}"]`);
const adjust = (page) => page.getByTitle('object adjustments');
const popover = (page) => page.locator('.glue-popover.glue-adjust-popover');
const flipV = (page) => page.getByTitle('flip vertically');
const flipH = (page) => page.getByTitle('flip horizontally');
// the literal inline style, which is what the modules parse and store
const transformOf = (page, id) => page.evaluate((i) =>
	document.getElementById(i).style.getPropertyValue('transform'), id);
const zOf = (page, id) => page.evaluate((i) =>
	getComputedStyle(document.getElementById(i)).zIndex, id);
const opacityOf = (page, id) => page.evaluate((i) =>
	getComputedStyle(document.getElementById(i)).opacity, id);

async function selectAndOpen(page, id) {
	await byId(page, id).click();
	await expect(adjust(page)).toBeVisible();
	await adjust(page).click();
	await expect(popover(page)).toBeVisible();
}

test('the popout opens, and the three buttons it folds are gone',
	async ({ page, hg }) => {
		const a = hg.addObject('100000000001', OBJ, 'A');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await selectAndOpen(page, a);

		// the old hidden-gesture buttons are out of the menu
		expect(await page.getByTitle('flip object').count()).toBe(0);
		expect(await page.getByTitle(/change transparency/).count()).toBe(0);
		expect(await page.getByTitle('bring object to foreground or background').count()).toBe(0);

		// and the panel has the promised rows: two flip toggles, four
		// z-level buttons, an opacity slider and a reset
		await expect(flipV(page)).toBeVisible();
		await expect(flipH(page)).toBeVisible();
		for (const t of ['to top', 'level up', 'level down', 'to bottom']) {
			await expect(page.getByTitle(t)).toBeVisible();
		}
		await expect(popover(page).locator('.glue-popover-slider')).toBeVisible();
		await expect(popover(page).locator('.glue-popover-reset')).toBeVisible();
	});

test('the flip toggles are independent, tracked, and round-trip',
	async ({ page, hg }) => {
		const a = hg.addObject('100000000001', OBJ, 'A');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await selectAndOpen(page, a);

		const active = (loc) => loc.evaluate((el) =>
			el.classList.contains('glue-btn-active'));

		// nothing flipped, nothing active
		expect(await transformOf(page, a)).toBe('');
		expect(await active(flipV(page))).toBe(false);
		expect(await active(flipH(page))).toBe(false);

		// one axis at a time: h is the a entry of the matrix, v the d
		await flipV(page).click();
		expect(await transformOf(page, a)).toContain('matrix(1, 0, 0, -1, 0, 0)');
		expect(await active(flipV(page))).toBe(true);
		expect(await active(flipH(page))).toBe(false);

		await flipH(page).click();
		expect(await transformOf(page, a)).toContain('matrix(-1, 0, 0, -1, 0, 0)');
		expect(await active(flipH(page))).toBe(true);

		// stored whole, the same way the rotation is
		await expect.poll(() => hg.readObject('100000000001').attrs['transform-flip'])
			.toBe('matrix(-1, 0, 0, -1, 0, 0)');

		// reopening the panel restores the toggle state from the object. The
		// panel opens at the click point and covers the menu, so the way to
		// close it is Escape, not a second click on the opener.
		await page.keyboard.press('Escape');
		await expect(popover(page)).toHaveCount(0);
		await adjust(page).click();
		await expect(popover(page)).toBeVisible();
		expect(await active(flipV(page))).toBe(true);
		expect(await active(flipH(page))).toBe(true);

		// each toggle off again removes just its axis, then all of it
		await flipH(page).click();
		expect(await transformOf(page, a)).toContain('matrix(1, 0, 0, -1, 0, 0)');
		expect(await active(flipH(page))).toBe(false);
		await flipV(page).click();
		expect(await transformOf(page, a)).toBe('');
	});

test('to top/to bottom push to the ends; level up/down swap one step',
	async ({ page, hg }) => {
		// two overlapping objects (offset so both stay clickable at their
		// centres - the objects render 190x104, not the 160x80 they are given,
		// so the offset has to clear that), a gap in the levels so every move
		// lands on a value that could not come from the initial state. A is
		// the one below, so its to top/to bottom actually move it.
		const a = hg.addObject('100000000001', { ...OBJ, 'object-zindex': '100' }, 'A');
		const b = hg.addObject('100000000002', {
			...OBJ, 'object-left': '440px', 'object-top': '360px',
			'object-zindex': '103',
		}, 'B');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 2);
		await selectAndOpen(page, a);

		// to top: just above the topmost intersecting object
		await page.getByTitle('to top').click();
		expect(await zOf(page, a)).toBe('104');
		await expect.poll(() => hg.readObject('100000000001').attrs['object-zindex'])
			.toBe('104');

		// to bottom: just below the bottommost intersecting object
		await page.getByTitle('to bottom').click();
		expect(await zOf(page, a)).toBe('102');
		await expect.poll(() => hg.readObject('100000000001').attrs['object-zindex'])
			.toBe('102');

		// level up: swap with the nearest intersecting object above
		await page.getByTitle('level up').click();
		expect(await zOf(page, a)).toBe('103');
		expect(await zOf(page, b)).toBe('102');
		await expect.poll(() => hg.readObject('100000000001').attrs['object-zindex'])
			.toBe('103');
		await expect.poll(() => hg.readObject('100000000002').attrs['object-zindex'])
			.toBe('102');

		// level down: swap with the nearest intersecting object below
		await page.getByTitle('level down').click();
		expect(await zOf(page, a)).toBe('102');
		expect(await zOf(page, b)).toBe('103');
		await expect.poll(() => hg.readObject('100000000001').attrs['object-zindex'])
			.toBe('102');
		await expect.poll(() => hg.readObject('100000000002').attrs['object-zindex'])
			.toBe('103');

		// at the bottom there is nothing below to swap with
		await page.getByTitle('level down').click();
		expect(await zOf(page, a)).toBe('102');
		expect(await zOf(page, b)).toBe('103');
	});

test('an object without its own z swaps with the implicit 0',
	async ({ page, hg }) => {
		// The editor's registration stamps z-index 100 onto every object that
		// arrives without one (edit.js, "make sure everything has a z-index"),
		// so to get an object that really sits at the implicit 0 the style has
		// to be cleared after load. Level up then hands it the neighbour's
		// level, and the neighbour goes back to having no style at all - not
		// to a made-up number.
		const a = hg.addObject('100000000001', OBJ, 'A');
		const b = hg.addObject('100000000002', {
			...OBJ, 'object-left': '440px', 'object-top': '360px',
			'object-zindex': '107',
		}, 'B');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 2);
		await page.evaluate((i) => {
			document.getElementById(i).style.zIndex = '';
		}, a);
		await selectAndOpen(page, a);

		await page.getByTitle('level up').click();
		expect(await zOf(page, a)).toBe('107');
		await expect.poll(() => hg.readObject('100000000001').attrs['object-zindex'])
			.toBe('107');
		await expect.poll(() => hg.readObject('100000000002').attrs['object-zindex'])
			.toBe(undefined);
	});

test('transparency: the slider applies live, the field commits',
	async ({ page, hg }) => {
		const a = hg.addObject('100000000001', OBJ, 'A');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await selectAndOpen(page, a);

		const slider = popover(page).locator('.glue-popover-slider');
		const field = popover(page).locator('.glue-popover-field');

		// the row opens at the object's current opacity
		expect(await slider.inputValue()).toBe('100');
		expect(await field.inputValue()).toBe('100');

		// a slider move applies live (commit false)...
		await slider.evaluate((el) => {
			el.value = 30;
			el.dispatchEvent(new Event('input', { bubbles: true }));
		});
		expect(await opacityOf(page, a)).toBe('0.3');
		// ...and the change that ends the drag is what stores it
		await slider.evaluate((el) => {
			el.dispatchEvent(new Event('change', { bubbles: true }));
		});
		await expect.poll(() => hg.readObject('100000000001').attrs['object-opacity'])
			.toBe('0.3');

		// the field does the same for a typed value
		await field.fill('60');
		await field.press('Enter');
		expect(await opacityOf(page, a)).toBe('0.6');
		await expect.poll(() => hg.readObject('100000000001').attrs['object-opacity'])
			.toBe('0.6');
		expect(await field.inputValue()).toBe('60');
	});

test('reset clears flip, z and transparency in one save',
	async ({ page, hg }) => {
		const a = hg.addObject('100000000001', { ...OBJ, 'object-zindex': '100' }, 'A');
		const b = hg.addObject('100000000002', {
			...OBJ, 'object-left': '440px', 'object-top': '360px',
			'object-zindex': '103',
		}, 'B');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 2);
		await selectAndOpen(page, a);

		// work the object: flip both axes, push it above its neighbour, dim it
		await flipV(page).click();
		await flipH(page).click();
		await page.getByTitle('to top').click();
		await popover(page).locator('.glue-popover-field').fill('25');
		await popover(page).locator('.glue-popover-field').press('Enter');
		// the last writes have to land before the reset writes, or the saves
		// could come back in the wrong order
		await expect.poll(() => hg.readObject('100000000001').attrs['object-opacity'])
			.toBe('0.25');
		await expect.poll(() => hg.readObject('100000000001').attrs['object-zindex'])
			.toBe('104');

		// the panel's reset restores every default at once
		await popover(page).locator('.glue-popover-reset').click();
		await expect.poll(() => hg.readObject('100000000001').attrs['object-zindex'])
			.toBe(undefined);
		await expect.poll(() => hg.readObject('100000000001').attrs['object-opacity'])
			.toBe(undefined);
		await expect.poll(() => hg.readObject('100000000001').attrs['transform-flip'])
			.toBe(undefined);
		expect(await transformOf(page, a)).toBe('');
		expect(await zOf(page, a)).toBe('auto');
		expect(await opacityOf(page, a)).toBe('1');
		expect(await popover(page).locator('.glue-popover-field').inputValue()).toBe('100');
		expect(await flipV(page).evaluate((el) =>
			el.classList.contains('glue-btn-active'))).toBe(false);
		expect(await flipH(page).evaluate((el) =>
			el.classList.contains('glue-btn-active'))).toBe(false);
	});
