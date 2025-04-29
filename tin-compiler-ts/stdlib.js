export const __tin_varargs_marker = Symbol();

export const TIN_TYPE_CACHE = new Map()
export const _JsArr = globalThis.Array;

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
	const type = (typeof this === 'object' && "_" in this) ? this._ : this
	console.log(type)
	if (type._c && type._c.__is_child) {
		if (typeof obj === 'object' && "_" in obj) {
			return type._c.__is_child(obj._)
		} else {
			return type._c.__is_child(obj);
		}
	} else if (Type._s in type) {
		return type[Type._s].check._(obj)
	}
	throw new Error("Unhandled")
}

Object.prototype.toString = function () {
	return makeStr(this, true, true)
}

export function _S(symbol, constructorRaw, descriptor, proto) {
	descriptor._s = symbol;
	const constructor = (...args) => {
		const result = constructorRaw(...args)
		// console.log(Reflect.ownKeys(result))
		for (let key of Reflect.ownKeys(result)) {
			if (typeof key === "string" && key.startsWith("_")) continue;
			if (result[key] === undefined) {
				delete result[key]
			} else if (typeof result[key] === 'object' && !("_" in result[key])) {
				result[key] = [result[key]]
			}
		}
		Object.setPrototypeOf(result, proto)
		const _clojure = result._clojure ? { ...result._clojure } : {};
		delete result._clojure
		return {
			_clojure,
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
		if (descriptor[Type._s]?.check?._ && descriptor[Type._s]?.check._(obj)) {
			return true;
		}
		return (typeof obj === "object") && Reflect.ownKeys(obj).includes(symbol)
	}
	descriptor.__is_child = constructor.__is_child

	return constructor;
}

export function _Q(symbol, func, descriptor) {
	func._s = symbol;
	return func;
}

export function Type$of(obj) {
	if (obj === undefined) {
		return undefined;
	}
	if (typeof obj === "number") {
		return Number._d;
	}
	if (typeof obj === "string") {
		return String._d;
	}
	if (obj === undefined || obj.null === null) {
		return Nothing
	}
	let result = obj._type || obj._d || obj
	if (result._d) {
		result = result._d
	}
	return result;
}

export function Type$get(obj) {
	if (obj === undefined || obj === null) {
		return Nothing;
	}
	let result = obj

	if (result._d) {
		result = result._d
	}
	if (result._d) {
		result = result._d
	}
	return result;
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

const _INTERSECTION_MAP = new Map();

function _getCachedIntersection(a, b) {
	if (!_INTERSECTION_MAP.has(a)) _INTERSECTION_MAP.set(a, new WeakMap());
	const inner = _INTERSECTION_MAP.get(a);
	return inner.get(b);
}

export const _A = function (obj1, obj2, isReflection = false) {
	// If they are types
	if (obj1?._s && obj2?._s) {
		const obj1Descriptor = obj1?._d ? obj1?._d : obj1
		const obj2Descriptor = obj2?._d ? obj2?._d : obj2
		if (obj1.isReflectiveType || obj2.isReflectiveType) {
			return obj1;
		}

		if (obj1Descriptor._s && obj2Descriptor._s) {
			const cachedIntersection = _getCachedIntersection(obj1Descriptor._s, obj2Descriptor._s);
			if (cachedIntersection) {
				return cachedIntersection;
			}
		}

		let descriptor = {};
		if (Intersection?._s) {
			descriptor = Type(
				{ _: obj1Descriptor._s.description + " & " + obj2Descriptor._s.description },
				{
					_: (obj) => {
						return obj1Descriptor[Type._s].check._(obj) && obj2Descriptor[Type._s].check._(obj)
					}
				})._and(
					lazy(() => Intersection({ _: obj1Descriptor }, { _: obj2Descriptor }))
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
		intersection._d._s = symbol;
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

		const inner1IntersectionMap = new WeakMap();
		const inner2IntersectionMap = new WeakMap();
		inner1IntersectionMap.set(obj2._s, intersection)
		inner2IntersectionMap.set(obj1._s, intersection)
		_INTERSECTION_MAP.set(obj1._s, inner1IntersectionMap)
		_INTERSECTION_MAP.set(obj2._s, inner2IntersectionMap)
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
			if (typeof key === 'symbol') {
				commonModules.push(key)
			}
		}
	}
	if (commonModules.length > 0) {
		throw new Error("Cannot merge objects with common modules: " + commonModules.map(s => s.description).join(", "))
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
	let newClojure = {};
	if (obj1._clojure) {
		newClojure = { ...obj1._clojure }
	}
	if (obj2._clojure) {
		newClojure = { ...newClojure, ...obj2._clojure }
	}
	newObj._clojure = newClojure;
	newObj._type = _A(obj1._type, obj2._type)
	return newObj
}

export const _N = function (type) {
	return {
		__is_child: (obj) => !type.__is_child(obj),
		_s: Symbol("!" + type._s.description)
	}
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
		return obj1.__is_child(obj) || obj2.__is_child(obj);
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
	let broaderType = Nothing;
	if (typeof value === "number") {
		broaderType = Number;
	} else if (typeof value === "strin") {
		broaderType = String
	}

	const result = Type({ _: "" + value }, { _: check }, { _: check })._and(Literal({ _: value }, { _: broaderType }))
	result.__is_child = check
	result._s = Symbol("Literal")

	return result
}

export const nothing = null;

export function _var(obj, doVar) {
	if (!doVar) {
		return obj
	} else {
		if (typeof obj === 'object' && "_" in obj) {
			return obj
		} else {
			return { _: obj }
		}
	}
}

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
		length: {
			_: function () {
				return args.length;
			}
		},
		at: {
			_: function (index) {
				if (typeof index !== "number") {
					throw new Error("Index was not number")
				}
				return args[index]
			}
		},
		and: {
			_: function (arr) {
				return Array(T)([...args, ...arr[Array._s]._rawArray])
			}
		},
		[__tin_varargs_marker]: true
	}), {}, {})
	result._s = arraySymbol()
	return result;
})()

