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

// The padding panel lived here until 2026-09-16, as text_padding_popover(),
// opened by the menu's own 'change padding' button. Both are gone: padding is
// the inset between an object's box and its content, which is a property of the
// object rather than of its typography, and it is now object_padding_section()
// in modules/object/object-edit.js, a section of the object properties panel.
//
// It is the text module's to build all the same - text-padding-x /
// text-padding-y is the only padding hotglue stores, so the object panel only
// draws the section for a text object - and the code that moved is the code
// that was here, with its own panel's open/footer/show taken off it. What the
// text menu keeps is font, source and heading: what is left of its own
// controls once the ones that were about the object rather than the type went
// where they belong.

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
			// Scaffolding a run-formatting toggle leaves behind: an empty
			// <b>/<i>/<u>/<s>, or a font-size <span> whose only content was the
			// zero-width caret pad. Remove them so an abandoned toggle does not
			// persist as markup. "Empty" means no element children and no text
			// but zero-width spaces - a span holding just a newline is content
			// and stays. b/i/u/s need the no-attribute rule so an authored
			// <b class="x"> survives; an empty span renders nothing whatever
			// its style says, so it is removed either way.
			clone.querySelectorAll('b, i, u, s, span').forEach(function(el) {
				var scaffold = true;
				for (var i = 0; i < el.childNodes.length; i++) {
					var n = el.childNodes[i];
					if (n.nodeType == 3) {
						if (n.data.replace(/\u200b/g, '') !== '') {
							scaffold = false;
							break;
						}
					} else {
						scaffold = false;
						break;
					}
				}
				if (scaffold && (el.tagName == 'SPAN' || !el.hasAttributes())) {
					el.remove();
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
			// the panel's run half only exists while editing, and a panel open
			// on a render that is about to be re-rendered would be pointing at
			// nodes that are gone: close it before the surfaces swap
			text_panel_hide(elem);
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
			if (input.value !== text_preedit_content) {
				// the content edit is an undo step of its own - the html
				// snapshots carry attributes only
				$.glue.undo.capture_content(elem, text_preedit_content);
			}
			text_preedit_content = null;
			$.glue.backend({ method: 'glue.update_object', name: elem.id, 'content': input.value });
		}
	};
}();

// the content as the undo stack reads it: the editing render's source
// while editing, the stored source otherwise (js/edit.js, $.glue.undo)
$.glue.undo.content_reader = function(obj) {
	var input = obj.querySelector(':scope > .glue-text-input');
	var render = obj.querySelector(':scope > .glue-text-render');
	if (!input || !render) {
		return null;
	}
	return render.isContentEditable ?
		$.glue.text.from_editing_html(render) : input.value;
};
// the content at the moment editing began - the undo target for whatever
// the edit session does to it
var text_preedit_content = null;

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
	var panel;
	// already editing: a click is how the panel is asked for again after it
	// was closed from under the editing - Escape in one of its fields, or the
	// object being dragged. The mode itself follows the selection (the
	// document selectionchange listener), so nothing is forced here.
	if (self.classList.contains('glue-text-editing')) {
		// only when it is not up already: a click that just puts the caret
		// somewhere must not rebuild the panel the author is working in
		panel = $.glue.popover.current();
		if (!(panel && $.glue.owner(panel) === self &&
				panel.classList.contains('glue-font-popover'))) {
			text_panel_open(self);
		}
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
	text_preedit_content = input.value;
	self.classList.add('glue-text-editing');

	// Typing into a block whose background nearly matches its font colour is
	// typing blind, so on entering the edit the font colour defaults to the
	// inverted background (danja's call, 2026-09-24). Written to the inline
	// style, so the save that follows the edit stores it and the published
	// page shows the text the way the author saw it. A transparent background
	// never triggers - what shows through it is not this block's to fix - and
	// colours far enough apart are left alone.
	var _parse_rgb = function(s) {
		var m = /rgba?\(([^)]+)\)/.exec(s);
		if (!m) {
			return false;
		}
		var a = m[1].split(',');
		if (3 > a.length) {
			return false;
		}
		return { r: parseFloat(a[0]), g: parseFloat(a[1]), b: parseFloat(a[2]), alpha: 4 <= a.length ? parseFloat(a[3]) : 1 };
	};
	var _bg = _parse_rgb(getComputedStyle(self).backgroundColor);
	var _col = _parse_rgb(getComputedStyle(self).color);
	if (_bg && _col && 0.01 < _bg.alpha) {
		var _dist = Math.sqrt(Math.pow(_bg.r-_col.r, 2)+Math.pow(_bg.g-_col.g, 2)+Math.pow(_bg.b-_col.b, 2));
		if (120 > _dist) {
			self.style.color = 'rgb('+Math.round(255-_bg.r)+', '+Math.round(255-_bg.g)+', '+Math.round(255-_bg.b)+')';
			// the house save path, so the inversion is stored like any other
			// colour change the panel makes - and is undoable like one
			$.glue.object.save(self);
		}
	}

	if (self.classList.contains('glue-text-source')) {
		// source mode: the textarea, as before, and no panel - the panel is
		// the WYSIWYG surface's toolbar and the textarea is where the raw
		// markup is typed (it styles its own runs by hand)
		text_panel_hide(self);
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
	// the panel is this render's toolbar, and it opens with the editing: the
	// caret is collapsed at this point, so it comes up showing the object's
	// own type, and flips to the run controls as soon as a run is selected
	text_panel_open(self);
});

// --- "make link" for a selection inside a text object ---------------------
// (An earlier version validated the link URL against a scheme allowlist and
// normalised bare domains; both are gone - the link takes whatever non-empty
// string the author typed, and the href attribute escapes it.)

// --- the text panel --------------------------------------------------------
//
// ONE popout for a text object, and the selection picks which half of it is
// showing. Danja's call, 2026-09-17: "basically the only difference is that
// when some text is selected we use wysiwyg editor and when no text is
// selected object font props apply." There were two surfaces until then: this
// panel, which is the object's own type (face, size, style, spacing - written
// to obj.style.* and saved per change, undo captured), and a strip that
// docked under the object while it was edited WYSIWYG (B/I/U/S, colour, face
// and size for the SELECTED RUN, written into the content as tags and
// committed once, when editing stops). The strip is gone: this panel is the
// toolbar of the contenteditable render it sits beside.
//
//   * a non-collapsed selection inside the edited render -> the run controls:
//     B/I/U/S and the colour button as the icon row, then the face, the run's
//     size and the link row, all in the open - the run half has no fold;
//   * anything else - the caret collapsed, or the object not being edited ->
//     the object's type, exactly as this panel has always been.
//
// The mode is read through text_strip_range_for(), the CACHED range rather
// than the live one, so that a press on a panel control - which takes focus
// and collapses the live selection - still counts the run it was made on, and
// the panel does not swap the control out from under the hand using it. A
// flip REBUILDS the panel's body: the two modes must never both be in the DOM
// (a spec locating .glue-popover-advanced inside the panel still finds exactly
// one - the object half's fold), and a rebuild is what drops every closure,
// range and node the half it left was holding.
//
// Storage is unchanged in either mode, and keeping the two one panel rather
// than one widget is what makes that sayable. The object half is obj.style.*,
// saved per change; the run half wraps the selection in <b>/<i>/<u>/<s> or in
// a style span and is committed ONCE, by stop_editing's glue.update_object.
// The render pipeline passes any well-formed tag through byte-for-byte
// (html_encode_str_smart), so no server code knows or cares that these tags
// exist - the browser renders them, on this page and on the published one.
//
// The range work is done by hand - including the link row - no execCommand
// anywhere. Every op re-installs an explicit range afterwards, because focus
// drifts to the panel on click and engines differ in what caret they put
// back. Selection state is kept in text_strip_range (updated on
// selectionchange) so the face dropdown and the size scrub can still act
// after focus moved.

var text_strip_obj = null;         // the .text object the panel belongs to
var text_strip_render = null;      // its .glue-text-render
var text_strip_range = null;       // last known selection inside the render (cloneRange)
var text_strip_snapshot = null;    // range the face dropdown and size scrub act on
var text_strip_link_sync = null;   // keeps the link row in step with the selection
var text_strip_link_reset = null;  // empties the link row's fields
var text_panel_mode_now = null;    // 'object' | 'selection' - what the panel targets
var text_panel_sync_fn = null;     // the build's sync closure, while the panel is built
var text_face_recenter = null;     // centres the wheel once the panel is attached

// A face name as it appears in a dropdown option: cut to 24 characters. A
// composite like "Verdana, Geneva, Tahoma, sans-serif" reads as a sentence
// at 11px and set the whole panel's width, which no face name deserves
// (danja's call, 2026-09-18). The option's VALUE is the full family string,
// and it is what the dropdown writes: this is display only.
function text_face_name(name) {
	return name.length > 24 ? name.slice(0, 24) : name;
}

