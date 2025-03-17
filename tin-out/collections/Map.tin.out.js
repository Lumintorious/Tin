const __tin_varargs_marker = Symbol();

// Object.prototype._copy = function (...args) {
// 	const keys = Object.keys(this).flatMap(k => Object.keys(this[k]));
// 	let i = 0;
// 	const copyObj = {};
// 	for (let arg of args) {
// 		copyObj[keys[i]] = arg
// 		i++;
// 	}
// 	return { ...this, ...copyObj }
// }

function TIN_TYPE(typeId, typeHash, constructorRaw, descriptor) {
	const constructor = (...args) => {
		const result = constructorRaw(...args)
		return {
			[typeId]: result
		};
	}
	constructor._tinFields = descriptor;
	constructor._typeId = typeId;
	constructor.toString = () => {
		return descriptor.toString()
	}
	constructor.__is_child = (obj) => {
		return (typeof obj === "object") && Reflect.ownKeys(obj).includes(typeId)
	}

	return constructor;
}

function TIN_LAMBDA_TYPE(typeId, paramTypes, returnType) {
	return { __is_child: (f) => typeof f === "function" };
}

// function _TIN_MAKE_LAMBDA(type)

const _TIN_INTERSECT_OBJECTS = function (obj1, obj2) {
	if (obj1 === undefined) {
		return obj2
	}
	if (obj2 === undefined) {
		return obj1
	}
	const commonModules = [];
	for (let key of Reflect.ownKeys(obj1)) {
		if (Reflect.ownKeys(obj2).includes(key)) {
			commonModules.push(key)
		}
	}
	const newObj = { ...obj1 };
	const obj1Keys = Reflect.ownKeys(obj1)
	const obj2Keys = Reflect.ownKeys(obj2)
	for (let key of obj2Keys) {
		if (obj1Keys.includes(key)) {
			const obj2Module = obj2[key]
			for (let originalKey of Reflect.ownKeys(obj2Module)) {
				if (obj2Module[originalKey] !== undefined) {
					newObj[key][originalKey] = obj2Module[originalKey]
				}
			}
		} else {
			newObj[key] = obj2[key]
		}
	}
	return newObj
}

const _TIN_UNION_OBJECTS = function (obj1, obj2) {
	return [obj1, obj2]
}

const nothing = undefined;

const Type = TIN_TYPE("", "", (i) => null, {})
const Int = TIN_TYPE("", "", (i) => Number(i), {})
const String = TIN_TYPE("", "", (i) => String(i), {})
const Void = TIN_TYPE("", "", (i) => null, {})
const Array = (T) => TIN_TYPE("Array", "", (args) => args[__tin_varargs_marker] ? args : ({
	_rawArray: args,
	length() {
		return args.length;
	},
	at(index) {
		return args[index]
	},
	[__tin_varargs_marker]: true,
	toString() {
		const parts = args.map(x => JSON.stringify(x)).join(", ")
		return "Array(" + parts + ")"
	}
}), {})

const Array$of = (t) => (args) => args
Array._typeId = "Array"

const copy = (T) => (obj) => {
	const newObj = {};
	for (let key of Reflect.ownKeys(obj)) {
		newObj[key] = { ...obj[key] }
	}
	return newObj;
}

function getRandomInt(min, max) {
	const minCeiled = Math.ceil(min);
	const maxFloored = Math.floor(max);
	return Math.floor(Math.random() * (maxFloored - minCeiled) + minCeiled); // The maximum is exclusive and the minimum is inclusive
}

function makeString(obj) {
	if (obj === null) return 'nothing';
	if (typeof obj === 'undefined') return 'nothing';
	if (typeof obj === 'boolean') return obj ? 'true' : 'false';
	if (typeof obj === 'number') return obj.toString();
	if (typeof obj === 'string') return obj;

	if (typeof obj === 'function') {
		return 'λ'
	}

	if (Reflect.ownKeys(obj).includes("Array")) {
		let result = 'Array(';
		for (let i = 0; i < obj.Array.length(); i++) {
			result += makeString(obj.Array.at(i)) + (i === obj.Array.length() - 1 ? "" : ", ")
		}
		return result + ")"
	}

	if (typeof obj === 'object') {
		let result = '(';
		let number = 0;
		for (let componentKey of Reflect.ownKeys(obj)) {
			const component = obj[componentKey]
			// if (++number > 1) {
			// 	result += " & "
			// }
			// result += componentKey + "("
			for (let key in component) {
				if (component.hasOwnProperty(key)) {
					if (key.startsWith("__")) {
						continue
					}
					result += componentKey + "." + key + "=" + makeString(component[key]) + ', ';
				}
			}
			if (result.length > 1 && result[result.length - 2] === ",") {
				result = result.slice(0, -2); // Remove trailing comma and space
			}
			result += ", "
		}
		if (result.length > 1 && result[result.length - 2] === ",") {
			result = result.slice(0, -2); // Remove trailing comma and space
		}
		return result + ')';
	}

	return ''; // For other types like functions, symbols, etc.
}

const print = (arg) => {
	console.log(makeString(arg))
}

const debug = (...args) => {
	console.log(...args)
}

// COMPILED TIN
;
import * as module0 from "file://C:\\Users\\Razvan\\Documents\\Tin\\tin-out\\collections\\Iterable.tin.out.js";Object.entries(module0).forEach(([key, value]) => {
			globalThis[key] = value;
	  });;


	const JsMap = globalThis.Map;

;
export let MapOps = /* [] */(K, V) => TIN_TYPE("MapOps", "3b8a0aa9-abcc-40a1-9bdb-bbcf2e7eb991", (_p0,_p1,_p2) => ({put: _p0,get: _p1,remove: _p2}), {}); MapOps._typeId = "MapOps";;
export let MapEntry = /* [] */(A, B) => TIN_TYPE("MapEntry", "77a5b341-fa45-46ca-a90c-b44d16db3781", (_p0,_p1) => ({key: _p0,value: _p1}), {}); MapEntry._typeId = "MapEntry";;
export let Map = /* [] */(K, V) => _TIN_INTERSECT_OBJECTS(MapOps.call('Type', K, V), Iterable.call('Type', MapEntry.call('Type', K, V)));
export let Map$entry/* [A, B] -> (key:A, value:B) -> MapEntry[A, B]*/ = function(A, B) {
return function(key, value) {
return MapEntry.call('Type', A, B)(key, value)
}
};
;


	const Map$of = (K, V) => (args) => {
		const map = new JsMap(args.Array._rawArray.map(p => [p.MapEntry.key, p.MapEntry.value]))
		const ops = MapOps(K, V)(
			(key, value) => map.put(key, value), 
			(key) => map.get(key),
			(key) => map.delete(key)
		)
		const getIterator = () => {
			const jsIterator = map.keys();
			return Iterator(MapEntry(K, V))(
				() => {
					const n = jsIterator.next();
					if (!n.done) {
						return MapEntry(K, V)(n.value, map.get(n.value))
					} else {
						return undefined;
					}
				}
			)
		}

		return _TIN_INTERSECT_OBJECTS(ops, Iterable(MapEntry(K, V))(getIterator));
	}

;
export let x/* Map[Number, String]*/ = Map$of.call('Type', Number, String)(Array(0)([Map$entry(0)(1, "One"), Map$entry(0)(2, "Two")]));
x.Iterable.forEach.call(x,function(p) {
return print(p.MapEntry.value)
})