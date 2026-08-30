/**
 *	modules/page_browser/page_browser-edit.js
 *	Frontend code linking the page browser to the general editing mode
 *
 *	Copyright Gottfried Haider, Danja Vasiliev 2010.
 *	This source code is licensed under the GNU General Public License.
 *	See the file COPYING for more details.
 */

document.addEventListener('DOMContentLoaded', function() {
	var elem = $.glue.icon('site-settings', 'pages / site settings');
	elem.addEventListener('click', function(e) {
		$.glue.menu.hide();
		window.location = $.glue.base_url+'?pages';
	});
	$.glue.menu.register('page', elem, 11);
});
