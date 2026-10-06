// The list buttons of the text panel: each selected line becomes a list
// item.
//
// Text objects are edited WYSIWYG: the rendered div is contenteditable, and
// the lines the author sees are the runs between the marked <br>s that
// to_editing_html writes for stored newlines and the Enter handler writes
// for typed ones. A list button splits the selection at those separators,
// wraps each line in <li>, and the items in <ul> (bulleted list) or <ol>
// (numbered list). The source form is still what gets stored, and is only
// materialised when editing ends - so these assert on the stored content
// after leaving edit mode, which exercises the whole chain rather than an
// intermediate. The buttons wear the 22x22 redraws of the set
// (list-bulleted-22.svg / list-ordered-22.svg), like the toggles beside
// them, and are told apart by their tooltips.
//
// The buttons are the run's own: they gray out while nothing is selected.
// Inside a list they are toggles instead: the kind the list already wears
// takes it off (each item's content becomes a line again), the other kind
// converts it - and a caret inside is enough to target the list, the way a
// caret inside a link targets the link. There is no object mode - no
// whole-object list.
//
// The stored format passes <ul>/<ol>/<li> through untouched on both the
// save and the render side, so the round trip and the published page are
// asserted too.

const { test, expect, waitForEditor } = require('./fixtures/hotglue.js');

const ATTRS = {
	type: 'text', module: 'text',
	'object-left': '200px', 'object-top': '200px',
	'object-width': '300px', 'object-height': '120px', 'object-zindex': '100',
	'text-background-color': 'transparent',
};

const byId = (page, id) => page.locator(`[id="${id}"]`);
const stored = (hg) => hg.readObject('100000000001').content;
const panel = (page) => page.locator('.glue-font-popover');
const fontBtn = (page) => page.getByTitle(/font: face, size and style/);
const listBtn = (page, title) => panel(page).locator(`.glue-popover-icon[title="${title}"]`);

async function startEditing(page, id) {
	await byId(page, id).click();
	await byId(page, id).click();
	await expect.poll(() => page.evaluate((i) =>
		document.querySelector(`[id="${i}"] > .glue-text-render`).isContentEditable, id)).toBe(true);
}

// editing first, then the panel from the menu - it is the WYSIWYG
// surface's toolbar, and the list buttons live in it
async function openPanel(page, id) {
	await startEditing(page, id);
	await expect(fontBtn(page)).toBeVisible();
	await page.waitForTimeout(400);		// the menu fades in
	await fontBtn(page).click();
	await expect(panel(page)).toBeVisible();
}

// select everything in the render, the way ctrl+a would
async function selectAll(page, id) {
	await page.evaluate((i) => {
		const render = document.querySelector(`[id="${i}"] > .glue-text-render`);
		const r = document.createRange();
		r.selectNodeContents(render);
		const s = window.getSelection();
		s.removeAllRanges();
		s.addRange(r);
	}, id);
}

// select from the first occurrence of `from` to the end of the LAST
// occurrence of `to`. The walk crosses line boundaries by construction -
// the marked <br>s are elements, and a range from the first text node to
// the last covers everything between them.
async function selectRange(page, id, from, to) {
	const ok = await page.evaluate(([i, f, t]) => {
		const render = document.querySelector(`[id="${i}"] > .glue-text-render`);
		const walker = document.createTreeWalker(render, NodeFilter.SHOW_TEXT);
		let start = null, end = null, node;
		while ((node = walker.nextNode())) {
			if (!start) {
				const at = node.data.indexOf(f);
				if (at !== -1) {
					const r = document.createRange();
					r.setStart(node, at);
					start = r;
				}
			}
			const at2 = node.data.lastIndexOf(t);
			if (at2 !== -1) {
				const r2 = document.createRange();
				r2.setEnd(node, at2 + t.length);
				end = r2;
			}
		}
		if (!start || !end) {
			return false;
		}
		const r = document.createRange();
		r.setStart(start.startContainer, start.startOffset);
		r.setEnd(end.endContainer, end.endOffset);
		const s = window.getSelection();
		s.removeAllRanges();
		s.addRange(r);
		return true;
	}, [id, from, to]);
	expect(ok, `could not find ${JSON.stringify(from)}..${JSON.stringify(to)} in the rendered text`).toBe(true);
}

