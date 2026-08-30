/**
 *	modules/page/page-edit.js
 *	Frontend code for general page properties
 *
 *	Copyright Gottfried Haider, Danja Vasiliev 2010.
 *	This source code is licensed under the GNU General Public License.
 *	See the file COPYING for more details.
 */

function page_bg_scroll_sync(elem) {
	var bg = getComputedStyle(document.documentElement).backgroundImage;
	var has_bg = (bg.length != 0 && bg != 'none');
	elem.style.display = has_bg ? 'block' : 'none';
	Alpine.$data(elem).enabled = (getComputedStyle(document.documentElement).backgroundAttachment != 'fixed');
}

function page_bg_scroll_toggle(elem) {
	var data = Alpine.$data(elem);
	if (getComputedStyle(document.documentElement).backgroundAttachment == 'fixed') {
		document.documentElement.style.backgroundAttachment = 'scroll';
		$.glue.backend({ method: 'glue.update_object', name: $.glue.page+'.page', 'page-background-attachment': 'scroll' });
		data.enabled = true;
	} else {
		document.documentElement.style.backgroundAttachment = 'fixed';
		$.glue.backend({ method: 'glue.update_object', name: $.glue.page+'.page', 'page-background-attachment': 'fixed' });
		data.enabled = false;
	}
}


// --- centered layout mode -------------------------------------------------
//
// The container is rendered server-side (module_page.inc.php,
// page_render_page_late) and objects live inside it with their coordinates
// untouched. What the editor adds is the two edge handles: they show where the
// container's boundary is while authoring, and dragging one sets its width.
//
// The container is centered, so moving one edge by dx changes the width by
// 2*dx - the opposite edge moves the same amount the other way.

function page_container_handles_update() {
	var wrap = $.glue.canvas.wrapper();
	var handles = document.querySelectorAll('.glue-container-handle');
	if (!wrap) {
		handles.forEach(function(h) { h.style.display = 'none'; });
		return;
	}
	var box = wrap.getBoundingClientRect();
	handles.forEach(function(h) {
		h.style.display = 'block';
		h.style.left = (h.dataset.edge == 'left' ? box.left : box.right) + 'px';
	});
}

function page_container_handle_make(edge) {
	var h = document.createElement('div');
	h.className = 'glue-container-handle glue-ui';
	h.dataset.edge = edge;
	h.title = 'drag to set how wide the centered container is';
	h.style.touchAction = 'none';
	h.addEventListener('pointerdown', function(e) {
		var wrap = $.glue.canvas.wrapper();
		if (!wrap) {
			return;
		}
		if (!e.isPrimary) {
			return;
		}
		e.preventDefault();
		var box = wrap.getBoundingClientRect();
		var centre = box.left + box.width/2;
		var min = $.glue.conf.page.container_min;
		var max = $.glue.conf.page.container_max;
		var width = box.width;

		function move(ev) {
			// centered: the distance from the centre IS half the width
			width = Math.round(Math.abs(ev.clientX - centre) * 2);
			width = Math.max(min, Math.min(max, width));
			wrap.style.width = width + 'px';
			page_container_handles_update();
			$.glue.grid.update();
		}
		function up() {
			document.removeEventListener('pointermove', move);
			document.removeEventListener('pointerup', up);
			document.removeEventListener('pointercancel', up);
			$.glue.backend({ method: 'page.set_layout', page: $.glue.page, width: width });
		}
		document.addEventListener('pointermove', move);
		document.addEventListener('pointerup', up);
		document.addEventListener('pointercancel', up);
	});
	document.body.appendChild(h);
	return h;
}

function page_layout_toggle() {
	var centered = !!$.glue.canvas.wrapper();
	$.glue.backend({
		method: 'page.set_layout',
		page: $.glue.page,
		mode: centered ? 'infinite' : 'centered'
	}, function(resp) {
		if (resp['#error']) {
			$.glue.error(resp['#data'] || resp['#error']);
			return;
		}
		// The container is part of the server-rendered markup, so reload rather
		// than rebuilding the DOM here - it keeps one definition of what each
		// mode renders as, instead of a second one in the editor that could
		// drift from it.
		window.location.reload();
	});
}

