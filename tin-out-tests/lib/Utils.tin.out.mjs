import * as module0 from "file://C:\\Users\\Razvan\\Documents\\Tin\\tin-out-tests\\stdlib.tin.out.mjs";Object.entries(module0).forEach(([key, value]) => {
				globalThis[key] = value;
		  });;
export var max/* (a:Number, b:Number) -> Number*/ = _F(Symbol("lambda"), function(a, b) {try{
throw ((a > b) ? (function(){a})() : (function(){b})()) 
} catch (e) { if (e instanceof Error) { throw e } else { return e } }}, 
				Type("max")._and(Lambda(
				Array(Type)([Parameter("a",
					Type$of(Number),
					() => { return (undefined)})
		,,Parameter("b",
					Type$of(Number),
					() => { return (undefined)})
		,]),
				Number))
			);
export var min/* (a:Number, b:Number) -> Number*/ = _F(Symbol("lambda"), function(a, b) {try{
throw ((a < b) ? (function(){a})() : (function(){b})()) 
} catch (e) { if (e instanceof Error) { throw e } else { return e } }}, 
				Type("min")._and(Lambda(
				Array(Type)([Parameter("a",
					Type$of(Number),
					() => { return (undefined)})
		,,Parameter("b",
					Type$of(Number),
					() => { return (undefined)})
		,]),
				Number))
			);
export var floor/* (n:Number) -> Number*/ = _F(Symbol("lambda"), function(n) {try{
throw n - (n["%"](1))
} catch (e) { if (e instanceof Error) { throw e } else { return e } }}, 
				Type("floor")._and(Lambda(
				Array(Type)([Parameter("n",
					Type$of(Number),
					() => { return (undefined)})
		,]),
				Number))
			);
export var ceiling/* (n:Number) -> Number*/ = _makeClojure({floor}, _F(Symbol("lambda"), function(n) {try{
throw this._clojure.floor._(n) + 1
} catch (e) { if (e instanceof Error) { throw e } else { return e } }}, 
				Type("ceiling")._and(Lambda(
				Array(Type)([Parameter("n",
					Type$of(Number),
					() => { return (undefined)})
		,]),
				Number))
			));
export var absolute/* (n:Number) -> Number*/ = _F(Symbol("lambda"), function(n) {try{
throw ((n < 0) ? (function(){0 - n})() : (function(){n})()) 
} catch (e) { if (e instanceof Error) { throw e } else { return e } }}, 
				Type("absolute")._and(Lambda(
				Array(Type)([Parameter("n",
					Type$of(Number),
					() => { return (undefined)})
		,]),
				Number))
			);
export var pi/* Number*/ = 3.141592653589793;
export var e/* Number*/ = 2.718281828459045