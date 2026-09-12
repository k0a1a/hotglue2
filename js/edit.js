/**
 *	js/edit.js
 *	Main hotglue frontend code
 *
 *	Copyright Gottfried Haider, Danja Vasiliev 2010.
 *	This source code is licensed under the GNU General Public License.
 *	See the file COPYING for more details.
 */

// jQuery's outerWidth/outerHeight(true) (dimensions including margin), used
// repeatedly for menu/context-menu layout math
function outer_width(elem, with_margin) {
	var w = elem.offsetWidth;
	if (with_margin) {
		var cs = getComputedStyle(elem);
		w += parseFloat(cs.marginLeft) + parseFloat(cs.marginRight);
	}
	return w;
}
function outer_height(elem, with_margin) {
	var h = elem.offsetHeight;
	if (with_margin) {
		var cs = getComputedStyle(elem);
		h += parseFloat(cs.marginTop) + parseFloat(cs.marginBottom);
	}
	return h;
}

// backs the orig_visibility handoff between this file (writer, in
// $.glue.upload below) and download-edit.js/video-edit.js (readers) - a
// WeakMap instead of jQuery .data() for the same reason $.glue.object's
// moveables map uses one
var glue_orig_visibility = new WeakMap();

// jQuery's .fadeIn(duration) - restores display and animates opacity 0->1
function fade_in(elem, duration) {
	elem.style.opacity = '0';
	elem.style.display = '';
	requestAnimationFrame(function() {
		requestAnimationFrame(function() {
			elem.style.transition = 'opacity '+duration+'ms';
			elem.style.opacity = '1';
		});
	});
}

$.glue.canvas = function()
{
	return {
		update: function(elem) {
			var elems;
			if (elem === undefined) {
				elems = document.querySelectorAll('.object');
			} else {
				elems = [elem];
			}
			var max_x = 0;
			var max_y = 0;
			elems.forEach(function(e) {
				if (max_x < e.offsetLeft+e.offsetWidth) {
					max_x = e.offsetLeft+e.offsetWidth;
				}
				if (max_y < e.offsetTop+e.offsetHeight) {
					max_y = e.offsetTop+e.offsetHeight;
				}
			});
			// make body at least match the window width and height but don't
			// send these values to the backend in any case
			if (max_x < window.innerWidth) {
				max_x = window.innerWidth;
			}
			if (max_y < window.innerHeight) {
				max_y = window.innerHeight;
			}
			// resize body
			var wrap = $.glue.canvas.wrapper();
			if (wrap) {
				// Centered layout: the container centers itself with
				// margin:0 auto, which resolves against BODY - so pinning a
				// pixel width on body would center it once, at whatever width
				// body happened to have, and never again on resize. Measured:
				// the object stayed at the same screen x through viewports of
				// 1280, 1100 and 950 until this branch existed.
				//
				// Height still has to grow to the content, on both, or the
				// page cannot be scrolled to reach the lower objects.
				document.body.style.width = '';
				wrap.style.height = max_y+'px';
			} else {
				document.body.style.width = max_x+'px';
			}
			document.body.style.height = max_y+'px';
			// update grid
			$.glue.grid.update();
		},
		// the centering container in centered layout mode, or false
		wrapper: function() {
			return document.getElementById('hg-centered-wrapper') || false;
		},
		// Where object coordinates sit in PAGE space.
		//
		// An object's offsetLeft/offsetTop are measured from its positioning
		// ancestor: the page in infinite mode, the centering container in
		// centered mode. Editor chrome - the context menus, and scrolling an
		// object into view - is positioned against the page in both, so it has
		// to add the container's own offset or it lands short by however far
		// the container is centered. Zero when there is no container, which
		// makes this a no-op on every existing page.
		origin: function() {
			var w = $.glue.canvas.wrapper();
			return w ? { x: w.offsetLeft, y: w.offsetTop } : { x: 0, y: 0 };
		},
		// Add a newly created object to the canvas. In centered mode that is
		// the container, not body - an object appended to body would sit
		// outside the centered layout until the next reload, and would then
		// jump, because the coordinates it saved were measured from a
		// different origin than the one it is reloaded into.
		add: function(elem) {
			var w = $.glue.canvas.wrapper();
			(w || document.body).appendChild(elem);
			return elem;
		},
		// Convert a PAGE point (a click's pageX/pageY, or menu spawn coords)
		// into the space object coordinates are stored in. A no-op in infinite
		// mode; in centered mode it takes off the container's offset, so an
		// object created by clicking lands under the pointer instead of
		// centering-width to the right of it.
		from_page: function(x, y) {
			var o = $.glue.canvas.origin();
			return { x: x-o.x, y: y-o.y };
		}
	};
}();

// small CSS color parsing/math helper, replacing the jquery.xcolor/farbtastic
// $.color dependency. Only needs to understand what computed styles
// (rgb()/rgba()) and the "#rrggbb"/"#rgb" hex the color picker itself
// produces look like - not the full CSS named-color table.
$.glue.color = function()
{
	var parse = function(str) {
		str = String(str).trim().toLowerCase();
		var m;
		if (m = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(str)) {
			return {
				r: parseInt(m[1]+m[1], 16),
				g: parseInt(m[2]+m[2], 16),
				b: parseInt(m[3]+m[3], 16),
				a: 1
			};
		}
		if (m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/.exec(str)) {
			return {
				r: parseInt(m[1], 16),
				g: parseInt(m[2], 16),
				b: parseInt(m[3], 16),
				a: 1
			};
		}
		if (m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([0-9.]+)\s*)?\)$/.exec(str)) {
			return {
				r: parseInt(m[1], 10),
				g: parseInt(m[2], 10),
				b: parseInt(m[3], 10),
				a: m[4] !== undefined ? parseFloat(m[4]) : 1
			};
		}
		if (str == 'transparent') {
			return { r: 0, g: 0, b: 0, a: 0 };
		}
		return false;
	};

	var comp = function(v) {
		v = Math.max(0, Math.min(255, Math.round(v)));
		return (v < 16 ? '0' : '') + v.toString(16);
	};

	var to_hex = function(rgb) {
		return '#'+comp(rgb.r)+comp(rgb.g)+comp(rgb.b);
	};

	return {
		parse: parse,
		to_hex: to_hex,
		// opposite color on each channel, used for grid lines that need to
		// stay visible against any background color
		complementary: function(hex) {
			var rgb = parse(hex);
			if (!rgb) {
				return hex;
			}
			return to_hex({ r: 255-rgb.r, g: 255-rgb.g, b: 255-rgb.b });
		},
		average: function(hex1, hex2) {
			var a = parse(hex1);
			var b = parse(hex2);
			if (!a || !b) {
				return hex1;
			}
			return to_hex({ r: (a.r+b.r)/2, g: (a.g+b.g)/2, b: (a.b+b.b)/2 });
		}
	};
}();

// wraps the vendored vanilla-picker library (js/vanilla-picker.js) behind
// the same show/hide/set_color API the native <input type="color"> version
// used, so page-edit.js/text-edit.js need no changes. Switched away from the
// native picker because its platform-dependent UI (a swatch grid on some
// Linux/Chromium setups) made trying out shades require repeated confirm-
// and-reopen clicks, instead of farbtastic's original continuous drag-to-
// preview wheel - vanilla-picker's onChange fires live while dragging,
// matching that.
// Where a popover goes. "No menu or interface shall interfere with page
// elements" applies to the editor's own panels too: opening one at the
// pointer puts it squarely on top of the object being edited, which is the
// one thing the author needs to watch while editing it. So a popover goes in
// the nearest free space AROUND the selection instead - right, below, left or
// above, whichever is closest to where the pointer was and still fits on
// screen. Any candidate that fits is by construction clear of the object,
// since each one is placed past one of its edges.
//
// Pulled out of the colour picker so that the panels that came after it -
// the font popover, and whatever follows - land in the same places for the
// same reasons, rather than each growing its own idea of "near the button".
$.glue.popover = function()
{
	var GAP = 10;
	var open_panel = false;

	return {
		// w, h .. the popover's size in px
		// p .. where the pointer was, in viewport coordinates (optional)
		// ignore .. an element to leave out of what must stay visible,
		//   which is how a panel avoids avoiding ITSELF: it is in the DOM
		//   before it is placed, and .glue-popover is on the list below
		// returns { x, y } in viewport coordinates
		place_for: function(w, h, p, ignore) {
			// The VISUAL viewport, not the layout one. They are the same on a
			// desktop at 100% zoom and very different on a phone: an on-screen
			// keyboard shortens the visual viewport and leaves the layout
			// viewport alone, so a panel placed by clientHeight lands
			// underneath the keyboard while every measurement says it is on
			// screen. Measured on a Galaxy S23: layout 274x500, visual
			// 274x308 with the keyboard up, and the font panel's bottom edge
			// at 350. Pinch-zooming does the same thing on both.
			var vv = window.visualViewport;
			var min_x = vv ? vv.offsetLeft : 0;
			var min_y = vv ? vv.offsetTop : 0;
			var vw = vv ? vv.width : document.documentElement.clientWidth;
			var vh = vv ? vv.height : document.documentElement.clientHeight;
			if (!p) {
				p = { x: Math.round(min_x+vw/2), y: Math.round(min_y+vh/2) };
			}

			// Two boxes, because they are not equally important. The OBJECT
			// is what must not be covered - "no menu or interface shall
			// interfere with page elements". The menu the panel was opened
			// from, and any panel already open, are better not covered but
			// are ours to cover if it comes to that.
			var union = function(sel) {
				var box = false;
				document.querySelectorAll(sel).forEach(function(el) {
					if (ignore && (el === ignore || el.contains(ignore))) {
						return;
					}
					var b = el.getBoundingClientRect();
					if (!b.width && !b.height) {
						return;
					}
					box = box ? {
						left: Math.min(box.left, b.left), top: Math.min(box.top, b.top),
						right: Math.max(box.right, b.right), bottom: Math.max(box.bottom, b.bottom)
					} : { left: b.left, top: b.top, right: b.right, bottom: b.bottom };
				});
				return box;
			};
			var obj = union('.glue-selected');
			var ui = union('.glue-contextmenu-left, .glue-contextmenu-top, ' +
				'.glue-menu, .glue-popover');

			var overlap = function(x, y, box) {
				if (!box) {
					return 0;
				}
				var ox = Math.min(x+w, box.right)-Math.max(x, box.left);
				var oy = Math.min(y+h, box.bottom)-Math.max(y, box.top);
				return (0 < ox && 0 < oy) ? ox*oy : 0;
			};

			// Beside each box, on all four sides, plus the pointer itself as
			// a last resort. Every candidate is clamped on screen rather than
			// discarded for being off it: a candidate that has to slide back
			// into view is still better than one that lands on the object.
			var candidates = [];
			[obj, ui && obj ? {
				left: Math.min(obj.left, ui.left), top: Math.min(obj.top, ui.top),
				right: Math.max(obj.right, ui.right), bottom: Math.max(obj.bottom, ui.bottom)
			} : ui].forEach(function(box) {
				if (!box) {
					return;
				}
				candidates.push({ x: box.right+GAP, y: p.y-h/2 });
				candidates.push({ x: p.x-w/2, y: box.bottom+GAP });
				candidates.push({ x: box.left-GAP-w, y: p.y-h/2 });
				candidates.push({ x: p.x-w/2, y: box.top-GAP-h });
			});
			candidates.push({ x: p.x-w/2, y: p.y-h/2 });

			var best = false;
			var best_score = false;
			candidates.forEach(function(c) {
				// clamped into what can actually be seen, which does not
				// start at 0 once the page is pinch-zoomed
				var x = Math.max(min_x, Math.min(min_x+vw-w, c.x));
				var y = Math.max(min_y, Math.min(min_y+vh-h, c.y));
				// covering the object is what disqualifies a position;
				// covering our own chrome is a tie-breaker; being near where
				// the pointer was decides the rest
				var score = [
					overlap(x, y, obj),
					overlap(x, y, ui),
					Math.pow(x+w/2-p.x, 2)+Math.pow(y+h/2-p.y, 2)
				];
				if (!best || score[0] < best_score[0] ||
					(score[0] === best_score[0] && score[1] < best_score[1]) ||
					(score[0] === best_score[0] && score[1] === best_score[1] &&
						score[2] < best_score[2])) {
					best = { x: x, y: y };
					best_score = score;
				}
			});
			return { x: Math.round(best.x), y: Math.round(best.y) };
		},
		// Puts an already-built, already-in-the-DOM popover where place_for()
		// says. It must be position:fixed and laid out (so it has a size) by
		// the time this is called.
		place: function(elem, p) {
			var at = $.glue.popover.place_for(elem.offsetWidth, elem.offsetHeight,
				p, elem);
			elem.style.left = at.x+'px';
			elem.style.top = at.y+'px';
			return at;
		},
		// where the pointer last was, which is what a popover opens near
		pointer: function() {
			return $.glue.colorpicker.last_click();
		},
		// Opens an empty panel for obj, or closes the one that is open if it
		// is already this panel on this object, so the button toggles.
		// Returns the element to fill with rows, or false when it just
		// closed. One panel at a time whichever it is: two open at once would
		// fight over the same free space beside the object.
		// cls .. a class naming the panel, e.g. 'glue-font-popover'
		open: function(obj, cls) {
			var same = open_panel && $.glue.owner(open_panel) === obj &&
				open_panel.classList.contains(cls);
			$.glue.popover.close();
			if (same) {
				return false;
			}
			var pop = document.createElement('div');
			pop.className = 'glue-popover glue-ui '+cls;
			$.glue.owner(pop, obj);
			return pop;
		},
		// Puts the filled panel on screen. It goes into the DOM invisible and
		// is positioned after, because place() needs its size.
		show: function(pop) {
			pop.style.visibility = 'hidden';
			document.body.appendChild(pop);
			open_panel = pop;
			$.glue.popover.place(pop, $.glue.popover.pointer());
			pop.style.visibility = '';
		},
		close: function() {
			if (open_panel) {
				open_panel.remove();
				open_panel = false;
			}
		},
		// what is open, or false - for the handlers below
		current: function() {
			return open_panel;
		},
		// A folded-away section of a panel: a disclosure row and the body it
		// shows. Collapsed to start with, because what goes in one is what
		// most objects will never touch.
		//
		// Returns { toggle, body } - append both to the panel, fill the body.
		// Opening one changes the panel's height, and a panel is placed by
		// its size, so it is re-placed on every toggle.
		fold: function(pop, label) {
			var toggle_row = $.glue.popover.row(false);
			var disclosure = document.createElement('div');
			disclosure.className = 'glue-popover-disclosure';
			toggle_row.appendChild(disclosure);

			var body = document.createElement('div');
			body.className = 'glue-popover-advanced';

			var open = false;
			var sync = function() {
				disclosure.textContent = (open ? '\u25be' : '\u25b8')+' '+label;
				body.style.display = open ? '' : 'none';
			};
			disclosure.addEventListener('click', function() {
				open = !open;
				sync();
				$.glue.popover.place(pop, $.glue.popover.pointer());
			});
			sync();
			return { toggle: toggle_row, body: body };
		},
		// A colour button for a panel: the shared icon, opening the picker on
		// whatever property the caller names. One of these rather than one
		// per panel, so that "the colour of this thing" always looks and
		// behaves the same wherever it turns up.
		// title .. the tooltip, e.g. 'border colour'
		// current() .. the colour to open on
		// change(col) .. called live as the picker is dragged
		// done(col) .. called once when the picker closes
		color_button: function(title, current, change, done) {
			var b = $.glue.icon('color-swatch', title);
			b.classList.add('glue-popover-color');
			// the panels' own controls are 26px; the toolbar's are 32
			b.style.width = '26px';
			b.style.height = '26px';
			b.addEventListener('click', function(e) {
				$.glue.colorpicker.show(current(), false, change, done);
				e.stopPropagation();
			});
			return b;
		},
		// The small "reset" a panel offers for its own properties: it clears
		// them rather than writing defaults into them, so the object file
		// drops the attributes and the object goes back to looking like one
		// nobody ever touched. Sits at the end of a row, pushed right.
		reset: function(title, fn) {
			var b = document.createElement('div');
			b.className = 'glue-popover-reset';
			b.textContent = 'reset';
			b.title = title;
			b.addEventListener('click', fn);
			return b;
		},
		// The destructive sibling of reset: same small frame, in the colour
		// of the panel's problem notes, for the control that removes what
		// the panel acts on rather than resetting it.
		delete: function(title, fn) {
			var b = document.createElement('div');
			b.className = 'glue-popover-delete';
			b.textContent = 'delete';
			b.title = title;
			b.addEventListener('click', fn);
			return b;
		},
		// one row of a popover: a label and whatever control it names
		row: function(label) {
			var row = document.createElement('div');
			row.className = 'glue-popover-row';
			if (label) {
				var l = document.createElement('div');
				l.className = 'glue-popover-label';
				l.textContent = label;
				row.appendChild(l);
			}
			return row;
		},
		// A slider paired with a number field for the same value, kept in
		// step. Lives here rather than in the module that first needed it,
		// because the panels are meant to be each other's twins: the font
		// size, the three text spacings and the colour picker's alpha are all
		// the same control and should not drift apart.
		//
		// The FIELD is deliberately not capped by the slider: display type
		// runs past the end of any sensible drag range, and so does the odd
		// extreme letter spacing. The slider parks at its own end and the
		// field keeps the real number.
		//
		// opts .. min, max, step, decimals, value, unit (label after the
		//         field), apply(value, commit) - called live while dragging
		//         with commit false, and once with true when it is settled
		// returns { row: element, set: function(value) } - set() is for
		// whoever changes the value behind the row's back (a reset button, a
		// colour arriving from somewhere else)
		number_row: function(label, opts) {
			var row = $.glue.popover.row(label);
			var decimals = opts.decimals || 0;
			var fmt = function(v) {
				return decimals ? v.toFixed(decimals) : String(Math.round(v));
			};
			var clamp = function(v) {
				return Math.max(opts.min, Math.min(opts.max, v));
			};

			var range = document.createElement('input');
			range.type = 'range';
			range.className = 'glue-popover-slider';
			range.min = opts.min;
			range.max = opts.max;
			range.step = opts.step;
			range.value = clamp(opts.value);

			var field = document.createElement('input');
			field.type = 'number';
			field.className = 'glue-popover-field';
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
				// tidied to the row's own precision once it is settled, so a
				// typed "8" and a dragged 8 look the same afterwards
				this.value = fmt(v);
				opts.apply(v, true);
			});

			row.appendChild(range);
			row.appendChild(field);
			if (opts.unit) {
				var u = document.createElement('div');
				u.className = 'glue-popover-unit';
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
	};
}();

