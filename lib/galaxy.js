/**
 * Copyright (c) 2011 Bruno Jouhier <bruno.jouhier@sage.com>
 * MIT License
 */

var resume;

function link(src, name, dst) {
	Object.defineProperty(src, name, {
		configurable: false,
		writable: false,
		enumerable: false,
		value: dst
	});
	return dst;
}

// glob is the hidden global in which we store the context.
// it must be unique, even if we have several versions of the galaxy module.
var glob = (function() {
	var gl = typeof global === "object" ? global : window;
	// share the secret with streamline's global module.
	var secret = "_20c7abceb95c4eb88b7ca1895b1170d1";
	return gl[secret] || link(gl, secret, {});
})();

function future(fn, args, i) {
	var err, result, done, q = [],
		self = this;
	args = Array.prototype.slice.call(args);
	args[i] = function(e, r) {
		err = e, result = r, done = true;
		q && q.forEach(function(f) {
			f.call(self, e, r);
		});
		q = null;
	};
	fn.apply(this, args);
	return function F(cb) {
		if (!cb) return F;
		if (done) cb.call(self, err, result);
		else q.push(cb);
	}
}


function isGenerator(val) {
	return Object.prototype.toString.call(val) === "[object Generator]";
}

var PENDING = {};

function run(g, cb) {
	var rsm = resume;
	glob.emitter && glob.emitter.emit("resume");
	try {
		resume = function(err, val) {
			while (g) {
				try {
					var v = err ? g.throw (err) : g.send(val);
					val = v.value;
					err = null;
					// if we get PENDING, the current call completed with a pending I/O
					// resume will be called again when the I/O completes. So just save the context and return here.
					if (val === PENDING) {
						return;
					}
					// if we get [PENDING, e, r], the current call invoked its callback synchronously
					// we just loop to send/throw what the callback gave us.
					if (val && val[0] === PENDING) {
						err = val[1];
						val = val[2];
					}
					// else, if g is done we unwind it we send val to the parent generator (or through cb if we are at the top)
					else if (v.done) {
						//g.close();
						g = g.prev;
					}
					// else if val is not a generator we have an error. Yield was not applied to a generators
					else if (!isGenerator(val)) {
						throw new Error("invalid value was yielded. Expected a generator, got " + val);
					} else {
						// else, we got a new generator which means that g called another generator function
						// the new generator become current and we loop with g.send(undefined) (equiv to g.next()) 
						val.prev = g;
						g = val;
						val = undefined;
					}
				} catch (ex) {
					// the send/throw call failed.
					// we unwind the current generator and we rethrow into the parent generator (or through cb if at the top)
					//g.close();
					g = g.prev;
					err = ex;
					val = undefined;
				}
			}
			// we have exhausted the stack of generators. 
			// return the result or error through the callback.
			cb(err, val);
		}

		// start the resume loop
		resume();
	} finally {
		// restore resume global
		resume = rsm;
		glob.emitter && glob.emitter.emit("yield");
	}
}

function invoke(that, fn, args, idx) {
	if (fn.__unstarred__) throw new Error("cannot invoke starred function: " + fn.__unstarred__);
	// Set things up so that call returns:
	// * PENDING if it completes with a pending I/O (and cb will be called later)
	// * [PENDING, e, r] if the callback is called synchronously.
	var result = PENDING,
		sync = true;
	//var cb = args[idx];
	var rsm = resume;

	// convert args to array so that args.length gets correctly set if idx is args.length
	args = Array.prototype.slice.call(args, 0);
	var cx = glob.context;
	args[idx] = function(e, r) {
		glob.context = cx;
		resume = rsm;
		if (sync) {
			result = [PENDING, e, r];
		} else {
			resume(e, r);
			//cb(e, r);
		}
	}
	fn.apply(that, args);
	sync = false;
	return result;
}

function convertAPI(converter, api, idx) {
	return Object.keys(api).reduce(function(result, key) {
		var fn = api[key];
		result[key] = (typeof fn === 'function' && !/Sync$/.test(fn.name)) ? converter(fn, idx) : fn;
		return result;
	}, {});
}

exports.star = function star(fn, idx) {
	if (typeof fn === 'object') return convertAPI(star, fn, idx);

	if (fn.__starred__) return fn.__starred__;

	if (idx == null) idx = fn.length - 1;

	var F = function*() {
		return (yield invoke(this, fn, arguments, idx));
	};
	link(F, '__unstarred__', fn);
	link(fn, '__starred__', F);
	return F;
}

exports.unstar = function unstar(fn, idx) {
	if (typeof fn === 'object') return convertAPI(unstar, fn, idx);

	if (fn.__unstarred__) return fn.__unstarred__;

	if (idx == null) idx = fn.length;

	var F = function() {
		var cb = arguments[idx];
		// preserve streamline future semantics in unstarred space.
		if (cb == null) return future(F, arguments, idx);

		var g = fn.apply(this, arguments);
		run.call(this, g, cb);
	};
	link(F, '__starred__', fn);
	link(fn, '__unstarred__', F);
	return F;
}

// TODO: simplify the future stuff
// The cb parameter is not documented. Probably better to have another call for it. 
exports.spin = function(g, cb) {
	if (!isGenerator(g)) throw new Error("Invalid spin call, expected a generator, got " + g);
	var that = this;
	if (!cb) return exports.star(future(function(cb) {
		run.call(that, g, cb);
	}, [], 0));
	run.call(that, g, cb);
}

// undocumented unstarredProto is set to true by streamline because prototype is on unstarred function in this case
exports.new = function(constructor, unstarredProto) {
	if (constructor.__new__) return constructor.__new__;

	var F = function*() {
		var that = Object.create((unstarredProto ? constructor.__unstarred__ : constructor).prototype);
		yield constructor.apply(that, arguments);
		return that;
	};
	link(constructor, '__new__', F);
	return F;
}

Object.defineProperty(exports, 'context', {
	set: function(val) {
		glob.context = val;
	},
	get: function() {
		return glob.context;
	}
});

// undocumented helper for streamline compat
exports.invoke = function* (that, fn, args, idx) {
	if (typeof fn !== 'function') {
		if (typeof that === 'function' && that.__starred__ && fn === 'call') {
			return that.__starred__.apply(args[0], args.slice(1));
		}
		fn = that[fn];
	}
	return yield exports.star(fn, idx).apply(that, args);
}