// The link row, under the face and the size. The url field IS the
// control - there is nothing to press: the selection decides what the button
// does. No link under it, 'make link' wraps the selected run; a link, 'remove
// link' unwraps it, and the url pre-fills so Enter edits the href. The sync
// keeps this current as the selection moves (text_strip_link_sync, called from
// the document selectionchange listener), and never while the author is
// typing.
function text_panel_link_build() {
	var link_row = document.createElement('div');
	link_row.className = 'glue-text-strip-link';
	var link_url = document.createElement('input');
	link_url.type = 'text';
	link_url.className = 'glue-link-field';
	link_url.title = 'the address the selected text links to';
	var link_btn = document.createElement('button');
	link_btn.type = 'button';
	link_btn.className = 'glue-link-add-class';
	link_btn.textContent = 'make link';
	link_btn.title = 'wrap the selected text in a link to this address';
	link_row.appendChild(link_url);
	link_row.appendChild(link_btn);

	// The target, as one of three choices (2026-09-23, danja) instead of
	// whatever the author could remember to type: 'same window' stores
	// nothing, 'new tab' stores '_blank', 'new window' stores the fixed
	// window name. The select is the shared link_target_select()
	// (object-edit.js, where the object link row lives) and sits on a row
	// of its own under the url - the link row already fills the panel's
	// width.
	var target_sel = (typeof link_target_select === 'function') ?
		link_target_select() : null;
	var target_row = $.glue.popover.row('target');
	if (target_sel) {
		target_sel.title = 'where clicking the link opens it';
		target_row.appendChild(target_sel);
	}
	var link_range = null;      // the snapshot the first interaction took
	var link_mode = 'add';      // what the button does right now
	var link_prefill = null;    // the href the sync put in, for change detection

	// the <a> the range's caret or anchor is inside, validated against the
	// object being edited
	var link_existing_for = function(range) {
		var render = text_strip_render;
		if (!range || !render) {
			return null;
		}
		var node = range.startContainer;
		var el = node && node.nodeType == 3 ? node.parentElement : node;
		el = el ? el.closest('a') : null;
		return (el && render.contains(el)) ? el : null;
	};
	var link_reset_fields = function() {
		link_url.value = '';
		link_range = null;
		link_prefill = null;
	};
	// the snapshot the first interaction takes wins: mousedown on the field
	// sees the live selection BEFORE the focus collapse, and every later
	// mousedown/focus (the button, the click's own focus) must not clobber
	// it
	var link_snapshot = function() {
		if (!link_range) {
			link_range = text_strip_range_for();
		}
	};
	var link_commit = function() {
		var render = text_strip_render;
		if (!render) {
			return;
		}
		var range = link_range || text_strip_range_for();
		if (!range) {
			return;
		}
		var existing = link_existing_for(range);
		if (!existing && range.collapsed) {
			$.glue.error('Select the text you want to turn into a link first, or put the cursor inside an existing link to edit it.');
			return;
		}
		if (!existing && !link_url.value.trim()) {
			return;		// nothing typed, nothing to do
		}
		if (!existing) {
			existing = document.createElement('a');
			// extractContents rather than surroundContents: the latter
			// throws when the selection only partly covers an element
			existing.appendChild(range.extractContents());
			range.insertNode(existing);
			// put the caret inside the new link: insertNode leaves the
			// range at the DIV level, and the row's state keys off a
			// selection inside the link
			range.selectNodeContents(existing);
			range.collapse(true);
		}
		// whatever the author typed, as long as it is a (non-empty) string -
		// no validation, no rewriting
		existing.setAttribute('href', link_url.value.trim());
		if (target_sel) {
			var tgt = target_sel.value;
			if (tgt) {
				existing.setAttribute('target', tgt);
			} else {
				existing.removeAttribute('target');
			}
		}
		link_reset_fields();
		text_strip_restore(render, range);
		render.focus();
		text_strip_link_sync();
	};
	var link_remove_click = function() {
		var render = text_strip_render;
		if (!render) {
			return;
		}
		var range = link_range || text_strip_range_for();
		var existing = link_existing_for(range);
		if (!existing) {
			return;
		}
		existing.replaceWith(...existing.childNodes);
		link_reset_fields();
		render.focus();
		text_strip_link_sync();
	};
	var link_keydown = function(e) {
		if (e.key == 'Escape') {
			// The panel's own Escape is a keydown on documentElement in the
			// bubble phase, so stopping it here is enough to keep the panel
			// open and let the field empty itself. So Escape means what it
			// means in a field anywhere else: the first press empties the
			// row, the second closes the panel the field is in.
			e.preventDefault();
			e.stopPropagation();
			link_reset_fields();
			if (text_strip_render) {
				text_strip_render.focus();
			}
			return;
		}
		if (e.key == 'Enter') {
			e.preventDefault();
			link_commit();
		}
		// no stopPropagation otherwise - the editor's global keydown ignores
		// fields (typing_in_a_field), like the size scrub above
	};
	link_url.addEventListener('keydown', link_keydown);
	link_url.addEventListener('mousedown', function() {
		link_range = text_strip_range_for();	// live selection, pre-collapse
	});
	link_url.addEventListener('focus', link_snapshot);
	link_btn.addEventListener('mousedown', link_snapshot);
	link_btn.addEventListener('click', function() {
		if (link_mode == 'remove') {
			link_remove_click();
		} else {
			link_commit();
		}
	});
	// an edit to a pre-filled url flips the button from 'remove link' to
	// 'update link' - and back, if the author restores the stored value
	link_url.addEventListener('input', function() {
		if (link_mode != 'add' && link_prefill !== null) {
			if (link_url.value != link_prefill) {
				link_btn.textContent = 'update link';
				link_btn.title = 'apply the edited address to the link';
				link_mode = 'update';
			} else {
				link_btn.textContent = 'remove link';
				link_btn.title = 'take the link off the text';
				link_mode = 'remove';
			}
		}
	});
	// keep the row in step with a selection that moves into or out of a
	// link; a selection that moves AWAY must not eat what the author is
	// typing, so only the existing-link prefill and the button react
	text_strip_link_sync = function() {
		if (!text_strip_obj) {
			return;
		}
		// never overwrite what the author is typing: the prefill only
		// applies while the field is not focused (focusing it collapses
		// the render's selection, which would otherwise fire this and eat
		// the edit mid-typing)
		if (document.activeElement == link_url) {
			return;
		}
		var existing = link_existing_for(text_strip_range_for());
		if (existing) {
			link_url.value = existing.getAttribute('href') || '';
			link_prefill = link_url.value;
			link_btn.textContent = 'remove link';
			link_btn.title = 'take the link off the text';
			link_mode = 'remove';
			if (target_sel) target_sel.set_value(existing.getAttribute('target') || '');
		} else {
			link_btn.textContent = 'make link';
			link_btn.title = 'wrap the selected text in a link to this address';
			link_mode = 'add';
			if (target_sel) target_sel.set_value('');
		}
	};
	text_strip_link_reset = link_reset_fields;
	link_reset_fields();

	// a target change on an existing link applies on the spot, the way the
	// object link row's does; without a link under the selection it only
	// remembers the choice for the next commit
	if (target_sel) {
		target_sel.addEventListener('change', function() {
			var render = text_strip_render;
			if (!render) {
				return;
			}
			var range = link_range || text_strip_range_for();
			var existing = link_existing_for(range);
			if (!existing) {
				return;
			}
			var tgt = target_sel.value;
			if (tgt) {
				existing.setAttribute('target', tgt);
			} else {
				existing.removeAttribute('target');
			}
			// applied to the live content; it lands in the file with the
			// next save, the way a link made here does
		});
	}

	return { link_row: link_row, target_row: target_row };
}

// live selection if it is inside the render, else the cached last-known
// selection, validated against the live DOM
function text_strip_range_for() {
	var render = text_strip_render;
	if (!render) {
		return null;
	}
	var sel = window.getSelection();
	if (sel && sel.rangeCount) {
		var r = sel.getRangeAt(0);
		if (render.contains(r.startContainer) && render.contains(r.endContainer)) {
			text_strip_range = r.cloneRange();
			return r.cloneRange();
		}
	}
	if (text_strip_range && render.contains(text_strip_range.startContainer) &&
		render.contains(text_strip_range.endContainer)) {
		return text_strip_range.cloneRange();
	}
	return null;
}

// focus the render if needed, then install the range as THE selection and as
// the cache (so the size field can act on the result of a toggle later).
// keep_focus is for the roller's keyboard settles: the range is reinstalled
// so the next arrow step reads it, but focus stays on the reel so the
// arrows keep working.
function text_strip_restore(render, r, keep_focus) {
	if (!keep_focus && document.activeElement !== render) {
		render.focus();
	}
	var sel = window.getSelection();
	sel.removeAllRanges();
	sel.addRange(r);
	text_strip_range = r.cloneRange();
}

// unwrap an element and keep a range that described its contents valid.
// Endpoints on el itself are remapped to their parent-index positions; text
// node endpoints survive because replaceWith(...el.childNodes) moves the
// SAME node objects (no merging happens in DOM API operations).
function text_strip_unwrap(render, el, range) {
	var parent = el.parentNode;
	var idx = Array.prototype.indexOf.call(parent.childNodes, el);
	var before = range.cloneRange();
	var remap = function(node, off) {
		return (node === el) ? { node: parent, off: idx + off } : { node: node, off: off };
	};
	el.replaceWith(...el.childNodes);
	var s = remap(before.startContainer, before.startOffset);
	var e = remap(before.endContainer, before.endOffset);
	var r2 = document.createRange();
	r2.setStart(s.node, s.off);
	r2.setEnd(e.node, e.off);
	if (before.collapsed) {
		r2.collapse(true);
	}
	text_strip_restore(render, r2);
}

// Toggle a run's <b>/<i>/<u>/<s> on the selection text_strip_range_for()
// describes. Every caller is a control of the panel's run half, and that half
// only exists while a run is selected - a caret puts the panel in object mode,
// where none of these buttons is in the DOM - so the range is never collapsed.
// The branch that used to plant an empty <b> with a ZWSP pad under a caret,
// hoping the author typed into it, went with the strip.
function text_strip_toggle(render, tag) {
	var range = text_strip_range_for();
	if (!range || range.collapsed) {
		return;
	}
	var cont = range.commonAncestorContainer;
	var el = (cont.nodeType == 3) ? cont.parentElement : cont;
	var inner = el && el.closest ? el.closest(tag) : null;
	if (inner && !render.contains(inner)) {
		inner = null;
	}
	var covers = function(e) {
		if (range.startContainer === e && range.startOffset === 0 &&
			range.endContainer === e && range.endOffset === e.childNodes.length) {
			return true;
		}
		return range.toString() === e.textContent && e.textContent !== '';
	};
	// toggle OFF: only attribute-less elements are unwrapped, so an authored
	// <b class="x"> is never destroyed behind the author's back
	if (inner && !inner.hasAttributes() && covers(inner)) {
		text_strip_unwrap(render, inner, range);
		return;
	}
	// toggle ON
	var frag = range.extractContents();
	// a nested same tag is redundant; drop attribute-less ones only
	frag.querySelectorAll(tag).forEach(function(n) {
		if (!n.hasAttributes()) {
			n.replaceWith(...n.childNodes);
		}
	});
	var w = document.createElement(tag);
	w.appendChild(frag);
	range.insertNode(w);
	var r2 = document.createRange();
	r2.selectNodeContents(w);
	text_strip_restore(render, r2);
}

// px: the run's font size, applied to the selection text_strip_snapshot
// describes. After wrapping, the snapshot is re-aimed at the wrapper, so the
// drag that keeps moving - and the digits of a typed number, one at a time -
// update the SAME span live instead of nesting a span per call.
//
// Selection-only, like the toggle above; and the strip's other two faces of
// this op are gone with it. The `null` that cleared a run's size back to the
// inherited one had no control left to reach it (a scrub has no empty state),
// and the branch that styled a collapsed caret's empty span has no caret to
// style.
function text_strip_apply_size(render, px) {
	var range = text_strip_snapshot;
	if (!range || range.collapsed || !render.contains(range.commonAncestorContainer)) {
		return;
	}
	var cont = range.commonAncestorContainer;
	var el = (cont.nodeType == 3) ? cont.parentElement : cont;
	var inner = el && el.closest ? el.closest('span') : null;
	if (inner && !render.contains(inner)) {
		inner = null;
	}
	var covering = text_strip_span_styled(inner) &&
		range.toString() === inner.textContent && inner.textContent !== '';
	if (covering) {
		inner.style.fontSize = px + 'px';        // live update, no nesting
		text_strip_clear_inner(inner, 'fontSize');
		return;
	}
	var sp = document.createElement('span');
	sp.style.fontSize = px + 'px';
	sp.appendChild(range.extractContents());
	text_strip_clear_inner(sp, 'fontSize');
	range.insertNode(sp);
	text_strip_snapshot = (function() {
		var r = document.createRange();
		r.selectNodeContents(sp);
		return r;
	})();
}

// is a span carrying a run-level style (any of the seven the panel applies)?
// All the applies share this test, so a run styled by one control and then
// touched by another stays on a SINGLE span instead of nesting one per pick.
function text_strip_span_styled(inner) {
	return inner && (inner.style.color || inner.style.fontSize ||
		inner.style.fontFamily || inner.style.lineHeight ||
		inner.style.letterSpacing || inner.style.wordSpacing ||
		inner.style.textShadow);
}

