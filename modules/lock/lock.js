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

$('.object').live('glue-object-lock', function(e) {
	// if object is in locked state
	// disable dragging and resize

	if ($(this).hasClass('locked')) {
		$(this).draggable('disable');
		$(this).resizable('disable');
		// small workaround for textarea resize handle
		if ($(this).hasClass('text')) {
			$(this).children('textarea').css('resize', 'none');
		}
	} 
});


$(document).ready(function() {
	//
	// trigger object lock check 
	//
	$('.object').trigger('glue-object-lock');
	
	//
	// register menu items
	//
	var elem;
	$.glue.contextmenu.hide();

	elem = $('<img src="'+$.glue.base_url+'modules/lock/lock.png" alt="btn" title="lock object" width="32" height="32">');

	$(elem).bind('glue-menu-activate', function(e) {
		var obj = $(this).data('owner');
		var tip 
		if ($(obj).hasClass('locked')) {
			tip = 'object is locked, click to unlock it';
		} else { tip = 'lock object'; 
		}
		$(this).attr('title', tip);
	});

	$(elem).bind('click', function(e) {
		var that = this;
		var obj = $(this).data('owner');

		if ($(obj).hasClass('locked')) {
			$(obj).removeClass('locked');
			$(obj).draggable('enable');
			$(obj).resizable('enable');
			$.glue.contextmenu.hide();
			$.glue.contextmenu.show(obj);
		} else {
			$(obj).addClass('locked');
			$(obj).draggable('disable');
			$(obj).resizable('disable');
			if ($(obj).hasClass('text')) {
				$(obj).children('textarea').css('resize', 'none');
			}
			$.glue.contextmenu.hide();
			$.glue.contextmenu.show(obj);
		}
		$(that).trigger('glue-menu-activate');
		$.glue.object.save(obj);
	});
	
	$.glue.contextmenu.register('object', 'object-lock', elem, 19);
});
