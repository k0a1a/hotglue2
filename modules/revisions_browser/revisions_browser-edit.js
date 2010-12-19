/**
 *	modules/revisions_browser/revisions_browser-edit.js
 *	Frontend code linking the revisions browser to the general editing 
 *	mode
 *
 *	Copyright Gottfried Haider, Danja Vasiliev 2010.
 *	This source code is licensed under the GNU General Public License.
 *	See the file COPYING for more details.
 */

$(document).ready(function() {
	elem = $('<img src="'+$.glue.base_url+'modules/revisions_browser/revisions_browser.png" alt="btn" title="compare revisions of this page" width="32" height="32">');
	$(elem).bind('click', function(e) {
		$.glue.menu.hide();
		window.location = $.glue.base_url+'?'+$.glue.page+'/revisions';
	});
	$.glue.menu.register('page', elem, 12);
});
