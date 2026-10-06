// Per-object code - SOW-object-code.md. An object's "code" panel takes CSS and
// JavaScript for that object alone; they are stored in an object of their own
// next to it (<rev>/code<id>), never in the object's file, and applied by the
// server when the page renders: the CSS confined to the object by its id, the
// script wrapped to run once the page is loaded and handed the object as el.
//
// What is pinned: the round trip (the panel shows what was written, not the
// generated machinery), the confinement of the CSS, the script getting its
// object, and the life of the code - it goes with a deleted object and comes
// with a cloned or pasted one.

const { test, expect, waitForEditor } = require('./fixtures/hotglue.js');

const box = (left) => ({
	type: 'text', module: 'text',
	'object-left': `${left}px`, 'object-top': '300px',
	'object-width': '160px', 'object-height': '80px', 'object-zindex': '100',
	'text-background-color': 'transparent',
});

const byId = (page, id) => page.locator(`[id="${id}"]`);
const codeBtn = (page) => page.getByTitle(/code for this object/);
const panel = (page) => page.locator('.glue-code-popover');
const styleBox = (page) => panel(page).getByLabel('style');
const scriptBox = (page) => panel(page).getByLabel('script');

async function openCode(page, id) {
	// an object that is moving or changing size is never "stable" to Playwright,
	// so the examples' animations are held still before it is clicked (they are
	// still the object's animations, only paused)
	await page.evaluate(() => document.getAnimations().forEach((a) => a.pause()));
	await byId(page, id).click();
	await expect(codeBtn(page)).toBeVisible();
	await page.waitForTimeout(400);		// the menu fades in
	await codeBtn(page).click();
	await expect(panel(page)).toBeVisible();
}

const rgb = (page, id) => page.evaluate((i) =>
	getComputedStyle(document.getElementById(i)).backgroundColor, id);

test('the code is written in the panel, stored beside the object and applied',
	async ({ page, hg }) => {
		const a = hg.addObject('100000000001', box(100), 'A');
		const b = hg.addObject('100000000002', box(400), 'B');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 2);
		await openCode(page, a);

		// hotglue writes an object's own colours as inline styles, which beat any
		// rule short of !important - so the author has to say it to override one
		await styleBox(page).fill('background: rgb(1, 2, 3) !important;');
		await scriptBox(page).fill("el.setAttribute('data-ran', 'yes');");
		await page.keyboard.press('Escape');
		await expect(panel(page)).toHaveCount(0);

		// stored in an object of its own, as the author's own blocks - and the
		// object's file is not touched
		await expect.poll(() => hg.readObject('code100000000001').content)
			.toContain('background: rgb(1, 2, 3) !important;');
		const stored = hg.readObject('code100000000001');
		expect(stored.attrs.type).toBe('objcode');
		expect(stored.content).toContain('<style>');
		expect(stored.content).toContain('<script>');
		expect(hg.readObject('100000000001').attrs['object-code']).toBeUndefined();

		// the style shows at once, and only on its own object
		await expect.poll(() => rgb(page, a)).toBe('rgb(1, 2, 3)');
		expect(await rgb(page, b)).not.toBe('rgb(1, 2, 3)');

		// after a reload the server applies both, the script handed its object
		await page.reload();
		await waitForEditor(page, 2);
		expect(await rgb(page, a)).toBe('rgb(1, 2, 3)');
		await expect(byId(page, a)).toHaveAttribute('data-ran', 'yes');
		await expect(byId(page, b)).not.toHaveAttribute('data-ran', 'yes');

		// and the published page, which has no editor in it, gets them too
		await page.goto(`/?${hg.pageName}`);
		await expect(byId(page, a)).toHaveAttribute('data-ran', 'yes');
		expect(await rgb(page, a)).toBe('rgb(1, 2, 3)');
	});

test('reopening the panel shows what was written, not the scoped version',
	async ({ page, hg }) => {
		const a = hg.addObject('100000000001', box(100), 'A');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await openCode(page, a);
		await styleBox(page).fill(':hover { opacity: .5 }\n.x { color: red }');
		await scriptBox(page).fill('console.log(el.id);');
		await page.keyboard.press('Escape');
		await expect.poll(() => hg.readObject('code100000000001').content)
			.toContain('console.log');

		await page.reload();
		await waitForEditor(page, 1);
		await openCode(page, a);
		await expect(styleBox(page)).toHaveValue(':hover { opacity: .5 }\n.x { color: red }');
		await expect(scriptBox(page)).toHaveValue('console.log(el.id);');
	});

test('a closing tag in the code is refused, and nothing is stored',
	async ({ page, hg }) => {
		const a = hg.addObject('100000000001', box(100), 'A');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await openCode(page, a);
		await scriptBox(page).fill('var s = "</script>";');
		await expect(panel(page).locator('.glue-code-problem')).toContainText('closing script tag');
		await page.keyboard.press('Escape');
		await page.waitForTimeout(500);
		expect(hg.ids()).not.toContain('code100000000001');
	});

test('emptying both fields removes the code object', async ({ page, hg }) => {
	const a = hg.addObject('100000000001', box(100), 'A');
	hg.addObject('code100000000001', {
		type: 'objcode', module: 'user_code',
	}, '<style>\nbackground: rgb(9, 9, 9) !important;\n</style>');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	expect(await rgb(page, a)).toBe('rgb(9, 9, 9)');
	await openCode(page, a);
	await styleBox(page).fill('');
	await page.keyboard.press('Escape');
	await expect.poll(() => hg.ids()).not.toContain('code100000000001');
	await expect.poll(() => rgb(page, a)).not.toBe('rgb(9, 9, 9)');
});

