/**
 *	modules/video/video-edit.js
 *	Frontend code for video objects
 *
 *	Copyright Gottfried Haider, Danja Vasiliev 2010.
 *	This source code is licensed under the GNU General Public License.
 *	See the file COPYING for more details.
 */

function video_autoplay_sync(elem) {
	var video = $.glue.owner(elem).querySelector(':scope > video');
	Alpine.$data(elem).enabled = video.hasAttribute('autoplay');
}

function video_autoplay_toggle(elem) {
	var obj = $.glue.owner(elem);
	var video = obj.querySelector(':scope > video');
	var data = Alpine.$data(elem);
	if (!video.hasAttribute('autoplay')) {
		video.setAttribute('autoplay', 'autoplay');
		data.enabled = true;
		// make sure video is playing
		video.play();
	} else {
		video.removeAttribute('autoplay');
		data.enabled = false;
	}
	$.glue.object.save(obj);
}

function video_loop_sync(elem) {
	var video = $.glue.owner(elem).querySelector(':scope > video');
	Alpine.$data(elem).enabled = video.hasAttribute('loop');
}

function video_loop_toggle(elem) {
	var obj = $.glue.owner(elem);
	var video = obj.querySelector(':scope > video');
	var data = Alpine.$data(elem);
	if (!video.hasAttribute('loop')) {
		video.setAttribute('loop', 'loop');
		data.enabled = true;
	} else {
		video.removeAttribute('loop');
		data.enabled = false;
	}
	$.glue.object.save(obj);
}

function video_controls_sync(elem) {
	var video = $.glue.owner(elem).querySelector(':scope > video');
	Alpine.$data(elem).enabled = video.hasAttribute('controls');
}

function video_controls_toggle(elem) {
	var obj = $.glue.owner(elem);
	var video = obj.querySelector(':scope > video');
	var data = Alpine.$data(elem);
	if (!video.hasAttribute('controls')) {
		video.setAttribute('controls', 'controls');
		data.enabled = true;
	} else {
		video.removeAttribute('controls');
		data.enabled = false;
	}
	$.glue.object.save(obj);
}

function video_mute_sync(elem) {
	var video = $.glue.owner(elem).querySelector(':scope > video');
	Alpine.$data(elem).enabled = (video.getAttribute('audio') == 'muted');
}

function video_mute_toggle(elem) {
	var obj = $.glue.owner(elem);
	var video = obj.querySelector(':scope > video');
	var data = Alpine.$data(elem);
	if (video.getAttribute('audio') != 'muted') {
		video.setAttribute('audio', 'muted');
		data.enabled = true;
	} else {
		video.removeAttribute('audio');
		data.enabled = false;
	}
	$.glue.object.save(obj);
}

// while a video object shows the "processing" placeholder (see
// video_alter_render_early()), periodically re-render it server-side and
// swap in the result once the background encode has finished, so an
// editor left open doesn't keep showing a stale placeholder indefinitely
function video_poll_encode(obj) {
	var attempts = 0;
	var max_attempts = 200; // ~10 minutes at 3s intervals
	var timer = setInterval(function() {
		attempts++;
		if (!document.body.contains(obj) || max_attempts < attempts) {
			clearInterval(timer);
			return;
		}
		$.glue.backend({ method: 'glue.render_object', name: obj.id, edit: true }, function(data) {
			if (!data || data['#error']) {
				// transient error - keep polling silently, don't alert
				return;
			}
			var tmpl = document.createElement('template');
			tmpl.innerHTML = (data['#data'] || '').trim();
			var fresh = tmpl.content.firstElementChild;
			if (!fresh || fresh.querySelector('.video-processing')) {
				// still pending
				return;
			}
			clearInterval(timer);
			// copy attributes too, not just content - the placeholder was
			// sized by the browser's CSS default (e.g. 480x360) before the
			// encode finished, and that got saved as this object's width/
			// height; the finalized render's style now carries the real
			// encoded dimensions, which only applying innerHTML would miss
			Array.from(obj.attributes).forEach(function(a) { obj.removeAttribute(a.name); });
			Array.from(fresh.attributes).forEach(function(a) { obj.setAttribute(a.name, a.value); });
			obj.innerHTML = fresh.innerHTML;
			$.glue.canvas.update(obj);
		}, false);
	}, 3000);
}