// A panel is closed by a click anywhere outside it, by Escape, by its object
// being deselected, and by that object being dragged out from under it.
// Capture phase for the click, so it closes even when something else stops
// the event.
document.documentElement.addEventListener('click', function(e) {
	var pop = $.glue.popover.current();
	// The colour picker counts as part of whatever panel opened it: a panel
	// with a colour button on it would otherwise close the moment the picker
	// was clicked, which is the first thing anyone does with it.
	if (pop && !pop.contains(e.target) && !e.target.closest('.picker_wrapper')) {
		$.glue.popover.close();
	}
}, true);

document.documentElement.addEventListener('keydown', function(e) {
	if (e.key == 'Escape') {
		$.glue.popover.close();
	}
});

document.addEventListener('DOMContentLoaded', function() {
	$.glue.live('.object', 'glue-deselect', function(e) {
		var pop = $.glue.popover.current();
		if (pop && $.glue.owner(pop) === this) {
			$.glue.popover.close();
		}
	});
	$.glue.live('.object', 'glue-movestart', function(e) {
		$.glue.popover.close();
	});
});

$.glue.colorpicker = function()
{
	var change_func = false;
	var finish_func = false;
	var shown = false;
	var cancelled = false;

	// Invisible positioning anchor - vanilla-picker renders its popup relative
	// to this, moved to wherever was last clicked each time show() is called,
	// so the picker appears next to the button that opened it.
	//
	// It is position:FIXED, so it needs VIEWPORT coordinates. It used to be
	// given $.glue.menu.spawn_coords(), which is in page space and is captured
	// when the menu opens rather than when the picker does - so the popup
	// landed wherever the page had been scrolled to at some earlier moment.
	// Measured: the same 655,30 whatever button was clicked. The last click is
	// both the right anchor and already in the right space.
	var last_click = false;
	// pointerdown rather than mousedown: the drag controls cancel their
	// pointerdown, which suppresses the compatibility mousedown that used to
	// keep this anchor fresh on touch
	document.addEventListener('pointerdown', function(e) {
		last_click = { x: e.clientX, y: e.clientY };
	}, true);

	var anchor = document.createElement('div');
	anchor.className = 'glue-ui';
	anchor.style.position = 'fixed';
	anchor.style.width = '0';
	anchor.style.height = '0';
	// Above the objects it is used to recolour. Objects go up to z-index 199
	// ($.glue.stack), menu items sit at 200/201 and the centered-layout
	// handles at 400 - without this the picker paints UNDER whichever object
	// is selected, which is most of the time, since that is the object being
	// coloured. Below the modal backdrop at 500.
	anchor.style.zIndex = '450';

	// The last several colours used ON THIS PAGE, offered as swatches above
	// the hex field. Stored on the page object as page-recent-colors and handed
	// back by module_page.inc.php as $.glue.conf.page.recent_colors, so they
	// belong to the page and are there for whoever opens it next - unlike the
	// last-typeface memory in module_text.inc.php, which is deliberately
	// site-wide. A page's palette is part of that page's design.
	// Seven, which is what fits: the swatch row has 158px of usable width in
	// a 170px panel, and seven 18px swatches with 4px between them come to
	// 150. An eighth would wrap the row and make the panel taller.
	var RECENT_MAX = 7;
	var recent = false;		// read lazily: conf is emitted after this file
	var swatches = document.createElement('div');
	swatches.className = 'glue-picker-recent glue-ui';

	var recent_colors = function() {
		if (recent === false) {
			var stored = ($.glue.conf.page && $.glue.conf.page.recent_colors) || '';
			recent = String(stored).split(',').filter(function(c) {
				return /^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(c);
			});
		}
		return recent;
	};

	var remember_color = function(color) {
		// #rrggbb while opaque, #rrggbbaa once the transparency slider has
		// been moved - never rgba(), since the list is comma-separated and
		// rgba() is full of commas
		var hex = String(color.hex).toLowerCase();
		if (/^#[0-9a-f]{6}ff$/.test(hex)) {
			hex = hex.slice(0, 7);
		}
		if (!/^#[0-9a-f]{6}([0-9a-f]{2})?$/.test(hex)) {
			return;
		}
		var list = recent_colors();
		var at = list.indexOf(hex);
		if (at == 0) {
			// already the most recent one: nothing to write
			return;
		} else if (0 < at) {
			list.splice(at, 1);
		}
		list.unshift(hex);
		recent = list.slice(0, RECENT_MAX);
		if ($.glue.page) {
			$.glue.backend({
				method: 'glue.update_object',
				name: $.glue.page+'.page',
				'page-recent-colors': recent.join(',')
			});
		}
	};

	// Where the popup goes - see $.glue.popover, which is this rule pulled out
	// so every popover in the editor obeys it.
	var place_popup = function() {
		var wrapper = anchor.querySelector('.picker_wrapper');
		if (!wrapper) {
			return;
		}
		// popup_bottom puts the wrapper's top-left at the anchor, and
		// css/edit.css takes away the margin vanilla-picker leaves for the
		// arrow, so what $.glue.popover works out for the wrapper is where
		// the anchor goes
		var at = $.glue.popover.place_for(wrapper.offsetWidth, wrapper.offsetHeight,
			last_click);
		anchor.style.left = at.x+'px';
		anchor.style.top = at.y+'px';
	};

	// The transparency row: a plain slider and a number field, in place of
	// vanilla-picker's alpha bar. The bar was a gradient from the colour to a
	// checkerboard with a handle somewhere along it - it showed the effect
	// but not the value, and there was no way to type one. This is the same
	// control as the font panel's size and the spacing panel's rows, which is
	// the point: one kind of slider in the editor, not one per panel.
	//
	// Percent rather than 0-1: a hundredth is the finest anyone means, and
	// "50%" needs no explaining.
	var alpha_row = false;

	var build_alpha = function() {
		var editor = anchor.querySelector('.picker_editor');
		if (!editor || !editor.parentNode) {
			return;
		}
		// vanilla-picker builds its wrapper once and REUSES it: hiding the
		// picker only detaches the anchor, so anything added to the wrapper is
		// still there the next time it opens. Without this the panel grows an
		// extra alpha row per open. (The swatch row does not need it - it is
		// one element that gets re-filled and moved.)
		var stale = anchor.querySelector('.glue-picker-alpha');
		if (stale) {
			stale.remove();
		}
		alpha_row = $.glue.popover.number_row('alpha', {
			min: 0, max: 100, step: 1, unit: '%',
			value: Math.round(picker.color.rgba[3]*100),
			apply: function(pct) {
				var c = picker.color.rgba;
				// straight through the picker rather than onto the object, so
				// everything else - the sample, the hex field, onChange and
				// what gets stored - follows from one place
				picker.setColor('rgba('+Math.round(c[0])+', '+Math.round(c[1])+', '+
					Math.round(c[2])+', '+(pct/100)+')');
			}
		});
		alpha_row.row.classList.add('glue-picker-alpha');
		// vanilla-picker swallows every click inside the panel (so a click on
		// the gradient does not leak to what is underneath it). A range input
		// COMMITS its value on click - the track click, and the end of a drag -
		// and Chromium cancels the whole drag when that default is prevented.
		// The row's own clicks stop before the library's handler sees them,
		// the way the swatches' clicks do.
		alpha_row.row.addEventListener('click', function(e) {
			if (e.target instanceof HTMLInputElement) {
				e.stopPropagation();
			}
		});
		editor.parentNode.insertBefore(alpha_row.row, editor);
	};

	// vanilla-picker builds its DOM on the first show(), so the row is
	// (re)placed then rather than at construction
	var build_swatches = function() {
		swatches.textContent = '';
		recent_colors().forEach(function(hex) {
			var sw = document.createElement('div');
			sw.className = 'glue-picker-swatch';
			// the colour goes on an inner layer: the swatch itself carries
			// the checkerboard a transparent colour has to show against
			var ink = document.createElement('div');
			ink.style.width = '100%';
			ink.style.height = '100%';
			ink.style.backgroundColor = hex;
			sw.appendChild(ink);
			sw.title = hex;
			sw.addEventListener('click', function(e) {
				// not silent: this should update the object live, exactly as
				// dragging in the gradient does
				picker.setColor(hex);
				e.stopPropagation();
			});
			swatches.appendChild(sw);
		});
		var editor = anchor.querySelector('.picker_editor');
		if (editor && editor.parentNode) {
			editor.parentNode.insertBefore(swatches, editor);
		}
	};

	// What the modules get back. They put it straight into a style property
	// and store it as an object attribute, so it has to be something
	// $.glue.color.parse() reads and CSS accepts: plain #rrggbb while the
	// colour is opaque, which is what every existing page already stores and
	// keeps them unchanged, rgba() once the transparency slider has been
	// moved, and the keyword for fully transparent - hotglue has always
	// stored that as 'transparent' and a page should not start saying
	// rgba(0, 0, 0, 0) because the picker was opened on it.
	var to_css = function(color) {
		var c = color.rgba;
		var a = Math.round(c[3]*100)/100;
		if (a <= 0) {
			return 'transparent';
		} else if (1 <= a) {
			return String(color.hex).slice(0, 7);
		}
		return 'rgba('+Math.round(c[0])+', '+Math.round(c[1])+', '+
			Math.round(c[2])+', '+a+')';
	};

	// The transparency slider is vanilla-picker's own alpha channel, which
	// its layout puts directly under the gradient square - above the recent
	// colours. Note it is the alpha of THIS colour, not the opacity of the
	// object: a half-transparent background with fully solid text on it,
	// which the object-transparency button in modules/object/object-edit.js
	// cannot express (it fades everything at once).
	var picker = new Picker({
		parent: anchor,
		popup: 'top',
		alpha: true,
		onChange: function(color) {
			// a colour can arrive from the gradient, the hex field or a
			// swatch; the alpha row has to say what is true whichever it was
			if (alpha_row) {
				alpha_row.set(Math.round(color.rgba[3]*100));
			}
			if (typeof change_func == 'function') {
				change_func(to_css(color));
			}
		},
		onClose: function(color) {
			if (!shown) {
				return;
			}
			shown = false;
			alpha_row = false;
			if (!cancelled) {
				remember_color(color);
				if (typeof finish_func == 'function') {
					finish_func(to_css(color));
				}
			}
			anchor.remove();
		}
	});

	return {
		// The colours used on this page, most recent first, as the swatch row
		// shows them. Live: it includes what has been picked since the page
		// loaded, not just what was stored when it did.
		recent: function() {
			return recent_colors().slice();
		},
		// the pointer position popovers open near - tracked here because this
		// is where the document-wide click listener already lives
		last_click: function() {
			return last_click ? { x: last_click.x, y: last_click.y } : false;
		},
		hide: function(cancel) {
			if (shown) {
				cancelled = (cancel === true);
				picker.hide();
			}
		},
		is_shown: function() {
			return shown;
		},
		set_color: function(col) {
			var rgb = $.glue.color.parse(col);
			if (!rgb) {
				picker.setColor('#ff0000', true);
				return;
			}
			// 'transparent' is stored as fully transparent BLACK, and
			// opening the picker on it used to show white because there was
			// no alpha slider to explain the black. There is one now, so the
			// slider shows what is true - but the colour underneath still
			// starts white, since dragging transparency up out of an
			// untouched object should not turn it black.
			var hex = $.glue.color.to_hex(rgb.a == 0 ? { r: 255, g: 255, b: 255 } : rgb);
			picker.setColor('rgba('+parseInt(hex.slice(1, 3), 16)+', '+
				parseInt(hex.slice(3, 5), 16)+', '+parseInt(hex.slice(5, 7), 16)+', '+
				rgb.a+')', true);
		},
		show: function(def, transp, change, finish) {
			if (shown) {
				$.glue.colorpicker.hide(true);
			}

			change_func = change;
			finish_func = finish;
			cancelled = false;

			document.body.appendChild(anchor);
			// Always 'bottom', which is the only one of vanilla-picker's four
			// popup positions that puts the wrapper's top-left exactly at the
			// anchor. Which side of the object it ends up on is decided by
			// place_popup() below, from the popup's real size - the library
			// fixes its own choice at construction and never flips, which is
			// how a button near the top of the window used to put the popup
			// off the top of the screen entirely (measured at y=-68).
			picker.setOptions({ popup: 'bottom' });

			if (typeof def != 'string' || def.length == 0) {
				// set a sane default
				picker.setColor('#ff0000', true);
			} else {
				$.glue.colorpicker.set_color(def);
			}

			shown = true;
			picker.show();
			build_alpha();
			build_swatches();
			// after the swatches, since they are part of what makes it tall
			place_popup();
		}
	};
}();

