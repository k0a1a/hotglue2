<?php

use PHPUnit\Framework\TestCase;

require __DIR__ . '/../util.inc.php';

class UtilTest extends TestCase
{

	function testIsIterable()
	{
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


	function testGetFirstitemWithNonIterable()
	{
		$this->expectException(\InvalidArgumentException::class);
		get_first_item(new \stdClass);
	}

}
