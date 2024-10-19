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