$.glue.contextmenu = function()
{
	var default_prio = 10;
	var left = [];
	var m = {};
	var owner = false;
	var prev_owner = false;
	var top = [];
	var veto = {};

	$.glue.live('.object', 'glue-deselect', function(e) {
		// hide menu when deselecting
		$.glue.contextmenu.hide();
	});

	$.glue.live('.object', 'glue-movestart', function(e) {
		// hide menu when moving the selected object
		if (this == owner) {
			prev_owner = owner;
			$.glue.contextmenu.hide();
		}
	});

	$.glue.live('.object', 'glue-movestop', function(e) {
		// show menu again when we hid the menu because of movement
		if (this == prev_owner) {
			$.glue.contextmenu.show(prev_owner);
			prev_owner = false;
		}
	});

	$.glue.live('.object', 'glue-select', function(e) {
		// show menu when one object is selected
		if (document.querySelectorAll('.glue-selected').length == 1) {
			$.glue.contextmenu.show(this);
		} else {
			$.glue.contextmenu.hide();
		}
	});

	// Where the menu items go, geometry only - no DOM insertion, no events -
	// so it can be run again when the object changes shape or angle under
	// them without rebuilding the menu.
	//
	// From the object's VISUAL box, not its layout box. offsetLeft and
	// offsetTop describe where the element was laid out and know nothing
	// about the transform on top of it, so a rotated object got its menus
	// drawn around the rectangle it would have occupied unrotated - a 90
	// degree turn leaves the column and the row sitting across the object
	// instead of beside it. getBoundingClientRect() is the rectangle actually
	// on screen, rotation included; page coordinates are what the menu items
	// (absolutely positioned in body) need, hence the scroll offsets, and it
	// makes $.glue.canvas.origin() unnecessary here since the rect already
	// accounts for any wrapper the objects sit in.
	//
	// reveal .. fade the items in as they are placed. True the first time
	// they appear; false when they are only being moved, which must not
	// restart the animation under the pointer.
	var place_items = function(obj, reveal) {
		var obj_rect = obj.getBoundingClientRect();
		for (var i=0; i < 2; i++) {
			var target;
			var cur_left = obj_rect.left+window.scrollX;
			var cur_top = obj_rect.top+window.scrollY;
			var offset = 48; // menu offset (when can't calculate height or width)
			if (i == 0) {
				target = top;
				// this is to make sure that the context menu for objects positioned at 0, 0 is accessible
				// TODO (later): can be improved
				if (left.length) {
					if (cur_left-outer_width(left[0].elem, true) < 0) {
						cur_left = outer_width(left[0].elem, true) + offset;
					}
				// if left menu is empty shift top menu right by 48px (to make fisrt icon visible)
				// TODO: calculate offset dynamically
				} else {
					if (cur_left-offset < 0) {
						cur_left = offset;
					}
				}
			} else {
				target = left;
				// this is to make sure that the context menu for objects positioned at 0, 0 is accessible
				// TODO (later): can be improved
				if (top.length) {
					if (cur_top-outer_height(top[0].elem, true) < 0) {
						cur_top = outer_height(top[0].elem, true);
					}
				// if top menu is empty shift left menu down by 48px (to make fisrt icon visible)
				// TODO: calculate offset dynamically
				} else {
					if (cur_top-offset < 0) {
						cur_top = offset;
					}
				}
			}
			for (var j=0; j < target.length; j++) {
				var item = target[j].elem;
				if (target == top) {
					item.style.left = cur_left+'px';
					var temp_top = cur_top-outer_height(item, true);
					if (temp_top < 0) {
						temp_top = 0;
					}
					item.style.top = temp_top+'px';
					var cur_width = outer_width(item, true);
				} else {
					var temp_left = cur_left-outer_width(item, true);
					if (temp_left < 0) {
						temp_left = 0;
					}
					item.style.left = temp_left+'px';
					item.style.top = cur_top+'px';
					var cur_height = outer_height(item, true);
				}
				// check if we still want to show the icon ;)
				if (getComputedStyle(item).display == 'none') {
					continue;
				}
				// show it for real
				if (target == left) {
					cur_top += cur_height;
				} else {
					cur_left += cur_width;
				}
				if (reveal) {
					item.style.visibility = '';
					item.style.display = 'none';
					fade_in(item, 333);
				}
			}
		}
	};

	return {
		// Runs the placement again for the menu that is already open, for
		// whatever has just changed the object's shape or angle under it. The
		// alternative - hide() and show() - would rebuild the whole menu and
		// fade it back in, which reads as a flicker after every resize.
		reposition: function() {
			if (owner) {
				place_items(owner, false);
			}
		},
		hide: function() {
			if (owner) {
				while (left.length) {
					var item = left.shift();
					$.glue.trigger(item.elem, 'glue-menu-deactivate');
					item.elem.remove();
				}
				while (top.length) {
					var item = top.shift();
					$.glue.trigger(item.elem, 'glue-menu-deactivate');
					item.elem.remove();
				}
				owner = false;
			}
		},
		is_shown: function() {
			if (owner) {
				return true;
			} else {
				return false;
			}
		},
		register: function(cls, name, elem, prio, top) {
			if (!m[cls]) {
				m[cls] = [];
			}
			if (prio === undefined) {
				prio = default_prio;
			}
			// 'top' opts an item out of its class's usual side: an 'object'
			// item flagged true goes to the top row instead of the left
			// column (object-adjust and object-background do)
			m[cls].push({ 'name': name, 'elem': elem, 'prio': prio, 'top': top });
		},
		// unreachable in practice (nothing in the codebase calls this) - kept
		// for API compatibility. Note cloneNode(true) (unlike jQuery's
		// .clone(true)) does not carry over event listeners; not worth
		// solving for dead code
		reuse: function(cls, name, as, prio) {
			if (prio === undefined) {
				prio = default_prio;
			}
			for (var cur_m in m) {
				for (var i=0; i<m[cur_m].length; i++) {
					if (m[cur_m][i].name == name) {
						// clone element (structure only, see note above)
						var new_elem = m[cur_m][i].elem.cloneNode(true);
						$.glue.contextmenu.register(cls, as, new_elem, prio);
						// return new element
						return new_elem;
					}
				}
			}
			return false;
		},
		show: function(obj) {
			if (owner) {
				if (obj == owner) {
					return;
				} else {
					$.glue.contextmenu.hide();
				}
			}
			// unless object is locked construct default menus
			if (!obj.classList.contains('locked')) {
				for (var cls in m) {
					if (obj.classList.contains(cls)) {
						for (var i=0; i < m[cls].length; i++) {
							var item = m[cls][i];
							// add to left or top: an object item can opt out
							// of the left column into the top row - the
							// register flag
							var target = (cls == 'object' && !item.top) ? left : top;
							// sort by priority ascending
							var added = false;
							for (var j=0; j < target.length; j++) {
								if (item.prio < target[j].prio) {
									target.splice(j, 0, item);
									added = true;
									break;
								}
							}
							if (!added) {
								target.push(item);
							}
						}
					}
				}
			// if object is locked show only 'object-lock' in object menu
			} else {
				var target = left;
				// find out position of 'object-lock' module in module array
				for (var i=0; i < m['object'].length; i++) {
					if (m['object'][i]['name'] == 'object-lock') {
						target.push(m['object'][i]);
					}
				}
			}
			// remove specific menu items again
			var obj_cls = Array.from(obj.classList);
			for (var cls in veto) {
				for (var i=0; i < obj_cls.length; i++) {
					if (cls == obj_cls[i]) {
						for (var j=0; j < veto[cls].length; j++) {
							for (var k=0; k < left.length; k++) {
								if (left[k].name == veto[cls][j]) {
									left.splice(k, 1);
									k--;
								}
							}
							for (var k=0; k < top.length; k++) {
								if (top[k].name == veto[cls][j]) {
									top.splice(k, 1);
									k--;
								}
							}
						}
					}
				}
			}
			// put the items in the DOM and let them say whether they want
			// to be here at all, then place them
			for (var i=0; i < 2; i++) {
				var target = (i == 0) ? top : left;
				for (var j=0; j < target.length; j++) {
					var item = target[j].elem;
					item.id = 'glue-contextmenu-'+target[j].name;
					item.classList.add(target == left ?
						'glue-contextmenu-left' : 'glue-contextmenu-top');
					item.classList.add('glue-ui');
					item.style.position = 'absolute';
					item.style.visibility = 'hidden';
					item.style.zIndex = '201';
					document.body.appendChild(item);
					// set owner and trigger event
					$.glue.owner(item, obj);
					// Alpine's own MutationObserver-based init is async, but
					// icons here get detached/reattached on every hide()/
					// show() - without this, the glue-menu-activate trigger
					// right below fires before Alpine has (re)attached its
					// x-on listener on the freshly reappended element, and
					// the event is silently lost (Alpine.initTree is a
					// no-op on an already-initialized element, safe to call
					// every time)
					if (window.Alpine) {
						Alpine.initTree(item);
					}
					$.glue.trigger(item, 'glue-menu-activate');
				}
			}
			place_items(obj, true);
			owner = obj;
			// reset prev_owner as well
			prev_owner = false;
			return true;
		},
		veto: function(cls, name) {
			if (!veto[cls]) {
				veto[cls] = [];
			}
			veto[cls].push(name);
		}
	};
}();

$.glue.grid = function()
{
	var guides = [];		// list of elements
	var guides_x = [];		// list of y coordinates for x-guides
	var guides_y = [];		// list of x coordinates for y-guides
	var lines = [];			// list of elements
	var grid_height = false;
	var grid_mode = 0;
	var grid_width = false;
	var grid_x = 50;
	var grid_y = 50;

	var draw = function() {
		// bit 0 draws the grid and guides
		// i'd have preferred to use the canvas element for this, but as it
		// would need to be on top it'd receive all the click events..
		// TODO (later): there seem to be an off-by-one bug in Chrome when rendering the line over an object below
		if ((grid_mode & 1)) {
			if (grid_height !== document.documentElement.scrollHeight || grid_width !== document.documentElement.scrollWidth) {
				// optimization: only redraw the grid when width & height changes
				remove();
				grid_height = document.documentElement.scrollHeight;
				grid_width = document.documentElement.scrollWidth;
				// get background color
				var bg_color = '#ffffff';	// default to white
				var body_bg = getComputedStyle(document.body).backgroundColor;
				if (body_bg.length) {
					var bg_rgb = $.glue.color.parse(body_bg);
					// doesn't handle the complementary of rgba(0, 0, 0, 0)
					if (bg_rgb && bg_rgb.a != 0) {
						bg_color = $.glue.color.to_hex(bg_rgb);
					}
				}
				// add grid lines
				//
				// Offset by the canvas origin. Snapping happens in OBJECT
				// space (an object's left is measured from the centering
				// container), while these lines are drawn in page space - so
				// without the offset the grid a user sees and the positions
				// objects actually snap to are out of step by however far the
				// container is centered. No-op in infinite mode, where the
				// origin is 0.
				var grid_origin = $.glue.canvas.origin();
				// the lines are drawn as dotted rows (css/edit.css builds
				// the dots from --glue-grid-color); the dimensions of the
				// dot row live in the class, the length of the line here
				var line_color = $.glue.color.complementary(bg_color);
				for (var x=(grid_origin.x % grid_x); x <= grid_width; x+=grid_x) {
					// no line hugging the page's left edge - the grid
					// starts one step in
					if (x == 0) {
						continue;
					}
					var elem = document.createElement('div');
					// set crucial css properties
					elem.classList.add('glue-grid-y');
					elem.classList.add('glue-grid');
					elem.classList.add('glue-ui');
					// use complementary color
					elem.style.setProperty('--glue-grid-color', line_color);
					elem.style.height = grid_height+'px';
					elem.style.left = x+'px';
					elem.style.position = 'absolute';
					elem.style.top = '0px';
					elem.style.zIndex = '200';
					// add to dom and list
					document.body.appendChild(elem);
					lines.push(elem);
				}
				for (var y=(grid_origin.y % grid_y); y <= grid_height; y+=grid_y) {
					// no line hugging the page's top edge - the grid
					// starts one step down
					if (y == 0) {
						continue;
					}
					var elem = document.createElement('div');
					elem.classList.add('glue-grid-x');
					elem.classList.add('glue-grid');
					elem.classList.add('glue-ui');
					// use complementary color
					elem.style.setProperty('--glue-grid-color', line_color);
					elem.style.left = '0px';
					elem.style.position = 'absolute';
					elem.style.top = y+'px';
					elem.style.width = grid_width+'px';
					elem.style.zIndex = '200';
					document.body.appendChild(elem);
					lines.push(elem);
				}
				// and guides
				for (var i in guides_x) {
					var elem = document.createElement('div');
					elem.classList.add('glue-guide-x');
					elem.classList.add('glue-guide');
					elem.classList.add('glue-ui');
					// use a different color than background and grid lines
					elem.style.backgroundColor = $.glue.color.average($.glue.color.complementary(bg_color), bg_color);
					elem.style.height = grid_height+'px';
					elem.style.left = guides_x[i]+'px';
					elem.style.position = 'absolute';
					elem.style.top = '0px';
					elem.style.width = '1px';
					elem.style.zIndex = '200';
					document.body.appendChild(elem);
					guides.push(elem);
				}
				for (var i in guides_y) {
					var elem = document.createElement('div');
					elem.classList.add('glue-guide-y');
					elem.classList.add('glue-guide');
					elem.classList.add('glue-ui');
					// use a different color than background and grid lines
					elem.style.backgroundColor = $.glue.color.average($.glue.color.complementary(bg_color), bg_color);
					elem.style.height = '1px';
					elem.style.left = '0px';
					elem.style.position = 'absolute';
					elem.style.top = guides_y[i]+'px';
					elem.style.width = grid_width+'px';
					elem.style.zIndex = '200';
					document.body.appendChild(elem);
					guides.push(elem);
				}
			}
		} else {
			remove();
		}
		// bits 1/2 (drag/resize snap-to-grid) are applied live by each
		// object's Moveable drag/resize handlers reading grid_mode()/x()/y()
		// directly, rather than through a widget option here
	};

	var remove = function() {
		// remove lines
		while (lines.length) {
			var line = lines.shift();
			line.remove();
		}
		// and guides
		while (guides.length) {
			var guide = guides.shift();
			guide.remove();
		}
		grid_height = false;
		grid_width = false;
	};

	return {
		add_guide_x: function(y) {
			guides_x.push(y);
		},
		add_guide_y: function(x) {
			guides_y.push(x);
		},
		mode: function(val) {
			if (val === undefined) {
				return grid_mode;
			} else {
				grid_mode = val;
				// call update() to redraw
			}
		},
		update: function(force) {
			if (force !== undefined && force) {
				grid_height = false;
				grid_width = false;
			}
			draw();
		},
		x: function(val) {
			if (val === undefined) {
				return grid_x;
			} else {
				grid_x = val;
				// call update() to redraw
			}
		},
		y: function(val) {
			if (val === undefined) {
				return grid_y;
			} else {
				grid_y = val;
				// call update() to redraw
			}
		}
	};
}();