export const Array$of = (t) => (args) => args
export const Array$empty = (t) => Array(t)([])
export const Array$and = function (t) { return (function (arr) { return this[Array._s].and._(arr) }) }
Array._typeId = "Array"
export const copy = (obj, replacers) => {
	if (typeof (obj) === 'object' && "_" in obj) {
		return { _: copy(obj._), _cn: obj._cn }
	}

	let newObj = { _type: obj._type };
	let wasUnderscore = false;
	if (typeof (obj) === 'object' && "_" in obj) {
		obj = obj._
		wasUnderscore = true;
	}
	if (obj._clojure) {
		newObj._clojure = {}
	}
	const components = new Set();
	const newFieldsByOldFields = new Map();
	for (let componentKey of Reflect.ownKeys(obj)) {
		const oldComponent = obj[componentKey];
		const newComponent = { ...obj[componentKey] };
		if (typeof componentKey !== "symbol") {
			continue;
		}
		// Duplicate Mutables
		for (let fieldKey of Reflect.ownKeys(oldComponent)) {
			const field = oldComponent[fieldKey];
			let newField;
			if (typeof (field) === 'object' && "_" in field) {
				newField = { _: field._, _cn: field._cn }
				newComponent[fieldKey] = newField
				newFieldsByOldFields.set(field, newField)
			}
		}

		// Assign new component
		newObj[componentKey] = newComponent;
		newFieldsByOldFields.set(oldComponent, newComponent)
	}

	if (obj._clojure) {
		newObj._clojure = { ...obj._clojure }
		for (const clojureKey of Object.keys(obj._clojure)) {
			const clojureCapture = obj._clojure[clojureKey]
			for (const [key, value] of newFieldsByOldFields) {
				if (key === clojureCapture) {
					newObj._clojure[clojureKey] = newFieldsByOldFields.get(clojureCapture);
				}
				if (typeof clojureCapture === 'object')
					for (const captureComponentSym of Reflect.ownKeys(clojureCapture)) {
						if (typeof captureComponentSym !== "symbol") {
							continue;
						}
						const captureComponent = clojureCapture[captureComponentSym]
						if (key === captureComponent) {
							newObj._clojure[clojureKey] = { [captureComponentSym]: value };
						}
					}
			}
		}
	}

	_replaceComponentFields(newObj, replacers)
	if (wasUnderscore) {
		return [newObj]
	}
	return newObj;
}

