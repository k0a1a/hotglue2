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
	await page.locator('input[title="upload a file"]').first().waitFor({ state: 'attached' });
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