$.glue.menu = function()
{
	var default_prio = 10;
	var cur = false;
	var m = {};
	var prev_menu = '';
	var spawn_coords = false;

	var close_menu = function(e) {
		// close menu when clicking outside of an ui element
		if (!e.target.classList.contains('glue-ui') && !e.target.closest('.glue-ui')) {
			// this also unregisters the event
			// when we close a menu like this we want to keep the name of the
			// previous menu, hence false
			$.glue.menu.hide(false);
		}
	};

	$.glue.live('.object', 'glue-select', function(e) {
		// hide any menu when an object gets selected
		if (cur) {
			$.glue.menu.hide();
		}
	});

	return {
		// hide any currently shown menus
		hide: function(reset_prev_menu) {
			// reset the previous menu, so we can launch the same menu immediately
			// for almost all callers (except close_menu above)
			if (reset_prev_menu === undefined || reset_prev_menu) {
				prev_menu = '';
			}
			if (cur) {
				for (var i=0; i < cur.length; i++) {
					$.glue.trigger(cur[i].elem, 'glue-menu-deactivate');
					cur[i].elem.remove();
				}
				cur = false;
			}
			document.body.removeEventListener('click', close_menu);
		},
		// return whether or not a menu is shown
		// menu .. menu name (if undefined, any menu)
		is_shown: function(menu) {
			if (menu === undefined) {
				if (cur) {
					return true;
				} else {
					return false;
				}
			} else {
				if (m[menu] && m[menu] == cur) {
					return true;
				} else {
					return false;
				}
			}
		},
		prev_menu: function() {
			var ret = prev_menu;
			prev_menu = '';
			return ret;
		},
		// register a menu item
		// menu .. menu name
		// elem .. element to add
		// prio .. priority (ascending) - optional
		register: function(menu, elem, prio) {
			if (!m[menu]) {
				m[menu] = [];
			}
			if (prio === undefined) {
				prio = default_prio;
			}
			// add sorted by prio ascending
			var added = false;
			for (var i=0; i < m[menu].length; i++) {
				if (prio < m[menu][i].prio) {
					m[menu].splice(i, 0, { 'elem': elem, 'prio': prio });
					added = true;
					break;
				}
			}
			if (!added) {
				m[menu].push({ 'elem': elem, 'prio': prio });
			}
		},
		// show a menu
		// this also hides any currently shown menus
		// menu .. menu name
		// x, y .. window coordinates to launch the menu
		show: function(menu, x, y) {
			if (!m[menu]) {
				return false;
			}
			// hide any active menu
			if (cur) {
				$.glue.menu.hide();
			}
			// default x & y coordinates
			if (x === undefined) {
				x = window.innerWidth/2;
			}
			if (y === undefined) {
				y = window.innerHeight/2;
			}
			var max_w = 0;
			var max_h = 0;
			cur = m[menu];
			// add items to dom
			num_shown = 0;
			for (var i=0; i < cur.length; i++) {
				var elem = cur[i].elem;
				// set crucial css properties
				elem.classList.add('glue-menu-'+menu);
				elem.classList.add('glue-menu');
				elem.classList.add('glue-ui');
				elem.style.left = x+'px';
				elem.style.position = 'fixed';
				elem.style.top = y+'px';
				elem.style.visibility = 'hidden';
				elem.style.zIndex = '201';
				// add to dom
				document.body.appendChild(elem);
				// see the equivalent comment in $.glue.contextmenu.show()
				if (window.Alpine) {
					Alpine.initTree(elem);
				}
				// trigger event
				$.glue.trigger(elem, 'glue-menu-activate');
				// check if we still want to show the icon ;)
				if (getComputedStyle(elem).display == 'none') {
					continue;
				} else {
					num_shown++;
				}
				// calculate max width & height
				// make sure you specify the width & height attribute for images etc
				if (max_w < outer_width(elem, true)) {
					max_w = outer_width(elem, true);
				}
				if (max_h < outer_height(elem, true)) {
					max_h = outer_height(elem, true);
				}
			}
			// position items
			var num_rows = 1;
			while (num_rows*num_rows < num_shown) {
				num_rows++;
			}
			var num_cols = num_rows;
			if (num_shown <= num_rows*(num_rows-1)) {
				num_cols--;
			}
			var cur_row = 0;
			var cur_col = 0;
			for (var i=0; i < cur.length; i++) {
				var elem = cur[i].elem;
				// check if the icon is shown
				if (getComputedStyle(elem).display == 'none') {
					continue;
				}
				if (cur_col == num_cols) {
					cur_row++;
					cur_col = 0;
				}
				// make visible
				elem.style.opacity = '0.0';
				elem.style.visibility = '';
				(function(elem, target_left, target_top) {
					requestAnimationFrame(function() {
						elem.style.transition = 'left 200ms, top 200ms, opacity 200ms';
						requestAnimationFrame(function() {
							elem.style.left = target_left;
							elem.style.top = target_top;
							elem.style.opacity = '1.0';
						});
					});
				})(elem, (x-(num_rows*max_w)/2+cur_col*max_w)+'px', (y-(num_rows*max_h)/2+cur_row*max_h)+'px');
				cur_col++;
			}
			// register close menu event and set prev_menu
			document.body.addEventListener('click', close_menu);
			prev_menu = menu;
			// convert x, y to page and save them
			spawn_coords = {x: document.documentElement.scrollLeft+x, y: document.documentElement.scrollTop+y};
			return true;
		},
		spawn_coords: function() {
			return spawn_coords;
		}
	};
}();

// A modal dialog that is actually modal.
//
// Factored out because getting this right is not obvious and it was wrong the
// first time: the editor binds its shortcuts on documentElement and a dialog
// lives inside body, so without stopping propagation every keystroke typed into
// a dialog also drives the canvas behind it - Tab cycles through objects,
// Delete deletes one, arrows move it. On top of the editor is not the same as
// modal to it.
//
// open() returns { modal, close }: fill in modal, call close() when done.
$.glue.modal = function()
{
	return {
		// label ..	accessible name for the dialog
		// cls ..	optional extra class on the dialog box
		open: function(label, cls) {
			var previously_focused = document.activeElement;

			var backdrop = document.createElement('div');
			backdrop.className = 'glue-modal-backdrop glue-ui';
			var modal = document.createElement('div');
			modal.className = 'glue-modal'+(cls ? ' '+cls : '');
			modal.setAttribute('role', 'dialog');
			modal.setAttribute('aria-modal', 'true');
			modal.setAttribute('aria-label', label || 'dialog');
			// so focus has somewhere to go if every control is disabled
			modal.tabIndex = -1;

			function close() {
				backdrop.remove();
				if (previously_focused && document.contains(previously_focused)) {
					previously_focused.focus();
				}
			}

			// everything focusable inside, in tab order - disabled and hidden
			// controls skipped, so a disabled OK button is not a dead stop
			function focusable() {
				return Array.from(modal.querySelectorAll('input, button, select, textarea'))
					.filter(function(el) { return !el.disabled && el.offsetParent !== null; });
			}

			['keydown', 'keypress', 'keyup'].forEach(function(type) {
				backdrop.addEventListener(type, function(e) {
					e.stopPropagation();
				});
			});

			backdrop.addEventListener('keydown', function(e) {
				if (e.key == 'Escape') {
					close();
					return;
				}
				if (e.key != 'Tab') {
					return;
				}
				// keep Tab inside the dialog rather than letting the browser
				// walk focus out into the page behind it
				var items = focusable();
				if (!items.length) {
					e.preventDefault();
					return;
				}
				var first = items[0];
				var last = items[items.length-1];
				var at = document.activeElement;
				if (e.shiftKey && (at === first || !modal.contains(at))) {
					last.focus();
					e.preventDefault();
				} else if (!e.shiftKey && (at === last || !modal.contains(at))) {
					first.focus();
					e.preventDefault();
				}
			});

			backdrop.addEventListener('click', function(e) {
				if (e.target === backdrop) {
					close();
				}
			});

			backdrop.appendChild(modal);
			document.body.appendChild(backdrop);
			return { backdrop: backdrop, modal: modal, close: close };
		},
		// standard OK/Cancel row; extra buttons can be prepended by the caller
		buttons: function(modal, on_ok, on_cancel) {
			var row = document.createElement('div');
			row.className = 'glue-modal-buttons';
			var cancel = document.createElement('button');
			cancel.type = 'button';
			cancel.textContent = 'Cancel';
			cancel.addEventListener('click', on_cancel);
			var ok = document.createElement('button');
			ok.type = 'button';
			ok.textContent = 'OK';
			ok.addEventListener('click', on_ok);
			row.appendChild(cancel);
			row.appendChild(ok);
			modal.appendChild(row);
			return { row: row, ok: ok, cancel: cancel };
		}
	};
}();


