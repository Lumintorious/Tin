import * as module0 from "file://C:\\Users\\Razvan\\Documents\\Tin\\tin-out\\stdlib.tin.out.mjs";Object.entries(module0).forEach(([key, value]) => {
				globalThis[key] = value;
		  });;
import * as module1 from "file://C:\\Users\\Razvan\\Documents\\Tin\\tin-out\\collections\\Iterable.tin.out.mjs";Object.entries(module1).forEach(([key, value]) => {
				globalThis[key] = value;
		  });;
export var Box = _S(Symbol("Box"), (_p0,_p1) => ({get: _p0,setValue: _p1}), lazy(Type('Box', (obj) => Reflect.ownKeys(obj).includes(Box._s))._and(Struct(Array(0)([
						Parameter("get",
					Type$of(
				Type("undefined")._and(Lambda(
				Array(Type)([]),
				{}))
			),
					() => { return (undefined)})
		,Parameter("setValue",
					Type$of(
				Type("undefined")._and(Lambda(
				Array(Type)([Parameter("undefined",
					Type$of(Number),
					() => { return (undefined)})
		,]),
				Null))
			),
					() => { return (undefined)})
		
			])))), {});
export var ImmutableHolder = _S(Symbol("ImmutableHolder"), (_p0) => ({box: _p0}), lazy(Type('ImmutableHolder', (obj) => Reflect.ownKeys(obj).includes(ImmutableHolder._s))._and(Struct(Array(0)([
						Parameter("box",
					Type$of({}),
					() => { return (undefined)})
		
			])))), {});
export var makeBox/* (n:Number) -> Box*/ = _F(Symbol("lambda"), function(n) {try{
var number/* ~Number*/ = n;
var get/* () -> ~Number*/ = _F(Symbol("lambda"), function() {try{
throw number
} catch (e) { if (e instanceof Error) { throw e } else { return e } }}, 
				Type("get")._and(Lambda(
				Array(Type)([]),
				{}))
			);
var setValue/* (newValue:Number) ~> Any*/ = _F(Symbol("lambda"), function(newValue) {try{
throw number = newValue
} catch (e) { if (e instanceof Error) { throw e } else { return e } }}, 
				Type("setValue")._and(Lambda(
				Array(Type)([Parameter("newValue",
					Type$of(Number),
					() => { return (undefined)})
		,]),
				{}))
			);
throw Box(get, setValue)
} catch (e) { if (e instanceof Error) { throw e } else { return e } }}, 
				Type("makeBox")._and(Lambda(
				Array(Type)([Parameter("n",
					Type$of(Number),
					() => { return (undefined)})
		,]),
				Box))
			);
ImmutableHolder(makeBox(2));
print("Hello")