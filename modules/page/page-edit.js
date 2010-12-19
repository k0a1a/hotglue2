/**
 *	modules/page/page-edit.js
 *	Frontend code for general page properties
 *
 *	Copyright Gottfried Haider, Danja Vasiliev 2010.
 *	This source code is licensed under the GNU General Public License.
 *	See the file COPYING for more details.
 */

$(document).ready(function() {
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
	var elem;
	elem = $('<img src="'+$.glue.base_url+'modules/page/page-new.png" alt="btn" title="create a new page" width="32" height="32">');
	$(elem).bind('click', function(e) {
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
		
	elem = $('<img src="'+$.glue.base_url+'modules/page/page-title.png" alt="btn" title="change page title" width="32" height="32">');
	$(elem).bind('click', function(e) {
		var title = $('title').html();
		title = prompt('Change the page title', title);
		if (title === null) {
			return;
		}
		$('title').html(title);
		$.glue.backend({ method: 'glue.update_object', name: $.glue.page+'.page', 'page-title': title });
	});
	$.glue.menu.register('page', elem);
	
	elem = $('<img src="'+$.glue.base_url+'img/background-color.png" alt="btn" title="change the background color" width="32" height="32">');
	$(elem).bind('click', function(e) {
		if ($('html').css('background-image').length != 0 && $('html').css('background-image') != 'none') {
			if (confirm('Do you want to clear the current background image?')) {
				$.glue.backend({ method: 'page.clear_background_img', page: $.glue.page });
				$('html').css('background-image', '');
			} else {
				$.glue.menu.hide();
				return;
			}
		}
		var col = $('html').css('background-color');
		if (e.shiftKey) {
			col = prompt('Enter background color (e.g. #ff0000 or rgb(255, 0, 0))', col);
			if (!col) {
				return;
			}
		}
		$.glue.colorpicker.show(col, false, function(col) {
			$('html').css('background-color', col);
		}, function(col) {
			// update grid as well
			$.glue.grid.update(true);
			$.glue.backend({ method: 'glue.update_object', name: $.glue.page+'.page', 'page-background-color': col });
		});
		$.glue.menu.hide();
	});
	$.glue.menu.register('page', elem);
	
	elem = $('<img src="'+$.glue.base_url+'modules/page/page-grid.png" width="32" height="32">');
	// also change tilte below
	$(elem).attr('title', 'show/hide grid or change grid size by dragging ('+$.glue.grid.x()+'x'+$.glue.grid.y()+')');
	$(elem).bind('mousedown', function(e) {
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
			$(that).attr('title', 'show/hide grid or change grid size by dragging ('+$.glue.grid.x()+'x'+$.glue.grid.y()+')');
			// close menu
			$.glue.menu.hide();
		});
		return false;
	});
	$.glue.menu.register('page', elem);
	
	elem = $('<div style="height: 32px; max-height: 32px; max-width: 32px; overflow: hidden; width: 32px;"><img src="'+$.glue.base_url+'modules/page/page-background-image.png" alt="btn" width="32" height="32"></div>');
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
				$('html').css('background-image', 'url('+$.glue.base_url+'?'+$.glue.page+'.page&'+(new Date().getTime())+')');
			}
			$.glue.menu.hide();
		},
		tooltip: 'upload a background image'
	};
	$.glue.upload.button(elem, { method: 'glue.upload_files', page: $.glue.page, preferred_module: 'page' }, upload);
	$.glue.menu.register('page', elem);
	
	elem = $('<div id="glue-menu-page-background-scroll" alt="btn" style="height: 32px; width: 32px;" title="toggle between having the background image fixed or having it scroll with the rest of the page">');
	$(elem).bind('glue-menu-activate', function(e) {
		var elem = $('#glue-menu-page-background-scroll');
		if ($('html').css('background-image').length != 0 && $('html').css('background-image') != 'none') {
			if ($('html').css('background-attachment') == 'fixed') {
				$(elem).removeClass('glue-menu-enabled');
				$(elem).addClass('glue-menu-disabled');
			} else {
				$(elem).addClass('glue-menu-enabled');
				$(elem).removeClass('glue-menu-disabled');
			}
			$(elem).css('display', 'block');
		} else {
			$(elem).css('display', 'none');
		}
	});
	$(elem).bind('click', function(e) {
		if ($('html').css('background-attachment') == 'fixed') {
			$('html').css('background-attachment', 'scroll');
			$.glue.backend({ method: 'glue.update_object', name: $.glue.page+'.page', 'page-background-attachment': 'scroll' });
			$(this).addClass('glue-menu-enabled');
			$(this).removeClass('glue-menu-disabled');
		} else {
			$('html').css('background-attachment', 'fixed');
			$.glue.backend({ method: 'glue.update_object', name: $.glue.page+'.page', 'page-background-attachment': 'fixed' });
			$(this).removeClass('glue-menu-enabled');
			$(this).addClass('glue-menu-disabled');
		}
		$.glue.menu.hide();
	});
	$.glue.menu.register('page', elem);
	
	elem = $('<img src="'+$.glue.base_url+'modules/page/page-background-image-pos.png" alt="btn" title="adjust background image selection" width="32" height="32">');
	$(elem).bind('glue-menu-activate', function(e) {
		var elem = $('#glue-menu-page-background-scroll');
		if ($('html').css('background-image').length != 0 && $('html').css('background-image') != 'none') {
			$(elem).css('display', 'block');
		} else {
			$(elem).css('display', 'none');
		}
	});
	$(elem).bind('mousedown', function(e) {
		var a = $('html').css('background-position').split(' ');
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
			$('html').css('background-position', (prev_x_pos+x)+'px '+(prev_y_pos+y)+'px');
			if (x != 0 || y != 0) {
				no_change = false;
			}
		}, function(x, y) {
			// reset background position if there was no change at all
			if (no_change) {
				$('html').css('background-position', '');
				$.glue.backend({ method: 'glue.object_remove_attr', name: $.glue.page+'.page', attr: 'page-background-image-position' });
			} else {
				$.glue.backend({ method: 'glue.update_object', name: $.glue.page+'.page', 'page-background-image-position': $('html').css('background-position') });
			}
		});
		return false;
	});
	$.glue.menu.register('page', elem);
	
	elem = $('<img src="'+$.glue.base_url+'modules/page/page-delete.png" alt="btn" title="delete page" width="32" height="32">');
	$(elem).bind('click', function(e) {
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
	
	elem = $('<img src="'+$.glue.base_url+'modules/page/page-url.png" alt="btn" title="change the page&#039;s url" width="32" height="32">');
	$(elem).bind('click', function(e) {
		var old_pn = $.glue.page.split('.').shift();
		var new_pn = prompt('Change the page URL', old_pn);
		if (new_pn != null && new_pn != old_pn) {
			$.glue.backend({ method: 'glue.rename_page', 'old': old_pn, 'new': new_pn }, function(data) {
				// redirect to new url
				window.location = $.glue.base_url+'?'+new_pn+'/edit';
			});
		}
		$.glue.menu.hide();
	});
	$.glue.menu.register('page', elem);
	
	// TODO (later): glue.get_startpage
	elem = $('<img src="'+$.glue.base_url+'modules/page/page-set-startpage.png" alt="btn" title="make this the start page" width="32" height="32">');
	$(elem).bind('click', function(e) {
		$.glue.backend({ method: 'glue.set_startpage', page: $.glue.page });
		$.glue.menu.hide();
	});
	$.glue.menu.register('page', elem);
});
