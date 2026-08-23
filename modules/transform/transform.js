/**
 *	modules/transform/transform.js
 *	Frontend code for general object properties
 *
 *	Copyright Gottfried Haider, Danja Vasiliev 2010.
 *	This source code is licensed under the GNU General Public License.
 *	See the file COPYING for more details.
 */

//
// An object's flip and its rotation are two terms in ONE css transform
// property, which module_transform.inc.php stores whole (under the attribute
// name transform-flip, which predates there being a rotation in it). So the
// flip button and the rotation handle below have to edit their own term and
// leave the other one alone, and neither may go through
// getComputedStyle(): computed style resolves the
// function list down to a single matrix(), in which a rotation and a flip are
// no longer distinguishable - a rotated object would read back as some
// matrix() that matches none of the flip states, and flipping it would
// overwrite the rotation. The element's own .style still reflects the
// function list as it was literally assigned, so that is what is parsed.
//

function transform_term(obj, re)
{
	var m = (obj.style.getPropertyValue('transform') || '').match(re);
	return m ? m[0] : '';
}

// replaces (or removes, when 'term' is empty) the one function matching 're',
// keeping everything else in the transform in place
function transform_set_term(obj, re, term)
{
	var cur = obj.style.getPropertyValue('transform') || '';
	var m = cur.match(re);
	if (m) {
		cur = cur.replace(m[0], '');
	}
	if (term) {
		cur += ' '+term;
	}
	cur = cur.replace(/\s+/g, ' ').trim();
	obj.style.setProperty('transform', cur);
}

var TRANSFORM_FLIP_RE = /matrix\([^)]*\)/;
var TRANSFORM_ROTATE_RE = /rotate\(-?\d+(?:\.\d+)?deg\)/;

function transform_rotation(obj)
{
	var m = transform_term(obj, TRANSFORM_ROTATE_RE).match(/-?\d+(?:\.\d+)?/);
	return m ? parseFloat(m[0]) : 0;
}

// deg is normalized into 0..359 and rounded: whole degrees keep the stored
// value short and the regex above simple, and 0 is stored as no term at all
// so an object that has been rotated back to straight looks exactly like one
// that never was
function transform_set_rotation(obj, deg)
{
	deg = Math.round(deg) % 360;
	if (deg < 0) {
		deg += 360;
	}
	transform_set_term(obj, TRANSFORM_ROTATE_RE, deg ? 'rotate('+deg+'deg)' : '');
}

document.addEventListener('DOMContentLoaded', function() {
	//
	// register menu items
	//
	var elem;
	elem = document.createElement('img');
	elem.src = $.glue.base_url+'modules/transform/transform-flip.png';
	elem.alt = 'btn';
	elem.title = 'flip object';
	elem.width = 32;
	elem.height = 32;
	elem.addEventListener('click', function(e) {
		var obj = $.glue.owner(this);
		// cycle: none -> both axes -> horizontal -> vertical -> none
		var val = transform_term(obj, TRANSFORM_FLIP_RE).replace(/\s+/g, '');
		var next;
		if (val == 'matrix(-1,0,0,-1,0,0)') {
			next = 'matrix(1, 0, 0, -1, 0, 0)';
		} else if (val == 'matrix(1,0,0,-1,0,0)') {
			next = 'matrix(-1, 0, 0, 1, 0, 0)';
		} else if (val == 'matrix(-1,0,0,1,0,0)') {
			next = '';
		} else {
			next = 'matrix(-1, 0, 0, -1, 0, 0)';
		}
		transform_set_term(obj, TRANSFORM_FLIP_RE, next);
		$.glue.object.save(obj);
	});
	$.glue.contextmenu.register('object', 'object-transform-flip', elem, 5);
});

//
// Rotation is direct manipulation only: Moveable's own handle, shown while an
// object is selected the way the resize handles are (js/edit.js). There was a
// 90°-per-click button in the object menu until the handle existed, at which
// point it was a second, worse way to do the same thing - the artwork for it
// is still in this directory.
//
// It snaps to 15° BY DEFAULT and shift releases it to any angle, which is the
// opposite way round from most editors. The reason is that the thing being
// rotated is a page element, and the reader will notice a heading that sits
// at 7° when it was meant to be straight: losing precision by accident is the
// startling outcome here, so precision is the deliberate one.
//
var transform_rotate_bound = new WeakSet();

$.glue.live('.object', 'glue-select', function(e) {
	var obj = this;
	var m = $.glue.object.moveable_of(obj);
	if (!m || obj.classList.contains('locked')) {
		return;
	}
	if (!transform_rotate_bound.has(obj)) {
		transform_rotate_bound.add(obj);
		var start_deg = 0;
		// e.dist is the rotation accumulated since rotateStart. Moveable's
		// absolute e.rotation is NOT usable here: it comes from the matrix it
		// reads off the element, so a flipped object starts life at 180° as
		// far as Moveable is concerned and the object would jump on the first
		// move. Adding the delta to what the element actually stores keeps
		// the two independent.
		m.on('rotateStart', function(ev) {
			start_deg = transform_rotation(obj);
		}).on('rotate', function(ev) {
			// The 15° snap is Moveable's throttleRotate rather than a
			// Math.round here, so that there is ONE angle: Moveable draws its
			// control box from its own state, so snapping only the value
			// written to the object would leave the handles sitting a few
			// degrees off the object they belong to. It throttles the
			// absolute angle, not the delta, so this lands on multiples of 15
			// whatever the object started at. Reading shift per event rather
			// than at rotateStart lets it be pressed mid-drag.
			m.throttleRotate = (ev.inputEvent && ev.inputEvent.shiftKey) ? 0 : 15;
			transform_set_rotation(obj, start_deg+ev.dist);
			// the offsets that keep the handles outside the object turn with
			// it, so they are recomputed as it turns
			$.glue.object.place_handles(obj);
		}).on('rotateEnd', function(ev) {
			$.glue.object.save(obj);
			m.updateRect();
			$.glue.object.place_handles(obj);
			// the object's visual box has turned with it, and the menu is
			// placed around that box
			$.glue.contextmenu.reposition();
		});
	}
	m.rotatable = true;
	// 15° steps unless shift is held - see the rotate handler below
	m.throttleRotate = 15;
	// Out of the middle of the RIGHT edge, where it emerges from the 'e'
	// resize handle, rather than Moveable's default position above the box:
	// that is exactly where contextmenu.show() puts the top row of menu
	// buttons, so the handle landed among them and the two fought over the
	// same pixels. The right edge is clear - the left-hand column is on the
	// other side and the top row stops at the object's corner.
	m.rotationPosition = 'right';
});

$.glue.live('.object', 'glue-deselect', function(e) {
	var m = $.glue.object.moveable_of(this);
	if (m) {
		m.rotatable = false;
	}
});
