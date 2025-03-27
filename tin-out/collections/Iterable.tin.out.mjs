import * as module0 from "file://C:\\Users\\Razvan\\Documents\\Tin\\tin-out\\stdlib.tin.out.mjs";Object.entries(module0).forEach(([key, value]) => {
				globalThis[key] = value;
		  });;
export var Iterator = /* [] */(function(){ const _sym = Symbol("undefined"); return _Q(_sym, (T) => _S(typeof _sym !== "undefined" ? _sym : Symbol("Iterator"), (_p0) => ({next: _p0}), lazy(Type('Iterator', (obj) => Reflect.ownKeys(obj).includes(Iterator._s))._and(Struct(Array(0)([
						Parameter("next",
					Type$of(
				Type("undefined")._and(Lambda(
				Array(Type)([]),
				{}))
			),
					() => { return (undefined)})
		
			])))), {})); })();
export var Accessible = /* [] */(function(){ const _sym = Symbol("undefined"); return _Q(_sym, (T) => _S(typeof _sym !== "undefined" ? _sym : Symbol("Accessible"), (_p0,_p1) => ({at: _p0,length: _p1}), lazy(Type('Accessible', (obj) => Reflect.ownKeys(obj).includes(Accessible._s))._and(Struct(Array(0)([
						Parameter("at",
					Type$of(
				Type("undefined")._and(Lambda(
				Array(Type)([Parameter("index",
					Type$of(Number),
					() => { return (undefined)})
		,]),
				T))
			),
					() => { return (undefined)})
		,Parameter("length",
					Type$of(
				Type("undefined")._and(Lambda(
				Array(Type)([]),
				Number))
			),
					() => { return (undefined)})
		
			])))), {})); })();
;
export var ToString = _S(typeof _sym !== "undefined" ? _sym : Symbol("ToString"), (_p0) => ({toString: _p0}), lazy(Type('ToString', (obj) => Reflect.ownKeys(obj).includes(ToString._s))._and(Struct(Array(0)([
						Parameter("toString",
					Type$of(
				Type("undefined")._and(Lambda(
				Array(Type)([Parameter("this",
					Type$of({}),
					() => { return (undefined)})
		,]),
				String))
			),
					() => { return (undefined)})
		
			])))), {});
export var stringOf/* (obj:Anything) -> String*/ = _F(Symbol("lambda"), function(obj) {try{
throw ((Type$get(ToString).__is_child(obj) ) ? (function(){throw ((() => { var _owner = obj; return _owner[ToString._s].toString.call(_owner,)})())})() : (function(){throw makeString(obj)})()) 
} catch (e) { if (e instanceof Error) { throw e } else { return e } }}, 
				Type("stringOf")._and(Lambda(
				Array(Type)([Parameter("obj",
					Type$of({}),
					() => { return (undefined)})
		,]),
				String))
			);
