// Object rotation, which is Moveable's rotation handle and nothing else - a
// 90°-per-click button in the object menu was tried first and dropped once
// the handle existed.
//
// The value is a rotate(Ndeg) term inside the object's own inline transform,
// which module_transform.inc.php stores whole under the attribute name
// transform-flip (a misnomer that predates there being a rotation in it). A
// flip is a matrix() term in the SAME property, so each control has to edit
// its own term and leave the other alone. That is the thing most likely to
// break here, and it is invisible from either control on its own - each looks
// correct until the other one has been used.

const { test, expect, waitForEditor } = require('./fixtures/hotglue.js');

const ATTRS = {
	type: 'text', module: 'text',
	'object-left': '300px', 'object-top': '300px',
	'object-width': '160px', 'object-height': '80px', 'object-zindex': '100',
	'text-background-color': 'transparent',
};

const byId = (page, id) => page.locator(`[id="${id}"]`);
const flipBtn = (page) => page.getByTitle('flip object');
// the literal inline style, which is what the module parses - never the
// computed one, where a rotation and a flip are the same matrix()
const transformOf = (page, id) => page.evaluate((i) =>
	document.getElementById(i).style.getPropertyValue('transform'), id);
const degOf = async (page, id) =>
	parseInt(((await transformOf(page, id)).match(/rotate\((-?\d+)deg\)/) || [0, '0'])[1], 10);

async function select(page, id) {
	await byId(page, id).click();
	await expect(flipBtn(page)).toBeVisible();
	// the menu and the handles fade in
	await page.waitForTimeout(400);
}

// swing the rotation handle around the object's centre to 'angle' degrees
// clockwise from straight up, which is where the handle sits at rest
async function dragHandle(page, id, angle, opts = {}) {
	const obj = await byId(page, id).boundingBox();
	const handle = await page.locator('.moveable-rotation-control').first().boundingBox();
	const cx = obj.x + obj.width/2, cy = obj.y + obj.height/2;
	const r = cy - (handle.y + handle.height/2);
	const rad = angle*Math.PI/180;
	await page.mouse.move(handle.x + handle.width/2, handle.y + handle.height/2);
	await page.mouse.down();
	if (opts.shift) await page.keyboard.down('Shift');
	await page.mouse.move(cx + r*Math.sin(rad), cy - r*Math.cos(rad), { steps: 20 });
	await page.mouse.up();
	if (opts.shift) await page.keyboard.up('Shift');
}

test('the handle rotates the object and stores the angle', async ({ page, hg }) => {
	const a = hg.addObject('100000000001', ATTRS, 'A');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await select(page, a);

	await dragHandle(page, a, 90);
	const deg = await degOf(page, a);
	expect(Math.abs(deg - 90), `handle drag gave ${deg}°`).toBeLessThan(6);
	await expect.poll(() => hg.readObject('100000000001').attrs['transform-flip'])
		.toMatch(/rotate\(\d+deg\)/);
});

test('holding shift lands on 15 degree steps', async ({ page, hg }) => {
	const a = hg.addObject('100000000001', ATTRS, 'A');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await select(page, a);

	// a deliberately untidy angle
	await dragHandle(page, a, 40, { shift: true });
	const deg = await degOf(page, a);
	expect(deg % 15, `${deg}° is not a multiple of 15`).toBe(0);
	expect(deg).toBeGreaterThan(0);
});

test('the handle appears with the selection and goes with it', async ({ page, hg }) => {
	const a = hg.addObject('100000000001', ATTRS, 'A');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	expect(await page.locator('.moveable-rotation-control').count()).toBe(0);

	await select(page, a);
	await expect(page.locator('.moveable-rotation-control').first()).toBeVisible();
	// the connector is a .moveable-line, and edit.css hides that class
	// outright for the bounding box Moveable draws - the rotation one has to
	// survive that or the handle floats unattached
	await expect(page.locator('.moveable-rotation-line').first()).toBeVisible();

	await page.mouse.click(50, 50);
	await expect(page.locator('.moveable-rotation-control')).toHaveCount(0);
});

test('a locked object offers no rotation handle', async ({ page, hg }) => {
	// object-lock is what module_lock.inc.php turns into the .locked class
	const a = hg.addObject('100000000001', { ...ATTRS, 'object-lock': 'locked' }, 'A');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await byId(page, a).click();
	await page.waitForTimeout(400);
	expect(await page.locator('.moveable-rotation-control').count()).toBe(0);
});

test('flipping keeps the rotation, and rotating keeps the flip',
	async ({ page, hg }) => {
		// both live in one transform property; whichever control ran last used
		// to win the whole property
		const a = hg.addObject('100000000001',
			{ ...ATTRS, 'transform-flip': 'rotate(90deg)' }, 'A');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await select(page, a);

		await flipBtn(page).click();
		let t = await transformOf(page, a);
		expect(t, 'the flip dropped the rotation').toContain('rotate(90deg)');
		expect(t, 'the flip did not happen').toContain('matrix(-1, 0, 0, -1, 0, 0)');

		await dragHandle(page, a, 45);
		t = await transformOf(page, a);
		expect(t, 'the rotation dropped the flip').toContain('matrix(-1, 0, 0, -1, 0, 0)');
		expect(t).toMatch(/rotate\(\d+deg\)/);

		await expect.poll(() => hg.readObject('100000000001').attrs['transform-flip'])
			.toMatch(/matrix\(-1, 0, 0, -1, 0, 0\)/);
	});

test('a rotation of zero is stored as no transform at all', async ({ page, hg }) => {
	// an object turned full circle should end up looking exactly like one that
	// was never touched, rather than carrying rotate(0deg) forever. Driven
	// through the module's own setter: landing on an exact 0 by dragging is
	// not something a test can rely on, and the rule under test is the
	// storage one, not the gesture
	const a = hg.addObject('100000000001',
		{ ...ATTRS, 'transform-flip': 'rotate(270deg)' }, 'A');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await select(page, a);

	await page.evaluate((i) => {
		const obj = document.getElementById(i);
		transform_set_rotation(obj, 360);
		$.glue.object.save(obj);
	}, a);
	expect(await transformOf(page, a)).toBe('');
	await expect.poll(() => hg.readObject('100000000001').attrs['transform-flip'])
		.toBe(undefined);
});

test('the rotation renders on the published page', async ({ page, hg }) => {
	hg.addObject('100000000001', { ...ATTRS, 'transform-flip': 'rotate(45deg)' }, 'A');
	await page.goto(`/?${hg.pageName}`);
	const m = await page.evaluate(() =>
		getComputedStyle(document.querySelector('.object')).transform);
	// 45° as a matrix: cos45 = 0.7071...
	expect(m).toMatch(/^matrix\(0\.7071/);
});
