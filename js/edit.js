/**
 *	js/edit.js
 *	Main hotglue frontend code
 *
 *	Copyright Gottfried Haider, Danja Vasiliev 2010.
 *	This source code is licensed under the GNU General Public License.
 *	See the file COPYING for more details.
 */

$.glue.canvas = function()
{
	return {
		update: function(elem) {
			if (elem === undefined) {
				elem = $('.object');
			}
			var max_x = 0;
			var max_y = 0;
			$(elem).each(function() {
				var p = $(this).position();
				if (max_x < p.left+$(this).outerWidth()) {
					max_x = p.left+$(this).outerWidth();
				}
				if (max_y < p.top+$(this).outerHeight()) {
					max_y = p.top+$(this).outerHeight();
				}
			});
			// make body at least match the window width and height but don't 
			// send these values to the backend in any case
			if (max_x < $(window).width()) {
				max_x = $(window).width();
			}
			if (max_y < $(window).height()) {
				max_y = $(window).height();
			}
			// resize body
			$('body').css('width', max_x+'px');
			$('body').css('height', max_y+'px');
			// update grid
			$.glue.grid.update();
		}
	};
}();

$.glue.colorpicker = function()
{
	var change_func = false;
	var color = false;
	var finish_func = false;
	var shown = false;
	
	// setup element
	var elem = $('<div id="glue-colorpicker" class="glue-ui" style="z-index: 202;"><div id="glue-colorpicker-transparent" class="glue-ui"></div><div id="glue-colorpicker-wheel" style="height: 195px; width: 195px;" title="set transparent"></div></div>');
	$(elem).children('#glue-colorpicker-wheel').farbtastic(function(col) {
		if (col !== color) {
			// update tooltip
			$(elem).children('#glue-colorpicker-wheel').find('.marker').attr('title', col);
			$(elem).children('#glue-colorpicker-transparent').removeClass('glue-colorpicker-transparent-set');
			$(elem).children('#glue-colorpicker-transparent').addClass('glue-colorpicker-transparent-notset');
			if (typeof change_func == 'function') {
				change_func(col);
			}
			color = col;
		}
	});
	$(elem).children('#glue-colorpicker-transparent').bind('click', function(e) {
		$(this).addClass('glue-colorpicker-transparent-set');
		$(this).removeClass('glue-colorpicker-transparent-notset');
		if (typeof change_func == 'function') {
			change_func('transparent');
		}
		color = 'transparent';
	});
	
	var close_colorpicker = function(e) {
		// close colorpicker when clicking outside of it or its children
		// note: this handler is also being called right after colorpicker 
		// creation
		if (!$(e.target).hasClass('glue-ui') && $(e.target).parents('.glue-ui').length == 0) {
			// this also unregisters the event
			$.glue.colorpicker.hide();
			// prevent the menu from firing
			e.stopImmediatePropagation();
		}
	};
	
	return {
		hide: function(cancel) {
			if (shown) {
				if (cancel === undefined || cancel == false) {
					if (typeof finish_func == 'function') {
						finish_func(color);
					}
				}
				$(elem).detach();
				shown = false;
			}
			// unregister event
			$('body').unbind('click', close_colorpicker);
		},
		is_shown: function() {
			return shown;
		},
		set_color: function(col) {
			$.color.setColor(col);
			var rgba = $.color.getRGB();
			var hex = $.color.getHex();
			if ($(elem).children('#glue-colorpicker-transparent').css('display') == 'block') {
				// showing transparency button
				if (rgba.a == 0) {
					$(elem).children('#glue-colorpicker-transparent').addClass('glue-colorpicker-transparent-set');
					$(elem).children('#glue-colorpicker-transparent').removeClass('glue-colorpicker-transparent-notset');
					col = 'transparent';
				} else {
					$(elem).children('#glue-colorpicker-transparent').removeClass('glue-colorpicker-transparent-set');
					$(elem).children('#glue-colorpicker-transparent').addClass('glue-colorpicker-transparent-notset');
				}
			} else {
				// not showing transparency button
				// a special case for color 'transparent'
				if (rgba.r == 0 && rgba.g == 0 && rgba.b == 0 && rgba.a == 0) {
					// set color to white
					hex = '#ffffff';
				}
			}
			// set color wheel
			$.farbtastic($(elem).children('#glue-colorpicker-wheel')).setColor(hex);
			$(elem).children('#glue-colorpicker-wheel').find('.marker').attr('title', hex);
			color = col;
		},
		show: function(def, transp, change, finish) {
			if (shown) {
				$.glue.colorpicker.hide();
			}
			color = false;
			
			// set functions first, as $.farbtastic().setColor() immediately 
			// triggers a change event
			change_func = change;
			finish_func = finish;
			
			if (transp) {
				$(elem).children('#glue-colorpicker-transparent').css('display', 'block');
			} else {
				$(elem).children('#glue-colorpicker-transparent').css('display', 'none');
			}
			
			if (typeof def != 'string' || def.length == 0) {
				// set a sane default
				$.farbtastic($(elem).children('#glue-colorpicker-wheel')).setColor('#ff0000');
				$(elem).children('#glue-colorpicker-wheel').find('.marker').removeAttr('title');
			} else {
				$.glue.colorpicker.set_color(def);
			}
			
			// add to dom
			$('body').append(elem);
			shown = true;
			// register event
			$('body').bind('click', close_colorpicker);
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
	
	$('.object').live('glue-deselect', function(e) {
		// hide menu when deselecting
		$.glue.contextmenu.hide();
	});
	
	$('.object').live('glue-movestart', function(e) {
		// hide menu when moving the selected object
		if (this == owner) {
			prev_owner = owner;
			$.glue.contextmenu.hide();
		}
	});
	
	$('.object').live('glue-movestop', function(e) {
		// show menu again when we hid the menu because of movement
		if (this == prev_owner) {
			$.glue.contextmenu.show(prev_owner);
			prev_owner = false;
		}
	});
	
	$('.object').live('glue-select', function(e) {
		// show menu when one object is selected
		if ($('.glue-selected').length == 1) {
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
					$(item.elem).trigger('glue-menu-deactivate');
					$(item.elem).detach();
				}
				while (top.length) {
					var item = top.shift();
					$(item.elem).trigger('glue-menu-deactivate');
					$(item.elem).detach();
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
		reuse: function(cls, name, as, prio) {
			if (prio === undefined) {
				prio = default_prio;
			}
			for (var cur_m in m) {
				for (var i=0; i<m[cur_m].length; i++) {
					if (m[cur_m][i].name == name) {
						// clone element with data and events
						var new_elem = $(m[cur_m][i].elem).clone(true);
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
			for (var cls in m) {
				if ($(obj).hasClass(cls)) {
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
			// remove specific menu items again
			var obj_cls = $(obj).attr('class').replace(/\s+/, ' ').split(' ');
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
				var cur_left = $(obj).position().left;
				var cur_top = $(obj).position().top;
				if (i == 0) {
					target = top;
				} else {
					target = left;
					// this is to make sure that the context menu for objects positioned at 0, 0 is accessible
					// TODO (later): can be improved
					if (top.length && cur_top-$(top[0].elem).outerHeight(true) < 0) {
						cur_top = $(top[0].elem).outerHeight(true);
					}
				}
				// add items to dom
				for (var j=0; j < target.length; j++) {
					// set crucial css properties
					$(target[j].elem).attr('id', 'glue-contextmenu-'+target[j].name);
					if (target == left) {
						$(target[j].elem).addClass('glue-contextmenu-left');
					} else {
						$(target[j].elem).addClass('glue-contextmenu-top');
					}
					$(target[j].elem).addClass('glue-ui');
					$(target[j].elem).css('position', 'absolute');
					$(target[j].elem).css('visibility', 'hidden');
					$(target[j].elem).css('z-index', '201');
					// add to dom and move
					$('body').append(target[j].elem);
					if (target == top) {
						$(target[j].elem).css('left', cur_left+'px');
						var temp_top = cur_top-$(target[j].elem).outerHeight(true);
						if (temp_top < 0) {
							temp_top = 0;
						}
						$(target[j].elem).css('top', temp_top+'px');
						var cur_width = $(target[j].elem).outerWidth(true);
					} else {
						var temp_left = cur_left-$(target[j].elem).outerWidth(true);
						if (temp_left < 0) {
							temp_left = 0;
						}
						$(target[j].elem).css('left', temp_left+'px');
						$(target[j].elem).css('top', cur_top+'px');
						var cur_height = $(target[j].elem).outerHeight(true);
					}
					// set owner and trigger event
					$(target[j].elem).data('owner', obj);
					$(target[j].elem).trigger('glue-menu-activate');
					// check if we still want to show the icon ;)
					if ($(target[j].elem).css('display') == 'none') {
						continue;
					}
					// show it for real
					if (target == left) {
						cur_top += cur_height;
					} else {
						cur_left += cur_width;
					}
					$(target[j].elem).css('visibility', '');
					$(target[j].elem).hide();
					$(target[j].elem).fadeIn(333);
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
			if (grid_height !== $(document).height() || grid_width !== $(document).width()) {
				// optimization: only redraw the grid when width & height changes
				remove();
				grid_height = $(document).height();
				grid_width = $(document).width();
				// get background color
				var bg_color = '#ffffff';	// default to white
				if ($('body').css('background-color').length) {
					$.color.setColor($('body').css('background-color'));
					var bg_a = $.color.getArray();
					// xcolor doesn't handle the complementary of rgba(0, 0, 0, 0)
					if (bg_a[3] != 0) {
						bg_color = $.color.getHex();
					}
				}
				// add grid lines
				for (var x=grid_x; x <= grid_width; x+=grid_x) {
					var elem = $('<div></div>');
					// set crucial css properties
					$(elem).addClass('glue-grid-y');
					$(elem).addClass('glue-grid');
					$(elem).addClass('glue-ui');
					// use complementary color
					$(elem).css('background-color', $.xcolor.complementary(bg_color));
					$(elem).css('height', grid_height+'px');
					$(elem).css('left', x+'px');
					$(elem).css('position', 'absolute');
					$(elem).css('top', '0px');
					$(elem).css('width', '1px');
					$(elem).css('z-index', '200');
					// add to dom and list
					$('body').append(elem);
					lines.push(elem);
				}
				for (var y=grid_y; y <= grid_height; y+=grid_y) {
					var elem = $('<div></div>');
					$(elem).addClass('glue-grid-x');
					$(elem).addClass('glue-grid');
					$(elem).addClass('glue-ui');
					// use complementary color
					$(elem).css('background-color', $.xcolor.complementary(bg_color));
					$(elem).css('height', '1px');
					$(elem).css('left', '0px');
					$(elem).css('position', 'absolute');
					$(elem).css('top', y+'px');
					$(elem).css('width', grid_width+'px');
					$(elem).css('z-index', '200');
					$('body').append(elem);
					lines.push(elem);
				}
				// and guides
				for (var i in guides_x) {
					var elem = $('<div></div>');
					$(elem).addClass('glue-guide-x');
					$(elem).addClass('glue-guide');
					$(elem).addClass('glue-ui');
					// use a different color than background and grid lines
					$(elem).css('background-color', $.xcolor.average($.xcolor.complementary(bg_color), bg_color));
					$(elem).css('height', grid_height+'px');
					$(elem).css('left', guides_x[i]+'px');
					$(elem).css('position', 'absolute');
					$(elem).css('top', '0px');
					$(elem).css('width', '1px');
					$(elem).css('z-index', '200');
					$('body').append(elem);
					guides.push(elem);
				}
				for (var i in guides_y) {
					var elem = $('<div></div>');
					$(elem).addClass('glue-guide-y');
					$(elem).addClass('glue-guide');
					$(elem).addClass('glue-ui');
					// use a different color than background and grid lines
					$(elem).css('background-color', $.xcolor.average($.xcolor.complementary(bg_color), bg_color));
					$(elem).css('height', '1px');
					$(elem).css('left', '0px');
					$(elem).css('position', 'absolute');
					$(elem).css('top', guides_y[i]+'px');
					$(elem).css('width', grid_width+'px');
					$(elem).css('z-index', '200');
					$('body').append(elem);
					guides.push(elem);
				}
			}
		} else {
			remove();
		}
		// bit 1 changes drag behavior
		// this is not working as expected (the object snaps every x/y pixels 
		// form the current position, not from 0/0)
		// TODO (later): implement this properly
		if ((grid_mode & 2)) {
			$('.object').draggable('option', 'grid', [grid_x, grid_y]);		
		} else {
			$('.object').draggable('option', 'grid', false);
		}
		// bit 2 changes resize behavior
		// this is not working as expected (the object snaps every x/y pixels 
		// form the current position, not from 0/0)
		// TODO (later): implement this properly
		if ((grid_mode & 4)) {
			$('.resizable').resizable('option', 'grid', [grid_x, grid_y]);
		} else {
			$('.resizable').resizable('option', 'grid', false);
		}
	};
	
	var remove = function() {
		// remove lines
		while (lines.length) {
			var line = lines.shift();
			$(line).remove();
		}
		// and guides
		while (guides.length) {
			var guide = guides.shift();
			$(guide).remove();
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
		if (!$(e.target).hasClass('glue-ui') && $(e.target).parents('.glue-ui').length == 0) {
			// this also unregisters the event
			// when we close a menu like this we want to keep the name of the 
			// previous menu, hence false
			$.glue.menu.hide(false);
		}
	};
	
	$('.object').live('glue-select', function(e) {
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
					$(cur[i].elem).trigger('glue-menu-deactivate');
					$(cur[i].elem).detach();
				}
				cur = false;
			}
			$('body').unbind('click', close_menu);
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
				x = $(window).width()/2;
			}
			if (y === undefined) {
				y = $(window).height()/2;
			}
			var max_w = 0;
			var max_h = 0;
			cur = m[menu];
			// add items to dom
			for (var i=0; i < cur.length; i++) {
				var elem = cur[i].elem;
				// set crucial css properties
				$(elem).addClass('glue-menu-'+menu);
				$(elem).addClass('glue-menu');
				$(elem).addClass('glue-ui');
				$(elem).css('left', x+'px');
				$(elem).css('position', 'fixed');
				$(elem).css('top', y+'px');
				$(elem).css('visibility', 'hidden');
				$(elem).css('z-index', '201');
				// add to dom
				$('body').append(elem);
				// calculate max width & height
				// make sure you specify the width & height attribute for images etc
				if (max_w < $(elem).outerWidth(true)) {
					max_w = $(elem).outerWidth(true);
				}
				if (max_h < $(elem).outerHeight(true)) {
					max_h = $(elem).outerHeight(true);
				}
			}
			// position items
			var num_rows = 1;
			while (num_rows*num_rows < cur.length) {
				num_rows++;
			}
			var cur_row = 0;
			var cur_col = 0;
			for (var i=0; i < cur.length; i++) {
				var elem = cur[i].elem;
				// trigger event
				$(elem).trigger('glue-menu-activate');
				// check if we still want to show the icon ;)
				if ($(elem).css('display') == 'none') {
					continue;
				}
				if (cur_col == num_rows) {
					cur_row++;
					cur_col = 0;
				}
				// make visible
				$(elem).css('opacity', '0.0');
				$(elem).css('visibility', '');
				$(elem).animate({
					left: (x-(num_rows*max_w)/2+cur_col*max_w)+'px',
					opacity: 1.0,
					top: (y-(num_rows*max_h)/2+cur_row*max_h)+'px'
				}, 200);
				cur_col++;
			}
			// register close menu event and set prev_menu
			$('body').bind('click', close_menu);
			prev_menu = menu;
			// convert x, y to page and save them
			spawn_coords = {x: $(document).scrollLeft()+x, y: $(document).scrollTop()+y};
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
	var resize_prev_grid = false;
	var reg_objs = {};
	
	$('.resizable').live('glue-pre-clone', function(e) {
		// remove the jqueryui resizable-related stuff from the object
		$(this).removeClass('ui-resizable');
		$(this).children('.ui-resizable-handle').remove();
	});
	
	$('.object').live('resize', function(e) {
		// ignore grid when ctrl is pressed
		if (e.ctrlKey) {
			if ($(this).resizable('option', 'grid') !== false) {
				// save previous setting
				resize_prev_grid = $(this).resizable('option', 'grid');
				// disable grid
				$(this).resizable('option', 'grid', false);
			}
		} else {
			// reset previous setting
			if (resize_prev_grid) {
				$(this).resizable('option', 'grid', resize_prev_grid);
				resize_prev_grid = false;
			}
		}
		$.glue.object.resizable_update_tooltip(this);
		$(this).trigger('glue-resize');
	});
	
	$('.object').live('resizestart', function(e) {
		$(this).trigger('glue-resizestart');
	});
	
	$('.object').live('resizestop', function(e) {
			// reset previous grid setting
			if (resize_prev_grid) {
				$(this).resizable('option', 'grid', resize_prev_grid);
				resize_prev_grid = false;
			}
		$.glue.object.save(this);
		$(this).trigger('glue-resizestop');
		$.glue.canvas.update(this);
	});
	
	$(document).ready(function() {
		$.glue.object.register_alter_pre_save('resizable', function(obj, orig) {
			// remove the jqueryui resizable-related stuff from the object
			$(obj).removeClass('ui-resizable');
			$(obj).children('.ui-resizable-handle').remove();
		});
		$.glue.object.register_alter_pre_save('object', function(obj, orig) {
			// remove the jqueryui draggable-related stuff from the object
			$(obj).removeClass('ui-draggable-dragging');
		});
		$.glue.object.register_alter_pre_save('glue-selected', function(obj, orig) {
			var border = $(orig).outerHeight()-$(orig).innerHeight();
			var p = $(orig).position();
			// remove class
			$(obj).removeClass('glue-selected');
			// and remove border offset
			$(obj).css('left', (p.left+border/2)+'px');
			$(obj).css('top', (p.top+border/2)+'px');
			//$(obj).css('width', ($(orig).width()+border)+'px');
			//$(obj).css('height', ($(orig).height()+border)+'px');
		});
	});
	
	return {
		// obj .. element
		register: function(obj) {
			// prevent double registration
			if (reg_objs[$(obj).attr('id')]) {
				return false;
			} else {
				reg_objs[$(obj).attr('id')] = true;
			}
			// make sure everything has a z-index
			if (isNaN(parseInt($(obj).css('z-index')))) {
				$(obj).css('z-index', $.glue.stack.default_z());
			}
			// obj must have width & height for draggable to work
			$(obj).draggable({ addClasses: false });
			// obj must not be an img element (otherwise resizable creates a 
			// wrapper which fucks things up)
			if ($(obj).hasClass('resizable')) {
				$(obj).resizable();
				$.glue.object.resizable_update_tooltip(obj);
			}
			$(obj).trigger('glue-register');
			$.glue.canvas.update(obj);
		},
		register_alter_pre_save: function(cls, func) {
			alter_pre_save[cls] = func;
		},
		resizable_update_tooltip: function(obj) {
			var p = $(obj).position();
			// don't include any border in the calculation
			$(obj).children('.ui-resizable-handle').attr('title', $(obj).innerWidth()+'x'+$(obj).innerHeight()+' at '+p.left+'x'+p.top);
		},
		save: function(obj) {
			var elem = $(obj).clone();
			var elem_cls = $(elem).attr('class').replace(/\s+/, ' ').split(' ');
			for (var i=0; i < elem_cls.length; i++) {
				if (typeof alter_pre_save[elem_cls[i]] == 'function') {
					alter_pre_save[elem_cls[i]](elem, obj);
				}
			}
			// trim element content
			// necessary, otherwise we'd be sending \n\t back again
			$(elem).html($.trim($(elem).html()));
			// convert to string
			var html = $('<div></div>').html(elem).html();
			// DEBUG
			//console.log(html);
			$.glue.backend({ method: 'glue.save_state', 'html': html });
		},
		// obj .. element
		unregister: function(obj) {
			$(obj).trigger('glue-unregister');
			// can't update canvas here as object to be deleted is still in the 
			// dom
		}
	};
}();

$.glue.sel = function()
{
	var drag_prev_grid = false;
	var drag_prev_x = false;
	var drag_prev_y = false;
	var drag_start_x = false;
	var drag_start_y = false;
	var drag_mouse_start_x = false;
	var drag_mouse_start_x = false;
	var key_moving = false;
	
	// this could probably also be body
	$('html').bind('click', function(e) {
		if (e.target == $('body').get(0)) {
			if ($('.glue-selected').length) {
				// deselect when clicking on background
				$.glue.sel.none();
				// prevent the menu from firing
				e.stopImmediatePropagation();
			}
		}
	});
		
	$('html').bind('keydown', function(e) {
		if (e.which == 9) {
			// cycle through all objects with tab key
			if ($('.glue-selected').length < 2) {
				var next = false;
				if ($('.glue-selected').next('.object').length) {
					next = $('.glue-selected').next('.object');
				} else {
					next = $('.object').first();
				}
				if (next) {
					$.glue.sel.none();
					$.glue.sel.select(next);
					// scroll to the selected objects if not currently visible
					var window_min_x = $(document).scrollLeft();
					var window_max_x = window_min_x+$(window).width();
					var window_min_y = $(document).scrollTop();
					var window_max_y = window_min_y+$(window).height();
					var h = $(next).outerHeight();
					var p = $(next).position();
					var w = $(next).outerWidth();
					// fit the entire object on the screen
					// TODO (later): scroll a bit more up/left for the any 
					// context menu to fit in there too
					if (p.left < window_min_x) {
						$(document).scrollLeft(p.left);
					} else if (window_max_x < p.left+w) {
						$(document).scrollLeft(window_min_x+p.left+w-window_max_x);
					}
					if (p.top < window_min_y) {
						$(document).scrollTop(p.top);
					} else if (window_max_y < p.top+h) {
						$(document).scrollTop(window_min_y+p.top+h-window_max_y);
					}
				}
			}
			return false;
		} else if (33 == e.which && e.shiftKey && $('.glue-selected').length) {
			// shift+pageup: move objects to top of stack
			// we can't use ctrl+page{up,down} as this cycles through tabs
			// only prevent scrolling here
			return false;
		} else if (34 == e.which && e.shiftKey && $('.glue-selected').length) {
			// shift+pageup: move objects to bottom of stack
			return false;
		} else if (37 <= e.which && e.which <= 40 && $('.glue-selected').length) {
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
			$('.glue-selected').each(function() {
				var p = $(this).position();
				// prevent elements from going completely offscreen
				if (1 < p.left+add_x+$(this).outerWidth()) {
					$(this).css('left', (p.left+add_x)+'px');
				}
				if (1 < p.top+add_y+$(this).outerHeight()) {
					$(this).css('top', (p.top+add_y)+'px');
				}
			});
			// scroll window if neccessary
			// TODO (later): implement for moving multiple objects
			if ($('.glue-selected').length == 1) {
				var window_min_x = $(document).scrollLeft();
				var window_max_x = window_min_x+$(window).width();
				var window_min_y = $(document).scrollTop();
				var window_max_y = window_min_y+$(window).height();
				var elem = $('.glue-selected');
				var p = $(elem).position();
				var w = $(elem).outerWidth();
				var h = $(elem).outerHeight();
				if (p.left < window_min_x) {
					$(document).scrollLeft(p.left);
				} else if (window_max_x < p.left+w) {
					$(document).scrollLeft(p.left+w);
				}
				if (p.top < window_min_y) {
					$(document).scrollTop(p.top);
				} else if (window_max_y < p.top+h) {
					$(document).scrollTop(p.top+h);
				}
			}
			// trigger event (once, cleared in keyup)
			if (!key_moving) {
				$('.glue-selected').trigger('glue-movestart');
				key_moving = true;
			}
			// prevent window scrolling
			return false;
		} else if (e.ctrlKey && e.which == 65) {
			// select all objects
			$('.object').not('.glue-selected').each(function() {
				$.glue.sel.select($(this));
			});
			return false;
		} else if (e.ctrlKey && e.which == 68) {
			// select none
			$.glue.sel.none();
			return false;
		} else if (e.ctrlKey && e.which == 73) {
			// invert selection
			var next = $('.object').not('.glue-selected');
			$.glue.sel.none();
			$(next).each(function() {
				$.glue.sel.select($(this));
			});
			return false;
		} else {
			// DEBUG
			//console.log('html keydown '+e.which);
		}
	});
	
	$('html').bind('keyup', function(e) {
		if (33 == e.which && e.shiftKey && $('.glue-selected').length) {
			// shift+pageup: move objects to top of stack
			$('.glue-selected').each(function() {
				$.glue.stack.to_top($(this));
				$.glue.object.save($(this));
			});
			$.glue.stack.compress();
			return false;
		} else if (34 == e.which && e.shiftKey && $('.glue-selected').length) {
			// shift+pagedown: move objects to bottom of stack
			$('.glue-selected').each(function() {
				$.glue.stack.to_bottom($(this));
				$.glue.object.save($(this));
			});
			$.glue.stack.compress();
			return false;
		} else if (37 <= e.which && e.which <= 40 && $('.glue-selected').length) {
			// move selected elements with arrow keys
			$('.glue-selected').trigger('glue-movestop');
			key_moving = false;
			return false;
		} else if (e.which == 46 && $('.glue-selected').length) {
			// delete selected objects
			// this is pretty much copied from object-edit.js
			var objs = $('.glue-selected');
			$(objs).each(function() {
				var id = $(this).attr('id');
				$.glue.object.unregister($(this));
				$(this).remove();
				// delete in backend as well
				$.glue.backend({ method: 'glue.delete_object', name: id });
				// update canvas
				$.glue.canvas.update();
			});
			return false;
		} else {
			// DEBUG
			//console.log('html keydown '+e.which);
		}
	});
	
	$('.object').live('dragstart', function(e) {
		// contrain to axis when dragging with shift key pressed
		drag_start_x = $(this).position().left;
		drag_start_y = $(this).position().top;
		drag_mouse_start_x = e.pageX;
		drag_mouse_start_y = e.pageY;
		$(this).draggable('option', 'axis', false);
		if (!$(this).hasClass('glue-selected')) {
			// event for selected objects is triggered in the .glue-selected dragstart 
			// handler
			$(this).trigger('glue-movestart');
		}
	});
	
	$('.object').live('dragstop', function(e) {
		// reset previous grid setting
		if (drag_prev_grid) {
			$(this).draggable('option', 'grid', drag_prev_grid);
			drag_prev_grid = false;
		}
	});
	
	$('.object').live('drag', function(e) {
		// ignore grid when ctrl is pressed
		if (e.ctrlKey) {
			if ($(this).draggable('option', 'grid') !== false) {
				// save previous setting
				drag_prev_grid = $(this).draggable('option', 'grid');
				// disable grid
				$(this).draggable('option', 'grid', false);
			}
		} else {
			// reset previous setting
			if (drag_prev_grid) {
				$(this).draggable('option', 'grid', drag_prev_grid);
				drag_prev_grid = false;
			}
		}
		// contrain to axis when dragging with shift key pressed
		if (e.shiftKey) {
			var dir;
			if (Math.abs(e.pageX-drag_mouse_start_x) < Math.abs(e.pageY-drag_mouse_start_y)) {
				dir = 'y';
			} else {
				dir = 'x';
			}
			var diff = Math.abs(Math.abs(e.pageX-drag_mouse_start_x)-Math.abs(e.pageY-drag_mouse_start_y));
			if ($(this).draggable('option', 'axis') == false) {
				// move object back to the starting position
				$(this).css('left', drag_start_x+'px');
				$(this).css('top', drag_start_y+'px');
				$(this).draggable('option', 'axis', dir);
			} else {
				// only change direction if difference is greater than 50 pixels
				if (50 < diff && $(this).draggable('option', 'axis') != dir) {
					// move object back to the starting position
					$(this).css('left', drag_start_x+'px');
					$(this).css('top', drag_start_y+'px');
					$(this).draggable('option', 'axis', dir);
				}
			}
		} else {
			$(this).draggable('option', 'axis', false);
		}
	});
	
	$('.object').live('dragstop', function(e) {
		if (!$(this).hasClass('glue-selected')) {
			// event for selected objects is triggered in the .glue-selected dragstop 
			// handler
			$(this).trigger('glue-movestop');
		}
	});
	
	$('.glue-selected').live('drag', function(e) {
		if (1 < $('.glue-selected').length) {
			// dragging multiple selected object
			var that = this;
			var that_p = $(this).position();
			$('.glue-selected').each(function() {
				if (this == that) {
					return;
				}
				var p = $(this).position();
				$(this).css('left', (p.left+that_p.left-drag_prev_x)+'px');
				$(this).css('top', (p.top+that_p.top-drag_prev_y)+'px');
			});
			drag_prev_x = that_p.left;
			drag_prev_y = that_p.top;
		}
	});
	
	$('.glue-selected').live('dragstart', function(e) {
		if (1 < $('.glue-selected').length) {
			var p = $(this).position();
			drag_prev_x = p.left;
			drag_prev_y = p.top;
		}
		$('.glue-selected').trigger('glue-movestart');
	});
	
	$('.glue-selected').live('dragstop', function(e) {
		// dragging multiple selected object
		// there does not seem to be a drag event for the position where the 
		// mouse button is released, so the following is necessary
		var that = this;
		var that_p = $(this).position();
		$('.glue-selected').each(function() {
			if (this == that) {
				return;
			}
			var p = $(this).position();
			$(this).css('left', (p.left+that_p.left-drag_prev_x)+'px');
			$(this).css('top', (p.top+that_p.top-drag_prev_y)+'px');
		});
		$('.glue-selected').trigger('glue-movestop');
	});
	
	$('.object').live('click', function(e) {
		// TODO (later): moving objects after shift clicking on them does not seem to work right on Chrome, document and fill a bug upstream
		if (!e.shiftKey && !$(this).hasClass('glue-selected')) {
			$.glue.sel.none();
		}
		if (e.shiftKey && $(this).hasClass('glue-selected')) {
			$.glue.sel.deselect($(this));
		} else {
			$.glue.sel.select($(this));
		}
	});
	
	$('.object').live('glue-movestop', function(e) {
		// update tooltip
		$.glue.object.resizable_update_tooltip(this);
		// save object
		$.glue.object.save(this);
		// update canvas
		$.glue.canvas.update(this);
	});
	
	$('.object').live('glue-unregister', function(e) {
		$.glue.sel.deselect($(this));
	});
	
	return {
		// deselect an object
		// obj .. element
		deselect: function(obj) {
			if ($(obj).hasClass('glue-selected')) {
				var border = $(obj).outerHeight()-$(obj).innerHeight();
				$(obj).removeClass('glue-selected');
				$(obj).trigger('glue-deselect');
				var p = $(obj).position();
				$(obj).css('left', (p.left+border/2)+'px');
				$(obj).css('top', (p.top+border/2)+'px');
				//$(obj).css('width', ($(obj).width()+border)+'px');
				//$(obj).css('height', ($(obj).height()+border)+'px');
				// DEBUG
				//console.log('deselected '+$(obj).attr('id'));
			}
		},
		// select none
		none: function() {
			$('.glue-selected').each(function() {
				$.glue.sel.deselect($(this));
			});
		},
		// select an object
		// obj .. element
		select: function(obj) {
			// TODO (later): handle more than one obj (and change callers)
			if (!$(obj).hasClass('glue-selected')) {
				$(obj).addClass('glue-selected');
				$(obj).trigger('glue-select');
				// TODO (later): the following code works for dashed borders but 
				// not for solid ones - read out the border-style on the fly and 
				// act accordingly (there seem to be a problem with getting the 
				// information through jQuery 1.4.3 however)
				// also needs changes above and in register_alter_pre_save
				var p = $(obj).position();
				var border = $(obj).outerHeight()-$(obj).innerHeight();
				$(obj).css('left', (p.left-border/2)+'px');
				$(obj).css('top', (p.top-border/2)+'px');
				//$(obj).css('width', ($(obj).width()-border)+'px');
				//$(obj).css('height', ($(obj).height()-border)+'px');
				// DEBUG
				//console.log('selected '+$(obj).attr('id'));
			}
		},
		// return if an object is selected
		// obj .. element
		selected: function(obj) {
			return $(obj).hasClass('glue-selected');
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
			return false;
		};
		var mouseup = function(e) {
			$('html').unbind('mousemove', mousemove);
			$('html').unbind('mouseup', mouseup);
			if (typeof change == 'function') {
				change(e.pageX-old_e.pageX, e.pageY-old_e.pageY, e);
			}
			if (typeof stop == 'function') {
				stop(e.pageX-old_e.pageX, e.pageY-old_e.pageY, e);
			}
			return false;
		};
		$('html').bind('mousemove', mousemove);
		$('html').bind('mouseup', mouseup);	
	};
}();

$.glue.stack = function()
{
	var default_z = 100;
	var max_z = 199;
	var min_z = 0;
	
	var intersecting = function(a, b) {
		var a_h = $(a).outerHeight();
		var a_p = $(a).position();
		var a_w = $(a).outerWidth();
		var b_h = $(b).outerHeight();
		var b_p = $(b).position();
		var b_w = $(b).outerWidth();
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
			$('.object').each(function() {
				var z = parseInt($(this).css('z-index'));
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
				$('.object').each(function() {
					var z = parseInt($(this).css('z-index'));
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
					$('.object').each(function() {
						var z = parseInt($(this).css('z-index'));
						if (isNaN(z)) {
							return;
						} else if (i < z) {
							$(this).css('z-index', --z);
							$(this).addClass('need_save');
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
				$('.object').addClass('need_save');
			}
			// save objects
			$('.need_save').each(function() {
				var z = parseInt($(this).css('z-index'));
				if (!isNaN(z)) {
					$(this).css('z-index', z+shift);
					$.glue.object.save(this);
				}
				$(this).removeClass('need_save');
			});
		},
		default_z: function() {
			return default_z;
		},
		to_bottom: function(obj) {
			var local_min_z = max_z+1;
			var old_z = parseInt($(obj).css('z-index'));
			$('.object').each(function() {
				if (this == $(obj).get(0)) {
					return;
				}
				if (!intersecting(obj, this)) {
					return;
				} else {
					// DEBUG
					//console.log('object intersects '+$(this).attr('id'));
				}
				if ($(this).css('z-index').length) {
					var z = parseInt($(this).css('z-index'));
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
					$(obj).css('z-index', local_min_z-1);
					// DEBUG
					//console.log('set z-index to '+(local_min_z-1));
					return true;
				}
			}
			return false;
		},
		to_top: function(obj) {
			var local_max_z = min_z-1;
			var old_z = parseInt($(obj).css('z-index'));
			$('.object').each(function() {
				if (this == $(obj).get(0)) {
					return;
				}
				if (!intersecting(obj, this)) {
					return;
				} else {
					// DEBUG
					//console.log('object intersects '+$(this).attr('id'));
				}
				if ($(this).css('z-index').length) {
					var z = parseInt($(this).css('z-index'));
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
					$(obj).css('z-index', local_max_z+1);
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
					$(this.status).detach();
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
					$(this.status).detach();
				}
				// handle response
				$.glue.upload.handle_response(data, this.x, this.y);
			},
			progress: function(e) {
				// update status indicator
				// TODO (later): values are off on Chrome when uploading multiple file, one after another (it jumps back and forth) (report)
				$(this.status).children('.glue-upload-statusbar-done').css('width', (e.loaded/e.total*100)+'%');
				$(this.status).attr('title', e.loaded+' of '+e.total+' bytes ('+(e.loaded/e.total*100).toFixed(1)+'%)');
			},
			start: function(e) {
				// DEBUG
				//console.log('started uploading');
				$.glue.menu.hide();
				uploading++;
				// add status indicator to dom
				$('body').append(this.status);
				$(this.status).children('.glue-upload-statusbar-done').css('width', '0%');
				$(this.status).css('left', (this.x-$(this.status).outerWidth()/2)+'px');
				$(this.status).css('top', (this.y-$(this.status).outerHeight()/2)+'px');
			},
			status: $('<div class="glue-upload-statusbar glue-ui" style="position: absolute; z-index: 202;"><div class="glue-upload-statusbar-done"></div></div>'),
			x: orig_x,
			y: orig_y
		}
	};
	
	$(document).ready(function() {
		// generic upload button
		var elem = $('<div style="height: 32px; max-height: 32px; max-width: 32px; overflow: hidden; width: 32px;"><img src="'+$.glue.base_url+'img/upload.png" alt="btn" width="32" height="32"></div>');
		var upload = default_upload_handling();
		upload.multiple = true;
		$.glue.upload.button(elem, { method: 'glue.upload_files', page: $.glue.page }, upload);
		$(elem).bind('click', function(e) {
			// update x, y
			var p = $.glue.menu.spawn_coords();
			upload.x = p.x;
			upload.y = p.y;
		});
		$.glue.menu.register('new', elem);
		
		// handle drop events on body
		// this is based on http://developer.mozilla.org/en/using_files_from_web_applications
		// does not seem to be possible in jQuery at the moment
		// we use html here as body doesn't get enlarged when zooming out e.g.
		$('html').get(0).addEventListener('dragover', function(e) {
			e.stopPropagation();
			e.preventDefault();
		}, false);
		$('html').get(0).addEventListener('drop', function(e) {
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
			$(elem).prepend('<input type="file" title="'+options.tooltip+'" style="height: 100%; opacity: 0; position: absolute; width: 100%; z-index: 300;">');
			if (options.multiple) {
				$(elem).children('input').first().attr('multiple', 'multiple');
			}
			// add event handler
			$(elem).children('input').first().bind('change', function(e) {
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
						options.finish($.parseJSON(e.target.responseText));	
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
			} else if (files[0] && files[0].getAsBinary) {
				// DEBUG
				//console.log('upload: using getAsBinary');
				// build RFC2388 string
				var boundary = '----multipartformboundary'+(new Date).getTime();
				var builder = '';
				// other parameters
				for (var key in data) {
					builder += '--'+boundary+'\r\n';
					builder += 'Content-Disposition: form-data; name="'+key+'"'+'\r\n';
					builder += '\r\n';
					builder += JSON.stringify(data[key])+'\r\n';
				}
				// files
				for (var i=0; i < files.length; i++) {
					var file = files[i];
					builder += '--'+boundary+'\r\n';
					builder += 'Content-Disposition: form-data; name="user_file'+i+'"';
					if (file.fileName) {
						builder += '; filename="'+file.fileName+'"';
					}
					builder += '\r\n';
					if (file.type) {
						builder += 'Content-Type: '+file.type+'\r\n';
					} else {
						builder += 'Content-Type: application/octet-stream'+'\r\n';
					}
					builder += '\r\n';
					builder += file.getAsBinary();
					builder += '\r\n';
				}
				// mark end of request
				builder += '--'+boundary+'--'+'\r\n';
				xhr.setRequestHeader('Content-Type', 'multipart/form-data; boundary='+boundary);
				xhr.sendAsBinary(builder);
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
					var obj = $(data['#data'][i]);
					
					// load event handler
					var content_loaded = function(e) {
						// function scope bites us in the ass here
						var mode = e.data.mode;
						var target_x = e.data.target_x;
						var target_y = e.data.target_y;
						if ($(this).hasClass('object')) {
							var obj = $(this);						
						} else {
							var obj = $(this).parents('.object').first();
						}
						// set default width and height
						$(obj).css('width', $(obj).width()+'px');
						$(obj).css('height', $(obj).height()+'px');
						// DEBUG
						//console.log('glue-upload-dynamic-late: '+$(obj).attr('id'));
						// fire handler (can overwrite width and height)
						$(obj).trigger('glue-upload-dynamic-late', [ this ]);
						// position object
						if (mode == 'center') {
							// move to the center of mouseclick
							$(obj).css('left', (target_x-$(obj).outerWidth()/2)+'px');
							$(obj).css('top', (target_y-$(obj).outerHeight()/2)+'px');
						} else {
							// move to stack
							$(obj).css('left', (target_x+'px'));
							$(obj).css('top', (target_y+'px'));
						}
						// restore visibility
						$(obj).css('visibility', $(obj).data('orig_visibility'));
						$(obj).removeData('orig_visibility');
						// register object
						$.glue.object.register(obj);
						// save object
						$.glue.object.save(obj);
					}
					
					// set mode and target x, y
					if (data['#data'].length == 1) {
						var mode = 'center';
						var target_x = x;
						var target_y = y;
					} else {
						var mode = 'stack';
						var target_x = x+i*$.glue.grid.x();
						var target_y = y+i*$.glue.grid.y();
					}
					// check if we have dimensions already
					var width = parseInt($(obj).get(0).style.getPropertyValue('width'));
					if (isNaN(width) || width === 0) {
						// bind load event handlers
						$(obj).bind('load', { 'mode': mode, 'target_x': target_x, 'target_y': target_y }, content_loaded);
						$(obj).find('*').bind('load', { 'mode': mode, 'target_x': target_x, 'target_y': target_y }, content_loaded);
						// save initial visibility and make object invisible
						$(obj).data('orig_visibility', $(obj).css('visibility'));
						$(obj).css('visibility', 'hidden');
						// add to dom
						$('body').append(obj);
						// DEBUG
						//console.log('glue-upload-dynamic-early: '+$(obj).attr('id'));
						// fire handler
						$(obj).trigger('glue-upload-dynamic-early', [ mode, target_x, target_y ]);
					} else {
						// add to dom
						$('body').append(obj);
						// position object
						if (mode == 'center') {
							// move to the center of mouseclick
							$(obj).css('left', (target_x-$(obj).outerWidth()/2)+'px');
							$(obj).css('top', (target_y-$(obj).outerHeight()/2)+'px');
						} else {
							// move to stack
							$(obj).css('left', (target_x+'px'));
							$(obj).css('top', (target_y+'px'));
						}
						// register object
						$.glue.object.register(obj);
						// DEBUG
						//console.log('registered static upload: '+$(obj).attr('id'));
						// fire handler
						$(obj).trigger('glue-upload-static', [ mode ]);
						// save object
						$.glue.object.save(obj);
					}
				}
			}
		}
	};
}();


$(document).ready(function() {
	// register all objects
	$('.object').each(function() {
		$.glue.object.register($(this));
	});
	
	// make sure we call enlarge body even if there are no objects
	$.glue.canvas.update();
	
	// enlarge body when we resize the window
	var resize_timer;
	$(window).bind('resize', function(e) {
		clearTimeout(resize_timer);
		resize_timer = setTimeout(function() {
			$.glue.canvas.update();
		}, 100);
	});
	
	// trigger menus on click and doubleclick
	var menu_dblclick_timeout = false;
	$('html').bind('click', function(e) {
		// we use 'html' here to give the colorpicker et al a chance to stop the 
		// propagation of the event in 'body'
		if (e.target == $('body').get(0)) {
			if (!$.glue.menu.is_shown()) {
				if (menu_dblclick_timeout) {
					clearTimeout(menu_dblclick_timeout);
					menu_dblclick_timeout = false;
					// show page menu
					$.glue.menu.show('page', e.clientX, e.clientY);
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
	
	// I really don't know why, but when we don't handle the mousedown event here 
	// double-clicking the page does select some object (the first child of body 
	// on Firefox and the nearest element on Chrome)
	$('html').bind('mousedown', function(e) {
		return false;	
	});
});
