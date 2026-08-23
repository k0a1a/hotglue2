/**
 *	modules/text/text-edit.js
 *	Frontend code for text objects
 *
 *	Copyright Gottfried Haider, Danja Vasiliev 2010.
 *	This source code is licensed under the GNU General Public License.
 *	See the file COPYING for more details.
 */

function text_font_size_sync(elem) {
	var obj = $.glue.owner(elem);
	Alpine.$data(elem).tip = 'drag to change font size ('+getComputedStyle(obj).fontSize+'), click to reset to default one';
}

function text_align_sync(elem) {
	var obj = $.glue.owner(elem);
	var val = getComputedStyle(obj).textAlign;
	var label = (val == 'center') ? 'center' : (val == 'right') ? 'right' : (val == 'justify') ? 'justify' : 'left';
	Alpine.$data(elem).tip = 'change text alignment ('+label+')';
}

function text_padding_sync(elem) {
	var obj = $.glue.owner(elem);
	var computed = getComputedStyle(obj);
	Alpine.$data(elem).tip = 'change padding ('+computed.paddingLeft+', '+computed.paddingTop+'), click to reset to default one';
}

$.glue.text = function()
{
	var str_replace = function(from, to, s) {
		// this naive version doesn't work as from might be included in to again
		// e.g. when replacing '\n' to '<br>\n'
		//while (s.indexOf(from) != -1) {
		//	s = s.replace(from, to);
		//}
		if (typeof to !== 'string') {
			if (to.toString) {
				to = to.toString();
			} else {
				return '';
			}
		}
		if (typeof s !== 'string') {
			if (s.toString) {
				s = s.toString();
			} else {
				return '';
			}
		}
		var cur = 0;
		while (cur+from.length <= s.length) {
			if (s.substring(cur, cur+from.length) == from) {
				s = s.substring(0, cur)+to+s.substring(cur+from.length);
				// don't subject the added to to checking
				cur += to.length;
			} else {
				cur++;
			}
		}
		return s;
	};

	return {
		get_fonts: function(fonts, woff_fonts) {
			// get all fonts
			//fonts = [];
			//woff_fonts = [];
			for (var i=0; i < document.styleSheets.length; i++) {
				var sheet = document.styleSheets[i];
				for (var j=0; sheet.cssRules && j < sheet.cssRules.length; j++) {
					var rule = sheet.cssRules[j];
					if (!rule.selectorText) {
						continue;
					}
					if (rule.selectorText.substr(0, 10) != '.glue-font') {
						continue;
					}
					// find font-family property
					var text = rule.cssText;
					var start = text.indexOf('font-family:');
					if (start == -1) {
						continue;
					}
					// move start to beginning of value
					start += 12;
					var end = text.length-1;
					// check for closing bracket
					var tmp = text.indexOf('}', start);
					if (tmp != -1) {
						end = tmp-1;
					}
					// check for semicolon
					tmp = text.indexOf(';', start);
					if (tmp != -1 && tmp < end) {
						end = tmp-1;
					}
					fonts.push(text.substr(start, end-start+1).trim());
					if (rule.selectorText.substr(0, 15) == '.glue-font-woff') {
						// also add to woff_fonts
						woff_fonts.push(text.substr(start, end-start+1).trim());
					}
				}
			}
		},
		// --- WYSIWYG editing round-trip ---------------------------------
		//
		// Text is STORED as raw HTML source. It is VIEWED through
		// _text_render_content(), which is a one-way projection: it expands
		// $BASEURL$ and friends, turns relative urls absolute, converts
		// newlines to <br> and spaces to &nbsp;. Editing the viewed output and
		// saving it back would bake every one of those in permanently, on the
		// first edit of every text object.
		//
		// So editing does NOT use the view render. It uses this pair, which is
		// deliberately reversible: no alias expansion, no url rewriting,
		// nothing encoded. The only transform is newline <-> <br>, and the
		// <br> elements this inserts are MARKED, so a <br> the author typed
		// themselves survives as a <br> instead of silently becoming a
		// newline. Both forms render identically, but rewriting one into the
		// other would still be us editing their file behind their back.
		to_editing_html: function(src) {
			return String(src).replace(/\r\n|\r|\n/g, '<br data-glue-nl="1">');
		},
		// node .. the contenteditable element
		from_editing_html: function(node) {
			var clone = node.cloneNode(true);
			// our own line breaks become newlines again
			clone.querySelectorAll('br[data-glue-nl]').forEach(function(br) {
				br.replaceWith(document.createTextNode('\n'));
			});
			// Browsers wrap new lines in <div> (blink) or insert bare <br>
			// (gecko) when Enter is pressed, whatever we ask for. Unwrap the
			// former and mark the latter, so both engines produce the same
			// source rather than one of them producing stray block elements.
			clone.querySelectorAll('div, p').forEach(function(block) {
				block.replaceWith(document.createTextNode('\n'), ...block.childNodes);
			});
			clone.querySelectorAll('br:not([data-glue-nl])').forEach(function(br) {
				if (br.dataset.glueTyped) {
					br.replaceWith(document.createTextNode('\n'));
				}
			});
			var out = clone.innerHTML;
			// &nbsp; round-trips as the character it was
			out = out.replace(/&nbsp;/g, '\xa0');
			// the zero-width space used to make a trailing <br> visible is
			// scaffolding, not content
			out = out.replace(/\u200b/g, '');
			// a leading newline from unwrapping the first block is an artefact
			return out.replace(/^\n/, '');
		},
		insert_at_cursor: function(elem, s) {
			// inspired from http://forumsblogswikis.com/2008/07/20/how-to-insert-tabs-in-a-textarea/
			// this only includes the code for Firefox and Webkit though
			var start = elem.selectionStart;
			var end = elem.selectionEnd;
			elem.value = elem.value.substring(0, start)+s+elem.value.substring(end, elem.value.length);
			elem.selectionStart = start+s.length;
			elem.selectionEnd = start+s.length;
		},
		render_content: function(s, name) {
			// base url
			s = str_replace('$BASEURL$', $.glue.base_url, s);
			s = str_replace('$baseurl$', $.glue.base_url, s);
			// version number
			s = str_replace('$GLUE$', str_replace(',', '.', $.glue.version), s);
			s = str_replace('$glue$', str_replace(',', '.', $.glue.version), s);
			// current object
			s = str_replace('$OBJ$', name, s);
			s = str_replace('$obj$', name, s);
			// current page
			s = str_replace('$PAGE$', $.glue.page, s);
			s = str_replace('$page$', $.glue.page, s);
			// pagename
			s = str_replace('$PAGENAME$', $.glue.page.split('.').slice(0, 1), s);
			s = str_replace('$pagename$', $.glue.page.split('.').slice(0, 1), s);
			// protocol used
			if (location.protocol == 'https:') {
				s = str_replace('$PROT$', 'https', s);
				s = str_replace('$prot$', 'https', s);
			} else {
				s = str_replace('$PROT$', 'http', s);
				s = str_replace('$prot$', 'http', s);
			}
			// revision
			s = str_replace('$REV$', $.glue.page.split('.').slice(1, 2), s);
			s = str_replace('$rev$', $.glue.page.split('.').slice(1, 2), s);
			// automatically add <br> elements for newlines
			if ($.glue.conf.text.auto_br) {
				s = str_replace('\r\n', '<br>', s);
				s = str_replace('\n', '<br>', s);
			}
			// non-breakable spaces get automatically encoded to &nbsp; it seems
			return s;
		},
		stop_editing: function(elem) {
			var input = elem.querySelector(':scope > .glue-text-input');
			var render = elem.querySelector(':scope > .glue-text-render');
			// in WYSIWYG mode the div is where the edits are, so read the
			// source back out of it before anything else touches it
			if (render.isContentEditable) {
				input.value = $.glue.text.from_editing_html(render);
				render.contentEditable = 'false';
			}
			// now show the VIEW render, which is lossy on purpose
			render.innerHTML = $.glue.text.render_content(input.value, elem.id);
			elem.classList.remove('glue-text-editing');
			// disable links, resolve relative urls
			render.querySelectorAll('a').forEach(function(a) {
				a.addEventListener('click', function(e) {
					e.preventDefault();
					return false;
				});
				a.title = 'this link is disabled for editing';
				// check if scheme is set
				var url = a.getAttribute('href');
				if (url && url.charAt(0) != '#' && url.indexOf('://') < 1) {
					a.setAttribute('href', $.glue.base_url+url);
				}
			});
			// hide the text area again
			input.style.display = 'none';
			render.style.display = 'block';
			// update the textarea's inner html as well (.val() seems to be
			// different from .text(), at least with jquery 1.5.2 on chromium 12
			input.textContent = input.value;
			// update the content on the server
			// see the comments in $.glue.object.register_alter_pre_save below
			$.glue.backend({ method: 'glue.update_object', name: elem.id, 'content': input.value });
		}
	};
}();

