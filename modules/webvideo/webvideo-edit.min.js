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
	var elem = document.createElement('img');
	elem.src = $.glue.base_url+'modules/webvideo/webvideo.png';
	elem.alt = 'btn';
	elem.title = 'embed a youtube or vimeo video';
	elem.width = 32;
	elem.height = 32;
	elem.addEventListener('click', function(e) {
		var url = prompt('Enter the video URL (e.g. http://www.youtube.com/watch?v=_mdVHEus0T8)');
		if (!url) {
			return;
		}
		// determine provider
		var provider = false;
		if (url.indexOf('youtube') != -1) {
			var start = url.indexOf('v=');
			if (start == -1) {
				$.glue.error('Error understanding the youtube link');
			} else {
				start += 2;
				var end = url.indexOf('&', start);
				if (end == -1) {
					end = url.length;
				}
				provider = 'youtube';
				var id = url.slice(start, end);
			}
		} else if (url.indexOf('vimeo') != -1) {
			var start = url.indexOf('.com/');
			if (start == -1) {
				$.glue.error('Error understanding the vimeo link');
			} else {
				start += 5;
				provider = 'vimeo';
				var id = String(parseInt(url.slice(start)));
			}
		} else {
			$.glue.error('Only youtube and vimeo videos are supported at the moment.');
		}

		if (provider) {
			// create new object
			$.glue.backend({ method: 'glue.create_object', 'page': $.glue.page }, function(data) {
				var elem = document.createElement('div');
				elem.className = 'webvideo resizable object';
				elem.style.position = 'absolute';
				elem.id = data['name'];
				// default width and height is set in the css
				var child;
				if (provider == 'youtube') {
          // use protocol relative url
					var src = '//';
        /*
					if (location.protocol == 'https:') {
						src = 'https://';
					} else {
						src = 'http://';
					}
        */
					child = document.createElement('iframe');
					child.className = 'youtube-player';
					child.src = src+'www.youtube.com/embed/'+id+'?rel=0';
					child.style.borderWidth = '0px';
					child.style.height = '100%';
					child.style.position = 'absolute';
					child.style.width = '100%';
				} else if (provider == 'vimeo') {
					var src = '//';
					child = document.createElement('iframe');
					child.src = src+'player.vimeo.com/video/'+id+'?title=0&byline=0&portrait=0&color=ffffff';
					child.style.borderWidth = '0px';
					child.style.height = '100%';
					child.style.position = 'absolute';
					child.style.width = '100%';
				}
				elem.appendChild(child);
				// put the iframe behind some shield for editing
				child = document.createElement('div');
				child.className = 'glue-webvideo-handle glue-ui';
				child.title = 'drag here';
				elem.appendChild(child);
				document.body.appendChild(elem);
				// make width and height explicit
				elem.style.width = elem.offsetWidth+'px';
				elem.style.height = elem.offsetHeight+'px';
				// move to mouseclick
				elem.style.left = (e.pageX-elem.offsetWidth/2)+'px';
				elem.style.top = (e.pageY-elem.offsetHeight/2)+'px';
				$.glue.object.register(elem);
				// set the provider and the id in the object file
				$.glue.backend({ method: 'glue.update_object', name: elem.id, 'webvideo-provider': provider, 'webvideo-id': id });
				// and save the element
				$.glue.object.save(elem);
			});
		}
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
		var handle = obj.querySelector(':scope > .glue-webvideo-handle');
		if (handle) {
			handle.remove();
		}
	});
});
