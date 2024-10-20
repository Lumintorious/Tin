function TIN_TYPE(typeId, constructor, descriptor) {
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
	return constructor
}

const _TIN_INTERSECT_OBJECTS = function (obj1, obj2) {
	return { ...obj1, ...obj2 }
}

const _TIN_UNION_OBJECTS = function (obj1, obj2) {
	return [obj1, obj2]
}

const Type = TIN_TYPE("", (i) => null, {})
const Int = TIN_TYPE("", (i) => Number(i), {})
const String = TIN_TYPE("", (i) => String(i), {})
const Void = TIN_TYPE("", (i) => null, {})
const Array = TIN_TYPE("", (args) => ({
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

const print = (...args) => {
	if (args[0].hasOwnProperty("toString")) {
		console.log(args.toString())
	} else {
		console.log(...args)
	}
}
const list = []

// COMPILED TIN
;
var apply/* [T] => (T, (T) => T) => T*/ = function(T) {
return function(thing, func) {
return func(thing)
}
};
var addOne/* (Number) => Number*/ = function(i) {
return i + 1
};
var x/* Number*/ = apply.call('Type', Number)(12, addOne);
print(x);
var Cat = TIN_TYPE("0a349a58-08a0-4956-8b2e-510fd2d88252", (_p0) => ({name: _p0}), {name: { type: String, defaultValue: undefined }}); var makeCat = Cat;;
var Robot = TIN_TYPE("d9bb1d3f-3301-45ff-8796-491ab7274bdc", (_p0) => ({version: _p0}), {version: { type: Number, defaultValue: undefined }}); var makeRobot = Robot;;
var Robocat = _TIN_INTERSECT_OBJECTS(Cat, Robot);
var makeRoboKitty/* (String, Number) => Cat & Robot*/ = function(name, version) {
return _TIN_INTERSECT_OBJECTS(makeCat(name), makeRobot(version))
};
print(makeRoboKitty("Kitkat", 1.2));
var sumOf/* (Array[Number]) => Number*/ = function(things) {
var sum/* Number*/ = 0;
for (var i/* ???*/ = 0;i < things.length();i = i + 1) {
 sum = sum + things.at(i) 
};
return sum
};
print(sumOf(Array([1, 2, 3, 4])))