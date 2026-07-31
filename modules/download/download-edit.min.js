/**
 *	modules/download/download-edit.js
 *	Frontend code for download objects
 *
 *	Copyright Gottfried Haider, Danja Vasiliev 2010.
 *	This source code is licensed under the GNU General Public License.
 *	See the file COPYING for more details.
 * 
 */

$('.download').glueLive('glue-upload-dynamic-early', function(e, mode, target_x, target_y) {
	// there probably is no load event for our div, so make it available 
	// right away
	// position object
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
	// register object
	$.glue.object.register(this);
	// save object
	$.glue.object.save(this);
});

function download_public_sync(elem) {
	var obj = $.glue.owner(elem);
	$.glue.backend({ method: 'glue.load_object', name: $(obj).attr('id') }, function(data) {
		Alpine.$data(elem).enabled = (data['download-public'] == 'public');
	});
}

function download_public_toggle(elem) {
	var obj = $.glue.owner(elem);
	var data = Alpine.$data(elem);
	if (data.enabled) {
		data.enabled = false;
		$.glue.backend({ method: 'glue.object_remove_attr', name: $(obj).attr('id'), attr: 'download-public' });
	} else {
		data.enabled = true;
		$.glue.backend({ method: 'glue.update_object', name: $(obj).attr('id'), 'download-public': 'public' });
	}
}

$(document).ready(function() {
	$.glue.contextmenu.veto('download', 'object-link');
	//
	// register menu items
	//
	var elem;
	elem = $('<img src="'+$.glue.base_url+'img/download.png" alt="btn" title="download file" width="32" height="32">');
	$(elem).bind('click', function(e) {
		var obj = $.glue.owner(this);
		// initite download
		window.location = $.glue.base_url+'?'+$(obj).attr('id')+'&download=1';
	});
	$.glue.contextmenu.register('download', 'download-download', elem);

	elem = $('<div alt="btn" style="height: 32px; width: 32px;">');
	$.glue.toggle_button(elem, 'download_public_sync', 'download_public_toggle',
		'this object is shown to everyone - click to make it private',
		'this object is only shown while editing - click to make it public');
	$.glue.contextmenu.register('download', 'download-public', elem);

	// make sure we don't send to much over the wire for every save
	$.glue.object.register_alter_pre_save('download', function(obj, orig) {
		$(obj).children('.download-ext').remove();
	});
});
