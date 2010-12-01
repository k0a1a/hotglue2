/**
 *	modules/video/video-edit.js
 *	Frontend code for video objects
 *
 *	Copyright Gottfried Haider, Danja Vasiliev 2010.
 *	This source code is licensed under the GNU General Public License.
 *	See the file COPYING for more details.
 */

$(document).ready(function() {
	//
	// turn video upload into an object
	//
	$('.video').live('glue-upload-dynamic-early', function(e, mode, target_x, target_y) {
		$(this).children('video').get(0).addEventListener('loadedmetadata', function(e) {
			// resize the video to it's native size
			// DEBUG
			//console.log('loadedmetadata');
			var w = e.target.videoWidth;
			var h = e.target.videoHeight;
			if (typeof w == 'number' && 0 < w && typeof h == 'number' && 0 < h) {
				var obj = $(e.target).parent();
				$(obj).css('width', w+'px');
				$(obj).css('height', h+'px');
				$.glue.object.save(obj);
			}
		}, false);
		// default width and height is set in the css
		// make it explicit though
		$(this).css('width', $(this).width()+'px');
		$(this).css('height', $(this).height()+'px');
		if (mode == 'center') {
			$(this).css('left', (target_x-$(this).outerWidth()/2)+'px');
			$(this).css('top', (target_y-$(this).outerHeight()/2)+'px');
		} else {
			$(this).css('left', target_x+'px');
			$(this).css('top', target_y+'px');
		}
		// restore visibility
		$(this).css('visibility', $(this).data('orig_visibility'));
		$(this).removeData('orig_visibility');
		$.glue.object.register(this);
		$.glue.object.save(this);
	});
	
	//
	// context menu items
	//
	var elem = $('<div style="height: 32px; width: 32px;" title="toggle automatic playback of video">');
	$(elem).bind('click', function(e) {
		var obj = $(this).data('owner');
		var video = $(obj).children('video').first();
		if (!$(video).attr('autoplay')) {
			$(video).attr('autoplay', 'autoplay');
			$(this).addClass('glue-menu-enabled');
			$(this).removeClass('glue-menu-disabled');
			// make sure video is playing
			$(video).get(0).play();
		} else {
			$(video).removeAttr('autoplay');
			$(this).removeClass('glue-menu-enabled');
			$(this).addClass('glue-menu-disabled');
		}
		$.glue.object.save(obj);
	});
	$(elem).bind('glue-menu-activate', function(e) {
		var obj = $(this).data('owner');
		var video = $(obj).children('video').first();
		if ($(video).attr('autoplay')) {
			$('#glue-contextmenu-video-autoplay').addClass('glue-menu-enabled');
			$('#glue-contextmenu-video-autoplay').removeClass('glue-menu-disabled');
		} else {
			$('#glue-contextmenu-video-autoplay').removeClass('glue-menu-enabled');
			$('#glue-contextmenu-video-autoplay').addClass('glue-menu-disabled');
		}
	});
	$.glue.contextmenu.register('video', 'video-autoplay', elem);
	
	elem = $('<div style="height: 32px; width: 32px;" title="toggle looping of video">');
	$(elem).bind('click', function(e) {
		var obj = $(this).data('owner');
		var video = $(obj).children('video').first();
		if (!$(video).attr('loop')) {
			$(video).attr('loop', 'loop');
			$(this).addClass('glue-menu-enabled');
			$(this).removeClass('glue-menu-disabled');
		} else {
			$(video).removeAttr('loop');
			$(this).removeClass('glue-menu-enabled');
			$(this).addClass('glue-menu-disabled');
		}
		$.glue.object.save(obj);
	});
	$(elem).bind('glue-menu-activate', function(e) {
		var obj = $(this).data('owner');
		var video = $(obj).children('video').first();
		if ($(video).attr('loop')) {
			$('#glue-contextmenu-video-loop').addClass('glue-menu-enabled');
			$('#glue-contextmenu-video-loop').removeClass('glue-menu-disabled');
		} else {
			$('#glue-contextmenu-video-loop').removeClass('glue-menu-enabled');
			$('#glue-contextmenu-video-loop').addClass('glue-menu-disabled');
		}
	});
	$.glue.contextmenu.register('video', 'video-loop', elem);
	
	elem = $('<div style="height: 32px; width: 32px;" title="show or hide control elements">');
	$(elem).bind('click', function(e) {
		var obj = $(this).data('owner');
		var video = $(obj).children('video').first();
		if (!$(video).attr('controls')) {
			$(video).attr('controls', 'controls');
			$(this).addClass('glue-menu-enabled');
			$(this).removeClass('glue-menu-disabled');
		} else {
			$(video).removeAttr('controls');
			$(this).removeClass('glue-menu-enabled');
			$(this).addClass('glue-menu-disabled');
		}
		$.glue.object.save(obj);
	});
	$(elem).bind('glue-menu-activate', function(e) {
		var obj = $(this).data('owner');
		var video = $(obj).children('video').first();
		if ($(video).attr('controls')) {
			$('#glue-contextmenu-video-controls').addClass('glue-menu-enabled');
			$('#glue-contextmenu-video-controls').removeClass('glue-menu-disabled');
		} else {
			$('#glue-contextmenu-video-controls').removeClass('glue-menu-enabled');
			$('#glue-contextmenu-video-controls').addClass('glue-menu-disabled');
		}
	});
	$.glue.contextmenu.register('video', 'video-controls', elem);
	
	elem = $('<div style="height: 32px; width: 32px;" title="mute or unmute video">');
	$(elem).bind('click', function(e) {
		var obj = $(this).data('owner');
		var video = $(obj).children('video').first();
		if ((video).attr('audio') != 'muted') {
			$(video).attr('audio', 'muted');
			$(this).addClass('glue-menu-enabled');
			$(this).removeClass('glue-menu-disabled');
		} else {
			$(video).removeAttr('audio');
			$(this).removeClass('glue-menu-enabled');
			$(this).addClass('glue-menu-disabled');
		}
		$.glue.object.save(obj);
	});
	$(elem).bind('glue-menu-activate', function(e) {
		var obj = $(this).data('owner');
		var video = $(obj).children('video').first();
		if ((video).attr('audio') == 'muted') {
			$('#glue-contextmenu-video-mute').addClass('glue-menu-enabled');
			$('#glue-contextmenu-video-mute').removeClass('glue-menu-disabled');
		} else {
			$('#glue-contextmenu-video-mute').removeClass('glue-menu-enabled');
			$('#glue-contextmenu-video-mute').addClass('glue-menu-disabled');
		}
	});
	$.glue.contextmenu.register('video', 'video-mute', elem);
	
	elem = $('<img src="'+$.glue.base_url+'modules/video/video-ratio.png" alt="btn" title="reset video size" width="32" height="32">');
	$(elem).bind('glue-menu-activate', function(e) {
		var obj = $(this).data('owner');
		var video = $(obj).children('video').first();
		// only show the icon when we have the native width and height
		var w = $(video).get(0).videoWidth;
		var h = $(video).get(0).videoHeight;
		if (typeof w == 'number' && 0 < w && typeof h == 'number' && 0 < h) {
			$(this).css('display', 'block');
		} else {
			$(this).css('display', 'none');
		}
	});
	$(elem).bind('click', function(e) {
		var obj = $(this).data('owner');
		var video = $(obj).children('video').first();
		// get the native width and height
		var w = $(video).get(0).videoWidth;
		var h = $(video).get(0).videoHeight;
		if (typeof w != 'number' || w <= 0 || typeof h != 'number' || h <= 0) {
			// return if we don't have them
			return;
		}
		var aspect = w/h;
		$(obj).trigger('glue-resizestart');
		$(obj).css('width', w+'px');
		$(obj).css('height', h+'px');
		$(obj).trigger('glue-resize');
		$.glue.object.resizable_update_tooltip(obj);
		$.glue.object.save(obj);
		$(obj).trigger('glue-resizestop');
		$.glue.canvas.update(obj);
	});
	$.glue.contextmenu.register('video', 'video-ratio', elem);
	
	elem = $('<img src="'+$.glue.base_url+'img/download.png" alt="btn" title="download original file" width="32" height="32">');
	$(elem).bind('click', function(e) {
		var obj = $(this).data('owner');
		// initiate download
		window.location = $.glue.base_url+'?'+$(obj).attr('id')+'&download=1';
	});
	$.glue.contextmenu.register('video', 'video-download', elem);
});
