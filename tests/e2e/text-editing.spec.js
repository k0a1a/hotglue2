// Typing isolation inside a text object - MODERNIZATION.md section 11,
// scenario 7, against section 8 item 1:
//
//   "text-edit.js has a documented Chrome-specific event-propagation quirk
//    around isolating textarea typing from canvas drag/selection handlers.
//    This is the highest-risk single file in the whole migration."
//
// The isolation is not a guard in edit.js - there is no "am I editing text"
// check on the canvas keyboard handlers. It is the editing surface itself
// calling stopPropagation on keydown/keypress/keyup. So every canvas shortcut
// is live and merely unreachable, and if propagation ever stops being stopped,
// typing an arrow key nudges the object and pressing Delete deletes it
// mid-sentence.
//
// Text objects are edited WYSIWYG: the rendered div is contenteditable, so the
// markup stays hidden. The textarea is still there behind the </> source
// toggle, and has its own stopPropagation handlers - the tests below drive
// whichever surface is live rather than naming one.

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
// what is actually being typed into
const surface = (page, id) => page.locator(`[id="${id}"] > .glue-text-render`);
const shownText = (page, id) => page.evaluate((i) =>
	document.querySelector(`[id="${i}"] > .glue-text-render`).innerText, id);

// One click selects, a second enters editing (modules/text/text-edit.js).
async function startEditing(page, id) {
	await byId(page, id).click();
	await byId(page, id).click();
	await expect.poll(() => isEditing(page, id)).toBe(true);
	await expect.poll(() => page.evaluate((i) =>
		document.querySelector(`[id="${i}"] > .glue-text-render`).isContentEditable, id)).toBe(true);
}

test('a second click enters editing on the rendered text', async ({ page, hg }) => {
	const a = hg.addObject('100000000001', box(300, 300), 'HELLO');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await startEditing(page, a);
});

test('typing goes into the text, not the canvas', async ({ page, hg }) => {
	const a = hg.addObject('100000000001', box(300, 300), 'HELLO');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await startEditing(page, a);

	const before = await posOf(page, a);
	await surface(page, a).click();
	await page.keyboard.type(' WORLD');
	expect(await shownText(page, a)).toContain('WORLD');
	expect(await posOf(page, a), 'typing moved the object').toEqual(before);
});

test('arrow keys move the caret rather than the object', async ({ page, hg }) => {
	const a = hg.addObject('100000000001', box(300, 300), 'HELLO');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await startEditing(page, a);

	const before = await posOf(page, a);
	await surface(page, a).click();
	for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight');
	await page.keyboard.press('ArrowDown');
	expect(await posOf(page, a), 'arrow keys nudged the object while typing').toEqual(before);
	// and the caret really is in the text
	expect(await page.evaluate((i) => {
		const sel = window.getSelection();
		return sel.rangeCount > 0 &&
			document.querySelector(`[id="${i}"] > .glue-text-render`).contains(sel.anchorNode);
	}, a), 'the caret is not in the text being edited').toBe(true);
});

test('Delete while editing does not delete the object', async ({ page, hg }) => {
	const a = hg.addObject('100000000001', box(300, 300), 'HELLO');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await startEditing(page, a);

	// js/edit.js deletes the selection on keycode 46 - the object IS selected
	// right now, so only stopPropagation stands between a keystroke and losing
	// the object mid-sentence
	await surface(page, a).click();
	await page.keyboard.press('Delete');
	await page.keyboard.press('Delete');
	await expect(byId(page, a), 'Delete removed the object being typed into').toHaveCount(1);
});

test('Escape leaves editing and the text is persisted', async ({ page, hg }) => {
	const a = hg.addObject('100000000001', box(300, 300), 'HELLO');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await startEditing(page, a);

	await surface(page, a).click();
	await page.keyboard.press('End');
	await page.keyboard.type(' THERE');
	await page.keyboard.press('Escape');
	await expect.poll(() => isEditing(page, a)).toBe(false);

	// content travels via glue.update_object, not save_state
	// (modules/text/text-edit.js:176)
	await expect.poll(() => hg.readObject('100000000001').content).toContain('THERE');
});
