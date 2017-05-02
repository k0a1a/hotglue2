<?php

use PHPUnit\Framework\TestCase;

require __DIR__ . '/../util.inc.php';

class UtilTest extends TestCase
{

	function testIsIterable()
	{
		if (version_compare(PHP_VERSION, '7.1', '>=')) {
			$this->markTestSkipped("This test is only for PHP 7.1-");
		}

		$this->assertTrue(is_iterable([4]));
		$this->assertFalse(is_iterable(4));
		$this->assertFalse(is_iterable(new \stdClass));
		$this->assertTrue(is_iterable(new \DirectoryIterator(".")));
	}


	function testGetFirstitem()
	{
		$this->assertEquals(4, get_first_item([4]));
		$this->assertEquals('a', get_first_item(explode('.', 'a.b.c')));
		$this->assertNull(get_first_item([]));
	}


	/**
	 * @expectedException \InvalidArgumentException
	 */
	function testGetFirstitemWithNonIterable()
	{
		get_first_item(new \stdClass);
	}

}
