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

## Parallelizing

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

Galaxy also provides a `funnel` call that you can use to limit the level of parallelism on a given block of code. By setting the funnel's size to 1 you can set up critical sections. See the [galaxy API](https://github.com/bjouhier/galaxy/blob/master/lib/galaxy.md) for details.

## Array utilities

Galaxy provides async variants of the EcmaScript 5 array functions (`forEach`, `map`, `filter`, ...). These variants give you the choice between sequential and parallel execution when relevant.

See [API documentation](https://github.com/bjouhier/galaxy/blob/master/lib/array.md) for details.

## Exception Handling

The usual exception handling keywords (`try/catch/finally/throw`) work as you would expect them to.

If an exception is thrown during the excution of a future, it is thrown when you _yield_ on the future, not when you create it with `galaxy.spin`.

## Long stacktrace

Galaxy provides long stacktraces. Here is a typical stacktrace:

```
Error: getaddrinfo ENOTFOUND
    <<< yield stack >>>
    at googleSearch (/Users/bruno/dev/syracuse/node_modules/galaxy/tutorial/tuto6-mongo.js:43:11)
    at search (/Users/bruno/dev/syracuse/node_modules/galaxy/tutorial/tuto6-mongo.js:30:34)
    at  (/Users/bruno/dev/syracuse/node_modules/galaxy/tutorial/tuto6-mongo.js:22:29)
    <<< raw stack >>>
    at errnoException (dns.js:37:11)
    at Object.onanswer [as oncomplete] (dns.js:124:16)
```

The `<<< yield stack >>>` part is a stack which has been reconstructed by the galaxy library and which reflects the stack of `yield` calls in your code. 

The `<<< raw stack >>>` part gives you the low level callback stack that triggered the exception. It is usually a lot less helpful than the _yield_ stack because it does not give you much context about the error.

This feature requires that you install the [galaxy-stack](https://github.com/bjouhier/galaxy-stack) addon module:

```
npm install galaxy-stack
```

## Stable context

Global variables are evil. Everyone knows that!

But there are a few cases where they can be helpful. 
The main one is to track information about _who_ is executing the current request: security context, locale, etc. This kind of information is usually very stable (for a given request) and it would be very heavy to pass it explicitly down to all the low level APIs that need it. So the best way is to pass it implicitly through some kind of global context.

But you need a special global which is preserved across _yield_ points. If you set it at the beginning of a request it should remain the same throughout the request (unless you change it explicitly). It should not change under your feet because other requests with different contexts get interleaved.

Galaxy exposes a `context` property that is guaranteed to be stable across yield points. If you assign an object to `galaxy.context` at the beginning of a request, you can retrieve it later.

Note: this functionality is more or less equivalent to Thread Local Storage (TLS) in threaded systems.

## Odd callbacks

Galaxy is designed to work with functions that have the usual node.js callback signature: `callback(err, result)`. It also works with functions that return several results through their callback. In this case the results are returned as an array. For example:

``` javascript
var request = require('request');
// request.get calls its callback as callback(err, response, body)

var get = galaxy.star(request.get);
var r = yield get(url);
// the starred version returns [response, body]
console.log("status=" + r[0].statusCode);
console.log("body=" + r[1]);
```

On the other hand, galaxy cannot deal directly with functions that have an odd callback signature. The best example is `fs.exists` which does not have any error parameter in its callback. You need a special wrapper to deal with such calls:

```
// the wrapper
function existsWrapper(path, cb) {
	fs.exists(path, function(result) { cb(null, result); })
}

var exists = galaxy.star(existsWrapper);
var found = yield exists(__dirname + '/README.md');
```

## Interrupting a future

Futures can be made interruptible by passing an `interrupt` option to the `galaxy.spin` call:

```javascript
var fut = galaxy.spin(asyncFn(), {
	interrupt: function() {
		if (interruptRequested) return true;
	});

// somewhere else
// this yield will never return if fut is interrupted (see note below)
var result = yield fut();

```

Note: this feature is very experimental. It could be enhanced to throw an exception into the code which is yielding on the future but it is not clear whether this should bypass or not the catch/finally clauses that may be active on the future's stack.

## Streams

Galaxy works with [ez-streams](https://github.com/Sage/ez-streams), a simple streaming API for node.js.

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

## API

See [API.md](API.md)

See also the [tutorial](tutorial/tutorial.md) and the [examples](examples).

## Installation

``` sh
$ npm install galaxy
$ npm install galaxy-stack
```

`galaxy-stack` is an optional module that you should install to get long stacktraces.

Then you can try the examples:

``` sh
$ cd node_modules/galaxy
$ node --harmony examples/countLines
... some output ...
$ node --harmony examples/countLinesParallel
... slightly different output  ...
```

## Running in the browser

Galaxy also runs browser side but you need a recent browser like Firefox 31 or Google Chrome 39 that you can download from https://www.google.com/chrome.

You're all set and you can open the examples/hello-browser.html page to see Galaxy in action. Pretty boring demo but at least it works!

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

This design is strongly inspired from bits and pieces of [streamline.js](https://github.com/Sage/streamlinejs). The following blog articles (some a bit old) give background information on this design:

* [bringing async/await to life in JavaScript](http://bjouhier.wordpress.com/2013/06/01/bringing-asyncawait-to-life-in-javascript/)
* [an early experiment with generators](http://bjouhier.wordpress.com/2012/05/18/asynchronous-javascript-with-generators-an-experiment/).
* [futures = currying the callback](http://bjouhier.wordpress.com/2011/04/04/currying-the-callback-or-the-essence-of-futures/)
* [stream API: events or callbacks](http://bjouhier.wordpress.com/2012/07/04/node-js-stream-api-events-or-callbacks/)

The streamline.js tool has been adapted to generate `galaxy` code in `--generators` mode. So, you can also use streamline.js as a preprocessor to generate `galaxy` code.

## License

This work is licensed under the [MIT license](http://en.wikipedia.org/wiki/MIT_License).

