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
	elem.src = $.glue.base_url+'modules/text/text-font-size.png';
	elem.alt = 'btn';
	elem.width = 32;
	elem.height = 32;
	elem.setAttribute('x-data', "{ tip: 'drag to change font size, click to reset to default one' }");
	elem.setAttribute('x-bind:title', 'tip');
	elem.setAttribute('x-on:glue-menu-activate', 'text_font_size_sync($el)');
	elem.addEventListener('mousedown', function(e) {
		var obj = $.glue.owner(this);
		// we assume px here
		var orig_val = parseInt(getComputedStyle(obj).fontSize);
		if (isNaN(orig_val)) {
			orig_val = 10;
		}
		// preserve whatever line-height-to-font-size ratio is currently in
		// effect (falls back to a sane readable default) so line-height
		// scales along with font-size instead of staying fixed - this
		// also correctly keeps a previously custom-set ratio (via the
		// separate "change line height" control) rather than resetting it
		var orig_line_height = parseFloat(getComputedStyle(obj).lineHeight);
		var line_height_ratio = (!isNaN(orig_line_height) && orig_val) ? orig_line_height/orig_val : 1.2;
		var no_change = true;
		var that = this;
		$.glue.slider(e, function(x, y) {
			var val = Math.floor(orig_val+y/6);
			if (val < 0) {
				val = 0;
			}
			obj.style.fontSize = val+'px';
			obj.style.lineHeight = (val*line_height_ratio)+'px';
			Alpine.$data(that).tip = 'drag to change font size ('+val+'px), click to reset to default one';
			if (x != 0 || y != 0) {
				no_change = false;
			}
		}, function(x, y) {
			// reset font-size if there was no change at all - line-height
			// is left alone here, since it has its own dedicated reset
			// (the separate "change line height" control) and a plain
			// click on this button shouldn't discard an unrelated,
			// deliberately customized line-height
			if (no_change) {
				obj.style.fontSize = '';
				$.glue.backend({ method: 'glue.object_remove_attr', name: obj.id, attr: 'text-font-size' });
				Alpine.$data(that).tip = 'drag to change font size ('+getComputedStyle(obj).fontSize+'px), click to reset to default one';
			} else {
				$.glue.object.save(obj);
				// remember as the site-wide default for newly created text
				// objects (see the "new text" handler above) - this
				// includes line-height, which this drag also sets
				// alongside font-size (see line_height_ratio above)
				$.glue.conf.text.last_font_size = obj.style.fontSize;
				$.glue.backend({ method: 'page.set_last_font_size', size: obj.style.fontSize });
				$.glue.conf.text.last_line_height = obj.style.lineHeight;
				$.glue.backend({ method: 'page.set_last_line_height', height: obj.style.lineHeight });
			}
		});
		e.preventDefault();
		return false;
	});
	$.glue.contextmenu.register('text', 'text-font-size', elem);

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

	elem = document.createElement('div');
	elem.className = 'glue-text-font-family';
	elem.style.height = '32px';
	elem.style.width = '32px';
	elem.title = 'add fonts ⚙';
	elem.addEventListener('glue-menu-activate', function(e) {
		var obj = $.glue.owner(this);
		var fonts = [];
		var woff_fonts = [];
		$.glue.text.get_fonts(fonts, woff_fonts);
		// check if current font is a woff-font
		var cur = getComputedStyle(obj).fontFamily;
		var faceElem = document.getElementById('glue-contextmenu-text-font-face');
		for (i=0; i < woff_fonts.length; i++) {
			if (cur === woff_fonts[i]) {
				// current font is a woff-font
				faceElem.classList.add('glue-text-font-face');
				faceElem.classList.remove('glue-text-font-family');
				faceElem.title = cur+' | add fonts ⚙';
				return;
			}
		}
		// not a woff-font
		faceElem.classList.remove('glue-text-font-face');
		faceElem.classList.add('glue-text-font-family');
		faceElem.title = cur+' | add fonts ⚙';
	});
	elem.addEventListener('click', function(e) {
		var obj = $.glue.owner(this);
		var fonts = [];
		var woff_fonts = [];
		$.glue.text.get_fonts(fonts, woff_fonts);
		// DEBUG
		//console.log(fonts);
		//console.log(woff_fonts);
		// search for current font
		var cur = getComputedStyle(obj).fontFamily;
		var n = false;
		for (var i=0; i < fonts.length; i++) {
			if (cur === fonts[i]) {
				// pick the next one
				if (i+1 < fonts.length) {
					n = i+1;
				} else {
					n = 0;
				}
				break;
			}
		}
		// otherwise fall back to the first one
		if (n === false && fonts.length) {
			n = 0;
		}
		if (n !== false) {
			obj.style.fontFamily = fonts[n];
			// check if woff-font
			var is_woff = false;
			for (var i=0; i < woff_fonts.length; i++) {
				if (woff_fonts[i] == fonts[n]) {
					is_woff = true;
					break;
				}
			}
			if (is_woff) {
				this.classList.add('glue-text-font-face');
				this.classList.remove('glue-text-font-family');
			} else {
				this.classList.remove('glue-text-font-face');
				this.classList.add('glue-text-font-family');
			}
			this.title = fonts[n]+' | add fonts ⚙';
			$.glue.object.save(obj);
			// remember as the site-wide default for newly created text
			// objects (see the "new text" handler above)
			$.glue.conf.text.last_font = fonts[n];
			$.glue.backend({ method: 'page.set_last_font', font: fonts[n] });
		}
	});
	$.glue.contextmenu.register('text', 'text-font-face', elem);

	elem = document.createElement('img');
	elem.src = $.glue.base_url+'modules/text/text-font-style.png';
	elem.alt = 'btn';
	elem.title = 'change font style';
	elem.width = 32;
	elem.height = 32;
	elem.addEventListener('click', function(e) {
		var obj = $.glue.owner(this);
		var computed = getComputedStyle(obj);
		if (computed.fontStyle == 'normal' && (computed.fontWeight == 'bold' || computed.fontWeight == '700')) {
			obj.style.fontStyle = 'italic';
			obj.style.fontWeight = 'normal';
		} else if (computed.fontStyle == 'italic' && (computed.fontWeight == 'normal' || computed.fontWeight == '400')) {
			obj.style.fontStyle = 'italic';
			obj.style.fontWeight = 'bold';
		} else if (computed.fontStyle == 'italic' && (computed.fontWeight == 'bold' || computed.fontWeight == '700')) {
			obj.style.fontStyle = 'normal';
			obj.style.fontWeight = 'normal';
		} else {
			obj.style.fontStyle = 'normal';
			obj.style.fontWeight = 'bold';
		}
		$.glue.object.save(obj);
	});
	$.glue.contextmenu.register('text', 'text-font-style', elem);

	elem = document.createElement('img');
	elem.src = $.glue.base_url+'modules/text/text-line-height.png';
	elem.alt = 'btn';
	elem.title = 'change line height, click to reset to default one';
	elem.width = 32;
	elem.height = 32;
	elem.addEventListener('glue-menu-activate', function(e) {
		// TODO (later): my px to em calculation is not working perfectly, so leave this out for now
		/*
		var obj = $.glue.owner(this);
		if ($(obj).css('line-height').substr(-2) == 'em') {
			$(this).attr('title', 'change line height ('+$(obj).css('line-height')+'), click to reset to default one');
		} else if ($(obj).css('line-height').substr(-2) == 'px') {
			$(this).attr('title', 'change line height ('+parseFloat($(obj).css('line-height'))/parseFloat($(obj).css('font-size'))+'em), click to reset to default one');
		}
		*/
	});
	elem.addEventListener('mousedown', function(e) {
		var obj = $.glue.owner(this);
		// jquery seems to always return line-height in px
		// but just in case, try to handle em as well
		// assume px for font-size
		var font_size = parseFloat(getComputedStyle(obj).fontSize);
		var line_height = getComputedStyle(obj).lineHeight;
		if (line_height.substr(-2) == 'em') {
			var orig_val = parseFloat(line_height)*font_size;
		} else if (line_height.substr(-2) == 'px') {
			var orig_val = parseFloat(line_height);
		} else {
			// some sane fallback
			var orig_val = font_size*1.2;
		}
		var no_change = true;
		var that = this;
		$.glue.slider(e, function(x, y) {
			var val = orig_val+y/6;
			if (val < 0) {
				val = 0;
			}
			// set line-height in em
			obj.style.lineHeight = (val/font_size)+'em';
			//$(that).attr('title', 'change line height ('+(val/font_size)+'em), click to reset to default one');
			if (x != 0 || y != 0) {
				no_change = false;
			}
		}, function(x, y) {
			// reset line-height if there was no change at all
			if (no_change) {
				obj.style.lineHeight = '';
				$.glue.backend({ method: 'glue.object_remove_attr', name: obj.id, attr: 'text-line-height' });
				/*
				if ($(obj).css('line-height').substr(-2) == 'em') {
					$(that).attr('title', 'change line height ('+$(obj).css('line-height')+'), click to reset to default one');
				} else if ($(obj).css('line-height').substr(-2) == 'px') {
					$(that).attr('title', 'change line height ('+parseFloat($(obj).css('line-height'))/parseFloat($(obj).css('font-size'))+'em), click to reset to default one');
				}
				*/
			} else {
				$.glue.object.save(obj);
				// remember as the site-wide default for newly created text
				// objects (see the "new text" handler above)
				$.glue.conf.text.last_line_height = obj.style.lineHeight;
				$.glue.backend({ method: 'page.set_last_line_height', height: obj.style.lineHeight });
			}
		});
		e.preventDefault();
		return false;
	});
	$.glue.contextmenu.register('text', 'text-line-height', elem);

	elem = document.createElement('img');
	elem.src = $.glue.base_url+'modules/text/text-letter-spacing.png';
	elem.alt = 'btn';
	elem.title = 'change letter spacing';
	elem.width = 32;
	elem.height = 32;
	elem.addEventListener('glue-menu-activate', function(e) {
		// TODO (later): my px to em calculation is not working perfectly, so leave this out for now
		/*
		var obj = $.glue.owner(this);
		if ($(obj).css('letter-spacing').substr(-2) == 'em') {
			$(this).attr('title', 'change letter spacing ('+$(obj).css('letter-spacing')+'), click to reset to default one');
		} else if ($(obj).css('letter-spacing').substr(-2) == 'px') {
			$(this).attr('title', 'change letter spacing ('+parseFloat($(obj).css('letter-spacing'))/parseFloat($(obj).css('font-size'))+'em), click to reset to default one');
		}
		*/
	});
	elem.addEventListener('mousedown', function(e) {
		var obj = $.glue.owner(this);
		// jquery seems to always return letter-spacing in px
		// but just in case, try to handle em as well
		// assume px for font-size
		var font_size = parseFloat(getComputedStyle(obj).fontSize);
		var letter_spacing = getComputedStyle(obj).letterSpacing;
		if (letter_spacing.substr(-2) == 'em') {
			var orig_val = parseFloat(letter_spacing)*font_size;
		} else if (letter_spacing.substr(-2) == 'px') {
			var orig_val = parseFloat(letter_spacing);
		} else {
			// some sane fallback
			var orig_val = 0.0;
		}
		var no_change = true;
		var that = this;
		$.glue.slider(e, function(x, y) {
			var val = orig_val+y/6;
			obj.style.letterSpacing = (val/font_size)+'em';
			//$(that).attr('title', 'change letter spacing ('+(val/font_size)+'em), click to reset to default one');
			if (x != 0 || y != 0) {
				no_change = false;
			}
		}, function(x, y) {
			// reset letter-spacing if there was no change at all
			if (no_change) {
				obj.style.letterSpacing = '';
				$.glue.backend({ method: 'glue.object_remove_attr', name: obj.id, attr: 'text-letter-spacing' });
				/*
				if ($(obj).css('letter-spacing').substr(-2) == 'em') {
					$(that).attr('title', 'change letter spacing ('+$(obj).css('letter-spacing')+'), click to reset to default one');
				} else if ($(obj).css('letter-spacing').substr(-2) == 'px') {
					$(that).attr('title', 'change letter spacing ('+parseFloat($(obj).css('letter-spacing'))/parseFloat($(obj).css('font-size'))+'em), click to reset to default one');
				}
				*/
			} else {
				$.glue.object.save(obj);
			}
		});
		e.preventDefault();
		return false;
	});
	$.glue.contextmenu.register('text', 'text-letter-spacing', elem);

	elem = document.createElement('img');
	elem.src = $.glue.base_url+'modules/text/text-word-spacing.png';
	elem.alt = 'btn';
	elem.title = 'change word spacing';
	elem.width = 32;
	elem.height = 32;
	elem.addEventListener('glue-menu-activate', function(e) {
		// TODO (later): my px to em calculation is not working perfectly, so leave this out for now
		/*
		var obj = $.glue.owner(this);
		if ($(obj).css('word-spacing').substr(-2) == 'em') {
			$(this).attr('title', 'change word spacing ('+$(obj).css('word-spacing')+'), click to reset to default one');
		} else if ($(obj).css('word-spacing').substr(-2) == 'px') {
			$(this).attr('title', 'change word spacing ('+parseFloat($(obj).css('word-spacing'))/parseFloat($(obj).css('font-size'))+'em), click to reset to default one');
		}
		*/
	});
	elem.addEventListener('mousedown', function(e) {
		var obj = $.glue.owner(this);
		// jquery seems to always return word-spacing in px
		// but just in case, try to handle em as well
		// assume px for font-size
		var font_size = parseFloat(getComputedStyle(obj).fontSize);
		var word_spacing = getComputedStyle(obj).wordSpacing;
		if (word_spacing.substr(-2) == 'em') {
			var orig_val = parseFloat(word_spacing)*font_size;
		} else if (word_spacing.substr(-2) == 'px') {
			var orig_val = parseFloat(word_spacing);
		} else {
			// some sane fallback
			var orig_val = 0.0;
		}
		var no_change = true;
		var that = this;
		$.glue.slider(e, function(x, y) {
			var val = orig_val+y/6;
			obj.style.wordSpacing = (val/font_size)+'em';
			//$(that).attr('title', 'change word spacing ('+(val/font_size)+'em), click to reset to default one');
			if (x != 0 || y != 0) {
				no_change = false;
			}
		}, function(x, y) {
			// reset word-spacing if there was no change at all
			if (no_change) {
				obj.style.wordSpacing = '';
				$.glue.backend({ method: 'glue.object_remove_attr', name: obj.id, attr: 'text-word-spacing' });
				/*
				if ($(obj).css('word-spacing').substr(-2) == 'em') {
					$(that).attr('title', 'change word spacing ('+$(obj).css('word-spacing')+'), click to reset to default one');
				} else if ($(obj).css('word-spacing').substr(-2) == 'px') {
					$(that).attr('title', 'change word spacing ('+parseFloat($(obj).css('word-spacing'))/parseFloat($(obj).css('font-size'))+'em), click to reset to default one');
				}
				*/
			} else {
				$.glue.object.save(obj);
			}
		});
		e.preventDefault();
		return false;
	});
	$.glue.contextmenu.register('text', 'text-word-spacing', elem);

	elem = document.createElement('img');
	elem.src = $.glue.base_url+'modules/text/text-align.png';
	elem.alt = 'btn';
	elem.width = 32;
	elem.height = 32;
	elem.setAttribute('x-data', "{ tip: 'change text alignment' }");
	elem.setAttribute('x-bind:title', 'tip');
	elem.setAttribute('x-on:glue-menu-activate', 'text_align_sync($el)');
	elem.addEventListener('click', function(e) {
		var obj = $.glue.owner(this);
		var val = getComputedStyle(obj).textAlign;
		var data = Alpine.$data(this);
		if (val == 'center') {
			obj.style.textAlign = 'right';
			data.tip = 'change text alignment (right)';
		} else if (val == 'right') {
			obj.style.textAlign = 'justify';
			data.tip = 'change text alignment (justify)';
		} else if (val == 'justify') {
			obj.style.textAlign = 'left';
			data.tip = 'change text alignment (left)';
		} else {
			obj.style.textAlign = 'center';
			data.tip = 'change text alignment (center)';
		}
		$.glue.object.save(obj);
	});
	$.glue.contextmenu.register('text', 'text-align', elem);

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
