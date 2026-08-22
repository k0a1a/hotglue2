// KNOWN REGRESSION from the jQuery removal. Both tests below are marked
// test.fail(): they describe the behaviour hotglue is supposed to have, they
// currently do not hold, and Playwright will report a failure the moment
// somebody fixes it - at which point delete the test.fail() lines.
//
// Symptom, measured:
//   - a single click on a text object jumps straight into editing, where it
//     should take a second click ("check if we are already editing" at
//     modules/text/text-edit.js:260 only makes sense if the handler is meant
//     to fire on a click when the object is ALREADY selected)
//   - shift-clicking a second text object deselects the first, so two text
//     objects cannot be multi-selected at all. On content/zinecamp2015 that is
//     32 of 65 objects.
//
// Cause is the delegation rewrite, not the text module. $.glue.live
// (js/glue.js:97) registers one document listener per call and evaluates
// e.target.closest(selector) when that listener runs, so listeners see class
// changes made by earlier listeners during the SAME dispatch:
//
//   1. live('.object', 'click')            edit.js:1639   adds .glue-selected
//   2. live('.text.glue-selected','click') text-edit.js:258  now matches, and
//      deselects every other object before entering edit mode
//
// jQuery's delegated handlers build their queue once, walking target -> root
// before invoking anything, so a selector that only starts matching mid
// dispatch never fires. That difference is the whole bug.
//
// A minimal fix is an e.shiftKey guard in text-edit.js:258 plus requiring the
// object to have been selected before this dispatch; the general fix is for
// $.glue.live to snapshot its matches at dispatch time the way jQuery did,
// which would need checking against every other live() call site.

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
	test.fail();
	const a = hg.addObject('100000000001', box(100, 100), 'A');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);

	await byId(page, a).click();
	expect(await selected(page)).toEqual([a]);
	expect(await editing(page), 'one click went straight into text editing').toEqual([]);
});

test('shift-clicking a second text object adds it to the selection', async ({ page, hg }) => {
	test.fail();
	const a = hg.addObject('100000000001', box(100, 100), 'A');
	const b = hg.addObject('100000000002', box(400, 100), 'B');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 2);

	await byId(page, a).click();
	await byId(page, b).click({ modifiers: ['Shift'] });
	expect(await selected(page), 'shift-click replaced the selection instead of extending it')
		.toEqual([a, b].sort());
});
