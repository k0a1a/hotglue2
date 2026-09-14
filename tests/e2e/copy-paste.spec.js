// Copy/paste objects (SOW-copy-paste-objects.md): copy one object on a page,
// navigate to another page of the same site, paste it there. The navigation is
// a full page load, which is why the clipboard cannot be a variable and lives
// in localStorage - and why every test below that crosses pages reloads.
//
// Most of what these check is the STORAGE MODEL rather than the UI. Fonts are
// site-wide, so a copied text object keeps resolving its face with nothing
// copied at all; images and the other uploads live in ONE page's shared/
// directory, so a paste has to carry them across, and must not overwrite what
// the target page already had under the same name.
//
// Both halves are asserted, and they are separate code paths: the client half
// is what ends up in the dom, the server half is what lands in the page
// directory. A paste that looks right on screen while writing the wrong file
// (or the right file into the wrong page, or a renamed file the object does
// not point at) is the failure this file exists to catch.

const fs = require('fs');
const path = require('path');
const {
	test: base, expect, waitForEditor, serializeObject, CONTENT,
} = require('./fixtures/hotglue.js');

const SAMPLE = path.join(__dirname, 'fixtures', 'sample.png');
const SAMPLE_BYTES = fs.readFileSync(SAMPLE);

const byId = (page, id) => page.locator(`[id="${id}"]`);
const pageDir = (pageName) => path.join(CONTENT, pageName.split('.')[0]);
const revDir = (pageName) => path.join(CONTENT, pageName.split('.').join('/'));
// assets are per page, not per revision: <page>/shared/, a level above head/
const sharedDir = (pageName) => path.join(pageDir(pageName), 'shared');

function seedAsset(pageName, name, bytes) {
	const dir = sharedDir(pageName);
	fs.mkdirSync(dir, { recursive: true, mode: 0o777 });
	fs.writeFileSync(path.join(dir, name), bytes);
}

function assets(pageName) {
	const dir = sharedDir(pageName);
	return fs.existsSync(dir) ? fs.readdirSync(dir).sort() : [];
}

// the page's own pseudo-object, where page-level settings live (reading order,
// and the site-wide font registry below)
function writePageObject(pageName, attrs) {
	fs.writeFileSync(path.join(revDir(pageName), 'page'), serializeObject(attrs));
}

// An object as the image module stores one - including the three attributes
// that exist ONLY in the object file. Nothing in the editor displays them, so
// a copy that went through the dom instead of the stored object would drop
// them silently, and this is the attribute set that catches it.
const imageObject = (left, top, z, file = 'sample.png') => ({
	type: 'image', module: 'image',
	'image-file': file,
	'image-file-mime': 'image/png',
	'image-file-width': '120',
	'image-file-height': '80',
	'object-left': left + 'px', 'object-top': top + 'px',
	'object-width': '120px', 'object-height': '80px',
	'object-zindex': String(z),
});

const textObject = (left, top, z, extra = {}) => ({
	type: 'text', module: 'text',
	'object-left': left + 'px', 'object-top': top + 'px',
	'object-width': '160px', 'object-height': '60px',
	'object-zindex': String(z), 'text-background-color': 'transparent',
	...extra,
});

// the id the editor wrote, i.e. the one that was not there before
function newId(before, after) {
	const fresh = after.filter((f) => !before.includes(f) && f !== 'page');
	expect(fresh, 'exactly one new object file was expected').toHaveLength(1);
	return fresh[0];
}

// A page the test builds itself, for the pages that are not the one the `hg`
// fixture looks after (a second page to paste onto, the page a symlink points
// from). Same layout rules as the fixture, but named by the test.
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
		writePageObject: (attrs) => writePageObject(pageName, attrs),
		readObject: (id) => {
			const file = path.join(dir, id);
			return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
		},
		ids: () => (fs.existsSync(dir) ? fs.readdirSync(dir).sort() : []),
		assets: () => assets(pageName),
		destroy: () => fs.rmSync(pageDir(pageName), {
			recursive: true, force: true, maxRetries: 10, retryDelay: 50,
		}),
	};
}

