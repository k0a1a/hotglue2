/**
 *	modules/text/text-edit.js
 *	Frontend code for text objects
 *
 *	Copyright Gottfried Haider, Danja Vasiliev 2010.
 *	This source code is licensed under the GNU General Public License.
 *	See the file COPYING for more details.
 */

$.glue.text = function()
{
	var str_replace = function(from, to, s) {
		// this naive version doesn't work as from might be included in to again
		// e.g. when replacing '\n' to '<br>\n'
		//while (s.indexOf(from) != -1) {
		//	s = s.replace(from, to);
		//}
		if (typeof to !== 'string') {
			if (to.toString) {
				to = to.toString();
			} else {
				return '';
			}
		}
		if (typeof s !== 'string') {
			if (s.toString) {
				s = s.toString();
			} else {
				return '';
			}
		}
		var cur = 0;
		while (cur+from.length <= s.length) {
			if (s.substring(cur, cur+from.length) == from) {
				s = s.substring(0, cur)+to+s.substring(cur+from.length);
				// don't subject the added to to checking
				cur += to.length;
			} else {
				cur++;
			}
		}
		return s;
	};
	
	return {
		get_fonts: function(fonts, woff_fonts) {
			// get all fonts
			//fonts = [];
			//woff_fonts = [];
			for (var i=0; i < document.styleSheets.length; i++) {
				var sheet = document.styleSheets[i];
				for (var j=0; sheet.cssRules && j < sheet.cssRules.length; j++) {
					var rule = sheet.cssRules[j];
					if (!rule.selectorText) {
						continue;
					}
					if (rule.selectorText.substr(0, 10) != '.glue-font') {
						continue;
					}
					// find font-family property
					var text = rule.cssText;
					var start = text.indexOf('font-family:');
					if (start == -1) {
						continue;
					}
					// move start to beginning of value
					start += 12;
					var end = text.length-1;
					// check for closing bracket
					var tmp = text.indexOf('}', start);
					if (tmp != -1) {
						end = tmp-1;
					}
					// check for semicolon
					tmp = text.indexOf(';', start);
					if (tmp != -1 && tmp < end) {
						end = tmp-1;
					}
					fonts.push($.trim(text.substr(start, end-start+1)));
					if (rule.selectorText.substr(0, 15) == '.glue-font-woff') {
						// also add to woff_fonts
						woff_fonts.push($.trim(text.substr(start, end-start+1)));
					}
				}
			}
		},
		insert_at_cursor: function(elem, s) {
			// inspired from http://forumsblogswikis.com/2008/07/20/how-to-insert-tabs-in-a-textarea/
			// this only includes the code for Firefox and Webkit though
			var elem = $(elem).get(0);
			var start = elem.selectionStart;
			var end = elem.selectionEnd;
			elem.value = elem.value.substring(0, start)+s+elem.value.substring(end, elem.value.length);
			elem.selectionStart = start+s.length;
			elem.selectionEnd = start+s.length;
		},
		render_content: function(s, name) {
			// base url
			s = str_replace('$BASEURL$', $.glue.base_url, s);
			s = str_replace('$baseurl$', $.glue.base_url, s);
			// version number
			s = str_replace('$GLUE$', str_replace(',', '.', $.glue.version), s);
			s = str_replace('$glue$', str_replace(',', '.', $.glue.version), s);
			// current object
			s = str_replace('$OBJ$', name, s);
			s = str_replace('$obj$', name, s);
			// current page
			s = str_replace('$PAGE$', $.glue.page, s);
			s = str_replace('$page$', $.glue.page, s);
			// pagename
			s = str_replace('$PAGENAME$', $.glue.page.split('.').slice(0, 1), s);
			s = str_replace('$pagename$', $.glue.page.split('.').slice(0, 1), s);
			// protocol used
			if (location.protocol == 'https:') {
				s = str_replace('$PROT$', 'https', s);
				s = str_replace('$prot$', 'https', s);
			} else {
				s = str_replace('$PROT$', 'http', s);
				s = str_replace('$prot$', 'http', s);
			}
			// revision
			s = str_replace('$REV$', $.glue.page.split('.').slice(1, 2), s);
			s = str_replace('$rev$', $.glue.page.split('.').slice(1, 2), s);
			// automatically add <br> elements for newlines
			if ($.glue.conf.text.auto_br) {
				s = str_replace('\r\n', '<br>', s);
				s = str_replace('\n', '<br>', s);
			}
			// non-breakable spaces get automatically encoded to &nbsp; it seems
			return s;
		}
	};
}();

