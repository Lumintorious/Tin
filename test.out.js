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

_TIN_INTERSECT_OBJECTS = function (obj1, obj2) {
	return { ...obj1, ...obj2 }
}

_TIN_UNION_OBJECTS = function (obj1, obj2) {
	return [obj1, obj2]
}

const Type = TIN_TYPE("", (i) => null, {})
const Int = TIN_TYPE("", (i) => Number(i), {})
const String = TIN_TYPE("", (i) => String(i), {})
const Void = TIN_TYPE("", (i) => null, {})

const print = (...args) => console.log(...args)
const list = []

// COMPILED TIN
;
var Cat  = TIN_TYPE("7029c005-d634-4d02-b367-1914f7033a1f", (_p0,_p1) => ({name: _p0,livesLeft: _p1}), {name: { type: String, defaultValue: undefined },livesLeft: { type: Number, defaultValue: undefined }});
var Robot  = TIN_TYPE("16f825db-c14a-4b36-8cd8-49c261b33668", (_p0,_p1,_p2,_p3) => ({version: _p0,material: _p1,tier: _p2,isFlying: _p3}), {version: { type: Number, defaultValue: undefined },material: { type: String, defaultValue: undefined },tier: { type: Number, defaultValue: undefined },isFlying: { type: Boolean, defaultValue: undefined }});
var cat /* Cat */ = Cat("Catty", 9);
var robo /* Robot */ = Robot(1.2, "Iron", 3, false);
var x /* Unknown(undefined, undefined) */ = ((1 < 2) ? (3) : (4)) ;
var mechaCat /* Cat & Robot */ = _TIN_INTERSECT_OBJECTS(cat, robo);
print(mechaCat);
print(x);
var f /* () => Unknown(undefined, undefined) */ = function() {
var ff  = function() {
var fff  = function() {
return print("Hello")
}
}
};
f()