$.glue.live('.text', 'glue-register', function(e) {
	// prevent events from bubbling up while we're editing
	// and handle a few keycodes
	var input = this.querySelector(':scope > .glue-text-input');
	var render = this.querySelector(':scope > .glue-text-render');

	// The contenteditable div needs everything the textarea gets, and for the
	// same reason: the editor's shortcuts are bound on documentElement, so
	// while it is being typed into, Delete deletes the object, arrows move it
	// and Tab cycles the selection. The textarea has stopped propagation since
	// forever (below); this is the same guard for the other editing surface.
	['keydown', 'keypress', 'keyup'].forEach(function(type) {
		render.addEventListener(type, function(e) {
			if (!this.isContentEditable) {
				return;
			}
			e.stopPropagation();
		});
	});

	render.addEventListener('mousedown', function(e) {
		// same reason as the textarea's handler below - edit.js preventDefaults
		// mousedown on the canvas, which would stop a caret being placed
		if (this.isContentEditable) {
			e.stopPropagation();
		}
	});

	render.addEventListener('keydown', function(e) {
		if (!this.isContentEditable) {
			return;
		}
		if (e.key == 'Escape') {
			$.glue.text.stop_editing(this.parentElement);
			e.preventDefault();
			return;
		}
		if (e.key == 'Enter') {
			// Insert our OWN marked <br> rather than letting the browser
			// decide: blink wraps the new line in a <div> and gecko inserts a
			// bare <br>, so without this the same keystroke produces different
			// source on the two engines. Marked, so it reads back as a newline
			// while a <br> the author typed stays a <br>.
			var br = document.createElement('br');
			br.setAttribute('data-glue-nl', '1');
			var sel = window.getSelection();
			if (sel && sel.rangeCount) {
				var range = sel.getRangeAt(0);
				range.deleteContents();
				range.insertNode(br);
				// a trailing <br> is not rendered unless something follows it
				var pad = document.createTextNode('​');
				br.after(pad);
				range.setStartAfter(br);
				range.collapse(true);
				sel.removeAllRanges();
				sel.addRange(range);
			}
			e.preventDefault();
		}
	});

	render.addEventListener('paste', function(e) {
		if (!this.isContentEditable) {
			return;
		}
		// Paste as PLAIN TEXT. Rich paste brings the source document's spans,
		// styles and classes with it, and they are indistinguishable from
		// markup the author wrote, so they would end up in the stored file.
		e.preventDefault();
		var text = (e.clipboardData || window.clipboardData).getData('text/plain');
		var sel = window.getSelection();
		if (!sel || !sel.rangeCount) {
			return;
		}
		var range = sel.getRangeAt(0);
		range.deleteContents();
		var parts = String(text).split(/\r\n|\r|\n/);
		var frag = document.createDocumentFragment();
		parts.forEach(function(part, i) {
			if (i) {
				var br = document.createElement('br');
				br.setAttribute('data-glue-nl', '1');
				frag.appendChild(br);
			}
			frag.appendChild(document.createTextNode(part));
		});
		range.insertNode(frag);
		range.collapse(false);
		sel.removeAllRanges();
		sel.addRange(range);
	});

	input.addEventListener('mousedown', function(e) {
		// without this selecting text in the textarea doesn't work because of
		// a mousedown handler on body in edit.js
		if (getComputedStyle(this).display == 'none') {
			// we're not editing
			return;
		} else {
			e.stopPropagation();
		}
	});

	input.addEventListener('keydown', function(e) {
		if (getComputedStyle(this).display == 'none') {
			// we're not editing
			return;
		} else {
			e.stopPropagation();
		}

		if (e.which == 9) {
			// tab (key code 9)
			$.glue.text.insert_at_cursor(this, String.fromCharCode(9));
			e.preventDefault();
			return false;
		} else if (e.shiftKey && e.which == 32) {
			// shift+space: add a non-breakable space (&nbsp; or key code 160)
			$.glue.text.insert_at_cursor(this, String.fromCharCode(160));
			e.preventDefault();
			return false;
		} else if (e.which == 27) {
			$.glue.text.stop_editing(this.parentElement);
			e.preventDefault();
			return false;
		}

	});

	input.addEventListener('keypress', function(e) {
		if (getComputedStyle(this).display == 'none') {
			// we're not editing
			return;
		} else {
			e.stopPropagation();
		}
	});

	input.addEventListener('keyup', function(e) {
		if (getComputedStyle(this).display == 'none') {
			// we're not editing
			return;
		} else {
			e.stopPropagation();
		}
	});

	// disable links
	render.querySelectorAll('a').forEach(function(a) {
		a.addEventListener('click', function(e) {
			e.preventDefault();
			return false;
		});
		a.title = 'this link is disabled for editing';
	});
});

