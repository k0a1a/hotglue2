/**
 *	modules/image/image-edit.js
 *	Frontend code for image objects
 *
 *	Copyright Gottfried Haider, Danja Vasiliev 2010.
 *	This source code is licensed under the GNU General Public License.
 *	See the file COPYING for more details.
 *
 */

$.glue.image = function() {
	var preload_obj = false;
	var preload_timer = false;

	return {
		autoresize: function(obj, mode) {
			if (mode === undefined) {
				mode = 'center';
			}
			var larger = $.glue.conf.image.upload_resize_larger;
			var to = $.glue.conf.image.upload_resize_to;
			if (larger == '0%' && to == '0%') {
				return;
			}

			var w = obj.offsetWidth;
			var h = obj.offsetHeight;
			var win_w = window.innerWidth;
			var win_h = window.innerHeight;
			var larger_f = parseFloat(larger);
			var to_f = parseFloat(to);
			if (isNaN(larger_f) || isNaN(to_f)) {
				return;
			}
			var do_resize = false;
			var target_w = w;
			var target_h = h;

			if (win_w*larger_f/100 < w) {
				target_w = win_w*to_f/100;
				target_h = target_w*h/w;
				do_resize = true;
			}
			if (win_h*larger_f/100 < h) {
				// this is here because target_h could also have been
				// already been changed by the lines above
				if (win_h*to_f/100 < target_h) {
					target_h = win_h*to_f/100;
					target_w = target_h*w/h;
					do_resize = true;
				}
			}
			if (do_resize) {
				// DEBUG
				//console.log('window is '+window.innerWidth+' and '+window.innerHeight);
				//console.log('resizing to '+target_w+' and '+target_h);
				// setup element
				obj.style.width = target_w+'px';
				obj.style.height = target_h+'px';
				// DEBUG
				//console.log('moving from '+obj.offsetLeft+' and '+obj.offsetTop);
				//console.log('to '+(obj.offsetLeft+(w-target_w)/2)+' and '+(obj.offsetTop+(h-target_h)/2));
				if (mode == 'center') {
					obj.style.left = (obj.offsetLeft+(w-target_w)/2)+'px';
					obj.style.top = (obj.offsetTop+(h-target_h)/2)+'px';
				}
				$.glue.object.resizable_update_tooltip(obj);
				// call resize
				$.glue.image.resize(obj, mode);
			}
		},
		resize: function(obj, mode) {
			if (!$.glue.conf.image.resizing || getComputedStyle(obj).backgroundRepeat != 'no-repeat') {
				return;
			}
			if (mode === undefined) {
				mode = 'center';
			}

			var width = obj.offsetWidth;
			var height = obj.offsetHeight;
			$.glue.backend({ method: 'image.resize', name: obj.id, 'width': width, 'height': height }, function(data) {
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
					clearTimeout(preload_timer);
					// DEBUG
					//console.log('clearing timeout');
					var temp_elem = obj.cloneNode(true);
					temp_elem.id = '';
					temp_elem.className = 'glue-object-copy';
					// this assumes that the borders are equally spaced..
					if (mode == 'center') {
						temp_elem.style.left = (obj.offsetLeft+(obj.offsetWidth-width)/2)+'px';
						temp_elem.style.top = (obj.offsetTop+(obj.offsetHeight-height)/2)+'px';
					}
					// set new url (w & h are only here to prevent caching)
					temp_elem.style.backgroundImage = 'url('+$.glue.base_url+'?'+obj.id+'&w='+width+'&h='+height+')';
					obj.before(temp_elem);
					// destroy element on move or resize
					obj.addEventListener('glue-movestart', function() {
						// remove any copies still left
						document.querySelectorAll('.glue-object-copy').forEach(function(el) { el.remove(); });
					}, { once: true });
					obj.addEventListener('glue-resizestart', function() {
						// remove any copies still left
						document.querySelectorAll('.glue-object-copy').forEach(function(el) { el.remove(); });
					}, { once: true });
					obj.addEventListener('glue-unregister', function() {
						// remove any copies still left
						document.querySelectorAll('.glue-object-copy').forEach(function(el) { el.remove(); });
					}, { once: true });
					preload_obj = temp_elem;
					preload_timer = setTimeout(function() {
						// DEBUG
						//console.log('outer timeout');
						obj.style.backgroundImage = 'url('+$.glue.base_url+'?'+obj.id+'&w='+width+'&h='+height+')';
						var remove = preload_obj;
						setTimeout(function() {
							remove.remove();
							// DEBUG
							//console.log('inner timeout');
						}, 500);
						preload_obj = false;
					}, 500);
				}
			}, false);
		}
	};
}();


$.glue.live('.image', 'glue-resizestop', function(e) {
	$.glue.image.resize(this);
});

