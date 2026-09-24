// The oEmbed media embed (SOW-oembed-media.md): a pasted URL resolves
// through the curated whitelist, the response is validated and cached in the
// page's shared directory, and the render reads the cache. The suite runs
// against the hermetic STUB provider (HG_STUB_OEMBED in server-router.php) -
// stub.example/watch/* resolves locally, /fail/* fails, /bad/* returns an
// invalid response - so no network is involved.

const fs = require('fs');
const path = require('path');
const { test, expect, waitForEditor, CONTENT } = require('./fixtures/hotglue.js');

const byId = (page, hg, id) => page.locator(`[id="${hg.pageName}.${id}"]`);
const pageUrl = (hg) => `/?${hg.pageName}`;
const sharedDir = (hg) => path.join(CONTENT, hg.pageName.split('.')[0], 'shared');

const webvideoObject = (left, top, z, extra = {}) => ({
	type: 'webvideo', module: 'webvideo',
	'object-left': left + 'px', 'object-top': top + 'px',
	'object-width': '400px', 'object-height': '300px',
	'object-zindex': String(z),
	...extra,
});

test('pasting a URL resolves, caches and embeds it', async ({ page, hg }) => {
	hg.addObject('100000000001', {
		type: 'text', module: 'text', 'object-left': '50px', 'object-top': '50px',
		'object-width': '100px', 'object-height': '50px', 'object-zindex': '100',
		'text-background-color': 'transparent',
	}, 'seed');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);

	// the embed button lives in the new menu, and the URL goes through a
	// prompt() - the resolve happens server-side, then the fresh object
	// lands like an upload
	page.on('dialog', (d) => d.accept('https://stub.example/watch/abc123'));
	await page.keyboard.press('Alt+o');
	await page.locator('input[title="upload an asset: an image, video or sound file"]').first().waitFor({ state: 'attached' });
	await page.getByTitle('embed a video or audio track').click();
	await expect(page.locator('.webvideo.object')).toHaveCount(1, { timeout: 10000 });

	// the stored pair of facts and the cache file in shared
	const id = hg.ids().find((f) => f !== '100000000001' && f !== 'page');
	const attrs = hg.readObject(id).attrs;
	expect(attrs['webvideo-url']).toBe('https://stub.example/watch/abc123');
	expect(attrs['webvideo-provider']).toBe('stub');
	expect(attrs['webvideo-cache-file']).toMatch(/^webvideo-[0-9a-f]+\.html$/);
	expect(fs.readdirSync(sharedDir(hg))).toContain(attrs['webvideo-cache-file']);

	// the editor shows the sandboxed iframe
	const iframe = page.locator('.webvideo.object iframe');
	await expect(iframe).toHaveAttribute('src', 'https://embed.stub.example/abc123');
	await expect(iframe).toHaveAttribute('sandbox', /allow-scripts/);
	await expect(iframe).toHaveAttribute('referrerpolicy', /cross-origin/);

	// and the published page renders it from the cache, no network
	await page.goto(pageUrl(hg));
	await expect(page.locator('.webvideo.object iframe'))
		.toHaveAttribute('src', 'https://embed.stub.example/abc123');
});