$.glue.live('.text', 'glue-deselect', function(e) {
	// check if we are editing
	if (this.classList.contains('glue-text-editing')) {
		$.glue.text.stop_editing(this);
	}
});

$.glue.live('.text.glue-selected', 'click', function(e) {
	var self = this;
	// check if we are already editing
	if (self.classList.contains('glue-text-editing')) {
		return;
	}
	// deselect all other objects
	if (self.classList.contains('glue-selected')) {
		Array.from(document.querySelectorAll('.glue-selected')).filter(function(el) {
			return el !== self;
		}).forEach(function(el) {
			$.glue.sel.deselect(el);
		});
	}
	var input = self.querySelector(':scope > .glue-text-input');
	var render = self.querySelector(':scope > .glue-text-render');
	self.classList.add('glue-text-editing');

	if (self.classList.contains('glue-text-source')) {
		// source mode: the textarea, as before
		input.style.display = 'block';
		render.style.display = 'none';
		input.focus();
		if (input.setSelectionRange) {
			input.setSelectionRange(0, 0);
		}
		return;
	}

	// WYSIWYG: edit the rendered div itself, so a link shows as underlined
	// text rather than as its markup. What is shown is the EDITING render
	// (see to_editing_html) and not the view render - the view render is a
	// one-way projection and saving it back would bake it into the file.
	render.innerHTML = $.glue.text.to_editing_html(input.value);
	render.contentEditable = 'true';
	render.spellcheck = false;
	render.style.display = 'block';
	input.style.display = 'none';
	render.focus();
});

// --- "make link" for a selection inside a text object ---------------------
//
// Text objects are edited as a TEXTAREA holding raw HTML source, not as
// contenteditable (see js/edit.js:2370). So there is no Selection/Range API to
// use here and document.execCommand('createLink') does nothing: making a link
// means splicing literal <a> tags into the textarea's value around the selected
// characters. That is also why the URL has to be escaped as attribute syntax on
// the way in - the user is authoring source, and a stray quote produces broken
// markup rather than a broken DOM.

// Schemes that are allowed to appear in a href here. Anything else - including
// javascript: and data: - is refused.
//
// This is hygiene, not a security boundary: the author is authenticated and is
// typing raw HTML into a textarea, so they can already write anything at all,
// this button included or not. The point is that a link the UI builds for you
// should never be something you did not ask for.
var LINK_SCHEME_RE = /^([a-z][a-z0-9+.-]*):/i;
var LINK_ALLOWED_SCHEMES = ['http', 'https', 'mailto', 'ftp'];

function text_link_url_problem(url) {
	url = url.trim();
	if (url === '') {
		return 'enter a URL';
	}
	var m = LINK_SCHEME_RE.exec(url);
	if (m) {
		if (LINK_ALLOWED_SCHEMES.indexOf(m[1].toLowerCase()) == -1) {
			return '"' + m[1] + ':" links are not allowed here';
		}
		return false;
	}
	// no scheme: an anchor, or a page/relative path, or a bare domain
	return false;
}

// What actually goes in the href. A bare domain gets https:// so the link
// works; anchors and relative hotglue paths are left exactly as typed.
function text_link_normalize(url) {
	url = url.trim();
	if (url === '' || LINK_SCHEME_RE.test(url)) {
		return url;
	}
	if (url.charAt(0) == '#' || url.charAt(0) == '/') {
		return url;
	}
	// something.tld[/...] - looks like a domain the user typed without a scheme
	if (/^[^\s\/]+\.[a-z]{2,}(\/|$|\?|#)/i.test(url)) {
		return 'https://' + url;
	}
	// otherwise treat it as an internal hotglue page name / relative path
	return url;
}

function text_link_escape_attr(s) {
	return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;')
		.replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Find an <a>...</a> in the source that contains the given offsets.
//
// A regex over the source, not a parser: the textarea holds text that may not
// even be well-formed while it is being typed. It is good enough to recognise
// a link this UI wrote, and it fails by finding nothing rather than by
// mangling something.
function text_link_at(value, start, end) {
	var re = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
	var m;
	while ((m = re.exec(value)) !== null) {
		var from = m.index;
		var to = m.index + m[0].length;
		if (start >= from && end <= to) {
			var href = /href\s*=\s*"([^"]*)"/i.exec(m[1]) || /href\s*=\s*'([^']*)'/i.exec(m[1]);
			var cls = /class\s*=\s*"([^"]*)"/i.exec(m[1]) || /class\s*=\s*'([^']*)'/i.exec(m[1]);
			return {
				from: from, to: to,
				href: href ? href[1] : '',
				cls: cls ? cls[1] : '',
				text: m[2]
			};
		}
	}
	return null;
}

// The dialog itself, shared by both editing surfaces. opts:
//   href, cls   .. current values, '' for a new link
//   note        .. what the dialog is acting on, shown to the user
//   on_save(href, cls), on_remove (omitted for a new link)
function text_link_ui(opts) {
	var m = $.glue.modal.open(opts.on_remove ? 'edit link' : 'make link');

	function field(labelText, value) {
		var label = document.createElement('label');
		label.className = 'glue-modal-field';
		var span = document.createElement('span');
		span.textContent = labelText;
		var inp = document.createElement('input');
		inp.type = 'text';
		inp.value = value || '';
		label.appendChild(span);
		label.appendChild(inp);
		m.modal.appendChild(label);
		return inp;
	}

	var what = document.createElement('div');
	what.className = 'glue-modal-note';
	what.textContent = opts.note;
	m.modal.appendChild(what);

	var url_input = field('URL', opts.href || 'https://');
	var class_input = field('class (optional, for your own CSS)', opts.cls || '');

	var problem = document.createElement('div');
	problem.className = 'glue-tag-problem';
	m.modal.appendChild(problem);

	var buttons = $.glue.modal.buttons(m.modal, function() {
		if (!validate()) {
			return;
		}
		var href = text_link_normalize(url_input.value);
		var cls = class_input.value.trim();
		m.close();
		opts.on_save(href, cls);
	}, m.close);

	if (opts.on_remove) {
		var remove = document.createElement('button');
		remove.type = 'button';
		remove.textContent = 'Remove link';
		remove.addEventListener('click', function() {
			m.close();
			opts.on_remove();
		});
		buttons.row.insertBefore(remove, buttons.row.firstChild);
	}

	function validate() {
		var msg = text_link_url_problem(url_input.value);
		url_input.classList.toggle('glue-tag-invalid', !!msg);
		problem.textContent = msg || '';
		buttons.ok.disabled = !!msg;
		return !msg;
	}
	url_input.addEventListener('input', validate);
	validate();
	url_input.focus();
	url_input.select();
}

