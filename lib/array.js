"use strict";
/**
 * Copyright (c) 2013 Bruno Jouhier <bruno.jouhier@sage.com>
 * MIT License
 */
(function(galaxy) {
	var VERSION = 1;

	if (Array.prototype.forEachStar && Array.prototype.forEachStar.version_ >= VERSION) return;

	// bail out (silently) if JS does not support defineProperty (IE 8).
	try {
		Object.defineProperty({}, 'x', {})
	} catch (e) {
		return;
	}

	var funnel = galaxy.funnel;

	function _parallel(options) {
		if (typeof options === "number") return options;
		if (typeof options.parallel === "number") return options.parallel;
		return options.parallel ? -1 : 1;
	}

	var has = Object.prototype.hasOwnProperty;

	/// !doc
	/// 
	/// # Array functions  
	/// 
	/// These functions are asynchronous variants of the EcmaScript 5 Array functions.
	/// 
	/// Common Rules: 
	/// 
	/// These variants are postfixed by `Star`.  
	/// Most of them have an optional `options` first parameter which controls the level of 
	/// parallelism. This `options` parameter may be specified either as `{ parallel: par }` 
	/// where `par` is an integer, or directly as a `par` integer value.  
	/// The `par` values are interpreted as follows:
	/// 
	/// * If absent or equal to 1, execution is sequential.
	/// * If > 1, at most `par` operations are parallelized.
	/// * if 0, a default number of operations are parallelized. 
	///   This default is defined by `galaxy.funnel.defaultSize` (4 by default - see [galaxy](./galaxy.md) module).
	/// * If < 0 or Infinity, operations are fully parallelized (no limit).
	/// 
	/// Functions:
	/// 
	/// * `yield array.forEachStar([options,] fn[, thisObj])`  
	///   `fn` is called as `yield fn(elt, i)`.
	delete Array.prototype.forEachStar;
	Object.defineProperty(Array.prototype, 'forEachStar', {
		configurable: true,
		writable: true,
		enumerable: false,
		value: function*(options, fn, thisObj) {
			if (typeof options === "function") thisObj = fn, fn = options, options = 1;
			var par = _parallel(options);
			thisObj = thisObj !== undefined ? thisObj : this;
			var len = this.length;
			if (par === 1 || len <= 1) {
				for (var i = 0; i < len; i++) {
					if (has.call(this, i)) yield fn.call(thisObj, this[i], i);
				}
			} else {
				yield this.mapStar(par, fn, thisObj);
			}
			return this;
		}
	})
	Array.prototype.forEachStar.version_ = VERSION;
	/// * `result = yield array.mapStar([options,] fn[, thisObj])`  
	///   `fn` is called as `yield fn(elt, i)`.
	delete Array.prototype.mapStar;
	Object.defineProperty(Array.prototype, 'mapStar', {
		configurable: true,
		writable: true,
		enumerable: false,
		value: function*(options, fn, thisObj) {
			if (typeof options === "function") thisObj = fn, fn = options, options = 1;
			var par = _parallel(options);
			thisObj = thisObj !== undefined ? thisObj : this;
			var len = this.length;
			var result;
			if (par === 1 || len <= 1) {
				result = new Array(len);
				for (var i = 0; i < len; i++) {
					if (has.call(this, i)) result[i] = yield fn.call(thisObj, this[i], i);
				}
			} else {
				var fun = funnel(par);
				result = this.map(function(elt, i) {
					return galaxy.spin(fun(function*() {
						return yield fn.call(thisObj, elt, i);
					}));
				});
				for (var i = 0; i < len; i++) {
					if (has.call(this, i)) result[i] = yield result[i]();
				}
			}
			return result;
		}
	});
	/// * `result = yield array.filterStar([options,] fn[, thisObj])`  
	///   `fn` is called as `yield fn(elt)`.
	delete Array.prototype.filterStar;
	Object.defineProperty(Array.prototype, 'filterStar', {
		configurable: true,
		writable: true,
		enumerable: false,
		value: function*(options, fn, thisObj) {
			if (typeof options === "function") thisObj = fn, fn = options, options = 1;
			var par = _parallel(options);
			thisObj = thisObj !== undefined ? thisObj : this;
			var result = [];
			var len = this.length;
			if (par === 1 || len <= 1) {
				for (var i = 0; i < len; i++) {
					if (has.call(this, i)) {
						var elt = this[i];
						if (yield fn.call(thisObj, elt)) result.push(elt);
					}
				}
			} else {
				yield this.mapStar(par, function*(elt) {
					if (yield fn.call(thisObj, elt)) result.push(elt)
				}, thisObj);
			}
			return result;
		}
	});
	/// * `bool = yield array.everyStar([options,] fn[, thisObj])`  
	///   `fn` is called as `yield fn(elt)`.
	delete Array.prototype.everyStar;
	Object.defineProperty(Array.prototype, 'everyStar', {
		configurable: true,
		writable: true,
		enumerable: false,
		value: function*(options, fn, thisObj) {
			if (typeof options === "function") thisObj = fn, fn = options, options = 1;
			var par = _parallel(options);
			thisObj = thisObj !== undefined ? thisObj : this;
			var len = this.length;
			if (par === 1 || len <= 1) {
				for (var i = 0; i < len; i++) {

					if (has.call(this, i) && !(yield fn.call(thisObj, this[i]))) return false;
				}
			} else {
				var fun = funnel(par);
				var futures = this.map(function(elt) {
					return galaxy.spin(fun(function*() {
						return yield fn.call(thisObj, elt);
					}));
				});
				for (var i = 0; i < len; i++) {
					if (has.call(this, i) && !(yield futures[i]())) {
						fun.close();
						return false;
					}
				}
			}
			return true;
		}
	});
	/// * `bool = yield array.someStar([options,] fn[, thisObj])`  
	///   `fn` is called as `yield fn(elt)`.
	delete Array.prototype.someStar;
	Object.defineProperty(Array.prototype, 'someStar', {
		configurable: true,
		writable: true,
		enumerable: false,
		value: function*(options, fn, thisObj) {
			if (typeof options === "function") thisObj = fn, fn = options, options = 1;
			var par = _parallel(options);
			thisObj = thisObj !== undefined ? thisObj : this;
			var len = this.length;
			if (par === 1 || len <= 1) {
				for (var i = 0; i < len; i++) {
					if (has.call(this, i) && (yield fn.call(thisObj, this[i]))) return true;
				}
			} else {
				var fun = funnel(par);
				var futures = this.map(function(elt) {
					return galaxy.spin(fun(function*() {
						return yield fn.call(thisObj, elt);
					}));
				});
				for (var i = 0; i < len; i++) {
					if (has.call(this, i) && (yield futures[i]())) {
						fun.close();
						return true;
					}
				}
			}
			return false;
		}
	});
	/// * `result = yield array.reduceStar(fn, val[, thisObj])`  
	///   `fn` is called as `val = yield fn(val, elt, i, array)`.
	delete Array.prototype.reduceStar;
	Object.defineProperty(Array.prototype, 'reduceStar', {
		configurable: true,
		writable: true,
		enumerable: false,
		value: function*(fn, v, thisObj) {
			thisObj = thisObj !== undefined ? thisObj : this;
			var len = this.length;
			for (var i = 0; i < len; i++) {
				if (has.call(this, i)) v = yield fn.call(thisObj, v, this[i], i, this);
			}
			return v;
		}
	});
	/// * `result = yield array.reduceRightStar(fn, val[, thisObj])`  
	///   `fn` is called as `val = yield fn(val, elt, i, array)`.
	delete Array.prototype.reduceRightStar;
	Object.defineProperty(Array.prototype, 'reduceRightStar', {
		configurable: true,
		writable: true,
		enumerable: false,
		value: function*(fn, v, thisObj) {
			thisObj = thisObj !== undefined ? thisObj : this;
			var len = this.length;
			for (var i = len - 1; i >= 0; i--) {
				if (has.call(this, i)) v = yield fn.call(thisObj, v, this[i], i, this);
			}
			return v;
		}
	});

	/// * `array = yield array.sortStar(compare [, beg [, end]])`  
	///   `compare` is called as `cmp = yield compare(elt1, elt2)`.  
	///   Note: this function _changes_ the original array (and returns it).
	delete Array.prototype.sortStar;
	Object.defineProperty(Array.prototype, 'sortStar', {
		configurable: true,
		writable: true,
		enumerable: false,
		value: function*(compare, beg, end) {
			var array = this;
			beg = beg || 0;
			end = end == null ? array.length - 1 : end;

			function* _qsort(beg, end) {
				if (beg >= end) return;

				if (end == beg + 1) {
					if ((yield compare(array[beg], array[end])) > 0) {
						var tmp = array[beg];
						array[beg] = array[end];
						array[end] = tmp;
					}
					return;
				}

				var mid = Math.floor((beg + end) / 2);
				var o = array[mid];
				var nbeg = beg;
				var nend = end;

				while (nbeg <= nend) {
					while (nbeg < end && (yield compare(array[nbeg], o)) < 0) nbeg++;
					while (beg < nend && (yield compare(o, array[nend])) < 0) nend--;

					if (nbeg <= nend) {
						var tmp = array[nbeg];
						array[nbeg] = array[nend];
						array[nend] = tmp;
						nbeg++;
						nend--;
					}
				}

				if (nbeg < end) yield _qsort(nbeg, end);
				if (beg < nend) yield _qsort(beg, nend);
			}
			yield _qsort(beg, end);
			return array;
		}
	});
})(typeof exports !== 'undefined' ? require('./galaxy') : (window.galaxy = window.galaxy || {}));