document.addEventListener('DOMContentLoaded', function() {
	// set grid
	$.glue.grid.x($.glue.conf.page.default_grid_x);
	$.glue.grid.y($.glue.conf.page.default_grid_y);

	// set guides
	for (i in $.glue.conf.page.guides_x) {
		$.glue.grid.add_guide_x($.glue.conf.page.guides_x[i]);
	}
	for (i in $.glue.conf.page.guides_y) {
		$.glue.grid.add_guide_y($.glue.conf.page.guides_y[i]);
	}

	//
	// register menu items
	//
	//
	// page settings: the page menu's page-level controls live here - title,
	// url, start page, delete - opened from the one menu button. The panel
	// opens anchored to the click, like the font popover.
	//
	var page_settings_popover = function() {
		var pop = $.glue.popover.open(document.documentElement, 'glue-page-settings-popover');
		if (!pop) {
			return;
		}

		// --- page title ---------------------------------------------------
		var row = $.glue.popover.row('page title');
		var title_field = document.createElement('input');
		title_field.type = 'text';
		title_field.className = 'glue-popover-field glue-page-title';
		title_field.value = document.title;
		title_field.title = 'the title shown in the browser tab and to search engines';
		// commit on change (blur or Enter), not per keystroke: the title is
		// an attribute of the page, not text being edited
		title_field.addEventListener('change', function() {
			var title = this.value.trim();
			if (title === document.title) {
				return;
			}
			document.title = title;
			$.glue.backend({ method: 'glue.update_object', name: $.glue.page+'.page', 'page-title': title });
		});
		row.appendChild(title_field);
		pop.appendChild(row);

		// --- page url -----------------------------------------------------
		row = $.glue.popover.row('page url');
		var url_field = document.createElement('input');
		url_field.type = 'text';
		url_field.className = 'glue-popover-field glue-page-url';
		url_field.value = $.glue.page.split('.').shift();
		url_field.title = 'the URL of this page';
		url_field.addEventListener('change', function() {
			var old_pn = $.glue.page.split('.').shift();
			var new_pn = this.value.trim();
			if (new_pn === old_pn) {
				return;
			}
			// check if the current page is also the starting page
			$.glue.backend({ method: 'glue.get_startpage' }, function(data) {
				var is_startpage = (data == $.glue.page);
				$.glue.backend({ method: 'glue.rename_page', 'old': old_pn, 'new': new_pn }, function(data) {
					if (is_startpage) {
						// change startpage accordingly
						$.glue.backend({ method: 'glue.set_startpage', page: new_pn+'.head' }, function(data) {
							// redirect to new url
							window.location = $.glue.base_url+'?'+new_pn+'/edit';
						});
					} else {
						// redirect to new url
						window.location = $.glue.base_url+'?'+new_pn+'/edit';
					}
				});
			});
		});
		row.appendChild(url_field);
		pop.appendChild(row);

		// --- start page ---------------------------------------------------
		row = $.glue.popover.row('start page');
		var start_check = document.createElement('input');
		start_check.type = 'checkbox';
		start_check.title = 'make this the page visitors land on';
		// sync with reality when the panel opens
		$.glue.backend({ method: 'glue.get_startpage' }, function(data) {
			start_check.checked = (data == $.glue.page);
		});
		start_check.addEventListener('change', function() {
			// an empty value clears the startpage - get_startpage then
			// falls back to the default page
			$.glue.backend({ method: 'glue.set_startpage',
				page: this.checked ? $.glue.page : '' });
		});
		row.appendChild(start_check);
		pop.appendChild(row);

		// --- delete page --------------------------------------------------
		var footer = $.glue.popover.row(false);
		footer.appendChild($.glue.popover.delete('delete this page and all its revisions', function() {
			if (!confirm('Really delete the current page and all its revisions?')) {
				return;
			}
			var pn = $.glue.page.split('.').shift();
			var pages = [];
			// get all revisions
			$.glue.backend({ method: 'glue.revisions', pagename: pn }, function(data) {
				for (var rev in data) {
					pages.push(pn+'.'+data[rev]);
				}
				// and delete them
				for (var page in pages) {
					// DEBUG
					//console.log('deleting '+pages[page]);
					$.glue.backend({ method: 'glue.delete_page', 'page': pages[page] });
				}
				// TODO (later): check if all revisions were indeed deleted
				// redirect to "pages" controller
				window.location = $.glue.base_url+'?pages';
			});
		}));
		pop.appendChild(footer);

		$.glue.popover.show(pop);
	};

	var elem = $.glue.icon('page-title', 'page settings');
	elem.addEventListener('click', function(e) {
		$.glue.menu.hide();
		page_settings_popover();
	});
	$.glue.menu.register('page', elem);

	elem = $.glue.icon('color-swatch', 'change the background color');
	elem.addEventListener('click', function(e) {
		var bg = getComputedStyle(document.documentElement).backgroundImage;
		if (bg.length != 0 && bg != 'none') {
			if (confirm('Do you want to clear the current background image?')) {
				$.glue.backend({ method: 'page.clear_background_img', page: $.glue.page });
				document.documentElement.style.backgroundImage = '';
			} else {
				$.glue.menu.hide();
				return;
			}
		}
		var col = getComputedStyle(document.documentElement).backgroundColor;
		if (e.shiftKey) {
			col = prompt('Enter background color (e.g. #ff0000 or rgb(255, 0, 0))', col);
			if (!col) {
				return;
			}
		}
		$.glue.colorpicker.show(col, false, function(col) {
			document.documentElement.style.backgroundColor = col;
		}, function(col) {
			// update grid as well
			$.glue.grid.update(true);
			$.glue.backend({ method: 'glue.update_object', name: $.glue.page+'.page', 'page-background-color': col });
		});
		$.glue.menu.hide();
	});
	$.glue.menu.register('page', elem);

	elem = $.glue.icon('page-new', 'create a new page');
	elem.addEventListener('click', function(e) {
		$.glue.menu.hide();
		var pn = prompt('Name the page to be created');
		if (pn === null) {
			return;
		}
		$.glue.backend({ method: 'glue.create_page', page: pn+'.head' }, function(data) {
			// redirect to newly created page
			window.location = $.glue.base_url+'?'+pn+'/edit';
		});
	});
	$.glue.menu.register('page', elem);

	//
	// page background: the menu button uploads when there is no image (the
	// button IS the file input, like the object background's), and opens a
	// panel - the object background panel's twin - when there is one. The
	// page stores its background as attrs on the page object
	// (page-background-file/-mime from the upload, plus the repeat, position
	// and size attrs below), which page_render_object() applies for visitors.
	//
	var page_bg_has = function() {
		var bg = getComputedStyle(document.documentElement).backgroundImage;
		return bg.length != 0 && bg != 'none';
	};
	var page_background_popover = function() {
		var doc = document.documentElement;
		var pop = $.glue.popover.open(doc, 'glue-background-popover');
		if (!pop) {
			return;
		}

		// --- tile or not ---------------------------------------------------
		var repeat_row = $.glue.popover.row('tile');
		var repeat = document.createElement('div');
		repeat.className = 'glue-font-toggle glue-background-repeat';
		repeat.textContent = '\u25a6';
		repeat.title = 'repeat the image across the page';
		var sync_repeat = function() {
			repeat.classList.toggle('glue-font-toggle-on',
				getComputedStyle(doc).backgroundRepeat.indexOf('no-repeat') == -1);
		};
		repeat.addEventListener('click', function() {
			var tiled = getComputedStyle(doc).backgroundRepeat.indexOf('no-repeat') == -1;
			doc.style.backgroundRepeat = tiled ? 'no-repeat' : 'repeat';
			sync_repeat();
			if (tiled) {
				// absent means the browser default, which is repeat
				$.glue.backend({ method: 'glue.object_remove_attr', name: $.glue.page+'.page', attr: 'page-background-repeat' });
			} else {
				$.glue.backend({ method: 'glue.update_object', name: $.glue.page+'.page', 'page-background-repeat': 'no-repeat' });
			}
		});
		sync_repeat();
		repeat_row.appendChild(repeat);
		pop.appendChild(repeat_row);

		// --- move it around -------------------------------------------------
		//
		// The object panel's pad, and the same control that used to sit in
		// the page menu on its own. A click with no drag puts the image back
		// to the corner, dropping the attribute.
		var move_row = $.glue.popover.row('move');
		var pad = document.createElement('div');
		pad.className = 'glue-background-pad';
		pad.title = 'drag to move the image, click to put it back';
		pad.textContent = '\u2725';
		pad.style.touchAction = 'none';
		pad.addEventListener('pointerdown', function(e) {
			if (!e.isPrimary) {
				return;
			}
			var start = getComputedStyle(doc).backgroundPosition.split(' ');
			var from_x = parseInt(start[0]);
			var from_y = parseInt(start[1]);
			if (isNaN(from_x)) {
				from_x = 0;
			}
			if (isNaN(from_y)) {
				from_y = 0;
			}
			var moved = false;
			$.glue.slider(e, function(x, y) {
				doc.style.backgroundPosition = (from_x+x)+'px '+(from_y+y)+'px';
				if (x != 0 || y != 0) {
					moved = true;
				}
			}, function(x, y) {
				if (!moved) {
					// emptied rather than set to 0 0, so the page object drops
					// the attribute
					doc.style.backgroundPosition = '';
					$.glue.backend({ method: 'glue.object_remove_attr', name: $.glue.page+'.page', attr: 'page-background-image-position' });
				} else {
					$.glue.backend({ method: 'glue.update_object', name: $.glue.page+'.page', 'page-background-image-position': getComputedStyle(doc).backgroundPosition });
				}
			});
			e.preventDefault();
		});
		move_row.appendChild(pad);
		pop.appendChild(move_row);

		// --- size it ---------------------------------------------------------
		//
		// A percentage of the page's width, the height keeping the image's
		// own ratio - the object panel's row. 100 is what the row shows when
		// nothing is stored; it is not written until the scale is actually
		// touched, and a zero clears the attribute again.
		var scale_row = $.glue.popover.number_row('scale', {
			min: 10, max: 300, step: 1, unit: '%',
			value: parseFloat(doc.style.backgroundSize) || 100,
			apply: function(pct, commit) {
				if (!pct || pct < 0) {
					doc.style.backgroundSize = '';
					scale_row.set(0);
				} else {
					doc.style.backgroundSize = pct+'% auto';
				}
				if (commit) {
					if (!pct || pct < 0) {
						$.glue.backend({ method: 'glue.object_remove_attr', name: $.glue.page+'.page', attr: 'page-background-size' });
					} else {
						$.glue.backend({ method: 'glue.update_object', name: $.glue.page+'.page', 'page-background-size': pct+'% auto' });
					}
				}
			}
		});
		pop.appendChild(scale_row.row);

		// --- take it off, or put it back --------------------------------------
		var footer = $.glue.popover.row(false);
		footer.appendChild($.glue.popover.delete('remove the background image', function() {
			doc.style.backgroundImage = '';
			doc.style.backgroundRepeat = '';
			doc.style.backgroundPosition = '';
			doc.style.backgroundSize = '';
			$.glue.popover.close();
			$.glue.backend({ method: 'page.clear_background_img', page: $.glue.page }, function(data) {
				// the file and its settings are gone with it
				$.glue.backend({ method: 'glue.object_remove_attr', name: $.glue.page+'.page',
					attr: ['page-background-repeat', 'page-background-image-position', 'page-background-size'] });
			});
			// the menu button goes back to being a file picker
			page_bg_sync(page_bg_button);
		}));
		footer.appendChild($.glue.popover.reset('reset tiling, position and scale to their defaults', function() {
			doc.style.backgroundRepeat = '';
			doc.style.backgroundPosition = '';
			doc.style.backgroundSize = '';
			$.glue.backend({ method: 'glue.object_remove_attr', name: $.glue.page+'.page',
				attr: ['page-background-repeat', 'page-background-image-position', 'page-background-size'] });
		}));
		pop.appendChild(footer);

		$.glue.popover.show(pop);
	};
	// the menu button: upload when there is no image, the panel when there is
	var page_bg_button = $.glue.icon('page-background-image', 'background image');
	var page_bg_data = { method: 'glue.upload_files', page: $.glue.page, preferred_module: 'page' };
	$.glue.upload.button(page_bg_button, page_bg_data, {
		tooltip: 'background image',
		error: function(e) {
			if (e && e.target && e.target.status) {
				$.glue.error('There was a problem uploading a file (status '+e.target.status+')');
			} else {
				$.glue.error('There was a problem uploading a file. Make sure you are not exceeding the file size limits set in the server configuration.');
				// DEBUG
				console.error(e);
			}
			$.glue.menu.hide();
		},
		finish: function(data) {
			if (!data) {
				$.glue.error('There was a problem communicating with the server');
			} else if (data['#error']) {
				$.glue.error('There was a problem uploading the file ('+data['#data']+')');
			} else {
				// the timestamp here is to trick any caching going on
				document.documentElement.style.backgroundImage = 'url('+$.glue.base_url+'?'+$.glue.page+'.page&'+(new Date().getTime())+')';
			}
			$.glue.menu.hide();
			page_bg_sync(page_bg_button);
		}
	});
	var page_bg_input = page_bg_button.querySelector('input[type=file]');
	var page_bg_sync = function(button) {
		var has = page_bg_has();
		page_bg_input.style.display = has ? 'none' : '';
		button.title = has ? 'background image: tile it, move it, remove it' : 'background image';
	};
	page_bg_button.addEventListener('glue-menu-activate', function(e) {
		page_bg_sync(this);
	});
	page_bg_button.addEventListener('click', function(e) {
		if (page_bg_has()) {
			page_background_popover();
			e.stopPropagation();
		}
	});
	$.glue.menu.register('page', page_bg_button);

	elem = document.createElement('div');
	elem.id = 'glue-menu-page-background-scroll';
	elem.setAttribute('alt', 'btn');
	elem.style.height = '32px';
	elem.style.width = '32px';
	$.glue.toggle_button(elem, 'page_bg_scroll_sync', 'page_bg_scroll_toggle',
		'background scrolls with the page - click to make it fixed',
		'background is fixed - click to make it scroll with the page');
	$.glue.menu.register('page', elem);

	elem = $.glue.icon('adjust-grid-size', 'show/hide grid or change grid size by dragging ('+$.glue.grid.x()+'x'+$.glue.grid.y()+')');
	elem.style.touchAction = 'none';
	elem.addEventListener('pointerdown', function(e) {
		if (!e.isPrimary) {
			return;
		}
		var that = this;
		$.glue.slider(e, function(x, y, evt) {
			// rectangular grid when pressing shift
			if (evt.shiftKey) {
				if (x < y) {
					x = y;
				} else {
					y = x;
				}
			}
			// only update grid when grid size is <= 10px for performance reasons
			var update = false;
			if (10 <= Math.abs(x)) {
				$.glue.grid.mode(1);
				$.glue.grid.x(Math.abs(x));
				update = true;
			}
			if (10 <= Math.abs(y)) {
				$.glue.grid.mode(1);
				$.glue.grid.y(Math.abs(y));
				update = true;
			}
			if (update) {
				$.glue.grid.update(true);
			}
		}, function(x, y) {
			if (Math.abs(x) < 10 && Math.abs(y) < 10) {
				if ($.glue.grid.mode()) {
					$.glue.grid.mode(0);
				} else {
					$.glue.grid.mode(1);
				}
				$.glue.grid.update();
			}
			// update backend
			$.glue.backend({ method: 'page.set_grid', 'x': $.glue.grid.x(), 'y': $.glue.grid.y() });
			// update tooltip
			that.title = 'show/hide grid or change grid size by dragging ('+$.glue.grid.x()+'x'+$.glue.grid.y()+')';
			// close menu
			$.glue.menu.hide();
		});
		e.preventDefault();
		return false;
	});
	$.glue.menu.register('page', elem, 13);

	// centered/infinite layout toggle
	// The label used to name the destination ("wide" while centered) while the
	// tooltip described the present, and the icon keeps that split: it shows
	// the mode you are about to switch TO, not the one you are in. Picked once
	// here because toggling reloads the page.
	elem = $.glue.conf.page.layout_mode == 'centered' ?
		$.glue.icon('composition-mode-absolute',
			'page content is centered in a fixed-width container - click for the unbounded canvas') :
		$.glue.icon('composition-mode-centered',
			'page content sits on an unbounded canvas - click to center it in a fixed-width container');
	elem.addEventListener('click', function(e) {
		$.glue.menu.hide();
		page_layout_toggle();
	});
	$.glue.menu.register('page', elem, 14);

	// container edge handles, in centered mode only
	if ($.glue.canvas.wrapper()) {
		page_container_handle_make('left');
		page_container_handle_make('right');
		page_container_handles_update();
		window.addEventListener('resize', page_container_handles_update);
		window.addEventListener('scroll', page_container_handles_update);
	}
});
