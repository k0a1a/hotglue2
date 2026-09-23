// The 'object adjustments' popout: where the object sits in the stack, and
// nothing else.
//
// It was three things - flip, z-level and transparency - until 2026-09-16, when
// danja moved the other two to the object properties panel and left this one
// the relation between an object and its neighbours. The flip and transparency
// tests that used to be in this file are in object-background.spec.js now, with
// the panel they moved to.
//
// The panel itself replaces a menu button that hid a drag-distance slider (drag
// right, drag further right...), and the four buttons it offers are the four
// moves the object adjustment menu always had: to top, level up, level down, to
// bottom. The stored format is the one the module always used - object-zindex
// holds the literal style value - so the round-trips below assert against the
// flat files exactly the way the rotation spec does.

const { test, expect, waitForEditor } = require('./fixtures/hotglue.js');

const OBJ = {
	type: 'text', module: 'text',
	'object-left': '300px', 'object-top': '300px',
	'object-width': '160px', 'object-height': '80px', 'object-zindex': '100',
	'text-background-color': 'transparent',
};

const byId = (page, id) => page.locator(`[id="${id}"]`);
const adjust = (page) => page.getByTitle('object position controls: layer up/down and x/y position');
const popover = (page) => page.locator('.glue-popover.glue-adjust-popover');
const zOf = (page, id) => page.evaluate((i) =>
	getComputedStyle(document.getElementById(i)).zIndex, id);

async function selectAndOpen(page, id) {
	await byId(page, id).click();
	await expect(adjust(page)).toBeVisible();
	await adjust(page).click();
	await expect(popover(page)).toBeVisible();
}

test('the popout opens, and the old hidden-gesture buttons are gone',
	async ({ page, hg }) => {
		const a = hg.addObject('100000000001', OBJ, 'A');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await selectAndOpen(page, a);

		expect(await page.getByTitle('flip object').count()).toBe(0);
		expect(await page.getByTitle(/change transparency/).count()).toBe(0);
		expect(await page.getByTitle('bring object to foreground or background').count()).toBe(0);

		// and the panel has the promised rows: the four z buttons and a reset,
		// and nothing else - the flip toggles and the opacity slider are the
		// properties panel's now, so neither is in here
		for (const t of ['to top', 'level up', 'level down', 'to bottom']) {
			await expect(page.getByTitle(t)).toBeVisible();
		}
		await expect(popover(page).locator('.glue-popover-reset')).toBeVisible();
		await expect(popover(page).locator('.glue-popover-slider')).toHaveCount(0);
		expect(await page.getByTitle('flip vertically').count()).toBe(0);
	});

test('the x and y rows position the object precisely', async ({ page, hg }) => {
	const a = hg.addObject('100000000001', OBJ, 'A');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await selectAndOpen(page, a);

	// the rows are right in the panel, seeded from the stored position
	const fields = popover(page).locator('.glue-popover-field');
	await expect(fields.nth(0)).toHaveValue('300');
	await expect(fields.nth(1)).toHaveValue('300');

	// typed values move the object live and commit on change
	await fields.nth(0).fill('415');
	await fields.nth(0).press('Enter');
	await expect.poll(() => hg.readObject('100000000001').attrs['object-left']).toBe('415px');
	await expect(byId(page, a)).toHaveCSS('left', '415px');
	await fields.nth(1).fill('37');
	await fields.nth(1).press('Enter');
	await expect.poll(() => hg.readObject('100000000001').attrs['object-top']).toBe('37px');
	await expect(byId(page, a)).toHaveCSS('top', '37px');
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

test('reset clears the z index, and only the z index',
	async ({ page, hg }) => {
		// It used to clear the flip and the transparency too. Both are the
		// properties panel's now, and this panel's reset has to leave them
		// alone: an object that is flipped and dimmed and then has its layer
		// reset keeps being flipped and dimmed.
		const a = hg.addObject('100000000001', {
			...OBJ, 'object-zindex': '100',
			'transform-flip': 'matrix(-1, 0, 0, -1, 0, 0)',
			'object-opacity': '0.4',
		}, 'A');
		const b = hg.addObject('100000000002', {
			...OBJ, 'object-left': '440px', 'object-top': '360px',
			'object-zindex': '103',
		}, 'B');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 2);
		await selectAndOpen(page, a);

		await page.getByTitle('to top').click();
		await expect.poll(() => hg.readObject('100000000001').attrs['object-zindex'])
			.toBe('104');

		await popover(page).locator('.glue-popover-reset').click();
		await expect.poll(() => hg.readObject('100000000001').attrs['object-zindex'])
			.toBe(undefined);
		expect(await zOf(page, a)).toBe('auto');
		// untouched: the reset has no business with what this panel does not own
		await expect.poll(() => hg.readObject('100000000001').attrs['transform-flip'])
			.toBe('matrix(-1, 0, 0, -1, 0, 0)');
		await expect.poll(() => hg.readObject('100000000001').attrs['object-opacity'])
			.toBe('0.4');
	});
