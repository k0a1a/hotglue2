<?php

/*
 *	html.inc.php
 *	Generic html element functions
 *
 *	Copyright Gottfried Haider, Danja Vasiliev 2010.
 *	This source code is licensed under the GNU General Public License.
 *	See the file COPYING for more details.
 */

@require_once('config.inc.php');
require_once('util.inc.php');

$single_tags = ['br', 'hr', 'img', 'input', 'link', 'meta', 'param'];

if (!isset($html)) {
	html_flush();
}


/**
 *	helper function for sorting an array of arrays by key 'prio'
 *
 *	@param array &$a reference to an array
 */
function _array_sort_by_prio(&$a)
{
	// usort makes no guarantee what happens when two entries have the same 
	// prio
	usort($a, '_cmp_prio');
}


/**
 *	helper function for _array_sort_prio()
 *
 *	@param array $a array to compare
 *	@param array $b array to compare
 *	@return int comparison result
 */
function _cmp_prio($a, $b)
{
	if ($a['prio'] == $b['prio']) {
		return 0;
	}
	return ($a['prio'] < $b['prio']) ? -1 : 1;
}


/**
 *	get a reference to the body element
 *
 *	@return &array reference to the body element
 */
function &body()
{
	global $html;
	return $html['body'];
}


/**
 *	helper function for appending content to the body element
 *
 *	@param mixed $c content (can be either a string or another element)
 */
function body_append($c)
{
	global $html;
	elem_append($html['body'], $c);
}


/**
 *	create a element
 *
 *	@param string $tag element tag
 *	@return array element
 */
function elem($tag)
{
	return ['tag'=>$tag];
}


/**
 *	add a class to an element
 *
 *	@param array &$elem reference to an element
 *	@param string $c class
 */
function elem_add_class(&$elem, $c)
{
	if ((!isset($elem['class']) || !is_array($elem['class']))) {
		$elem['class'] = [];
	}
	$elem['class'][] = $c;
	$elem['class'] = array_unique($elem['class']);
}


/**
 *	append content to an element
 *
 *	this function is similar to elem_val().
 *	@param array &$elem reference to an element
 *	@param mixed $c content (can be either a string or another element)
 */
function elem_append(&$elem, $c)
{
	if (!isset($elem['val'])) {
		if (is_array($c)) {
			$elem['val'] = [$c];
		} else {
			$elem['val'] = $c;
		}
	} elseif (is_array($c) && is_array($elem['val'])) {
		$elem['val'][] = $c;
	} elseif (is_array($c) && is_string($elem['val'])) {
		$elem['val'] = [$elem['val'], $c];
	} elseif (is_string($c) && is_array($elem['val'])) {
		$elem['val'][] = $c;
	} elseif (is_string($c) && is_string($elem['val'])) {
		$elem['val'] .= $c;
	}
}


/**
 *	get or set an attribute in an element
 *
 *	@param array &$elem reference to an element
 *	@param string attribute name
 *	@param mixed attribute value (to set it)
 */
function elem_attr(&$elem)
{
	if (func_num_args() == 2) {
		if (isset($elem[func_get_arg(1)])) {
			return $elem[func_get_arg(1)];
		} else {
			return NULL;
		}
	} elseif (2 < func_num_args()) {
		$elem[func_get_arg(1)] = func_get_arg(2);
	}
}


/**
 *	get the element's classes in an array
 *
 *	@param array $elem element
 *	@return array
 */
function elem_classes($elem)
{
	if ((isset($elem['class']) && is_array($elem['class']))) {
		return $elem['class'];
	} else {
		return [];
	}
}


/**
 *	get or set a css property in an element
 *
 *	@param array &$elem reference to an element
 *	@param string css property name
 *	@param mixed css property value (to set it; empty string to clear it)
 */
function elem_css(&$elem)
{
	if (func_num_args() == 2) {
		if ((isset($elem['style']) && is_array($elem['style'])) && isset($elem['style'][func_get_arg(1)])) {
			return $elem['style'][func_get_arg(1)];
		} else {
			return NULL;
		}
	} elseif (2 < func_num_args()) {
		if ((!isset($elem['style']) || !is_array($elem['style']))) {
			$elem['style'] = [];
		}
		if (func_get_arg(2) === '') {
			// clear css property
			unset($elem['style'][func_get_arg(1)]);
		} else {
			$elem['style'][func_get_arg(1)] = func_get_arg(2);
		}
	}
}


/**
 *	turn an element into a html string
 *
 *	@param array $elem element
 *	@return string html
 */
