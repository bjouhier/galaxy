<blockquote>
Simple things should be simple. Complex things should be possible.
<br/><em>Alan Kay</em>
</blockquote>

## [Hello world!](tuto1-hello.js)

Let us start with galaxy's version of node's hello world:

```javascript
"use strict";
var galaxy = require('galaxy');
var streams = require('galaxy-streams');

var server = streams.createHttpServer(function *(request, response) {
	response.writeHead(200, {
		'Content-Type': 'text/plain; charset=utf8'
	});
	response.end("Hello world!");
});

galaxy.main(function *() {
	yield server.listen(1337);
	console.log('Server running at http://127.0.0.1:1337/');
});
```

To run it, save this source as `tuto1.js` and start it with:

```javascript
node --harmony tuto1
```

Now, point your browser to http://127.0.0.1:1337/. You should get a `"hello world"` message.

This code is very close to the original version. Just a few differences:

* The server is created with galaxy's `streams.createHttpServer` rather than with node's `http.createServer` call.
* The server callback is a `function*` rather than a `function`. This allows you to _yield_ on asynchronous calls inside the request handler.
* The `request` and `response` parameters are galaxy wrappers around node's request and response streams. These wrappers don't make a difference for now but they will make it easier to read and write from these streams later.
* `listen` is invoked with `yield. This is because `listen` is an asynchronous call. The galaxy version prints the `'Server running ...'` message after receiving the `listening` event, while the original node version prints the message without waiting for the `listening` event. This is a really minor difference though.

## [Setting up a simple search form](tuto2-form.js)

Now, we are going to be a bit more ambitious and turn our page into a simple search form:

```javascript
"use strict";
var streams = require('galaxy-streams');
var galaxy = require('galaxy');
var url = require('url');
var qs = require('querystring');

var begPage = '<html><head><title>My Search</title></head></body>' + //
'<form action="/">Search: ' + //
'<input name="q" value="{q}"/>' + //
'<input type="submit"/>' + //
'</form><hr/>';
var endPage = '<hr/>generated in {ms}ms</body></html>';

var server = streams.createHttpServer(function*(request, response) {
	var query = qs.parse(url.parse(request.url).query),
		t0 = new Date();
	response.writeHead(200, {
		'Content-Type': 'text/html; charset=utf8'
	});
	yield response.write(begPage.replace('{q}', query.q || ''));
	yield response.write(yield search(query.q));
	yield response.write(endPage.replace('{ms}', new Date() - t0));
	response.end();
});

function* search(q) {
	return "NIY: " + q;
}

