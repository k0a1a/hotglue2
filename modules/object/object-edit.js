/**
 *	modules/object/object-edit.js
 *	Frontend code for general object properties
 *
 *	Copyright Gottfried Haider, Danja Vasiliev 2010.
 *	This source code is licensed under the GNU General Public License.
 *	See the file COPYING for more details.
 */

// whether an object is currently clipping its overflowing content
function object_overflow_hidden(obj) {
	return getComputedStyle(obj).overflow == 'hidden';
}

// the object's opacity as a whole percentage, for the adjustment popout's
// transparency row
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

//
// --- edge panel ------------------------------------------------------------
//
// What an object's edges look like: rounded corners, a soft fade inwards from
// each edge, and a border - width, style and colour. One panel, same rows and
// same behaviour as the text module's font and spacing panels
// ($.glue.popover).
//
// Both are stored in PX. A percentage would keep the shape through a resize -
// 50% is a pill, or an ellipse on a box that is not square - but hotglue
// stores lengths in px everywhere else, and someone who rounded a corner by
// 8px wants 8px whatever the object is resized to. The slider reaches "fully
// round" anyway, because its maximum is half the object's shorter side.
//
// The fade is applied here as a custom property plus a class, and drawn by
// .glue-edge-fade in css/main.css - the object file stores the number only.
// See object_render_object() in module_object.inc.php for why. It fades all
// four edges evenly; the slider's maximum is half the shorter side, which is
// where the fade meets itself in the middle.
//

function object_edge_max(obj)
{
	// half the shorter side is a circle for the radius, and a fade that meets
	// itself in the middle - past either there is nothing further to see
	return Math.max(10, Math.round(Math.min(obj.offsetWidth, obj.offsetHeight)/2));
}

function object_edge_radius(obj)
{
	var v = parseFloat(getComputedStyle(obj).borderTopLeftRadius);
	return isNaN(v) ? 0 : v;
}

function object_edge_border(obj)
{
	var v = parseFloat(getComputedStyle(obj).borderTopWidth);
	return isNaN(v) ? 0 : v;
}

function object_set_border(obj, px)
{
	if (0 < px) {
		obj.style.borderWidth = px+'px';
		// solid unless a style has already been chosen - this is also called
		// BY the style dropdown, to give a style something to draw in
		if (!obj.style.borderStyle) {
			obj.style.borderStyle = 'solid';
		}
	} else {
		// emptied rather than set to zero, so the object file drops the
		// attributes and the object goes back to looking untouched
		obj.style.borderWidth = '';
		obj.style.borderStyle = '';
		obj.style.borderColor = '';
	}
}

function object_edge_fade(obj)
{
	var v = parseFloat(obj.style.getPropertyValue('--glue-fade'));
	return isNaN(v) ? 0 : v;
}

function object_set_fade(obj, px)
{
	if (0 < px) {
		obj.style.setProperty('--glue-fade', px+'px');
		obj.classList.add('glue-edge-fade');
	} else {
		// empty means the property is gone, which is what makes the object
		// file drop the attribute again rather than storing a fade of zero
		obj.style.removeProperty('--glue-fade');
		obj.classList.remove('glue-edge-fade');
	}
}

function object_glow(obj)
{
	return {
		color: obj.style.getPropertyValue('--glue-glow-color').trim() || '#ff8844',
		spread: parseFloat(obj.style.getPropertyValue('--glue-glow-spread')) || 40,
		alpha: parseFloat(obj.style.getPropertyValue('--glue-glow-alpha')) || 80,
		inner: parseFloat(obj.style.getPropertyValue('--glue-glow-inner')) || 0,
		color2: obj.style.getPropertyValue('--glue-glow-color2').trim() || '',
		on: obj.classList.contains('glue-glow')
	};
}

// The class is shared by the whole box-shadow family: the halo, its duotone
// sides and the drop shadow each turn it on, and it comes off again only when
// none of them is active. The composed rule in css/main.css keeps the members
// nobody set invisible, so one shadow never invents another.
function object_shadow_class_sync(obj)
{
	var active = obj.style.getPropertyValue('--glue-glow-color') !== '' ||
		obj.style.getPropertyValue('--glue-glow-color2') !== '' ||
		obj.style.getPropertyValue('--glue-drop-color') !== '';
	obj.classList.toggle('glue-glow', active);
}