$.glue.object = function()
{
	var alter_pre_save = {};
	var reg_objs = {};
	// keyed by raw DOM element rather than jQuery's .data(), since jQuery
	// 1.5.2's clone() (used by save() on every save) hangs when an element
	// carries a .data() entry pointing to a Moveable instance - its internal
	// object graph is large/circular enough to blow up clone()'s data-cache
	// fixup walk
	var moveables = new WeakMap();

	// Moveable's controls are 14px and centred on the edge they belong to
	// (margin: -7px), so half of each one lies over the object. HANDLE_OUT is
	// how far the centre has to move for the handle to clear the edge and
	// leave a 5px gap: "no menu or interface shall interfere with page
	// elements", the design codex.
	var HANDLE_HALF = 7;
	var HANDLE_OUT = 12;
	var HANDLE_DIRS = {
		n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0],
		ne: [1, -1], se: [1, 1], sw: [-1, 1], nw: [-1, -1]
	};

	// Pushes the resize handles outside the object, and keeps them there when
	// it is rotated.
	//
	// This cannot be a stylesheet. A control's margin shifts its box in the
	// control box's coordinates, which are screen-aligned; the rotate() that
	// Moveable puts in each control's own transform only spins the element in
	// place. So "push the east handle right" clears the right edge at 0° and
	// buries the handle INSIDE the object at 180°, where that edge is now on
	// the left - which is exactly what it did.
	//
	// The angle is read off the ELEMENT's own computed matrix - the same thing
	// Moveable reads to decide where to draw the handles, and true the moment
	// the element changes. Moveable's getRect() was the obvious source and is
	// the wrong one: its rect is cached and updateRect() only schedules a
	// recompute, so anything that changes an object and immediately replaces
	// its handles - an undo, most of all - measured the angle the object had
	// a moment ago and pinned the offsets to it. Reading the matrix also
	// covers a flipped object, whose matrix is a rotation as far as both this
	// and Moveable are concerned.
	// returns false when there is nothing to place yet, which is how the
	// retry below knows to come back
	var place_handles = function(obj) {
		var m = moveables.get(obj);
		if (!m || typeof m.getControlBoxElement != 'function') {
			return false;
		}
		var box = m.getControlBoxElement();
		if (!box) {
			return false;
		}
		// matrix(a, b, c, d, e, f): the first column is the x axis after the
		// transform, so its angle is the element's rotation
		var cos = 1;
		var sin = 0;
		var matrix = getComputedStyle(obj).transform;
		var parts = /^matrix\(([^)]+)\)$/.exec(matrix);
		if (parts) {
			var n = parts[1].split(',').map(parseFloat);
			var len = Math.sqrt(n[0]*n[0]+n[1]*n[1]);
			if (len) {
				cos = n[0]/len;
				sin = n[1]/len;
			}
		}
		var placed = 0;
		box.querySelectorAll('.moveable-control.moveable-direction').forEach(function(el) {
			var dir = (el.className.match(/moveable-(nw|ne|sw|se|n|e|s|w)(?:\s|$)/) || [])[1];
			var v = HANDLE_DIRS[dir];
			if (!v) {
				return;
			}
			// the outward direction, turned with the object. Set as
			// important: css/edit.css has to mark the straight-on case
			// important to outrank Moveable's own stylesheet, and an
			// ordinary inline style would lose to it
			el.style.setProperty('margin-left',
				(-HANDLE_HALF+(v[0]*cos-v[1]*sin)*HANDLE_OUT)+'px', 'important');
			el.style.setProperty('margin-top',
				(-HANDLE_HALF+(v[0]*sin+v[1]*cos)*HANDLE_OUT)+'px', 'important');
			placed++;
		});
		return 0 < placed;
	};

	// Switching resizable on schedules a render; the controls do not exist
	// until it lands, and Moveable has no event for "the control box now
	// exists". So try, and keep trying for a few frames until they turn up.
	var place_handles_soon = function(obj) {
		var tries = 0;
		var tick = function() {
			if (place_handles(obj) || 10 < ++tries) {
				return;
			}
			requestAnimationFrame(tick);
		};
		tick();
	};

	// only show resize handles while an object is selected, not permanently
	$.glue.live('.object', 'glue-select', function(e) {
		var m = moveables.get(this);
		if (m && this.classList.contains('resizable') && !this.classList.contains('locked')) {
			var obj = this;
			m.resizable = true;
			// the controls are (re)created by that assignment, so the offsets
			// go on once the render it schedules has landed
			m.updateRect();
			place_handles_soon(obj);
		}
	});
	$.glue.live('.object', 'glue-deselect', function(e) {
		var m = moveables.get(this);
		if (m) {
			m.resizable = false;
		}
	});

	document.addEventListener('DOMContentLoaded', function() {
		// A selected object is stored without the class that says so. There
		// used to be a coordinate fixup here too, undoing the half-border
		// shift select() applied; the selection is an outline now, which is
		// not part of the box, so there is nothing to undo.
		$.glue.object.register_alter_pre_save('glue-selected', function(obj, orig) {
			obj.classList.remove('glue-selected');
		});
	});

	return {
		// obj .. element
		register: function(obj) {
			// prevent double registration
			if (reg_objs[obj.id]) {
				return false;
			} else {
				reg_objs[obj.id] = true;
			}
			// make sure everything has a z-index
			if (isNaN(parseInt(getComputedStyle(obj).zIndex))) {
				obj.style.zIndex = $.glue.stack.default_z();
			}

			var can_resize = obj.classList.contains('resizable');
			var m = new Moveable(document.body, {
				target: obj,
				container: document.body,
				draggable: true,
				// Chrome touches are handed back in the dragStart listener
				// below, not through an onDragStart OPTION - see the
				// comment there for why the option cannot work.
				// resize handles are only shown once the object is selected
				// (see the glue-select/glue-deselect handlers below)
				resizable: false,
				// jQuery UI's resizable() only exposed e/s/se handles by default
				renderDirections: can_resize ? ['e', 's', 'se'] : [],
				keepRatio: false,
				edge: false,
				origin: false,
				// mirror jQuery UI draggable's implicit viewport-edge auto-scroll
				scrollable: true,
				// document.body, NOT documentElement. Moveable decides the
				// pointer is near an edge by comparing it against the scroll
				// container's box, captured at drag start, and it special-cases
				// body to mean the VIEWPORT (js/moveable.js:4064) while every
				// other element is measured with getBoundingClientRect().
				// documentElement's box is the viewport WIDTH but the full
				// document HEIGHT - measured 1280x2624 against a 1280x720
				// viewport - so its bottom edge sits far below the fold and the
				// threshold could never be reached downwards. Horizontal
				// auto-scroll worked and vertical silently did not.
				scrollContainer: document.body,
				// body.scrollTop is 0 in standards mode (the viewport's scroll
				// lives on the window), so the offsets Moveable diffs to detect
				// that a scroll happened have to be read from the window.
				getScrollPosition: function() {
					return [window.scrollX, window.scrollY];
				},
				scrollThreshold: 40,
				scrollThrottleTime: 30,
				// Moveable's gesture layer calls preventDefault() on
				// touchstart by default, which stops the browser synthesising
				// the click that follows a tap - and a tap that produces no
				// click is a tap that cannot select an object, open its menu,
				// or (a second tap later) start editing its text. The whole
				// editor was unreachable on a phone for want of this.
				//
				// Nothing needs it on the mouse side: the editor already
				// preventDefaults mousedown itself, further down this file,
				// to stop a drag turning into a text selection.
				preventDefault: false,
				// with the click let through, a DRAG would end in one too -
				// selecting or deselecting whatever it finished over. This
				// suppresses the click only when a drag actually happened.
				preventClickEventOnDrag: true
			});
			moveables.set(obj, m);
			// Moveable's control box (drag/resize handles) stays
			// visibility:hidden - and thus unclickable - until a second
			// internal render pass completes; without user interaction that
			// never happens on its own, so it's kicked off explicitly here
			m.updateRect();

			// jQuery UI's draggable had a 10px distance threshold before a
			// mousedown turned into an actual drag (so a plain click doesn't
			// nudge the object) - Moveable has no equivalent, so it is
			// hand-rolled here
			var drag_started = false;
			var drag_axis = false;				// false, 'x' or 'y'
			var drag_orig_left = 0;
			var drag_orig_top = 0;
			var drag_mouse_start_x = 0;
			var drag_mouse_start_y = 0;
			var drag_multi_prev_left = 0;
			var drag_multi_prev_top = 0;

			m.on('dragStart', function(e) {
				// A finger on editor chrome - a context menu button, a
				// panel, a popover - reaches the gesture layer through the
				// container, unlike a mousedown which it only hears from
				// the target itself. Without this the touch drags the
				// object underneath the chrome in parallel, the
				// glue-movestart that fires hides the context menus, and
				// the control under the finger loses its save. Handing
				// the gesture back leaves the touch with the control that
				// actually got it.
				//
				// This used to be the onDragStart OPTION, and it was dead
				// code: MoveableManager spreads its own events wiring over
				// the options when it constructs (js/moveable.js), so
				// props.onDragStart is the internal "re-emit dragStart"
				// wrapper, never this function, and the drag went ahead
				// regardless. This listener is on the live path - the
				// wrapper re-emits dragStart into it - and stopping the
				// event is what actually aborts the drag (emit returns
				// !isStop, which is what dragStart checks).
				var t = e.inputEvent && e.inputEvent.target;
				if (t && t.closest && t.closest(
					'.glue-contextmenu-left, .glue-contextmenu-top, ' +
					'.glue-menu, .glue-popover')) {
					e.stop();
					return;
				}
				drag_started = false;
				drag_axis = false;
				drag_orig_left = obj.offsetLeft;
				drag_orig_top = obj.offsetTop;
				drag_mouse_start_x = e.clientX;
				drag_mouse_start_y = e.clientY;
			}).on('drag', function(e) {
				if (!drag_started) {
					if (Math.max(Math.abs(e.clientX-drag_mouse_start_x), Math.abs(e.clientY-drag_mouse_start_y)) < 10) {
						return;
					}
					drag_started = true;
					// Dragging an object selects it, which is what it always
					// did - by way of the click that used to follow the
					// mouseup. That click is suppressed now
					// (preventClickEventOnDrag, so a drag does not also
					// toggle whatever it finished over), so the selection has
					// to be said out loud. A group drag is left alone: the
					// object is already in the selection, and selecting it
					// again would collapse the rest.
					if (!obj.classList.contains('glue-selected')) {
						$.glue.sel.none();
						$.glue.sel.select(obj);
					}
					if (document.querySelectorAll('.glue-selected').length > 1 && obj.classList.contains('glue-selected')) {
						drag_multi_prev_left = drag_orig_left;
						drag_multi_prev_top = drag_orig_top;
						$.glue.trigger('.glue-selected', 'glue-movestart');
					} else {
						$.glue.trigger(obj, 'glue-movestart');
					}
				}

				var left = e.left;
				var top = e.top;

				// constrain to axis when dragging with shift key pressed
				if (e.inputEvent.shiftKey) {
					if (!drag_axis) {
						drag_axis = Math.abs(e.clientX-drag_mouse_start_x) < Math.abs(e.clientY-drag_mouse_start_y) ? 'y' : 'x';
					} else {
						var diff = Math.abs(Math.abs(e.clientX-drag_mouse_start_x)-Math.abs(e.clientY-drag_mouse_start_y));
						if (50 < diff) {
							drag_axis = Math.abs(e.clientX-drag_mouse_start_x) < Math.abs(e.clientY-drag_mouse_start_y) ? 'y' : 'x';
						}
					}
					if (drag_axis == 'x') {
						top = drag_orig_top;
					} else {
						left = drag_orig_left;
					}
				} else {
					drag_axis = false;
				}

				// ignore grid when ctrl is pressed
				if (!e.inputEvent.ctrlKey && ($.glue.grid.mode() & 2)) {
					left = Math.round(left/$.glue.grid.x())*$.glue.grid.x();
					top = Math.round(top/$.glue.grid.y())*$.glue.grid.y();
				}

				obj.style.left = left+'px';
				obj.style.top = top+'px';

				if (document.querySelectorAll('.glue-selected').length > 1 && obj.classList.contains('glue-selected')) {
					// dragging multiple selected objects
					var delta_left = left-drag_multi_prev_left;
					var delta_top = top-drag_multi_prev_top;
					Array.from(document.querySelectorAll('.glue-selected')).filter(function(el) { return el !== obj; }).forEach(function(el) {
						el.style.left = (el.offsetLeft+delta_left)+'px';
						el.style.top = (el.offsetTop+delta_top)+'px';
					});
					drag_multi_prev_left = left;
					drag_multi_prev_top = top;
				}
			}).on('dragEnd', function(e) {
				if (!drag_started) {
					return;
				}
				$.glue.undo.begin_batch();
				if (document.querySelectorAll('.glue-selected').length > 1 && obj.classList.contains('glue-selected')) {
					$.glue.trigger('.glue-selected', 'glue-movestop');
				} else {
					$.glue.trigger(obj, 'glue-movestop');
				}
				$.glue.undo.end_batch();
			}).on('scroll', function(e) {
				// the window, not e.scrollContainer: body is the container by
				// name only - it does not scroll, the viewport does
				window.scrollBy(e.direction[0]*15, e.direction[1]*15);
			});

			if (can_resize) {
				var resize_orig_aspect = 1;

				m.on('resizeStart', function(e) {
					resize_orig_aspect = obj.offsetWidth/obj.offsetHeight;
					$.glue.trigger(obj, 'glue-resizestart');
				}).on('resize', function(e) {
					var width = e.width;
					var height = e.height;
					// shift: keep the aspect ratio the object had when the
					// resize started. e/s/se are the only handles in use
					// (renderDirections above), and none of them move the
					// top-left anchor, so it's enough to just adjust
					// whichever dimension the handle doesn't already drive
					if (e.inputEvent.shiftKey) {
						if (e.direction[0] != 0 && e.direction[1] != 0) {
							// corner handle: let whichever dimension moved
							// more this frame drive the other
							if (Math.abs(width-obj.offsetWidth) > Math.abs(height-obj.offsetHeight)) {
								height = width/resize_orig_aspect;
							} else {
								width = height*resize_orig_aspect;
							}
						} else if (e.direction[0] != 0) {
							height = width/resize_orig_aspect;
						} else if (e.direction[1] != 0) {
							width = height*resize_orig_aspect;
						}
					}
					// ignore grid when ctrl is pressed
					if (!e.inputEvent.ctrlKey && ($.glue.grid.mode() & 4)) {
						width = Math.round(width/$.glue.grid.x())*$.glue.grid.x();
						height = Math.round(height/$.glue.grid.y())*$.glue.grid.y();
					}
					obj.style.width = width+'px';
					obj.style.height = height+'px';
					obj.style.left = e.drag.left+'px';
					obj.style.top = e.drag.top+'px';
					$.glue.trigger(obj, 'glue-resize');
				}).on('resizeEnd', function(e) {
					$.glue.object.save(obj);
					$.glue.trigger(obj, 'glue-resizestop');
					$.glue.canvas.update(obj);
					// the object is a different shape now, so the menu around
					// it is in the wrong place until it is told
					$.glue.contextmenu.reposition();
				});
			}

			$.glue.trigger(obj, 'glue-register');
			$.glue.canvas.update(obj);
		},
		register_alter_pre_save: function(cls, func) {
			alter_pre_save[cls] = func;
		},
		resizable_update_tooltip: function(obj) {
			// no-op: Moveable's resize handles are separate overlay elements
			// (not children of obj), so there is nothing to attach a title
			// to. Kept for backward compatibility with existing callers.
		},
		// serializes obj to the on-disk storage format, without sending it
		// anywhere - factored out of save() so other callers (e.g. the undo
		// stack, capturing state before a delete) can get the exact same
		// normalized HTML save() would have sent
		to_html: function(obj) {
			var elem = obj.cloneNode(true);
			var elem_cls = Array.from(elem.classList);
			for (var i=0; i < elem_cls.length; i++) {
				if (typeof alter_pre_save[elem_cls[i]] == 'function') {
					alter_pre_save[elem_cls[i]](elem, obj);
				}
			}
			// trim element content
			// necessary, otherwise we'd be sending \n\t back again
			elem.innerHTML = elem.innerHTML.trim();
			return elem.outerHTML;
		},
		save: function(obj) {
			var html = $.glue.object.to_html(obj);
			// DEBUG
			//console.log(html);
			$.glue.undo.capture(obj, html);
			$.glue.backend({ method: 'glue.save_state', 'html': html });
		},
		// obj .. element
		// see place_handles above: called by whatever changes an object's
		// rotation, since the offsets that keep the handles outside it are
		// direction-dependent
		place_handles: place_handles,
		// returns the Moveable instance managing obj's drag/resize, or
		// undefined - used by modules (e.g. lock.js) that need to toggle
		// draggable/resizable directly
		moveable_of: function(obj) {
			return moveables.get(obj);
		},
		unregister: function(obj) {
			var m = moveables.get(obj);
			if (m) {
				m.destroy();
				moveables.delete(obj);
			}
			// Clear the double-registration guard too, or the pair does not
			// round-trip: register() would see the id still marked, return
			// early, and leave the object with no Moveable at all - silently
			// undraggable and unresizable until the page is reloaded.
			delete reg_objs[obj.id];
			$.glue.trigger(obj, 'glue-unregister');
			// can't update canvas here as object to be deleted is still in the
			// dom
		}
	};
}();

// a lightweight, purely client-side undo/redo stack - in-memory only,
// cleared on reload, capped to a few levels. Replaces the old server-side
// auto-snapshot system (periodic full-page backups browsable/revertable via
// a dedicated UI), which was real disk/complexity overhead for what wasn't
// actually an undo feature (Ctrl+Z just redirected to it with a confirm()
// nudge).
//
// design: a single generic capture point in $.glue.object.save() covers
// move/resize/z-order/property-toggles (anything that calls save()) for
// free - a WeakMap tracks each object's last-saved html, so the first save
// for a given object is classified 'create', every later one 'update' with
// the *previous* html as the undo target. Delete has its own capture call
// (the object stops existing, so there's no "next save" to diff against).
//
// redo: every restore (whether undoing or redoing) computes its own inverse
// from whatever is currently live right before it acts, and pushes that
// inverse onto the *other* stack - so redoing an undo, undoing a redo, etc.
// all just work by always reversing from current state rather than reusing
// stale captured data. Any genuine new action (capture()/capture_delete())
// clears the redo stack, same as any standard undo/redo implementation.
$.glue.undo = function()
{
	var MAX_DEPTH = 20;
	var stack = [];
	var redo_stack = [];
	var last_html = new WeakMap();
	var restoring = false;
	var batch_depth = 0;
	var current_batch = null;

	function push_to(target, entry) {
		target.push(entry);
		if (MAX_DEPTH < target.length) {
			target.shift();
		}
	}

	function push(entry) {
		if (restoring) {
			return;
		}
		redo_stack = [];
		if (0 < batch_depth) {
			current_batch.push(entry);
			return;
		}
		push_to(stack, entry);
	}

	// the html captured by to_html()/save() is the on-disk STORAGE format,
	// not necessarily the live-DOM format - some modules strip presentation-
	// only children before saving (e.g. text's alter_pre_save removes its
	// .glue-text-input/.glue-text-render, which the server-side render adds
	// back). So restoring must go through the same glue.render_object() call
	// every normal page load uses, not reuse the stored snapshot as DOM
	// content directly.
	function apply_rendered(live, rendered_html) {
		var tmpl = document.createElement('template');
		tmpl.innerHTML = (rendered_html || '').trim();
		var fresh = tmpl.content.firstElementChild;
		if (!fresh) {
			return;
		}
		// mutate the live node in place (attributes + content) rather than
		// replacing it, so Moveable's bound target and delegated event
		// matching (both keyed on the actual DOM node/id) stay intact
		Array.from(live.attributes).forEach(function(a) { live.removeAttribute(a.name); });
		Array.from(fresh.attributes).forEach(function(a) { live.setAttribute(a.name, a.value); });
		live.innerHTML = fresh.innerHTML;
	}

	// The object has just been put back at whatever size, place and angle it
	// had, so the chrome drawn AROUND it is describing the object as it was a
	// moment ago: Moveable's box and handles come from its own cached rect,
	// and the context menu is placed around the object's visual box. Neither
	// is told by anything else.
	//
	// Called from the render callback rather than from step(), because the
	// restore goes through glue.render_object - by the time step() returns,
	// the DOM has not changed yet, and measuring then reads the old object.
	function refresh_chrome(live) {
		var m = $.glue.object.moveable_of(live);
		if (m) {
			m.updateRect();
		}
		$.glue.object.place_handles(live);
		$.glue.contextmenu.reposition();
	}

	function render_and_apply(id, live, is_new) {
		$.glue.backend({ method: 'glue.render_object', name: id, edit: true }, function(data) {
			if (!data || data['#error']) {
				return;
			}
			apply_rendered(live, data['#data']);
			if (is_new) {
				$.glue.object.register(live);
			}
			last_html.set(live, $.glue.object.to_html(live));
			$.glue.canvas.update(live);
			refresh_chrome(live);
		}, false);
	}

	// applies action `a`, appending its inverse to `inverse_out` - used for
	// both undo and redo, since reversing either direction works the same
	// way (capture current state, then overwrite it)
	function restore_one(a, inverse_out) {
		if (a.type == 'create') {
			var el = document.getElementById(a.id);
			if (!el) {
				return;
			}
			inverse_out.push({ type: 'delete', id: a.id, html: $.glue.object.to_html(el) });
			$.glue.object.unregister(el);
			el.remove();
			$.glue.canvas.update();
			$.glue.backend({ method: 'glue.delete_object', name: a.id });
			last_html.delete(el);
		} else if (a.type == 'update') {
			var el = document.getElementById(a.id);
			if (!el) {
				// object was later deleted - can't restore an update onto
				// nothing, this is expected for "a few levels", not an error
				return;
			}
			inverse_out.push({ type: 'update', id: a.id, before: $.glue.object.to_html(el) });
			$.glue.backend({ method: 'glue.save_state', html: a.before }, function(data) {
				if (!data || data['#error']) {
					return;
				}
				render_and_apply(a.id, el, false);
			}, false);
		} else if (a.type == 'delete') {
			inverse_out.push({ type: 'create', id: a.id });
			// the object's file was unlinked by delete_object() - glue.
			// save_state requires the object to already exist, so recreate
			// the (empty) file first via glue.save_object (no such
			// precondition), then populate it the normal way
			$.glue.backend({ method: 'glue.save_object', name: a.id }, function(data) {
				if (!data || data['#error']) {
					return;
				}
				$.glue.backend({ method: 'glue.save_state', html: a.html }, function(data2) {
					if (!data2 || data2['#error']) {
						return;
					}
					var el = document.createElement('div');
					el.id = a.id;
					el.style.position = 'absolute';
					document.body.appendChild(el);
					render_and_apply(a.id, el, true);
				}, false);
			}, false);
		}
	}

	// pops the most recent entry off `from`, replays it, and pushes its
	// inverse onto `to` - `reverse_order` true replays a batch last-action-
	// first (undo's direction), false replays first-action-first (redo's
	// direction, reproducing the original gesture order)
	function step(from, to, reverse_order) {
		var entry = from.pop();
		if (!entry) {
			return;
		}
		var actions = entry.batch ? entry.batch : [entry];
		var inverses = [];
		restoring = true;
		if (reverse_order) {
			for (var i = actions.length-1; 0 <= i; i--) {
				restore_one(actions[i], inverses);
			}
			inverses.reverse();
		} else {
			for (var i = 0; i < actions.length; i++) {
				restore_one(actions[i], inverses);
			}
		}
		restoring = false;
		if (inverses.length) {
			push_to(to, entry.batch ? { batch: inverses } : inverses[0]);
		}
	}

	return {
		begin_batch: function() {
			if (batch_depth++ === 0) {
				current_batch = [];
			}
		},
		end_batch: function() {
			if (--batch_depth === 0) {
				if (current_batch.length) {
					push_to(stack, { batch: current_batch });
				}
				current_batch = null;
			}
		},
		// establishes a baseline for an object that already existed when the
		// page loaded (never went through save() this session) - without
		// this, that object's first edit would have no "previous html" to
		// diff against and would be wrongly classified as 'create' by
		// capture() below, making undo DELETE it instead of reverting the edit
		seed: function(obj, html) {
			last_html.set(obj, html);
		},
		// called from $.glue.object.save() - classifies as create (first
		// save ever seen for this object) or update (with the previous html
		// as the undo target)
		capture: function(obj, html) {
			if (restoring) {
				return;
			}
			var prev = last_html.get(obj);
			if (prev === undefined) {
				push({ type: 'create', id: obj.id });
			} else {
				push({ type: 'update', id: obj.id, before: prev });
			}
			last_html.set(obj, html);
		},
		// called before a delete removes the object from the dom
		capture_delete: function(obj, html) {
			if (restoring) {
				return;
			}
			push({ type: 'delete', id: obj.id, html: html });
			last_html.delete(obj);
		},
		undo: function() {
			step(stack, redo_stack, true);
		},
		redo: function() {
			step(redo_stack, stack, false);
		}
	};
}();