$.glue.live('.image', 'glue-upload-dynamic-late', function(e, loaded) {
	var img = loaded;
	if (img.matches('img')) {
		// we should have the exact dimensions of the image by now
		// resize object
		this.style.width = img.offsetWidth+'px';
		this.style.height = img.offsetHeight+'px';
		// update object file
		$.glue.backend({ method: 'glue.update_object', name: this.id, 'image-file-width': img.offsetWidth, 'image-file-height': img.offsetHeight });
		// set the defaults
		this.style.backgroundImage = 'url('+img.getAttribute('src')+')';
		this.style.backgroundRepeat = 'no-repeat';
		this.style.backgroundSize = '100% 100%';
		this.style.setProperty('-moz-background-size', '100% 100%');
		// remove the img
		img.remove();
		// automatically resize
		$.glue.image.autoresize(this);
	}
});

$.glue.live('.image', 'glue-upload-static', function(e, mode) {
	// this is only getting triggered when the object width and height is set
	// immediately after uploading, i.e. when gd is available on the server
	$.glue.image.autoresize(this, mode);
});


document.addEventListener('DOMContentLoaded', function() {
	$.glue.contextmenu.veto('iframe', 'object-link');
	//
	// register menu items
	//
	var elem = document.createElement('img');
	elem.src = $.glue.base_url+'modules/image/image-tile.png';
	elem.alt = 'btn';
	elem.title = 'toggle image tiling';
	elem.width = 32;
	elem.height = 32;
	elem.addEventListener('click', function(e) {
		var obj = $.glue.owner(this);
		if (getComputedStyle(obj).backgroundRepeat != 'no-repeat') {
			obj.style.backgroundRepeat = 'no-repeat';
			obj.style.backgroundSize = '100% 100%';
			obj.style.setProperty('-moz-background-size', '100% 100%');
		} else {
			obj.style.backgroundRepeat = 'repeat';
			// background-size is automatically set with background-repeat
			// so no need to remove this attribute in the backend here
			obj.style.backgroundSize = '';
			obj.style.setProperty('-moz-background-size', '');
		}
		$.glue.object.save(obj);
	});
	$.glue.contextmenu.register('image', 'image-tile', elem);

	elem = document.createElement('img');
	elem.src = $.glue.base_url+'modules/image/image-ratio.png';
	elem.alt = 'btn';
	elem.title = 'reset image size';
	elem.width = 32;
	elem.height = 32;
	elem.addEventListener('click', function(e) {
		var obj = $.glue.owner(this);
		// get original-{width,height} from backend
		$.glue.backend({ method: 'glue.load_object', name: obj.id }, function(data) {
			if (data['image-file-width'] && data['image-file-height']) {
				var aspect = data['image-file-width']/data['image-file-height'];
				$.glue.trigger(obj, 'glue-resizestart');
				if (e.shiftKey) {
					// shift: only change aspect ratio
					// fit height to width
					obj.style.height = (obj.offsetWidth/aspect)+'px';
				} else if (e.ctrlKey) {
					// ctrl: only change aspect ratio
					// fit width to heigth
					obj.style.width = (obj.offsetHeight*aspect)+'px';
				} else {
					obj.style.width = data['image-file-width']+'px';
					obj.style.height = data['image-file-height']+'px';
				}
				$.glue.trigger(obj, 'glue-resize');
				$.glue.object.resizable_update_tooltip(obj);
				$.glue.object.save(obj);
				$.glue.trigger(obj, 'glue-resizestop');
				$.glue.canvas.update(obj);
			}
		});
	});
	$.glue.contextmenu.register('image', 'image-ratio', elem);

	elem = document.createElement('img');
	elem.src = $.glue.base_url+'modules/image/image-pos.png';
	elem.alt = 'btn';
	elem.title = 'adjust image selection';
	elem.width = 32;
	elem.height = 32;
	elem.addEventListener('mousedown', function(e) {
		var obj = $.glue.owner(this);
		var a = getComputedStyle(obj).backgroundPosition.split(' ');
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
			obj.style.backgroundPosition = (prev_x_pos+x)+'px '+(prev_y_pos+y)+'px';
			if (x != 0 || y != 0) {
				no_change = false;
			}
		}, function(x, y) {
			// reset background position if there was no change at all
			if (no_change) {
				obj.style.backgroundPosition = '';
				$.glue.backend({ method: 'glue.object_remove_attr', name: obj.id, attr: 'image-background-position' });
			} else {
				$.glue.object.save(obj);
			}
		});
		e.preventDefault();
		return false;
	});
	$.glue.contextmenu.register('image', 'image-pos', elem);

	elem = document.createElement('img');
	elem.src = $.glue.base_url+'img/download.png';
	elem.alt = 'btn';
	elem.title = 'download original file';
	elem.width = 32;
	elem.height = 32;
	elem.addEventListener('click', function(e) {
		var obj = $.glue.owner(this);
		// initiate download
		window.location = $.glue.base_url+'?'+obj.id+'&download=1';
	});
	$.glue.contextmenu.register('image', 'image-download', elem);
});
