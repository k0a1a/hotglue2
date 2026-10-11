// The object menu stays on screen: the top row drops under the object when it
// would leave the top of the screen, and the left column moves to the object's
// right when it would leave the left edge.

const { test, expect, waitForEditor } = require('./fixtures/hotglue.js');

const attrs = (left, top) => ({
	type: 'text', module: 'text',
	'object-left': left+'px', 'object-top': top+'px',
	'object-width': '200px', 'object-height': '100px', 'object-zindex': '100',
	'text-background-color': '#ffff00',
});
const byId = (page, id) => page.locator(`[id="${id}"]`);

async function geometry(page, id) {
	return page.evaluate((id) => {
		const o = document.getElementById(id).getBoundingClientRect();
		const box = (sel) => {
			const r = [...document.querySelectorAll(sel)]
				.filter((e) => getComputedStyle(e).display != 'none')
				.map((e) => e.getBoundingClientRect());
			return {
				left: Math.min(...r.map((x) => x.left)), right: Math.max(...r.map((x) => x.right)),
				top: Math.min(...r.map((x) => x.top)), bottom: Math.max(...r.map((x) => x.bottom)),
			};
		};
		return { o, row: box('.glue-contextmenu-top'), col: box('.glue-contextmenu-left') };
	}, id);
}

for (const [name, left, top, flipRow, flipCol] of [
	['in the open', 300, 300, false, false],
	['at the top edge', 300, 0, true, false],
	['at the left edge', 0, 300, false, true],
	['in the corner', 0, 0, true, true],
]) {
	test(`the menu ${name}`, async ({ page, hg }) => {
		const id = hg.addObject('100000000001', attrs(left, top), 'hello');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await byId(page, id).click({ position: { x: 100, y: 50 } });
		await page.waitForTimeout(600);
		const g = await geometry(page, id);
		if (flipRow) {
			expect(g.row.top).toBeGreaterThanOrEqual(g.o.bottom);
		} else {
			expect(g.row.bottom).toBeLessThanOrEqual(g.o.top);
		}
		if (flipCol) {
			expect(g.col.left).toBeGreaterThanOrEqual(g.o.right);
		} else {
			expect(g.col.right).toBeLessThanOrEqual(g.o.left);
		}
		expect(g.row.top).toBeGreaterThanOrEqual(0);
		expect(g.col.left).toBeGreaterThanOrEqual(0);
	});
}