galaxy.main(function *() {
	yield server.listen(1337);
	console.log('Server running at http://127.0.0.1:1337/');
});
```

Nothing difficult here. We are using node's `url` and `querystring` helper modules to parse the URL and its query string component. We are now writing the response in 3 chunks with the asynchronous `write` method of the wrapped response stream.

The `response.end()` does not need a yield because it is synchronous. Note that writing `null` or `undefined`,  for example with `yield response.write()` is equivalent to calling `response.end()`.

We are going to implement the `search` function next. For now we are just returning a `NIY` message. Note that our `search` function is a `function*`and that we are calling it with `yield`. We need this because `search` will soon become an asynchronous function.

## [Calling Google](tuto3-google.js)

Now we are going to implement the `search` function by passing our search string to Google. Here is the code:

```javascript
function* search(q) {
	if (!q || /^\s*$/.test(q)) return "Please enter a text to search";
	// pass it to Google
	var response = yield streams.httpRequest({
		url: 'http://ajax.googleapis.com/ajax/services/search/web?v=1.0&q=' + q,
		proxy: process.env.http_proxy
	}).end().response();
	var json = yield response.checkStatus(200).readAll();
	// parse JSON response
	var parsed = JSON.parse(json);
	// Google may refuse our request. Return the message then.
	if (!parsed.responseData) return "GOOGLE ERROR: " + parsed.responseDetails;
	// format result in HTML
	return '<ul>' + parsed.responseData.results.map(function(entry) {
		return '<li><a href="' + entry.url + '">' + entry.titleNoFormatting + '</a></li>';
	}).join('') + '</ul>';
}
```

`streams.httpRequest` is a small wrapper around node's `http.request` call. It allows us to obtain the response with a simple `yield request.response()` asynchronous call, and to read from this response with a simple asynchronous `yield reponse.readAll()` call (there is also an asynchronous `read` call which would let us read one chunk at a time, or read up to a given length). Notice how the calls can be naturally chained to obtain the response data.

In this example we do not need to post any data to the remote URL. But this would not be difficult either. It would just be a matter of calling asynchronous `yield request.write(data)` methods before calling the `end()` method.

## [Dealing with errors](tuto4-catch.js)

If our `search` function fails, an exception will be propagated. If we don't do anything special, the exception will bubble up to the request dispatcher created by `streams.createHttpServer(...)`. This dispatcher will catch it and generate a 500 response with the error message.

This is probably a bit rude to our users. But we can do a better job by trapping the error and injecting the error message into our HTML page. All we need is a `try/catch` inside our `search` function:

```javascript
function *search(q) {
	if (!q || /^\s*$/.test(q)) return "Please enter a text to search";
	// pass it to Google
	try {
		var response = yield streams.httpRequest({
			url: 'http://ajax.googleapis.com/ajax/services/search/web?v=1.0&q=' + q,
			proxy: process.env.http_proxy
		}).end().response();
		var json = yield response.checkStatus(200).readAll();
		// parse JSON response
		var parsed = JSON.parse(json);
		// Google may refuse our request. Return the message then.
		if (!parsed.responseData) return "GOOGLE ERROR: " + parsed.responseDetails;
		// format result in HTML
		return '<ul>' + parsed.responseData.results.map(function(entry) {
			return '<li><a href="' + entry.url + '">' + entry.titleNoFormatting + '</a></li>';
		}).join('') + '</ul>';
	} catch (ex) {
		return 'an error occured. Retry or contact the site admin: ' + ex.stack.replace(/\n/g, '<br/>');
	}
}
```

## [Searching through files](tuto5-files.js)

Now, we are going to extend our search to also search the text in local files. Our `search` function becomes:

```javascript
function* search(q) {
	if (!q || /^\s*$/.test(q)) return "Please enter a text to search";
	try {
		return '<h2>Web</h2>' + (yield googleSearch(q)) + '<hr/><h2>Files</h2>' + (yield fileSearch(q));
	} catch (ex) {
		return 'an error occured. Retry or contact the site admin: ' + ex.stack.replace(/\n/g, '<br/>');
	}
}

