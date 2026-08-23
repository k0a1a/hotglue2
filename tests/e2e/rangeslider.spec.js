// $.glue.rangeslider - the visible bar for menu buttons that set a number by
// being dragged.
//
// NOTE: nothing in the editor drives it yet. It was built for the object
// rotation control and rotation ended up being direct manipulation instead
// (Moveable's handle, see rotate.spec.js), so the widget is waiting for the
// first ranged control to adopt it - the invisible drags that transparency,
// font size and border width use today are the candidates. These tests drive
// it directly, through synthetic menu buttons, rather than leaving it
// untested until then.
//
// Two things about it are worth pinning down. The bar has to point AWAY from
// the object - left from a button in the left-hand column, up from one in the
// top row - or it lies across the thing being edited. And the press starts on
// the button while the release happens wherever the drag went, so the click
// the browser then synthesises is dispatched on their common ancestor, body -
// which is exactly what $.glue.sel reads as "deselect everything".

const { test, expect, waitForEditor } = require('./fixtures/hotglue.js');

const ATTRS = {
	type: 'text', module: 'text',
	'object-left': '300px', 'object-top': '300px',
	'object-width': '160px', 'object-height': '80px', 'object-zindex': '100',
	'text-background-color': 'transparent',
};

// a menu button of the given kind, wired to a value the test can read back
async function makeButton(page, kind, at = { left: 500, top: 420 }) {
	await page.evaluate(([k, pos]) => {
		const b = document.createElement('div');
		b.className = k+' glue-ui';
		b.id = 'e2e-slider-button';
		b.style.position = 'absolute';
		b.style.left = pos.left+'px';
		b.style.top = pos.top+'px';
		b.style.width = '32px';
		b.style.height = '32px';
		document.body.appendChild(b);
		window.__v = 50;
		$.glue.rangeslider.attach(b, {
			min: 0, max: 100,
			value: () => window.__v,
			change: (v) => { window.__v = v; },
			stop: (v, moved) => { window.__moved = moved; },
		});
	}, [kind, at]);
	return page.locator('#e2e-slider-button');
}

async function press(page, btn) {
	const box = await btn.boundingBox();
	const at = { x: box.x + box.width/2, y: box.y + box.height/2 };
	await page.mouse.move(at.x, at.y);
	await page.mouse.down();
	return { box, at };
}

test('a left-hand column button gets a horizontal bar, running left',
	async ({ page, hg }) => {
		hg.addObject('100000000001', ATTRS, 'A');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		const btn = await makeButton(page, 'glue-contextmenu-left');
		const { box, at } = await press(page, btn);
		await page.mouse.move(at.x - 30, at.y, { steps: 10 });

		const bar = page.locator('.glue-slider');
		await expect(bar).toBeVisible();
		expect(await bar.evaluate((e) => e.classList.contains('glue-slider-h'))).toBe(true);
		const barBox = await bar.boundingBox();
		expect(barBox.x + barBox.width, 'the bar overlaps its button')
			.toBeLessThanOrEqual(box.x);
		expect(barBox.width, 'a horizontal bar runs along the long axis')
			.toBeGreaterThan(barBox.height);

		// the handle marks where in the range the value is, so it sits inside
		// the bar rather than pinned at an end
		const handle = await page.locator('.glue-slider-handle').boundingBox();
		expect(handle.x).toBeGreaterThan(barBox.x);
		expect(handle.x).toBeLessThan(barBox.x + barBox.width);

		// right increases, left decreases: 30px of a 200px track over a range
		// of 100 is 15
		await page.mouse.up();
		expect(await page.evaluate(() => Math.round(window.__v))).toBe(35);
		await expect(page.locator('.glue-slider')).toHaveCount(0);
	});

test('a top-row button gets a vertical bar, running up', async ({ page, hg }) => {
	hg.addObject('100000000001', ATTRS, 'A');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	const btn = await makeButton(page, 'glue-contextmenu-top');
	const { box, at } = await press(page, btn);
	await page.mouse.move(at.x, at.y - 40, { steps: 10 });

	const bar = page.locator('.glue-slider');
	await expect(bar).toBeVisible();
	expect(await bar.evaluate((e) => e.classList.contains('glue-slider-v'))).toBe(true);
	const barBox = await bar.boundingBox();
	expect(barBox.y + barBox.height, 'the bar should sit above its button')
		.toBeLessThanOrEqual(box.y);
	expect(barBox.height, 'a vertical bar runs along the long axis')
		.toBeGreaterThan(barBox.width);

	// up increases
	await page.mouse.up();
	expect(await page.evaluate(() => Math.round(window.__v))).toBe(70);
});

test('a press that never moves opens nothing and changes nothing',
	async ({ page, hg }) => {
		// which is what lets a button be a slider AND still do something on a
		// plain click, should a caller want both
		hg.addObject('100000000001', ATTRS, 'A');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		const btn = await makeButton(page, 'glue-contextmenu-left');
		const { at } = await press(page, btn);
		await page.mouse.move(at.x + 1, at.y);
		await expect(page.locator('.glue-slider')).toHaveCount(0);
		await page.mouse.up();

		expect(await page.evaluate(() => window.__v)).toBe(50);
		expect(await page.evaluate(() => window.__moved),
			'a press with no movement reported itself as a drag').toBe(false);
	});

test('releasing the drag over the canvas does not deselect the object',
	async ({ page, hg }) => {
		// the click that follows mouseup lands on body, and a click on body is
		// how you deselect - so without swallowing it the selection, the menu
		// and the very button being dragged all disappear at the end of every
		// drag
		const a = hg.addObject('100000000001', ATTRS, 'A');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await page.locator(`[id="${a}"]`).click();
		await expect(page.locator(`[id="${a}"]`)).toHaveClass(/glue-selected/);

		const btn = await makeButton(page, 'glue-contextmenu-left', { left: 600, top: 500 });
		const { at } = await press(page, btn);
		// out over empty canvas, well away from the button
		await page.mouse.move(at.x - 120, at.y + 60, { steps: 10 });
		await page.mouse.up();

		await expect(page.locator(`[id="${a}"]`)).toHaveClass(/glue-selected/);
	});