async function finish(page, id) {
	await page.evaluate((i) => window.$.glue.text.stop_editing(document.getElementById(i)), id);
}

// collapse the caret at the start of the first item - inside a list that is
// enough to target the list, so the buttons stay alive
async function caretInList(page, id) {
	await page.evaluate((i) => {
		const render = document.querySelector(`[id="${i}"] > .glue-text-render`);
		const li = render.querySelector('li');
		const r = document.createRange();
		r.setStart(li.firstChild, 0);
		r.collapse(true);
		const s = window.getSelection();
		s.removeAllRanges();
		s.addRange(r);
	}, id);
}

// select the whole first item
async function selectItem(page, id) {
	await page.evaluate((i) => {
		const render = document.querySelector(`[id="${i}"] > .glue-text-render`);
		const li = render.querySelector('li');
		const r = document.createRange();
		r.selectNodeContents(li);
		const s = window.getSelection();
		s.removeAllRanges();
		s.addRange(r);
	}, id);
}

test('the list buttons join the align row, and gray until a run is selected',
	async ({ page, hg }) => {
		const a = hg.addObject('100000000001', ATTRS, 'one\ntwo\nthree');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await openPanel(page, a);

		// both buttons are there from the moment the panel opens; with
		// nothing selected, they are grayed - they are the run's own
		await expect(listBtn(page, 'bulleted list')).toBeVisible();
		await expect(listBtn(page, 'numbered list')).toBeVisible();
		await expect(listBtn(page, 'bulleted list')).toHaveClass(/glue-popover-disabled/);
		await expect(listBtn(page, 'numbered list')).toHaveClass(/glue-popover-disabled/);

		// a run selected inside the render brings them alive
		await selectAll(page, a);
		await expect(listBtn(page, 'bulleted list')).not.toHaveClass(/glue-popover-disabled/);
		await expect(listBtn(page, 'numbered list')).not.toHaveClass(/glue-popover-disabled/);
	});

test('the bulleted button wraps each selected line in its own li',
	async ({ page, hg }) => {
		const a = hg.addObject('100000000001', ATTRS, 'one\ntwo\nthree');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await openPanel(page, a);
		await selectAll(page, a);

		await listBtn(page, 'bulleted list').click();
		await finish(page, a);

		await expect.poll(() => stored(hg))
			.toBe('<ul><li>one</li><li>two</li><li>three</li></ul>');
	});

test('the numbered button wraps in ol', async ({ page, hg }) => {
	const a = hg.addObject('100000000001', ATTRS, 'one\ntwo\nthree');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await openPanel(page, a);
	await selectAll(page, a);

	await listBtn(page, 'numbered list').click();
	await finish(page, a);

	await expect.poll(() => stored(hg))
		.toBe('<ol><li>one</li><li>two</li><li>three</li></ol>');
});

test('partial first and last lines become partial items',
	async ({ page, hg }) => {
		const a = hg.addObject('100000000001', ATTRS, 'alpha\nbeta\ngamma');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await openPanel(page, a);
		// from inside 'alpha' to inside 'gamma': the author gets exactly
		// what they selected, same as every other run op
		await selectRange(page, a, 'lph', 'amm');

		await listBtn(page, 'bulleted list').click();
		await finish(page, a);

		await expect.poll(() => stored(hg))
			.toBe('a<ul><li>lpha</li><li>beta</li><li>gamm</li></ul>a');
	});

