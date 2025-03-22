export const __tin_varargs_marker = Symbol();

export const TIN_TYPE_CACHE = new Map()

/** LEGEND
	Type Constructors:
		_S = Struct
		_L = Literal
		_U = Union
		_A = Intersection (AND)

	Utility Functions:
		._t = Type Check
		._c = Constructor for Descriptor
		._d = Descriptor of Constructor
		._s = Type Symbol, on Constructors, Descriptors 
*/
export class Return {
	constructor(value) {
		this.value = value;
	}
}

Object.prototype.__is_child = function (obj) {
	if (this._c && this._c.__is_child) {
		return this._c.__is_child(obj)
	}
	throw new Error("Unhandled")
}

export function _S(symbol, constructorRaw, descriptor) {
	descriptor._s = symbol;
	const constructor = (...args) => {
		const result = constructorRaw(...args)
		return {
			_type: descriptor,
			[symbol]: result
		};
	}
	TIN_TYPE_CACHE.set(symbol, constructor)
	constructor._s = symbol;
	descriptor._c = constructor;
	globalThis[symbol] = constructor;
	constructor._d = descriptor;
	constructor._typeId = symbol.description;
	constructor.toString = () => {
		return descriptor.toString()
	}
	constructor.__is_child = (obj) => {
		if (descriptor[Type._s]?.check && descriptor[Type._s]?.check(obj)) {
			return true;
		}
		return (typeof obj === "object") && Reflect.ownKeys(obj).includes(symbol)
	}

	return constructor;
}

export function Type$of(obj) {
	if (typeof obj === "number") {
		return Number._d;
	}
	if (typeof obj === "string") {
		return String._d;
	}
	if (obj === undefined || obj.null === null) {
		return Null
	}
	let result = obj._type
	if (result._d) {
		result = result._d
	}
	return result;
}

export function Type$get(obj) {
	let result = obj

	if (result._d) {
		result = result._d
	}
	if (result._d) {
		result = result._d
	}
	return result;
}

export function Union$getValuesRaw(objType) {
	if (objType[Union._s]) {
		const left = Union$getValuesRaw(objType[Union._s].left)
		const right = Union$getValuesRaw(objType[Union._s].right)
		return Array(objType)([...left[Array._s]._rawArray, ...right[Array._s]._rawArray])
	} else if (objType[Literal._s]) {
		return Array(objType)([objType[Literal._s].value])
	} else {
		return Array(Null)([])
	}
}

export function _F(typeId, lambda, type) {
	lambda._type = type;
	lambda._typeId = typeId;
	lambda._d = type
	return lambda;
}

// function _TIN_MAKE_LAMBDA(type)
Object.prototype._and = function (other) {
	return _A(this, other)
}

Object.prototype._findComponentField = function (arrComponentSymbols, fieldName) {
	for (const symbol of Reflect.ownKeys(this)) {
		for (const componentSymbol of arrComponentSymbols) {
			if (symbol === componentSymbol) {
				return this[symbol][fieldName]
			}
		}
	}

	throw new Error("Could not find field " + fieldName)
}

export const _A = function (obj1, obj2, isReflection = false) {
	if (obj1?._s && obj2?._s) {
		const obj1Descriptor = obj1?._d ? obj1?._d : obj1
		const obj2Descriptor = obj2?._d ? obj2?._d : obj2
		if (obj1.isReflectiveType || obj2.isReflectiveType) {
			return obj1;
		}

		let descriptor = {};
		if (Intersection?._s) {
			descriptor = Type(
				"Hello",
				(obj) => {
					return obj1Descriptor[Type._s].check(obj) && obj2Descriptor[Type._s].check(obj)
				})._and(
					Intersection(obj1Descriptor, obj2Descriptor)
				)
		}

		const intersection = (...args) => {
			const result = obj2(...args)
			result._type = descriptor
			return result;
		}
		intersection._d = descriptor;
		descriptor._c = intersection;
		const symbol = obj2._s;
		TIN_TYPE_CACHE.set(symbol, intersection)
		intersection._s = symbol;
		// globalThis[symbol] = intersection;
		intersection._typeId = symbol.description;
		intersection.toString = () => {
			return descriptor.toString()
		}
		// Object.assign(intersection, obj1, obj2)
		intersection._s = symbol
		intersection.__is_child = (obj) => {
			return obj1.__is_child(obj) && obj2.__is_child(obj)
		}

		return intersection
	}

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
					try {
						if (!originalKey.startsWith(_)) {
							newObj[key][originalKey] = obj2Module[originalKey]
						}
					} catch (e) { }
				}
			}
		} else {
			newObj[key] = obj2[key]
		}
	}
	newObj._type = _A(obj1._type, obj2._type)
	return newObj
}

export const _U = function (obj1, obj2) {
	if ((!obj1._s || !obj2._s) && (typeof obj1 !== "number" && typeof obj2 !== "number")) {
		throw new Error("Unioning objects is not possible.");
	}
	if (!obj1._s) {
		obj1 = Type$of(obj1)
	}
	if (!obj2._s) {
		obj2 = Type$of(obj2)
	}
	if (obj1._d) {
		obj1 = obj1._d
	}
	if (obj2._d) {
		obj2 = obj2._d
	}
	function check(obj) {
		return obj1[Type._s].check(obj) || obj2[Type._s].check(obj);
	}

	const result = Type("Union", check)._and(Union(obj1, obj2));
	result.__is_child = check
	result._s = Symbol("Union")

	return result
}

