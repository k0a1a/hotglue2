// Multi-select group drag - MODERNIZATION.md section 11, called out there as
// "the highest-value regression test given this was entirely custom code
// before". jQuery UI never did this; edit.js synchronises the non-dragged
// members of a selection by hand (js/edit.js:1030-1042), so there is no
// library behaviour underneath to fall back on if it breaks.
//
// The other thing under test here is subtler and lives in the same code path.
// Selecting an object SHIFTS it by half the selection border - select() does
// left -= border/2 (js/edit.js:1706), deselect() adds it back, and
// register_alter_pre_save('glue-selected') (js/edit.js:912) adds it back again
// on the way to disk. The border is 1px (css/edit.css:114), so every selection
// nudges an object by a pixel and three separate pieces of code have to agree
// about undoing it. If they ever stop agreeing, every object on every page
// creeps by a pixel each time somebody clicks it.

const { test, expect, waitForEditor } = require('./fixtures/hotglue.js');

const box = (left, top) => ({
	type: 'text', module: 'text',
	'object-left': `${left}px`, 'object-top': `${top}px`,
	'object-width': '150px', 'object-height': '100px', 'object-zindex': '100',
	'text-background-color': 'transparent',
});

const SEED = { a: [100, 100], b: [400, 100], c: [700, 100] };

async function seed(hg) {
	const ids = {};
	ids.a = hg.addObject('100000000001', box(...SEED.a), 'A');
	ids.b = hg.addObject('100000000002', box(...SEED.b), 'B');
	ids.c = hg.addObject('100000000003', box(...SEED.c), 'C');
	return ids;
}

// Live left/top of every object, keyed by DOM id.
const positions = (page) => page.evaluate(() => Object.fromEntries(
	Array.from(document.querySelectorAll('.object'))
		.map((el) => [el.id, [parseFloat(el.style.left), parseFloat(el.style.top)]])));

// Object ids are "<page>.<revision>.<id>" - the dots make them invalid inside a
// CSS #id selector, so address them by attribute rather than escaping.
const byId = (page, id) => page.locator(`[id="${id}"]`);

const selected = (page) => page.evaluate(() =>
	Array.from(document.querySelectorAll('.glue-selected')).map((el) => el.id).sort());

// Drag from a point by a delta. Moveable ignores the first 10px
// (js/edit.js:986), so the move is stepped to get well past that and to emit
// several drag events rather than one jump.
async function drag(page, from, dx, dy) {
	await page.mouse.move(from[0], from[1]);
	await page.mouse.down();
	for (let i = 1; i <= 6; i++) {
		await page.mouse.move(from[0] + (dx * i) / 6, from[1] + (dy * i) / 6);
	}
	await page.mouse.up();
}

test('dragging one of several selected objects moves them all by the same delta',
	async ({ page, hg }) => {
		const ids = await seed(hg);
		await page.goto(hg.editUrl());
		await waitForEditor(page, 3);

		// Selected the way a user does it. This only works since the
		// $.glue.live delegation fix - see text-selection.spec.js.
		await byId(page, ids.a).click();
		await byId(page, ids.b).click({ modifiers: ['Shift'] });
		expect(await selected(page)).toEqual([ids.a, ids.b].sort());

		const before = await positions(page);
		await drag(page, [175, 150], 120, 60);
		const after = await positions(page);

		const moved = (id) => [after[id][0] - before[id][0], after[id][1] - before[id][1]];
		expect(moved(ids.a), 'the dragged object did not follow the mouse').toEqual([120, 60]);
		expect(moved(ids.b), 'the other selected object did not track the dragged one')
			.toEqual(moved(ids.a));
		expect(moved(ids.c), 'an unselected object moved').toEqual([0, 0]);
	});

test('a group drag persists every selected object, border offset cancelled',
	async ({ page, hg }) => {
		const ids = await seed(hg);
		await page.goto(hg.editUrl());
		await waitForEditor(page, 3);

		await byId(page, ids.a).click();
		await byId(page, ids.b).click({ modifiers: ['Shift'] });
		await drag(page, [175, 150], 120, 60);

		// Both members save on glue-movestop (js/edit.js:1048), so wait for the
		// slower one rather than guessing at a delay.
		await expect.poll(() => hg.readObject('100000000002').attrs['object-left'])
			.toBe(`${SEED.b[0] + 120}px`);

		// Stored position must be the seeded one plus the drag delta exactly:
		// no pixel left over from the select/save border shuffle.
		expect(hg.readObject('100000000001').attrs['object-left']).toBe(`${SEED.a[0] + 120}px`);
		expect(hg.readObject('100000000001').attrs['object-top']).toBe(`${SEED.a[1] + 60}px`);
		expect(hg.readObject('100000000002').attrs['object-top']).toBe(`${SEED.b[1] + 60}px`);
		// and the object nobody touched is untouched on disk
		expect(hg.readObject('100000000003').attrs['object-left']).toBe(`${SEED.c[0]}px`);
		expect(hg.readObject('100000000003').attrs['object-top']).toBe(`${SEED.c[1]}px`);
	});

test('selecting and deselecting leaves an object exactly where it was',
	async ({ page, hg }) => {
		// The 1px creep guard. Three pieces of code have to agree about the
		// selection border offset; this is the cheapest way to notice if they
		// stop.
		const ids = await seed(hg);
		await page.goto(hg.editUrl());
		await waitForEditor(page, 3);

		const before = await positions(page);
		for (let i = 0; i < 3; i++) {
			await page.evaluate((id) => window.$.glue.sel.select(document.getElementById(id)), ids.a);
			await page.evaluate((id) => window.$.glue.sel.deselect(document.getElementById(id)), ids.a);
		}
		expect(await positions(page), 'an object crept during select/deselect cycles')
			.toEqual(before);
	});
