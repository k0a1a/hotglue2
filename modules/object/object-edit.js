/**
 *	modules/object/object-edit.js
 *	Frontend code for general object properties
 *
 *	Copyright Gottfried Haider, Danja Vasiliev 2010.
 *	This source code is licensed under the GNU General Public License.
 *	See the file COPYING for more details.
 */

$(document).ready(function() {
	//
	// register menu items
	//
	var elem;
	elem = $('<img src="'+$.glue.base_url+'modules/object/object-clone.png" alt="btn" title="clone object" width="32" height="32">');
	$(elem).bind('click', function(e) {
		var obj = $(this).data('owner');
		$.glue.backend({ method: 'glue.clone_object', name: $(obj).attr('id') }, function(data) {
			// deselect current object
			$.glue.sel.none();
			var clone = $(obj).clone();
			// set new id
			$(clone).attr('id', data);
			// move object a bit
			$(clone).css('left', ($(obj).position().left+$.glue.grid.x())+'px');
			$(clone).css('top', ($(obj).position().top+$.glue.grid.y())+'px');
			// add to dom and register
			$('body').append(clone);
			$(clone).trigger('glue-pre-clone');
			$.glue.object.register(clone);
			// select new object
			$.glue.sel.select(clone);
			$.glue.object.save(clone);
		});
	});
	$.glue.contextmenu.register('object', 'object-clone', elem, 1);
	
	elem = $('<img src="'+$.glue.base_url+'modules/object/object-transparency.png" alt="btn" title="change transparency" width="32" height="32">');
	$(elem).bind('glue-menu-activate', function(e) {
		var obj = $(this).data('owner');
		var opacity = parseFloat($(obj).css('opacity'))*100;
		var tip = 'change transparency ('+opacity.toFixed(0)+'%)';
		$(this).attr('title', tip);
	});
	$(elem).bind('mousedown', function(e) {
		var that = this;
		var obj = $(this).data('owner');
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
			$(obj).css('opacity', x);
		}, function(x, y) {
			$.glue.object.save(obj);
			// update tooltip (see above)
			$(that).trigger('glue-menu-activate');
		});
		return false;
	});
	$.glue.contextmenu.register('object', 'object-transparency', elem, 2);
	
	elem = $('<img src="'+$.glue.base_url+'modules/object/object-zindex.png" alt="btn" title="bring object to foreground or background" width="32" height="32">');
	$(elem).bind('mousedown', function(e) {
		var obj = $(this).data('owner');
		var old_z = parseInt($(obj).css('z-index'));
		$.glue.slider(e, function(x, y) {
			if (x < -15) {
				$.glue.stack.to_bottom($(obj));
			} else if (x < 15) {
				// dead zone
				var z = parseInt($(obj).css('z-index'));
				if (z !== old_z) {
					if (!isNaN(old_z)) {
						$(obj).css('z-index', old_z);
					} else {
						$(obj).css('z-index', '');
					}
					// DEBUG
					//console.log('set z-index to '+old_z);
				}
			} else {
				$.glue.stack.to_top($(obj));
			}
		}, function(x, y) {
			$.glue.object.save(obj);
			$.glue.stack.compress();
		});
		return false;
	});
	$.glue.contextmenu.register('object', 'object-zindex', elem, 3);
	
	elem = $('<img src="'+$.glue.base_url+'modules/object/object-link.png" alt="btn" title="make the object a link" width="32" height="32">');
	$(elem).bind('click', function(e) {
		var obj = $(this).data('owner');
		// get link
		$.glue.backend({ method: 'glue.load_object', name: $(obj).attr('id') }, function(data) {
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
					$.glue.backend({ method: 'glue.object_remove_attr', name: $(obj).attr('id'), attr: 'object-link' });
				} else {
					// set link
					$.glue.backend({ method: 'glue.update_object', name: $(obj).attr('id'), 'object-link': link });
					if (target !== undefined) {
						// set target
						$.glue.backend({ method: 'glue.update_object', name: $(obj).attr('id'), 'object-target': target });
					}
				}
				if (old_target !== '' && (target == '' || target == undefined)) {
					// delete target
					$.glue.backend({ method: 'glue.object_remove_attr', name: $(obj).attr('id'), attr: 'object-target' });
				}
			}
		}, false);
	});
	$.glue.contextmenu.register('object', 'object-link', elem);

	elem = $('<img src="'+$.glue.base_url+'modules/object/object-target.png" alt="btn" title="get the name of this object (for linking to it)" width="32" height="32">');
	$(elem).bind('click', function(e) {
		var obj = $(this).data('owner');
		var name = $(obj).attr('id').split('.').pop();
		prompt('You can link to this object by copying and pasting this string', $.glue.page+'.'+name);
	});
	$.glue.contextmenu.register('object', 'object-target', elem);
	
	elem = $('<img src="'+$.glue.base_url+'modules/object/object-symlink.png" alt="btn" title="make this object appear on all pages" width="32" height="32">');
	$(elem).bind('click', function(e) {
		var obj = $(this).data('owner');
		$.glue.backend({ method: 'glue.object_make_symlink', name: $(obj).attr('id') });
	});
	$.glue.contextmenu.register('object', 'object-symlink', elem);
	
	elem = $('<img src="'+$.glue.base_url+'modules/object/object-delete.png" alt="btn" title="delete object" width="32" height="32">');
	$(elem).bind('click', function(e) {
		var obj = $(this).data('owner');
		var id = $(obj).attr('id');
		$.glue.object.unregister($(obj));
		$(obj).remove();
		// delete in backend as well
		$.glue.backend({ method: 'glue.delete_object', name: id });
		// update canvas
		$.glue.canvas.update();
	});
	$.glue.contextmenu.register('object', 'object-delete', elem, 20);
});
