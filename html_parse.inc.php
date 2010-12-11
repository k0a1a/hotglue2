<?php

/**
 *	html_parse.inc.php
 *	Generic html parsing functions
 *
 *	Copyright Gottfried Haider, Danja Vasiliev 2010.
 *	This source code is licensed under the GNU General Public License.
 *	See the file COPYING for more details.
 */

@require_once('config.inc.php');
require_once('html.inc.php');
require_once('util.inc.php');


function html_encode_str_smart($html)
{
	// TODO (later): remove debug code
	log_msg('debug', 'html_encode_str_smart: string is '.quot(var_dump_inl($html)));
	
	// encode ampersand characters where needed
	$cur = 0;
	while ($cur < strlen($html)) {
		// check &
		if (substr($html, $cur, 1) == '&') {
			$replace = true;
			// DEBUG
			$reason = false;
			
			// check &#??
			if ($cur+3 < strlen($html) && substr($html, $cur+1, 1) == '#') {
				// check $#x or not
				if (strtolower(substr($html, $cur+2, 1)) == 'x') {
					// check for hexadecimal characters before ;
					$ahead = $cur+3;
					while ($ahead < strlen($html)) {
						$char = strtolower(substr($html, $ahead, 1));
						if ((48 <= ord($char) && ord($char) <= 57) || (97 <= ord($char) && ord($char) <= 102)) {
							// valid hexadecimal character
							$ahead++;
						} elseif ($char == ';') {
							if ($cur+3 < $ahead) {
								// valid entitiy
								$replace = false;
								break;
							} else {
								// invalid entity
								// DEBUG
								$reason = 1;
								break;
							}
						} else {
							// invalid entity
							// DEBUG
							$reason = 2;
							break;
						}
					}
					if ($ahead == strlen($html)) {
						// DEBUG
						$reason = 3;
					}
				} elseif (is_numeric(substr($html, $cur+2, 1))) {
					// check for for decimal characters before ;
					$ahead = $cur+3;
					while ($ahead < strlen($html)) {
						$char = substr($html, $ahead, 1);
						if (48 <= ord($char) && ord($char) <= 57) {
							// valid decimal character
							$ahead++;
						} elseif ($char == ';') {
							// valid entity
							$replace = false;
							break;
						} else {
							// invalid entity
							$reason = 4;
							break;
						}
					}
					if ($ahead == strlen($html)) {
						// DEBUG
						$reason = 5;
					}
				} else {
					// DEBUG
					$reson = 6;
				}
			} else {
				// assume a named entity
				// it turns out we can't use get_html_translation_table() 
				// for this as the HTML_ENTITIES table is not complete
				$ahead = $cur+1;
				while ($ahead < strlen($html)) {
					$char = strtolower(substr($html, $ahead, 1));
					if ((48 <= ord($char) && ord($char) <= 57) || (97 <= ord($char) && ord($char) <= 122)) {
						// valid alphanumeric character
						$ahead++;
					} elseif ($char == ';') {
						if ($cur+1 < $ahead) {
							// (supposedly) valid entity
							$replace = false;
							break;
						} else {
							// invalid entity
							// DEBUG
							$reason = 7;
							break;
						}
					} else {
						// invalid entity
						// DEBUG
						$reason = 8;
						break;
					}
				}
				if ($ahead == strlen($html)) {
					$reason = 9;
					break;
				}
			}
			
			if ($replace) {
				log_msg('debug', 'html_encode_str_smart: replacing ampersand at '.$cur.' because of '.$reason);
				$html = substr($html, 0, $cur).'&amp;'.substr($html, $cur+1);
				log_msg('debug', 'html_encode_str_smart: new string is '.quot(var_dump_inl($html)));
				$cur += 5;
			} else {
				log_msg('debug', 'html_encode_str_smart: not replacing ampersand at '.$cur);
				$cur++;
			}
		} else {
			$cur++;
		}
	}
	
	// encode < and > where needed
	$cur = 0;
	while ($cur < strlen($html)) {
		$char = substr($html, $cur, 1);
		$replace = true;
		
		if ($char == '<') {
			// a possible tag
			// search for a closing bracket
			$ahead = $cur+1;
			while ($ahead < strlen($html)) {
				$c = strtolower(substr($html, $ahead, 1));
				if ($c == '<') {
					// found another opening bracket
					// the first one can't be legit
					// DEBUG
					$reason = 1;
					break;
				} elseif ($c == '>') {
					if ($cur+1 < $ahead) {
						// can be a valid tag
						$replace = false;
						// forward till after the closing bracket
						$cur = $ahead;
						break;
					} else {
						// invalid (empty) tag
						// DEBUG
						$reason = 2;
						break;
					}
				} elseif ($ahead == $cur+1) {
					if ((48 <= ord($c) && ord($c) <= 57) || (97 <= ord($c) && ord($c) <= 122) || $c == '/') {
						// starts with an alphanumeric character or a slash, can be valid
					} else {
						// DEBUG
						$reason = 3;
						break;
					}
				}
				$ahead++;
			}
			if ($ahead == strlen($html)) {
				// DEBUG
				$reason = 4;
			}
		} else if ($char == '>') {
			// we should be getting all valid tags through the code above
			// DEBUG
			$reason = 5;
		}
		
		if ($replace && $char == '<') {
			log_msg('debug', 'html_encode_str_smart: replacing opening bracket at '.$cur.' because of '.$reason);
			$html = substr($html, 0, $cur).'&lt;'.substr($html, $cur+1);
			log_msg('debug', 'html_encode_str_smart: new string is '.quot(var_dump_inl($html)));
			$cur += 4;
		} elseif ($replace && $char == '>') {
			log_msg('debug', 'html_encode_str_smart: replacing closing bracket at '.$cur.' because of '.$reason);
			$html = substr($html, 0, $cur).'&gt;'.substr($html, $cur+1);
			log_msg('debug', 'html_encode_str_smart: new string is '.quot(var_dump_inl($html)));
			$cur += 4;
		} else {
			$cur++;
		}
	}
	
	return $html;
}


