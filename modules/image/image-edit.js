/**
 *	modules/image/image-edit.js
 *	Frontend code for image objects
 *
 *	Copyright Gottfried Haider, Danja Vasiliev 2010.
 *	This source code is licensed under the GNU General Public License.
 *	See the file COPYING for more details.
 */

// TODO (later): make this a closure as well
$.glue.image = $.glue.image || {};
$.glue.image.preload_obj = false;
$.glue.image.preload_timer = false;

$('.image').live('glue-resizestop', function(e) {
	if ($.glue.conf.image.resizing && $(this).css('background-repeat') == 'no-repeat') {
		var that = this;
		$.glue.backend({ method: 'image.resize', name: $(this).attr('id'), width: $(this).width(), height: $(this).height() }, function(data) {
			if (!data) {
				// DEBUG
				console.error('image.resize returned null');
			} else if (data['#error']) {
				// DEBUG
				console.error(data['#data']);
			} else if (!data['#data']) {
				// no refresh necessary
			} else {
				// try to preload the file to prevent flicker
				clearTimeout($.glue.image.preload_timer);
				// DEBUG
				//console.log('clearing timeout');
				var temp_elem = $(that).clone();
				$(temp_elem).attr('id', '');
				$(temp_elem).attr('class', 'glue-object-copy');
				// this assumes that the borders are equally spaced..
				$(temp_elem).css('left', ($(that).position().left+($(that).outerWidth()-$(that).width())/2)+'px');
				$(temp_elem).css('top', ($(that).position().top+($(that).outerHeight()-$(that).height())/2)+'px');
				// set new url (w & h are only here to prevent caching)
				$(temp_elem).css('background-image', 'url('+$.glue.base_url+'?'+$(that).attr('id')+'&w='+$(that).width()+'&h='+$(that).height()+')');
				$(that).before(temp_elem);
				// destroy element on move or resize
				$(that).one('glue-movestart', function() {
					// remove any copies still left
					$('.glue-object-copy').remove();
				});
				$(that).one('glue-resizestart', function() {
					// remove any copies still left
					$('.glue-object-copy').remove();
				});
				$(that).one('glue-unregister', function() {
					// remove any copies still left
					$('.glue-object-copy').remove();
				});
				$.glue.image.preload_obj = temp_elem;
				$.glue.image.preload_timer = setTimeout(function() {
					// DEBUG
					//console.log('outer timeout');
					$(that).css('background-image', 'url('+$.glue.base_url+'?'+$(that).attr('id')+'&w='+$(that).width()+'&h='+$(that).height()+')');
					var remove = $.glue.image.preload_obj;
					setTimeout(function() {
						$(remove).remove();
						// DEBUG
						//console.log('inner timeout');
					}, 500);
					$.glue.image.preload_obj = false;
				}, 500);
			}
		}, false);
	}
});

$('.image').live('glue-upload-dynamic-late', function(e, loaded) {
	var img = loaded;
	if ($(img).is('img')) {
		// we should have the exact dimensions of the image by now
		// resize object
		$(this).css('width', $(img).width()+'px');
		$(this).css('height', $(img).height()+'px');
		// update object file
		$.glue.backend({ method: 'glue.update_object', name: $(this).attr('id'), 'image-file-width': $(img).width(), 'image-file-height': $(img).height() });
		// set the defaults
		$(this).css('background-image', 'url('+$(img).attr('src')+')');
		$(this).css('background-repeat', 'no-repeat');
		$(this).css('background-size', '100% 100%');
		$(this).css('-moz-background-size', '100% 100%');
		// remove the img
		$(img).remove();
	}
});

$(document).ready(function() {
	$.glue.contextmenu.veto('iframe', 'object-link');
	//
	// register menu items
	//
	var elem = $('<img src="'+$.glue.base_url+'modules/image/image-tile.png" alt="btn" title="toggle image tiling" width="32" height="32">');
	$(elem).bind('click', function(e) {
		var obj = $(this).data('owner');
		if ($(obj).css('background-repeat') != 'no-repeat') {
			$(obj).css('background-repeat', 'no-repeat');
			$(obj).css('background-size', '100% 100%');
			$(obj).css('-moz-background-size', '100% 100%');
		} else {
			$(obj).css('background-repeat', 'repeat');
			// background-size is automatically set with background-repeat
			// so no need to remove this attribute in the backend here
			$(obj).css('background-size', '');
			$(obj).css('-moz-background-size', '');
		}
		$.glue.object.save(obj);
	});
	$.glue.contextmenu.register('image', 'image-tile', elem);
	
	elem = $('<img src="'+$.glue.base_url+'modules/image/image-ratio.png" alt="btn" title="reset image size" width="32" height="32">');
	$(elem).bind('click', function(e) {
		var obj = $(this).data('owner');
		// get original-{width,height} from backend
		$.glue.backend({ method: 'glue.load_object', name: $(obj).attr('id') }, function(data) {
			if (data['image-file-width'] && data['image-file-height']) {
				var aspect = data['image-file-width']/data['image-file-height'];
				$(obj).trigger('glue-resizestart');
				if (e.shiftKey) {
					// shift: only change aspect ratio
					// fit height to width
					$(obj).css('height', ($(obj).width()*aspect)+'px');
				} else if (e.ctrlKey) {
					// ctrl: only change aspect ratio
					// fit width to heigth
					$(obj).css('width', ($(obj).height()/aspect)+'px');
				} else {
					$(obj).css('width', data['image-file-width']+'px');
					$(obj).css('height', data['image-file-height']+'px');
				}
				$(obj).trigger('glue-resize');
				$.glue.object.resizable_update_tooltip(obj);
				$.glue.object.save(obj);
				$(obj).trigger('glue-resizestop');
				$.glue.canvas.update(obj);
			}
		});
	});
	$.glue.contextmenu.register('image', 'image-ratio', elem);
	
	elem = $('<img src="'+$.glue.base_url+'modules/image/image-pos.png" alt="btn" title="adjust image selection" width="32" height="32">');
	$(elem).bind('mousedown', function(e) {
		var obj = $(this).data('owner');
		var a = $(obj).css('background-position').split(' ');
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
			$(obj).css('background-position', (prev_x_pos+x)+'px '+(prev_y_pos+y)+'px');
			if (x != 0 || y != 0) {
				no_change = false;
			}
		}, function(x, y) {
			// reset background position if there was no change at all
			if (no_change) {
				$(obj).css('background-position', '');
				$.glue.backend({ method: 'glue.object_remove_attr', name: $(obj).attr('id'), attr: 'image-background-position' });
			} else {
				$.glue.object.save(obj);
			}
		});
		return false;
	});
	$.glue.contextmenu.register('image', 'image-pos', elem);
	
	elem = $('<img src="'+$.glue.base_url+'img/download.png" alt="btn" title="download original file" width="32" height="32">');
	$(elem).bind('click', function(e) {
		var obj = $(this).data('owner');
		// initiate download
		window.location = $.glue.base_url+'?'+$(obj).attr('id')+'&download=1';
	});
	$.glue.contextmenu.register('image', 'image-download', elem);
});
