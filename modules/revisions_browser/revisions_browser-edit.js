/**
 *	modules/revisions_browser/revisions_browser-edit.js
 *	Frontend code linking the revisions browser to the general editing
 *	mode
 *
 *	Copyright Gottfried Haider, Danja Vasiliev 2010.
 *	This source code is licensed under the GNU General Public License.
 *	See the file COPYING for more details.
 */

document.addEventListener('DOMContentLoaded', function() {
	var elem = document.createElement('img');
	elem.src = $.glue.base_url+'modules/revisions_browser/revisions_browser.png';
	elem.alt = 'btn';
	elem.title = 'compare revisions of this page';
	elem.width = 32;
	elem.height = 32;
	elem.addEventListener('click', function(e) {
		$.glue.menu.hide();
		window.location = $.glue.base_url+'?'+$.glue.page+'/revisions';
	});
	$.glue.menu.register('page', elem, 12);
});
