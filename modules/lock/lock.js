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

$('.object').glueLive('glue-object-lock', function(e) {
	// if object is in locked state
	// disable dragging and resize

	if ($(this).hasClass('locked')) {
		var m = $.glue.object.moveable_of(this);
		if (m) {
			m.draggable = false;
			m.resizable = false;
		}
		// small workaround for textarea resize handle
		if ($(this).hasClass('text')) {
			$(this).children('textarea').css('resize', 'none');
		}
	}
});

// toggles the lock state of the icon's current owner object (see
// $.glue.owner) and returns the new locked state - kept as a plain
// function rather than inline in the x-on:click expression below since it
// has side effects on a different element (the owner object), not just on
// the icon's own Alpine state
function lock_toggle(iconElem) {
	var obj = $.glue.owner(iconElem);
	var m = $.glue.object.moveable_of(obj);
	var nowLocked;

	if ($(obj).hasClass('locked')) {
		$(obj).removeClass('locked');
		if (m) {
			m.draggable = true;
			// resize handles only show while selected (this button only
			// appears in the context menu of a selected object, but check
			// explicitly rather than assume)
			m.resizable = $(obj).hasClass('resizable') && $(obj).hasClass('glue-selected');
		}
		nowLocked = false;
	} else {
		$(obj).addClass('locked');
		if (m) {
			m.draggable = false;
			m.resizable = false;
		}
		if ($(obj).hasClass('text')) {
			$(obj).children('textarea').css('resize', 'none');
		}
		nowLocked = true;
	}
	$.glue.contextmenu.hide();
	$.glue.contextmenu.show(obj);
	$.glue.object.save(obj);
	return nowLocked;
}

document.addEventListener('DOMContentLoaded', function() {
	//
	// trigger object lock check
	//
	$('.object').glueTrigger('glue-object-lock');

	//
	// register menu item
	//
	$.glue.contextmenu.hide();

	var elem = document.createElement('img');
	elem.src = $.glue.base_url+'modules/lock/lock.png';
	elem.alt = 'btn';
	elem.width = 32;
	elem.height = 32;

	// Alpine tracks whether the current owner is locked, purely to drive
	// the tooltip text; re-synced whenever the context menu is (re)shown
	// for an object (glue-menu-activate), and set directly from
	// lock_toggle()'s return value on click
	elem.setAttribute('x-data', '{ locked: false }');
	elem.setAttribute('x-bind:title', "locked ? 'object is locked, click to unlock it' : 'lock object'");
	elem.setAttribute('x-on:glue-menu-activate', 'locked = $.glue.owner($el).classList.contains("locked")');
	elem.setAttribute('x-on:click', 'locked = lock_toggle($el)');

	$.glue.contextmenu.register('object', 'object-lock', elem, 19);
});
