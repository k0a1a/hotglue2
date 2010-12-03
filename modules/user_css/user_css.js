$(document).ready(function() {
	var insert_at_cursor = function(elem, s) {
		// inspired from http://forumsblogswikis.com/2008/07/20/how-to-insert-tabs-in-a-textarea/
		// this only includes the code for Firefox and Webkit though
		var elem = $(elem).get(0);
		var start = elem.selectionStart;
		var end = elem.selectionEnd;
		elem.value = elem.value.substring(0, start)+s+elem.value.substring(end, elem.value.length);
		elem.selectionStart = start+s.length;
		elem.selectionEnd = start+s.length;
	};
	
	if ($('#user_css_text').val().length) {
		$('#user_css_text').focus();
	}
	
	$('#user_css_text').bind('keydown', function(e) {
		if (e.which == 9) {
			// tab (key code 9)
			insert_at_cursor($(this), String.fromCharCode(9));
			e.preventDefault();
			return false;
		}
	});
	
	$('#user_css_save').bind('click', function(e) {
		$(this).attr('disabled', 'disabled');
		$(this).attr('value', 'saving..');
		var that = this;
		$.glue.backend({ method: 'user_css.set_css', page: $.glue.page, css: $('#user_css_text').val() }, function(data) {
			$(that).removeAttr('disabled');
			$(that).attr('value', 'saved');
			setTimeout(function() {
				$(that).attr('value', 'save');
			}, 2000);
			if ($.glue.page && $('#user_css_page_link').length == 0) {
				$('body').append($('<a id="user_css_page_link" href="'+$.glue.base_url+'?'+$.glue.page+'/edit">go to page</a>'));
			}
		});
	});
});