"use strict";
QUnit.module(module.id);
var galaxy = require("galaxy");

function* delay(val) {
	yield galaxy.star(process.nextTick)();
	return val;
}

function* delayFail(err) {
	yield galaxy.star(process.nextTick)();
	throw err;
}

function sparse() {
	var a = [];
	a[3] = 33;
	a[4] = 44;
	a[9] = 99;
	return a;
}

function dump(a) {
	return a.reduce(function(s, v) {
		return s + '/' + v;
	}, '');
}

asyncTest("each", 6, galaxy.unstar(function*() {
	var result = 1;
	yield [1, 2, 3, 4].forEachStar(function*(val) {
		var v = yield delay(val);
		result = result * v;
	});
	strictEqual(result, 24);
	result = 1;
	yield [1, 2, 3, 4].forEachStar(2, function*(val) {
		var v = yield delay(val);
		result = result * v;
	});
	strictEqual(result, 24);
	result = 1;
	yield [1, 2, 3, 4].forEachStar({
		parallel: 2
	}, function*(val) {
		var v = yield delay(val);
		result = result * v;
	});
	strictEqual(result, 24);
	result = 1;
	yield [1, 2, 3, 4].forEachStar(-1, function*(val) {
		var v = yield delay(val);
		result = result * v;
	});
	strictEqual(result, 24);
	result = '';
	yield sparse().forEachStar(function*(val, i) {
		var v = yield delay(val);
		result = result + '/' + i + ':' + v;
	});
	strictEqual(result, '/3:33/4:44/9:99');
	result = '';
	yield sparse().forEachStar(-1, function*(val, i) {
		var v = yield delay(val);
		result = result + '/' + i + ':' + v;
	});
	strictEqual(result, '/3:33/4:44/9:99');
	start();
}));

asyncTest("map", 8,  galaxy.unstar(function*() {
	var result = yield [1, 2, 3, 4].mapStar(function*(val) {
		return 2 * (yield delay(val));
	});
	deepEqual(result, [2, 4, 6, 8]);
	var result = yield [1, 2, 3, 4].mapStar(2, function*(val) {
		return 2 * (yield delay(val));
	});
	deepEqual(result, [2, 4, 6, 8]);
	var result = yield [1, 2, 3, 4].mapStar({
		parallel: 2
	}, function*(val) {
		return 2 * (yield delay(val));
	});
	deepEqual(result, [2, 4, 6, 8]);
	var result = yield [1, 2, 3, 4].mapStar(-1, function*(val) {
		return 2 * (yield delay(val));
	});
	deepEqual(result, [2, 4, 6, 8]);
	result = yield sparse().mapStar(function*(val, i) {
		var v = yield delay(val);
		return i + ':' + v;
	});
	strictEqual(result.length, 10);
	strictEqual(dump(result), '/3:33/4:44/9:99');
	result = yield sparse().mapStar(-1, function*(val, i) {
		var v = yield delay(val);
		return i + ':' + v;
	});
	strictEqual(result.length, 10);
	strictEqual(dump(result), '/3:33/4:44/9:99');
	start();
}));

asyncTest("filter", 8,  galaxy.unstar(function*() {
	var result = yield [1, 2, 3, 4].filterStar(function*(val) {
		return (yield delay(val)) % 2;
	});
	deepEqual(result, [1, 3]);
	var result = yield [1, 2, 3, 4].filterStar(2, function*(val) {
		return (yield delay(val)) % 2;
	});
	deepEqual(result, [1, 3]);
	var result = yield [1, 2, 3, 4].filterStar({
		parallel: 2
	}, function*(val) {
		return (yield delay(val)) % 2;
	});
	deepEqual(result, [1, 3]);
	var result = yield [1, 2, 3, 4].filterStar(-1, function*(val) {
		return (yield delay(val)) % 2;
	});
	deepEqual(result, [1, 3]);
	result = yield sparse().filterStar(function*(val, i) {
		return (yield delay(val)) % 2;
	});
	strictEqual(result.length, 2);
	deepEqual(result, [33, 99]);
	result = yield sparse().filterStar(-1, function*(val, i) {
		return (yield delay(val)) % 2;
	});
	strictEqual(result.length, 2);
	deepEqual(result, [33, 99]);
	start();
}));

asyncTest("every true", 6,  galaxy.unstar(function*() {
	var result = yield [1, 2, 3, 4].everyStar(function*(val) {
		return (yield delay(val)) < 5;
	});
	strictEqual(result, true);
	var result = yield [1, 2, 3, 4].everyStar(2, function*(val) {
		return (yield delay(val)) < 5;
	});
	strictEqual(result, true);
	var result = yield [1, 2, 3, 4].everyStar({
		parallel: 2
	}, function*(val) {
		return (yield delay(val)) < 5;
	});
	strictEqual(result, true);
	var result = yield [1, 2, 3, 4].everyStar(-1, function*(val) {
		return (yield delay(val)) < 5;
	});
	strictEqual(result, true);
	result = yield sparse().everyStar(function*(val, i) {
		return (yield delay(val)) > 30;
	});
	strictEqual(result, true);
	result = yield sparse().everyStar(-1, function*(val, i) {
		return (yield delay(val)) > 30;
	});
	strictEqual(result, true);
	start();
}));