export function _replaceComponentFields(obj, replacer) {
	if (typeof obj !== "object") {
		return obj;
	}
	if (typeof replacer !== 'object' || replacer === null) {
		return obj;
	}
	for (const componentKey of Reflect.ownKeys(replacer)) {
		if (typeof componentKey !== 'symbol') {
			continue;
		}
		const replacerComponent = replacer[componentKey];
		for (const fieldKey of Reflect.ownKeys(replacerComponent)) {
			const replacerField = replacerComponent[fieldKey]
			const objField = obj?.[componentKey]?.[fieldKey]
			if (objField !== undefined && replacerField !== undefined) {
				obj[componentKey][fieldKey] = replacerField
				if (objField._cn && !replacerField._cn) {
					replacerField._cn = objField._cn

					if (replacerField._cn && obj._clojure[replacerField._cn]) {
						obj._clojure[replacerField._cn] = replacerField
					}
				}
				// if (typeof (objField) === 'object' && ("_" in objField) && !(objField["_cn"] === undefined)) {
				const oldObjField = objField
				obj[componentKey][fieldKey] = replacerField;
				for (const clojureKey of Reflect.ownKeys(obj._clojure)) {
					const clojureField = obj._clojure[clojureKey]
					if (clojureField === oldObjField) {
						obj._clojure[clojureKey] = replacerField
					}
				}
				// }
			}
		}

	}

	return obj;
}

export const _o = function (objParam) {
	let obj = objParam;
	if (typeof obj === 'object' && "_" in obj) {
		obj = obj._
	}
	if (!obj._clojure) {
		obj._clojure = {}
	}
	for (const key of Reflect.ownKeys(obj)) {
		if (key.startsWith("_")) continue;
		const field = obj[key]
		if (field && field._clojure) {
			Object.assign(obj._clojure, field._clojure)
			// delete field._clojure
		}
		if (field && field._?._clojure) {
			Object.assign(obj._clojure, field._?._clojure)
			// delete field._clojure
		}
	}

	return objParam;
}

export const _makeClojure = (clojure, objParam) => {
	let obj = (typeof objParam === 'object' && ("_" in objParam)) ? objParam._ : objParam;
	function setObj(newObj) {
		if (typeof objParam === 'object' && ("_" in objParam)) {
			objParam._ = newObj;
		} else {
			objParam = newObj;
		}
		obj = newObj;
	}

	for (const key of Reflect.ownKeys(clojure)) {
		if (!(typeof (clojure[key]) === 'object') || !("_" in clojure[key])) {
			clojure[key] = { _: clojure[key] }
		}
	}

	if (typeof obj === "function") {
		const old = obj;
		old._clojure = clojure;
		setObj(function (...args) {
			const self = !this || this === globalThis ? { _clojure: clojure } : this;
			return old.call(self, ...args)
		});
	}

	if (typeof obj !== "object" && typeof obj !== "function") {
		return objParam;
	}

	obj._clojure = clojure;
	// objParam._clojure = clojure;

	return objParam;
}

export function _call(owner, fn, params) {
	return fn.call(owner, ...params)
}

export function _cast(obj, type) {
	if (typeof (type) === 'object' && "_" in type) {
		type = type._
	}
	let objToTest = obj;
	if (typeof (obj) === 'object' && "_" in obj) {
		objToTest = obj._;
	}

	if (type.__is_child !== undefined && type.__is_child(objToTest)) {
		return obj
	} else {
		console.log(type._s)
		console.log(objToTest)
		console.log(type.__is_child(objToTest))
		throw new Error(`'${makeStr(objToTest, true, true)}' was not of type ${(type?._d ?? type)?._s?.description}`)
	}
}