function elem_finalize($elem)
{
	global $single_tags;
	
	$ret = '<'.$elem['tag'];
	if (isset($elem['id'])) {
		$ret .= ' id="'.htmlspecialchars($elem['id'], ENT_COMPAT, 'UTF-8').'"';
		unset($elem['id']);
	}
	if ((isset($elem['class']) && is_array($elem['class']))) {
		$ret .= ' class="'.htmlspecialchars(implode(' ', $elem['class']), ENT_COMPAT, 'UTF-8').'"';
		unset($elem['class']);
	}
	foreach ($elem as $key=>$val) {
		if ($key == 'tag' || $key == 'id' || $key == 'class' || $key == 'val' || $key == 'body_inline') {
			continue;
		} elseif ($key == 'style') {
			$ret .= ' style="';
			ksort($val);
			foreach ($val as $k=>$v) {
				$ret .= htmlspecialchars($k, ENT_COMPAT, 'UTF-8').': '.htmlspecialchars($v, ENT_COMPAT, 'UTF-8').'; ';
			}
			// strip the last space
			$ret = substr($ret, 0, -1);
			$ret .= '"';
		} else {
			$ret .= ' '.htmlspecialchars($key, ENT_NOQUOTES, 'UTF-8').'="'.htmlspecialchars($val, ENT_COMPAT, 'UTF-8').'"';
		}
	}
	$ret .= '>';
	
	// make block elements have a newline after the opening tag
	$block_tags = ['blockquote', 'body', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'li', 'ol', 'p', 'pre', 'script', 'ul'];
	if (in_array($elem['tag'], $block_tags)) {
		$block_tag = true;
		$ret .= nl();
	} else {
		$block_tag = false;
	}
	
	// handle single-type elements
	if (in_array(strtolower($elem['tag']), $single_tags)) {
		return $ret;
	}
	
	// handle text, an element array or an array of both
	$content = '';
	if ((isset($elem['val']) && is_string($elem['val']))) {
		$content = $elem['val'];
	} elseif ((isset($elem['val']) && is_array($elem['val'])) && isset($elem['val']['tag'])) {
		// this is recursive
		$content = elem_finalize($elem['val']);
	} elseif ((isset($elem['val']) && is_array($elem['val']))) {
		foreach ($elem['val'] as $v) {
			if (is_string($v)) {
				$content .= $v;
			} elseif (is_array($v) && isset($v['tag'])) {
				// add a newline when appropriate
				if (in_array($v['tag'], $block_tags) && 0 < strlen($content) && substr($content, -1) != "\n") {
					$content .= nl();
				}
				// this is recursive
				$content .= elem_finalize($v);
			}
		}
	}
	// move block element content in by one tab
	if ($block_tag && 0 < strlen($content)) {
		// if the content ends with a newline character, remove it
		if (substr($content, -1) == "\n") {
			$content = substr($content, 0, -1);
		}
		$content = str_replace("\n", "\n\t", $content);
		$ret .= tab().$content.nl();
	} elseif (0 < strlen($content)) {
		$ret .= $content;
	}
	
	$ret .= '</'.$elem['tag'].'>';
	// make block elements have a newline after the closing tag
	if ($block_tag) {
		$ret .= nl();
	}
	
	return $ret;
}


/**
 *	check if an element is of a certain class
 *
 *	@param array $elem element
 *	@param string $c class to check
 *	@return bool
 */
function elem_has_class($elem, $c)
{
	 if (is_array($elem) && is_array($elem['class']) && @in_array($c, $elem['class'])) {
		return true;
	} else {
		return false;
	}
}


/**
 *	remove an attribute from an element
 *
 *	@param array &$elem reference to an element
 *	@param string $a attribute name
 */
function elem_remove_attr(&$elem, $a)
{
	unset($elem[$a]);
}


/**
 *	remove a class from an element
 *
 *	@param array &$elem reference to an element
 *	@param string $c class
 */
function elem_remove_class(&$elem, $c)
{
	if ((isset($elem['class']) && is_array($elem['class']))) {
		if (($k = array_search($c, $elem['class'])) !== false) {
			array_splice($elem['class'], $k, 1);
		}
	}
}


/**
 *	get the element's tag
 *
 *	the tag is always returned in lowercase characters.
 *	@param array $elem element
 *	@return string
 */
function elem_tag($elem)
{
	if (isset($elem['tag'])) {
		return strtolower($elem['tag']);
	} else {
		return '';
	}
}