// The selection's own spans carry their own values of `prop`, and an inner
// value would win inside the wrapper an apply just put around them - two
// words with different faces selected together would keep both faces and
// the new one would show on neither. So the value being applied now clears
// its own property on the spans inside the wrapper; a span that also
// carries other styles keeps those, and one left with nothing is
// unwrapped.
function text_strip_clear_inner(container, prop) {
	container.querySelectorAll('span').forEach(function(inner) {
		if (!inner.style[prop]) {
			return;
		}
		inner.style[prop] = '';
		if (!inner.getAttribute('style')) {
			inner.replaceWith(...inner.childNodes);
		}
	});
}

// One apply for every run-level style that lives on the styled span: the
// spacings and the shadow. Same join-a-styled-span behaviour as size, face
// and colour, and `value` is the literal style string the span stores.
// '' removes the property, and a span that has nothing left is unwrapped -
// the run's default is absence, like the object's.
function text_strip_apply_style(render, prop, value) {
	var range = text_strip_snapshot;
	if (!range || range.collapsed || !render.contains(range.commonAncestorContainer)) {
		return;
	}
	var cont = range.commonAncestorContainer;
	var el = (cont.nodeType == 3) ? cont.parentElement : cont;
	var inner = el && el.closest ? el.closest('span') : null;
	if (inner && !render.contains(inner)) {
		inner = null;
	}
	var covering = text_strip_span_styled(inner) &&
		range.toString() === inner.textContent && inner.textContent !== '';
	if (covering) {
		if (value === '') {
			inner.style[prop] = '';
			text_strip_clear_inner(inner, prop);
			if (!inner.getAttribute('style')) {
				// nothing left but the tag itself: unwrap it
				inner.replaceWith(...inner.childNodes);
			}
		} else {
			inner.style[prop] = value;              // join the styled span
			text_strip_clear_inner(inner, prop);
		}
		return;
	}
	if (value === '') {
		return;		// no covering span to clear, and nothing to write
	}
	var sp = document.createElement('span');
	sp.style[prop] = value;
	sp.appendChild(range.extractContents());
	text_strip_clear_inner(sp, prop);
	range.insertNode(sp);
	text_strip_snapshot = (function() {
		var r = document.createRange();
		r.selectNodeContents(sp);
		return r;
	})();
}

// The run's shadow, as the object's shadow is stored: a radius, a strength
// and a colour. The span carries the COMPOSED value - text-shadow with a
// color-mix alpha - because a run has no css rule of its own to compose in
// (the object's composition lives in css/main.css, .glue-text-shadow).
// Parsing it back is this regex's job.
function text_strip_run_shadow() {
	var render = text_strip_render;
	var range = text_strip_range_for();
	if (!range || !render) {
		return null;
	}
	var node = range.startContainer;
	var el = (node && node.nodeType == 3) ? node.parentElement : node;
	for (var cur = el; cur && cur !== render; cur = cur.parentElement) {
		if (cur.tagName == 'SPAN' && cur.style.textShadow) {
			// the engines serialize the composed value their own way: the
			// colour first with zero-padded offsets, or the offsets first;
			// the colour as #000000 or rgb(0, 0, 0)
			// the composed value layers the same shadow at shrinking radii;
			// the FIRST layer carries the ingredients the rest share
			var m = cur.style.textShadow.match(
				/^color-mix\(in srgb, (\S+) ([\d.]+)%, transparent\) 0px 0px ([\d.]+)px/) ||
				cur.style.textShadow.match(
				/^0 0 ([\d.]+)px color-mix\(in srgb, (\S+) ([\d.]+)%, transparent\)/);
			if (m) {
				return m[4] ? { radius: parseFloat(m[4]), color: m[1], alpha: parseFloat(m[2]) }
					: { radius: parseFloat(m[1]), color: m[2], alpha: parseFloat(m[3]) };
			}
		}
	}
	return { radius: 0, color: '#000000', alpha: 80 };
}

// radius 0 takes the shadow off the run; anything above it writes the
// composed value onto the run's span. The colour's own path raises a
// zeroed radius to 6, exactly as the object's does - a colour with no
// radius shows nothing, and giving it one is the honest reading of "I
// picked a colour".
function text_strip_apply_shadow(render, shadow) {
	var value = '';
	if (shadow.radius > 0) {
		// layered like the object's composition: the same shadow at half
		// and quarter radii, dense at the glyph (2026-09-22)
		var layer = function(r) {
			return '0 0 ' + r + 'px color-mix(in srgb, ' + shadow.color +
				' ' + shadow.alpha + '%, transparent)';
		};
		value = layer(shadow.radius) + ', ' + layer(shadow.radius * 0.5) +
			', ' + layer(shadow.radius * 0.25);
	}
	text_strip_apply_style(render, 'textShadow', value);
}

// face: string -> apply; '' -> clear (unwraps font-family spans fully inside
// the selection). A run already in a styled span gets the face ADDED to that
// span rather than wrapped in a second one, so size, face and colour stay on a
// single span no matter which was picked first. Selection-only, like the two
// above: a caret shows the object's own face row, not this one.
function text_strip_apply_face(render, face) {
	var range = text_strip_snapshot;
	if (!range || range.collapsed || !render.contains(range.commonAncestorContainer)) {
		return;
	}
	var cont = range.commonAncestorContainer;
	var el = (cont.nodeType == 3) ? cont.parentElement : cont;
	var inner = el && el.closest ? el.closest('span') : null;
	if (inner && !render.contains(inner)) {
		inner = null;
	}
	var covering = text_strip_span_styled(inner) &&
		range.toString() === inner.textContent && inner.textContent !== '';
	if (face === '') {
		if (covering) {
			// the whole run is the one styled span: drop only the face
			// from it - a size or colour on the same span stays. The
			// unwrap moves the range's nodes, and the browser collapses a
			// range whose home is being pulled out from under it: aim the
			// snapshot at a FRESH range over the same text first, so the
			// commit's restore still has a live one.
			var s0 = { node: range.startContainer, off: range.startOffset };
			var e0 = { node: range.endContainer, off: range.endOffset };
			inner.style.fontFamily = '';
			if (!inner.getAttribute('style')) {
				// nothing left but the tag itself: unwrap it
				inner.replaceWith(...inner.childNodes);
			}
			var r0 = document.createRange();
			r0.setStart(s0.node, s0.off);
			r0.setEnd(e0.node, e0.off);
			text_strip_snapshot = r0;
		} else {
			// extractContents collapses the range it was made from, and the
			// spans it unwraps move the text: capture the endpoints first
			var s1 = { node: range.startContainer, off: range.startOffset };
			var e1 = { node: range.endContainer, off: range.endOffset };
			var frag = range.extractContents();
			var changed = false;
			frag.querySelectorAll('span').forEach(function(sp) {
				if (sp.style.fontFamily) {
					sp.replaceWith(...sp.childNodes);
					changed = true;
				}
			});
			if (changed) {
				range.insertNode(frag);
			}
			var r1 = document.createRange();
			r1.setStart(s1.node, s1.off);
			r1.setEnd(e1.node, e1.off);
			text_strip_snapshot = r1;
		}
		return;
	}
	if (covering) {
		inner.style.fontFamily = face;              // join the styled span
		text_strip_clear_inner(inner, 'fontFamily');
		return;
	}
	var sp = document.createElement('span');
	sp.style.fontFamily = face;
	sp.appendChild(range.extractContents());
	text_strip_clear_inner(sp, 'fontFamily');
	range.insertNode(sp);
	text_strip_snapshot = (function() {
		var r = document.createRange();
		r.selectNodeContents(sp);
		return r;
	})();
}

// the colour the picker should open showing: the run's explicit span colour
// if it has one, else the text colour the run inherits
function text_strip_run_color() {
	var render = text_strip_render;
	var sel = window.getSelection();
	var node = sel && sel.rangeCount ? sel.anchorNode : null;
	if (node && render.contains(node)) {
		var el = (node.nodeType == 3) ? node.parentElement : node;
		for (var cur = el; cur && cur !== render; cur = cur.parentElement) {
			if (cur.tagName == 'SPAN' && cur.style.color) {
				return cur.style.color;
			}
		}
	}
	return getComputedStyle(render).color;
}

// col: string -> apply, to the selection text_strip_snapshot describes. Same
// join-a-styled-span behaviour as size and face, and the same selection-only
// rule - the picker's buttons are in the panel's icon row, which is the run
// half's.
function text_strip_apply_color(render, col) {
	var range = text_strip_snapshot;
	if (!range || range.collapsed || !render.contains(range.commonAncestorContainer)) {
		return;
	}
	var cont = range.commonAncestorContainer;
	var el = (cont.nodeType == 3) ? cont.parentElement : cont;
	var inner = el && el.closest ? el.closest('span') : null;
	if (inner && !render.contains(inner)) {
		inner = null;
	}
	var covering = text_strip_span_styled(inner) &&
		range.toString() === inner.textContent && inner.textContent !== '';
	if (covering) {
		inner.style.color = col;                    // join the styled span
		text_strip_clear_inner(inner, 'color');
		return;
	}
	var sp = document.createElement('span');
	sp.style.color = col;
	sp.appendChild(range.extractContents());
	text_strip_clear_inner(sp, 'color');
	range.insertNode(sp);
	text_strip_snapshot = (function() {
		var r = document.createRange();
		r.selectNodeContents(sp);
		return r;
	})();
}

// --- the panel's life: open, sync, close -----------------------------------

// What the panel's controls target right now. Only an edited render can
// hold a run selection, and only a non-collapsed range counts as one: a
// caret is not a selection, and with the caret on the object the object
// itself is the target.
function text_panel_mode() {
	var render = text_strip_render;
	if (!render || !render.isContentEditable || !text_strip_obj) {
		return 'object';
	}
	var r = text_strip_range_for();
	return (r && !r.collapsed) ? 'selection' : 'object';
}

// Build the panel once. The body does not change with the target - every
// control that can act on both retargets in place, and the three that
// cannot (align and reset, the object's own; the link row, the run's) are
// grayed by the sync - so a target flip costs nothing but a re-sync.
function text_panel_rebuild(pop, obj) {
	text_strip_obj = obj;
	text_strip_render = obj.querySelector(':scope > .glue-text-render');
	text_strip_snapshot = null;
	text_strip_link_sync = null;
	text_strip_link_reset = null;
	text_panel_sync_fn = null;
	// the cached range is what decides the target, so it is refreshed from
	// the live selection first: a rebuild is no time to forget a selection
	// the author is still holding
	text_strip_range_for();
	text_panel_mode_now = text_panel_mode();
	pop.innerHTML = '';
	text_panel_build(pop, obj);
}

