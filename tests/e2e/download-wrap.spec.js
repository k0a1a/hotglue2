// The download wrap (SOW-download-object.md): a download object (the 50x50
// mime box) wraps a text or image object BY REFERENCE - the target's own
// render emits <a href download> around its markup in view mode only, so the
// wrapped object edits normally in the editor and the download is inert
// there (the link pattern).
//
// Both halves of the association are asserted: the stored pair of attributes
// (download-wrap on the target, download-wrap-target on the download) and
// the rendered anchor on the published page. The two attach paths - the
// box's pick mode and the target menu's file picker - plus detach, the
// copy-paste pair travel, delete cleanup in both directions, the private
// gate, and the box's fallback label.

const fs = require('fs');
const path = require('path');
const { test, expect, waitForEditor, serializeObject, parseObject, CONTENT } = require('./fixtures/hotglue.js');

const SAMPLE = path.join(__dirname, 'fixtures', 'sample.pdf');
const SAMPLE_BYTES = fs.readFileSync(SAMPLE);

// the DOM id is the FULL object name, not the file's basename
const byId = (page, hg, id) => page.locator(`[id="${hg.pageName}.${id}"]`);
// the published page, as opposed to the editor's ?page/edit
const pageUrl = (hg) => `/?${hg.pageName}`;
const pageDir = (pageName) => path.join(CONTENT, pageName.split('.')[0]);
const revDir = (pageName) => path.join(CONTENT, pageName.split('.').join('/'));
const sharedDir = (pageName) => path.join(pageDir(pageName), 'shared');

const textObject = (left, top, z) => ({
	type: 'text', module: 'text',
	'object-left': left + 'px', 'object-top': top + 'px',
	'object-width': '160px', 'object-height': '60px',
	'object-zindex': String(z), 'text-background-color': 'transparent',
});

const downloadObject = (left, top, z) => ({
	type: 'download', module: 'download',
	'download-file': 'sample.pdf', 'download-file-mime': 'application/pdf',
	'download-file-name': 'sample.pdf',
	'object-left': left + 'px', 'object-top': top + 'px',
	'object-zindex': String(z),
});

function seedAsset(pageName, name, bytes) {
	const dir = sharedDir(pageName);
	fs.mkdirSync(dir, { recursive: true, mode: 0o777 });
	fs.writeFileSync(path.join(dir, name), bytes);
}

function newId(hg, before) {
	const fresh = hg.ids().filter((f) => !before.includes(f) && f !== 'page');
	expect(fresh, 'exactly one new object file was expected').toHaveLength(1);
	return fresh[0];
}

function makePage(pageName) {
	const dir = revDir(pageName);
	return {
		pageName,
		editUrl: () => `/?${pageName}/edit`,
		url: () => `/?${pageName}`,
		create: () => {
			fs.mkdirSync(dir, { recursive: true, mode: 0o777 });
			fs.mkdirSync(sharedDir(pageName), { recursive: true, mode: 0o777 });
			return pageName;
		},
		addObject: (id, attrs, content = '') => {
			fs.writeFileSync(path.join(dir, id), serializeObject(attrs, content));
			return `${pageName}.${id}`;
		},
		readObject: (id) => {
			const file = path.join(dir, id);
			if (!fs.existsSync(file)) {
				return null;
			}
			return parseObject(fs.readFileSync(file, 'utf8'));
		},
		ids: () => (fs.existsSync(dir) ? fs.readdirSync(dir).sort() : []),
		destroy: () => fs.rmSync(pageDir(pageName), {
			recursive: true, force: true, maxRetries: 10, retryDelay: 50,
		}),
	};
}

// the target's menu button, whose state flips between attach and detach
const menuBtn = (page) => page.locator('#glue-contextmenu-download-wrap');

// click a text/image object and wait for its menu (one object selected)
async function openMenu(page, hg, id) {
	await byId(page, hg, id).click();
	await expect(page.locator('#glue-contextmenu-download-wrap')).toBeVisible();
	await page.waitForTimeout(300);
}

