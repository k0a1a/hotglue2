/**
 *	modules/revisions_browser/revisions_browser.js
 *	Revisions browser frontend code
 *
 *	Copyright Gottfried Haider, Danja Vasiliev 2010.
 *	This source code is licensed under the GNU General Public License.
 *	See the file COPYING for more details.
 */

document.addEventListener('DOMContentLoaded', function() {
	document.getElementById('revisions_browser_revert_btn').addEventListener('click', function(e) {
		e.preventDefault();
		$.glue.backend({ method: 'glue.revert', page: $.glue.page }, function(data) {
			var a = $.glue.page.split('.');
			window.location = $.glue.base_url+'?'+a[0]+'/edit';
		});
	});

	document.addEventListener('keydown', function(e) {
		// keyboard navigation
		var prev = document.querySelector('#revisions_browser_prev > a');
		var next = document.querySelector('#revisions_browser_next > a');
		if (e.key == 'ArrowLeft' && prev) {
			window.location = prev.getAttribute('href');
		} else if (e.key == 'ArrowRight' && next) {
			window.location = next.getAttribute('href');
		}
		// prevent scrolling
		if (e.key == 'ArrowLeft' || e.key == 'ArrowRight') {
			e.preventDefault();
		}
	});
});
