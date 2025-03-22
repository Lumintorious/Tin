import * as module0 from "file://C:\\Users\\Razvan\\Documents\\Tin\\tin-out\\stdlib.tin.out.mjs";Object.entries(module0).forEach(([key, value]) => {
				globalThis[key] = value;
		  });;
export var Iterator = /* [] */(T) => _S(Symbol("Iterator"), (_p0) => ({next: _p0}), lazy(Type('Iterator', (obj) => Reflect.ownKeys(obj).includes(Iterator._s))._and(Struct(Array(0)([
						Parameter("next",
					
				Type("undefined")._and(Lambda(
				Array(Type)([]),
				{}))
			,
					() => { return (undefined)})
		,
			])))));
export var Accessible = /* [] */(T) => _S(Symbol("Accessible"), (_p0,_p1) => ({at: _p0,length: _p1}), lazy(Type('Accessible', (obj) => Reflect.ownKeys(obj).includes(Accessible._s))._and(Struct(Array(0)([
						Parameter("at",
					
				Type("undefined")._and(Lambda(
				Array(Type)([Parameter("index",
					Number,
					() => { return (undefined)})
		,]),
				T))
			,
					() => { return (undefined)})
		,,Parameter("length",
					
				Type("undefined")._and(Lambda(
				Array(Type)([]),
				Number))
			,
					() => { return (undefined)})
		,
			])))));
;
export var ToString = _S(Symbol("ToString"), (_p0) => ({toString: _p0}), lazy(Type('ToString', (obj) => Reflect.ownKeys(obj).includes(ToString._s))._and(Struct(Array(0)([
						Parameter("toString",
					
				Type("undefined")._and(Lambda(
				Array(Type)([Parameter("this",
					{},
					() => { return (undefined)})
		,]),
				String))
			,
					() => { return (undefined)})
		,
			])))));
export var stringOf/* (obj:Any) -> String*/ = _F(Symbol("lambda"), function(obj) {try{
throw ((Type$get(ToString).__is_child(obj) ) ? (do{throw ((() => { var _owner = obj; return _owner[ToString._s].toString.call(_owner,)})())}) : (do{throw makeString(obj)})) 
} catch (e) { if (e instanceof Error) { throw e } else { return e } }}, 
				Type("stringOf")._and(Lambda(
				Array(Type)([Parameter("obj",
					{},
					() => { return (undefined)})
		,]),
				String))
			);