// Drag from a point by a delta. Moveable ignores the first 10px
// (js/edit.js:986), so the move is stepped to get well past that and to emit
// several drag events rather than one jump. (Same helper as
// group-drag.spec.js.)
async function drag(page, from, dx, dy) {
	await page.mouse.move(from[0], from[1]);
	await page.mouse.down();
	for (let i = 1; i <= 6; i++) {
		await page.mouse.move(from[0] + (dx * i) / 6, from[1] + (dy * i) / 6);
	}
	await page.mouse.up();
}

test('an uploaded file renders as the 50x50 mime box and downloads in view',
	async ({ page, hg }) => {
		hg.addObject('100000000001', textObject(50, 50, 100), 'seed');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);

		await page.keyboard.press('Alt+o');
		const input = page.locator('input[title="upload a file"]').first();
		await expect(input).toBeAttached();
		await page.evaluate(() => {
			document.querySelector('input[title="upload a file"]').parentElement
				.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		});
		await input.setInputFiles(SAMPLE);
		await expect(page.locator('.download.object')).toHaveCount(1, { timeout: 10000 });

		// the 50x50 box, the type inside
		const box = await page.locator('.download.object').boundingBox();
		expect(Math.round(box.width)).toBe(50);
		expect(Math.round(box.height)).toBe(50);
		await expect(page.locator('.download-mime')).toHaveText('pdf');

		// the stored object
		const id = newId(hg, ['100000000001', 'page']);
		const attrs = hg.readObject(id).attrs;
		expect(attrs['download-file']).toBe('sample.pdf');
		expect(attrs['download-file-mime']).toBe('application/pdf');
		expect(attrs['download-file-name']).toBe('sample.pdf');
		expect(fs.readdirSync(sharedDir(hg.pageName))).toContain('sample.pdf');

		// downloads are public by default (danja's call, 2026-09-23) - the
		// published page wraps the box in the anchor and the server hands
		// the bytes out as an attachment
		await page.goto(pageUrl(hg));
		// the anchor is AROUND the object div, not inside it
		const a = page.locator('a').filter({ has: page.locator('.object') });
		await expect(a).toHaveAttribute('download', 'sample.pdf');
		expect(await a.getAttribute('href')).toContain('download=1');
		const resp = await page.request.get(new URL(await a.getAttribute('href'), page.url()).href);
		expect(resp.status()).toBe(200);
		expect(resp.headers()['content-disposition']).toContain('attachment');
		expect(await resp.body()).toEqual(SAMPLE_BYTES);
	});

test('attaching from the target menu writes the pair and wraps only in view',
	async ({ page, hg }) => {
		const target = hg.addObject('100000000001', textObject(50, 50, 100), 'hello world');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);

		await openMenu(page, hg, '100000000001');
		await expect(menuBtn(page)).toHaveAttribute('title', 'attach a file to download');
		const chooser = page.waitForEvent('filechooser');
		await menuBtn(page).click();
		await (await chooser).setFiles(SAMPLE);
		// the new box arrives hidden - wait for it before reading the disk
		await expect(page.locator('.download.object')).toHaveCount(1, { timeout: 10000 });

		// the pair lands on disk
		const dl = newId(hg, ['100000000001', 'page']);
		await expect.poll(() => hg.readObject(dl).attrs['download-wrap-target'])
			.toBe(hg.pageName + '.100000000001');
		await expect.poll(() => hg.readObject('100000000001').attrs['download-wrap'])
			.toBe(hg.pageName + '.' + dl);
		expect(fs.readdirSync(sharedDir(hg.pageName))).toContain('sample.pdf');

		// the box is on screen but hidden
		await expect(byId(page, hg, dl)).toBeHidden();
		// the editor renders the target UNwrapped - no <a> ancestor
		expect(await page.locator('a').filter({ has: byId(page, hg, '100000000001') }).count())
			.toBe(0);
		// no dashed indicator on the target (danja's call, 2026-09-22) - the
		// menus carry the association; the hover title stays
		await expect(byId(page, hg, '100000000001')).not.toHaveClass(/glue-download-wrap/);

		// the wrap renders in view - downloads are public by default
		// (danja's call, 2026-09-23)
		await page.goto(pageUrl(hg));
		const a = page.locator('a').filter({ has: byId(page, hg, '100000000001') });
		await expect(a).toHaveAttribute('download', 'sample.pdf');
		expect(await a.getAttribute('href')).toContain(dl);
	});

