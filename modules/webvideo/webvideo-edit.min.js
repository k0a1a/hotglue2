/**
 *	modules/webvideo/webvideo-edit.js
 *	Frontend code for webvideo objects
 *
 *	Copyright Gottfried Haider, Danja Vasiliev 2010.
 *	This source code is licensed under the GNU General Public License.
 *	See the file COPYING for more details.
 */

// webvideo-autoplay/-loop are cached on the object element (via jQuery
// .data(), unrelated to the .data('owner') contract) to avoid a
// glue.load_object round trip every time the context menu is shown for the
// same object
function webvideo_autoplay_sync(elem) {
	var obj = $.glue.owner(elem);
	var data = Alpine.$data(elem);
	if ($(obj).data('webvideo-autoplay') === undefined) {
		$.glue.backend({ method: 'glue.load_object', name: $(obj).attr('id') }, function(resp) {
			var val = (resp['webvideo-autoplay'] == 'autoplay') ? 'autoplay' : '';
			$(obj).data('webvideo-autoplay', val);
			data.enabled = (val == 'autoplay');
		});
	} else {
		data.enabled = ($(obj).data('webvideo-autoplay') == 'autoplay');
	}
}

function webvideo_autoplay_toggle(elem) {
	var obj = $.glue.owner(elem);
	var data = Alpine.$data(elem);
	if (data.enabled) {
		data.enabled = false;
		$(obj).data('webvideo-autoplay', '');
		$.glue.backend({ method: 'glue.object_remove_attr', name: $(obj).attr('id'), attr: 'webvideo-autoplay' });
	} else {
		data.enabled = true;
		$(obj).data('webvideo-autoplay', 'autoplay');
		$.glue.backend({ method: 'glue.update_object', name: $(obj).attr('id'), 'webvideo-autoplay': 'autoplay' });
	}
}

function webvideo_loop_sync(elem) {
	var obj = $.glue.owner(elem);
	var data = Alpine.$data(elem);
	if ($(obj).data('webvideo-loop') === undefined) {
		$.glue.backend({ method: 'glue.load_object', name: $(obj).attr('id') }, function(resp) {
			var val = (resp['webvideo-loop'] == 'loop') ? 'loop' : '';
			$(obj).data('webvideo-loop', val);
			data.enabled = (val == 'loop');
		});
	} else {
		data.enabled = ($(obj).data('webvideo-loop') == 'loop');
	}
}

function webvideo_loop_toggle(elem) {
	var obj = $.glue.owner(elem);
	var data = Alpine.$data(elem);
	if (data.enabled) {
		data.enabled = false;
		$(obj).data('webvideo-loop', '');
		$.glue.backend({ method: 'glue.object_remove_attr', name: $(obj).attr('id'), attr: 'webvideo-loop' });
	} else {
		data.enabled = true;
		$(obj).data('webvideo-loop', 'loop');
		$.glue.backend({ method: 'glue.update_object', name: $(obj).attr('id'), 'webvideo-loop': 'loop' });
	}
}

$(document).ready(function() {
	//
	// menu items
	//
	var elem = $('<img src="'+$.glue.base_url+'modules/webvideo/webvideo.png" alt="btn" title="embed a youtube or vimeo video" width="32" height="32">');
	$(elem).bind('click', function(e) {
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
				var elem = $('<div class="webvideo resizable object" style="position: absolute;"></div>');
				$(elem).attr('id', data['name']);
				// default width and height is set in the css
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
					var child = $('<iframe class="youtube-player" src="'+src+'www.youtube.com/embed/'+id+'?rel=0" style="border-width: 0px; height: 100%; position: absolute; width: 100%;"></iframe>');
				} else if (provider == 'vimeo') {
					var src = '//';
					var child = $('<iframe src="'+src+'player.vimeo.com/video/'+id+'?title=0&amp;byline=0&amp;portrait=0&amp;color=ffffff" style="border-width: 0px; height: 100%; position: absolute; width: 100%;"></iframe>');
				}
				$(elem).append(child);
				// put the iframe behind some shield for editing
				child = $('<div class="glue-webvideo-handle glue-ui" title="drag here"></div>');
				$(elem).append(child);
				$('body').append(elem);
				// make width and height explicit
				$(elem).css('width', $(elem).width()+'px');
				$(elem).css('height', $(elem).height()+'px');
				// move to mouseclick
				$(elem).css('left', (e.pageX-$(elem).outerWidth()/2)+'px');
				$(elem).css('top', (e.pageY-$(elem).outerHeight()/2)+'px');
				$.glue.object.register(elem);
				// set the provider and the id in the object file
				$.glue.backend({ method: 'glue.update_object', name: $(elem).attr('id'), 'webvideo-provider': provider, 'webvideo-id': id });
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
	var elem = $('<div style="height: 32px; width: 32px;">');
	$.glue.toggle_button(elem, 'webvideo_autoplay_sync', 'webvideo_autoplay_toggle',
		'automatic playback is on (takes effect after a reload) - click to turn off',
		'toggle automatic playback of video (takes effect after a reload)');
	$.glue.contextmenu.register('webvideo', 'webvideo-autoplay', elem);

	elem = $('<div style="height: 32px; width: 32px;">');
	$.glue.toggle_button(elem, 'webvideo_loop_sync', 'webvideo_loop_toggle',
		'looping is on (takes effect after a reload) - click to turn off',
		'toggle looping of video (takes effect after a reload)');
	$.glue.contextmenu.register('webvideo', 'webvideo-loop', elem);

	// make sure we don't send to much over the wire for every save
	$.glue.object.register_alter_pre_save('webvideo', function(obj, orig) {
		$(obj).children('iframe').html('');
		$(obj).children('.glue-webvideo-handle').remove();
	});
});