// Everything the panel was holding, let go of. A panel can close while the
// object stays in editing mode (a click outside, Escape, the object being
// dragged), and what it held - a live range, a node of the render - must not
// stay held behind it.
function text_panel_state_clear() {
	text_strip_obj = null;
	text_strip_render = null;
	text_strip_range = null;
	text_strip_snapshot = null;
	text_strip_link_sync = null;
	text_strip_link_reset = null;
	text_panel_mode_now = null;
	text_panel_sync_fn = null;
	text_face_recenter = null;
}

// Open the panel on obj, or rebuild the one already open on it. open() itself
// toggles a same-class same-owner panel CLOSED, so the already-open case is
// answered before it is called - this is not a toggle.
function text_panel_open(obj) {
	if (!obj) {
		return;
	}
	var pop = $.glue.popover.current();
	if (pop && $.glue.owner(pop) === obj &&
			pop.classList.contains('glue-font-popover')) {
		text_panel_rebuild(pop, obj);
		$.glue.popover.place(pop, $.glue.popover.pointer());
		if (text_face_recenter) {
			text_face_recenter();
		}
		return;
	}
	pop = $.glue.popover.open(obj, 'glue-font-popover');
	if (!pop) {
		return;
	}
	// The object counts as part of the panel: clicking it is the gesture that
	// starts editing it, and that click must not close the panel on the way
	// in (keep_open_target, js/edit.js). For the panel's whole life rather
	// than for one gesture, because the click that keeps arriving is on the
	// render the object contains.
	pop.keep_open_target = obj;
	pop.on_close = text_panel_state_clear;
	text_panel_rebuild(pop, obj);
	$.glue.popover.show(pop);
	if (text_face_recenter) {
		text_face_recenter();
	}
}

// The menu button's toggle: open if closed, close if open, which is what every
// other panel button in the editor does.
function text_panel_toggle(obj) {
	var pop = $.glue.popover.current();
	if (pop && $.glue.owner(pop) === obj &&
			pop.classList.contains('glue-font-popover')) {
		$.glue.popover.close();
		return;
	}
	text_panel_open(obj);
}

// Close the panel if it is this object's, and let go of what it held. Called
// when editing stops and when the text switches to source mode - the panel is
// the WYSIWYG surface's toolbar, and neither of those has one.
function text_panel_hide(elem) {
	var pop = $.glue.popover.current();
	if (pop && $.glue.owner(pop) === elem &&
			pop.classList.contains('glue-font-popover')) {
		$.glue.popover.close();		// runs text_panel_state_clear
		return;
	}
	if (text_strip_obj === elem) {
		text_panel_state_clear();
	}
}

// toggles reflect the run's EXPLICIT tags only. The walk stops at the render
// div, so object-level inline styles (a bold OBJECT) live outside it and can
// never light a toggle - computed styles are not consulted at all.
// The panel follows the selection: a run selected inside the edited render
// makes the panel's controls act on that run, losing the selection turns
// them back on the whole object, and every caret move re-reads what the
// controls should show. The sync itself is a closure in text_panel_build -
// it is the one thing that knows every control the panel holds.
//
// A press on a panel control takes focus out of the render and collapses the
// live selection, and that collapse must not read as "the author let go of the
// run" - text_strip_range_for() falls back to the cached range, which is the
// one the press was made on.
document.addEventListener('selectionchange', function() {
	if (!text_strip_obj) {
		return;
	}
	var pop = $.glue.popover.current();
	if (!pop || $.glue.owner(pop) !== text_strip_obj ||
			!pop.classList.contains('glue-font-popover')) {
		return;                       // closed, or open on another object
	}
	var render = text_strip_render;
	var sel = window.getSelection();
	if (render && sel && sel.rangeCount) {
		var r = sel.getRangeAt(0);
		// only a selection inside the render belongs to this panel - a caret
		// that landed in one of the panel's own fields is not one
		if (render.contains(r.startContainer) && render.contains(r.endContainer)) {
			text_strip_range = r.cloneRange();
		}
	}
	text_panel_mode_now = text_panel_mode();
	if (text_panel_sync_fn) {
		text_panel_sync_fn();
	}
});

//
// --- the panel: one editor for the run and the object ----------------------
//
// Face, size, style, colour, spacings, shadow and a link, in one panel,
// replacing three buttons: one that cycled through the installed faces a
// click at a time, one that had to be dragged to change the size, and one
// that cycled bold -> italic -> both -> normal.
//
// The panel acts on whatever is CURRENT: a non-collapsed selection inside
// the edited render is the target, and the controls wrap tags and styled
// spans in the render; nothing selected is a caret, and the controls write
// the whole object's style (obj.style.*, stored as attributes). The body
// does not change with the target - one control retargets in place, so a
// flip is a re-sync, not a rebuild (danja's call, 2026-09-18, merging the
// two halves the panel used to swap between).
//
// Three controls cannot retarget and gray out instead:
//   * the alignments and the reset - the object's own (text-align is a
//     block property, and a reset clears the object's attributes) - gray
//     while a run is selected;
//   * the link row - the run's own (it wraps a selection; the whole-object
//     link is the object link panel) - grays while nothing is selected.
//
// The panel opens on the sizes (small, normal, big, extra), the styles with
// the colour beside them, and the alignments, then the face with the note
// under it, then the link row; everything else is under "more knobs", which
// is the house style every panel follows now (js/edit.js, beside
// icon_row()). The rows are unlabelled: every button in them is named in
// its tooltip and nowhere else.
//
// The panel behaves like the colour picker: placed in the nearest free space
// beside the object rather than over it, applied live so the judgement can be
// made by eye, closed by a click outside or Escape.
//

