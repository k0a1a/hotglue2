// Audio objects - the video module's flow for sound: an m4a upload becomes
// an audio object that re-encodes to 44.1kHz stereo 128kbps in the
// background, shows as a sound icon, sits paused by default, and plays on
// click. The upload route is image-upload.spec.js's: alt+o opens the 'new'
// menu without the single/double-click timing race, then the generic
// upload button takes the file.

const fs = require('fs');
const path = require('path');
const { test, expect, waitForEditor, CONTENT } = require('./fixtures/hotglue.js');

const SAMPLE = path.join(__dirname, 'fixtures', 'sample.m4a');

async function uploadViaNewMenu(page, file) {
	await page.keyboard.press('Alt+o');
	// the button's artwork is now a mask icon (.glue-btn-icon); the input
	// keeps the button's tooltip, so it is the handle to the button
	const input = page.locator('input[title="upload a file"]').first();
	await expect(input).toBeAttached();
	// The button's own click handler is what records WHERE the upload should
	// land ($.glue.menu.spawn_coords()), and the file input is a transparent
	// overlay on top of it - so fire the button's click first, then hand the
	// input its file. Driving the file chooser instead skips the handler.
	await page.evaluate(() => {
		document.querySelector('input[title="upload a file"]').parentElement
			.dispatchEvent(new MouseEvent('click', { bubbles: true }));
	});
	await input.setInputFiles(file);
}

const sharedDir = (hg) => path.join(CONTENT, hg.pageName.split('.')[0], 'shared');

const audioOf = (page) => page.locator('.audio.object');

// the object sits paused until the encode finishes or the placeholder
// resolves - wait for the real <audio> element either way
const awaitAudio = async (page) => {
	await expect(page.locator('.audio.object audio')).toBeAttached({ timeout: 15000 });
};

test('uploading an m4a creates an audio object that plays on click',
	async ({ page, hg }) => {
		hg.addObject('100000000001', {
			type: 'text', module: 'text', 'object-left': '50px', 'object-top': '50px',
			'object-width': '100px', 'object-height': '50px', 'object-zindex': '100',
			'text-background-color': 'transparent',
		}, 'seed');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);

		await uploadViaNewMenu(page, SAMPLE);
		await expect(audioOf(page)).toHaveCount(1, { timeout: 10000 });
		// the object wears its sound icon
		await expect(audioOf(page).locator('img.audio-icon')).toBeVisible();

		await awaitAudio(page);

		// paused by default - a fresh upload never plays by itself
		expect(await audioOf(page).locator('audio').evaluate((a) => a.paused)).toBe(true);
		// and the click starts it (the click lands on the <audio> element
		// under the icon, below the edit shield)
		await audioOf(page).click();
		await expect.poll(() => audioOf(page).locator('audio').evaluate((a) => a.paused))
			.toBe(false);

		// the file landed in the page's shared directory (original or the
		// encoded -audio.m4a, depending on whether ffmpeg was available)
		expect(fs.readdirSync(sharedDir(hg)).some((f) => /\.m4a$/.test(f))).toBe(true);

		// and an audio object was written
		await expect.poll(() => hg.ids().length, { timeout: 5000 }).toBeGreaterThan(1);
		const id = hg.ids().find((f) => f !== '100000000001' && f !== 'page');
		const attrs = hg.readObject(id).attrs;
		expect(attrs['type']).toBe('audio');
		expect(attrs['audio-file-mime']).toBe('audio/mp4');
	});

test('the published page shows the sound icon and plays on click', async ({ page, hg }) => {
	hg.addObject('100000000001', {
		type: 'text', module: 'text', 'object-left': '50px', 'object-top': '50px',
		'object-width': '100px', 'object-height': '50px', 'object-zindex': '100',
		'text-background-color': 'transparent',
	}, 'seed');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);
	await uploadViaNewMenu(page, SAMPLE);
	await expect(audioOf(page)).toHaveCount(1, { timeout: 10000 });
	await awaitAudio(page);

	await page.goto(`/?${hg.pageName}`);
	await expect(audioOf(page)).toHaveCount(1);
	await expect(audioOf(page).locator('img.audio-icon')).toBeVisible();
	expect(await audioOf(page).locator('audio').evaluate((a) => a.paused)).toBe(true);
	// the icon lets the click through to the <audio> element under it
	await audioOf(page).click();
	await expect.poll(() => audioOf(page).locator('audio').evaluate((a) => a.paused))
		.toBe(false);
});

