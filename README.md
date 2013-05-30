Galaxy bridges the gap between node.js callback based APIs and EcmaScript 6 generators. It makes it easy to write node.js code in sync style thanks to ES6 generators.





# API

`var galaxy = require('galaxy')`

* `var generator = galaxy.star(asyncFn, cbIndex)`  
  Converts an asynchronous function to a generator  
  `asyncFn`: asynchonous function with a standard node.js callback
  `cbIndex`: index of the callback parameter. Optional. If omitted the callback is assumed to be the last parameter

* `var asyncFn = galaxy.unstar(generator, cbIndex)`  
  Converts a generator to an asynchronous function  
  `asyncFn`: a generator
  `cbIndex`: index of the callback parameter. Optional. If omitted the callback is appended to the parameter list



# Installation

```
npm install galaxy
```

# Hello World

``` javascript
```

# Resources

The implementation is inspired from [this early experiment with generators](http://bjouhier.wordpress.com/2012/05/18/asynchronous-javascript-with-generators-an-experiment/).

# License

This work is licensed under the [MIT license](http://en.wikipedia.org/wiki/MIT_License).

