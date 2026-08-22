// register/unregister must round-trip.
//
// $.glue.object.register() guards against registering the same object twice by
// id. unregister() used to destroy the Moveable without clearing that guard, so
// a register() afterwards returned early and the object was left with no drag
// or resize handling at all - silently, until the page was reloaded. Nothing in
// the editor did the pair back to back, which is why it went unnoticed; the
// Object Properties dialog nearly did, and would have broken every object it
// was opened on.

const { test, expect, waitForEditor } = require('./fixtures/hotglue.js');

const OBJ = {
	type: 'text', module: 'text',
	'object-left': '200px', 'object-top': '200px',
	'object-width': '160px', 'object-height': '80px', 'object-zindex': '100',
	'text-background-color': 'transparent',
};

test('an object can be unregistered and registered again', async ({ page, hg }) => {
	const a = hg.addObject('100000000001', OBJ, 'A');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);

	expect(await page.evaluate((i) =>
		!!window.$.glue.object.moveable_of(document.getElementById(i)), a),
	'the object should start registered').toBe(true);

	await page.evaluate((i) => {
		const el = document.getElementById(i);
		window.$.glue.object.unregister(el);
		window.$.glue.object.register(el);
	}, a);

	expect(await page.evaluate((i) =>
		!!window.$.glue.object.moveable_of(document.getElementById(i)), a),
	're-registering left the object with no Moveable').toBe(true);

	// and it is genuinely draggable again, not just holding an instance
	const before = await page.evaluate((i) =>
		parseFloat(document.getElementById(i).style.left), a);
	const box = await page.locator(`[id="${a}"]`).boundingBox();
	await page.mouse.move(box.x + 80, box.y + 40);
	await page.mouse.down();
	for (let i = 1; i <= 6; i++) await page.mouse.move(box.x + 80 + i * 20, box.y + 40);
	await page.mouse.up();
	expect(await page.evaluate((i) =>
		parseFloat(document.getElementById(i).style.left), a),
	'the re-registered object did not respond to a drag').toBeGreaterThan(before + 50);
});