test('the menu is video\'s: the four toggles and download, and no reset-size',
	async ({ page, hg }) => {
		hg.addObject('100000000001', {
			type: 'text', module: 'text', 'object-left': '50px', 'object-top': '50px',
			'object-width': '100px', 'object-height': '50px', 'object-zindex': '100',
			'text-background-color': 'transparent',
		}, 'seed');
		await page.goto(hg.editUrl());
		await waitForEditor(page, 1);
		await uploadViaNewMenu(page, SAMPLE);
		await expect(audioOf(page)).toHaveCount(1, { timeout: 10000 });
		await awaitAudio(page);

		// select the object - the context menu items come up beside it
		await audioOf(page).click();
		await expect(page.getByTitle('toggle automatic playback of audio')).toBeVisible();
		await expect(page.getByTitle('toggle looping of audio')).toBeVisible();
		await expect(page.getByTitle('show or hide control elements')).toBeVisible();
		await expect(page.getByTitle('mute or unmute audio')).toBeVisible();
		await expect(page.getByTitle('download original file')).toBeVisible();
		// no reset-size: the button left the video menu too (2026-09-24), and
		// the audio object never had a native size to reset to in the first
		// place
		await expect(page.getByTitle('reset video size')).toHaveCount(0);

		// mute toggles the live state, the property not just the attribute -
		// the same loaded-element lock the video module's fix is about
		await page.getByTitle('mute or unmute audio').click();
		await expect.poll(() => audioOf(page).locator('audio').evaluate((a) => a.muted))
			.toBe(true);
		await page.getByTitle('audio is muted - click to unmute').click();
		await expect.poll(() => audioOf(page).locator('audio').evaluate((a) => a.muted))
			.toBe(false);

		// loop toggles the stored attr the way video's does
		await page.getByTitle('toggle looping of audio').click();
		await expect.poll(() => {
			const id = hg.ids().find((f) => f !== '100000000001' && f !== 'page');
			return hg.readObject(id).attrs['audio-loop'];
		}, { timeout: 5000 }).toBe('loop');
	});

// the formats the audio module claims beyond m4a (2026-09-24): each upload
// becomes an audio object - anything unclaimed would fall back to a
// download object, so the counts below pin the whole dispatch
const AUDIO_FORMATS = ['sample.mp3', 'sample.flac', 'sample.wav', 'sample.aac',
	'sample.oga', 'sample.aiff'];

test('the other audio formats all become audio objects', async ({ page, hg }) => {
	hg.addObject('100000000001', {
		type: 'text', module: 'text', 'object-left': '50px', 'object-top': '50px',
		'object-width': '100px', 'object-height': '50px', 'object-zindex': '100',
		'text-background-color': 'transparent',
	}, 'seed');
	await page.goto(hg.editUrl());
	await waitForEditor(page, 1);

	for (let i = 0; i < AUDIO_FORMATS.length; i++) {
		await uploadViaNewMenu(page, path.join(__dirname, 'fixtures', AUDIO_FORMATS[i]));
		await expect(audioOf(page)).toHaveCount(i + 1, { timeout: 10000 });
	}
	// all six finalize their background encode (or render directly when
	// ffmpeg is unavailable) - six real <audio> elements means none of the
	// uploads fell back to a download object
	await expect(page.locator('.audio.object audio')).toHaveCount(AUDIO_FORMATS.length,
		{ timeout: 30000 });

	const ids = hg.ids().filter((f) => f !== '100000000001' && f !== 'page');
	expect(ids.length).toBe(AUDIO_FORMATS.length);
	for (const id of ids) {
		const attrs = hg.readObject(id).attrs;
		expect(attrs['type']).toBe('audio');
		expect(attrs['audio-file-mime']).toBeTruthy();
	}
});