document.addEventListener('DOMContentLoaded', function() {
	// visible "Undo" entry in the single-click ("new") menu, not just the
	// Ctrl+Z shortcut
	var elem = $.glue.icon('undo', 'undo the last change');
	elem.addEventListener('click', function(e) {
		$.glue.menu.hide();
		$.glue.undo.undo();
	});
	$.glue.menu.register('new', elem, 20);

	// visible "Redo" entry, next to Undo
	var redo_elem = $.glue.icon('redo', 'redo the last undone change');
	redo_elem.addEventListener('click', function(e) {
		$.glue.menu.hide();
		$.glue.undo.redo();
	});
	$.glue.menu.register('new', redo_elem, 21);
});

$.glue.sel = function()
{
	var key_moving = false;

	// this could probably also be body
	document.documentElement.addEventListener('click', function(e) {
		if (e.target == document.body) {
			if (document.querySelectorAll('.glue-selected').length) {
				// deselect when clicking on background
				$.glue.sel.none();
				// prevent the menu from firing
				e.stopImmediatePropagation();
			}
		}
	});

	// Keys typed into a form field belong to that field, not to the canvas.
	// The two listeners below act on the SELECTION - tab cycles objects, the
	// arrows nudge them, ctrl+a selects all of them, delete deletes them -
	// and none of that should happen while someone is typing a url into the
	// link panel or a number into the font panel. Ctrl+Z had its own version
	// of this check because undo was the case someone hit; the rest were just
	// as wrong and nobody had tried them from a field yet.
	//
	// The two editing surfaces solved this for themselves years ago by
	// stopping propagation (the textarea, and modules/text/text-edit.js:245
	// for the contenteditable render). That works for a whole surface; it
	// does not help the editor's own inputs, which are scattered across
	// panels and dialogs. contenteditable is still listed here so the render
	// is covered either way.
	var typing_in_a_field = function(e) {
		return !!(e.target && e.target.closest && e.target.closest(
			'input, textarea, select, [contenteditable=""], [contenteditable="true"]'));
	};

	document.documentElement.addEventListener('keydown', function(e) {
		if (typing_in_a_field(e)) {
			return;
		}
		if (e.which == 9) {
			// cycle through all objects with tab key
			if (document.querySelectorAll('.glue-selected').length < 2) {
				var next = false;
				var selectedEls = document.querySelectorAll('.glue-selected');
				if (selectedEls.length == 1) {
					var candidate = selectedEls[0].nextElementSibling;
					if (candidate && candidate.classList.contains('object')) {
						next = candidate;
					}
				}
				if (!next) {
					next = document.querySelector('.object');
				}
				if (next) {
					$.glue.sel.none();
					$.glue.sel.select(next);
					// scroll to the selected objects if not currently visible
					var window_min_x = document.documentElement.scrollLeft;
					var window_max_x = window_min_x+window.innerWidth;
					var window_min_y = document.documentElement.scrollTop;
					var window_max_y = window_min_y+window.innerHeight;
					var h = outer_height(next);
					var o = $.glue.canvas.origin();
					var p = { left: next.offsetLeft+o.x, top: next.offsetTop+o.y };
					var w = outer_width(next);
					// fit the entire object on the screen
					// TODO (later): scroll a bit more up/left for the any
					// context menu to fit in there too
					if (p.left < window_min_x) {
						document.documentElement.scrollLeft = p.left;
					} else if (window_max_x < p.left+w) {
						document.documentElement.scrollLeft = window_min_x+p.left+w-window_max_x;
					}
					if (p.top < window_min_y) {
						document.documentElement.scrollTop = p.top;
					} else if (window_max_y < p.top+h) {
						document.documentElement.scrollTop = window_min_y+p.top+h-window_max_y;
					}
				}
			}
			e.preventDefault();
			return false;
		} else if (33 == e.which && e.shiftKey && document.querySelectorAll('.glue-selected').length) {
			// shift+pageup: move objects to top of stack
			// we can't use ctrl+page{up,down} as this cycles through tabs
			// only prevent scrolling here
			e.preventDefault();
			return false;
		} else if (34 == e.which && e.shiftKey && document.querySelectorAll('.glue-selected').length) {
			// shift+pagedown: move objects to bottom of stack
			e.preventDefault();
			return false;
		} else if (37 <= e.which && e.which <= 40 && document.querySelectorAll('.glue-selected').length) {
			// move selected elements with arrow keys
			var add_x = 0;
			var add_y = 0;
			if (e.which == 38) {
				add_y = -1;
			} else if (e.which == 39) {
				add_x = 1;
			} else if (e.which == 40) {
				add_y = 1;
			} else if (e.which == 37) {
				add_x = -1;
			}
			// shift multiplier
			if (e.shiftKey) {
				// this depends on the grid size
				add_x *= $.glue.grid.x();
				add_y *= $.glue.grid.y();
			}
			document.querySelectorAll('.glue-selected:not(.locked)').forEach(function(el) {
				// prevent elements from going completely offscreen
				if (1 < el.offsetLeft+add_x+el.offsetWidth) {
					el.style.left = (el.offsetLeft+add_x)+'px';
				}
				if (1 < el.offsetTop+add_y+el.offsetHeight) {
					el.style.top = (el.offsetTop+add_y)+'px';
				}
			});
			// scroll window if neccessary
			// TODO (later): implement for moving multiple objects
			if (document.querySelectorAll('.glue-selected').length == 1) {
				var window_min_x = document.documentElement.scrollLeft;
				var window_max_x = window_min_x+window.innerWidth;
				var window_min_y = document.documentElement.scrollTop;
				var window_max_y = window_min_y+window.innerHeight;
				var elem = document.querySelector('.glue-selected');
				var o = $.glue.canvas.origin();
				var p = { left: elem.offsetLeft+o.x, top: elem.offsetTop+o.y };
				var w = outer_width(elem);
				var h = outer_height(elem);
				if (p.left < window_min_x) {
					document.documentElement.scrollLeft = p.left;
				} else if (window_max_x < p.left+w) {
					document.documentElement.scrollLeft = p.left+w;
				}
				if (p.top < window_min_y) {
					document.documentElement.scrollTop = p.top;
				} else if (window_max_y < p.top+h) {
					document.documentElement.scrollTop = p.top+h;
				}
			}
			// trigger event (once, cleared in keyup)
			if (!key_moving) {
				$.glue.trigger('.glue-selected:not(.locked)', 'glue-movestart');
				key_moving = true;
			}
			// prevent window scrolling
			e.preventDefault();
			return false;
		} else if (e.ctrlKey && e.which == 65) {
			// select all objects not locked objects
			// selected locked objects will be unselected
			document.querySelectorAll('.object:not(.glue-selected):not(.locked)').forEach(function(el) {
				$.glue.sel.select(el);
			});
			// exclude locked objects from selection
			document.querySelectorAll('.locked.glue-selected').forEach(function(el) {
				$.glue.sel.deselect(el);
			});
			e.preventDefault();
			return false;
		} else if (e.ctrlKey && e.which == 68) {
			// select none
			$.glue.sel.none();
			e.preventDefault();
			return false;
		} else if (e.ctrlKey && e.which == 73) {
			// invert selection
			var next = document.querySelectorAll('.object:not(.glue-selected):not(.locked)');
			$.glue.sel.none();
			next.forEach(function(el) {
				$.glue.sel.select(el);
			});
			e.preventDefault();
			return false;
		} else {
			// DEBUG
			//console.log('html keydown '+e.which);
		}
	});

	document.documentElement.addEventListener('keyup', function(e) {
		// same as above - and this is the listener that matters most, since
		// DELETE is handled here: pressing it while clearing a url field took
		// the object with it
		if (typing_in_a_field(e)) {
			return;
		}
		if (33 == e.which && e.shiftKey && document.querySelectorAll('.glue-selected').length) {
			// shift+pageup: move objects to top of stack
			$.glue.undo.begin_batch();
			document.querySelectorAll('.glue-selected:not(.locked)').forEach(function(el) {
				$.glue.stack.to_top(el);
				$.glue.object.save(el);
			});
			$.glue.stack.compress();
			$.glue.undo.end_batch();
			e.preventDefault();
			return false;
		} else if (34 == e.which && e.shiftKey && document.querySelectorAll('.glue-selected').length) {
			// shift+pagedown: move objects to bottom of stack
			$.glue.undo.begin_batch();
			document.querySelectorAll('.glue-selected:not(.locked)').forEach(function(el) {
				$.glue.stack.to_bottom(el);
				$.glue.object.save(el);
			});
			$.glue.stack.compress();
			$.glue.undo.end_batch();
			e.preventDefault();
			return false;
		} else if (37 <= e.which && e.which <= 40 && document.querySelectorAll('.glue-selected').length) {
			// move selected elements with arrow keys
			$.glue.undo.begin_batch();
			$.glue.trigger('.glue-selected:not(.locked)', 'glue-movestop');
			$.glue.undo.end_batch();
			key_moving = false;
			e.preventDefault();
			return false;
		} else if (e.which == 46 && document.querySelectorAll('.glue-selected').length) {
			// delete selected objects
			// this is pretty much copied from object-edit.js
			var objs = document.querySelectorAll('.glue-selected:not(.locked)');
			$.glue.undo.begin_batch();
			objs.forEach(function(el) {
				var id = el.id;
				$.glue.undo.capture_delete(el, $.glue.object.to_html(el));
				$.glue.object.unregister(el);
				el.remove();
				// delete in backend as well
				$.glue.backend({ method: 'glue.delete_object', name: id });
				// update canvas
				$.glue.canvas.update();
			});
			$.glue.undo.end_batch();
			e.preventDefault();
			return false;
		} else {
			// DEBUG
			//console.log('html keydown '+e.which);
		}
	});

	// note: drag/resize (including axis-constrain, grid-snap, and
	// multi-select sync) are wired up per-object in $.glue.object.register()
	// via Moveable's dragStart/drag/dragEnd instead of delegated handlers
	// here, since Moveable doesn't emit jQuery-style 'drag'/'dragstart' DOM
	// events the way jQuery UI's draggable() did

	$.glue.live('.object', 'click', function(e) {
		// TODO (later): moving objects after shift clicking on them does not seem to work right on Chrome, document and fill a bug upstream
		if (!e.shiftKey && !this.classList.contains('glue-selected')) {
			$.glue.sel.none();
		}
		if (e.shiftKey && this.classList.contains('glue-selected')) {
			$.glue.sel.deselect(this);
		}
		// shift clicking involving locked object will result in no action
		else if (e.shiftKey && this.classList.contains('locked') || document.querySelector('.glue-selected.locked')) {
			return;
		} else {
			$.glue.sel.select(this);
		}

	});

	$.glue.live('.object', 'glue-movestop', function(e) {
		// update tooltip
		$.glue.object.resizable_update_tooltip(this);
		// save object
		$.glue.object.save(this);
		// update canvas
		$.glue.canvas.update(this);
	});

	$.glue.live('.object', 'glue-unregister', function(e) {
		$.glue.sel.deselect(this);
	});

	return {
		// deselect an object
		// obj .. element
		deselect: function(obj) {
			if (obj.classList.contains('glue-selected')) {
				obj.classList.remove('glue-selected');
				$.glue.trigger(obj, 'glue-deselect');
			}
		},
		// select none
		none: function() {
			document.querySelectorAll('.glue-selected').forEach(function(el) {
				$.glue.sel.deselect(el);
			});
		},
		// select an object
		// obj .. element
		// Selecting an object no longer moves it. The selection used to be a
		// border, which is part of the box, so the object had to be shifted
		// by half of it to keep its content where it was - and put back on
		// deselect, and put back again before saving. It is an outline now
		// (see .glue-selected in css/edit.css), which changes no layout, so
		// all three of those fixups are gone. An object with a border of its
		// own also used to jump by half of ITS border, since the code
		// measured whatever border was there rather than the selection's.
		select: function(obj) {
			// TODO (later): handle more than one obj (and change callers)
			if (!obj.classList.contains('glue-selected')) {
				obj.classList.add('glue-selected');
				$.glue.trigger(obj, 'glue-select');
			}
		},
		// return if an object is selected
		// obj .. element
		selected: function(obj) {
			return obj.classList.contains('glue-selected');
		}
	};
}();