test('a wrapped text object edits normally, and the wrap survives the save',
	async ({ page, hg }) => {
		const dl = hg.addObject('100000000002', { ...downloadObject(300, 50, 100),
			'download-wrap-target': hg.pageName + '.100000000001' });
		hg.addObject('100000000001', { ...textObject(50, 50, 100),
			'download-wrap': hg.pageName + '.100000000002' }, 'hello world');
		seedAsset(hg.pageName, 'sample.pdf', SAMPLE_BYTES);
		await page.goto(hg.editUrl());
		await waitForEditor(page, 2);

		// the wrapped box is off-screen (it must exist for undo/detach to
		// reach it); the text is there and editable
		await expect(byId(page, hg, '100000000002')).toBeHidden();
		await byId(page, hg, '100000000001').click();
		await byId(page, hg, '100000000001').click();
		await expect.poll(() => page.evaluate((i) =>
			document.querySelector(`[id="${i}"] > .glue-text-render`).isContentEditable,
			hg.pageName + '.100000000001')).toBe(true);
		// type into it
		await page.keyboard.press('End');
		await page.keyboard.type('!');
		await page.keyboard.press('Escape');
		await expect.poll(() => hg.readObject('100000000001').content)
			.toBe('hello world!');
		// the wrap attribute survived the save round-trip
		expect(hg.readObject('100000000001').attrs['download-wrap'])
			.toBe(hg.pageName + '.100000000002');
	});

test('the box\'s menu: attach first, no overflow, no rotation handle, and it wraps',
	async ({ page, hg }) => {
		hg.addObject('100000000001', textObject(50, 50, 100), 'hello');
		hg.addObject('100000000002', downloadObject(300, 50, 100));
		seedAsset(hg.pageName, 'sample.pdf', SAMPLE_BYTES);
		await page.goto(hg.editUrl());
		await waitForEditor(page, 2);

		// select the target, then the box: the box's click collapses the
		// selection and opens its menu, and the remembered target rides
		// along (danja's call, 2026-09-22)
		await byId(page, hg, '100000000001').click();
		await byId(page, hg, '100000000002').click();
		await expect(page.locator('#glue-contextmenu-download-attach')).toBeVisible();

		// the upper bar's FIRST item is the attach icon, and the items the
		// box must not carry are absent
		const ids = await page.evaluate(() =>
			Array.from(document.querySelectorAll('[id^="glue-contextmenu-"]'))
				.filter((el) => el.style.visibility !== 'hidden').map((el) => el.id));
		expect(ids[0]).toBe('glue-contextmenu-download-attach');
		expect(ids).not.toContain('glue-contextmenu-object-overflow');

		// no rotation handle on the selected box
		await expect(page.locator('.moveable-rotation-control:visible')).toHaveCount(0);

		// the menu attach wraps the remembered target
		await page.locator('#glue-contextmenu-download-attach').click();
		await expect.poll(() => hg.readObject('100000000001').attrs['download-wrap'])
			.toBe(hg.pageName + '.100000000002');
		await expect.poll(() => hg.readObject('100000000002').attrs['download-wrap-target'])
			.toBe(hg.pageName + '.100000000001');
		await expect(byId(page, hg, '100000000002')).toBeHidden();
	});

