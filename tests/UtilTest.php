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

	function testA11yOrderTopToBottom()
	{
		$objs = [
			['name' => 'b', 'top' => 100, 'left' => 10],
			['name' => 'a', 'top' => 10, 'left' => 10],
			['name' => 'c', 'top' => 200, 'left' => 10],
		];
		$this->assertEquals(['a', 'b', 'c'], a11y_order_objects($objs, 16));
	}

	function testA11yOrderRowsAtThreshold()
	{
		// tops 0 and 5 are one row (left-to-right), top 40 starts the next
		$objs = [
			['name' => 'r', 'top' => 5, 'left' => 300],
			['name' => 'q', 'top' => 0, 'left' => 100],
			['name' => 's', 'top' => 40, 'left' => 10],
		];
		$this->assertEquals(['q', 'r', 's'], a11y_order_objects($objs, 16));
	}

	function testA11yOrderThresholdEdge()
	{
		// a difference of exactly the threshold still counts as one row
		$objs = [
			['name' => 'a', 'top' => 16, 'left' => 50],
			['name' => 'b', 'top' => 0, 'left' => 10],
		];
		$this->assertEquals(['b', 'a'], a11y_order_objects($objs, 16));
	}

	function testA11yOrderNameTieBreak()
	{
		// identical positions fall back to the name for a deterministic order
		$objs = [
			['name' => 'z', 'top' => 10, 'left' => 10],
			['name' => 'a', 'top' => 10, 'left' => 10],
		];
		$this->assertEquals(['a', 'z'], a11y_order_objects($objs, 16));
	}

	function testA11yOrderMissingCoordinates()
	{
		// a missing coordinate reads as 0 (the render caller intval-guards it)
		$objs = [
			['name' => 'a', 'top' => 0, 'left' => 10],
		];
		$this->assertEquals(['a'], a11y_order_objects($objs, 16));
	}

}
