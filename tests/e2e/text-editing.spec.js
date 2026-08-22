// Typing isolation inside a text object - MODERNIZATION.md section 11,
// scenario 7, against section 8 item 1:
//
//   "text-edit.js has a documented Chrome-specific event-propagation quirk
//    around isolating textarea typing from canvas drag/selection handlers.
//    This is the highest-risk single file in the whole migration."
//
// The isolation is not a guard in edit.js - there is no "am I in a textarea"
// check on the canvas keyboard handlers. It is the textarea itself calling
// stopPropagation on keydown/keypress/keyup while it is being edited
// (modules/text/text-edit.js:198-239). So every canvas shortcut is live and
// merely unreachable, and if propagation ever stops being stopped, typing an
// arrow key nudges the object and pressing Delete deletes it mid-sentence.

const { test, expect, waitForEditor } = require('./fixtures/hotglue.js');

const box = (left, top) => ({
	type: 'text', module: 'text',
	'object-left': `${left}px`, 'object-top': `${top}px`,
	'object-width': '200px', 'object-height': '120px', 'object-zindex': '100',
	'text-background-color': 'transparent',
});

const byId = (page, id) => page.locator(`[id="${id}"]`);
const posOf = (page, id) => page.evaluate((i) => {
	const el = document.getElementById(i);
	return [parseFloat(el.style.left), parseFloat(el.style.top)];
}, id);
const isEditing = (page, id) => page.evaluate((i) =>
	document.getElementById(i).classList.contains('glue-text-editing'), id);

// One click selects, a second enters editing (modules/text/text-edit.js:258).
async function startEditing(page, id) {
	await byId(page, id).click();
	await byId(page, id).click();
	await expect.poll(() => isEditing(page, id)).toBe(true);
	await expect(page.locator(`[id="${id}"] > .glue-text-input`)).toBeFocused();
}

test('a second click enters editing and focuses the textarea', async ({ page, hg }) => {
	const a = hg.addObject('100000000001', box(300, 300), 'HELLO');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await startEditing(page, a);
});

test('typing goes into the textarea, not the canvas', async ({ page, hg }) => {
	const a = hg.addObject('100000000001', box(300, 300), 'HELLO');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await startEditing(page, a);

	const before = await posOf(page, a);
	await page.keyboard.type(' WORLD');
	expect(await page.inputValue(`[id="${a}"] > .glue-text-input`)).toContain('WORLD');
	expect(await posOf(page, a), 'typing moved the object').toEqual(before);
});

test('arrow keys move the caret rather than the object', async ({ page, hg }) => {
	const a = hg.addObject('100000000001', box(300, 300), 'HELLO');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await startEditing(page, a);

	const before = await posOf(page, a);
	for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight');
	await page.keyboard.press('ArrowDown');
	expect(await posOf(page, a), 'arrow keys nudged the object while typing').toEqual(before);
	// and the caret really did move
	expect(await page.evaluate((i) =>
		document.querySelector(`[id="${i}"] > .glue-text-input`).selectionStart, a))
		.toBeGreaterThan(0);
});

test('Delete while editing does not delete the object', async ({ page, hg }) => {
	const a = hg.addObject('100000000001', box(300, 300), 'HELLO');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await startEditing(page, a);

	// js/edit.js:1609 deletes the selection on keycode 46 - the object IS
	// selected right now, so only stopPropagation stands between a keystroke
	// and losing the object mid-sentence
	await page.keyboard.press('Delete');
	await page.keyboard.press('Delete');
	await expect(byId(page, a), 'Delete removed the object being typed into').toHaveCount(1);
});

test('Escape leaves editing and the text is persisted', async ({ page, hg }) => {
	const a = hg.addObject('100000000001', box(300, 300), 'HELLO');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await startEditing(page, a);

	await page.keyboard.press('End');
	await page.keyboard.type(' THERE');
	await page.keyboard.press('Escape');
	await expect.poll(() => isEditing(page, a)).toBe(false);

	// content travels via glue.update_object, not save_state
	// (modules/text/text-edit.js:176)
	await expect.poll(() => hg.readObject('100000000001').content).toContain('THERE');
});
