function TIN_TYPE(typeId, constructor, descriptor) {
	constructor._tinFields = descriptor;
	constructor._tinTypeId = typeId;
	constructor["&"] = () => {
		throw new Error("Cannot automatically create intersection type instance. Ambiguous parameter order")
	}
	return constructor
}

const Int = Number

const print = (...args) => console.log(...args)