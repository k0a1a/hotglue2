/**
 *	modules/download/download-edit.js
 *	Frontend code for download objects
 *
 *	Copyright Gottfried Haider, Danja Vasiliev 2010.
 *	This source code is licensed under the GNU General Public License.
 *	See the file COPYING for more details.
 *
 */

// the pick mode's state: { name, box } while "attach to object on screen"
// is armed, and the wrap target an attach-upload is waiting to box (2026-09-22,
// SOW-download-object)
var download_pick = null;
var download_pending_wrap = null;

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
	// the attach-upload: box the fresh download beside the target it wraps,
	// hidden - the position is saved so detach can put the box back there
	if (download_pending_wrap) {
		var target = document.getElementById(download_pending_wrap);
		if (target) {
			this.style.left = (target.offsetLeft + target.offsetWidth + 20)+'px';
			this.style.top = target.offsetTop+'px';
			// the indicator rides along without waiting for a reload
			target.classList.add('glue-download-wrap');
		}
		this.style.display = 'none';
		download_pending_wrap = null;
		$.glue.object.register(this);
		$.glue.object.save(this);
		return;
	}
	// register object
	$.glue.object.register(this);
	// save object
	$.glue.object.save(this);
});

// the wrap pair, written sequentially: the download's name onto the target,
// the target's name onto the download, then the box leaves the screen. Both
// are FULL object names - the server resolves them by name.
function download_wrap_pair(dl_name, target_full, box) {
	$.glue.backend({ method: 'glue.update_object', name: target_full, 'download-wrap': dl_name }, function() {
		$.glue.backend({ method: 'glue.update_object', name: dl_name, 'download-wrap-target': target_full }, function() {
			if (box) {
				box.style.display = 'none';
			}
			download_pick_disarm();
		}, false);
	}, false);
}

function download_pick_disarm() {
	if (!download_pick) {
		return;
	}
	download_pick.box.querySelector('.download-attach').classList.remove('download-armed');
	document.removeEventListener('click', download_pick_click, true);
	document.removeEventListener('keydown', download_pick_key);
	download_pick = null;
}

// the pick's capture-phase click: a capture listener rather than $.glue.live,
// so the swallow happens BEFORE the editor's own delegation sees the click
function download_pick_click(e) {
	if (e.target.closest('.download')) {
		return;		// the box and its button pass through
	}
	var t = e.target.closest('.text, .image');
	if (!t || !t.id) {
		download_pick_disarm();		// anything else cancels the pick
		return;
	}
	e.stopPropagation();
	e.preventDefault();
	var pick = download_pick;
	download_pick_disarm();
	$.glue.backend({ method: 'glue.load_object', name: t.id }, function(data) {
		if (data['#error'] || !data['#data']) {
			return;
		}
		var attrs = data['#data'];
		if (attrs['object-link']) {
			$.glue.error('this object is already a link');
			return;
		}
		if (attrs['download-wrap']) {
			$.glue.error('this object already has a download');
			return;
		}
		download_wrap_pair(pick.name, t.id, pick.box);
	}, false);
}

function download_pick_key(e) {
	if (e.key == 'Escape') {
		download_pick_disarm();
	}
}

// the text/image menu's attach/detach button: the glyph is the state -
// attach.svg while the object carries no download, detach.svg once it does.
// The swap follows the lock module's padlock - a stateful button either
// swaps its --glue-icon or takes a colour class, and the menu-state classes
// never paint on a .glue-btn-icon (css/edit.css .glue-menu-enabled).
function download_wrap_make_item() {
	var elem = $.glue.icon('attach', 'attach a file to download');
	var wrapped = false;
	var set_icon = function(is_wrapped) {
		var url = new URL($.glue.base_url+'img/icons/' +
			(is_wrapped ? 'detach' : 'attach')+'.svg', document.baseURI).href;
		elem.style.setProperty('--glue-icon', 'url("'+url+'")');
	};
	elem.addEventListener('glue-menu-activate', function() {
		var obj = $.glue.owner(this);
		if (!obj) {
			return;
		}
		$.glue.backend({ method: 'glue.load_object', name: obj.id }, function(data) {
			wrapped = !!(data['#data'] && data['#data']['download-wrap']);
			set_icon(wrapped);
			elem.title = wrapped ? 'detach the download' : 'attach a file to download';
		}, false);
	});
	elem.addEventListener('click', function(e) {
		e.stopPropagation();
		var obj = $.glue.owner(this);
		if (!obj) {
			return;
		}
		if (wrapped) {
			download_wrap_detach(obj);
		} else {
			download_wrap_attach(obj);
		}
	});
	return elem;
}