function object_set_glow(obj, g)
{
	if (!g) {
		obj.style.removeProperty('--glue-glow-color');
		obj.style.removeProperty('--glue-glow-spread');
		obj.style.removeProperty('--glue-glow-alpha');
		obj.style.removeProperty('--glue-glow-inner');
		obj.style.removeProperty('--glue-glow-color2');
	} else {
		obj.style.setProperty('--glue-glow-color', g.color);
		obj.style.setProperty('--glue-glow-spread', g.spread);
		obj.style.setProperty('--glue-glow-alpha', g.alpha);
		// the inner layers and the duotone sides are all sized off the
		// spread, so without one they would be a solid box - they exist
		// only while the glow has a reach
		if (0 < g.spread) {
			if (g.inner) {
				obj.style.setProperty('--glue-glow-inner', 1);
			} else {
				obj.style.removeProperty('--glue-glow-inner');
			}
			if (g.color2) {
				obj.style.setProperty('--glue-glow-color2', g.color2);
			} else {
				obj.style.removeProperty('--glue-glow-color2');
			}
		} else {
			obj.style.removeProperty('--glue-glow-inner');
			obj.style.removeProperty('--glue-glow-color2');
		}
	}
	object_shadow_class_sync(obj);
}

// The drop shadow's on-switch is its colour: without one there is nothing to
// cast, so every property comes off entirely and the object file stores no
// knobs. Clearing the colour - or the picker's transparent - is how a shadow
// goes away. The angle keeps its unit ('135deg'): the composed rule resolves
// it to x/y offsets with cos()/sin(), and the trig sees an angle, not a
// number.
function object_drop(obj)
{
	return {
		color: obj.style.getPropertyValue('--glue-drop-color').trim() || '',
		distance: parseFloat(obj.style.getPropertyValue('--glue-drop-distance')) || 12,
		angle: parseFloat(obj.style.getPropertyValue('--glue-drop-angle')) || 135,
		blur: parseFloat(obj.style.getPropertyValue('--glue-drop-blur')) || 16,
		spread: parseFloat(obj.style.getPropertyValue('--glue-drop-spread')) || 0
	};
}

function object_set_drop(obj, d)
{
	if (!d || !d.color || d.color == 'transparent') {
		obj.style.removeProperty('--glue-drop-color');
		obj.style.removeProperty('--glue-drop-distance');
		obj.style.removeProperty('--glue-drop-angle');
		obj.style.removeProperty('--glue-drop-blur');
		obj.style.removeProperty('--glue-drop-spread');
		object_shadow_class_sync(obj);
		return;
	}
	obj.style.setProperty('--glue-drop-color', d.color);
	// a zeroed knob is no knob: it comes off entirely, so the object file
	// drops it rather than storing a default (the angle excepted - a shadow
	// at 0 degrees is a real direction, so it always round-trips)
	obj.style.setProperty('--glue-drop-angle', d.angle+'deg');
	[['--glue-drop-distance', d.distance],
	 ['--glue-drop-blur', d.blur],
	 ['--glue-drop-spread', d.spread]].forEach(function(p) {
		if (0 < p[1]) {
			obj.style.setProperty(p[0], p[1]);
		} else {
			obj.style.removeProperty(p[0]);
		}
	});
	object_shadow_class_sync(obj);
}

