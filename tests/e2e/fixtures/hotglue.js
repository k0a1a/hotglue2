// Shared fixtures for the hotglue editor e2e suite.
//
// Pages are seeded by writing hotglue's flat files directly rather than by
// driving the editor's "add object" buttons. That is deliberate: object
// creation in the modules picks a RANDOM background colour
// (modules/text/text-edit.js:315), so a UI-created fixture could not be
// compared against anything stable. Writing the files gives byte-exact
// control over the starting state, which is the whole point when the thing
// under test is the storage format itself.

const fs = require('fs');
const path = require('path');
const base = require('@playwright/test');

const ROOT = path.resolve(__dirname, '../../..');
const CONTENT = path.join(ROOT, 'content-e2e');

// hotglue's object file: "key:value" lines, a blank line, then the object's
// content. See any file under content/<page>/<revision>/.
function serializeObject(attrs, content = '') {
	const head = Object.entries(attrs).map(([k, v]) => `${k}:${v}`).join('\n');
	return `${head}\n\n${content}`;
}

// Parse one back, so tests can assert on attributes without caring about the
// order they happen to be written in.
function parseObject(text) {
	const [head, ...rest] = text.split('\n\n');
	const attrs = {};
	for (const line of head.split('\n')) {
		if (!line.trim()) continue;
		const i = line.indexOf(':');
		if (i === -1) continue;
		attrs[line.slice(0, i)] = line.slice(i + 1);
	}
	return { attrs, content: rest.join('\n\n') };
}

class Fixture {
	constructor(pageName) {
		this.pageName = pageName;			// e.g. "e2e-abc123.default"
		const [p, rev] = pageName.split('.');
		this.dir = path.join(CONTENT, p, rev);
	}

	create() {
		fs.mkdirSync(this.dir, { recursive: true, mode: 0o777 });
		return this;
	}

	// id is the object's basename; the DOM id is "<page>.<id>"
	addObject(id, attrs, content = '') {
		fs.writeFileSync(path.join(this.dir, id), serializeObject(attrs, content));
		return `${this.pageName}.${id}`;
	}

	// An object that has not been written yet reads as empty rather than
	// throwing. Tests poll this while the editor saves - and a page object in
	// particular does not exist at all until something stores a page-level
	// setting on it - so "no file yet" is a legitimate state to observe, not
	// an error. Throwing made expect.poll() fail outright instead of
	// retrying, which showed up as an intermittent failure in whichever test
	// happened to poll before the first save landed.
	readObject(id) {
		const file = path.join(this.dir, id);
		if (!fs.existsSync(file)) {
			return { attrs: {}, content: '' };
		}
		return parseObject(fs.readFileSync(file, 'utf8'));
	}

	readObjectRaw(id) {
		return fs.readFileSync(path.join(this.dir, id), 'utf8');
	}

	ids() {
		return fs.readdirSync(this.dir).sort();
	}

	editUrl() {
		// the editor is addressed as ?<page>/edit - the slash matters, it is
		// how parse_query_string() splits arg0 from arg1 (controller.inc.php)
		return `/?${this.pageName}/edit`;
	}

	// Teardown races the application: a save the editor started as the test
	// ended is still landing, and a file that appears while rmSync is walking
	// the tree makes the rmdir fail with ENOTEMPTY - which fails the test
	// AFTER every assertion in it has passed. That is the whole family of
	// unreproducible one-off failures this suite had: always a different
	// test, always fast, never on a rerun. maxRetries is what rmSync has for
	// exactly this.
	destroy() {
		fs.rmSync(path.join(CONTENT, this.pageName.split('.')[0]), {
			recursive: true, force: true, maxRetries: 10, retryDelay: 50,
		});
	}
}

// A fresh, uniquely-named page per test, torn down afterwards - so tests are
// order-independent even though they share one content tree.
const test = base.test.extend({
	hg: async ({}, use, testInfo) => {
		const slug = 'e2e' + testInfo.testId.replace(/[^a-z0-9]/gi, '').slice(0, 12).toLowerCase();
		const fixture = new Fixture(`${slug}.default`).create();
		await use(fixture);
		fixture.destroy();
	},
});

// Resolves once edit.js has published its API and registered every object,
// so tests never race the editor's own start-up.
async function waitForEditor(page, expectedObjects) {
	await page.waitForFunction(
		(n) => window.$ && window.$.glue && window.$.glue.object &&
			document.querySelectorAll('.object').length === n,
		expectedObjects,
	);
}

module.exports = { test, expect: base.expect, waitForEditor, serializeObject, parseObject, CONTENT, ROOT };
