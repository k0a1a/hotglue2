#!/usr/bin/env node
//
// Drive Chrome on a real Android phone over ADB and read the mobile guided
// view's own debug panel back off the device.
//
// This is a MEASURING tool, not a regression test - it needs a phone plugged
// in, so it can never run as part of the suite. It exists because several
// things about the guided view can only be established on real hardware: the
// layout viewport differs per engine and per OS display setting, and the
// browser's pinch floor cannot be reproduced in a desktop responsive mode.
//
// Usage, with the phone connected and USB debugging authorised:
//
//   node tests/e2e/android-check.js [baseUrl]
//
// baseUrl defaults to the dev server on this machine, reached through an adb
// reverse tunnel so the phone's own localhost points back here.
//
// It checks three things that can only be established on hardware:
//   - the reveal's PACING, recorded frame by frame inside the page
//   - the pinch floor, via a synthesised multi-touch gesture
//   - the double-tap overview toggle, via a synthesised double tap
//
// LIMIT: this drives CHROME only. Firefox findings - and half of what we know
// about the pinch floor came from Firefox - still need a human with the phone.

const { execFileSync } = require('child_process');
const { chromium } = require('playwright');

// the adb on PATH may be an ancient shadowed binary; prefer the packaged one
const ADB = ['/usr/bin/adb', 'adb'].find((p) => {
	try { execFileSync(p, ['version'], { stdio: 'pipe' }); return true; } catch (e) { return false; }
});

const PAGES = (process.env.HG_PAGES || 'mort,wide,wideimg').split(',');
const PORT = 8000;
// localhost, reached through the adb reverse tunnel set up below - an mDNS
// name like w3.local resolves from the phone only intermittently
const BASE = process.argv[2] || `http://localhost:${PORT}`;

// the lines of the debug panel worth reporting
const WANTED = /^(viewport|canvas|origin|fitWidth|fitHeight|docWidth|startScale|targetScale|finalScale|restoredZoom|pinch|visibleAtMin|scrollMax):/;

(async () => {
	if (!ADB) {
		console.error('no working adb found - install android-tools-adb');
		process.exit(1);
	}
	// Connect to the Chrome ALREADY running on the phone rather than launching
	// one. playwright._android.launchBrowser() waits for a devtools socket it
	// creates itself and hangs when Chrome is already up with the standard
	// @chrome_devtools_remote; forwarding that socket and speaking CDP to it
	// works first time.
	try {
		execFileSync(ADB, ['forward', 'tcp:9222', 'localabstract:chrome_devtools_remote'], { stdio: 'pipe' });
		execFileSync(ADB, ['reverse', `tcp:${PORT}`, `tcp:${PORT}`], { stdio: 'pipe' });
	} catch (e) {
		console.error('adb forward/reverse failed - is the phone connected and authorised?');
		process.exit(1);
	}

	const browser = await chromium.connectOverCDP('http://localhost:9222');
	const page = browser.contexts()[0].pages()[0] || await browser.contexts()[0].newPage();
	const cdp = await page.context().newCDPSession(page);
	const scaleNow = () => page.evaluate(() => {
		const c = document.getElementById('hg-mg-canvas');
		return c ? +new DOMMatrixReadOnly(getComputedStyle(c).transform).a.toFixed(4) : null;
	});

	try {
		for (const name of PAGES) {
			console.log(`--- ${name} ---`);
			await page.goto('about:blank');
			await page.goto(`${BASE}/?${name}&debug=1`, { waitUntil: 'commit' });

			// Record the reveal from inside the page. Sampling it over CDP
			// aliases badly: each round trip to the phone costs ~250ms against
			// a 1500ms animation.
			await page.evaluate(() => {
				window.__rec = [];
				const t0 = performance.now();
				(function loop() {
					const c = document.getElementById('hg-mg-canvas');
					if (c) {
						const m = new DOMMatrixReadOnly(getComputedStyle(c).transform);
						window.__rec.push([Math.round(performance.now() - t0), +m.a.toFixed(4)]);
					}
					if (performance.now() - t0 < 7000) requestAnimationFrame(loop);
				})();
			});
			await page.waitForTimeout(7500);

			const lines = await page.evaluate(() => {
				const d = document.getElementById('hg-mg-dbg');
				return d ? d.textContent.split('\n').filter(Boolean) : [];
			});
			lines.filter((l) => WANTED.test(l)).forEach((l) => console.log('  ' + l));

			// pacing: a zoom feels even when log-progress tracks time
			const rec = await page.evaluate(() => window.__rec || []);
			if (rec.length > 4) {
				const s0 = rec[0][1], s1 = rec[rec.length - 1][1];
				const a = (rec.filter((r) => r[1] > s0 * 1.02)[0] || [0])[0];
				const z = (rec.filter((r) => r[1] >= s1 * 0.9999)[0] || [0])[0];
				const at = (f) => {
					const tt = a + (z - a) * f;
					return rec.reduce((p, c) => Math.abs(c[0] - tt) < Math.abs(p[0] - tt) ? c : p);
				};
				console.log(`  => reveal ${(s1 / s0).toFixed(1)}x over ${z - a}ms, ${rec.length} frames`);
				console.log('     log-progress at 1/4, 1/2, 3/4: ' + [0.25, 0.5, 0.75]
					.map((f) => (Math.log(at(f)[1] / s0) / Math.log(s1 / s0)).toFixed(2)).join('  '));
			}

			// the two gestures that cannot be tested any other way
			await cdp.send('Input.synthesizePinchGesture',
				{ x: 192, y: 346, scaleFactor: 0.25, relativeSpeed: 800 });
			await page.waitForTimeout(400);
			await cdp.send('Input.synthesizePinchGesture',
				{ x: 192, y: 346, scaleFactor: 0.25, relativeSpeed: 800 });
			await page.waitForTimeout(400);
			const floor = await page.evaluate(() => +visualViewport.scale.toFixed(4));
			console.log(`  pinch floor reached: ${floor}` +
				(Math.abs(floor - 0.25) < 0.01 ? '  (the platform floor, as expected)' : '  (UNEXPECTED)'));

			await page.goto(`${BASE}/?${name}`);
			await page.waitForTimeout(5000);
			const before = await scaleNow();
			await cdp.send('Input.synthesizeTapGesture', { x: 192, y: 346, tapCount: 2, duration: 60 });
			await page.waitForTimeout(900);
			const out = await scaleNow();
			await cdp.send('Input.synthesizeTapGesture', { x: 192, y: 346, tapCount: 2, duration: 60 });
			await page.waitForTimeout(900);
			const back = await scaleNow();
			console.log(`  double-tap: ${before} -> ${out} -> ${back}`);

			await page.screenshot({ path: `tests/e2e/.android-${name}.png` });
			console.log(`  screenshot: tests/e2e/.android-${name}.png\n`);
		}
	} finally {
		await browser.close();
	}
})();
