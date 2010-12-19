/**
 *	modules/webvideo/webvideo-edit.js
 *	Frontend code for webvideo objects
 *
 *	Copyright Gottfried Haider, Danja Vasiliev 2010.
 *	This source code is licensed under the GNU General Public License.
 *	See the file COPYING for more details.
 */

$(document).ready(function() {
	//
	// menu items
	//
	var elem = $('<img src="'+$.glue.base_url+'modules/webvideo/webvideo.png" alt="btn" title="embedded a youtube or vimeo video" width="32" height="32">');
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
					var child = $('<iframe class="youtube-player" frameborder="0" src="http://www.youtube.com/embed/'+id+'?rel=0" style="border-width: 0px; height: 100%; position: absolute; width: 100%;" type="text/html"></iframe>');
				} else if (provider == 'vimeo') {
					var child = $('<iframe frameborder="0" src="http://player.vimeo.com/video/'+id+'?title=0&amp;byline=0&amp;portrait=0&amp;color=ffffff" style="border-width: 0px; height: 100%; position: absolute; width: 100%;" type="text/html"></iframe>');
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
	var elem = $('<div style="height: 32px; width: 32px;" title="toggle automatic playback of video (takes effect after a reload)">');
	$(elem).bind('glue-menu-activate', function(e) {
		var obj = $(this).data('owner');
		if ($(obj).data('webvideo-autoplay') === undefined) {
			$(this).removeClass('glue-menu-enabled');
			$(this).removeClass('glue-menu-disabled');
			var that = this;
			$.glue.backend({ method: 'glue.load_object', name: $(obj).attr('id') }, function(data) {
				if (data['webvideo-autoplay'] == 'autoplay') {
					$(that).addClass('glue-menu-enabled');
					$(obj).data('webvideo-autoplay', 'autoplay');
				} else {
					$(that).addClass('glue-menu-disabled');
					$(obj).data('webvideo-autoplay', '');		
				}
			});
		} else {
			if ($(obj).data('webvideo-autoplay') == 'autoplay') {
				$(this).addClass('glue-menu-enabled');
				$(this).removeClass('glue-menu-disabled');
			} else {
				$(this).removeClass('glue-menu-enabled');
				$(this).addClass('glue-menu-disabled');
			}
		}
	});
	$(elem).bind('click', function(e) {
		var obj = $(this).data('owner');
		if ($(this).hasClass('glue-menu-enabled')) {
			$(this).removeClass('glue-menu-enabled');
			$(this).addClass('glue-menu-disabled');
			$(obj).data('webvideo-autoplay', '');
			$.glue.backend({ method: 'glue.object_remove_attr', name: $(obj).attr('id'), attr: 'webvideo-autoplay' });
		} else if ($(this).hasClass('glue-menu-disabled')) {
			$(this).addClass('glue-menu-enabled');
			$(this).removeClass('glue-menu-disabled');
			$(obj).data('webvideo-autoplay', '');
			$.glue.backend({ method: 'glue.update_object', name: $(obj).attr('id'), 'webvideo-autoplay': 'autoplay' });
		}
	});
	$.glue.contextmenu.register('webvideo', 'webvideo-autoplay', elem);
	
	elem = $('<div style="height: 32px; width: 32px;" title="toggle looping of video (takes effect after a reload)">');
	$(elem).bind('glue-menu-activate', function(e) {
		var obj = $(this).data('owner');
		if ($(obj).data('webvideo-loop') === undefined) {
			$(this).removeClass('glue-menu-enabled');
			$(this).removeClass('glue-menu-disabled');
			var that = this;
			$.glue.backend({ method: 'glue.load_object', name: $(obj).attr('id') }, function(data) {
				if (data['webvideo-loop'] == 'loop') {
					$(that).addClass('glue-menu-enabled');
					$(obj).data('webvideo-loop', 'loop');
				} else {
					$(that).addClass('glue-menu-disabled');
					$(obj).data('webvideo-loop', '');		
				}
			});
		} else {
			if ($(obj).data('webvideo-loop') == 'loop') {
				$(this).addClass('glue-menu-enabled');
				$(this).removeClass('glue-menu-disabled');
			} else {
				$(this).removeClass('glue-menu-enabled');
				$(this).addClass('glue-menu-disabled');
			}
		}
	});
	$(elem).bind('click', function(e) {
		var obj = $(this).data('owner');
		if ($(this).hasClass('glue-menu-enabled')) {
			$(this).removeClass('glue-menu-enabled');
			$(this).addClass('glue-menu-disabled');
			$(obj).data('webvideo-loop', '');
			$.glue.backend({ method: 'glue.object_remove_attr', name: $(obj).attr('id'), attr: 'webvideo-loop' });
		} else if ($(this).hasClass('glue-menu-disabled')) {
			$(this).addClass('glue-menu-enabled');
			$(this).removeClass('glue-menu-disabled');
			$(obj).data('webvideo-loop', 'loop');
			$.glue.backend({ method: 'glue.update_object', name: $(obj).attr('id'), 'webvideo-loop': 'loop' });
		}
	});
	$.glue.contextmenu.register('webvideo', 'webvideo-loop', elem);
	
	// make sure we don't send to much over the wire for every save
	$.glue.object.register_alter_pre_save('iframe', function(obj, orig) {
		$(obj).children('iframe').html('');
		$(obj).children('.glue-webvideo-handle').remove();
	});
});
