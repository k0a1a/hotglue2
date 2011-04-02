$(document).ready(function() {
//	$('#welcome-msg').show(3333);
	$('#welcome-msg').delay(1000).fadeIn(500);
	$('#welcome-msg').bind('click', function(e) {
		$(this).hide(333);
	});
});
