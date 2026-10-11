// A selection of several objects: no resize or rotation handles, and a left
// menu of just freeze and delete that act on each selected object.

const { test, expect, waitForEditor } = require('./fixtures/hotglue.js');

const box = (left, top) => ({
	type: 'text', module: 'text',
	'object-left': `${left}px`, 'object-top': `${top}px`,
	'object-width': '120px', 'object-height': '60px', 'object-zindex': '100',
	'text-background-color': '#ffff00',
});
const byId = (page, id) => page.locator(`[id="${id}"]`);

async function setup(page, hg) {
	const a = hg.addObject('100000000001', box(100, 150), 'A');
	const b = hg.addObject('100000000002', box(400, 150), 'B');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 2);
	await byId(page, a).click();
	return { a, b };
}

test('several selected: no handles, and the menu is freeze and delete only', async ({ page, hg }) => {
	const { a, b } = await setup(page, hg);
	await expect(page.locator('.moveable-rotation-control').first()).toBeVisible();
	await expect(page.locator('.moveable-direction').first()).toBeVisible();

	await byId(page, b).click({ modifiers: ['Shift'] });
	await expect(page.locator('.moveable-rotation-control')).toHaveCount(0);
	await expect(page.locator('.moveable-control.moveable-direction')).toHaveCount(0);
	await expect(page.locator('[id^="glue-contextmenu-"]:visible')).toHaveCount(2);
	await expect(page.locator('#glue-contextmenu-object-lock')).toBeVisible();
	await expect(page.locator('#glue-contextmenu-object-delete')).toBeVisible();

	// back to one: the handles return
	await byId(page, b).click({ modifiers: ['Shift'] });
	await expect(page.locator('.moveable-rotation-control').first()).toBeVisible();
});

test('freeze and unfreeze apply to every selected object', async ({ page, hg }) => {
	const { a, b } = await setup(page, hg);
	await byId(page, b).click({ modifiers: ['Shift'] });
	await page.locator('#glue-contextmenu-object-lock').click();
	await expect(byId(page, a)).toHaveClass(/locked/);
	await expect(byId(page, b)).toHaveClass(/locked/);
	// still selected, so the menu is still the multi one, now offering unfreeze
	await expect(page.locator('#glue-contextmenu-object-lock')).toBeVisible();
	await page.locator('#glue-contextmenu-object-lock').click();
	await expect(byId(page, a)).not.toHaveClass(/locked/);
	await expect(byId(page, b)).not.toHaveClass(/locked/);
	await expect(page.locator('.moveable-rotation-control')).toHaveCount(0);
});

test('delete removes every selected object', async ({ page, hg }) => {
	const { a, b } = await setup(page, hg);
	await byId(page, b).click({ modifiers: ['Shift'] });
	await page.locator('#glue-contextmenu-object-delete').click();
	await expect(byId(page, a)).toHaveCount(0);
	await expect(byId(page, b)).toHaveCount(0);
});
