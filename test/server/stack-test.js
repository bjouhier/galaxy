"use strict";
QUnit.module(module.id);
// WARNING: DO NOT INSERT COMMENTS OR ANYTHING
// Line numbers matter to this test!

var galaxy = require('galaxy');

var nextTick = galaxy.star(function (cb){
	setTimeout(function(){
		cb();
	}, 0);
});

function* failAsync(code){
	throw new Error(code);
}

function* failSync(code){
	(function fail(dummy){ // dummy to defeat CoffeeScript compat rule
		throw new Error(code);
	})(0);
}

var fail;

function* A(code){
	if (code == 1) 
		yield fail(code);
	if (code == 2) 
		yield fail(code);
	yield nextTick();
	if (code == 3) 
		yield fail(code);
	for (var i = 0; i < 6; i++) {
		if (code == i) 
			yield fail(code);
		yield nextTick();
	}
	if (code == 6) 
		yield fail(code);
	yield nextTick();
	yield B(code);
	yield nextTick();
	return "END";
}

function* B(code){
	if (code == 7) 
		yield fail(code);
	yield C(code);
	yield nextTick();
	yield C(code);
	yield D(code);
}

function* C(code){
	if (code == 8) 
		yield fail(code);
}

function* D(code){
	if (code == 9) 
		yield fail(code);
}

function* E(code){
	try {
		yield fail(code);
	} 
	catch (ex) {
		if (code % 3 == 1) 
			yield fail(code);
		else if (code % 3 == 2) 
			yield A(code);
		else 
			return "OK " + code;
	}
}

function* F(code){
	var f1 = galaxy.spin(A(code));
	var f2 = galaxy.spin(A(code + 1));
	return (yield f1()) + " & " + (yield f2());
}

function* G(code){
	if (code == 5) 
		yield fail(code);
	return "" + code;
}

function* H(code){
	if (code % 2 == 0) 
		yield nextTick();
	return yield G(code);
}

function* I(code){
	var s = "";
	for (var i = 0; i < code; i++) 
		s += yield H(i);
	return s;
}

function* T(fn, code, failFn){
	fail = failFn;
	var s = "{"
	try {
		return yield fn(code);
	} 
	catch (ex) {
		var s = ex.stack;
		s = s.substring(0, s.indexOf('\n  <<< raw') + 1);
		s = s.split('\n').filter(function(l) { return l.indexOf('<<<') < 0; }).map(function(l){
			var m = /^\s+at (\w+).*:(\d+)\:[^:]+$/.exec(l);
			if (m) 
				return m[1] + ":" + m[2];
			return l;
		}).join('/');
		var end = s.indexOf('/T:');
		return end < 0 ? s + "-- end frame missing" : s.substring(0, end);
	}
}

function stackEqual(got, expect) {
	strictEqual(got, expect, expect);
}
// safari hack
var rawStack = new Error().stack ? function(raw) {
	return raw;
} : function() {
	return "raw stack unavailable";
}



asyncTest("stacks", 20, galaxy.unstar(function*() {
	stackEqual(yield T(A, 1, failAsync), rawStack("Error: 1/failAsync:15") + "/A:28");
	stackEqual(yield T(A, 1, failSync), rawStack("Error: 1/fail:20/failSync:21") + "/A:28");
	stackEqual(yield T(A, 2, failAsync), rawStack("Error: 2/failAsync:15") + "/A:30");
	stackEqual(yield T(A, 2, failSync), rawStack("Error: 2/fail:20/failSync:21") + "/A:30");
	stackEqual(yield T(A, 3, failAsync), rawStack("Error: 3/failAsync:15") + "/A:33");
	stackEqual(yield T(A, 3, failSync), rawStack("Error: 3/fail:20/failSync:21") + "/A:33");
	stackEqual(yield T(A, 4, failAsync), rawStack("Error: 4/failAsync:15") + "/A:36");
	stackEqual(yield T(A, 4, failSync), rawStack("Error: 4/fail:20/failSync:21") + "/A:36");
	stackEqual(yield T(A, 5, failAsync), rawStack("Error: 5/failAsync:15") + "/A:36");
	stackEqual(yield T(A, 5, failSync), rawStack("Error: 5/fail:20/failSync:21") + "/A:36");
	stackEqual(yield T(A, 6, failAsync), rawStack("Error: 6/failAsync:15") + "/A:40");
	stackEqual(yield T(A, 6, failSync), rawStack("Error: 6/fail:20/failSync:21") + "/A:40");
	stackEqual(yield T(A, 7, failAsync), rawStack("Error: 7/failAsync:15") + "/B:49/A:42");
	stackEqual(yield T(A, 7, failSync), rawStack("Error: 7/fail:20/failSync:21") + "/B:49/A:42");
	stackEqual(yield T(A, 8, failAsync), rawStack("Error: 8/failAsync:15") + "/C:58/B:50/A:42");
	stackEqual(yield T(A, 8, failSync), rawStack("Error: 8/fail:20/failSync:21") + "/C:58/B:50/A:42");
	stackEqual(yield T(A, 9, failAsync), rawStack("Error: 9/failAsync:15") + "/D:63/B:53/A:42");
	stackEqual(yield T(A, 9, failSync), rawStack("Error: 9/fail:20/failSync:21") + "/D:63/B:53/A:42");
	stackEqual(yield T(A, 10, failAsync), "END");
	stackEqual(yield T(A, 10, failSync), "END");
	start();
}));