/**
 *	parse a string containing html elements
 *
 *	this function decodes html's special characters except for the content 
 *	(when it too is not being parsed).
  *	this function is more fragile than html_parse_elem() when it comes to 
 *	malformatted input.
 *	@param string $html input string
 *	@param bool $recursive also parse children elements
 *	@return array parsed representation
 */
function html_parse($html, $recursive = false)
{
	global $single_tags;		// from html.inc.php
	
	$ret = array();
	
	$pos = 0;
	$open_tag = false;
	$open_pos = false;
	// can probably be done with -1 and some slightly easier code below
	$close_pos = false;
	$num_open = 0;
	
	while ($pos < strlen($html)) {
		if ($html[$pos] == '<') {
			if (($next = strpos($html, '>', $pos+1)) === false) {
				// error: unclosed <
				$pos++;
				continue;
			}
			// handle uppercase tags as well
			$tag = strtolower(trim(substr($html, $pos+1, $next-$pos-1)));
			
			if (substr($tag, 0, 1) !== '/') {
				// opening tag
				if ($num_open == 0) {
					$a = expl_whitesp($tag, true);
					$open_tag = $a[0];
					$open_pos = $pos;
				}
				// handle single tags
				if (in_array($tag, $single_tags)) {
					if ($num_open == 0) {
						// check if there was something between the last $close_pos and $open_pos
						$text = '';
						if ($close_pos === false && 0 < $open_pos) {
							$text = trim(substr($html, 0, $open_pos));
						} elseif ($close_pos !== false && $close_pos+1 < $open_pos) {
							$text = trim(substr($html, $close_pos+1, $open_pos-$close_pos-1));
						}
						if (0 < strlen($text)) {
							$ret[] = $text;
						}						
						$close_pos = $next;
						$ret[] = html_parse_elem(substr($html, $open_pos, $close_pos-$open_pos+1), $recursive);
					}
				} else {
					$num_open++;
				}
			} else {
				// closing tag
				$num_open--;
				if ($num_open == 0) {
					// check if opening and closing tag match
					if ($open_tag != substr($tag, 1)) {
						// error: opening and closing tag do not match
						$pos++;
						continue;
					}
					// check if there was something between the last $close_pos and $open_pos
					$text = '';
					if ($close_pos === false && 0 < $open_pos) {
						$text = trim(substr($html, 0, $open_pos));
					} elseif ($close_pos !== false && $close_pos+1 < $open_pos) {
						$text = trim(substr($html, $close_pos+1, $open_pos-$close_pos-1));
					}
					if (0 < strlen($text)) {
						$ret[] = $text;
					}
					$close_pos = $next;
					$ret[] = html_parse_elem(substr($html, $open_pos, $close_pos-$open_pos+1), $recursive);
				}
			}
		}
		$pos++;
	}
	// check if there was something after the last $close_pos
	$text = '';
	if ($close_pos === false && 1 < $pos) {
		$text = trim($html);
	} elseif ($close_pos !== false && $close_pos+1 < $pos) {
		$text = trim(substr($html, $close_pos+1));
	}
	if (0 < strlen($text)) {
		$ret[] = $text;
	}
	
	return $ret;
}


