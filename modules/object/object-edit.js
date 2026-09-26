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

// the object's opacity as a whole percentage, for the properties panel's
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
	// 'object attributes', not 'object properties': the button that opens this
	// dialog says 'object attributes' now (see the registrations at the bottom
	// of this file), and the panel's menu button is the one that carries the
	// other name. This string is only the dialog's accessible name - nothing
	// displays it - so it is here to keep the two in step rather than to be
	// read off the screen.
	var dialog = $.glue.modal.open('object attributes', 'glue-modal-tag');
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
// 8px wants 8px whatever the object is resized to. The drag reaches "fully
// round" anyway, because the row's maximum is half the object's shorter side.
//
// The fade is applied here as a custom property plus a class, and drawn by
// .glue-edge-fade in css/main.css - the object file stores the number only.
// See object_render_object() in module_object.inc.php for why. It fades all
// four edges evenly; the row's maximum is half the shorter side, which is
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
		// hard floor at 0: a radius is a magnitude, and the setter reads
		// anything else as "no radius" - so -20 was taking the corner off the
		// object and leaving -20 in the field as the reason. The ceiling is the
		// object's own half-size, which is a fence rather than a meaning
		min: 0, max: max, step: 1, unit: 'px', hard: [0, null],
		value: object_edge_radius(obj),
		apply: function(px, commit) {
			obj.style.borderRadius = (0 < px) ? px+'px' : '';
			if (commit) {
				save();
			}
		}
	});

	// The fade: the edge softening inwards from the object's own sides. It is
	// the one edge control the panel does not show - danja's call on 2026-09-17,
	// when the panel became the house style's shape: style and colour, then the
	// two numbers they act on, and everything else folded. Appended at the foot
	// of this function, into the fold, because the appends are what fix the
	// panel's order and the fold is built below.
	var fade = $.glue.popover.number_row('fade', {
		// hard floor at 0, as round above: a fade is a length, and the setter
		// takes a negative as "no fade" rather than as a soft edge
		min: 0, max: max, step: 1, unit: 'px', hard: [0, null],
		value: object_edge_fade(obj),
		apply: function(px, commit) {
			object_set_fade(obj, px);
			if (commit) {
				save();
			}
		}
	});

	// A border of the object's own, which only became possible when the
	// editor's selection stopped being a border on this same element.
	var border = $.glue.popover.number_row('width', {
		// hard floor at 0: a border-width of -3px is an invalid declaration the
		// browser drops, so the object would show no border at all while the
		// field said -3. 40 is where the drag stops, which is not a meaning
		min: 0, max: 40, step: 1, unit: 'px', hard: [0, null],
		value: object_edge_border(obj),
		apply: function(px, commit) {
			object_set_border(obj, px);
			if (commit) {
				save();
			}
		}
	});

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

	// the border colour is the shared swatch button now - the 20x20 square
	// of the palette's four most recent colours, like every other colour
	// button (danja's call, 2026-09-26)
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

	// --- what the panel shows ---------------------------------------------
	//
	// Four controls, in the order danja named them (2026-09-17): the style and
	// the colour, which are what a border IS, then the two numbers they act on -
	// how round the box is, and how thick the line. The rows were built in
	// another order above; what the panel looks like is the order of these
	// appends and nothing else.
	pop.appendChild(style_row);
	pop.appendChild(radius.row);
	pop.appendChild(border.row);

	// --- clip: content bigger than the object, cut off or spilling ---------
	//
	// The toggle that was its own menu button until 2026-09-23. It is an act
	// like the panel's other controls, so it sits as the last row before
	// "more knobs"; the fold below holds the values. The state is the
	// pressed-in frame the flip toggles use, and the tooltip says what is
	// true now.
	var clip_row = $.glue.popover.row('clip');
	var clip = $.glue.popover.icon_button('clip', '');
	var clip_sync = function() {
		var on = object_overflow_hidden(obj);
		clip.classList.toggle('glue-btn-active', on);
		clip.title = on ?
			'content bigger than this object is cut off - click to let it show' :
			'content bigger than this object spills out - click to cut it off';
	};
	clip.addEventListener('click', function() {
		obj.style.overflow = object_overflow_hidden(obj) ? '' : 'hidden';
		save();
		clip_sync();
	});
	clip_row.appendChild(clip);
	pop.appendChild(clip_row);
	clip_sync();

	// --- more knobs: the fade and the glow --------------------------------
	//
	// Everything else the object's edge can do, and most objects want none of
	// it. The fade is first, because it is the oldest and the plainest: it
	// softens the object inwards from its own sides.
	//
	// The glow is a halo painted AROUND the box, which is a different mechanism
	// from the fade beside it and worth keeping apart from it: the fade is a
	// mask, so it takes the text with it, while this is a box-shadow and never
	// touches the content.
	var fold = $.glue.popover.fold(pop, 'more knobs');
	pop.appendChild(fold.toggle);
	var adv = fold.body;
	pop.appendChild(adv);

	adv.appendChild(fade.row);

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
		// hard floor at 0: it is a radius, and a negative one is what the
		// apply below turns into "no glow" - so the row would be showing the
		// number that took the glow off
		min: 0, max: 100, step: 0.1, decimals: 1, unit: 'px', hard: [0, null],
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
		// hard both ends: a percentage of opacity, so 150 is not a stronger
		// glow - it is a number the object file would keep and the page would
		// clamp, and this is one of the three rows that reach the file as typed
		min: 0, max: 100, step: 1, unit: '%', hard: [0, 100],
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
		l.innerHTML = label;
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

	// the toggle wears the empty square glyph, the same one the image
	// panel's decorative toggle has (danja's call, 2026-09-24) - the base
	// .glue-font-toggle style is a white square with a black frame, and
	// .glue-font-toggle-on fills it dark, so the control reads as a dark
	// square when it is on and a white one when it is off
	var inner_toggle = document.createElement('div');
	inner_toggle.className = 'glue-font-toggle glue-glow-inner-toggle';
	var inner_glyph = document.createElement('span');
	inner_glyph.className = 'glue-glyph-empty-square';
	inner_toggle.appendChild(inner_glyph);
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

	var cell_glow = pair_cell('glow', glow_colour);
	var cell_inside = pair_cell('inside', inner_toggle);
	var cell_duo = pair_cell('second<br>glow', duotone);
	var cell_drop = pair_cell('shadow<br>color', drop_colour);
	var pair_glow = pair_row(cell_glow, cell_inside);
	var pair_duo = pair_row(cell_duo, cell_drop);
	adv.appendChild(pair_glow);
	adv.appendChild(pair_duo);

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
		// hard floor at 0: a blur radius, and the shadow is drawn without one
		// below that. Distance and spread are NOT floored - both are signed in
		// CSS, and a shadow up and to the left is what a negative distance is
		min: 0, max: 100, step: 1, unit: 'px', hard: [0, null],
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

	// --- the fold's layout: two columns, a rule, then the colours ---------
	//
	// left: fade, glow, opacity - right: distance, angle, blur, spread -
	// a rule - then the colours: the glow's and its second on the left,
	// the inside toggle and the shadow colour on the right. (danja's call,
	// 2026-09-26)
	var edge_grid = document.createElement('div');
	edge_grid.className = 'glue-edge-knobs-grid';
	var edge_left = document.createElement('div');
	edge_left.className = 'glue-edge-knobs-col';
	var edge_right = document.createElement('div');
	edge_right.className = 'glue-edge-knobs-col';
	// the two colour rows come out first, so the remainder splits evenly
	[pair_glow, pair_duo].forEach(function(r) {
		if (r.parentNode) {
			r.remove();
		}
	});
	// the split danja named (2026-09-26): opacity and blur on the left
	// (with the glow number, the fold's first row), the glow colours on
	// the right with the spread and the inside toggle. The rows start in
	// their build order - glow, opacity, then blur and spread of the
	// drop shadow, distance and angle already headed below - so the left
	// column takes the first two and blur, the right one spread and the
	// rest.
	for (var ei = 0; ei < 2; ei++) {
		edge_left.appendChild(adv.children[0]);
	}
	edge_left.appendChild(adv.children[0]);		// blur
	edge_right.appendChild(adv.children[0]);		// spread
	edge_right.appendChild(cell_glow);
	// inside sits right under the glow colour (danja's call, 2026-09-26)
	edge_right.appendChild(cell_inside);
	edge_right.appendChild(cell_duo);
	edge_grid.appendChild(edge_left);
	edge_grid.appendChild(edge_right);
	adv.insertBefore(edge_grid, adv.firstChild);
	var edge_rule = document.createElement('hr');
	edge_rule.className = 'glue-edge-knobs-rule';
	adv.insertBefore(edge_rule, edge_grid.nextSibling);
	// below the rule: distance and angle on the left, the shadow colour
	// on the right
	var colour_grid = document.createElement('div');
	colour_grid.className = 'glue-edge-knobs-grid';
	var colour_left = document.createElement('div');
	colour_left.className = 'glue-edge-knobs-col';
	var colour_right = document.createElement('div');
	colour_right.className = 'glue-edge-knobs-col';
	colour_left.appendChild(distance.row);
	colour_left.appendChild(angle.row);
	colour_right.appendChild(cell_drop);
	colour_grid.appendChild(colour_left);
	colour_grid.appendChild(colour_right);
	adv.insertBefore(colour_grid, footer);

	// --- the clip joins the two top numbers -------------------------------
	// The round and width rows stack on the left, the clip icon sits at
	// their right (danja's call, 2026-09-26) - the clip's old row goes.
	var edge_top_rows = document.createElement('div');
	edge_top_rows.className = 'glue-edge-top-rows';
	edge_top_rows.appendChild(radius.row);
	edge_top_rows.appendChild(border.row);
	// fade sits right under width, out of the fold (danja's call,
	// 2026-09-26)
	edge_top_rows.appendChild(fade.row);
	var edge_top = document.createElement('div');
	edge_top.className = 'glue-edge-top';
	edge_top.appendChild(edge_top_rows);
	// the clip's label, left of the button (danja's call, 2026-09-26)
	var clip_cell = document.createElement('div');
	clip_cell.className = 'glue-edge-clip';
	var clip_label = document.createElement('div');
	clip_label.className = 'glue-popover-label';
	clip_label.textContent = 'clip';
	clip_cell.appendChild(clip_label);
	clip_cell.appendChild(clip);
	edge_top.appendChild(clip_cell);
	// back where the rows always sat: above "more knobs", before the
	// fold's toggle
	pop.insertBefore(edge_top, fold.toggle);
	if (clip_row.parentNode) {
		clip_row.remove();
	}

	$.glue.popover.show(pop);
}

