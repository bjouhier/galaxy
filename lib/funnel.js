"use strict";

(function(galaxy) {
	/// !doc
	/// 
	/// # Semaphore utility
	/// 
	/// * `fun = galaxy.funnel(max)`  
	///   limits the number of concurrent executions of a given code block.
	/// 
	/// The `funnel` function is typically used with the following pattern:
	/// 
	/// ``` javascript
	/// // somewhere
	/// var myFunnel = galaxy.funnel(10); // create a funnel that only allows 10 concurrent executions.
	/// 
	/// // elsewhere
	/// var result = yield myFunnel(function* () { /* code with at most 10 concurrent executions */ });
	/// ```
	/// 
	/// The `funnel` function can also be used to implement critical sections. Just set funnel's `max` parameter to 1.
	/// 
	/// If `max` is set to 0, a default number of parallel executions is allowed. 
	/// This default number can be read and set via `galaxy.funnel.defaultSize`.  
	/// If `max` is negative, the funnel does not limit the level of parallelism.
	/// 
	/// The funnel can be closed with `fun.close()`.  
	/// When a funnel is closed, the operations that are still in the funnel will continue but their callbacks
	/// won't be called, and no other operation will enter the funnel.
	galaxy.funnel = function(max) {
		max = max == null ? -1 : max;
		if (max === 0) max = funnel.defaultSize;
		if (typeof max !== "number") throw new Error("bad max number: " + max);
		var queue = [],
			active = 0,
			closed = false;

		var fun = galaxy.star(function(fnStar, callback) {
			var fn = galaxy.unstar(fnStar);
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

	galaxy.funnel.defaultSize = 4;
})(typeof exports !== 'undefined' ? require('./galaxy') : (window.galaxy = window.galaxy || {}));