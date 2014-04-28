"use strict";
QUnit.module(module.id);
// These unit tests are borrowed from streamline.js
// They are a bit heavy because they test all sorts of variants of basic language constructs (loops, switch, etc.)
// This comes from streamline where it was important to test the transformation patterns for every contruct.
// We could trim a bit in the galaxy context because we can rely on the JS engine  
// but it does not hurt to have these tests so I kept them all.

var galaxy = require('galaxy');


function evalTest(f, val) {
	galaxy.unstar(f)(function(err, result) {
		var str = err ? "ERR: " + err : result;
		strictEqual(str, val);
		start();
	})
}

function* delay(val) {
	yield galaxy.star(setTimeout, 0)(null, 0);
	return val;
}

function* delayFail(err) {
	yield galaxy.star(setTimeout, 0)(null, 0);
	throw err;
}

function throwError(message) {
	throw new Error(message);
}

asyncTest("eval return", 1, function() {
	evalTest(function* f() {
		return yield delay(5);
	}, 5);
})
asyncTest("eval if true", 1, function() {
	evalTest(function* f() {
		if (true) return yield delay(3);
		return 4;
	}, 3);
})
asyncTest("eval if false", 1, function() {
	evalTest(function* f() {
		if (false) return yield delay(3);
		return 4;
	}, 4);
})
asyncTest("eval while", 1, function() {
	evalTest(function* f() {
		var i = 1,
			result = 1;
		while (i < 5) {
			result = yield delay(i * result);
			i++;
		}
		return result;
	}, 24);
})
asyncTest("eval for", 1, function() {
	evalTest(function* f() {
		var result = 1;
		for (var i = 1; i < 5; i++) {
			result = (yield delay(i)) * (yield delay(result));
		}
		return result;
	}, 24);
})
asyncTest("eval for in", 1, function() {
	evalTest(function* f() {
		var foo = {
			a: 1,
			b: 2,
			c: 3,
			d: 5
		}
		var result = 1;
		for (var k in foo) {
			result = (yield delay(foo[yield delay(k)])) * (yield delay(result));
		}
		return result;
	}, 30);
})
asyncTest("fully async for in", 1, function() {
	evalTest(function* f() {
		var result = 1;
		for (var i = yield delay(2); i < (yield delay(5)); i = (yield delay(i)) + 1) {
			result = (yield delay(result)) * (yield delay(i));
		}
		return result;
	}, 24);
})
asyncTest("break in loop", 1, function() {
	evalTest(function* f() {
		var result = 1;
		for (var i = 1; i < 10; i++) {
			if (i == 5) break;
			result = (yield delay(result)) * (yield delay(i));
		}
		return result;
	}, 24);
})
asyncTest("continue", 1, function() {
	evalTest(function* f() {
		var result = 1;
		for (var i = 1; i < 10; i++) {
			if (i >= 5) continue;
			result = (yield delay(result)) * (yield delay(i));
		}
		return result;
	}, 24);
})
asyncTest("break in while", 1, function() {
	evalTest(function* f() {
		var i = 1,
			result = 1;
		while (i < 10) {
			if (i == 5) break;
			result = (yield delay(result)) * (yield delay(i));
			i++;
		}
		return result;
	}, 24);
})
asyncTest("continue in while", 1, function() {
	evalTest(function* f() {
		var i = 1,
			result = 1;
		while (i < 10) {
			i++;
			if (i >= 5) continue;
			result = ((yield delay(result)) * (yield delay(i)));
		}
		return result;
	}, 24);
})
asyncTest("for (;;)", 1, function() {
	evalTest(function* f() {
		var i = 0;
		for (;;) {
			if ((yield delay(++i)) === 10) return i;
		}
	}, 10);
})
asyncTest("eval lazy", 1, function() {
	evalTest(function* f() {
		var result = 1;
		return (yield delay(yield delay(result + 8))) < 5 && true ? 2 : 4
	}, 4);
})
asyncTest("eval lazy full async", 1, function() {
	evalTest(function* f() {
		var result = 1;
		return (yield delay(yield delay(result + 8))) < 5 && true ? yield delay(2) : yield delay(4)
	}, 4);
})
asyncTest("try catch 1", 1, function() {
	evalTest(function* f() {
		try {
			return yield delay("ok");
		} catch (ex) {
			return yield delay("err");
		}
	}, "ok");
})
asyncTest("try catch 2", 1, function() {
	evalTest(function* f() {
		try {
			throw yield delay("thrown");
		} catch (ex) {
			return (yield delay("caught ")) + ex;
		}
	}, "caught thrown");
})
asyncTest("try catch 3", 1, function() {
	evalTest(function* f() {
		try {
			throw yield delay("thrown");
		} catch (ex) {
			return (yield delay("caught ")) + ex;
		}
	}, "caught thrown");
})
asyncTest("try catch 5", 1, function() {
	evalTest(function* f() {
		try {
			yield delayFail("delay fail");
		} catch (ex) {
			return (yield delay("caught ")) + ex;
		}
	}, "caught delay fail");
})
asyncTest("try catch 6", 1, function() {
	evalTest(function* f() {
		try {
			throwError("direct")
			return yield delay("ok")
		} catch (ex) {
			return (yield delay("caught ")) + ex.message;
		}
	}, "caught direct");
})
asyncTest("try catch 7", 1, function() {
	evalTest(function* f() {
		try {
			var message = yield delay("indirect");
			throwError(message)
			return yield delay("ok")
		} catch (ex) {
			return (yield delay("caught ")) + ex.message;
		}
	}, "caught indirect");
})
asyncTest("try finally 1", 1, function() {
	evalTest(function* f() {
		var x = "";
		try {
			x += yield delay("try")
		} finally {
			x += yield delay(" finally");
		}
		x += " end"
		return x;
	}, "try finally end");
})
asyncTest("try finally 2", 1, function() {
	evalTest(function* f() {
		var x = "";
		try {
			x += yield delay("try")
			return x;
		} finally {
			x += yield delay(" finally");
		}
		x += " end"
		return x;
	}, "try");
})
asyncTest("try finally 3", 1, function() {
	evalTest(function* f() {
		var x = "";
		try {
			x += yield delay("try")
			throw "bad try";
		} finally {
			x += yield delay(" finally");
		}
		x += " end"
		return x;
	}, "ERR: bad try");
})
asyncTest("try finally 4", 1, function() {
	evalTest(function* f() {
		var x = "";
		try {
			x += yield delay("try")
			throwError("except");
		} finally {
			x += yield delay(" finally");
		}
		x += " end"
		return x;
	}, "ERR: Error: except");
})
asyncTest("try finally 5", 1, function() {
	evalTest(function* f() {
		var x = "";
		try {
			try {
				x += yield delay("try")
				throwError("except");
				x += " unreached"
			} finally {
				x += yield delay(" finally");
			}
			x += " end"
			return x;
		} catch (ex) {
			return x + "/" + ex.message;
		}
	}, "try finally/except");
})
asyncTest("try catch finally 1", 1, function() {
	evalTest(function* f() {
		var x = "";
		try {
			try {
				x += yield delay("try")
				throw new Error("except");
				x += " unreached"
			} catch (ex) {
				x += yield delay(" catch " + ex.message);
				throw ex;
			} finally {
				x += yield delay(" finally");
			}
			x += " end"
			return x;
		} catch (ex) {
			return x + "/" + ex.message;
		}
	}, "try catch except finally/except");
})
asyncTest("try catch finally 2", 1, function() {
	evalTest(function* f() {
		var x = "";
		try {
			try {
				x += yield delay("try")
				throwError("except");
				x += " unreached"
			} catch (ex) {
				x += " catch " + ex.message;
				throw ex;
			} finally {
				x += " finally";
			}
			x += " end"
			return x;
		} catch (ex) {
			return x + "/" + ex.message;
		}
	}, "try catch except finally/except");
})
asyncTest("nested try/catch 1", 1, function() {
	evalTest(function* f() {
		var x = "";
		try {
			try {
				x += yield delay("try")
			} catch (ex) {
				x += yield delay(" inner catch " + ex.message);
			}
			throwError(" except");
		} catch (ex) {
			return x + " outer catch" + ex.message;
		}
	}, "try outer catch except");
})
asyncTest("nested try/catch 2", 1, function() {
	evalTest(function* f() {
		var x = "";
		try {
			try {
				x += yield delay("try")
			} catch (ex) {
				x += " inner catch " + ex.message;
			}
			throw new Error(" except");
		} catch (ex) {
			return x + " outer catch" + ex.message;
		}
	}, "try outer catch except");
})
asyncTest("nested try/catch 3", 1, function() {
	evalTest(function* f() {
		var x = "";
		try {
			try {
				x += yield delay("try")
			} catch (ex) {
				x += yield delay(" inner catch " + ex.message);
			}
			throw new Error(" except");
		} catch (ex) {
			return x + " outer catch" + ex.message;
		}
	}, "try outer catch except");
})
asyncTest("nested try/finally 1", 1, function() {
	evalTest(function* f() {
		var x = "";
		try {
			try {
				x += yield delay("try")
			} finally {
				x += yield delay(" inner finally");
			}
			throwError(" except");
		} catch (ex) {
			return x + " outer catch" + ex.message;
		}
	}, "try inner finally outer catch except");
})
asyncTest("nested try/finally 2", 1, function() {
	evalTest(function* f() {
		var x = "";
		try {
			try {
				x += yield delay("try")
			} finally {
				x += " inner finally";
			}
			throwError(" except");
		} catch (ex) {
			return x + " outer catch" + ex.message;
		}
	}, "try inner finally outer catch except");
})
asyncTest("nested try/finally 3", 1, function() {
	evalTest(function* f() {
		var x = "";
		try {
			try {
				x += yield delay("try")
			} finally {
				x += yield delay(" inner finally");
			}
			throw new Error(" except");
		} catch (ex) {
			return x + " outer catch" + ex.message;
		}
	}, "try inner finally outer catch except");
})
asyncTest("and ok", 1, function() {
	evalTest(function* f() {
		var x = "<<";
		if ((yield delay(true)) && (yield delay(true))) x += "T1";
		else x += "F1"
		if ((yield delay(true)) && (yield delay(false))) x += "T2";
		else x += "F2"
		if ((yield delay(false)) && (yield delay(true))) x += "T3";
		else x += "F3"
		if ((yield delay(false)) && (yield delay(false))) x += "T4";
		else x += "F4"
		if ((yield delay(false)) && (yield delayFail("bad"))) x += "T5";
		else x += "F5"
		x += ">>";
		return x;
	}, "<<T1F2F3F4F5>>");
})
asyncTest("or ok", 1, function() {
	evalTest(function* f() {
		var x = "<<";
		if ((yield delay(true)) || (yield delay(true))) x += "T1";
		else x += "F1"
		if ((yield delay(true)) || (yield delay(false))) x += "T2";
		else x += "F2"
		if ((yield delay(false)) || (yield delay(true))) x += "T3";
		else x += "F3"
		if ((yield delay(false)) || (yield delay(false))) x += "T4";
		else x += "F4"
		if ((yield delay(true)) || (yield delayFail("bad"))) x += "T5";
		else x += "F5"
		x += ">>";
		return x;
	}, "<<T1T2T3F4T5>>");
})
asyncTest("switch with default", 1, function() {
	evalTest(function* f() {
		function* g(i) {
			var result = "a"
			switch (yield delay(i)) {
			case 1:
				result = yield delay("b");
				break;
			case 2:
				return yield delay("c");
			case 3:
			case 4:
				result = yield delay("d");
				break;
			default:
				result = yield delay("e");
			}
			return result;
		}

		return (yield g(0)) + (yield g(1)) + (yield g(2)) + (yield g(3)) + (yield g(4)) + (yield g(5));
	}, "ebcdde");
})
asyncTest("switch without default", 1, function() {
	evalTest(function* f() {
		function* g(i) {
			var result = "a"
			switch (yield delay(i)) {
			case 1:
				result = "b";
				break;
			case 2:
				return "c";
			case 3:
			case 4:
				result = "d";
				break;
			}
			return result;
		}

		return (yield g(0)) + (yield g(1)) + (yield g(2)) + (yield g(3)) + (yield g(4)) + (yield g(5));
	}, "abcdda");
})
asyncTest("this", 5, function() {
	evalTest(function* f() {
		function O(x) {
			this.x = x;
		}

		O.prototype.test1 = function*() {
			var self = this;
			this.x = yield delay(this.x + 1);
			strictEqual(this, self);
		}
		O.prototype.test2 = function*() {
			var self = this;
			try {
				this.x = yield delay(this.x + 1);
				strictEqual(this, self);
			} catch (ex) {
				ok(false);
			}
		}
		O.prototype.test3 = function*() {
			var self = this;
			try {
				this.x = yield delay(this.x + 1);
				throwError("test3");
				ok(false);
			} catch (ex) {
				strictEqual(this, self);
				this.x = yield delay(this.x + 1);
			}
		}

		function* delay2(val) {
			return yield delay(val);
		}

		O.prototype.test4 = function*() {
			var self = this;
			var v1 = galaxy.spin(delay2(this.x + 1));
			var v2 = galaxy.spin(delay2(1));
			this.x = (yield v1()) + (yield v2());
			strictEqual(this, self);
		}
		var o = new O(1);
		yield o.test1();
		yield o.test2();
		yield o.test3();
		yield o.test4();
		return o.x;
	}, 7);
})
asyncTest("scoping", 1, function() {
	evalTest(function* f() {
		function* test() {
			var foo = "abc";

			function bar() {
				return foo;
			}

			yield delay();
			var foo = "xyz";
			return bar;
		}

		return (yield test())();
	}, "xyz");
})
asyncTest("return undefined", 1, function() {
	evalTest(function* f() {
		function* test() {
			yield delay();
			return;
		}

		return yield test();
	}, undefined);
})
asyncTest("futures test", 1, function() {
	evalTest(function* f() {
		function* delay2(val) {
			return yield delay(val);
		}

		var a = galaxy.spin(delay2('a'));
		var b = galaxy.spin(delay2('b'));
		var c = galaxy.spin(delay2('c'));
		var d = galaxy.spin(delay2('d'));
		return (yield a()) + (yield b()) + (yield d()) + (yield c());
	}, "abdc");
})
asyncTest("last case without break", 1, function() {
	evalTest(function* f() {
		switch (true) {
		case true:
			yield delay();
		}
		return 1;
	}, 1);
})

