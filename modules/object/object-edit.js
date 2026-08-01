/**
 *	modules/object/object-edit.js
 *	Frontend code for general object properties
 *
 *	Copyright Gottfried Haider, Danja Vasiliev 2010.
 *	This source code is licensed under the GNU General Public License.
 *	See the file COPYING for more details.
 */

// returns the tooltip-ready transparency percentage for an object, used by
// the transparency icon's x-bind:title below
function object_transparency_percent(obj) {
	return Math.round(parseFloat(getComputedStyle(obj).opacity)*100);
}

// modal shown by the "get id" icon: read-only object id (for linking to
// it), plus an editable custom class field (object-custom-class) for the
// object's own CSS/JS scripting - see module_object.inc.php's
// object_alter_render_early() for how it gets applied when the page renders.
// note: the object's real id is the internal dotted name (page.rev.objid)
// and stays that way always - it's load-bearing for the whole editor
// (selection, save, undo, etc. all key off it), so it's not user-editable
function object_id_modal_show(obj, data) {
	var name = obj.id.split('.').pop();
	var full_name = $.glue.page+'.'+name;
	var custom_class = data['object-custom-class'] || '';

	var backdrop = document.createElement('div');
	backdrop.className = 'glue-modal-backdrop glue-ui';

	var modal = document.createElement('div');
	modal.className = 'glue-modal';

	function field(labelText, value, readonly) {
		var label = document.createElement('label');
		label.className = 'glue-modal-field';
		var span = document.createElement('span');
		span.textContent = labelText;
		var input = document.createElement('input');
		input.type = 'text';
		input.value = value;
		input.readOnly = !!readonly;
		label.appendChild(span);
		label.appendChild(input);
		modal.appendChild(label);
		return input;
	}

	field('id (for linking to this object)', full_name, true);
	var class_input = field('class (for your own CSS/JS)', custom_class, false);

	var buttons = document.createElement('div');
	buttons.className = 'glue-modal-buttons';
	var ok = document.createElement('button');
	ok.type = 'button';
	ok.textContent = 'OK';
	var cancel = document.createElement('button');
	cancel.type = 'button';
	cancel.textContent = 'Cancel';
	buttons.appendChild(cancel);
	buttons.appendChild(ok);
	modal.appendChild(buttons);

	function close() {
		backdrop.remove();
	}

	ok.addEventListener('click', function() {
		var new_class = class_input.value.trim();
		if (new_class) {
			$.glue.backend({ method: 'glue.update_object', name: obj.id, 'object-custom-class': new_class });
		} else if (custom_class) {
			$.glue.backend({ method: 'glue.object_remove_attr', name: obj.id, attr: 'object-custom-class' });
		}
		close();
	});
	cancel.addEventListener('click', close);
	backdrop.addEventListener('click', function(e) {
		if (e.target === backdrop) {
			close();
		}
	});
	backdrop.addEventListener('keydown', function(e) {
		if (e.key == 'Escape') {
			close();
		}
	});

	backdrop.appendChild(modal);
	document.body.appendChild(backdrop);
	class_input.focus();
}

