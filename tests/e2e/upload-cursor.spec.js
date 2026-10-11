// The upload buttons are a file input laid invisibly over an icon, so the
// input is what the pointer is over: it wears the pointer cursor itself.

const { test, expect, waitForEditor } = require('./fixtures/hotglue.js');

test('the upload asset and upload file buttons show the pointer cursor', async ({ page, hg }) => {
	await page.goto(hg.editUrl());
	await waitForEditor(page, 0);
	await page.mouse.click(400, 400);
	const inputs = page.locator('.glue-upload-input');
	await expect(inputs).toHaveCount(2);
	for (const i of [0, 1]) {
		expect(await inputs.nth(i).evaluate((el) => getComputedStyle(el).cursor)).toBe('pointer');
	}
});
