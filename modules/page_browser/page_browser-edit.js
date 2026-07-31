/**
 *	modules/page_browser/page_browser-edit.js
 *	Frontend code linking the page browser to the general editing mode
 *
 *	Copyright Gottfried Haider, Danja Vasiliev 2010.
 *	This source code is licensed under the GNU General Public License.
 *	See the file COPYING for more details.
 */

document.addEventListener('DOMContentLoaded', function() {
	var elem = document.createElement('img');
	elem.src = $.glue.base_url+'modules/page_browser/page_browser.png';
	elem.alt = 'list all pages';
	elem.title = 'list all pages';
	elem.width = 32;
	elem.height = 32;
	elem.addEventListener('click', function(e) {
		$.glue.menu.hide();
		window.location = $.glue.base_url+'?pages';
	});
	$.glue.menu.register('page', elem, 11);
});
