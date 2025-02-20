function TIN_TYPE(typeId, constructorRaw, descriptor) {
	const constructor = (...args) => {
		const result = constructorRaw(...args)
		if (result !== undefined) {
			result.__tin_typeIds = [typeId]
		}
		return result;
	}
	constructor._tinFields = descriptor;
	constructor._tinTypeId = typeId;
	constructor["&"] = () => {
		return TIN_TYPE("", () => null, {})
	}
	constructor["|"] = () => {
		return TIN_TYPE("", () => null, {})
	}
	constructor.toString = () => {
		return descriptor.toString()
	}
	constructor.__is_child = (obj) =>
		obj.__tin_typeIds.includes(typeId)

	return constructor;
}

const _TIN_INTERSECT_OBJECTS = function (obj1, obj2) {
	if (obj1 === undefined) {
		return obj2
	}
	if (obj2 === undefined) {
		return obj1
	}
	const result = { ...obj1, ...obj2 }
	result.__tin_typeIds = [...(obj1.__tin_typeIds ?? []), ... (obj2.__tin_typeIds ?? [])]
	return result
}

const _TIN_UNION_OBJECTS = function (obj1, obj2) {
	return [obj1, obj2]
}

const nothing = undefined;

const Type = TIN_TYPE("", (i) => null, {})
const Int = TIN_TYPE("", (i) => Number(i), {})
const String = TIN_TYPE("", (i) => String(i), {})
const Void = TIN_TYPE("", (i) => null, {})
const Array = (T) => TIN_TYPE("Array", (args) => ({
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

	if (obj.__tin_typeIds.includes("Array")) {
		let result = '[';
		for (let i = 0; i < obj.length(); i++) {
			result += obj.at(i) + (i === obj.length() - 1 ? "" : ", ")
		}
		return result + "]"
	}

	if (typeof obj === 'object') {
		let result = 'data(';
		for (let key in obj) {
			if (obj.hasOwnProperty(key)) {
				if (typeof obj[key] === "function" || key.startsWith("__")) {
					continue
				}
				result += makeString(key) + '=' + makeString(obj[key]) + ',';
			}
		}
		if (result.length > 1) {
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
import * as module1 from "file://C:\\Users\\Razvan\\Documents\\Tin\\tin-out\\collections\\List.tin.out.js";Object.entries(module1).forEach(([key, value]) => {
			globalThis[key] = value;
	  });;
import * as module2 from "file://C:\\Users\\Razvan\\Documents\\Tin\\tin-out\\refinements.tin.out.js";Object.entries(module2).forEach(([key, value]) => {
			globalThis[key] = value;
	  });;
export var myList/* ListHead[Number]? & Iterable[Number]*/ = listOf.call('Type', Number)(Array(0)([1, 2, 3, 4]));
print(myList.mkString(",", "[", "]"));
export var Cat = TIN_TYPE("87c5cdf8-4e5f-44db-8f65-c716fb7456b5", (_p0,_p1) => ({name: _p0,age: _p1}), {});
export var cat/* Cat?*/ = Cat("C", 1);
export var age/* Number?*/ = cat?.age;
print(cat);
export var num/* Number & NonZero?*/ = checkNonZero(3);
export var divide/* (Number, Number & NonZero) => Number*/ = function(numerator, denominator) {
return numerator / denominator
};
((num != nothing) ? (divide(6, num)) : (null)) 