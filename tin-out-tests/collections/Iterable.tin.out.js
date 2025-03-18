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
export let Iterator = /* [] */(T) => TIN_TYPE("Iterator", "0050bbca-a4dc-44b0-90c3-f4ace7a3c60e", (_p0) => ({next: _p0}), {}); Iterator._typeId = "Iterator";;
export let Accessible = /* [] */(T) => TIN_TYPE("Accessible", "1121addb-99d4-4ace-acb3-a3a719a0036f", (_p0,_p1) => ({at: _p0,length: _p1}), {}); Accessible._typeId = "Accessible";;
;
export let ToString = TIN_TYPE("ToString", "6ef3ac5e-a476-4d6b-8eb3-99fa1ab8b9f8", (_p0) => ({toString: _p0}), {}); ToString._typeId = "ToString";;
export let stringOf/* (obj:Any) -> String*/ = function(obj) {
return ((ToString.__is_child(obj) ) ? (((() => { const _owner = obj; return _owner.ToString.toString.call(_owner,)})())) : (makeString(obj))) 
};
export let Iterable = /* [] */(T) => TIN_TYPE("Iterable", "da45405b-d17c-40d7-a92e-77c44074129d", (_p0,_p1,_p2,_p3) => ({forEach: _p0,mkString: _p1,count: _p2,getIterator: _p3}), {}); Iterable._typeId = "Iterable";;
export let makeIterable/* [T] -> (getIterator:() -> Iterator[T]) -> Iterable[T]*/ = function(T) {
return function(getIterator) {
let forEach/* (fn:(T) -> Nothing) -> Nothing*/ = function(fn) {
let iterator/* Iterator[T]*/ = getIterator();
let current/* T?*/ = ((() => { const _owner = iterator; return _owner.Iterator.next.call(_owner,)})());
while (current != nothing) {
 fn(current);
let current/* T?*/ = ((() => { const _owner = iterator; return _owner.Iterator.next.call(_owner,)})()) 
}
};
let mkString/* (separator:String, left:String, right:String) -> String*/ = function(separator = ", ", left = "", right = "") {
let string/* String*/ = "";
let fn/* (t:T) -> Any*/ = function(t) {
let comma/* String*/ = ((string == "") ? ("") : (separator)) ;
return string = "" + string + "" + comma + "" + t + ""
};
forEach(fn);
return "" + left + "" + string + "" + right + ""
};
let count/* (pred:(T) -> Boolean) -> Number*/ = function(pred) {
let num/* Number*/ = 0;
let fn/* (t:T) -> Any?*/ = function(t) {
return ((pred(t)) ? (num = num + 1) : (null)) 
};
forEach(fn);
return num
};
return Iterable.call('Type', T)(forEach, mkString, count, getIterator)
}
}