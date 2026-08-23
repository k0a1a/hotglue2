// Spacing and alignment: line height, letter spacing, word spacing, the four
// alignments and a reset. Four buttons once - three that had to be dragged,
// where a click on the same button quietly meant "reset", and one that cycled
// left -> centre -> right -> justify - then a panel of its own, and now the
// advanced fold of the font panel, since it is the same subject and most
// objects never touch it.
//
// The units matter and are not arbitrary. The three spacings are written in
// em, which is what the controls they replace wrote: it keeps them
// proportional when the type is resized later. Line height is SHOWN as a
// multiple of the font size, because that is how anyone reasons about it, but
// stored the same way as before.
//
// Reset clears the properties rather than writing defaults into them, so a
// reset object goes back to being byte-identical to one nobody ever touched.

const { test, expect, waitForEditor } = require('./fixtures/hotglue.js');

const ATTRS = {
	type: 'text', module: 'text',
	'object-left': '340px', 'object-top': '320px',
	'object-width': '220px', 'object-height': '120px', 'object-zindex': '100',
	'text-background-color': 'transparent', 'text-font-size': '20px',
};

const byId = (page, id) => page.locator(`[id="${id}"]`);
const fontBtn = (page) => page.getByTitle(/font: face, size and style/);
const pop = (page) => page.locator('.glue-font-popover .glue-popover-advanced');
const rowField = (page, n) => pop(page).locator('.glue-popover-field').nth(n);
const rowSlider = (page, n) => pop(page).locator('.glue-popover-slider').nth(n);
const alignBtn = (page, which) => pop(page).locator(`[data-align="${which}"]`);
const cssOf = (page, id, prop) => page.evaluate(([i, p]) =>
	getComputedStyle(document.getElementById(i))[p], [id, prop]);
const attrs = (hg) => hg.readObject('100000000001').attrs;

// the rows in order: line, letter, word
const LINE = 0, LETTER = 1, WORD = 2;

async function open(page, id) {
	const obj = byId(page, id);
	if (!(await obj.evaluate((e) => e.classList.contains('glue-selected')))) {
		await obj.click();
	}
	await expect(fontBtn(page)).toBeVisible();
	await page.waitForTimeout(400);		// the menu fades in
	await fontBtn(page).click();
	await expect(page.locator('.glue-font-popover')).toBeVisible();
	// spacing lives in the fold, which starts closed
	await page.locator('.glue-popover-disclosure').click();
	await expect(pop(page)).toBeVisible();
}

async function setRow(page, n, value) {
	const field = rowField(page, n);
	await field.fill(String(value));
	await field.dispatchEvent('input');
	await field.dispatchEvent('change');
}

test('the fold holds all of it, and the buttons it replaced are gone',
	async ({ page, hg }) => {
		const a = hg.addObject('100000000001', ATTRS, 'A');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await open(page, a);

		// line, letter, word - plus the text shadow's radius and fade
		await expect(pop(page).locator('.glue-popover-slider')).toHaveCount(5);
		await expect(pop(page).locator('.glue-align-btn')).toHaveCount(4);
		await expect(pop(page).locator('.glue-popover-reset')).toHaveCount(1);

		for (const gone of ['text-line-height', 'text-letter-spacing',
			'text-word-spacing', 'text-align', 'text-spacing']) {
			expect(await page.locator(`#glue-contextmenu-${gone}`).count(),
				`${gone} is still in the menu`).toBe(0);
		}
	});

test('it opens beside the object, not over it', async ({ page, hg }) => {
	const a = hg.addObject('100000000001', ATTRS, 'A');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await open(page, a);

	const o = await byId(page, a).boundingBox();
	const p = await pop(page).boundingBox();
	const overlaps = p.x < o.x + o.width && o.x < p.x + p.width &&
		p.y < o.y + o.height && o.y < p.y + p.height;
	expect(overlaps, 'the panel is sitting on top of the object').toBe(false);
});

test('line height is shown as a multiple and stored in em', async ({ page, hg }) => {
	// 40px of line on 20px of type is 2 - and 2 is what the field should say,
	// not 40
	const a = hg.addObject('100000000001',
		{ ...ATTRS, 'text-line-height': '40px' }, 'A');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await open(page, a);

	await expect(rowField(page, LINE)).toHaveValue('2.00');

	await setRow(page, LINE, 1.5);
	await expect.poll(() => cssOf(page, a, 'lineHeight')).toBe('30px');
	await expect.poll(() => attrs(hg)['text-line-height']).toBe('1.5em');
});

test('letter and word spacing apply, in em', async ({ page, hg }) => {
	const a = hg.addObject('100000000001', ATTRS, 'A');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await open(page, a);

	// nothing set reads as zero rather than as 'normal'
	await expect(rowField(page, LETTER)).toHaveValue('0.00');
	await expect(rowField(page, WORD)).toHaveValue('0.00');

	await setRow(page, LETTER, 0.1);
	await setRow(page, WORD, 0.5);
	// 0.1em and 0.5em of 20px type
	await expect.poll(() => cssOf(page, a, 'letterSpacing')).toBe('2px');
	await expect.poll(() => cssOf(page, a, 'wordSpacing')).toBe('10px');
	await expect.poll(() => attrs(hg)['text-letter-spacing']).toBe('0.1em');
	await expect.poll(() => attrs(hg)['text-word-spacing']).toBe('0.5em');
});

