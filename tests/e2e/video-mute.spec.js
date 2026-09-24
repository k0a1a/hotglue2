// The video mute toggle must change the LIVE mute state, not only the
// stored attribute. A media element locks its mute state in when the
// resource loads - afterwards flipping the muted attribute alone does
// nothing (the button changed its own title while the audio stayed
// exactly as it was), so the toggle sets the property alongside the
// attribute. The seeded object is the fresh-upload state: autoplay,
// muted, no loop, so a restart (currentTime dropping) is visible too.

const fs = require('fs');
const path = require('path');
const { test, expect, waitForEditor, CONTENT } = require('./fixtures/hotglue.js');

const seed = (hg) => {
	const shared = path.join(CONTENT, hg.pageName.split('.')[0], 'shared');
	fs.mkdirSync(shared, { recursive: true });
	fs.copyFileSync(path.join(__dirname, 'fixtures', 'sample-mute.mov'),
		path.join(shared, 'sample-mute.mov'));
	return hg.addObject('100000000001', {
		type: 'video', module: 'video',
		'object-left': '100px', 'object-top': '100px',
		'object-width': '320px', 'object-height': '240px', 'object-zindex': '100',
		'video-file': 'sample-mute.mov', 'video-file-mime': 'video/quicktime',
		'video-autoplay': 'autoplay', 'video-volume': '0',
	});
};

const videoState = (page) => page.evaluate(() => {
	const v = document.querySelector('.video.object video');
	return { muted: v.muted, mutedAttr: v.hasAttribute('muted'), t: v.currentTime };
});
const stored = (hg) => hg.readObject('100000000001').attrs['video-volume'];

test('the mute toggle changes the live state and the playback keeps its place',
	async ({ page, hg }) => {
		seed(hg);
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		const obj = page.locator('.video.object');
		await expect(obj.locator('video')).toHaveCount(1);

		// it autoplays muted (the fresh-upload default)
		await expect.poll(() => videoState(page).then((s) => s.t)).toBeGreaterThan(0.2);

		const bb = await obj.boundingBox();
		await page.mouse.click(bb.x + bb.width / 2, bb.y + bb.height * 0.2);
		const muteBtn = page.locator('#glue-contextmenu-video-mute');

		// unmute: the live state flips AND the playback position does not
		// restart from the beginning
		const t0 = (await videoState(page)).t;
		await muteBtn.click();
		await expect.poll(() => videoState(page).then((s) => s.muted)).toBe(false);
		const s1 = await videoState(page);
		expect(s1.mutedAttr).toBe(false);
		expect(s1.t).toBeGreaterThanOrEqual(t0);
		await expect.poll(() => stored(hg)).toBeUndefined();

		// mute again: both flip back, still no restart
		const t1 = s1.t;
		await muteBtn.click();
		await expect.poll(() => videoState(page).then((s) => s.muted)).toBe(true);
		const s2 = await videoState(page);
		expect(s2.mutedAttr).toBe(true);
		expect(s2.t).toBeGreaterThanOrEqual(t1);
		await expect.poll(() => stored(hg)).toBe('0');
	});
