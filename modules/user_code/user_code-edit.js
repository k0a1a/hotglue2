/**
 *	modules/user_code/user_code-edit.js
 *	Frontend code linking user code editor to the general editing mode
 *
 *	Copyright Gottfried Haider, Danja Vasiliev 2010.
 *	This source code is licensed under the GNU General Public License.
 *	See the file COPYING for more details.
 */

document.addEventListener('DOMContentLoaded', function() {
	var elem = document.createElement('img');
	elem.src = $.glue.base_url+'modules/user_code/user_code.png';
	elem.alt = 'add/edit custom code';
	elem.title = 'add/edit custom code';
	elem.width = 32;
	elem.height = 32;
	elem.addEventListener('click', function(e) {
		$.glue.menu.hide();
		window.location = $.glue.base_url+'?'+$.glue.page+'/code';
	});
	$.glue.menu.register('page', elem, 12);
});
