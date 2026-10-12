// An image object saved by the old tiling button (image-background-repeat:
// repeat) is still drawn as a tile: the object's own background-image at its
// natural size, repeating - not one stretched copy of the picture in an img
// child. hotglue.me's own start page is made of these (bluegrid.png). The
// keys stay in the file through an editor save, and a resize of the object
// does not re-encode the tile.

const fs = require('fs');
const path = require('path');
const { test, expect, waitForEditor, CONTENT } = require('./fixtures/hotglue.js');

const SAMPLE_BYTES = fs.readFileSync(path.join(__dirname, 'fixtures', 'sample.png'));
const byId = (page, id) => page.locator(`[id="${id}"]`);

const ATTRS = (extra) => Object.assign({
	type: 'image', module: 'image',
	'image-file': 'sample.png', 'image-file-mime': 'image/png',
	'image-file-width': '16', 'image-file-height': '16',
	'object-left': '60px', 'object-top': '60px',
	'object-width': '320px', 'object-height': '200px', 'object-zindex': '100',
}, extra);

function seed(hg) {
	const dir = path.join(CONTENT, hg.pageName.split('.')[0], 'shared');
	fs.mkdirSync(dir, { recursive: true, mode: 0o777 });
	fs.writeFileSync(path.join(dir, 'sample.png'), SAMPLE_BYTES);
}

test('a tiled image object draws as a repeating background, on the page and in the editor',
	async ({ page, hg }) => {
		seed(hg);
		const id = hg.addObject('100000000001', ATTRS({ 'image-background-repeat': 'repeat' }));
		for (const url of [`/?${hg.pageName}`, hg.editUrl()]) {
			await page.goto(url);
			const obj = byId(page, id);
			await expect(obj).toBeVisible();
			expect(await obj.evaluate((o) => {
				const cs = getComputedStyle(o);
				return {
					img: o.querySelectorAll(':scope > img').length,
					repeat: cs.backgroundRepeat,
					image: /url\(/.test(cs.backgroundImage),
					size: cs.backgroundSize,
				};
			})).toEqual({ img: 0, repeat: 'repeat', image: true, size: 'auto' });
		}
	});

test('an untiled image object keeps the child img', async ({ page, hg }) => {
	seed(hg);
	const id = hg.addObject('100000000001', ATTRS({ 'image-background-repeat': 'no-repeat' }));
	await page.goto(`/?${hg.pageName}`);
	await expect(byId(page, id).locator(':scope > img')).toHaveCount(1);
	expect(await byId(page, id).evaluate((o) => getComputedStyle(o).backgroundImage)).toBe('none');
});

test('a position-only legacy image is drawn at its stored position', async ({ page, hg }) => {
	seed(hg);
	const id = hg.addObject('100000000001', ATTRS({ 'image-background-position': '10px 20px' }));
	await page.goto(`/?${hg.pageName}`);
	expect(await byId(page, id).evaluate((o) => {
		const cs = getComputedStyle(o);
		return [o.querySelectorAll(':scope > img').length, cs.backgroundPosition, cs.backgroundRepeat];
	})).toEqual([0, '10px 20px', 'no-repeat']);
});

test('saving from the editor keeps the legacy keys, and resizing does not re-encode the tile',
	async ({ page, hg }) => {
		seed(hg);
		const id = hg.addObject('100000000001', ATTRS({
			'image-background-repeat': 'repeat', 'image-alt': 'a blue grid',
		}));
		const calls = [];
		page.on('request', (r) => {
			if (r.method() === 'POST' && /image\.resize/.test(r.postData() || '')) calls.push(r.url());
		});
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		const obj = byId(page, id);
		await obj.click();
		// nudge it with the arrow keys: a save
		await page.keyboard.press('ArrowRight');
		await expect.poll(() => hg.readObject('100000000001').attrs['object-left']).toBe('61px');
		const attrs = hg.readObject('100000000001').attrs;
		expect(attrs['image-background-repeat']).toBe('repeat');
		expect(attrs['image-alt']).toBe('a blue grid');
		// the resize hook: no re-encode request for a tile
		await page.evaluate((id) => {
			const o = document.getElementById(id);
			$.glue.image.resize(o);
		}, id);
		await page.waitForTimeout(500);
		expect(calls).toEqual([]);
		// the control: the same call on an ordinary image object does ask for one
		// (otherwise "no request" above would only mean resizing is off here)
		await page.evaluate(() => {
			const o = document.createElement('div');
			o.className = 'object image';
			o.id = 'control-img';
			o.style.cssText = 'position:absolute;left:0;top:0;width:100px;height:100px';
			o.innerHTML = '<img src="">';
			document.body.appendChild(o);
			$.glue.image.resize(o);
		});
		await expect.poll(() => calls.length).toBeGreaterThan(0);
	});
