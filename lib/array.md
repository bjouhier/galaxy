
# Array functions  

These functions are asynchronous variants of the EcmaScript 5 Array functions.

Common Rules: 

These variants are postfixed by `Star`.  
Most of them have an optional `options` first parameter which controls the level of 
parallelism. This `options` parameter may be specified either as `{ parallel: par }` 
where `par` is an integer, or directly as a `par` integer value.  
The `par` values are interpreted as follows:

* If absent or equal to 1, execution is sequential.
* If > 1, at most `par` operations are parallelized.
* if 0, a default number of operations are parallelized. 
  This default is defined by `galaxy.funnel.defaultSize` (4 by default - see [galaxy](./galaxy.md) module).
* If < 0 or Infinity, operations are fully parallelized (no limit).

Functions:

* `yield array.forEachStar([options,] fn[, thisObj])`  
  `fn` is called as `yield fn(elt, i)`.
* `result = yield array.mapStar([options,] fn[, thisObj])`  
  `fn` is called as `yield fn(elt, i)`.
* `result = yield array.filterStar([options,] fn[, thisObj])`  
  `fn` is called as `yield fn(elt)`.
* `bool = yield array.everyStar([options,] fn[, thisObj])`  
  `fn` is called as `yield fn(elt)`.
* `bool = yield array.someStar([options,] fn[, thisObj])`  
  `fn` is called as `yield fn(elt)`.
* `result = yield array.reduceStar(fn, val[, thisObj])`  
  `fn` is called as `val = yield fn(val, elt, i, array)`.
* `result = yield array.reduceRightStar(fn, val[, thisObj])`  
  `fn` is called as `val = yield fn(val, elt, i, array)`.
* `array = yield array.sortStar(compare [, beg [, end]])`  
  `compare` is called as `cmp = yield compare(elt1, elt2)`.  
  Note: this function _changes_ the original array (and returns it).
