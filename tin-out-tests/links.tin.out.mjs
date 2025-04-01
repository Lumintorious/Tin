import * as module0 from "file://C:\\Users\\Razvan\\Documents\\Tin\\tin-out-tests\\stdlib.tin.out.mjs";Object.entries(module0).forEach(([key, value]) => {
				globalThis[key] = value;
		  });;
export var Box = _S(typeof _sym !== "undefined" ? _sym : Symbol("Box"), (_p0,_p1) => _o({value: _p0,get: _p1}), lazy(Type('Box', (obj => typeof obj === 'object' && Reflect.ownKeys(obj).includes(Box._s)))._and(Struct(Array(0)([
						Parameter("value",
					Type$of(Number),
					() => { return (undefined)})
		,Parameter("get",
					Type$of(
				Type("undefined")._and(Lambda(
				Array(Type)([]),
				Number))
			),
					() => { return (undefined)})
		
			])))), {});
export var BoxV = _S(typeof _sym !== "undefined" ? _sym : Symbol("BoxV"), (_p0,_p1) => _o({value: _p0,get: _p1}), lazy(Type('BoxV', (obj => typeof obj === 'object' && Reflect.ownKeys(obj).includes(BoxV._s)))._and(Struct(Array(0)([
						Parameter("value",
					Type$of({}),
					() => { return (undefined)})
		,Parameter("get",
					Type$of(
				Type("undefined")._and(Lambda(
				Array(Type)([]),
				{}))
			),
					() => { return (undefined)})
		
			])))), {});
export var makeBox/* () -> Box*/ = _F(Symbol("lambda"), function() {try{
var value/* Number*/ = 1;
throw Box({_:(value),_cn:"value"}, _makeClojure({value}, {_:(_F(Symbol("lambda"), function() {try{
throw this._clojure.value._ * 10
} catch (e) { if (e instanceof Error) { throw e } else { return e } }}, 
				Type("undefined")._and(Lambda(
				Array(Type)([]),
				Number))
			)),_cn:""}))
} catch (e) { if (e instanceof Error) { throw e } else { return e } }}, 
				Type("makeBox")._and(Lambda(
				Array(Type)([]),
				Box))
			);
export var makeBoxV/* () -> var BoxV*/ = _F(Symbol("lambda"), function() {try{
var value/* var Number*/ = {_:(1)};
throw {_:(BoxV(value, _makeClojure({value}, {_:(_F(Symbol("lambda"), function() {try{
throw {_:((this._clojure.value)._ * 10)}
} catch (e) { if (e instanceof Error) { throw e } else { return e } }}, 
				Type("undefined")._and(Lambda(
				Array(Type)([]),
				{}))
			)),_cn:""})))}
} catch (e) { if (e instanceof Error) { throw e } else { return e } }}, 
				Type("makeBoxV")._and(Lambda(
				Array(Type)([]),
				{}))
			);
export var box1/* Box*/ = makeBox();
export var box2/* Box*/ = copy(box1,Box({_:(99),_cn:""}));
assert(box1[Box._s].value._ == 1, "Constructor value was incorrect");
assert(((() => { var _owner = box1; return _owner[Box._s].get._.call(_owner,)})()) == 10, "Constructor clojure was incorrect");
assert(box2[Box._s].value._ == 99, "Value copy failed");
assert(((() => { var _owner = box2; return _owner[Box._s].get._.call(_owner,)})()) == 990, "Clojure copy failed");
export var boxv1/* var BoxV*/ = makeBoxV();
export var boxv2/* BoxV*/ = copy((boxv1)._,BoxV({_:(99)}));
assert(((boxv1)._[BoxV._s].value)._ == 1, "Constructor var was incorrect");
assert((((() => { var _owner = (boxv1)._; return _owner[BoxV._s].get._.call(_owner,)})()))._ == 10, "Constructor clojure including 'var' was incorrect");
((boxv1)._[BoxV._s].value._) = 25;
assert(((boxv1)._[BoxV._s].value)._ == 25, "Mutating variable failed");
assert((((() => { var _owner = (boxv1)._; return _owner[BoxV._s].get._.call(_owner,)})()))._ == 250, "Reading mutated variable from clojure failed");
assert((boxv2[BoxV._s].value)._ == 99, "Variable copy failed");
assert((((() => { var _owner = boxv2; return _owner[BoxV._s].get._.call(_owner,)})()))._ == 990, "Clojure with 'var' failed to copy");
(boxv2[BoxV._s].value._) = 33;
assert((boxv2[BoxV._s].value)._ == 33, "Mutating copy failed");
assert((((() => { var _owner = boxv2; return _owner[BoxV._s].get._.call(_owner,)})()))._ == 330, "Reading mutated copy failed");
assert(((boxv1)._[BoxV._s].value)._ == 25, "Copy mutation affected original value");
assert((((() => { var _owner = (boxv1)._; return _owner[BoxV._s].get._.call(_owner,)})()))._ == 250, "Copy mutation affected original clojure")