/**
 *	parse exactly one html element
 *
 *	this function decodes html's special characters except for the content 
 *	(when it too is not being parsed).
 *	this function is less fragile than html_parse() when it comes to 
 *	malformatted input.
 *	@param string $html input string (must start and end with the element's tag)
 *	@param bool $recursive also parse children elements
 *	@return array parsed representation
 */
function html_parse_elem($html, $recursive = false)
{
	global $single_tags;		// from html.inc.php
	$quot = array('"', "'");
	
	$ret = array();
	
	// explode the tag
	$next = strpos($html, '>', 1);
	$a = expl_whitesp(substr($html, 1, $next-1), true);
	if (count($a) < 1) {
		return $ret;
	} else {
		$ret['tag'] = strtolower($a[0]);
	}
	
	// attributes can end up in one to three fields
	// combine them
	for ($i=1; $i < count($a); $i++) {
		if ($a[$i] == '=' && 1 < $i && $i+1 < count($a)) {
			$a[$i] = $a[$i-1].'='.$a[$i+1];
			array_splice($a, $i-1, 1);
			array_splice($a, $i, 1);
			$i--;
		} elseif (substr($a[$i], -1) == '=' && $i+1 < count($a)) {
			$a[$i] .= $a[$i+1];
			array_splice($a, $i+1, 1);
			$i--;
		} elseif (substr($a[$i], 0, 1) == '=' && 1 < $i) {
			$a[$i] = $a[$i-1].$a[$i];
			array_splice($a, $i-1, 1);
			$i--;
		}
	}
	
	// put attributes into array
	for ($i=1; $i < count($a); $i++) {
		if (($equal = strpos($a[$i], '=')) === false) {
			$attr = strtolower(htmlspecialchars_decode($a[$i], ENT_QUOTES));
			$ret[$attr] = $attr;
		} else {
			$attr = strtolower(htmlspecialchars_decode(substr($a[$i], 0, $equal), ENT_QUOTES));
			$val = htmlspecialchars_decode(substr($a[$i], $equal+1), ENT_QUOTES);
			// strip optional quotes
			if (in_array(substr($val, 0, 1), $quot) && substr($val, 0, 1) == substr($val, -1)) {
				$val = substr($val, 1, -1);
			}
			// special cases for certain attributes
			if ($attr == 'class') {
				$val = expl(' ', $val);
			} elseif ($attr == 'style') {
				$styles = expl(';', $val);
				$val = array();
				foreach ($styles as $style) {
					$temp = expl(':', $style);
					if (1 < count($temp)) {
						$val[strtolower(trim($temp[0]))] = trim(implode(':', array_slice($temp, 1)));
					}
				}
			}
			$ret[$attr] = $val;
		}
	}
	
	// handle content
	if (!in_array($ret['tag'], $single_tags)) {
		// check if there is actually a closing tag
		if (($last = strrpos($html, '<')) !== false) {
			// check if opening and closing tags match
			if (strtolower(substr($html, $last+2, -1)) == $ret['tag']) {
				$ret['val'] = trim(substr($html, $next+1, $last-$next-1));
				if ($recursive) {
					$ret['val'] = html_parse($ret['val'], true);
				}
			}
		}
	}
	
	return $ret;
}


?>