//
// --- object adjustment ------------------------------------------------------
//
// The stack, and the precise position: four z moves in the icon row, and the
// x/y rows right under it - no fold, the position is what one comes to this
// panel for (danja's call, 2026-09-23).
//
// It was three things until 2026-09-16 - flip, z-level and transparency in one
// panel - and the other two went to the object properties panel, where an
// object's own properties are. Z-level is not a property of the object but of
// the company it keeps; the position is the object's own, and its rows read
// and write the same stored coordinates the drag writes.
function object_adjust_popover(obj)
{
	var pop = $.glue.popover.open(obj, 'glue-adjust-popover');
	if (!pop) {
		return;
	}
	var save = function() {
		$.glue.object.save(obj);
	};

	// z-level: to the ends or one place at a time. level_up/level_down swap
	// with the nearest intersecting object and save both ends of the swap
	// themselves; to_top/to_bottom follow the menu's old pattern of save on
	// the way out.
	//
	// Four actions is the house style's first half; the values - the x/y
	// position - sit right below, out in the open.
	var z_row = $.glue.popover.icon_row();
	var z_btn = function(icon, title, fn) {
		var b = $.glue.popover.icon_button(icon, title);
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

	// x and y: the stored coordinates, typed or dragged precisely. Positions
	// have no natural bounds - the row's range only feeds the field's
	// steppers, since a typed value is never capped (number_row's own rule) -
	// and the drag moves one pixel per pixel of pointer, which is what makes
	// it a positioning control rather than a coarse scrub.
	var pos = {
		x: parseFloat(obj.style.left) || obj.offsetLeft,
		y: parseFloat(obj.style.top) || obj.offsetTop,
	};
	var pos_row = function(label, key) {
		var row = $.glue.popover.number_row(label, {
			min: -9999, max: 99999, step: 1, unit: 'px', sensitivity: 1,
			value: pos[key],
			apply: function(v, commit) {
				pos[key] = v;
				obj.style[key == 'x' ? 'left' : 'top'] = v+'px';
				if (commit) {
					save();
				}
			}
		});
		return row.row;
	};
	// the rows sit out in the open, no fold - the position is what one comes
	// to this panel FOR (danja's call, 2026-09-23)
	pop.appendChild(pos_row('x', 'x'));
	pop.appendChild(pos_row('y', 'y'));

	// The reset clears everything this panel owns, and only then saves - one
	// write, and nothing left behind that the save happened before. Same
	// ordering as the edge panel's footer. What it owns is the z-index alone
	// now: it used to clear the flip and the opacity too, and those are the
	// properties panel's to clear.
	var footer = $.glue.popover.row(false);
	footer.appendChild($.glue.popover.reset(
		'no manual layer: back in the default stack', function() {
			obj.style.zIndex = '';
			save();
		}));
	pop.appendChild(footer);

	$.glue.popover.show(pop);
}

//
// --- properties ------------------------------------------------------------
//
// One button that opens the panel where an object's own properties are set:
// what is under and on it (the background - a colour, a picture, and what the
// picture does with itself), the inset between its box and its content
// (padding), and two things about the object itself (its flip and its
// transparency).
//
// Everything in here is the object's OWN. How it sits against its neighbours
// (z-level) is the adjustments panel's, and how it is shaped (rounded corners,
// glow, shadow) is the edge panel's; those are relations and drawing, not
// properties.
//
// It was three places until 2026-09-16, and danja's call joined them: the
// background panel ("object background", the page's panel one button shorter),
// the adjustments panel's flip and transparency, and the text menu's own
// padding button. One panel per idea, and the idea here is the object's own
// properties - so the panel is named for them.
//
// The panel is a list of sections. Each draws its own rows into the popover and
// hands back the reset for what it owns; the footer runs them all and saves
// once. A section can be absent, and absent means not drawn at all rather than
// greyed: an image object has no background section (below), and only a text
// object has a padding one (the text module is the only thing in hotglue that
// stores padding).
//

function object_has_background(obj)
{
	return !!(obj && obj.style.backgroundImage && obj.style.backgroundImage != 'none');
}

// Where the background image sits, in px. parse the computed value because
// that is the one place the browser resolves '0% 0%', 'left top' and the
// pairs with only one number into something with two of them.
function object_background_position(obj)
{
	var start = getComputedStyle(obj).backgroundPosition.split(' ');
	var x = parseInt(start[0]);
	var y = parseInt(start[1]);
	return {
		x: isNaN(x) ? 0 : x,
		y: isNaN(y) ? 0 : y
	};
}

// The target of a link, as one of three choices instead of a free-text field
// (2026-09-23, danja): 'same window' stores nothing - the browser default -
// 'new tab' stores '_blank', and 'new window' stores a fixed window name (a
// named target opens one shared new window, the frame-name behaviour the free
// field always allowed). A stored value none of the three names keeps itself
// as an extra option rather than being rewritten.
//
// Shared by the object properties panel's link row (object_link_row below)
// and the font panel's (text_panel_link_build in modules/text/text-edit.js,
// which calls it the same guarded way the flip helpers are called).
function link_target_select() {
	var sel = document.createElement('select');
	sel.className = 'glue-link-target-select';
	[
		['', 'same window'],
		['_blank', 'new tab'],
		['hotglue-window', 'new window'],
	].forEach(function(o) {
		var el = document.createElement('option');
		el.value = o[0];
		el.textContent = o[1];
		sel.appendChild(el);
	});
	sel.set_value = function(value) {
		// show the stored value; one the three choices don't name is added
		// once as an extra option rather than rewritten (and a repeated sync
		// finds the same option again)
		var found = false;
		for (var i = 0; i < sel.options.length; i++) {
			if (sel.options[i].value === value) { found = true; break; }
		}
		if (!found && value) {
			var el = document.createElement('option');
			el.value = value;
			el.textContent = value;
			sel.appendChild(el);
		}
		sel.value = value;
	};
	return sel;
}

// The link row of the object properties panel: a url field and one button,
// the font panel's shape, with the target select on a row of its own under
// them. The link is not on the element - the renderer adds it in viewing
// mode - so the row is handed the stored object when it arrives (set below),
// and every commit writes straight back (glue.update_object /
// glue.object_remove_attr), the way the link panel this replaced did.
function object_link_row(obj)
{
	var row = document.createElement('div');
	row.className = 'glue-object-link-row';
	var url_input = document.createElement('input');
	url_input.type = 'text';
	url_input.className = 'glue-popover-field glue-object-link-field';
	// the prompt's examples, which were this feature's only documentation
	url_input.title = 'a full address (https://hotglue.me), a page name, or an anchor (#top)';
	var btn = document.createElement('button');
	btn.type = 'button';
	btn.className = 'glue-link-add-class';
	btn.textContent = 'make link';
	btn.title = 'put this address on the object';
	var target = link_target_select();
	target.title = 'where clicking the object opens the link';
	var target_row = $.glue.popover.row('target');
	target_row.appendChild(target);

	row.appendChild(url_input);
	row.appendChild(btn);

	var link = '';           // what the file says now
	var stored_target = '';  // and its target
	var mode = 'add';        // what the button does right now
	var prefill = '';        // the url the load put in, for change detection

	var sync = function() {
		if (mode == 'remove') {
			btn.textContent = 'remove link';
			btn.title = 'take the link off the object';
		} else if (mode == 'update') {
			btn.textContent = 'update link';
			btn.title = 'apply the edited address to the link';
		} else {
			btn.textContent = 'make link';
			btn.title = 'put this address on the object';
		}
	};

	var write_target = function() {
		var tgt = target.value;
		if (tgt) {
			$.glue.backend({ method: 'glue.update_object', name: obj.id, 'object-target': tgt });
			stored_target = tgt;
		} else if (stored_target) {
			$.glue.backend({ method: 'glue.object_remove_attr', name: obj.id, attr: 'object-target' });
			stored_target = '';
		}
	};

	var commit = function() {
		var url = url_input.value.trim();
		if (!url) {
			return;		// nothing typed, nothing to do
		}
		$.glue.backend({ method: 'glue.update_object', name: obj.id, 'object-link': url });
		link = url;
		prefill = url;
		write_target();
		mode = 'remove';
		sync();
	};

	var remove = function() {
		$.glue.backend({ method: 'glue.object_remove_attr', name: obj.id, attr: 'object-link' });
		if (stored_target) {
			$.glue.backend({ method: 'glue.object_remove_attr', name: obj.id, attr: 'object-target' });
		}
		link = '';
		stored_target = '';
		url_input.value = '';
		target.set_value('');
		prefill = '';
		mode = 'add';
		sync();
	};

	// the pre-filled url is selected the first time the field is focused, so
	// typing replaces it whole - the old link panel did the same on open, and
	// a link is usually replaced rather than edited (the caret would
	// otherwise land at the end and append)
	var select_on_focus = false;
	url_input.addEventListener('focus', function() {
		if (select_on_focus) {
			select_on_focus = false;
			url_input.select();
		}
	});
	url_input.addEventListener('keydown', function(e) {
		if (e.key == 'Escape') {
			// the panel's own Escape closes it; stopping the event here
			// keeps the panel open and empties the field instead - the
			// first press empties, the second closes the panel (the font
			// row's contract)
			e.preventDefault();
			e.stopPropagation();
			url_input.value = '';
			return;
		}
		if (e.key == 'Enter') {
			e.preventDefault();
			commit();
		}
	});
	// an edit to a pre-filled url flips the button from 'remove link' to
	// 'update link' - and back, if the author restores the stored value
	url_input.addEventListener('input', function() {
		if (mode != 'add' && prefill !== '') {
			mode = url_input.value != prefill ? 'update' : 'remove';
			sync();
		}
	});
	btn.addEventListener('click', function() {
		if (mode == 'remove') {
			remove();
		} else {
			commit();
		}
	});
	// a target change is a deliberate act and commits on its own - but only
	// when there is a link for it to say anything about; the choice made
	// before a link exists is read at commit
	target.addEventListener('change', function() {
		if (link) {
			write_target();
		}
	});

	return {
		row: row,
		target_row: target_row,
		// the stored object arrives after the panel is open; the row fills
		// in then
		set: function(new_link, new_target) {
			link = new_link || '';
			stored_target = new_target || '';
			url_input.value = link;
			prefill = link;
			target.set_value(stored_target);
			mode = link ? 'remove' : 'add';
			select_on_focus = !!link;
			sync();
		},
	};
}

function object_properties_popover(obj)
{
	var pop = $.glue.popover.open(obj, 'glue-properties-popover');
	if (!pop) {
		return;
	}
	var save = function() {
		$.glue.object.save(obj);
	};

	// The panel is the house style, in two pieces: a row of icon buttons that
	// is the panel from the outside - one per thing an object can be told to
	// do - and, under it, one "more knobs" fold holding everything that is a
	// value rather than an act. The convention is written down once, in
	// js/edit.js beside icon_row(). The row is built before the sections (they
	// fill it as they are built) and appended after them (the append order is
	// what the panel looks like).
	var icons = $.glue.popover.icon_row();
	var fold = $.glue.popover.fold(pop, 'more knobs');
	var body = fold.body;

	// The sections, in the order their controls are drawn. Two of them are not
	// always there, and absent means not drawn at all rather than greyed out:
	// the panel is the object's properties panel, and a property this kind of
	// object does not have is not a control that is waiting for something to
	// arrive.
	//
	// The padding section belongs to image, video and webvideo objects: the
	// picture or footage letterboxes inside the padded content box, and the
	// frame compensation the section does keeps the object's stored size
	// the OUTER one. The text object's padding rows moved to the font
	// popout's fold (danja's call, 2026-09-25) - there they sit next to the
	// type they pad. Text stores text-padding-* (module_text.inc.php), the
	// others object-padding-* (module_object.inc.php).
	var background = object_background_section(pop, icons, body, obj, save);
	var padding = (obj.classList.contains('image') ||
		obj.classList.contains('video') || obj.classList.contains('webvideo')) ?
		object_padding_section(body, obj, save) : null;
	var flip = object_flip_section(icons, obj, save);
	var transparency = object_transparency_section(body, obj, save);
	var sections = [background, padding, flip, transparency];

	// --- make the object a link --------------------------------------------
	//
	// The link row, the same shape the font panel's link row is (2026-09-23,
	// danja): a url field and a button out front, under the icon row and
	// before "more knobs", with the target as one of three choices on a row
	// of its own. The link is not on the element - the renderer adds it in
	// viewing mode - so the row reads the stored object when it arrives, and
	// writes straight back, the way the link panel this replaced did. Media
	// embeds don't get it (2026-09-24, danja): the embed is its own clickable
	// thing, so the link row and its target have nothing to say there.
	var link_ui = null;
	if (!obj.classList.contains('webvideo')) {
		link_ui = object_link_row(obj);
		$.glue.backend({ method: 'glue.load_object', name: obj.id }, function(data) {
			if (data['#error']) {
				$.glue.error(data['#error']);
				return;
			}
			// the backend wraps the object in '#data' (the old link panel read
			// it the same way)
			var stored = data['#data'];
			link_ui.set(stored['object-link'] || '', stored['object-target'] || '');
		}, false);
	}

	// --- put it back -------------------------------------------------------
	//
	// The reset is every section's, run in the order they were drawn with one
	// save at the end of it: one write, and nothing left behind that the save
	// happened before. Each section's reset clears only what is set, so a reset
	// on an object nobody has touched writes nothing at all. A background
	// picture is taken off by the colour button instead, which clears it first
	// with its confirm - one way to remove is enough, and the delete button
	// went (2026-09-24, danja).
	//
	// The reset is the fold's last row rather than a footer under the panel,
	// and is therefore behind a fold when the panel opens: that is the house
	// style's one cost, and it is the price of a panel that opens on the five
	// things you came for rather than on the ten you did not.
	var footer = $.glue.popover.row(false);
	footer.appendChild($.glue.popover.reset(
		'reset tiling, scale, position, padding, flip and transparency to their defaults',
		function() {
			sections.forEach(function(section) {
				if (section) {
					section.reset();
				}
			});
			save();
		}));
	body.appendChild(footer);

	pop.appendChild(icons);
	if (link_ui) {
		pop.appendChild(link_ui.row);
		pop.appendChild(link_ui.target_row);
	}
	pop.appendChild(fold.toggle);
	pop.appendChild(body);

	$.glue.popover.show(pop);
}

// The background section: what the background IS (a colour, a picture) and what
// the picture does with itself (tile it, move it, scale it, or take it off
// again). It is the page's background panel, one button shorter - the page's
// fourth is the scroll toggle, which is the page's alone, since an object and
// its background move together and there is nothing for such a control to say
// about one.
//
// The picture button used to BE the menu button: with no image the whole
// button was the file input, and only an object that already had a picture got
// a panel at all. That is the arrangement the page menu's background button had
// until 2026-09-16, and it went the same way it went there - when the panel can
// set the background itself, the menu button has nothing left to do but open
// it, and it opens whether or not there is a background, since an object with
// none needs somewhere to get one.
//
// The image belongs to the object rather than to the page: it uploads with
// preferred_module 'object' and the object's name, which object_upload() in
// module_object.inc.php takes. The url points at the
// object, not at the file - see object_serve_resource() there. The colour is
// the element's ordinary background-color: text objects have kept theirs in
// text-background-color since long before there was a panel, and
// object_alter_save() keeps it for every other kind of object.
//
// Returns the two things the panel's fold-footer needs: remove(), which takes
// the picture and its settings off the object, and reset(), which puts the rows
// it owns back to their defaults without touching the picture itself.
function object_background_section(pop, icons, body, obj, save)
{
	// --- what the background is, and what it does -------------------------
	//
	// Three of the panel's five actions - the page panel's own, one shorter: a
	// colour and a picture to set the object's background, and the tile toggle
	// for the picture. They go in the icon row, named in their tooltips and
	// nowhere else. What the picture then DOES with itself - where it sits, how
	// big it is - is the fold's first business, below.

	// Take the picture off the object, and the settings that described it, the
	// way the page's page_bg_clear() does. The delete in the fold's last row and
	// the colour button below both do this - dropping the picture is the same act
	// whether you asked for it or asked for a colour to put in its place - so
	// they share the one function.
	var bg_clear = function() {
		obj.style.backgroundImage = '';
		obj.style.backgroundRepeat = '';
		obj.style.backgroundPosition = '';
		obj.style.backgroundSize = '';
		// saved BEFORE the file attribute goes: object_alter_save() clears the
		// settings that described the picture only while the object still names
		// one, so a save that arrives after the name has gone leaves them on
		// disk with no picture to belong to
		save();
		// the file itself is dropped by the object no longer naming it
		$.glue.backend({ method: 'glue.object_remove_attr', name: obj.id,
			attr: 'object-background-file' });
	};

	// The colour button, which is the page panel's: a colour sits BEHIND an
	// opaque picture, so picking one while a picture is up would look like
	// nothing had happened - hence the clear first, with the confirm it has
	// always had. See page_background_popover() in modules/page/page-edit.js
	// for the long version of why this is not $.glue.popover.color_button().
	// The glyph is the shared color, the same as the page panel's and
	// every other colour button in the editor (danja's call, 09-16).
	var colour = $.glue.popover.color_button('set object background color',
		function() {
			return getComputedStyle(obj).backgroundColor;
		},
		function(col) {
			obj.style.backgroundColor = col;
		},
		function(col) {
			save();
		},
		function() {
			if (!object_has_background(obj)) {
				return;
			}
			if (!confirm('Do you want to clear the current background image?')) {
				return false;
			}
			bg_clear();
		});
	colour.classList.add('glue-background-color');
	icons.appendChild(colour);

	// The picture: a file picker $.glue.upload.button() lays over the icon, so
	// the button IS the picker and wants no click handler of its own. This is
	// what the menu button used to be, moved in with the rest; the upload
	// leaves the panel open, because what you do next - tiling, sizing, moving
	// - is all in here.
	//
	// 'object', not 'object-background': upload_files() dispatches by calling
	// "{preferred_module}_upload", so the name has to be the module's own or
	// the file falls through to the image module and becomes a new object.
	var image = $.glue.popover.icon_button('background-image', 'set object background image');
	image.classList.add('glue-background-image');
	$.glue.upload.button(image, { method: 'glue.upload_files', page: $.glue.page,
		preferred_module: 'object', object: obj.id }, {
		tooltip: 'set object background image',
		error: function(e) {
			$.glue.error('There was a problem uploading the file.');
		},
		finish: function(data) {
			if (!data || data['#error']) {
				$.glue.error('There was a problem uploading the file'+
					(data && data['#data'] ? ' ('+data['#data']+')' : ''));
				return;
			}
			if (obj.classList.contains('image')) {
				// an image object's background is painted by the server
				// render with the raw shared-file url (its object url
				// serves the PICTURE), so the panel re-renders instead of
				// guessing the url client-side
				$.glue.backend({ method: 'glue.render_object', name: obj.id, edit: true }, function(d) {
					if (!d || d['#error'] || !d['#data']) {
						return;
					}
					var tmpl = document.createElement('template');
					tmpl.innerHTML = d['#data'].trim();
					var fresh = tmpl.content.firstElementChild;
					if (fresh) {
						obj.innerHTML = fresh.innerHTML;
						obj.style.backgroundColor = fresh.style.backgroundColor;
						obj.style.backgroundImage = fresh.style.backgroundImage;
						obj.style.backgroundRepeat = fresh.style.backgroundRepeat;
						obj.style.backgroundPosition = fresh.style.backgroundPosition;
						obj.style.backgroundSize = fresh.style.backgroundSize;
					}
					save();
					arm();
					sync_has();
				}, false);
				return;
			}
			// the timestamp defeats the cache: the url does not change when
			// the file behind it does
			obj.style.backgroundImage = 'url('+$.glue.base_url+'?'+obj.id+
				'&'+(new Date().getTime())+')';
			obj.style.backgroundRepeat = 'no-repeat';
			save();
			// the panel is the move mode (see arm() below) and there is
			// something to move now; the tile toggle has something to tile
			arm();
			sync_has();
		}
	});
	icons.appendChild(image);

	// --- tiled or not -----------------------------------------------------
	//
	// The page's tile toggle, down to the drawing: the set's own, with the
	// state in the frame (glue-btn-active) rather than in a second glyph. Lit
	// means the picture repeats - which is what a browser does with a
	// background it has been told nothing about.
	//
	// The object writes the value either way, unlike the page, which drops the
	// attribute for "tiled": an object's picture goes up as no-repeat
	// (object_alter_render_early()'s own default when the attribute is absent),
	// so an empty inline style here would tile the picture live until the next
	// load. The reset button below sets no-repeat for the same reason.
	var repeat = $.glue.popover.icon_button('tile', 'tile object background image');
	repeat.classList.add('glue-background-tile');
	var sync_repeat = function() {
		repeat.classList.toggle('glue-btn-active',
			getComputedStyle(obj).backgroundRepeat.indexOf('no-repeat') == -1);
	};
	repeat.addEventListener('click', function() {
		var tiled = getComputedStyle(obj).backgroundRepeat.indexOf('no-repeat') == -1;
		obj.style.backgroundRepeat = tiled ? 'no-repeat' : 'repeat';
		sync_repeat();
		save();
	});
	icons.appendChild(repeat);
	sync_repeat();

	// --- move it around ---------------------------------------------------
	//
	// OPENING this panel is the mode: it hands the object's own drag over to
	// the background, so you grab the object and the image slides under it. A
	// picture behind text is judged by eye against the thing it sits behind,
	// and that judgement wants the picture under the pointer rather than a pad
	// in a panel. It lasts as long as the panel is open, and while it does the
	// object cannot be moved or resized - which is why the panel is closed
	// again when you are done moving the background.
	//
	// The two rows are the same position by hand, and they follow the drag
	// live: dragging is how you find the position, typing is how you fix it.
	// x 0 y 0 is the corner and is not written - absent means it, the way it
	// does everywhere else in this panel.
	var at = object_background_position(obj);
	var write_at = function() {
		obj.style.backgroundPosition = (at.x == 0 && at.y == 0) ? '' : at.x+'px '+at.y+'px';
	};
	// The min and max are a drag length, not a limit: the field keeps the real
	// number however far the drag went (see $.glue.popover.number_row).
	var x_row = $.glue.popover.number_row('x', {
		// coarse: a page position wants a finer hand than the default drag
		// gives - span/200 would move the picture 5px per pixel of drag
		min: -500, max: 500, step: 1, unit: 'px', coarse: true,
		value: at.x,
		apply: function(v, commit) {
			at.x = v;
			write_at();
			if (commit) {
				save();
			}
		}
	});
	var y_row = $.glue.popover.number_row('y', {
		// coarse: as x above
		min: -500, max: 500, step: 1, unit: 'px', coarse: true,
		value: at.y,
		apply: function(v, commit) {
			at.y = v;
			write_at();
			if (commit) {
				save();
			}
		}
	});
	var sync_rows = function() {
		x_row.set(at.x);
		y_row.set(at.y);
	};
	// the image moves up and left as readily as down and right, so these two
	// fields get the room for a sign (the shared one allows three digits)
	x_row.row.classList.add('glue-background-pos');
	y_row.row.classList.add('glue-background-pos');
	body.appendChild(x_row.row);
	body.appendChild(y_row.row);

	var armed = false;
	var saved = false;

	var restore = function() {
		if (!armed) {
			return;
		}
		var m = $.glue.object.moveable_of(obj);
		if (m) {
			// saved and put back rather than set to a fixed true: a locked
			// object is not draggable to begin with, and must stay that way
			m.draggable = saved.draggable;
			m.resizable = saved.resizable;
		}
		obj.style.touchAction = saved.touch_action;
		pop.keep_open_target = false;
		obj.removeEventListener('pointerdown', drag);
		obj.removeEventListener('click', swallow, true);
		armed = false;
	};

	var drag = function(e) {
		// primary button only: a right click on the object is the context menu
		// being asked for, and must not be turned into a drag - the pad this
		// came from sat in a panel, where that could not happen
		if (!e.isPrimary || e.button) {
			return;
		}
		var from = object_background_position(obj);
		at.x = from.x;
		at.y = from.y;
		$.glue.slider(e, function(x, y) {
			at.x = from.x+x;
			at.y = from.y+y;
			write_at();
			sync_rows();
		}, function() {
			save();
		});
		e.preventDefault();
	};

	// A canceled pointerdown does not stop the click the browser sends after
	// it. That click would reach whatever the object holds (a text object
	// starts editing) and the editor's own handler (clicking selects), so
	// while the panel is open the object's clicks are stopped here first - the
	// drag's leftovers, and nothing else.
	var swallow = function(e) {
		e.stopPropagation();
		e.preventDefault();
	};

	var arm = function() {
		if (armed) {
			return;
		}
		var m = $.glue.object.moveable_of(obj);
		saved = {
			draggable: m ? m.draggable : false,
			resizable: m ? m.resizable : false,
			touch_action: obj.style.touchAction
		};
		if (m) {
			m.draggable = false;
			m.resizable = false;
		}
		// $.glue.slider needs the gesture to itself, or the browser claims it
		// for scrolling and the drag never arrives - same as the pad
		obj.style.touchAction = 'none';
		pop.keep_open_target = obj;
		obj.addEventListener('pointerdown', drag);
		obj.addEventListener('click', swallow, true);
		armed = true;
	};
	// whatever the panel took, it puts back - by any of the ways it can close,
	// none of which is this panel's own code
	pop.on_close = restore;

	// --- size it -----------------------------------------------------------
	//
	// A percentage of the object's width; the height keeps the image's own
	// ratio ('% auto' is composed from the bare number, like the position the
	// x and y rows write). 100 is what the row shows when nothing is stored -
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
	// this section has three number fields, so the scale one is named - the
	// two above share glue-background-pos, and the bare .glue-popover-field
	// would match all three. Since the fold took everything with a label in it,
	// every row in there needs a name of its own: it is one list now, and the
	// only way to address a row in it is the class the row was given.
	scale_row.row.classList.add('glue-background-scale');
	body.appendChild(scale_row.row);

	// The tile toggle and the three number rows are all about the picture:
	// tiling it, moving it, sizing it. With none on the object they would be
	// tiling, moving and sizing a background that is not there, so they grey out
	// and go inert together until one arrives - the upload above calls this too,
	// so a picture dropped in while the panel is open wakes them where they
	// stand. (The page's panel greys its two toggles with it, and for the same
	// reason.) Defined here rather than with the tile toggle above because it
	// reaches all four, and the last of them is the row just appended.
	var sync_has = function() {
		var off = !object_has_background(obj);
		repeat.classList.toggle('glue-background-off', off);
		x_row.row.classList.toggle('glue-background-off', off);
		y_row.row.classList.toggle('glue-background-off', off);
		scale_row.row.classList.toggle('glue-background-off', off);
	};
	sync_has();

	// the panel is the move mode, so it takes the object's drag on the way in
	// and gives it back on the way out (pop.on_close, above) - but only when
	// there is a picture to move: an object with none has nothing for a drag to
	// move and must keep its own, until the upload above gives it something
	if (object_has_background(obj)) {
		arm();
	}

	return {
		remove: bg_clear,
		reset: function() {
			// Only what there is to reset: an object with no picture has no
			// tiling, position or scale to put back, and writing no-repeat at it
			// would store a setting about a picture that does not exist.
			if (object_has_background(obj)) {
				// no-repeat is the default tiling - the state a fresh upload
				// leaves, and the one the renderer fills in when the attribute is
				// absent; clearing the style to '' would tile the image live
				// until the next load
				obj.style.backgroundRepeat = 'no-repeat';
				obj.style.backgroundPosition = '';
				obj.style.backgroundSize = '';
			}
			at.x = 0;
			at.y = 0;
			sync_rows();
			sync_repeat();
			scale_row.set(100);
		}
	};
}

// The padding rows: the inset between the object's box and its content.
//
// Text objects only, and the reason is storage rather than taste: padding is
// kept as text-padding-x / text-padding-y, which the text module writes and
// renders (per-side attributes when the sides differ). Nothing else in hotglue
// has padding to store, so the rows are not drawn for anything else - the panel
// belongs to every object, but this section is the text module's.
//
// It was the text menu's own button until 2026-09-16 - "change padding", the
// module's last control in the menu after the font and spacing redesign - and
// moving it here is what the text-controls SOW said to do with it: the text's
// inset from the object's sides is a property of the object, not typography.
//
// Padding is internal: the outer box is captured once here and every change
// below compensates width/height by the padding it adds, so the object never
// moves while the panel is open (see the drag handler this replaced).
//
// The rows are the panel's fold's, since 2026-09-17: the uniform row first,
// the four sides under it. Building once is what makes the capture above safe -
// the fold only sets display, it never rebuilds a row.
//
// Returns an object with the section's reset.
function object_padding_section(body, obj, save)
{
	var outer_w = obj.offsetWidth;
	var outer_h = obj.offsetHeight;
	// padding can't eat more than half the shorter side without collapsing
	// the content area; the field is allowed to say more, and the apply below
	// clamps it
	var max = Math.floor(Math.min(outer_w, outer_h)/2);
	var pad = {};
	var side = function(name) {
		var v = parseInt(getComputedStyle(obj)['padding-'+name]);
		return isNaN(v) ? 0 : v;
	};
	pad.top = side('top');
	pad.right = side('right');
	pad.bottom = side('bottom');
	pad.left = side('left');

	var apply = function(commit) {
		obj.style.paddingLeft = pad.left+'px';
		obj.style.paddingRight = pad.right+'px';
		obj.style.paddingTop = pad.top+'px';
		obj.style.paddingBottom = pad.bottom+'px';
		obj.style.width = (outer_w-pad.left-pad.right)+'px';
		obj.style.height = (outer_h-pad.top-pad.bottom)+'px';
		if (commit) {
			save();
		}
	};

	// one value for all four sides. Starts at the left padding, and shows
	// what a drag would set all four to rather than chasing the knobs.
	var all = $.glue.popover.number_row('padding', {
		// hard both ends, because the apply below already clamps to exactly
		// this - saying it here as well is what makes the FIELD show the
		// padding the object has, rather than the number that was typed into it
		min: 0, max: max, step: 1, unit: 'px', hard: [0, max],
		value: pad.left,
		apply: function(v, commit) {
			pad.left = pad.right = pad.top = pad.bottom =
				Math.max(0, Math.min(max, Math.round(v)));
			apply(commit);
		}
	});
	// named, like every row of the fold it now sits in - a bare
	// .glue-popover-field matches several of them, and the fold is one list:
	// the background's x, y and scale, this section's uniform row, its four
	// sides, then the transparency.
	all.row.classList.add('glue-padding-row');
	body.appendChild(all.row);

	// --- each side on its own ---------------------------------------------
	//
	// These four were a fold of their own until 2026-09-17, also labelled "more
	// knobs" - which is now the name of the one fold the panel has, and they
	// are rows of it rather than of a fold inside a fold. A panel may hold only
	// one disclosure: a spec locating .glue-popover-advanced inside a panel must
	// find exactly one, and two folds would be two ways to hide the same knob.
	// Flattened, they lost the anonymity the fold gave them - they were its
	// whole contents, so a bare row could reach one - and each side takes a
	// name of its own.
	var knob = function(label, name) {
		var row = $.glue.popover.number_row(label, {
			// hard both ends, as the padding row above and for its reason
			min: 0, max: max, step: 1, unit: 'px', hard: [0, max],
			value: pad[name],
			apply: function(v, commit) {
				pad[name] = Math.max(0, Math.min(max, Math.round(v)));
				apply(commit);
			}
		});
		row.row.classList.add('glue-padding-'+name);
		body.appendChild(row.row);
		return row;
	};
	var top = knob('top', 'top');
	var right = knob('right', 'right');
	var bottom = knob('bottom', 'bottom');
	var left = knob('left', 'left');

	// the rows read the object's live padding again - after this section's
	// own rows, and after the font popout's drag button, which writes the
	// same four sides behind the rows' back (danja's call, 2026-09-26)
	var sync = function() {
		var c = getComputedStyle(obj);
		pad.top = parseInt(c.paddingTop);
		pad.right = parseInt(c.paddingRight);
		pad.bottom = parseInt(c.paddingBottom);
		pad.left = parseInt(c.paddingLeft);
		all.set(pad.left);
		top.set(pad.top);
		right.set(pad.right);
		bottom.set(pad.bottom);
		left.set(pad.left);
	};

	return {
		sync: sync,
		reset: function() {
			// Only when there is padding to clear: the compensation below writes
			// the object's width and height, and an object nobody has padded
			// should be left alone rather than have the size it already has
			// written back at it.
			if (!(pad.top || pad.right || pad.bottom || pad.left)) {
				return;
			}
			// No module default any more: reset means flush, the way the
			// historical engine renders a bare text object. Clearing the inline
			// padding is also what removes the stored text-padding-* keys on
			// save, and the box is compensated so nothing moves here either.
			obj.style.paddingLeft = '';
			obj.style.paddingRight = '';
			obj.style.paddingTop = '';
			obj.style.paddingBottom = '';
			var c = getComputedStyle(obj);
			pad.top = parseInt(c.paddingTop);
			pad.right = parseInt(c.paddingRight);
			pad.bottom = parseInt(c.paddingBottom);
			pad.left = parseInt(c.paddingLeft);
			obj.style.width = (outer_w-pad.left-pad.right)+'px';
			obj.style.height = (outer_h-pad.top-pad.bottom)+'px';
			all.set(pad.left);
			top.set(pad.top);
			right.set(pad.right);
			bottom.set(pad.bottom);
			left.set(pad.left);
		}
	};
}

// The flip: two toggles, one per axis, independent of each other.
//
// The state lives in a matrix() term of the object's transform, which the
// transform module owns and stores; its helpers are plain functions in this
// same scope, and are guarded here in case the module was disabled. The active
// class is the pressed-in frame from the icon buttons' toggle state.
//
// It was the adjustments panel's until 2026-09-16 - a flip is a property of the
// object itself, where z-level is its relation to its neighbours - and a menu
// button before that, whose one click cycled through four states (none, h, v,
// both). Two toggles make 'flip both axes' a state rather than a stop on the
// way back to none.
//
// The two toggles are the panel's last two actions, in the icon row after the
// background's three - horizontal first, the order the concept names them in.
//
// Returns an object with the section's reset.
function object_flip_section(icons, obj, save)
{
	// The artwork is danja's pair: flip-h.svg draws the shape reflected
	// across a horizontal dashed line, flip-v.svg the same drawing turned
	// on its side - each file depicts the flip its own click performs
	// (2026-09-23, the earlier names were crossed because the old art
	// read opposite to the action).
	var flip_h = $.glue.popover.icon_button('flip-h', 'flip horizontally');
	var flip_v = $.glue.popover.icon_button('flip-v', 'flip vertically');
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
	icons.appendChild(flip_h);
	icons.appendChild(flip_v);
	flip_sync();

	return {
		reset: function() {
			if (typeof transform_set_flip == 'function') {
				var axes = transform_flip_axes(obj);
				// nothing flipped, nothing written: the transform is left
				// exactly as it is, so an object nobody has flipped keeps the
				// rotation it may have without a write putting the same value
				// back. (set_flip edits its own term and would leave a rotation
				// alone, but a write is a write.)
				if (axes.h || axes.v) {
					transform_set_flip(obj, false, false);
				}
			}
			flip_sync();
		}
	};
}

// Transparency: the object's opacity as a percentage, on the shared
// slider-plus-field row. It was the adjustments panel's until 2026-09-16, and
// a menu button with a hidden drag-distance gesture before that.
//
// Returns an object with the section's reset.
function object_transparency_section(body, obj, save)
{
	var opacity = $.glue.popover.number_row('opacity', {
		// THE row the hard range was added for. opacity is 0 to 1 in CSS, and
		// out of range here is not a declaration the browser throws away - it
		// CLAMPS it and keeps the number. Measured in both engines: a typed -50
		// leaves "opacity: -0.5" on the element, so the object goes invisible,
		// and object-opacity: -0.5 in the FILE; 150 leaves 1.5 in both while
		// the page renders 1. So the panel showed the number that was typed
		// and the file kept a number opacity cannot take
		min: 0, max: 100, step: 1, unit: '%', hard: [0, 100],
		value: object_transparency_percent(obj),
		apply: function(pct, commit) {
			obj.style.opacity = pct/100;
			if (commit) {
				save();
			}
		}
	});
	opacity.row.classList.add('glue-opacity-row');
	body.appendChild(opacity.row);

	return {
		reset: function() {
			// clearing the inline value, not writing 1 into it: that is what
			// object_alter_save() reads as "no opacity" (unset on the way out),
			// so an object nobody has dimmed keeps the file it had
			obj.style.opacity = '';
			opacity.set(100);
		}
	};
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
	elem = $.glue.icon('clone-object', 'create a clone of this object');
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

	// object adjustment: z-level in one popout. It was flip, z-level and
	// transparency, in place of the three menu buttons that each hid a gesture
	// - the flip's four-state cycle and the two drag-distance sliders; the
	// other two went to the properties button below on 2026-09-16. The PNG
	// artwork of the removed buttons stays in this directory, like
	// transform-rotate.png in the transform module's.
	elem = $.glue.icon('change-layer', 'object position controls: layer up/down and x/y position');
	elem.addEventListener('click', function(e) {
		object_adjust_popover($.glue.owner(this));
	});
	// in the top row, after the text items (prios 1-6): 7 and 8
	$.glue.contextmenu.register('object', 'object-adjust', elem, 7, true);

	// border properties and effects: rounded corners, style, shadow and glow
	elem = $.glue.icon('object-border-properties', 'object border properties and effects: rounded corners, style, shadow and glow');
	elem.addEventListener('click', function(e) {
		object_edge_popover($.glue.owner(this));
		e.stopPropagation();
	});
	$.glue.contextmenu.register('object', 'object-edge', elem, 3);

	// object properties: the panel, which is where the object's own properties
	// are set - the background under and on it, the padding between its box and
	// its content, and its flip and its transparency. The menu button only
	// opens it, and opens it whatever the object has: an object with no
	// background has to get one in there, and one with no padding has to be
	// able to be given some; the button used to be the file picker itself until
	// the panel took that over.
	//
	// Left-most in the top row (prio 0): the background is the object-wide
	// setting the rest of the row sits on top of, and it is the button whose
	// panel everything else in this menu is read against. The key and the
	// tooltip were 'object background' until 2026-09-16, when the panel grew
	// the padding, the flip and the transparency and stopped being about the
	// background alone. The icon is unchanged - a filled square is what an
	// object's properties panel looks like from here, and the button's place in
	// the row has not moved.
	elem = $.glue.icon('object-properties', 'object properties: background color/image, transparency, padding, flip, link');
	elem.addEventListener('click', function(e) {
		object_properties_popover($.glue.owner(this));
		e.stopPropagation();
	});
	$.glue.contextmenu.register('object', 'object-properties', elem, 0, true);

	// 'object attributes', not 'object properties: id, classes and custom
	// attributes', which is what this said until 2026-09-16. The panel button
	// above took that name, and it is the better one for the panel - what is
	// under an object, and how it is flipped, is as much a property of it as
	// the id is. What this action is about is the object as an element: what it
	// is called, what classes it carries, what it points at.
	elem = $.glue.icon('object-html-attributes', 'object HTML attributes: id, class and custom values');
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

	elem = $.glue.icon('shared-w-other-pages', 'make this object appear on all pages');
	elem.addEventListener('click', function(e) {
		var obj = $.glue.owner(this);
		$.glue.backend({ method: 'glue.object_make_symlink', name: obj.id });
	});
	$.glue.contextmenu.register('object', 'object-symlink', elem);

	elem = $.glue.icon('delete', 'delete object (UNDOABLE)');
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

	// copy: the object goes onto a clipboard held by the browser itself, so it
	// survives the page load that changing pages is - copy here, paste on any
	// other page of the site. The clipboard is otherwise invisible and a copy
	// gives no sign of itself, so the icon carries a dot in its top right
	// corner while there is something on it, and says so in words in its
	// tooltip - the dot alone is 2px. A badge, not the editor's "this state is
	// on" green: that would have said something about THIS object, and the
	// clipboard is one slot for the whole editor holding an object that may
	// well not be the one whose menu is open.
	elem = $.glue.icon('copy-to-clipboard', 'copy object to clipboard: paste copied object on any page of your site');
	// note: elem is reused for every item in this scope, so the closure must
	// capture this button, not the mutable elem
	var copy_elem = elem;
	var copy_sync = function() {
		var full = $.glue.clipboard.has_clipboard();
		copy_elem.classList.toggle('glue-clipboard-full', full);
		copy_elem.title = full ? 'copy object to clipboard: [previous data present]' : 'copy object to clipboard: paste copied object on any page of your site';
	};
	elem.addEventListener('glue-menu-activate', copy_sync);
	// a copy by shortcut leaves this button untouched, so it is told when the
	// clipboard changes rather than asked only when its menu opens (see the
	// trigger in $.glue.clipboard)
	document.addEventListener('glue-clipboard-change', copy_sync);
	elem.addEventListener('click', function(e) {
		var obj = $.glue.owner(this);
		// no syncing here: a successful copy fires the event above, and a
		// failed one changed nothing to sync
		$.glue.clipboard.copy_of(obj, function(ok, msg) {
			if (!ok) {
				$.glue.error(msg);
			}
		});
	});
	// in the top row with the adjustments (7) and the background (8), after
	// both: the row runs text items, then those, then this
	$.glue.contextmenu.register('object', 'object-copy', elem, 9, true);

	// paste: writes whatever was copied into the page that is open now, which
	// may well be a different page than the one it came from. It belongs with
	// the other ways of putting something onto this page, so it goes in the
	// single-click menu, after the object types (10-13) and before undo/redo
	// (20-21) - and it is dead weight while the clipboard is empty, so it
	// shows itself only when there is something to paste.
	elem = $.glue.icon('paste-from-clipboard', 'paste copied object');
	elem.addEventListener('glue-menu-activate', function(e) {
		// menu.show() drops anything that reports itself hidden right after
		// this event (see the check in js/edit.js)
		this.style.display = $.glue.clipboard.has_clipboard() ? '' : 'none';
	});
	elem.addEventListener('click', function(e) {
		$.glue.menu.hide();
		$.glue.clipboard.paste_into_current_page(function(ok, msg) {
			if (!ok) {
				$.glue.error(msg);
			}
		});
	});
	$.glue.menu.register('new', elem, 15);
});