function* googleSearch(q) {
	var t0 = new Date();
	var json = streams.httpRequest(...
	...
	return '<ul>' + ...
}

function* fileSearch(q) {
	var t0 = new Date();
	var results = '';

	function* doDir(dir) {
		yield (yield fs.readdir(dir)).forEachStar(function*(file) {
			var f = dir + '/' + file;
			var stat = yield fs.stat(f);
			if (stat.isFile()) {
				(yield fs.readFile(f, 'utf8')).split('\n').forEach(function(line, i) {
					if (line.indexOf(q) >= 0) results += '<br/>' + f + ':' + i + ':' + line;
				});
			} else if (stat.isDirectory()) {
				yield doDir(f);
			}
		});
	}
	yield doDir(__dirname);
	return results + '<br/>completed in ' + (new Date() - t0) + ' ms';;
}
```

The `forEachStar` function is galaxy's asynchronous variant of the standard EcmaScript 5 `forEach` array function. It is needed here because the body of the loop contains asynchronous calls . Note that galaxy also provides asynchronous variants for the other ES5 array functions: `map`, `some`, `every`, `filter`, `reduce` and `reduceRight`.

Otherwise, there is not much to say about `fileSearch`. It uses a simple recursive directory traversal logic. 

## [Searching in MongoDB](tuto6-mongo.js)

Now, we are going to extend our search to a MongoDB database.

To run this you need to install MongoDB and start the `mongod` daemon. You also have to install the node MongoDB driver:

```sh
npm install mongodb
```

We have to modify our `search` function again:

```javascript
function* search(q) {
	if (!q || /^\s*$/.test(q)) return "Please enter a text to search";
	try {
		return '<h2>Web</h2>' + (yield googleSearch(q)) //
		+ '<hr/><h2>Files</h2>' + (yield fileSearch(q)) //
		+ '<hr/><h2>Mongo</h2>' + (yield mongoSearch(q));
	} catch (ex) {
		return 'an error occured. Retry or contact the site admin: ' + ex.stack.replace(/\n/g, '<br/>');
	}
}
```

Here comes `mongoSearch`:

``` javascript
var mongodb = require('mongodb');

function* mongoSearch(q) {
	var t0 = new Date();
	var db = new mongodb.Db('tutorial', new mongodb.Server("127.0.0.1", 27017, {}));
	yield star(db, 'open')();
	try {
		var coln = yield star(db, 'collection')('movies');
		if ((yield star(coln, 'count')()) === 0) yield star(coln, 'insert')(MOVIES);
		var re = new RegExp(".*" + q + ".*");
		var found = yield star(coln, 'find')({
			$or: [{
				title: re
			}, {
				director: re
			}]
		});
		return (yield star(found, 'toArray')()).map(function(movie) {
			return movie.title + ': ' + movie.director;
		}).join('<br/>') + '<br/>completed in ' + (new Date() - t0) + ' ms';
	} finally {
		db.close();
	}
}
```

where `MOVIES` is used to initialize our little movies database:

```javascript
var MOVIES = [{
	title: 'To be or not to be',
	director: 'Ernst Lubitsch'
}, {
	title: 'La Strada',
	director: 'Federico Fellini'
}, {
	...
}];
```

The tricky parts are the `star(db, 'open')`, `star(coln, 'count')`, etc. calls. These calls are necessary because the mongodb driver gives us callback based APIs and we have to _star_ them to be able to _yield_ on them. 

Notes: `star(db.open)()` would not work because `this` would be different from `db` inside the call. We would need `star(db.open).bind(db)()` instead. But `star(db, 'open')` does the job as well.

The rest of the `mongoSearch` function is rather straightforwards once you know the mongodb API. The `try/finally` is rather interesting: it guarantees that the database will be closed regardless of whether the `try` block completes successfully or throws an exception.

## [Parallelizing](tuto7-parallel.js)

So far so good. But the code that we have written executes completely sequentially. So we only start the directory search after having obtained the response from Google and we only start the Mongo search after having completed the directory search. This is very inefficient. We should run these 3 independent search operations in parallel.

This is where _futures_ come into play. The principle is simple: if you call an asynchronous function with `galaxy.spin` instead of `yield`, the function returns a _future_ `f` on which you can _yield_ later with `yield f()` to obtain the result.

So, to parallelize, we just need a small change to our `search` function:

```javascript
function* search(q) {
	if (!q || /^\s*$/.test(q)) return "Please enter a text to search";
	try {
		// start the 3 futures
		var googleFuture = galaxy.spin(googleSearch(q));
		var fileFuture = galaxy.spin(fileSearch(q));
		var mongoFuture = galaxy.spin(mongoSearch(q));
		// join the results
		return '<h2>Web</h2>' + (yield googleFuture()) //
		+ '<hr/><h2>Files</h2>' + (yield fileFuture()) //
		+ '<hr/><h2>Mongo</h2>' + (yield mongoFuture());
	} catch (ex) {
		return 'an error occured. Retry or contact the site admin: ' + ex.stack.replace(/\n/g, '<br/>');
	}
}
```

We can also go further and parallelize the directory traversal. This could be done with futures but there is a simpler way to do it: passing the number of parallel operations as first argument to the `forEachStar` call:

```javascript
	function* doDir(dir) {
		yield (yield fs.readdir(dir)).forEachStar(4, function*(file) {
			var f = dir + '/' + file;
			var stat = yield fs.stat(f);
			...
		});
	}
```

We could pass -1 instead of 4 to execute all iterations in parallel. But then we would have a risk of running out of file descriptors when traversing large trees. The best way to do it then is to pass -1 and use the `galaxy.funnel` function to limit concurrency in the low level function. Here is the modified function:

```javascript
function* fileSearch(q) {
	var t0 = new Date();
	var results = '';
	// allocate a funnel for 20 concurrent executions
	var filesFunnel = galaxy.funnel(20);

	function* doDir(dir) {
		yield (yield fs.readdir(dir)).forEachStar(-1, function*(file) {
			var f = dir + '/' + file;
			var stat = yield fs.stat(f);
			if (stat.isFile()) {
				yield filesFunnel(function*() {
					(yield fs.readFile(f, 'utf8')).split('\n').forEach(function(line, i) {
						if (line.indexOf(q) >= 0) results += '<br/>' + f + ':' + i + ':' + line;
					});
				});
			} else if (stat.isDirectory()) {
				yield doDir(f);
			}
		});
	}
	yield doDir(__dirname);
	return results + '<br/>completed in ' + (new Date() - t0) + ' ms';;
}
```

The `filesFunnel` function acts like a semaphore. It limits the number of concurrent entries in its inner function to 20. 

With this implementation, each call to `fileSearch` opens 20 files at most but we could still run out of file descriptors when lots of requests are handled concurrently. The fix is simple though: move the `filesFunnel` declaration one level up, above the declaration of `fileSearch`. And also bump the limit to 100 because this is now a global funnel:

```javascript
// allocate a funnel for 100 concurrent open files
var filesFunnel = galaxy.funnel(100);

function* fileSearch(q) {
	// same as above, without the filesFunnel var declaration
}
```

## Fixing race conditions

And, last but not least, there is a concurrency bug in this code! Let's fix it.

 The problem is in the code that initializes the movies collection in MongoDB:

``` javascript
	if ((yield star(coln, 'count')()) === 0) yield star(coln, 'insert')(MOVIES);
```

The problem is that the code _yields_ everywhere we have an `yield` in the code. So this code can get interrupted between the `yield star(coln, 'count')()` call and the `yield star(coln, 'insert')(MOVIES)` call. And we can get into the unfortunate situation where two requests or more will get a count of 0, which would lead to multiple insertions of the `MOVIES` list.

This is easy to fix, though. All we need is a little funnel to restrict access to this critical section:

```javascript
var mongodb = require('mongodb'),
	mongoFunnel = galaxy.funnel(1);

function* mongoSearch(q) {
	...
	yield star(db, 'open')();
	try {
		var coln = yield star(db, 'collection')('movies');
		yield mongoFunnel(function*() {
			if ((yield star(coln, 'count')()) === 0) yield star(coln, 'insert')(MOVIES);
		});
		var re = new RegExp(".*" + q + ".*");
		return ...
	} finally {
		db.close();
	}
}
```

## Wrapping up

In this tutorial we have done the following:

* [Create a simple web server](tuto1-hello.js)
* [Set up a little search form](tuto2-form.js)
* [Call a Google API to handle the search](tuto3-google.js) 
* [Handle errors](tuto4-catch.js) 
* [Search a tree of files](tuto5-files.js) 
* [Search inside MongoDB](tuto6-mongo.js) 
* [Parallelize and fix race conditions](tuto7-parallel.js)

This should give you a flavor of what _galaxy_ programming looks like. Don't forget to read the [README](../README.md).
