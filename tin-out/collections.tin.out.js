function TIN_TYPE(typeId, constructorRaw, descriptor) {
	const constructor = (...args) => {
		const result = constructorRaw(...args)
		if (result !== undefined) {
			result.__tin_typeIds = [typeId]
		}
		return result;
	}
	constructor._tinFields = descriptor;
	constructor._tinTypeId = typeId;
	constructor["&"] = () => {
		return TIN_TYPE("", () => null, {})
	}
	constructor["|"] = () => {
		return TIN_TYPE("", () => null, {})
	}
	constructor.toString = () => {
		return descriptor.toString()
	}
	constructor.__is_child = (obj) =>
		obj.__tin_typeIds.includes(typeId)

	return constructor;
}

const _TIN_INTERSECT_OBJECTS = function (obj1, obj2) {
	if (obj1 === undefined) {
		return obj2
	}
	if (obj2 === undefined) {
		return obj1
	}
	const result = { ...obj1, ...obj2 }
	result.__tin_typeIds = [...(obj1.__tin_typeIds ?? []), ... (obj2.__tin_typeIds ?? [])]
	return result
}

const _TIN_UNION_OBJECTS = function (obj1, obj2) {
	return [obj1, obj2]
}

const nothing = undefined;

const Type = TIN_TYPE("", (i) => null, {})
const Int = TIN_TYPE("", (i) => Number(i), {})
const String = TIN_TYPE("", (i) => String(i), {})
const Void = TIN_TYPE("", (i) => null, {})
const Array = (T) => TIN_TYPE("Array", (args) => ({
	length() {
		return args.length;
	},
	at(index) {
		return args[index]
	},
	toString() {
		const parts = args.map(x => JSON.stringify(x)).join(", ")
		return "Array(" + parts + ")"
	}
}), {})

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

	if (obj.__tin_typeIds.includes("Array")) {
		let result = '[';
		for (let i = 0; i < obj.length(); i++) {
			result += obj.at(i) + (i === obj.length() - 1 ? "" : ", ")
		}
		return result + "]"
	}

	if (typeof obj === 'object') {
		let result = 'data(';
		for (let key in obj) {
			if (obj.hasOwnProperty(key)) {
				if (typeof obj[key] === "function" || key.startsWith("__")) {
					continue
				}
				result += makeString(key) + '=' + makeString(obj[key]) + ',';
			}
		}
		if (result.length > 1) {
			result = result.slice(0, -1); // Remove trailing comma and space
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
import * as module0 from "./collections/Iterable.tin.out.js";Object.entries(module0).forEach(([key, value]) => {
			globalThis[key] = value;
	  });;
export var ListHead = /* [] */(T) => TIN_TYPE("c8f0bcbc-d879-4ee5-b106-c170fd107ef0", (_p0,_p1) => ({value: _p0,rest: _p1}), {});
export var List = /* [] */(T) => (_TIN_INTERSECT_OBJECTS(ListHead.call('Type', T), Iterable.call('Type', T)));
export var listIterator/* [T] => (ListHead[T]?) => Iterator[T]*/ = function(T) {
return function(list) {
var currentList/* ListHead[T]?*/ = list;
var nextF/* () => T | Nothing*/ = function() {
return ((currentList != nothing) ? ((function(){var result/* T*/ = currentList.value;
currentList = currentList.rest;
return result})()) : (nothing)) 
};
var thing/* () => T | Nothing*/ = nextF;
return Iterator.call('Type', T)(nextF)
}
};
export var listOf/* [T] => (Array[T]) => ListHead[T]? & Iterable[T]*/ = function(T) {
return function(arr) {
var i/* Number*/ = arr.length();
var list/* ListHead[T]?*/ = nothing;
while (i > 0) {
 i = i - 1;
list = ListHead.call('Type', T)(arr.at(i), list) 
};
return _TIN_INTERSECT_OBJECTS(list, makeIterable.call('Type', T)(function() {
return listIterator.call('Type', T)(list)
}))
}
};
export var listFromIterator/* [T] => (() => Iterator[T]) => ListHead[T]? & Iterable[T]*/ = function(T) {
return function(getIterator) {
var list/* ListHead[T]?*/ = nothing;
var iterator/* Iterator[T]*/ = getIterator();
var current/* T?*/ = iterator.next();
while (current != nothing) {
 list = ListHead.call('Type', T)(current, list);
current = current.next() 
};
return _TIN_INTERSECT_OBJECTS(list, makeIterable.call('Type', T)(getIterator))
}
};
export var mkString/* [T] => (ListHead[T]?, String, String, String) => String*/ = function(T) {
return function(originalList, separator = ", ", left = "", right = "") {
var list/* ListHead[T]?*/ = originalList;
var string/* String*/ = "";
while (list != nothing) {
 var comma/* String*/ = ((string == "") ? ("") : (separator)) ;
string = "" + string + "" + comma + "" + list.value + "";
list = list.rest 
};
return "" + left + "" + string + "" + right + ""
}
}