test('blank lines are dropped, interior and trailing',
	async ({ page, hg }) => {
		// the trailing newline is a trailing marked br - select-all would
		// otherwise make it an empty item on every page
		const a = hg.addObject('100000000001', ATTRS, 'one\n\ntwo\n');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await openPanel(page, a);
		await selectAll(page, a);

		await listBtn(page, 'bulleted list').click();
		await finish(page, a);

		await expect.poll(() => stored(hg))
			.toBe('<ul><li>one</li><li>two</li></ul>');
	});

test('with nothing selected the buttons stay grayed and the content is untouched',
	async ({ page, hg }) => {
		const a = hg.addObject('100000000001', ATTRS, 'one\ntwo\nthree');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await openPanel(page, a);

		// the gray-out is pointer-events:none, so no click can reach the
		// handler - assert the state, then leave the content alone
		await expect(listBtn(page, 'bulleted list')).toHaveClass(/glue-popover-disabled/);
		await finish(page, a);

		await expect.poll(() => stored(hg)).toBe('one\ntwo\nthree');
	});

test('a caret inside a list keeps the buttons alive, and numbered converts it',
	async ({ page, hg }) => {
		const a = hg.addObject('100000000001', ATTRS, 'one\ntwo\nthree');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await openPanel(page, a);
		await selectAll(page, a);
		await listBtn(page, 'bulleted list').click();
		await finish(page, a);
		await expect.poll(() => stored(hg))
			.toBe('<ul><li>one</li><li>two</li><li>three</li></ul>');

		// back into editing: a bare caret in an item is enough to target
		// the list - the buttons stay alive, and numbered converts it
		await openPanel(page, a);
		await caretInList(page, a);
		await expect(listBtn(page, 'numbered list')).not.toHaveClass(/glue-popover-disabled/);
		await listBtn(page, 'numbered list').click();
		await finish(page, a);

		await expect.poll(() => stored(hg))
			.toBe('<ol><li>one</li><li>two</li><li>three</li></ol>');
	});

test('the bulleted button converts a numbered list', async ({ page, hg }) => {
	const a = hg.addObject('100000000001', ATTRS, 'one\ntwo\nthree');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await openPanel(page, a);
	await selectAll(page, a);
	await listBtn(page, 'numbered list').click();
	await finish(page, a);
	await expect.poll(() => stored(hg))
		.toBe('<ol><li>one</li><li>two</li><li>three</li></ol>');

	await openPanel(page, a);
	await selectItem(page, a);
	await listBtn(page, 'bulleted list').click();
	await finish(page, a);

	await expect.poll(() => stored(hg))
		.toBe('<ul><li>one</li><li>two</li><li>three</li></ul>');
});

test('the button the list already wears takes the list off',
	async ({ page, hg }) => {
		const a = hg.addObject('100000000001', ATTRS, 'one\ntwo\nthree');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await openPanel(page, a);
		await selectAll(page, a);
		await listBtn(page, 'bulleted list').click();
		await finish(page, a);
		await expect.poll(() => stored(hg))
			.toBe('<ul><li>one</li><li>two</li><li>three</li></ul>');

		// the list is the last thing in the render, so un-listing leaves no
		// trailing separator: the stored form is the plain lines again
		await openPanel(page, a);
		await selectItem(page, a);
		await listBtn(page, 'bulleted list').click();
		await finish(page, a);

		await expect.poll(() => stored(hg)).toBe('one\ntwo\nthree');
	});

test('un-listing keeps what followed the list on its own line',
	async ({ page, hg }) => {
		const a = hg.addObject('100000000001', ATTRS,
			'<ul><li>one</li><li>two</li></ul> tail');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await openPanel(page, a);

		await selectItem(page, a);
		await listBtn(page, 'bulleted list').click();
		await finish(page, a);

		// a separator after the last item because something follows the
		// list - ' tail' (its own leading space included) is a line of its
		// own, not part of item two
		await expect.poll(() => stored(hg)).toBe('one\ntwo\n tail');
	});