test('the properties panel offers padding and the iframe obeys it', async ({ page, hg }) => {
	hg.addObject('100000000001', {
		type: 'text', module: 'text', 'object-left': '50px', 'object-top': '50px',
		'object-width': '100px', 'object-height': '50px', 'object-zindex': '100',
		'text-background-color': 'transparent',
	}, 'seed');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);

	page.on('dialog', (d) => d.accept('https://stub.example/watch/abc123'));
	await page.keyboard.press('Alt+o');
	await page.locator('input[title="upload an asset: an image, video or sound file"]').first().waitFor({ state: 'attached' });
	await page.getByTitle('embed a video or audio track').click();
	await expect(page.locator('.webvideo.object')).toHaveCount(1, { timeout: 10000 });

	// select the embed - the shield covers the upper part, and a click
	// anywhere else would vanish into the cross-origin iframe - and open
	// the properties panel
	const obj = page.locator('.webvideo.object');
	const bb = await obj.boundingBox();
	await page.mouse.click(bb.x + bb.width / 2, bb.y + bb.height * 0.2);
	await page.getByTitle('object properties: background color/image, transparency, padding, flip, link').click();
	const panel = page.locator('.glue-popover.glue-properties-popover');
	await expect(panel).toBeVisible();

	// the padding section lives under the panel's one fold
	await panel.locator('.glue-popover-disclosure').click();
	await expect(panel.locator('.glue-popover-advanced')).toBeVisible();
	const row = panel.locator('.glue-padding-row');
	await row.locator('.glue-popover-field').fill('20');
	await row.locator('.glue-popover-field').dispatchEvent('change');

	// the uniform value stores as the x/y pair, the generic object format
	const id = hg.ids().find((f) => f !== '100000000001' && f !== 'page');
	await expect.poll(() => hg.readObject(id).attrs['object-padding-x'],
		{ timeout: 5000 }).toBe('20px');

	// and the published page insets the iframe by the padding - with the
	// old absolutely-positioned iframe the embed would overflow the padded
	// box instead (flush with the object, full width)
	await page.goto(pageUrl(hg));
	const boxes = await page.evaluate(() => {
		const o = document.querySelector('.webvideo.object');
		const i = o.querySelector('iframe');
		const ob = o.getBoundingClientRect();
		const ib = i.getBoundingClientRect();
		return { ox: ob.x, ow: ob.width, oh: ob.height, ix: ib.x, iw: ib.width, ih: ib.height };
	});
	expect(boxes.ix - boxes.ox).toBeCloseTo(20, 0);
	expect(boxes.ow - boxes.iw).toBeCloseTo(40, 0);
	expect(boxes.oh - boxes.ih).toBeCloseTo(40, 0);
});

test('a provider that fails renders the fallback link, not a broken page',
	async ({ page, hg }) => {
		hg.addObject('100000000001', webvideoObject(100, 100, 100,
			{ 'webvideo-url': 'https://stub.example/fail/x' }));
		await page.goto(pageUrl(hg));
		// the re-resolve fails, the view falls back to the url as a link
		const a = page.locator('.webvideo.object a');
		await expect(a).toHaveAttribute('href', 'https://stub.example/fail/x');
		expect(await page.locator('.webvideo.object iframe').count()).toBe(0);
		// and nothing was cached
		expect(fs.existsSync(sharedDir(hg)) ? fs.readdirSync(sharedDir(hg)) : []).toEqual([]);
	});

test('an invalid provider response is rejected, never stored', async ({ page, hg }) => {
	hg.addObject('100000000001', webvideoObject(100, 100, 100,
		{ 'webvideo-url': 'https://stub.example/bad/x' }));
	await page.goto(pageUrl(hg));
	// the response carried a script and a wrong host - rejected, fallback
	await expect(page.locator('.webvideo.object a'))
		.toHaveAttribute('href', 'https://stub.example/bad/x');
	expect(await page.locator('.webvideo.object iframe').count()).toBe(0);
	expect(fs.existsSync(sharedDir(hg)) ? fs.readdirSync(sharedDir(hg)) : []).toEqual([]);
});

test('a legacy youtube object reconstructs its canonical url', async ({ page, hg }) => {
	hg.addObject('100000000001', webvideoObject(100, 100, 100,
		{ 'webvideo-provider': 'youtube', 'webvideo-id': 'abc123' }));
	await page.goto(pageUrl(hg));
	// offline the real endpoint is unreachable, so the fallback shows the
	// RECONSTRUCTED url - that reconstruction is the migration (SOW
	// Decision 4); on a networked host the same path re-resolves
	const a = page.locator('.webvideo.object a');
	await expect(a).toHaveAttribute('href', 'https://www.youtube.com/watch?v=abc123');
});

test('a PeerTube watch url transforms to the instance embed directly',
	async ({ page, hg }) => {
		// tier 2: no network - the embed url derives from the watch url, so
		// the re-resolve completes offline and the view renders the iframe
		const uuid = '3e8b2f4a-9c6d-4a1e-b7f0-2d5c8a1e6b3f';
		hg.addObject('100000000001', webvideoObject(100, 100, 100,
			{ 'webvideo-url': 'https://tube.example/w/'+uuid }));
		await page.goto(pageUrl(hg));
		await expect(page.locator('.webvideo.object iframe'))
			.toHaveAttribute('src', 'https://tube.example/videos/embed/'+uuid);
		// the cached embed landed in shared, provider recorded
		const attrs = hg.readObject('100000000001').attrs;
		expect(attrs['webvideo-provider']).toBe('peertube');
		expect(attrs['webvideo-cache-file']).toMatch(/^webvideo-[0-9a-f]+\.html$/);
		expect(fs.readdirSync(sharedDir(hg))).toContain(attrs['webvideo-cache-file']);
	});

