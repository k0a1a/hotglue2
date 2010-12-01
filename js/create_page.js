/**
 *	js/create_page.js
 *	Frontend code for creating new pages
 *
 *	Copyright Gottfried Haider, Danja Vasiliev 2010.
 *	This source code is licensed under the GNU General Public License.
 *	See the file COPYING for more details.
 */

$(document).ready(function() {
	$('#create_page_btn').bind('click', function(e) {
		$('#create_page_btn').attr('disabled', 'disabled');
		$.glue.backend({ method: 'glue.create_page', page: $.glue.page }, function(data) {
			window.location = $.glue.base_url+'?'+$.glue.page+'/edit';
		});
	});
});
