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
		$.glue.colorpicker.show($('html').css('background-color'), false, function(col) {
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
			// update tooltip
			$(elem).attr('title', 'show/hide grid or change grid size by dragging ('+$.glue.grid.x()+'x'+$.glue.grid.y()+')');
			// close menu
			$.glue.menu.hide();
		});
		return false;
	});
	$.glue.menu.register('page', elem);
});