asyncTest("async comma operator", 1, function() {
	evalTest(function* f() {
		var a;
		return a = 4, a++, a = yield delay(2 * a), yield delay(a + 1);
	}, 11);
})

asyncTest("async constructor", 1, function() {
	evalTest(function* f() {
		function* Foo(val) {
			yield delay();
			this.x = val;
		}
		Foo.prototype.y = function() {
			return this.x + 1;
		}
		return (yield galaxy.new(Foo)(5)).y();
	}, 6);
})

asyncTest("fibo false async", 1, function() {
	evalTest(function* f() {
		function* fibo(n) {
			return n > 1 ? (yield fibo(n - 1)) + (yield fibo(n - 2)) : 1;
		}
		return yield fibo(16);
	}, 1597);
})

asyncTest("coffeescript wrapper 1", 1, function() {
	evalTest(function* f() {
		return yield (function*() {
			return yield delay("cs1");
		})();
	}, "cs1");
})

asyncTest("coffeescript wrapper 2", 1, function() {
	evalTest(function* f() {
		return yield (function*() {
			return yield delay("cs2");
		}).call(this);
	}, "cs2");
})

asyncTest("coffeescript wrapper 3", 1, function() {
	evalTest(function* f() {
		return yield (function*() {
			return yield delay("cs3");
		}).apply(this, arguments);
	}, "cs3");
})

