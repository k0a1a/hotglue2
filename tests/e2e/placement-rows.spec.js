// x, y and scale in the object properties panel and the text panel, above
// "more knobs": the object's own left/top, and its size as a percentage of
// what it was when the panel opened.

const { test, expect, waitForEditor } = require('./fixtures/hotglue.js');

const ATTRS = {
	type: 'text', module: 'text',
	'object-left': '200px', 'object-top': '150px',
	'object-width': '300px', 'object-height': '100px', 'object-zindex': '100',
	'text-background-color': '#ffff00',
};
const byId = (page, id) => page.locator(`[id="${id}"]`);

async function open(page, hg, button) {
	const id = hg.addObject('100000000001', ATTRS, 'hello');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await byId(page, id).click();
	await page.waitForTimeout(500);
	await page.getByTitle(button).click();
	return id;
}

for (const [name, button, panel] of [
	['object properties', /object properties - background/, '.glue-properties-popover'],
	['text', /text properties - font/, '.glue-font-popover'],
]) {
	test(`${name} panel: x, y and scale move and size the object`, async ({ page, hg }) => {
		const id = await open(page, hg, button);
		const rows = page.locator(`${panel} .glue-placement-rows .glue-popover-field`);
		await expect(rows).toHaveCount(3);
		// above the fold
		const order = await page.evaluate((sel) => {
			const p = document.querySelector(sel);
			const g = p.querySelector('.glue-placement-rows');
			const f = p.querySelector('.glue-popover-disclosure').parentElement;
			return !!(g.compareDocumentPosition(f) & Node.DOCUMENT_POSITION_FOLLOWING);
		}, panel);
		expect(order).toBe(true);
		await expect(rows.nth(0)).toHaveValue('200');
		await expect(rows.nth(1)).toHaveValue('150');
		await expect(rows.nth(2)).toHaveValue('100');

		await rows.nth(0).fill('320');
		await rows.nth(0).press('Enter');
		await rows.nth(1).fill('90');
		await rows.nth(1).press('Enter');
		await rows.nth(2).fill('50');
		await rows.nth(2).press('Enter');
		await expect.poll(() => byId(page, id).evaluate((el) =>
			[el.style.left, el.style.top, el.style.width, el.style.height].join()))
			.toBe('320px,90px,150px,50px');
		await expect.poll(() => hg.readObject('100000000001').attrs['object-left']).toBe('320px');
		await expect.poll(() => hg.readObject('100000000001').attrs['object-width']).toBe('150px');
	});
}

// a panel takes the object's menu's place while it is open, and the menu
// comes back when the panel goes
test('the menu goes away with the panel open and returns when it closes', async ({ page, hg }) => {
	const id = await open(page, hg, /object properties - background/);
	await expect(page.locator('.glue-properties-popover')).toBeVisible();
	await expect(page.locator('.glue-contextmenu-left, .glue-contextmenu-top')).toHaveCount(0);
	// the panel has x, y and scale fields: no resize or rotation handles
	await expect(page.locator('.moveable-rotation-control')).toHaveCount(0);
	await expect(page.locator('.moveable-control.moveable-direction')).toHaveCount(0);

	await page.keyboard.press('Escape');
	await expect(page.locator('.glue-properties-popover')).toBeHidden();
	await expect(page.locator('#glue-contextmenu-object-lock')).toBeVisible();
	await expect(page.locator('.moveable-rotation-control').first()).toBeVisible();
	await expect(page.locator('.moveable-control.moveable-direction').first()).toBeVisible();

	// letting go of the object with the panel open leaves no menu behind
	await page.getByTitle(/object properties - background/).click();
	await expect(page.locator('.glue-properties-popover')).toBeVisible();
	await page.mouse.click(5, 5);
	await expect(page.locator('.glue-properties-popover')).toBeHidden();
	await expect(page.locator('.glue-contextmenu-left, .glue-contextmenu-top')).toHaveCount(0);
});
