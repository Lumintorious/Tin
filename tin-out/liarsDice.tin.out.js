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
			result += obj.Array.at(i) + (i === obj.Array.length() - 1 ? "" : ", ")
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
import * as module1 from "file://C:\\Users\\Razvan\\Documents\\Tin\\tin-out\\collections\\List.tin.out.js";Object.entries(module1).forEach(([key, value]) => {
			globalThis[key] = value;
	  });;
;
export var Roll = _TIN_UNION_OBJECTS(_TIN_UNION_OBJECTS(_TIN_UNION_OBJECTS(_TIN_UNION_OBJECTS(_TIN_UNION_OBJECTS(1, 2), 3), 4), 5), 6);
export var dicePerPlayer/* Number*/ = 5;
export var Cup = TIN_TYPE("Cup", "81745c5a-9df7-458c-8fad-f45f4f6a40c7", (_p0) => ({dice: _p0}), {}); Cup._typeId = "Cup";;
export var rollDice/* () -> Roll*/ = function() {
return (getRandomInt(1, 7)) /* as Roll */
};
export var rollCup/* () -> Struct(Cup)*/ = function() {
return Cup(Array(0)([rollDice(), rollDice(), rollDice(), rollDice(), rollDice()]))
};
export var binomialCoefficient/* (n:Number, k:Number) -> Number*/ = function(n, k) {
return ((k > n) ? (0) : ((function(){var coefficient/* Number*/ = 1;
var i/* Number*/ = 0;
while (i < k) {
 coefficient = coefficient * (n - i) / (i + 1);
i = i + 1 
};
return coefficient})())) 
};
export var binomialProbability/* (k:Number, n:Number, p:Number) -> Number*/ = function(k, n, p) {
var pComplement/* Number*/ = 1 - p;
var nMinusK/* Number*/ = n - k;
var coefficient/* Number*/ = binomialCoefficient(n, k);
return (coefficient * (p ** k) * (pComplement ** nMinusK))
};
export var getFaceCount/* (bidFace:Number, cup:Cup) -> Number*/ = function(bidFace, cup) {
var i/* Number*/ = 0;
var count/* Number*/ = 0;
while (i < cup.Cup.dice.Array.length()) {
 ((cup.Cup.dice.Array.at(i) == bidFace) ? (count = count + 1) : (null)) ;
i = i + 1 
};
return (count)
};
export var bidProbability/* (bidCount:Number, bidFace:Number, myCup:Cup, totalCups:Number) -> Number*/ = function(bidCount, bidFace, myCup, totalCups) {
var totalDice/* Number*/ = totalCups * dicePerPlayer;
var myFaceCount/* Number*/ = getFaceCount(bidFace, myCup);
var neededElsewhere/* Number*/ = ((bidCount > myFaceCount) ? (bidCount - myFaceCount) : (0)) ;
var remainingDice/* Number*/ = totalDice - myCup.Cup.dice.Array.length();
var probability/* Number*/ = 0;
var i/* Number*/ = neededElsewhere;
while (i < remainingDice) {
 probability = probability + binomialProbability(i, remainingDice, 1 / 3);
i = i + 1 
};
return (probability)
};
export var myCup/* Struct(Cup)*/ = rollCup();
print(myCup.Cup.dice);
print(bidProbability(4, 3, Cup(Array(0)([3, 3, 4, 5, 1])), 2))