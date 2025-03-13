const __tin_varargs_marker = Symbol();

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
const Array = (T) => TIN_TYPE("Array", "", (args) => args[__tin_varargs_marker] ? args : ({
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

const arrayOf = (t) => (args) => args
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
		console.dir(obj)
		for (let i = 0; i < obj.Array.length(); i++) {
			result += obj.Array.at(i) + (i === obj.Array.length() - 1 ? "" : ", ")
		}
		return result + ")"
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
					result += /* makeString(key) + '=' +  */makeString(component[key]) + ',';
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
export var Iterator = /* [] */(T) => TIN_TYPE("Iterator", "f4babe01-6b23-4e20-93a1-4746e9d2ddff", (_p0,_p1 = function(t) {
return print("Hello")
}) => ({next: _p0,consumeAll: _p1}), {}); Iterator._typeId = "Iterator";;
export var Accessible = /* [] */(T) => TIN_TYPE("Accessible", "0e0feac6-66d7-4f2a-9962-af136e78864e", (_p0,_p1) => ({at: _p0,length: _p1}), {}); Accessible._typeId = "Accessible";;
;
export var ToString = TIN_TYPE("ToString", "26d79486-d32d-4f9d-a6fd-f649ae338680", (_p0) => ({toString: _p0}), {}); ToString._typeId = "ToString";;
export var stringOf/* (Any) => String*/ = function(obj) {
return ((ToString.__is_child(obj) ) ? ((function(){debug(obj.ToString.toString.call(obj));
return obj.ToString.toString.call(obj)}).call(this)) : (makeString(obj))) 
};
export var Iterable = /* [] */(T) => TIN_TYPE("Iterable", "830ee98f-6bd7-409f-95ff-268e0242356c", (_p0,_p1,_p2,_p3) => ({forEach: _p0,mkString: _p1,count: _p2,getIterator: _p3}), {}); Iterable._typeId = "Iterable";;
export var makeIterable/* [T] => (() => Iterator[T]) => Iterable[T]*/ = function(T) {
return function(getIterator) {
var forEach/* ((T) => Nothing) => Nothing*/ = function(fn) {
var iterator/* Iterator[T]*/ = getIterator();
var current/* T?*/ = iterator.Iterator.next();
while (current != nothing) {
 fn(current);
current = iterator.Iterator.next() 
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
var count/* ((T) => Boolean) => Number*/ = function(pred) {
var num/* Number*/ = 0;
var fn/* (T) => Any?*/ = function(t) {
return ((pred(t)) ? (num = num + 1) : (null)) 
};
forEach(fn);
return num
};
return Iterable.call('Type', T)(forEach, mkString, count, getIterator)
}
}