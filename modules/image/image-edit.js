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

			var w = obj.offsetWidth;
			var h = obj.offsetHeight;
			var do_resize = false;
			var target_w = w;
			var target_h = h;

			// shrink if larger than a % of the window
			if (!(larger == '0%' && to == '0%')) {
				var win_w = window.innerWidth;
				var win_h = window.innerHeight;
				var larger_f = parseFloat(larger);
				var to_f = parseFloat(to);
				if (!isNaN(larger_f) && !isNaN(to_f)) {
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
				}
			}

			// also cap to an absolute maximum pixel size, regardless of
			// window size or the window-relative resize above - the
			// original file/resolution is untouched (image-file-width/
			// -height keep recording it), "reset image size" (the
			// image-ratio icon) still shows the image at full size
			var max_w = $.glue.conf.image.upload_max_width;
			var max_h = $.glue.conf.image.upload_max_height;
			if (max_w && max_h && (max_w < target_w || max_h < target_h)) {
				var scale = Math.min(max_w/target_w, max_h/target_h);
				target_w = target_w*scale;
				target_h = target_h*scale;
				do_resize = true;
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
			// request the resize at device-pixel resolution (capped) rather
			// than CSS-pixel resolution, so the image the browser gets stays
			// sharp instead of being upscaled on HiDPI/Retina displays -
			// width/height (CSS pixels) below are left as-is for the preload
			// clone's positioning and the cache-busting query string, since
			// image_serve_resource() ignores those query params anyway and
			// just serves whatever resized file image.resize() produced
			var dpr = Math.min(window.devicePixelRatio || 1, $.glue.conf.image.resize_max_dpr);
			var req_width = Math.round(width*dpr);
			var req_height = Math.round(height*dpr);
			$.glue.backend({ method: 'image.resize', name: obj.id, 'width': req_width, 'height': req_height }, function(data) {
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
	// the tiling, ratio and position adjustments of an image object are now
	// part of the object's own panel (object-background in object-edit.js),
	// so the context menu's duplicate buttons are gone

	var elem;
	elem = $.glue.icon('download', 'download original file');
	elem.addEventListener('click', function(e) {
		var obj = $.glue.owner(this);
		// initiate download
		window.location = $.glue.base_url+'?'+obj.id+'&download=1';
	});
	$.glue.contextmenu.register('image', 'image-download', elem);
});