/**
 *	get or set an element's content
 *
 *	this function is similar to elem_append().
 *	@param array &$elem reference to an element
 *	@param mixed $c content (to set it, can be either a string or another element)
 */
function elem_val(&$elem)
{
	if (func_num_args() == 1) {
		if ((isset($elem['val']) && is_string($elem['val']))) {
			return $elem['val'];
		} else {
			return '';
		}
	} elseif (1 < func_num_args()) {
		$elem['val'] = func_get_arg(1);
	}
}


/**
 *	add a link-alternate element to the html header
 *
 *	@param string $type type attribute
 *	@param string $url url attribute (url-encoded if necessary)
 *	@param string $title title attribute
 */
function html_add_alternate($type, $url, $title)
{
	global $html;
	if ((!isset($html['header']['alternate']) || !is_array($html['header']['alternate']))) {
		$html['header']['alternate'] = [];
	}
	$html['header']['alternate'][] = ['type'=>$type, 'url'=>$url, 'title'=>$title];
}


/**
 *	strip a leading base_url() from an asset url, turning it back into a
 *	same-site relative one
 *
 *	every asset-loading call site in this codebase builds its url as
 *	base_url().'some/path' - centralizing the strip here (rather than
 *	dropping the base_url() call at each of those many sites) means assets
 *	keep resolving correctly even when a page is viewed through a different
 *	domain than the one BASE_URL is configured/detected as (e.g. a custom
 *	domain pointed at this install), same rationale as
 *	module_object.inc.php's object_alter_render_late() for page links
 *
 *	@param string $url
 *	@return string
 */
function _relativize_asset_url($url)
{
	$bu = base_url();
	if (!empty($bu) && strpos($url, $bu) === 0) {
		return substr($url, strlen($bu));
	}
	return $url;
}


/**
 *	add a reference to a css file to the html header
 *
 *	@param string $url url attribute (url-encoded if necessary)
 *	@param int $prio when to insert reference (0 - very early to 9 - late)
 *	@param string $media media attribute (optional)
 */
function html_add_css($url, $prio = 5, $media = '')
{
	global $html;
	if ((!isset($html['header']['css']) || !is_array($html['header']['css']))) {
		$html['header']['css'] = [];
	}
	$html['header']['css'][] = ['url'=>_relativize_asset_url($url), 'prio'=>$prio, 'media'=>$media];
}


/**
 *	add a css rule to the html header
 *
 *	@param string $rule css rule
 *	@param int $prio when to insert code (0 - very early to 9 - late)
 */
function html_add_css_inline($rule, $prio = 5)
{
	global $html;
	if ((!isset($html['header']['css_inline']) || !is_array($html['header']['css_inline']))) {
		$html['header']['css_inline'] = [];
	}
	$html['header']['css_inline'][] = ['rule'=>$rule, 'prio'=>$prio];
}

/**
 *	add head definitions to the html header
 *
 *	@param string $def heade definition
 *	@param int $prio when to insert code (0 - very early to 9 - late)
 */
function html_add_head_inline($def, $prio = 5)
{
	global $html;
	if ((!isset($html['header']['head_inline']) || !is_array($html['header']['head_inline']))) {
		$html['header']['head_inline'] = [];
	}
	$html['header']['head_inline'][] = ['def'=>$def, 'prio'=>$prio];
}

/**
 *	add body definitions to the html body
 *
 *	@param string $def heade definition
 *	@param int $prio when to insert code (0 - very early to 9 - late)
 */
function html_add_body_inline($def, $prio = 5)
{
	global $html;
	if ((!isset($html['body']['body_inline']) || !is_array($html['body']['body_inline']))) {
		$html['body']['body_inline'] = [];
	}
	$html['body']['body_inline'][] = ['def'=>$def, 'prio'=>$prio];
}
/**
 *	add a reference to a javascript file to the html header
 *
 *	duplicate references will be removed from the output.
 *	@param string $url url attribute (url-encoded if necessary)
 *	@param int $prio when to insert reference (0 - very early to 9 - late)
 */
function html_add_js($url, $prio = 5)
{
	global $html;
	if ((!isset($html['header']['js']) || !is_array($html['header']['js']))) {
		$html['header']['js'] = [];
	}
	$html['header']['js'][] = ['url'=>_relativize_asset_url($url), 'prio'=>$prio];
}


/**
 *	add javascript code to the html header
 *
 *	@param string $code javscript code
 *	@param int $prio when to insert code (0 - very early to 9 - late)
 *	@param string $reason (e.g. your module) (optional)
 */