test('a pasted Bandcamp embed url wraps directly, no fetch', async ({ page, hg }) => {
	// the share dialog's own iframe url: the player url IS the embed, so
	// the resolve wraps and validates it without touching the network
	const embedUrl = 'https://bandcamp.com/EmbeddedPlayer/v=2/album=3352330868/size=large/tracklist=false/artwork=small/';
	hg.addObject('100000000001', webvideoObject(100, 100, 100,
		{ 'webvideo-url': embedUrl }));
	await page.goto(pageUrl(hg));
	await expect(page.locator('.webvideo.object iframe')).toHaveAttribute('src', embedUrl);
	const attrs = hg.readObject('100000000001').attrs;
	expect(attrs['webvideo-provider']).toBe('bandcamp');
	expect(fs.readdirSync(sharedDir(hg))).toContain(attrs['webvideo-cache-file']);
});

test('pasting the whole <iframe> embed code extracts the src', async ({ page, hg }) => {
	// the share dialog's full snippet - iframe plus the fallback link -
	// resolves to the iframe's own src (danja's call, 2026-09-23)
	const snippet = '<iframe style="border: 0; width: 100%; height: 42px;" ' +
		'src="https://bandcamp.com/EmbeddedPlayer/album=2156047848/size=small/' +
		'bgcol=ffffff/linkcol=0687f5/track=272996041/transparent=true/" seamless>' +
		'<a href="https://caskaudio.bandcamp.com/album/tubular-bells-sample-pack-samples">' +
		'Tubular Bells Sample Pack [SAMPLES] by CASKaudio</a></iframe>';
	hg.addObject('100000000001', {
		type: 'text', module: 'text', 'object-left': '50px', 'object-top': '50px',
		'object-width': '100px', 'object-height': '50px', 'object-zindex': '100',
		'text-background-color': 'transparent',
	}, 'seed');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);

	page.on('dialog', (d) => d.accept(snippet));
	await page.keyboard.press('Alt+o');
	await page.locator('input[title="upload an asset: an image, video or sound file"]').first().waitFor({ state: 'attached' });
	await page.getByTitle('embed a video or audio track').click();
	await expect(page.locator('.webvideo.object')).toHaveCount(1, { timeout: 10000 });
	await expect(page.locator('.webvideo.object iframe')).toHaveAttribute('src',
		'https://bandcamp.com/EmbeddedPlayer/album=2156047848/size=small/bgcol=ffffff/linkcol=0687f5/track=272996041/transparent=true/');
	// the stored url is the clean src, not the whole snippet
	const id = hg.ids().find((f) => f !== '100000000001' && f !== 'page');
	expect(hg.readObject(id).attrs['webvideo-url']).toContain('bandcamp.com/EmbeddedPlayer/album=2156047848');
	expect(hg.readObject(id).attrs['webvideo-url']).not.toContain('<iframe');
});

test('a non-whitelisted url fails soft in the editor', async ({ page, hg }) => {
	hg.addObject('100000000001', {
		type: 'text', module: 'text', 'object-left': '50px', 'object-top': '50px',
		'object-width': '100px', 'object-height': '50px', 'object-zindex': '100',
		'text-background-color': 'transparent',
	}, 'seed');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);

	let message = null;
	page.on('dialog', (d) => {
		if (d.type() == 'prompt') {
			d.accept('https://example.com/some/page');
		} else {
			message = d.message();
			d.dismiss().catch(() => {});
		}
	});
	await page.keyboard.press('Alt+o');
	await page.getByTitle('embed a video or audio track').click();
	await expect.poll(() => message).toBeTruthy();
	expect(message).toContain("this service isn't supported yet");
	expect(await page.locator('.webvideo.object').count()).toBe(0);
});
