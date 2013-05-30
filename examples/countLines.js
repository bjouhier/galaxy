var galaxy = require('galaxy'), star = galaxy.star, unstar = galaxy.unstar;
var fs = require('fs');

var readdir = star(fs.readdir)
var readFile = star(fs.readFile);

function* countLines(path) {
	var names = yield readdir(path);
	var total = 0;
	for (var i = 0; i < names.length; i++) {
		var name = names[i];
		var n = (yield (readFile(path + '/' + name, 'utf8'))).split('\n').length;
		console.log(name + ': ' + n);
		total += n;
	}
	return total;
}

galaxy.unstar(countLines)(__dirname, function(err, result) {
	if (err) throw err;
	console.log('TOTAL: ' + result);
})