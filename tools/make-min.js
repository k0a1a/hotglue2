#!/usr/bin/env node
//
// Produce the .min.js copy of one of hotglue's own JS files.
//
// The project has no build pipeline and does not want one; MODERNIZATION.md
// section 5 describes the *.min.js pairs as "produced by a small one-off
// script", and this is that script. It is not a minifier: it strips whole-line
// comments and collapses the blank runs they leave behind, and touches nothing
// else.
//
// Deliberately conservative. It never removes a TRAILING comment, because
// deciding whether a // is a comment or part of a string or a regex literal
// needs a parser, and this file contains both ('//example.org/', /[?&]guided=/).
// Whole-line comments can be recognised safely; that is where the bulk is
// anyway - 18KB of mobile-guided.js's 30KB.
//
//   node tools/make-min.js js/mobile-guided.js
//
// Re-run it after editing the source. tests/e2e/min-files.spec.js fails if a
// copy is left older than the file it came from.

const fs = require('fs');
const path = require('path');

// The transform itself, exported so tests/e2e/min-files.spec.js can ask what
// this file WOULD write without running it. A comment-only change to a source
// leaves its copy byte-identical, which no amount of looking at dates can tell
// apart from a copy nobody remembered to update.
function strip_comments(source) {
	const lines = source.split('\n');
	const kept = [];
	let inBlock = false;
	for (const line of lines) {
		const t = line.trim();
		if (inBlock) {
			if (t.includes('*/')) inBlock = false;
			continue;
		}
		if (t.startsWith('/*')) {
			if (!t.includes('*/')) inBlock = true;
			continue;
		}
		if (t.startsWith('//')) continue;
		// collapse the blank runs left where a comment block used to be
		if (!t && kept.length && !kept[kept.length - 1].trim()) continue;
		kept.push(line);
	}
	return kept.join('\n').replace(/\n{3,}/g, '\n\n');
}

module.exports = { strip_comments };

// Only when run as a command, so that requiring this for its transform - which
// tests/e2e/min-files.spec.js does, to ask what it WOULD write - does not go
// looking at argv and exit.
if (require.main === module) {
	const src = process.argv[2];
	if (!src || !src.endsWith('.js') || src.endsWith('.min.js')) {
		console.error('usage: node tools/make-min.js <path/to/file.js>');
		process.exit(1);
	}
	const out = src.replace(/\.js$/, '.min.js');

	const result = strip_comments(fs.readFileSync(src, 'utf8'));
	fs.writeFileSync(out, result);

	const before = fs.statSync(src).size;
	const after = Buffer.byteLength(result);
	console.log(`${path.basename(out)}: ${before} -> ${after} bytes ` +
		`(${Math.round((1 - after / before) * 100)}% smaller)`);
}
