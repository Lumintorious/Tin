import * as module0 from "file://C:\\Users\\Razvan\\Documents\\Tin\\tin-out\\stdlib.tin.out.mjs";Object.entries(module0).forEach(([key, value]) => {
				globalThis[key] = value;
		  });;
export var Box = _S(typeof _sym !== "undefined" ? _sym : Symbol("Box"), (_p0) => _o({value: _p0}), lazy(Type('Box', (obj) => Reflect.ownKeys(obj).includes(Box._s))._and(Struct(Array(0)([
						Parameter("value",
					Type$of({}),
					() => { return (undefined)})
		
			])))), {});
export var box/* Anything*/ = Box({_:(12)});
export var vbox/* Anything*/ = Box({_:(21)});
export var takeInvar/* (v:Number) ~> Nothing*/ = _makeClojure({print}, _F(Symbol("lambda"), function(v) {try{
throw this._clojure.print._(v)
} catch (e) { if (e instanceof Error) { throw e } else { return e } }}, 
				Type("takeInvar")._and(Lambda(
				Array(Type)([Parameter("v",
					Type$of(Number),
					() => { return (undefined)})
		,]),
				Nothing))
			));
takeInvar(({_:(2)})._);
export var f/* () ~> (Nothing)?*/ = _F(Symbol("lambda"), function() {try{
throw ((Type$get(Box).__is_child(box) ) ? (function(){throw print("Yes1")})() : (function(){null})()) 
} catch (e) { if (e instanceof Error) { throw e } else { return e } }}, 
				Type("f")._and(Lambda(
				Array(Type)([]),
				{}))
			);
export var f2/* () ~> var (Nothing)?*/ = _F(Symbol("lambda"), function() {try{
throw {_:(((Type$get(Box).__is_child(vbox) ) ? (function(){throw {_:(print("Yes2 " + (vbox[Box._s].value)._ + ""))}})() : (function(){null})()) )}
} catch (e) { if (e instanceof Error) { throw e } else { return e } }}, 
				Type("f2")._and(Lambda(
				Array(Type)([]),
				{}))
			);
f();
f2()