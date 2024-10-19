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
	}
}), {})

const print = (...args) => console.log(...args)
const list = []

// COMPILED TIN
;
var Person/* ???*/ = TIN_TYPE("5bb433fb-0177-483b-b025-d1b2bf675bc7", (_p0,_p1,_p2) => ({name: _p0,house: _p1,title: _p2}), {name: { type: String, defaultValue: undefined },house: { type: String, defaultValue: undefined },title: { type: String, defaultValue: undefined }}); var makePerson = Person;;
var robert/* Person*/ = makePerson("Robert", "Baratheon", "King of the Seven Kingdoms");
var hail/* (Person) => String*/ = function(p/* Person*/) {
return "Hails " + p.name + " of House " + p.house + ", " + p.title + "!"
};
var addAll/* (Array[Number]) => Array[Number]*/ = function(xs/* Array[Number]*/) {
return xs
};
var xs/* Array[Number]*/ = addAll(Array([1, 2, 3]));
print(xs.length());
print(hail(robert))