document.addEventListener('DOMContentLoaded', function() {
	//
	// register menu items
	//
	var elem;
	elem = document.createElement('img');
	elem.src = $.glue.base_url+'modules/object/object-clone.png';
	elem.alt = 'btn';
	elem.title = 'clone object';
	elem.width = 32;
	elem.height = 32;
	elem.addEventListener('click', function(e) {
		var obj = $.glue.owner(this);
		$.glue.backend({ method: 'glue.clone_object', name: obj.id }, function(data) {
			// deselect current object
			$.glue.sel.none();
			var clone = obj.cloneNode(true);
			// set new id
			clone.id = data;
			// move object a bit
			clone.style.left = (obj.offsetLeft+$.glue.grid.x())+'px';
			clone.style.top = (obj.offsetTop+$.glue.grid.y())+'px';
			// add to dom and register
			document.body.appendChild(clone);
			$.glue.trigger(clone, 'glue-pre-clone');
			$.glue.object.register(clone);
			// select new object
			$.glue.sel.select(clone);
			$.glue.object.save(clone);
		});
	});
	$.glue.contextmenu.register('object', 'object-clone', elem, 1);

	elem = document.createElement('img');
	elem.src = $.glue.base_url+'modules/object/object-transparency.png';
	elem.alt = 'btn';
	elem.width = 32;
	elem.height = 32;
	elem.setAttribute('x-data', '{ opacity: 100 }');
	elem.setAttribute('x-bind:title', "'change transparency ('+opacity+'%)'");
	elem.setAttribute('x-on:glue-menu-activate', 'opacity = object_transparency_percent($.glue.owner($el))');
	elem.addEventListener('mousedown', function(e) {
		var that = this;
		var obj = $.glue.owner(this);
		$.glue.slider(e, function(x, y) {
			if (x < -15) {
				x = 1-(Math.abs(x)-15)/300;
			} else if (x < 15) {
				// dead zone
				x = 1;
			} else {
				x = 1-(Math.abs(x)-15)/300;
			}
			if (x < 0) {
				x = 0;
			}
			obj.style.opacity = x;
		}, function(x, y) {
			$.glue.object.save(obj);
			// update tooltip (see above) via Alpine's reactive opacity state
			that.dispatchEvent(new CustomEvent('glue-menu-activate'));
		});
		e.preventDefault();
		return false;
	});
	$.glue.contextmenu.register('object', 'object-transparency', elem, 2);

	elem = document.createElement('img');
	elem.src = $.glue.base_url+'modules/object/object-zindex.png';
	elem.alt = 'btn';
	elem.title = 'bring object to foreground or background';
	elem.width = 32;
	elem.height = 32;
	elem.addEventListener('mousedown', function(e) {
		var obj = $.glue.owner(this);
		var old_z = parseInt(getComputedStyle(obj).zIndex);
		$.glue.slider(e, function(x, y) {
			if (x < -15) {
				$.glue.stack.to_bottom(obj);
			} else if (x < 15) {
				// dead zone
				var z = parseInt(getComputedStyle(obj).zIndex);
				if (z !== old_z) {
					if (!isNaN(old_z)) {
						obj.style.zIndex = old_z;
					} else {
						obj.style.zIndex = '';
					}
					// DEBUG
					//console.log('set z-index to '+old_z);
				}
			} else {
				$.glue.stack.to_top(obj);
			}
		}, function(x, y) {
			$.glue.object.save(obj);
			$.glue.stack.compress();
		});
		e.preventDefault();
		return false;
	});
	$.glue.contextmenu.register('object', 'object-zindex', elem, 3);

	elem = document.createElement('img');
	elem.src = $.glue.base_url+'modules/object/object-link.png';
	elem.alt = 'btn';
	elem.title = 'make the object a link';
	elem.width = 32;
	elem.height = 32;
	elem.addEventListener('click', function(e) {
		var obj = $.glue.owner(this);
		// get link
		$.glue.backend({ method: 'glue.load_object', name: obj.id }, function(data) {
			if (data['#error']) {
				$.glue.error(data['#error']);
			} else {
				var old_link = '';
				if (data['#data']['object-link'] !== undefined) {
					old_link = data['#data']['object-link'];
				}
				var old_target = '';
				if (data['#data']['object-target'] !== undefined) {
					old_target = data['#data']['object-target'];
				}
				old_linkdata = (old_target == '') ? old_link : old_link + ' ' + old_target;
				var linkdata = prompt('Enter link (e.g. http://hotglue.me or pagename or anchor name).\nTo add target specify its name after a space (e.g. http://hotglue.me _blank)', old_linkdata);
				if (linkdata === null || linkdata == old_link + ' ' + old_target) {
					return;
				}
				t = linkdata.split(' '); // if there is no space split() returns the string
				link = t[0];
				target = t[1];

				if (link == undefined) {
					$.glue.backend({ method: 'glue.object_remove_attr', name: obj.id, attr: 'object-link' });
				} else {
					// set link
					$.glue.backend({ method: 'glue.update_object', name: obj.id, 'object-link': link });
					if (target !== undefined) {
						// set target
						$.glue.backend({ method: 'glue.update_object', name: obj.id, 'object-target': target });
					}
				}
				if (old_target !== '' && (target == '' || target == undefined)) {
					// delete target
					$.glue.backend({ method: 'glue.object_remove_attr', name: obj.id, attr: 'object-target' });
				}
			}
		}, false);
	});
	$.glue.contextmenu.register('object', 'object-link', elem);

	elem = document.createElement('img');
	elem.src = $.glue.base_url+'modules/object/object-target.png';
	elem.alt = 'btn';
	elem.title = 'get this object\'s id (for linking to it), or assign a custom class';
	elem.width = 32;
	elem.height = 32;
	elem.addEventListener('click', function(e) {
		var obj = $.glue.owner(this);
		$.glue.backend({ method: 'glue.load_object', name: obj.id }, function(data) {
			if (data['#error']) {
				$.glue.error(data['#error']);
				return;
			}
			object_id_modal_show(obj, data['#data']);
		}, false);
	});
	$.glue.contextmenu.register('object', 'object-target', elem);

	elem = document.createElement('img');
	elem.src = $.glue.base_url+'modules/object/object-symlink.png';
	elem.alt = 'btn';
	elem.title = 'make this object appear on all pages';
	elem.width = 32;
	elem.height = 32;
	elem.addEventListener('click', function(e) {
		var obj = $.glue.owner(this);
		$.glue.backend({ method: 'glue.object_make_symlink', name: obj.id });
	});
	$.glue.contextmenu.register('object', 'object-symlink', elem);

	elem = document.createElement('img');
	elem.src = $.glue.base_url+'modules/object/object-delete.png';
	elem.alt = 'btn';
	elem.title = 'delete object';
	elem.width = 32;
	elem.height = 32;
	elem.addEventListener('click', function(e) {
		var obj = $.glue.owner(this);
		var id = obj.id;
		$.glue.undo.capture_delete(obj, $.glue.object.to_html(obj));
		$.glue.object.unregister(obj);
		obj.remove();
		// delete in backend as well
		$.glue.backend({ method: 'glue.delete_object', name: id });
		// update canvas
		$.glue.canvas.update();
	});
	$.glue.contextmenu.register('object', 'object-delete', elem, 20);
});
