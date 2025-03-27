import * as module0 from "file://C:\\Users\\Razvan\\Documents\\Tin\\tin-out\\stdlib.tin.out.mjs";Object.entries(module0).forEach(([key, value]) => {
				globalThis[key] = value;
		  });;
import * as module1 from "file://C:\\Users\\Razvan\\Documents\\Tin\\tin-out\\collections\\Iterable.tin.out.mjs";Object.entries(module1).forEach(([key, value]) => {
				globalThis[key] = value;
		  });;
export var ListHead = /* [] */(function(){ const _sym = Symbol("undefined"); return _Q(_sym, (T) => _S(typeof _sym !== "undefined" ? _sym : Symbol("ListHead"), (_p0,_p1) => ({value: _p0,rest: _p1}), lazy(Type('ListHead', (obj) => Reflect.ownKeys(obj).includes(ListHead._s))._and(Struct(Array(0)([
						Parameter("value",
					Type$of(T),
					() => { return (undefined)})
		,Parameter("rest",
					Type$of({}),
					() => { return (undefined)})
		
			])))), {})); })();
export var List = /* [] */(function(){ const _sym = Symbol("undefined"); return _Q(_sym, (T) => ((() => { const _left = (() => { const _left = (() => { const _left = ListHead.call('Type', T); return _A(_left, Iterable.call('Type', T));})(); return _A(_left, Accessible.call('Type', T));})(); return _A(_left, ToString);})())); })();
export var List$iterator/* [T] -> (list:(ListHead[T])?) -> Iterator[T]*/ = function(T) {try{
throw _F(Symbol("lambda"), function(list) {try{
var currentList/* var (ListHead[T])?*/ = list;
var nextF/* () ~> var (T)?*/ = _F(Symbol("lambda"), function() {try{
throw ((currentList != nothing) ? (function(){var result/* T*/ = currentList[ListHead._s].value;
currentList = currentList[ListHead._s].rest;
throw result})() : (function(){throw nothing})()) 
} catch (e) { if (e instanceof Error) { throw e } else { return e } }}, 
				Type("nextF")._and(Lambda(
				Array(Type)([]),
				{}))
			);
throw Iterator.call('Type', T)(nextF)
} catch (e) { if (e instanceof Error) { throw e } else { return e } }}, 
				Type("undefined")._and(Lambda(
				Array(Type)([Parameter("list",
					Type$of({}),
					() => { return (undefined)})
		,]),
				{}))
			)
} catch(e) { if(e instanceof Error) {throw e} else { return e} } };
export var List$accessible/* [T] -> (list:ListHead[T]) -> var Accessible[T]*/ = function(T) {try{
throw _F(Symbol("lambda"), function(list) {try{
var length/* () ~> var Number*/ = _F(Symbol("lambda"), function() {try{
var num/* var Number*/ = 0;
var l/* ListHead[T]*/ = list;
while (l != nothing) {
 num = num + 1 
};
throw num
} catch (e) { if (e instanceof Error) { throw e } else { return e } }}, 
				Type("length")._and(Lambda(
				Array(Type)([]),
				{}))
			);
var at/* (index:Number) ~> var T*/ = _F(Symbol("lambda"), function(index) {try{
var currentIndex/* var Number*/ = 0;
var l/* var ListHead[T]*/ = list;
while (currentIndex < index) {
 ((l != nothing) ? (function(){throw l = l[ListHead._s].rest})() : (function(){null})()) ;
currentIndex = currentIndex + 1 
};
throw l[ListHead._s].value
} catch (e) { if (e instanceof Error) { throw e } else { return e } }}, 
				Type("at")._and(Lambda(
				Array(Type)([Parameter("index",
					Type$of(Number),
					() => { return (undefined)})
		,]),
				{}))
			);
throw Accessible.call('Type', T)(at, length)
} catch (e) { if (e instanceof Error) { throw e } else { return e } }}, 
				Type("undefined")._and(Lambda(
				Array(Type)([Parameter("list",
					Type$of({}),
					() => { return (undefined)})
		,]),
				{}))
			)
} catch(e) { if(e instanceof Error) {throw e} else { return e} } };
export var List$of/* [T] -> (arr:Array[T]) ~> var List[T]*/ = function(T) {try{
throw _F(Symbol("lambda"), function(arr) {try{
var i/* var Number*/ = ((() => { var _owner = arr; return _owner[Array._s].length.call(_owner,)})());
var list/* (ListHead[T])?*/ = nothing /* as ListHead.call('Type', T) */;
while (i > 0) {
 i = i - 1;
var list/* ListHead[T]*/ = ListHead.call('Type', T)(((() => { var _owner = arr; return _owner[Array._s].at.call(_owner,i)})()), list) 
};
var ssss/* (getIterator:() -> Iterator[T], forEach:(this:Iterable[T], fn:(T) ~> Nothing) ~> var Anything, mkString:(this:Iterable[T], separator:String, left:String, right:String) ~> var String, count:(this:Iterable[T], pred:(T) -> Boolean) ~> var Number) -> Iterable[T]*/ = Iterable.call('Type', T);
var iterable/* Iterable[T]*/ = Iterable.call('Type', T)(_F(Symbol("lambda"), function() {try{
throw List$iterator.call('Type', T)(list)
} catch (e) { if (e instanceof Error) { throw e } else { return e } }}, 
				Type("undefined")._and(Lambda(
				Array(Type)([]),
				{}))
			));
var toStr/* (this:Anything) ~> var String*/ = _F(Symbol("lambda"), function() {try{
throw ((() => { var _owner = iterable; return _owner[Iterable._s].mkString.call(_owner,",", "List(", ")")})())
} catch (e) { if (e instanceof Error) { throw e } else { return e } }}, 
				Type("toStr")._and(Lambda(
				Array(Type)([Parameter("this",
					Type$of({}),
					() => { return (undefined)})
		,]),
				{}))
			);
throw (() => { const _left = (() => { const _left = (() => { const _left = list; return _A(_left, iterable);})(); return _A(_left, List$accessible.call('Type', T).call(_left, list));})(); return _A(_left, ToString.call(_left, toStr));})()
} catch (e) { if (e instanceof Error) { throw e } else { return e } }}, 
				Type("undefined")._and(Lambda(
				Array(Type)([Parameter("arr",
					Type$of({}),
					() => { return (undefined)})
		,]),
				{}))
			)
} catch(e) { if(e instanceof Error) {throw e} else { return e} } };
export var List$range/* (start:Number, end:Number) -> var (ListHead[Number])? & Iterable[Number]*/ = _F(Symbol("lambda"), function(start, end) {try{
var list/* var (ListHead[Number])?*/ = nothing;
var st/* var Number*/ = start;
var en/* Number*/ = end;
while (st < en) {
 list = ListHead.call('Type', Number)(st, list);
st = st + 1 
};
throw ((() => { const _left = list; return _A(_left, Iterable.call('Type', Number).call(_left, _F(Symbol("lambda"), function() {try{
throw List$iterator.call('Type', Number)(list)
} catch (e) { if (e instanceof Error) { throw e } else { return e } }}, 
				Type("undefined")._and(Lambda(
				Array(Type)([]),
				{}))
			)));})())
} catch (e) { if (e instanceof Error) { throw e } else { return e } }}, 
				Type("List@range")._and(Lambda(
				Array(Type)([Parameter("start",
					Type$of(Number),
					() => { return (undefined)})
		,,Parameter("end",
					Type$of(Number),
					() => { return (undefined)})
		,]),
				{}))
			);
export var li/* Number*/ = 0