function object_edge_popover(obj)
{
	var pop = $.glue.popover.open(obj, 'glue-edge-popover');
	if (!pop) {
		return;
	}
	var max = object_edge_max(obj);
	var save = function() {
		$.glue.object.save(obj);
	};

	var radius = $.glue.popover.number_row('round', {
		min: 0, max: max, step: 1, unit: 'px',
		value: object_edge_radius(obj),
		apply: function(px, commit) {
			obj.style.borderRadius = (0 < px) ? px+'px' : '';
			if (commit) {
				save();
			}
		}
	});
	pop.appendChild(radius.row);

	var fade = $.glue.popover.number_row('fade', {
		min: 0, max: max, step: 1, unit: 'px',
		value: object_edge_fade(obj),
		apply: function(px, commit) {
			object_set_fade(obj, px);
			if (commit) {
				save();
			}
		}
	});
	pop.appendChild(fade.row);

	// A border of the object's own, which only became possible when the
	// editor's selection stopped being a border on this same element.
	var border = $.glue.popover.number_row('width', {
		min: 0, max: 40, step: 1, unit: 'px',
		value: object_edge_border(obj),
		apply: function(px, commit) {
			object_set_border(obj, px);
			if (commit) {
				save();
			}
		}
	});
	pop.appendChild(border.row);

	// Style and colour on one row: neither is a number, and a border is one
	// thing to think about rather than three.
	var style_row = $.glue.popover.row('style');
	var select = document.createElement('select');
	select.className = 'glue-border-style';
	// solid first because it is the default, and the only one that is not
	// stored - see object_render_object() in module_object.inc.php
	['solid', 'dashed', 'double', 'groove', 'inset', 'outset', 'ridge']
		.forEach(function(name) {
			var o = document.createElement('option');
			o.value = name;
			o.textContent = name;
			if (getComputedStyle(obj).borderTopStyle == name) {
				o.selected = true;
			}
			select.appendChild(o);
		});
	// A style or a colour on an object with no border gives it a 1px one:
	// otherwise nothing happens and the control looks broken, since a style
	// with no width to draw in is invisible.
	// Reads the object's OWN width, not the computed one: as soon as a style
	// is set the computed width becomes 'medium' (3px) whether anyone asked
	// for it or not, and a width nobody set is a width nobody stores - so the
	// border would come back on reload as no border at all.
	var ensure_width = function() {
		if (!(0 < parseFloat(obj.style.borderWidth))) {
			object_set_border(obj, 1);
			border.set(1);
		}
	};
	select.addEventListener('change', function() {
		obj.style.borderStyle = this.value;
		ensure_width();
		save();
	});
	style_row.appendChild(select);

	var colour = $.glue.popover.color_button('border colour',
		function() {
			return getComputedStyle(obj).borderTopColor;
		},
		function(col) {
			obj.style.borderColor = col;
			ensure_width();
		},
		function(col) {
			save();
		});
	colour.classList.add('glue-border-color');
	style_row.appendChild(colour);
	pop.appendChild(style_row);

	// --- more knobs: the glow ---------------------------------------------
	//
	// A halo painted AROUND the box, which is a different mechanism from
	// the fade above and worth keeping apart from it: the fade is a mask,
	// so it takes the text with it, while this is a box-shadow and never
	// touches the content. Folded away because most objects will never want
	// it, and the panel is already four rows.
	var fold = $.glue.popover.fold(pop, 'more knobs');
	pop.appendChild(fold.toggle);
	var adv = fold.body;
	pop.appendChild(adv);

	var glow = object_glow(obj);
	var write_glow = function(commit) {
		object_set_glow(obj, glow);
		if (commit) {
			save();
		}
	};

	var spread = $.glue.popover.number_row('glow', {
		// the halo's blur radius, in px; a tenth of a px is finer than the
		// eye can judge, but it keeps the step that found the values it did
		min: 0, max: 100, step: 0.1, decimals: 1, unit: 'px',
		value: glow.on ? glow.spread : 0,
		apply: function(pct, commit) {
			glow.spread = pct;
			// a glow of zero is no glow: the properties come off entirely, so
			// the object file drops them
			if (pct <= 0) {
				object_set_glow(obj, false);
				if (commit) {
					save();
				}
				return;
			}
			write_glow(commit);
		}
	});
	adv.appendChild(spread.row);

	var strength = $.glue.popover.number_row('opacity', {
		min: 0, max: 100, step: 1, unit: '%',
		value: glow.alpha,
		apply: function(pct, commit) {
			glow.alpha = pct;
			if (0 < glow.spread) {
				write_glow(commit);
			}
		}
	});
	adv.appendChild(strength.row);

	// --- the four small controls: a 2 x 2 grid -----------------------------
	//
	// The glow's colour, the toggle that ALSO puts the glow inside the box
	// (the translucent-marble look), a second colour the halo's side layers
	// take so the glow goes duotone (white in the middle, coloured on the
	// sides, like a billiard ball), and the drop shadow's colour. Each is a
	// label beside a 26px button, too short to own a row of the fold, so
	// they sit two to a row and the rows below keep their knobs.
	var pair_row = function(a, b) {
		var row = document.createElement('div');
		row.className = 'glue-popover-pair';
		row.appendChild(a);
		row.appendChild(b);
		return row;
	};
	var pair_cell = function(label, control) {
		var cell = document.createElement('div');
		cell.className = 'glue-popover-pair-cell';
		var l = document.createElement('div');
		l.className = 'glue-popover-label';
		l.textContent = label;
		cell.appendChild(l);
		cell.appendChild(control);
		return cell;
	};

	var glow_colour = $.glue.popover.color_button('glow colour',
		function() {
			return glow.color;
		},
		function(col) {
			glow.color = col;
			// a colour with no radius shows nothing; give it one
			if (glow.spread <= 0) {
				glow.spread = 40;
				spread.set(40);
			}
			write_glow(false);
		},
		function(col) {
			save();
		});
	glow_colour.classList.add('glue-glow-color');

	// the toggle itself is a plain square - the base .glue-font-toggle
	// style is a white square with a black frame, and .glue-font-toggle-on
	// fills it dark - so the glow-inside control reads as a dark square
	// when it is on and a white one when it is off
	var inner_toggle = document.createElement('div');
	inner_toggle.className = 'glue-font-toggle glue-glow-inner-toggle';
	inner_toggle.title = 'glow inside the object too';
	var sync_inner = function() {
		inner_toggle.classList.toggle('glue-font-toggle-on', 0 < glow.inner);
	};
	inner_toggle.addEventListener('click', function() {
		glow.inner = glow.inner ? 0 : 1;
		// a glow with no spread has no inside; turning it on gives it the
		// default the colour button would
		if (glow.inner && glow.spread <= 0) {
			glow.spread = 40;
			spread.set(40);
		}
		sync_inner();
		write_glow(false);
		save();
	});
	sync_inner();

	var duotone = $.glue.popover.color_button('glow second colour',
		function() {
			return glow.color2;
		},
		function(col) {
			glow.color2 = (col == 'transparent') ? '' : col;
			// the sides are sized off the spread, so without one they
			// would be a solid box
			if (glow.color2 && glow.spread <= 0) {
				glow.spread = 40;
				spread.set(40);
			}
			write_glow(false);
		},
		function(col) {
			save();
		});
	duotone.classList.add('glue-glow-color2');

	// --- the drop shadow ----------------------------------------------------
	//
	// A directional shadow, the depth version of the glow: one shadow in one
	// direction, cast by the box itself. Its colour is the on-switch, and
	// the direction is an angle and a distance resolved into x/y offsets by
	// the composed rule in css/main.css.
	var drop = object_drop(obj);
	var write_drop = function(commit) {
		object_set_drop(obj, drop);
		if (commit) {
			save();
		}
	};

	var drop_colour = $.glue.popover.color_button('drop shadow colour',
		function() {
			return drop.color;
		},
		function(col) {
			drop.color = (col == 'transparent') ? '' : col;
			// a colour with no distance shows nothing; give it one (the
			// other knobs already sit at the defaults a shadow is born
			// with, so a pick on a fresh object materializes the whole
			// shadow without touching them)
			if (drop.color && drop.distance <= 0) {
				drop.distance = 12;
				distance.set(12);
			}
			write_drop(false);
		},
		function(col) {
			save();
		});
	drop_colour.classList.add('glue-drop-color');

	adv.appendChild(pair_row(
		pair_cell('glow', glow_colour),
		pair_cell('glow inside', inner_toggle)
	));
	adv.appendChild(pair_row(
		pair_cell('2nd glow', duotone),
		pair_cell('shadow', drop_colour)
	));

	var distance = $.glue.popover.number_row('distance', {
		min: 0, max: 100, step: 1, unit: 'px',
		value: drop.distance,
		apply: function(px, commit) {
			drop.distance = px;
			// knobs without a colour are dead: there is nothing to cast,
			// so nothing gets written - or stored - either
			if (!drop.color) {
				return;
			}
			write_drop(commit);
		}
	});
	adv.appendChild(distance.row);

	var angle = $.glue.popover.number_row('angle', {
		min: 0, max: 360, step: 1, unit: '°',
		value: drop.angle,
		apply: function(deg, commit) {
			drop.angle = deg;
			if (!drop.color) {
				return;
			}
			write_drop(commit);
		}
	});
	adv.appendChild(angle.row);

	var blur = $.glue.popover.number_row('blur', {
		min: 0, max: 100, step: 1, unit: 'px',
		value: drop.blur,
		apply: function(px, commit) {
			drop.blur = px;
			if (!drop.color) {
				return;
			}
			write_drop(commit);
		}
	});
	adv.appendChild(blur.row);

	var drop_spread = $.glue.popover.number_row('spread', {
		min: 0, max: 40, step: 1, unit: 'px',
		value: drop.spread,
		apply: function(px, commit) {
			drop.spread = px;
			if (!drop.color) {
				return;
			}
			write_drop(commit);
		}
	});
	adv.appendChild(drop_spread.row);

	// The reset goes inside the fold, as the font panel's does: it clears
	// more than the rows above it set, so it belongs with the knobs rather
	// than sitting under them looking like it applies to the last one.
	var footer = $.glue.popover.row(false);
	footer.appendChild($.glue.popover.reset(
		'back to square corners, a hard edge and no border', function() {
			// everything this panel owns comes off, and THEN it is saved -
			// one write, and nothing left behind that the save happened
			// before
			obj.style.borderRadius = '';
			object_set_fade(obj, 0);
			object_set_border(obj, 0);
			object_set_glow(obj, false);
			object_set_drop(obj, false);
			save();
			radius.set(0);
			fade.set(0);
			border.set(0);
			select.value = 'solid';
			glow = object_glow(obj);
			spread.set(0);
			strength.set(glow.alpha);
			sync_inner();
			drop = object_drop(obj);
			distance.set(drop.distance);
			angle.set(drop.angle);
			blur.set(drop.blur);
			drop_spread.set(drop.spread);
		}));
	adv.appendChild(footer);

	$.glue.popover.show(pop);
}

