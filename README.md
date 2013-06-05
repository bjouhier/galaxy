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

`galaxy.unstar` can also be applied to a whole module, in which case it _unstars_ all the functions of the module. This is handy if you have written a library with galaxy and you want to make it available to developers who write their code in callback style. Just create another module that exports the _unstarred_ version of your functions:

``` javascript
var galaxy = require('galaxy');
module.exports = galaxy.unstar(require('my-starred-functions'));
```

Together, `galaxy.star` and `galaxy.unstar` take care of all the ugly work to make `*/yield` behave like `async/await`.

## spin

Fine. But all the code that we have seen above is completely sequential. Would be nice if we could parallelize some calls.

This is actually not very difficult: instead of _yielding_ on a generator returned by a _starred_ function you can _spin_ on it. This runs the generator in parallel with your other code and it gives you back a future. The future that you obtain is just another _starred_ function on which you can _yield_ later to get the result of the computation.

So, for example, you can parallelize the `projectLineCounts` operation by rewriting it as:

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

Note: this is not true parallelism; the futures only move forwards when execution reaches `yield` keywords in your code.

## Exception Handling

The usual exception handling keywords (`try/catch/finally/throw`) work as you would expect them to.

If an exception is thrown during the excution of a future, it is thrown when you _yield_ on the future, not when you start it with `galaxy.spin`.

## Asynchronous constructor

Galaxy also lets you invoke constructors that contain asynchronous calls but this is one of the rare cases where you cannot just use the usual JavaScript keyword. Instead of the `new` keyword you use the special `galaxy.new` helper. Here is an example:

``` javascript
// asynchronous constructor
function* MyClass(name) {
	this.name = name;
	yield myAsyncFn();
}

// create an instance of MyClass
var myObj = (yield galaxy.new(MyClass)("obj1"));
console.log(myObj.name);
```

## Stable context

Global variables are evil. Everyone knows that!

But there are a few cases where they can be helpful. 
The main one is to track information about _who_ is executing the current request: security context, locale, etc. This kind of information is usually very stable (for a given request) and it would be very heavy to pass it explicitly down to all the low level APIs that need it. So the best way is to pass it implicitly through some kind of global context.

But you need a special global which is preserved across _yield_ points. If you set it at the beginning of a request it should remain the same throughout the request (unless you change it explicitly). It should not change under your feet because other requests with different contexts get interleaved.

Galaxy exposes a `context` property that is guaranteed to be stable across yield points. If you assign an object to `galaxy.context` at the beginning of a request, you can retrieve it later.

Note: this functionality is more or less equivalent to Thread Local Storage (TLS) in threaded systems.

Gotcha: the context will be preserved if you write your logic in async/await style with galaxy, but you have to be careful if you start mixing sync style and callback style in your source code. You may break the propagation.

## API

* `var genFn = galaxy.star(asyncFn, cbIndex)`  
  This function turns an asynchronous function into a generator function.  
  `asyncFn` is the asynchronous function.  
  `cbIndex` is the index of the callback parameter. It is optional. If omitted the callback is assumed to be the last parameter of `asyncFn`.

* `var asyncFn = galaxy.unstar(genFn, cbIndex)`  
  This function converts in the other direction. It allows you to turn a generator function into an asynchronous function.  
  `genFn` is the generator function.  
  `cbIndex` is the index of the callback parameter. It is optional. If omitted the callback is added at the end of the parameter list of `genFn`.

  As previously mentioned these calls may also be applied to a whole module, or to any object containing functions. 
  `Sync` calls are skipped.

* `var genFn = galaxy.spin(generator)`  
  Start spinning a generator that you obtained by calling a starred function (without yield).  
  The generator will execute in parallel with other code, at the points where the code yields.  
  The returned value is a generator function on which you can yield later to obtain the result of the computation.

* `var genCreate = galaxy.new(genConstructor)`  
  Converts a constructor generator function to a _creator_ function.  
  `genConstructor` is a _starred_ constructor that may contain `yield` calls.  
  The returned `genCreate` is a _starred_ function that you can call as `yield genCreate(args)`

* `galaxy.context = ctx`  
  `ctx = galaxy.context`  
  Sets and gets the stable context.

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

The yield keyword can be tricky because it has a very low precedence. For example you cannot write:

``` javascript
var sum1 = yield a() + yield b();
var sum2 = yield c() + 3;
```

because they get interpreted as:

``` javascript
var sum1 = yield (a() + yield b()); // compile error
var sum2 = yield (c() + 3); // galaxy gives runtime error
```

You have to write:

``` javascript
var sum = (yield a()) + (yield b());
var sum2 = (yield c()) + 3;
```

This brings a little lispish flavor to your JS code.


## More info

This design is strongly inspired from bits and pieces of [streamline.js](https://github.com/Sage/streamlinejs). The following blog articles are a bit old and not completely aligned on `galaxy` but they give a bit of background:

* [an early experiment with generators](http://bjouhier.wordpress.com/2012/05/18/asynchronous-javascript-with-generators-an-experiment/).
* [futures = currying the callback](http://bjouhier.wordpress.com/2011/04/04/currying-the-callback-or-the-essence-of-futures/)

## License

This work is licensed under the [MIT license](http://en.wikipedia.org/wiki/MIT_License).

