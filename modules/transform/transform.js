/**
 *	modules/transform/transform.js
 *	Frontend code for general object properties
 *
 *	Copyright Gottfried Haider, Danja Vasiliev 2010.
 *	This source code is licensed under the GNU General Public License.
 *	See the file COPYING for more details.
 */

/*
function matrixToArray(m) {
	var c = m.substr(7);
	c = c.substr(0, c.length - 1);

	return c.split(', ');
}
*/

$(document).ready(function() {
	//
	// register menu items
	//
	var elem;
	elem = $('<img src="'+$.glue.base_url+'modules/transform/transform-flip.png" alt="btn" title="flip object" width="32" height="32">');
	$(elem).bind('click', function(e) {
		var that = this;
		var obj = $(this).data('owner');
/*
		if ($(obj).css('-moz-transform') != '') {
			var o = $(obj).css('-moz-transform');
		} else { var o = $(obj).css('-webkit-transform'); }

		if (o == null || o.length < 6) {
			o = 'matrix(1, 0, 0, 1, 0, 0)';
		}
		var o = matrixToArray(o);
	
		$(obj).transform({reflectX: true, matrix: ''+o+''}, {forceMatrix: true});
*/
		if ($(obj).css('-webkit-transform') != '') {
			var val = $(obj).css('-webkit-transform');
			if (val == 'matrix(-1, 0, 0, -1, 0, 0)') {
				$(obj).css('-webkit-transform', 'matrix(1, 0, 0, -1, 0, 0)');
			} else if (val == 'matrix(1, 0, 0, -1, 0, 0)') {
				$(obj).css('-webkit-transform', 'matrix(-1, 0, 0, 1, 0, 0)');
			} else if (val == 'matrix(-1, 0, 0, 1, 0, 0)') {
				$(obj).css('-webkit-transform', '');
			} else {
				$(obj).css('-webkit-transform', 'matrix(-1, 0, 0, -1, 0, 0)');
			}
		}
		else if ($(obj).css('-moz-transform') != '') {
			var val = $(obj).css('-moz-transform');
			if (val == 'matrix(-1, 0, 0, -1, 0px, 0px)') {
				$(obj).css('-moz-transform', 'matrix(1, 0, 0, -1, 0px, 0px)');
			} else if (val == 'matrix(1, 0, 0, -1, 0px, 0px)') {
				$(obj).css('-moz-transform', 'matrix(-1, 0, 0, 1, 0px, 0px)');
			} else if (val == 'matrix(-1, 0, 0, 1, 0px, 0px)') {
				$(obj).css('-moz-transform', '');
			} else {
				$(obj).css('-moz-transform', 'matrix(-1, 0, 0, -1, 0px, 0px)');
			}
		}
		$.glue.object.save(obj);
		});
	$.glue.contextmenu.register('object', 'object-transform-flip', elem, 5);

/* implement this later */
/*	elem = $('<img src="'+$.glue.base_url+'modules/transform/transform-rotate.png" alt="btn" title="rotate object" width="32" height="32">');
	$(elem).bind('mousedown', function(e) {
		var obj = $(this).data('owner');
		if ($(obj).css('-moz-transform') != '') {
			var o = $(obj).css('-moz-transform');
		} else { var o = $(obj).getAttribute('style'); }
		if (o == null || o.length < 6) {
			o = 'matrix(1, 0, 0, 1, 0, 0)';
		}
		var o = matrixToArray(o);
		$.glue.slider(e, function(x, y) {
			var r = y+'deg';
			$(obj).transform({rotate: ''+r+'', matrix: ''+o+''}, {forceMatrix: true});
//			$(obj).css('-webkit-transform','rotate('+r+')');

		}, function(x, y) {
			$.glue.object.save(obj);
		});
		return false;
	});
	$.glue.contextmenu.register('object', 'object-transform-rotate', elem, 6);
*/

});
