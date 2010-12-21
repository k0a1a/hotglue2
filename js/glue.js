/**
 *	js/glue.js
 *	Auxiliary hotglue frontend code
 *
 *	Copyright Gottfried Haider, Danja Vasiliev 2010.
 *	This source code is licensed under the GNU General Public License.
 *	See the file COPYING for more details.
 */

// create dummy console functions
if (!window.console) {
	console = {};
}
console.log = console.log || function(){};
console.error = console.error || function(){};
console.warn = console.warn || function(){};
console.info = console.info || function(){};

$.glue = {};

// communication with the backend
$.glue.backend = function()
{
	$(document).ready(function() {
		$(this).ajaxError(function(e, xhr, options, err) {
			if (xhr.readyState == 0 || xhr.status == 0) {
				// not really an error
				// these happen when navigating away while a ajax request is in flight
				// see http://stackoverflow.com/questions/866771/jquery-ambiguous-ajax-error
			} else {
				$.glue.error('There was a problem communicating with the server (ready state '+xhr.readyState+', status '+ xhr.status+')');
			}
		});
	});
	
	return function(param, func, print_errors) {
		// ten seconds timeout
		$.ajaxSetup({ timeout: 10000 });
		// make sure parameters are json encoded
		// otherwise we would get complaints from the php parser for empty 
		// strings, arrays and thelike
		for (p in param) {
			param[p] = JSON.stringify(param[p]);
		}
		$.post($.glue.base_url+'json.php', param, function(data) {
			if (print_errors === undefined) {
				print_errors = true;
			}
			if (data === null) {
				if (print_errors) {
					$.glue.error('There was a problem communicating with the server');
				} else if (typeof func == 'function') {
					func({ '#error': true, '#data':'There was a problem communicating with the server' });
				}
			} else if (print_errors) {
				if (data['#error']) {
					$.glue.error(data['#data']);
				} else if (typeof func == 'function') {
					func(data['#data']);
				}
			} else if (typeof func == 'function') {
				func(data);
			}
		}, 'json');
	};
}();

$.glue.error = function()
{
	return function(s) {
		if ($.glue.conf.show_frontend_errors) {
			alert('The glue gun manufacturer says: '+s);
		}
	};
}();