// --- source mode: splice literal tags into the textarea's value ----------
function text_link_dialog(obj, input, start, end) {
	var value = input.value;
	var existing = text_link_at(value, start, end);
	var selected = value.substring(start, end);
	if (!existing && start === end) {
		$.glue.error('Select the text you want to turn into a link first, or put the cursor inside an existing link to edit it.');
		return;
	}
	function splice(from, to, str) {
		input.value = input.value.substring(0, from) + str + input.value.substring(to);
		var pos = from + str.length;
		input.focus();
		input.setSelectionRange(pos, pos);
	}
	var plain = (existing ? existing.text : selected).replace(/<[^>]*>/g, '').substring(0, 40);
	text_link_ui({
		href: existing ? existing.href : '',
		cls: existing ? existing.cls : '',
		note: (existing ? 'editing the link around "' : 'linking "') + plain + '"',
		on_save: function(href, cls) {
			var body = existing ? existing.text : selected;
			var link = '<a href="' + text_link_escape_attr(href) + '"' +
				(cls ? ' class="' + text_link_escape_attr(cls) + '"' : '') + '>' + body + '</a>';
			splice(existing ? existing.from : start, existing ? existing.to : end, link);
		},
		on_remove: existing ? function() {
			splice(existing.from, existing.to, existing.text);
		} : null
	});
}

// --- WYSIWYG mode: operate on the DOM, where there is no markup to splice -
function text_link_dialog_dom(obj, render) {
	var sel = window.getSelection();
	if (!sel || !sel.rangeCount || !render.contains(sel.anchorNode)) {
		$.glue.error('Select the text you want to turn into a link first, or put the cursor inside an existing link to edit it.');
		return;
	}
	// The modal takes focus, which collapses the live selection - so keep a
	// copy of the range now and act on that.
	var range = sel.getRangeAt(0).cloneRange();
	var node = sel.anchorNode;
	var existing = node && node.nodeType == 3 ? node.parentElement : node;
	existing = existing ? existing.closest('a') : null;
	if (existing && !render.contains(existing)) {
		existing = null;
	}
	if (!existing && range.collapsed) {
		$.glue.error('Select the text you want to turn into a link first, or put the cursor inside an existing link to edit it.');
		return;
	}
	var plain = (existing ? existing.textContent : range.toString()).substring(0, 40);
	text_link_ui({
		href: existing ? existing.getAttribute('href') || '' : '',
		cls: existing ? existing.className : '',
		note: (existing ? 'editing the link around "' : 'linking "') + plain + '"',
		on_save: function(href, cls) {
			var a = existing;
			if (!a) {
				a = document.createElement('a');
				// extractContents rather than surroundContents: the latter
				// throws when the selection only partly covers an element
				a.appendChild(range.extractContents());
				range.insertNode(a);
			}
			a.setAttribute('href', href);
			if (cls) {
				a.setAttribute('class', cls);
			} else {
				a.removeAttribute('class');
			}
			render.focus();
		},
		on_remove: existing ? function() {
			existing.replaceWith(...existing.childNodes);
			render.focus();
		} : null
	});
}

//
// --- font popover ----------------------------------------------------------
//
// Face, size and style in one panel, replacing three buttons: one that cycled
// through the installed faces a click at a time, one that had to be dragged to
// change the size, and one that cycled bold -> italic -> both -> normal.
//
// SCOPE IS THE WHOLE OBJECT, like every other control in this menu: they all
// read getComputedStyle(obj) and write obj.style.*. Nothing here styles a
// selection - text objects are edited as raw HTML in a textarea, so there is
// no execCommand to lean on, and per-selection styling would mean wrapping
// ranges by hand the way the link dialog does. That is a much bigger job and
// its own decision; until then the toggles are two-state, because with one
// object there is no third, partial state to be in.
//
// The panel behaves like the colour picker: placed in the nearest free space
// beside the object rather than over it, applied live so the judgement can be
// made by eye, closed by a click outside or Escape.
//

// One panel at a time, whichever it is: two open at once would fight for the
// same free space beside the object.
var text_popover_elem = false;

function text_popover_close()
{
	if (text_popover_elem) {
		text_popover_elem.remove();
		text_popover_elem = false;
	}
}

// Opens an empty panel for obj, or closes the one that is open if it is
// already this panel on this object (so the button toggles). Returns the
// element to fill with rows, or false when it just closed.
// cls .. a class naming the panel, e.g. 'glue-font-popover'
function text_popover_open(obj, cls)
{
	var same = text_popover_elem && $.glue.owner(text_popover_elem) === obj &&
		text_popover_elem.classList.contains(cls);
	text_popover_close();
	if (same) {
		return false;
	}
	var pop = document.createElement('div');
	pop.className = 'glue-popover glue-ui '+cls;
	$.glue.owner(pop, obj);
	return pop;
}

// Puts the filled panel on screen. Measured first, so $.glue.popover can fit
// it into the free space beside the object - which is why it goes into the
// DOM invisible rather than being positioned before it has a size.
function text_popover_show(pop)
{
	pop.style.visibility = 'hidden';
	document.body.appendChild(pop);
	text_popover_elem = pop;
	$.glue.popover.place(pop, $.glue.popover.pointer());
	pop.style.visibility = '';
}

// one row: a label and whatever control it names
function text_popover_row(label)
{
	var row = document.createElement('div');
	row.className = 'glue-font-row';
	if (label) {
		var l = document.createElement('div');
		l.className = 'glue-font-label';
		l.textContent = label;
		row.appendChild(l);
	}
	return row;
}

