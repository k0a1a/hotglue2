// Guards the *.min.js pairs for hotglue's OWN javascript against going stale.
//
// USE_MIN_FILES defaults to TRUE in config.inc.php, so the .min.js copy is what
// a default install actually serves. A stale one silently ships the old
// behaviour while the source, this test suite and any developer running
// USE_MIN_FILES=false all show the fix working perfectly.
//
// Not hypothetical: the $.glue.live delegation fix was written against
// js/glue.js and would have reached nobody, because js/glue.min.js still held
// the buggy version.
//
// The check is FRESHNESS, not equality, because the pairs are not produced
// uniformly - there is no build step (MODERNIZATION.md section 5, "Build
// tooling"). js/edit.min.js and js/glue.min.js are byte-identical copies of
// their sources, js/create_page.min.js is the source minus its licence header,
// and modules/user_code/user_code-edit.min.js is genuinely minified with
// renamed locals. Comparing content cannot span those; "was the copy updated
// when the source was" can.
//
// Vendored libraries are excluded: their .min.js files are upstream builds with
// no corresponding source of ours.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { test, expect, ROOT } = require('./fixtures/hotglue.js');

const VENDORED = ['alpine', 'moveable', 'vanilla-picker'];

const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
const lastCommit = (rel) => git('log', '-1', '--format=%ct', '--', rel);
const isDirty = (rel) => git('status', '--porcelain', '--', rel) !== '';

function pairsIn(dir) {
	if (!fs.existsSync(dir)) return [];
	return fs.readdirSync(dir)
		.filter((f) => f.endsWith('.min.js'))
		.map((f) => f.replace(/\.min\.js$/, ''))
		.filter((name) => !VENDORED.includes(name))
		.filter((name) => fs.existsSync(path.join(dir, `${name}.js`)))
		.map((name) => ({
			name: path.relative(ROOT, path.join(dir, name)),
			src: path.relative(ROOT, path.join(dir, `${name}.js`)),
			min: path.relative(ROOT, path.join(dir, `${name}.min.js`)),
		}));
}

const modulesDir = path.join(ROOT, 'modules');
const found = [
	...pairsIn(path.join(ROOT, 'js')),
	...fs.readdirSync(modulesDir)
		.map((m) => path.join(modulesDir, m))
		.filter((d) => fs.statSync(d).isDirectory())
		.flatMap(pairsIn),
];

test('there are project-authored min pairs to check', () => {
	expect(found.length, 'no *.min.js pairs found - has the layout changed?')
		.toBeGreaterThan(0);
});

for (const { name, src, min } of found) {
	test(`${name}.min.js is not stale`, () => {
		// Uncommitted edits first: whoever changed the source in the working
		// tree must have refreshed the copy too.
		if (isDirty(src)) {
			expect(isDirty(min), `${src} has uncommitted changes but ${min} does not. `
				+ `Refresh the copy - USE_MIN_FILES defaults to true, so ${min} is what a `
				+ `default install serves.`).toBe(true);
			return;
		}
		const srcAt = lastCommit(src);
		const minAt = lastCommit(min);
		expect(srcAt, `${src} is not tracked by git`).not.toBe('');
		expect(minAt, `${min} is not tracked by git`).not.toBe('');
		expect(Number(minAt) >= Number(srcAt),
			`${min} was last committed before ${src} was, so it is stale.`).toBe(true);
	});
}