test('negative letter spacing is allowed', async ({ page, hg }) => {
	// tightening is as legitimate as loosening, and the old drag control
	// allowed it
	const a = hg.addObject('100000000001', ATTRS, 'A');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await open(page, a);

	await setRow(page, LETTER, -0.05);
	await expect.poll(() => cssOf(page, a, 'letterSpacing')).toBe('-1px');
});

test('the field is not capped by its slider', async ({ page, hg }) => {
	const a = hg.addObject('100000000001', ATTRS, 'A');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await open(page, a);

	await setRow(page, LINE, 8);
	await expect(rowSlider(page, LINE)).toHaveValue('3');
	await expect(rowField(page, LINE)).toHaveValue('8.00');
	await expect.poll(() => cssOf(page, a, 'lineHeight')).toBe('160px');
});

test('the slider and the field stay in step', async ({ page, hg }) => {
	const a = hg.addObject('100000000001', ATTRS, 'A');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await open(page, a);

	const slider = rowSlider(page, WORD);
	await slider.fill('1.2');
	await slider.dispatchEvent('input');
	await expect(rowField(page, WORD)).toHaveValue('1.20');
	await expect.poll(() => cssOf(page, a, 'wordSpacing')).toBe('24px');
});

test('the four alignment buttons set alignment, and show which one is on',
	async ({ page, hg }) => {
		const a = hg.addObject('100000000001', ATTRS, 'A');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await open(page, a);

		// nothing set: computed text-align is 'start', which is left here -
		// the panel should say left rather than none of them
		await expect(alignBtn(page, 'left')).toHaveClass(/glue-align-on/);

		for (const which of ['center', 'right', 'justify']) {
			await alignBtn(page, which).click();
			await expect.poll(() => cssOf(page, a, 'textAlign')).toBe(which);
			await expect(alignBtn(page, which)).toHaveClass(/glue-align-on/);
			await expect(alignBtn(page, 'left')).not.toHaveClass(/glue-align-on/);
			await expect.poll(() => attrs(hg)['text-align']).toBe(which);
		}
	});

test('the reset in the fold clears the whole panel, not just the spacing',
	async ({ page, hg }) => {
		// it is one panel now, so one reset: face, size, style, colour and
		// spacing all go back to what an untouched object has
		const a = hg.addObject('100000000001', {
			...ATTRS, 'text-font-size': '40px', 'text-font-weight': 'bold',
			'text-font-family': 'Georgia, serif', 'text-font-color': '#ff0000',
			'text-letter-spacing': '0.2em', 'text-align': 'right',
		}, 'A');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await open(page, a);

		await pop(page).locator('.glue-popover-reset').click();
		for (const gone of ['text-font-size', 'text-font-weight', 'text-font-family',
			'text-font-color', 'text-letter-spacing', 'text-align']) {
			await expect.poll(() => attrs(hg)[gone],
				`${gone} survived the reset`).toBe(undefined);
		}
		// and the controls above the fold say so too
		await expect(page.locator('.glue-font-toggle-bold'))
			.not.toHaveClass(/glue-font-toggle-on/);
	});

test('reset clears the properties rather than writing defaults into them',
	async ({ page, hg }) => {
		const a = hg.addObject('100000000001', {
			...ATTRS, 'text-line-height': '40px', 'text-letter-spacing': '0.2em',
			'text-word-spacing': '0.4em', 'text-align': 'justify',
		}, 'A');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await open(page, a);

		await pop(page).locator('.glue-popover-reset').click();

		for (const gone of ['text-line-height', 'text-letter-spacing',
			'text-word-spacing', 'text-align']) {
			await expect.poll(() => attrs(hg)[gone],
				`${gone} was stored rather than cleared`).toBe(undefined);
		}
		// and the panel now says what is true, not what it said before
		await expect(rowField(page, LETTER)).toHaveValue('0.00');
		await expect(rowField(page, WORD)).toHaveValue('0.00');
		await expect(alignBtn(page, 'justify')).not.toHaveClass(/glue-align-on/);
		await expect(alignBtn(page, 'left')).toHaveClass(/glue-align-on/);
	});

test('the spacing survives a reload and reaches the published page',
	async ({ page, hg }) => {
		const a = hg.addObject('100000000001', ATTRS, 'A');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await open(page, a);

		await setRow(page, LETTER, 0.15);
		await alignBtn(page, 'right').click();
		await expect.poll(() => attrs(hg)['text-letter-spacing']).toBe('0.15em');

		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		expect(await cssOf(page, a, 'letterSpacing')).toBe('3px');
		expect(await cssOf(page, a, 'textAlign')).toBe('right');

		await page.goto(`/?${hg.pageName}`);
		const published = await page.evaluate(() => {
			const cs = getComputedStyle(document.querySelector('.object'));
			return [cs.letterSpacing, cs.textAlign];
		});
		expect(published).toEqual(['3px', 'right']);
	});

test('a click outside closes it, and Escape closes it', async ({ page, hg }) => {
	const a = hg.addObject('100000000001', ATTRS, 'A');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await open(page, a);

	await page.mouse.click(30, 30);
	await expect(pop(page)).toHaveCount(0);

	await open(page, a);
	await page.keyboard.press('Escape');
	await expect(pop(page)).toHaveCount(0);
});
