// A video page background (2026-09-24): the 'set page background' popout
// gains a video button beside the picture one - the server tells the two
// apart by mime, each replaces the other, and the video honours the same
// position/scale/attachment keys. The render puts the <video> behind the
// objects (z-index 0), out of the pointer's way in the editor.

const path = require('path');
const { test, expect, waitForEditor, CONTENT } = require('./fixtures/hotglue.js');

const SAMPLE = path.join(__dirname, 'fixtures', 'sample-bg.mp4');

const sharedDir = (hg) => path.join(CONTENT, hg.pageName.split('.')[0], 'shared');

test('a video uploads as the page background and behaves like the picture',
	async ({ page, hg }) => {
		hg.addObject('100000000001', {
			type: 'text', module: 'text', 'object-left': '80px', 'object-top': '80px',
			'object-width': '200px', 'object-height': '40px', 'object-zindex': '100',
			'text-background-color': '#ff8844',
		}, 'hello');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);

		await page.keyboard.press('Alt+P');
		await page.getByTitle('set page background').click();
		const pop = page.locator('.glue-background-popover');
		await expect(pop).toBeVisible();

		// the video button is the picker, like the picture's
		const input = page.locator('input[title="set page background video"]').first();
		await expect(input).toBeAttached();
		await page.evaluate(() => {
			document.querySelector('input[title="set page background video"]').parentElement
				.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		});
		await input.setInputFiles(SAMPLE);

		// the layer appears in the editor: behind the objects, out of the
		// pointer's way, muted and looping
		const layer = page.locator('video.page-background-video');
		await expect(layer).toHaveCount(1, { timeout: 10000 });
		await expect(layer).toHaveAttribute('src', new RegExp('\\?'+hg.pageName+'\\.page'));
		expect(await layer.evaluate((v) => ({
			muted: v.muted, loop: v.loop, autoplay: v.autoplay,
			pe: getComputedStyle(v).pointerEvents, z: getComputedStyle(v).zIndex,
		}))).toEqual({ muted: true, loop: true, autoplay: true, pe: 'none', z: '0' });

		// stored on the page object, the image keys absent
		await expect.poll(() => hg.readObject('page').attrs['page-background-video-file'])
			.toBe('sample-bg.mp4');
		expect(hg.readObject('page').attrs['page-background-file']).toBeUndefined();

		// the tile toggle works for a video too: the wallpaper swap
		await expect(page.locator('.glue-background-tile')).not.toHaveClass(/glue-background-off/);

		// the scale row drives the video's width and stores the same key
		await pop.locator('.glue-popover-disclosure').click();
		const scale = pop.locator('.glue-background-scale .glue-popover-field');
		await scale.fill('150');
		await scale.dispatchEvent('change');
		await expect.poll(() => hg.readObject('page').attrs['page-background-size'])
			.toBe('150% auto');
		expect(await layer.evaluate((v) => v.style.width)).toBe('150%');

		// the published page plays it behind the content
		await page.goto(`/?${hg.pageName}`);
		await expect(page.locator('video.page-background-video')).toHaveCount(1);
		const viewLayer = page.locator('video.page-background-video');
		await expect.poll(() => viewLayer.evaluate((v) => v.paused)).toBe(false);
		expect(await viewLayer.evaluate((v) => getComputedStyle(v).pointerEvents)).toBe('auto');
		await expect(page.getByText('hello')).toBeVisible();

		// tiling: the video becomes the offscreen feeder and a canvas
		// paints its frames in a grid - stored as the picture's own key
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await page.keyboard.press('Alt+P');
		await page.getByTitle('set page background').click();
		await expect(pop).toBeVisible();
		await page.locator('.glue-background-tile').click();
		await expect(page.locator('canvas.page-background-video')).toHaveCount(1);
		await expect(page.locator('video.page-background-video-source')).toHaveCount(1);
		// the tiler actually paints the swapped-in canvas - the frame is
		// opaque pixels, not a blank layer (the swap must start the loop:
		// at load there was no canvas for the tiler to arm itself on)
		await expect.poll(() => page.locator('canvas.page-background-video').evaluate((c) => {
			const d = c.getContext('2d').getImageData(Math.min(40, c.width-1), Math.min(40, c.height-1), 1, 1).data;
			return d[3];
		})).toBeGreaterThan(0);
		await expect.poll(() => hg.readObject('page').attrs['page-background-repeat']).toBe('repeat');

		await page.goto(`/?${hg.pageName}`);
		await expect(page.locator('canvas.page-background-video')).toHaveCount(1);
		await expect(page.locator('video.page-background-video-source')).toHaveCount(1);
		await expect.poll(() =>
			page.locator('video.page-background-video-source').evaluate((v) => v.paused)).toBe(false);
		await expect(page.getByText('hello')).toBeVisible();

		// and the delete takes the layer, the keys and the file with it
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await page.keyboard.press('Alt+P');
		await page.getByTitle('set page background').click();
		await expect(pop).toBeVisible();
		await pop.locator('.glue-popover-disclosure').click();
		await pop.getByTitle('remove the background image').click();
		await expect.poll(() => hg.readObject('page').attrs['page-background-video-file'])
			.toBeUndefined();
		const fs = require('fs');
		const left = fs.existsSync(sharedDir(hg)) ? fs.readdirSync(sharedDir(hg)) : [];
		expect(left.filter((f) => f.endsWith('.mp4'))).toEqual([]);
	});
