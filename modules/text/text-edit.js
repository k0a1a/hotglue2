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

// The padding panel: one value for all four sides up top, the sides
// individually in a folded-away "more knobs" section, and a reset that goes
// back to no padding (the inherent default). Twin of the object panels
// (object_adjust_popover / object_edge_popover in object-edit.js).
function text_padding_popover(obj)
{
	var pop = $.glue.popover.open(obj, 'glue-padding-popover');
	if (!pop) {
		return;
	}
	var save = function() {
		$.glue.object.save(obj);
	};

	// Padding is internal: the outer box is captured once here and every
	// change below compensates width/height by the padding it adds, so the
	// object never moves while the panel is open (see the drag handler this
	// panel replaced).
	var outer_w = obj.offsetWidth;
	var outer_h = obj.offsetHeight;
	// padding can't eat more than half the shorter side without collapsing
	// the content area; the field is allowed to say more, and the apply below
	// clamps it
	var max = Math.floor(Math.min(outer_w, outer_h)/2);
	var pad = {};
	var side = function(name) {
		var v = parseInt(getComputedStyle(obj)['padding-'+name]);
		return isNaN(v) ? 0 : v;
	};
	pad.top = side('top');
	pad.right = side('right');
	pad.bottom = side('bottom');
	pad.left = side('left');

	var apply = function(commit) {
		obj.style.paddingLeft = pad.left+'px';
		obj.style.paddingRight = pad.right+'px';
		obj.style.paddingTop = pad.top+'px';
		obj.style.paddingBottom = pad.bottom+'px';
		obj.style.width = (outer_w-pad.left-pad.right)+'px';
		obj.style.height = (outer_h-pad.top-pad.bottom)+'px';
		if (commit) {
			save();
		}
	};

	// one value for all four sides. Starts at the left padding, and shows
	// what a drag would set all four to rather than chasing the knobs.
	var all = $.glue.popover.number_row('padding', {
		min: 0, max: max, step: 1, unit: 'px',
		value: pad.left,
		apply: function(v, commit) {
			pad.left = pad.right = pad.top = pad.bottom =
				Math.max(0, Math.min(max, Math.round(v)));
			apply(commit);
		}
	});
	pop.appendChild(all.row);

	// --- more knobs: each side on its own --------------------------------
	var fold = $.glue.popover.fold(pop, 'more knobs');
	pop.appendChild(fold.toggle);
	var adv = fold.body;
	var knob = function(label, name) {
		var row = $.glue.popover.number_row(label, {
			min: 0, max: max, step: 1, unit: 'px',
			value: pad[name],
			apply: function(v, commit) {
				pad[name] = Math.max(0, Math.min(max, Math.round(v)));
				apply(commit);
			}
		});
		adv.appendChild(row.row);
		return row;
	};
	var top = knob('top', 'top');
	var right = knob('right', 'right');
	var bottom = knob('bottom', 'bottom');
	var left = knob('left', 'left');
	pop.appendChild(adv);

	// Reset: back to no padding (there is no class default anymore - a bare
	// text object renders flush, like the historical engine), with the box
	// compensated so nothing moves here either. Clearing the inline padding
	// is what removes the stored text-padding-* keys on save, the way the
	// old click-to-reset did.
	var footer = $.glue.popover.row(false);
	footer.appendChild($.glue.popover.reset(
		'back to the default (no padding)', function() {
			obj.style.paddingLeft = '';
			obj.style.paddingRight = '';
			obj.style.paddingTop = '';
			obj.style.paddingBottom = '';
			var c = getComputedStyle(obj);
			pad.top = parseInt(c.paddingTop);
			pad.right = parseInt(c.paddingRight);
			pad.bottom = parseInt(c.paddingBottom);
			pad.left = parseInt(c.paddingLeft);
			obj.style.width = (outer_w-pad.left-pad.right)+'px';
			obj.style.height = (outer_h-pad.top-pad.bottom)+'px';
			save();
			all.set(pad.left);
			top.set(pad.top);
			right.set(pad.right);
			bottom.set(pad.bottom);
			left.set(pad.left);
		}));
	pop.appendChild(footer);

	$.glue.popover.show(pop);
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
			// the run-formatting strip only exists while editing; hide it before
			// the surfaces swap, so the render.innerHTML below cannot trigger a
			// reposition against stale state
			text_strip_hide();
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
		text_strip_hide();
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
	// the run-formatting strip docks to the object while it is edited
	text_strip_show(self);
});

// --- "make link" for a selection inside a text object ---------------------
// (An earlier version validated the link URL against a scheme allowlist and
// normalised bare domains; both are gone - the link takes whatever non-empty
// string the author typed, and the href attribute escapes it.)

