function TIN_TYPE(typeId, constructorRaw, descriptor) {
	const constructor = (...args) => {
		const result = constructorRaw(...args)
		result.__tin_typeIds = [typeId]
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
const Array = (T) => TIN_TYPE("", (args) => ({
	length() {
		console.log("called")
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
var ListHead = /* [] */(T) => TIN_TYPE("a2b3bb4a-a34b-470d-b4b8-cf50126ba30d", (_p0,_p1) => ({value: _p0,rest: _p1}), {});
var List = /* [] */(T) => ListHead.call('Type', T);
var s/* String*/ = "Hello";
var listOf/* [T] => (Array[T]) => List[T]*/ = function(T) {
return function(arr) {
var i/* Number*/ = arr.length();
var list/* List[T]*/ = nothing;
while (i > 0) {
 i = i - 1;
list = ListHead.call('Type', T)(arr.at(i), list) 
};
return list
}
};
var mkString/* [T] => (List[T]) => String*/ = function(T) {
return function(originalList) {
var list/* List[T]*/ = originalList;
var string/* String*/ = "";
while (list != nothing) {
 print("Hey");
var comma/*  | , */ = ((string == "") ? ("") : (", ")) ;
string = "" + string + "" + comma + "" + list.value + "";
list = list.rest 
};
return string
}
};
var head/* List[Number]*/ = listOf.call('Type', Number)(Array(0)([1, 2, 3]));
var r/* String*/ = mkString.call('Type', String)(head);
print(r)