//
// --- object adjustment ------------------------------------------------------
//
// Flip, z-level and transparency in one panel. These used to be three menu
// buttons with hidden gestures: the flip cycled through four states, and the
// z-level and the transparency were both drag-distance sliders (drag right,
// drag further right...). The popout trades the hidden gestures for visible
// controls, and the flip becomes two independent toggles instead of a cycle,
// so 'flip both axes' is a state rather than a stop on the way back to none.
function object_adjust_popover(obj)
{
	var pop = $.glue.popover.open(obj, 'glue-adjust-popover');
	if (!pop) {
		return;
	}
	var save = function() {
		$.glue.object.save(obj);
	};

	// flip: two toggles. The state lives in a matrix() term of the object's
	// transform, which the transform module owns and stores; its helpers are
	// plain functions in this same scope, and are guarded in case the module
	// was disabled. The active class is the pressed-in frame from the icon
	// buttons' toggle state.
	var flip_row = $.glue.popover.row(false);
	var flip_v = $.glue.icon('flip-v', 'flip vertically');
	var flip_h = $.glue.icon('flip-h', 'flip horizontally');
	var flip_sync = function() {
		var axes = (typeof transform_flip_axes === 'function') ?
			transform_flip_axes(obj) : { h: false, v: false };
		flip_v.classList.toggle('glue-btn-active', axes.v);
		flip_h.classList.toggle('glue-btn-active', axes.h);
	};
	var flip_toggle = function(axis) {
		return function() {
			if (typeof transform_set_flip !== 'function') {
				return;
			}
			var axes = transform_flip_axes(obj);
			axes[axis] = !axes[axis];
			transform_set_flip(obj, axes.h, axes.v);
			save();
			flip_sync();
		};
	};
	flip_v.addEventListener('click', flip_toggle('v'));
	flip_h.addEventListener('click', flip_toggle('h'));
	flip_row.appendChild(flip_v);
	flip_row.appendChild(flip_h);
	pop.appendChild(flip_row);
	flip_sync();

	// z-level: to the ends or one place at a time. level_up/level_down swap
	// with the nearest intersecting object and save both ends of the swap
	// themselves; to_top/to_bottom follow the menu's old pattern of save on
	// the way out.
	var z_row = $.glue.popover.row(false);
	var z_btn = function(icon, title, fn) {
		var b = $.glue.icon(icon, title);
		b.addEventListener('click', fn);
		z_row.appendChild(b);
	};
	z_btn('layer-top', 'to top', function() {
		$.glue.stack.to_top(obj);
		save();
	});
	z_btn('layer-up', 'level up', function() {
		$.glue.stack.level_up(obj);
	});
	z_btn('layer-down', 'level down', function() {
		$.glue.stack.level_down(obj);
	});
	z_btn('layer-bottom', 'to bottom', function() {
		$.glue.stack.to_bottom(obj);
		save();
	});
	pop.appendChild(z_row);

	// transparency: the same slider-plus-field as the other panels
	var opacity = $.glue.popover.number_row('opacity', {
		min: 0, max: 100, step: 1, unit: '%',
		value: object_transparency_percent(obj),
		apply: function(pct, commit) {
			obj.style.opacity = pct/100;
			if (commit) {
				save();
			}
		}
	});
	pop.appendChild(opacity.row);

	// The reset clears everything this panel owns, and only then saves - one
	// write, and nothing left behind that the save happened before. Same
	// ordering as the edge panel's footer.
	var footer = $.glue.popover.row(false);
	footer.appendChild($.glue.popover.reset(
		'no flip, no transparency, back in the default stack', function() {
			if (typeof transform_set_flip === 'function') {
				transform_set_flip(obj, false, false);
			}
			obj.style.zIndex = '';
			obj.style.opacity = '';
			save();
			flip_sync();
			opacity.set(100);
		}));
	pop.appendChild(footer);

	$.glue.popover.show(pop);
}

