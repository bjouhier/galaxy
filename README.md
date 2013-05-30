Galaxy bridges the gap between node.js callback based APIs and EcmaScript 6 generators. It makes it easy to write node.js code in sync style thanks to ES6 generators.

Programming with galaxy is a bit like programming with two different worlds:

* The world of _usual_ asynchronous functions to which you pass callbacks. This is how most node.js APIs are designed.
* A new world of _generator_ functions that you declare as `function*` (_function star_) rather than as `function`. You don't pass callbacks to these functions. Instead, you call them with a special `yield` operator, as if they were synchronous.

Galaxy gives you a simple API that lets you move between these two worlds. There are only two functions:

* `var generator = galaxy.star(asyncFn, cbIndex)`  
  This function converts a usual asynchronous function into a generator.
  `asyncFn` is the asynchronous function.
  `cbIndex` is the index of the callback parameter. It is optional. If omitted the callback is assumed to be the last parameter.

* `var asyncFn = galaxy.unstar(generator, cbIndex)`  
  This function converts in the other direction. It allows you to turn a generator into an asynchronous function.   
  `asyncFn` is the generator.  
  `cbIndex` is the index of the callback parameter. It is ptional. If omitted the callback is added at the end of the parameter list.

The first thing you have to do to work with galaxy is take the asynchronous functions that you are going to call and convert them to generators. 

For example if you need to call `fs.readdir` and `fs.readFile`, you write:

``` javascript
var galaxy = require('galaxy');
var fs = require('fs');
var readdirStar = galaxy.star(fs.readdir);
var readFileStar = galaxy.star(fs.readFile);
```

Now, you can write your own generator functions by calling `readdir` and `readFile` with `yield`. The cool part is that you don't need to worry about callbacks any more; you write your code as if the functions were synchronous.

For example, we can write a generator function that displays the number of lines in all the files of a directory as:

``` javascript
function* countLinesStar(path) {
	var names = yield readdirStar(path);
	var total = 0;
	for (var i = 0; i < names.length; i++) {
		var fullname = path + '/' + names[i];
		var count = yield (readFileStar(fullname, 'utf8')).split('\n').length;
		console.log(fullname + ': ' + count);
		total += count;
	}
	return total;
}
```

At this point you have created another generator function. You can continue coding in sync style. This is very easy: just write more generators. For example:

``` javascript
function* projectLineCountsStar() {
	var total = 0;
	total += yield countLinesStar(__dirname + '/../examples');
	total += yield countLinesStar(__dirname + '/../lib');
	total += yield countLinesStar(__dirname + '/../test');
	console.log('TOTAL: ' + total);
	return total;
}
```

This is all very nice and we can program very happily in the world of generator functions but how do we trigger the evaluation of these generators?

The answer is simple: just `unstar` them, and call them with a callback. For example:

``` javascript
var projectLineCountsCb = galaxy.unstar(projectLineCountsStar);

projectLineCountsCb(function(err, result) {
	if (err) throw err;
	console.log('CALLBACK RESULT: ' + result);
});
```

Kinda cool! But our `Star` functions are completely sequential. How do we parallelize?

Easy again: if you call the _unstarred_ function without passing a callback, you obtain a _future_. This future executes in parallel with other futures that you may create. And this future _is_ rturned as a generator. So you can yield on it.

So, for example, we can parallelize the `projectLineCount` operation by rewriting it as:

``` javascript
function* projectLineCountsParallelStar() {
 	var countLinesCb = galaxy.unstar(countLinesStar);
	var future1 = countLinesCb(__dirname + '/../examples');
	var future2 = countLinesCb(__dirname + '/../examples');
	var future3 = countLinesCb(__dirname + '/../examples');
	var total = (yield future1) + (yield future2) + (yield future3);
	console.log('TOTAL: ' + total);
	return total; 
}
```

Now you can call this parallel function as:

``` javascript
galaxy.unstar(projectLineCountsParallelStar)(function(err, result) {
	if (err) throw err;
	console.log('CALLBACK RESULT: ' + result);	
});
```

# Gotchas

Generators have been added very recently to V8. To use them you need to:

* Install node.js version 0.11.2 (unstable) or higher.
* Run node with the `--harmony` flag.

For example, to run the example above:

``` sh
$ node -v
v0.11.2
$ node --harmony examples/countLines

Also, this is just a first brew of the galaxy project and I did not have time to test much. So be ready for some bugs. But the foundation should be pretty solid.

# Installation

```
npm install galaxy
```

# More info

This design is strongly inspired from early designs related to the [streamline.js tool](https://github.com/Sage/streamlinejs):

* [an early experiment with generators](http://bjouhier.wordpress.com/2012/05/18/asynchronous-javascript-with-generators-an-experiment/).
* [futures = currying the callback](http://bjouhier.wordpress.com/2011/04/04/currying-the-callback-or-the-essence-of-futures/)

# License

This work is licensed under the [MIT license](http://en.wikipedia.org/wiki/MIT_License).