export function _L(value) {
	function check(obj) {
		return obj === value;
	}
	let broaderType = Null;
	if (typeof value === "number") {
		broaderType = Number;
	} else if (typeof value === "strin") {
		broaderType = String
	}

	const result = Type("" + value, check, check)._and(Literal(value, broaderType))
	result.__is_child = check
	result._s = Symbol("Literal")

	return result
}

export const nothing = undefined;


export function arraySymbol() {
	const cache = globalThis["_arraySymbol"];
	if (!cache) {
		globalThis["_arraySymbol"] = Symbol("Array");
		return globalThis["_arraySymbol"]
	}
	return cache;
}

export var Array = (function () {
	const result = (T) => _S(arraySymbol(), (args) => args[__tin_varargs_marker] ? args : ({
		_rawArray: args,
		length() {
			return args.length;
		},
		at(index) {
			return args[index]
		},
		and(arr) {
			return Array(T)([...args, ...arr[Array._s]._rawArray])
		},
		[__tin_varargs_marker]: true
	}), {})
	result._s = arraySymbol()
	return result;
})()

export const Array$of = (t) => (args) => args
Array._typeId = "Array"

export const copy = (T) => (obj) => {
	const newObj = {};
	for (let key of Reflect.ownKeys(obj)) {
		newObj[key] = { ...obj[key] }
	}
	return newObj;
}

export function getRandomInt(min, max) {
	const minCeiled = Math.ceil(min);
	const maxFloored = Math.floor(max);
	return Math.floor(Math.random() * (maxFloored - minCeiled) + minCeiled); // The maximum is exclusive and the minimum is inclusive
}

export function makeString(obj, sprawl = false) {
	if (obj === null) return 'nothing';
	if (typeof obj === 'undefined') return 'nothing';
	if (typeof obj === 'boolean') return obj ? 'true' : 'false';
	if (typeof obj === 'number') return obj.toString();
	if (typeof obj === 'string') return obj;
	if (typeof obj === 'symbol') return obj.description;

	if (typeof obj === 'function') {
		return 'λ'
	}

	if (Reflect.ownKeys(obj).includes(Array._s)) {
		let result = 'Array(';
		for (let i = 0; i < obj[Array._s].length(); i++) {
			result += makeString(obj[Array._s].at(i)) + (i === obj[Array._s].length() - 1 ? "" : ", ")
		}
		return result + ")"
	}

	if (typeof obj === 'object') {
		let result = sprawl ? '(' : "";
		let number = 0;
		for (let componentKey of Reflect.ownKeys(obj)) {
			if (!componentKey.description) {
				continue;
			}
			const component = obj[componentKey]
			if (!sprawl) {
				result += componentKey.description + "("
			}
			for (let key in component) {
				if (component.hasOwnProperty(key)) {
					if (key.startsWith("__")) {
						continue
					}
					if (sprawl) {
						result += componentKey.description + "."
					}
					if (!key.startsWith("_") && component[key] != obj) {
						result += key + "=" + makeString(component[key], sprawl) + ', ';
					}
				}
			}
			if (result.length > 1 && result[result.length - 2] === ",") {
				result = result.slice(0, -2); // Remove trailing comma and space
			}
			result += sprawl ? ", " : ") & "
		}
		if (result.length > 1 && ((sprawl && result[result.length - 2] === ",") || (!sprawl && result[result.length - 2] === "&"))) {
			result = result.slice(0, sprawl ? -2 : -3); // Remove trailing comma and space
		}
		return result + (sprawl ? ')' : "");
	}

	return ''; // For other types like functions, symbols, etc.
}

export const print = (arg) => {
	console.log(makeString(arg))
}

export const debug = (...args) => {
	console.log(...args)
}

export const jsonify = (obj) => {
	return JSON.stringify(obj, (key, value) => {
		if (typeof key === "symbol") {
			return undefined; // Skip if needed
		}
		if (typeof value === "object" && value !== null) {
			// Convert symbol keys to strings
			const newObj = {};
			Object.getOwnPropertySymbols(value).forEach(sym => {
				newObj[`#${String(sym.description)}`] = value[sym];
			});
			return { ...value, ...newObj };
		}
		return value;
	}, 2);
}

export const dejsonify = function (json) {
	return JSON.parse(json, function (key, value) {
		if (typeof key === "string" && key.startsWith("#")) {
			const description = key.slice(1);
			const sym = TIN_TYPE_CACHE.get(description)._s;
			this[sym] = value; // Attach symbol key to the object
			return undefined;  // Prevent duplicate normal key
		}
		return value;
	});
}

export function lazy(make) {
	if (typeof make !== "function") {
		return make;
	}
	let value = undefined;
	let temp = {};
	const result = function () {
		if (!value) {
			value = make();
		}
		return value;
	};
	return new Proxy(result, {
		get(target, prop) {
			if (!value) {
				result()
				Object.assign(value, temp)
			}
			if (prop === "_d" && value) {
				return value;
			}
			return target[prop];
		},
		set(target, prop, v) {
			if (value) {
				value[prop] = v;
			} else {
				temp[prop] = v;
			}
			return true;
		}
	})
}

// COMPILED TIN