test('a download selected together with its target shows the menu and attaches',
	async ({ page, hg }) => {
		hg.addObject('100000000001', textObject(50, 50, 100), 'hello');
		hg.addObject('100000000002', downloadObject(300, 50, 100));
		seedAsset(hg.pageName, 'sample.pdf', SAMPLE_BYTES);
		await page.goto(hg.editUrl());
		await waitForEditor(page, 2);

		// multi-select: the text first, the box second - the editor hides
		// every menu on a multi-select, the download's own shows instead,
		// and it is JUST the attach icon
		await byId(page, hg, '100000000001').click();
		await byId(page, hg, '100000000002').click({ modifiers: ['Shift'] });
		await expect(page.locator('#glue-contextmenu-download-attach')).toBeVisible();
		const ids = await page.evaluate(() =>
			Array.from(document.querySelectorAll('[id^="glue-contextmenu-"]'))
				.filter((el) => el.style.visibility !== 'hidden').map((el) => el.id));
		expect(ids).toEqual(['glue-contextmenu-download-attach']);

		// the icon sits at the corner facing the target: the text here is
		// left of (and a hair below) the box, so the icon touches the box's
		// bottom-left corner
		const box = await byId(page, hg, '100000000002').boundingBox();
		const icon = await page.locator('#glue-contextmenu-download-attach').boundingBox();
		expect(icon.x + icon.width).toBeCloseTo(box.x, 0);
		expect(icon.y).toBeCloseTo(box.y + box.height, 0);

		// the attach reads the selection itself - no remembered target
		await page.locator('#glue-contextmenu-download-attach').click();
		await expect.poll(() => hg.readObject('100000000001').attrs['download-wrap'])
			.toBe(hg.pageName + '.100000000002');
		await expect.poll(() => hg.readObject('100000000002').attrs['download-wrap-target'])
			.toBe(hg.pageName + '.100000000001');
		await expect(byId(page, hg, '100000000002')).toBeHidden();
	});

test('the attach icon points at the target: the corner facing it, whichever way it lies',
	async ({ page, hg }) => {
		// the user's layout: the box sits up-left of the text below it, so
		// the icon lands on the box's bottom-right corner
		hg.addObject('100000000001', downloadObject(50, 50, 100));
		hg.addObject('100000000002', textObject(300, 200, 100), 'hello');
		seedAsset(hg.pageName, 'sample.pdf', SAMPLE_BYTES);
		await page.goto(hg.editUrl());
		await waitForEditor(page, 2);

		await byId(page, hg, '100000000001').click();
		await byId(page, hg, '100000000002').click({ modifiers: ['Shift'] });
		await expect(page.locator('#glue-contextmenu-download-attach')).toBeVisible();

		const box = await byId(page, hg, '100000000001').boundingBox();
		const icon = await page.locator('#glue-contextmenu-download-attach').boundingBox();
		expect(icon.x).toBeCloseTo(box.x + box.width, 0);
		expect(icon.y).toBeCloseTo(box.y + box.height, 0);
	});

test('detach clears the pair and the box returns at its position',
	async ({ page, hg }) => {
	hg.addObject('100000000001', { ...textObject(50, 50, 100),
		'download-wrap': hg.pageName + '.100000000002' }, 'hello');
	hg.addObject('100000000002', { ...downloadObject(300, 50, 100),
		'download-wrap-target': hg.pageName + '.100000000001' });
	seedAsset(hg.pageName, 'sample.pdf', SAMPLE_BYTES);
	await page.goto(hg.editUrl());
	await waitForEditor(page, 2);

	await openMenu(page, hg, '100000000001');
	await expect(menuBtn(page)).toHaveAttribute('title', 'detach the download');
	await menuBtn(page).click();
	await expect.poll(() => hg.readObject('100000000001').attrs['download-wrap'])
		.toBe(undefined);
	await expect.poll(() => hg.readObject('100000000002').attrs['download-wrap-target'])
		.toBe(undefined);
	// the box is back, at its stored position
	await expect(byId(page, hg, '100000000002')).toBeVisible();
	const box = await byId(page, hg, '100000000002').boundingBox();
	expect(Math.round(box.x)).toBeGreaterThanOrEqual(295);
	expect(Math.round(box.y)).toBeGreaterThanOrEqual(45);

	// and the returned box can be moved: it must be re-registered with
	// Moveable, or the fresh element stays undraggable until a reload
	// (the registration guard is keyed by id - see download-edit.js
	// download_wrap_detach)
	await page.evaluate(() => $.glue.contextmenu.hide());
	await drag(page, [box.x + box.width / 2, box.y + box.height / 2], 100, 40);
	await expect.poll(() => hg.readObject('100000000002').attrs['object-left']).toBe('400px');
	await expect.poll(() => hg.readObject('100000000002').attrs['object-top']).toBe('90px');
	const moved = await byId(page, hg, '100000000002').boundingBox();
	expect(Math.round(moved.x)).toBeGreaterThanOrEqual(395);
	expect(Math.round(moved.y)).toBeGreaterThanOrEqual(85);
});

