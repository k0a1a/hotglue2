// Save-serialization equivalence - MODERNIZATION.md section 11, last scenario,
// against the risk in section 8 item 2:
//
//   "edit.js's save path serializes objects to literal HTML strings that are
//    the on-disk storage format for every existing page. Changing how that
//    serialization happens risks corrupting or mis-rendering already-published
//    pages on next load."
//
// The migration that motivated this has already landed, so a literal
// before/after diff is no longer available. The durable equivalent is pinning
// the two properties that actually protect stored pages:
//
//   1. a save is IDEMPOTENT - opening a page and saving without editing must
//      leave the bytes on disk exactly as they were. If this breaks, every
//      page mutates a little every time somebody opens it.
//   2. save() only owns the ATTRIBUTES. Object body content (a text object's
//      words) travels a different path - glue.update_object - and a save must
//      never touch it.

const { test, expect, waitForEditor, CONTENT } = require('./fixtures/hotglue.js');

// Canonical stored forms, i.e. what hotglue itself writes. Note iframe-url is
// protocol-relative; see the normalization test at the bottom for why.
const TEXT = {
	type: 'text', module: 'text',
	'object-left': '120px', 'object-top': '80px',
	'object-width': '200px', 'object-height': '40px', 'object-zindex': '100',
	'text-background-color': 'transparent', 'text-font-size': '17px',
};
const IFRAME = {
	type: 'iframe', module: 'iframe',
	'object-left': '400px', 'object-top': '300px',
	'object-width': '320px', 'object-height': '240px', 'object-zindex': '101',
	'iframe-url': '//example.org/',
};

// Save every object on the page the way glue-movestop does, and wait for the
// backend to acknowledge each one.
async function saveAll(page) {
	await page.evaluate(() => Promise.all(
		Array.from(document.querySelectorAll('.object')).map((el) => new Promise((res) => {
			window.$.glue.backend(
				{ method: 'glue.save_state', html: window.$.glue.object.to_html(el) }, res);
		}))));
}

test('a no-op save leaves the stored bytes untouched', async ({ page, hg }) => {
	hg.addObject('100000000001', TEXT, 'HELLO');
	hg.addObject('100000000002', IFRAME);
	const before = Object.fromEntries(hg.ids().map((id) => [id, hg.readObjectRaw(id)]));

	await page.goto(hg.editUrl());
	await waitForEditor(page, 2);
	await saveAll(page);

	for (const id of hg.ids()) {
		expect(hg.readObjectRaw(id), `object ${id} was rewritten by an unedited save`)
			.toBe(before[id]);
	}
});

test('serialization is stable across a save and reload', async ({ page, hg }) => {
	hg.addObject('100000000001', TEXT, 'HELLO');
	hg.addObject('100000000002', IFRAME);

	const serialize = () => page.evaluate(() => Object.fromEntries(
		Array.from(document.querySelectorAll('.object'))
			.map((el) => [el.id, window.$.glue.object.to_html(el)])));

	await page.goto(hg.editUrl());
	await waitForEditor(page, 2);
	const first = await serialize();
	await saveAll(page);

	await page.reload();
	await waitForEditor(page, 2);
	expect(await serialize()).toEqual(first);
});

test('saving a text object does not clobber its content', async ({ page, hg }) => {
	// The textarea and render div are stripped before serialization
	// (modules/text/text-edit.js:945) precisely so the words are not sent
	// through save_state. If that ever changes, every text object on every
	// page loses its content on the next save - the worst failure this suite
	// exists to catch.
	const body = 'HELLO\nsecond line <b>with markup</b> & an ampersand';
	hg.addObject('100000000001', TEXT, body);

	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);

	expect(await page.evaluate(() => window.$.glue.object.to_html(
		document.querySelector('.object'))), 'serialized text object must carry no body')
		.not.toContain('HELLO');

	await saveAll(page);
	expect(hg.readObject('100000000001').content).toBe(body);
});

test('a moved object persists its new position and nothing else', async ({ page, hg }) => {
	hg.addObject('100000000001', TEXT, 'HELLO');
	const before = hg.readObject('100000000001').attrs;

	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await page.evaluate(() => {
		const el = document.querySelector('.object');
		el.style.left = '300px';
		el.style.top = '210px';
	});
	await saveAll(page);

	await expect.poll(() => hg.readObject('100000000001').attrs['object-left']).toBe('300px');
	const after = hg.readObject('100000000001').attrs;
	expect(after['object-top']).toBe('210px');
	// every other attribute must be exactly as it was
	for (const k of Object.keys(before)) {
		if (k === 'object-left' || k === 'object-top') continue;
		expect(after[k], `attribute ${k} changed during a move`).toBe(before[k]);
	}
	expect(Object.keys(after).sort(), 'a move invented or dropped attributes')
		.toEqual(Object.keys(before).sort());
});

test('iframe urls are normalized to protocol-relative, then stay put', async ({ page, hg }) => {
	// module_iframe.inc.php:88 renders src as strstr(url, '//') and :48 stores
	// it back the same way, so a stored absolute URL is rewritten to
	// protocol-relative by the first save. That is deliberate (the same page
	// has to work over http and https), but it IS a lossy rewrite of stored
	// data, so it is pinned here: one normalization, and stable thereafter.
	hg.addObject('100000000001', { ...IFRAME, 'iframe-url': 'https://example.org/path' });

	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await saveAll(page);
	await expect.poll(() => hg.readObject('100000000001').attrs['iframe-url'])
		.toBe('//example.org/path');

	const normalized = hg.readObjectRaw('100000000001');
	await page.reload();
	await waitForEditor(page, 1);
	await saveAll(page);
	expect(hg.readObjectRaw('100000000001'), 'iframe url normalization is not idempotent')
		.toBe(normalized);
});