asyncTest("every false", 6, galaxy.unstar(function*() {
	var result = yield [1, 2, 3, 4].everyStar(function*(val) {
		return (yield delay(val)) < 3;
	});
	strictEqual(result, false);
	var result = yield [1, 2, 3, 4].everyStar(2, function*(val) {
		return (yield delay(val)) < 3;
	});
	strictEqual(result, false);
	var result = yield [1, 2, 3, 4].everyStar({
		parallel: 2
	}, function*(val) {
		return (yield delay(val)) < 3;
	});
	strictEqual(result, false);
	var result = yield [1, 2, 3, 4].everyStar(-1, function*(val) {
		return (yield delay(val)) < 3;
	});
	strictEqual(result, false);
	result = yield sparse().everyStar(function*(val, i) {
		return (yield delay(val)) > 40;
	});
	strictEqual(result, false);
	result = yield sparse().everyStar(-1, function*(val, i) {
		return (yield delay(val)) > 40;
	});
	strictEqual(result, false);
	start();
}));

asyncTest("some true", 6, galaxy.unstar(function*() {
	var result = yield [1, 2, 3, 4].someStar(function*(val) {
		return (yield delay(val)) < 3;
	});
	strictEqual(result, true);
	var result = yield [1, 2, 3, 4].someStar(2, function*(val) {
		return (yield delay(val)) < 3;
	});
	strictEqual(result, true);
	var result = yield [1, 2, 3, 4].someStar({
		parallel: 2
	}, function*(val) {
		return (yield delay(val)) < 3;
	});
	strictEqual(result, true);
	var result = yield [1, 2, 3, 4].someStar(-1, function*(val) {
		return (yield delay(val)) < 3;
	});
	strictEqual(result, true);
	result = yield sparse().someStar(function*(val, i) {
		return (yield delay(val)) > 30;
	});
	strictEqual(result, true);
	result = yield sparse().someStar(-1, function*(val, i) {
		return (yield delay(val)) > 30;
	});
	strictEqual(result, true);
	start();
}));

asyncTest("some false", 6, galaxy.unstar(function*() {
	var result = yield [1, 2, 3, 4].someStar(function*(val) {
		return (yield delay(val)) < 0;
	});
	strictEqual(result, false);
	var result = yield [1, 2, 3, 4].someStar(2, function*(val) {
		return (yield delay(val)) < 0;
	});
	strictEqual(result, false);
	var result = yield [1, 2, 3, 4].someStar({
		parallel: 2
	}, function*(val) {
		return (yield delay(val)) < 0;
	});
	strictEqual(result, false);
	var result = yield [1, 2, 3, 4].someStar(-1, function*(val) {
		return (yield delay(val)) < 0;
	});
	strictEqual(result, false);
	result = yield sparse().someStar(function*(val, i) {
		return !((yield delay(val)) > 20);
	});
	strictEqual(result, false);
	result = yield sparse().someStar(-1, function*(val, i) {
		return !((yield delay(val)) > 20);
	});
	strictEqual(result, false);
	start();
}));

asyncTest("reduce", 2, galaxy.unstar(function*() {
	var result = yield [1, 2, 3, 4].reduceStar(function*(v, val) {
		return v * (yield delay(val));
	}, 1);
	strictEqual(result, 24);
	var result = yield sparse().reduceStar(function*(v, val) {
		return v + '/' + (yield delay(val));
	}, '');
	strictEqual(result, '/33/44/99');
	start();
}));

asyncTest("reduceRight", 2, galaxy.unstar(function*() {
	var result = yield [1, 2, 3, 4].reduceRightStar(function*(v, val) {
		return v * (yield delay(val));
	}, 1);
	strictEqual(result, 24);
	var result = yield sparse().reduceRightStar(function*(v, val) {
		return v + '/' + (yield delay(val));
	}, '');
	strictEqual(result, '/99/44/33');
	start();
}));

asyncTest("sort", 3, galaxy.unstar(function*() {
	var array = [1, 2, 3, 4];
	yield array.sortStar(function*(a, b) {
		return yield delay(a - b);
	});
	deepEqual(array, [1, 2, 3, 4], "In order array sort ok");
	array = [4, 3, 2, 1];
	yield array.sortStar(function*(a, b) {
		return yield delay(a - b);
	});
	deepEqual(array, [1, 2, 3, 4], "Reverse array sort ok");
	array = [3, 1, 2, 4];
	yield array.sortStar(function*(a, b) {
		return yield delay(a - b);
	});
	deepEqual(array, [1, 2, 3, 4], "Random array sort ok");
	start();
}));
