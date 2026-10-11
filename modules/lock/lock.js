/**
 *	modules/lock/lock.js
 *	Frontend code for general object properties
 *
 *	Copyright Gottfried Haider, Danja Vasiliev 2010.
 *	This source code is licensed under the GNU General Public License.
 *	See the file COPYING for more details.
 *
 */

/**
 *	NOTE: this module introduces a new object class .locked
 *	Any other modules which define keybinding onto the objects
 *	must include .not('.locked') to their selectors.
 *
 *	i.e. $('.glue-selected').not('.locked')
 */

$.glue.live('.object', 'glue-object-lock', function(e) {
	// if object is in locked state
	// disable dragging and resize

	if (this.classList.contains('locked')) {
		var m = $.glue.object.moveable_of(this);
		if (m) {
			m.draggable = false;
			m.resizable = false;
			// modules/transform/transform.js turns this on while an object is
			// selected; locking one that is already selected has to take it
			// away again, or the rotation handle stays live
			m.rotatable = false;
		}
		// small workaround for textarea resize handle
		if (this.classList.contains('text')) {
			var ta = this.querySelector(':scope > textarea');
			if (ta) {
				ta.style.resize = 'none';
			}
		}
	}
});

// The padlock glyph shows the ACTION the click performs, not the state the
// object is in (danja's call, 2026-10-06): lock.svg (the closed padlock)
// while the object is unfrozen - click to freeze it - and unlock.svg (the
// open padlock) once it is frozen - click to unfreeze it. The two live at
// module scope since Alpine evaluates its expressions as global strings.
function lock_set_icon(el, locked) {
	var url = new URL($.glue.base_url+'img/icons/' +
		(locked ? 'unlock' : 'lock')+'.svg', document.baseURI).href;
	el.style.setProperty('--glue-icon', 'url("'+url+'")');
	Alpine.$data(el).locked = locked;
}

// re-synced whenever the context menu is (re)shown for an object. For a
// selection of several the glyph is the action on the lot: unfreeze only
// when every one of them is frozen
function lock_sync(el) {
	var all = $.glue.sel.targets($.glue.owner(el)).every(function(obj) {
		return obj.classList.contains('locked');
	});
	lock_set_icon(el, all);
}

// freezes or unfreezes one object
function lock_apply(obj, lock) {
	var m = $.glue.object.moveable_of(obj);
	// handles only show on a lone selected object
	var alone = obj.classList.contains('glue-selected') &&
		document.querySelectorAll('.glue-selected').length == 1;

	if (!lock) {
		obj.classList.remove('locked');
		if (m) {
			m.draggable = true;
			// resize handles only show while selected
			m.resizable = obj.classList.contains('resizable') && alone;
			m.rotatable = alone;
		}
	} else {
		// an object locked mid-edit stops being editable: stop_editing
		// commits the session's content first, and the lock makes the
		// object inert - a text block left contenteditable would keep
		// accepting keystrokes behind the lock's back
		if (obj.classList.contains('glue-text-editing')) {
			$.glue.text.stop_editing(obj);
		}
		obj.classList.add('locked');
		if (m) {
			m.draggable = false;
			m.resizable = false;
			m.rotatable = false;
		}
		if (obj.classList.contains('text')) {
			var ta = obj.querySelector(':scope > textarea');
			if (ta) {
				ta.style.resize = 'none';
			}
		}
	}
	$.glue.object.save(obj);
}

// toggles the lock state of the icon's current owner object (see
// $.glue.owner), or of every selected object when the owner is one of
// several, and returns the new locked state - kept as a plain function
// rather than inline in the x-on:click expression below since it has side
// effects on a different element (the owner object), not just on the
// icon's own Alpine state
function lock_toggle(iconElem) {
	var obj = $.glue.owner(iconElem);
	var targets = $.glue.sel.targets(obj);
	// several objects of mixed state all freeze; they unfreeze only when
	// every one is frozen already
	var lock = !targets.every(function(t) {
		return t.classList.contains('locked');
	});
	$.glue.undo.begin_batch();
	targets.forEach(function(t) {
		lock_apply(t, lock);
	});
	$.glue.undo.end_batch();
	$.glue.contextmenu.hide();
	$.glue.contextmenu.show(obj, 1 < targets.length);
	return lock;
}

document.addEventListener('DOMContentLoaded', function() {
	//
	// trigger object lock check
	//
	$.glue.trigger('.object', 'glue-object-lock');

	//
	// register menu item
	//
	$.glue.contextmenu.hide();

	// Alpine drives the tooltip text from the same state the glyph uses
	var elem = $.glue.icon('lock');

	elem.setAttribute('x-data', '{ locked: false }');
	elem.setAttribute('x-bind:title', "locked ? 'unfreeze object - this object is frozen' : 'freeze object'");
	elem.setAttribute('x-on:glue-menu-activate', 'lock_sync($el)');
	elem.setAttribute('x-on:click', 'lock_set_icon($el, lock_toggle($el))');

	$.glue.contextmenu.register('object', 'object-lock', elem, 19);
});