test('dragging a download raises no server-communication dialog',
	async ({ page, hg }) => {
		hg.addObject('100000000001', downloadObject(300, 50, 100));
		seedAsset(hg.pageName, 'sample.pdf', SAMPLE_BYTES);
		let dialog = null;
		page.on('dialog', (d) => {
			dialog = d.message();
			d.dismiss().catch(() => {});
		});
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);

		// the drag's first frame shows the box's menu and the movestart
		// hides it again in the same gesture - an Alpine item's sync
		// round-trip landing while the tear-down runs used to throw
		// (firefox reported "can't convert undefined to object" into the
		// glue-gun dialog)
		const box = await byId(page, hg, '100000000001').boundingBox();
		await drag(page, [box.x + box.width / 2, box.y + box.height / 2], 100, 40);
		await expect.poll(() => hg.readObject('100000000001').attrs['object-left']).toBe('400px');
		expect(dialog).toBeNull();
	});

test('copy-paste carries the wrap pair and its file', async ({ page, hg }) => {
	const pageB = makePage('e2e-wrap-b.default');
	pageB.create();
	try {
		const dl = hg.addObject('100000000002', { ...downloadObject(300, 50, 100),
			'download-wrap-target': hg.pageName + '.100000000001' });
		hg.addObject('100000000001', { ...textObject(50, 50, 100),
			'download-wrap': hg.pageName + '.100000000002' }, 'hello');
		seedAsset(hg.pageName, 'sample.pdf', SAMPLE_BYTES);
		await page.goto(hg.editUrl());
		await waitForEditor(page, 2);

		await byId(page, hg, '100000000001').click();
		await page.keyboard.press('Control+c');
		// the clipboard round-trips through the server, so wait for it to land
		await page.waitForFunction(() => {
			try {
				return window.localStorage.getItem('glue.object-clipboard') !== null;
			} catch (e) {
				return false;
			}
		});
		await page.goto(pageB.editUrl());
		await waitForEditor(page, 0);
		await page.keyboard.press('Control+v');
		// the pair pastes as two FRESH objects - the ids are new
		await expect.poll(() => pageB.ids().length).toBe(2);
		const fresh = pageB.ids();
		const targetId = fresh.find((f) => pageB.readObject(f).attrs['type'] === 'text');
		const dlId = fresh.find((f) => pageB.readObject(f).attrs['type'] === 'download');
		expect(targetId, 'the pasted text is missing').toBeTruthy();
		expect(dlId, 'the pasted download is missing').toBeTruthy();
		expect(pageB.readObject(targetId).attrs['download-wrap'])
			.toBe(pageB.pageName + '.' + dlId);
		expect(pageB.readObject(dlId).attrs['download-wrap-target'])
			.toBe(pageB.pageName + '.' + targetId);
		expect(pageB.readObject(dlId).attrs['download-file']).toBe('sample.pdf');
		expect(fs.readdirSync(sharedDir(pageB.pageName))).toContain('sample.pdf');

		// and the pasted page renders the wrap
		await page.goto(pageB.url());
		const a = page.locator('a').filter({
			has: page.locator(`[id="${pageB.pageName}.${targetId}"]`) });
		await expect(a).toHaveAttribute('download', 'sample.pdf');
	} finally {
		pageB.destroy();
	}
});

