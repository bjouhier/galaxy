var galaxy = require('galaxy');
var fs = require('fs');
var readdirStar = galaxy.star(fs.readdir);
var readFileStar = galaxy.star(fs.readFile);

function* countLinesStar(path) {
	var names = yield readdirStar(path);
	var total = 0;
	for (var i = 0; i < names.length; i++) {
		var fullname = path + '/' + names[i];
		var count = (yield readFileStar(fullname, 'utf8')).split('\n').length;
		console.log(fullname + ': ' + count);
		total += count;
	}
	return total;
}

function* projectLineCountsParallelStar() {
 	var countLinesCb = galaxy.unstar(countLinesStar);
 	var future1 = countLinesCb(__dirname + '/../examples');
 	var future2 = countLinesCb(__dirname + '/../lib');
	var future3 = countLinesCb(__dirname + '/../test');
 	var total = (yield future1()) + (yield future2()) + (yield future3());
	console.log('TOTAL: ' + total);
	return total; 
}

galaxy.unstar(projectLineCountsParallelStar)(function(err, result) {
	if (err) throw err;
	console.log('CALLBACK RESULT: ' + result);	
})
