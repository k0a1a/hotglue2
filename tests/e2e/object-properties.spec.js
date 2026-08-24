// Object Properties modal - SOW-object-properties.md.
//
// The object is presented as the <div> it renders as: id read-only, hotglue's
// classes fixed with an input for the user's own, and rows of custom
// attributes. Three layers are under test, and they are deliberately separate:
//
//   1. the modal's own validation, which is FEEDBACK only
//   2. object.set_properties, which REFUSES a bad save with a reason
//   3. the render path, which filters independently - and has to, because
//      glue.update_object is a generic key/value setter, so a guard that only
//      runs on the write can be walked around with one POST
//
// Layer 3 is the one that matters for safety: html.inc.php:228 emits attribute
// NAMES with htmlspecialchars(..., ENT_NOQUOTES), which leaves quotes alone, so
// a name like  x" onload="alert(1)  would break out of the attribute and inject
// an event handler if it ever reached the renderer.

const { test, expect, waitForEditor } = require('./fixtures/hotglue.js');

const box = (left, top) => ({
	type: 'text', module: 'text',
	'object-left': `${left}px`, 'object-top': `${top}px`,
	'object-width': '200px', 'object-height': '100px', 'object-zindex': '100',
	'text-background-color': 'transparent',
});

const byId = (page, id) => page.locator(`[id="${id}"]`);

// Open the object's context menu and click the properties icon.
async function openProperties(page, id) {
	await byId(page, id).click();
	await page.getByTitle(/object properties/).click();
	await expect(page.locator('.glue-modal-tag')).toBeVisible();
}

// Talk to the service directly, the way a bypassing client would.
const callService = (page, args) => page.evaluate((a) => new Promise((res) => {
	window.$.glue.backend(a, res, false);
}), args);

test('the modal shows the object as a div, with id fixed', async ({ page, hg }) => {
	const a = hg.addObject('100000000001', box(200, 200), 'A');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await openProperties(page, a);

	const tag = page.locator('.glue-tag');
	await expect(tag).toContainText('<div');
	await expect(tag).toContainText(a);			// full dotted id, for copying
	await expect(tag).toContainText('class=');
	// the id is text, never an input
	expect(await page.locator('.glue-tag input[value*="' + a + '"]').count()).toBe(0);
	// hotglue's own classes are shown, and shown as fixed
	await expect(page.locator('.glue-tag-fixed').nth(1)).toContainText('object');
});

test('user classes are appended to the system ones and persist', async ({ page, hg }) => {
	const a = hg.addObject('100000000001', box(200, 200), 'A');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await openProperties(page, a);

	await page.locator('.glue-tag-input').first().fill('mine other-one');
	await page.locator('.glue-modal-buttons button:has-text("OK")').click();

	await expect.poll(() => hg.readObject('100000000001').attrs['object-custom-class'])
		.toBe('mine other-one');
	// the editor reflects it live, without losing the system classes
	await expect(byId(page, a)).toHaveClass(/\bobject\b/);
	await expect(byId(page, a)).toHaveClass(/\bmine\b/);

	// and it survives a reload through the render path
	await page.reload();
	await waitForEditor(page, 1);
	await expect(byId(page, a)).toHaveClass(/\bmine\b/);
	await expect(byId(page, a)).toHaveClass(/\bobject\b/);
});

test('a custom attribute round-trips to the page', async ({ page, hg }) => {
	const a = hg.addObject('100000000001', box(200, 200), 'A');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await openProperties(page, a);

	await page.locator('.glue-tag-add').click();
	await page.locator('.glue-tag-attr-name').fill('data-note');
	await page.locator('.glue-tag-attr-value').fill('hello world');
	await page.locator('.glue-modal-buttons button:has-text("OK")').click();

	await expect.poll(() => hg.readObject('100000000001').attrs['object-attributes'])
		.toBe('{"data-note":"hello world"}');

	await page.reload();
	await waitForEditor(page, 1);
	await expect(byId(page, a)).toHaveAttribute('data-note', 'hello world');
});

