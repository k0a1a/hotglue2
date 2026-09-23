/**
 *	modules/user_code/user_code-edit.js
 *	Frontend code linking user code editor to the general editing mode
 *
 *	Copyright Gottfried Haider, Danja Vasiliev 2010.
 *	This source code is licensed under the GNU General Public License.
 *	See the file COPYING for more details.
 */

document.addEventListener('DOMContentLoaded', function() {
	var elem = $.glue.icon('site-code', 'add custom JavaScript code and CSS definitions');
	elem.addEventListener('click', function(e) {
		$.glue.menu.hide();
		window.location = $.glue.base_url+'?'+$.glue.page+'/code';
	});
	$.glue.menu.register('page', elem, 12);
});
