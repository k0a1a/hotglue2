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
// Two checks, because the pairs are not produced uniformly - there is no build
// step (MODERNIZATION.md section 5, "Build tooling"). js/create_page.min.js is
// its source minus a licence header and
// modules/user_code/user_code-edit.min.js is genuinely minified with renamed
// locals; for those, all that can be asked is "was the copy updated when the
// source was", by commit date.
//
// For everything tools/make-min.js produces, the copy is checked by CONTENT
// instead: what the tool would write now, against what is on disk. That is
// both stricter and free of the date rule's false positive - a comment-only
// change to a source leaves its copy byte-identical, so the copy can never
// take a newer commit than the source, and by date alone it looks stale
// forever.
//
// Vendored libraries are excluded: their .min.js files are upstream builds with
// no corresponding source of ours.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { test, expect, ROOT } = require('./fixtures/hotglue.js');

const VENDORED = ['alpine', 'moveable', 'vanilla-picker'];

const { strip_comments } = require(path.join(ROOT, 'tools', 'make-min.js'));

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

// The copies tools/make-min.js writes can be checked exactly: ask it what it
// would produce from the source as it stands. Everything else falls back to
// dates. A pair joins this list by being regenerable - if the answer matches
// what is on disk, the tool made it.
function toolWouldWrite(src) {
	try {
		return strip_comments(fs.readFileSync(path.join(ROOT, src), 'utf8'));
	} catch (e) {
		return null;
	}
}

for (const { name, src, min } of found) {
	test(`${name}.min.js is not stale`, () => {
		const onDisk = fs.readFileSync(path.join(ROOT, min), 'utf8');
		const source = fs.readFileSync(path.join(ROOT, src), 'utf8');
		// Content first, where content can answer. A copy that is byte-equal
		// to its source, or byte-equal to what tools/make-min.js would write
		// from it, is up to date whatever the dates say - and a comment-only
		// change to a source produces exactly that case, since the tool
		// strips comments, so by date alone the pair looks stale forever.
		if (onDisk === source || onDisk === toolWouldWrite(src)) {
			return;
		}

		// The rest - a licence header stripped by hand, one genuinely
		// minified with renamed locals - can only be asked whether the copy
		// was updated when the source was.
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
