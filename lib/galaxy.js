"use strict";
/**
 * Copyright (c) 2013 Bruno Jouhier <bruno.jouhier@sage.com>
 * MIT License
 */
(function(exports) {
	/// !doc
	/// 
	/// # Main galaxy module
	/// 
	/// `var galaxy = require('galaxy');`  
	/// 

	function link(src, name, dst) {
		Object.defineProperty(src, name, {
			configurable: false,
			writable: true,
			enumerable: false,
			value: dst
		});
		return dst;
	}


	function makeArgs(i) {
		if (i <= 0) return "";
		return i > 1 ? makeArgs(i - 1) + ', a' + i : "a1";
	}

	// glob is the hidden global in which we store the context.
	// it must be unique, even if we have several versions of the galaxy module.
	var glob = (function() {
		var gl = typeof global === "object" ? global : window;
		// share the secret with streamline's global module.
		var secret = "_20c7abceb95c4eb88b7ca1895b1170d1";
		return gl[secret] || link(gl, secret, { context: {} });
	})();

	if (typeof glob.yielded === "undefined") glob.yielded = true;
	glob.PENDING = glob.PENDING || {};

	var stackHelper, stackHelperError;
	try {
		stackHelper = require('galaxy-stack');
	} catch (ex) {
		stackHelperError = ex.message;
	}

	function future(fn, args, i) {
		var err, result, done, q = [],
			self = this;
		args = Array.prototype.slice.call(args);
		args[i] = function(e, r) {
			//if (arguments.length > 2) r = Array.prototype.slice.call(arguments, 1);
			err = e, result = r, done = true;
			q && q.forEach(function(f) {
				f.call(self, e, r);
			});
			q = null;
		};
		fn.apply(this, args);
		return function F(cb) {
			if (typeof cb !== 'function') {
				if (cb !== false) throw new Error("invalid argument #0: you must pass _ or !_");
				return F;
			}
			if (done) cb.call(self, err, result);
			else q.push(cb);
		}
	}


	function isGenerator(val) {
		return Object.prototype.toString.call(val) === "[object Generator]";
	}

	function Frame(g) {
		this.g = g;
		this.prev = glob.frame;
		g.frame = this;
		this._info = null;
		this.recurse = 0;
		this.yielded = 0;
	}

	Object.defineProperty(Frame.prototype, "info", {
		get: function() {
			return this._info || stackHelper.getStackFrame(this.g); 
		}
	});

	Object.defineProperty(Frame.prototype, "name", {
		get: function() { return this.info.functionName; }
	});
	
	Object.defineProperty(Frame.prototype, "file", {
		get: function() { return this.info.scriptName; }
	});
	
	Object.defineProperty(Frame.prototype, "line", {
		get: function() { return this.info.lineNumber; }
	});
	
	function pushFrame(g) {
		glob.frame = g.frame = g.frame || new Frame(g);
		glob.emitter.emit('enter', g.frame);
	}

	function popFrame(g) {
		if (!glob.frame) return;
		glob.emitter.emit('exit', g.frame);
		glob.frame = glob.frame.prev;
	}

	function run(g, cb, options) {
		var rsm = glob.resume;
		var emit = glob.emitter && stackHelper && function(ev, g) {
			g.frame = g.frame || new Frame(g);
			glob.emitter.emit(ev, g.frame);
		}

		try {
			glob.resume = function(err, val) {
				if (emit && glob.yielded) {
					emit("resume", g);
					glob.yielded = false;
				}
				while (g) {
					if (options && options.interrupt && options.interrupt()) return;
					try {
						// ES6 is deprecating send in favor of next. Following line makes us compatible with both.
						var send = g.send || g.next;
						var v = err ? g.throw (err) : send.call(g, val);
						val = v.value;
						err = null;
						// if we get PENDING, the current call completed with a pending I/O
						// resume will be called again when the I/O completes. So just save the context and return here.
						if (val === glob.PENDING) {
							if (emit && !glob.yielded) {
								emit("yield", g);
								glob.yielded = true;
							}
							return;
						}
						// if we get [PENDING, e, r], the current call invoked its callback synchronously
						// we just loop to send/throw what the callback gave us.
						if (val && val[0] === glob.PENDING) {
							err = val[1];
							val = val[2];
							if (err) err = wrapError(err, g, glob.resume);
						}
						// else, if g is done we unwind it we send val to the parent generator (or through cb if we are at the top)
						else if (v.done) {
							//g.close();
							if (emit) popFrame(g);
							g = g.prev;
						}
						// else if val is not a generator we have an error. Yield was not applied to a generators
						else {
							if (!isGenerator(val)) {
								// but we accept an array of generators, and we parallelize in this case
								if (!Array.isArray(val)) throw new Error("invalid value was yielded. Expected a generator, got " + val);
								val = val.mapStar(-1, function*(elt) {
									if (!isGenerator(elt)) throw new Error("invalid array element was yielded. Expected a generator, got " + elt);
									return yield elt;
								});
							}
							// we got a new generator which means that g called another generator function
							// the new generator become current and we loop with g.send(undefined) (equiv to g.next()) 
							val.prev = g;
							g = val;
							if (emit) pushFrame(g);
							val = undefined;
						}
					} catch (ex) {
						// the send/throw call failed.
						// we unwind the current generator and we rethrow into the parent generator (or through cb if at the top)
						//g.close();
						err = wrapError(ex, g, glob.resume);
						if (emit) popFrame(g);
						g = g.prev;
						val = undefined;
					}
				}
				// we have exhausted the stack of generators. 
				// return the result or error through the callback.
				cb(err, val);
			}

			// start the resume loop
			glob.resume();
		} finally {
			// restore resume global
			glob.resume = rsm;
		}
	}

	function mapResults(options, args) {
		if (options && typeof options === "object") {
			if (options.returnArray) return args;
			if (options.returnObject) return options.returnObject.reduce(function(res, key, i) {
				res[key] = args[i];
				return res;
			}, {});
		}
		return args[0];
	}

	function getTag(options, idx) {
		if (options && typeof options === "object") {
			if (options.returnArray) return "A" + idx;
			if (options.returnObject) return "O" + options.returnObject.join('/') + idx;
		}
		return idx;
	}

	function invoke(that, fn, args, idx, options) {
		if (fn['__unstarred__' + idx]) throw new Error("cannot invoke starred function: " + fn['__unstarred__' + idx]);
		// Set things up so that call returns:
		// * PENDING if it completes with a pending I/O (and cb will be called later)
		// * [PENDING, e, r] if the callback is called synchronously.
		var result = glob.PENDING,
			sync = true;
		var rsm = glob.resume;

		// convert args to array so that args.length gets correctly set if idx is args.length
		args = Array.prototype.slice.call(args, 0);
		var cx = glob.context;
		args[idx == null ? args.length : idx] = function(e, r) {
			var oldContext = glob.context;
			var oldResume = glob.resume;
			try {
				if (options) r = mapResults(options, Array.prototype.slice.call(arguments, 1));
				glob.context = cx;
				glob.resume = rsm;
				if (sync) {
					result = [glob.PENDING, e, r];
				} else {
					glob.resume(e, r);
				}
			} finally {
				glob.context = oldContext;
				glob.resume = oldResume;
			}
		}
		fn.apply(that, args);
		sync = false;
		return result;
	}

	function convertAPI(converter, api, idx) {
		if (typeof idx === 'string') {
			var fn = api[idx];
			if (typeof fn !== 'function') throw new Error("not a function: " + idx);
			return converter(fn.bind(api));
		}
		return Object.keys(api).reduce(function(result, key) {
			var fn = api[key];
			result[key] = (typeof fn === 'function' && !/Sync$/.test(fn.name)) ? converter(fn, idx) : fn;
			return result;
		}, {});
	}

	/// 
	/// ## API wrappers
	/// 
	/// * `var genFn = galaxy.star(asyncFn, cbIndex)`  
	///   This function turns an asynchronous function into a generator function.  
	///   `asyncFn` is the asynchronous function.  
	///   `cbIndex` is the index of the callback parameter. It is optional. 
	///   If omitted the callback is assumed to be the last parameter of `asyncFn`.
	var starTemplate = function star(fn, options) {
		if (typeof fn === 'object') return convertAPI(exports.star, fn, options);

		var idx = (options && typeof options === 'object') ? options.callbackIndex : options; 
		var idx2 = idx < 0 ? -(idx + 1) : idx;
		var tag = getTag(options, idx);

		var key = '__starred__' + tag;
		if (fn[key]) return fn[key];

		//if (idx == null) idx = fn.length - 1;

		var F = function *() {
				if (idx < 0) Array.prototype.splice.call(arguments, idx2, 0, null);
				return (yield invoke(this, fn, arguments, idx2, options));
			};
		link(F, '__unstarred__' + tag, fn);
		link(fn, key, F);
		return F;
	}

	var starBody = starTemplate.toString();
	starBody = starBody.substring(starBody.indexOf('{'));
	var starrors = [];

	function makeStarror(i) {
		return eval("(function(fn, options)" + starBody.replace(/function\s*\*\s*\(\)/, "function*(" + makeArgs(i) + ")") + ")");
	}

	exports.star = function(fn, idx) {
		var i = fn.length;
		var starror = starrors[i] || (starrors[i] = makeStarror(i));
		return starror(fn, idx); 
	}

	/// * `var asyncFn = galaxy.unstar(genFn, cbIndex)`  
	///   This function converts in the other direction. It allows you to turn a generator function into an asynchronous function.  
	///   `genFn` is the generator function.  
	///   `cbIndex` is the index of the callback parameter. It is optional. If omitted the callback is added at the end of the parameter list of `genFn`.
	/// 
	///   As previously mentioned these calls may also be applied to a whole module, or to any object containing functions. 
	///   `Sync` calls are skipped.
	// entering is undocumented streamline parameter for future.
	var unstarTemplate = function unstar(fn, options, entering) {
		if (typeof fn === 'object') return convertAPI(exports.unstar, fn, options);

		var idx = (options && typeof options === 'object') ? options.callbackIndex : options; 
		if (idx == null) idx = fn.length;
		var idx2 = idx < 0 ? -(idx + 1) : idx;

		var key = '__unstarred__' + idx;
		if (fn[key]) return fn[key];

		var F = function() {
				var cb = arguments[idx2];
				if (idx < 0) Array.prototype.splice.call(arguments, idx2, 1);
				// preserve streamline future semantics in unstarred space.
				if (typeof cb !== 'function') {
					if (entering && !cb) cb = arguments[idx2] = function(err) { if (err) throw err; };
					return ((options && options.promise) || future).call(this, F, arguments, idx2);
				}
				var g = fn.apply(this, arguments);
				run.call(this, g, cb);
			};
		link(F, '__starred__' + idx, fn);
		link(fn, key, F);
		return F;
	}

	var unstarBody = unstarTemplate.toString();
	unstarBody = unstarBody.substring(unstarBody.indexOf('{'));
	var unstarrors = [];

	function makeUnstarror(i) {
		return eval("(function(fn, options, entering)" + unstarBody.replace(/function\s*\(\)/, "function(" + makeArgs(i) + ")") + ")");
	}

	exports.unstar = function(fn, idx, entering) {
		var i = idx == null ? fn.length + 1 : fn.length;
		var unstarror = unstarrors[i] || (unstarrors[i] = makeUnstarror(i));
		return unstarror(fn, idx, entering); 
	}


	/// 
	/// ## Parallelizing
	/// 
	/// * `var genFn = galaxy.spin(generator)`  
	///   Start spinning a generator that you obtained by calling a starred function (without yield).  
	///   The generator will execute in parallel with other code, at the points where the code yields.  
	///   The returned value is a generator function on which you can yield later to obtain the result of the computation.
	exports.spin = function(g, options) {
		if (!isGenerator(g)) throw new Error("Invalid spin call, expected a generator, got " + g);
		var that = this;
		// use starTemplate rather than galaxy.star because future has arity of 1 and we want arity of 0 
		return starTemplate(future(function(cb) {
			run.call(that, g, cb, options);
		}, [], 0), 0);
	}

	/// * `fun = galaxy.funnel(max)`  
	///   limits the number of concurrent executions of a given code block.
	///   
	///   The `funnel` function is typically used with the following pattern:
	///   
	///   ``` javascript
	///   // somewhere
	///   var myFunnel = galaxy.funnel(10); // create a funnel that only allows 10 concurrent executions.
	///   
	///   // elsewhere
	///   var result = yield myFunnel(function* () { /* code with at most 10 concurrent executions */ });
	///   ```
	///   
	///   The `funnel` function can also be used to implement critical sections. Just set funnel's `max` parameter to 1.
	///   
	///   If `max` is set to 0, a default number of parallel executions is allowed. 
	///   This default number can be read and set via `galaxy.funnel.defaultSize`.  
	///   If `max` is negative, the funnel does not limit the level of parallelism.
	///   
	///   The funnel can be closed with `fun.close()`.  
	///   When a funnel is closed, the operations that are still in the funnel will continue but their callbacks
	///   won't be called, and no other operation will enter the funnel.
	exports.funnel = function(max) {
		max = max == null ? -1 : max;
		if (max === 0) max = funnel.defaultSize;
		if (typeof max !== "number") throw new Error("bad max number: " + max);
		var queue = [],
			active = 0,
			closed = false;

		var fun = exports.star(function(fnStar, callback) {
			var fn = exports.unstar(fnStar);
			if (max < 0 || max == Infinity) return fn(callback);

			queue.push({
				fn: fn,
				cb: callback
			});

			function _doOne() {
				var current = queue.splice(0, 1)[0];
				if (!current.cb) return current.fn();
				active++;
				current.fn(function(err, result) {
					active--;
					if (!closed) {
						current.cb(err, result);
						while (active < max && queue.length > 0) _doOne();
					}
				});
			}

			while (active < max && queue.length > 0) _doOne();
		});
		fun.close = function() {
			queue = [], closed = true;
		}
		return fun;
	}

	exports.funnel.defaultSize = 4;

	/// 
	/// ## Stable context (TLS-like)
	/// 
	/// * `galaxy.context = ctx`  
	///   `ctx = galaxy.context`  
	///   Sets and gets the stable context.
	Object.defineProperty(exports, 'context', {
		set: function(val) {
			glob.context = val;
		},
		get: function() {
			return glob.context;
		}
	});

	/// 
	/// ## Miscellaneous
	/// 
	/// * `var genCreate = galaxy.new(genConstructor)`  
	///   Converts a constructor generator function to a _creator_ function.  
	///   `genConstructor` is a _starred_ constructor that may contain `yield` calls.  
	///   The returned `genCreate` is a _starred_ function that you can call as `yield genCreate(args)`

	// undocumented idx is set by streamline because prototype is on unstarred function in this case
	exports.new = function(constructor, idx) {
		var key = '__new__' + idx;
		if (constructor[key]) return constructor[key];

		var F = function *() {
				var that = Object.create((idx != null ? constructor['__unstarred__' + idx] : constructor).prototype);
				yield constructor.apply(that, arguments);
				return that;
			};
		link(constructor, key, F);
		return F;
	}

	// undocumented helper for streamline compat
	exports.invoke = function *(that, fn, args, options) {
		var idx = (options && typeof options === 'object') ? options.callbackIndex : options; 
		var tag = getTag(options, idx);
 		if (typeof fn !== 'function') {
			if (typeof that === 'function' && that['__starred__' + tag] && fn === 'call') {
				return yield that['__starred__' + tag].apply(args[0], args.slice(1));
			}
			fn = that[fn];
		}
		return yield exports.star(fn, options).apply(that, args);
	}

	function wrapError(err, g, resume) {
		if (!(err instanceof Error)) return err; // handle throw "some string";
		if (err.__async__ && err.__async__.resume === resume) return err;
		var continuations = [];
		g = g.prev; // first frame will be in err.stack
		if (stackHelper) {
			for (var gg = g; gg; gg = gg.prev) {
				continuations.push(stackHelper.getContinuation(gg));
			}
		}
		err = Object.create(err);
		Object.defineProperty(err, 'stack', {
			get: function() {
				return stackTrace(this);
			}
		});
		link(err, "__async__", {
			continuations: continuations,
			generator: g,
			resume: resume,
		});
		return err;
	}

	function stackTrace(err) {
		var extra;
		var starredStack = "";
		while (extra = err.__async__) {
			if (stackHelper) {
				var frames = [];
				for (var g = extra.generator; g; g = g.prev) {
					var frame = stackHelper.getStackFrame(g, extra.continuations[frames.length]);
					frames.push(frame);
				}
				starredStack = frames.filter(function(frame){
					return !(frame.functionName === "exports.invoke" && /\/galaxy\/lib\/galaxy/.test(frame.scriptName));
				}).map(function(frame) {
					return '  at ' + frame.functionName + ' (' + frame.scriptName + ':' + frame.lineNumber + ':' + frame.column + ')';
				}).join('\n') + '\n' + starredStack;
			}
			err = Object.getPrototypeOf(err);
		}
		if (!stackHelper) starredStack = '  UNAVAILABLE: ' + stackHelperError + '\n';

		var rawStack = err.stack;
		var cut = rawStack.indexOf('  at GeneratorFunctionPrototype');
		if (cut < 0) cut = rawStack.indexOf('\n') + 1;
		var result = rawStack.substring(0, cut) + //
		'  <<< yield stack >>>\n' + starredStack + //
		'  <<< raw stack >>>\n' + rawStack.substring(cut);
		return result;
	}

	/// * `galaxy.main(function*() { ... })`  
	///   Wrapper for a main asynchronous script.  
	///   See the [tutorial](../tutorial/tutorial.md) for an example
	exports.main = function(fn) {
		var that = this;
		exports.unstar(function*() {
			yield fn.call(that);
		})(function(err) {
			if (err) throw err;
		});		
	}
})(typeof exports !== 'undefined' ? exports : (window.galaxy = window.galaxy || {}));