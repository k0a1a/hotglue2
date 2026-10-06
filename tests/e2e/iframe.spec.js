// The iframe object's menu: one button, the scrollbar toggle, wearing the SVG
// set's background-scroll icon like the video toggles do. The button that
// changed the address an iframe shows is gone (danja's call, 2026-10-06).

const { test, expect, waitForEditor } = require('./fixtures/hotglue.js');

const IFRAME = {
	type: 'iframe', module: 'iframe',
	'object-left': '400px', 'object-top': '300px',
	'object-width': '320px', 'object-height': '240px', 'object-zindex': '101',
	'iframe-url': '//example.org/',
};

const byId = (page, id) => page.locator(`[id="${id}"]`);

test('the menu has the scrollbar toggle with its icon and no change-url button',
	async ({ page, hg }) => {
		const a = hg.addObject('100000000001', IFRAME, '');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		// the shield is what sits over the iframe while editing
		await byId(page, a).locator('.glue-iframe-shield').click();
		await page.waitForTimeout(400);		// the menu fades in

		await expect(page.getByTitle(/scrollbars are shown|toggle scrollbars/).first()).toBeVisible();
		const icon = await page.getByTitle(/scrollbars are shown|toggle scrollbars/).first()
			.evaluate((el) => el.style.getPropertyValue('--glue-icon'));
		expect(icon).toContain('background-scroll.svg');
		await expect(page.getByTitle('change webpage url')).toHaveCount(0);
	});

test('the toggle shows and hides the iframe\'s scrollbars and says which it is',
	async ({ page, hg }) => {
		// an iframe is made with its scrollbars hidden unless it is stored as
		// iframe-scroll:scroll (module_iframe.inc.php), so that is where it starts
		const a = hg.addObject('100000000001', IFRAME, '');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await byId(page, a).locator('.glue-iframe-shield').click();
		await page.waitForTimeout(400);

		const iframe = byId(page, a).locator(':scope > iframe');
		const btn = () => page.locator('.glue-btn-icon[title*="scrollbars"]').first();
		await expect(iframe).toHaveAttribute('scrolling', 'no');
		await expect(btn()).toHaveClass(/glue-menu-disabled/);
		await expect(btn()).toHaveAttribute('title', 'toggle scrollbars on and off');

		await btn().click();
		await expect(iframe).toHaveAttribute('scrolling', 'auto');
		await expect(btn()).toHaveClass(/glue-menu-enabled/);
		await expect(btn()).toHaveAttribute('title', 'scrollbars are shown - click to hide them');

		await btn().click();
		await expect(iframe).toHaveAttribute('scrolling', 'no');
		await expect(btn()).toHaveClass(/glue-menu-disabled/);
	});

test('the shield is the webvideo\'s: the upper part of the embed, shown on hover',
	async ({ page, hg }) => {
		const a = hg.addObject('100000000001', IFRAME, '');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);

		const shield = byId(page, a).locator(':scope > .glue-iframe-shield');
		await expect(shield).toHaveAttribute('title', 'click here to select/edit this embed');
		const geometry = () => page.evaluate((i) => {
			const o = document.getElementById(i).getBoundingClientRect();
			const s = document.querySelector('[id="' + i + '"] > .glue-iframe-shield');
			const r = s.getBoundingClientRect();
			return { top: Math.round(r.top - o.top), ratio: +(r.height / o.height).toFixed(2),
				wide: Math.round(r.width) === Math.round(o.width),
				opacity: getComputedStyle(s).opacity };
		}, a);

		// at rest it is there and invisible; over the object it shows
		await page.mouse.move(5, 5);
		expect(await geometry()).toEqual({ top: 0, ratio: 0.4, wide: true, opacity: '0' });
		const box = await byId(page, a).boundingBox();
		await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.2);
		await expect.poll(async () => (await geometry()).opacity).toBe('0.5');

		// and the webvideo's is styled by the same rule
		const same = await page.evaluate(() => {
			const rules = [];
			for (const sheet of document.styleSheets) {
				try {
					for (const r of sheet.cssRules) {
						if (r.selectorText && r.selectorText.includes('.glue-iframe-shield')
							&& r.selectorText.includes('.glue-webvideo-shield')) rules.push(r.selectorText);
					}
				} catch (e) { /* a sheet from another origin */ }
			}
			return rules.length;
		});
		expect(same, 'one rule for both shields').toBeGreaterThan(0);
	});