// Fills an already-open panel whose body has been emptied: the `pop` comes
// from text_panel_rebuild, which owns the open/show/close lifecycle.
function text_panel_build(pop, obj)
{
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

	// What a control acts on right now: the selected run, or the whole
	// object. Every control that can act on both branches on this; the
	// three that cannot are grayed by the sync. A press on a control
	// snapshots the run before focus can collapse the live selection - the
	// snapshot is the target while the press is in flight, and it is let
	// go of when the op commits.
	var run_active = function() {
		if (text_strip_snapshot && !text_strip_snapshot.collapsed) {
			return true;
		}
		return text_panel_mode() == 'selection';
	};
	// A run-level style would beat the object's own for its text: the
	// object-wide value is what the whole object wears, so the run spans'
	// own copies come off when the object branch writes. The content is
	// edited the way stop_editing edits it - the editing render directly
	// (committed by stop_editing), or the source string, re-rendered and
	// saved.
	var object_clear_runs = function(prop, commit) {
		var render = obj.querySelector(':scope > .glue-text-render');
		var input = obj.querySelector(':scope > .glue-text-input');
		if (!render || !input) {
			return;
		}
		if (render.isContentEditable) {
			text_strip_clear_inner(render, prop);
			return;
		}
		var probe = document.createElement('div');
		probe.innerHTML = input.value;
		text_strip_clear_inner(probe, prop);
		if (probe.innerHTML !== input.value) {
			var old_value = input.value;
			input.value = probe.innerHTML;
			render.innerHTML = $.glue.text.render_content(input.value, obj.id);
			if (commit) {
				$.glue.undo.capture_content(obj, old_value);
				$.glue.backend({ method: 'glue.update_object',
					name: obj.id, content: input.value });
			}
		}
	};

	// The link row is the run's own - except that a caret inside an
	// existing link is also its target (editing or removing that link), so
	// it stays alive for that one collapsed case.
	var link_available = function() {
		if (run_active()) {
			return true;
		}
		var r = text_strip_range_for();
		if (!r || !text_strip_render) {
			return false;
		}
		var node = r.startContainer;
		var el = node && node.nodeType == 3 ? node.parentElement : node;
		return !!(el && el.closest && el.closest('a') &&
			text_strip_render.contains(el.closest('a')));
	};
	// A row or button that exists but cannot act on the current target
	// wears this (css/edit.css): the panel's gray-out.
	var set_gray = function(el, gray) {
		el.classList.toggle('glue-popover-disabled', gray);
	};

	// The size the text actually renders at: the run's own span size if it
	// has one, else whatever it inherits - which for a caret is the
	// object's own size. The spacings' em reads and the size row's display
	// all go through it.
	var effective_size = function() {
		if (run_active() && text_strip_render) {
			var r = text_strip_range_for();
			var node = r && r.startContainer;
			var el = (node && node.nodeType == 3) ? node.parentElement : node;
			for (var cur = el; cur && cur !== text_strip_render;
					cur = cur.parentElement) {
				if (cur.tagName == 'SPAN' && cur.style.fontSize) {
					return parseInt(cur.style.fontSize, 10) || 16;
				}
			}
			return parseInt(getComputedStyle(text_strip_render).fontSize, 10) || 16;
		}
		return parseInt(getComputedStyle(obj).fontSize, 10) || 16;
	};

	// --- the acts: B/I/U/S and the colour ----------------------------------
	//
	// On the run they wrap/unwrap tags and a colour span in the render; on
	// the object they write obj.style.* - the same four effects, stored
	// wherever the target stores things.
	var icons = $.glue.popover.icon_row();
	pop.appendChild(icons);
	var toggles = {};
	var decoration = function() {
		var d = getComputedStyle(obj).textDecorationLine ||
			getComputedStyle(obj).textDecoration || '';
		return {
			underline: /underline/.test(d),
			strike: /line-through/.test(d)
		};
	};
	// the object's own toggle states - underline and strikethrough are ONE
	// css property, so they are read and written together as a list
	// rather than one overwriting the other
	var state = { bold: false, italic: false, underline: false, strike: false };
	var read_state_object = function() {
		var w = parseInt(getComputedStyle(obj).fontWeight, 10);
		var d = decoration();
		state.bold = getComputedStyle(obj).fontWeight == 'bold' ||
			(!isNaN(w) && 600 <= w);
		state.italic = getComputedStyle(obj).fontStyle == 'italic';
		state.underline = d.underline;
		state.strike = d.strike;
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
	[
		['b', 'font-style-bold', 'bold', function() {
			state.bold = !state.bold;
			obj.style.fontWeight = state.bold ? 'bold' : 'normal';
		}],
		['i', 'font-style-italic', 'italic', function() {
			state.italic = !state.italic;
			obj.style.fontStyle = state.italic ? 'italic' : 'normal';
		}],
		['u', 'font-style-underline', 'underline', function() {
			state.underline = !state.underline;
			write_decoration();
		}],
		['s', 'font-style-strikeout', 'strikethrough', function() {
			state.strike = !state.strike;
			write_decoration();
		}]
	].forEach(function(t) {
		var b = $.glue.popover.icon_button(t[1], t[2]);
		b.dataset.fmt = t[0];
		b.addEventListener('click', function() {
			if (run_active()) {
				if (text_strip_render) {
					text_strip_toggle(text_strip_render, t[0]);
				}
			} else {
				t[3]();
				save();
				sync();
			}
		});
		toggles[t[0]] = b;
		icons.appendChild(b);
	});
	// The colour button, same branch: a run gets a colour span (and the
	// caret back once the picker closes), the object gets obj.style.color.
	// The picker takes focus, which collapses the selection - so the range
	// is snapshotted on mousedown, before the click opens anything.
	var color_btn = $.glue.popover.color_button('text colour',
		function() {
			return run_active() ? text_strip_run_color() :
				getComputedStyle(obj).color;
		},
		function(col) {
			if (run_active()) {
				if (text_strip_render) {
					text_strip_apply_color(text_strip_render, col);
				}
			} else {
				obj.style.color = col;
			}
		},
		function(col) {
			if (run_active() && text_strip_render && text_strip_snapshot) {
				// commit: put the caret back where the formatting is
				text_strip_restore(text_strip_render, text_strip_snapshot);
				text_strip_snapshot = null;
			} else {
				$.glue.undo.begin_batch();
				object_clear_runs('color', true);
				save();
				$.glue.undo.end_batch();
				sync();
			}
		});
	color_btn.addEventListener('mousedown', function() {
		text_strip_snapshot = text_strip_range_for();
	});
	icons.appendChild(color_btn);
	read_state_object();

	// --- the face, and the size to the pixel ------------------------------
	//
	// The face was the panel's first row from the beginning - a list of the
	// installed faces, each option set in its own typeface, which is the whole
	// point of it. It slid under "more knobs" with the exact size on
	// 2026-09-17, and came back out above the fold the next day (danja's
	// call): a face is something most objects care about. The dropdown
	// became a custom list the same day, so the sample can follow the
	// pointer over its options, and that list became a ROLLER on
	// 2026-09-21 (SOW-font-roller-picker.md): a three-row drum whose
	// centred row is the selection, spun by wheel, drag and arrow keys
	// and applied when it settles.
	var fonts = [];
	var woff_fonts = [];
	$.glue.text.get_fonts(fonts, woff_fonts);
	var cur_face = cs.fontFamily;
	// null until the first face_show, so that show always counts as a
	// change and the reel's first centre lands on the face in force
	var face_current = null;

	// The roller is ALWAYS present in the panel since 2026-09-21 (danja's
	// call) - the button that opened it is gone, and the wheel sits
	// in-flow in the face row: a scroll container with y-proximity
	// snapping, where the snap makes the rows land centred, the JS reads
	// which one that is and applies it on settle. The list keeps the
	// select's two group headings and its option-set-in-its-own-face
	// convention, and the names are cut to 24 characters (text_face_name)
	// exactly as the select's were. The viewport is focusable, so the
	// arrow keys have somewhere to land.
	var face_list = document.createElement('div');
	face_list.className = 'glue-font-face-list';
	face_list.setAttribute('tabindex', '0');
	// the end spacer: (60 - 26) / 2, so the first row can reach the centre
	var face_pad_top = document.createElement('div');
	face_pad_top.className = 'glue-font-face-pad';
	face_list.appendChild(face_pad_top);

	// the range the roller acts on: refreshed on every interaction, but
	// never DEGRADED - the press that collapses the live selection must
	// not replace the run the snapshot still holds
	var face_snap = function() {
		var r = text_strip_range_for();
		if (r && !r.collapsed) {
			text_strip_snapshot = r;
		}
	};

	var face_show = function(name) {
		var changed = name !== face_current;
		face_current = name;
		var found = false;
		[].forEach.call(face_list.querySelectorAll('.glue-font-face-opt'), function(o) {
			if (o.dataset.value === name) {
				found = true;
			}
			o.classList.toggle('glue-font-face-on', o.dataset.value === name);
		});
		if (name && !found) {
			// a face that is not one of the offered ones (an inherited
			// default, or one that has since been removed): offer it first,
			// so the list never misreports what is on screen. The new row
			// goes after the leading pad and before the first option -
			// lastChild is the trailing pad once the pads exist.
			face_option(face_list, name);
			face_list.insertBefore(face_list.lastChild,
				face_list.querySelector('.glue-font-face-opt'));
		}
		if (changed) {
			// the drum follows the face wherever it changed from: the
			// synthesis above, or the target retargeting. Instant - the
			// drum must not visibly spin for a face it already wears.
			face_reel_center(name);
		}
	};

	// the roller's pick: the run gets the face wrapped on its styled span,
	// the object gets it written into its style - and '' takes either back
	// to the inherited face. The roller STAYS OPEN - dismissal is
	// click-away or Escape, and spinning on is the point of a drum.
	var face_picked = function(name) {
		if (run_active()) {
			if (text_strip_render) {
				if (!text_strip_snapshot) {
					text_strip_snapshot = text_strip_range_for();
				}
				text_strip_apply_face(text_strip_render, name);
				// commit: put the caret back where the formatting is -
				// except when the settle came from the arrow keys, which
				// must keep focus on the reel to step again
				if (text_strip_snapshot) {
					text_strip_restore(text_strip_render, text_strip_snapshot,
						document.activeElement === face_list);
					text_strip_snapshot = null;
				}
			}
		} else {
			obj.style.fontFamily = name;
			$.glue.undo.begin_batch();
			object_clear_runs('fontFamily', true);
			save();
			$.glue.undo.end_batch();
			if (name !== '') {
				// remembered as the default for newly created text objects,
				// as the old face button did (page_set_last_font(), site-wide)
				$.glue.conf.text.last_font = name;
				$.glue.backend({ method: 'page.set_last_font', font: name });
			}
		}
		face_show(name);
		sync();
	};

	var face_option = function(parent, name) {
		var o = document.createElement('div');
		o.className = 'glue-font-face-opt';
		o.dataset.value = name;
		// the name of a face, set in that face - the point of the list
		o.style.fontFamily = name;
		o.textContent = text_face_name(name.replace(/["\']/g, ''));
		// the click IS the interaction (2026-09-21, danja's call): the row
		// clicked is the face applied, and the wheel follows it into the
		// centre. No scrolling - the rows reachable are the ones in the
		// window, and the window moves with the selection.
		o.addEventListener('click', function() {
			face_picked(name);
		});
		parent.appendChild(o);
		return o;
	};
	// the list is just the faces, no headings and no default row
	// (2026-09-21, danja's call). Uploaded faces first - they are the ones
	// the author went and added, and hunting for them in an alphabetical
	// run of system faces is the thing the old cycling button was worst at.
	var uploaded = [];
	var installed = [];
	fonts.forEach(function(f) {
		(woff_fonts.indexOf(f) == -1 ? installed : uploaded).push(f);
	});
	uploaded.forEach(function(f) {
		face_option(face_list, f);
	});
	installed.forEach(function(f) {
		face_option(face_list, f);
	});
	// the trailing pad, closing the drum: the last row centres exactly at
	// the bottom of the scroll
	var face_pad_bottom = document.createElement('div');
	face_pad_bottom.className = 'glue-font-face-pad';
	face_list.appendChild(face_pad_bottom);

	// instant recentre on a named face (open, retarget, synthesis, and the
	// follow after a click). Rows are measured with getBoundingClientRect
	// deltas - offsetTop would be relative to the box, not the list. The
	// container is overflow:hidden, but a scrollTop write still moves it;
	// no listener reacts to the scroll, which is what keeps the apply the
	// click's own work.
	var face_reel_center = function(name) {
		var rows = face_list.querySelectorAll('.glue-font-face-opt');
		var hit = null;
		[].forEach.call(rows, function(r) {
			if (r.dataset.value === name) {
				hit = r;
			}
		});
		if (!hit) {
			face_list.scrollTop = 0;
			return;
		}
		var list_top = face_list.getBoundingClientRect().top;
		var box = hit.getBoundingClientRect();
		var center = (box.top - list_top - face_list.clientTop) +
			face_list.scrollTop + box.height / 2;
		face_list.scrollTop = Math.max(0, Math.min(
			face_list.scrollHeight - face_list.clientHeight,
			Math.round(center - face_list.clientHeight / 2)));
	};

	// --- the wheel: click, apply, follow ------------------------------------
	//
	// No scrolling at all (2026-09-21, danja's call): the rows in the 50px
	// window are clicked, the click applies the face, and the wheel
	// recentres so the applied row is the middle one. The recentre is the
	// only scrollTop writer in here, and there is no scroll listener to
	// react to it - the apply is the click's own work, never a settle's.
	//
	// Hovering the wheel hands it the keyboard: the arrows scroll the drum
	// one row at a time while the pointer is over it, without applying
	// (2026-09-21, danja's call - only the click applies).
	face_list.addEventListener('mouseenter', function() {
		face_list.focus();
	});
	face_list.addEventListener('keydown', function(e) {
		if (e.key != 'ArrowDown' && e.key != 'ArrowUp') {
			return;
		}
		e.preventDefault();
		e.stopPropagation();
		var rows = face_list.querySelectorAll('.glue-font-face-opt');
		var list_top = face_list.getBoundingClientRect().top;
		var view_center = face_list.scrollTop + face_list.clientHeight / 2;
		var idx = 0;
		var best = null;
		[].forEach.call(rows, function(r, i) {
			var box = r.getBoundingClientRect();
			var center = (box.top - list_top - face_list.clientTop) +
				face_list.scrollTop + box.height / 2;
			var off = Math.abs(center - view_center);
			if (best === null || off < best) {
				best = off;
				idx = i;
			}
		});
		var target = Math.max(0, Math.min(rows.length - 1,
			idx + (e.key == 'ArrowDown' ? 1 : -1)));
		var box = rows[target].getBoundingClientRect();
		var center = (box.top - list_top - face_list.clientTop) +
			face_list.scrollTop + box.height / 2;
		face_list.scrollTo({
			top: Math.max(0, Math.min(
				face_list.scrollHeight - face_list.clientHeight,
				center - face_list.clientHeight / 2)),
			behavior: 'smooth'
		});
	});

	// The wheel scrolls the drum at HALF pace (2026-09-21, danja's call:
	// re-enabled and slowed by 200%) - and like the drag, it applies
	// nothing; only the click applies.
	face_list.addEventListener('wheel', function(e) {
		e.preventDefault();
		face_list.scrollTop = Math.max(0, Math.min(
			face_list.scrollHeight - face_list.clientHeight,
			face_list.scrollTop + e.deltaY / 2));
	}, { passive: false });

	// The press on a row collapses the live selection, so the snapshot is
	// taken on pointerdown before the click - the run the click was made on
	// is the one the apply wraps.
	var reel_drag = null;
	face_list.addEventListener('pointerdown', function(e) {
		face_snap();
		reel_drag = { y: e.clientY, top: face_list.scrollTop };
		var move = function(ev) {
			var dy = reel_drag.y - ev.clientY;
			face_list.scrollTop = Math.max(0, Math.min(
				face_list.scrollHeight - face_list.clientHeight,
				reel_drag.top + dy));
			reel_drag.y = ev.clientY;
			reel_drag.top = face_list.scrollTop;
		};
		var up = function() {
			window.removeEventListener('pointermove', move);
			window.removeEventListener('pointerup', up);
			window.removeEventListener('pointercancel', up);
			// the release snaps to the nearest row - the drum never rests
			// between rows - but does NOT apply: only a click applies
			var rows = face_list.querySelectorAll('.glue-font-face-opt');
			var list_top = face_list.getBoundingClientRect().top;
			var view_center = face_list.scrollTop +
				face_list.clientHeight / 2;
			var best = null;
			[].forEach.call(rows, function(r) {
				var box = r.getBoundingClientRect();
				var center = (box.top - list_top - face_list.clientTop) +
					face_list.scrollTop + box.height / 2;
				var off = center - view_center;
				if (!best || Math.abs(off) < Math.abs(best)) {
					best = off;
				}
			});
			if (best !== null) {
				face_list.scrollTo({
					top: Math.max(0, Math.min(
						face_list.scrollHeight - face_list.clientHeight,
						Math.round(face_list.scrollTop + best))),
					behavior: 'smooth'
				});
			}
			reel_drag = null;
		};
		window.addEventListener('pointermove', move);
		window.addEventListener('pointerup', up);
		window.addEventListener('pointercancel', up);
	});

	// the build's own sync names the button and lights the current face,
	// once the rest of the panel exists - face_show touches the preview,
	// which is built further down

	// the face row is built here and appended into the open above the fold
	// (see the fold block below): the appends are what fix where a row
	// sits, and the wheel IS the row
	var face_row = $.glue.popover.row(false);
	face_row.appendChild(face_list);
	// the up-down affordance, the number rows' ↔ stood up: drawn on
	// the wheel's right end, pinned to the ROW so the rows scroll under it
	// instead of carrying it, and the drag goes straight through it
	face_row.style.position = 'relative';
	var face_arrow = document.createElement('div');
	face_arrow.className = 'glue-font-face-arrow';
	face_arrow.textContent = '\u2195';
	face_row.appendChild(face_arrow);

	// The one writer for the font size, whichever control asked for it: the
	// four buttons and the fold's scrub are two views of one number and
	// must not drift apart. The run gets its size wrapped on a span; the
	// object gets it written into its style - and holds line-height in
	// step with it, as the old drag control did.
	var set_size = function(px, commit) {
		if (px < 1) {
			return;
		}
		if (run_active()) {
			if (text_strip_render) {
				// live while dragging and while typing; the caret goes back
				// where the formatting is once the edit is settled
				text_strip_apply_size(text_strip_render, px);
				if (commit && text_strip_snapshot) {
					text_strip_restore(text_strip_render, text_strip_snapshot);
					text_strip_snapshot = null;
				}
			}
			return;
		}
		obj.style.fontSize = px+'px';
		obj.style.lineHeight = (px*ratio)+'px';
		$.glue.undo.begin_batch();
		object_clear_runs('fontSize', commit);
		if (commit) {
			save();
			$.glue.undo.end_batch();
			$.glue.conf.text.last_font_size = obj.style.fontSize;
			$.glue.backend({ method: 'page.set_last_font_size', size: obj.style.fontSize });
			$.glue.conf.text.last_line_height = obj.style.lineHeight;
			$.glue.backend({ method: 'page.set_last_line_height', height: obj.style.lineHeight });
		}
		// the row says the same number the buttons do. set() writes the slider
		// and the field without firing anything, so this cannot come back in
		// through the row's own apply - and a size the slider cannot reach (300
		// typed into the field) parks the slider at its end and keeps the
		// number, exactly as it does when the field itself is typed into.
		size_row.set(px);
		sync_size();
	};

	// --- row 1: the four sizes --------------------------------------------
	//
	// Small, normal, big and extra, one click each, with the number in the
	// tooltip. The buttons were letters wearing their own sizes until
	// 2026-09-21, when danja drew the font_small / font_normal / font_big /
	// font_extra_big artwork and the row took those - the same mask buttons
	// as the align row below. The sizes are what the panel opens on; the
	// face and the exact size slid under "more knobs" below them
	// (2026-09-17, danja's call).
	//
	// The scale moved up the same day - small 14, normal 24, big 32, extra
	// 48: a scale rather than three islands with a jump between the last
	// two, and the size the old row called big is the new one's normal.
	//
	// The one in force is lit. A size that is none of them - the scrub in the
	// fold sets one - leaves all four unlit, which is the honest picture rather
	// than rounding to the nearest.
	var size_buttons = [];
	var size_preset_row = $.glue.popover.row(false);
	[
		['s', 14, 'small: 14px', 'font-small'],
		['n', 24, 'normal: 24px', 'font-normal'],
		['b', 32, 'big: 32px', 'font-big'],
		['x', 48, 'extra: 48px', 'font-extra-big']
	].forEach(function(s) {
		var b = $.glue.icon(s[3], s[2]);
		b.classList.add('glue-font-size');
		b.classList.add('glue-font-size-'+s[0]);
		// the panel's icons are 26px; the toolbar's are 32 (the align
		// buttons' precedent)
		b.style.width = '26px';
		b.style.height = '26px';
		b.dataset.size = s[1];
		b.addEventListener('click', function() {
			set_size(s[1], true);
		});
		size_buttons.push(b);
		size_preset_row.appendChild(b);
	});
	var sync_size = function() {
		var cur = effective_size();
		size_buttons.forEach(function(b) {
			b.classList.toggle('glue-font-size-on',
				parseInt(b.dataset.size, 10) == cur);
		});
	};
	sync_size();
	// the press that sets a run's size also collapses the selection: the
	// range is taken on mousedown, like the size scrub's own
	size_preset_row.addEventListener('mousedown', function() {
		text_strip_snapshot = text_strip_range_for();
	});

	pop.appendChild(size_preset_row);

	// --- the size, exactly -------------------------------------------------
	//
	// The scrub for the size that is not one of the four buttons above.
	// It is appended into the fold below, and it retargets like the
	// buttons: a run gets its size wrapped on a span, the object gets it
	// written into its style.
	var size_row = $.glue.popover.number_row('size', {
		min: 1, max: 100, step: 1, value: size, unit: 'px',
		apply: function(px, commit) {
			set_size(px, commit);
		}
	});
	// The row is the drag handle, and the press that starts a scrub takes
	// focus and collapses the selection - so the range is taken on
	// pointerdown, exactly as the strip's field took it on mousedown.
	size_row.row.addEventListener('pointerdown', function() {
		text_strip_snapshot = text_strip_range_for();
	});
	var size_field_probe = size_row.row.querySelector('.glue-popover-field');
	if (size_field_probe) {
		size_field_probe.addEventListener('focus', function() {
			// fallback for programmatic focus (selection may already have collapsed)
			if (!text_strip_snapshot) {
				text_strip_snapshot = text_strip_range_for();
			}
		});
	}

	// The styles and the colour live in the icon row at the top now - the
	// same four effects, retargeted in place (2026-09-18, when the two
	// halves became one panel).

	// --- the alignments ----------------------------------------------------
	//
	// The object's own: text-align is a block property, and a run span
	// cannot carry it - so the sync grays the row while a run is selected.
	// Four buttons rather than a cycle, so the one in force is visible
	// without clicking through the others. Note computed text-align reads
	// 'start' when nothing is set, which is left in a left-to-right page -
	// treat it as left rather than as "none of them".
	var align_row = $.glue.popover.row(false);
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
		// the toolbar's own size, like every other popout icon now
		// (danja's call, 2026-09-25)
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

	// the face, out in the open above the fold (danja's call, 2026-09-18 -
	// it had been the fold's first row since the day before). The appends are
	// what fix where a row sits, and this one goes before "more knobs".
	pop.appendChild(face_row);

	// Where the faces in that dropdown come from, for anyone wondering why
	// theirs is not among them. A note rather than a control: uploading is a
	// site-wide thing and lives in site settings. It sits under the face it
	// explains.
	var note = document.createElement('div');
	note.className = 'glue-popover-note glue-font-note';
	note.innerHTML = 'upload new fonts in <a href="' + $.glue.base_url +
		'?pages">site settings</a>';
	pop.appendChild(note);

	// The link row, under the face and the size. The url field IS the
	// control - there is nothing to press: the selection decides what the
	// button does. No link under it, 'make link' wraps the selected run; a
	// link, 'remove link' unwraps it, and the url pre-fills so Enter edits
	// the href. It is the run's own row - the whole-object link is the
	// object properties panel's link row's job - so the sync grays it (and
	// the target row under it) while nothing is selected.
	var link_parts = text_panel_link_build();
	var link_row = link_parts.link_row;
	pop.appendChild(link_row);
	pop.appendChild(link_parts.target_row);

	// --- more knobs: the exact size, spacing and a shadow -------------------
	//
	// A panel of its own until now, opened from a button of its own. It is
	// the same subject - how the type sits - and most objects never touch it,
	// so it folds away here instead of taking a second button in the menu.
	// The face came out of it on 2026-09-18 and sits above, so the exact
	// size is its first row.
	var fold = $.glue.popover.fold(pop, 'more knobs');
	pop.appendChild(fold.toggle);
	var adv = fold.body;
	pop.appendChild(adv);

	// the exact size, first in the fold: built above, appended here, because
	// the appends are what fix what the panel looks like
	adv.appendChild(size_row.row);

	// em is relative to the size the text actually renders at: the run's
	// own span size if it has one, the object's otherwise. Every read and
	// write below goes through it.
	var em = function() {
		return effective_size();
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

	var line = $.glue.popover.number_row('line', {
		// hard floor at 0: a line-height of -1em is not a tight leading, it is
		// an invalid declaration the browser drops, so the object would render
		// at its default while the file kept the number. The ceiling is the
		// usual fence - the drag stops at 3, typing 8 is a real line-height
		min: 0.5, max: 3, step: 0.05, decimals: 2, unit: '\u00d7', hard: [0, null],
		value: to_em(cs.lineHeight, 1.2),
		apply: function(v, commit) {
			if (run_active() && text_strip_render) {
				// live while dragging and while typing; the caret goes back
				// where the formatting is once the edit is settled
				text_strip_apply_style(text_strip_render, 'lineHeight', v+'em');
				if (commit && text_strip_snapshot) {
					text_strip_restore(text_strip_render, text_strip_snapshot);
					text_strip_snapshot = null;
				}
				return;
			}
			obj.style.lineHeight = v+'em';
			$.glue.undo.begin_batch();
			object_clear_runs('lineHeight', commit);
			if (commit) {
				save();
				$.glue.undo.end_batch();
				// the old line-height control remembered this site-wide for
				// newly created text objects; so does this one
				$.glue.conf.text.last_line_height = obj.style.lineHeight;
				$.glue.backend({ method: 'page.set_last_line_height', height: obj.style.lineHeight });
			}
		}
	});
	adv.appendChild(line.row);

	var letter = $.glue.popover.number_row('letter', {
		// fine: the declared range is a fence around the useful one. Nobody
		// sets a whole em of letter spacing; the band anyone uses is about an
		// eighth of this, and at the default drag that eighth would be a 25px
		// gesture - the row would be all threshold and no travel.
		min: -0.2, max: 1, step: 0.01, decimals: 2, unit: 'em', fine: true,
		value: to_em(cs.letterSpacing, 0),
		apply: function(v, commit) {
			if (run_active() && text_strip_render) {
				// a run at 0 wears its own explicit zero, like the object's
				text_strip_apply_style(text_strip_render, 'letterSpacing', v+'em');
				if (commit && text_strip_snapshot) {
					text_strip_restore(text_strip_render, text_strip_snapshot);
					text_strip_snapshot = null;
				}
				return;
			}
			obj.style.letterSpacing = v+'em';
			$.glue.undo.begin_batch();
			object_clear_runs('letterSpacing', commit);
			if (commit) {
				save();
				$.glue.undo.end_batch();
			}
		}
	});
	adv.appendChild(letter.row);

	var word = $.glue.popover.number_row('word', {
		// fine: as letter above, whose range this one is the wider half of
		min: -0.2, max: 2, step: 0.01, decimals: 2, unit: 'em', fine: true,
		value: to_em(cs.wordSpacing, 0),
		apply: function(v, commit) {
			if (run_active() && text_strip_render) {
				// a run at 0 wears its own explicit zero, like the object's
				text_strip_apply_style(text_strip_render, 'wordSpacing', v+'em');
				if (commit && text_strip_snapshot) {
					text_strip_restore(text_strip_render, text_strip_snapshot);
					text_strip_snapshot = null;
				}
				return;
			}
			obj.style.wordSpacing = v+'em';
			$.glue.undo.begin_batch();
			object_clear_runs('wordSpacing', commit);
			if (commit) {
				save();
				$.glue.undo.end_batch();
			}
		}
	});
	adv.appendChild(word.row);

	// --- a halo behind the text ------------------------------------------
	//
	// text-shadow with no offset: a glow around the letters rather than a
	// shadow beside them. Same three ingredients as the object glow, and
	// the object stores them the same way - a radius, a strength and a
	// colour, composed in css/main.css. A run's span carries the COMPOSED
	// value instead (it has no rule of its own to compose in), and
	// text_strip_run_shadow() parses it back.
	var shadow = { radius: 0, color: '#000000', alpha: 80 };
	var read_shadow = function() {
		if (run_active() && text_strip_render) {
			var s = text_strip_run_shadow();
			shadow.radius = s ? s.radius : 0;
			shadow.color = s ? s.color : '#000000';
			shadow.alpha = s ? s.alpha : 80;
			return;
		}
		shadow.radius = parseFloat(obj.style.getPropertyValue('--glue-shadow-radius')) || 0;
		var a = parseFloat(obj.style.getPropertyValue('--glue-shadow-alpha'));
		shadow.alpha = isNaN(a) ? 80 : a;
		shadow.color = obj.style.getPropertyValue('--glue-shadow-color').trim() || '#000000';
	};
	read_shadow();
	var write_shadow = function(commit) {
		if (run_active()) {
			if (text_strip_render) {
				text_strip_apply_shadow(text_strip_render, shadow);
				if (commit && text_strip_snapshot) {
					text_strip_restore(text_strip_render, text_strip_snapshot);
					text_strip_snapshot = null;
				}
			}
			return;
		}
		if (shadow.radius <= 0) {
			obj.style.removeProperty('--glue-shadow-radius');
			obj.style.removeProperty('--glue-shadow-alpha');
			obj.style.removeProperty('--glue-shadow-color');
			obj.classList.remove('glue-text-shadow');
		} else {
			obj.style.setProperty('--glue-shadow-radius', shadow.radius);
			obj.style.setProperty('--glue-shadow-alpha', shadow.alpha);
			obj.style.setProperty('--glue-shadow-color', shadow.color);
			obj.classList.add('glue-text-shadow');
		}
		$.glue.undo.begin_batch();
		object_clear_runs('textShadow', commit);
		if (commit) {
			save();
			$.glue.undo.end_batch();
		}
	};

	var shadow_radius = $.glue.popover.number_row('shadow', {
		// hard floor: a blur radius is a magnitude, and the writer reads
		// anything at or below zero as "no shadow" - so a typed -5 would take
		// the shadow off and leave -5 in the field saying why. 40 is a fence
		// (a 200px shadow is a shadow), the floor is the meaning
		min: 0, max: 40, step: 0.5, decimals: 1, unit: 'px', hard: [0, null],
		value: shadow.radius,
		apply: function(px, commit) {
			shadow.radius = px;
			write_shadow(commit);
		}
	});
	adv.appendChild(shadow_radius.row);

	var shadow_alpha = $.glue.popover.number_row('fade', {
		// hard both ends: this is a percentage of opacity, and one of the three
		// rows in the editor whose number goes into the file as it was typed.
		// 150% reaches the object as --glue-shadow-alpha: 150 and the page as
		// whatever the colour function makes of it
		min: 0, max: 100, step: 1, unit: '%', hard: [0, 100],
		value: shadow.alpha,
		apply: function(pct, commit) {
			shadow.alpha = pct;
			// a strength with no shadow shows nothing: give it one, the
			// colour button's courtesy for the same situation (2026-09-22,
			// danja's call - the row felt inert without it)
			if (shadow.radius <= 0) {
				shadow.radius = 6;
				shadow_radius.set(6);
			}
			write_shadow(commit);
		}
	});
	adv.appendChild(shadow_alpha.row);

	var shadow_row = $.glue.popover.row('color');
	var shadow_color_btn = $.glue.popover.color_button('shadow colour',
		function() {
			read_shadow();
			return shadow.color;
		},
		function(col) {
			shadow.color = col;
			// a colour with no radius shows nothing; give it one
			if (shadow.radius <= 0) {
				shadow.radius = 6;
				shadow_radius.set(6);
			}
			write_shadow(false);
		},
		function(col) {
			if (run_active() && text_strip_render && text_strip_snapshot) {
				// commit: put the caret back where the formatting is
				text_strip_restore(text_strip_render, text_strip_snapshot);
				text_strip_snapshot = null;
			} else {
				save();
				sync();
			}
		});
	shadow_color_btn.addEventListener('mousedown', function() {
		text_strip_snapshot = text_strip_range_for();
	});
	shadow_row.appendChild(shadow_color_btn);
	adv.appendChild(shadow_row);

	// the press that starts a scrub takes focus and collapses the
	// selection: the range is taken on pointerdown, for the run the rows
	// will act on
	[line, letter, word, shadow_radius, shadow_alpha].forEach(function(rw) {
		rw.row.addEventListener('pointerdown', function() {
			text_strip_snapshot = text_strip_range_for();
		});
	});

	// One reset for the whole object, in the fold: everything about the
	// type, including what the rows above set. The object's own - a run has
	// no attribute set to clear - so the sync grays it while a run is
	// selected. Clearing the properties rather than writing defaults into
	// them is what makes the object file drop the attributes, so a reset
	// object is byte-identical to one nobody ever touched.
	var reset_row = $.glue.popover.row(false);
	reset_row.appendChild($.glue.popover.reset(
		'back to the default typeface, size, style, colour and spacing',
		function() {
			['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'textDecoration',
				'color', 'lineHeight', 'letterSpacing', 'wordSpacing', 'textAlign']
				.forEach(function(prop) {
					obj.style[prop] = '';
				});
			shadow.radius = 0;
			write_shadow(false);
			save();
			// every control now says something that is no longer true
			sync();
		}));
	adv.appendChild(reset_row);

	// --- sync: every control, in step with the target ----------------------
	//
	// The mode decides which reads everything makes - the run's explicit
	// tags and spans, or the object's computed style - and which rows
	// gray out. Called after the build and on every selectionchange; never
	// overwrites a control that is being interacted with.
	var sync = function() {
		var run = run_active();
		set_gray(align_row, run);
		set_gray(reset_row, run);
		set_gray(link_row, !link_available());
		set_gray(link_parts.target_row, !link_available());

		// the four toggles: the run's explicit tags, or the object's style
		if (run) {
			var sel = window.getSelection();
			var node = sel && sel.rangeCount ? sel.anchorNode : null;
			var st = { b: false, i: false, u: false, s: false };
			if (node && text_strip_render && text_strip_render.contains(node)) {
				var el = (node.nodeType == 3) ? node.parentElement : node;
				for (var cur = el; cur && cur !== text_strip_render;
						cur = cur.parentElement) {
					var tag = cur.tagName;
					if (!st.b && (tag == 'B' || tag == 'STRONG')) {
						st.b = true;
					}
					if (!st.i && (tag == 'I' || tag == 'EM')) {
						st.i = true;
					}
					if (!st.u && tag == 'U') {
						st.u = true;
					}
					if (!st.s && (tag == 'S' || tag == 'STRIKE' || tag == 'DEL')) {
						st.s = true;
					}
				}
			}
			toggles.b.classList.toggle('glue-btn-active', st.b);
			toggles.i.classList.toggle('glue-btn-active', st.i);
			toggles.u.classList.toggle('glue-btn-active', st.u);
			toggles.s.classList.toggle('glue-btn-active', st.s);
		} else {
			read_state_object();
			toggles.b.classList.toggle('glue-btn-active', state.bold);
			toggles.i.classList.toggle('glue-btn-active', state.italic);
			toggles.u.classList.toggle('glue-btn-active', state.underline);
			toggles.s.classList.toggle('glue-btn-active', state.strike);
		}

		// the size, wherever it lives
		var size_field = size_row.row.querySelector('.glue-popover-field');
		if (document.activeElement !== size_field) {
			size_row.set(effective_size());
			sync_size();
		}

		// the face, wherever it lives: the run's own span face, or the
		// object's ('' is the run's inherited face, which face_show names)
		var face = '';
		if (run) {
			var r2 = text_strip_range_for();
			var n2 = r2 && r2.startContainer;
			var e2 = (n2 && n2.nodeType == 3) ? n2.parentElement : n2;
			for (var c2 = e2; c2 && c2 !== text_strip_render;
					c2 = c2.parentElement) {
				if (c2.tagName == 'SPAN' && c2.style.fontFamily) {
					face = c2.style.fontFamily;
					break;
				}
			}
			if (!face) {
				// no span face: the run wears the inherited one, and with
				// no default row that is what the wheel centres
				face = getComputedStyle(obj).fontFamily;
			}
		} else {
			face = getComputedStyle(obj).fontFamily;
		}
		face_show(face);

		// the spacings and the shadow, wherever they live. A run shows its
		// span's own value, or what it renders at (the object's) - the row
		// is never pointing at nothing.
		var sp = function(prop) {
			if (!run) {
				return '';
			}
			var r3 = text_strip_range_for();
			var n3 = r3 && r3.startContainer;
			var e3 = (n3 && n3.nodeType == 3) ? n3.parentElement : n3;
			for (var c3 = e3; c3 && c3 !== text_strip_render;
					c3 = c3.parentElement) {
				if (c3.tagName == 'SPAN' && c3.style[prop]) {
					return c3.style[prop];
				}
			}
			return '';
		};
		var line_field = line.row.querySelector('.glue-popover-field');
		if (document.activeElement !== line_field) {
			var lh = sp('lineHeight');
			line.set(lh ? parseFloat(lh) :
				to_em(getComputedStyle(text_strip_render || obj).lineHeight, 1.2));
		}
		var letter_field = letter.row.querySelector('.glue-popover-field');
		if (document.activeElement !== letter_field) {
			var ls = sp('letterSpacing');
			letter.set(ls ? parseFloat(ls) :
				to_em(getComputedStyle(text_strip_render || obj).letterSpacing, 0));
		}
		var word_field = word.row.querySelector('.glue-popover-field');
		if (document.activeElement !== word_field) {
			var ws = sp('wordSpacing');
			word.set(ws ? parseFloat(ws) :
				to_em(getComputedStyle(text_strip_render || obj).wordSpacing, 0));
		}
		read_shadow();
		var sr_field = shadow_radius.row.querySelector('.glue-popover-field');
		var sa_field = shadow_alpha.row.querySelector('.glue-popover-field');
		if (document.activeElement !== sr_field) {
			shadow_radius.set(shadow.radius);
		}
		if (document.activeElement !== sa_field) {
			shadow_alpha.set(shadow.alpha);
		}

		// the link row follows the selection; grayed means there is none
		if (link_available() && text_strip_link_sync) {
			text_strip_link_sync();
		}

		// the alignments: the object's own, and only lit for it
		sync_align();
	};
	text_panel_sync_fn = sync;
	// the wheel's first centre must wait for the panel to be in the
	// document - the build's own sync ran against an unattached list, so
	// its geometry was all zeros. text_panel_open calls this right after
	// show() attaches the popover.
	text_face_recenter = function() {
		face_reel_center(face_current);
	};
	sync();
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

// Semantic heading level (SOW-accessibility.md, Feature 4). The stored
// text-heading-level key maps to the wrapper's tag itself, so the level
// round-trips through the same serialize-and-save path as every visual
// property. Tag names are immutable in place, hence the swap below.
// (attached to the existing $.glue.text namespace defined further up)
$.glue.text.set_heading = function(obj, level) {
	var tag = level || 'div';
	if (obj.tagName.toLowerCase() === tag) {
		return;
	}
	var selected = obj.classList.contains('glue-selected');
	// the heading panel stays open across the choice (danja's call,
	// 2026-09-24): the swap below kills the node the panel points at, so it
	// is re-opened on the new node once that exists - at the SAME position:
	// show() would re-place it by the pointer (the toggle just clicked), so
	// the old place is captured and put back on the re-opened panel
	var reopen_pos = false;
	var cur = $.glue.popover.current();
	if (cur && $.glue.owner(cur) === obj && cur.classList.contains('glue-heading-popover')) {
		reopen_pos = { left: cur.style.left, top: cur.style.top };
	}
	$.glue.popover.close();
	var neu = document.createElement(tag);
	for (var i = 0; i < obj.attributes.length; i++) {
		var a = obj.attributes[i];
		neu.setAttribute(a.name, a.value);	// id, class, style, custom attrs
	}
	while (obj.firstChild) {
		neu.appendChild(obj.firstChild);	// textarea + render div ride along
	}
	$.glue.object.unregister(obj);		// destroys the Moveable, clears the guard
	obj.replaceWith(neu);
	$.glue.object.register(neu);		// new Moveable
	if (selected) {
		$.glue.sel.none();
		$.glue.sel.select(neu);
	}
	// NOTE: the undo WeakMap is keyed by element, so this first save reads
	// as a 'create' rather than an 'update' - a cosmetic, accepted gap.
	$.glue.object.save(neu);
	if (reopen_pos) {
		text_heading_popover(neu);
		var re = $.glue.popover.current();
		if (re) {
			re.style.left = reopen_pos.left;
			re.style.top = reopen_pos.top;
		}
	}
};

// does a palette colour qualify as a fresh object's background: fully
// opaque, and not white or near-white. The picker memorizes transparent
// and white swatches, and either would create an invisible object on the
// default white page background (danja's call, 2026-09-24). Returns the
// colour as stored, or false.
function text_palette_bg(color) {
	var r, g, b, a;
	var s = String(color || '').trim();
	if (/^#([0-9a-f]{3})$/i.test(s)) {
		r = parseInt(s[1]+s[1], 16);
		g = parseInt(s[2]+s[2], 16);
		b = parseInt(s[3]+s[3], 16);
		a = 255;
	} else if (/^#([0-9a-f]{6})$/i.test(s)) {
		r = parseInt(s.substr(1,2), 16);
		g = parseInt(s.substr(3,2), 16);
		b = parseInt(s.substr(5,2), 16);
		a = 255;
	} else if (/^#([0-9a-f]{8})$/i.test(s)) {
		r = parseInt(s.substr(1,2), 16);
		g = parseInt(s.substr(3,2), 16);
		b = parseInt(s.substr(5,2), 16);
		a = parseInt(s.substr(7,2), 16);
	} else {
		var m = s.match(/^rgba?\(([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?\)$/i);
		if (m) {
			r = parseInt(m[1], 10);
			g = parseInt(m[2], 10);
			b = parseInt(m[3], 10);
			a = (m[4] === undefined) ? 255 : Math.round(parseFloat(m[4])*255);
		} else {
			// 'transparent' and anything we do not understand: not usable
			return false;
		}
	}
	// 0% transparency only
	if (a != 255) {
		return false;
	}
	// white or near-white blends with the page background
	if (Math.min(r, g, b) >= 0xB3) {
		return false;
	}
	return s;
}

function text_heading_popover(obj)
{
	var pop = $.glue.popover.open(obj, 'glue-heading-popover');
	if (!pop) {
		return;
	}

	var row = $.glue.popover.row('heading');
	var levels = [['normal', 'div'], ['H1', 'h1'], ['H2', 'h2'], ['H3', 'h3'],
		['H4', 'h4'], ['H5', 'h5'], ['H6', 'h6']];
	levels.forEach(function(level) {
		var b = document.createElement('div');
		b.className = 'glue-font-toggle glue-heading-toggle';
		if (level[1] == 'div') {
			// the plain-text choice wears the empty square instead of a
			// letter (danja's call, 2026-09-24) - the shared glyph class in
			// css/edit.css, the same one the image panel's decorative
			// toggle uses
			b.classList.add('glue-heading-normal');
			var glyph = document.createElement('span');
			glyph.className = 'glue-glyph-empty-square';
			b.appendChild(glyph);
			b.title = 'render this text as a plain text object';
		} else {
			b.textContent = level[0];
			b.title = 'render this text as a '+level[0]+' heading';
		}
		var sync = function() {
			b.classList.toggle('glue-font-toggle-on', obj.tagName.toLowerCase() == level[1]);
		};
		b.addEventListener('click', function() {
			$.glue.text.set_heading(obj, level[1]);
		});
		b.addEventListener('glue-menu-activate', sync);
		sync();
		row.appendChild(b);
	});
	pop.appendChild(row);

	// the reset rides a row of its own, like every other panel's: appended
	// to the bare popover column it would stretch the whole panel width
	var footer = $.glue.popover.row(false);
	footer.appendChild($.glue.popover.reset('back to a plain text object', function() {
		$.glue.text.set_heading(obj, 'div');
	}));
	pop.appendChild(footer);

	$.glue.popover.show(pop);
}

document.addEventListener('DOMContentLoaded', function() {
	//
	// menu items
	//
	var elem = $.glue.icon('text-object', 'create a text object');
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
			//
			// The background comes from the page's recent palette: the first
			// colour that is fully opaque and not white or near-white, so a
			// run of new objects stays in the palette being worked in while
			// a fresh object is always visible (danja's call, 2026-09-24 -
			// the picker memorizes transparent and white swatches, and
			// either would create an invisible object). A palette with no
			// usable colour falls back to the random pick from the global
			// defaults, which is what it always did.
			var bg = false;
			var recent = $.glue.colorpicker.recent();
			for (var i=0; i < recent.length; i++) {
				bg = text_palette_bg(recent[i]);
				if (bg !== false) {
					break;
				}
			}
			if (bg === false && $.glue.conf.object.default_colors) {
				var rand = Math.floor(Math.random()*$.glue.conf.object.default_colors.length);
				bg = $.glue.conf.object.default_colors[rand];
			}
			if (bg !== false) {
				elem.style.backgroundColor = bg;
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

	// "turn the selected text into a link" now lives in the run-formatting
	// strip, where the selection it acts on is - it docks while the text is
	// edited WYSIWYG and shows the url/class row under the size slider
	// (text_strip_build above). No context-menu entry any more.

	// Source-mode toggle. WYSIWYG editing hides the markup, which is the
	// point, but it also means the browser's HTML parser gets a say in what
	// ends up stored: hand-written markup comes back canonicalised (an
	// unquoted attribute gains quotes, an uppercase tag becomes lowercase).
	// This is the way back to editing the literal source, and the way to fix
	// anything WYSIWYG gets wrong.
	// the icon is the SuperGlue set's super-user, which draws exactly the </>
	// this button used to spell out as text
	elem = $.glue.icon('super-user',
		'switch between editing the text as it looks and editing its HTML source');
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
	// prio 12: the last button of the upper row, after the heading level
	// (it sat second since forever - 2026-09-22, danja's call)
	$.glue.contextmenu.register('text', 'text-source', elem, 12);


	// The text menu's own two background buttons - "change background color"
	// and "make background transparent" - are gone. The object properties
	// panel's background section took over what an object's background is: its
	// colour button is
	// this same picker onto obj.style.backgroundColor, which text_alter_save()
	// stores as text-background-color, and the picker's alpha row taken to 0%
	// stores 'transparent', the keyword the second button used to set outright
	// (to_css() in js/edit.js keeps the keyword rather than writing rgba()
	// zeroes). Two buttons, one panel button, nothing lost - and the textarea
	// needs no syncing either: .glue-text-input is 'background: inherit'.


	// --- the text panel ---------------------------------------------------
	//
	// One button in place of the three that used to be here (size, face,
	// style). It opens the panel built by text_panel_build() below, which
	// looks and behaves like the colour picker: it goes in the nearest free
	// colour picker: it goes in the nearest free space beside the object
	// rather than over it ($.glue.popover), applies live, reads the object's
	// current values when it opens, and closes on a click outside or Escape.
	//
	// It TOGGLES, like every other panel button, and what it shows depends on
	// what is selected: a run selected inside the editing render brings up the
	// B/I/U/S, colour, face, size and link controls for that run, and anything
	// else brings up the object's own type (text_panel_mode).
	elem = $.glue.icon('font-size', 'font: face, size and style');
	elem.addEventListener('click', function(e) {
		text_panel_toggle($.glue.owner(this));
		e.stopPropagation();
	});
	$.glue.contextmenu.register('text', 'text-font', elem, 1);



	// padding has no button here any more (2026-09-16). It was this menu's last
	// control that was about the object rather than the type - the text's inset
	// from its own box, which the object properties panel owns now, for every
	// object that can have padding. The icon ('padding', a box with an inset
	// frame) went with it; img/icons/padding.svg is still in the tree, like the
	// other artwork of buttons that folded into a panel.

	// semantic heading level: screen readers navigate pages by headings, so
	// a text object can render as h1/h2/h3 (appearance stays the author's).
	// prio 11 puts it at the right end of the top row, past everything else
	elem = $.glue.icon('heading', 'heading level');
	elem.addEventListener('click', function(e) {
		text_heading_popover($.glue.owner(this));
		e.stopPropagation();
	});
	$.glue.contextmenu.register('text', 'text-heading', elem, 11);

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
