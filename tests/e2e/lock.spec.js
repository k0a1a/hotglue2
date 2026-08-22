// Locked objects - MODERNIZATION.md section 11, scenario 8, against the risk
// in section 7: lock.js called jQuery UI's .draggable()/.resizable() API
// directly rather than through edit.js's wrappers, so it had to be ported in
// the same phase as the drag/resize engine. It now toggles Moveable's
// draggable/resizable through $.glue.object.moveable_of()
// (modules/lock/lock.js:24).
//
// The other half of locking lives in selectors: the module's own header says
// every handler that acts on a selection "must include .not('.locked')". That
// is a convention with no enforcement, so it is worth testing rather than
// assuming.

const { test, expect, waitForEditor } = require('./fixtures/hotglue.js');

const box = (left, top, extra = {}) => ({
	type: 'text', module: 'text',
	'object-left': `${left}px`, 'object-top': `${top}px`,
	'object-width': '150px', 'object-height': '100px', 'object-zindex': '100',
	'text-background-color': 'transparent', ...extra,
});

const byId = (page, id) => page.locator(`[id="${id}"]`);
const posOf = (page, id) => page.evaluate((i) => {
	const el = document.getElementById(i);
	return [parseFloat(el.style.left), parseFloat(el.style.top)];
}, id);

// object-lock is what module_lock.inc.php:31 turns into the .locked class
const seedLocked = (hg) => hg.addObject('100000000001',
	box(200, 200, { 'object-lock': 'locked' }), 'LOCKED');
const seedFree = (hg) => hg.addObject('100000000002', box(600, 200), 'FREE');

test('a locked object renders with the locked class', async ({ page, hg }) => {
	const a = seedLocked(hg);
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await expect(byId(page, a)).toHaveClass(/\blocked\b/);
});

test('a locked object cannot be dragged', async ({ page, hg }) => {
	const a = seedLocked(hg);
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);

	const before = await posOf(page, a);
	await page.mouse.move(275, 250);
	await page.mouse.down();
	for (let i = 1; i <= 6; i++) await page.mouse.move(275 + i * 30, 250 + i * 15);
	const during = await posOf(page, a);
	await page.mouse.up();

	expect(during, 'a locked object moved while being dragged').toEqual(before);
});

test('a locked object shows no resize handles when selected', async ({ page, hg }) => {
	const a = seedLocked(hg);
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await byId(page, a).click();
	expect(await page.locator('.moveable-control.moveable-direction').count()).toBe(0);
});

test('arrow keys do not nudge a locked object', async ({ page, hg }) => {
	const a = seedLocked(hg);
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);

	await byId(page, a).click();
	const before = await posOf(page, a);
	await page.keyboard.press('ArrowRight');
	await page.keyboard.press('ArrowDown');
	expect(await posOf(page, a), 'arrow keys moved a locked object').toEqual(before);
});

test('select-all leaves locked objects out of the selection', async ({ page, hg }) => {
	const locked = seedLocked(hg);
	const free = seedFree(hg);
	await page.goto(hg.editUrl());
	await waitForEditor(page, 2);

	// js/edit.js:1546 - ctrl+A selects .object:not(.glue-selected):not(.locked)
	await page.keyboard.press('Control+a');
	const sel = await page.evaluate(() =>
		Array.from(document.querySelectorAll('.glue-selected')).map((el) => el.id));
	expect(sel).toEqual([free]);
	expect(sel).not.toContain(locked);
});
