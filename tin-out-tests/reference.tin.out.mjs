import * as module0 from "file://C:\\Users\\Razvan\\Documents\\Tin\\tin-out-tests\\stdlib.tin.out.mjs";Object.entries(module0).forEach(([key, value]) => {
				globalThis[key] = value;
		  });;
export var v/* Number*/ = 1;
export var vv/* Number*/ = 1.1;
export var s/* String*/ = "string, can be spliced like " + v + "";
export var same/* Number*/ = 1;
export var line/* Number*/ = 2;
export var String$anything/* String*/ = "Works";
export var m/* var 1*/ = {_:(1)};
(m)._ = 1;
export var x/* Number*/ = 1 + 2;
export var y/* Number*/ = 12 / 3;
export var number/* Number*/ = 1;
export var string/* String*/ = "str";
export var boolean/* Boolean*/ = false;
export var empty/* Nothing*/ = nothing;
export var anyStr/* Anything*/ = "str";
export var maybeFull/* (Number)?*/ = 10;
export var maybeEmpty/* (Number)?*/ = nothing;
export var f/* (n:Number) -> Number*/ = _F(Symbol("lambda"), function(n) {try{
throw n + 1
} catch (e) { if (e instanceof Error) { throw e } else { return e } }}, 
				Type("f")._and(Lambda(
				Array(Type)([Parameter("n",
					Type$of(Number),
					() => { return (undefined)})
		,]),
				Number))
			);
export var ff/* (n:Number) -> Number*/ = _F(Symbol("lambda"), function(n) {try{
throw n + 2
} catch (e) { if (e instanceof Error) { throw e } else { return e } }}, 
				Type("ff")._and(Lambda(
				Array(Type)([Parameter("n",
					Type$of(Number),
					() => { return (undefined)})
		,]),
				Number))
			);
print("Hello World");
export var F = _F(Symbol("lambda"), function(Number) {try{
throw Type$get(Number)
} catch (e) { if (e instanceof Error) { throw e } else { return e } }}, {});
export var FNamed = _F(Symbol("lambda"), function(first, second) {try{
throw Type$get(Number)
} catch (e) { if (e instanceof Error) { throw e } else { return e } }}, {});
f(24);
((v > 0) ? (function(){throw print("Works")})() : (function(){throw print("Doesn't work")})()) ;
export var ifelse/* Number*/ = ((v > 0) ? (function(){1})() : (function(){2})()) ;
export var i/* Number*/ = 0;
while (i < 3) {
 print(i) 
};
export var Cat = _S(typeof _sym !== "undefined" ? _sym : Symbol("Cat"), (_p0,_p1 = 1) => _o({name: _p0,age: _p1}), lazy(Type('Cat', (obj => typeof obj === 'object' && Reflect.ownKeys(obj).includes(Cat._s)))._and(Struct(Array(0)([
						Parameter("name",
					Type$of(String),
					() => { return (undefined)})
		,Parameter("age",
					Type$of(Number),
					() => { return (1)})
		
			])))), {});
export var Mech = _S(typeof _sym !== "undefined" ? _sym : Symbol("Mech"), (_p0,_p1) => _o({name: _p0,version: _p1}), lazy(Type('Mech', (obj => typeof obj === 'object' && Reflect.ownKeys(obj).includes(Mech._s)))._and(Struct(Array(0)([
						Parameter("name",
					Type$of(String),
					() => { return (undefined)})
		,Parameter("version",
					Type$of(Number),
					() => { return (undefined)})
		
			])))), {});
export var test/* Number*/ = 0;
export var kitty/* Cat*/ = Cat({_:("Kitty"),_cn:""}, {_:(1),_cn:""});
export var mech/* Mech*/ = Mech({_:("Iodized Steel"),_cn:""}, {_:(3),_cn:""});
kitty[Cat._s].name._;
mech[Mech._s].version._;
export var MechaCat = (() => { const _left = Type$get(Mech); return _A(_left, Type$get(Cat));})();
export var MechOrCat = _U(Type$get(Mech), Type$get(Cat));
export var mechaCat/* Cat & Mech*/ = (() => { const _left = Cat({_:("MechaCat"),_cn:""}, {_:(10),_cn:""}); return _A(_left, Mech.call(_left, {_:("Oxidized Copper"),_cn:""}, {_:(1.4),_cn:""}));})();
mechaCat[Mech._s].version._;
mechaCat /* as Type$get(Cat) */[Cat._s].name._ == "MechaCat";
mechaCat /* as Type$get(Mech) */[Mech._s].name._ == "OxidizedCopper";
export var any/* Anything*/ = kitty;
((Type$get(Cat).__is_child(any) ) ? (function(){throw print(any[Cat._s].name._)})() : (function(){null})()) ;
export var maybeCat/* (Cat)?*/ = kitty;
((maybeCat != nothing) ? (function(){throw print(maybeCat[Cat._s].age._)})() : (function(){null})()) ;
export var arr/* Array[Number]*/ = Array$of.call(Number)(Array(0)([1, 2, 3, 4]));
((() => { var _owner = arr; return _owner[Array._s].at._.call(_owner,0)})());
((() => { var _owner = arr; return _owner[Array._s].length._.call(_owner,)})());
export var varargs/* (n:Array[Number]) -> Number*/ = _F(Symbol("lambda"), function(n) {try{
throw ((() => { var _owner = n; return _owner[Array._s].at._.call(_owner,0)})())
} catch (e) { if (e instanceof Error) { throw e } else { return e } }}, 
				Type("varargs")._and(Lambda(
				Array(Type)([Parameter("n",
					Type$of({}),
					() => { return (undefined)})
		,]),
				Number))
			);
varargs(Array(0)([1, 2, 3]));
varargs(Array$of.call(Number)(Array(0)([1, 2])))