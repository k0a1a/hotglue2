#!/usr/bin/env node
/*
 * Prepare the SuperGlue SVG icon set for use as CSS mask images.
 *
 * The source files come out of Inkscape carrying RDF metadata, a namedview,
 * and a pile of inkscape:/sodipodi: attributes -- around 85% of each file by
 * weight, none of which a mask ever reads. This strips them and drops the
 * icon_ prefix, so the editor JS can name an icon by what it is:
 *
 *   node tools/prep-icons.js ../superglue-ng/documentation/UI-icons-SVG-nobg img/icons
 *
 * Re-run it whenever the upstream set changes; img/icons is generated, and
 * hand-editing anything in it will be overwritten.
 */

var fs = require('fs');
var path = require('path');

function strip(s)
{
	// xml declaration and doctype
	s = s.replace(/<\?xml[\s\S]*?\?>/g, '');
	s = s.replace(/<!DOCTYPE[\s\S]*?>/gi, '');
	// comments
	s = s.replace(/<!--[\s\S]*?-->/g, '');
	// metadata, namedview, and any group the author left hidden
	s = s.replace(/<metadata[\s\S]*?<\/metadata>/gi, '');
	// editor-private elements: paired form first, then self-closing. Guides and
	// grids sometimes sit outside the namedview, so match the prefix, not the tag.
	s = s.replace(/<(inkscape|sodipodi):([\w-]+)\b[^>]*>[\s\S]*?<\/\1:\2>/gi, '');
	s = s.replace(/<(?:inkscape|sodipodi):[\w-]+\b[^>]*?\/?>/gi, '');
	s = s.replace(/<g[^>]*\bdisplay="none"[^>]*\/>/gi, '');
	s = s.replace(/<g[^>]*\bdisplay="none"[^>]*>[\s\S]*?<\/g>/gi, '');
	// editor-private attributes and the namespaces that declare them
	s = s.replace(/\s+(?:inkscape|sodipodi):[\w-]+\s*=\s*"[^"]*"/g, '');
	s = s.replace(/\s+xmlns:(?:inkscape|sodipodi|dc|cc|rdf|svg)\s*=\s*"[^"]*"/g, '');
	// empty defs and empty groups left behind by the above
	for (var i = 0; i < 4; i++) {
		s = s.replace(/<defs[^>]*\/>/gi, '');
		s = s.replace(/<defs[^>]*>\s*<\/defs>/gi, '');
		s = s.replace(/<g[^>]*\/>/gi, '');
		s = s.replace(/<g([^>]*)>\s*<\/g>/gi, '');
	}
	// ids exist to be referenced; nothing here references them
	s = s.replace(/\s+id\s*=\s*"[^"]*"/g, '');
	// author-facing text and the RDF licence block above: these are masks,
	// nothing ever reads them out, and provenance does not belong repeated
	// in every one of 54 files.
	s = s.replace(/<title>[\s\S]*?<\/title>/gi, '');
	s = s.replace(/<desc>[\s\S]*?<\/desc>/gi, '');
	// root-element cruft: a viewBox is what the mask scales by, so the
	// Illustrator/Inkscape export leftovers around it do nothing. Confined to
	// the opening <svg> tag on purpose - x and y mean something very
	// different on a <rect>, and stripping them there moves it to the origin.
	s = s.replace(/^(\s*<svg\b)([^>]*)>/i, function(all, open, attrs) {
		return open + attrs.replace(
			/\s+(?:enable-background|xml:space|version|x|y)\s*=\s*"[^"]*"/g, '') + '>';
	});
	// six hex digits where three will do. Only the alpha channel of these
	// files is ever read (they are masks), but keeping them white rather
	// than dropping the colour outright leaves them usable as plain <img>
	// against dark chrome, and a bare stroke with no colour draws nothing.
	s = s.replace(/#([0-9a-f])\1([0-9a-f])\2([0-9a-f])\3\b/gi, '#$1$2$3');
	// wrapper groups that carry no attributes only exist because of how the
	// artwork was organised in the editor. Innermost first: the lazy match
	// would otherwise pair an outer <g> with an inner group's </g> and unwrap
	// the wrong one.
	for (var j = 0; j < 6; j++) {
		var before_g = s;
		s = s.replace(/<g>((?:(?!<g[\s>])[\s\S])*?)<\/g>/gi, '$1');
		if (s === before_g) {
			break;
		}
	}
	// collapse the whitespace Inkscape puts between every attribute. This
	// reaches inside attribute values too, which is harmless for the path and
	// points data here (runs of whitespace are one separator in both), and
	// there is no <text> in the set whose content it could alter.
	s = s.replace(/\s*\n\s*/g, ' ');
	s = s.replace(/\s{2,}/g, ' ');
	s = s.replace(/\s+(\/?>)/g, '$1');
	return s.trim() + '\n';
}

var src = process.argv[2];
var dst = process.argv[3];
if (!src || !dst) {
	console.error('usage: node tools/prep-icons.js <src-dir> <dest-dir>');
	process.exit(1);
}
fs.mkdirSync(dst, {recursive: true});

// anything already in dst that this run does not rewrite is left over from an
// earlier batch under a name upstream no longer uses. Not deleted - just
// named, because a stale icon still serves happily and nothing else notices.
var existing = fs.existsSync(dst) ? fs.readdirSync(dst).filter(function(f) {
	return /\.svg$/i.test(f);
}) : [];
var written = {};

var before = 0, after = 0, n = 0;
fs.readdirSync(src).filter(function(f) {
	return /\.svg$/i.test(f);
}).sort().forEach(function(f) {
	var raw = fs.readFileSync(path.join(src, f), 'utf8');
	var out = strip(raw);
	// icon_font_size.svg -> font-size.svg
	var name = f.replace(/^icon_/, '').replace(/_/g, '-')
	            .replace(/[()]/g, '').replace(/-+/g, '-').replace(/-\.svg$/, '.svg');
	fs.writeFileSync(path.join(dst, name), out);
	written[name] = true;
	before += Buffer.byteLength(raw);
	after += Buffer.byteLength(out);
	n++;
});

console.log(n + ' icons: ' + (before / 1024).toFixed(1) + 'K -> ' +
            (after / 1024).toFixed(1) + 'K (' +
            Math.round(100 - after / before * 100) + '% smaller)');

var stale = existing.filter(function(f) { return !written[f]; });
if (stale.length) {
	console.log('note: ' + stale.length + ' file(s) in ' + dst +
	            ' have no upstream source any more: ' + stale.join(', '));
}
