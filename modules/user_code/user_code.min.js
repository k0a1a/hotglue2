/**
 *	modules/user_code/user_code.js
 *	Frontend code for setting user-defined per-site and global code
 *
 *	Copyright Gottfried Haider, Danja Vasiliev 2010.
 *	This source code is licensed under the GNU General Public License.
 *	See the file COPYING for more details.
 */

document.addEventListener('DOMContentLoaded', function() {
	var insert_at_cursor = function(elem, s) {
		// inspired from http://forumsblogswikis.com/2008/07/20/how-to-insert-tabs-in-a-textarea/
		// this only includes the code for Firefox and Webkit though
		var start = elem.selectionStart;
		var end = elem.selectionEnd;
		elem.value = elem.value.substring(0, start)+s+elem.value.substring(end, elem.value.length);
		elem.selectionStart = start+s.length;
		elem.selectionEnd = start+s.length;
	};

	if (document.getElementById('user_body_text').value.length) {
		var focusTarget = document.getElementById('user_code_text');
		if (focusTarget) {
			focusTarget.focus();
		}
	}

	document.getElementById('user_body_text').addEventListener('keydown', function(e) {
		if (e.key == 'Tab') {
			insert_at_cursor(this, String.fromCharCode(9));
			e.preventDefault();
		}
	});

	document.getElementById('user_code_save').addEventListener('click', function(e) {
		this.setAttribute('disabled', 'disabled');
		this.setAttribute('value', 'saving..');
		var that = this;
		$.glue.backend({ method: 'user_code.set_code', page: $.glue.page, head: document.getElementById('user_head_text').value, body: document.getElementById('user_body_text').value }, function(data) {
			that.removeAttribute('disabled');
			that.setAttribute('value', 'saved');
			setTimeout(function() {
				that.setAttribute('value', 'save');
			}, 2000);
			if ($.glue.page && !document.getElementById('user_code_page_link')) {
				document.body.insertAdjacentHTML('beforeend', '<a id="user_code_page_link" href="'+$.glue.base_url+'?'+$.glue.page+'/edit">go to page</a>');
			}
		});
	});
});
