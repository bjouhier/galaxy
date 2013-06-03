var galaxy = require('galaxy');
var fs = galaxy.star(require('fs'));

function* countLines(path) {
	var names = yield fs.readdir(path);
	var total = 0;
	for (var i = 0; i < names.length; i++) {
		var fullname = path + '/' + names[i];
		if ((yield fs.stat(fullname)).isDirectory()) {
			total += yield countLines(fullname);
		} else {
			var count = (yield fs.readFile(fullname, 'utf8')).split('\n').length;
			console.log(fullname + ': ' + count);
			total += count;
		}
	}
	return total;
}

function* projectLineCounts() {
	var total = 0;
	total += yield countLines(__dirname + '/../examples');
	total += yield countLines(__dirname + '/../lib');
	total += yield countLines(__dirname + '/../test');
	console.log('TOTAL: ' + total);
	return total;
}

var projectLineCountsCb = galaxy.unstar(projectLineCounts);

projectLineCountsCb(function(err, result) {
	if (err) throw err;
	console.log('CALLBACK RESULT: ' + result);
});
