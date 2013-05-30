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

function run(fn, args, idx) {
	var cb = args[idx],
		g;

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
				// else, if g yielded a value which is not a generator, g is done. 
				// so we unwind it we send val to the parent generator (or through cb if we are at the top)
				else if (!isGenerator(val)) {
					if (!v.done) throw new Error("invalid yield inside async function")
					//g.close();
					g = g.prev;
				}
				// else, we got a new generator which means that g called another generator function
				// the new generator become current and we loop with g.send(undefined) (equiv to g.next()) 
				else {
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

	// call fn to get the initial generator
	g = fn.apply(this, args);
	// start the resume loop
	resume();
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

function starAPI(api, idx) {
	return Object.keys(api).reduce(function(result, key) {
		var fn = api[key];
		result[key] = (typeof fn === 'function' && !/Sync$/.test(fn.name)) ? exports.star(fn, idx) : fn;
		return result;
	}, {});
}

exports.star = function(fn, idx) {
	if (typeof fn === 'object') return starAPI(fn, idx);

	if (fn.starred) return fn;

	if (idx == null) idx = fn.length - 1;

	function *F() {
		return (yield invoke(this, fn, arguments, idx));
	};
	// Memoize the original function for fast passing later
	F.unstarred = fn;
	return F;
}

exports.unstar = function(fn, idx) {
	if (idx == null) idx = fn.length;

	function F() {
		if (arguments[idx] == null) return future(fn, arguments, idx);
		// If we're calling a function that we have starred we can just call it directly instead
		// Do it after checking future to ensure that all unstarred function support futures.
		if (fn.unstarred) return fn.unstarred.apply(this, args);
		// else run it
		run.call(this, fn, arguments, idx);
	};
	F.starred = fn;
	return F;
}