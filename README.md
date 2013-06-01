Galaxy brings `async/await` semantics to JavaScript with a minimal API, thanks to EcmaScript 6 generators.

## async/await in JavaScript

Galaxy lets you write async code as if JavaScript had [`async/await` keywords](http://msdn.microsoft.com/en-us/library/vstudio/hh191443.aspx).

For example, here is how you would write an async function that counts lines in a file:

``` javascript
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
```

Just think of the `*` in `function*` as an `async` keyword and of `yield` as an `await` keyword.

You can write another async function that calls `countLines`:

``` javascript
function* projectLineCounts() {
	var total = 0;
	total += yield countLines(__dirname + '/../examples');
	total += yield countLines(__dirname + '/../lib');
	total += yield countLines(__dirname + '/../test');
	console.log('TOTAL: ' + total);
	return total;
}
```

Note: don't forget to prefix all the async calls with a `yield`. Otherwise you will be adding _generator_ objects to `total` and you'll just get a `NaN`.

Cool! But where does galaxy come into play? This is just plain JavaScript (with ES6 generators) and there are no calls to any `galaxy` API. Pretty mysterious!

That's the whole point behind galaxy: you hardly see it. It lets you write async functions that call other async functions with `function*` and `yield`. There are no extra API calls. Exactly like you would write your code if the language had `async/await` keywords.

## star/unstar

The magic happens in two places: when you call node.js async functions, and when node.js calls your async functions.

The node.js functions that we called in the example functions are `fs.readdir` and `fs.readFile`. Part of the magic is that `fs` is not your usual `require('fs')`. It is initialized as:

``` javascript
var galaxy = require('galaxy');
var fs = galaxy.star(require('fs'));
```

The `galaxy.star` call returns a module in which all the asynchronous functions have been _starred_, i.e. promoted from `function` to `function*`. When you call these functions with `yield` you get `await` semantics.

Note that `galaxy.star` can also be applied to individual functions. So, instead of _starring_ the entire `fs` module, we could have starred individual functions:

``` javascript
var galaxy = require('galaxy');
var fs = require('fs');
var readdir = galaxy.star(fs.readdir);
var readFile = galaxy.star(fs.readFile);
```

---

The other side of the magic happens when node.js calls your `function*` APIs. In our example, this happens when we call `projectLineCounts`, our main function. Here is the code:

``` javascript
var projectLineCountsCb = galaxy.unstar(projectLineCounts);

projectLineCountsCb(function(err, result) {
	if (err) throw err;
	console.log('CALLBACK RESULT: ' + result);
});
```

The `galaxy.unstar` call converts our `function*` into a regular node.js `function` that we then call with a callback.

`galaxy.unstar` can also be applied to a whole module, in which case it _unstars_ all the functions of the module. This is handy if you have written a library with galaxy and you want to make it available to developers who write their code in callback style. Just create another module that exports the _unstarred_ version of the functions:

``` javascript
var galaxy = require('galaxy');
module.exports = galaxy.unstar(require('my-starred-functions'));
```

Together, `galaxy.star` and `galaxy.unstar` take care of all the ugly work to make `*/yield` behave like `async/await`.

## spin

Fine. But all the code that we have seen above is completely sequential. Would be nice if we could parallelize some calls.

This is actually not very difficult: instead of yielding on a generator returned by a _starred_ function you can _spin_ on it. This gives you another _starred_ function on which you can yield later to get the result of the computation.

So, for example, you can parallelize the `projectLineCount` operation by rewriting it as:

``` javascript
function* projectLineCountsParallel() {
 	var future1 = galaxy.spin(countLines(__dirname + '/../examples'));
 	var future2 = galaxy.spin(countLines(__dirname + '/../lib'));
	var future3 = galaxy.spin(countLines(__dirname + '/../test'));
 	var total = (yield future1()) + (yield future2()) + (yield future3());
	console.log('TOTAL: ' + total);
	return total; 
}
```

## API

* `var genFn = galaxy.star(asyncFn, cbIndex)`  
  This function turns an asynchronous function into a generator function.  
  `asyncFn` is the asynchronous function.  
  `cbIndex` is the index of the callback parameter. It is optional. If omitted the callback is assumed to be the last parameter of `asyncFn`.

* `var asyncFn = galaxy.unstar(genFn, cbIndex)`  
  This function converts in the other direction. It allows you to turn a generator function into an asynchronous function.  
  `genFn` is the generator function.  
  `cbIndex` is the index of the callback parameter. It is optional. If omitted the callback is added at the end of the parameter list of `genFn`.

As previously mentioned these calls may also be applied to a whole module, or to any object containing functions. `Sync` calls are skipped.

* `var genFn = galaxy.spin(generator)`  
  Start spinning a generator that you obtained by calling a starred function (without yield).  
  The generator will execute in parallel with other code, at the points where the code yields.  
  The returned value is a generator function on which you can yield later to obtain the result of the computation.

## Installation

``` sh
$ npm install galaxy
```

Then you can try the examples:

``` sh
$ cd node_modules/galaxy
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

This design is strongly inspired from bits and pieces of [streamline.js](https://github.com/Sage/streamlinejs). The following blog articles are a bit old and not completely aligned on `galaxy` but they give a bit of background:

* [an early experiment with generators](http://bjouhier.wordpress.com/2012/05/18/asynchronous-javascript-with-generators-an-experiment/).
* [futures = currying the callback](http://bjouhier.wordpress.com/2011/04/04/currying-the-callback-or-the-essence-of-futures/)

## License

This work is licensed under the [MIT license](http://en.wikipedia.org/wiki/MIT_License).