test('the list survives the editing round trip', async ({ page, hg }) => {
	const a = hg.addObject('100000000001', ATTRS, 'one\ntwo\nthree');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await openPanel(page, a);
	await selectAll(page, a);
	await listBtn(page, 'numbered list').click();
	await finish(page, a);
	await expect.poll(() => stored(hg))
		.toBe('<ol><li>one</li><li>two</li><li>three</li></ol>');

	// enter editing again: the markup is projected back into a list on
	// screen (textContent carries no <li>), and leaving edit mode stores
	// it unchanged. Runs on both engines, so this doubles as the
	// cross-engine serialization check.
	await openPanel(page, a);
	const txt = await page.evaluate((i) =>
		document.querySelector(`[id="${i}"] > .glue-text-render`).textContent, a);
	expect(txt).toBe('onetwothree');
	expect(txt).not.toContain('<');
	await finish(page, a);

	await expect.poll(() => stored(hg))
		.toBe('<ol><li>one</li><li>two</li><li>three</li></ol>');
});

test('the list renders as a list on the published page', async ({ page, hg }) => {
	const a = hg.addObject('100000000001', ATTRS, 'one\ntwo\nthree');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await openPanel(page, a);
	await selectAll(page, a);
	await listBtn(page, 'bulleted list').click();
	await finish(page, a);

	// the real page a visitor gets: three items, and a disc marker -
	// css/main.css re-asserts it on the li, because reset.css's own
	// li { list-style: none; } would beat an inherited value from the ul
	await page.goto(`/?${hg.pageName}`);
	const items = page.locator('.object li');
	await expect(items).toHaveCount(3);
	await expect(items.nth(0)).toHaveText('one');
	await expect(items.nth(1)).toHaveText('two');
	await expect(items.nth(2)).toHaveText('three');
	await expect.poll(() => page.evaluate(() =>
		getComputedStyle(document.querySelector('.object li')).listStyleType)).toBe('disc');
});

test('Enter inside a list makes a new item, and Enter on an empty item steps out',
	async ({ page, hg }) => {
		const a = hg.addObject('100000000001', ATTRS, 'one\ntwo\nthree');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await openPanel(page, a);
		await selectAll(page, a);
		await listBtn(page, 'bulleted list').click();

		// the caret is at the start of the first item; move to its end and
		// Enter - inside a list the browser's own Enter applies (the marked
		// <br> knows nothing about items), so a new item opens
		await page.keyboard.press('End');
		await page.keyboard.press('Enter');
		await expect.poll(() => page.locator('.object li').count()).toBe(4);
		await page.keyboard.type('x');
		// Enter on the still-empty item steps OUT of the list
		await page.keyboard.press('Enter');
		await page.keyboard.press('Enter');
		await page.keyboard.type('tail');
		await finish(page, a);

		// whatever block the exit produced is unwrapped to a newline at
		// commit, so both engines store the list and the text after it -
		// and the tail is NOT an item of its own
		await expect.poll(() => stored(hg)).toContain('<ul><li>one</li><li>x</li>');
		await expect.poll(() => stored(hg)).toContain('tail');
		await expect.poll(() => stored(hg)).not.toContain('<li>tail');
	});

test('a list edit is one undo step away', async ({ page, hg }) => {
	const a = hg.addObject('100000000001', ATTRS, 'one\ntwo\nthree');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await openPanel(page, a);
	await selectAll(page, a);
	await listBtn(page, 'bulleted list').click();
	await finish(page, a);
	await expect.poll(() => stored(hg))
		.toBe('<ul><li>one</li><li>two</li><li>three</li></ul>');

	// ctrl-z outside any field: the edit session's content change reverts
	// (the html snapshots carry attributes only, so a content change is an
	// undo entry of its own)
	await page.keyboard.press('Control+z');
	await expect.poll(() => stored(hg)).toBe('one\ntwo\nthree');
	// and the redo brings it back
	await page.keyboard.press('Control+y');
	await expect.poll(() => stored(hg))
		.toBe('<ul><li>one</li><li>two</li><li>three</li></ul>');
});
