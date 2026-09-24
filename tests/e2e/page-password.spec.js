// Per-page password protection (SOW-page-password.md): the hash is a
// per-page flat-file property (bcrypt, on the page object), the gate is a
// PHP session flag per page, the prompt is styled hotglue html, and a
// protected page's assets - both the statically-served shared files
// (rewritten to the session-checked 'asset' proxy) and the php-served
// object resources (?name) - need the same session. The owner's editor
// auth passes every gate; anonymous visitors get the prompt.
//
// The fixture hash is a precomputed bcrypt of 'e2e-secret-pass'.

const fs = require('fs');
const path = require('path');
const { test, expect, waitForEditor, CONTENT } = require('./fixtures/hotglue.js');

const HASH = '$2y$12$wO8qXn0D4U796uB3d.6CyOAV682or2.uVqJNWlU.UOvqXDZufOXI6';
const PASS = 'e2e-secret-pass';

const byId = (page, hg, id) => page.locator(`[id="${hg.pageName}.${id}"]`);
const pageUrl = (hg) => `/?${hg.pageName}`;
const sharedDir = (hg) => path.join(CONTENT, hg.pageName.split('.')[0], 'shared');

const textObject = {
	type: 'text', module: 'text', 'object-left': '80px', 'object-top': '80px',
	'object-width': '200px', 'object-height': '40px', 'object-zindex': '100',
	'text-background-color': '#ff8844',
};

const prompt = (page) => page.locator('.glue-password');
const promptError = (page) => page.locator('.glue-password-error');

test('a protected page serves the prompt, not the content', async ({ page, hg }) => {
	hg.addObject('100000000001', textObject, 'the secret text');
	hg.addObject('page', { 'page-password': HASH });
	await page.goto(pageUrl(hg));

	await expect(prompt(page)).toBeVisible();
	await expect(page.locator('input[name="page_password"]')).toBeVisible();
	// nothing of the page leaked into the prompt
	await expect(page.getByText('the secret text')).toHaveCount(0);
});

test('a wrong password answers the generic message, and never the content',
	async ({ page, hg }) => {
		hg.addObject('100000000001', textObject, 'the secret text');
		hg.addObject('page', { 'page-password': HASH });
		await page.goto(pageUrl(hg));

		for (let i = 0; i < 2; i++) {
			await page.locator('input[name="page_password"]').fill('wrong');
			await page.locator('button[type="submit"]').click();
			await expect(promptError(page)).toBeVisible();
			await expect(page.getByText('the secret text')).toHaveCount(0);
		}
	});

test('the right password serves the content and the session holds', async ({ page, hg }) => {
	hg.addObject('100000000001', textObject, 'the secret text');
	hg.addObject('page', { 'page-password': HASH });
	await page.goto(pageUrl(hg));

	await page.locator('input[name="page_password"]').fill(PASS);
	await page.locator('button[type="submit"]').click();
	await expect(page.getByText('the secret text')).toBeVisible();

	// the per-page session flag survives a reload
	await page.reload();
	await expect(page.getByText('the secret text')).toBeVisible();
	await expect(prompt(page)).toHaveCount(0);
});

test('assets gate with the page: the proxy and the served resources',
	async ({ page, context, hg }) => {
		// a static shared asset (the video poster) and a php-served object
		// resource (the image) on the protected page
		const shared = sharedDir(hg);
		fs.mkdirSync(shared, { recursive: true });
		fs.copyFileSync(path.join(__dirname, 'fixtures', 'sample.png'), path.join(shared, 'poster.png'));
		fs.copyFileSync(path.join(__dirname, 'fixtures', 'sample.png'), path.join(shared, 'sample.png'));
		hg.addObject('100000000001', {
			type: 'video', module: 'video',
			'object-left': '80px', 'object-top': '80px',
			'object-width': '300px', 'object-height': '200px', 'object-zindex': '100',
			'video-file': 'sample.png', 'video-file-mime': 'image/png',
			'video-poster-file': 'poster.png',
		}, '');
		hg.addObject('100000000002', {
			type: 'image', module: 'image',
			'object-left': '80px', 'object-top': '300px',
			'object-width': '120px', 'object-height': '80px', 'object-zindex': '100',
			'image-file': 'sample.png', 'image-file-mime': 'image/png',
			'image-file-width': '120', 'image-file-height': '80',
		}, '');
		hg.addObject('page', { 'page-password': HASH });
		await page.goto(pageUrl(hg));

		// log in
		await page.locator('input[name="page_password"]').fill(PASS);
		await page.locator('button[type="submit"]').click();
		await expect(byId(page, hg, '100000000002')).toBeVisible();

		// the static poster went through the rewrite: the proxy url
		const posterSrc = await page.locator('.video.object video').getAttribute('poster');
		expect(posterSrc).toContain('?asset&p=');
		// and the image object is still php-served by name
		const imgSrc = await byId(page, hg, '100000000002').locator('img').getAttribute('src');
		expect(imgSrc).toContain('?');

		// a fresh context (no session) is denied both
		const stranger = await context.browser().newContext({ httpCredentials: undefined });
		const strangerPage = await stranger.newPage();
		const denyPoster = await strangerPage.request.get(new URL(posterSrc, page.url()).href);
		expect(denyPoster.status()).toBe(403);
		const denyImg = await strangerPage.request.get(new URL(imgSrc, page.url()).href);
		expect(denyImg.status()).toBe(403);
		await stranger.close();

		// the logged-in session gets both
		const allowPoster = await page.request.get(new URL(posterSrc, page.url()).href);
		expect(allowPoster.status()).toBe(200);
		const allowImg = await page.request.get(new URL(imgSrc, page.url()).href);
		expect(allowImg.status()).toBe(200);
	});

test('the options set and clear the password', async ({ page, hg }) => {
	hg.addObject('100000000001', textObject, 'the secret text');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);

	await page.keyboard.press('Alt+P');
	await page.getByTitle('page options: change title of the page, URL, make it a start page, or delete it').click();
	const pwField = page.locator('.glue-page-password');
	await expect(pwField).toBeVisible();

	// set
	await pwField.fill('abc123');
	await pwField.press('Enter');
	await expect.poll(() => hg.readObject('page').attrs['page-password'] ?? '').toMatch(/^\$2y\$/);

	// the panel flips to the protected state
	await expect(page.locator('.glue-page-password')).toHaveAttribute('placeholder', 'page is protected');

	// clear
	await page.locator('.glue-page-settings-popover .glue-popover-reset').click();
	await expect.poll(() => hg.readObject('page').attrs['page-password']).toBeUndefined();

	// and the published page is open again
	const stranger = await page.context().browser().newContext();
	const strangerPage = await stranger.newPage();
	await strangerPage.goto(pageUrl(hg));
	await expect(strangerPage.getByText('the secret text')).toBeVisible();
	await stranger.close();
});