test('the modal blocks a denied attribute before it can be saved', async ({ page, hg }) => {
	const a = hg.addObject('100000000001', box(200, 200), 'A');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await openProperties(page, a);

	await page.locator('.glue-tag-add').click();
	await page.locator('.glue-tag-attr-name').fill('onclick');
	await expect(page.locator('.glue-tag-problem')).toContainText('event handlers');
	await expect(page.locator('.glue-modal-buttons button:has-text("OK")')).toBeDisabled();

	await page.locator('.glue-tag-attr-name').fill('style');
	await expect(page.locator('.glue-tag-problem')).toContainText('managed by the object');
	await expect(page.locator('.glue-modal-buttons button:has-text("OK")')).toBeDisabled();
});

for (const [name, why] of [
	['onclick', 'event handlers'],
	['style', 'position and size'],
	['id', 'managed by hotglue'],
	['x" onload="alert(1)', 'Invalid attribute name'],
]) {
	test(`the server refuses attribute ${JSON.stringify(name)}`, async ({ page, hg }) => {
		const a = hg.addObject('100000000001', box(200, 200), 'A');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);

		const resp = await callService(page, {
			method: 'object.set_properties', name: a, attributes: { [name]: 'x' },
		});
		expect(resp['#error'], 'the server accepted a denied attribute').toBeTruthy();
		expect(String(resp['#data'])).toContain(why);
		// and nothing was written
		expect(hg.readObject('100000000001').attrs['object-attributes']).toBeUndefined();
	});
}

test('the renderer drops a dangerous attribute written behind the service', async ({ page, hg }) => {
	const a = hg.addObject('100000000001', box(200, 200), 'A');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);

	// straight past object.set_properties, the way a scripted client would
	await callService(page, {
		method: 'glue.update_object', name: a,
		'object-attributes': '{"x\\" onload=\\"alert(1)":"v","onclick":"evil()","data-ok":"kept"}',
	});
	expect(hg.readObject('100000000001').attrs['object-attributes'],
		'update_object is generic and did store it - that is the premise').toBeTruthy();

	await page.reload();
	await waitForEditor(page, 1);

	const html = await page.evaluate((i) => document.getElementById(i).outerHTML, a);
	expect(html, 'an injected event handler reached the page').not.toContain('onload');
	expect(html, 'an injected event handler reached the page').not.toContain('onclick');
	expect(html, 'the valid attribute alongside it was dropped too').toContain('data-ok="kept"');
});

test('invalid class tokens are refused by the server', async ({ page, hg }) => {
	const a = hg.addObject('100000000001', box(200, 200), 'A');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);

	const resp = await callService(page, {
		method: 'object.set_properties', name: a, classes: 'fine 9bad also-fine',
	});
	expect(resp['#error']).toBeTruthy();
	expect(String(resp['#data'])).toContain('9bad');
	expect(hg.readObject('100000000001').attrs['object-custom-class']).toBeUndefined();
});

test('awkward attribute values survive storage and are escaped on render', async ({ page, hg }) => {
	const a = hg.addObject('100000000001', box(200, 200), 'A');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);

	const value = 'quote " angle <b> amp & colon : equals = ünïcode';
	const resp = await callService(page, {
		method: 'object.set_properties', name: a, attributes: { title: value },
	});
	expect(resp['#error']).toBeFalsy();

	// the object file must still parse: one line, colons and all
	const attrs = hg.readObject('100000000001').attrs;
	expect(Object.keys(attrs)).toContain('object-attributes');
	expect(attrs['object-top'], 'the flat file format was corrupted').toBe('200px');

	await page.reload();
	await waitForEditor(page, 1);
	// the DOM value is the original, i.e. it was escaped rather than mangled
	await expect(byId(page, a)).toHaveAttribute('title', value);
});

