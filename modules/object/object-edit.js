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
// whether an object is currently clipping its overflowing content
function object_overflow_hidden(obj) {
	return getComputedStyle(obj).overflow == 'hidden';
}

function object_transparency_percent(obj) {
	return Math.round(parseFloat(getComputedStyle(obj).opacity)*100);
}

// Object Properties modal, shown by the object-target icon.
//
// The object is presented AS the <div> it renders as, with the fixed parts as
// plain text and the editable parts as inputs sitting inline where they belong:
//
//   <div id="page.rev.123" class="text object |your classes|" |name|="|value|" >
//
// That is the point of it - it shows what an object actually is rather than
// describing it, and the same view teaches which parts hotglue owns.
//
// The object's real id is the internal dotted name (page.rev.objid) and stays
// that way always: it is load-bearing for the whole editor - selection, save,
// undo and cross-page linking all key off it - so it is displayed for copying
// and is never an input.
//
// Validation here is for feedback only. The save is gated server-side by
// object.set_properties, and independently filtered at render time, because
// glue.update_object is a generic key/value setter and anything guarded only
// in the browser can be walked around with one POST.

// classes the editor puts on an object while it is being worked on - never
// part of the object's stored identity, so they must not appear as "system"
var GLUE_TRANSIENT_CLASSES = ['glue-selected', 'glue-text-editing'];

var ATTR_NAME_RE = /^[a-zA-Z][a-zA-Z0-9-]*$/;
var CLASS_TOKEN_RE = /^-?[A-Za-z_][A-Za-z0-9_-]*$/;
// mirrors object_attr_denylist() in module_object.inc.php
var ATTR_DENYLIST = ['id', 'class', 'style', 'contenteditable', 'draggable'];

function object_attr_problem(name) {
	name = name.toLowerCase().trim();
	if (name === '') {
		return false;
	}
	if (!ATTR_NAME_RE.test(name)) {
		return 'use letters, digits and dashes, starting with a letter';
	}
	if (name.indexOf('on') === 0) {
		return 'inline event handlers are not allowed - put javascript in the page\'s code';
	}
	if (name == 'style') {
		return 'the object\'s position and size are managed by the object itself';
	}
	if (ATTR_DENYLIST.indexOf(name) != -1) {
		return 'managed by hotglue';
	}
	return false;
}

function object_class_problem(str) {
	var tokens = str.trim().split(/\s+/).filter(function(t) { return t !== ''; });
	for (var i = 0; i < tokens.length; i++) {
		if (!CLASS_TOKEN_RE.test(tokens[i])) {
			return 'invalid class name "' + tokens[i] + '" - letters, digits, - and _, not starting with a digit';
		}
	}
	return false;
}

