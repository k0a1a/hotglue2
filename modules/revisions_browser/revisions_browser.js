/**
 *	modules/revisions_browser/revisions_browser.js
 *	Revisions browser frontend code
 *
 *	Copyright Gottfried Haider, Danja Vasiliev 2010.
 *	This source code is licensed under the GNU General Public License.
 *	See the file COPYING for more details.
 */

$(document).ready(function() {
	$('#revisions_browser_revert_btn').bind('click', function(e) {
		$.glue.backend({ method: 'glue.revert', page: $.glue.page }, function(data) {
			var a = $.glue.page.split('.');
			window.location = $.glue.base_url+'?'+a[0]+'/edit';		
		});
		return false;
	});
		
	$(document).bind('keydown', function(e) {
		// keyboard navigation
		if (e.which == 37 && $('#revisions_browser_prev > a').length) {
			window.location = $('#revisions_browser_prev > a').attr('href');
		} else if (e.which == 39 && $('#revisions_browser_next > a').length) {
			window.location = $('#revisions_browser_next > a').attr('href');
		}
		// prevent scrolling
		if (e.which == 37 || e.which == 39) {
			return false;
		}
	});
});
