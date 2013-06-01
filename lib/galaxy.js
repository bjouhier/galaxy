/**
 * Copyright (c) 2011 Bruno Jouhier <bruno.jouhier@sage.com>
 * MIT License
 */

var resume;

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
	}
}

function invoke(that, fn, args, idx) {
	// Set things up so that call returns:
	// * PENDING if it completes with a pending I/O (and cb will be called later)
	// * [PENDING, e, r] if the callback is called synchronously.
	var result = PENDING,
		sync = true;
	//var cb = args[idx];
	var rsm = resume;

	// convert args to array so that args.length gets correctly set if idx is args.length
	args = Array.prototype.slice.call(args, 0);
	args[idx] = function(e, r) {
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

	if (fn.starred) return fn.starred;

	if (idx == null) idx = fn.length - 1;

	function *F() {
		return (yield invoke(this, fn, arguments, idx));
	};
	// Memoize the original function for fast passing later
	F.unstarred = fn;
	return F;
}

exports.unstar = function unstar(fn, idx) {
	if (typeof fn === 'object') return convertAPI(unstar, fn, idx);

	if (fn.unstarred) return fn.unstarred;

	if (idx == null) idx = fn.length;

	function F() {
		var cb = arguments[idx];
		var g = fn.apply(this, arguments);
		run.call(this, g, cb);
	};
	F.starred = fn;
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