test('deleting the wrapped download unwraps the target', async ({ page, hg }) => {
	hg.addObject('100000000001', { ...textObject(50, 50, 100),
		'download-wrap': hg.pageName + '.100000000002' }, 'hello');
	hg.addObject('100000000002', { ...downloadObject(300, 50, 100),
		'download-wrap-target': hg.pageName + '.100000000001' });
	seedAsset(hg.pageName, 'sample.pdf', SAMPLE_BYTES);
	await page.goto(hg.editUrl());
	await waitForEditor(page, 2);

	// the wrapped box cannot be selected in the editor, so the delete goes
	// through the API - the server-side cleanup is the same one a page
	// deletion exercises
	await page.evaluate((n) => fetch($.glue.base_url + 'json.php', {
		method: 'POST',
		body: new URLSearchParams([
			['method', JSON.stringify('glue.delete_object')],
			['name', JSON.stringify(n)],
		]),
	}), hg.pageName + '.100000000002');
	await expect.poll(() => hg.readObject('100000000001').attrs['download-wrap'])
		.toBe(undefined);
	// the shared dir itself goes with the last file
	expect(fs.existsSync(sharedDir(hg.pageName)) ?
		fs.readdirSync(sharedDir(hg.pageName)) : []).not.toContain('sample.pdf');
});

test('deleting the wrapped target un-hides the box', async ({ page, hg }) => {
	hg.addObject('100000000001', { ...textObject(50, 50, 100),
		'download-wrap': hg.pageName + '.100000000002' }, 'hello');
	hg.addObject('100000000002', { ...downloadObject(300, 50, 100),
		'download-wrap-target': hg.pageName + '.100000000001' });
	seedAsset(hg.pageName, 'sample.pdf', SAMPLE_BYTES);
	await page.goto(hg.editUrl());
	await waitForEditor(page, 2);

	await byId(page, hg, '100000000001').click();
	await page.keyboard.press('Delete');
	await expect.poll(() => hg.readObject('100000000002').attrs['download-wrap-target'])
		.toBe(undefined);
	// the box reappears after a reload (the immediate re-show is a noted v1
	// gap)
	await page.reload();
	await waitForEditor(page, 1);
	await expect(byId(page, hg, '100000000002')).toBeVisible();
});

test('a wrapped pair renders in view with no public attribute needed', async ({ page, hg }) => {
	// downloads are public by default (danja's call, 2026-09-23) - no
	// download-public attribute is written, and the anchor still renders
	hg.addObject('100000000001', { ...textObject(50, 50, 100),
		'download-wrap': hg.pageName + '.100000000002' }, 'hello');
	hg.addObject('100000000002', { ...downloadObject(300, 50, 100),
		'download-wrap-target': hg.pageName + '.100000000001' });
	seedAsset(hg.pageName, 'sample.pdf', SAMPLE_BYTES);
	await page.goto(pageUrl(hg));
	const a = page.locator('a').filter({ has: byId(page, hg, '100000000001') });
	await expect(a).toHaveAttribute('download', 'sample.pdf');
});

