Galaxy bridges the gap between node.js callback based APIs and EcmaScript 6 generators. It makes it easy to write node.js code in sync style thanks to ES6 generators.

## API

Programming with _galaxy_ is a bit like programming with two different worlds:

* The old world of asynchronous functions to which you pass _callbacks_. This is how most node.js APIs are designed. In this world you program in a callback-oriented async style.
* A new world of _generator functions_ that you declare as `function*` rather than `function`. You don't pass callbacks to these functions. Instead, you call them with tbe `yield` operator. In this new world you program in sync style.

Galaxy gives you a simple API that lets you move between these two worlds. There are only two functions in the `galaxy` module:

* `var genFn = galaxy.star(asyncFn, cbIndex)`  
  This function converts an asynchronous function into a generator function.  
  `asyncFn` is the asynchronous function.  
  `cbIndex` is the index of the callback parameter. It is optional. If omitted the callback is assumed to be the last parameter of `asyncFn`.

* `var asyncFn = galaxy.unstar(genFn, cbIndex)`  
  This function converts in the other direction. It allows you to turn a generator function into an asynchronous function.  
  `genFn` is the generator function.  
  `cbIndex` is the index of the callback parameter. It is optional. If omitted the callback is added at the end of the parameter list of `genFn`.

You can also pass a module rather than an individual function to these calls. In this case the functions will return a new module in which all the functions have been _starred/unstarred_ (skipping `Sync` call).

The naming is a bit spacey but should be easy to remember: the `star` function turns a `function` into a `function*`; it adds the star. The `unstar` function goes in the other direction; it removes the star.

## Quick walk through

The first thing you have to do is transform the asynchronous functions that you are going to call into generator functions. 

For example if you plan to call functions from the `fs` module, you can write:

``` javascript
var galaxy = require('galaxy');
var fsStar = galaxy.star(require('fs'));
```

Now, you can write your own generator functions that call `fsStar` functions. All these calls _must_ be prefixed by a `yield` keyword. The cool part is that you don't need to worry about callbacks any more; you write your code as if all the functions that you are calling are synchronous.

For example, you can write a function that displays the number of lines in all the files of a directory:

``` javascript
function* countLinesStar(path) {
	var names = yield fsStar.readdir(path);
	var total = 0;
	for (var i = 0; i < names.length; i++) {
		var fullname = path + '/' + names[i];
		var count = (yield fsStar.readFile(fullname, 'utf8')).split('\n').length;
		console.log(fullname + ': ' + count);
		total += count;
	}
	return total;
}
```

Here, you have just created a generator function called `countLinesStar`. You can now continue coding in sync style: just write more generator functions. For example:

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

This is all nice and you can now program happily with generator functions but there is at least one important question left: how do you run these generator functions?

The answer is simple: just `unstar` them, and call them with a callback. For example:

``` javascript
var projectLineCountsCb = galaxy.unstar(projectLineCountsStar);

projectLineCountsCb(function(err, result) {
	if (err) throw err;
	console.log('CALLBACK RESULT: ' + result);
});
```

If you have written a library in sync style with generator functions, you can also make it available to developers who prefer the callback style by creating a module that _unstars_ your API:

``` javascript
var galaxy = require('galaxy');
module.exports = galaxy.unstar(require('my-gen-functions'));
```

## Parallelizing

Kinda cool so far! But your generator functions are completely sequential. Would be nice to be able to parallelize them.

This is actually not very difficult: if you call _unstarred_ functions without a callback you obtain a _future_. This future executes in parallel with other futures that you have created. And this future is returned as a parameterless generator function. So you can _yield_ on it to get the result of the computation.

So, for example, you can parallelize the `projectLineCount` operation by rewriting it as:

``` javascript
function* projectLineCountsParallelStar() {
 	var countLinesCb = galaxy.unstar(countLinesStar);
 	var future1 = countLinesCb(__dirname + '/../examples');
 	var future2 = countLinesCb(__dirname + '/../lib');
	var future3 = countLinesCb(__dirname + '/../test');
 	var total = (yield future1()) + (yield future2()) + (yield future3());
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

## Installation

``` sh
$ npm install galaxy
```

Then you can try the examples:

``` sh
$ cd galaxy
$ node --harmony examples/countLines
... some output ...
$ node --harmony examples/countLinesParallel
... slightly different output  ...
```

## Gotchas

Generators have been added very recently to V8. To use them you need to:

* Install node.js version 0.11.2 (unstable) or higher.
* Run node with the `--harmony` flag.

For example, to run the example above:

``` sh
$ node -v
v0.11.2
$ node --harmony examples/countLines
```

Also, this is just a first brew of the galaxy project and I did not have time to test much. So be ready for some bugs. But the foundation should be pretty solid.

## More info

This design is strongly inspired from bits and pieces of [streamline.js](https://github.com/Sage/streamlinejs):

* [an early experiment with generators](http://bjouhier.wordpress.com/2012/05/18/asynchronous-javascript-with-generators-an-experiment/).
* [futures = currying the callback](http://bjouhier.wordpress.com/2011/04/04/currying-the-callback-or-the-essence-of-futures/)

## License

This work is licensed under the [MIT license](http://en.wikipedia.org/wiki/MIT_License).

