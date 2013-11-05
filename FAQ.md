### It doesn't work. All I'm getting is SyntaxError: Unexpected token *

Generators are a new feature of node.js and are not enabled by default. Check that:
* you are running node.js >= 0.11.2 (`node -v`)
* you passed the `--harmony` flag to `node`