// hg's page with a second one beside it, torn down after the test even when an
// assertion fails - the fixture pattern the suite already uses
const test = base.extend({
	second: async ({ hg }, use) => {
		const pg = makePage(hg.pageName.replace(/\.default$/, '') + '-b.default');
		pg.create();
		await use(pg);
		pg.destroy();
	},
	third: async ({ hg }, use) => {
		const pg = makePage(hg.pageName.replace(/\.default$/, '') + '-c.default');
		pg.create();
		await use(pg);
		pg.destroy();
	},
});

// copy = ctrl+c with one object selected, but the clipboard round-trips
// through the server, so give it a moment to land before pasting
async function copySelected(page) {
	await page.keyboard.press('Control+c');
	await page.waitForFunction(() => {
		try {
			return window.localStorage.getItem('glue.object-clipboard') !== null;
		} catch (e) {
			return false;
		}
	});
}

async function pasteInSingleClickMenu(page) {
	await page.keyboard.press('Alt+O');
	await page.getByTitle('paste copied object').click();
}

// A hand-written clipboard, in the shape read() accepts. Tests that need one
// rather than a real copy use this, so the shape lives in one place: a
// version, a source page, the stored object, and when it was last used.
async function writeClipboard(page, snap) {
	await page.evaluate((s) => {
		localStorage.setItem('glue.object-clipboard', JSON.stringify(s));
	}, {
		v: 2,
		content: '',
		used_at: new Date().toISOString(),
		...snap,
	});
}

// Backdate the clipboard's timestamp, which is the only clock it has - an
// hour of not being pasted is what expires it.
async function ageClipboard(page, ms) {
	await page.evaluate((age) => {
		const key = 'glue.object-clipboard';
		const snap = JSON.parse(localStorage.getItem(key));
		snap.used_at = new Date(Date.now() - age).toISOString();
		localStorage.setItem(key, JSON.stringify(snap));
	}, ms);
}

const readClipboard = (page) => page.evaluate(() => {
	const raw = localStorage.getItem('glue.object-clipboard');
	return raw === null ? null : JSON.parse(raw);
});

// dialogs are how the editor reports a frontend error (SHOW_FRONTEND_ERRORS),
// and an unexpected one is a failure whether or not the paste went through
function collectErrors(page) {
	const errors = [];
	page.on('dialog', (d) => {
		errors.push(d.message());
		d.dismiss();
	});
	return errors;
}

test('an object pasted into the same page keeps every stored property',
	async ({ page, hg }) => {
		// the object, an overlapping neighbour with a higher z-index (so
		// "on top" means something here), and a stored reading order, which
		// the paste has to append itself to
		hg.addObject('100000000001', imageObject(100, 100, 10));
		hg.addObject('100000000002', imageObject(150, 130, 50));
		writePageObject(hg.pageName,
			{ 'page-reading-order': '["100000000001","100000000002"]' });
		seedAsset(hg.pageName, 'sample.png', SAMPLE_BYTES);

		await page.goto(hg.editUrl());
		await waitForEditor(page, 2);

		const errors = collectErrors(page);
		await byId(page, `${hg.pageName}.100000000001`).click();
		await copySelected(page);

		// the copy button says so: its clipboard dot is on while there is
		// something to paste
		await expect(page.getByTitle('copy object')).toHaveClass(/glue-clipboard-full/);

		const before = hg.ids();
		await page.keyboard.press('Control+v');
		await expect(page.locator('.object')).toHaveCount(3);
		await expect.poll(() => hg.ids().length).toBe(before.length + 1);

		const pasted = newId(before, hg.ids());
		expect(pasted, 'the paste reused the source id').not.toBe('100000000001');

		// every property of the source, not a subset the editor knows about:
		// the mime and the original dimensions are in no dom element
		const source = hg.readObject('100000000001').attrs;
		const copy = hg.readObject(pasted).attrs;
		expect(copy['image-file-mime']).toBe('image/png');
		expect(copy['image-file-width']).toBe('120');
		expect(copy['image-file-height']).toBe('80');
		for (const [k, v] of Object.entries(source)) {
			expect(copy[k], `the pasted object lost ${k}`).toBe(v);
		}

		// original coordinates, kept (that is the point of a paste)
		expect(copy['object-left']).toBe('100px');
		expect(copy['object-top']).toBe('100px');
		// and on top of what it landed on: past 002's 50, not the source's 10
		expect(copy['object-zindex']).toBe('51');

		// selected, ready to be moved
		await expect(byId(page, `${hg.pageName}.${pasted}`)).toHaveClass(/glue-selected/);

		// the stored reading order gained it, at the end
		expect(JSON.parse(hg.readObject('page').attrs['page-reading-order']))
			.toEqual(['100000000001', '100000000002', pasted]);

		// the asset was not duplicated: the target's copy is byte-identical,
		// so the same file is reused and the reference is left alone
		expect(hg.assets()).toEqual(['sample.png']);
		expect(copy['image-file']).toBe('sample.png');

		// the source is untouched
		expect(hg.readObject('100000000001').attrs['object-zindex']).toBe('10');
		expect(errors).toEqual([]);
	});

