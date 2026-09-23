/**
 *	modules/webvideo/webvideo-edit.js
 *	Frontend code for webvideo objects
 *
 *	Copyright Gottfried Haider, Danja Vasiliev 2010.
 *	This source code is licensed under the GNU General Public License.
 *	See the file COPYING for more details.
 */

// webvideo-autoplay/-loop are cached on the object element (via a private
// WeakMap, unrelated to the $.glue.owner contract) to avoid a
// glue.load_object round trip every time the context menu is shown for the
// same object
var webvideo_cache = new WeakMap();
function webvideo_cache_get(obj, key) {
	var d = webvideo_cache.get(obj);
	return d ? d[key] : undefined;
}
function webvideo_cache_set(obj, key, val) {
	var d = webvideo_cache.get(obj);
	if (!d) {
		d = {};
		webvideo_cache.set(obj, d);
	}
	d[key] = val;
}

function webvideo_autoplay_sync(elem) {
	var obj = $.glue.owner(elem);
	var data = Alpine.$data(elem);
	if (webvideo_cache_get(obj, 'webvideo-autoplay') === undefined) {
		$.glue.backend({ method: 'glue.load_object', name: obj.id }, function(resp) {
			// the menu can hide - and Alpine tear the item down - while
			// this round-trip is in flight; the next show re-syncs, so the
			// detached write is skipped (see download_public_sync)
			if (!elem.isConnected) {
				return;
			}
			var val = (resp['webvideo-autoplay'] == 'autoplay') ? 'autoplay' : '';
			webvideo_cache_set(obj, 'webvideo-autoplay', val);
			data.enabled = (val == 'autoplay');
		});
	} else {
		data.enabled = (webvideo_cache_get(obj, 'webvideo-autoplay') == 'autoplay');
	}
}

function webvideo_autoplay_toggle(elem) {
	var obj = $.glue.owner(elem);
	var data = Alpine.$data(elem);
	if (data.enabled) {
		data.enabled = false;
		webvideo_cache_set(obj, 'webvideo-autoplay', '');
		$.glue.backend({ method: 'glue.object_remove_attr', name: obj.id, attr: 'webvideo-autoplay' });
	} else {
		data.enabled = true;
		webvideo_cache_set(obj, 'webvideo-autoplay', 'autoplay');
		$.glue.backend({ method: 'glue.update_object', name: obj.id, 'webvideo-autoplay': 'autoplay' });
	}
}

function webvideo_loop_sync(elem) {
	var obj = $.glue.owner(elem);
	var data = Alpine.$data(elem);
	if (webvideo_cache_get(obj, 'webvideo-loop') === undefined) {
		$.glue.backend({ method: 'glue.load_object', name: obj.id }, function(resp) {
			if (!elem.isConnected) {
				return;
			}
			var val = (resp['webvideo-loop'] == 'loop') ? 'loop' : '';
			webvideo_cache_set(obj, 'webvideo-loop', val);
			data.enabled = (val == 'loop');
		});
	} else {
		data.enabled = (webvideo_cache_get(obj, 'webvideo-loop') == 'loop');
	}
}

function webvideo_loop_toggle(elem) {
	var obj = $.glue.owner(elem);
	var data = Alpine.$data(elem);
	if (data.enabled) {
		data.enabled = false;
		webvideo_cache_set(obj, 'webvideo-loop', '');
		$.glue.backend({ method: 'glue.object_remove_attr', name: obj.id, attr: 'webvideo-loop' });
	} else {
		data.enabled = true;
		webvideo_cache_set(obj, 'webvideo-loop', 'loop');
		$.glue.backend({ method: 'glue.update_object', name: obj.id, 'webvideo-loop': 'loop' });
	}
}

document.addEventListener('DOMContentLoaded', function() {
	//
	// menu items
	//
	var elem = $.glue.icon('embed-webvideo', 'embed a video or audio track');
	elem.addEventListener('click', function(e) {
		var url = prompt('Enter the URL of a video or audio track to embed (YouTube, Vimeo, PeerTube, Bandcamp, SoundCloud, Mixcloud, Spotify)');
		if (!url) {
			return;
		}
		// the server resolves the url through the oEmbed whitelist (or the
		// Bandcamp template, or discovery), validates the response, caches
		// the embed and creates the object - the callback gets the service's
		// #data, the upload-shaped array of html strings, so it lands in
		// handle_response exactly like an uploaded file (SOW-oembed-media.md;
		// errors are toasted by glue.backend itself)
		$.glue.backend({ method: 'webvideo.resolve', 'url': url, 'page': $.glue.page }, function(data) {
			if (!data || !data.length) {
				$.glue.error('There was a problem embedding the link');
				return;
			}
			$.glue.upload.handle_response({ '#data': data }, e.pageX, e.pageY);
		});
		$.glue.menu.hide();
	});
	$.glue.menu.register('new', elem, 13);

	//
	// context menu items
	//
	var elem = document.createElement('div');
	elem.style.height = '32px';
	elem.style.width = '32px';
	$.glue.toggle_button(elem, 'webvideo_autoplay_sync', 'webvideo_autoplay_toggle',
		'automatic playback is on (takes effect after a reload) - click to turn off',
		'toggle automatic playback of video (takes effect after a reload)');
	$.glue.contextmenu.register('webvideo', 'webvideo-autoplay', elem);

	elem = document.createElement('div');
	elem.style.height = '32px';
	elem.style.width = '32px';
	$.glue.toggle_button(elem, 'webvideo_loop_sync', 'webvideo_loop_toggle',
		'looping is on (takes effect after a reload) - click to turn off',
		'toggle looping of video (takes effect after a reload)');
	$.glue.contextmenu.register('webvideo', 'webvideo-loop', elem);

	// make sure we don't send to much over the wire for every save
	$.glue.object.register_alter_pre_save('webvideo', function(obj, orig) {
		var child = obj.querySelector(':scope > iframe');
		if (child) {
			child.innerHTML = '';
		}
		var shield = obj.querySelector(':scope > .glue-webvideo-shield');
		if (shield) {
			shield.remove();
		}
	});
});
