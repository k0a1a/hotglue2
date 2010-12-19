/**
 *	modules/page_browser/page_browser-edit.js
 *	Frontend code linking the page browser to the general editing mode
 *
 *	Copyright Gottfried Haider, Danja Vasiliev 2010.
 *	This source code is licensed under the GNU General Public License.
 *	See the file COPYING for more details.
 */

$(document).ready(function() {
	elem = $('<img src="'+$.glue.base_url+'modules/page_browser/page_browser.png" alt="list all pages" title="list all pages" width="32" height="32">');
	$(elem).bind('click', function(e) {
		$.glue.menu.hide();
		window.location = $.glue.base_url+'?pages';
	});
	$.glue.menu.register('page', elem, 11);
});