test('an object pasted onto another page arrives with its image',
	async ({ page, hg, second }) => {
		hg.addObject('100000000001', imageObject(80, 120, 10));
		seedAsset(hg.pageName, 'sample.png', SAMPLE_BYTES);
		second.addObject('100000000001', textObject(40, 40, 10), 'target page');

		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		const errors = collectErrors(page);
		await byId(page, `${hg.pageName}.100000000001`).click();
		await copySelected(page);

		// the navigation that makes a client-held clipboard necessary
		await page.goto(second.editUrl());
		await waitForEditor(page, 1);
		await pasteInSingleClickMenu(page);
		await expect(page.locator('.object')).toHaveCount(2);
		await expect.poll(() => second.ids().length).toBe(2);

		const pasted = newId(['100000000001'], second.ids());
		const copy = second.readObject(pasted);
		expect(copy).toContain('image-file:sample.png');
		expect(copy).toContain('object-left:80px');

		// the file came across into the target page's own shared directory
		expect(second.assets()).toContain('sample.png');
		expect(fs.readFileSync(path.join(sharedDir(second.pageName), 'sample.png')))
			.equals(SAMPLE_BYTES);
		// the source page keeps its own
		expect(hg.assets()).toEqual(['sample.png']);

		// the round trip that matters: saved, reloaded, and published - the
		// real page a visitor gets, not the editor
		await page.goto(second.url());
		const img = page.locator('.image.object');
		await expect(img).toHaveCount(1);
		const bg = await img.evaluate((el) => getComputedStyle(el).backgroundImage);
		expect(bg, 'the pasted image is not painted on the published page').not.toBe('none');
		// and the file the object points at is really served (the url is the
		// object's name, resolved by the image module, not the shared path)
		const url = bg.match(/url\(["']?([^"')]+)/)[1];
		const r = await page.request.get(url);
		expect(r.status()).toBe(200);
		expect(Buffer.from(await r.body())).equals(SAMPLE_BYTES);
		expect(errors).toEqual([]);
	});

test('a colliding asset is copied under a new name, never over the target',
	async ({ page, hg, second }) => {
		hg.addObject('100000000001', imageObject(80, 120, 10));
		seedAsset(hg.pageName, 'sample.png', SAMPLE_BYTES);
		// the target page already has a DIFFERENT file under that name
		const theirs = Buffer.from('not the same image at all');
		seedAsset(second.pageName, 'sample.png', theirs);

		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		const errors = collectErrors(page);
		await byId(page, `${hg.pageName}.100000000001`).click();
		await copySelected(page);

		await page.goto(second.editUrl());
		await waitForEditor(page, 0);
		await pasteInSingleClickMenu(page);
		await expect.poll(() => second.ids().length).toBe(1);

		const pasted = newId([], second.ids());
		const attrs = second.readObject(pasted);
		// unique_filename() numbers from _2 (it pre-increments), the same
		// names an upload gets
		expect(attrs).toContain('image-file:sample_2.png');
		expect(second.assets()).toEqual(['sample.png', 'sample_2.png']);

		// the target's own file is untouched, byte for byte - this is the
		// "I pasted an object and it broke a different image" failure
		expect(fs.readFileSync(path.join(sharedDir(second.pageName), 'sample.png')))
			.equals(theirs);
		expect(fs.readFileSync(path.join(sharedDir(second.pageName), 'sample_2.png')))
			.equals(SAMPLE_BYTES);
		expect(errors).toEqual([]);
	});

test('an asset that is gone from the source page fails soft',
	async ({ page, hg, second }) => {
		hg.addObject('100000000001', imageObject(80, 120, 10));
		seedAsset(hg.pageName, 'sample.png', SAMPLE_BYTES);
		second.addObject('100000000001', textObject(40, 40, 10), 'target page');

		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		const errors = collectErrors(page);
		await byId(page, `${hg.pageName}.100000000001`).click();
		await copySelected(page);

		// the source page loses the file between the copy and the paste
		fs.unlinkSync(path.join(sharedDir(hg.pageName), 'sample.png'));

		await page.goto(second.editUrl());
		await waitForEditor(page, 1);
		await pasteInSingleClickMenu(page);
		await expect(page.locator('.object')).toHaveCount(2);
		await expect.poll(() => second.ids().length).toBe(2);

		// the object pastes whole, pointing at a file that never arrived -
		// a broken image is a smaller problem than a paste that does nothing
		const pasted = newId(['100000000001'], second.ids());
		expect(second.readObject(pasted)).toContain('image-file:sample.png');
		expect(second.assets(), 'nothing should have been copied').toEqual([]);
		expect(errors).toEqual([]);
	});

test('fonts are not copied: they are site-wide and already resolve',
	async ({ page, hg, second }) => {
		// The registry is the startpage's own page object, whichever page is
		// being viewed (common.inc.php's site_custom_fonts()). No other spec
		// touches the startpage, so this one puts it back the way it found it.
		const startpageName = 'start.head';
		const startDir = pageDir(startpageName);
		const hadStartpage = fs.existsSync(startDir);
		fs.mkdirSync(revDir(startpageName), { recursive: true, mode: 0o777 });
		seedAsset(startpageName, 'TestFace.woff2', Buffer.from('not a real font'));
		writePageObject(startpageName, {
			'page-custom-fonts': '[{"file":"TestFace.woff2","name":"TestFace"}]',
		});

		try {
			hg.addObject('100000000001',
				textObject(60, 60, 10, { 'text-font-family': 'TestFace' }), 'styled text');
			second.addObject('100000000001', textObject(40, 40, 10), 'target page');

			await page.goto(hg.editUrl());
			await waitForEditor(page, 1);
			const errors = collectErrors(page);
			await byId(page, `${hg.pageName}.100000000001`).click();
			await copySelected(page);

			await page.goto(second.editUrl());
			await waitForEditor(page, 1);
			await pasteInSingleClickMenu(page);
			await expect.poll(() => second.ids().length).toBe(2);

			const pasted = newId(['100000000001'], second.ids());
			const copy = second.readObject(pasted);
			// the reference travels as it was
			expect(copy).toContain('text-font-family:TestFace');
			// and nothing was copied for it - not into the page, not into
			// the registry's own directory either
			expect(second.assets(), 'a font was copied into the target page').toEqual([]);
			expect(assets(startpageName)).toEqual(['TestFace.woff2']);

			// it still resolves on the target page, which is the whole
			// reason fonts are left alone: the @font-face rule points at the
			// startpage's shared directory from every page of the site
			await page.goto(second.url());
			const css = await page.evaluate(() => [...document.styleSheets]
				.flatMap((s) => { try { return [...s.cssRules]; } catch (e) { return []; } })
				.map((r) => r.cssText).join('\n'));
			expect(css, 'the pasted text lost its custom font').toContain('TestFace');
			expect(css).toContain('content-e2e/start/shared/TestFace.woff2');
			expect(errors).toEqual([]);
		} finally {
			if (hadStartpage) {
				fs.rmSync(path.join(sharedDir(startpageName), 'TestFace.woff2'), { force: true });
			} else {
				fs.rmSync(startDir, { recursive: true, force: true, maxRetries: 10 });
			}
		}
	});

test('copying through a symlinked object pastes the target, as a real file',
	async ({ page, hg, second, third }) => {
		// a symlinked object is how hotglue shares one object across pages,
		// so copying one has to mean copying what it points at - otherwise
		// the paste would carry a symlink into a page whose relative path
		// means something else entirely
		hg.addObject('100000000001', imageObject(80, 120, 10));
		seedAsset(hg.pageName, 'sample.png', SAMPLE_BYTES);
		second.addObject('100000000001', textObject(40, 40, 10), 'target page');
		// third's object points at hg's
		const link = `${third.pageName}.100000000001`;
		fs.symlinkSync(
			`../../${hg.pageName.split('.')[0]}/head/100000000001`,
			path.join(revDir(third.pageName), '100000000001'));

		await page.goto(third.editUrl());
		await waitForEditor(page, 1);
		const errors = collectErrors(page);
		// the symlink is what is on the page, and what gets selected
		await byId(page, link).click();
		await copySelected(page);

		await page.goto(second.editUrl());
		await waitForEditor(page, 1);
		await pasteInSingleClickMenu(page);
		await expect.poll(() => second.ids().length).toBe(2);

		const pasted = newId(['100000000001'], second.ids());
		const file = path.join(revDir(second.pageName), pasted);
		expect(fs.lstatSync(file).isSymbolicLink(),
			'the paste carried the symlink instead of resolving it').toBe(false);
		// the target's attributes, and the target page's asset - resolved
		// through the link, not read off the page the copy was made on
		expect(second.readObject(pasted)).toContain('image-file:sample.png');
		expect(second.assets()).toEqual(['sample.png']);
		expect(third.assets(), 'nothing belongs in the linking page').toEqual([]);
		expect(errors).toEqual([]);
	});

test('the paste button appears only when there is something to paste',
	async ({ page, hg }) => {
		hg.addObject('100000000001', imageObject(80, 120, 10));
		seedAsset(hg.pageName, 'sample.png', SAMPLE_BYTES);
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);

		// the single-click menu opens with alt+o; with an empty clipboard the
		// paste item takes itself out of it rather than sitting there dead
		await page.keyboard.press('Alt+O');
		await expect(page.getByTitle('undo the last change')).toBeVisible();
		await expect(page.getByTitle('paste copied object')).toBeHidden();

		// selecting an object closes the menu by itself (glue-select)
		await byId(page, `${hg.pageName}.100000000001`).click();
		const copy_btn = page.getByTitle('copy object');
		await expect(copy_btn).toBeVisible();
		await expect(copy_btn).not.toHaveClass(/glue-clipboard-full/);
		await copy_btn.click();
		await page.waitForFunction(() =>
			window.localStorage.getItem('glue.object-clipboard') !== null);
		await expect(copy_btn).toHaveClass(/glue-clipboard-full/);

		// and now the single-click menu offers it, and it works
		await page.keyboard.press('Alt+O');
		await expect(page.getByTitle('paste copied object')).toBeVisible();
		await page.getByTitle('paste copied object').click();
		await expect(page.locator('.object')).toHaveCount(2);
	});

test('ctrl+c and ctrl+v leave a form field alone', async ({ page, hg }) => {
	hg.addObject('100000000001', imageObject(80, 120, 10));
	seedAsset(hg.pageName, 'sample.png', SAMPLE_BYTES);
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);

	await byId(page, `${hg.pageName}.100000000001`).click();
	await copySelected(page);

	// the page title field - a real text input, and the place an editor user
	// would paste a page title into
	await page.keyboard.press('Alt+P');
	await page.getByTitle('page settings').click();
	const field = page.locator('.glue-page-title');
	await expect(field).toBeVisible();
	await field.click();
	await field.fill('pasted text');
	await page.keyboard.press('Control+v');

	// the keystroke belonged to the field: no object appeared, and the
	// clipboard was not consumed
	await expect(page.locator('.object')).toHaveCount(1);
	await expect(field).toHaveValue('pasted text');
	expect(await page.evaluate(() =>
		window.localStorage.getItem('glue.object-clipboard') !== null)).toBe(true);
});

test('ctrl+z takes a pasted object off the page again',
	async ({ page, hg }) => {
		hg.addObject('100000000001', imageObject(80, 120, 10));
		seedAsset(hg.pageName, 'sample.png', SAMPLE_BYTES);
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);

		await byId(page, `${hg.pageName}.100000000001`).click();
		await copySelected(page);
		const before = hg.ids();
		await page.keyboard.press('Control+v');
		await expect.poll(() => hg.ids().length).toBe(before.length + 1);
		const pasted = newId(before, hg.ids());

		// the paste is one undo step, like the clone button's
		await page.keyboard.press('Control+z');
		await expect(page.locator('.object')).toHaveCount(1);
		await expect.poll(() => hg.ids().includes(pasted),
			'the file outlived the undo').toBe(false);
	});

