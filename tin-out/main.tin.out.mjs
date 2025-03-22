import * as module0 from "file://C:\\Users\\Razvan\\Documents\\Tin\\tin-out\\stdlib.tin.out.mjs";Object.entries(module0).forEach(([key, value]) => {
				globalThis[key] = value;
		  });;
import * as module1 from "file://C:\\Users\\Razvan\\Documents\\Tin\\tin-out\\collections\\List.tin.out.mjs";Object.entries(module1).forEach(([key, value]) => {
				globalThis[key] = value;
		  });;
export var Animal = _S(Symbol("Animal"), (_p0) => ({breed: _p0}), lazy(Type('Animal', (obj) => Reflect.ownKeys(obj).includes(Animal._s))._and(Struct(Array(0)([
						Parameter("breed",
					String,
					() => { return (undefined)})
		,
			])))));
export var Furry = _S(Symbol("Furry"), (_p0) => ({something: _p0}), lazy(Type('Furry', (obj) => Reflect.ownKeys(obj).includes(Furry._s))._and(Struct(Array(0)([
						Parameter("something",
					Number,
					() => { return (undefined)})
		,
			])))));
export var Cat = (() => { const _left = (() => { const _left = Type$get(Animal); return _A(_left, Type$get(Furry));})(); return _A(_left, _S(Symbol("Cat"), (_p0) => ({name: _p0}), lazy(Type('Cat', (obj) => Reflect.ownKeys(obj).includes(Cat._s))._and(Struct(Array(0)([
						Parameter("name",
					String,
					() => { return (undefined)})
		,
			]))))));})();
export var cat/* Animal & Furry & Cat*/ = (() => { const _left = (() => { const _left = Animal("Something"); return _A(_left, Furry.call(_left, 2));})(); return _A(_left, Cat.call(_left, "Mercy"));})();
export var animal/* Animal*/ = Animal("Fwoof");
export var arr/* Array[Number]*/ = Array$of(0)(Array(0)([1, 2, 3]));
print(arr)