asyncTest("catch", 20, galaxy.unstar(function*() {
	stackEqual(yield T(E, 1, failAsync), rawStack("Error: 1/failAsync:15") + "/E:72");
	stackEqual(yield T(E, 1, failSync), rawStack("Error: 1/fail:20/failSync:21") + "/E:72");
	stackEqual(yield T(E, 2, failAsync), rawStack("Error: 2/failAsync:15") + "/A:30/E:74");
	stackEqual(yield T(E, 2, failSync), rawStack("Error: 2/fail:20/failSync:21") + "/A:30/E:74");
	stackEqual(yield T(E, 3, failAsync), "OK 3");
	stackEqual(yield T(E, 3, failSync), "OK 3");
	stackEqual(yield T(E, 4, failAsync), rawStack("Error: 4/failAsync:15") + "/E:72");
	stackEqual(yield T(E, 4, failSync), rawStack("Error: 4/fail:20/failSync:21") + "/E:72");
	stackEqual(yield T(E, 5, failAsync), rawStack("Error: 5/failAsync:15") + "/A:36/E:74");
	stackEqual(yield T(E, 5, failSync), rawStack("Error: 5/fail:20/failSync:21") + "/A:36/E:74");
	stackEqual(yield T(E, 6, failAsync), "OK 6");
	stackEqual(yield T(E, 6, failSync), "OK 6");
	stackEqual(yield T(E, 7, failAsync), rawStack("Error: 7/failAsync:15") + "/E:72");
	stackEqual(yield T(E, 7, failSync), rawStack("Error: 7/fail:20/failSync:21") + "/E:72");
	stackEqual(yield T(E, 8, failAsync), rawStack("Error: 8/failAsync:15") + "/C:58/B:50/A:42/E:74");
	stackEqual(yield T(E, 8, failSync), rawStack("Error: 8/fail:20/failSync:21") + "/C:58/B:50/A:42/E:74");
	stackEqual(yield T(E, 9, failAsync), "OK 9");
	stackEqual(yield T(E, 9, failSync), "OK 9");
	stackEqual(yield T(E, 10, failAsync), rawStack("Error: 10/failAsync:15") + "/E:72");
	stackEqual(yield T(E, 10, failSync), rawStack("Error: 10/fail:20/failSync:21") + "/E:72");
	start();
}));

asyncTest("futures", 20, galaxy.unstar(function*() {
	stackEqual(yield T(F, 1, failAsync), rawStack("Error: 1/failAsync:15") + "/A:28/F:83");
	stackEqual(yield T(F, 1, failSync), rawStack("Error: 1/fail:20/failSync:21") + "/A:28/F:83");
	stackEqual(yield T(F, 2, failAsync), rawStack("Error: 2/failAsync:15") + "/A:30/F:83");
	stackEqual(yield T(F, 2, failSync), rawStack("Error: 2/fail:20/failSync:21") + "/A:30/F:83");
	stackEqual(yield T(F, 3, failAsync), rawStack("Error: 3/failAsync:15") + "/A:33/F:83");
	stackEqual(yield T(F, 3, failSync), rawStack("Error: 3/fail:20/failSync:21") + "/A:33/F:83");
	stackEqual(yield T(F, 4, failAsync), rawStack("Error: 4/failAsync:15") + "/A:36/F:83");
	stackEqual(yield T(F, 4, failSync), rawStack("Error: 4/fail:20/failSync:21") + "/A:36/F:83");
	stackEqual(yield T(F, 5, failAsync), rawStack("Error: 5/failAsync:15") + "/A:36/F:83");
	stackEqual(yield T(F, 5, failSync), rawStack("Error: 5/fail:20/failSync:21") + "/A:36/F:83");
	stackEqual(yield T(F, 6, failAsync), rawStack("Error: 6/failAsync:15") + "/A:40/F:83");
	stackEqual(yield T(F, 6, failSync), rawStack("Error: 6/fail:20/failSync:21") + "/A:40/F:83");
	stackEqual(yield T(F, 7, failAsync), rawStack("Error: 7/failAsync:15") + "/B:49/A:42/F:83");
	stackEqual(yield T(F, 7, failSync), rawStack("Error: 7/fail:20/failSync:21") + "/B:49/A:42/F:83");
	stackEqual(yield T(F, 8, failAsync), rawStack("Error: 8/failAsync:15") + "/C:58/B:50/A:42/F:83");
	stackEqual(yield T(F, 8, failSync), rawStack("Error: 8/fail:20/failSync:21") + "/C:58/B:50/A:42/F:83");
	stackEqual(yield T(F, 9, failAsync), rawStack("Error: 9/failAsync:15") + "/D:63/B:53/A:42/F:83");
	stackEqual(yield T(F, 9, failSync), rawStack("Error: 9/fail:20/failSync:21") + "/D:63/B:53/A:42/F:83");
	stackEqual(yield T(F, 10, failAsync), "END & END");
	stackEqual(yield T(F, 10, failSync), "END & END");
	start();
}));

asyncTest("loop", 8, galaxy.unstar(function*() {
	stackEqual(yield T(I, 4, failAsync), "0123");
	stackEqual(yield T(I, 4, failSync), "0123");
	stackEqual(yield T(I, 5, failAsync), "01234");
	stackEqual(yield T(I, 5, failSync), "01234");
	stackEqual(yield T(I, 6, failAsync), rawStack("Error: 5/failAsync:15") + "/G:88/H:95/I:101");
	stackEqual(yield T(I, 6, failSync), rawStack("Error: 5/fail:20/failSync:21") + "/G:88/H:95/I:101");
	stackEqual(yield T(I, 7, failAsync), rawStack("Error: 5/failAsync:15") + "/G:88/H:95/I:101");
	stackEqual(yield T(I, 7, failSync), rawStack("Error: 5/fail:20/failSync:21") + "/G:88/H:95/I:101");
	start();
}));