function html_add_js_inline($code, $prio = 5, $reason = '')
{
	global $html;
	if ((!isset($html['header']['js_inline']) || !is_array($html['header']['js_inline']))) {
		$html['header']['js_inline'] = [];
	}
	$html['header']['js_inline'][] = ['code'=>$code, 'prio'=>$prio, 'reason'=>$reason];
}


/**
 *	set a variable in the javascript output
 *
 *	@param string $key variable or object the value will be stored)
 *	@param mixed $val value
 */
function html_add_js_var($key, $val)
{
	global $html;
	if ((!isset($html['header']['js_var']) || !is_array($html['header']['js_var']))) {
		$html['header']['js_var'] = [];
	}
	$html['header']['js_var'][$key] = $val;
}


/**
 *	get or set a css property in the html element
 *
 *	@param string $prop css property name
 *	@param mixed css property value (to set it; empty string to clear it)
 */
function html_css($prop)
{
	global $html;
	if (func_num_args() == 1) {
		if ((isset($html['header']['style']) && is_array($html['header']['style'])) && isset($html['header']['style'][$prop])) {
			return $html['header']['style'][$prop];
		} else {
			return NULL;
		}
	} elseif (1 < func_num_args()) {
		if ((!isset($html['header']['style']) || !is_array($html['header']['style']))) {
			$html['header']['style'] = [];
		}
		if (func_get_arg(1) === '') {
			// clear css property
			unset($html['header']['style'][$prop]);
		} else {
			$html['header']['style'][$prop] = func_get_arg(1);
		}
	}
}


/**
 *	disable caching of output
 *
 *	can be used for modules that need the php to be executed every time.
 *	@param string $reason (e.g. your module)
 */
function html_disable_caching($reason = '')
{
	global $html;
	if ($html['cache']) {
		log_msg('info', 'html: disabled caching for this request because of '.quot($reason));
		$html['cache'] = false;
	}
}


/**
 *	get or set favicon
 *
 *	@param string url (to set it, url-encoded if necessary)
 */
function html_favicon()
{
	global $html;
	if (func_num_args() == 0) {
		if ((isset($html['header']['favicon']) && is_string($html['header']['favicon']))) {
			return $html['header']['favicon'];
		} else {
			return '';
		}
	} elseif (0 < func_num_args()) {
		$html['header']['favicon'] = _relativize_asset_url(func_get_arg(0));
	}
}


/**
 *	turn the page into a html string
 *
 *	@param bool &$cache is output cachable (will only modified if $cache is 
 *	true before)
 *	@return string html
 */
