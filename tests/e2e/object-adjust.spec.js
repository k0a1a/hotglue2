// The layer order in the object properties panel: a row of four icons under
// the panel's own, where the object sits in the stack.
//
// It was a popout of its own ('object position controls', with an x and y)
// until 2026-10-10, when danja folded it into the properties panel. The four
// buttons are the four moves the object menu always had: to front, forward,
// backward, to back. The stored format is the one the module always used -
// object-zindex holds the literal style value - so the round-trips below
// assert against the flat files exactly the way the rotation spec does.

const { test, expect, waitForEditor } = require('./fixtures/hotglue.js');

const OBJ = {
	type: 'text', module: 'text',
	'object-left': '300px', 'object-top': '300px',
	'object-width': '160px', 'object-height': '80px', 'object-zindex': '100',
	'text-background-color': 'transparent',
};

const byId = (page, id) => page.locator(`[id="${id}"]`);
const adjust = (page) => page.getByTitle(/object properties - background/);
const popover = (page) => page.locator('.glue-popover.glue-properties-popover');
const zOf = (page, id) => page.evaluate((i) =>
	getComputedStyle(document.getElementById(i)).zIndex, id);

async function selectAndOpen(page, id) {
	await byId(page, id).click();
	await expect(adjust(page)).toBeVisible();
	await adjust(page).click();
	await expect(popover(page)).toBeVisible();
}

test('the layer row sits under the icon row, as four 22px icons',
	async ({ page, hg }) => {
		const a = hg.addObject('100000000001', OBJ, 'A');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await selectAndOpen(page, a);

		// there is no popout of its own any more
		expect(await page.getByTitle(/object position controls/).count()).toBe(0);
		for (const t of ['bring to front', 'bring forward', 'send backward', 'send to back']) {
			await expect(page.getByTitle(t)).toBeVisible();
			const box = await page.getByTitle(t).boundingBox();
			expect(Math.round(box.width)).toBe(22);
			expect(Math.round(box.height)).toBe(22);
		}
		// under the panel's own icon row, and no x/y rows of this row's own
		const rows = popover(page).locator('.glue-popover-icons');
		await expect(rows).toHaveCount(2);
		const first = await rows.nth(0).boundingBox();
		const second = await rows.nth(1).boundingBox();
		expect(second.y).toBeGreaterThan(first.y + first.height - 1);
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
		await page.getByTitle('bring to front').click();
		expect(await zOf(page, a)).toBe('104');
		await expect.poll(() => hg.readObject('100000000001').attrs['object-zindex'])
			.toBe('104');

		// to bottom: just below the bottommost intersecting object
		await page.getByTitle('send to back').click();
		expect(await zOf(page, a)).toBe('102');
		await expect.poll(() => hg.readObject('100000000001').attrs['object-zindex'])
			.toBe('102');

		// level up: swap with the nearest intersecting object above
		await page.getByTitle('bring forward').click();
		expect(await zOf(page, a)).toBe('103');
		expect(await zOf(page, b)).toBe('102');
		await expect.poll(() => hg.readObject('100000000001').attrs['object-zindex'])
			.toBe('103');
		await expect.poll(() => hg.readObject('100000000002').attrs['object-zindex'])
			.toBe('102');

		// level down: swap with the nearest intersecting object below
		await page.getByTitle('send backward').click();
		expect(await zOf(page, a)).toBe('102');
		expect(await zOf(page, b)).toBe('103');
		await expect.poll(() => hg.readObject('100000000001').attrs['object-zindex'])
			.toBe('102');
		await expect.poll(() => hg.readObject('100000000002').attrs['object-zindex'])
			.toBe('103');

		// at the bottom there is nothing below to swap with
		await page.getByTitle('send backward').click();
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

		await page.getByTitle('bring forward').click();
		expect(await zOf(page, a)).toBe('107');
		await expect.poll(() => hg.readObject('100000000001').attrs['object-zindex'])
			.toBe('107');
		await expect.poll(() => hg.readObject('100000000002').attrs['object-zindex'])
			.toBe(undefined);
	});

