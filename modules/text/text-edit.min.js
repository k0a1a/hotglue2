/**
 *	modules/text/text-edit.js
 *	Frontend code for text objects
 *
 *	Copyright Gottfried Haider, Danja Vasiliev 2010.
 *	This source code is licensed under the GNU General Public License.
 *	See the file COPYING for more details.
 */

function text_font_size_sync(elem) {
	var obj = $.glue.owner(elem);
	Alpine.$data(elem).tip = 'drag to change font size ('+getComputedStyle(obj).fontSize+'), click to reset to default one';
}

function text_align_sync(elem) {
	var obj = $.glue.owner(elem);
	var val = getComputedStyle(obj).textAlign;
	var label = (val == 'center') ? 'center' : (val == 'right') ? 'right' : (val == 'justify') ? 'justify' : 'left';
	Alpine.$data(elem).tip = 'change text alignment ('+label+')';
}

function text_padding_sync(elem) {
	var obj = $.glue.owner(elem);
	var computed = getComputedStyle(obj);
	Alpine.$data(elem).tip = 'change padding ('+computed.paddingLeft+', '+computed.paddingTop+'), click to reset to default one';
}

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
					fonts.push(text.substr(start, end-start+1).trim());
					if (rule.selectorText.substr(0, 15) == '.glue-font-woff') {
						// also add to woff_fonts
						woff_fonts.push(text.substr(start, end-start+1).trim());
					}
				}
			}
		},
		insert_at_cursor: function(elem, s) {
			// inspired from http://forumsblogswikis.com/2008/07/20/how-to-insert-tabs-in-a-textarea/
			// this only includes the code for Firefox and Webkit though
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
		},
		stop_editing: function(elem) {
			var input = elem.querySelector(':scope > .glue-text-input');
			var render = elem.querySelector(':scope > .glue-text-render');
			// copy the rendered textarea value
			render.innerHTML = $.glue.text.render_content(input.value, elem.id);
			elem.classList.remove('glue-text-editing');
			// disable links, resolve relative urls
			render.querySelectorAll('a').forEach(function(a) {
				a.addEventListener('click', function(e) {
					e.preventDefault();
					return false;
				});
				a.title = 'this link is disabled for editing';
				// check if scheme is set
				var url = a.getAttribute('href');
				if (url && url.charAt(0) != '#' && url.indexOf('://') < 1) {
					a.setAttribute('href', $.glue.base_url+url);
				}
			});
			// hide the text area again
			input.style.display = 'none';
			render.style.display = 'block';
			// update the textarea's inner html as well (.val() seems to be
			// different from .text(), at least with jquery 1.5.2 on chromium 12
			input.textContent = input.value;
			// update the content on the server
			// see the comments in $.glue.object.register_alter_pre_save below
			$.glue.backend({ method: 'glue.update_object', name: elem.id, 'content': input.value });
		}
	};
}();

$.glue.live('.text', 'glue-register', function(e) {
	// prevent events from bubbling up while we're editing
	// and handle a few keycodes
	var input = this.querySelector(':scope > .glue-text-input');
	var render = this.querySelector(':scope > .glue-text-render');

	input.addEventListener('mousedown', function(e) {
		// without this selecting text in the textarea doesn't work because of
		// a mousedown handler on body in edit.js
		if (getComputedStyle(this).display == 'none') {
			// we're not editing
			return;
		} else {
			e.stopPropagation();
		}
	});

	input.addEventListener('keydown', function(e) {
		if (getComputedStyle(this).display == 'none') {
			// we're not editing
			return;
		} else {
			e.stopPropagation();
		}

		if (e.which == 9) {
			// tab (key code 9)
			$.glue.text.insert_at_cursor(this, String.fromCharCode(9));
			e.preventDefault();
			return false;
		} else if (e.shiftKey && e.which == 32) {
			// shift+space: add a non-breakable space (&nbsp; or key code 160)
			$.glue.text.insert_at_cursor(this, String.fromCharCode(160));
			e.preventDefault();
			return false;
		} else if (e.which == 27) {
			$.glue.text.stop_editing(this.parentElement);
			e.preventDefault();
			return false;
		}

	});

	input.addEventListener('keypress', function(e) {
		if (getComputedStyle(this).display == 'none') {
			// we're not editing
			return;
		} else {
			e.stopPropagation();
		}
	});

	input.addEventListener('keyup', function(e) {
		if (getComputedStyle(this).display == 'none') {
			// we're not editing
			return;
		} else {
			e.stopPropagation();
		}
	});

	// disable links
	render.querySelectorAll('a').forEach(function(a) {
		a.addEventListener('click', function(e) {
			e.preventDefault();
			return false;
		});
		a.title = 'this link is disabled for editing';
	});
});

