// The page's background panel: the first spec this panel has had.
//
// It is the object properties panel's twin - the same parts, one action
// shorter - and it has been reachable since 2026-09-16 without anything
// asserting on it, which is the gap this file closes. The panel is where the
// page's background is set whole: what it IS (a colour, a picture) and what the
// picture does with itself (tile it, scroll it, move it, scale it, take it
// off).
//
// Since 2026-09-17 the panel is the house style, in two pieces: an icon row that
// is the panel from the outside - set the colour, set the picture, tile it,
// scroll it, in that order - and ONE "more knobs" fold holding everything with
// a label in it: the position's x and y, the scale, and the delete and reset as
// its last row. The fold is closed when the panel opens; its rows are in the
// DOM either way, so counts and classes read the same folded or open, and it is
// clicking, filling and measuring that need the way in (openFold below).
//
// The picture is the PAGE's: it uploads with the page's own name, it is stored
// as page-background-file (with the position, the tiling, the size and the
// scroll mode as attributes beside it), and page-edit.js renders it from there.
// The page's tiling default is the opposite of the object's - absent means
// tiled, and the attribute is stored only for the exception - which is why the
// reset below clears the attributes rather than writing a value into them.

const fs = require('fs');
const path = require('path');
const { test, expect, waitForEditor, CONTENT } = require('./fixtures/hotglue.js');

const SAMPLE = path.join(__dirname, 'fixtures', 'sample.png');

const ATTRS = {
	type: 'text', module: 'text',
	'object-left': '300px', 'object-top': '300px',
	'object-width': '240px', 'object-height': '140px', 'object-zindex': '100',
	'text-background-color': 'transparent',
};

const pop = (page) => page.locator('.glue-popover.glue-background-popover');
const disclosure = (page) => pop(page).locator('.glue-popover-disclosure');
const advanced = (page) => pop(page).locator('.glue-popover-advanced');
const pageAttrs = (hg) => hg.readObject('page').attrs;

async function openFold(page) {
	await disclosure(page).click();
	await expect(advanced(page)).toBeVisible();
}

// the page menu, then its background button - the panel's one way in
async function openPanel(page) {
	await page.keyboard.press('Alt+P');
	const button = page.getByTitle('page background', { exact: true });
	await expect(button).toBeVisible();
	await button.click();
	await expect(pop(page)).toBeVisible();
}

// a page with the sample picture already on it: the picture lives in the page's
// shared directory and is named by page-background-file, which is what the
// renderer paints from
function withPicture(hg, extra) {
	hg.addObject('100000000001', ATTRS, 'A');
	hg.addObject('page', {
		'page-background-file': 'sample.png', 'page-background-mime': 'image/png',
		...(extra || {}),
	});
	fs.mkdirSync(path.join(CONTENT, hg.pageName.split('.')[0], 'shared'),
		{ recursive: true });
	fs.copyFileSync(SAMPLE,
		path.join(CONTENT, hg.pageName.split('.')[0], 'shared', 'sample.png'));
}

// type a value into a row's field and commit it (change is the commit)
async function fillRow(page, row, v) {
	await row.locator('.glue-popover-field').fill(String(v));
	await row.locator('.glue-popover-field').dispatchEvent('change');
}

test('the panel opens on four actions, with everything else folded away',
	async ({ page, hg }) => {
		hg.addObject('100000000001', ATTRS, 'A');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await openPanel(page);

		// the row of four: set the colour, set the picture, tile it, scroll it
		await expect(pop(page).locator('.glue-popover-icon')).toHaveCount(4);
		await expect(pop(page).locator('.glue-background-color')).toHaveCount(1);
		await expect(pop(page).locator('.glue-background-tile')).toHaveCount(1);
		await expect(pop(page).locator('.glue-background-scroll')).toHaveCount(1);
		// the picture button IS a file picker, the way the object panel's is
		await expect(pop(page).locator('.glue-background-image input[type=file]'))
			.toBeAttached();
		// and everything with a label is behind the one fold, closed to start
		await expect(disclosure(page)).toHaveCount(1);
		await expect(advanced(page)).toBeHidden();
		// with no picture, the two toggles describe a background that is not
		// there: greyed and inert until one arrives (the page's rows beside them
		// are the object panel's "to the letter" and do not grey - the one place
		// the two panels still differ)
		await expect(pop(page).locator('.glue-background-tile'))
			.toHaveClass(/glue-background-off/);
		await expect(pop(page).locator('.glue-background-scroll'))
			.toHaveClass(/glue-background-off/);
	});

test('with a picture, the fold holds the position, the scale and the two buttons',
	async ({ page, hg }) => {
		withPicture(hg);
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await openPanel(page);
		await openFold(page);

		// the rows the picture is described by, and the two ways out of it
		await expect(pop(page).locator('.glue-background-pos')).toHaveCount(2);
		await expect(pop(page).locator('.glue-background-scale')).toHaveCount(1);
		await expect(pop(page).locator('.glue-popover-delete')).toBeVisible();
		await expect(pop(page).locator('.glue-popover-reset')).toBeVisible();
		// the toggles woke where they stand: there is a picture to tile now
		await expect(pop(page).locator('.glue-background-tile'))
			.not.toHaveClass(/glue-background-off/);
		await expect(pop(page).locator('.glue-background-scale .glue-popover-field'))
			.toHaveValue('100');
	});

test('the fold\'s rows write the page\'s own attributes', async ({ page, hg }) => {
	withPicture(hg);
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await openPanel(page);
	await openFold(page);

	await fillRow(page, pop(page).locator('.glue-background-scale'), 150);
	await expect.poll(() => pageAttrs(hg)['page-background-size']).toBe('150% auto');

	// the position is stored as the pair, x then y, once either moves
	await fillRow(page, pop(page).locator('.glue-background-pos').first(), 30);
	await expect.poll(() => pageAttrs(hg)['page-background-image-position'])
		.toBe('30px 0px');

	// and it survives a reload and reaches the published page
	await page.goto(`/?${hg.pageName}`);
	await expect.poll(() => page.evaluate(() =>
		getComputedStyle(document.documentElement).backgroundSize)).toContain('150%');
});

test('the delete takes the picture off the page and closes the panel',
	async ({ page, hg }) => {
		withPicture(hg);
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await openPanel(page);
		// it is the fold's last row: the house style's one cost, and the reason
		// this test has to go looking for it
		await openFold(page);

		await pop(page).locator('.glue-popover-delete').click();
		// the panel closes with it, as it does when the colour button clears the
		// picture on the way to the picker: what the panel was describing is gone
		await expect(pop(page)).toHaveCount(0);
		await expect.poll(() => pageAttrs(hg)['page-background-file']).toBe(undefined);
		expect(await page.evaluate(() =>
			getComputedStyle(document.documentElement).backgroundImage)).toBe('none');
	});
