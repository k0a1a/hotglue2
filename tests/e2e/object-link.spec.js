// Making an object a link - the link row of the object properties panel.
//
// The link was a panel of its own (a url field, a free-text target, a delete)
// until 2026-09-23, when the act moved into the object properties popout and
// took the font panel's shape instead: a url field and one button - make
// link / remove link / update link - with the target as one of three choices
// on a row of its own: 'same window' stores nothing (the browser default),
// 'new tab' stores '_blank', and 'new window' stores the fixed window name
// 'hotglue-window'. A stored target none of the three names keeps itself as
// an extra option rather than being rewritten.
//
// Enter and the button commit; Escape empties the field without storing, and
// clicking away (the panel closing) stores nothing either - the link row is
// the font row's contract, not the old panel's commit-on-close one.
//
// The link is NOT on the element. It is stored as object-link / object-target
// and wrapped around the object by the renderer in VIEWING mode only
// (module_object.inc.php), which is why every test here reads the object
// file rather than the DOM, and why the last one loads the page twice. The
// row reads the stored object back when it arrives - the panel opens before
// the load answers - so the field pre-fills asynchronously; tests that read
// it poll.

const { test, expect, waitForEditor } = require('./fixtures/hotglue.js');

const ATTRS = {
	type: 'text', module: 'text',
	'object-left': '200px', 'object-top': '200px',
	'object-width': '200px', 'object-height': '100px', 'object-zindex': '100',
	'text-background-color': 'transparent',
};

const byId = (page, id) => page.locator(`[id="${id}"]`);
const attrs = (hg) => hg.readObject('100000000001').attrs;
const panel = (page) => page.locator('.glue-properties-popover');
const linkRow = (page) => panel(page).locator('.glue-object-link-row');
const urlField = (page) => linkRow(page).locator('.glue-object-link-field');
const linkButton = (page) => linkRow(page).locator('button').first();
const targetSel = (page) => panel(page).locator('.glue-link-target-select');

// Open the object's properties popout, where the link row lives under the
// icon row and before "more knobs".
async function openPanel(page, id) {
	await byId(page, id).click();
	await page.getByTitle('object properties').click();
	await expect(panel(page)).toBeVisible();
	await expect(linkRow(page)).toBeVisible();
}

// Type into the url field the way a person does. Deliberately not fill():
// Playwright's fill() fires input AND change in one gesture, where typing
// keeps them apart - the tests assert on the input-only states.
async function typeUrl(page, url) {
	await urlField(page).click();
	await page.keyboard.type(url);
}

test('an object with no link gets one typed into the row', async ({ page, hg }) => {
	const id = hg.addObject('100000000001', ATTRS, 'hello');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await openPanel(page, id);

	// nothing to show, nothing to remove, and the button says what it does
	expect(await urlField(page).inputValue()).toBe('');
	await expect(linkButton(page)).toHaveText('make link');
	await expect(targetSel(page)).toHaveValue('');

	await typeUrl(page, 'https://hotglue.me/');
	await page.keyboard.press('Enter');
	await expect.poll(() => attrs(hg)['object-link']).toBe('https://hotglue.me/');
	// a link made with the target on 'same window' stores no target
	expect(attrs(hg)['object-target']).toBeUndefined();

	// and the button now offers to take it off again
	await expect(linkButton(page)).toHaveText('remove link');
});

test('an existing link pre-fills the row, and remove takes link and target off',
	async ({ page, hg }) => {
		const id = hg.addObject('100000000001', {
			...ATTRS, 'object-link': 'other-page', 'object-target': '_blank',
		}, 'hello');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await openPanel(page, id);

		// the row reads the stored object back when it arrives, which is
		// after the panel is open
		await expect.poll(async () => urlField(page).inputValue()).toBe('other-page');
		await expect(linkButton(page)).toHaveText('remove link');
		await expect(targetSel(page)).toHaveValue('_blank');

		await linkButton(page).click();
		await expect.poll(() => attrs(hg)['object-link']).toBeUndefined();
		await expect.poll(() => attrs(hg)['object-target']).toBeUndefined();
		await expect(linkButton(page)).toHaveText('make link');
		expect(await urlField(page).inputValue()).toBe('');
		await expect(targetSel(page)).toHaveValue('');
	});

test('the target choice stores the named values', async ({ page, hg }) => {
	const id = hg.addObject('100000000001', ATTRS, 'hello');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await openPanel(page, id);

	// 'new tab' stores _blank
	await targetSel(page).selectOption('_blank');
	await typeUrl(page, 'https://example.com/');
	await page.keyboard.press('Enter');
	await expect.poll(() => attrs(hg)['object-target']).toBe('_blank');

	// 'new window' stores the fixed window name, and a select change on an
	// existing link commits on its own
	await targetSel(page).selectOption('hotglue-window');
	await expect.poll(() => attrs(hg)['object-target']).toBe('hotglue-window');

	// 'same window' takes the target off again
	await targetSel(page).selectOption('');
	await expect.poll(() => attrs(hg)['object-target']).toBeUndefined();
});

test('a stored target none of the three names keeps itself', async ({ page, hg }) => {
	const id = hg.addObject('100000000001', {
		...ATTRS, 'object-link': 'other-page', 'object-target': 'frame1',
	}, 'hello');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await openPanel(page, id);

	// the named window appears as an extra option rather than being rewritten
	await expect.poll(async () => targetSel(page).inputValue()).toBe('frame1');
	await expect(targetSel(page).locator('option[value="frame1"]')).toHaveCount(1);

	// and an unrelated commit leaves it alone
	await typeUrl(page, 'https://example.com/');
	await page.keyboard.press('Enter');
	await expect.poll(() => attrs(hg)['object-target']).toBe('frame1');
});

test('editing the pre-filled url flips the button to update', async ({ page, hg }) => {
	const id = hg.addObject('100000000001', {
		...ATTRS, 'object-link': 'old-page',
	}, 'hello');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await openPanel(page, id);
	await expect.poll(async () => urlField(page).inputValue()).toBe('old-page');
	await expect(linkButton(page)).toHaveText('remove link');

	await typeUrl(page, 'https://new.example/');
	await expect(linkButton(page)).toHaveText('update link');
	await linkButton(page).click();
	await expect.poll(() => attrs(hg)['object-link']).toBe('https://new.example/');

	// restoring the stored value flips it back to remove
	await urlField(page).click();
	await page.keyboard.press('Control+a');
	await page.keyboard.type('https://new.example/');
	await expect(linkButton(page)).toHaveText('remove link');
});

test('Escape empties without storing, and clicking away stores nothing',
	async ({ page, hg }) => {
		const id = hg.addObject('100000000001', ATTRS, 'hello');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await openPanel(page, id);

		await typeUrl(page, 'https://never-stored.test/');
		await page.keyboard.press('Escape');
		await expect(urlField(page)).toHaveValue('');
		expect(attrs(hg)['object-link']).toBeUndefined();

		// clicking away closes the panel; what was typed is dropped, the
		// font row's contract (the old link panel committed on the way out)
		await typeUrl(page, 'https://also-never-stored.test/');
		await page.mouse.click(10, 10);
		await expect(panel(page)).toHaveCount(0);
		expect(attrs(hg)['object-link']).toBeUndefined();
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