$.glue.slider = function()
{
	// The drag mechanics behind every drag-only control in the editor. It
	// used to listen for mousemove/mouseup, which touch never sends during a
	// drag, so the controls were dead on a phone. Pointer events cover both:
	// the browser reports them for mouse, touch and pen alike. The triggers
	// that start a drag set touch-action: none on themselves, or the browser
	// claims the gesture for scrolling and this gets a pointercancel instead
	// of a drag.
	return function(e, change, stop) {
		var old_e = e;
		var pointer_id = e.pointerId;	// ignore other fingers mid-gesture
		var last_dx = 0;
		var last_dy = 0;

		var pointermove = function(e) {
			if (e.pointerId !== pointer_id) {
				return;
			}
			last_dx = e.pageX-old_e.pageX;
			last_dy = e.pageY-old_e.pageY;
			if (typeof change == 'function') {
				change(last_dx, last_dy, e);
			}
			e.preventDefault();
		};
		var finish = function(e, dx, dy) {
			document.documentElement.removeEventListener('pointermove', pointermove);
			document.documentElement.removeEventListener('pointerup', pointerup);
			document.documentElement.removeEventListener('pointercancel', pointercancel);
			if (typeof stop == 'function') {
				stop(dx, dy, e);
			}
			e.preventDefault();
		};
		var pointerup = function(e) {
			if (e.pointerId !== pointer_id) {
				return;
			}
			var dx = e.pageX-old_e.pageX;
			var dy = e.pageY-old_e.pageY;
			// A throwing change() must not be able to orphan the drag: if the
			// exception escaped here, the listeners would stay attached and
			// stop() - which is where the drags save their work - would never
			// run, silently dropping the edit. The finally guarantees finish()
			// (and with it the save) while the exception still surfaces.
			try {
				if (typeof change == 'function') {
					change(dx, dy, e);
				}
			} finally {
				finish(e, dx, dy);
			}
		};
		// Some browsers report pageX/pageY as 0 on pointercancel, so the
		// gesture finishes with the last deltas actually seen rather than
		// a bogus jump back to the origin.
		var pointercancel = function(e) {
			if (e.pointerId !== pointer_id) {
				return;
			}
			finish(e, last_dx, last_dy);
		};
		document.documentElement.addEventListener('pointermove', pointermove);
		document.documentElement.addEventListener('pointerup', pointerup);
		document.documentElement.addEventListener('pointercancel', pointercancel);
	};
}();

// A VISIBLE range control for the menu buttons that change a number by being
// dragged. $.glue.slider() above is only the drag mechanics and draws
// nothing, so what the value is doing has to be inferred from the object
// changing under the pointer; this wraps it in the readout Superglue's editor
// has, so the value is something you can see.
//
// The bar is drawn AWAY from the object, along the axis of the menu the
// button sits in: a button in the left-hand column gets a horizontal bar
// running left, a button in the top row gets a vertical bar running up.
// contextmenu.show() puts those two menus on the object's left and top edges
// and marks their items .glue-contextmenu-left / -top, so following that
// class is what keeps the bar pointing out into empty canvas instead of lying
// across the object being edited.
//
// The handle tracks the pointer 1:1 - the full range spans TRACK px and the
// value comes from how far the pointer has moved since pointerdown - so it
// reads as a real slider even though the pointer starts on the button and
// never actually touches the bar.
$.glue.rangeslider = function()
{
	var TRACK = 200;	// px along the axis: the whole range spans this
	var GAP = 6;		// px between the button and the bar
	var DEAD = 3;		// px of movement before this counts as a drag at all

	return {
		// button .. the menu element to drive the value from
		// opts.min, opts.max .. ends of the range
		// opts.value() .. the value to open at, read at pointerdown
		// opts.change(v, ev) .. called live while dragging
		// opts.stop(v, moved, ev) .. called once on release. 'moved' is false
		//   for a press that never became a drag, which is how a button can
		//   be a slider and still do something else on a plain click
		// opts.snap .. step to snap to while shift is held
		// opts.wrap .. true to wrap around the ends instead of clamping, for
		//   a value that is cyclic (an angle) rather than bounded
		attach: function(button, opts) {
			var min = opts.min;
			var max = opts.max;
			var span = max-min;

			button.style.touchAction = 'none';
			button.addEventListener('pointerdown', function(e) {
				if (!e.isPrimary) {
					return;
				}
				// which way the menu this button is in runs
				// which way the menu this button is in runs
				var vertical = button.classList.contains('glue-contextmenu-top');
				var start = opts.value();
				var bar = false;
				var handle = false;
				var moved = false;
				var last = start;

				var value_at = function(dx, dy, ev) {
					// up and right increase, matching the bar as it is drawn
					var px = vertical ? -dy : dx;
					var v = start + px/TRACK*span;
					if (ev && ev.shiftKey && opts.snap) {
						v = Math.round(v/opts.snap)*opts.snap;
					}
					if (opts.wrap) {
						v = min + (((v-min) % span)+span) % span;
					} else {
						v = Math.max(min, Math.min(max, v));
					}
					return v;
				};

				var place = function(v) {
					var frac = (v-min)/span;
					if (frac < 0) {
						frac = 0;
					} else if (1 < frac) {
						frac = 1;
					}
					if (vertical) {
						handle.style.top = ((1-frac)*TRACK)+'px';
					} else {
						handle.style.left = (frac*TRACK)+'px';
					}
				};

				var show = function() {
					// The menu buttons are absolutely positioned in body, so
					// the bar is too, and the rect has to be put back into
					// page coordinates for that to line up once the page is
					// scrolled.
					var box = button.getBoundingClientRect();
					bar = document.createElement('div');
					bar.className = 'glue-slider glue-ui '+
						(vertical ? 'glue-slider-v' : 'glue-slider-h');
					handle = document.createElement('div');
					handle.className = 'glue-slider-handle';
					bar.appendChild(handle);
					if (vertical) {
						bar.style.width = box.width+'px';
						bar.style.height = TRACK+'px';
						bar.style.left = (box.left+window.scrollX)+'px';
						bar.style.top = (box.top+window.scrollY-TRACK-GAP)+'px';
					} else {
						bar.style.width = TRACK+'px';
						bar.style.height = box.height+'px';
						bar.style.left = (box.left+window.scrollX-TRACK-GAP)+'px';
						bar.style.top = (box.top+window.scrollY)+'px';
					}
					document.body.appendChild(bar);
					place(start);
				};

				$.glue.slider(e, function(dx, dy, ev) {
					if (!moved) {
						if (Math.max(Math.abs(dx), Math.abs(dy)) < DEAD) {
							return;
						}
						moved = true;
						show();
					}
					last = value_at(dx, dy, ev);
					place(last);
					if (typeof opts.change == 'function') {
						opts.change(last, ev);
					}
				}, function(dx, dy, ev) {
					if (bar) {
						bar.remove();
						bar = false;
					}
					if (moved) {
						// The press starts on the button and the release
						// happens wherever the drag went, so the click the
						// browser synthesises afterwards is dispatched on
						// their common ancestor - body. A click on body means
						// "deselect" to $.glue.sel below, so without this the
						// object loses its selection at the end of every
						// drag, taking the menu and this very button with it.
						// Capture phase, since that handler is on
						// documentElement too.
						var swallow = function(cev) {
							cev.stopPropagation();
							cev.preventDefault();
							document.documentElement.removeEventListener('click', swallow, true);
						};
						document.documentElement.addEventListener('click', swallow, true);
						// belt and braces: if no click follows at all (a
						// release outside the window, say) the listener must
						// not sit there and eat the next real one
						setTimeout(function() {
							document.documentElement.removeEventListener('click', swallow, true);
						}, 200);
					}
					if (typeof opts.stop == 'function') {
						opts.stop(last, moved, ev);
					}
				});
				e.preventDefault();
			});
			return button;
		}
	};
}();

$.glue.stack = function()
{
	var default_z = 100;
	var max_z = 199;
	var min_z = 0;

	var intersecting = function(a, b) {
		var a_h = outer_height(a);
		var a_p = { left: a.offsetLeft, top: a.offsetTop };
		var a_w = outer_width(a);
		var b_h = outer_height(b);
		var b_p = { left: b.offsetLeft, top: b.offsetTop };
		var b_w = outer_width(b);
		if ((a_p.left <= b_p.left+b_w && b_p.left <= a_p.left+a_w) &&
			(a_p.top <= b_p.top+b_h && b_p.top <= a_p.top+a_h)) {
			return true;
		} else {
			return false;
		}
	};

	return {
		compress: function() {
			var max = min_z-1;
			var min = max_z+1;
			var shift = 0;
			// get min and max z of all objects
			document.querySelectorAll('.object:not(.locked)').forEach(function(el) {
				var z = parseInt(getComputedStyle(el).zIndex);
				if (isNaN(z)) {
					return;
				}
				if (z < min) {
					min = z;
				}
				if (max < z) {
					max = z;
				}
			});
			// compress levels
			for (var i=min; i<=max; i++) {
				// for each z-index level
				// check if there is an object in this level
				var found = false;
				document.querySelectorAll('.object:not(.locked)').forEach(function(el) {
					var z = parseInt(getComputedStyle(el).zIndex);
					if (isNaN(z)) {
						return;
					} else if (z == i) {
						found = true;
					}
				});
				// if not, move all upper levels one down
				if (!found) {
					// DEBUG
					//console.log('compressing level '+i);
					max--;
					document.querySelectorAll('.object:not(.locked)').forEach(function(el) {
						var z = parseInt(getComputedStyle(el).zIndex);
						if (isNaN(z)) {
							return;
						} else if (i < z) {
							el.style.zIndex = --z;
							el.classList.add('need_save');
						}
					});
				}
			}
			// calculcate how much we want to shift all z's
			shift = default_z-Math.round((max-min)/2)-min;
			// DEBUG
			//console.log('shift is '+shift);
			if (Math.abs(shift) < 20) {
				shift = 0;
			} else {
				document.querySelectorAll('.object').forEach(function(el) {
					el.classList.add('need_save');
				});
			}
			// save objects
			document.querySelectorAll('.need_save').forEach(function(el) {
				var z = parseInt(getComputedStyle(el).zIndex);
				if (!isNaN(z)) {
					el.style.zIndex = z+shift;
					$.glue.object.save(el);
				}
				el.classList.remove('need_save');
			});
		},
		default_z: function() {
			return default_z;
		},
		to_bottom: function(obj) {
			var local_min_z = max_z+1;
			var old_z = parseInt(getComputedStyle(obj).zIndex);
			document.querySelectorAll('.object:not(.locked)').forEach(function(el) {
				if (el == obj) {
					return;
				}
				if (!intersecting(obj, el)) {
					return;
				} else {
					// DEBUG
					//console.log('object intersects '+el.id);
				}
				var z_str = getComputedStyle(el).zIndex;
				if (z_str.length) {
					var z = parseInt(z_str);
					if (!isNaN(z) && z < local_min_z) {
						local_min_z = z;
					}
				}
			});
			// check if we need to update the object
			if (isNaN(old_z) || local_min_z <= old_z) {
				// check if we really found an intersecting element (otherwise
				// local_min_z is max_z+1) and if we are inside min_z
				if (local_min_z <= max_z && min_z < local_min_z) {
					obj.style.zIndex = local_min_z-1;
					// DEBUG
					//console.log('set z-index to '+(local_min_z-1));
					return true;
				}
			}
			return false;
		},
		to_top: function(obj) {
			var local_max_z = min_z-1;
			var old_z = parseInt(getComputedStyle(obj).zIndex);
			document.querySelectorAll('.object:not(.locked)').forEach(function(el) {
				if (el == obj) {
					return;
				}
				if (!intersecting(obj, el)) {
					return;
				} else {
					// DEBUG
					//console.log('object intersects '+el.id);
				}
				var z_str = getComputedStyle(el).zIndex;
				if (z_str.length) {
					var z = parseInt(z_str);
					if (!isNaN(z) && local_max_z < z) {
						local_max_z = z;
					}
				}
			});
			// check if we need to update the object
			if (isNaN(old_z) || old_z <= local_max_z) {
				// check if we really found an intersecting element (otherwise
				// local_max_z is min_z-1) and if we are inside max_z
				if (min_z <= local_max_z && local_max_z < max_z) {
					obj.style.zIndex = local_max_z+1;
					// DEBUG
					//console.log('set z-index to '+(local_max_z+1));
					return true;
				}
			}
			return false;
		},
	// level_up/level_down swap the object with the nearest intersecting
	// object above (below) it: to_top/to_bottom push to the ends, these nudge
	// one place. An object without a z-index of its own sits at 0, and the
	// swap hands that position to the neighbour - so the neighbour goes back
	// to having no style at all, not to a made-up number. Both ends of the
	// swap are saved here, since the caller cannot know the other object.
	level_up: function(obj) {
		var own_z = parseInt(getComputedStyle(obj).zIndex);
		if (isNaN(own_z)) {
			own_z = 0;
		}
		var other = null;
		var other_z = Infinity;
		document.querySelectorAll('.object:not(.locked)').forEach(function(el) {
			if (el == obj) {
				return;
			}
			if (!intersecting(obj, el)) {
				return;
			}
			var z = parseInt(getComputedStyle(el).zIndex);
			if (!isNaN(z) && own_z < z && z < other_z) {
				other = el;
				other_z = z;
			}
		});
		if (!other) {
			return false;
		}
		var had_z = obj.style.zIndex;
		obj.style.zIndex = other_z;
		if (had_z && had_z != 'auto') {
			other.style.zIndex = had_z;
		} else {
			other.style.zIndex = '';
		}
		$.glue.object.save(obj);
		$.glue.object.save(other);
		return true;
	},
	level_down: function(obj) {
		var own_z = parseInt(getComputedStyle(obj).zIndex);
		if (isNaN(own_z)) {
			own_z = 0;
		}
		var other = null;
		var other_z = -Infinity;
		document.querySelectorAll('.object:not(.locked)').forEach(function(el) {
			if (el == obj) {
				return;
			}
			if (!intersecting(obj, el)) {
				return;
			}
			var z = parseInt(getComputedStyle(el).zIndex);
			if (!isNaN(z) && z < own_z && other_z < z) {
				other = el;
				other_z = z;
			}
		});
		if (!other) {
			return false;
		}
		var had_z = obj.style.zIndex;
		obj.style.zIndex = other_z;
		if (had_z && had_z != 'auto') {
			other.style.zIndex = had_z;
		} else {
			other.style.zIndex = '';
		}
		$.glue.object.save(obj);
		$.glue.object.save(other);
		return true;
	}
	};
}();

