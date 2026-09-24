/**
 *	modules/download/download-edit.js
 *	Frontend code for download objects
 *
 *	Copyright Gottfried Haider, Danja Vasiliev 2010.
 *	This source code is licensed under the GNU General Public License.
 *	See the file COPYING for more details.
 *
 */

// the last compatible object the user selected. The box menu's attach
// falls back to it: opening the box's menu clicks the box, and that click
// collapses the selection to the box alone before the menu appears - so
// "select the target, then the box, then attach" needs the target
// remembered across the collapse. Cleared once the selection is empty
// (background click), so a stale target can never surprise.
var download_last_target = null;

// the wrap target an attach-upload is waiting to box (2026-09-22,
// SOW-download-object)
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
		}, false);
	}, false);
}

// the box's attach: the download wraps ONE selected text or image object -
// multi-select (shift-click) is the picking gesture, no pick mode (danja's
// call, 2026-09-22). With nothing compatible selected it falls back to the
// last compatible selection (see download_last_target), which is what makes
// the box menu's attach usable: the click that opens the menu deselects
// everything else. The button's click stops propagation, so the selection
// stays as it was while the pair is written.
function download_wrap_attach_selected(box) {
	var selected = document.querySelectorAll('.glue-selected');
	var targets = Array.from(selected).filter(function(el) {
		return el !== box && (el.classList.contains('text') || el.classList.contains('image'));
	});
	if (targets.length > 1) {
		$.glue.error('select exactly one text or image object to attach the download to');
		return;
	}
	var t = targets[0];
	if (!t) {
		// no compatible object in the selection: the remembered target
		// serves only when the box is selected ALONE - the click that
		// opened its menu collapsed the selection. In a real multi-select
		// the selection says what it says, so an attach without a target
		// there is an error, not a reach into the past.
		if (selected.length > 1) {
			$.glue.error('select a text or image object to attach the download to using Shift+click');
			return;
		}
		t = download_last_target;
		if (!t || !t.isConnected || t === box) {
			$.glue.error('select a text or image object to attach the download to using Shift+click');
			return;
		}
	}
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
		download_wrap_pair(box.id, t.id, box);
	}, false);
}

// the glyph of a stateful item is its state. The swap follows the lock
// module's padlock - a stateful button either swaps its --glue-icon or
// takes a colour class, and the menu-state classes never paint on a
// .glue-btn-icon (css/edit.css .glue-menu-enabled).
function download_icon(elem, name) {
	var url = new URL($.glue.base_url+'img/icons/'+name+'.svg', document.baseURI).href;
	elem.style.setProperty('--glue-icon', 'url("'+url+'")');
}

function download_wrap_set_icon(elem, is_wrapped) {
	download_icon(elem, is_wrapped ? 'detach' : 'attach');
}

