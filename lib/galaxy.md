
# Main galaxy module

`var galaxy = require('galaxy');`  

* `var genFn = galaxy.star(asyncFn, cbIndex)`  
  This function turns an asynchronous function into a generator function.  
  `asyncFn` is the asynchronous function.  
  `cbIndex` is the index of the callback parameter. It is optional. 
  If omitted the callback is assumed to be the last parameter of `asyncFn`.
* `var asyncFn = galaxy.unstar(genFn, cbIndex)`  
  This function converts in the other direction. It allows you to turn a generator function into an asynchronous function.  
  `genFn` is the generator function.  
  `cbIndex` is the index of the callback parameter. It is optional. If omitted the callback is added at the end of the parameter list of `genFn`.

  As previously mentioned these calls may also be applied to a whole module, or to any object containing functions. 
  `Sync` calls are skipped.
* `var genFn = galaxy.spin(generator)`  
  Start spinning a generator that you obtained by calling a starred function (without yield).  
  The generator will execute in parallel with other code, at the points where the code yields.  
  The returned value is a generator function on which you can yield later to obtain the result of the computation.
* `var genCreate = galaxy.new(genConstructor)`  
  Converts a constructor generator function to a _creator_ function.  
  `genConstructor` is a _starred_ constructor that may contain `yield` calls.  
  The returned `genCreate` is a _starred_ function that you can call as `yield genCreate(args)`
* `galaxy.context = ctx`  
  `ctx = galaxy.context`  
  Sets and gets the stable context.
* `galaxy.main(function*() { ... })`  
  Wrapper for a main asynchronous script.  
  See the [tutorial](../tutorial/tutorial.md) for an example