// --- run formatting strip --------------------------------------------------
//
// B/I/U/S, a colour button, a font-face dropdown and an arbitrary-px size for
// a SELECTED RUN of text, while the object is edited WYSIWYG. The strip docks
// to the object's bottom edge, is a singleton (one object edits at a time),
// and is hidden in source mode - the textarea is where raw markup is typed,
// and this is the surface that puts it there for you.
//
// Storage is semantic: toggling wraps the selection in <b>/<i>/<u>/<s>, the
// colour, size and face controls wrap it in a <span> carrying the matching
// inline style, and all three share one span per run rather than nesting. The
// render pipeline passes any well-formed tag through byte-for-byte
// (html_encode_str_smart), so no server code knows or cares that these tags
// exist - the browser renders them, on this page and on the published one.
//
// The range work is done by hand - including the strip's link row - no
// execCommand anywhere. Every op re-installs an explicit range afterwards,
// because focus drifts to the strip on click and engines differ in what
// caret they put back. Selection state is kept in text_strip_range (updated
// on selectionchange) so the size field and face dropdown can still act
// after focus moved.

var text_strip = null;             // singleton element, created lazily, appended to body
var text_strip_obj = null;         // the .text object the strip belongs to
var text_strip_render = null;      // its .glue-text-render
var text_strip_range = null;       // last known selection inside the render (cloneRange)
var text_strip_snapshot = null;    // range the size field and face dropdown act on
var text_strip_btns = {};          // { b, i, u, s } -> button element
var text_strip_size_field = null;  // the number input
var text_strip_size_slider = null; // the size slider it rides next to
var text_strip_face = null;        // the face dropdown
var text_strip_face_default = null; // the dropdown's "inherited" option
var text_strip_link_sync = null;   // keeps the link row in step with the selection
var text_strip_link_reset = null;  // empties the link row's fields