test('deleting the object deletes its code', async ({ page, hg }) => {
	const a = hg.addObject('100000000001', box(100), 'A');
	hg.addObject('code100000000001', {
		type: 'objcode', module: 'user_code',
	}, '<style>\ncolor: red;\n</style>');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	const res = await page.evaluate((n) => new Promise((ok) =>
		window.$.glue.backend({ method: 'glue.delete_object', name: n }, ok, false)), a);
	expect(res['#error']).toBeFalsy();
	expect(hg.ids()).not.toContain('100000000001');
	expect(hg.ids()).not.toContain('code100000000001');
});

test('a clone and a paste get their own copy of the code', async ({ page, hg }) => {
	const a = hg.addObject('100000000001', box(100), 'A');
	hg.addObject('code100000000001', {
		type: 'objcode', module: 'user_code',
	}, '<style>\ncolor: red;\n</style>');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);

	const call = (req) => page.evaluate((r) => new Promise((ok) =>
		window.$.glue.backend(r, ok, false)), req);
	const cloned = (await call({ method: 'glue.clone_object', name: a }))['#data'];
	const cloneId = cloned.split('.').pop();
	expect(hg.readObject('code' + cloneId).content).toContain('color: red;');

	const got = (await call({ method: 'glue.get_object', name: a }))['#data'];
	expect(got.code).toContain('color: red;');
	const pasted = (await call({
		method: 'glue.paste_object', page: hg.pageName,
		clipboard: { v: 2, name: got.name, source_page: got.page,
			attrs: got.attrs, content: got.content, code: got.code },
	}))['#data'];
	const pastedId = pasted.name.split('.').pop();
	expect(hg.readObject('code' + pastedId).content).toContain('color: red;');
	// and the original's own is still there
	expect(hg.readObject('code100000000001').content).toContain('color: red;');
});

test('only a numbered object can carry code', async ({ page, hg }) => {
	hg.addObject('100000000001', box(100), 'A');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	const call = (req) => page.evaluate((r) => new Promise((ok) =>
		window.$.glue.backend(r, ok, false)), req);
	for (const name of [`${hg.pageName}.page`, `${hg.pageName}.userhead`,
		`${hg.pageName}.code100000000001`]) {
		const res = await call({ method: 'user_code.set_object_code', name, code: '<style>a{b:c}</style>' });
		expect(res['#error'], name).toBeTruthy();
	}
});

// The examples dropdown. An example is added to the fields after whatever is
// there and goes through the same save as typed code, so each one is checked
// by what it does to the object once it has been saved and the page reloaded.

const examples = (page) => panel(page).getByLabel('insert an example');

async function insertExample(page, label) {
	await examples(page).selectOption({ label });
	await page.waitForTimeout(100);
}

test('an example is added after what is already written, never over it',
	async ({ page, hg }) => {
		const a = hg.addObject('100000000001', box(100), 'A');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await openCode(page, a);
		await styleBox(page).fill('color: red;');
		await insertExample(page, 'spin');
		const value = await styleBox(page).inputValue();
		expect(value.startsWith('color: red;')).toBe(true);
		expect(value).toContain('@keyframes ex-spin');
		// the dropdown is ready for the next one
		await expect(examples(page)).toHaveValue('');
		await insertExample(page, 'orbit in a circle');
		expect(await styleBox(page).inputValue()).toContain('@keyframes ex-orbit');
		expect(await styleBox(page).inputValue()).toContain('@keyframes ex-spin');
	});

test('the style examples animate the object', async ({ page, hg }) => {
	const a = hg.addObject('100000000001', box(100), 'A');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await openCode(page, a);
	await insertExample(page, 'spin');
	await page.keyboard.press('Escape');
	await expect.poll(() => hg.readObject('code100000000001').content).toContain('ex-spin');
	await page.reload();
	await waitForEditor(page, 1);
	const anim = () => page.evaluate((i) => {
		const s = getComputedStyle(document.getElementById(i));
		return [s.animationName, s.animationDuration];
	}, a);
	expect(await anim()).toEqual(['ex-spin', '6s']);

	// the orbit swaps in for it
	await openCode(page, a);
	await styleBox(page).fill('');
	await insertExample(page, 'orbit in a circle');
	await page.keyboard.press('Escape');
	await expect.poll(async () => (await anim())[0]).toBe('ex-orbit');
});

test('the script examples act on the object', async ({ page, hg }) => {
	const a = hg.addObject('100000000001', box(100), 'A');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);

	// breathe: one running animation, drawn without writing the object's own
	// position or size
	await openCode(page, a);
	await insertExample(page, 'breathe: grow and shrink by 20px, staying centred');
	await page.keyboard.press('Escape');
	await expect.poll(() => hg.readObject('code100000000001').content).toContain('el.animate');
	await page.reload();
	await waitForEditor(page, 1);
	await expect.poll(() => page.evaluate((i) =>
		document.getElementById(i).getAnimations().length, a)).toBeGreaterThan(0);
	expect(await page.evaluate((i) => document.getElementById(i).style.width, a))
		.toBe('160px');

	// the class toggle: a click puts the class on, and the style shows it
	await openCode(page, a);
	await scriptBox(page).fill('');
	await insertExample(page, 'switch a class on and off by clicking');
	await page.keyboard.press('Escape');
	await expect.poll(() => hg.readObject('code100000000001').content).toContain('toggle');
	await page.reload();
	await waitForEditor(page, 1);
	await page.evaluate(() => document.getAnimations().forEach((x) => x.pause()));
	await byId(page, a).click();
	await expect(byId(page, a)).toHaveClass(/\bon\b/);
	await expect.poll(() => rgb(page, a)).toBe('rgb(255, 215, 0)');
});
