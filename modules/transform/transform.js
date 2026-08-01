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
		var that = this;
		var obj = $.glue.owner(this);
		var computed = getComputedStyle(obj);
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
		if (computed.getPropertyValue('-moz-transform') != '') {
			var val = computed.getPropertyValue('-moz-transform');
			if (val == 'matrix(-1, 0, 0, -1, 0, 0)') {
				obj.style.setProperty('-moz-transform', 'matrix(1, 0, 0, -1, 0, 0)');
			} else if (val == 'matrix(1, 0, 0, -1, 0, 0)') {
				obj.style.setProperty('-moz-transform', 'matrix(-1, 0, 0, 1, 0, 0)');
			} else if (val == 'matrix(-1, 0, 0, 1, 0, 0)') {
				obj.style.setProperty('-moz-transform', '');
			} else {
				obj.style.setProperty('-moz-transform', 'matrix(-1, 0, 0, -1, 0, 0)');
			}
		}
		if (computed.getPropertyValue('-webkit-transform') != '') {
			var val = computed.getPropertyValue('-webkit-transform');
			if (val == 'matrix(-1, 0, 0, -1, 0, 0)') {
				obj.style.setProperty('-webkit-transform', 'matrix(1, 0, 0, -1, 0, 0)');
			} else if (val == 'matrix(1, 0, 0, -1, 0, 0)') {
				obj.style.setProperty('-webkit-transform', 'matrix(-1, 0, 0, 1, 0, 0)');
			} else if (val == 'matrix(-1, 0, 0, 1, 0, 0)') {
				obj.style.setProperty('-webkit-transform', '');
			} else {
				obj.style.setProperty('-webkit-transform', 'matrix(-1, 0, 0, -1, 0, 0)');
			}
		}
		$.glue.object.save(obj);
		});
	$.glue.contextmenu.register('object', 'object-transform-flip', elem, 5);

	elem = document.createElement('img');
	elem.src = $.glue.base_url+'modules/transform/transform-rotate.png';
	elem.alt = 'btn';
	elem.title = 'rotate object 90°';
	elem.width = 32;
	elem.height = 32;
	elem.addEventListener('click', function(e) {
		var obj = $.glue.owner(this);
		// read the literal (not computed) inline style here, unlike the
		// flip button above - getComputedStyle() always resolves transform
		// functions down to a single matrix(), which would make a
		// previously-set rotate(Ndeg) impossible to read back out; the
		// element's own .style, however, still reflects whatever function
		// list was literally assigned, so any existing rotate(Ndeg) term
		// can be found and replaced while leaving a flip matrix (if any)
		// untouched
		var cur = obj.style.getPropertyValue('-webkit-transform') || obj.style.getPropertyValue('-moz-transform') || '';
		var deg = 0;
		var m = cur.match(/rotate\((-?\d+)deg\)/);
		if (m) {
			deg = parseInt(m[1], 10);
			cur = cur.replace(m[0], '').replace(/\s+/g, ' ').trim();
		}
		// cycle 0 -> 90 -> 180 -> 270 -> 0
		deg = (deg+90) % 360;
		var next = cur;
		if (deg != 0) {
			next = (cur ? cur+' ' : '')+'rotate('+deg+'deg)';
		}
		obj.style.setProperty('-moz-transform', next);
		obj.style.setProperty('-webkit-transform', next);
		$.glue.object.save(obj);
	});
	$.glue.contextmenu.register('object', 'object-transform-rotate', elem, 6);

});
