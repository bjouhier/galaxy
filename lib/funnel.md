
# Semaphore utility

* `fun = galaxy.funnel(max)`  
  limits the number of concurrent executions of a given code block.

The `funnel` function is typically used with the following pattern:

``` javascript
// somewhere
var myFunnel = galaxy.funnel(10); // create a funnel that only allows 10 concurrent executions.

// elsewhere
var result = yield myFunnel(function* () { /* code with at most 10 concurrent executions */ });
```

The `funnel` function can also be used to implement critical sections. Just set funnel's `max` parameter to 1.

If `max` is set to 0, a default number of parallel executions is allowed. 
This default number can be read and set via `galaxy.funnel.defaultSize`.  
If `max` is negative, the funnel does not limit the level of parallelism.

The funnel can be closed with `fun.close()`.  
When a funnel is closed, the operations that are still in the funnel will continue but their callbacks
won't be called, and no other operation will enter the funnel.