test('the public/private toggle hides and restores the box in view',
	async ({ page, hg }) => {
		hg.addObject('100000000001', downloadObject(300, 50, 100));
		seedAsset(hg.pageName, 'sample.pdf', SAMPLE_BYTES);
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);

		// public by default (danja's call, 2026-09-23) - the view shows
		// the box and the file serves
		await page.goto(pageUrl(hg));
		const a = page.locator('a').filter({ has: page.locator('.object') });
		await expect(a).toHaveAttribute('download', 'sample.pdf');
		const href = await a.getAttribute('href');
		expect((await page.request.get(new URL(href, page.url()).href)).status()).toBe(200);

		// toggle private - the glyph and the title say it
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await byId(page, hg, '100000000001').click();
		const toggle = page.locator('#glue-contextmenu-download-public');
		await expect(toggle).toHaveAttribute('title',
			'this download is public - click to make it private');
		await toggle.click();
		await expect.poll(() => hg.readObject('100000000001').attrs['download-public'])
			.toBe('private');
		await expect(toggle).toHaveAttribute('title',
			'this download is private - click to make it public');

		// the view shows nothing and the file asks an outsider for auth
		// (a bare node fetch, not Playwright's request fixture - that one
		// inherits the suite's httpCredentials and is not an outsider)
		await page.goto(pageUrl(hg));
		expect(await page.locator('.object').count()).toBe(0);
		const bare = await fetch(new URL(href, page.url()).href);
		expect(bare.status).toBe(401);
		expect(bare.headers.get('www-authenticate')).toBeTruthy();

		// toggle back public - the attribute goes, the view shows the box
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await byId(page, hg, '100000000001').click();
		await toggle.click();
		await expect.poll(() => hg.readObject('100000000001').attrs['download-public'])
			.toBe(undefined);
		await page.goto(pageUrl(hg));
		await expect(page.locator('a').filter({ has: page.locator('.object') }))
			.toHaveAttribute('download', 'sample.pdf');
	});

test('a private download wraps nothing in view', async ({ page, hg }) => {
	hg.addObject('100000000001', { ...textObject(50, 50, 100),
		'download-wrap': hg.pageName + '.100000000002' }, 'hello');
	hg.addObject('100000000002', { ...downloadObject(300, 50, 100),
		'download-wrap-target': hg.pageName + '.100000000001',
		'download-public': 'private' });
	seedAsset(hg.pageName, 'sample.pdf', SAMPLE_BYTES);
	await page.goto(pageUrl(hg));
	// no anchor around the text, and no box
	expect(await page.locator('a').filter({ has: byId(page, hg, '100000000001') }).count())
		.toBe(0);
	expect(await byId(page, hg, '100000000002').count()).toBe(0);
});

test('the box label falls back to the file extension', async ({ page, hg }) => {
	// no mime stored: the label is the extension
	hg.addObject('100000000001', {
		type: 'download', module: 'download',
		'download-file': 'archive.zip',
		'object-left': '50px', 'object-top': '50px', 'object-zindex': '100',
	});
	seedAsset(hg.pageName, 'archive.zip', Buffer.from('zip'));
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await expect(page.locator('.download-mime')).toHaveText('zip');
});

test('an image target attaches the same way, and wraps its <img> in view',
	async ({ page, hg }) => {
		hg.addObject('100000000001', {
			type: 'image', module: 'image',
			'image-file': 'sample.pdf', 'image-file-mime': 'application/pdf',
			'image-file-width': '120', 'image-file-height': '80',
			'object-left': '50px', 'object-top': '50px',
			'object-width': '120px', 'object-height': '80px',
			'object-zindex': '100',
		});
		seedAsset(hg.pageName, 'sample.pdf', SAMPLE_BYTES);
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);

		// the image's menu carries the same attach button
		await openMenu(page, hg, '100000000001');
		await expect(menuBtn(page)).toHaveAttribute('title', 'attach a file to download');
		const chooser = page.waitForEvent('filechooser');
		await menuBtn(page).click();
		await (await chooser).setFiles(SAMPLE);
		await expect(page.locator('.download.object')).toHaveCount(1, { timeout: 10000 });

		const dl = newId(hg, ['100000000001', 'page']);
		await expect.poll(() => hg.readObject(dl).attrs['download-wrap-target'])
			.toBe(hg.pageName + '.100000000001');
		await expect.poll(() => hg.readObject('100000000001').attrs['download-wrap'])
			.toBe(hg.pageName + '.' + dl);

		// the published page wraps the image's markup - public by default
		await page.goto(pageUrl(hg));
		const a = page.locator('a').filter({ has: byId(page, hg, '100000000001') });
		await expect(a).toHaveAttribute('download', 'sample.pdf');
	});