// attach: the file picker; the uploaded file becomes a NEW download object
// wrapped around this target (download_upload server-side). A transient
// input - the menu element is reused across objects, so a persistent one
// would carry a stale wrap target.
function download_wrap_attach(obj) {
	download_pending_wrap = obj.id;
	var upload = {
		x: 0,
		y: 0,
		error: function() {
			download_pending_wrap = null;
			$.glue.error('There was a problem uploading a file. Make sure you are not exceeding the file size limits set in the server configuration.');
		},
		finish: function(data) {
			$.glue.upload.handle_response(data, this.x, this.y);
		}
	};
	var p = $.glue.menu.spawn_coords();
	upload.x = p.x;
	upload.y = p.y;
	var input = document.createElement('input');
	input.type = 'file';
	input.style.display = 'none';
	document.body.appendChild(input);
	input.addEventListener('change', function() {
		if (this.files && this.files.length) {
			$.glue.upload.files(this.files, { method: 'glue.upload_files', page: $.glue.page, preferred_module: 'download', wrap: obj.id }, upload);
		} else {
			download_pending_wrap = null;
		}
		this.remove();
	});
	input.click();
}

// detach: clear the pair; the download box reappears at its saved position
function download_wrap_detach(obj) {
	$.glue.backend({ method: 'glue.load_object', name: obj.id }, function(data) {
		if (data['#error'] || !data['#data'] || !data['#data']['download-wrap']) {
			return;
		}
		var dl = data['#data']['download-wrap'];
		$.glue.backend({ method: 'glue.object_remove_attr', name: dl, attr: 'download-wrap-target' }, function() {
			$.glue.backend({ method: 'glue.object_remove_attr', name: obj.id, attr: 'download-wrap' }, function() {
				$.glue.backend({ method: 'glue.render_object', name: dl, edit: true }, function(d) {
					if (!d || d['#error'] || !d['#data']) {
						return;
					}
					// the old hidden box leaves the dom before the fresh one
					// lands - one element per object, always
					var old = document.getElementById(dl);
					if (old) {
						old.remove();
					}
					var tmpl = document.createElement('template');
					tmpl.innerHTML = d['#data'].trim();
					var box = tmpl.content.firstElementChild;
					$.glue.canvas.add(box);
					$.glue.object.register(box);
					$.glue.sel.select(box);
				}, false);
			}, false);
		}, false);
	}, false);
}

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
	// the box's ONE button: arms the pick mode (2026-09-22)
	$.glue.live('.download-attach', 'click', function(e) {
		e.stopPropagation();
		var box = this.closest('.download');
		if (!box || !box.id) {
			return;
		}
		// canvas objects do not carry $.glue.owner - the box's id IS its
		// full object name
		if (download_pick && download_pick.box === box) {
			download_pick_disarm();		// toggle off
			return;
		}
		download_pick_disarm();
		download_pick = { name: box.id, box: box };
		this.classList.add('download-armed');
		document.addEventListener('click', download_pick_click, true);
		document.addEventListener('keydown', download_pick_key);
	});
	// the text and image menus' attach/detach buttons - two instances, one
	// per class (a menu element is appended per matching class)
	$.glue.contextmenu.register('text', 'download-wrap', download_wrap_make_item());
	$.glue.contextmenu.register('image', 'download-wrap', download_wrap_make_item());
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
		['.download-ext', '.download-mime', '.download-attach'].forEach(function(sel) {
			var el = obj.querySelector(':scope > '+sel);
			if (el) {
				el.remove();
			}
		});
	});
});