$.glue.upload = function()
{
	// helper function that provides a default upload
	// orig_x .. (page) x position of upload (can be set on the fly in .x)
	// orig_y .. (page) y position of upload (can be set on the fly in .y)
	// TODO (later): expose this through $.glue.upload.default_upload_handling
	var default_upload_handling = function(orig_x, orig_y) {
		if (orig_x === undefined) {
			orig_x = 0;
		}
		if (orig_y === undefined) {
			orig_y = 0;
		}
		var uploading = 0;
		return {
			error: function(e) {
				// remove status indicator if no file uploading anymore
				uploading--;
				if (uploading == 0) {
					this.status.remove();
				}
				// e.target.status suggested in
				// http://developer.mozilla.org/en/XMLHttpRequest/Using_XMLHttpRequest
				if (e && e.target && e.target.status) {
					$.glue.error('There was a problem uploading a file (status '+e.target.status+')');
				} else {
					$.glue.error('There was a problem uploading a file. Make sure you are not exceeding the file size limits set in the server configuration.');
					// DEBUG
					console.error(e);
				}
			},
			finish: function(data) {
				// DEBUG
				//console.log('finished uploading');
				// remove status indicator if no file uploading anymore
				uploading--;
				if (uploading == 0) {
					// DEBUG
					//console.log('no files uploading anymore, removing status indicator');
					this.status.remove();
				}
				// handle response
				$.glue.upload.handle_response(data, this.x, this.y);
			},
			progress: function(e) {
				// update status indicator
				// TODO (later): values are off on Chrome when uploading multiple file, one after another (it jumps back and forth) (report)
				var pct = e.loaded/e.total*100;
				this.status.querySelector('.glue-upload-statusbar-done').style.width = pct+'%';
				this.status.title = e.loaded+' of '+e.total+' bytes ('+pct.toFixed(1)+'%)';
				// once an upload has been running for more than 5 seconds, also
				// show percentage + speed as a visible label (not just on hover)
				var elapsed = (Date.now()-this.startTime)/1000;
				var label = this.status.querySelector('.glue-upload-statusbar-label');
				if (elapsed > 5) {
					var mbps = (e.loaded*8/1000000)/elapsed;
					label.textContent = pct.toFixed(1)+'% – '+mbps.toFixed(1)+' Mbps';
					label.style.display = 'block';
				}
			},
			start: function(e) {
				// DEBUG
				//console.log('started uploading');
				$.glue.menu.hide();
				uploading++;
				this.startTime = Date.now();
				// add status indicator to dom
				document.body.appendChild(this.status);
				this.status.querySelector('.glue-upload-statusbar-done').style.width = '0%';
				var label = this.status.querySelector('.glue-upload-statusbar-label');
				label.style.display = 'none';
				label.textContent = '';
				this.status.style.left = (this.x-outer_width(this.status)/2)+'px';
				this.status.style.top = (this.y-outer_height(this.status)/2)+'px';
			},
			status: (function() {
				var el = document.createElement('div');
				el.className = 'glue-upload-statusbar glue-ui';
				el.style.position = 'absolute';
				el.style.zIndex = '202';
				var inner = document.createElement('div');
				inner.className = 'glue-upload-statusbar-done';
				el.appendChild(inner);
				var label = document.createElement('div');
				label.className = 'glue-upload-statusbar-label';
				el.appendChild(label);
				return el;
			})(),
			x: orig_x,
			y: orig_y
		}
	};

	document.addEventListener('DOMContentLoaded', function() {
		// generic upload button
		var elem = document.createElement('div');
		elem.style.height = '32px';
		elem.style.maxHeight = '32px';
		elem.style.maxWidth = '32px';
		elem.style.overflow = 'hidden';
		elem.style.width = '32px';
		// the SVG icon set is white artwork and this chrome is light, so the
		// button is a mask (.glue-btn-icon) and the colour comes from CSS;
		// the tooltip rides on the file input, which covers the button
		elem.appendChild($.glue.icon('upload'));
		var upload = default_upload_handling();
		upload.multiple = true;
		$.glue.upload.button(elem, { method: 'glue.upload_files', page: $.glue.page }, upload);
		elem.addEventListener('click', function(e) {
			// update x, y
			var p = $.glue.menu.spawn_coords();
			upload.x = p.x;
			upload.y = p.y;
		});
		$.glue.menu.register('new', elem, 11);

		// handle drop events on body
		// this is based on http://developer.mozilla.org/en/using_files_from_web_applications
		// does not seem to be possible in jQuery at the moment
		// we use html here as body doesn't get enlarged when zooming out e.g.
		document.documentElement.addEventListener('dragover', function(e) {
			e.stopPropagation();
			e.preventDefault();
		}, false);
		document.documentElement.addEventListener('drop', function(e) {
			e.stopPropagation();
			e.preventDefault();
			// pageX, pageY are available in Firefox and Chrome
			// TODO (later): pageX, pageY does not seem to handle zoomed pages in Chrome (report)
			var upload = default_upload_handling(e.pageX, e.pageY);
			$.glue.upload.files(e.dataTransfer.files, { method: 'glue.upload_files', page: $.glue.page }, upload);
		}, false);
	});

	return {
		// exposed so other modules can build their own upload buttons (e.g.
		// a type-specific "add video" menu entry) without reimplementing the
		// status bar / progress / error handling
		default_upload_handling: default_upload_handling,
		// elem .. element to turn into a file button
		// data .. other parameters to send to the service
		// options ..	multiple => allow multiple files to be uploaded (boolean, defaults to false)
		//				tooltip => title attribute on the file button
		//				accept => restricts the file picker to matching files (e.g. 'video/*,.mp4')
		//				abort => function called if the upload didn't start
		//				start => function called when the upload started
		//				progress => function called periodically during the upload
		//				error => function called when an error occured
		//				finish => function called after the upload has completed
		button: function(elem, data, options) {
			// add a file input to the element
			if (!options) {
				options = {};
			}
			if (!options.tooltip) {
				options.tooltip = 'upload a file';
			}
			var input = document.createElement('input');
			input.type = 'file';
			input.title = options.tooltip;
			input.style.height = '100%';
			input.style.opacity = '0';
			input.style.position = 'absolute';
			input.style.width = '100%';
			input.style.zIndex = '300';
			elem.insertBefore(input, elem.firstChild);
			if (options.multiple) {
				input.setAttribute('multiple', 'multiple');
			}
			if (options.accept) {
				input.setAttribute('accept', options.accept);
			}
			// add event handler
			input.addEventListener('change', function(e) {
				e.preventDefault();
				if (!this.files || this.files.length == 0) {
					if (typeof options.abort == 'function') {
						options.abort();
					}
					return false;
				} else {
					$.glue.upload.files(this.files, data, options);
					return false;
				}
			});
		},
		// files .. array of file-objects (see $.glue.upload.button)
		// data .. other parameters to send to the service
		// options ..	abort => function called if the upload didn't start
		//				start => function called when the upload started
		//				progress => function called periodically during the upload
		//				error => function called when an error occured
		//				finish => function called after the upload has completed
		files: function(files, data, options) {
			// based on http://www.appelsiini.net/2009/10/html5-drag-and-drop-multiple-file-upload
			// and jquery-html5-upload
			if (!data) {
				data = {};
			}
			if (!options) {
				options = {};
			}
			var xhr = new XMLHttpRequest();
			if (typeof options.progress == 'function') {
				// this is needed otherwise this is XMLHttpRequestUpload in the
				// progress handler
				xhr.upload['onprogress'] = function(e) {
					options.progress(e);
				}
			}
			if (typeof options.finish == 'function') {
				xhr.onload = function(e) {
					try {
						options.finish(JSON.parse(e.target.responseText));
					} catch (e) {
						if (typeof options.error == 'function') {
							options.error(e);
						}
					}
				};
			}
			if (typeof options.error == 'function') {
				xhr.onerror = function(e) {
					options.error(e);
				}
			}
			xhr.open('POST', $.glue.base_url+'json.php', true);
			if (window.FormData) {
				// DEBUG
				//console.log('upload: using FormData');
				var f = new FormData();
				// other parameters
				for (var key in data) {
					f.append(key, JSON.stringify(data[key]));
				}
				// files
				for (var i=0; i < files.length; i++) {
					f.append('user_file'+i, files[i]);
				}
				xhr.send(f);
				if (typeof options.start == 'function') {
					options.start(files);
				}
				return true;
			} else {
				$.glue.error('Your browser is not supported. Update to a recent version of Firefox or Chrome.');
				if (typeof options.abort == 'function') {
					options.abort();
				}
				return false;
			}
		},
		handle_response: function(data, x, y) {
			// x and y arrive in PAGE space - from a drop's pageX/pageY, or from
			// $.glue.menu.spawn_coords() when the upload button was used. The
			// objects built below are added to the canvas, which in centered
			// mode is the container, so their coordinates have to be in the
			// container's space or every uploaded file lands centering-width to
			// the right of where it was dropped. A no-op in infinite mode.
			var at = $.glue.canvas.from_page(x, y);
			x = at.x;
			y = at.y;
			if (!data) {
				$.glue.error('There was a problem communicating with the server');
			} else if (data['#error']) {
				$.glue.error('There was a problem uploading the file ('+data['#data']+')');
			} else {
				// add new elements to the dom and register them
				if (data['#data'].length == 0) {
					// special case for no new elements
					$.glue.error('The server did not reply with any object. The file type you were uploading could either not be supported (look around for more modules!) or there could be an internal problem. Check the log file to be sure!');
					return;
				}
				// we're not selecting the new objects but at least clear the current selection
				$.glue.sel.none();
				for (var i=0; i < data['#data'].length; i++) {
					// data['#data'][i] is an HTML string - parse it into a
					// real element via a detached template
					var tmpl = document.createElement('template');
					tmpl.innerHTML = data['#data'][i].trim();
					var obj = tmpl.content.firstElementChild;

					// set mode and target x, y
					var mode, target_x, target_y;
					if (data['#data'].length == 1) {
						mode = 'center';
						target_x = x;
						target_y = y;
					} else {
						mode = 'stack';
						target_x = x+i*$.glue.grid.x();
						target_y = y+i*$.glue.grid.y();
					}

					// load event handler - 'this' is whichever element the
					// native 'load' event actually fired on (obj itself, or
					// one of its descendants below), same as jQuery's .bind()
					// which attaches directly to each element rather than
					// delegating. mode/target_x/target_y are snapshotted as
					// IIFE parameters (not just closed over) since they're
					// var-scoped to this whole loop and 'load' fires later,
					// asynchronously - by then a multi-file upload could have
					// moved on to later iterations and overwritten them;
					// jQuery's original .bind(event, eventData, handler) took
					// a snapshot the same way, per element, at bind time
					var content_loaded = (function(mode, target_x, target_y) {
						return function(e) {
							var obj;
							if (this.classList.contains('object')) {
								obj = this;
							} else {
								obj = this.closest('.object');
							}
							// set default width and height
							obj.style.width = obj.offsetWidth+'px';
							obj.style.height = obj.offsetHeight+'px';
							// DEBUG
							//console.log('glue-upload-dynamic-late: '+obj.id);
							// fire handler (can overwrite width and height)
							$.glue.trigger(obj, 'glue-upload-dynamic-late', [ this ]);
							// position object
							if (mode == 'center') {
								// move to the center of mouseclick
								obj.style.left = (target_x-outer_width(obj)/2)+'px';
								obj.style.top = (target_y-outer_height(obj)/2)+'px';
							} else {
								// move to stack
								obj.style.left = target_x+'px';
								obj.style.top = target_y+'px';
							}
							// restore visibility
							obj.style.visibility = glue_orig_visibility.get(obj) || '';
							glue_orig_visibility.delete(obj);
							// register object
							$.glue.object.register(obj);
							// save object
							$.glue.object.save(obj);
						};
					})(mode, target_x, target_y);

					// check if we have dimensions already
					var width = parseInt(obj.style.getPropertyValue('width'));
					if (isNaN(width) || width === 0) {
						// bind load event handlers
						obj.addEventListener('load', content_loaded);
						obj.querySelectorAll('*').forEach(function(child) {
							child.addEventListener('load', content_loaded);
						});
						// save initial visibility and make object invisible
						glue_orig_visibility.set(obj, getComputedStyle(obj).visibility);
						obj.style.visibility = 'hidden';
						// add to dom
						$.glue.canvas.add(obj);
						// DEBUG
						//console.log('glue-upload-dynamic-early: '+obj.id);
						// fire handler
						$.glue.trigger(obj, 'glue-upload-dynamic-early', [ mode, target_x, target_y ]);
					} else {
						// add to dom
						$.glue.canvas.add(obj);
						// position object
						if (mode == 'center') {
							// move to the center of mouseclick
							obj.style.left = (target_x-outer_width(obj)/2)+'px';
							obj.style.top = (target_y-outer_height(obj)/2)+'px';
						} else {
							// move to stack
							obj.style.left = target_x+'px';
							obj.style.top = target_y+'px';
						}
						// register object
						$.glue.object.register(obj);
						// DEBUG
						//console.log('registered static upload: '+obj.id);
						// fire handler
						$.glue.trigger(obj, 'glue-upload-static', [ mode ]);
						// save object
						$.glue.object.save(obj);
					}
				}
			}
		}
	};
}();

document.addEventListener('DOMContentLoaded', function() {
	// register all objects
	document.querySelectorAll('.object').forEach(function(el) {
		$.glue.object.register(el);
		$.glue.undo.seed(el, $.glue.object.to_html(el));
	});

	// make sure we call enlarge body even if there are no objects
	$.glue.canvas.update();

	// enlarge body when we resize the window
	var resize_timer;
	window.addEventListener('resize', function(e) {
		clearTimeout(resize_timer);
		resize_timer = setTimeout(function() {
			$.glue.canvas.update();
		}, 100);
	});

	// trigger menus on click and doubleclick
	var menu_dblclick_timeout = false;
	document.documentElement.addEventListener('click', function(e) {
		// make sure no iframe has focus as this breaks keyboard shortcuts etc
		window.focus();
		// we use 'html' here to give the colorpicker et al a chance to stop the
		// propagation of the event in 'body'
		if (e.target == document.body) {
			if (!$.glue.menu.is_shown()) {
				if (menu_dblclick_timeout) {
					clearTimeout(menu_dblclick_timeout);
					menu_dblclick_timeout = false;
					// show page menu
					$.glue.menu.show('page', e.clientX, e.clientY);
					e.preventDefault();
					return false;
				}
				menu_dblclick_timeout = setTimeout(function() {
					menu_dblclick_timeout = false;
					// prevent the new menu from showing when the user wants to
					// simply clear any open menu
					if ($.glue.menu.prev_menu() == '') {
						// show new menu
						$.glue.menu.show('new', e.clientX, e.clientY);
					}
				}, 300);
			}
		}
	});

	// menu shortcuts
	document.documentElement.addEventListener('keyup', function(e) {
		if (e.altKey && e.which == 79) {
			// alt+o: show new object menu
			$.glue.menu.show('new');
			e.preventDefault();
			return false;
		} else if (e.altKey && e.which == 80) {
			// alt+p: show page menu
			$.glue.menu.show('page');
			e.preventDefault();
			return false;
		} else if (e.ctrlKey && e.which == 90) {
			// ctrl+z: undo. Typing in a field is handled by the guard at the
			// top of this listener, which leaves the browser's own undo to
			// the field it belongs to.
			$.glue.undo.undo();
			e.preventDefault();
			return false;
		} else if (e.ctrlKey && e.which == 89) {
			// ctrl+y: redo (same textarea/input guard as ctrl+z)
			if (document.activeElement && (document.activeElement.tagName == 'TEXTAREA' || document.activeElement.tagName == 'INPUT')) {
				return;
			}
			$.glue.undo.redo();
			e.preventDefault();
			return false;
		}
	});

	// I really don't know why, but when we don't handle the mousedown event here
	// double-clicking the page does select some object (the first child of body
	// on Firefox and the nearest element on Chrome)
	// exclude Moveable's own controls: they need their mousedown to reach
	// Moveable's handlers undisturbed to start a drag/resize
	document.documentElement.addEventListener('mousedown', function(e) {
		// preventDefault on mousedown is what stops a drag on the canvas from
		// turning into a text selection - but it also suppresses FOCUS, so
		// anything the user is meant to click into has to be exempt. Without
		// the form controls here, an input inside editor UI can only be typed
		// into if something focused it programmatically: clicking a second
		// field does nothing at all, and the keystrokes keep going to the
		// first one. modules/text/text-edit.js:187 works around this same
		// handler locally for its textarea; this is the general case.
		if (e.target.closest('.moveable-control, .moveable-line, input, textarea, select, button, label')) {
			return;
		}
		e.preventDefault();
	});
});
