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
	var elem = document.createElement('img');
	elem.src = $.glue.base_url+'modules/page/page-title.png';
	elem.alt = 'btn';
	elem.title = 'change page title';
	elem.width = 32;
	elem.height = 32;
	elem.addEventListener('click', function(e) {
		var title = document.title;
		title = prompt('Change the page title', title);
		if (title === null) {
			return;
		}
		document.title = title;
		$.glue.backend({ method: 'glue.update_object', name: $.glue.page+'.page', 'page-title': title });
	});
	$.glue.menu.register('page', elem);

	elem = document.createElement('img');
	elem.src = $.glue.base_url+'modules/page/page-url.png';
	elem.alt = 'btn';
	elem.title = "change the page's url";
	elem.width = 32;
	elem.height = 32;
	elem.addEventListener('click', function(e) {
		var old_pn = $.glue.page.split('.').shift();
		var new_pn = prompt('Change the page URL', old_pn);
		if (new_pn != null && new_pn != old_pn) {
			// check if the current page is also the starting page
			$.glue.backend({ method: 'glue.get_startpage' }, function(data) {
				var is_startpage = false;
				if (data == $.glue.page) {
					is_startpage = true;
				}
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
		}
		$.glue.menu.hide();
	});
	$.glue.menu.register('page', elem);

	// TODO (later): only display if not already the starting page
	elem = document.createElement('img');
	elem.src = $.glue.base_url+'modules/page/page-set-startpage.png';
	elem.alt = 'btn';
	elem.title = 'make this the start page';
	elem.width = 32;
	elem.height = 32;
	elem.addEventListener('click', function(e) {
		$.glue.backend({ method: 'glue.set_startpage', page: $.glue.page });
		$.glue.menu.hide();
	});
	$.glue.menu.register('page', elem);

	elem = document.createElement('img');
	elem.src = $.glue.base_url+'img/background-color.png';
	elem.alt = 'btn';
	elem.title = 'change the background color';
	elem.width = 32;
	elem.height = 32;
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

	elem = document.createElement('img');
	elem.src = $.glue.base_url+'modules/page/page-new.png';
	elem.alt = 'btn';
	elem.title = 'create a new page';
	elem.width = 32;
	elem.height = 32;
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

	elem = document.createElement('img');
	elem.src = $.glue.base_url+'modules/page/page-delete.png';
	elem.alt = 'btn';
	elem.title = 'delete page';
	elem.width = 32;
	elem.height = 32;
	elem.addEventListener('click', function(e) {
		if (confirm('Really delete the current page and all it\'s revisions?')) {
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
		}
		$.glue.menu.hide();
	});
	$.glue.menu.register('page', elem);

	elem = document.createElement('div');
	elem.style.height = '32px';
	elem.style.maxHeight = '32px';
	elem.style.maxWidth = '32px';
	elem.style.overflow = 'hidden';
	elem.style.width = '32px';
	var bgImg = document.createElement('img');
	bgImg.src = $.glue.base_url+'modules/page/page-background-image.png';
	bgImg.alt = 'btn';
	bgImg.width = 32;
	bgImg.height = 32;
	elem.appendChild(bgImg);
	var upload = {
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
		},
		tooltip: 'upload a background image'
	};
	$.glue.upload.button(elem, { method: 'glue.upload_files', page: $.glue.page, preferred_module: 'page' }, upload);
	$.glue.menu.register('page', elem);

	elem = document.createElement('div');
	elem.id = 'glue-menu-page-background-scroll';
	elem.setAttribute('alt', 'btn');
	elem.style.height = '32px';
	elem.style.width = '32px';
	$.glue.toggle_button(elem, 'page_bg_scroll_sync', 'page_bg_scroll_toggle',
		'background scrolls with the page - click to make it fixed',
		'background is fixed - click to make it scroll with the page');
	$.glue.menu.register('page', elem);

	elem = document.createElement('img');
	elem.src = $.glue.base_url+'modules/page/page-background-image-pos.png';
	elem.alt = 'btn';
	elem.title = 'adjust background image selection';
	elem.width = 32;
	elem.height = 32;
	elem.addEventListener('glue-menu-activate', function(e) {
		var toggleElem = document.getElementById('glue-menu-page-background-scroll');
		var bg = getComputedStyle(document.documentElement).backgroundImage;
		if (bg.length != 0 && bg != 'none') {
			toggleElem.style.display = 'block';
		} else {
			toggleElem.style.display = 'none';
		}
	});
	elem.addEventListener('mousedown', function(e) {
		var a = getComputedStyle(document.documentElement).backgroundPosition.split(' ');
		if (a.length != 2) {
			var prev_x_pos = 0;
			var prev_y_pos = 0;
		} else {
			// we assume px (or 0%..)
			var prev_x_pos = parseInt(a[0]);
			if (isNaN(prev_x_pos)) {
				prev_x_pos = 0;
			}
			var prev_y_pos = parseInt(a[1]);
			if (isNaN(prev_y_pos)) {
				prev_y_pos = 0;
			}
		}
		var no_change = true;
		$.glue.slider(e, function(x, y) {
			// background-position-{x,y} does not work in Firefox (but seems to be faster)
			document.documentElement.style.backgroundPosition = (prev_x_pos+x)+'px '+(prev_y_pos+y)+'px';
			if (x != 0 || y != 0) {
				no_change = false;
			}
		}, function(x, y) {
			// reset background position if there was no change at all
			if (no_change) {
				document.documentElement.style.backgroundPosition = '';
				$.glue.backend({ method: 'glue.object_remove_attr', name: $.glue.page+'.page', attr: 'page-background-image-position' });
			} else {
				$.glue.backend({ method: 'glue.update_object', name: $.glue.page+'.page', 'page-background-image-position': getComputedStyle(document.documentElement).backgroundPosition });
			}
		});
		e.preventDefault();
		return false;
	});
	$.glue.menu.register('page', elem);

	elem = document.createElement('img');
	elem.src = $.glue.base_url+'modules/page/page-grid.png';
	elem.width = 32;
	elem.height = 32;
	// also change tilte below
	elem.title = 'show/hide grid or change grid size by dragging ('+$.glue.grid.x()+'x'+$.glue.grid.y()+')';
	elem.addEventListener('mousedown', function(e) {
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
});
