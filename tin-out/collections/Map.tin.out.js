const __tin_varargs_marker = Symbol();

function TIN_TYPE(typeId, typeHash, constructorRaw, descriptor) {
	const symbol = Symbol();
	const constructor = (...args) => {
		const result = constructorRaw(...args)
		return {
			[symbol]: result
		};
	}
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

// COMPILED TIN
;
import * as module0 from "file://C:\\Users\\Razvan\\Documents\\Tin\\tin-out\\collections\\Iterable.tin.out.js";Object.entries(module0).forEach(([key, value]) => {
			globalThis[key] = value;
	  });;


	const JsMap = globalThis.Map;

;
export var MapOps = /* [] */(K, V) => TIN_TYPE("MapOps", "dda21daf-1de3-4161-9dc0-8e37fcd9e190", (_p0,_p1,_p2) => ({put: _p0,get: _p1,remove: _p2}), {
		Type: {
			tag: "Struct",
			name: "MapOps",
				fields: [
					{
			Field: {
				name: "put",
				type: {
		Type: {
			tag: "Lambda",
			name: undefined,
			parameters: [{
			Field: {
				name: "key",
				type: () => K,
				defaultValue: () => { return (undefined);},
			}
		},,{
			Field: {
				name: "value",
				type: () => V,
				defaultValue: () => { return (undefined);},
			}
		},],
			returnType: ???
		}
	},
				defaultValue: () => { return (undefined);},
			}
		},,{
			Field: {
				name: "get",
				type: {
		Type: {
			tag: "Lambda",
			name: undefined,
			parameters: [{
			Field: {
				name: "key",
				type: () => K,
				defaultValue: () => { return (undefined);},
			}
		},],
			returnType: ???
		}
	},
				defaultValue: () => { return (undefined);},
			}
		},,{
			Field: {
				name: "remove",
				type: {
		Type: {
			tag: "Lambda",
			name: undefined,
			parameters: [{
			Field: {
				name: "key",
				type: () => K,
				defaultValue: () => { return (undefined);},
			}
		},],
			returnType: ???
		}
	},
				defaultValue: () => { return (undefined);},
			}
		},
		]
		}
	}); MapOps._typeId = "MapOps";;
export var MapEntry = /* [] */(A, B) => TIN_TYPE("MapEntry", "159437a6-00b0-4e07-90ef-6bd895c5cc16", (_p0,_p1) => ({key: _p0,value: _p1}), {
		Type: {
			tag: "Struct",
			name: "MapEntry",
				fields: [
					{
			Field: {
				name: "key",
				type: () => A,
				defaultValue: () => { return (undefined);},
			}
		},,{
			Field: {
				name: "value",
				type: () => B,
				defaultValue: () => { return (undefined);},
			}
		},
		]
		}
	}); MapEntry._typeId = "MapEntry";;
export var Map = /* [] */(K, V) => _TIN_INTERSECT_OBJECTS(MapOps.call('Type', K, V), Iterable.call('Type', MapEntry.call('Type', K, V)));
export var Map$entry/* [A, B] -> (key:A, value:B) -> MapEntry[A, B]*/ = function(A, B) {
return TIN_LAMBDA("cf6527db-279d-4ffa-ae66-9ce298acc682", function(key, value) {
return MapEntry.call('Type', A, B)(key, value)
}, {
		Type: {
			tag: "Lambda",
			name: undefined,
			parameters: [{
			Field: {
				name: "key",
				type: () => A,
				defaultValue: () => { return (undefined);},
			}
		},,{
			Field: {
				name: "value",
				type: () => B,
				defaultValue: () => { return (undefined);},
			}
		},],
			returnType: ???
		}
	})
};
;
export var Map$create/* [K, V] -> Map[K, V]*/ = function(K, V) {
return Map$of.call('Type', K, V)(Array(0)([]))
};


	const Map$of = (K, V) => (args) => {
		const map = new JsMap(args.Array._rawArray.map(p => [p.MapEntry.key, p.MapEntry.value]))
		const ops = MapOps(K, V)(
			function(key, value)  {
				map.set(key, value);
				return this;
			}, 
			(key) => map.get(key),
			function (key) {
				map.delete(key);
				return this;
			}
		)
		const getIterator = () => {
			const jsIterator = map.keys();
			return Iterator(MapEntry(K, V))(
				() => {
					const n = jsIterator.next();
					if (!n.done) {
						return MapEntry(K, V)(n.value, map.get(n.value))
					} else {
						return undefined;
					}
				}
			)
		}

		return _TIN_INTERSECT_OBJECTS(ops, Iterable(MapEntry(K, V))(getIterator));
	}

