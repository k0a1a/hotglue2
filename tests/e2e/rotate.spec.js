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

// swing the rotation handle 'sweep' degrees clockwise around the object's
// centre, from wherever it currently sits. What Moveable reports is the angle
// swept since the press, so the test does not need to know which edge the
// handle hangs off - only how far it moved.
async function dragHandle(page, id, sweep, opts = {}) {
	const obj = await byId(page, id).boundingBox();
	const handle = await page.locator('.moveable-rotation-control').first().boundingBox();
	const cx = obj.x + obj.width/2, cy = obj.y + obj.height/2;
	const hx = handle.x + handle.width/2, hy = handle.y + handle.height/2;
	const r = Math.hypot(hx - cx, hy - cy);
	const from = Math.atan2(hy - cy, hx - cx);
	const to = from + sweep*Math.PI/180;
	await page.mouse.move(hx, hy);
	await page.mouse.down();
	if (opts.shift) await page.keyboard.down('Shift');
	await page.mouse.move(cx + r*Math.cos(to), cy + r*Math.sin(to), { steps: 20 });
	await page.mouse.up();
	if (opts.shift) await page.keyboard.up('Shift');
}

test('the handle rotates the object and stores the angle', async ({ page, hg }) => {
	const a = hg.addObject('100000000001', ATTRS, 'A');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await select(page, a);

	await dragHandle(page, a, 90);
	expect(await degOf(page, a)).toBe(90);
	await expect.poll(() => hg.readObject('100000000001').attrs['transform-flip'])
		.toBe('rotate(90deg)');
});

test('rotation snaps to 15 degree steps by default', async ({ page, hg }) => {
	const a = hg.addObject('100000000001', ATTRS, 'A');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await select(page, a);

	// a deliberately untidy angle: an object meant to be straight should not
	// end up at 7° because the pointer was a few pixels out
	await dragHandle(page, a, 40);
	const deg = await degOf(page, a);
	expect(deg % 15, `${deg}° is not a multiple of 15`).toBe(0);
	expect(deg).toBeGreaterThan(0);
});

test('holding shift releases it to any angle', async ({ page, hg }) => {
	const a = hg.addObject('100000000001', ATTRS, 'A');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await select(page, a);

	await dragHandle(page, a, 40, { shift: true });
	const deg = await degOf(page, a);
	// close to the 40 asked for, and therefore NOT snapped to 30 or 45
	expect(Math.abs(deg - 40), `shift-drag gave ${deg}°`).toBeLessThanOrEqual(4);
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

	// out of the RIGHT edge, not above the object: the top row of menu
	// buttons is up there and the handle used to land in among them
	const obj = await byId(page, a).boundingBox();
	const handle = await page.locator('.moveable-rotation-control').first().boundingBox();
	expect(handle.x, 'the handle should hang off the right edge')
		.toBeGreaterThan(obj.x + obj.width);
	const hy = handle.y + handle.height/2;
	expect(hy).toBeGreaterThan(obj.y);
	expect(hy).toBeLessThan(obj.y + obj.height);

	await page.mouse.click(50, 50);
	await expect(page.locator('.moveable-rotation-control')).toHaveCount(0);
});

test('the handles stay outside the object when it is turned', async ({ page, hg }) => {
	// The offsets that put the handles outside the object are applied as
	// margins, which shift a control in SCREEN space - while the object's
	// edges turn with it. So "push the east handle right", which clears the
	// right edge at 0°, pushed it straight into the object at 180°, where
	// that edge is on the left. It survived a deselect/reselect too, because
	// nothing about re-rendering the controls knew the angle.
	const a = hg.addObject('100000000001',
		{ ...ATTRS, 'transform-flip': 'rotate(180deg)' }, 'A');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await select(page, a);

	const check = async (when) => {
		const obj = await byId(page, a).boundingBox();
		const handles = await page.evaluate(() =>
			[...document.querySelectorAll('.moveable-control.moveable-direction')].map((e) => {
				const b = e.getBoundingClientRect();
				return { dir: (e.className.match(/moveable-(nw|ne|sw|se|n|e|s|w)(?:\s|$)/) || [])[1],
					cx: b.x + b.width/2, cy: b.y + b.height/2 };
			}));
		expect(handles.length, when).toBe(3);
		for (const h of handles) {
			// turned 180°, east is screen-west and south is screen-north
			if (h.dir.includes('e')) {
				expect(h.cx, `${when}: the ${h.dir} handle is inside the object`)
					.toBeLessThan(obj.x);
			}
			if (h.dir.includes('s')) {
				expect(h.cy, `${when}: the ${h.dir} handle is inside the object`)
					.toBeLessThan(obj.y);
			}
		}
	};
	await check('on select');

	// and again after letting go of it and picking it up
	await page.mouse.click(50, 50);
	await expect(page.locator('.moveable-control.moveable-direction')).toHaveCount(0);
	await select(page, a);
	await check('after reselect');
});

test('the handles stay outside at an angle that is not a right one',
	async ({ page, hg }) => {
		// 180° is the case that shows the bug most plainly, but the rule is
		// general: measure in the OBJECT's own frame, where "outside" means
		// past its own half-width or half-height whatever it is turned to.
		const a = hg.addObject('100000000001',
			{ ...ATTRS, 'transform-flip': 'rotate(45deg)' }, 'A');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await select(page, a);

		const out = await page.evaluate((i) => {
			const obj = document.getElementById(i);
			const b = obj.getBoundingClientRect();
			// rotation is about the centre, so the axis-aligned box the
			// browser reports still has the object's centre in the middle
			const cx = b.x + b.width/2, cy = b.y + b.height/2;
			const hw = obj.offsetWidth/2, hh = obj.offsetHeight/2;
			const rad = -45*Math.PI/180;		// back into the object's frame
			return [...document.querySelectorAll('.moveable-control.moveable-direction')]
				.map((e) => {
					const r = e.getBoundingClientRect();
					const dx = r.x + r.width/2 - cx, dy = r.y + r.height/2 - cy;
					return {
						dir: (e.className.match(/moveable-(nw|ne|sw|se|n|e|s|w)(?:\s|$)/) || [])[1],
						lx: dx*Math.cos(rad) - dy*Math.sin(rad),
						ly: dx*Math.sin(rad) + dy*Math.cos(rad),
						hw, hh,
					};
				});
		}, a);

		expect(out.length).toBe(3);
		for (const h of out) {
			if (h.dir.includes('e')) {
				expect(h.lx, `the ${h.dir} handle is not past the right edge`)
					.toBeGreaterThan(h.hw + 3);
			}
			if (h.dir.includes('s')) {
				expect(h.ly, `the ${h.dir} handle is not past the bottom edge`)
					.toBeGreaterThan(h.hh + 3);
			}
		}
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
