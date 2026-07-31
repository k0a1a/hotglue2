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
			document.body.style.width = max_x+'px';
			document.body.style.height = max_y+'px';
			// update grid
			$.glue.grid.update();
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

$.glue.colorpicker = function()
{
	var change_func = false;
	var finish_func = false;
	var finished = false;
	var shown = false;

	// setup element
	// note: the "transparent" toggle farbtastic used to offer here was never
	// actually used by any module (transparency is handled by a separate
	// opacity slider on objects), so it's not carried over
	var elem = document.createElement('input');
	elem.type = 'color';
	elem.id = 'glue-colorpicker';
	elem.className = 'glue-ui';
	elem.addEventListener('input', function(e) {
		if (typeof change_func == 'function') {
			change_func(elem.value);
		}
	});
	elem.addEventListener('change', function(e) {
		// the native picker has been dismissed/confirmed
		$.glue.colorpicker.hide();
	});

	var close_colorpicker = function(e) {
		// close colorpicker when clicking outside of it or its children
		// note: this handler is also being called right after colorpicker
		// creation
		if (!e.target.classList.contains('glue-ui') && !e.target.closest('.glue-ui')) {
			// this also unregisters the event
			$.glue.colorpicker.hide();
			// prevent the menu from firing
			e.stopImmediatePropagation();
		}
	};

	return {
		hide: function(cancel) {
			if (shown) {
				if (!finished && (cancel === undefined || cancel == false)) {
					finished = true;
					if (typeof finish_func == 'function') {
						finish_func(elem.value);
					}
				}
				elem.remove();
				shown = false;
			}
			// unregister event
			document.body.removeEventListener('click', close_colorpicker);
		},
		is_shown: function() {
			return shown;
		},
		set_color: function(col) {
			var rgb = $.glue.color.parse(col);
			var hex = rgb ? $.glue.color.to_hex(rgb) : '#ff0000';
			// a special case for color 'transparent': show white rather than
			// black, as native color inputs can't represent alpha
			if (rgb && rgb.a == 0) {
				hex = '#ffffff';
			}
			elem.value = hex;
		},
		show: function(def, transp, change, finish) {
			if (shown) {
				$.glue.colorpicker.hide();
			}

			change_func = change;
			finish_func = finish;
			finished = false;

			if (typeof def != 'string' || def.length == 0) {
				// set a sane default
				elem.value = '#ff0000';
			} else {
				$.glue.colorpicker.set_color(def);
			}

			// add to dom
			document.body.appendChild(elem);
			shown = true;
			// register event
			document.body.addEventListener('click', close_colorpicker);
			// open the native picker right away, mirroring farbtastic's
			// always-visible wheel
			elem.click();
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

	return {
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
		register: function(cls, name, elem, prio) {
			if (!m[cls]) {
				m[cls] = [];
			}
			if (prio === undefined) {
				prio = default_prio;
			}
			m[cls].push({ 'name': name, 'elem': elem, 'prio': prio });
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
						var target;
						// add to left or top
						if (cls == 'object') {
							target = left;
						} else {
							target = top;
						}
						// sort by priority ascending
						for (var i=0; i < m[cls].length; i++) {
							var added = false;
							for (var j=0; j < target.length; j++) {
								if (m[cls][i].prio < target[j].prio) {
									target.splice(j, 0, m[cls][i]);
									added = true;
									break;
								}
							}
							if (!added) {
								target.push(m[cls][i]);
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
			// position items
			for (var i=0; i < 2; i++) {
				var target;
				var cur_left = obj.offsetLeft;
				var cur_top = obj.offsetTop;
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
				// add items to dom
				for (var j=0; j < target.length; j++) {
					// set crucial css properties
					target[j].elem.id = 'glue-contextmenu-'+target[j].name;
					if (target == left) {
						target[j].elem.classList.add('glue-contextmenu-left');
					} else {
						target[j].elem.classList.add('glue-contextmenu-top');
					}
					target[j].elem.classList.add('glue-ui');
					target[j].elem.style.position = 'absolute';
					target[j].elem.style.visibility = 'hidden';
					target[j].elem.style.zIndex = '201';
					// add to dom and move
					document.body.appendChild(target[j].elem);
					if (target == top) {
						target[j].elem.style.left = cur_left+'px';
						var temp_top = cur_top-outer_height(target[j].elem, true);
						if (temp_top < 0) {
							temp_top = 0;
						}
						target[j].elem.style.top = temp_top+'px';
						var cur_width = outer_width(target[j].elem, true);
					} else {
						var temp_left = cur_left-outer_width(target[j].elem, true);
						if (temp_left < 0) {
							temp_left = 0;
						}
						target[j].elem.style.left = temp_left+'px';
						target[j].elem.style.top = cur_top+'px';
						var cur_height = outer_height(target[j].elem, true);
					}
					// set owner and trigger event
					$.glue.owner(target[j].elem, obj);
					// Alpine's own MutationObserver-based init is async, but
					// icons here get detached/reattached on every hide()/
					// show() - without this, the glue-menu-activate trigger
					// right below fires before Alpine has (re)attached its
					// x-on listener on the freshly reappended element, and
					// the event is silently lost (Alpine.initTree is a
					// no-op on an already-initialized element, safe to call
					// every time)
					if (window.Alpine) {
						Alpine.initTree(target[j].elem);
					}
					$.glue.trigger(target[j].elem, 'glue-menu-activate');
					// check if we still want to show the icon ;)
					if (getComputedStyle(target[j].elem).display == 'none') {
						continue;
					}
					// show it for real
					if (target == left) {
						cur_top += cur_height;
					} else {
						cur_left += cur_width;
					}
					target[j].elem.style.visibility = '';
					target[j].elem.style.display = 'none';
					fade_in(target[j].elem, 333);
				}
			}
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
				for (var x=grid_x; x <= grid_width; x+=grid_x) {
					var elem = document.createElement('div');
					// set crucial css properties
					elem.classList.add('glue-grid-y');
					elem.classList.add('glue-grid');
					elem.classList.add('glue-ui');
					// use complementary color
					elem.style.backgroundColor = $.glue.color.complementary(bg_color);
					elem.style.height = grid_height+'px';
					elem.style.left = x+'px';
					elem.style.position = 'absolute';
					elem.style.top = '0px';
					elem.style.width = '1px';
					elem.style.zIndex = '200';
					// add to dom and list
					document.body.appendChild(elem);
					lines.push(elem);
				}
				for (var y=grid_y; y <= grid_height; y+=grid_y) {
					var elem = document.createElement('div');
					elem.classList.add('glue-grid-x');
					elem.classList.add('glue-grid');
					elem.classList.add('glue-ui');
					// use complementary color
					elem.style.backgroundColor = $.glue.color.complementary(bg_color);
					elem.style.height = '1px';
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

	// only show resize handles while an object is selected, not permanently
	$.glue.live('.object', 'glue-select', function(e) {
		var m = moveables.get(this);
		if (m && this.classList.contains('resizable') && !this.classList.contains('locked')) {
			m.resizable = true;
		}
	});
	$.glue.live('.object', 'glue-deselect', function(e) {
		var m = moveables.get(this);
		if (m) {
			m.resizable = false;
		}
	});

	document.addEventListener('DOMContentLoaded', function() {
		$.glue.object.register_alter_pre_save('glue-selected', function(obj, orig) {
			var border = orig.offsetHeight-orig.clientHeight;
			var p = { left: orig.offsetLeft, top: orig.offsetTop };
			// remove class
			obj.classList.remove('glue-selected');
			// and remove border offset
			obj.style.left = (p.left+border/2)+'px';
			obj.style.top = (p.top+border/2)+'px';
			//obj.style.width = (orig.offsetWidth+border)+'px';
			//obj.style.height = (orig.offsetHeight+border)+'px';
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
				scrollContainer: document.documentElement,
				scrollThreshold: 40,
				scrollThrottleTime: 30
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
				if (document.querySelectorAll('.glue-selected').length > 1 && obj.classList.contains('glue-selected')) {
					$.glue.trigger('.glue-selected', 'glue-movestop');
				} else {
					$.glue.trigger(obj, 'glue-movestop');
				}
			}).on('scroll', function(e) {
				e.scrollContainer.scrollBy(e.direction[0]*15, e.direction[1]*15);
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
		save: function(obj) {
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
			// convert to string
			var html = elem.outerHTML;
			// DEBUG
			//console.log(html);
			$.glue.backend({ method: 'glue.save_state', 'html': html });
		},
		// obj .. element
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
			$.glue.trigger(obj, 'glue-unregister');
			// can't update canvas here as object to be deleted is still in the
			// dom
		}
	};
}();

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

	document.documentElement.addEventListener('keydown', function(e) {
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
					var p = { left: next.offsetLeft, top: next.offsetTop };
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
				var p = { left: elem.offsetLeft, top: elem.offsetTop };
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
		if (33 == e.which && e.shiftKey && document.querySelectorAll('.glue-selected').length) {
			// shift+pageup: move objects to top of stack
			document.querySelectorAll('.glue-selected:not(.locked)').forEach(function(el) {
				$.glue.stack.to_top(el);
				$.glue.object.save(el);
			});
			$.glue.stack.compress();
			e.preventDefault();
			return false;
		} else if (34 == e.which && e.shiftKey && document.querySelectorAll('.glue-selected').length) {
			// shift+pagedown: move objects to bottom of stack
			document.querySelectorAll('.glue-selected:not(.locked)').forEach(function(el) {
				$.glue.stack.to_bottom(el);
				$.glue.object.save(el);
			});
			$.glue.stack.compress();
			e.preventDefault();
			return false;
		} else if (37 <= e.which && e.which <= 40 && document.querySelectorAll('.glue-selected').length) {
			// move selected elements with arrow keys
			$.glue.trigger('.glue-selected:not(.locked)', 'glue-movestop');
			key_moving = false;
			e.preventDefault();
			return false;
		} else if (e.which == 46 && document.querySelectorAll('.glue-selected').length) {
			// delete selected objects
			// this is pretty much copied from object-edit.js
			var objs = document.querySelectorAll('.glue-selected:not(.locked)');
			objs.forEach(function(el) {
				var id = el.id;
				$.glue.object.unregister(el);
				el.remove();
				// delete in backend as well
				$.glue.backend({ method: 'glue.delete_object', name: id });
				// update canvas
				$.glue.canvas.update();
			});
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
				var border = obj.offsetHeight-obj.clientHeight;
				obj.classList.remove('glue-selected');
				$.glue.trigger(obj, 'glue-deselect');
				var p = { left: obj.offsetLeft, top: obj.offsetTop };
				obj.style.left = (p.left+border/2)+'px';
				obj.style.top = (p.top+border/2)+'px';
				//obj.style.width = (obj.offsetWidth+border)+'px';
				//obj.style.height = (obj.offsetHeight+border)+'px';
				// DEBUG
				//console.log('deselected '+obj.id);
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
		select: function(obj) {
			// TODO (later): handle more than one obj (and change callers)
			if (!obj.classList.contains('glue-selected')) {
				obj.classList.add('glue-selected');
				$.glue.trigger(obj, 'glue-select');
				// TODO (later): the following code works for dashed borders but
				// not for solid ones - read out the border-style on the fly and
				// act accordingly (there seem to be a problem with getting the
				// information through jQuery 1.4.3 however)
				// also needs changes above and in register_alter_pre_save
				var p = { left: obj.offsetLeft, top: obj.offsetTop };
				var border = obj.offsetHeight-obj.clientHeight;
				obj.style.left = (p.left-border/2)+'px';
				obj.style.top = (p.top-border/2)+'px';
				//obj.style.width = (obj.offsetWidth-border)+'px';
				//obj.style.height = (obj.offsetHeight-border)+'px';
				// DEBUG
				//console.log('selected '+obj.id);
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
	return function(e, change, stop) {
		var old_e = e;
		var mousemove = function(e) {
			if (typeof change == 'function') {
				change(e.pageX-old_e.pageX, e.pageY-old_e.pageY, e);
			}
			e.preventDefault();
		};
		var mouseup = function(e) {
			document.documentElement.removeEventListener('mousemove', mousemove);
			document.documentElement.removeEventListener('mouseup', mouseup);
			if (typeof change == 'function') {
				change(e.pageX-old_e.pageX, e.pageY-old_e.pageY, e);
			}
			if (typeof stop == 'function') {
				stop(e.pageX-old_e.pageX, e.pageY-old_e.pageY, e);
			}
			e.preventDefault();
		};
		document.documentElement.addEventListener('mousemove', mousemove);
		document.documentElement.addEventListener('mouseup', mouseup);
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
				this.status.querySelector('.glue-upload-statusbar-done').style.width = (e.loaded/e.total*100)+'%';
				this.status.title = e.loaded+' of '+e.total+' bytes ('+(e.loaded/e.total*100).toFixed(1)+'%)';
			},
			start: function(e) {
				// DEBUG
				//console.log('started uploading');
				$.glue.menu.hide();
				uploading++;
				// add status indicator to dom
				document.body.appendChild(this.status);
				this.status.querySelector('.glue-upload-statusbar-done').style.width = '0%';
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
		var uploadImg = document.createElement('img');
		uploadImg.src = $.glue.base_url+'img/upload.png';
		uploadImg.alt = 'btn';
		uploadImg.width = 32;
		uploadImg.height = 32;
		elem.appendChild(uploadImg);
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
		// elem .. element to turn into a file button
		// data .. other parameters to send to the service
		// options ..	multiple => allow multiple files to be uploaded (boolean, defaults to false)
		//				tooltip => title attribute on the file button
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
						document.body.appendChild(obj);
						// DEBUG
						//console.log('glue-upload-dynamic-early: '+obj.id);
						// fire handler
						$.glue.trigger(obj, 'glue-upload-dynamic-early', [ mode, target_x, target_y ]);
					} else {
						// add to dom
						document.body.appendChild(obj);
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
			// ctrl+z: show revisions browser to suggest using revisions in place of undo
			if (confirm('Looking for an "undo" option?\nHOTGLUE keeps record of your recent edits - it\'s called "revisions".\nWould you like to browse through the revisions of this page?')) {
				window.location = $.glue.base_url+'?'+$.glue.page+'/revisions';
				e.preventDefault();
				return false;
			}
		}
	});

	// I really don't know why, but when we don't handle the mousedown event here
	// double-clicking the page does select some object (the first child of body
	// on Firefox and the nearest element on Chrome)
	// exclude Moveable's own controls: they need their mousedown to reach
	// Moveable's handlers undisturbed to start a drag/resize
	document.documentElement.addEventListener('mousedown', function(e) {
		if (e.target.closest('.moveable-control, .moveable-line')) {
			return;
		}
		e.preventDefault();
	});
});