$('.text').live('glue-register', function(e) {
	// prevent events from bubbling up while we're editing 
	// and handle a few keycodes
	$(this).children('.glue-text-input').bind('mousedown', function(e) {
		// without this selecting text in the textarea doesn't work because of 
		// a mousedown handler on body in edit.js
		if ($(this).css('display') == 'none') {
			// we're not editing
			return;
		} else {
			e.stopPropagation();
		}
	});
		
	$(this).children('.glue-text-input').bind('keydown', function(e) {
		if ($(this).css('display') == 'none') {
			// we're not editing
			return;
		} else {
			e.stopPropagation();
		}
		
		if (e.which == 9) {
			// tab (key code 9)
			$.glue.text.insert_at_cursor($(this), String.fromCharCode(9));
			e.preventDefault();
			return false;
		} else if (e.shiftKey && e.which == 32) {
			// shift+space: add a non-breakable space (&nbsp; or key code 160)
			$.glue.text.insert_at_cursor($(this), String.fromCharCode(160));
			e.preventDefault();
			return false;
		}
	});
	
	$(this).children('.glue-text-input').bind('keypress', function(e) {
		if ($(this).css('display') == 'none') {
			// we're not editing
			return;
		} else {
			e.stopPropagation();
		}		
	});
	
	$(this).children('.glue-text-input').bind('keyup', function(e) {
		if ($(this).css('display') == 'none') {
			// we're not editing
			return;
		} else {
			e.stopPropagation();
		}
	});
	
	// disable links
	$(this).children('.glue-text-render').find('a').bind('click', function(e) {
		return false;
	});
	$(this).children('.glue-text-render').find('a').attr('title', 'this link is disabled for editing');
});

$('.text').live('glue-deselect', function(e) {
	// do nothing if we are not editing
	if (!$(this).hasClass('glue-text-editing')) {
		return;
	}
	// copy the rendered textarea value
	$(this).children('.glue-text-render').html($.glue.text.render_content($(this).children('.glue-text-input').val(), $(this).attr('id')));
	$(this).removeClass('glue-text-editing');
	// disable links
	$(this).children('.glue-text-render').find('a').bind('click', function(e) {
		return false;
	});
	$(this).children('.glue-text-render').find('a').attr('title', 'this link is disabled for editing');
	// resolve relative urls
	$(this).children('.glue-text-render').find('a').each(function() {
		// check if scheme is set
		var url = $(this).attr('href');
		if (url.charAt(0) != '#' && url.indexOf('://') < 1) {
			$(this).attr('href', $.glue.base_url+url);
		}
	});
	// hide the text area again
	$(this).children('.glue-text-input').css('display', 'none');
	$(this).children('.glue-text-render').css('display', 'block');
	// update the content on the server
	// see the comments in $.glue.object.register_alter_pre_save below
	$.glue.backend({ method: 'glue.update_object', name: $(this).attr('id'), 'content': $(this).children('.glue-text-input').val() });
});