document.addEventListener('DOMContentLoaded', function() {
	// resume polling for any objects that were already mid-encode when this
	// page was loaded (e.g. reopened the editor before a previous upload's
	// encode had finished)
	document.querySelectorAll('.video.object').forEach(function(obj) {
		if (obj.querySelector('.video-processing')) {
			video_poll_encode(obj);
		}
	});

	//
	// "new" menu: explicit video upload button (video files can also be
	// added via the generic upload button/drag-drop, this just makes the
	// capability discoverable)
	//
	var upload_elem = document.createElement('div');
	upload_elem.style.height = '32px';
	upload_elem.style.maxHeight = '32px';
	upload_elem.style.maxWidth = '32px';
	upload_elem.style.overflow = 'hidden';
	upload_elem.style.width = '32px';
	var upload_img = document.createElement('img');
	upload_img.src = $.glue.base_url+'modules/video/video.png';
	upload_img.alt = 'btn';
	upload_img.width = 32;
	upload_img.height = 32;
	upload_elem.appendChild(upload_img);
	var upload = $.glue.upload.default_upload_handling();
	upload.multiple = true;
	upload.accept = 'video/*,.mp4,.webm,.ogv,.ogg,.h264,.mov';
	upload.tooltip = 'upload a video';
	$.glue.upload.button(upload_elem, { method: 'glue.upload_files', page: $.glue.page, preferred_module: 'video' }, upload);
	upload_elem.addEventListener('click', function(e) {
		var p = $.glue.menu.spawn_coords();
		upload.x = p.x;
		upload.y = p.y;
	});
	$.glue.menu.register('new', upload_elem, 11.5);

	//
	// turn video upload into an object
	//
	$.glue.live('.video', 'glue-upload-dynamic-early', function(e, mode, target_x, target_y) {
		// while a background encode is still pending, the server renders a
		// placeholder (see video_alter_render_early()) instead of a <video>
		// element - skip the native-size auto-resize below in that case,
		// it'll apply on a later reload once the encode finishes
		var video = this.querySelector(':scope > video');
		if (video) {
			video.addEventListener('loadedmetadata', function(e) {
				// resize the video to it's native size
				// DEBUG
				//console.log('loadedmetadata');
				var w = e.target.videoWidth;
				var h = e.target.videoHeight;
				if (typeof w == 'number' && 0 < w && typeof h == 'number' && 0 < h) {
					var obj = e.target.parentElement;
					obj.style.width = w+'px';
					obj.style.height = h+'px';
					$.glue.object.save(obj);
				}
			}, false);
		}
		// default width and height is set in the css
		// make it explicit though
		this.style.width = this.offsetWidth+'px';
		this.style.height = this.offsetHeight+'px';
		if (mode == 'center') {
			this.style.left = (target_x-this.offsetWidth/2)+'px';
			this.style.top = (target_y-this.offsetHeight/2)+'px';
		} else {
			this.style.left = target_x+'px';
			this.style.top = target_y+'px';
		}
		// restore visibility (orig_visibility is stashed by edit.js's upload
		// code in a shared WeakMap, glue_orig_visibility)
		this.style.visibility = glue_orig_visibility.get(this) || '';
		glue_orig_visibility.delete(this);
		$.glue.object.register(this);
		$.glue.object.save(this);
		if (this.querySelector('.video-processing')) {
			video_poll_encode(this);
		}
	});

	//
	// context menu items
	//
	var elem = document.createElement('div');
	elem.style.height = '32px';
	elem.style.width = '32px';
	$.glue.toggle_button(elem, 'video_autoplay_sync', 'video_autoplay_toggle',
		'automatic playback is on - click to turn off', 'toggle automatic playback of video');
	$.glue.contextmenu.register('video', 'video-autoplay', elem);

	elem = document.createElement('div');
	elem.style.height = '32px';
	elem.style.width = '32px';
	$.glue.toggle_button(elem, 'video_loop_sync', 'video_loop_toggle',
		'looping is on - click to turn off', 'toggle looping of video');
	$.glue.contextmenu.register('video', 'video-loop', elem);

	elem = document.createElement('div');
	elem.style.height = '32px';
	elem.style.width = '32px';
	$.glue.toggle_button(elem, 'video_controls_sync', 'video_controls_toggle',
		'controls are shown - click to hide them', 'show or hide control elements');
	$.glue.contextmenu.register('video', 'video-controls', elem);

	elem = document.createElement('div');
	elem.style.height = '32px';
	elem.style.width = '32px';
	$.glue.toggle_button(elem, 'video_mute_sync', 'video_mute_toggle',
		'video is muted - click to unmute', 'mute or unmute video');
	$.glue.contextmenu.register('video', 'video-mute', elem);

	elem = document.createElement('img');
	elem.src = $.glue.base_url+'modules/video/video-ratio.png';
	elem.alt = 'btn';
	elem.title = 'reset video size';
	elem.width = 32;
	elem.height = 32;
	elem.addEventListener('glue-menu-activate', function(e) {
		var obj = $.glue.owner(this);
		var video = obj.querySelector(':scope > video');
		// only show the icon when we have the native width and height
		var w = video.videoWidth;
		var h = video.videoHeight;
		if (typeof w == 'number' && 0 < w && typeof h == 'number' && 0 < h) {
			this.style.display = 'block';
		} else {
			this.style.display = 'none';
		}
	});
	elem.addEventListener('click', function(e) {
		var obj = $.glue.owner(this);
		var video = obj.querySelector(':scope > video');
		// get the native width and height
		var w = video.videoWidth;
		var h = video.videoHeight;
		if (typeof w != 'number' || w <= 0 || typeof h != 'number' || h <= 0) {
			// return if we don't have them
			return;
		}
		var aspect = w/h;
		$.glue.trigger(obj, 'glue-resizestart');
		obj.style.width = w+'px';
		obj.style.height = h+'px';
		$.glue.trigger(obj, 'glue-resize');
		$.glue.object.resizable_update_tooltip(obj);
		$.glue.object.save(obj);
		$.glue.trigger(obj, 'glue-resizestop');
		$.glue.canvas.update(obj);
	});
	$.glue.contextmenu.register('video', 'video-ratio', elem);

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
	$.glue.contextmenu.register('video', 'video-download', elem);
});
