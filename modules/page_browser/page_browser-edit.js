/**
 *	modules/page_browser/page_browser-edit.js
 *	Frontend code linking the page browser to the general editing mode
 *
 *	Copyright Gottfried Haider, Danja Vasiliev 2010.
 *	This source code is licensed under the GNU General Public License.
 *	See the file COPYING for more details.
 */

document.addEventListener('DOMContentLoaded', function() {
	// /?options is the same controller as /?pages (module_page_browser.inc.php
	// registers both), and this button is what the site-wide settings are
	// reached from - so it names the settings, not the page list that happens
	// to share the page with them. /?pages stays as it was: it is out there in
	// links and bookmarks, and an alias is the whole point of it.
	var elem = $.glue.icon('site-settings', 'site options: set site icon (favicon), manage pages, add fonts');
	elem.addEventListener('click', function(e) {
		$.glue.menu.hide();
		// a new tab, so the page being worked on stays behind (danja's
		// call, 2026-09-24) - the click is a user gesture, so no popup
		// blocker applies
		window.open($.glue.base_url+'?options', '_blank');
	});
	$.glue.menu.register('page', elem, 7);
});
