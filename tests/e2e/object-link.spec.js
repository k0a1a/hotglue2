// Making an object a link - the panel beside the object.
//
// This was a browser prompt() until 2026-09-16: one text box, both questions in
// it (the address, a space, the target), and no way to see what the object
// already had without reading it out of that string. The panel is the two rows
// those two questions deserve, and a delete, which is what these assert on. The
// target spent its first day folded away - the one fold in the editor whose
// label named its contents - and is a row beside the url since 2026-09-17, so
// there is no disclosure in this panel for a test to open.
//
// The panel commits on Enter and on its way out, and drops what was typed on
// Escape. Neither half of that is the browser's to do - removing a focused
// field fires change in Chromium and nothing at all in Firefox - so both are
// wired (object_link_popover) and pinned here, where the suite runs the two
// engines that disagree.
//
// The link is NOT on the element. It is stored as object-link / object-target
// and wrapped around the object by the renderer in VIEWING mode only
// (module_object.inc.php:414), which is why every test here reads the object
// file rather than the DOM, and why the last one loads the page twice.

const { test, expect, waitForEditor } = require('./fixtures/hotglue.js');

const ATTRS = {
	type: 'text', module: 'text',
	'object-left': '200px', 'object-top': '200px',
	'object-width': '200px', 'object-height': '100px', 'object-zindex': '100',
	'text-background-color': 'transparent',
};

const byId = (page, id) => page.locator(`[id="${id}"]`);
const attrs = (hg) => hg.readObject('100000000001').attrs;
const panel = (page) => page.locator('.glue-object-link-popover');
const urlField = (page) => panel(page).locator('.glue-object-link-field').first();
const targetField = (page) => panel(page).locator('.glue-object-link-field').nth(1);
const removeButton = (page) => panel(page).locator('.glue-popover-delete');
// the row labels, in order: 'link' then 'target'
const labels = (page) => panel(page).locator('.glue-popover-label');

// Open the object's context menu and click the link icon. The button's tooltip
// is 'make the object a link'; what it opens is a panel, and the panel is what
// carries the state, so nothing here reads the button again.
async function openPanel(page, id) {
	await byId(page, id).click();
	await page.getByTitle('make the object a link').click();
	await expect(panel(page)).toBeVisible();
}

// Type into the url field the way a person does. Deliberately not fill():
// Playwright's fill() fires input AND change, and change is this panel's
// commit - a test that used it would commit before it meant to, and the
// "Escape discards" case below could not be written at all.
async function typeUrl(page, url) {
	await urlField(page).click();
	await page.keyboard.type(url);
}

test('an object with no link gets one typed into the panel', async ({ page, hg }) => {
	const id = hg.addObject('100000000001', ATTRS, 'hello');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await openPanel(page, id);

	// nothing to show and nothing to remove
	expect(await urlField(page).inputValue()).toBe('');
	await expect(removeButton(page)).toBeHidden();
	// both questions are out front, each in its own labelled row, and there is
	// no fold for either of them to hide behind
	await expect(labels(page)).toHaveText(['link', 'target']);
	await expect(targetField(page)).toBeVisible();
	expect(await targetField(page).inputValue()).toBe('');
	expect(await panel(page).locator('.glue-popover-disclosure').count()).toBe(0);

	await typeUrl(page, 'https://hotglue.me/');
	await page.keyboard.press('Enter');
	await expect.poll(() => attrs(hg)['object-link']).toBe('https://hotglue.me/');
	// a link with no target stores no target
	expect(attrs(hg)['object-target']).toBeUndefined();

	// and the panel now offers to take it off again
	await expect(removeButton(page)).toBeVisible();
});

test('an existing link is shown, and taking it off takes the target too',
	async ({ page, hg }) => {
		const id = hg.addObject('100000000001', {
			...ATTRS, 'object-link': 'other-page', 'object-target': '_blank',
		}, 'hello');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await openPanel(page, id);

		// the address can be READ, which is the whole reason for the panel
		expect(await urlField(page).inputValue()).toBe('other-page');
		// and the target is readable too, in a row of its own with its name on
		// it - it must not go invisible, which was the whole reason it was
		// folded, and the answer turned out to be not to fold it
		expect(await targetField(page).inputValue()).toBe('_blank');
		await expect(labels(page).nth(1)).toHaveText('target');
		await expect(targetField(page)).toBeVisible();

		// Emptied by hand, one key at a time: ctrl+a is the editor's
		// select-all-objects and calls preventDefault() on documentElement,
		// so the input never sees it.
		await urlField(page).click();
		await page.keyboard.press('End');
		const typed = (await urlField(page).inputValue()).length;
		for (let i = 0; i < typed; i++) await page.keyboard.press('Backspace');
		await page.keyboard.press('Enter');

		await expect.poll(() => attrs(hg)['object-link']).toBeUndefined();
		await expect.poll(() => attrs(hg)['object-target']).toBeUndefined();
		await expect(removeButton(page)).toBeHidden();
	});

test('clicking away commits, Escape does not', async ({ page, hg }) => {
	const id = hg.addObject('100000000001', ATTRS, 'hello');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await openPanel(page, id);

	// Escape closes the panel and drops what was typed. The prompt this
	// replaced cancelled on Escape too.
	await typeUrl(page, 'https://never-stored.test/');
	await page.keyboard.press('Escape');
	await expect(panel(page)).toHaveCount(0);
	expect(attrs(hg)['object-link']).toBeUndefined();

	// reopening reads the object back from the server, which is where a
	// stray write would have landed
	await openPanel(page, id);
	expect(await urlField(page).inputValue(),
		'Escape stored what was typed in the field').toBe('');

	// clicking away is the other half, and it is the opposite: the panel
	// commits on its way out, whatever closed it. This test is engine
	// sensitive on purpose - removing a focused field fires change in
	// Chromium and nothing at all in Firefox, so a panel that left the commit
	// to the browser stored on Escape here and dropped the typed url there.
	await typeUrl(page, 'https://stored.test/');
	await page.mouse.click(10, 10);
	await expect.poll(() => attrs(hg)['object-link']).toBe('https://stored.test/');
	await expect(panel(page)).toHaveCount(0);
});

test('the renderer wraps the object, in viewing mode only', async ({ page, hg }) => {
	const id = hg.addObject('100000000001', {
		...ATTRS, 'object-link': 'https://example.com/', 'object-target': '_blank',
	}, 'hello');

	// the editor shows the object itself: the link is storage, not markup
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	expect(await page.evaluate((i) =>
		document.getElementById(i).closest('a') ? 'in a link' : 'plain',
	id), 'the editor rendered the link').toBe('plain');

	await page.goto(`/?${hg.pageName}`);
	const link = page.locator('a[href="https://example.com/"]');
	await expect(link).toHaveAttribute('target', '_blank');
	// <a> wraps the object, it is not inside it
	await expect(link.locator(`[id="${id}"]`)).toHaveCount(1);
});
