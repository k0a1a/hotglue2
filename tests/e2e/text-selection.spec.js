// Regression guard for text-object selection, and for the event delegation
// underneath it.
//
// Both behaviours below were BROKEN by the jQuery removal and fixed in
// js/glue.js. They are worth keeping tested because the failure was invisible
// from the code: nothing in text-edit.js changed, and the module reads
// correctly on its own.
//
// What broke:
//   - a single click on a text object jumped straight into editing, where it
//     should take a second click ("check if we are already editing" at
//     modules/text/text-edit.js:260 only makes sense if that handler fires on
//     a click when the object is ALREADY selected)
//   - shift-clicking a second text object deselected the first, so two text
//     objects could not be multi-selected at all. On content/zinecamp2015 that
//     is 32 of 65 objects.
//
// Why: $.glue.live used to register a separate document listener per call, so
// each evaluated e.target.closest(selector) when it ran and saw class changes
// made by handlers that ran before it in the SAME dispatch:
//
//   1. live('.object', 'click')             edit.js   adds .glue-selected
//   2. live('.text.glue-selected', 'click') text-edit.js  now matches, and
//      deselects every other object before entering edit mode
//
// jQuery's delegated handlers built their queue once, walking target -> root
// before invoking anything, so a selector that only started matching mid
// dispatch never fired. $.glue.live now resolves all matches up front, which
// restores that. Only one registered selector depends on mutable state
// (.text.glue-selected), so nothing else was affected.

const { test, expect, waitForEditor } = require('./fixtures/hotglue.js');

const box = (left, top) => ({
	type: 'text', module: 'text',
	'object-left': `${left}px`, 'object-top': `${top}px`,
	'object-width': '150px', 'object-height': '100px', 'object-zindex': '100',
	'text-background-color': 'transparent',
});

const byId = (page, id) => page.locator(`[id="${id}"]`);
const selected = (page) => page.evaluate(() =>
	Array.from(document.querySelectorAll('.glue-selected')).map((el) => el.id).sort());
const editing = (page) => page.evaluate(() =>
	Array.from(document.querySelectorAll('.glue-text-editing')).map((el) => el.id));

test('a single click on a text object selects it without entering edit mode', async ({ page, hg }) => {
	const a = hg.addObject('100000000001', box(100, 100), 'A');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);

	await byId(page, a).click();
	expect(await selected(page)).toEqual([a]);
	expect(await editing(page), 'one click went straight into text editing').toEqual([]);
});

test('shift-clicking a second text object adds it to the selection', async ({ page, hg }) => {
	const a = hg.addObject('100000000001', box(100, 100), 'A');
	const b = hg.addObject('100000000002', box(400, 100), 'B');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 2);

	await byId(page, a).click();
	await byId(page, b).click({ modifiers: ['Shift'] });
	expect(await selected(page), 'shift-click replaced the selection instead of extending it')
		.toEqual([a, b].sort());
});