$.glue.live('.text', 'glue-deselect', function(e) {
	// check if we are editing
	if (this.classList.contains('glue-text-editing')) {
		$.glue.text.stop_editing(this);
	}
});

$.glue.live('.text.glue-selected', 'click', function(e) {
	var self = this;
	// check if we are already editing
	if (self.classList.contains('glue-text-editing')) {
		return;
	}
	// deselect all other objects
	if (self.classList.contains('glue-selected')) {
		Array.from(document.querySelectorAll('.glue-selected')).filter(function(el) {
			return el !== self;
		}).forEach(function(el) {
			$.glue.sel.deselect(el);
		});
	}
	// make the textarea visible
	var input = self.querySelector(':scope > .glue-text-input');
	var render = self.querySelector(':scope > .glue-text-render');
	input.style.display = 'block';
	render.style.display = 'none';
	self.classList.add('glue-text-editing');
	// set focus and selection
	input.focus();
	if (input.setSelectionRange) {
		input.setSelectionRange(0, 0);
	}
});

document.addEventListener('DOMContentLoaded', function() {
	//
	// menu items
	//
	var elem = document.createElement('img');
	elem.src = $.glue.base_url+'modules/text/text.png';
	elem.alt = 'btn';
	elem.title = 'add a new text object';
	elem.width = 32;
	elem.height = 32;
	elem.addEventListener('click', function(e) {
		// create new object
		$.glue.backend({ method: 'glue.create_object', 'page': $.glue.page }, function(data) {
			var elem = document.createElement('div');
			elem.className = 'text resizable object';
			elem.style.position = 'absolute';
			var input = document.createElement('textarea');
			input.className = 'glue-text-input';
			input.style.display = 'none';
			input.style.height = '100%';
			input.style.width = '100%';
			var render = document.createElement('div');
			render.className = 'glue-text-render';
			render.style.height = '100%';
			render.style.width = '100%';
			elem.appendChild(input);
			elem.appendChild(render);
			elem.id = data['name'];
			// default width and height is set in the css
			// randomly pick one of the default colors
			if ($.glue.conf.object.default_colors) {
				var rand = Math.floor(Math.random()*$.glue.conf.object.default_colors.length);
				elem.style.backgroundColor = $.glue.conf.object.default_colors[rand];
			}
			document.body.appendChild(elem);
			// make width and height explicit
			elem.style.width = elem.offsetWidth+'px';
			elem.style.height = elem.offsetHeight+'px';
			// move to mouseclick
			elem.style.left = (e.pageX-elem.offsetWidth/2)+'px';
			elem.style.top = (e.pageY-elem.offsetHeight/2)+'px';
			$.glue.object.register(elem);
			$.glue.object.save(elem);
		});
		$.glue.menu.hide();
	});
	$.glue.menu.register('new', elem);

	//
	// context menu items
	//
	elem = document.createElement('img');
	elem.src = $.glue.base_url+'modules/text/text-background-color.png';
	elem.alt = 'btn';
	elem.title = 'change background color';
	elem.width = 32;
	elem.height = 32;
	var colorpicker_shown = false;
	elem.addEventListener('click', function(e) {
		var obj = $.glue.owner(this);
		var col = getComputedStyle(obj).backgroundColor;
		if (e.shiftKey) {
			col = prompt('Enter background color (e.g. #ff0000 or rgb(255, 0, 0))', col);
			if (!col) {
				return;
			}
		}
		$.glue.colorpicker.show(col, false, function(col) {
			obj.style.backgroundColor = col;
			// explicitly set the color for the textarea as changes to the parent object are not reflected while editing on Chrome 10.0.634.0 and below)
			obj.querySelector(':scope > .glue-text-input').style.backgroundColor = col;
		}, function (col) {
			$.glue.object.save(obj);
			colorpicker_shown = false;
		});
		colorpicker_shown = true;
	});
	elem.addEventListener('glue-deselect', function(e) {
		// hide the colorpicker if we opened it
		if (colorpicker_shown) {
			$.glue.colorpicker.hide();
			colorpicker_shown = false;
		}
	});
	$.glue.contextmenu.register('text', 'text-background-color', elem);

	elem = document.createElement('img');
	elem.src = $.glue.base_url+'modules/text/text-background-transparent.png';
	elem.alt = 'btn';
	elem.title = 'make background transparent';
	elem.width = 32;
	elem.height = 32;
	elem.addEventListener('click', function(e) {
		var obj = $.glue.owner(this);
		obj.style.backgroundColor = 'transparent';
		obj.querySelector(':scope > .glue-text-input').style.backgroundColor = 'transparent';
		$.glue.object.save(obj);
	});
	$.glue.contextmenu.register('text', 'text-background-transparent', elem);

	elem = document.createElement('img');
	elem.src = $.glue.base_url+'modules/text/text-font-size.png';
	elem.alt = 'btn';
	elem.width = 32;
	elem.height = 32;
	elem.setAttribute('x-data', "{ tip: 'drag to change font size, click to reset to default one' }");
	elem.setAttribute('x-bind:title', 'tip');
	elem.setAttribute('x-on:glue-menu-activate', 'text_font_size_sync($el)');
	elem.addEventListener('mousedown', function(e) {
		var obj = $.glue.owner(this);
		// we assume px here
		var orig_val = parseInt(getComputedStyle(obj).fontSize);
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
			obj.style.fontSize = val+'px';
			Alpine.$data(that).tip = 'drag to change font size ('+val+'px), click to reset to default one';
			if (x != 0 || y != 0) {
				no_change = false;
			}
		}, function(x, y) {
			// reset font-size if there was no change at all
			if (no_change) {
				obj.style.fontSize = '';
				$.glue.backend({ method: 'glue.object_remove_attr', name: obj.id, attr: 'text-font-size' });
				Alpine.$data(that).tip = 'drag to change font size ('+getComputedStyle(obj).fontSize+'px), click to reset to default one';
			} else {
				$.glue.object.save(obj);
			}
		});
		e.preventDefault();
		return false;
	});
	$.glue.contextmenu.register('text', 'text-font-size', elem);

	elem = document.createElement('img');
	elem.src = $.glue.base_url+'modules/text/text-font-color.png';
	elem.alt = 'btn';
	elem.title = 'change font color';
	elem.width = 32;
	elem.height = 32;
	elem.addEventListener('click', function(e) {
		var obj = $.glue.owner(this);
		var col = getComputedStyle(obj).color;
		if (e.shiftKey) {
			col = prompt('Enter font color (e.g. #ff0000 or rgb(255, 0, 0))', col);
			if (!col) {
				return;
			}
		}
		$.glue.colorpicker.show(col, false, function(col) {
			obj.style.color = col;
		}, function (col) {
			$.glue.object.save(obj);
			colorpicker_shown = false;
		});
		colorpicker_shown = true;
	});
	// this also requires the glue-deselect handler above
	$.glue.contextmenu.register('text', 'text-font-color', elem);

	elem = document.createElement('div');
	elem.className = 'glue-text-font-family';
	elem.style.height = '32px';
	elem.style.width = '32px';
	elem.title = 'change typeface (click to cycle through available typefaces)';
	elem.addEventListener('glue-menu-activate', function(e) {
		var obj = $.glue.owner(this);
		var fonts = [];
		var woff_fonts = [];
		$.glue.text.get_fonts(fonts, woff_fonts);
		// check if current font is a woff-font
		var cur = getComputedStyle(obj).fontFamily;
		var faceElem = document.getElementById('glue-contextmenu-text-font-face');
		for (i=0; i < woff_fonts.length; i++) {
			if (cur === woff_fonts[i]) {
				// current font is a woff-font
				faceElem.classList.add('glue-text-font-face');
				faceElem.classList.remove('glue-text-font-family');
				faceElem.title = 'this is a WOFF web-font ('+cur+') - while only supported on the latest browser versions, this text should look similar across different browsers and operating systems supporting WOFF';
				return;
			}
		}
		// not a woff-font
		faceElem.classList.remove('glue-text-font-face');
		faceElem.classList.add('glue-text-font-family');
		faceElem.title = 'change typeface (click to cycle through available typefaces)';
	});
	elem.addEventListener('click', function(e) {
		var obj = $.glue.owner(this);
		var fonts = [];
		var woff_fonts = [];
		$.glue.text.get_fonts(fonts, woff_fonts);
		// DEBUG
		//console.log(fonts);
		//console.log(woff_fonts);
		// search for current font
		var cur = getComputedStyle(obj).fontFamily;
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
			obj.style.fontFamily = fonts[n];
			// check if woff-font
			var is_woff = false;
			for (var i=0; i < woff_fonts.length; i++) {
				if (woff_fonts[i] == fonts[n]) {
					is_woff = true;
					break;
				}
			}
			if (is_woff) {
				this.classList.add('glue-text-font-face');
				this.classList.remove('glue-text-font-family');
				this.title = 'this is a WOFF web-font ('+fonts[n]+') - while only supported on the latest browser versions, this text should look similar across different browsers and operating systems supporting WOFF';
			} else {
				this.classList.remove('glue-text-font-face');
				this.classList.add('glue-text-font-family');
				this.title = 'change typeface (click to cycle through available typefaces)';
			}
			$.glue.object.save(obj);
		}
	});
	$.glue.contextmenu.register('text', 'text-font-face', elem);

	elem = document.createElement('img');
	elem.src = $.glue.base_url+'modules/text/text-font-style.png';
	elem.alt = 'btn';
	elem.title = 'change font style';
	elem.width = 32;
	elem.height = 32;
	elem.addEventListener('click', function(e) {
		var obj = $.glue.owner(this);
		var computed = getComputedStyle(obj);
		if (computed.fontStyle == 'normal' && (computed.fontWeight == 'bold' || computed.fontWeight == '700')) {
			obj.style.fontStyle = 'italic';
			obj.style.fontWeight = 'normal';
		} else if (computed.fontStyle == 'italic' && (computed.fontWeight == 'normal' || computed.fontWeight == '400')) {
			obj.style.fontStyle = 'italic';
			obj.style.fontWeight = 'bold';
		} else if (computed.fontStyle == 'italic' && (computed.fontWeight == 'bold' || computed.fontWeight == '700')) {
			obj.style.fontStyle = 'normal';
			obj.style.fontWeight = 'normal';
		} else {
			obj.style.fontStyle = 'normal';
			obj.style.fontWeight = 'bold';
		}
		$.glue.object.save(obj);
	});
	$.glue.contextmenu.register('text', 'text-font-style', elem);

	elem = document.createElement('img');
	elem.src = $.glue.base_url+'modules/text/text-line-height.png';
	elem.alt = 'btn';
	elem.title = 'change line height, click to reset to default one';
	elem.width = 32;
	elem.height = 32;
	elem.addEventListener('glue-menu-activate', function(e) {
		// TODO (later): my px to em calculation is not working perfectly, so leave this out for now
		/*
		var obj = $.glue.owner(this);
		if ($(obj).css('line-height').substr(-2) == 'em') {
			$(this).attr('title', 'change line height ('+$(obj).css('line-height')+'), click to reset to default one');
		} else if ($(obj).css('line-height').substr(-2) == 'px') {
			$(this).attr('title', 'change line height ('+parseFloat($(obj).css('line-height'))/parseFloat($(obj).css('font-size'))+'em), click to reset to default one');
		}
		*/
	});
	elem.addEventListener('mousedown', function(e) {
		var obj = $.glue.owner(this);
		// jquery seems to always return line-height in px
		// but just in case, try to handle em as well
		// assume px for font-size
		var font_size = parseFloat(getComputedStyle(obj).fontSize);
		var line_height = getComputedStyle(obj).lineHeight;
		if (line_height.substr(-2) == 'em') {
			var orig_val = parseFloat(line_height)*font_size;
		} else if (line_height.substr(-2) == 'px') {
			var orig_val = parseFloat(line_height);
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
			obj.style.lineHeight = (val/font_size)+'em';
			//$(that).attr('title', 'change line height ('+(val/font_size)+'em), click to reset to default one');
			if (x != 0 || y != 0) {
				no_change = false;
			}
		}, function(x, y) {
			// reset line-height if there was no change at all
			if (no_change) {
				obj.style.lineHeight = '';
				$.glue.backend({ method: 'glue.object_remove_attr', name: obj.id, attr: 'text-line-height' });
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
		e.preventDefault();
		return false;
	});
	$.glue.contextmenu.register('text', 'text-line-height', elem);

	elem = document.createElement('img');
	elem.src = $.glue.base_url+'modules/text/text-letter-spacing.png';
	elem.alt = 'btn';
	elem.title = 'change letter spacing';
	elem.width = 32;
	elem.height = 32;
	elem.addEventListener('glue-menu-activate', function(e) {
		// TODO (later): my px to em calculation is not working perfectly, so leave this out for now
		/*
		var obj = $.glue.owner(this);
		if ($(obj).css('letter-spacing').substr(-2) == 'em') {
			$(this).attr('title', 'change letter spacing ('+$(obj).css('letter-spacing')+'), click to reset to default one');
		} else if ($(obj).css('letter-spacing').substr(-2) == 'px') {
			$(this).attr('title', 'change letter spacing ('+parseFloat($(obj).css('letter-spacing'))/parseFloat($(obj).css('font-size'))+'em), click to reset to default one');
		}
		*/
	});
	elem.addEventListener('mousedown', function(e) {
		var obj = $.glue.owner(this);
		// jquery seems to always return letter-spacing in px
		// but just in case, try to handle em as well
		// assume px for font-size
		var font_size = parseFloat(getComputedStyle(obj).fontSize);
		var letter_spacing = getComputedStyle(obj).letterSpacing;
		if (letter_spacing.substr(-2) == 'em') {
			var orig_val = parseFloat(letter_spacing)*font_size;
		} else if (letter_spacing.substr(-2) == 'px') {
			var orig_val = parseFloat(letter_spacing);
		} else {
			// some sane fallback
			var orig_val = 0.0;
		}
		var no_change = true;
		var that = this;
		$.glue.slider(e, function(x, y) {
			var val = orig_val+y/6;
			obj.style.letterSpacing = (val/font_size)+'em';
			//$(that).attr('title', 'change letter spacing ('+(val/font_size)+'em), click to reset to default one');
			if (x != 0 || y != 0) {
				no_change = false;
			}
		}, function(x, y) {
			// reset letter-spacing if there was no change at all
			if (no_change) {
				obj.style.letterSpacing = '';
				$.glue.backend({ method: 'glue.object_remove_attr', name: obj.id, attr: 'text-letter-spacing' });
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
		e.preventDefault();
		return false;
	});
	$.glue.contextmenu.register('text', 'text-letter-spacing', elem);

	elem = document.createElement('img');
	elem.src = $.glue.base_url+'modules/text/text-word-spacing.png';
	elem.alt = 'btn';
	elem.title = 'change word spacing';
	elem.width = 32;
	elem.height = 32;
	elem.addEventListener('glue-menu-activate', function(e) {
		// TODO (later): my px to em calculation is not working perfectly, so leave this out for now
		/*
		var obj = $.glue.owner(this);
		if ($(obj).css('word-spacing').substr(-2) == 'em') {
			$(this).attr('title', 'change word spacing ('+$(obj).css('word-spacing')+'), click to reset to default one');
		} else if ($(obj).css('word-spacing').substr(-2) == 'px') {
			$(this).attr('title', 'change word spacing ('+parseFloat($(obj).css('word-spacing'))/parseFloat($(obj).css('font-size'))+'em), click to reset to default one');
		}
		*/
	});
	elem.addEventListener('mousedown', function(e) {
		var obj = $.glue.owner(this);
		// jquery seems to always return word-spacing in px
		// but just in case, try to handle em as well
		// assume px for font-size
		var font_size = parseFloat(getComputedStyle(obj).fontSize);
		var word_spacing = getComputedStyle(obj).wordSpacing;
		if (word_spacing.substr(-2) == 'em') {
			var orig_val = parseFloat(word_spacing)*font_size;
		} else if (word_spacing.substr(-2) == 'px') {
			var orig_val = parseFloat(word_spacing);
		} else {
			// some sane fallback
			var orig_val = 0.0;
		}
		var no_change = true;
		var that = this;
		$.glue.slider(e, function(x, y) {
			var val = orig_val+y/6;
			obj.style.wordSpacing = (val/font_size)+'em';
			//$(that).attr('title', 'change word spacing ('+(val/font_size)+'em), click to reset to default one');
			if (x != 0 || y != 0) {
				no_change = false;
			}
		}, function(x, y) {
			// reset word-spacing if there was no change at all
			if (no_change) {
				obj.style.wordSpacing = '';
				$.glue.backend({ method: 'glue.object_remove_attr', name: obj.id, attr: 'text-word-spacing' });
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
		e.preventDefault();
		return false;
	});
	$.glue.contextmenu.register('text', 'text-word-spacing', elem);

	elem = document.createElement('img');
	elem.src = $.glue.base_url+'modules/text/text-align.png';
	elem.alt = 'btn';
	elem.width = 32;
	elem.height = 32;
	elem.setAttribute('x-data', "{ tip: 'change text alignment' }");
	elem.setAttribute('x-bind:title', 'tip');
	elem.setAttribute('x-on:glue-menu-activate', 'text_align_sync($el)');
	elem.addEventListener('click', function(e) {
		var obj = $.glue.owner(this);
		var val = getComputedStyle(obj).textAlign;
		var data = Alpine.$data(this);
		if (val == 'center') {
			obj.style.textAlign = 'right';
			data.tip = 'change text alignment (right)';
		} else if (val == 'right') {
			obj.style.textAlign = 'justify';
			data.tip = 'change text alignment (justify)';
		} else if (val == 'justify') {
			obj.style.textAlign = 'left';
			data.tip = 'change text alignment (left)';
		} else {
			obj.style.textAlign = 'center';
			data.tip = 'change text alignment (center)';
		}
		$.glue.object.save(obj);
	});
	$.glue.contextmenu.register('text', 'text-align', elem);

	elem = document.createElement('img');
	elem.src = $.glue.base_url+'modules/text/text-padding.png';
	elem.alt = 'btn';
	elem.width = 32;
	elem.height = 32;
	elem.setAttribute('x-data', "{ tip: 'change padding, click to reset to default one' }");
	elem.setAttribute('x-bind:title', 'tip');
	elem.setAttribute('x-on:glue-menu-activate', 'text_padding_sync($el)');
	elem.addEventListener('mousedown', function(e) {
		var obj = $.glue.owner(this);
		// we assume px here, and for {left,right} {top,bottom} to be the same
		var computed = getComputedStyle(obj);
		var orig_x = parseInt(computed.paddingLeft);
		if (isNaN(orig_x)) {
			orig_x = 0;
		}
		var orig_w = obj.offsetWidth;
		var orig_y = parseInt(computed.paddingTop);
		if (isNaN(orig_y)) {
			orig_y = 0;
		}
		var orig_h = obj.offsetHeight;
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
			obj.style.paddingLeft = val_x+'px';
			obj.style.paddingRight = val_x+'px';
			// resize object
			obj.style.width = (orig_w+2*orig_x-2*val_x)+'px';
			obj.style.paddingTop = val_y+'px';
			obj.style.paddingBottom = val_y+'px';
			obj.style.height = (orig_h+2*orig_y-2*val_y)+'px';
			Alpine.$data(that).tip = 'change padding ('+val_x+'px, '+val_y+'px), click to reset to default one';
			if (x != 0 || y != 0) {
				no_change = false;
			}
		}, function(x, y) {
			// reset padding if there was no change at all
			if (no_change) {
				var var_x = parseInt(getComputedStyle(obj).paddingLeft);
				if (!isNaN(var_x)) {
					// resize object
					obj.style.width = (obj.offsetWidth+2*var_x)+'px';
				}
				var var_y = parseInt(getComputedStyle(obj).paddingTop);
				if (!isNaN(var_y)) {
					obj.style.height = (obj.offsetHeight+2*var_y)+'px';
				}
				obj.style.paddingLeft = '';
				obj.style.paddingRight = '';
				obj.style.paddingTop = '';
				obj.style.paddingBottom = '';
				var resetComputed = getComputedStyle(obj);
				Alpine.$data(that).tip = 'change padding ('+resetComputed.paddingLeft+', '+resetComputed.paddingTop+'), click to reset to default one';
			}
			// use object.save() in both cases (width and height got changed too)
			$.glue.object.save(obj);
		});
		e.preventDefault();
		return false;
	});
	$.glue.contextmenu.register('text', 'text-text-padding', elem);

	// make sure we don't send to much over the wire for every save
	// (obj here is edit.js's still-jQuery-wrapped save clone - kept as
	// jQuery until edit.js's save() and the other register_alter_pre_save
	// consumers (download/iframe/webvideo) convert together in one pass)
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