test('a clipboard cannot talk the paste into writing outside its page',
	async ({ page, hg, second }) => {
		// A real file sitting ONE LEVEL ABOVE the source page's shared
		// directory, at the place '../canary.png' resolves to from there. If
		// the paste follows that name it copies this file into the target
		// page, so its absence from the target is the proof that it did not.
		second.addObject('100000000001', textObject(40, 40, 10), 'target page');
		fs.writeFileSync(path.join(pageDir(hg.pageName), 'canary.png'),
			Buffer.from('this must not travel'));
		await page.goto(second.editUrl());
		await waitForEditor(page, 1);

		// what is in localStorage is client-side and editable, so the paste
		// service cannot trust any of it: the asset names below all try to
		// climb out of a page's shared directory
		await writeClipboard(page, {
			source_page: hg.pageName,
			name: hg.pageName + '.100000000009',
			attrs: {
				type: 'image', module: 'image',
				'image-file': '../canary.png',
				'image-resized-file': '/etc/passwd',
				'object-background-file': '../../../../etc/passwd',
				'object-left': '10px', 'object-top': '10px',
			},
		});
		await page.keyboard.press('Control+v');
		await expect(page.locator('.object')).toHaveCount(2);
		await expect.poll(() => second.ids().length).toBe(2);

		// the object is written with its attributes as they came - the
		// references are dangling, which is the point: nothing was copied
		// and nothing outside the page was read or written
		const pasted = newId(['100000000001'], second.ids());
		expect(second.readObject(pasted)).toContain('image-file:../canary.png');
		expect(second.assets()).toEqual([]);
	});

