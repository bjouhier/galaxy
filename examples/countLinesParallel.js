var galaxy = require('galaxy');
var fs = galaxy.star(require('fs'));

function* countLines(path) {
	var names = yield fs.readdir(path);
	var total = 0;
	for (var i = 0; i < names.length; i++) {
		var fullname = path + '/' + names[i];
		var count = (yield fs.readFile(fullname, 'utf8')).split('\n').length;
		console.log(fullname + ': ' + count);
		total += count;
	}
	return total;
}

function* projectLineCountsParallel() {
 	var countLinesCb = galaxy.unstar(countLines);
 	var future1 = countLinesCb(__dirname + '/../examples');
 	var future2 = countLinesCb(__dirname + '/../lib');
	var future3 = countLinesCb(__dirname + '/../test');
 	var total = (yield future1()) + (yield future2()) + (yield future3());
	console.log('TOTAL: ' + total);
	return total; 
}

galaxy.unstar(projectLineCountsParallel)(function(err, result) {
	if (err) throw err;
	console.log('CALLBACK RESULT: ' + result);	
})