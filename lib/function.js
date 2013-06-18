(function() {
	NOT NEEDED!
	var VERSION = 1;

	if (Function.prototype.applyStar && Function.prototype.applyStar.version_ >= VERSION) return;
	/// 
	/// ## Function functions  
	/// 
	/// * `result = yield fn.applyStar(thisObj, args[, index])`  
	///   Helper to use `Function.prototype.apply` inside streamlined functions.  
	///   Equivalent to `result = fn.apply(thisObj, argsWith_)` where `argsWith_` is 
	///   a modified `args` in which the callback has been inserted at `index` 
	///   (at the end of the argument list if `index` is omitted or negative).
	delete Function.prototype.applyStar;
	Object.defineProperty(Function.prototype, 'applyStar', {
		configurable: true,
		writable: true,
		enumerable: false,
		value: function(callback, thisObj, args, index) {
			args = Array.prototype.slice.call(args, 0);
			args.splice(index != null && index >= 0 ? index : args.length, 0, callback);
			return this.apply(thisObj, args);
		}
	});
	Function.prototype.applyStar.version_ = VERSION;

})();