function html_finalize(&$cache = false)
{
	global $html;
	// return html5
	$ret = '<!DOCTYPE html>'.nl();
	$ret .= '<html';
	if ((isset($html['header']['style']) && is_array($html['header']['style']))) {
		$ret .= ' style="';
		ksort($html['header']['style']);
		foreach ($html['header']['style'] as $key=>$val) {
			$ret .= htmlspecialchars($key, ENT_COMPAT, 'UTF-8').': '.htmlspecialchars($val, ENT_COMPAT, 'UTF-8').'; ';
		}
		// strip the last space
		$ret = substr($ret, 0, -1);
		$ret .= '"';
	}
	$ret .= '>'.nl();
	$ret .= '<head>'.nl();
	$ret .= '<title>'.htmlspecialchars($html['header']['title'], ENT_NOQUOTES, 'UTF-8').'</title>'.nl();
	$ret .= '<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">'.nl();
	if ((isset($html['header']['alternate']) && is_array($html['header']['alternate']))) {
		foreach ($html['header']['alternate'] as $e) {
			$ret .= '<link rel="alternate" type="'.htmlspecialchars($e['type'], ENT_COMPAT, 'UTF-8').'" href="'.htmlspecialchars($e['url'], ENT_COMPAT, 'UTF-8').'" title="'.htmlspecialchars($e['title'], ENT_COMPAT, 'UTF-8').'">'.nl();
		}
	}
	if (!empty($html['header']['favicon'])) {
		$ret .= '<link rel="shortcut icon" href="'.htmlspecialchars($html['header']['favicon'], ENT_COMPAT, 'UTF-8').'">'.nl();
	}
	if ((isset($html['header']['css']) && is_array($html['header']['css']))) {
		_array_sort_by_prio($html['header']['css']);
		// removed the removal of duplicates here as two different media might point to the same url
		//array_unique_element($html['header']['css'], 'url');
		foreach ($html['header']['css'] as $e) {
			$ret .= '<link rel="stylesheet" type="text/css" href="'.htmlspecialchars($e['url'], ENT_COMPAT, 'UTF-8').'"';
			if (!empty($e['media'])) {
				$ret .= ' media="'.htmlspecialchars($e['media'], ENT_COMPAT, 'UTF-8').'"';
			}
			$ret .= '>'.nl();
		}
	}
	if ((isset($html['header']['css_inline']) && is_array($html['header']['css_inline']))) {
		_array_sort_by_prio($html['header']['css_inline']);
		if (0 < count($html['header']['css_inline'])) {
			$ret .= '<style type="text/css">'.nl();
		}
		foreach ($html['header']['css_inline'] as $c) {
			$rule = $c['rule'];
			// if the rule ends with a newline character, remove it
			if (substr($rule, -1) == "\n") {
				$rule = substr($rule, 0, -1);
			}
			// move rule in by one tab
			$rule = str_replace("\n", "\n\t", $rule);
			$ret .= tab().$rule.nl();
		}
		if (0 < count($html['header']['css_inline'])) {
			$ret .= '</style>'.nl();
		}
	}
	if ((isset($html['header']['js']) && is_array($html['header']['js']))) {
		_array_sort_by_prio($html['header']['js']);
		array_unique_element($html['header']['js'], 'url');
		foreach ($html['header']['js'] as $e) {
			$ret .= '<script type="text/javascript" src="'.htmlspecialchars($e['url'], ENT_COMPAT, 'UTF-8').'"></script>'.nl();
		}
	}
	if ((isset($html['header']['js_var']) && is_array($html['header']['js_var']))) {
		$ret .= array_to_js($html['header']['js_var']);
	}
	if ((isset($html['header']['js_inline']) && is_array($html['header']['js_inline']))) {
		_array_sort_by_prio($html['header']['js_inline']);
		foreach ($html['header']['js_inline'] as $c) {
			if (!empty($c['reason'])) {
				$ret .= '<!-- '.$c['reason'].' -->'.nl();
				$ret .= '<script type="text/javascript">'.nl();
				// if the code ends with a newline character, remove it
				if (substr($c['code'], -1) == "\n") {
					$c['code'] = substr($c['code'], 0, -1);
				}
				// move code in by one tab
				$c = str_replace("\n", "\n\t", $c);
				$ret .= tab().$c['code'].nl();
				$ret .= '</script>'.nl();
			}
		}
	}
	if ((isset($html['header']['head_inline']) && is_array($html['header']['head_inline']))) {
		_array_sort_by_prio($html['header']['head_inline']);
		if (0 < count($html['header']['head_inline'])) {
			$ret .= '<!-- user HEAD definitions -->'.nl();
		}
		foreach ($html['header']['head_inline'] as $c) {
			$def = $c['def'];
			// if the definition ends with a newline character, remove it
			if (substr($def, -1) == "\n") {
				$def = substr($def, 0, -1);
			}
			// $rule = str_replace("\n", "\n\t", $def);
			$ret .= $def.nl();
		}
	}
	$ret .= '</head>'.nl();
	// load user body definitions
	if ((isset($html['body']['body_inline']) && is_array($html['body']['body_inline']))) {
		_array_sort_by_prio($html['body']['body_inline']);
		if (0 < count($html['body']['body_inline'])) {
			$user_body = '<!-- user BODY definitions -->'.nl();
		}
		foreach ($html['body']['body_inline'] as $c) {
			$def = $c['def'];
			// if the definition ends with a newline character, remove it
			if (substr($def, -1) == "\n") {
				$def = substr($def, 0, -1);
			}
			$rule = str_replace("\n", "\n\t", $def);
			$user_body .= $def.nl();
		}
		body_append($user_body);
	}
	$ret .= elem_finalize($html['body']);
	$ret .= '</html>';
	
	// pass caching information up if requested
	if ($cache) {
		if (!$html['cache']) {
			$cache = false;
		}
	}
	
	return $ret;
}


/**
 *	reset the html output
 */
function html_flush()
{
	global $html;
	$html = [];
	$html['header'] = ['title'=>''];
	$html['body'] = ['tag'=>'body'];
	$html['cache'] = true;
}


/**
 *	get or set title
 *
 *	@param string title (to set it)
 */
function html_title()
{
	global $html;
	if (func_num_args() == 0) {
		return $html['header']['title'];
	} elseif (0 < func_num_args()) {
		$html['header']['title'] = func_get_arg(0);
	}
}
