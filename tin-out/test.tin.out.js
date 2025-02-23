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
	constructor.__is_child = (obj) =>
		Reflect.ownKeys(obj).includes(typeId)
	// obj.__tin_typeIds.includes(typeId)

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
const Array = (T) => TIN_TYPE("Array", "", (args) => ({
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
Array._typeId = "Array"

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
		return 'Lambda'
	}

	if (Reflect.ownKeys(obj).includes("Array")) {
		let result = '[';
		for (let i = 0; i < obj.length(); i++) {
			result += obj.at(i) + (i === obj.length() - 1 ? "" : ", ")
		}
		return result + "]"
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
					result += makeString(key) + '=' + makeString(component[key]) + ',';
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
import * as module1 from "file://C:\\Users\\Razvan\\Documents\\Tin\\tin-out\\collections\\List.tin.out.js";Object.entries(module1).forEach(([key, value]) => {
			globalThis[key] = value;
	  });;
export var Cat = TIN_TYPE("Cat", "e5a94d37-0e51-4c1a-8775-1ff2fd4eb0dd", (_p0) => ({name: _p0}), {}); Cat._typeId = "Cat";;
export var CatMeow = TIN_TYPE("CatMeow", "6e9bbe29-7265-44a8-8300-d0159deb938e", (_p0) => ({meow: _p0}), {}); CatMeow._typeId = "CatMeow";;
export var CatPurr = TIN_TYPE("CatPurr", "6b1abc00-472a-43c1-88e2-1b7977e2b834", (_p0) => ({purr: _p0}), {}); CatPurr._typeId = "CatPurr";;
export var meow/* (Cat) => Nothing*/ = function() {
return print("Meow, I'm " + this[Cat._typeId].name)
};
export var purr/* (Cat) => () => Nothing*/ = function(cat) {
return function() {
return print("Prr, I'm " + cat[Cat._typeId].name)
}
};
export var cat/* Cat & CatMeow*/ = _TIN_INTERSECT_OBJECTS(Cat("Kitty"), CatMeow(meow));
cat[CatMeow._typeId].meow.call(cat);
cat[Cat._typeId].name = "A dude";
cat[CatMeow._typeId].meow.call(cat);
export var catTwoData/* Cat*/ = Cat("Kitty");
export var catTwo/* Cat & CatPurr*/ = _TIN_INTERSECT_OBJECTS(catTwoData, CatPurr(purr(catTwoData)));
catTwo[CatPurr._typeId].purr();
catTwo[Cat._typeId].name = "A dude";
catTwo[CatPurr._typeId].purr()