// The clipboard is NOT cleared on paste - the same object pastes as often as
// you like, which is most of what it is for. What bounds it is an hour of not
// being used, put back to a full hour by each paste.
test('a clipboard nobody has used for an hour is gone',
	async ({ page, hg }) => {
		hg.addObject('100000000001', imageObject(80, 120, 10));
		seedAsset(hg.pageName, 'sample.png', SAMPLE_BYTES);
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);

		await byId(page, `${hg.pageName}.100000000001`).click();
		await copySelected(page);
		await ageClipboard(page, 61 * 60 * 1000);

		// the menu takes itself back out, and the key goes with it - a
		// clipboard that is only *pretended* to be empty would leave the dot
		// lit and the whole question to be answered again at every call site
		await page.keyboard.press('Alt+O');
		await expect(page.getByTitle('undo the last change')).toBeVisible();
		await expect(page.getByTitle('paste copied object')).toBeHidden();
		expect(await readClipboard(page)).toBeNull();

		// and the shortcut agrees with the button
		await page.keyboard.press('Control+v');
		await expect(page.locator('.object')).toHaveCount(1);
		expect(hg.ids()).toEqual(['100000000001']);
	});

test('pasting puts the hour back', async ({ page, hg }) => {
	hg.addObject('100000000001', imageObject(80, 120, 10));
	seedAsset(hg.pageName, 'sample.png', SAMPLE_BYTES);
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);

	await byId(page, `${hg.pageName}.100000000001`).click();
	await copySelected(page);
	// an hour less a minute: still there, but with nothing to spare
	await ageClipboard(page, 59 * 60 * 1000);

	await page.keyboard.press('Control+v');
	await expect(page.locator('.object')).toHaveCount(2);

	// the paste moved the timestamp to now rather than leaving the copy's own
	// time on it, so it is good for another hour
	const after = await readClipboard(page);
	expect(after.used_at).not.toBeNull();
	expect(Date.now() - Date.parse(after.used_at)).toBeLessThan(60 * 1000);

	// and it is still what was copied - extending is not a re-copy
	expect(after.name).toBe(`${hg.pageName}.100000000001`);
});
