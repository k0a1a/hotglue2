// Playwright config for hotglue's editor end-to-end suite.
//
// The suite is hermetic on purpose: it starts its own PHP built-in server
// through tests/e2e/server-router.php, which forces CONTENT_DIR to
// content-e2e/ and the credentials to a fixed test pair. It never touches
// the developer's own content/ directory, user-config.inc.php, or whatever
// server they have running on port 8000.
//
// See MODERNIZATION.md section 11 for the scenario list this implements.

const { defineConfig, devices } = require('@playwright/test');

const PORT = Number(process.env.HG_E2E_PORT || 8123);
const BASE = `http://127.0.0.1:${PORT}`;

module.exports = defineConfig({
	testDir: __dirname,
	// The editor writes to a single content tree and the tests assert on what
	// landed on disk, so they must not race each other.
	workers: 1,
	fullyParallel: false,
	forbidOnly: !!process.env.CI,
	retries: 0,
	reporter: process.env.CI ? 'list' : [['list'], ['html', { open: 'never' }]],
	use: {
		baseURL: BASE,
		// AUTH_METHOD is 'basic' and server-router.php pins these
		httpCredentials: { username: 'e2e', password: 'e2e-secret' },
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure',
	},
	// Both engines, because hotglue's editor keeps meeting places where they
	// differ: gecko reports innerWidth 4x out on android, refuses to scroll an
	// overflowing child that blink scrolls happily, and wraps a new line in a
	// bare <br> where blink wraps it in a <div>. Run with --project=chromium to
	// narrow it down when something fails.
	projects: [
		{ name: 'chromium', use: { ...devices['Desktop Chrome'] } },
		{ name: 'firefox', use: { ...devices['Desktop Firefox'] } },
	],
	webServer: {
		command: `php -S 127.0.0.1:${PORT} tests/e2e/server-router.php`,
		env: { HG_MIN: process.env.HG_MIN || '' },
		cwd: require('path').resolve(__dirname, '../..'),
		// probe a static asset: it is served by the router's passthrough and
		// always 200s, whereas any page URL depends on content that the tests
		// themselves create
		url: `${BASE}/js/edit.js`,
		reuseExistingServer: !process.env.CI,
		stdout: 'ignore',
		stderr: 'pipe',
	},
});