export var Iterable = /* [] */(function(){ const _sym = Symbol("undefined"); return _Q(_sym, (T) => _S(typeof _sym !== "undefined" ? _sym : Symbol("Iterable"), (_p0,_p1 = _F(Symbol("lambda"), function(fn) {try{
var iterator/* Iterator[T]*/ = ((() => { var _owner = this; return _owner[Iterable._s].getIterator.call(_owner,)})());
var current/* var (T)?*/ = ((() => { var _owner = iterator; return _owner[Iterator._s].next.call(_owner,)})());
throw ((current != nothing) ? (function(){throw current = nothing})() : (function(){null})()) 
} catch (e) { if (e instanceof Error) { throw e } else { return e } }}, 
				Type("undefined")._and(Lambda(
				Array(Type)([Parameter("this",
					Type$of({}),
					() => { return (undefined)})
		,,Parameter("fn",
					Type$of(
				Type("undefined")._and(Lambda(
				Array(Type)([Parameter("undefined",
					Type$of({}),
					() => { return (undefined)})
		,]),
				Nothing))
			),
					() => { return (undefined)})
		,]),
				{}))
			),_p2 = _F(Symbol("lambda"), function(separator, left, right) {try{
var string/* var String*/ = "";
var fn/* (t:T) ~> var String*/ = _F(Symbol("lambda"), function(t) {try{
var comma/* String*/ = ((string == "") ? (function(){""})() : (function(){separator})()) ;
throw string = "" + string + "" + comma + "" + t + ""
} catch (e) { if (e instanceof Error) { throw e } else { return e } }}, 
				Type("fn")._and(Lambda(
				Array(Type)([Parameter("t",
					Type$of(T),
					() => { return (undefined)})
		,]),
				{}))
			);
((() => { var _owner = this; return _owner[Iterable._s].forEach.call(_owner,fn)})());
throw "" + left + "" + string + "" + right + ""
} catch (e) { if (e instanceof Error) { throw e } else { return e } }}, 
				Type("undefined")._and(Lambda(
				Array(Type)([Parameter("this",
					Type$of({}),
					() => { return (undefined)})
		,,Parameter("separator",
					Type$of(String),
					() => { return (undefined)})
		,,Parameter("left",
					Type$of(String),
					() => { return (undefined)})
		,,Parameter("right",
					Type$of(String),
					() => { return (undefined)})
		,]),
				{}))
			),_p3 = _F(Symbol("lambda"), function(pred) {try{
var num/* var Number*/ = 0;
((() => { var _owner = this; return _owner[Iterable._s].forEach.call(_owner,_F(Symbol("lambda"), function(t) {try{
throw ((pred(t)) ? (function(){num = num + 1})() : (function(){null})()) 
} catch (e) { if (e instanceof Error) { throw e } else { return e } }}, 
				Type("undefined")._and(Lambda(
				Array(Type)([Parameter("t",
					Type$of(T),
					() => { return (undefined)})
		,]),
				{}))
			))})());
throw num
} catch (e) { if (e instanceof Error) { throw e } else { return e } }}, 
				Type("undefined")._and(Lambda(
				Array(Type)([Parameter("this",
					Type$of({}),
					() => { return (undefined)})
		,,Parameter("pred",
					Type$of(
				Type("undefined")._and(Lambda(
				Array(Type)([Parameter("undefined",
					Type$of({}),
					() => { return (undefined)})
		,]),
				Boolean))
			),
					() => { return (undefined)})
		,]),
				{}))
			)) => ({getIterator: _p0,forEach: _p1,mkString: _p2,count: _p3}), lazy(Type('Iterable', (obj) => Reflect.ownKeys(obj).includes(Iterable._s))._and(Struct(Array(0)([
						Parameter("getIterator",
					Type$of(
				Type("undefined")._and(Lambda(
				Array(Type)([]),
				{}))
			),
					() => { return (undefined)})
		,Parameter("forEach",
					Type$of(
				Type("undefined")._and(Lambda(
				Array(Type)([Parameter("this",
					Type$of({}),
					() => { return (undefined)})
		,,Parameter("fn",
					Type$of(
				Type("undefined")._and(Lambda(
				Array(Type)([Parameter("undefined",
					Type$of({}),
					() => { return (undefined)})
		,]),
				Nothing))
			),
					() => { return (undefined)})
		,]),
				{}))
			),
					() => { return (_F(Symbol("lambda"), function(fn) {try{
var iterator/* Iterator[T]*/ = ((() => { var _owner = this; return _owner[Iterable._s].getIterator.call(_owner,)})());
var current/* var (T)?*/ = ((() => { var _owner = iterator; return _owner[Iterator._s].next.call(_owner,)})())
} catch (e) { if (e instanceof Error) { throw e } else { return e } }}, 
				Type("undefined")._and(Lambda(
				Array(Type)([Parameter("this",
					Type$of({}),
					() => { return (undefined)})
		,,Parameter("fn",
					Type$of(
				Type("undefined")._and(Lambda(
				Array(Type)([Parameter("undefined",
					Type$of({}),
					() => { return (undefined)})
		,]),
				Nothing))
			),
					() => { return (undefined)})
		,]),
				{}))
			))})
		,Parameter("mkString",
					Type$of(
				Type("undefined")._and(Lambda(
				Array(Type)([Parameter("this",
					Type$of({}),
					() => { return (undefined)})
		,,Parameter("separator",
					Type$of(String),
					() => { return (undefined)})
		,,Parameter("left",
					Type$of(String),
					() => { return (undefined)})
		,,Parameter("right",
					Type$of(String),
					() => { return (undefined)})
		,]),
				{}))
			),
					() => { return (_F(Symbol("lambda"), function(separator, left, right) {try{
var string/* var String*/ = "";
var fn/* (t:T) ~> var String*/ = _F(Symbol("lambda"), function(t) {try{
var comma/* String*/ = ((string == "") ? (function(){""})() : (function(){separator})()) 
} catch (e) { if (e instanceof Error) { throw e } else { return e } }}, 
				Type("fn")._and(Lambda(
				Array(Type)([Parameter("t",
					Type$of(T),
					() => { return (undefined)})
		,]),
				{}))
			);
throw ((() => { var _owner = this; return _owner[Iterable._s].forEach.call(_owner,fn)})())
} catch (e) { if (e instanceof Error) { throw e } else { return e } }}, 
				Type("undefined")._and(Lambda(
				Array(Type)([Parameter("this",
					Type$of({}),
					() => { return (undefined)})
		,,Parameter("separator",
					Type$of(String),
					() => { return (undefined)})
		,,Parameter("left",
					Type$of(String),
					() => { return (undefined)})
		,,Parameter("right",
					Type$of(String),
					() => { return (undefined)})
		,]),
				{}))
			))})
		,Parameter("count",
					Type$of(
				Type("undefined")._and(Lambda(
				Array(Type)([Parameter("this",
					Type$of({}),
					() => { return (undefined)})
		,,Parameter("pred",
					Type$of(
				Type("undefined")._and(Lambda(
				Array(Type)([Parameter("undefined",
					Type$of({}),
					() => { return (undefined)})
		,]),
				Boolean))
			),
					() => { return (undefined)})
		,]),
				{}))
			),
					() => { return (_F(Symbol("lambda"), function(pred) {try{
var num/* var Number*/ = 0;
throw ((() => { var _owner = this; return _owner[Iterable._s].forEach.call(_owner,_F(Symbol("lambda"), function(t) {try{
throw undefined
} catch (e) { if (e instanceof Error) { throw e } else { return e } }}, 
				Type("undefined")._and(Lambda(
				Array(Type)([Parameter("t",
					Type$of(T),
					() => { return (undefined)})
		,]),
				{}))
			))})())
} catch (e) { if (e instanceof Error) { throw e } else { return e } }}, 
				Type("undefined")._and(Lambda(
				Array(Type)([Parameter("this",
					Type$of({}),
					() => { return (undefined)})
		,,Parameter("pred",
					Type$of(
				Type("undefined")._and(Lambda(
				Array(Type)([Parameter("undefined",
					Type$of({}),
					() => { return (undefined)})
		,]),
				Boolean))
			),
					() => { return (undefined)})
		,]),
				{}))
			))})
		
			])))), {})); })();
export var ssss/* Number*/ = 2