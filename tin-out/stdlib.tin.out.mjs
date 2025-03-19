const __tin_varargs_marker = Symbol();

const TIN_TYPE_CACHE = new Map()

function TIN_TYPE(typeId, typeHash, constructorRaw, descriptor) {
	const symbol = Symbol(typeHash);
	const constructor = (...args) => {
		const result = constructorRaw(...args)
		return {
			[symbol]: result
		};
	}
	TIN_TYPE_CACHE.set(typeHash, constructor)
	constructor._symbol = symbol;
	globalThis[symbol] = constructor;
	constructor.descriptor = descriptor;
	constructor._typeId = typeId;
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

const _TIN_INTERSECT_OBJECTS = function (obj1, obj2) {
	if (obj1._typeId && obj2._typeId) {
		if (obj2.descriptor.Type.tag === "Struct") {
			const clone = (...args) => obj2(...args)
			Object.assign(clone, obj2, obj1)
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

// const Int = TIN_TYPE("", "", (i) => Number(i), {})
// const String = TIN_TYPE("", "", (i) => String(i), {})
// const Void = TIN_TYPE("", "", (i) => null, {})
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
			for (let key in component) {
				if (component.hasOwnProperty(key)) {
					if (key.startsWith("__")) {
						continue
					}
					result += globalThis[componentKey]._typeId + "." + key + "=" + makeString(component[key]) + ', ';
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

// COMPILED TIN
;
export var Type = TIN_TYPE("Type", "b97e0a1a-3518-465a-96a7-ee8ae0d52b38", (_p0,_p1 = TIN_LAMBDA("137f697e-ccfd-42c7-b9b6-0d624cf2fcae", function(o) {
return false
}, {
			Type: {
				tag: "Lambda",
				name: undefined,
				parameters: [{
				Field: {
					name: "o",
					type: () => Any,
					defaultValue: () => { return (undefined)},
				}
			},],
				returnType: {}
			}
		}),_p2 = TIN_LAMBDA("aaf0085c-5f93-4e45-91b2-c4b2643d8017", function(o) {
return false
}, {
			Type: {
				tag: "Lambda",
				name: undefined,
				parameters: [{
				Field: {
					name: "o",
					type: () => Any,
					defaultValue: () => { return (undefined)},
				}
			},],
				returnType: {}
			}
		})) => ({tag: _p0,check: _p1,checkDeep: _p2}), {
			Type: {
				tag: "Struct",
				name: "Type",
					fields: [
						{
				Field: {
					name: "tag",
					type: () => String,
					defaultValue: () => { return (undefined)},
				}
			},,{
				Field: {
					name: "check",
					type: {
			Type: {
				tag: "Lambda",
				name: undefined,
				parameters: [{
				Field: {
					name: "o",
					type: () => Any,
					defaultValue: () => { return (undefined)},
				}
			},],
				returnType: {}
			}
		},
					defaultValue: () => { return (TIN_LAMBDA("9a9d0eab-e66c-4d8f-8a6c-8d6e96475bbc", function(o) {
return undefined
}, {
			Type: {
				tag: "Lambda",
				name: undefined,
				parameters: [{
				Field: {
					name: "o",
					type: () => Any,
					defaultValue: () => { return (undefined)},
				}
			},],
				returnType: {}
			}
		}))},
				}
			},,{
				Field: {
					name: "checkDeep",
					type: {
			Type: {
				tag: "Lambda",
				name: undefined,
				parameters: [{
				Field: {
					name: "o",
					type: () => Any,
					defaultValue: () => { return (undefined)},
				}
			},],
				returnType: {}
			}
		},
					defaultValue: () => { return (TIN_LAMBDA("8063bbbb-9eb4-4a72-9809-47a322f4f260", function(o) {
return undefined
}, {
			Type: {
				tag: "Lambda",
				name: undefined,
				parameters: [{
				Field: {
					name: "o",
					type: () => Any,
					defaultValue: () => { return (undefined)},
				}
			},],
				returnType: {}
			}
		}))},
				}
			},
			]
			}
		});
export var RefData = TIN_TYPE("RefData", "79180a2c-bfb8-4223-9666-29ed00142499", (_p0) => ({get: _p0}), {
			Type: {
				tag: "Struct",
				name: "RefData",
					fields: [
						{
				Field: {
					name: "get",
					type: {
			Type: {
				tag: "Lambda",
				name: undefined,
				parameters: [],
				returnType: () => Type
			}
		},
					defaultValue: () => { return (undefined)},
				}
			},
			]
			}
		});
export var RefType$create/* (tag:String, get:() -> Type) -> Type & RefData*/ = TIN_LAMBDA("d08ddb62-26f6-4261-b3bf-4f9d51cea3d2", function(tag, get) {
return _TIN_INTERSECT_OBJECTS(Type(tag), RefData(get))
}, {
			Type: {
				tag: "Lambda",
				name: undefined,
				parameters: [{
				Field: {
					name: "tag",
					type: () => String,
					defaultValue: () => { return (undefined)},
				}
			},,{
				Field: {
					name: "get",
					type: {
			Type: {
				tag: "Lambda",
				name: undefined,
				parameters: [],
				returnType: () => Type
			}
		},
					defaultValue: () => { return (undefined)},
				}
			},],
				returnType: {}
			}
		});
export var Field = TIN_TYPE("Field", "151ad275-5b32-48a0-aa35-6ee6adff5b49", (_p0,_p1,_p2) => ({name: _p0,tpe: _p1,defaultValue: _p2}), {
			Type: {
				tag: "Struct",
				name: "Field",
					fields: [
						{
				Field: {
					name: "name",
					type: () => String,
					defaultValue: () => { return (undefined)},
				}
			},,{
				Field: {
					name: "tpe",
					type: () => Type,
					defaultValue: () => { return (undefined)},
				}
			},,{
				Field: {
					name: "defaultValue",
					type: {},
					defaultValue: () => { return (undefined)},
				}
			},
			]
			}
		});
export var Parameter = TIN_TYPE("Parameter", "3a77df21-819f-47c4-ae99-93ffed1e2a1b", (_p0,_p1,_p2) => ({name: _p0,tpe: _p1,defaultValue: _p2}), {
			Type: {
				tag: "Struct",
				name: "Parameter",
					fields: [
						{
				Field: {
					name: "name",
					type: {},
					defaultValue: () => { return (undefined)},
				}
			},,{
				Field: {
					name: "tpe",
					type: () => Type,
					defaultValue: () => { return (undefined)},
				}
			},,{
				Field: {
					name: "defaultValue",
					type: {},
					defaultValue: () => { return (undefined)},
				}
			},
			]
			}
		});
export var StructData = TIN_TYPE("StructData", "71d76d3f-9433-47e1-bea1-06379ef7d7c7", (_p0,_p1) => ({name: _p0,fields: _p1}), {
			Type: {
				tag: "Struct",
				name: "StructData",
					fields: [
						{
				Field: {
					name: "name",
					type: () => String,
					defaultValue: () => { return (undefined)},
				}
			},,{
				Field: {
					name: "fields",
					type: {},
					defaultValue: () => { return (undefined)},
				}
			},
			]
			}
		});
export var Lambda = _TIN_INTERSECT_OBJECTS(Type, TIN_TYPE("Lambda", "d0f3cbcf-ec9e-443f-9759-006fa7501c77", (_p0,_p1) => ({name: _p0,params: _p1}), {
			Type: {
				tag: "Struct",
				name: "Lambda",
					fields: [
						{
				Field: {
					name: "name",
					type: {},
					defaultValue: () => { return (undefined)},
				}
			},,{
				Field: {
					name: "params",
					type: {},
					defaultValue: () => { return (undefined)},
				}
			},
			]
			}
		}));
export var l/* Type & Lambda*/ = _TIN_INTERSECT_OBJECTS(Type("Hi"), Lambda(undefined, Array$of(0)(Array(0)([1]))));
print(l[Type._symbol].tag);
;