function object_properties_modal_show(obj, data) {
	var full_name = $.glue.page + '.' + obj.id.split('.').pop();
	var custom_class = data['object-custom-class'] || '';
	var custom_tokens = custom_class.trim().split(/\s+/).filter(function(t) { return t !== ''; });

	// whatever the object is wearing right now, minus the user's own classes
	// and minus the editor's transient ones, is what hotglue owns
	var system_classes = Array.from(obj.classList).filter(function(c) {
		return custom_tokens.indexOf(c) == -1 && GLUE_TRANSIENT_CLASSES.indexOf(c) == -1;
	});

	var stored_attrs = {};
	if (data['object-attributes']) {
		try {
			stored_attrs = JSON.parse(data['object-attributes']) || {};
		} catch (err) {
			$.glue.error('This object\'s custom attributes could not be read and have been left alone.');
			stored_attrs = {};
		}
	}

	// $.glue.modal supplies what makes a dialog modal rather than merely on top:
	// the editor binds its shortcuts on documentElement, so without stopping
	// propagation Tab would cycle the objects behind this one and Delete would
	// delete one. Shared so the next dialog cannot get it wrong. See js/edit.js.
	var dialog = $.glue.modal.open('object properties', 'glue-modal-tag');
	var modal = dialog.modal;
	var close = dialog.close;

	function txt(parent, str, cls) {
		var span = document.createElement('span');
		span.className = cls || 'glue-tag-punct';
		span.textContent = str;
		parent.appendChild(span);
		return span;
	}

	// --- the tag itself ---------------------------------------------------
	var tag = document.createElement('div');
	tag.className = 'glue-tag';

	var line1 = document.createElement('div');
	line1.className = 'glue-tag-line';
	txt(line1, '<div', 'glue-tag-name');
	txt(line1, ' id=');
	var id_val = txt(line1, '"' + full_name + '"', 'glue-tag-fixed');
	id_val.title = 'the object\'s id - select and copy it to target this object from the page\'s code';
	tag.appendChild(line1);

	var line2 = document.createElement('div');
	line2.className = 'glue-tag-line';
	txt(line2, '  class=');
	txt(line2, '"');
	txt(line2, system_classes.join(' '), 'glue-tag-fixed').title =
		'set by hotglue - these can\'t be changed, your own classes are added after them';
	txt(line2, system_classes.length ? ' ' : '');
	var class_input = document.createElement('input');
	class_input.type = 'text';
	class_input.className = 'glue-tag-input';
	class_input.value = custom_class;
	class_input.placeholder = 'your classes';
	class_input.setAttribute('aria-label', 'your own classes, space separated');
	line2.appendChild(class_input);
	txt(line2, '"');
	tag.appendChild(line2);

	// --- custom attribute rows --------------------------------------------
	var attrs_wrap = document.createElement('div');
	tag.appendChild(attrs_wrap);

	function add_attr_row(name, value) {
		var row = document.createElement('div');
		row.className = 'glue-tag-line';
		txt(row, '  ');
		var name_input = document.createElement('input');
		name_input.type = 'text';
		name_input.className = 'glue-tag-input glue-tag-attr-name';
		name_input.value = name || '';
		name_input.placeholder = 'name';
		name_input.setAttribute('aria-label', 'attribute name');
		row.appendChild(name_input);
		txt(row, '=');
		txt(row, '"');
		var value_input = document.createElement('input');
		value_input.type = 'text';
		value_input.className = 'glue-tag-input glue-tag-attr-value';
		value_input.value = value || '';
		value_input.placeholder = 'value';
		value_input.setAttribute('aria-label', 'attribute value');
		row.appendChild(value_input);
		txt(row, '"');
		var remove = document.createElement('button');
		remove.type = 'button';
		remove.className = 'glue-tag-remove';
		remove.textContent = '×';
		remove.title = 'remove this attribute';
		remove.addEventListener('click', function() {
			row.remove();
			validate();
		});
		row.appendChild(remove);
		attrs_wrap.appendChild(row);
		name_input.addEventListener('input', validate);
		value_input.addEventListener('input', validate);
		return name_input;
	}

	var line_end = document.createElement('div');
	line_end.className = 'glue-tag-line';
	txt(line_end, '>', 'glue-tag-name');
	tag.appendChild(line_end);
	modal.appendChild(tag);

	var add = document.createElement('button');
	add.type = 'button';
	add.className = 'glue-tag-add';
	add.textContent = '+ attribute';
	add.addEventListener('click', function() {
		add_attr_row('', '').focus();
	});
	modal.appendChild(add);

	var problem = document.createElement('div');
	problem.className = 'glue-tag-problem';
	modal.appendChild(problem);

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

	// --- validation (feedback only - the server is the gate) --------------
	function rows() {
		return Array.from(attrs_wrap.querySelectorAll('.glue-tag-line'));
	}
	function validate() {
		var msg = false;
		class_input.classList.remove('glue-tag-invalid');
		var class_msg = object_class_problem(class_input.value);
		if (class_msg) {
			class_input.classList.add('glue-tag-invalid');
			msg = class_msg;
		}
		var seen = {};
		rows().forEach(function(row) {
			var name_input = row.querySelector('.glue-tag-attr-name');
			name_input.classList.remove('glue-tag-invalid');
			var name = name_input.value.toLowerCase().trim();
			var attr_msg = object_attr_problem(name);
			if (name !== '' && seen[name]) {
				attr_msg = '"' + name + '" is set twice';
			}
			if (name !== '') {
				seen[name] = true;
			}
			if (attr_msg) {
				name_input.classList.add('glue-tag-invalid');
				if (!msg) {
					msg = name === '' ? attr_msg : '"' + name + '": ' + attr_msg;
				}
			}
		});
		problem.textContent = msg || '';
		ok.disabled = !!msg;
		return !msg;
	}
	class_input.addEventListener('input', validate);

	Object.keys(stored_attrs).forEach(function(name) {
		add_attr_row(name, stored_attrs[name]);
	});
	validate();


	ok.addEventListener('click', function() {
		if (!validate()) {
			return;
		}
		var attributes = {};
		rows().forEach(function(row) {
			var name = row.querySelector('.glue-tag-attr-name').value.toLowerCase().trim();
			if (name !== '') {
				attributes[name] = row.querySelector('.glue-tag-attr-value').value;
			}
		});
		$.glue.backend({
			method: 'object.set_properties',
			name: obj.id,
			classes: class_input.value.trim(),
			attributes: attributes
		}, function(resp) {
			if (resp['#error']) {
				// the server refused - keep the modal open with the reason
				problem.textContent = resp['#data'] || resp['#error'];
				return;
			}
			// Reflect the class change live, so the editor shows what the
			// page will. Only the classList is touched: the object is NOT
			// re-registered, because $.glue.object.unregister() does not clear
			// edit.js's reg_objs guard, so a register() after it silently does
			// nothing and the object loses its Moveable until a reload.
			// Nothing about a class or attribute change needs re-registering.
			custom_tokens.forEach(function(t) { obj.classList.remove(t); });
			class_input.value.trim().split(/\s+/)
				.filter(function(t) { return t !== ''; })
				.forEach(function(t) { obj.classList.add(t); });
			close();
		});
	});
	cancel.addEventListener('click', close);
	class_input.focus();
}