$('.text.glue-selected').live('click', function(e) {
	// check if we are already editing
	if ($(this).hasClass('glue-text-editing')) {
		return;
	}
	// deselect all other objects
	if ($(this).hasClass('glue-selected')) {
		$('.glue-selected').not(this).each(function() {
			$.glue.sel.deselect(this);
		});
	}
	// make the textarea visible
	$(this).children('.glue-text-input').css('display', 'block');
	$(this).children('.glue-text-render').css('display', 'none');
	$(this).addClass('glue-text-editing');
	// set focus and selection
	$(this).children('.glue-text-input').focus();
	if ($(this).children('.glue-text-input').get(0).setSelectionRange) {
		$(this).children('.glue-text-input').get(0).setSelectionRange(0, 0);
	}
});

$(document).ready(function() {
	//
	// menu items
	//
	var elem = $('<img src="'+$.glue.base_url+'modules/text/text.png" alt="btn" title="add a new text object" width="32" height="32">');
	$(elem).bind('click', function(e) {
		// create new object
		$.glue.backend({ method: 'glue.create_object', 'page': $.glue.page }, function(data) {
			var elem = $('<div class="text resizable object" style="position: absolute;"><textarea class="glue-text-input" style="display: none; height: 100%; width: 100%;"></textarea><div class="glue-text-render" style="height: 100%; width: 100%;"></div></div>');
			$(elem).attr('id', data['name']);
			// default width and height is set in the css
			// randomly pick one of the default colors
			if ($.glue.conf.object.default_colors) {
				var rand = Math.floor(Math.random()*$.glue.conf.object.default_colors.length);
				$(elem).css('background-color', $.glue.conf.object.default_colors[rand]);
			}
			$('body').append(elem);
			// make width and height explicit
			$(elem).css('width', $(elem).width()+'px');
			$(elem).css('height', $(elem).height()+'px');
			// move to mouseclick
			$(elem).css('left', (e.pageX-$(elem).outerWidth()/2)+'px');
			$(elem).css('top', (e.pageY-$(elem).outerHeight()/2)+'px');
			$.glue.object.register(elem);
			$.glue.object.save(elem);
		});
		$.glue.menu.hide();
	});
	$.glue.menu.register('new', elem);
	
	//
	// context menu items
	//
	elem = $('<img src="'+$.glue.base_url+'modules/text/text-background-color.png" alt="btn" title="change background color" width="32" height="32">');
	var colorpicker_shown = false;
	$(elem).bind('click', function(e) {
		var obj = $(this).data('owner');
		var col = $(obj).css('background-color');
		if (e.shiftKey) {
			col = prompt('Enter background color (e.g. #ff0000 or rgb(255, 0, 0))', col);
			if (!col) {
				return;
			}
		}
		$.glue.colorpicker.show(col, false, function(col) {
			$(obj).css('background-color', col);
			// explicitly set the color for the textarea as changes to the parent object are not reflected while editing on Chrome 10.0.634.0 and below)
			$(obj).children('.glue-text-input').css('background-color', col);
		}, function (col) {
			$.glue.object.save(obj);
			colorpicker_shown = false;
		});
		colorpicker_shown = true;
	});
	$(elem).bind('glue-deselect', function(e) {
		// hide the colorpicker if we opened it
		if (colorpicker_shown) {
			$.glue.colorpicker.hide();
			colorpicker_shown = false;
		}
	});
	$.glue.contextmenu.register('text', 'text-background-color', elem);
	
	elem = $('<img src="'+$.glue.base_url+'modules/text/text-background-transparent.png" alt="btn" title="make background transparent" width="32" height="32">');
	$(elem).bind('click', function(e) {
		var obj = $(this).data('owner');
		$(obj).css('background-color', 'transparent');
		$(obj).children('.glue-text-input').css('background-color', 'transparent');
		$.glue.object.save(obj);
	});
	$.glue.contextmenu.register('text', 'text-background-transparent', elem);
	
	elem = $('<img src="'+$.glue.base_url+'modules/text/text-font-size.png" alt="btn" title="drag to change font size, click to reset to default one" width="32" height="32">');
	$(elem).bind('glue-menu-activate', function(e) {
		var obj = $(this).data('owner');
		$(this).attr('title', 'drag to change font size ('+$(obj).css('font-size')+'), click to reset to default one');
	});
	$(elem).bind('mousedown', function(e) {
		var obj = $(this).data('owner');
		// we assume px here
		var orig_val = parseInt($(obj).css('font-size'));
		if (isNaN(orig_val)) {
			orig_val = 10;
		}
		var no_change = true;
		var that = this;
		$.glue.slider(e, function(x, y) {
			var val = Math.floor(orig_val+y/6);
			if (val < 0) {
				val = 0;
			}
			$(obj).css('font-size', val+'px');
			$(that).attr('title', 'drag to change font size ('+val+'px), click to reset to default one');
			if (x != 0 || y != 0) {
				no_change = false;
			}
		}, function(x, y) {
			// reset font-size if there was no change at all
			if (no_change) {
				$(obj).css('font-size', '');
				$.glue.backend({ method: 'glue.object_remove_attr', name: $(obj).attr('id'), attr: 'text-font-size' });
				$(that).attr('title', 'drag to change font size ('+$(obj).css('font-size')+'px), click to reset to default one');
			} else {
				$.glue.object.save(obj);
			}
		});
		return false;
	});
	$.glue.contextmenu.register('text', 'text-font-size', elem);
	
	elem = $('<img src="'+$.glue.base_url+'modules/text/text-font-color.png" alt="btn" title="change font color" width="32" height="32">');
	$(elem).bind('click', function(e) {
		var obj = $(this).data('owner');
		var col = $(obj).css('color');
		if (e.shiftKey) {
			col = prompt('Enter font color (e.g. #ff0000 or rgb(255, 0, 0))', col);
			if (!col) {
				return;
			}
		}
		$.glue.colorpicker.show(col, false, function(col) {
			$(obj).css('color', col);
		}, function (col) {
			$.glue.object.save(obj);
			colorpicker_shown = false;
		});
		colorpicker_shown = true;
	});
	// this also requires the glue-deselect handler above
	$.glue.contextmenu.register('text', 'text-font-color', elem);
	
	elem = $('<div class="glue-text-font-family" style="height: 32px; width: 32px;" title="change typeface (click to cycle through available typefaces)">');
	$(elem).bind('glue-menu-activate', function(e) {
		var obj = $(this).data('owner');
		var fonts = [];
		var woff_fonts = [];
		$.glue.text.get_fonts(fonts, woff_fonts);
		// check if current font is a woff-font
		var cur = $(obj).css('font-family');
		for (i=0; i < woff_fonts.length; i++) {
			if (cur === woff_fonts[i]) {
				// current font is a woff-font
				$('#glue-contextmenu-text-font-face').addClass('glue-text-font-face');
				$('#glue-contextmenu-text-font-face').removeClass('glue-text-font-family');
				$('#glue-contextmenu-text-font-face').attr('title', 'this is a WOFF web-font ('+cur+') - while only supported on the latest browser versions, this text should look similar across different browsers and operating systems supporting WOFF');
				return;
			}
		}
		// not a woff-font
		$('#glue-contextmenu-text-font-face').removeClass('glue-text-font-face');
		$('#glue-contextmenu-text-font-face').addClass('glue-text-font-family');
		$('#glue-contextmenu-text-font-face').attr('title', 'change typeface (click to cycle through available typefaces)');
	});
	$(elem).bind('click', function(e) {
		var obj = $(this).data('owner');
		var fonts = [];
		var woff_fonts = [];
		$.glue.text.get_fonts(fonts, woff_fonts);
		// DEBUG
		//console.log(fonts);
		//console.log(woff_fonts);
		// search for current font
		var cur = $(obj).css('font-family');
		var n = false;
		for (var i=0; i < fonts.length; i++) {
			if (cur === fonts[i]) {
				// pick the next one
				if (i+1 < fonts.length) {
					n = i+1;
				} else {
					n = 0;
				}
				break;
			}
		}
		// otherwise fall back to the first one
		if (n === false && fonts.length) {
			n = 0;
		}
		if (n !== false) {
			$(obj).css('font-family', fonts[n]);
			// check if woff-font
			var is_woff = false;
			for (var i=0; i < woff_fonts.length; i++) {
				if (woff_fonts[i] == fonts[n]) {
					is_woff = true;
					break;
				}
			}
			if (is_woff) {
				$(this).addClass('glue-text-font-face');
				$(this).removeClass('glue-text-font-family');
				$(this).attr('title', 'this is a WOFF web-font ('+fonts[n]+') - while only supported on the latest browser versions, this text should look similar across different browsers and operating systems supporting WOFF');
			} else {
				$(this).removeClass('glue-text-font-face');
				$(this).addClass('glue-text-font-family');
				$(this).attr('title', 'change typeface (click to cycle through available typefaces)');
			}
			$.glue.object.save(obj);
		}
	});
	$.glue.contextmenu.register('text', 'text-font-face', elem);
	
	elem = $('<img src="'+$.glue.base_url+'modules/text/text-font-style.png" alt="btn" title="change font style" width="32" height="32">');
	$(elem).bind('click', function(e) {
		var obj = $(this).data('owner');
		if ($(obj).css('font-style') == 'normal' && ($(obj).css('font-weight') == 'bold' || $(obj).css('font-weight') == '700')) {
			$(obj).css('font-style', 'italic');
			$(obj).css('font-weight', 'normal');
		} else if ($(obj).css('font-style') == 'italic' && ($(obj).css('font-weight') == 'normal' || $(obj).css('font-weight') == '400')) {
			$(obj).css('font-style', 'italic');
			$(obj).css('font-weight', 'bold');
		} else if ($(obj).css('font-style') == 'italic' && ($(obj).css('font-weight') == 'bold' || $(obj).css('font-weight') == '700')) {
			$(obj).css('font-style', 'normal');
			$(obj).css('font-weight', 'normal');
		} else {
			$(obj).css('font-style', 'normal');
			$(obj).css('font-weight', 'bold');
		}
		$.glue.object.save(obj);
	});
	$.glue.contextmenu.register('text', 'text-font-style', elem);
	
	elem = $('<img src="'+$.glue.base_url+'modules/text/text-line-height.png" alt="btn" title="change line height, click to reset to default one" width="32" height="32">');
	$(elem).bind('glue-menu-activate', function(e) {
		// TODO (later): my px to em calculation is not working perfectly, so leave this out for now
		/*
		var obj = $(this).data('owner');
		if ($(obj).css('line-height').substr(-2) == 'em') {
			$(this).attr('title', 'change line height ('+$(obj).css('line-height')+'), click to reset to default one');
		} else if ($(obj).css('line-height').substr(-2) == 'px') {
			$(this).attr('title', 'change line height ('+parseFloat($(obj).css('line-height'))/parseFloat($(obj).css('font-size'))+'em), click to reset to default one');
		}
		*/
	});
	$(elem).bind('mousedown', function(e) {
		var obj = $(this).data('owner');
		// jquery seems to always return line-height in px
		// but just in case, try to handle em as well
		// assume px for font-size
		var font_size = parseFloat($(obj).css('font-size'));
		if ($(obj).css('line-height').substr(-2) == 'em') {
			var orig_val = parseFloat($(obj).css('line-height'))*font_size;
		} else if ($(obj).css('line-height').substr(-2) == 'px') {
			var orig_val = parseFloat($(obj).css('line-height'));
		} else {
			// some sane fallback
			var orig_val = font_size*1.2;
		}
		var no_change = true;
		var that = this;
		$.glue.slider(e, function(x, y) {
			var val = orig_val+y/6;
			if (val < 0) {
				val = 0;
			}
			// set line-height in em
			$(obj).css('line-height', (val/font_size)+'em');
			//$(that).attr('title', 'change line height ('+(val/font_size)+'em), click to reset to default one');
			if (x != 0 || y != 0) {
				no_change = false;
			}
		}, function(x, y) {
			// reset line-height if there was no change at all
			if (no_change) {
				$(obj).css('line-height', '');
				$.glue.backend({ method: 'glue.object_remove_attr', name: $(obj).attr('id'), attr: 'text-line-height' });
				/*
				if ($(obj).css('line-height').substr(-2) == 'em') {
					$(that).attr('title', 'change line height ('+$(obj).css('line-height')+'), click to reset to default one');
				} else if ($(obj).css('line-height').substr(-2) == 'px') {
					$(that).attr('title', 'change line height ('+parseFloat($(obj).css('line-height'))/parseFloat($(obj).css('font-size'))+'em), click to reset to default one');
				}
				*/
			} else {
				$.glue.object.save(obj);
			}
		});
		return false;
	});
	$.glue.contextmenu.register('text', 'text-line-height', elem);
	
	elem = $('<img src="'+$.glue.base_url+'modules/text/text-letter-spacing.png" alt="btn" title="change letter spacing" width="32" height="32">');
	$(elem).bind('glue-menu-activate', function(e) {
		// TODO (later): my px to em calculation is not working perfectly, so leave this out for now
		/*
		var obj = $(this).data('owner');
		if ($(obj).css('letter-spacing').substr(-2) == 'em') {
			$(this).attr('title', 'change letter spacing ('+$(obj).css('letter-spacing')+'), click to reset to default one');
		} else if ($(obj).css('letter-spacing').substr(-2) == 'px') {
			$(this).attr('title', 'change letter spacing ('+parseFloat($(obj).css('letter-spacing'))/parseFloat($(obj).css('font-size'))+'em), click to reset to default one');
		}
		*/
	});
	$(elem).bind('mousedown', function(e) {
		var obj = $(this).data('owner');
		// jquery seems to always return letter-spacing in px
		// but just in case, try to handle em as well
		// assume px for font-size
		var font_size = parseFloat($(obj).css('font-size'));
		if ($(obj).css('letter-spacing').substr(-2) == 'em') {
			var orig_val = parseFloat($(obj).css('letter-spacing'))*font_size;
		} else if ($(obj).css('letter-spacing').substr(-2) == 'px') {
			var orig_val = parseFloat($(obj).css('letter-spacing'));
		} else {
			// some sane fallback
			var orig_val = 0.0;
		}
		var no_change = true;
		var that = this;
		$.glue.slider(e, function(x, y) {
			var val = orig_val+y/6;
			$(obj).css('letter-spacing', (val/font_size)+'em');
			//$(that).attr('title', 'change letter spacing ('+(val/font_size)+'em), click to reset to default one');
			if (x != 0 || y != 0) {
				no_change = false;
			}
		}, function(x, y) {
			// reset letter-spacing if there was no change at all
			if (no_change) {
				$(obj).css('letter-spacing', '');
				$.glue.backend({ method: 'glue.object_remove_attr', name: $(obj).attr('id'), attr: 'text-letter-spacing' });
				/*
				if ($(obj).css('letter-spacing').substr(-2) == 'em') {
					$(that).attr('title', 'change letter spacing ('+$(obj).css('letter-spacing')+'), click to reset to default one');
				} else if ($(obj).css('letter-spacing').substr(-2) == 'px') {
					$(that).attr('title', 'change letter spacing ('+parseFloat($(obj).css('letter-spacing'))/parseFloat($(obj).css('font-size'))+'em), click to reset to default one');
				}
				*/
			} else {
				$.glue.object.save(obj);
			}
		});
		return false;
	});
	$.glue.contextmenu.register('text', 'text-letter-spacing', elem);
	
	elem = $('<img src="'+$.glue.base_url+'modules/text/text-word-spacing.png" alt="btn" title="change word spacing" width="32" height="32">');
	$(elem).bind('glue-menu-activate', function(e) {
		// TODO (later): my px to em calculation is not working perfectly, so leave this out for now
		/*
		var obj = $(this).data('owner');
		if ($(obj).css('word-spacing').substr(-2) == 'em') {
			$(this).attr('title', 'change word spacing ('+$(obj).css('word-spacing')+'), click to reset to default one');
		} else if ($(obj).css('word-spacing').substr(-2) == 'px') {
			$(this).attr('title', 'change word spacing ('+parseFloat($(obj).css('word-spacing'))/parseFloat($(obj).css('font-size'))+'em), click to reset to default one');
		}
		*/
	});
	$(elem).bind('mousedown', function(e) {
		var obj = $(this).data('owner');
		// jquery seems to always return word-spacing in px
		// but just in case, try to handle em as well
		// assume px for font-size
		var font_size = parseFloat($(obj).css('font-size'));
		if ($(obj).css('word-spacing').substr(-2) == 'em') {
			var orig_val = parseFloat($(obj).css('word-spacing'))*font_size;
		} else if ($(obj).css('word-spacing').substr(-2) == 'px') {
			var orig_val = parseFloat($(obj).css('word-spacing'));
		} else {
			// some sane fallback
			var orig_val = 0.0;
		}
		var no_change = true;
		var that = this;
		$.glue.slider(e, function(x, y) {
			var val = orig_val+y/6;
			$(obj).css('word-spacing', (val/font_size)+'em');
			//$(that).attr('title', 'change word spacing ('+(val/font_size)+'em), click to reset to default one');
			if (x != 0 || y != 0) {
				no_change = false;
			}
		}, function(x, y) {
			// reset word-spacing if there was no change at all
			if (no_change) {
				$(obj).css('word-spacing', '');
				$.glue.backend({ method: 'glue.object_remove_attr', name: $(obj).attr('id'), attr: 'text-word-spacing' });
				/*
				if ($(obj).css('word-spacing').substr(-2) == 'em') {
					$(that).attr('title', 'change word spacing ('+$(obj).css('word-spacing')+'), click to reset to default one');
				} else if ($(obj).css('word-spacing').substr(-2) == 'px') {
					$(that).attr('title', 'change word spacing ('+parseFloat($(obj).css('word-spacing'))/parseFloat($(obj).css('font-size'))+'em), click to reset to default one');
				}
				*/
			} else {
				$.glue.object.save(obj);
			}
		});
		return false;
	});
	$.glue.contextmenu.register('text', 'text-word-spacing', elem);
	
	elem = $('<img src="'+$.glue.base_url+'modules/text/text-align.png" alt="btn" title="change text alignment" width="32" height="32">');
	$(elem).bind('glue-menu-activate', function(e) {
		var obj = $(this).data('owner');
		var val = $(obj).css('text-align');
		if (val == 'center') {
			$(this).attr('title', 'change text alignment (center)');
		} else if (val == 'right') {
			$(this).attr('title', 'change text alignment (right)');
		} else if (val == 'justify') {
			$(this).attr('title', 'change text alignment (justify)');
		} else {
			// default to left
			$(this).attr('title', 'change text alignment (left)');
		}
	});
	$(elem).bind('click', function(e) {
		var obj = $(this).data('owner');
		var val = $(obj).css('text-align');
		if (val == 'center') {
			$(obj).css('text-align', 'right');
			$(this).attr('title', 'change text alignment (right)');
		} else if (val == 'right') {
			$(obj).css('text-align', 'justify');
			$(this).attr('title', 'change text alignment (justify)');
		} else if (val == 'justify') {
			$(obj).css('text-align', 'left');
			$(this).attr('title', 'change text alignment (left)');			
		} else {
			$(obj).css('text-align', 'center');
			$(this).attr('title', 'change text alignment (center)');
		}
		$.glue.object.save(obj);
	});
	$.glue.contextmenu.register('text', 'text-align', elem);
	
	elem = $('<img src="'+$.glue.base_url+'modules/text/text-padding.png" alt="btn" title="change padding, click to reset to default one" width="32" height="32">');
	$(elem).bind('glue-menu-activate', function(e) {
		var obj = $(this).data('owner');
		$(this).attr('title', 'change padding ('+$(obj).css('padding-left')+', '+$(obj).css('padding-top')+'), click to reset to default one');
	});
	$(elem).bind('mousedown', function(e) {
		var obj = $(this).data('owner');
		// we assume px here, and for {left,right} {top,bottom} to be the same
		var orig_x = parseInt($(obj).css('padding-left'));
		if (isNaN(orig_x)) {
			orig_x = 0;
		}
		var orig_w = $(obj).width();
		var orig_y = parseInt($(obj).css('padding-top'));
		if (isNaN(orig_y)) {
			orig_y = 0;
		}
		var orig_h = $(obj).height();
		var no_change = true;
		var that = this;
		$.glue.slider(e, function(x, y, e) {
			var val_x = Math.floor(orig_x+x/6);
			if (val_x < 0) {
				val_x = 0;
			}
			var val_y = Math.floor(orig_y+y/6);
			if (val_y < 0) {
				val_y = 0;
			}
			// shift: same padding for x and y
			if (e.shiftKey) {
				if (val_x < val_y) {
					val_x = val_y;
				} else if (val_y < val_x) {
					val_y = val_x;
				}
			}
			$(obj).css('padding-left', val_x+'px');
			$(obj).css('padding-right', val_x+'px');
			// resize object
			$(obj).css('width', (orig_w+2*orig_x-2*val_x)+'px');
			$(obj).css('padding-top', val_y+'px');
			$(obj).css('padding-bottom', val_y+'px');
			$(obj).css('height', (orig_h+2*orig_y-2*val_y)+'px');
			$(that).attr('title', 'change padding ('+val_x+'px, '+val_y+'px), click to reset to default one');
			if (x != 0 || y != 0) {
				no_change = false;
			}
		}, function(x, y) {
			// reset padding if there was no change at all
			if (no_change) {
				var var_x = parseInt($(obj).css('padding-left'));
				if (!isNaN(var_x)) {
					// resize object
					$(obj).css('width', ($(obj).width()+2*var_x)+'px');
				}
				var var_y = parseInt($(obj).css('padding-top'));
				if (!isNaN(var_y)) {
					$(obj).css('height', ($(obj).height()+2*var_y)+'px');
				}
				$(obj).css('padding-left', '');
				$(obj).css('padding-right', '');
				$(obj).css('padding-top', '');
				$(obj).css('padding-bottom', '');
				$(that).attr('title', 'change padding ('+$(obj).css('padding-left')+', '+$(obj).css('padding-top')+'), click to reset to default one');
			}
			// use object.save() in both cases (width and height got changed too)
			$.glue.object.save(obj);
		});
		return false;
	});
	$.glue.contextmenu.register('text', 'text-text-padding', elem);
	
	// make sure we don't send to much over the wire for every save
	$.glue.object.register_alter_pre_save('text', function(obj, orig) {
		// clear the textarea's background-image that Chrome sends along
		$(obj).children('.glue-text-input').css('background-image', '');
		// the textarea's content is automatically not included
		// we can read it out using 
		// $(orig).children('.glue-text-input').val()
		// and even set it using 
		// $(obj).children('.glue-text-input').get(0).innerHTML
		// but later on (when turning the element into a string) the content of the 
		// textarea get's magically encoded
		// a la:
		// &lt;a href="asd"&gt;test&lt;/a&gt;
		// for this reason we update the object's content not through 
		// $.glue.object.update
		$(obj).children('.glue-text-input').remove();
		$(obj).children('.glue-text-render').remove();
	});
});