// --- the file-backed module types ----------------------------------------
//
// Above covers text and iframe, which need nothing on disk. image, video and
// download each reference an uploaded file, and are seeded here rather than
// uploaded: what is under test is the SERIALIZATION round trip, and going
// through a real upload would drag ffmpeg re-encoding and image resizing into
// it without testing anything more about the storage format.

const fs = require('fs');
const path = require('path');

const IMAGE = {
	type: 'image', module: 'image',
	'object-left': '120px', 'object-top': '80px',
	'object-width': '120px', 'object-height': '80px', 'object-zindex': '100',
	'image-file': 'sample.png', 'image-file-mime': 'image/png',
	'image-file-width': '120', 'image-file-height': '80',
	'image-background-repeat': 'no-repeat',
};
const DOWNLOAD = {
	type: 'download', module: 'download',
	'object-left': '400px', 'object-top': '80px', 'object-zindex': '102',
	'download-file': 'notes.txt', 'download-file-mime': 'text/plain',
	// deliberately NO object-width/height: download_save_state() strips them
	// ("make width and height only be determined by the css"), so a real
	// download object does not carry them and a fixture that does would look
	// like data loss on the first save
};
const VIDEO = {
	type: 'video', module: 'video',
	'object-left': '120px', 'object-top': '300px',
	'object-width': '320px', 'object-height': '180px', 'object-zindex': '103',
	'video-file': 'clip.mp4', 'video-file-mime': 'video/mp4',
};

// put the files the objects reference into the page's shared directory
function shareFiles(hg) {
	const dir = path.join(CONTENT, hg.pageName.split('.')[0], 'shared');
	fs.mkdirSync(dir, { recursive: true });
	fs.copyFileSync(path.join(__dirname, 'fixtures', 'sample.png'),
		path.join(dir, 'sample.png'));
	fs.writeFileSync(path.join(dir, 'notes.txt'), 'a downloadable file\n');
	fs.writeFileSync(path.join(dir, 'clip.mp4'), 'not really a video\n');
}

// What each module normalises on save. Anything NOT listed here would be the
// storage format drifting; these are the module deciding what its own objects
// look like, which is a different thing and worth pinning by name.
const NORMALISES = {
	image: {},
	// video objects default to autoplay, materialised on the first save - real
	// ones on disk carry it too
	video: { 'video-autoplay': 'autoplay' },
	// download objects are sized entirely by css, so any stored size is dropped
	download: {},
};

for (const [name, attrs] of [['image', IMAGE], ['download', DOWNLOAD], ['video', VIDEO]]) {
	test(`a ${name} object only changes in the ways its module intends`,
		async ({ page, hg }) => {
			hg.addObject('100000000001', attrs);
			shareFiles(hg);
			const before = hg.readObject('100000000001').attrs;

			await page.goto(hg.editUrl());
			await waitForEditor(page, 1);
			await saveAll(page);
			const after = hg.readObject('100000000001').attrs;

			const expected = { ...before, ...NORMALISES[name] };
			expect(after, `a ${name} object changed in a way its module does not intend`)
				.toEqual(expected);
		});

	test(`a second save of a ${name} object changes nothing further`,
		async ({ page, hg }) => {
			// the normalisations above must settle, not compound
			hg.addObject('100000000001', attrs);
			shareFiles(hg);
			await page.goto(hg.editUrl());
			await waitForEditor(page, 1);
			await saveAll(page);
			const once = hg.readObjectRaw('100000000001');

			await page.reload();
			await waitForEditor(page, 1);
			await saveAll(page);
			expect(hg.readObjectRaw('100000000001'),
				`saving a ${name} object twice kept changing it`).toBe(once);
		});

	test(`${name} serialization is stable across a save and reload`, async ({ page, hg }) => {
		hg.addObject('100000000001', attrs);
		shareFiles(hg);
		const serialize = () => page.evaluate(() =>
			window.$.glue.object.to_html(document.querySelector('.object')));

		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		const first = await serialize();
		await saveAll(page);

		await page.reload();
		await waitForEditor(page, 1);
		expect(await serialize()).toEqual(first);
	});
}

test('a moved image keeps the file it points at', async ({ page, hg }) => {
	// the file reference is the part that would be catastrophic to lose: the
	// upload stays on disk but the object no longer knows about it
	hg.addObject('100000000001', IMAGE);
	shareFiles(hg);
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await page.evaluate(() => {
		const el = document.querySelector('.object');
		el.style.left = '600px';
	});
	await saveAll(page);

	await expect.poll(() => hg.readObject('100000000001').attrs['object-left']).toBe('600px');
	const after = hg.readObject('100000000001').attrs;
	expect(after['image-file']).toBe('sample.png');
	expect(after['image-file-width']).toBe('120');
	expect(after['image-file-mime']).toBe('image/png');
});

test('a no-op save keeps accessibility keys byte-identical', async ({ page, hg }) => {
	// image-alt/image-decorative (Feature 3) and text-heading-level
	// (Feature 4) round-trip through the serialized DOM - an unedited save
	// must reproduce exactly the stored values, not a mutated version of them
	hg.addObject('100000000001', { ...IMAGE, 'image-alt': 'a red balloon' });
	hg.addObject('100000000002', { ...TEXT, 'text-heading-level': 'h2' });
	const before = Object.fromEntries(hg.ids().map((id) => [id, hg.readObjectRaw(id)]));

	await page.goto(hg.editUrl());
	await waitForEditor(page, 2);
	await saveAll(page);

	for (const id of hg.ids()) {
		expect(hg.readObjectRaw(id), `object ${id} was rewritten by an unedited save`)
			.toBe(before[id]);
	}
});