export function getRandomInt(min, max) {
	const minCeiled = Math.ceil(min);
	const maxFloored = Math.floor(max);
	return Math.floor(Math.random() * (maxFloored - minCeiled) + minCeiled); // The maximum is exclusive and the minimum is inclusive
}

function blue(str) {
	return `\x1b[34m${str}\x1b[0m`
}

function yellow(str) {
	return `\x1b[93m${str}\x1b[0m`
}

function white(str) {
	return `\x1b[37m${str}\x1b[0m`
}

function orange(str) {
	return `\x1b[33m${str}\x1b[0m`
}

function green(str) {
	return `\x1b[32m${str}\x1b[0m`
}

export function makeString(obj, sprawl = false, indent = 0, currentIndent = 0) {
	function padd(currentIndentChange = 0) {
		return "".padStart((currentIndent + currentIndentChange * indent), " ".padEnd(indent, " "))
	}

	if (obj === null) return green('nothing');
	if (typeof obj === 'undefined') return green('nothing');
	if (typeof (obj) === 'object' && "_" in obj) {
		obj = obj._
	}

	if (typeof obj === 'boolean') return green(obj ? 'true' : 'false');
	if (typeof obj === 'number') return green("" + obj);
	if (typeof obj === 'string') return green(currentIndent > 0 ? `"${obj}"` : obj);
	if (typeof obj === 'symbol') return obj.description;

	if (typeof obj === 'function') {
		return blue('λ')
	}

	if (Reflect.ownKeys(obj).includes(Array._s)) {
		let result = yellow("Array") + white('(') + (indent > 0 ? "\n" : "");
		for (let i = 0; i < obj[Array._s].length._(); i++) {
			result += (typeof obj[Array._s].at._(i) === "object" ? padd() : padd(1)) + makeString(obj[Array._s].at._(i), sprawl, indent, currentIndent) + (i === obj[Array._s].length._() - 1 ? "" : white(", ")) + (indent > 0 ? "\n" : "")
		}

		currentIndent -= indent;
		return result + padd() + white(")")
	}

	if (typeof obj === 'object') {
		if (obj[ToString._s]?.toString?._) {
			return obj[ToString._s]?.toString?._.call(obj)
		}

		let result = sprawl ? white('(') : "";
		let number = 0;
		// if (obj._clojure) {
		// 	result += `\n[${Object.keys(obj._clojure).join(",")}]\n`
		// }
		for (let componentKey of Reflect.ownKeys(obj)) {
			if (!componentKey.description) {
				continue;
			}
			const component = obj[componentKey]
			if (!sprawl) {
				result += yellow(componentKey.description) + white("(") + (indent > 0 ? "\n" : "")
				currentIndent += indent;
			}
			for (let key in component) {
				if (key.startsWith("__")) {
					continue
				}
				if (sprawl) {
					result += componentKey.description + "."
				}
				if (!key.startsWith("_") && component[key] != obj) {
					result += padd() + key + white(" = ") + makeString(component[key], sprawl, indent, currentIndent + indent) + white(', ') + (indent > 0 ? "\n" : "");
				}
			}
			if (result.length > 1 && result[result.length - 2] === ",") {
				result = result.slice(0, -2); // Remove trailing comma and space
			}
			result += indent > 0 ? padd(-1) : ""
			result += sprawl ? white(", ") : white(") & ")
			result += indent > 0 ? "\n" : ""
			currentIndent -= indent;
		}
		// if (result.length > 1 && ((sprawl && result[result.length - 2] === ",") || (!sprawl && result[result.length - 3] === "4"))) {
		// 	result = result.slice(0, sprawl ? -4 : -3); // Remove trailing comma and space
		// }
		if (result.length > 2 && indent > 0 && result[result.length - 7] === "&") {
			result = result.slice(0, -7)
		}
		result = result + (sprawl ? white(')') : "")
		return result;
	}

	return ''; // For other types like functions, symbols, etc.
}

