var galaxy = require('galaxy');

var sleep = galaxy.star(setTimeout, 0);

function* delay(val) {
	yield sleep(null, 100);
	return val;
}

function* f1() {
	var s = yield delay('a');
	s += yield delay('b');
	return s;
}

function* f2() {
	var s = '';
	for (var i = 0; i < 3; i++)
		s += (yield f1()) + i;
	return s;
}

function strictEqual(a, b) {
	if (a != b) throw new Error('ERROR: expected ' + b + ', got ' + a);
	console.log('ok: ' + a);
}

galaxy.unstar(f2)(function(err, result) {
	if (err) throw err;
	strictEqual(result, 'ab0ab1ab2');
});
