import * as module0 from "file://C:\\Users\\Razvan\\Documents\\Tin\\tin-out\\stdlib.tin.out.mjs";Object.entries(module0).forEach(([key, value]) => {
				globalThis[key] = value;
		  });;
import * as module1 from "file://C:\\Users\\Razvan\\Documents\\Tin\\tin-out\\collections\\Iterable.tin.out.mjs";Object.entries(module1).forEach(([key, value]) => {
				globalThis[key] = value;
		  });;
export var ListHead = /* [] */(T) => _S(Symbol("ListHead"), (_p0,_p1) => ({value: _p0,rest: _p1}), lazy(Type('ListHead', (obj) => Reflect.ownKeys(obj).includes(ListHead._s))._and(Struct(Array(0)([
						Parameter("value",
					T,
					() => { return (undefined)})
		,,Parameter("rest",
					{},
					() => { return (undefined)})
		,
			])))), {});
export var List = /* [] */(T) => ((() => { const _left = (() => { const _left = (() => { const _left = ListHead.call('Type', T); return _A(_left, Iterable.call('Type', T));})(); return _A(_left, Accessible.call('Type', T));})(); return _A(_left, ToString);})());
export var List$iterator/* [T] -> (list:ListHead[T]?) -> Iterator[T]*/ = function(T) {try{
throw _F(Symbol("lambda"), function(list) {try{
var currentList/* ListHead[T]?*/ = list;
var nextF/* () -> T?*/ = _F(Symbol("lambda"), function() {try{
throw ((currentList != nothing) ? (do{var result/* T*/ = currentList[ListHead._s].value;
currentList = currentList[ListHead._s].rest;
throw result}) : (do{throw nothing})) 
} catch (e) { if (e instanceof Error) { throw e } else { return e } }}, 
				Type("nextF")._and(Lambda(
				Array(Type)([]),
				{}))
			);
throw Type$get(Iterator).call('Type', T)(0)(nextF)
} catch (e) { if (e instanceof Error) { throw e } else { return e } }}, 
				Type("undefined")._and(Lambda(
				Array(Type)([Parameter("list",
					{},
					() => { return (undefined)})
		,]),
				{}))
			)
} catch(e) { if(e instanceof Error) {throw e} else {return e} } };
export var List$accessible/* [T] -> (list:ListHead[T]) -> Accessible[T]*/ = function(T) {try{
throw _F(Symbol("lambda"), function(list) {try{
var length/* () -> Number*/ = _F(Symbol("lambda"), function() {try{
var num/* Number*/ = 0;
var l/* ListHead[T]*/ = list;
while (l != nothing) {
 num = num + 1 
};
throw num
} catch (e) { if (e instanceof Error) { throw e } else { return e } }}, 
				Type("length")._and(Lambda(
				Array(Type)([]),
				Number))
			);
var at/* (index:Number) -> T*/ = _F(Symbol("lambda"), function(index) {try{
var currentIndex/* Number*/ = 0;
var l/* ListHead[T]*/ = list;
while (currentIndex < index) {
 ((l != nothing) ? (do{throw l = l[ListHead._s].rest}) : (do{null})) ;
currentIndex = currentIndex + 1 
};
throw l[ListHead._s].value
} catch (e) { if (e instanceof Error) { throw e } else { return e } }}, 
				Type("at")._and(Lambda(
				Array(Type)([Parameter("index",
					Number,
					() => { return (undefined)})
		,]),
				T))
			);
throw Type$get(Accessible).call('Type', T)(0)(at, length)
} catch (e) { if (e instanceof Error) { throw e } else { return e } }}, 
				Type("undefined")._and(Lambda(
				Array(Type)([Parameter("list",
					{},
					() => { return (undefined)})
		,]),
				{}))
			)
} catch(e) { if(e instanceof Error) {throw e} else {return e} } };
export var List$of/* [T] -> (arr:Array[T]) -> ListHead[T]? & Iterable[T] & Accessible[T] & ToString*/ = function(T) {try{
throw _F(Symbol("lambda"), function(arr) {try{
var i/* Number*/ = ((() => { var _owner = arr; return _owner[Array._s].length.call(_owner,)})());
var list/* ListHead[T]?*/ = nothing /* as ListHead.call('Type', T) */;
while (i > 0) {
 i = i - 1;
var list/* ListHead[T]*/ = Type$get(ListHead).call('Type', T)(0)(((() => { var _owner = arr; return _owner[Array._s].at.call(_owner,i)})()), list) 
};
var ssss/* [T] -> (getIterator:() -> Iterator[T], forEach:(this:Iterable[T], fn:(T) -> Nothing) -> Nothing, mkString:(this:Iterable[T], separator:String, left:String, right:String) -> String, count:(this:Iterable[T], pred:(T) -> Boolean) -> Number) -> Iterable[T]*/ = Type$get(Iterable).call('Type', T);
var iterable/* Iterable[T]*/ = Type$get(Iterable).call('Type', T)(0)(_F(Symbol("lambda"), function() {try{
throw List$iterator.call('Type', T)(list)
} catch (e) { if (e instanceof Error) { throw e } else { return e } }}, 
				Type("undefined")._and(Lambda(
				Array(Type)([]),
				{}))
			));
var toStr/* (this:Any) -> String*/ = _F(Symbol("lambda"), function() {try{
throw ((() => { var _owner = iterable; return _owner[Iterable._s].mkString.call(_owner,",", "List(", ")")})())
} catch (e) { if (e instanceof Error) { throw e } else { return e } }}, 
				Type("toStr")._and(Lambda(
				Array(Type)([Parameter("this",
					{},
					() => { return (undefined)})
		,]),
				String))
			);
throw (() => { const _left = (() => { const _left = (() => { const _left = list; return _A(_left, iterable);})(); return _A(_left, List$accessible.call('Type', T).call(_left, list));})(); return _A(_left, ToString.call(_left, toStr));})()
} catch (e) { if (e instanceof Error) { throw e } else { return e } }}, 
				Type("undefined")._and(Lambda(
				Array(Type)([Parameter("arr",
					{},
					() => { return (undefined)})
		,]),
				{}))
			)
} catch(e) { if(e instanceof Error) {throw e} else {return e} } };
export var List$fromIterator/* [T] -> (getIterator:() -> Iterator[T]) -> ListHead[T]? & Iterable[T]*/ = function(T) {try{
throw _F(Symbol("lambda"), function(getIterator) {try{
var list/* ListHead[T]?*/ = nothing;
var iterator/* Iterator[T]*/ = getIterator();
var current/* T?*/ = ((() => { var _owner = iterator; return _owner[Iterator._s].next.call(_owner,)})());
while (current != nothing) {
 list = Type$get(ListHead).call('Type', T)(0)(current, list);
current = ((() => { var _owner = iterator; return _owner[Iterator._s].next.call(_owner,)})()) 
};
throw (() => { const _left = list; return _A(_left, Type$get(Iterable).call('Type', T)(0).call(_left, _F(Symbol("lambda"), function() {try{
throw List$iterator.call('Type', T)(list)
} catch (e) { if (e instanceof Error) { throw e } else { return e } }}, 
				Type("undefined")._and(Lambda(
				Array(Type)([]),
				{}))
			)));})()
} catch (e) { if (e instanceof Error) { throw e } else { return e } }}, 
				Type("undefined")._and(Lambda(
				Array(Type)([Parameter("getIterator",
					
				Type("undefined")._and(Lambda(
				Array(Type)([]),
				{}))
			,
					() => { return (undefined)})
		,]),
				{}))
			)
} catch(e) { if(e instanceof Error) {throw e} else {return e} } }