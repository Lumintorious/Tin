function TIN_TYPE(typeId, constructor, descriptor) {
	constructor._tinFields = descriptor;
	constructor._tinTypeId = typeId;
	constructor["&"] = () => {
		throw new Error("Cannot automatically create intersection type instance. Ambiguous parameter order")
	}
	return constructor
}

const Int = Number

const print = (...args) => console.log(...args);
const Cat  = TIN_TYPE("7a5b4e69-64bb-49d6-8157-e7e6e8058345", (_p0,_p1) => ({name: _p0,age: _p1}), {name: { type: String, defaultValue: null },age: { type: Int, defaultValue: 1 }});
const Pokemon  = TIN_TYPE("9893dd58-631d-49a5-8069-6555c9eed63d", (_p0,_p1) => ({damage: _p0,health: _p1}), {damage: { type: Int, defaultValue: null },health: { type: Int, defaultValue: null }});
const add  = function(undefined, undefined/*[object Object]*/) {
const q /*Int*/ = 1 + 2;
return x + y
};
const myCat  = Cat("Kitty", 12);
((1 < 2) ? (print(32)) : (print(44))) ;
print(myCat . name)