asyncTest("sync try/catch in async", 1, function() {
	evalTest(function* f() {
		try {
			throw new Error("catch me");
		} catch (ex) {
			return "got it";
		}
	}, "got it");
})

asyncTest("sync try/catch inside conditional", 1, function() {
	evalTest(function* f() {
		if (true) {
			try {} catch (ex) {}
		}
	}, undefined);
})

asyncTest("labelled break", 1, function() {
	evalTest(function* f() {
		var result = '';
		outer:
		for (var i = 1; i < 10; i++) {
			inner:
			for (var j = 5; j < 10; j++) {
				result = (yield delay(result)) + '!'
				if (i == 1 && j == 7) break;
				if (i == 2 && j == 7) break inner;
				if (i == 3 && j == 7) continue inner;
				if (i == 4 && j == 7) continue outer;
				if (i == 5 && j == 7) break outer;
				result = (yield delay(result)) + (yield delay(i)) + (yield delay(j)) + '-';
			}
			result += yield delay('/')
		}
		return result;
	}, '!15-!16-!/!25-!26-!/!35-!36-!!38-!39-/!45-!46-!!55-!56-!');
});

asyncTest("arity of future", 2, function() {
	function* foo() { return "hello"; }

	galaxy.unstar(galaxy.spin(foo()))(function(e, r) {
		strictEqual(e, null);
		strictEqual(r, "hello");
		start();
	});
});