document.addEventListener('DOMContentLoaded', function() {
	//
	// register menu items
	//
	var elem;
	// A sheep, for cloning. It is the one icon in the set that is a joke
	// rather than a diagram, and it earns its place: everyone knows what a
	// cloned sheep is, and the alternative - two overlapping rectangles - is
	// what half the icons in any toolbar already look like.
	elem = $.glue.icon('sheep-icon', 'clone object');
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
			// same parent as everything else on the canvas - in centered mode
			// that is the container, and the clone's coordinates are already
			// in that space because they came from the object it copied
			$.glue.canvas.add(clone);
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

	// Toggle whether content bigger than the object's box is cut off or spills
	// out of it. Absent means visible, the browser default and what hotglue has
	// always done, so only 'hidden' is ever stored.
	//
	// Text placeholder rather than an icon, like the link/undo/redo buttons -
	// this menu needs a proper icon set and the placeholders should look like
	// placeholders. The label is the ACTION, not the state: it says what
	// clicking will do, and the tooltip says what is true now.
	elem = document.createElement('div');
	elem.style.alignItems = 'center';
	elem.style.backgroundColor = '#eee';
	elem.style.border = '1px solid #000';
	elem.style.boxSizing = 'border-box';
	elem.style.display = 'flex';
	elem.style.fontSize = '11px';
	elem.style.height = '32px';
	elem.style.justifyContent = 'center';
	elem.style.lineHeight = '32px';
	elem.style.textAlign = 'center';
	elem.style.width = '32px';
	elem.setAttribute('x-data', '{ clipped: false }');
	elem.setAttribute('x-bind:title', "clipped ? " +
		"'content bigger than this object is cut off - click to let it show' : " +
		"'content bigger than this object spills out - click to cut it off'");
	elem.setAttribute('x-on:glue-menu-activate',
		"clipped = object_overflow_hidden($.glue.owner($el))");
	elem.className = 'glue-btn-label';
	elem.innerHTML = '<small x-text="clipped ? \'show\' : \'clip\'">clip</small>';
	elem.addEventListener('click', function(e) {
		var obj = $.glue.owner(this);
		obj.style.overflow = object_overflow_hidden(obj) ? '' : 'hidden';
		$.glue.object.save(obj);
		// refresh the label and tooltip through Alpine's reactive state, the
		// same way the transparency button refreshes its percentage
		this.dispatchEvent(new CustomEvent('glue-menu-activate'));
	});
	$.glue.contextmenu.register('object', 'object-overflow', elem, 4);

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
	elem.title = 'object properties: id, classes and custom attributes';
	elem.width = 32;
	elem.height = 32;
	elem.addEventListener('click', function(e) {
		var obj = $.glue.owner(this);
		$.glue.backend({ method: 'glue.load_object', name: obj.id }, function(data) {
			if (data['#error']) {
				$.glue.error(data['#error']);
				return;
			}
			object_properties_modal_show(obj, data['#data']);
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
