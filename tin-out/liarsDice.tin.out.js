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
import * as module0 from "./collections.tin.out.js";Object.entries(module0).forEach(([key, value]) => {
			globalThis[key] = value;
	  });;
import * as module1 from "./refinements.tin.out.js";Object.entries(module1).forEach(([key, value]) => {
			globalThis[key] = value;
	  });;
;
export var Roll = _TIN_UNION_OBJECTS(_TIN_UNION_OBJECTS(_TIN_UNION_OBJECTS(_TIN_UNION_OBJECTS(_TIN_UNION_OBJECTS(1, 2), 3), 4), 5), 6);
export var dicePerPlayer/* Number*/ = 5;
export var Cup = TIN_TYPE("d0f417e1-a164-4d4e-9812-5b85831b3acb", (_p0) => ({dice: _p0}), {});
export var rollDice/* () => Roll*/ = function() {
return (getRandomInt(1, 7)) /* as Roll */
};
export var rollCup/* () => Cup*/ = function() {
return Cup(Array(0)([rollDice(), rollDice(), rollDice(), rollDice(), rollDice()]))
};
export var binomialCoefficient/* (Number, Number) => Number*/ = function(n, k) {
return ((k > n) ? (0) : ((function(){var coefficient/* Number*/ = 1;
var i/* Number*/ = 0;
while (i < k) {
 coefficient = coefficient * (n - i) / (i + 1);
i = i + 1 
};
return coefficient})())) 
};
export var binomialProbability/* (Number, Number, Number) => Number*/ = function(k, n, p) {
var pComplement/* Number*/ = 1 - p;
var nMinusK/* Number*/ = n - k;
var coefficient/* Number*/ = binomialCoefficient(n, k);
return coefficient * (p ** k) * (pComplement ** nMinusK)
};
export var getFaceCount/* (Number, Cup) => Number*/ = function(bidFace, cup) {
var i/* Number*/ = 0;
var count/* Number*/ = 0;
while (i < cup.dice.length()) {
 ((cup.dice.at(i) == bidFace) ? (count = count + 1) : (null)) ;
i = i + 1 
};
return count
};
export var bidProbability/* (Number, Number, Cup, Number) => Number*/ = function(bidCount, bidFace, myCup, totalCups) {
var totalDice/* Number*/ = totalCups * dicePerPlayer;
var myFaceCount/* Number*/ = getFaceCount(bidFace, myCup);
var neededElsewhere/* Number | 0*/ = ((bidCount > myFaceCount) ? (bidCount - myFaceCount) : (0)) ;
var remainingDice/* Number*/ = totalDice - myCup.dice.length();
var probability/* Number*/ = 0;
var i/* Number | 0*/ = neededElsewhere;
while (i < remainingDice) {
 probability = probability + binomialProbability(i, remainingDice, 1 / 3);
i = i + 1 
};
return probability
};
export var myCup/* Cup*/ = rollCup();
print(myCup.dice);
print(bidProbability(4, 3, Cup(Array(0)([3, 3, 4, 5, 1])), 2))