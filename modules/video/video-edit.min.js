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

document.addEventListener('DOMContentLoaded', function() {
	//
	// turn video upload into an object
	//
	$.glue.live('.video', 'glue-upload-dynamic-early', function(e, mode, target_x, target_y) {
		this.querySelector(':scope > video').addEventListener('loadedmetadata', function(e) {
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