export function makeStr(obj, useToString, firstLayer = false) {

	if (obj === null) return green('nothing');
	if (typeof obj === 'undefined') return green('nothing');
	if (typeof obj === 'object' && "_" in obj) {
		obj = obj._
	}
	if (obj === null) return green('nothing');
	if (typeof obj === 'undefined') return green('nothing');

	if (typeof obj === 'boolean') return green(obj ? 'true' : 'false');
	if (typeof obj === 'number') return green("" + obj);
	if (typeof obj === 'string') return !firstLayer ? green(`"${obj}"`) : green(obj);
	if (typeof obj === 'symbol') return obj.description;

	if (typeof obj === 'function') {
		return blue('λ')
	}

	if (Reflect.ownKeys(obj).includes(Array._s)) {
		let result = yellow("Array") + white('(');
		for (let i = 0; i < obj[Array._s].length._(); i++) {
			result += makeStr(obj[Array._s].at._(i)) + (i === obj[Array._s].length._() - 1 ? "" : white(", "))
		}

		return result + white(")")
	}

	if (useToString && obj[ToString._s]?.toString?._) {
		return obj[ToString._s]?.toString?._.call(obj)
	}

	const results = [];
	for (const componentKey of Reflect.ownKeys(obj)) {
		if (typeof componentKey !== 'symbol') continue;
		const component = obj[componentKey]
		const componentName = (componentKey.description === "Tuple2" || componentKey.description === "Tuple3") ? "" : componentKey.description
		results.push(yellow(componentName) + white(" { ") + Reflect.ownKeys(component).map(k => makeStr(component[k])).join(white(", ")) + white(" } "))
	}

	return results.join(" & ")
}

export function String$matches(regex) {
	return this.match(regex) !== null
}

export function panic(message) {
	const err = TinErr_({ _: message }, { _: undefined })._and(StackInfo({ _: Array(String)([]) }));
	setTimeout(() => { }, 0);
	throw err
}

export function _addStack(tinErr, line) {
	if (tinErr[StackInfo._s]) {
		tinErr[StackInfo._s].stack._[Array._s]._rawArray.push(line)
	}
	return tinErr
}

// process.on('uncaughtException', (err) => {
// 	if (TinErr_._s in err) {
// 		console.log("Panic! " + err[TinErr_._s].message._)
// 	}
// 	if (StackInfo && StackInfo._s in err) {
// 		for (let i = 0; i < err[StackInfo._s].stack._[Array._s].length._(); i++) {
// 			console.log("  at " + err[StackInfo._s].stack._[Array._s].at._(i))
// 		}
// 	}

// })

export const printRaw = (arg) => {
	console.log(makeStr(arg, false, true))
}

export const print = (arg) => {
	console.log(makeStr(arg, true, true))
}

export const debug = (...args) => {
	console.dir(...args.map(arg => {
		if (arg === undefined) {
			return undefined;
		} else
			if (arg._type) {
				const { _type, ...rest } = arg
				return rest;
			} else {
				return arg;
			}
	}), { depth: null })
}

export function clojure(obj) {
	debug(obj._clojure ?? obj._?.clojure)
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

export const assert = (condition, message) => {
	if (!condition) {
		throw new Error(message ?? "Assertion failed")
	}
}

export function Struct$accessDynamically(obj, field) {
	const f = obj[this._s][field[Field._s].name._]
	if (typeof f === 'object' && f._) {
		return f._
	} else {
		return f
	}
}

export function Struct$createDynamically(args) {
	const constructor = this._c
	if (!constructor) throw new Error("Called create on non-struct.")
	const arr = args[Array._s]._rawArray;
	const fieldArr = this[Struct._s].fields._[Array._s]._rawArray;
	for (let i = 0; i < arr.length; i++) {
		const fieldType = fieldArr[i][Field._s].type._;
		if (!fieldType[Type._s].check._(arr[i])) {
			throw new Error("Could not coerce " + makeStr(arr[i]) + " to " + fieldType._s.description)
		}
	}
	return constructor.call(this, ...arr)
}

// COMPILED TIN
