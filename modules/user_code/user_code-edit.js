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
		// a new tab, so the page being worked on stays behind (danja's
		// call, 2026-09-24) - the click is a user gesture, so no popup
		// blocker applies
		window.open($.glue.base_url+'?'+$.glue.page+'/code', '_blank');
	});
	$.glue.menu.register('page', elem, 6);
});
