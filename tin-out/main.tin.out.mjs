import * as module0 from "file://C:\\Users\\Razvan\\Documents\\Tin\\tin-out\\stdlib.tin.out.mjs";Object.entries(module0).forEach(([key, value]) => {
				globalThis[key] = value;
		  });;
export var Shape = _S(typeof _sym !== "undefined" ? _sym : Symbol("Shape"), (_p0) => ({area: _p0}), lazy(Type('Shape', (obj) => Reflect.ownKeys(obj).includes(Shape._s))._and(Struct(Array(0)([
						Parameter("area",
					Type$of(
				Type("undefined")._and(Lambda(
				Array(Type)([]),
				{}))
			),
					() => { return (undefined)})
		
			])))), {});
export var Rectangle = _S(typeof _sym !== "undefined" ? _sym : Symbol("Rectangle"), (_p0) => ({side: _p0}), lazy(Type('Rectangle', (obj) => Reflect.ownKeys(obj).includes(Rectangle._s))._and(Struct(Array(0)([
						Parameter("side",
					Type$of({}),
					() => { return (undefined)})
		
			])))), {});
export var Rectangle$make/* (sideIn:Number) ~> var var Rectangle & Shape*/ = _F(Symbol("lambda"), function(sideIn) {try{
var side/* var Number*/ = {_:sideIn};
var rect/* Rectangle*/ = Rectangle(side);
throw _makeClojure({rect,side}, {_:(() => { const _left = rect; return _A(_left, Shape.call(_left, _F(Symbol("lambda"), function() {try{
throw _makeClojure({side}, {_:side._ ** 2})
} catch (e) { if (e instanceof Error) { throw e } else { return e } }}, 
				Type("undefined")._and(Lambda(
				Array(Type)([]),
				{}))
			)));})()})
} catch (e) { if (e instanceof Error) { throw e } else { return e } }}, 
				Type("Rectangle@make")._and(Lambda(
				Array(Type)([Parameter("sideIn",
					Type$of(Number),
					() => { return (undefined)})
		,]),
				{}))
			);
;
export var rect/* var var Rectangle & Shape*/ = Rectangle$make(12);
_makeClojure({debug,rect}, debug(rect._))