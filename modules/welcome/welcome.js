$(document).ready(function() {
	$('#welcome-msg').show(333);
	$('#welcome-msg').bind('click', function(e) {
		$(this).hide(333);
	});
});