// A slider paired with a number field for the same value, kept in step.
//
// The FIELD is deliberately not capped by the slider: display type runs past
// the end of any sensible drag range, and so does the odd extreme letter
// spacing. The slider parks at its own end and the field keeps the real
// number.
//
// opts .. min, max, step, decimals, value, unit (label after the field),
//         apply(value, commit) - called live while dragging with commit
//         false, and once with true when the value is settled
// returns { row: element, set: function(value) } - set() is for whoever
// changes the value behind the row's back, e.g. the reset button
function text_popover_number_row(label, opts)
{
	var row = text_popover_row(label);
	var decimals = opts.decimals || 0;
	var fmt = function(v) {
		return decimals ? v.toFixed(decimals) : String(Math.round(v));
	};
	var clamp = function(v) {
		return Math.max(opts.min, Math.min(opts.max, v));
	};

	var range = document.createElement('input');
	range.type = 'range';
	range.className = 'glue-font-size-slider';
	range.min = opts.min;
	range.max = opts.max;
	range.step = opts.step;
	range.value = clamp(opts.value);

	var field = document.createElement('input');
	field.type = 'number';
	field.className = 'glue-font-size-field';
	field.step = opts.step;
	field.value = fmt(opts.value);

	range.addEventListener('input', function() {
		field.value = fmt(parseFloat(this.value));
		opts.apply(parseFloat(this.value), false);
	});
	range.addEventListener('change', function() {
		opts.apply(parseFloat(this.value), true);
	});
	field.addEventListener('input', function() {
		var v = parseFloat(this.value);
		if (isNaN(v)) {
			return;
		}
		range.value = clamp(v);
		opts.apply(v, false);
	});
	field.addEventListener('change', function() {
		var v = parseFloat(this.value);
		if (isNaN(v)) {
			this.value = fmt(parseFloat(range.value));
			return;
		}
		// tidied to the row's own precision once it is settled, so a typed
		// "8" and a dragged 8 look the same afterwards
		this.value = fmt(v);
		opts.apply(v, true);
	});

	row.appendChild(range);
	row.appendChild(field);
	if (opts.unit) {
		var u = document.createElement('div');
		u.className = 'glue-font-unit';
		u.textContent = opts.unit;
		row.appendChild(u);
	}
	return {
		row: row,
		set: function(v) {
			range.value = clamp(v);
			field.value = fmt(v);
		}
	};
}

