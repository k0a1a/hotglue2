/**
 *	modules/video/video-edit.js
 *	Frontend code for video objects
 *
 *	Copyright Gottfried Haider, Danja Vasiliev 2010.
 *	This source code is licensed under the GNU General Public License.
 *	See the file COPYING for more details.
 */

function video_autoplay_sync(elem) {
	var video = $($.glue.owner(elem)).children('video').first();
	Alpine.$data(elem).enabled = !!$(video).attr('autoplay');
}

function video_autoplay_toggle(elem) {
	var obj = $.glue.owner(elem);
	var video = $(obj).children('video').first();
	var data = Alpine.$data(elem);
	if (!$(video).attr('autoplay')) {
		$(video).attr('autoplay', 'autoplay');
		data.enabled = true;
		// make sure video is playing
		$(video).get(0).play();
	} else {
		$(video).removeAttr('autoplay');
		data.enabled = false;
	}
	$.glue.object.save(obj);
}

function video_loop_sync(elem) {
	var video = $($.glue.owner(elem)).children('video').first();
	Alpine.$data(elem).enabled = !!$(video).attr('loop');
}

function video_loop_toggle(elem) {
	var obj = $.glue.owner(elem);
	var video = $(obj).children('video').first();
	var data = Alpine.$data(elem);
	if (!$(video).attr('loop')) {
		$(video).attr('loop', 'loop');
		data.enabled = true;
	} else {
		$(video).removeAttr('loop');
		data.enabled = false;
	}
	$.glue.object.save(obj);
}

function video_controls_sync(elem) {
	var video = $($.glue.owner(elem)).children('video').first();
	Alpine.$data(elem).enabled = !!$(video).attr('controls');
}

function video_controls_toggle(elem) {
	var obj = $.glue.owner(elem);
	var video = $(obj).children('video').first();
	var data = Alpine.$data(elem);
	if (!$(video).attr('controls')) {
		$(video).attr('controls', 'controls');
		data.enabled = true;
	} else {
		$(video).removeAttr('controls');
		data.enabled = false;
	}
	$.glue.object.save(obj);
}

function video_mute_sync(elem) {
	var video = $($.glue.owner(elem)).children('video').first();
	Alpine.$data(elem).enabled = ($(video).attr('audio') == 'muted');
}

function video_mute_toggle(elem) {
	var obj = $.glue.owner(elem);
	var video = $(obj).children('video').first();
	var data = Alpine.$data(elem);
	if ($(video).attr('audio') != 'muted') {
		$(video).attr('audio', 'muted');
		data.enabled = true;
	} else {
		$(video).removeAttr('audio');
		data.enabled = false;
	}
	$.glue.object.save(obj);
}

$(document).ready(function() {
	//
	// turn video upload into an object
	//
	$('.video').glueLive('glue-upload-dynamic-early', function(e, mode, target_x, target_y) {
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
	var elem = $('<div style="height: 32px; width: 32px;">');
	$.glue.toggle_button(elem, 'video_autoplay_sync', 'video_autoplay_toggle',
		'automatic playback is on - click to turn off', 'toggle automatic playback of video');
	$.glue.contextmenu.register('video', 'video-autoplay', elem);

	elem = $('<div style="height: 32px; width: 32px;">');
	$.glue.toggle_button(elem, 'video_loop_sync', 'video_loop_toggle',
		'looping is on - click to turn off', 'toggle looping of video');
	$.glue.contextmenu.register('video', 'video-loop', elem);

	elem = $('<div style="height: 32px; width: 32px;">');
	$.glue.toggle_button(elem, 'video_controls_sync', 'video_controls_toggle',
		'controls are shown - click to hide them', 'show or hide control elements');
	$.glue.contextmenu.register('video', 'video-controls', elem);

	elem = $('<div style="height: 32px; width: 32px;">');
	$.glue.toggle_button(elem, 'video_mute_sync', 'video_mute_toggle',
		'video is muted - click to unmute', 'mute or unmute video');
	$.glue.contextmenu.register('video', 'video-mute', elem);

	elem = $('<img src="'+$.glue.base_url+'modules/video/video-ratio.png" alt="btn" title="reset video size" width="32" height="32">');
	$(elem).bind('glue-menu-activate', function(e) {
		var obj = $.glue.owner(this);
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
		var obj = $.glue.owner(this);
		var video = $(obj).children('video').first();
		// get the native width and height
		var w = $(video).get(0).videoWidth;
		var h = $(video).get(0).videoHeight;
		if (typeof w != 'number' || w <= 0 || typeof h != 'number' || h <= 0) {
			// return if we don't have them
			return;
		}
		var aspect = w/h;
		$(obj).glueTrigger('glue-resizestart');
		$(obj).css('width', w+'px');
		$(obj).css('height', h+'px');
		$(obj).glueTrigger('glue-resize');
		$.glue.object.resizable_update_tooltip(obj);
		$.glue.object.save(obj);
		$(obj).glueTrigger('glue-resizestop');
		$.glue.canvas.update(obj);
	});
	$.glue.contextmenu.register('video', 'video-ratio', elem);

	elem = $('<img src="'+$.glue.base_url+'img/download.png" alt="btn" title="download original file" width="32" height="32">');
	$(elem).bind('click', function(e) {
		var obj = $.glue.owner(this);
		// initiate download
		window.location = $.glue.base_url+'?'+$(obj).attr('id')+'&download=1';
	});
	$.glue.contextmenu.register('video', 'video-download', elem);
});