export var Iterable = /* [] */(T) => _S(Symbol("Iterable"), (_p0,_p1 = _F(Symbol("lambda"), function(fn) {try{
var iterator/* Iterator[T]*/ = ((() => { var _owner = this; return _owner[Iterable._s].getIterator.call(_owner,)})());
var current/* T?*/ = ((() => { var _owner = iterator; return _owner[Iterator._s].next.call(_owner,)})());
while (current != nothing) {
 fn(current);
current = ((() => { var _owner = iterator; return _owner[Iterator._s].next.call(_owner,)})()) 
}
} catch (e) { if (e instanceof Error) { throw e } else { return e } }}, 
				Type("undefined")._and(Lambda(
				Array(Type)([Parameter("this",
					{},
					() => { return (undefined)})
		,,Parameter("fn",
					
				Type("undefined")._and(Lambda(
				Array(Type)([Parameter("undefined",
					{},
					() => { return (undefined)})
		,]),
				Nothing))
			,
					() => { return (undefined)})
		,]),
				Nothing))
			),_p2 = _F(Symbol("lambda"), function(separator, left, right) {try{
var string/* String*/ = "";
var fn/* (t:T) -> Any*/ = _F(Symbol("lambda"), function(t) {try{
var comma/* String*/ = ((string == "") ? (do{""}) : (do{separator})) ;
throw string = "" + string + "" + comma + "" + t + ""
} catch (e) { if (e instanceof Error) { throw e } else { return e } }}, 
				Type("fn")._and(Lambda(
				Array(Type)([Parameter("t",
					T,
					() => { return (undefined)})
		,]),
				{}))
			);
((() => { var _owner = this; return _owner[Iterable._s].forEach.call(_owner,fn)})());
throw "" + left + "" + string + "" + right + ""
} catch (e) { if (e instanceof Error) { throw e } else { return e } }}, 
				Type("undefined")._and(Lambda(
				Array(Type)([Parameter("this",
					{},
					() => { return (undefined)})
		,,Parameter("separator",
					String,
					() => { return (undefined)})
		,,Parameter("left",
					String,
					() => { return (undefined)})
		,,Parameter("right",
					String,
					() => { return (undefined)})
		,]),
				String))
			),_p3 = _F(Symbol("lambda"), function(pred) {try{
var num/* Number*/ = 0;
((() => { var _owner = this; return _owner[Iterable._s].forEach.call(_owner,_F(Symbol("lambda"), function(t) {try{
throw ((pred(t)) ? (do{num = num + 1}) : (do{null})) 
} catch (e) { if (e instanceof Error) { throw e } else { return e } }}, 
				Type("undefined")._and(Lambda(
				Array(Type)([Parameter("undefined",
					T,
					() => { return (undefined)})
		,]),
				{}))
			))})());
throw num
} catch (e) { if (e instanceof Error) { throw e } else { return e } }}, 
				Type("undefined")._and(Lambda(
				Array(Type)([Parameter("this",
					{},
					() => { return (undefined)})
		,,Parameter("pred",
					
				Type("undefined")._and(Lambda(
				Array(Type)([Parameter("undefined",
					{},
					() => { return (undefined)})
		,]),
				Boolean))
			,
					() => { return (undefined)})
		,]),
				Number))
			)) => ({getIterator: _p0,forEach: _p1,mkString: _p2,count: _p3}), lazy(Type('Iterable', (obj) => Reflect.ownKeys(obj).includes(Iterable._s))._and(Struct(Array(0)([
						Parameter("getIterator",
					
				Type("undefined")._and(Lambda(
				Array(Type)([]),
				{}))
			,
					() => { return (undefined)})
		,,Parameter("forEach",
					
				Type("undefined")._and(Lambda(
				Array(Type)([Parameter("this",
					{},
					() => { return (undefined)})
		,,Parameter("fn",
					
				Type("undefined")._and(Lambda(
				Array(Type)([Parameter("undefined",
					{},
					() => { return (undefined)})
		,]),
				Nothing))
			,
					() => { return (undefined)})
		,]),
				Nothing))
			,
					() => { return (_F(Symbol("lambda"), function(fn) {try{
var iterator/* Iterator[T]*/ = ((() => { var _owner = this; return _owner[Iterable._s].getIterator.call(_owner,)})());
var current/* T?*/ = ((() => { var _owner = iterator; return _owner[Iterator._s].next.call(_owner,)})())
} catch (e) { if (e instanceof Error) { throw e } else { return e } }}, 
				Type("undefined")._and(Lambda(
				Array(Type)([Parameter("this",
					{},
					() => { return (undefined)})
		,,Parameter("fn",
					
				Type("undefined")._and(Lambda(
				Array(Type)([Parameter("undefined",
					{},
					() => { return (undefined)})
		,]),
				Nothing))
			,
					() => { return (undefined)})
		,]),
				Nothing))
			))})
		,,Parameter("mkString",
					
				Type("undefined")._and(Lambda(
				Array(Type)([Parameter("this",
					{},
					() => { return (undefined)})
		,,Parameter("separator",
					String,
					() => { return (undefined)})
		,,Parameter("left",
					String,
					() => { return (undefined)})
		,,Parameter("right",
					String,
					() => { return (undefined)})
		,]),
				String))
			,
					() => { return (_F(Symbol("lambda"), function(separator, left, right) {try{
var string/* String*/ = "";
var fn/* (t:T) -> Any*/ = _F(Symbol("lambda"), function(t) {try{
var comma/* String*/ = ((string == "") ? (do{""}) : (do{separator})) 
} catch (e) { if (e instanceof Error) { throw e } else { return e } }}, 
				Type("fn")._and(Lambda(
				Array(Type)([Parameter("t",
					T,
					() => { return (undefined)})
		,]),
				{}))
			);
throw ((() => { var _owner = this; return _owner[Iterable._s].forEach.call(_owner,fn)})())
} catch (e) { if (e instanceof Error) { throw e } else { return e } }}, 
				Type("undefined")._and(Lambda(
				Array(Type)([Parameter("this",
					{},
					() => { return (undefined)})
		,,Parameter("separator",
					String,
					() => { return (undefined)})
		,,Parameter("left",
					String,
					() => { return (undefined)})
		,,Parameter("right",
					String,
					() => { return (undefined)})
		,]),
				String))
			))})
		,,Parameter("count",
					
				Type("undefined")._and(Lambda(
				Array(Type)([Parameter("this",
					{},
					() => { return (undefined)})
		,,Parameter("pred",
					
				Type("undefined")._and(Lambda(
				Array(Type)([Parameter("undefined",
					{},
					() => { return (undefined)})
		,]),
				Boolean))
			,
					() => { return (undefined)})
		,]),
				Number))
			,
					() => { return (_F(Symbol("lambda"), function(pred) {try{
var num/* Number*/ = 0;
throw ((() => { var _owner = this; return _owner[Iterable._s].forEach.call(_owner,_F(Symbol("lambda"), function(t) {try{
throw undefined
} catch (e) { if (e instanceof Error) { throw e } else { return e } }}, 
				Type("undefined")._and(Lambda(
				Array(Type)([Parameter("undefined",
					T,
					() => { return (undefined)})
		,]),
				{}))
			))})())
} catch (e) { if (e instanceof Error) { throw e } else { return e } }}, 
				Type("undefined")._and(Lambda(
				Array(Type)([Parameter("this",
					{},
					() => { return (undefined)})
		,,Parameter("pred",
					
				Type("undefined")._and(Lambda(
				Array(Type)([Parameter("undefined",
					{},
					() => { return (undefined)})
		,]),
				Boolean))
			,
					() => { return (undefined)})
		,]),
				Number))
			))})
		,
			])))));
print("Loaded")