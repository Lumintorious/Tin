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
export var ListHead = /* [] */(T) => TIN_TYPE("ListHead", "e871a80a-ff08-44b6-8b58-6192ce17d606", (_p0,_p1) => ({value: _p0,rest: _p1}), {}); ListHead._typeId = "ListHead";;
export var List = /* [] */(T) => (_TIN_INTERSECT_OBJECTS(_TIN_INTERSECT_OBJECTS(_TIN_INTERSECT_OBJECTS(ListHead.call('Type', T), Iterable.call('Type', T)), Accessible.call('Type', T)), ToString));
export var List$iterator/* [T] => (list:ListHead[T]?) -> Iterator[T]*/ = function(T) {
return function(list) {
var currentList/* ListHead[T]?*/ = list;
var nextF/* () -> T?*/ = function() {
return ((currentList != nothing) ? ((function(){var result/* T*/ = currentList.ListHead.value;
currentList = currentList.ListHead.rest;
return result}).call(this)) : (nothing)) 
};
return Iterator.call('Type', T)(nextF)
}
};
export var List$accessible/* [T] => (list:ListHead[T]) -> Accessible[T]*/ = function(T) {
return function(list) {
var length/* () -> Number*/ = function() {
var num/* Number*/ = 0;
var l/* ListHead[T]*/ = list;
while (l != nothing) {
 num = num + 1 
};
return num
};
var at/* (index:Number) -> T*/ = function(index) {
var currentIndex/* Number*/ = 0;
var l/* ListHead[T]*/ = list;
while (currentIndex < index) {
 ((l != nothing) ? (l = l.ListHead.rest) : (null)) ;
currentIndex = currentIndex + 1 
};
return l.ListHead.value
};
return (Accessible.call('Type', T)(at, length))
}
};
export var List$of/* [T] => (arr:Array[T]) -> ListHead[T]? & Iterable[T] & Accessible[T] & Struct(ToString)*/ = function(T) {
return function(arr) {
var i/* Number*/ = arr.Array.length();
var list/* ListHead[T]?*/ = (nothing) /* as ListHead.call('Type', T) */;
while (i > 0) {
 i = i - 1;
list = ListHead.call('Type', T)(arr.Array.at(i), list) 
};
var iterable/* Iterable[T]*/ = Iterable.call('Type', T)(function() {
return List$iterator.call('Type', T)(list)
});
var toStr/* (this:Any) -> String*/ = function() {
return iterable.Iterable.mkString.call(iterable,",", "List(", ")")
};
return (_TIN_INTERSECT_OBJECTS(_TIN_INTERSECT_OBJECTS(_TIN_INTERSECT_OBJECTS(list, iterable), List$accessible.call('Type', T)(list)), ToString(toStr)))
}
};
export var List$fromIterator/* [T] => (getIterator:() -> Iterator[T]) -> ListHead[T]? & Iterable[T]*/ = function(T) {
return function(getIterator) {
var list/* ListHead[T]?*/ = nothing;
var iterator/* Iterator[T]*/ = getIterator();
var current/* T?*/ = iterator.Iterator.next();
while (current != nothing) {
 list = ListHead.call('Type', T)(current, list);
current = iterator.Iterator.next() 
};
return (_TIN_INTERSECT_OBJECTS(list, Iterable.call('Type', T)(function() {
return List$iterator.call('Type', T)(list)
})))
}
}