function text_font_popover(obj)
{
	var pop = text_popover_open(obj, 'glue-font-popover');
	if (!pop) {
		return;
	}

	var cs = getComputedStyle(obj);
	var size = parseInt(cs.fontSize);
	if (isNaN(size) || size < 1) {
		size = 16;
	}
	// The old size control kept line-height in step with font-size, holding
	// whatever ratio was in effect (including one set deliberately through the
	// separate line-height control). Keep doing that, or changing the size
	// through this panel would quietly flatten it.
	var line_height = parseFloat(cs.lineHeight);
	var ratio = (!isNaN(line_height) && size) ? line_height/size : 1.2;

	var save = function() {
		$.glue.object.save(obj);
	};

	// --- row 1: face ------------------------------------------------------
	var fonts = [];
	var woff_fonts = [];
	$.glue.text.get_fonts(fonts, woff_fonts);
	var select = document.createElement('select');
	select.className = 'glue-font-face';
	var cur_face = cs.fontFamily;
	var option = function(parent, name) {
		var o = document.createElement('option');
		o.value = name;
		// the name of a face, set in that face - the point of the list
		o.style.fontFamily = name;
		o.textContent = name.replace(/["\']/g, '');
		if (name === cur_face) {
			o.selected = true;
		}
		parent.appendChild(o);
		return o;
	};
	// whatever the object is set to now goes first if it is not one of the
	// offered faces (an inherited default, or a face that has since been
	// removed), so the list never misreports what is on screen
	if (fonts.indexOf(cur_face) == -1) {
		option(select, cur_face);
	}
	var uploaded = [];
	var installed = [];
	fonts.forEach(function(f) {
		(woff_fonts.indexOf(f) == -1 ? installed : uploaded).push(f);
	});
	// uploaded fonts first and named as such: they are the ones the author
	// went and added, and hunting for them in an alphabetical run of system
	// faces is the thing the old cycling button was worst at
	[['your fonts', uploaded], ['fonts', installed]].forEach(function(g) {
		if (!g[1].length) {
			return;
		}
		var group = document.createElement('optgroup');
		group.label = g[0];
		g[1].forEach(function(f) {
			option(group, f);
		});
		select.appendChild(group);
	});
	select.addEventListener('change', function() {
		obj.style.fontFamily = this.value;
		save();
		// remembered as the default for newly created text objects, as the
		// old face button did (page_set_last_font(), site-wide)
		$.glue.conf.text.last_font = this.value;
		$.glue.backend({ method: 'page.set_last_font', font: this.value });
	});
	var face_row = text_popover_row(false);
	face_row.appendChild(select);
	pop.appendChild(face_row);

	// --- row 2: size ------------------------------------------------------
	var size_row = text_popover_number_row('size', {
		min: 8, max: 100, step: 1, value: size, unit: 'px',
		apply: function(px, commit) {
			if (px < 1) {
				return;
			}
			obj.style.fontSize = px+'px';
			obj.style.lineHeight = (px*ratio)+'px';
			if (commit) {
				save();
				$.glue.conf.text.last_font_size = obj.style.fontSize;
				$.glue.backend({ method: 'page.set_last_font_size', size: obj.style.fontSize });
				$.glue.conf.text.last_line_height = obj.style.lineHeight;
				$.glue.backend({ method: 'page.set_last_line_height', height: obj.style.lineHeight });
			}
		}
	});
	pop.appendChild(size_row.row);

	// --- row 3: style -----------------------------------------------------
	//
	// Four independent toggles, any combination valid. Underline and
	// strikethrough are the fiddly pair: they are ONE css property, so they
	// are read and written together as a list rather than one overwriting the
	// other. Neither was stored at all before this panel - see
	// text_alter_save() in module_text.inc.php.
	var decoration = function() {
		var d = cs.textDecorationLine || cs.textDecoration || '';
		return {
			underline: /underline/.test(d),
			strike: /line-through/.test(d)
		};
	};
	var weight = parseInt(cs.fontWeight, 10);
	var state = {
		bold: cs.fontWeight == 'bold' || (!isNaN(weight) && 600 <= weight),
		italic: cs.fontStyle == 'italic',
		underline: decoration().underline,
		strike: decoration().strike
	};

	var write_decoration = function() {
		var parts = [];
		if (state.underline) {
			parts.push('underline');
		}
		if (state.strike) {
			parts.push('line-through');
		}
		// empty string REMOVES the property, which is what makes the object
		// file lose the attribute again (text_alter_save unsets what is not
		// there); 'none' would be stored forever
		obj.style.textDecoration = parts.join(' ');
	};

	var style_row = text_popover_row('style');
	[
		['bold', 'bold', function() {
			obj.style.fontWeight = state.bold ? 'bold' : 'normal';
		}],
		['italic', 'italic', function() {
			obj.style.fontStyle = state.italic ? 'italic' : 'normal';
		}],
		['underline', 'underline', write_decoration],
		['strike', 'strikethrough', write_decoration]
	].forEach(function(t) {
		var b = document.createElement('div');
		b.className = 'glue-font-toggle glue-font-toggle-'+t[0];
		// the button is a T wearing the effect it applies
		b.textContent = 'T';
		b.title = t[1];
		b.dataset.style = t[0];
		if (state[t[0]]) {
			b.classList.add('glue-font-toggle-on');
		}
		b.addEventListener('click', function() {
			state[t[0]] = !state[t[0]];
			this.classList.toggle('glue-font-toggle-on', state[t[0]]);
			t[2]();
			save();
		});
		style_row.appendChild(b);
	});
	pop.appendChild(style_row);

	text_popover_show(pop);
}

//
// --- spacing popover -------------------------------------------------------
//
// Line height, letter spacing, word spacing and alignment, replacing four
// buttons: three that had to be dragged (with a click on the same button
// meaning "reset", which nothing told you) and one that cycled left ->
// centre -> right -> justify.
//
// Units: the three spacings are written in em, which is what the controls
// they replace wrote and what keeps them proportional if the type is resized
// later. Line height is shown as a MULTIPLE of the font size rather than a
// length, since that is how anyone reasons about it - 1.2, not 21.6px.
//
// The reset button clears all four properties. Emptying the style makes the
// object file drop the attributes entirely (text_alter_save() stores only
// what is set), so a reset object is byte-identical to one nobody ever
// touched, rather than one carrying "normal" forever.
//

function text_spacing_popover(obj)
{
	var pop = text_popover_open(obj, 'glue-spacing-popover');
	if (!pop) {
		return;
	}

	var save = function() {
		$.glue.object.save(obj);
	};
	// em is relative to the object's own font size, so every read and write
	// below goes through it
	var em = function() {
		var v = parseFloat(getComputedStyle(obj).fontSize);
		return (isNaN(v) || !v) ? 16 : v;
	};
	// a computed length in px, as a multiple of the font size. 'normal' is
	// what letter- and word-spacing report when nothing is set, and 0 is the
	// honest way to show it
	var to_em = function(value, fallback) {
		var px = parseFloat(value);
		if (isNaN(px)) {
			return fallback;
		}
		return px/em();
	};

	var cs = getComputedStyle(obj);

	var line = text_popover_number_row('line', {
		min: 0.5, max: 3, step: 0.05, decimals: 2, unit: '\u00d7',
		value: to_em(cs.lineHeight, 1.2),
		apply: function(v, commit) {
			obj.style.lineHeight = v+'em';
			if (commit) {
				save();
				// the old line-height control remembered this site-wide for
				// newly created text objects; so does this one
				$.glue.conf.text.last_line_height = obj.style.lineHeight;
				$.glue.backend({ method: 'page.set_last_line_height', height: obj.style.lineHeight });
			}
		}
	});
	pop.appendChild(line.row);

	var letter = text_popover_number_row('letter', {
		min: -0.2, max: 1, step: 0.01, decimals: 2, unit: 'em',
		value: to_em(cs.letterSpacing, 0),
		apply: function(v, commit) {
			obj.style.letterSpacing = v+'em';
			if (commit) {
				save();
			}
		}
	});
	pop.appendChild(letter.row);

	var word = text_popover_number_row('word', {
		min: -0.2, max: 2, step: 0.01, decimals: 2, unit: 'em',
		value: to_em(cs.wordSpacing, 0),
		apply: function(v, commit) {
			obj.style.wordSpacing = v+'em';
			if (commit) {
				save();
			}
		}
	});
	pop.appendChild(word.row);

	// --- alignment --------------------------------------------------------
	//
	// Four buttons rather than a cycle, so the one in force is visible
	// without clicking through the others. Note computed text-align reads
	// 'start' when nothing is set, which is left in a left-to-right page -
	// treat it as left rather than as "none of them".
	var align_row = text_popover_row('align');
	var align_buttons = [];
	var sync_align = function() {
		var cur = getComputedStyle(obj).textAlign;
		if (cur == 'start') {
			cur = 'left';
		}
		align_buttons.forEach(function(b) {
			b.classList.toggle('glue-align-on', b.dataset.align == cur);
		});
	};
	// The icon names are the SuperGlue set's, and two of them are swapped at
	// source: align-left.svg draws lines CENTRED on a common axis, while
	// align-center.svg draws them flush against a left margin rule. Mapped by
	// what the artwork shows rather than by what the file is called - a
	// button that says "centre" and looks like "left" is worse than an odd
	// pairing in here. Fix the names upstream and this table follows.
	[
		['left', 'align-center', 'align left'],
		['center', 'align-left', 'align centre'],
		['right', 'align-right', 'align right'],
		['justify', 'align-justify', 'justify']
	].forEach(function(a) {
		var b = $.glue.icon(a[1], a[2]);
		b.classList.add('glue-align-btn');
		b.dataset.align = a[0];
		b.addEventListener('click', function() {
			obj.style.textAlign = a[0];
			sync_align();
			save();
		});
		align_buttons.push(b);
		align_row.appendChild(b);
	});
	sync_align();
	pop.appendChild(align_row);

	// --- reset ------------------------------------------------------------
	var reset_row = text_popover_row(false);
	reset_row.classList.add('glue-popover-footer');
	var reset = document.createElement('div');
	reset.className = 'glue-popover-reset';
	reset.textContent = 'reset';
	reset.title = 'back to the default line height, spacing and alignment';
	reset.addEventListener('click', function() {
		obj.style.lineHeight = '';
		obj.style.letterSpacing = '';
		obj.style.wordSpacing = '';
		obj.style.textAlign = '';
		save();
		// the panel now says something that is no longer true, so it is read
		// back off the object rather than assumed
		var now = getComputedStyle(obj);
		line.set(to_em(now.lineHeight, 1.2));
		letter.set(to_em(now.letterSpacing, 0));
		word.set(to_em(now.wordSpacing, 0));
		sync_align();
	});
	reset_row.appendChild(reset);
	pop.appendChild(reset_row);

	text_popover_show(pop);
}

// closed by a click anywhere outside it, like the colour picker. Capture
// phase, so it closes even when something else stops the click.
document.documentElement.addEventListener('click', function(e) {
	if (text_popover_elem && !text_popover_elem.contains(e.target)) {
		text_popover_close();
	}
}, true);

document.documentElement.addEventListener('keydown', function(e) {
	if (e.key == 'Escape') {
		text_popover_close();
	}
});

// and it does not stay behind when the object it belongs to is dropped or
// dragged away from under it
$.glue.live('.object', 'glue-deselect', function(e) {
	if (text_popover_elem && $.glue.owner(text_popover_elem) === this) {
		text_popover_close();
	}
});

$.glue.live('.object', 'glue-movestart', function(e) {
	text_popover_close();
});

document.addEventListener('DOMContentLoaded', function() {
	//
	// menu items
	//
	var elem = document.createElement('img');
	elem.src = $.glue.base_url+'modules/text/text.png';
	elem.alt = 'btn';
	elem.title = 'add a new text object';
	elem.width = 32;
	elem.height = 32;
	elem.addEventListener('click', function(e) {
		// create new object
		$.glue.backend({ method: 'glue.create_object', 'page': $.glue.page }, function(data) {
			var elem = document.createElement('div');
			elem.className = 'text resizable object';
			elem.style.position = 'absolute';
			var input = document.createElement('textarea');
			input.className = 'glue-text-input';
			input.style.display = 'none';
			input.style.height = '100%';
			input.style.width = '100%';
			var render = document.createElement('div');
			render.className = 'glue-text-render';
			render.style.height = '100%';
			render.style.width = '100%';
			elem.appendChild(input);
			elem.appendChild(render);
			elem.id = data['name'];
			// default width and height is set in the css
			// randomly pick one of the default colors
			if ($.glue.conf.object.default_colors) {
				var rand = Math.floor(Math.random()*$.glue.conf.object.default_colors.length);
				elem.style.backgroundColor = $.glue.conf.object.default_colors[rand];
			}
			// default to whichever typeface/font size/line height were last
			// picked via "change typeface"/"change font size"/"change line
			// height" (site-wide, see page_set_last_font()/
			// page_set_last_font_size()/page_set_last_line_height()), so
			// the user doesn't have to cycle/drag back to them on every
			// new text object
			if ($.glue.conf.text.last_font) {
				elem.style.fontFamily = $.glue.conf.text.last_font;
			}
			if ($.glue.conf.text.last_font_size) {
				elem.style.fontSize = $.glue.conf.text.last_font_size;
			}
			if ($.glue.conf.text.last_line_height) {
				elem.style.lineHeight = $.glue.conf.text.last_line_height;
			}
			$.glue.canvas.add(elem);
			// make width and height explicit
			elem.style.width = elem.offsetWidth+'px';
			elem.style.height = elem.offsetHeight+'px';
			// move to mouseclick - converted out of page space, since in
			// centered mode an object's coordinates are measured from the
			// container rather than the page
			var at = $.glue.canvas.from_page(e.pageX, e.pageY);
			elem.style.left = (at.x-elem.offsetWidth/2)+'px';
			elem.style.top = (at.y-elem.offsetHeight/2)+'px';
			$.glue.object.register(elem);
			$.glue.object.save(elem);
		});
		$.glue.menu.hide();
	});
	$.glue.menu.register('new', elem);

	//
	// context menu items
	//

	// turn the currently selected text into a link - plain text glyph
	// rather than a new binary icon asset, same convention as the undo/
	// redo/gear buttons elsewhere. Storage/rendering need no changes at
	// all: html_encode_str_smart() already passes well-formed tags like
	// <a href="..."> through unescaped rather than encoding them, and
	// stop_editing() below already anticipates <a> tags inside rendered
	// text content (it finds and disables them while editing) - this
	// button just gives an easier way to insert one than hand-typing the
	// raw HTML into the textarea
	elem = $.glue.icon('hyperlink', 'turn the selected text into a link, or edit a link');
	elem.addEventListener('click', function(e) {
		var obj = $.glue.owner(this);
		var input = obj.querySelector(':scope > .glue-text-input');
		var render = obj.querySelector(':scope > .glue-text-render');
		if (render.isContentEditable) {
			text_link_dialog_dom(obj, render);
		} else {
			// selectionStart/End survive the textarea losing focus to this
			// click, which is what makes reading them here work at all
			text_link_dialog(obj, input, input.selectionStart, input.selectionEnd);
		}
	});
	$.glue.contextmenu.register('text', 'text-link', elem);

	// Source-mode toggle. WYSIWYG editing hides the markup, which is the
	// point, but it also means the browser's HTML parser gets a say in what
	// ends up stored: hand-written markup comes back canonicalised (an
	// unquoted attribute gains quotes, an uppercase tag becomes lowercase).
	// This is the way back to editing the literal source, and the way to fix
	// anything WYSIWYG gets wrong.
	elem = document.createElement('div');
	elem.style.alignItems = 'center';
	elem.style.backgroundColor = '#eee';
	elem.style.border = '1px solid #000';
	elem.style.boxSizing = 'border-box';
	elem.style.display = 'flex';
	elem.style.fontFamily = 'monospace';
	elem.style.fontSize = '15px';
	elem.style.height = '32px';
	elem.style.justifyContent = 'center';
	elem.style.width = '32px';
	elem.style.lineHeight = '32px';
	elem.style.textAlign = 'center';
	elem.title = 'switch between editing the text as it looks and editing its HTML source';
	elem.className = 'glue-btn-label';
	elem.textContent = '</>';
	elem.addEventListener('click', function(e) {
		var obj = $.glue.owner(this);
		var was_editing = obj.classList.contains('glue-text-editing');
		if (was_editing) {
			// commit whatever is on screen before swapping surfaces, so the
			// two never disagree about what the content is
			$.glue.text.stop_editing(obj);
		}
		obj.classList.toggle('glue-text-source');
		if (was_editing) {
			obj.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		}
	});
	$.glue.contextmenu.register('text', 'text-source', elem);


	elem = document.createElement('img');
	elem.src = $.glue.base_url+'modules/text/text-background-color.png';
	elem.alt = 'btn';
	elem.title = 'change background color';
	elem.width = 32;
	elem.height = 32;
	var colorpicker_shown = false;
	elem.addEventListener('click', function(e) {
		var obj = $.glue.owner(this);
		var col = getComputedStyle(obj).backgroundColor;
		if (e.shiftKey) {
			col = prompt('Enter background color (e.g. #ff0000 or rgb(255, 0, 0))', col);
			if (!col) {
				return;
			}
		}
		$.glue.colorpicker.show(col, false, function(col) {
			obj.style.backgroundColor = col;
			// explicitly set the color for the textarea as changes to the parent object are not reflected while editing on Chrome 10.0.634.0 and below)
			obj.querySelector(':scope > .glue-text-input').style.backgroundColor = col;
		}, function (col) {
			$.glue.object.save(obj);
			colorpicker_shown = false;
		});
		colorpicker_shown = true;
	});
	elem.addEventListener('glue-deselect', function(e) {
		// hide the colorpicker if we opened it
		if (colorpicker_shown) {
			$.glue.colorpicker.hide();
			colorpicker_shown = false;
		}
	});
	$.glue.contextmenu.register('text', 'text-background-color', elem);

	elem = document.createElement('img');
	elem.src = $.glue.base_url+'modules/text/text-background-transparent.png';
	elem.alt = 'btn';
	elem.title = 'make background transparent';
	elem.width = 32;
	elem.height = 32;
	elem.addEventListener('click', function(e) {
		var obj = $.glue.owner(this);
		obj.style.backgroundColor = 'transparent';
		obj.querySelector(':scope > .glue-text-input').style.backgroundColor = 'transparent';
		$.glue.object.save(obj);
	});
	$.glue.contextmenu.register('text', 'text-background-transparent', elem);

	elem = document.createElement('img');
	elem.src = $.glue.base_url+'modules/text/text-font-color.png';
	elem.alt = 'btn';
	elem.title = 'change font color';
	elem.width = 32;
	elem.height = 32;
	elem.addEventListener('click', function(e) {
		var obj = $.glue.owner(this);
		var col = getComputedStyle(obj).color;
		if (e.shiftKey) {
			col = prompt('Enter font color (e.g. #ff0000 or rgb(255, 0, 0))', col);
			if (!col) {
				return;
			}
		}
		$.glue.colorpicker.show(col, false, function(col) {
			obj.style.color = col;
		}, function (col) {
			$.glue.object.save(obj);
			colorpicker_shown = false;
		});
		colorpicker_shown = true;
	});
	// this also requires the glue-deselect handler above
	$.glue.contextmenu.register('text', 'text-font-color', elem);

	// --- font popover ----------------------------------------------------
	//
	// One button in place of the three that used to be here (size, face,
	// style). It opens the panel built by text_font_popover() below, which
	// looks and behaves like the colour picker: it goes in the nearest free
	// space beside the object rather than over it ($.glue.popover), applies
	// live, reads the object's current values when it opens, and closes on a
	// click outside or Escape.
	elem = $.glue.icon('font-face', 'font: face, size and style');
	elem.addEventListener('click', function(e) {
		text_font_popover($.glue.owner(this));
		e.stopPropagation();
	});
	$.glue.contextmenu.register('text', 'text-font', elem);

	// --- spacing popover -------------------------------------------------
	//
	// One button in place of the four that used to be here: line height,
	// letter spacing and word spacing, each of which had to be dragged, and
	// the alignment cycle. Same panel behaviour as the font popover above.
	elem = $.glue.icon('vertical-stack-space',
		'spacing: line, letter and word - and alignment');
	elem.addEventListener('click', function(e) {
		text_spacing_popover($.glue.owner(this));
		e.stopPropagation();
	});
	$.glue.contextmenu.register('text', 'text-spacing', elem);


	elem = document.createElement('img');
	elem.src = $.glue.base_url+'modules/text/text-padding.png';
	elem.alt = 'btn';
	elem.width = 32;
	elem.height = 32;
	elem.setAttribute('x-data', "{ tip: 'change padding, click to reset to default one' }");
	elem.setAttribute('x-bind:title', 'tip');
	elem.setAttribute('x-on:glue-menu-activate', 'text_padding_sync($el)');
	elem.addEventListener('mousedown', function(e) {
		var obj = $.glue.owner(this);
		// we assume px here, and for {left,right} {top,bottom} to be the same
		var computed = getComputedStyle(obj);
		var orig_x = parseInt(computed.paddingLeft);
		if (isNaN(orig_x)) {
			orig_x = 0;
		}
		var orig_w = obj.offsetWidth;
		var orig_y = parseInt(computed.paddingTop);
		if (isNaN(orig_y)) {
			orig_y = 0;
		}
		var orig_h = obj.offsetHeight;
		var no_change = true;
		var that = this;
		$.glue.slider(e, function(x, y, e) {
			var val_x = Math.floor(orig_x+x/6);
			if (val_x < 0) {
				val_x = 0;
			}
			var val_y = Math.floor(orig_y+y/6);
			if (val_y < 0) {
				val_y = 0;
			}
			// shift: same padding for x and y
			if (e.shiftKey) {
				if (val_x < val_y) {
					val_x = val_y;
				} else if (val_y < val_x) {
					val_y = val_x;
				}
			}
			obj.style.paddingLeft = val_x+'px';
			obj.style.paddingRight = val_x+'px';
			// resize object
			obj.style.width = (orig_w+2*orig_x-2*val_x)+'px';
			obj.style.paddingTop = val_y+'px';
			obj.style.paddingBottom = val_y+'px';
			obj.style.height = (orig_h+2*orig_y-2*val_y)+'px';
			Alpine.$data(that).tip = 'change padding ('+val_x+'px, '+val_y+'px), click to reset to default one';
			if (x != 0 || y != 0) {
				no_change = false;
			}
		}, function(x, y) {
			// reset padding if there was no change at all
			if (no_change) {
				var var_x = parseInt(getComputedStyle(obj).paddingLeft);
				if (!isNaN(var_x)) {
					// resize object
					obj.style.width = (obj.offsetWidth+2*var_x)+'px';
				}
				var var_y = parseInt(getComputedStyle(obj).paddingTop);
				if (!isNaN(var_y)) {
					obj.style.height = (obj.offsetHeight+2*var_y)+'px';
				}
				obj.style.paddingLeft = '';
				obj.style.paddingRight = '';
				obj.style.paddingTop = '';
				obj.style.paddingBottom = '';
				var resetComputed = getComputedStyle(obj);
				Alpine.$data(that).tip = 'change padding ('+resetComputed.paddingLeft+', '+resetComputed.paddingTop+'), click to reset to default one';
			}
			// use object.save() in both cases (width and height got changed too)
			$.glue.object.save(obj);
		});
		e.preventDefault();
		return false;
	});
	$.glue.contextmenu.register('text', 'text-text-padding', elem);

	// make sure we don't send to much over the wire for every save
	$.glue.object.register_alter_pre_save('text', function(obj, orig) {
		var input = obj.querySelector(':scope > .glue-text-input');
		// clear the textarea's background-image that Chrome sends along
		input.style.backgroundImage = '';
		// the textarea's content is automatically not included
		// we can read it out using
		// orig.querySelector(':scope > .glue-text-input').value
		// and even set it using
		// obj.querySelector(':scope > .glue-text-input').innerHTML
		// but later on (when turning the element into a string) the content of the
		// textarea get's magically encoded
		// a la:
		// &lt;a href="asd"&gt;test&lt;/a&gt;
		// for this reason we update the object's content not through
		// $.glue.object.update
		input.remove();
		obj.querySelector(':scope > .glue-text-render').remove();
	});
});
