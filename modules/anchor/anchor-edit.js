/**
 *	modules/anchor/anchor-edit.js
 *	Frontend code for anchor objects
 *
 *	Copyright Gottfried Haider, Danja Vasiliev 2010.
 *	This source code is licensed under the GNU General Public License.
 *	See the file COPYING for more details.
 */

$(document).ready(function() {
	$.glue.contextmenu.veto('anchor', 'object-clone');
	$.glue.contextmenu.veto('anchor', 'object-link');
	$.glue.contextmenu.veto('anchor', 'object-transparency');
	$.glue.contextmenu.veto('anchor', 'object-zindex');
	
	//
	// menu items
	//
	var elem = $('<img src="'+$.glue.base_url+'modules/anchor/anchor.png" alt="btn" title="add a named anchor" width="32" height="32">');
	$(elem).bind('click', function(e) {
		$.glue.menu.hide();
		var name = prompt('Enter the anchor\'s name (e.g. #someanchor)');
		if (name) {
			// strip any # from the beginning of name
			if (name.substr(0, 1) == '#') {
				name = name.substr(1);
			}
			$.glue.backend({ method: 'glue.create_object', 'page': $.glue.page }, function(data) {
				var elem = $('<div class="anchor object" style="position: absolute;" title="this is a named anchor, regular visitors won\'t be seing this icon"><div id="'+name+'" class="glue-anchor-name glue-ui">#'+name+'</div></div>');
				$(elem).attr('id', data['name']);
				$('body').append(elem);
				$(elem).css('width', $(elem).width()+'px');
				$(elem).css('height', $(elem).height()+'px');
				$(elem).css('left', (e.pageX-$(elem).outerWidth()/2)+'px');
				$(elem).css('top', (e.pageY-$(elem).outerHeight()/2)+'px');
				$.glue.object.register(elem);
				$.glue.object.save(elem);
			});
		}
	});
	$.glue.menu.register('new', elem, 14);
	
	//
	// context menu items
	//
	elem = $('<img src="'+$.glue.base_url+'modules/anchor/anchor-name.png" alt="btn" title="change the anchor\'s name" width="32" height="32">');
	$(elem).bind('click', function(e) {
		var obj = $(this).data('owner');
		var old_name = '#'+$(obj).children('.glue-anchor-name').attr('id');
		$.glue.menu.hide();
		var name = prompt('Enter the anchor\'s name (e.g. #someanchor)', old_name);
		if (name && name != old_name) {
			// strip any # from the beginning of name
			if (name.substr(0, 1) == '#') {
				name = name.substr(1);
			}
			$(obj).children('.glue-anchor-name').attr('id', name);
			$(obj).children('.glue-anchor-name').html('#'+name);
			$.glue.object.save(obj);
		}
	});
	$.glue.contextmenu.register('anchor', 'anchor-name', elem);
});