//
// --- background image ------------------------------------------------------
//
// One button that does two things, because there are two states and only one
// of them needs a panel. With no image on the object, the button IS the file
// input - the browser's own picker, no dialog of ours in front of it. With an
// image already there, the input is switched off and the button opens a panel
// for the two things you can then do to it: tile it or not, and move it
// around.
//
// The image belongs to the object rather than to the page: it uploads with
// preferred_module 'object' and the object's name, which object_upload() in
// module_object.inc.php takes. The url points at the
// object, not at the file - see object_serve_resource() there.
//

function object_has_background(obj)
{
	return !!(obj && obj.style.backgroundImage && obj.style.backgroundImage != 'none');
}

function object_background_popover(obj)
{
	var pop = $.glue.popover.open(obj, 'glue-background-popover');
	if (!pop) {
		return;
	}
	var save = function() {
		$.glue.object.save(obj);
	};

	// --- tile or not ------------------------------------------------------
	var repeat_row = $.glue.popover.row('tile');
	var repeat = document.createElement('div');
	repeat.className = 'glue-font-toggle glue-background-repeat';
	repeat.textContent = '\u25a6';
	repeat.title = 'repeat the image across the object';
	var sync_repeat = function() {
		repeat.classList.toggle('glue-font-toggle-on',
			getComputedStyle(obj).backgroundRepeat.indexOf('no-repeat') == -1);
	};
	repeat.addEventListener('click', function() {
		var on = getComputedStyle(obj).backgroundRepeat.indexOf('no-repeat') == -1;
		obj.style.backgroundRepeat = on ? 'no-repeat' : 'repeat';
		sync_repeat();
		save();
	});
	sync_repeat();
	repeat_row.appendChild(repeat);
	pop.appendChild(repeat_row);

	// --- move it around ---------------------------------------------------
	//
	// Dragged rather than typed, like the page background it is modelled on:
	// where a picture sits behind text is a thing you judge by eye. A click
	// with no drag puts it back to the corner, which is what the page
	// background's own control does.
	var move_row = $.glue.popover.row('move');
	var pad = document.createElement('div');
	pad.className = 'glue-background-pad';
	pad.title = 'drag to move the image, click to put it back';
	pad.textContent = '\u2725';
	pad.style.touchAction = 'none';
	pad.addEventListener('pointerdown', function(e) {
		if (!e.isPrimary) {
			return;
		}
		var start = getComputedStyle(obj).backgroundPosition.split(' ');
		var from_x = parseInt(start[0]);
		var from_y = parseInt(start[1]);
		if (isNaN(from_x)) {
			from_x = 0;
		}
		if (isNaN(from_y)) {
			from_y = 0;
		}
		var moved = false;
		$.glue.slider(e, function(x, y) {
			obj.style.backgroundPosition = (from_x+x)+'px '+(from_y+y)+'px';
			if (x != 0 || y != 0) {
				moved = true;
			}
		}, function(x, y) {
			if (!moved) {
				// emptied rather than set to 0 0, so the object file drops
				// the attribute
				obj.style.backgroundPosition = '';
			}
			save();
		});
		e.preventDefault();
	});
	move_row.appendChild(pad);
	pop.appendChild(move_row);

	// --- size it -----------------------------------------------------------
	//
	// A percentage of the object's width; the height keeps the image's own
	// ratio ('% auto' is composed from the bare number, like the move pad's
	// composed position). 100 is what the row shows when nothing is stored -
	// it is not written until the scale is actually touched, so an unscaled
	// image stays at its natural size, and a zero typed into the field
	// removes the attribute again, per the "absent means default" rule.
	var scale_row = $.glue.popover.number_row('scale', {
		min: 10, max: 300, step: 1, unit: '%',
		value: parseFloat(obj.style.backgroundSize) || 100,
		apply: function(pct, commit) {
			if (!pct || pct < 0) {
				obj.style.backgroundSize = '';
				scale_row.set(0);
			} else {
				obj.style.backgroundSize = pct+'% auto';
			}
			if (commit) {
				save();
			}
		}
	});
	pop.appendChild(scale_row.row);

	// --- take it off ------------------------------------------------------
	var footer = $.glue.popover.row(false);
	footer.appendChild($.glue.popover.reset('remove the background image', function() {
		obj.style.backgroundImage = '';
		obj.style.backgroundRepeat = '';
		obj.style.backgroundPosition = '';
		obj.style.backgroundSize = '';
		$.glue.popover.close();
		save();
		// the file itself is dropped by the object no longer naming it
		$.glue.backend({ method: 'glue.object_remove_attr', name: obj.id,
			attr: 'object-background-file' });
	}));
	pop.appendChild(footer);

	$.glue.popover.show(pop);
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
	elem = $.glue.icon('sheep-icon5', 'clone object');
	// the sheep is the one icon in the set that is a joke, so it gets the
	// one animation in the set too: its eyes blink (a lid painted in the
	// button's own fill drops over them - see
	// .glue-btn-icon.glue-sheep::after in css/edit.css). The blink cycle
	// length is rolled fresh every time one wraps - 3-30s, random - so
	// the pauses wander instead of ticking like a metronome.
	elem.classList.add('glue-sheep');
	// note: elem is reused for every menu item in this scope, so the
	// closure must capture the sheep itself, not the mutable elem
	var sheep_elem = elem;
	// the fades are a fixed half second each - 0.5s to close, 0.5s fully
	// down, 0.5s to open - but keyframes are fractions of whatever the
	// cycle is, so every roll has to rewrite the percentages as well as
	// the duration. This style tag is created now, after css/edit.css has
	// loaded, so its same-named @keyframes wins over the stylesheet's
	// 30s fallback (a later rule overrides an earlier one).
	var blink_style = document.createElement('style');
	document.head.appendChild(blink_style);
	var roll_cycle = function() {
		var cycle = 3 + Math.random() * 27; // seconds, 3-30
		sheep_elem.style.setProperty('--glue-sheep-cycle', cycle.toFixed(1) + 's');
		// blink window is the last 1.5s of the cycle, ending at 100%
		var p1 = (cycle - 1.5) / cycle * 100; // lid starts closing
		var p2 = (cycle - 1.0) / cycle * 100; // fully down
		var p3 = (cycle - 0.5) / cycle * 100; // starts opening
		blink_style.textContent = '@keyframes glue-sheep-blink { 0%, '
			+ p1.toFixed(4) + '% { opacity: 0; } ' + p2.toFixed(4)
			+ '% { opacity: 1; } ' + p3.toFixed(4)
			+ '%, 100% { opacity: 0; } }';
	};
	roll_cycle();
	// the animation runs on the ::after, but animationiteration is
	// dispatched to this button with event.pseudoElement === '::after'
	elem.addEventListener('animationiteration', roll_cycle);
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

	// object adjustment: flip, z-level and transparency in one popout, in
	// place of the three menu buttons that each hid a gesture - the flip's
	// four-state cycle and the two drag-distance sliders. The PNG artwork of
	// the removed buttons stays in this directory, like transform-rotate.png
	// in the transform module's.
	elem = $.glue.icon('change-layer', 'object adjustments');
	elem.addEventListener('click', function(e) {
		object_adjust_popover($.glue.owner(this));
	});
	$.glue.contextmenu.register('object', 'object-adjust', elem, 2);

	// edges: rounded corners and a soft fade
	elem = $.glue.icon('border-radius', 'edges: rounded corners and a soft fade');
	elem.addEventListener('click', function(e) {
		object_edge_popover($.glue.owner(this));
		e.stopPropagation();
	});
	$.glue.contextmenu.register('object', 'object-edge', elem, 3);

	// background image: the file picker when there is none, a panel when
	// there is. The upload's data object is filled in when the menu opens,
	// since which object it belongs to is not known before then.
	elem = $.glue.icon('page-background-image', 'background image');
	// 'object', not 'object-background': upload_files() dispatches by calling
	// "{preferred_module}_upload", so the name has to be the module's own or
	// the file falls through to the image module and becomes a new object
	var bg_data = { method: 'glue.upload_files', page: $.glue.page,
		preferred_module: 'object' };
	$.glue.upload.button(elem, bg_data, {
		tooltip: 'choose a background image for this object',
		error: function(e) {
			$.glue.error('There was a problem uploading the file.');
		},
		finish: function(data) {
			if (!data || data['#error']) {
				$.glue.error('There was a problem uploading the file'+
					(data && data['#data'] ? ' ('+data['#data']+')' : ''));
				return;
			}
			var obj = document.getElementById(bg_data.object);
			if (!obj) {
				return;
			}
			// the timestamp defeats the cache: the url does not change when
			// the file behind it does
			obj.style.backgroundImage = 'url('+$.glue.base_url+'?'+bg_data.object+
				'&'+(new Date().getTime())+')';
			obj.style.backgroundRepeat = 'no-repeat';
			$.glue.object.save(obj);
			bg_sync(elem);
		}
	});
	var bg_input = elem.querySelector('input[type=file]');
	// with an image already on the object the picker gets out of the way, so
	// the button's own click can open the panel instead
	var bg_sync = function(button) {
		var obj = $.glue.owner(button);
		bg_data.object = obj ? obj.id : '';
		var has = object_has_background(obj);
		bg_input.style.display = has ? 'none' : '';
		button.title = has ? 'background image: tile it, move it, remove it' :
			'background image';
	};
	elem.addEventListener('glue-menu-activate', function(e) {
		bg_sync(this);
	});
	elem.addEventListener('click', function(e) {
		var obj = $.glue.owner(this);
		if (object_has_background(obj)) {
			object_background_popover(obj);
			e.stopPropagation();
		}
	});
	$.glue.contextmenu.register('object', 'object-background', elem, 4);

	// Toggle whether content bigger than the object's box is cut off or spills
	// out of it. Absent means visible, the browser default and what hotglue has
	// always done, so only 'hidden' is ever stored.
	//
	// An icon button now, from the SuperGlue set's extra folder. The text it
	// replaced spelled out the state, and the state is now the pressed-in
	// frame (glue-btn-active), the same as the flip toggles - the tooltip
	// still says what is true now.
	elem = $.glue.icon('clip');
	elem.setAttribute('x-data', '{ clipped: false }');
	elem.setAttribute('x-bind:title', "clipped ? " +
		"'content bigger than this object is cut off - click to let it show' : " +
		"'content bigger than this object spills out - click to cut it off'");
	elem.setAttribute('x-bind:class', "clipped ? 'glue-btn-active' : ''");
	elem.setAttribute('x-on:glue-menu-activate',
		"clipped = object_overflow_hidden($.glue.owner($el))");
	elem.addEventListener('click', function(e) {
		var obj = $.glue.owner(this);
		obj.style.overflow = object_overflow_hidden(obj) ? '' : 'hidden';
		$.glue.object.save(obj);
		// refresh the frame and tooltip through Alpine's reactive state, the
		// same way the transparency button refreshes its percentage
		this.dispatchEvent(new CustomEvent('glue-menu-activate'));
	});
	$.glue.contextmenu.register('object', 'object-overflow', elem, 4);

	elem = $.glue.icon('object-link', 'make the object a link');
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

	elem = $.glue.icon('object-props', 'object properties: id, classes and custom attributes');
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
