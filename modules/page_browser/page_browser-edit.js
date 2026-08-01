/**
 *	modules/page_browser/page_browser-edit.js
 *	Frontend code linking the page browser to the general editing mode
 *
 *	Copyright Gottfried Haider, Danja Vasiliev 2010.
 *	This source code is licensed under the GNU General Public License.
 *	See the file COPYING for more details.
 */

document.addEventListener('DOMContentLoaded', function() {
	// plain text glyph rather than a new binary icon asset, same convention
	// as the undo/redo buttons in js/edit.js
	var elem = document.createElement('div');
	elem.style.alignItems = 'center';
	elem.style.backgroundColor = '#eee';
	elem.style.border = '1px solid #000';
	elem.style.boxSizing = 'border-box';
	elem.style.display = 'flex';
	elem.style.fontSize = '20px';
	elem.style.height = '32px';
	elem.style.justifyContent = 'center';
	elem.style.width = '32px';
	elem.title = 'pages / site settings';
	elem.textContent = '⚙';
	elem.addEventListener('click', function(e) {
		$.glue.menu.hide();
		window.location = $.glue.base_url+'?pages';
	});
	$.glue.menu.register('page', elem, 11);
});