function text_strip_build() {
	var strip = document.createElement('div');
	strip.className = 'glue-text-strip glue-ui';
	strip.style.display = 'none';
	var row1 = document.createElement('div');
	row1.className = 'glue-text-strip-row';
	strip.appendChild(row1);
	[
		['b', 'font-style-bold', 'bold the selected text'],
		['i', 'font-style-italic', 'italic the selected text'],
		['u', 'font-style-underline', 'underline the selected text'],
		['s', 'font-style-strikeout', 'strikethrough the selected text']
	].forEach(function(t) {
		var b = $.glue.icon(t[1], t[2]);
		b.style.width = '26px';                       // precedent: the align buttons below
		b.style.height = '26px';
		b.dataset.fmt = t[0];
		b.addEventListener('click', function() {
			if (text_strip_render) {
				text_strip_toggle(text_strip_render, t[0]);
			}
		});
		text_strip_btns[t[0]] = b;
		row1.appendChild(b);
	});
	// --- colour button -----------------------------------------------------
	// The picker the font popover's colour row uses, but for the selection:
	// it wraps the run in a color span (or joins the styled span it is in),
	// and opens showing the run's own colour. The picker takes focus, which
	// collapses the selection - so the range is snapshotted on mousedown,
	// before the click opens anything, like the size field and face dropdown.
	var color_btn = $.glue.popover.color_button('color of the selected text',
		text_strip_run_color,
		function(col) {
			if (text_strip_render) {
				text_strip_apply_color(text_strip_render, col);
			}
		},
		function(col) {
			// commit: put the caret back where the formatting is
			if (text_strip_render && text_strip_snapshot) {
				text_strip_restore(text_strip_render, text_strip_snapshot);
			}
		});
	color_btn.addEventListener('mousedown', function() {
		text_strip_snapshot = text_strip_range_for();
	});
	row1.appendChild(color_btn);
	// --- face dropdown ---------------------------------------------------
	// The same face list the font popover offers, but for the selection: the
	// pick wraps the run in a font-family span (or joins the size span it is
	// already in, so the two live on one span instead of nesting one per
	// pick), and "default" unwraps it back to whatever the object inherits.
	var faces = [];
	var woff_faces = [];
	$.glue.text.get_fonts(faces, woff_faces);
	var face = document.createElement('select');
	face.className = 'glue-text-face';
	face.title = 'font family of the selection';
	var def = document.createElement('option');
	def.value = '';
	def.textContent = 'default';	// the inherited face, named by sync_state
	face.appendChild(def);
	text_strip_face_default = def;
	var uploaded = [];
	var installed = [];
	faces.forEach(function(f) {
		(woff_faces.indexOf(f) == -1 ? installed : uploaded).push(f);
	});
	[['your fonts', uploaded], ['fonts', installed]].forEach(function(g) {
		if (!g[1].length) {
			return;
		}
		var group = document.createElement('optgroup');
		group.label = g[0];
		g[1].forEach(function(f) {
			var o = document.createElement('option');
			o.value = f;
			o.style.fontFamily = f;
			o.textContent = f.replace(/["\']/g, '');
			group.appendChild(o);
		});
		face.appendChild(group);
	});
	// same snapshot-on-mousedown discipline as the size field
	face.addEventListener('mousedown', function() {
		text_strip_snapshot = text_strip_range_for();
	});
	face.addEventListener('focus', function() {
		if (!text_strip_snapshot) {
			text_strip_snapshot = text_strip_range_for();
		}
	});
	face.addEventListener('change', function() {
		if (!text_strip_render) {
			return;
		}
		// a pick can reach change without the mousedown that snapshots the
		// selection: the keyboard path in a real browser, or selectOption in
		// a test - fall back to the last-known selection (the cache is kept
		// current by the document selectionchange listener)
		if (!text_strip_snapshot) {
			text_strip_snapshot = text_strip_range_for();
		}
		text_strip_apply_face(text_strip_render, this.value);
		// commit: put the caret back where the formatting is
		if (text_strip_snapshot) {
			text_strip_restore(text_strip_render, text_strip_snapshot);
		}
	});
	row1.appendChild(face);
	text_strip_face = face;

	// --- row 2: size slider + manual entry ---------------------------------
	// The slider is a quick tool (8-100px, like the font popover's); the
	// field is the precise one, and can say values the slider cannot. Both
	// act on the same snapshot, taken on mousedown before either steals
	// focus, and both commit the way the popover's row does: live on input,
	// caret restored where the formatting is on change.
	var row2 = document.createElement('div');
	row2.className = 'glue-text-strip-row';
	var slider = document.createElement('input');
	slider.type = 'range';
	slider.className = 'glue-popover-slider glue-text-size-slider';
	slider.min = 8;
	slider.max = 100;
	slider.step = 1;
	slider.value = 18;
	slider.title = 'font size of the selection, in px';
	slider.addEventListener('mousedown', function() {
		text_strip_snapshot = text_strip_range_for();
	});
	slider.addEventListener('input', function() {
		if (!text_strip_snapshot) {
			text_strip_snapshot = text_strip_range_for();
		}
		field.value = this.value;                    // the manual entry follows
		if (!text_strip_render) {
			return;
		}
		text_strip_apply_size(text_strip_render, parseInt(this.value, 10));
	});
	slider.addEventListener('change', function() {
		// commit: put the caret back where the formatting is
		if (text_strip_render && text_strip_snapshot) {
			text_strip_restore(text_strip_render, text_strip_snapshot);
		}
	});
	row2.appendChild(slider);
	text_strip_size_slider = slider;
	strip.appendChild(row2);
	var field = document.createElement('input');
	field.type = 'number';
	field.className = 'glue-popover-field glue-text-size';
	text_strip_size_field = field;
	field.step = 1;
	field.min = 1;
	field.title = 'font size of the selection, in px';
	// snapshot BEFORE the focus change: mousedown sees the live selection
	// intact, focus arrives after the browser collapsed it
	field.addEventListener('mousedown', function() {
		text_strip_snapshot = text_strip_range_for();
	});
	field.addEventListener('focus', function() {
		// fallback for programmatic focus (selection may already have collapsed)
		if (!text_strip_snapshot) {
			text_strip_snapshot = text_strip_range_for();
		}
	});
	field.addEventListener('input', function() {
		if (!text_strip_render) {
			return;
		}
		if (this.value === '') {
			text_strip_apply_size(text_strip_render, null);   // clear
			return;
		}
		var v = parseInt(this.value, 10);
		if (isNaN(v) || v < 1) {
			return;
		}
		// the slider follows the typed value, clamped to its own range
		text_strip_size_slider.value = Math.max(8, Math.min(100, v));
		text_strip_apply_size(text_strip_render, v);          // live, no focus steal
	});
	field.addEventListener('change', function() {
		// commit: put the caret back where the formatting is
		if (text_strip_render && text_strip_snapshot) {
			text_strip_restore(text_strip_render, text_strip_snapshot);
		}
	});
	field.addEventListener('keydown', function(e) {
		if (e.key == 'Escape') {
			e.preventDefault();
			if (text_strip_render) {
				text_strip_render.focus(); // abort the field, stay in editing
			}
		}
		// no stopPropagation: the editor's global keydown ignores fields
		// (typing_in_a_field, edit.js) and Escape here must not stop editing
	});
	row2.appendChild(field);
	var unit = document.createElement('div');
	unit.className = 'glue-popover-unit';
	unit.textContent = 'px';
	row2.appendChild(unit);

	// --- link row: the url field IS the control ---------------------------
	// Always visible while editing, no icon to press. The selection (or the
	// caret) decides what the button does: no link under it - 'make link'
	// wraps the selected run; a link - 'remove link' unwraps it, and the
	// url pre-fills so Enter edits the href. The sync keeps this current as
	// the selection moves (text_strip_link_sync, called from the document
	// selectionchange listener), and never while the author is typing.
	var link_row = document.createElement('div');
	link_row.className = 'glue-text-strip-row glue-text-strip-link';
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
	strip.appendChild(link_row);
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
			e.preventDefault();
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
		// no stopPropagation - the editor's global keydown ignores fields
		// (typing_in_a_field), like the size field above
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
		} else {
			link_btn.textContent = 'make link';
			link_btn.title = 'wrap the selected text in a link to this address';
			link_mode = 'add';
		}
	};
	text_strip_link_reset = link_reset_fields;
	link_reset_fields();

	// Moveable hears touch on the body container and would drag the object;
	// its chrome exemption list does not know this element.
	strip.addEventListener('touchstart', function(e) { e.stopPropagation(); });
	document.body.appendChild(strip);
	text_strip = strip;
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
// the cache (so the size field can act on the result of a toggle later)
function text_strip_restore(render, r) {
	if (document.activeElement !== render) {
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

function text_strip_toggle(render, tag) {
	var range = text_strip_range_for();
	if (!range) {
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
	if (inner && !inner.hasAttributes()) {
		if (!range.collapsed && covers(inner)) {
			text_strip_unwrap(render, inner, range);
			return;
		}
		if (range.collapsed) {
			// caret inside a run (our scaffold or an authored bare tag);
			// an abandoned scaffold drops its pad with it, caret remapped
			text_strip_unwrap(render, inner, range);
			return;
		}
	}
	// toggle ON
	if (!range.collapsed) {
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
	} else {
		// collapsed: empty scaffold with a ZWSP pad so the caret is visible
		// and typing lands inside the tag (the Enter handler's pad trick)
		var w = document.createElement(tag);
		w.appendChild(document.createTextNode('​'));
		range.insertNode(w);
		var r2 = document.createRange();
		// aim PAST the pad text node: Chromium pulls a caret at offset 0 of
		// an inline element's first text child out of the element on the next
		// keystroke, and the typed text would land outside the tag - after
		// the pad it stays inside, and the pad strips out at save time
		r2.setStart(w.firstChild, 1);
		r2.collapse(true);
		text_strip_restore(render, r2);
	}
}

// px: number -> apply; null -> clear (unwraps font-size spans fully inside
// the selection). Works on text_strip_snapshot. After wrapping, the
// snapshot is re-aimed at the wrapper, so consecutive keystrokes update the
// SAME span live instead of nesting a span per digit.
function text_strip_apply_size(render, px) {
	var range = text_strip_snapshot;
	if (!range || !render.contains(range.commonAncestorContainer)) {
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
	if (px === null) {
		if (!range.collapsed) {
			if (covering) {
				// the whole run is the one styled span: drop only the size
				// from it - a face or colour on the same span stays
				inner.style.fontSize = '';
				if (!inner.getAttribute('style')) {
					// nothing left but the tag itself: unwrap it
					inner.replaceWith(...inner.childNodes);
				}
			} else {
				var frag = range.extractContents();
				var changed = false;
				frag.querySelectorAll('span').forEach(function(sp) {
					if (sp.style.fontSize) {
						sp.replaceWith(...sp.childNodes);
						changed = true;
					}
				});
				if (changed) {
					range.insertNode(frag);
				}
			}
		}
		return;   // collapsed: nothing (no span around the caret to remove)
	}
	if (!range.collapsed && covering) {
		inner.style.fontSize = px + 'px';        // live update, no nesting
		return;
	}
	if (range.collapsed && text_strip_span_styled(inner)) {
		inner.style.fontSize = px + 'px';        // typing digits: update the scaffold
		return;
	}
	var sp = document.createElement('span');
	sp.style.fontSize = px + 'px';
	if (!range.collapsed) {
		sp.appendChild(range.extractContents());
		range.insertNode(sp);
		text_strip_snapshot = (function() {
			var r = document.createRange();
			r.selectNodeContents(sp);
			return r;
		})();
	} else {
		sp.appendChild(document.createTextNode('​'));
		range.insertNode(sp);
		text_strip_snapshot = (function() {
			var r = document.createRange();
			// aim past the pad text node, not at its start - see the
			// toggle scaffold for why
			r.setStart(sp.firstChild, 1);
			r.collapse(true);
			return r;
		})();
	}
}

// is a span carrying a run-level style (any of the three the strip applies)?
// All three applies share this test, so a run styled by one control and then
// touched by another stays on a SINGLE span instead of nesting one per pick.
function text_strip_span_styled(inner) {
	return inner && (inner.style.color || inner.style.fontSize || inner.style.fontFamily);
}

// face: string -> apply; '' -> clear (unwraps font-family spans fully inside
// the selection). A run already in a styled span gets the face ADDED to that
// span rather than wrapped in a second one, so size and face stay on a single
// span no matter which was picked first.
function text_strip_apply_face(render, face) {
	var range = text_strip_snapshot;
	if (!range || !render.contains(range.commonAncestorContainer)) {
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
		if (!range.collapsed) {
			if (covering) {
				// the whole run is the one styled span: drop only the face
				// from it - a size or colour on the same span stays
				inner.style.fontFamily = '';
				if (!inner.getAttribute('style')) {
					// nothing left but the tag itself: unwrap it
					inner.replaceWith(...inner.childNodes);
				}
			} else {
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
			}
		}
		return;   // collapsed: nothing (no span around the caret to clear)
	}
	if (covering) {
		inner.style.fontFamily = face;              // join the styled span
		return;
	}
	if (range.collapsed && text_strip_span_styled(inner)) {
		inner.style.fontFamily = face;              // typing in a styled run
		return;
	}
	var sp = document.createElement('span');
	sp.style.fontFamily = face;
	if (!range.collapsed) {
		sp.appendChild(range.extractContents());
		range.insertNode(sp);
		text_strip_snapshot = (function() {
			var r = document.createRange();
			r.selectNodeContents(sp);
			return r;
		})();
	} else {
		sp.appendChild(document.createTextNode('​'));
		range.insertNode(sp);
		text_strip_snapshot = (function() {
			var r = document.createRange();
			// aim past the pad text node, not at its start - see the
			// toggle scaffold for why
			r.setStart(sp.firstChild, 1);
			r.collapse(true);
			return r;
		})();
	}
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

// col: string -> apply. Same join-a-styled-span behaviour as size and face.
function text_strip_apply_color(render, col) {
	var range = text_strip_snapshot;
	if (!range || !render.contains(range.commonAncestorContainer)) {
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
		return;
	}
	if (range.collapsed && text_strip_span_styled(inner)) {
		inner.style.color = col;                    // typing in a styled run
		return;
	}
	var sp = document.createElement('span');
	sp.style.color = col;
	if (!range.collapsed) {
		sp.appendChild(range.extractContents());
		range.insertNode(sp);
		text_strip_snapshot = (function() {
			var r = document.createRange();
			r.selectNodeContents(sp);
			return r;
		})();
	} else {
		sp.appendChild(document.createTextNode('​'));
		range.insertNode(sp);
		text_strip_snapshot = (function() {
			var r = document.createRange();
			// aim past the pad text node, not at its start - see the
			// toggle scaffold for why
			r.setStart(sp.firstChild, 1);
			r.collapse(true);
			return r;
		})();
	}
}

function text_strip_hide() {
	if (text_strip) {
		text_strip.style.display = 'none';
		// the strip's link row is always visible while editing, so hiding
		// the strip empties it rather than hiding it
		if (text_strip_link_reset) {
			text_strip_link_reset();
		}
	}
	text_strip_obj = null;
	text_strip_render = null;
	text_strip_range = null;
	text_strip_snapshot = null;
}

function text_strip_position() {
	var obj = text_strip_obj;
	var r = obj.getBoundingClientRect();
	var vv = window.visualViewport;
	var min_x = vv ? vv.offsetLeft : 0;
	var min_y = vv ? vv.offsetTop : 0;
	var vw = vv ? vv.width : document.documentElement.clientWidth;
	var vh = vv ? vv.height : document.documentElement.clientHeight;
	var GAP = 12;                                 // clears the 14px south resize handle
	var x = Math.max(min_x + window.scrollX,
		Math.min(min_x + window.scrollX + vw - text_strip.offsetWidth,
			r.left + window.scrollX));
	var y = r.bottom + window.scrollY + GAP;
	if (y + text_strip.offsetHeight > min_y + window.scrollY + vh) {
		// below does not fit: above, clearing the context menu's top row
		y = r.top + window.scrollY - GAP - text_strip.offsetHeight;
		var top_row = document.querySelector('.glue-contextmenu-top');
		if (top_row) {
			var tr = top_row.getBoundingClientRect();
			if (tr.height) {
				y = Math.min(y, tr.top + window.scrollY - GAP - text_strip.offsetHeight);
			}
		}
		if (y < min_y + window.scrollY) {
			y = min_y + window.scrollY;
		}
	}
	text_strip.style.left = x + 'px';
	text_strip.style.top = y + 'px';
}

// toggles reflect the run's EXPLICIT tags only. The walk stops at the render
// div, so object-level inline styles (a bold OBJECT) live outside it and can
// never light a toggle - computed styles are not consulted at all.
function text_strip_sync_state() {
	if (text_strip_face_default && text_strip_render) {
		// name the "default" option by what it actually is: the font the
		// run inherits from the object and the page
		var inherited = getComputedStyle(text_strip_render).fontFamily || '';
		var first = inherited.split(',')[0].trim().replace(/["']/g, '');
		text_strip_face_default.textContent = first || 'default';
	}
	var render = text_strip_render;
	var sel = window.getSelection();
	var node = sel && sel.rangeCount ? sel.anchorNode : null;
	var state = { b: false, i: false, u: false, s: false, size: '', face: '' };
	if (node && render.contains(node)) {
		var el = (node.nodeType == 3) ? node.parentElement : node;
		for (var cur = el; cur && cur !== render; cur = cur.parentElement) {
			var tag = cur.tagName;
			if (!state.b && (tag == 'B' || tag == 'STRONG')) {
				state.b = true;
			}
			if (!state.i && (tag == 'I' || tag == 'EM')) {
				state.i = true;
			}
			if (!state.u && tag == 'U') {
				state.u = true;
			}
			if (!state.s && (tag == 'S' || tag == 'STRIKE' || tag == 'DEL')) {
				state.s = true;
			}
			if (!state.size && tag == 'SPAN' && cur.style.fontSize) {
				state.size = parseInt(cur.style.fontSize, 10) || '';
			}
			if (!state.face && tag == 'SPAN' && cur.style.fontFamily) {
				state.face = cur.style.fontFamily;
			}
		}
	}
	['b', 'i', 'u', 's'].forEach(function(k) {
		text_strip_btns[k].classList.toggle('glue-btn-active', state[k]);
	});
	// never overwrite the controls while they are being interacted with
	if (document.activeElement !== text_strip_size_field) {
		text_strip_size_field.value = state.size;
	}
	if (document.activeElement !== text_strip_size_slider) {
		// no explicit run size: the slider still points at the size the text
		// is actually rendering at, so it is never pointing at nothing
		var shown = parseInt(state.size || getComputedStyle(render).fontSize, 10) || 18;
		text_strip_size_slider.value = Math.max(8, Math.min(100, shown));
	}
	if (document.activeElement !== text_strip_face) {
		// a composite face (Verdana, Geneva, sans-serif) that is not one of
		// the offered options leaves the dropdown at its default
		text_strip_face.value = state.face;
	}
}

function text_strip_show(obj) {
	if (!text_strip) {
		text_strip_build();
	}
	text_strip_obj = obj;
	text_strip_render = obj.querySelector(':scope > .glue-text-render');
	text_strip.style.display = '';
	text_strip_position();                        // visible first, so offsetWidth is real
	text_strip_sync_state();
}

// reposition + state follow every caret move and selection change; typing
// keeps the caret moving, so this also covers "the object grew" cases, and
// no scroll handler is needed (page-space absolute scrolls with the page).
document.addEventListener('selectionchange', function() {
	if (!text_strip_obj || text_strip.style.display == 'none') {
		return;
	}
	var render = text_strip_render;
	var sel = window.getSelection();
	if (sel && sel.rangeCount) {
		var r = sel.getRangeAt(0);
		if (render.contains(r.startContainer) && render.contains(r.endContainer)) {
			text_strip_range = r.cloneRange();
		}
	}
	text_strip_position();
	text_strip_sync_state();
	if (text_strip_link_sync) {
		text_strip_link_sync();
	}
});

// the object can be resized by Moveable's handles while editing (the render's
// mousedown stopPropagation only blocks the object's own drag listener);
// resizeEnd fires glue-resizestop on the object
$.glue.live('.text', 'glue-resizestop', function(e) {
	if (this === text_strip_obj && text_strip_obj &&
		text_strip.style.display != 'none') {
		text_strip_position();
	}
});

//
// --- font popover ----------------------------------------------------------
//
// Face, size and style in one panel, replacing three buttons: one that cycled
// through the installed faces a click at a time, one that had to be dragged to
// change the size, and one that cycled bold -> italic -> both -> normal.
//
// SCOPE IS THE WHOLE OBJECT, like every other control in this menu: they all
// read getComputedStyle(obj) and write obj.style.*. Per-selection styling is
// the run-formatting strip above; the toggles here are two-state, because
// with one object there is no third, partial state to be in.
//
// The panel behaves like the colour picker: placed in the nearest free space
// beside the object rather than over it, applied live so the judgement can be
// made by eye, closed by a click outside or Escape.
//

// One panel at a time, whichever it is: two open at once would fight for the
// same free space beside the object.
function text_font_popover(obj)
{
	var pop = $.glue.popover.open(obj, 'glue-font-popover');
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
	var face_row = $.glue.popover.row(false);
	face_row.appendChild(select);
	pop.appendChild(face_row);

	// --- row 2: size ------------------------------------------------------
	var size_row = $.glue.popover.number_row('size', {
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

	var style_row = $.glue.popover.row('style');
	var toggles = {};
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
		toggles[t[0]] = b;
		style_row.appendChild(b);
	});

	// The text's colour, on the same row: it belongs with how the type looks,
	// and it was a button of its own in the menu until this panel existed.
	style_row.appendChild($.glue.popover.color_button('text colour',
		function() {
			return getComputedStyle(obj).color;
		},
		function(col) {
			obj.style.color = col;
		},
		function(col) {
			save();
		}));

	pop.appendChild(style_row);

	// --- more knobs: spacing, alignment and a shadow ----------------------
	//
	// A panel of its own until now, opened from a button of its own. It is
	// the same subject - how the type sits - and most objects never touch it,
	// so it folds away here instead of taking a second button in the menu.
	var fold = $.glue.popover.fold(pop, 'more knobs');
	pop.appendChild(fold.toggle);
	var adv = fold.body;
	pop.appendChild(adv);

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

	var line = $.glue.popover.number_row('line', {
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
	adv.appendChild(line.row);

	var letter = $.glue.popover.number_row('letter', {
		min: -0.2, max: 1, step: 0.01, decimals: 2, unit: 'em',
		value: to_em(cs.letterSpacing, 0),
		apply: function(v, commit) {
			obj.style.letterSpacing = v+'em';
			if (commit) {
				save();
			}
		}
	});
	adv.appendChild(letter.row);

	var word = $.glue.popover.number_row('word', {
		min: -0.2, max: 2, step: 0.01, decimals: 2, unit: 'em',
		value: to_em(cs.wordSpacing, 0),
		apply: function(v, commit) {
			obj.style.wordSpacing = v+'em';
			if (commit) {
				save();
			}
		}
	});
	adv.appendChild(word.row);

	// --- alignment --------------------------------------------------------
	//
	// Four buttons rather than a cycle, so the one in force is visible
	// without clicking through the others. Note computed text-align reads
	// 'start' when nothing is set, which is left in a left-to-right page -
	// treat it as left rather than as "none of them".
	var align_row = $.glue.popover.row('align');
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
		// the toolbar's icons are 32px; in here they sit next to the font
		// panel's 26px style toggles and should match those instead
		b.style.width = '26px';
		b.style.height = '26px';
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

	adv.appendChild(align_row);


	// --- a halo behind the text ------------------------------------------
	//
	// text-shadow with no offset: a glow around the letters rather than a
	// shadow beside them. Same three ingredients as the object glow, and
	// stored the same way - a radius, a strength and a colour, composed in
	// css/main.css.
	var shadow = {
		radius: parseFloat(obj.style.getPropertyValue('--glue-shadow-radius')) || 0,
		alpha: parseFloat(obj.style.getPropertyValue('--glue-shadow-alpha')) || 80,
		color: obj.style.getPropertyValue('--glue-shadow-color').trim() || '#000000'
	};
	var write_shadow = function(commit) {
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
		if (commit) {
			save();
		}
	};

	var shadow_radius = $.glue.popover.number_row('shadow', {
		min: 0, max: 40, step: 0.5, decimals: 1, unit: 'px',
		value: shadow.radius,
		apply: function(px, commit) {
			shadow.radius = px;
			write_shadow(commit);
		}
	});
	adv.appendChild(shadow_radius.row);

	var shadow_alpha = $.glue.popover.number_row('fade', {
		min: 0, max: 100, step: 1, unit: '%',
		value: shadow.alpha,
		apply: function(pct, commit) {
			shadow.alpha = pct;
			if (0 < shadow.radius) {
				write_shadow(commit);
			}
		}
	});
	adv.appendChild(shadow_alpha.row);

	var shadow_row = $.glue.popover.row('color');
	shadow_row.appendChild($.glue.popover.color_button('shadow colour',
		function() {
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
			save();
		}));
	adv.appendChild(shadow_row);

	// Where the faces in that dropdown come from, for anyone wondering why
	// theirs is not among them. A note rather than a control: uploading is a
	// site-wide thing and lives in site settings.
	var note = document.createElement('div');
	note.className = 'glue-popover-note glue-font-note';
	note.innerHTML = 'upload new fonts in <a href="' + $.glue.base_url +
		'?pages">site settings</a>';
	adv.appendChild(note);

	// One reset for the whole panel, in the fold: everything about the type,
	// including what the rows above set. Clearing the properties rather than
	// writing defaults into them is what makes the object file drop the
	// attributes, so a reset object is byte-identical to one nobody ever
	// touched.
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
			var now = getComputedStyle(obj);
			size_row.set(parseInt(now.fontSize, 10) || 16);
			line.set(to_em(now.lineHeight, 1.2));
			letter.set(to_em(now.letterSpacing, 0));
			word.set(to_em(now.wordSpacing, 0));
			sync_align();
			shadow_radius.set(0);
			var d = now.textDecorationLine || now.textDecoration || '';
			var w = parseInt(now.fontWeight, 10);
			state.bold = now.fontWeight == 'bold' || (!isNaN(w) && 600 <= w);
			state.italic = now.fontStyle == 'italic';
			state.underline = /underline/.test(d);
			state.strike = /line-through/.test(d);
			Object.keys(toggles).forEach(function(k) {
				toggles[k].classList.toggle('glue-font-toggle-on', state[k]);
			});
			var found = false;
			[].forEach.call(select.options, function(o) {
				if (o.value === now.fontFamily) {
					o.selected = true;
					found = true;
				}
			});
			if (!found) {
				var o = document.createElement('option');
				o.value = now.fontFamily;
				o.style.fontFamily = now.fontFamily;
				o.textContent = now.fontFamily.replace(/["']/g, '');
				o.selected = true;
				select.insertBefore(o, select.firstChild);
			}
		}));
	adv.appendChild(reset_row);

	$.glue.popover.show(pop);
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
	// the popover's owner points at the node that is about to die
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
};

function text_heading_popover(obj)
{
	var pop = $.glue.popover.open(obj, 'glue-heading-popover');
	if (!pop) {
		return;
	}

	var row = $.glue.popover.row('heading');
	var levels = [['normal', 'div'], ['H1', 'h1'], ['H2', 'h2'], ['H3', 'h3']];
	levels.forEach(function(level) {
		var b = document.createElement('div');
		b.className = 'glue-font-toggle glue-heading-toggle';
		b.textContent = level[0];
		b.title = 'render this text as a '+level[0]+' heading';
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

	pop.appendChild($.glue.popover.reset('back to a plain text object', function() {
		$.glue.text.set_heading(obj, 'div');
	}));

	$.glue.popover.show(pop);
}

document.addEventListener('DOMContentLoaded', function() {
	//
	// menu items
	//
	var elem = $.glue.icon('text-object', 'add a new text object');
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
			// The background is the last colour used on this page - the one
			// at the head of the colour picker's swatch row - so a run of new
			// objects comes out in the palette being worked in rather than in
			// a random one each time. Falls back to the random pick from
			// $.glue.conf.object.default_colors on a page where nothing has
			// been coloured yet, which is what it always did.
			var recent = $.glue.colorpicker.recent();
			if (recent.length) {
				elem.style.backgroundColor = recent[0];
			} else if ($.glue.conf.object.default_colors) {
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
	$.glue.contextmenu.register('text', 'text-source', elem, 5);


	// the new line-art swatch glyph, through the mask pipeline like every
	// other icon in the set
	elem = $.glue.icon('color-swatch-3', 'change background color');
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
		}, obj);
		colorpicker_shown = true;
	});
	elem.addEventListener('glue-deselect', function(e) {
		// hide the colorpicker if we opened it
		if (colorpicker_shown) {
			$.glue.colorpicker.hide();
			colorpicker_shown = false;
		}
	});
	$.glue.contextmenu.register('text', 'text-background-color', elem, 1);

	elem = $.glue.icon('background-color-remove', 'make background transparent');
	elem.addEventListener('click', function(e) {
		var obj = $.glue.owner(this);
		obj.style.backgroundColor = 'transparent';
		obj.querySelector(':scope > .glue-text-input').style.backgroundColor = 'transparent';
		$.glue.object.save(obj);
	});
	$.glue.contextmenu.register('text', 'text-background-transparent', elem, 2);


	// --- font popover ----------------------------------------------------
	//
	// One button in place of the three that used to be here (size, face,
	// style). It opens the panel built by text_font_popover() below, which
	// looks and behaves like the colour picker: it goes in the nearest free
	// space beside the object rather than over it ($.glue.popover), applies
	// live, reads the object's current values when it opens, and closes on a
	// click outside or Escape.
	elem = $.glue.icon('font-size', 'font: face, size and style');
	elem.addEventListener('click', function(e) {
		text_font_popover($.glue.owner(this));
		e.stopPropagation();
	});
	$.glue.contextmenu.register('text', 'text-font', elem, 3);



	// padding: the drag-with-shift gesture is a panel now (text_padding_popover
	// above), the way the transparency and z-index buttons folded into the
	// object adjustment panel
	elem = $.glue.icon('padding', 'change padding');
	elem.addEventListener('click', function(e) {
		text_padding_popover($.glue.owner(this));
		e.stopPropagation();
	});
	$.glue.contextmenu.register('text', 'text-text-padding', elem, 4);

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
