export const __tin_varargs_marker = Symbol();

export const TIN_TYPE_CACHE = new Map()
export const _JsArr = globalThis.Array;
process.chdir('../');

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
		._ta = Type Arguments
*/
export function _ss(obj) {
	if (obj._s) {
		return obj
	}
}

export class Return {
	constructor(value) {
		this.value = value;
	}
}

Object.prototype.toString = function () {
	return makeStr(this, true, true)
}

Object.prototype.__is_child = function (obj) {
	const type = (typeof this === 'object' && "_" in this) ? this._ : this
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
		for (let key of Reflect.ownKeys(result)) {
			if (typeof key === "string" && key.startsWith("_")) continue;
			if (result[key] === undefined) {
				delete result[key]
			} else if (typeof result[key] === 'object' && !("_" in result[key])) {
				result[key] = { _: result[key] }
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

const _Q_map = new Map()

export function _Q_share(calleeSym, argSyms) {
	try {
		return calleeSym
		if (argSyms === undefined || argSyms.length === 0) {
			return calleeSym
		}
		const key = calleeSym.description + "[" + argSyms.map(s => {
			return typeof s === 'object' && "_s" in s ? s._s.description : s.description
		}).join(", ") + "]"
		if (_Q_map.has(key)) {
			return _Q_map.get(key)
		} else {
			const result = Symbol(key)
			_Q_map.set(key, result)
			return result
		}
	} catch (e) {
		console.error(calleeSym)
		console.error(argSyms)
		throw e;
	}
}

export function _Q(symbol, func, descriptor) {
	const newFunc = (...args) => {
		const callReturn = func(...args)
		let result = callReturn;
		if (typeof callReturn === 'function') {
			const subFunc = (...oArgs) => {
				const subResult = callReturn(...oArgs);
				// Object.assign(subResult, callReturn)
				subResult[symbol]._ta = args
				return subResult
			}
			subFunc._s = callReturn._s;
			subFunc.__is_child = (obj) => {
				if (callReturn._isRefinement) {
					return callReturn.__is_child(obj);
				}
				if ((typeof obj === "object") && Reflect.ownKeys(obj).includes(symbol)) {
					for (let i = 0; i < args.length; i++) {
						if (args[i]._s !== obj[symbol]._ta[i]._s) {
							return false;
						}
					}
					return callReturn.__is_child(obj);
				} else {
					return false;
				}
			}
			result = subFunc;
		}
		return result;
	}
	Object.assign(newFunc, func)
	newFunc._s = symbol;
	newFunc.__is_child = (obj) => {
		return (typeof obj === "object") && Reflect.ownKeys(obj).includes(symbol);
	}
	return newFunc;
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

const shared_syms = new Map();

function _sym_share(name) {
	if (!shared_syms.has(name)) {
		shared_syms.set(name, Symbol(name))
	}
	return shared_syms.get(name)
}

export const _U = function (obj1, obj2, name) {

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
	const result = Type(name, check)._and(Union(obj1, obj2));
	result._s = name ? _sym_share(name) : Symbol("Union")
	result.__is_child = check

	return result
}

const _L_cache = new Map()

export function _L(value) {
	function check(obj) {
		return obj === value;
	}
	let broaderType = Nothing;
	if (typeof value === "number") {
		broaderType = Number;
	} else if (typeof value === "string") {
		broaderType = String
	}

	const result = Type({ _: "" + value }, { _: check }, { _: check })._and(Literal({ _: value }, { _: broaderType }))
	result.__is_child = check
	result._s = _L_cache.get(value) ?? Symbol("" + value)
	if (!_L_cache.has(value)) {
		_L_cache.set(value, result._s)
	}

	return result
}

export const nothing = null;

function set(newValue) {
	this._ = newValue;
	for (let i = 0; i < this.subscribers.length; i++) {
		this.subscribers[i].notify();
	}
}

function notify() {
	this.set(this.fn())
}

export function _var(deps, fn, doVar, clojureName) {
	// fn = (typeof fn === 'function') ? fn : () => fn
	const obj = fn();
	const subscribers = [];
	let result = {};
	if (!doVar) {
		if (obj && typeof obj === 'object' && "_" in obj) {
			result = { _: obj._, _cl: clojureName }
		} else {
			result = { _: obj, _cl: clojureName }
		}
	} else {
		if (obj && typeof obj === 'object' && "_" in obj) {
			result = { _: obj._, subscribers, fn, set, notify, _cl: clojureName }
		} else {
			result = { _: obj, subscribers, fn, set, notify, _cl: clojureName }
		}
		deps.forEach(d => d.subscribers.push(result))
	}
	return result;
}

function _copyUnderline(v) {
	if ("set" in v) {
		return {
			_: v._, subscribers: [], fn: v.fn, set, notify, _cl: v._cl
		}
	} else {
		return { _: v._, _cl: v._cl }
	}
}

export const delay = (ms, fn) => {
	setTimeout(fn, ms);
}

export const listen = (T) => (v, fn) => {
	v.subscribers.push({ notify() { fn(v._) } })
}

export function arraySymbol() {
	const cache = globalThis["_arraySymbol"];
	if (!cache) {
		globalThis["_arraySymbol"] = Symbol("Seq");
		return globalThis["_arraySymbol"]
	}
	return cache;
}

export var Seq = (function () {
	const _sqSym = Symbol("Seq")
	const result = _Q(_sqSym, (T) => {
		const _sqSym_args = [T._s]

		return _S(_Q_share(_sqSym, _sqSym_args), (args) => args[__tin_varargs_marker] ? args : ({
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
					return Seq(T)([...args, ...arr[Array._s]._rawArray])
				}
			},
			[__tin_varargs_marker]: true
		}), {}, {})
	})
	return result;
})()

export const Array$of = (t) => (args) => args
export const Array$empty = (t) => Seq(t)([])
export const Array$and = function (t) { return (function (arr) { return this[Array._s].and._(arr) }) }
Seq._typeId = "Seq"


export const copy = (obj, replacers) => {
	if (typeof (obj) === 'object' && "_" in obj) {
		return _copyUnderline(obj)//{ _: copy(obj._), _cn: obj._cn, _cl: obj._cl }
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
				newField = _copyUnderline(field)
				// newField = { _: field._, _cn: field._cn, _cl: field._cl }
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

	// _replaceComponentFields(newObj, replacers)
	if (wasUnderscore) {
		return [newObj]
	}
	return newObj;
}

// export function _replaceComponentFields(obj, replacer) {
// 	if (typeof obj !== "object") {
// 		return obj;
// 	}
// 	if (typeof replacer !== 'object' || replacer === null) {
// 		return obj;
// 	}
// 	for (const componentKey of Reflect.ownKeys(replacer)) {
// 		if (typeof componentKey !== 'symbol') {
// 			continue;
// 		}
// 		const replacerComponent = replacer[componentKey];
// 		for (const fieldKey of Reflect.ownKeys(replacerComponent)) {
// 			const replacerField = replacerComponent[fieldKey]
// 			const objField = obj?.[componentKey]?.[fieldKey]
// 			if (objField !== undefined && replacerField !== undefined) {
// 				obj[componentKey][fieldKey] = replacerField
// 				if (objField._cn && !replacerField._cn) {
// 					replacerField._cn = objField._cn

// 					if (replacerField._cn && obj._clojure[replacerField._cn]) {
// 						obj._clojure[replacerField._cn] = replacerField
// 					}
// 				}
// 				// if (typeof (objField) === 'object' && ("_" in objField) && !(objField["_cn"] === undefined)) {
// 				const oldObjField = objField
// 				obj[componentKey][fieldKey] = replacerField;
// 				for (const clojureKey of Reflect.ownKeys(obj._clojure)) {
// 					const clojureField = obj._clojure[clojureKey]
// 					if (clojureField === oldObjField) {
// 						obj._clojure[clojureKey] = replacerField
// 					}
// 				}
// 				// }
// 			}
// 		}

// 	}

// 	return obj;
// }

export function _copy(obj, fieldReplacers) {
	const copied = copy(obj)
	_replaceComponentFields2(copied, _expand(fieldReplacers))
	return copied;
}

function _expand(obj, sep = "$") {
	const result = {};
	for (const [key, value] of Object.entries(obj)) {
		const parts = key.split(sep);
		let curr = result;
		for (let i = 0; i < parts.length - 1; i++) {
			curr = curr[parts[i]] ??= {};
		}
		curr[parts.at(-1)] = value;
	}
	return result;
}

export function _replaceComponentFields2(obj, replacer) {
	if (typeof obj !== "object") {
		return obj;
	}
	if (typeof replacer !== 'object' || replacer === null) {
		return obj;
	}

	for (const componentKey of Reflect.ownKeys(obj)) {
		if (typeof componentKey !== 'symbol') {
			continue;
		}
		for (const fieldKey of Reflect.ownKeys(obj[componentKey])) {
			let replacerField = replacer[fieldKey]
			const objField = obj?.[componentKey]?.[fieldKey]
			if (objField !== undefined && replacerField !== undefined) {
				replacerField = replacerField._ ?? replacerField;
				if (typeof replacerField === 'object' && !("_type" in replacerField)) {
					const copied = copy(objField._)
					replacerField = _replaceComponentFields2(copied, replacerField)
				} else {
					replacerField = _var([], () => replacerField, true)
				}
				obj[componentKey][fieldKey] = _var([], () => replacerField, true)
				if (objField._cn && !replacerField._cn) {
					replacerField._cn = objField._cn

					if (replacerField._cn && obj._clojure[replacerField._cn]) {
						obj._clojure[replacerField._cn] = replacerField
					}
				}
				if (objField._cl && !replacerField._cl) {
					replacerField._cl = objField._cl

					if (replacerField._cl && obj._clojure[replacerField._cl]) {
						obj._clojure[replacerField._cl] = replacerField
					}
				}
				const oldObjField = objField
				obj[componentKey][fieldKey] = replacerField;
				for (const clojureKey of Reflect.ownKeys(obj._clojure)) {
					const clojureField = obj._clojure[clojureKey]
					if (clojureField === oldObjField) {
						obj._clojure[clojureKey] = replacerField
					}
				}
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
		console.error(type._s)
		console.error(objToTest)
		console.error(type.__is_child(objToTest))
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

function red(str) {
	return `\x1b[31m${str}\x1b[0m`
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

	if (Reflect.ownKeys(obj).includes(Seq._s)) {
		let result = yellow("Seq") + white('(') + (indent > 0 ? "\n" : "");
		for (let i = 0; i < obj[Seq._s].length._(); i++) {
			result += (typeof obj[Seq._s].at._(i) === "object" ? padd() : padd(1)) + makeString(obj[Seq._s].at._(i), sprawl, indent, currentIndent) + (i === obj[Seq._s].length._() - 1 ? "" : white(", ")) + (indent > 0 ? "\n" : "")
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
	const useFieldNames = Console$useFieldNames._;

	if (obj === null) return firstLayer ? 'nothing' : green('nothing');
	if (typeof obj === 'undefined') return firstLayer ? 'nothing' : green('nothing');
	if (typeof obj === 'object' && "_" in obj) {
		obj = obj._
	}
	if (obj === null) return firstLayer ? 'nothing' : green('nothing');
	if (typeof obj === 'undefined') return firstLayer ? 'nothing' : green('nothing');

	if (typeof obj === 'boolean') return firstLayer ? (obj ? 'true' : 'false') : green(obj ? 'true' : 'false');
	if (typeof obj === 'number') return firstLayer ? ("" + obj) : green("" + obj);
	if (typeof obj === 'string') return !firstLayer ? green(`"${obj}"`) : obj;
	if (typeof obj === 'symbol') return obj.description;

	if (typeof obj === 'function') {
		return blue('λ')
	}
	const seqSym = Reflect.ownKeys(obj).filter(s => typeof s === 'symbol' && s.description.startsWith("Seq"))[0];
	if (seqSym) {
		let result = yellow("Seq") + white(' { ');
		for (let i = 0; i < obj[seqSym].length._(); i++) {
			result += makeStr(obj[seqSym].at._(i)) + (i === obj[seqSym].length._() - 1 ? "" : white(", "))
		}

		return result + white(" }")
	}

	if (useToString && obj[ToString._s]?.toString?._) {
		return obj[ToString._s]?.toString?._.call(obj)
	}

	function colorSymbolName(symName) {
		const operators = [",", "[", "]"]
		let i = 0;
		let result = "";
		while (i < symName.length) {
			let block = "";
			let wasFirstLoop = false;
			while (operators.includes(symName[i])) {
				block += symName[i];
				i++;
				wasFirstLoop = true;
			}
			if (wasFirstLoop) {
				result += white(block)
			} else {
				while (i < symName.length && !operators.includes(symName[i])) {
					block += symName[i]
					i++;
				}
				result += yellow(block)
			}
		}
		return result;
	}

	const results = [];
	for (const componentKey of Reflect.ownKeys(obj)) {
		if (typeof componentKey === 'string') continue;
		const component = obj[componentKey]
		const componentName = (componentKey.description.startsWith("Tuple2") || componentKey.description.startsWith("Tuple3")) ? "" : componentKey.description + " "
		const innerFields = Reflect.ownKeys(component).filter(f => f !== undefined && typeof f === 'string' && !f.startsWith("_"));
		results.push(colorSymbolName(componentName) + (innerFields.length === 0 ? "" : (white("{ ") + innerFields.map(k => `${useFieldNames ? `${typeof k === 'symbol' ? k.description : red(k)} ${white("=")} ` : ""}${makeStr(component[k])}`).join(white(", ")) + white(" }"))))
	}

	return results.join(white(" & "))
}

export function printTable(objs /* [] */) {
	// console.log(obj)
	let arr = objs[Seq._s]._rawArray;
	let symbolsSet = [];
	const symbols = [];

	function findSym(sym) {
		return symbols.filter(o => o.symbol === sym)[0]
	}

	arr.forEach(obj => {
		Reflect.ownKeys(obj).filter(s => typeof s === 'symbol').forEach(s => {
			if (!findSym(s)) {
				symbols.push({ symbol: s, fields: [], width: 0 })
			}
		})
	});

	function findField(sym, fieldName) {
		return (findSym(sym) ?? { fields: [] }).fields.filter(o => o.name === fieldName)[0]
	}


	arr.forEach(obj => {
		symbols.forEach(sym => {
			if (obj[sym.symbol]) {
				const fields = Reflect.ownKeys(obj[sym.symbol]).filter(s => typeof s === 'string' && !s.startsWith("_"))
				fields.forEach(fieldName => {
					if (!findField(sym.symbol, fieldName)) {
						findSym(sym.symbol).fields.push({
							name: fieldName,
							width: Math.max(fieldName.length, sym.symbol.description.length)
						})
					}
				})
			}
		})
	})

	arr.forEach(obj => {
		symbols.filter(s => s.symbol in obj).forEach(sym => {
			sym.fields.filter(field => field.name in obj[sym.symbol]).forEach(field => {
				const fieldString = makeStr(obj[sym.symbol][field.name], true, true)
				const unformattedFieldString = fieldString.replaceAll(/\x1b\[[0-9]+m/g, "")
				if (unformattedFieldString.length > field.width) {
					field.width = unformattedFieldString.length
				} else if (sym.width > field.width) {
					field.width = sym.width;
				}
			})
		})
	})

	symbols.forEach(sym => {
		let widthFromFields = sym.fields.reduce((acc, field) => {
			return acc + field.width;
		}, 0);
		widthFromFields += (sym.fields.length - 1) * 4;
		sym.width = sym.symbol.description.length + 1;
		if (widthFromFields > sym.width) {
			sym.width = widthFromFields
		} else {
			const difference = sym.width - widthFromFields;
			if (sym.fields.length > 0) {
				sym.fields[sym.fields.length - 1].width += difference;
			}
		}
	})

	let header = "\x1b[1m|"
	symbols.forEach(sym => {
		header += " " + (sym.symbol.description).padEnd(sym.width + 2) + "|"
	})
	header += "\x1b[0m"

	console.log(header)

	let subHeader = "\x1b[1m|"
	symbols.forEach(sym => {
		sym.fields.forEach(field => {
			subHeader += " " + (field.name).padEnd(field.width + 2) + "|"
		})
	})
	subHeader += "\x1b[0m"

	console.log(subHeader)

	arr.forEach((obj, i) => {
		let row = ((i % 2 === 0) ? "\x1b[90m" : "") + "|"
		symbols.forEach(sym => {
			sym.fields.forEach(field => {
				if (sym.symbol in obj && field.name in obj[sym.symbol]) {
					row += " " + (makeStr(obj[sym.symbol][field.name], true, true).replaceAll(/\x1b\[[0-9]+m/g, "")).padEnd(field.width + 2) + "|"
				} else {
					row += " " + ("").padEnd(field.width + 2) + "|"
				}
			})
		})
		row += "\x1b[0m"
		console.log(row)
	})

	// Get keys per component
	// const keysList = columns.map(col => Object.keys(obj[col]));

	// const fieldWidths = new Map([[Symbol(), new Map([["__", 0]])]]);
	// columns.forEach(s => fieldWidths.set(s, new Map()))

	// columns.forEach(sym => {
	// 	Object.keys(obj[sym]).forEach(field => {

	// 	})
	// })

	// // Calculate column widths
	// const colWidths = keysList.map(keys => {
	// 	const maxKeyLen = Math.max(...keys.map(k => k.length));
	// 	const maxValLen = Math.max(...keys.map(k => {
	// 		const val = obj[columns[keysList.indexOf(keys)]][k];
	// 		return val === undefined ? 0 : ("" + val).length;
	// 	}));
	// 	return Math.max(maxKeyLen, maxValLen, columns[keysList.indexOf(keys)].length) + 2;
	// });

	// // Print top header (components spanning their fields)
	// let header = '|';
	// keysList.forEach((keys, i) => {
	// 	const w = colWidths[i] * keys.length + (keys.length - 1) * 3; // 3 = " | "
	// 	header += ' ' + columns[i].description.padEnd(w) + ' |';
	// });
	// console.log(header);

	// // Print second header (field keys)
	// let subHeader = '|';
	// keysList.forEach((keys, i) => {
	// 	keys.forEach(k => {
	// 		subHeader += ' ' + k.padEnd(colWidths[i]) + ' |';
	// 	});
	// });
	// console.log(subHeader);

	// // Calculate max rows
	// const maxRows = Math.max(...keysList.map(k => k.length));

	// // Print data rows
	// for (let r = 0; r < maxRows; r++) {
	// 	let row = '|';
	// 	keysList.forEach((keys, i) => {
	// 		if (r < keys.length) {
	// 			const key = keys[r];
	// 			const val = obj[columns[i]][key];
	// 			row += ' ' + (val === undefined ? ''.padEnd(colWidths[i]) : ("" + val).padEnd(colWidths[i])) + ' |';
	// 		} else {
	// 			row += ' '.repeat(colWidths[i] + 2) + '|';
	// 		}
	// 	});
	// 	console.log(row);
	// }
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
	Object.entries(obj._clojure).forEach(([k, v]) => {
		debug(k)
		debug(v)
	})
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
				if (value !== undefined) {
					Object.assign(value, temp)
				}
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

export function _interpolation(elems) {
	const _arr = elems.map(e => {
		if (typeof e === 'string') {
			return e
		} else {
			return Interpolation({ _: e[0] }, { _: e[1] })
		}
	});
	const arr = Seq(_U(String, Interpolation))(_arr)
	return InterpolatedString({ _: arr })
}

// COMPILED TIN
