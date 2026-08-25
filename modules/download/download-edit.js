/**
 *	modules/download/download-edit.js
 *	Frontend code for download objects
 *
 *	Copyright Gottfried Haider, Danja Vasiliev 2010.
 *	This source code is licensed under the GNU General Public License.
 *	See the file COPYING for more details.
 *
 */

$.glue.live('.download', 'glue-upload-dynamic-early', function(e, mode, target_x, target_y) {
	// there probably is no load event for our div, so make it available
	// right away
	// position object
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
	// register object
	$.glue.object.register(this);
	// save object
	$.glue.object.save(this);
});

function download_public_sync(elem) {
	var obj = $.glue.owner(elem);
	$.glue.backend({ method: 'glue.load_object', name: obj.id }, function(data) {
		Alpine.$data(elem).enabled = (data['download-public'] == 'public');
	});
}

function download_public_toggle(elem) {
	var obj = $.glue.owner(elem);
	var data = Alpine.$data(elem);
	if (data.enabled) {
		data.enabled = false;
		$.glue.backend({ method: 'glue.object_remove_attr', name: obj.id, attr: 'download-public' });
	} else {
		data.enabled = true;
		$.glue.backend({ method: 'glue.update_object', name: obj.id, 'download-public': 'public' });
	}
}

document.addEventListener('DOMContentLoaded', function() {
	$.glue.contextmenu.veto('download', 'object-link');
	//
	// register menu items
	//
	var elem;
	elem = $.glue.icon('download', 'download file');
	elem.addEventListener('click', function(e) {
		var obj = $.glue.owner(this);
		// initite download
		window.location = $.glue.base_url+'?'+obj.id+'&download=1';
	});
	$.glue.contextmenu.register('download', 'download-download', elem);

	elem = document.createElement('div');
	elem.setAttribute('alt', 'btn');
	elem.style.height = '32px';
	elem.style.width = '32px';
	$.glue.toggle_button(elem, 'download_public_sync', 'download_public_toggle',
		'this object is shown to everyone - click to make it private',
		'this object is only shown while editing - click to make it public');
	$.glue.contextmenu.register('download', 'download-public', elem);

	// make sure we don't send to much over the wire for every save
	$.glue.object.register_alter_pre_save('download', function(obj, orig) {
		var ext = obj.querySelector(':scope > .download-ext');
		if (ext) {
			ext.remove();
		}
	});
});
