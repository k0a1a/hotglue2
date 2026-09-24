/**
 *	modules/audio/audio-edit.js
 *	Frontend code for audio objects
 *
 *	Copyright Gottfried Haider, Danja Vasiliev 2010.
 *	This source code is licensed under the GNU General Public License.
 *	See the file COPYING for more details.
 */

// The four toggles and the poll/upload plumbing below are the video
// module's (video-edit.js), on an <audio> element instead of a <video> one.
// What the audio menu deliberately does NOT have is video's reset-size
// item: the object is a fixed box with an icon in it, no native pixel
// size exists to reset it to.

function audio_autoplay_sync(elem) {
	var audio = $.glue.owner(elem).querySelector(':scope > audio');
	Alpine.$data(elem).enabled = audio.hasAttribute('autoplay');
}

function audio_autoplay_toggle(elem) {
	var obj = $.glue.owner(elem);
	var audio = obj.querySelector(':scope > audio');
	var data = Alpine.$data(elem);
	if (!audio.hasAttribute('autoplay')) {
		audio.setAttribute('autoplay', 'autoplay');
		data.enabled = true;
		// make sure audio is playing
		audio.play();
	} else {
		audio.removeAttribute('autoplay');
		data.enabled = false;
	}
	$.glue.object.save(obj);
}

function audio_loop_sync(elem) {
	var audio = $.glue.owner(elem).querySelector(':scope > audio');
	Alpine.$data(elem).enabled = audio.hasAttribute('loop');
}

function audio_loop_toggle(elem) {
	var obj = $.glue.owner(elem);
	var audio = obj.querySelector(':scope > audio');
	var data = Alpine.$data(elem);
	if (!audio.hasAttribute('loop')) {
		audio.setAttribute('loop', 'loop');
		data.enabled = true;
	} else {
		audio.removeAttribute('loop');
		data.enabled = false;
	}
	$.glue.object.save(obj);
}

function audio_controls_sync(elem) {
	var audio = $.glue.owner(elem).querySelector(':scope > audio');
	Alpine.$data(elem).enabled = audio.hasAttribute('controls');
}

function audio_controls_toggle(elem) {
	var obj = $.glue.owner(elem);
	var audio = obj.querySelector(':scope > audio');
	var data = Alpine.$data(elem);
	if (!audio.hasAttribute('controls')) {
		audio.setAttribute('controls', 'controls');
		data.enabled = true;
	} else {
		audio.removeAttribute('controls');
		data.enabled = false;
	}
	$.glue.object.save(obj);
}

function audio_mute_sync(elem) {
	var audio = $.glue.owner(elem).querySelector(':scope > audio');
	Alpine.$data(elem).enabled = audio.hasAttribute('muted');
}

function audio_mute_toggle(elem) {
	var obj = $.glue.owner(elem);
	var audio = obj.querySelector(':scope > audio');
	var data = Alpine.$data(elem);
	if (!audio.hasAttribute('muted')) {
		audio.setAttribute('muted', 'muted');
		// the attribute is the STORED state (alter_save reads it), the
		// property the live one - and they must both be set, same reason
		// the video module's mute toggle sets both: a media element locks
		// its mute state in when the resource loads, and the attribute
		// alone stops having any effect after that.
		audio.muted = true;
		data.enabled = true;
	} else {
		audio.removeAttribute('muted');
		audio.muted = false;
		data.enabled = false;
	}
	$.glue.object.save(obj);
}

// while an audio object shows the "processing" placeholder (see
// audio_alter_render_early()), periodically re-render it server-side and
// swap in the result once the background encode has finished, so an
// editor left open doesn't keep showing a stale placeholder indefinitely
function audio_poll_encode(obj) {
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
			if (!fresh || fresh.querySelector('.audio-processing')) {
				// still pending
				return;
			}
			clearInterval(timer);
			// copy attributes too, not just content - the placeholder was
			// sized by the CSS default before the upload handler made its
			// size explicit; the finalized render's style now carries the
			// real numbers, which only applying innerHTML would miss
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
	document.querySelectorAll('.audio.object').forEach(function(obj) {
		if (obj.querySelector('.audio-processing')) {
			audio_poll_encode(obj);
		}
	});

	//
	// turn audio upload into an object
	//
	$.glue.live('.audio', 'glue-upload-dynamic-early', function(e, mode, target_x, target_y) {
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
		if (this.querySelector('.audio-processing')) {
			audio_poll_encode(this);
		}
	});

	//
	// context menu items
	//
	// The same four toggles the video menu has, wearing the same icons
	// (img/icons/video-*.svg - autoplay, loop, controls and mute mean the
	// same thing for either medium), with the same pressed-frame enabled
	// state. The download item completes the menu.
	var elem = $.glue.icon('video-autoplay', 'toggle automatic playback of audio');
	$.glue.toggle_button(elem, 'audio_autoplay_sync', 'audio_autoplay_toggle',
		'automatic playback is on - click to turn off', 'toggle automatic playback of audio');
	$.glue.contextmenu.register('audio', 'audio-autoplay', elem);

	elem = $.glue.icon('video-loop', 'toggle looping of audio');
	$.glue.toggle_button(elem, 'audio_loop_sync', 'audio_loop_toggle',
		'looping is on - click to turn off', 'toggle looping of audio');
	$.glue.contextmenu.register('audio', 'audio-loop', elem);

	elem = $.glue.icon('video-controls', 'show or hide control elements');
	$.glue.toggle_button(elem, 'audio_controls_sync', 'audio_controls_toggle',
		'controls are shown - click to hide them', 'show or hide control elements');
	$.glue.contextmenu.register('audio', 'audio-controls', elem);

	elem = $.glue.icon('video-sound', 'mute or unmute audio');
	$.glue.toggle_button(elem, 'audio_mute_sync', 'audio_mute_toggle',
		'audio is muted - click to unmute', 'mute or unmute audio');
	$.glue.contextmenu.register('audio', 'audio-mute', elem);

	elem = $.glue.icon('download', 'download original file');
	elem.addEventListener('click', function(e) {
		var obj = $.glue.owner(this);
		// initiate download
		window.location = $.glue.base_url+'?'+obj.id+'&download=1';
	});
	$.glue.contextmenu.register('audio', 'audio-download', elem);
});
