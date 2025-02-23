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
	constructor.__is_child = (obj) =>
		Reflect.ownKeys(obj).includes(typeId)
	// obj.__tin_typeIds.includes(typeId)

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
	const result = { ...obj1, ...obj2 }
	return result
}

const _TIN_UNION_OBJECTS = function (obj1, obj2) {
	return [obj1, obj2]
}

const nothing = undefined;

const Type = TIN_TYPE("", "", (i) => null, {})
const Int = TIN_TYPE("", "", (i) => Number(i), {})
const String = TIN_TYPE("", "", (i) => String(i), {})
const Void = TIN_TYPE("", "", (i) => null, {})
const Array = (T) => TIN_TYPE("Array", "", (args) => ({
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
Array._typeId = "Array"

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
		return 'Lambda'
	}

	if (Reflect.ownKeys(obj).includes("Array")) {
		let result = '[';
		for (let i = 0; i < obj.length(); i++) {
			result += obj.at(i) + (i === obj.length() - 1 ? "" : ", ")
		}
		return result + "]"
	}

	if (typeof obj === 'object') {
		let result = '';
		let number = 0;
		for (let componentKey of Reflect.ownKeys(obj)) {
			const component = obj[componentKey]
			if (++number > 1) {
				result += " & "
			}
			result += componentKey + "("
			for (let key in component) {
				if (component.hasOwnProperty(key)) {
					if (key.startsWith("__")) {
						continue
					}
					result += makeString(key) + '=' + makeString(component[key]) + ',';
				}
			}
			if (result.length > 1 && result[result.length - 1] === ",") {
				result = result.slice(0, -1); // Remove trailing comma and space
			}
			result += ")"
		}
		if (result.length > 1 && result[result.length - 1] === ")") {
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
export var Iterator = /* [] */(T) => TIN_TYPE("Iterator", "8f4436e0-349b-42e5-a2e3-609821c9fd57", (_p0) => ({next: _p0}), {}); Iterator._typeId = "Iterator";;
export var Iterable = /* [] */(T) => TIN_TYPE("Iterable", "d296e249-1db8-44cb-8f45-f9c3aa99139c", (_p0,_p1,_p2) => ({forEach: _p0,mkString: _p1,getIterator: _p2}), {}); Iterable._typeId = "Iterable";;
export var makeIterable/* [T] => (() => Iterator[T]) => Iterable[T]*/ = function(T) {
return function(getIterator) {
var forEach/* ((T) => Nothing) => Nothing*/ = function(fn) {
var iterator/* Iterator[T]*/ = getIterator();
var current/* T?*/ = iterator[Iterator._typeId].next();
while (current != nothing) {
 fn(current);
current = iterator[Iterator._typeId].next() 
}
};
var mkString/* (String, String, String) => String*/ = function(separator = ", ", left = "", right = "") {
var string/* String*/ = "";
var fn/* (T) => Any*/ = function(t) {
var comma/* String*/ = ((string == "") ? ("") : (separator)) ;
return string = "" + string + "" + comma + "" + t + ""
};
forEach(fn);
return "" + left + "" + string + "" + right + ""
};
return Iterable.call('Type', T)(forEach, mkString, getIterator)
}
}