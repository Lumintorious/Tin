const __tin_varargs_marker = Symbol();

const TIN_TYPE_CACHE = new Map()

function TIN_TYPE(symbol, constructorRaw, descriptor) {
	const constructor = (...args) => {
		const result = constructorRaw(...args)
		return {
			[symbol]: result
		};
	}
	TIN_TYPE_CACHE.set(symbol, constructor)
	constructor._symbol = symbol;
	globalThis[symbol] = constructor;
	constructor.descriptor = descriptor;
	constructor._typeId = symbol.description;
	constructor.toString = () => {
		return descriptor.toString()
	}
	constructor.__is_child = (obj) => {
		return (typeof obj === "object") && Reflect.ownKeys(obj).includes(typeId)
	}

	return constructor;
}

function TIN_LAMBDA(typeId, lambda, type) {
	lambda.type = type;
	lambda.typeId = typeId;
	return lambda;
}

// function _TIN_MAKE_LAMBDA(type)
Object.prototype._and = function (other) {
	return _TIN_INTERSECT_OBJECTS(this, other)
}

const _TIN_INTERSECT_OBJECTS = function (obj1, obj2) {
	if (obj1._typeId && obj2._typeId) {
		if (obj2.descriptor.Type.tag === "Struct") {
			const clone = (...args) => obj2(...args)
			Object.assign(clone, obj1, obj2)
			return clone
		}
		return {}
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


function arraySymbol() {
	const cache = globalThis["_arraySymbol"];
	if (!cache) {
		globalThis["_arraySymbol"] = Symbol("Array");
		return globalThis["_arraySymbol"]
	}
	return cache;
}
const Array = (function () {
	const result = (T) => TIN_TYPE(arraySymbol(), (args) => args[__tin_varargs_marker] ? args : ({
		_rawArray: args,
		length() {
			return args.length;
		},
		at(index) {
			return args[index]
		},
		[__tin_varargs_marker]: true
	}), {})
	result._symbol = arraySymbol()
	return result;
})()

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

function makeString(obj, sprawl = false) {
	if (obj === null) return 'nothing';
	if (typeof obj === 'undefined') return 'nothing';
	if (typeof obj === 'boolean') return obj ? 'true' : 'false';
	if (typeof obj === 'number') return obj.toString();
	if (typeof obj === 'string') return obj;

	if (typeof obj === 'function') {
		return 'λ'
	}

	if (Reflect.ownKeys(obj).includes(Array._symbol)) {
		let result = 'Array(';
		for (let i = 0; i < obj[Array._symbol].length(); i++) {
			result += makeString(obj[Array._symbol].at(i)) + (i === obj[Array._symbol].length() - 1 ? "" : ", ")
		}
		return result + ")"
	}

	if (typeof obj === 'object') {
		let result = sprawl ? '(' : "";
		let number = 0;
		for (let componentKey of Reflect.ownKeys(obj)) {
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
					result += key + "=" + makeString(component[key], sprawl) + ', ';
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

const print = (arg) => {
	console.log(makeString(arg))
}

const debug = (...args) => {
	console.log(...args)
}

const jsonify = (obj) => {
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

const dejsonify = function (json) {
	return JSON.parse(json, function (key, value) {
		if (typeof key === "string" && key.startsWith("#")) {
			const description = key.slice(1);
			const sym = TIN_TYPE_CACHE.get(description)._symbol;
			this[sym] = value; // Attach symbol key to the object
			return undefined;  // Prevent duplicate normal key
		}
		return value;
	});
}

function lazy(make) {
	let value = undefined;
	return function () {
		if (!value) {
			value = make();
		}
		return value;
	}
}

// COMPILED TIN