// the text/image menu's attach/detach button
function download_wrap_make_item() {
	var elem = $.glue.icon('attach', 'attach a file to download');
	var wrapped = false;
	elem.addEventListener('glue-menu-activate', function() {
		var obj = $.glue.owner(this);
		if (!obj) {
			return;
		}
		$.glue.backend({ method: 'glue.load_object', name: obj.id }, function(data) {
			wrapped = !!(data['#data'] && data['#data']['download-wrap']);
			download_wrap_set_icon(elem, wrapped);
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
// would carry a stale wrap target. The upload runs through the same
// default handling the page menu's 'upload a file' gets - status bar,
// error reporting, spawn placement - with the wrap target added to the
// service call, so the server pairs the new download with this object.
function download_wrap_attach(obj) {
	download_pending_wrap = obj.id;
	var upload = $.glue.upload.default_upload_handling();
	// the only extra on top of the default handling: a failed upload also
	// clears the remembered wrap target
	var orig_error = upload.error;
	upload.error = function(e) {
		download_pending_wrap = null;
		orig_error.call(this, e);
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
					// lands - one element per object, always. Unregister first:
					// without it the id stays marked in the registration guard
					// (js/edit.js register()), the fresh box never gets a
					// Moveable, and the returned box is undraggable until the
					// page is reloaded.
					var old = document.getElementById(dl);
					if (old) {
						$.glue.object.unregister(old);
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

// the box menu's public/private toggle: public is the DEFAULT (no
// attribute), the toggle writes 'download-public': 'private' and back.
// The glyph says the state - danja's tray icons: the dot is public, the
// slash is private (2026-09-23). One element per registration, reused
// across boxes like every menu item, so the state lives in the closure
// and every activate re-syncs it.
function download_public_make_item() {
	var elem = $.glue.icon('public-download', 'this download is public - click to make it private');
	var is_public = true;
	var set = function() {
		download_icon(elem, is_public ? 'public-download' : 'private-download');
		elem.title = is_public ?
			'this download is public - click to make it private' :
			'this download is private - click to make it public';
	};
	elem.addEventListener('glue-menu-activate', function() {
		var obj = $.glue.owner(this);
		if (!obj) {
			return;
		}
		$.glue.backend({ method: 'glue.load_object', name: obj.id }, function(data) {
			// the menu can hide while this round-trip is in flight (the
			// drag's first frame shows the menu and the movestart right
			// behind it hides it again) - the next show re-syncs, so the
			// detached write is skipped
			if (!elem.isConnected) {
				return;
			}
			is_public = !(data['#data'] && data['#data']['download-public'] == 'private');
			set();
		}, false);
	});
	elem.addEventListener('click', function(e) {
		e.stopPropagation();
		var obj = $.glue.owner(this);
		if (!obj) {
			return;
		}
		if (is_public) {
			$.glue.backend({ method: 'glue.update_object', name: obj.id, 'download-public': 'private' });
		} else {
			$.glue.backend({ method: 'glue.object_remove_attr', name: obj.id, attr: 'download-public' });
		}
		is_public = !is_public;
		set();
	});
	return elem;
}

document.addEventListener('DOMContentLoaded', function() {
	$.glue.contextmenu.veto('download', 'object-link');
	// the overflow toggle and the like have no business on a 50x50 box
	$.glue.contextmenu.veto('download', 'object-overflow');
	// the remembered target for the menu's attach (see download_last_target)
	$.glue.live('.text, .image', 'glue-select', function() {
		download_last_target = this;
	});
	$.glue.live('.text, .image', 'glue-deselect', function() {
		// cleared a moment later unless something is still selected: the
		// box's own click deselects the target and selects the box within
		// the same dispatch, a background click leaves nothing selected
		setTimeout(function() {
			if (!document.querySelector('.glue-selected')) {
				download_last_target = null;
			}
		}, 0);
	});
	// the editor hides every menu on a multi-select (a menu belongs to ONE
	// selected object); when a download is selected TOGETHER with others,
	// the box's own menu shows instead - the attach lives there and reads
	// the selection itself (danja's call, 2026-09-22). This runs after the
	// core glue-select handler, which did the hiding. The menu is JUST the
	// attach icon in this state: every other item hides itself for this
	// showing, and the next show's place_items resets the visibility, so
	// nothing persists.
	$.glue.live('.object', 'glue-select', function() {
		var box = this.classList.contains('download') ? this : null;
		if (!box) {
			box = document.querySelector('.glue-selected.download');
		}
		if (box && document.querySelectorAll('.glue-selected').length > 1) {
			$.glue.contextmenu.show(box);
			document.querySelectorAll('[id^="glue-contextmenu-"]').forEach(function(el) {
				if (el.id != 'glue-contextmenu-download-attach') {
					el.style.visibility = 'hidden';
				}
			});
		}
	});
	// the box menu's attach: FIRST in the upper bar (prio -1 beats
	// object-properties' 0; download-class items land in the top bar
	// anyway) - the attach lives in the menu only, not on the box
	// (danja's call, 2026-09-22)
	var attach = $.glue.icon('attach', 'attach the download to a selected text or image object');
	attach.addEventListener('click', function(e) {
		e.stopPropagation();
		var obj = $.glue.owner(this);
		if (!obj) {
			return;
		}
		$.glue.contextmenu.hide();
		download_wrap_attach_selected(obj);
	});
	$.glue.contextmenu.register('download', 'download-attach', attach, -1);
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
	$.glue.contextmenu.register('download', 'download-public', download_public_make_item());

	// make sure we don't send to much over the wire for every save
	$.glue.object.register_alter_pre_save('download', function(obj, orig) {
		['.download-ext', '.download-mime'].forEach(function(sel) {
			var el = obj.querySelector(':scope > '+sel);
			if (el) {
				el.remove();
			}
		});
	});
});