test('every field can be clicked into, not just the focused one', async ({ page, hg }) => {
	// Regression: edit.js's global mousedown handler calls preventDefault to
	// stop canvas drags becoming text selections, and that also suppresses
	// FOCUS. The modal opens with the class input focused programmatically, so
	// typing appeared to work while clicking any other field did nothing and
	// the keystrokes kept going to the class input. Form controls are now
	// exempt from that handler (js/edit.js:2394).
	const a = hg.addObject('100000000001', box(200, 200), 'A');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await openProperties(page, a);

	const classInput = page.locator('.glue-tag-input').first();
	await page.locator('.glue-tag-add').click();
	const nameInput = page.locator('.glue-tag-attr-name');
	const valueInput = page.locator('.glue-tag-attr-value');

	// click each field and type - no fill(), which would focus programmatically
	// and hide exactly the bug this guards
	await nameInput.click();
	await page.keyboard.type('data-note');
	await valueInput.click();
	await page.keyboard.type('hi');
	await classInput.click();
	await page.keyboard.type('mine');

	expect(await nameInput.inputValue()).toBe('data-note');
	expect(await valueInput.inputValue()).toBe('hi');
	expect(await classInput.inputValue()).toBe('mine');

	await page.locator('.glue-modal-buttons button:has-text("OK")').click();
	await expect.poll(() => hg.readObject('100000000001').attrs['object-attributes'])
		.toBe('{"data-note":"hi"}');
	expect(hg.readObject('100000000001').attrs['object-custom-class']).toBe('mine');
});

test('the dialog is modal: keys do not reach the canvas behind it', async ({ page, hg }) => {
	// The editor binds its shortcuts on documentElement and the dialog lives
	// inside body, so without stopping propagation every keystroke typed here
	// also drove the canvas: Tab cycled through objects behind the dialog, and
	// Delete, the arrow keys and ctrl+z were all live too.
	const a = hg.addObject('100000000001', box(200, 200), 'A');
	const b = hg.addObject('100000000002', box(600, 200), 'B');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 2);
	await openProperties(page, a);

	const selectedBefore = await page.evaluate(() =>
		Array.from(document.querySelectorAll('.glue-selected')).map((el) => el.id));
	const posBefore = await page.evaluate((i) => {
		const el = document.getElementById(i);
		return [el.style.left, el.style.top];
	}, a);

	for (let i = 0; i < 8; i++) await page.keyboard.press('Tab');
	await page.keyboard.press('ArrowRight');
	await page.keyboard.press('ArrowDown');
	await page.keyboard.press('Delete');

	// nothing on the canvas moved, changed selection, or got deleted
	expect(await page.evaluate(() =>
		Array.from(document.querySelectorAll('.glue-selected')).map((el) => el.id)),
	'Tab cycled the canvas selection behind the dialog').toEqual(selectedBefore);
	expect(await page.evaluate((i) => {
		const el = document.getElementById(i);
		return [el.style.left, el.style.top];
	}, a), 'arrow keys moved an object behind the dialog').toEqual(posBefore);
	await expect(page.locator('.object')).toHaveCount(2);
	expect(b).toBeTruthy();

	// and focus never left the dialog
	expect(await page.evaluate(() =>
		!!document.activeElement.closest('.glue-modal-tag')),
	'Tab walked focus out of the dialog').toBe(true);
});

test('closing the dialog gives the canvas its keyboard back', async ({ page, hg }) => {
	// The other half of being modal. Swallowing keys while open is only correct
	// if the editor is usable again the moment it closes - asserting on
	// document.activeElement would not show that, and would pass trivially
	// since the icon that opens the dialog is a mask div with no tabindex,
	// which cannot hold focus either.
	const a = hg.addObject('100000000001', box(200, 200), 'A');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await openProperties(page, a);
	await page.keyboard.press('Escape');
	await expect(page.locator('.glue-modal-tag')).toHaveCount(0);

	const before = await page.evaluate((i) => parseFloat(document.getElementById(i).style.left), a);
	await page.keyboard.press('ArrowRight');
	const after = await page.evaluate((i) => parseFloat(document.getElementById(i).style.left), a);
	expect(after - before, 'the canvas did not get its keyboard back').toBe(1);
});
